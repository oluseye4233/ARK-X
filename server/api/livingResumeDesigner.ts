/**
 * LIVING RESUME DESIGNER — API Routes
 * Production ID: JNGL-PDD-ARKH-LRD-2026-001
 *
 * Handles wizard state management, ARK/SPC imports, entitlement checks,
 * export generation, and telemetry logging.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  livingResumeSessions,
  livingResumeExports,
  livingResumeCertificates,
  livingResumeHeadshots,
  livingResumeArkImports,
  livingResumeEntitlements,
  livingResumeTelemetry,
  lrdWizardStateSchema,
  lrdExportRequestSchema,
  lrdHonestyGateResultSchema,
  computeCompletenessHeuristic,
  validateHonestyGate,
  getEntitlementsByTier,
  LrdWizardState,
} from "../shared/livingResumeDesigner";
import { db } from "./storage";
import { eq } from "drizzle-orm";

const router = Router();

// ════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════

// Require authentication
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// Check LRD feature flag
function checkLrdFeatureFlag(req: Request, res: Response, next: Function) {
  const enabled = process.env.FEATURE_LIVING_RESUME_DESIGNER !== "false";
  if (!enabled) {
    return res.status(404).json({ message: "Not found" });
  }
  next();
}

router.use(checkLrdFeatureFlag);
router.use(requireAuth);

// ════════════════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT (LRD-101)
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/lrd/session
 * Fetch or create the user's current wizard session.
 */
router.get("/session", async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;

    // Find existing session
    let session = await db.query.livingResumeSessions.findFirst({
      where: eq(livingResumeSessions.userId, userId),
    });

    // Create if doesn't exist
    if (!session) {
      const [newSession] = await db
        .insert(livingResumeSessions)
        .values({
          userId,
          theme: "navy_gold",
          projects: [],
          aiNativeApps: [],
          methodologyTags: [],
          linkedSpcListingIds: [],
        })
        .returning();

      session = newSession;

      // Log telemetry
      await db.insert(livingResumeTelemetry).values({
        userId,
        sessionId: session.id,
        eventType: "session_started",
        payload: { theme: "navy_gold" },
      });
    }

    // Check entitlements
    const user = await db.query.users.findFirst({
      where: eq(livingResumeSessions.userId, userId),
    });

    const entitlements = getEntitlementsByTier(user?.subscriptionPlan || "INDIVIDUAL_FREE");

    res.json({
      session,
      entitlements,
    });
  } catch (err) {
    console.error("LRD session fetch error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/lrd/session
 * Update the wizard session with partial state.
 * Body: Partial<LrdWizardState>
 */
router.post("/session", async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;
    const update = req.body;

    // Validate input
    const validateUpdate = lrdWizardStateSchema.partial().parse(update);

    // Compute new completeness
    const currentSession = await db.query.livingResumeSessions.findFirst({
      where: eq(livingResumeSessions.userId, userId),
    });

    if (!currentSession) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Merge state
    const mergedState: LrdWizardState = {
      ...currentSession,
      ...validateUpdate,
    } as LrdWizardState;

    const completeness = computeCompletenessHeuristic(mergedState);

    // Update database
    const [updated] = await db
      .update(livingResumeSessions)
      .set({
        ...validateUpdate,
        completenessPercent: completeness,
        updatedAt: new Date(),
      })
      .where(eq(livingResumeSessions.userId, userId))
      .returning();

    // Log telemetry
    if (validateUpdate.projects !== currentSession.projects) {
      await db.insert(livingResumeTelemetry).values({
        userId,
        sessionId: currentSession.id,
        eventType: "card_linked",
        payload: { cardCount: validateUpdate.projects?.length || 0 },
      });
    }

    if (validateUpdate.methodologyTags !== currentSession.methodologyTags) {
      await db.insert(livingResumeTelemetry).values({
        userId,
        sessionId: currentSession.id,
        eventType: "tag_selected",
        payload: { tags: validateUpdate.methodologyTags },
      });
    }

    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid state", errors: err.errors });
    }
    console.error("LRD session update error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ARK RESUME IMPORT (LRD-301)
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/lrd/import-ark-resume
 * Pre-fill wizard with subscriber's ARK RESUME data (Domain 2 read).
 */
router.post("/import-ark-resume", async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;

    const session = await db.query.livingResumeSessions.findFirst({
      where: eq(livingResumeSessions.userId, userId),
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Fetch user's latest assessment from Domain 2 (ARK RESUME)
    const assessment = await db.query.assessments.findFirst({
      where: eq(livingResumeSessions.userId, userId),
      orderBy: (t) => t.createdAt,
    });

    if (!assessment) {
      return res.status(404).json({ message: "No ARK RESUME found" });
    }

    // Extract fields
    const prefillData = {
      fullName: assessment.candidateName,
      currentRole: assessment.currentRole,
      currentEmployer: assessment.currentEmployer,
      professionalSummary: assessment.jstTotal ? `JST Score: ${assessment.jstTotal}` : undefined,
      email: assessment.contactEmail,
      phone: assessment.contactPhone,
      linkedinUrl: assessment.linkLinkedin,
      githubUrl: assessment.linkGithub,
      portfolioUrl: assessment.linkPortfolio,
      arkScoreSnapshot: 0, // Will fetch from user table
    };

    // Get ARK Score from user record
    const user = await db.query.users.findFirst({
      where: eq(livingResumeSessions.userId, userId),
    });

    // Update session
    const [updated] = await db
      .update(livingResumeSessions)
      .set({
        ...prefillData,
        arkScoreSnapshot: user?.arkScore,
        arkResumeImported: true,
        updatedAt: new Date(),
      })
      .where(eq(livingResumeSessions.id, session.id))
      .returning();

    // Log import
    await db.insert(livingResumeArkImports).values({
      userId,
      sessionId: session.id,
      importedName: prefillData.fullName,
      importedBio: prefillData.professionalSummary,
      importedCurrentRole: prefillData.currentRole,
      importedCurrentEmployer: prefillData.currentEmployer,
      arkScoreSnapshot: user?.arkScore,
      jstIndexSnapshot: user?.jstIndex,
      importStatus: "success",
    });

    res.json(updated);
  } catch (err) {
    console.error("LRD ARK import error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// HEADSHOT UPLOAD (LRD-106)
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/lrd/upload-headshot
 * Body: { base64DataUrl, altText, cropType }
 * Returns base64 data URL (embedded directly in export).
 */
router.post("/upload-headshot", async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;
    const { base64DataUrl, altText, cropType } = req.body;

    const session = await db.query.livingResumeSessions.findFirst({
      where: eq(livingResumeSessions.userId, userId),
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Validate base64 size (≤400KB)
    if (!base64DataUrl || base64DataUrl.length > 400000) {
      return res.status(400).json({ message: "Headshot too large (≤400KB)" });
    }

    // Validate mime type
    if (!base64DataUrl.match(/^data:(image\/(jpeg|png|webp));base64,/)) {
      return res.status(400).json({ message: "Invalid image format" });
    }

    // Save headshot metadata
    const [headshot] = await db
      .insert(livingResumeHeadshots)
      .values({
        userId,
        sessionId: session.id,
        originalFilename: "headshot",
        originalMimeType: "image/jpeg",
        originalSizeBytes: base64DataUrl.length,
        base64DataUrl,
        cropType: cropType || null,
        altText: altText || "Profile photo",
      })
      .returning();

    // Update session
    await db
      .update(livingResumeSessions)
      .set({ headshotDataUrl: base64DataUrl })
      .where(eq(livingResumeSessions.id, session.id));

    res.json({ headshotId: headshot.id, dataUrl: base64DataUrl });
  } catch (err) {
    console.error("LRD headshot upload error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ENTITLEMENT CHECK (LRD-303)
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/lrd/entitlements
 * Check which LRD features are unlocked for the current user's tier.
 */
router.get("/entitlements", async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;
    const user = await db.query.users.findFirst({
      where: eq(livingResumeSessions.userId, userId),
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const entitlements = getEntitlementsByTier(user.subscriptionPlan || "INDIVIDUAL_FREE");

    res.json(entitlements);
  } catch (err) {
    console.error("LRD entitlements error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// HONESTY GATE VALIDATION (LRD-404)
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/lrd/validate-honesty-gate
 * Check wizard state against Honesty Gate before export.
 */
router.post("/validate-honesty-gate", async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;

    const session = await db.query.livingResumeSessions.findFirst({
      where: eq(livingResumeSessions.userId, userId),
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const state: LrdWizardState = session as any;
    const result = validateHonestyGate(state);

    // Save to session
    await db
      .update(livingResumeSessions)
      .set({
        lastHonestyCheck: result,
        lastHonestyCheckAt: new Date(),
      })
      .where(eq(livingResumeSessions.id, session.id));

    res.json(result);
  } catch (err) {
    console.error("LRD Honesty Gate error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// EXPORT GENERATION (LRD-105, LRD-405)
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/lrd/export
 * Generate HTML or PDF export of the resume.
 * Body: LrdExportRequest { format, includeArkScore, includeSpcPanel, ... }
 * Returns: LrdExportResponse metadata (actual HTML/PDF streamed as download)
 */
router.post("/export", async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;
    const exportRequest = lrdExportRequestSchema.parse(req.body);

    const session = await db.query.livingResumeSessions.findFirst({
      where: eq(livingResumeSessions.userId, userId),
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Validate Honesty Gate
    const honestyGate = validateHonestyGate(session as any);
    if (!honestyGate.passed) {
      return res.status(400).json({ message: "Honesty Gate failed", details: honestyGate.flags });
    }

    // Check entitlements
    const user = await db.query.users.findFirst({
      where: eq(livingResumeSessions.userId, userId),
    });

    const entitlements = getEntitlementsByTier(user?.subscriptionPlan || "INDIVIDUAL_FREE");

    // Log export initiated
    await db.insert(livingResumeTelemetry).values({
      userId,
      sessionId: session.id,
      eventType: "export_initiated",
      payload: { format: exportRequest.format },
    });

    // Generate export ID
    const exportId = `lrd-export-${Date.now()}`;

    // Record export
    const [exportRecord] = await db
      .insert(livingResumeExports)
      .values({
        userId,
        sessionId: session.id,
        format: exportRequest.format,
        completenessPercent: session.completenessPercent,
        tierAtExport: user?.subscriptionPlan,
        spcPanelEnabled: exportRequest.includeSpcPanel && entitlements.canUseSpcPanel,
        aiAppShowcaseEnabled: exportRequest.includeAiApps && entitlements.canUseAiAppShowcase,
        forgeVerifiedBadgesEnabled: entitlements.canUseForgeVerifiedBadges,
        honestyGatePassed: honestyGate.passed,
        honestyGateWarnings: honestyGate.flags.map((f) => f.message),
        telemetryEventId: exportId,
        userAgent: req.get("user-agent"),
        ipAddress: req.ip,
      })
      .returning();

    // Update session exported timestamp
    await db
      .update(livingResumeSessions)
      .set({ exportedAt: new Date() })
      .where(eq(livingResumeSessions.id, session.id));

    // Optionally generate SPARTAN certificate (LRD-402)
    if (entitlements.canUseForgeVerifiedBadges) {
      await db.insert(livingResumeCertificates).values({
        exportId: exportRecord.id,
        userId,
        sectionPopulated: ["identity", "contact", "projects"],
        completenessHeuristic: session.completenessPercent,
        badge: session.completenessPercent >= 80 ? "COMPLETE" : "DRAFT",
        certificateJson: {
          sections: {
            identity: !!session.fullName,
            contact: !!session.email,
            projects: session.projects.length > 0,
            spc: session.linkedSpcListingIds.length > 0,
            apps: session.aiNativeApps.length > 0,
          },
          completeness: session.completenessPercent,
          exportedAt: new Date().toISOString(),
        },
      });
    }

    // Log export completed
    await db.insert(livingResumeTelemetry).values({
      userId,
      sessionId: session.id,
      exportId: exportRecord.id,
      eventType: "export_completed",
      payload: { format: exportRequest.format, success: true },
    });

    // TODO: Generate HTML/PDF blob and stream
    // For now, return metadata
    res.json({
      exportId: exportRecord.id,
      format: exportRequest.format,
      completenessPercent: session.completenessPercent,
      honestyGateResult: honestyGate,
      downloadUrl: `/api/lrd/download/${exportRecord.id}`,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid export request", errors: err.errors });
    }
    console.error("LRD export error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/lrd/download/:exportId
 * Stream the generated HTML/PDF file.
 * TODO: Implement actual blob generation
 */
router.get("/download/:exportId", async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;
    const { exportId } = req.params;

    const exportRecord = await db.query.livingResumeExports.findFirst({
      where: (t) => eq(t.userId, userId) && eq(t.id, exportId),
    });

    if (!exportRecord) {
      return res.status(404).json({ message: "Export not found" });
    }

    // TODO: Generate or retrieve HTML/PDF blob
    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Living Resume</title>
    <style>
      body { font-family: sans-serif; margin: 40px; }
      h1 { color: #003366; }
    </style>
  </head>
  <body>
    <h1>Export Placeholder</h1>
    <p>Format: ${exportRecord.format}</p>
    <p>Completeness: ${exportRecord.completenessPercent}%</p>
  </body>
</html>`;

    res.set({
      "Content-Type": exportRecord.format === "pdf" ? "application/pdf" : "text/html",
      "Content-Disposition": `attachment; filename="resume.${exportRecord.format === "pdf" ? "pdf" : "html"}"`,
    });

    res.send(htmlContent);
  } catch (err) {
    console.error("LRD download error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
