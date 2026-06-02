import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const _filename = typeof __filename !== "undefined"
  ? __filename
  : typeof (import.meta as any).url === "string"
    ? fileURLToPath((import.meta as any).url)
    : process.cwd() + "/index.js";
const _require = createRequire(_filename);
const { PDFParse } = _require("pdf-parse") as { PDFParse: new (opts: { data: Uint8Array }) => { getText: () => Promise<{ text: string }> } };
import { storage } from "./storage";
import { analyzeResume } from "./resumeAnalyzer";
import { extractProfileBio, EMPTY_BIO, type ProfileBio } from "./profileExtract";
import { requireAuth, requireSelf, requireInstructor, requireInstitutionAdmin, currentUserId, loginSession } from "./auth";
import { getHrConnector, listHrConnectors } from "./hrConnectors";
import { runHrConnectionTest } from "./workforceConnectionTest";
import { runConnectorSync } from "./hrConnectors/sync";
import {
  HR_FIELD_KEYS,
  HR_FIELD_LABELS,
  HR_SYNC_DEFAULT_INTERVAL_MINUTES,
  HR_SYNC_MIN_INTERVAL_MINUTES,
  HR_SYNC_MAX_INTERVAL_MINUTES,
} from "@shared/schema";
import { requireFeature, getResolvedFeatures, isFeatureEnabled } from "./featureFlags";
import { STAGE } from "@shared/featureFlags";
import { insertUserSchema, insertAssessmentSchema, CONTEXT_CRAFT_LEVELS, type ContextCraftLevel, SUBSCRIPTION_PLANS, type SubscriptionPlan, CCGE_TIERS, type CcgeTier, jcseToTier, ALL_CARD_PILLARS, SPC_MIN_CERT_TO_PUBLISH, SPC_PRICE_MIN, SPC_PRICE_MAX, SPC_STATUSES, SPC_SCOPES, CERT_LEVEL_RANK, ARK_SCORE_DELTAS, type CardPillar, type SpcStatus, ASSESSMENT_SOURCES, PRIMARY_ASSESSMENT_SOURCES, ASSESSMENT_SOURCE_LABELS, type AssessmentSourceKey } from "@shared/schema";
import { computeCompleteness, canonicalSourcesUsed, buildCombinedText } from "@shared/assessmentMerge";
import { dealHand, scoreSession, evaluateCustomCard, blendCraftIntoFinal } from "./ccge";
import { orchestrator } from "./orchestrator";
import { recalcArkForUser } from "./arkRecalc";
import { computeLhcsForUser } from "./lhcs";
import { pickFlywheelCta, rankAllCtas } from "./flywheelCta";
import { backfillAllUsers } from "./arkBackfill";
import { scoreSessionWithClaude } from "./ai/kcse";
import { generateResumeNarrative, ProTierRequiredError } from "./ai/narrative";
import { CODEC_PRIMITIVES, CODEC_BY_ID } from "@shared/codec-primitives";
import { generateScenario } from "./ai/scenarioGen";
import { getTierStatus } from "./ai/usage";
import { isClaudeAvailable, resolveUseClaude } from "./ai/client";
import {
  isPaidPlan,
  priceCentsForPlan,
  nextPeriodEnd,
  syntheticStripeCheckoutId,
} from "./billing";
import { seedCcge } from "./ccgeSeed";
import { runHivePrecheck, executePurchase, getOrCreateCredits } from "./sphinx";
import {
  calculateSynergy,
  recomputeComplementaryFor,
  getComplementaryForListing,
  getTopPairsPlatform,
  recomputeRoundtable,
  getRoundtableSnapshot,
  listNotifications,
  countUnread,
  markNotificationsRead,
} from "./sphinxSynergy";
import { seedJnomicsExpansion } from "./jnomicsSeed";
import { analyzeSpcListing, SpcAnalysisProTierRequiredError } from "./ai/spcAnalysis";
import { categoryToPillars, MARKETPLACE_CATEGORIES, type MarketplaceCategory, hiveToTierBadge } from "@shared/schema";
import { buildGuinProfile, validateEndorsement } from "./guin";
import { ENDORSEMENT_MAX_LEN } from "@shared/schema";
import { registerBadgeRoutes } from "./badge/routes";
import { renderChapterBadgePng } from "./badge/chapter";
import {
  resolveSlugDestination,
  slugDirectory,
  getNodeById,
  BOOK_TITLE,
} from "@shared/bookCompanion";
import { buildJourney, buildLedger, captureLedgerSnapshot } from "./bookCompanion";
import rateLimit from "express-rate-limit";
import { z } from "zod";

// Book Companion chapter badge art is generic (no PII) and identical for every
// reader, so a tiny process-memory cache keyed by nodeId fully covers it.
const bookBadgeCache = new Map<string, Buffer>();
const bookBadgeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many badge renders, please slow down." },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "text/plain"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Dedicated uploader for HR-roster CSV imports (Task #25). Browsers report CSV
// under several mimetypes (text/csv, application/vnd.ms-excel, octet-stream),
// so we accept the common set and re-validate the content downstream.
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "text/csv",
      "text/plain",
      "application/csv",
      "application/vnd.ms-excel",
      "application/octet-stream",
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Public CCGE badge renderer + share page ───────────
  registerBadgeRoutes(app);

  // ── Flywheel SSE stream ───────────────────────────────
  app.get("/api/ark-score/stream", requireAuth, async (req, res) => {
    const userId = currentUserId(req)!;
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    const recent = await orchestrator.getRecentEvents(userId, 10);
    const latest = await storage.getLatestAssessment(userId);
    const u = await storage.getUser(userId);
    res.write(`event: ark.snapshot\ndata: ${JSON.stringify({
      jstTotal: latest?.jstTotal ?? 0,
      jstSkills: latest?.jstSkills ?? 0,
      arkScore: u?.arkScore ?? 0,
      ccmi: u?.ccmi ?? 0,
      ccmiTier: u?.ccmiTier ?? "T0",
      vmstLevel: u?.vmstLevel ?? "L0",
      arkIdString: u?.arkIdString ?? null,
      lhcsStatus: u?.lhcsStatus ?? "red",
      recent,
    })}\n\n`);

    const unsubscribe = orchestrator.subscribe(userId, res);
    const heartbeat = setInterval(() => {
      try { res.write(": heartbeat\n\n"); } catch {}
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      try { res.end(); } catch {}
    });
  });

  app.get("/api/ark-score/events", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const events = await orchestrator.getRecentEvents(userId, 10);
      return res.json(events);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── AI / Claude ───────────────────────────────────────
  app.get("/api/ai/status", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const user = await storage.getUser(userId);
      const plan = (user?.subscriptionPlan as SubscriptionPlan) || "INDIVIDUAL_FREE";
      const status = await getTierStatus(userId, plan);
      return res.json({ available: isClaudeAvailable(), plan, ...status });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/ai/resume-narrative/:assessmentId", requireFeature("claudeNarrative"), requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const a = await storage.getAssessment(String(req.params.assessmentId));
      if (!a) return res.status(404).json({ message: "Assessment not found" });
      if (a.userId !== userId) return res.status(403).json({ message: "You may only generate narratives for your own assessments." });
      const user = await storage.getUser(userId);
      const plan = (user?.subscriptionPlan as SubscriptionPlan) || "INDIVIDUAL_FREE";
      const narrative = await generateResumeNarrative({ userId, plan, assessment: a });
      return res.json(narrative);
    } catch (err: any) {
      console.error("Resume narrative error:", err);
      const status = err.status || (err instanceof ProTierRequiredError ? 402 : 500);
      return res.status(status).json({ message: err.message });
    }
  });

  app.post("/api/admin/ai/generate-scenario", requireFeature("customScenarios"), requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const adminId = process.env.ADMIN_USER_ID;
      if (!adminId || userId !== adminId) {
        return res.status(403).json({ message: "Admin only." });
      }
      const schema = z.object({ brief: z.string().min(10).max(800), persist: z.boolean().optional() });
      const p = schema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ message: "brief required (10–800 chars)" });
      const user = await storage.getUser(userId);
      const plan = (user?.subscriptionPlan as SubscriptionPlan) || "ENTERPRISE";
      const scenario = await generateScenario({ userId, plan, brief: p.data.brief });
      if (p.data.persist) {
        const saved = await storage.upsertCcgeScenario(scenario);
        return res.status(201).json({ scenario: saved, persisted: true });
      }
      return res.json({ scenario, persisted: false });
    } catch (err: any) {
      console.error("Scenario gen error:", err);
      return res.status(err.status || 500).json({ message: err.message });
    }
  });

  // ── Auth ──────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      const { verifyPassword, hashPassword } = await import("./passwords");
      const { ok, needsRehash } = await verifyPassword(password, user.password);
      if (!ok) return res.status(401).json({ message: "Invalid credentials" });
      // Phase G: convert any pending `invite:<email>` cohort memberships into
      // real memberships keyed by this user's id, best-effort.
      try { await storage.reconcileCohortInvitesForUser(user.id, user.username); } catch {}
      // Task #25: auto-link any invited staff records matching this email.
      try { await storage.reconcileStaffInvitesForUser(user.id, user.username); } catch {}
      // Silently upgrade legacy plaintext rows to bcrypt on first successful
      // login so we drain pre-existing rows without forcing a password reset.
      if (needsRehash) {
        try {
          const fresh = await hashPassword(password);
          // storage.updateUser detects bcrypt prefix and passes through.
          await storage.updateUser(user.id, { password: fresh });
        } catch {
          /* best-effort; login still succeeds even if rehash write fails */
        }
      }
      await loginSession(req, user.id);
      const { password: _, ...safeUser } = user;
      return res.json(safeUser);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      // Phase G hardening: `role` is privilege-bearing (read by requireInstructor),
      // so it is stripped from any self-service registration payload and forced to
      // "student". Elevation to instructor/admin happens only via admin/seed paths.
      const registerSchema = insertUserSchema.omit({ role: true });
      const parsed = registerSchema.parse(req.body);
      const existing = await storage.getUserByUsername(parsed.username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }
      const user = await storage.createUser({ ...parsed, role: "student" });
      try { await storage.reconcileCohortInvitesForUser(user.id, user.username); } catch {}
      // Task #25: auto-link any invited staff records matching this email.
      try { await storage.reconcileStaffInvitesForUser(user.id, user.username); } catch {}
      await loginSession(req, user.id);
      const { password: _, ...safeUser } = user;
      return res.status(201).json(safeUser);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("ark.sid");
      return res.json({ ok: true });
    });
  });

  // ── GDPR ──────────────────────────────────────────────
  app.get("/api/users/me/export", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const dump = await storage.exportUserData(userId);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="ark-export-${userId}.json"`);
      return res.send(JSON.stringify(dump, null, 2));
    } catch (err: any) {
      const status = err.status || 500;
      if (status >= 500) console.error("Export error:", err);
      return res.status(status).json({ message: err.message });
    }
  });

  app.delete("/api/users/me", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const confirm = (req.body?.confirm as string) || (req.query?.confirm as string);
      if (confirm !== "DELETE") {
        return res.status(400).json({ message: 'Pass {"confirm":"DELETE"} to permanently delete your account.' });
      }
      const result = await storage.deleteUserCascade(userId);
      await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
      res.clearCookie("ark.sid");
      return res.json({ ok: true, ...result });
    } catch (err: any) {
      const status = err.status || 500;
      if (status >= 500) console.error("Delete error:", err);
      return res.status(status).json({ message: err.message });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const sid = currentUserId(req);
    if (!sid) return res.status(401).json({ message: "Not authenticated." });
    const user = await storage.getUser(sid);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Session user no longer exists." });
    }
    const { password: _, ...safeUser } = user;
    const adminId = process.env.ADMIN_USER_ID;
    const isAdmin = !!adminId && user.id === adminId;
    return res.json({ ...safeUser, isAdmin });
  });

  // ── Users ─────────────────────────────────────────────
  // Public DTO — only fields safe to expose to anyone (no email/username,
  // no subscription/institution metadata). Private full record is only
  // available to the user themselves via /api/auth/me.
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(String(req.params.id));
      if (!user) return res.status(404).json({ message: "User not found" });
      const sid = currentUserId(req);
      if (sid === user.id) {
        const { password: _, ...safeUser } = user;
        return res.json(safeUser);
      }
      return res.json({
        id: user.id,
        name: user.name,
        role: user.role,
        contextCraftCertLevel: user.contextCraftCertLevel,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Profile Update ──────────────────────────────────
  app.put("/api/users/:id/profile", requireSelf("id"), async (req, res) => {
    try {
      // Use an explicit literal mapping instead of bracket-indexing req.body
      // with a loop variable — satisfies the SAST prototype-pollution rule
      // (semgrep js.express.security.audit.remote-property-injection) and
      // makes the allowlist trivially auditable.
      const body = req.body ?? {};
      const updateData: Record<string, unknown> = {};
      if (typeof body.name === "string") updateData.name = body.name;
      // Phase G hardening: role is privilege-bearing (requireInstructor reads it),
      // so it is NEVER self-editable. Role changes must go through an admin path.
      if (typeof body.department === "string") updateData.department = body.department;
      if (typeof body.seniority === "string") updateData.seniority = body.seniority;
      if (typeof body.location === "string") updateData.location = body.location;
      const updated = await storage.updateUser(String(req.params.id), updateData);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = updated;
      return res.json(safeUser);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Email Notifications ────────────────────────────
  app.post("/api/notifications/assessment-summary", requireFeature("assessmentEmail"), requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "email is required" });
      }
      const assessment = await storage.getLatestAssessment(userId);
      if (!assessment) {
        return res.status(404).json({ message: "No assessment found for this user" });
      }
      return res.json({
        success: true,
        message: `Assessment summary will be sent to ${email}`,
        preview: {
          subject: `Your ARK JST Assessment Summary — Score: ${assessment.jstTotal}/300`,
          recipient: email,
          jstTotal: assessment.jstTotal,
          readinessProfile: assessment.readinessProfile,
          vulnerabilityLevel: assessment.vulnerabilityLevel,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Context Craft Certification ──────────────────────
  const validCertLevels = z.enum(Object.keys(CONTEXT_CRAFT_LEVELS) as [string, ...string[]]);

  // Cert level is computed by the game-finish flywheel; clients may NOT set
  // it directly. Kept as a no-op endpoint that always 403s for back-compat.
  app.put("/api/users/:id/context-craft-cert", (_req, res) => {
    return res.status(403).json({
      message: "Certification level can only be earned through CCGE Arena play, not set directly.",
    });
  });

  // (legacy handler retained below but unreachable; kept for type-checks only)
  const _unusedCertHandler = async (req: any, res: any) => {
    try {
      const parsed = validCertLevels.safeParse(req.body?.level);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid certification level",
          validLevels: Object.keys(CONTEXT_CRAFT_LEVELS),
        });
      }
      const level = parsed.data;
      const updated = await storage.updateUser(String(req.params.id), {
        contextCraftCertLevel: level,
      });
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = updated;
      return res.json(safeUser);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  };
  void _unusedCertHandler;

  app.get("/api/context-craft/levels", (_req, res) => {
    return res.json(CONTEXT_CRAFT_LEVELS);
  });

  // ── Subscription Plans ─────────────────────────────────
  const validSubscriptionPlans = z.enum(Object.keys(SUBSCRIPTION_PLANS) as [string, ...string[]]);

  app.get("/api/subscription/plans", (_req, res) => {
    return res.json(SUBSCRIPTION_PLANS);
  });

  // Legacy direct-update endpoint — ADMIN ONLY (ENTERPRISE custom-deal provisioning).
  // All self-serve plan transitions must flow through /api/billing/checkout.
  app.put("/api/users/:id/subscription", requireAuth, async (req, res) => {
    try {
      const adminId = process.env.ADMIN_USER_ID;
      const callerId = currentUserId(req)!;
      if (!adminId || callerId !== adminId) {
        return res.status(403).json({ message: "Admin only. Use POST /api/billing/checkout for self-serve plan changes.", endpoint: "/api/billing/checkout" });
      }
      const parsed = validSubscriptionPlans.safeParse(req.body?.plan);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid subscription plan", validPlans: Object.keys(SUBSCRIPTION_PLANS) });
      }
      const plan = parsed.data as SubscriptionPlan;
      if (plan !== "ENTERPRISE") {
        return res.status(409).json({ message: "Admin endpoint reserved for ENTERPRISE provisioning. Use /api/billing/checkout otherwise.", endpoint: "/api/billing/checkout" });
      }
      const target = await storage.getUser(String(req.params.id));
      if (!target) return res.status(404).json({ message: "User not found" });
      const fromPlan = (target.subscriptionPlan as SubscriptionPlan) || "INDIVIDUAL_FREE";
      const updated = await storage.updateUser(String(req.params.id), {
        subscriptionPlan: plan, subscriptionStatus: "active",
      } as any);
      await storage.createBillingEvent({
        userId: target.id, type: "subscription.upgraded",
        fromPlan, toPlan: plan, amountCents: 0,
        externalId: null,
        payload: { source: "admin.enterprise.provision", actorAdminId: adminId },
      });
      const { password: _, ...safeUser } = updated!;
      return res.json(safeUser);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Billing (Stub Stripe) ─────────────────────────────
  app.get("/api/billing/me", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const events = await storage.getBillingEventsByUser(userId, 10);
      return res.json({
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus,
        currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
        canceledAt: user.subscriptionCanceledAt,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        recentEvents: events,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/billing/checkout", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const schema = z.object({
        plan: validSubscriptionPlans,
        institution: z.string().min(1).max(120).optional(),
      });
      const p = schema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ message: "plan required", validPlans: Object.keys(SUBSCRIPTION_PLANS) });
      const plan = p.data.plan as SubscriptionPlan;
      const fromPlan = (user.subscriptionPlan as SubscriptionPlan) || "INDIVIDUAL_FREE";

      if (plan === "ENTERPRISE") {
        return res.status(409).json({ message: "Enterprise requires a sales contact, not self-checkout." });
      }
      if (plan === fromPlan && user.subscriptionStatus === "active" && !user.subscriptionCanceledAt) {
        return res.status(409).json({ message: `Already on ${plan}.` });
      }
      const planData = SUBSCRIPTION_PLANS[plan];
      if (planData.type === "school" && !p.data.institution && !user.institution) {
        return res.status(400).json({ message: "Institution name required for School plan." });
      }

      const amountCents = priceCentsForPlan(plan);
      const session = await storage.createCheckoutSession({
        userId,
        plan,
        amountCents,
        status: "pending",
        institution: planData.type === "school" ? (p.data.institution || user.institution || null) : null,
        externalSessionId: null,
      });
      const externalSessionId = syntheticStripeCheckoutId(session.id);
      await storage.updateCheckoutSession(session.id, { externalSessionId });
      await storage.createBillingEvent({
        userId,
        type: "checkout.created",
        fromPlan,
        toPlan: plan,
        amountCents,
        externalId: externalSessionId,
        payload: { sessionId: session.id, simulated: true },
      });

      // Free plan auto-completes (no card needed) — caller will hit /complete next.
      return res.status(201).json({
        sessionId: session.id,
        externalSessionId,
        plan,
        amountCents,
        requiresPayment: amountCents > 0,
        redirectUrl: `/checkout/${session.id}`,
      });
    } catch (err: any) {
      console.error("Billing checkout error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/billing/checkout/:id", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const session = await storage.getCheckoutSession(String(req.params.id));
      if (!session) return res.status(404).json({ message: "Checkout session not found" });
      if (session.userId !== userId) return res.status(403).json({ message: "Not your checkout session." });
      return res.json(session);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/billing/checkout/:id/complete", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;

      const result = await storage.completeCheckoutSession({
        sessionId: String(req.params.id),
        actorUserId: userId,
        success: true,
      });

      if (!result.ok) {
        await orchestrator.emit(userId, "billing.payment.failed", {
          plan: result.toPlan, amountCents: result.amountCents,
        }, 0);
        return res.status(402).json({ ok: false, message: "Payment failed (simulated)." });
      }
      await orchestrator.emit(userId, "billing.checkout.completed", {
        fromPlan: result.fromPlan, toPlan: result.toPlan,
        amountCents: result.amountCents, transition: result.transition,
      }, 0);
      const { password: _, ...safeUser } = result.user as any;
      return res.json({ ok: true, user: safeUser, session: result.session });
    } catch (err: any) {
      const status = err.status || 500;
      if (status >= 500) console.error("Billing complete error:", err);
      return res.status(status).json({ message: err.message });
    }
  });

  app.post("/api/billing/cancel", requireFeature("subscriptionCancel"), requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const plan = (user.subscriptionPlan as SubscriptionPlan) || "INDIVIDUAL_FREE";
      if (!isPaidPlan(plan)) return res.status(409).json({ message: "Nothing to cancel on a free plan." });
      if (user.subscriptionCanceledAt) return res.status(409).json({ message: "Already scheduled for cancellation." });

      const now = new Date();
      const periodEnd = user.subscriptionCurrentPeriodEnd || nextPeriodEnd(now);
      await storage.updateUser(userId, {
        subscriptionStatus: "canceling",
        subscriptionCanceledAt: now,
        subscriptionCurrentPeriodEnd: periodEnd,
      } as any);
      await storage.createBillingEvent({
        userId,
        type: "subscription.canceled",
        fromPlan: plan,
        toPlan: "INDIVIDUAL_FREE",
        amountCents: 0,
        externalId: user.stripeSubscriptionId,
        payload: { effectiveAt: periodEnd.toISOString(), simulated: true },
      });
      await orchestrator.emit(userId, "billing.subscription.canceled", {
        plan, effectiveAt: periodEnd.toISOString(),
      }, 0);
      return res.json({ ok: true, effectiveAt: periodEnd });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Admin-only webhook simulator: lets us trigger Stripe-like events for testing.
  app.post("/api/admin/billing/webhook-simulate", requireAuth, async (req, res) => {
    try {
      const adminId = process.env.ADMIN_USER_ID;
      const userId = currentUserId(req)!;
      if (!adminId || userId !== adminId) return res.status(403).json({ message: "Admin only." });

      const schema = z.object({
        targetUserId: z.string(),
        type: z.enum(["payment.failed", "subscription.canceled", "subscription.deleted"]),
      });
      const p = schema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ message: "targetUserId + type required" });

      const target = await storage.getUser(p.data.targetUserId);
      if (!target) return res.status(404).json({ message: "Target user not found" });
      const fromPlan = (target.subscriptionPlan as SubscriptionPlan) || "INDIVIDUAL_FREE";

      if (p.data.type === "payment.failed") {
        await storage.updateUser(target.id, { subscriptionStatus: "past_due" } as any);
        await storage.createBillingEvent({
          userId: target.id, type: "payment.failed", fromPlan, toPlan: fromPlan,
          amountCents: priceCentsForPlan(fromPlan), externalId: target.stripeSubscriptionId,
          payload: { simulated: true, source: "admin.webhook" },
        });
        await orchestrator.emit(target.id, "billing.payment.failed", { plan: fromPlan }, 0);
      } else {
        await storage.updateUser(target.id, {
          subscriptionPlan: "INDIVIDUAL_FREE", subscriptionStatus: "active",
          subscriptionCanceledAt: null, subscriptionCurrentPeriodEnd: null, stripeSubscriptionId: null,
        } as any);
        await storage.createBillingEvent({
          userId: target.id, type: "subscription.canceled", fromPlan, toPlan: "INDIVIDUAL_FREE",
          amountCents: 0, externalId: target.stripeSubscriptionId,
          payload: { simulated: true, source: "admin.webhook" },
        });
        await orchestrator.emit(target.id, "billing.subscription.canceled", { plan: fromPlan, immediate: true }, 0);
      }
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Assessments ───────────────────────────────────────
  app.post("/api/assessments", requireAuth, async (req, res) => {
    try {
      const sid = currentUserId(req)!;
      const { assessment, upskillingPlans, pivotOpportunities, transferabilityVectors } = req.body;
      const created = await storage.createAssessment({ ...assessment, userId: sid });

      let plans: any[] = [];
      let pivots: any[] = [];
      let vectors: any[] = [];

      if (upskillingPlans?.length) {
        plans = await storage.createUpskillingPlans(
          upskillingPlans.map((p: any) => ({ ...p, assessmentId: created.id }))
        );
      }
      if (pivotOpportunities?.length) {
        pivots = await storage.createPivotOpportunities(
          pivotOpportunities.map((p: any) => ({ ...p, assessmentId: created.id }))
        );
      }
      if (transferabilityVectors?.length) {
        vectors = await storage.createTransferabilityVectors(
          transferabilityVectors.map((v: any) => ({ ...v, assessmentId: created.id }))
        );
      }

      // Recompute ARK identity from the just-persisted assessment first,
      // then emit so the SSE broadcast that subscribers may trigger off
      // assessment.completed reflects the new identity values. Mirrors the
      // resume-upload ordering for consistent live-update behavior.
      try {
        const { recalcArkForUser } = await import("./arkRecalc");
        const recalc = await recalcArkForUser({
          userId: sid,
          trigger: "assessment.completed",
          triggerMeta: { assessmentId: created.id, source: "POST /api/assessments" },
        });
        orchestrator.broadcastIdentity(sid, recalc);
      } catch (recalcErr) {
        console.error("[/api/assessments] recalc failed (best-effort):", recalcErr);
      }

      await orchestrator.emit(sid, "assessment.completed", {
        assessmentId: created.id,
        jstTotal: created.jstTotal,
      }, 0);

      return res.status(201).json({
        ...created,
        upskillingPlans: plans,
        pivotOpportunities: pivots,
        transferabilityVectors: vectors,
      });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/assessments/user/:userId", requireSelf("userId"), async (req, res) => {
    try {
      const results = await storage.getAssessmentsByUser(String(req.params.userId));
      return res.json(results);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/assessments/user/:userId/latest", requireSelf("userId"), async (req, res) => {
    try {
      const assessment = await storage.getLatestAssessment(String(req.params.userId));
      if (!assessment) return res.status(404).json({ message: "No assessment found" });
      
      const [plans, pivots, vectors] = await Promise.all([
        storage.getUpskillingPlansByAssessment(assessment.id),
        storage.getPivotsByAssessment(assessment.id),
        storage.getVectorsByAssessment(assessment.id),
      ]);

      return res.json({
        ...assessment,
        upskillingPlans: plans,
        pivotOpportunities: pivots,
        transferabilityVectors: vectors,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Resume Upload & Analysis ────────────────────────
  app.post("/api/resume/upload", requireAuth, upload.single("resume"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded. Accepted formats: PDF, TXT." });
      }

      let resumeText = "";

      if (file.mimetype === "application/pdf") {
        let pdfTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
        const pdfTimeout = new Promise<never>((_, reject) => {
          pdfTimeoutHandle = setTimeout(() => reject(new Error("PDF parsing timed out")), 15_000);
        });
        let pdfData: { text: string };
        try {
          const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
          pdfData = await Promise.race([parser.getText(), pdfTimeout]);
          clearTimeout(pdfTimeoutHandle);
        } catch (parseErr: any) {
          clearTimeout(pdfTimeoutHandle);
          if (parseErr.message === "PDF parsing timed out") {
            return res.status(422).json({ message: "The uploaded PDF took too long to process. Please try a smaller or simpler file." });
          }
          throw parseErr;
        }
        resumeText = pdfData.text;
      } else if (file.mimetype === "text/plain") {
        resumeText = file.buffer.toString("utf-8");
      } else {
        resumeText = file.buffer.toString("utf-8");
      }

      if (!resumeText || resumeText.trim().length < 50) {
        return res.status(422).json({ message: "Could not extract enough text from the uploaded file. Please try a different format." });
      }

      const userId = currentUserId(req)!;
      const payload = await contributeSource(userId, "resume", resumeText);
      return res.status(201).json(payload);
    } catch (err: any) {
      console.error("Resume upload error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DRM Telemetry ─────────────────────────────────────
  // Best-effort sink for client-side DRM events fired by DrmBoundary
  // (copy/cut/paste/contextmenu/hotkey blocks). Logged for audit; we don't
  // persist a dedicated table since the volume is high and the value of
  // each individual event is low — aggregate counts in logs are enough to
  // flag suspicious sessions. Endpoint is auth-optional so the beacon can
  // still fire on an expired session, but unauthenticated events are tagged.
  //
  // Two abuse surfaces are mitigated here:
  //   1) Log flooding — naive clients (or attackers) could fire thousands
  //      of events per second. We rate-limit to DRM_RATE_MAX events per
  //      DRM_RATE_WINDOW_MS per origin key (userId or IP for anon).
  //   2) Log injection — string fields are user-controlled and go straight
  //      to console.log. We strip control chars and cap length so attackers
  //      can't forge fake log lines via embedded \n / \r.
  const DRM_RATE_WINDOW_MS = 10_000;
  const DRM_RATE_MAX = 60;
  const drmRateBuckets = new Map<string, { count: number; windowStart: number }>();

  // Ring buffer of recent DRM violations so an admin can see who is hammering
  // the copy-block at /api/admin/drm/violators. We cap at 2k entries (~< 1MB
  // memory) and drop the oldest when full. Not persisted — restarts wipe it,
  // which is fine for a security signal that's already mirrored in stdout.
  const DRM_EVENT_BUFFER_MAX = 2000;
  const drmEventBuffer: Array<{
    userId: string;
    contentType: string;
    contentId: string;
    action: string;
    ts: number;
  }> = [];

  function sanitizeDrmField(value: string, maxLen = 80): string {
    // Strip control chars (\n, \r, \t, escape, etc.) so a crafted payload
    // can't inject newlines and forge additional log lines.
    return value.replace(/[\x00-\x1f\x7f]/g, "?").slice(0, maxLen);
  }

  app.post("/api/drm/event", requireFeature("drm"), async (req, res) => {
    try {
      const { contentId, contentType, action, ts } = req.body ?? {};
      if (
        typeof contentId !== "string" ||
        typeof contentType !== "string" ||
        typeof action !== "string"
      ) {
        return res.status(400).json({ message: "Invalid DRM event payload." });
      }
      const userId = currentUserId(req) ?? "anon";
      const rateKey = userId !== "anon" ? `u:${userId}` : `ip:${req.ip ?? "?"}`;
      const now = Date.now();
      const bucket = drmRateBuckets.get(rateKey);
      if (!bucket || now - bucket.windowStart > DRM_RATE_WINDOW_MS) {
        drmRateBuckets.set(rateKey, { count: 1, windowStart: now });
      } else {
        bucket.count += 1;
        if (bucket.count > DRM_RATE_MAX) {
          // Silently drop — beacon clients ignore the response anyway, and
          // we don't want to give the abuser feedback on the limit.
          return res.status(204).end();
        }
      }
      // Lazy GC of the rate map to keep memory bounded under churn.
      if (drmRateBuckets.size > 5_000) {
        Array.from(drmRateBuckets.entries()).forEach(([k, v]) => {
          if (now - v.windowStart > DRM_RATE_WINDOW_MS * 2) drmRateBuckets.delete(k);
        });
      }
      // Single-line structured log so it can be grep'd / piped to a SIEM.
      const safeUser = sanitizeDrmField(userId, 64);
      const safeType = sanitizeDrmField(contentType, 32);
      const safeId = sanitizeDrmField(contentId, 64);
      const safeAction = sanitizeDrmField(action, 32);
      const safeTs = typeof ts === "number" ? ts : now;
      console.log(
        `[drm] user=${safeUser} type=${safeType} id=${safeId} action=${safeAction} ts=${safeTs}`,
      );
      // Mirror into the in-memory ring buffer for the admin endpoint.
      drmEventBuffer.push({
        userId: safeUser,
        contentType: safeType,
        contentId: safeId,
        action: safeAction,
        ts: safeTs,
      });
      if (drmEventBuffer.length > DRM_EVENT_BUFFER_MAX) {
        drmEventBuffer.splice(0, drmEventBuffer.length - DRM_EVENT_BUFFER_MAX);
      }
      return res.status(204).end();
    } catch (err: any) {
      console.error("[/api/drm/event] error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // Admin-only aggregation over the ring buffer. Returns the top N
  // (userId, contentType) pairs by violation count in the last 24h, plus
  // the raw recent-events tail. Lets ops spot scrapers without standing
  // up a full SIEM pipeline.
  app.get("/api/admin/drm/violators", requireFeature("drm"), requireAuth, async (req, res) => {
    try {
      const callerId = currentUserId(req)!;
      const adminId = process.env.ADMIN_USER_ID;
      if (!adminId || callerId !== adminId) {
        return res.status(403).json({ message: "Admin only." });
      }
      const windowMs = 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - windowMs;
      const recent = drmEventBuffer.filter((e) => e.ts >= cutoff);
      const counts = new Map<string, { userId: string; contentType: string; count: number; lastTs: number }>();
      for (const e of recent) {
        const k = `${e.userId}::${e.contentType}`;
        const cur = counts.get(k);
        if (cur) {
          cur.count += 1;
          if (e.ts > cur.lastTs) cur.lastTs = e.ts;
        } else {
          counts.set(k, { userId: e.userId, contentType: e.contentType, count: 1, lastTs: e.ts });
        }
      }
      const violators = Array.from(counts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 25);
      return res.json({
        windowMs,
        totalEvents: recent.length,
        bufferSize: drmEventBuffer.length,
        bufferCap: DRM_EVENT_BUFFER_MAX,
        violators,
        recentTail: recent.slice(-50).reverse(),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Self-Assessment & LinkedIn Text Intake ────────────
  // Single endpoint that runs the same analysis pipeline as /api/resume/upload
  // but takes raw text + a source tag instead of a binary file. Lets us pipe
  // self-assessment questionnaires and pasted LinkedIn profiles through the
  // exact same JST/CCMI/recalc flow with zero duplication.
  app.post("/api/assessment/text", requireAuth, async (req, res) => {
    try {
      const { text, source } = req.body ?? {};
      // Text-intake sources are the non-file primary sources plus the
      // archetype quiz. "resume" arrives via the file-upload route only.
      const allowedSources = ["self", "linkedin", "quiz"] as const;
      if (typeof text !== "string" || text.trim().length < 50) {
        return res.status(400).json({
          message: "Please provide at least 50 characters of profile content so we can build a meaningful assessment.",
        });
      }
      if (!allowedSources.includes(source)) {
        return res.status(400).json({ message: "Invalid assessment source." });
      }
      const userId = currentUserId(req)!;
      const payload = await contributeSource(userId, source as AssessmentSourceKey, text);
      return res.status(201).json(payload);
    } catch (err: any) {
      console.error("[/api/assessment/text] error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // Sources contributed so far + the resulting completeness/confidence meter.
  // Powers the additive intake UI (which cards are "done") and the dashboard /
  // report attribution surfaces.
  app.get("/api/assessment/sources", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const rows = await storage.getAssessmentSources(userId);
      const present = new Set(rows.map((r) => r.source));
      const sources = ASSESSMENT_SOURCES.map((key) => {
        const row = rows.find((r) => r.source === key);
        return {
          source: key,
          label: ASSESSMENT_SOURCE_LABELS[key],
          present: present.has(key),
          primary: (PRIMARY_ASSESSMENT_SOURCES as readonly string[]).includes(key),
          updatedAt: row?.updatedAt ?? null,
        };
      });
      const completeness = computeCompleteness(present);
      return res.json({
        sources,
        completeness,
        sourcesUsed: canonicalSourcesUsed(present),
      });
    } catch (err: any) {
      console.error("[/api/assessment/sources] error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // Remove one contributed source then rebuild the user's single evolving ARK
  // profile from whatever sources remain — the inverse of contributeSource.
  // Lets a user drop a stale/incorrect input (e.g. an old resume) and have the
  // report, sourcesUsed attribution, completeness meter, and ARK re-derive
  // accordingly. Removing the last source re-runs the merge over an empty input
  // so the profile honestly reflects that no sources feed it anymore.
  app.delete("/api/assessment/sources/:source", requireAuth, async (req, res) => {
    try {
      const source = req.params.source as AssessmentSourceKey;
      if (!(ASSESSMENT_SOURCES as readonly string[]).includes(source)) {
        return res.status(400).json({ message: "Invalid assessment source." });
      }
      const userId = currentUserId(req)!;
      const removed = await storage.deleteAssessmentSource(userId, source);
      if (!removed) {
        return res.status(404).json({ message: "That source hasn't been contributed." });
      }
      const payload = await runCumulativeAssessment(
        userId,
        source,
        `cumulative:remove:${source}`,
      );
      return res.json({ ...payload, removed: source });
    } catch (err: any) {
      console.error("[/api/assessment/sources DELETE] error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // Persist one source's raw text then rebuild the user's single evolving ARK
  // profile from EVERY source they've contributed. This is what makes the three
  // intake methods cumulative rather than mutually exclusive: re-submitting one
  // source updates only its row and preserves the others.
  async function contributeSource(
    userId: string,
    source: AssessmentSourceKey,
    content: string,
  ): Promise<any> {
    await storage.upsertAssessmentSource(userId, source, content);
    return runCumulativeAssessment(userId, source);
  }

  // Gather all of a user's contributed source texts, concatenate them into one
  // combined document (with per-source headers so the keyword analyzer reads
  // them coherently), and run the full analyze→persist→recalc→narrative
  // pipeline once over the merged input. Records which sources fed the result
  // (`sourcesUsed`) and the completeness meter on the persisted assessment.
  async function runCumulativeAssessment(
    userId: string,
    primarySource: AssessmentSourceKey,
    sourceTagOverride?: string,
  ): Promise<any> {
      const user = await storage.getUser(userId);
      const certLevel = (user?.contextCraftCertLevel as ContextCraftLevel) || "NONE";
      const userPlan = (user?.subscriptionPlan as SubscriptionPlan) || "INDIVIDUAL_FREE";

      const sourceRows = await storage.getAssessmentSources(userId);
      const present = new Set(sourceRows.map((r) => r.source));
      // Canonical order so the combined document and sourcesUsed list are stable
      // regardless of the order sources were contributed in.
      const sourcesUsed = canonicalSourcesUsed(present);
      const completeness = computeCompleteness(present);
      const sourceTag = sourceTagOverride ?? `cumulative:${primarySource}`;

      const combinedText = buildCombinedText(sourceRows);

      // Empty-input branch: the user has removed every contributed source.
      // Running the keyword analyzer over an empty document clamps to misleading
      // "floor baseline" JST/ARK scores, implying a weak-but-real profile when
      // in truth NO source feeds it. Persist an honest zeroed assessment
      // (sourcesUsed=[] / completeness=0) and sync ARK identity downward so the
      // dashboard and ARK Report can render an explicit "no sources contributed
      // yet" empty state. Re-adding any source returns to the full pipeline.
      if (sourceRows.length === 0) {
        const shell = analyzeResume("", certLevel);
        const created = await storage.createAssessment({
          ...shell.assessment,
          userId,
          jstTotal: 0,
          jstJobs: 0,
          jstSkills: 0,
          jstTalent: 0,
          jstRawTotal: 0,
          jstRawJobs: 0,
          jstRawSkills: 0,
          jstRawTalent: 0,
          vulnerabilityLevel: 0,
          riskModifiers: [],
          matchedCardIds: [],
          automationMilestones: [],
          sourcesUsed,
          completeness,
        });

        let emptyRecalc: Awaited<ReturnType<typeof recalcArkForUser>> | null = null;
        try {
          emptyRecalc = await recalcArkForUser({
            userId,
            trigger: "assessment.completed",
            triggerMeta: { assessmentId: created.id, source: sourceTag },
            freshScores: {
              categoryScores: {
                technical: 0,
                leadership: 0,
                analytical: 0,
                communication: 0,
                innovation: 0,
                ai_adjacent: 0,
              },
              avgAutomation: 0,
            },
          });
        } catch (recalcErr) {
          console.error(`[${sourceTag}] empty-input recalc failed (best-effort):`, recalcErr);
        }

        await orchestrator.emit(userId, "assessment.completed", {
          assessmentId: created.id,
          jstTotal: 0,
        }, 0);

        return {
          ...created,
          upskillingPlans: [],
          pivotOpportunities: [],
          transferabilityVectors: [],
          extractedTextLength: 0,
          sourcesUsed,
          completeness,
          empty: true,
          identity: emptyRecalc
            ? {
                arkScore: emptyRecalc.snapshot.arkScore,
                jstIndex: emptyRecalc.snapshot.jstIndex,
                ccmi: emptyRecalc.snapshot.ccmi,
                ccmiTier: emptyRecalc.snapshot.ccmiTier,
                ccmiTierLabel: emptyRecalc.snapshot.ccmiTierLabel,
                ccmiMultiplier: emptyRecalc.snapshot.ccmiMultiplier,
                ccmiPillars: emptyRecalc.snapshot.ccmiPillars,
                vmstLevel: emptyRecalc.snapshot.vmstLevel,
                vmstLabel: emptyRecalc.snapshot.vmstLabel,
                arkTier: emptyRecalc.snapshot.arkTierKey,
                arkIdString: emptyRecalc.snapshot.arkIdString,
                typology: emptyRecalc.snapshot.typology,
                resumeReplacementPct: emptyRecalc.snapshot.resumeReplacementPct,
              }
            : null,
          narrative: null,
        };
      }

      const resumeText = combinedText;
      const analysis = analyzeResume(resumeText, certLevel);

      // Scrape biographical facts (name, employer, role, qualifications) for the
      // "resume killer" ARK Report header. Best-effort — never blocks scoring.
      let bio: ProfileBio = { ...EMPTY_BIO };
      try {
        bio = await extractProfileBio(resumeText);
      } catch (bioErr) {
        console.error(`[${sourceTag}] bio extraction failed (best-effort):`, bioErr);
      }

      // PDD §3.4 J.3 — derive 7-pillar CCMI vector from fresh resume signals
      // (proxied off the JST sub-scores we just computed against the same text).
      const { derivePillarsFromResume } = await import("./ccmiDerivation");
      const aJobs = analysis.assessment.jstJobs ?? 0;
      const aSkills = analysis.assessment.jstSkills ?? 0;
      const aTalent = analysis.assessment.jstTalent ?? 0;
      const proxy = {
        technical: Math.max(0, (aJobs - 30) / 5),
        leadership: Math.max(0, (aTalent - 25) / 5),
        analytical: Math.max(0, (aSkills - 25) / 5),
        communication: Math.max(0, (aTalent - 25) / 6),
        innovation: Math.max(0, (aSkills - 25) / 6),
        ai_adjacent: Math.max(0, (aJobs - 30) / 6),
      };
      const freshPillars = derivePillarsFromResume({
        scores: proxy,
        contextCraftLevel: certLevel,
      });

      const created = await storage.createAssessment({
        ...analysis.assessment,
        userId,
        sourcesUsed,
        completeness,
        candidateName: bio.candidateName,
        currentEmployer: bio.currentEmployer,
        currentRole: bio.currentRole,
        professionalQuals: bio.professionalQuals,
        academicQuals: bio.academicQuals,
      });

      const [plans, pivots, vectors] = await Promise.all([
        storage.createUpskillingPlans(
          analysis.upskillingPlans.map(p => ({ ...p, assessmentId: created.id }))
        ),
        storage.createPivotOpportunities(
          analysis.pivotOpportunities.map(p => ({ ...p, assessmentId: created.id }))
        ),
        storage.createTransferabilityVectors(
          analysis.transferabilityVectors.map(v => ({ ...v, assessmentId: created.id }))
        ),
      ]);

      // Run recalc with the fresh pillar override before broadcasting.
      const avgAuto = (analysis.assessment.riskModifiers || []).length
        ? (analysis.assessment.riskModifiers || []).reduce((s, r) => s + r.automatable, 0) /
          (analysis.assessment.riskModifiers || []).length
        : 50;
      let recalc: Awaited<ReturnType<typeof recalcArkForUser>> | null = null;
      try {
        recalc = await recalcArkForUser({
          userId,
          trigger: "assessment.completed",
          triggerMeta: { assessmentId: created.id, source: sourceTag },
          pillarOverride: freshPillars,
          freshScores: { categoryScores: proxy, avgAutomation: avgAuto },
        });
      } catch (recalcErr) {
        console.error(`[${sourceTag}] recalc failed (best-effort):`, recalcErr);
      }

      // Stage-3 narrative (Claude Sonnet → fallback) — best-effort.
      type IdentityNarrativeT = Awaited<ReturnType<
        typeof import("./ai/identity")["generateIdentityNarrative"]
      >>;
      let narrative: IdentityNarrativeT | null = null;
      if (recalc) {
        try {
          const { generateIdentityNarrative } = await import("./ai/identity");
          narrative = await generateIdentityNarrative({
            userId,
            plan: userPlan,
            snapshot: recalc.snapshot,
            trigger: "assessment.completed",
          });
        } catch (narrErr) {
          console.error(`[${sourceTag}] narrative failed (best-effort):`, narrErr);
        }
      }

      // Emit AFTER recalc so the SSE arkEvent payload reflects new ARK score.
      await orchestrator.emit(userId, "assessment.completed", {
        assessmentId: created.id,
        jstTotal: created.jstTotal,
      }, 0);

      return {
        ...created,
        upskillingPlans: plans,
        pivotOpportunities: pivots,
        transferabilityVectors: vectors,
        extractedTextLength: resumeText.length,
        sourcesUsed,
        completeness,
        identity: recalc
          ? {
              arkScore: recalc.snapshot.arkScore,
              jstIndex: recalc.snapshot.jstIndex,
              ccmi: recalc.snapshot.ccmi,
              ccmiTier: recalc.snapshot.ccmiTier,
              ccmiTierLabel: recalc.snapshot.ccmiTierLabel,
              ccmiMultiplier: recalc.snapshot.ccmiMultiplier,
              ccmiPillars: recalc.snapshot.ccmiPillars,
              vmstLevel: recalc.snapshot.vmstLevel,
              vmstLabel: recalc.snapshot.vmstLabel,
              arkTier: recalc.snapshot.arkTierKey,
              arkIdString: recalc.snapshot.arkIdString,
              typology: recalc.snapshot.typology,
              resumeReplacementPct: recalc.snapshot.resumeReplacementPct,
            }
          : null,
        narrative,
      };
  }

  // ── Free JST Assessment (guest funnel — NO auth) ──────
  // Public marketing surface: a visitor runs ONE JST assessment with no login
  // via questionnaire, resume upload, or pasted LinkedIn profile, then we
  // upsell a subscription. Computes with the SAME analyzer as the logged-in
  // pipeline but DOES NOT persist to a user, recalc ARK, or emit SSE — guests
  // have no account. A tiny anonymous row backs the "first 100 free" counter.
  const FREE_ASSESSMENT_PROMO_LIMIT = 100;
  const freeAssessmentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 12, // generous for honest use; blocks scripted abuse of PDF parsing
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many free assessments from this network. Please try again later." },
  });

  // Keyword-rich text per archetype so the questionnaire answers feed the real
  // analyzer (no fabricated scores — the JST is computed from the visitor's own
  // selections, just like a resume's keywords drive a logged-in assessment).
  const ARCHETYPE_TEXT: Record<string, string> = {
    Architect: "Designed system architecture and technical strategy. Built scalable software platforms, data infrastructure, and automation pipelines. Led engineering innovation and defined long-term technical vision.",
    Orchestrator: "Coordinated cross-functional teams and managed complex programs at scale. Aligned stakeholders, optimized operational workflows, and led delivery across multiple departments and product lines.",
    Conductor: "Executed and shipped projects hands-on under tight deadlines. Solved critical problems, mentored peers, drove client communication, and owned the critical path to delivery.",
  };

  app.get("/api/free-assessment/spots", async (_req, res) => {
    try {
      const claimed = await storage.countGuestAssessments();
      const remaining = Math.max(0, FREE_ASSESSMENT_PROMO_LIMIT - claimed);
      return res.json({ claimed, limit: FREE_ASSESSMENT_PROMO_LIMIT, remaining });
    } catch {
      // Counter is best-effort marketing flair — never fail the page on it.
      return res.json({ claimed: 0, limit: FREE_ASSESSMENT_PROMO_LIMIT, remaining: FREE_ASSESSMENT_PROMO_LIMIT });
    }
  });

  app.post("/api/free-assessment", freeAssessmentLimiter, upload.single("resume"), async (req, res) => {
    try {
      const method = String(req.body?.method ?? "");
      if (!["questionnaire", "resume", "linkedin"].includes(method)) {
        return res.status(400).json({ message: "Invalid assessment method." });
      }

      let text = "";
      if (method === "resume") {
        const file = req.file;
        if (!file) return res.status(400).json({ message: "No file uploaded. Accepted formats: PDF, TXT." });
        if (file.mimetype === "application/pdf") {
          let h: ReturnType<typeof setTimeout> | undefined;
          const timeout = new Promise<never>((_, rej) => {
            h = setTimeout(() => rej(new Error("PDF parsing timed out")), 15_000);
          });
          try {
            const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
            const data = await Promise.race([parser.getText(), timeout]);
            clearTimeout(h);
            text = data.text;
          } catch (e: any) {
            clearTimeout(h);
            if (e.message === "PDF parsing timed out") {
              return res.status(422).json({ message: "That PDF took too long to process. Try a smaller or simpler file." });
            }
            throw e;
          }
        } else {
          text = file.buffer.toString("utf-8");
        }
      } else if (method === "questionnaire") {
        const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
        text = answers.map((a: unknown) => ARCHETYPE_TEXT[String(a)] ?? "").filter(Boolean).join(" ");
      } else {
        text = String(req.body?.text ?? "");
      }

      if (!text || text.trim().length < 50) {
        return res.status(422).json({
          message: method === "linkedin"
            ? "Please paste at least a few lines of your LinkedIn profile (your About / Experience sections work best)."
            : "We couldn't read enough content to build an assessment. Try a different option.",
        });
      }

      const analysis = analyzeResume(text, "NONE");
      const a = analysis.assessment;

      // Best-effort anonymous logging for the scarcity counter + analytics.
      let claimed = 0;
      try {
        await storage.createGuestAssessment({
          method,
          jstTotal: a.jstTotal,
          vulnerabilityLevel: a.vulnerabilityLevel,
          readinessProfile: a.readinessProfile,
        });
        claimed = await storage.countGuestAssessments();
      } catch (logErr) {
        console.error("[free-assessment] guest log failed (best-effort):", logErr);
      }
      const remaining = Math.max(0, FREE_ASSESSMENT_PROMO_LIMIT - claimed);

      return res.status(201).json({
        method,
        jstTotal: a.jstTotal,
        jstJobs: a.jstJobs,
        jstSkills: a.jstSkills,
        jstTalent: a.jstTalent,
        vulnerabilityLevel: a.vulnerabilityLevel,
        readinessProfile: a.readinessProfile,
        archetype: {
          architect: a.archetypeArchitect,
          orchestrator: a.archetypeOrchestrator,
          conductor: a.archetypeConductor,
        },
        riskModifiers: a.riskModifiers ?? [],
        transferabilityVectors: analysis.transferabilityVectors,
        pivotOpportunities: analysis.pivotOpportunities,
        upskillingPlans: analysis.upskillingPlans,
        spots: { claimed, limit: FREE_ASSESSMENT_PROMO_LIMIT, remaining },
      });
    } catch (err: any) {
      console.error("[/api/free-assessment] error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PDD §3.4 — ARK identity surfaces ───────────────────
  app.get("/api/ark/identity", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const [user, pillars, lhcs] = await Promise.all([
        storage.getUser(userId),
        storage.getCcmiPillars(userId),
        storage.getLhcsSignals(userId),
      ]);
      if (!user) return res.status(404).json({ message: "User not found." });
      if (user.arkScore !== user.jstIndex + user.ccmi) {
        console.warn(
          `[ark/identity] invariant drift userId=${userId} ark=${user.arkScore} ` +
            `jst=${user.jstIndex} ccmi=${user.ccmi} (expected ${user.jstIndex + user.ccmi})`,
        );
      }
      return res.json({
        userId,
        arkScore: user.arkScore,
        jstIndex: user.jstIndex,
        ccmi: user.ccmi,
        ccmiTier: user.ccmiTier,
        vmstLevel: user.vmstLevel,
        typology: user.typology,
        arkIdString: user.arkIdString,
        cprScore: user.cprScore,
        mpsScore: user.mpsScore,
        lcisScore: user.lcisScore,
        lhcsStatus: user.lhcsStatus,
        resumeReplacementPct: user.resumeReplacementPct,
        pillars: pillars
          ? {
              P1: pillars.p1, P2: pillars.p2, P3: pillars.p3, P4: pillars.p4,
              P5: pillars.p5, P6: pillars.p6, P7: pillars.p7,
              composite: pillars.composite,
              tier: pillars.tier,
              multiplier: pillars.multiplier,
            }
          : null,
        lhcs: lhcs
          ? {
              cprScore: lhcs.cprScore,
              mpsScore: lhcs.mpsScore,
              lcisScore: lhcs.lcisScore,
              cprLight: lhcs.cprLight,
              mpsLight: lhcs.mpsLight,
              lcisLight: lhcs.lcisLight,
              status: lhcs.status,
              readinessPct: lhcs.readinessPct,
            }
          : null,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Public feature-flag introspection — clients use the static map in
  // `shared/featureFlags.ts` at build time; this endpoint lets ops verify
  // what the server actually resolved after env overlays.
  app.get("/api/features", (_req, res) => {
    res.json({ stage: STAGE, features: getResolvedFeatures() });
  });

  // ── Book Companion (Task #22) ──────────────────────────────────────
  // All routes gated by the `bookCompanion` flag → 404 when off.

  // QR / deep-link resolver. Printed in the book as /b/<slug>. Works
  // logged-out — the destination route prompts login if needed. 302s to the
  // real in-app surface with a ?book=<nodeId> tag so the landing surface can
  // highlight the active chapter. Unknown slugs fall back to the journey hub.
  app.get("/b/:slug", requireFeature("bookCompanion"), (req, res) => {
    const dest = resolveSlugDestination(String(req.params.slug));
    return res.redirect(302, dest ?? "/book");
  });

  // Canonical slug → destination table (ops / book-print verification).
  app.get("/api/book/slugs", requireFeature("bookCompanion"), (_req, res) => {
    res.json({ bookTitle: BOOK_TITLE, slugs: slugDirectory() });
  });

  // Per-user journey: every node + earned status.
  app.get("/api/book/journey", requireFeature("bookCompanion"), requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const journey = await buildJourney(userId);
      return res.json(journey);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Digital Ledger: baseline + final snapshots + live values + delta.
  app.get("/api/book/ledger", requireFeature("bookCompanion"), requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const ledger = await buildLedger(userId);
      return res.json(ledger);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Capture the FINAL Ledger snapshot (reader-initiated at the Epilogue). The
  // baseline is captured server-internally on `assessment.completed` only — it
  // is NEVER client-settable, otherwise a caller could pre-poison the immutable
  // baseline (and thus the delta) before the Prologue assessment ran.
  app.post("/api/book/ledger/snapshot", requireFeature("bookCompanion"), requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const schema = z.object({ kind: z.literal("final") });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "kind must be 'final'" });
      }
      const snap = await captureLedgerSnapshot(userId, parsed.data.kind);
      const ledger = await buildLedger(userId);
      return res.json({ snapshot: snap, ledger });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Generic chapter badge art (no PII) — cached per nodeId. EARNED / LOCKED
  // overlay is applied client-side from the journey data.
  app.get("/badge/book/:nodeId.png", requireFeature("bookCompanion"), bookBadgeLimiter, async (req, res) => {
    try {
      const nodeId = String(req.params.nodeId);
      const node = getNodeById(nodeId);
      if (!node) return res.status(404).json({ message: "Unknown chapter" });
      const cached = bookBadgeCache.get(nodeId);
      if (cached) {
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
        res.setHeader("X-Robots-Tag", "noindex");
        return res.send(cached);
      }
      const png = await renderChapterBadgePng({
        chapterLabel: node.chapterLabel,
        title: node.title,
        badge: node.badge,
        pillar: node.pillar,
        ccLevel: node.ccLevel,
        tier: node.tierArt,
      });
      bookBadgeCache.set(nodeId, png);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
      res.setHeader("X-Robots-Tag", "noindex");
      return res.send(png);
    } catch (err: any) {
      console.error("[book] badge render failed:", err?.message || err);
      return res.status(500).json({ message: "Badge render failed" });
    }
  });

  app.post("/api/ark/recalc", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const result = await recalcArkForUser({
        userId,
        trigger: "manual.recompute",
        triggerMeta: { source: "user.manual" },
      });
      return res.json({
        snapshot: result.snapshot,
        appliedDelta: result.appliedDelta,
        rawDelta: result.rawDelta,
        capReason: result.capReason,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/ark/flywheel-cta", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const [user, pillars, lhcs, latest] = await Promise.all([
        storage.getUser(userId),
        storage.getCcmiPillars(userId),
        storage.getLhcsSignals(userId),
        storage.getLatestAssessment(userId),
      ]);
      if (!user) return res.status(404).json({ message: "User not found." });
      const input = {
        user,
        pillars: pillars ?? null,
        lhcs: lhcs ?? null,
        hasResumeUploaded: !!latest,
      };
      const top = pickFlywheelCta(input);
      const all = rankAllCtas(input, 3);
      return res.json({ top, ranked: all });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/ark/history", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const days = Math.max(1, Math.min(365, Number(req.query.days) || 90));
      const rows = await storage.getArkScoreHistory(userId, days);
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/ark/lhcs", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const lhcs = await computeLhcsForUser(userId);
      return res.json(lhcs);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Admin-only backfill endpoint (kept simple; ADMIN_USER_ID gate).
  app.post("/api/admin/ark/backfill", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const adminId = process.env.ADMIN_USER_ID;
      if (!adminId || userId !== adminId) {
        // Self-only sync: caps prevent positive ARK awards via this path.
        const result = await recalcArkForUser({
          userId,
          trigger: "backfill",
          triggerMeta: { selfOnly: true },
        });
        return res.json({ scope: "self", snapshot: result.snapshot, appliedDelta: result.appliedDelta });
      }
      const summary = await backfillAllUsers();
      return res.json({ scope: "all", ...summary });
    } catch (err: any) {
      console.error("Backfill error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // Admin-only CCGE compendium import — parse compendium-format Markdown
  // and upsert into ccge_cards. Mirrors the SPC import flow (paste/upload).
  const ccgeImportSchema = z.object({
    markdown: z.string().min(50).max(500000),
    dryRun: z.boolean().optional().default(false),
  });

  app.post("/api/admin/ccge/import-compendium", requireFeature("adminCcgeImport"), requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const adminId = process.env.ADMIN_USER_ID;
      if (!adminId || userId !== adminId) {
        return res.status(403).json({ message: "Admin only." });
      }
      const { markdown, dryRun } = ccgeImportSchema.parse(req.body);
      const { parseCompendium } = await import("./ccgeCompendiumParser");
      const result = parseCompendium(markdown);

      // Detect duplicate IDs in the parsed payload — fail fast so an import
      // can never silently overwrite one of its own rows.
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const c of result.cards) {
        if (seen.has(c.id)) duplicates.push(c.id);
        seen.add(c.id);
      }
      if (duplicates.length > 0) {
        return res.status(422).json({
          message: `Duplicate IDs in payload: ${duplicates.slice(0, 10).join(", ")}`,
          duplicates,
        });
      }

      if (dryRun) {
        return res.json({
          dryRun: true,
          stats: result.stats,
          skipped: result.skipped,
          preview: result.cards.slice(0, 5),
        });
      }

      const upserted = await storage.upsertCcgeCards(result.cards);
      return res.json({
        dryRun: false,
        upserted,
        stats: result.stats,
        skipped: result.skipped,
      });
    } catch (err: any) {
      console.error("CCGE compendium import error:", err);
      return res.status(400).json({ message: err.message });
    }
  });

  // ── Institution Workforce / HR Connectors (Task #25) ──────────────
  // ENTERPRISE / institution admins import their staff roster + HR fields via a
  // pluggable HR-connector framework, link staff to ARK accounts, and view a
  // workforce dashboard joining ARK scores with HR data. Every route is gated by
  // the `institutionWorkforce` flag (404 when off) AND requireInstitutionAdmin
  // (ENTERPRISE plan + institution on profile; fails closed). Institution scope
  // is always derived from the session (`req.institutionScope`), never the body.
  const workforceGate = [requireFeature("institutionWorkforce"), requireAuth, requireInstitutionAdmin] as const;

  // List the registered HR-connector adapters + the normalized field set so the
  // mapping UI can render its source-picker + field dropdowns.
  app.get("/api/workforce/connectors", ...workforceGate, async (req, res) => {
    try {
      // Most-recent connection-test outcome per adapter for this institution, so
      // each card can show connector health on load without re-running the test.
      const tests = await storage.getConnectorTests(req.institutionScope!);
      const lastTestByAdapter = new Map(tests.map((t) => [t.adapter, t]));
      return res.json({
        connectors: listHrConnectors().map((a) => {
          const lastTest = lastTestByAdapter.get(a.key);
          return {
            key: a.key,
            label: a.label,
            acceptsFile: a.acceptsFile,
            // Live API adapters report whether their server-side credentials are
            // present so the UI can enable/disable the sync button. File adapters
            // (and any adapter without required secrets) are always "configured".
            isApi: !a.acceptsFile,
            requiredSecrets: a.requiredSecrets ?? [],
            configured: a.isConfigured ? a.isConfigured() : true,
            lastTest: lastTest
              ? {
                  ok: lastTest.ok,
                  testedAt: lastTest.testedAt,
                  validRows: lastTest.validRows,
                  errorRows: lastTest.errorRows,
                  message: lastTest.message,
                }
              : null,
          };
        }),
        fields: HR_FIELD_KEYS.map((key) => ({ key, label: HR_FIELD_LABELS[key] })),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Parse a column-mapping override sent as a JSON string form field. Returns
  // undefined on absence/malformed so the adapter falls back to auto-detection.
  function parseMappingField(raw: unknown): Record<string, string> | undefined {
    if (typeof raw !== "string" || !raw.trim()) return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      /* ignore — fall back to auto-detect */
    }
    return undefined;
  }

  // Preview an upload: parse + detect column mapping + validate WITHOUT
  // persisting. Powers the mapping-correction screen before the real import.
  app.post(
    "/api/workforce/import/preview",
    ...workforceGate,
    csvUpload.single("file"),
    async (req, res) => {
      try {
        const adapterKey = (req.body?.adapter as string) || "csv";
        const adapter = getHrConnector(adapterKey);
        if (!adapter) {
          return res.status(400).json({ message: `Unknown HR connector "${adapterKey}".` });
        }
        if (!adapter.parse) {
          return res.status(400).json({
            message: `The "${adapter.label}" connector is API-backed — use the sync action instead of a file upload.`,
          });
        }
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded. Upload a CSV roster." });
        }
        const content = req.file.buffer.toString("utf-8");
        const result = adapter.parse({
          content,
          filename: req.file.originalname,
          columnMapping: parseMappingField(req.body?.columnMapping),
        });
        return res.json({
          adapter: result.adapter,
          filename: req.file.originalname,
          columnMapping: result.columnMapping,
          unmappedColumns: result.unmappedColumns,
          totalRows: result.totalRows,
          validRows: result.records.length,
          errorCount: result.errors.length,
          sample: result.records.slice(0, 10),
          errors: result.errors.slice(0, 100),
          fields: HR_FIELD_KEYS.map((key) => ({ key, label: HR_FIELD_LABELS[key] })),
        });
      } catch (err: any) {
        console.error("[/api/workforce/import/preview] error:", err);
        return res.status(500).json({ message: err.message });
      }
    },
  );

  // Run the import: parse → upsert staff records (auto-linking to ARK accounts
  // by email) → record an audit batch with row counts + errors.
  app.post(
    "/api/workforce/import",
    ...workforceGate,
    csvUpload.single("file"),
    async (req, res) => {
      try {
        const institution = req.institutionScope!;
        const userId = currentUserId(req)!;
        const adapterKey = (req.body?.adapter as string) || "csv";
        const adapter = getHrConnector(adapterKey);
        if (!adapter) {
          return res.status(400).json({ message: `Unknown HR connector "${adapterKey}".` });
        }
        if (!adapter.parse) {
          return res.status(400).json({
            message: `The "${adapter.label}" connector is API-backed — use the sync action instead of a file upload.`,
          });
        }
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded. Upload a CSV roster." });
        }
        const content = req.file.buffer.toString("utf-8");
        const result = adapter.parse({
          content,
          filename: req.file.originalname,
          columnMapping: parseMappingField(req.body?.columnMapping),
        });

        if (result.records.length === 0) {
          return res.status(422).json({
            message: "No valid rows to import. Check the column mapping and required Full Name column.",
            errors: result.errors.slice(0, 100),
          });
        }

        // Persist the batch audit FIRST so each staff row references it.
        const batch = await storage.createImportBatch({
          institution,
          adapter: result.adapter,
          filename: req.file.originalname,
          importedBy: userId,
          totalRows: result.totalRows,
          importedRows: 0,
          updatedRows: 0,
          errorRows: result.errors.length,
          errors: result.errors,
          columnMapping: result.columnMapping,
        });

        const summary = await storage.upsertStaffRecords(institution, batch.id, result.records);

        // Backfill the resolved insert/update counts onto the audit row.
        const finalBatch = await storage.updateImportBatchCounts(batch.id, {
          importedRows: summary.inserted,
          updatedRows: summary.updated,
        });

        return res.status(201).json({
          batchId: batch.id,
          summary: {
            ...summary,
            totalRows: result.totalRows,
            errorRows: result.errors.length,
          },
          columnMapping: result.columnMapping,
          errors: result.errors.slice(0, 100),
          batch: finalBatch ?? batch,
        });
      } catch (err: any) {
        console.error("[/api/workforce/import] error:", err);
        return res.status(500).json({ message: err.message });
      }
    },
  );

  // On-demand re-sync from a LIVE HR API connector (BambooHR / Gusto / Workday).
  // Pulls the roster via the adapter's `fetchRecords` (server-side credentials
  // only — nothing is accepted from the client beyond the adapter key), upserts
  // into staff_records, and records the same audit batch a file import does, so
  // re-syncing keeps rosters current without re-uploading. Idempotent: the
  // upsert matches on email/externalId and preserves prior manual ARK links.
  app.post("/api/workforce/sync", ...workforceGate, async (req, res) => {
    try {
      const institution = req.institutionScope!;
      const userId = currentUserId(req)!;
      const adapterKey = (req.body?.adapter as string) || "";

      // Shared pipeline with the scheduler — see server/hrConnectors/sync.ts.
      const result = await runConnectorSync({ institution, adapterKey, importedBy: userId });

      if (!result.ok) {
        // Map the discriminated failure code onto the HTTP status the client
        // already understands: bad request (400), upstream failure (502),
        // empty roster (422).
        const status =
          result.code === "fetch_failed" ? 502 : result.code === "no_records" ? 422 : 400;
        if (result.code === "fetch_failed") {
          console.error(`[/api/workforce/sync] ${adapterKey} fetch failed:`, result.message);
        }
        return res.status(status).json({ message: result.message });
      }

      return res.status(201).json({
        batchId: result.batchId,
        adapter: result.adapter,
        summary: result.summary,
        columnMapping: result.columnMapping,
        errors: result.errors.slice(0, 100),
      });
    } catch (err: any) {
      console.error("[/api/workforce/sync] error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // Lightweight "Test connection" for a LIVE HR API connector. Authenticates
  // and counts records via the adapter's `fetchRecords` but NEVER upserts into
  // staff_records or creates an import batch — pure read-only feedback so an
  // admin can verify credentials while wiring up a new HR system. Reuses the
  // same `isConfigured` / `fetchRecords` contract as the sync route.
  app.post("/api/workforce/test-connection", ...workforceGate, async (req, res) => {
    try {
      const adapterKey = (req.body?.adapter as string) || "";
      // The read-only core (extracted + unit-tested in workforceConnectionTest.ts)
      // does adapter lookup, validation, and the live fetch. It NEVER writes to
      // staff_records or creates an import batch — that invariant is locked in by
      // server/__tests__/workforceTestConnection.test.ts.
      const { status, body } = await runHrConnectionTest(adapterKey);

      // Persist connector health for the success (200) and upstream-failure (502)
      // outcomes so the connector card reflects the last test on next load. The
      // 400 validation cases (unknown / file-only / unconfigured) are request
      // errors rather than connector-health signals, so they are not recorded.
      if (status === 200) {
        await storage.recordConnectorTest({
          institution: req.institutionScope!,
          adapter: adapterKey,
          ok: true,
          totalRows: body.totalRows as number,
          validRows: body.validRows as number,
          errorRows: body.errorRows as number,
          testedBy: currentUserId(req)!,
        });
      } else if (status === 502) {
        await storage.recordConnectorTest({
          institution: req.institutionScope!,
          adapter: adapterKey,
          ok: false,
          message: body.message as string,
          testedBy: currentUserId(req)!,
        });
      }

      return res.status(status).json(body);
    } catch (err: any) {
      console.error("[/api/workforce/test-connection] error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Scheduled HR sync configuration (Task #35) ────────────────────
  // Per-institution connector configs that the background scheduler drives.
  // GET merges every registered API connector with its stored config (so the
  // UI lists connectors that have never been configured) and reports the
  // last-sync status. PUT enables/disables automatic sync + sets the cadence.

  // List API connectors + each one's scheduled-sync config + last-sync status.
  app.get("/api/workforce/connector-configs", ...workforceGate, async (req, res) => {
    try {
      const institution = req.institutionScope!;
      const configs = await storage.getConnectorConfigs(institution);
      const byAdapter = new Map(configs.map((c) => [c.adapter, c]));
      const items = listHrConnectors()
        .filter((a) => !a.acceptsFile) // only live API adapters can be scheduled
        .map((a) => {
          const cfg = byAdapter.get(a.key);
          return {
            adapter: a.key,
            label: a.label,
            configured: a.isConfigured ? a.isConfigured() : true,
            requiredSecrets: a.requiredSecrets ?? [],
            enabled: cfg?.enabled ?? false,
            intervalMinutes: cfg?.intervalMinutes ?? HR_SYNC_DEFAULT_INTERVAL_MINUTES,
            lastSyncedAt: cfg?.lastSyncedAt ?? null,
            lastSyncStatus: cfg?.lastSyncStatus ?? null,
            lastSyncMessage: cfg?.lastSyncMessage ?? null,
            lastSyncSummary: cfg?.lastSyncSummary ?? null,
          };
        });
      return res.json({ configs: items });
    } catch (err: any) {
      console.error("[/api/workforce/connector-configs] error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // Enable/disable scheduled sync for one adapter + set its cadence.
  app.put("/api/workforce/connector-configs/:adapter", ...workforceGate, async (req, res) => {
    try {
      const institution = req.institutionScope!;
      const userId = currentUserId(req)!;
      const adapterKey = String(req.params.adapter);
      const adapter = getHrConnector(adapterKey);
      if (!adapter || adapter.acceptsFile || !adapter.fetchRecords) {
        return res.status(400).json({
          message: `"${adapterKey}" is not a schedulable live HR connector.`,
        });
      }

      const parsed = z
        .object({
          enabled: z.boolean(),
          intervalMinutes: z
            .number()
            .int()
            .min(HR_SYNC_MIN_INTERVAL_MINUTES)
            .max(HR_SYNC_MAX_INTERVAL_MINUTES)
            .optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid config.", errors: parsed.error.flatten() });
      }

      // Block enabling a connector whose server-side credentials are missing —
      // it would only ever fail-close on every tick.
      if (parsed.data.enabled && adapter.isConfigured && !adapter.isConfigured()) {
        const missing = (adapter.requiredSecrets ?? []).join(", ");
        return res.status(400).json({
          message: `Cannot enable scheduled sync — "${adapter.label}" is not configured${missing ? ` (set ${missing})` : ""}.`,
        });
      }

      const config = await storage.upsertConnectorConfig({
        institution,
        adapter: adapterKey,
        enabled: parsed.data.enabled,
        intervalMinutes: parsed.data.intervalMinutes ?? HR_SYNC_DEFAULT_INTERVAL_MINUTES,
        createdBy: userId,
      });
      return res.json({ config });
    } catch (err: any) {
      console.error("[/api/workforce/connector-configs/:adapter] error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // Staff roster joined with each member's ARK identity + assessment status.
  app.get("/api/workforce/staff", ...workforceGate, async (req, res) => {
    try {
      const staff = await storage.getStaffRecords(req.institutionScope!);
      return res.json({ institution: req.institutionScope, staff });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Workforce intelligence: ARK scores broken down by department / tenure band /
  // compensation band / manager / location.
  app.get("/api/workforce/intelligence", ...workforceGate, async (req, res) => {
    try {
      const intel = await storage.getWorkforceIntelligence(req.institutionScope!);
      return res.json(intel);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Workforce intelligence CSV export — same breakdowns as the on-screen
  // dashboard, flattened into one file for board/HR reviews. Mirrors the cohort
  // grades.csv pattern (gated identically by flag + requireInstitutionAdmin).
  app.get("/api/workforce/intelligence.csv", ...workforceGate, async (req, res) => {
    try {
      const intel = await storage.getWorkforceIntelligence(req.institutionScope!);
      const esc = (v: any) => {
        if (v === null || v === undefined) return "";
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = [
        "section",
        "group",
        "staff",
        "linked",
        "assessed",
        "avg_ark",
        "avg_jst",
        "avg_vulnerability_pct",
      ];
      const lines = [header.join(",")];
      const row = (
        section: string,
        group: string,
        staff: number,
        linked: number,
        assessed: number,
        avgArk: number,
        avgJst: number,
        avgVuln: number,
      ) =>
        lines.push(
          [section, group, staff, linked, assessed, avgArk, avgJst, avgVuln]
            .map(esc)
            .join(","),
        );

      row(
        "Totals",
        "All Staff",
        intel.totals.staff,
        intel.totals.linked,
        intel.totals.assessed,
        intel.totals.avgArk,
        intel.totals.avgJst,
        intel.totals.avgVulnerability,
      );

      const sections: Array<[string, typeof intel.byDepartment]> = [
        ["By Department", intel.byDepartment],
        ["By Tenure Band", intel.byTenureBand],
        ["By Compensation Band", intel.byCompensationBand],
        ["By Manager", intel.byManager],
        ["By Location", intel.byLocation],
      ];
      for (const [section, rows] of sections) {
        for (const r of rows) {
          row(
            section,
            r.key,
            r.count,
            r.linkedCount,
            r.assessedCount,
            r.avgArk,
            r.avgJst,
            r.avgVulnerability,
          );
        }
      }

      const slug = (intel.institution || "institution").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const date = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="workforce-intelligence-${slug}-${date}.csv"`,
      );
      res.send(lines.join("\n"));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Import-batch audit history.
  app.get("/api/workforce/import-batches", ...workforceGate, async (req, res) => {
    try {
      const batches = await storage.getImportBatches(req.institutionScope!);
      return res.json({ batches });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Manually (re)link a staff member to an ALREADY-EXISTING ARK account by email.
  app.post("/api/workforce/staff/:id/link", ...workforceGate, async (req, res) => {
    try {
      const linked = await storage.linkStaffToArk(String(req.params.id), req.institutionScope!);
      if (!linked) {
        return res.status(404).json({
          message: "No ARK account matches this staff member's email (or no email on record).",
        });
      }
      return res.json(linked);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Invite an as-yet-unmatched staff member to create their ARK profile. If an
  // account already exists for their email it is linked immediately; otherwise
  // the invite is recorded and auto-linked when that email registers/logs in.
  app.post("/api/workforce/staff/:id/invite", ...workforceGate, async (req, res) => {
    try {
      const result = await storage.inviteStaff(String(req.params.id), req.institutionScope!);
      if (!result) {
        return res.status(422).json({
          message: "Cannot invite: staff member has no email on record.",
        });
      }
      return res.json({
        staff: result,
        linked: result.assessmentStatus !== "invited",
        message:
          result.assessmentStatus === "invited"
            ? "Invite recorded — this staff member will be linked automatically when they create their ARK account."
            : "An ARK account already existed for this email and was linked.",
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Jnomics Cards (CODEC Primitives) ─────────────────
  // Card rows in Postgres carry the canonical id/name/tier/type/emoji/
  // description/basePts. The CODEC catalog enriches each row with persona,
  // multiplier, insight, and the O*NET / SFIA / WEF skill standard
  // mappings so the UI can render skill-standard provenance without a
  // second round-trip.
  function enrichJnomicsCard(card: any) {
    const meta = CODEC_BY_ID[card.id];
    if (!meta) return card;
    return {
      ...card,
      persona: meta.persona,
      category: meta.category,
      multiplier: meta.multiplier,
      insight: meta.insight,
      mappings: meta.mappings,
    };
  }

  app.get("/api/jnomics-cards", async (_req, res) => {
    try {
      const cards = await storage.getAllJnomicsCards();
      return res.json(cards.map(enrichJnomicsCard));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/jnomics-cards/by-ids", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ message: "ids must be an array" });
      const cards = await storage.getJnomicsCardsByIds(ids);
      return res.json(cards.map(enrichJnomicsCard));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Enterprise / Departments ──────────────────────────
  app.get("/api/departments", requireFeature("enterpriseDashboard"), async (_req, res) => {
    try {
      const depts = await storage.getAllDepartments();
      return res.json(depts);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── CCGE: Context Craft Game Engine ──────────────────
  app.get("/api/ccge/cards", async (_req, res) => {
    try {
      const cards = await storage.getAllCcgeCards();
      return res.json(cards);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/ccge/scenarios", async (req, res) => {
    try {
      // Phase J.1: privacy-scope custom scenarios to their creator. Unauth'd
      // visitors only see canon scenarios.
      const userId = currentUserId(req);
      const all = await storage.getCcgeScenariosForUser(userId ?? null);
      const tier = typeof req.query.tier === "string" ? req.query.tier : null;
      const filtered = tier ? all.filter((s) => s.tier === tier) : all;
      return res.json(filtered);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Phase J.1: a logged-in player generates their own industry-specific scenario
  // via Claude. Persisted as a private custom scenario owned by the requester.
  app.post("/api/ccge/scenarios/custom", requireFeature("customScenarios"), requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        industry: z.string().min(2).max(80),
        role: z.string().min(2).max(80),
        problem: z.string().min(10).max(600),
        tier: z.enum(["Bronze", "Silver", "Gold", "Platinum"]).optional(),
      });
      const p = schema.safeParse(req.body);
      if (!p.success) {
        return res.status(400).json({ message: "industry, role, problem required" });
      }
      const userId = currentUserId(req)!;
      const user = await storage.getUser(userId);
      const plan = (user?.subscriptionPlan as SubscriptionPlan) || "INDIVIDUAL_FREE";
      const brief = `A ${p.data.role} working in ${p.data.industry} needs an AI prompt to address: ${p.data.problem}`;
      const generated = await generateScenario({
        userId,
        plan,
        brief,
        industry: p.data.industry,
        role: p.data.role,
        tierHint: p.data.tier,
      });
      // Force creator ownership + unique id; never trust Claude's id verbatim
      // for collision safety against canon ids. Random suffix avoids the rare
      // same-millisecond collision overwriting a prior scenario via upsert.
      const rand = Math.random().toString(36).slice(2, 8);
      const id = `custom-${userId.slice(0, 8)}-${Date.now().toString(36)}-${rand}`;
      // Tier-contract enforcement: if the player asked for a specific tier we
      // hold Claude to it (force the persisted tier to the requested value)
      // rather than silently accepting whatever the model returned.
      const enforcedTier = p.data.tier ?? generated.tier;
      const saved = await storage.upsertCcgeScenario({
        ...generated,
        id,
        tier: enforcedTier,
        creatorUserId: userId,
        industry: p.data.industry,
        isCustom: true,
      });
      return res.status(201).json({ scenario: saved });
    } catch (err: any) {
      console.error("Custom scenario gen error:", err);
      return res.status(err.status || 500).json({ message: err.message });
    }
  });

  app.post("/api/ccge/sessions", requireAuth, async (req, res) => {
    try {
      const schema = z.object({ scenarioId: z.string().min(1) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "scenarioId required" });
      }
      const userId = currentUserId(req)!;
      const { scenarioId } = parsed.data;

      const scenario = await storage.getCcgeScenario(scenarioId);
      if (!scenario) return res.status(404).json({ message: "Scenario not found" });
      // Phase J.1: custom scenarios are private to their creator. Fail closed
      // for malformed rows (isCustom=true but no creator) — never assume a
      // missing creator field grants public access.
      if (scenario.isCustom && scenario.creatorUserId !== userId) {
        return res.status(403).json({ message: "This custom scenario belongs to another player." });
      }

      const allCards = await storage.getAllCcgeCards();
      if (allCards.length === 0) {
        return res.status(503).json({ message: "Card library not seeded. Call POST /api/seed first." });
      }

      const hand = dealHand(allCards, scenario, 5);
      const session = await storage.createGameSession({
        userId,
        scenarioId,
        hand,
        played: [],
        status: "in_progress",
        kcseScore: null,
        kcseBreakdown: null,
        certTierEarned: null,
        arkScoreDelta: 0,
        certUpgradedFrom: null,
        certUpgradedTo: null,
      });

      return res.status(201).json({ session, scenario });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/ccge/sessions/:id", requireAuth, async (req, res) => {
    try {
      const session = await storage.getGameSession(String(req.params.id));
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.userId !== currentUserId(req)) {
        return res.status(403).json({ message: "You may only view your own sessions." });
      }
      const scenario = await storage.getCcgeScenario(session.scenarioId);
      return res.json({ session, scenario });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/ccge/sessions/:id/finish", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        playedCardIds: z.array(z.string()).min(1).max(5),
        useClaude: z.boolean().optional(),
        customCardName: z.string().trim().min(2).max(80),
        customCardBody: z.string().trim().min(10).max(4000),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Provide 1–5 card IDs plus a card name (2–80 chars) and a prompt (10–4000 chars)." });
      }
      const { playedCardIds, useClaude, customCardName, customCardBody } = parsed.data;

      const session = await storage.getGameSession(String(req.params.id));
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.userId !== currentUserId(req)) {
        return res.status(403).json({ message: "You may only finish your own sessions." });
      }
      if (session.status !== "in_progress") {
        return res.status(409).json({ message: "Session is already finished" });
      }

      // Validate every played card came from the dealt hand (no cheating)
      const handSet = new Set(session.hand);
      for (const id of playedCardIds) {
        if (!handSet.has(id)) {
          return res.status(400).json({ message: `Card ${id} was not in the dealt hand` });
        }
      }
      // No duplicate plays
      if (new Set(playedCardIds).size !== playedCardIds.length) {
        return res.status(400).json({ message: "Cannot play the same card twice" });
      }

      const scenario = await storage.getCcgeScenario(session.scenarioId);
      if (!scenario) return res.status(404).json({ message: "Scenario not found" });

      const allCards = await storage.getAllCcgeCards();
      const playedCards = playedCardIds
        .map((id) => allCards.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => !!c);

      const breakdown = scoreSession(playedCards, scenario);

      // ── Card Design stage (final stage) — evaluate the player's authored card.
      const cardFinal = breakdown.final;
      const craftResult = evaluateCustomCard({ name: customCardName, body: customCardBody, scenario });
      breakdown.craft = craftResult.craft;
      breakdown.craftSignals = craftResult.signals;
      breakdown.final = blendCraftIntoFinal(cardFinal, craftResult.craft);

      const actorUserId = currentUserId(req)!;
      let claudeKcse: Awaited<ReturnType<typeof scoreSessionWithClaude>> = null;
      const actor = await storage.getUser(actorUserId);
      const plan = (actor?.subscriptionPlan as SubscriptionPlan) || "INDIVIDUAL_FREE";
      // Phase O — gate `useClaude` at the route. With FEATURE_REVENUE_GUARDRAIL
      // OFF this is identity (legacy behaviour); ON, FREE-tier users cannot buy
      // a Sonnet/Haiku Claude judge by passing useClaude:true.
      const effectiveUseClaude = resolveUseClaude(plan, useClaude);
      if (useClaude && !effectiveUseClaude) {
        return res.status(402).json({
          message: "Claude-judged sessions require a paid plan.",
          upgradePath: "/subscription",
          currentTier: plan,
        });
      }
      if (effectiveUseClaude) {
        claudeKcse = await scoreSessionWithClaude({
          userId: actorUserId,
          plan,
          scenario,
          playedCards,
          deterministic: breakdown,
          customCard: { name: customCardName, body: customCardBody },
        });
        if (claudeKcse) {
          breakdown.final = Math.max(0, Math.min(50, Math.round((breakdown.final + claudeKcse.kcseDelta) * 10) / 10));
        }
      }
      const tier = jcseToTier(breakdown.final);

      const { session: updated, flywheel } = await storage.finalizeSession({
        sessionId: session.id,
        actorUserId,
        playedCardIds,
        breakdown,
        tier,
        customCardName,
        customCardBody,
      });

      await orchestrator.emit(actorUserId, "game.session.finished", {
        sessionId: updated.id,
        scenarioId: updated.scenarioId,
        kcseScore: breakdown.final,
        tier,
        certUpgradedFrom: flywheel.certUpgradedFrom,
        certUpgradedTo: flywheel.certUpgradedTo,
        newJstTotal: flywheel.newJstTotal,
      }, flywheel.arkScoreDelta);

      if (flywheel.certUpgradedTo && flywheel.certUpgradedFrom) {
        await orchestrator.emit(actorUserId, "cert.upgraded", {
          from: flywheel.certUpgradedFrom,
          to: flywheel.certUpgradedTo,
        }, 0);
      }

      return res.json({
        session: updated,
        scenario,
        breakdown,
        tier,
        flywheel,
        claude: claudeKcse,
      });
    } catch (err: any) {
      console.error("CCGE finish error:", err);
      return res.status(err.status || 500).json({ message: err.message });
    }
  });

  app.get("/api/ccge/sessions/user/:userId", requireSelf("userId"), async (req, res) => {
    try {
      const sessions = await storage.getGameSessionsByUser(String(req.params.userId));
      return res.json(sessions);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── SPHINX Marketplace ────────────────────────────────
  const hivePrecheckSchema = z.object({
    title: z.string(),
    description: z.string(),
    body: z.string(),
    pillar: z.enum(ALL_CARD_PILLARS as unknown as [string, ...string[]]),
  });

  app.post("/api/sphinx/hive-precheck", async (req, res) => {
    try {
      const parsed = hivePrecheckSchema.parse(req.body);
      const result = runHivePrecheck(parsed);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  const publishListingSchema = z.object({
    title: z.string().min(6).max(80),
    description: z.string().min(20).max(500),
    body: z.string().min(80).max(50000),
    pillar: z.enum(ALL_CARD_PILLARS as unknown as [string, ...string[]]),
    priceCredits: z.number().int().min(SPC_PRICE_MIN).max(SPC_PRICE_MAX),
    // Phase K — visibility scope for the new corporate marketplace surface.
    // Defaults to OPEN to preserve legacy publish flow when the corporate
    // feature flag is off. Corporate/Both require the creator to have a
    // non-empty users.institution string (snapshotted at publish time).
    scope: z.enum(SPC_SCOPES as unknown as [string, ...string[]]).default("OPEN"),
  });

  app.post("/api/sphinx/listings", requireAuth, async (req, res) => {
    try {
      const parsed = publishListingSchema.parse(req.body);
      const creatorId = currentUserId(req)!;
      const creator = await storage.getUser(creatorId);
      if (!creator) return res.status(404).json({ message: "Creator not found." });

      const certLevel = (creator.contextCraftCertLevel as ContextCraftLevel) || "NONE";
      if (CERT_LEVEL_RANK[certLevel] < CERT_LEVEL_RANK[SPC_MIN_CERT_TO_PUBLISH]) {
        return res.status(403).json({
          message: `Publishing requires ${CONTEXT_CRAFT_LEVELS[SPC_MIN_CERT_TO_PUBLISH].label} or higher. Your level: ${CONTEXT_CRAFT_LEVELS[certLevel].label}. Win Gold tier in CCGE Arena to qualify.`,
        });
      }

      const precheck = runHivePrecheck({
        title: parsed.title,
        description: parsed.description,
        body: parsed.body,
        pillar: parsed.pillar,
      });
      if (!precheck.passes) {
        return res.status(422).json({
          message: "HIVE pre-check failed — improve the prompt and re-submit.",
          precheck,
        });
      }

      // Phase K — corporate scope gating. The corporate marketplace is a
      // CLASS C surface; when the flag is off we reject CORPORATE/BOTH
      // publish attempts with 422 (explicit failure, no silent OPEN coerce).
      // When ON we require the creator's institution string for the snapshot.
      let effectiveScope = parsed.scope;
      let institutionSnapshot: string | null = null;
      if (effectiveScope === "CORPORATE" || effectiveScope === "BOTH") {
        // Use the server-side resolver (honors FEATURE_CORPORATE_MARKETPLACE
        // env overlay) — never the static shared FEATURES map, which would
        // disagree with the dedicated corporate routes (gated via
        // requireFeature) when ops flips the flag at runtime.
        // BUGMXT [L2-K01] — fail explicit instead of silently coercing to
        // OPEN. A stale client (or API caller) asking for CORPORATE/BOTH
        // when the flag is off must be told so, not have its listing
        // quietly redirected into the wrong market.
        if (!isFeatureEnabled("corporateMarketplace")) {
          return res.status(422).json({
            message: "Corporate marketplace is not enabled — publish with scope=OPEN.",
          });
        }
        const inst = (creator.institution ?? "").trim();
        if (!inst) {
          return res.status(422).json({
            message: "Corporate-scoped listings require an institution on your profile.",
          });
        }
        institutionSnapshot = inst;
      }

      const listing = await storage.createSpcListing({
        creatorId,
        title: parsed.title,
        description: parsed.description,
        body: parsed.body,
        pillar: parsed.pillar,
        priceCredits: parsed.priceCredits,
        kcseScore: precheck.kcseScore,
        hiveScore: precheck.hiveScore,
        status: "active",
        scope: effectiveScope,
        institution: institutionSnapshot,
      });

      await orchestrator.emit(creatorId, "spc.published", {
        listingId: listing.id,
        title: listing.title,
      }, ARK_SCORE_DELTAS.SPC_PUBLISHED);

      // M3 — refresh complementary cache + roundtable rankings. Fire-and-forget
      // so the publish path isn't blocked on derivative work.
      recomputeComplementaryFor(listing.id, 5).catch(() => null);
      recomputeRoundtable().catch(() => null);

      return res.status(201).json({ listing, precheck });
    } catch (err: any) {
      console.error("Publish SPC error:", err);
      return res.status(400).json({ message: err.message });
    }
  });

  const listingFiltersSchema = z.object({
    pillar: z.string().optional(),
    status: z.string().optional(),
    search: z.string().max(120).optional(),
    category: z.string().optional(),
    // M3 — three additional taxonomy dimensions sourced from jnomics_cards
    // (via listing.synergyTagIds intersection).
    disc: z.string().optional(),
    rarity: z.string().optional(),
    version: z.string().optional(),
    // M3 — HIVE tier filter (ULTRA/PREMIUM/STANDARD), derived from listing.hiveScore.
    tier: z.enum(["All", "ULTRA", "PREMIUM", "STANDARD"]).optional(),
  });

  // Server-side body redaction protects paid prompt content from being scraped
  // via direct API calls. We strip the body entirely on the wire for non-buyers
  // — the buyer-facing UI shows the SpcTaxonomyPanel (Benefits + Skills mix
  // derived from non-prompt metadata) instead of a content preview. The
  // body length is preserved separately as `bodyLength` so the panel can
  // render a "prompt density" indicator without exposing any actual content.
  const redactBody = (_body: string) => "";

  app.get("/api/sphinx/listings", async (req, res) => {
    try {
      const filters = listingFiltersSchema.parse(req.query);
      const all = await storage.getAllSpcListings({
        pillar: filters.pillar && filters.pillar !== "All" ? filters.pillar : undefined,
        status: filters.status ?? "active",
        disc: filters.disc && filters.disc !== "All" ? filters.disc : undefined,
        rarity: filters.rarity && filters.rarity !== "All" ? filters.rarity : undefined,
        version: filters.version && filters.version !== "All" ? filters.version : undefined,
        // Phase K — open market never shows CORPORATE-only listings.
        scope: "OPEN",
      });
      // Category filter (M19): map to pillars and intersect.
      let scoped = all;
      if (filters.category && filters.category !== "All") {
        const cat = filters.category as MarketplaceCategory;
        if (!MARKETPLACE_CATEGORIES.includes(cat)) {
          return res.status(400).json({ message: "Invalid category." });
        }
        const allowedPillars = new Set<string>(categoryToPillars(cat));
        scoped = scoped.filter((l) => allowedPillars.has(l.pillar));
      }
      // Tier filter (M3): HIVE band, computed from listing.hiveScore.
      if (filters.tier && filters.tier !== "All") {
        scoped = scoped.filter((l) => hiveToTierBadge(l.hiveScore) === filters.tier);
      }
      // Free-text search (M18): case-insensitive substring on title + description.
      if (filters.search && filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        scoped = scoped.filter(
          (l) =>
            l.title.toLowerCase().includes(q) ||
            l.description.toLowerCase().includes(q),
        );
      }
      // List endpoint always returns redacted bodies — no viewer context here.
      const redacted = scoped.map((l) => ({
        ...l,
        body: redactBody(l.body),
        bodyLocked: true,
        bodyLength: l.body.length,
      }));
      return res.json(redacted);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/sphinx/listings/:id", async (req, res) => {
    try {
      const listing = await storage.getSpcListing(String(req.params.id));
      if (!listing) return res.status(404).json({ message: "Listing not found." });
      const creator = await storage.getUser(listing.creatorId);
      const safeCreator = creator
        ? { id: creator.id, name: creator.name, contextCraftCertLevel: creator.contextCraftCertLevel }
        : null;
      const viewerId = currentUserId(req);
      let canViewBody = false;
      if (viewerId) {
        if (viewerId === listing.creatorId) {
          canViewBody = true;
        } else {
          canViewBody = await storage.hasBuyerPurchasedListing(viewerId, listing.id);
        }
      }
      const safeListing = canViewBody
        ? { ...listing, bodyLocked: false, bodyLength: listing.body.length }
        : { ...listing, body: redactBody(listing.body), bodyLocked: true, bodyLength: listing.body.length };
      return res.json({ listing: safeListing, creator: safeCreator });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── SPHINX AI Analysis (M3 / M15 / M20) ─────────────────
  // Access control: only the creator or a confirmed buyer may run AI
  // analysis. The endpoint feeds the full prompt body to Claude, and the
  // system prompt instructs the model to quote prompt wording — so any
  // non-buyer access would leak paid content. Mirrors the body-gate on
  // GET /api/sphinx/listings/:id.
  app.post("/api/sphinx/listings/:id/ai-analysis", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const listing = await storage.getSpcListing(String(req.params.id));
      if (!listing) return res.status(404).json({ message: "Listing not found." });
      const isCreator = listing.creatorId === userId;
      const hasPurchased = isCreator ? true : await storage.hasBuyerPurchasedListing(userId, listing.id);
      if (!isCreator && !hasPurchased) {
        return res.status(403).json({
          message: "AI Analysis is only available to the creator or buyers of this listing.",
        });
      }
      const user = await storage.getUser(userId);
      const plan = (user?.subscriptionPlan as SubscriptionPlan) || "INDIVIDUAL_FREE";
      const analysis = await analyzeSpcListing({ userId, plan, listing });
      return res.json(analysis);
    } catch (err: any) {
      console.error("SPC AI analysis error:", err);
      const status =
        err.status ||
        (err instanceof SpcAnalysisProTierRequiredError ? 402 : 500);
      return res.status(status).json({ message: err.message });
    }
  });

  app.delete("/api/sphinx/listings/:id", requireAuth, async (req, res) => {
    try {
      const creatorId = currentUserId(req)!;
      const listing = await storage.getSpcListing(String(req.params.id));
      if (!listing) return res.status(404).json({ message: "Listing not found." });
      if (listing.creatorId !== creatorId) {
        return res.status(403).json({ message: "Only the creator can delist." });
      }
      const updated = await storage.updateSpcListing(String(req.params.id), { status: "delisted" });
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/sphinx/listings/:id/purchase", requireAuth, async (req, res) => {
    try {
      const buyerId = currentUserId(req)!;
      // Phase K — corporate scope enforcement. CORPORATE listings can only
      // be purchased by members of the same institution as the creator. BOTH
      // and OPEN are unrestricted (open-market behavior). We check this
      // BEFORE executePurchase to avoid a wasted credit-debit transaction.
      const target = await storage.getSpcListing(String(req.params.id));
      if (target && target.scope === "CORPORATE") {
        const buyer = await storage.getUser(buyerId);
        const buyerInst = (buyer?.institution ?? "").trim().toLowerCase();
        const listingInst = (target.institution ?? "").trim().toLowerCase();
        if (!buyerInst || !listingInst || buyerInst !== listingInst) {
          return res.status(403).json({
            message: "This SPC is restricted to members of the publishing institution.",
          });
        }
      }
      const outcome = await executePurchase(buyerId, String(req.params.id));
      await orchestrator.emit(buyerId, "spc.purchased", {
        listingId: outcome.listing.id,
        asRole: "buyer",
      }, outcome.arkScoreDelta.buyer);
      await orchestrator.emit(outcome.listing.creatorId, "spc.purchased", {
        listingId: outcome.listing.id,
        asRole: "creator",
        isFirstSaleForCreator: outcome.isFirstSaleForCreator,
      }, outcome.arkScoreDelta.creator);

      // M3 — purchases shift sales-count, which feeds the roundtable composite.
      recomputeRoundtable().catch(() => null);
      // First sale gets a persistent notification badge for the creator.
      if (outcome.isFirstSaleForCreator) {
        const { persistAndBroadcastNotification } = await import("./sphinxSynergy");
        persistAndBroadcastNotification(outcome.listing.creatorId, {
          type: "spc.first_sale",
          title: `First sale — ${outcome.listing.title}`,
          body: `Your SPC just made its first sale.`,
          link: `/marketplace/${outcome.listing.id}`,
          payload: { listingId: outcome.listing.id },
        }).catch(() => null);
      }
      // Enrich the listing with the same DRM envelope as GET /listings/:id so
      // the client's bodyLocked check immediately swaps the taxonomy panel for
      // the full prompt without needing a refetch.
      const enriched = {
        ...outcome,
        listing: {
          ...outcome.listing,
          bodyLocked: false,
          bodyLength: outcome.listing.body.length,
        },
      };
      return res.json(enriched);
    } catch (err: any) {
      console.error("Purchase error:", err);
      const status = /not found|insufficient|own SPC|not available|already purchased/.test(err.message) ? 400 : 500;
      return res.status(status).json({ message: err.message });
    }
  });

  app.get("/api/sphinx/credits/:userId", requireSelf("userId"), async (req, res) => {
    try {
      const credits = await getOrCreateCredits(String(req.params.userId));
      return res.json(credits);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sphinx/listings/by-creator/:userId", async (req, res) => {
    try {
      const creatorId = String(req.params.userId);
      const viewerId = currentUserId(req);
      const isCreator = viewerId === creatorId;
      const listings = await storage.getSpcListingsByCreator(creatorId);
      const result = listings.map((l) =>
        isCreator
          ? { ...l, bodyLocked: false, bodyLength: l.body.length }
          : { ...l, body: redactBody(l.body), bodyLocked: true, bodyLength: l.body.length },
      );
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sphinx/sales/:userId", requireSelf("userId"), async (req, res) => {
    try {
      const purchases = await storage.getSpcPurchasesByCreator(String(req.params.userId));
      const totalEarned = purchases.reduce((s, p) => s + p.creatorShare, 0);
      return res.json({ purchases, totalEarned, salesCount: purchases.length });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // ── Phase K — Corporate Marketplace (flag-gated CLASS C surface) ───
  // ────────────────────────────────────────────────────────────────────

  // List corporate-scope SPCs for the caller's institution. Returns 403 if
  // the caller has no institution on their profile (the corporate market
  // is fundamentally institution-scoped — no fallback to global).
  app.get("/api/sphinx/corporate/listings", requireFeature("corporateMarketplace"), requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const me = await storage.getUser(userId);
      const inst = (me?.institution ?? "").trim();
      if (!inst) {
        return res.status(403).json({
          message: "No institution on your profile — corporate marketplace unavailable.",
        });
      }
      const pillar = typeof req.query.pillar === "string" && req.query.pillar !== "All" ? req.query.pillar : undefined;
      const rows = await storage.getCorporateListings(inst, { pillar, status: "active" });
      // Same body-redaction envelope as the open market.
      const redacted = rows.map((l) => ({
        ...l,
        body: redactBody(l.body),
        bodyLocked: true,
        bodyLength: l.body.length,
      }));
      return res.json({ institution: inst, listings: redacted });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  const submitFeedbackSchema = z.object({
    stars: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional(),
  });

  // Submit (or attempt to submit — duplicates 409) star feedback on a SPC.
  // Buyer-only; bonus credits are paid to the creator inside the txn.
  app.post("/api/sphinx/listings/:id/feedback", requireFeature("corporateMarketplace"), requireAuth, async (req, res) => {
    try {
      const buyerId = currentUserId(req)!;
      const parsed = submitFeedbackSchema.parse(req.body);
      const result = await storage.submitSpcFeedback({
        listingId: String(req.params.id),
        buyerId,
        stars: parsed.stars,
        comment: parsed.comment ?? null,
      });
      return res.status(201).json(result);
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      const status =
        /already left feedback/.test(msg) ? 409 :
        /verified buyers|own SPC|between 1 and 5|not found/.test(msg) ? 400 :
        500;
      return res.status(status).json({ message: msg });
    }
  });

  // Read feedback aggregate + recent comments for a listing. Visible to any
  // authenticated user once the feature flag is on (transparent reputation).
  app.get("/api/sphinx/listings/:id/feedback", requireFeature("corporateMarketplace"), requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const listingId = String(req.params.id);
      const summary = await storage.getSpcFeedbackForListing(listingId);
      const mine = await storage.getSpcFeedbackByBuyer(listingId, userId);
      return res.json({ ...summary, mine: mine ?? null });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sphinx/purchases/:userId", requireSelf("userId"), async (req, res) => {
    try {
      const purchases = await storage.getSpcPurchasesByBuyer(String(req.params.userId));
      const listingIds = Array.from(new Set(purchases.map((p) => p.listingId)));
      const listings = await Promise.all(listingIds.map((id) => storage.getSpcListing(id)));
      const byId = new Map(listings.filter((l): l is NonNullable<typeof l> => !!l).map((l) => [l.id, l]));
      const enriched = purchases.map((p) => ({ ...p, listing: byId.get(p.listingId) ?? null }));
      return res.json(enriched);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // ── M3 — Synergy engine, complementary pairs, ARK Roundtable, notifications
  // ────────────────────────────────────────────────────────────────────

  const synergyCalcSchema = z.object({
    cardIds: z.array(z.string().min(1).max(64)).min(2).max(5),
  });

  // POST /api/sphinx/synergies/calculate — informational synergy preview.
  // Synergy is NOT an ARK score writer in MVP. If/when we activate it, the
  // emission MUST route through orchestrator → arkRecalc.applyCaps under the
  // existing SPHINX +20/30d cap (see threat_model.md §Elevation of Privilege).
  app.post("/api/sphinx/synergies/calculate", requireFeature("sphinxAdvanced"), requireAuth, async (req, res) => {
    try {
      const parsed = synergyCalcSchema.parse(req.body);
      const result = await calculateSynergy(parsed.cardIds);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  // GET /api/sphinx/pairs/top — top-15 strongest synergy pairs platform-wide.
  app.get("/api/sphinx/pairs/top", requireFeature("sphinxAdvanced"), requireAuth, async (_req, res) => {
    try {
      const rows = await getTopPairsPlatform(15);
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // GET /api/sphinx/listings/:id/complementary — top-5 listing partners.
  app.get("/api/sphinx/listings/:id/complementary", requireFeature("sphinxAdvanced"), requireAuth, async (req, res) => {
    try {
      const id = String(req.params.id);
      let pairs = await getComplementaryForListing(id);
      // Lazy compute on first access if cache is cold.
      if (pairs.length === 0) {
        await recomputeComplementaryFor(id, 5);
        pairs = await getComplementaryForListing(id);
      }
      const redacted = pairs.map((p) => p.partner ? ({
        rank: p.rank,
        score: p.score,
        partner: { ...p.partner, body: "", bodyLocked: true, bodyLength: p.partner.body.length },
      }) : null).filter(Boolean);
      return res.json(redacted);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // GET /api/sphinx/roundtable — current Top-12 snapshot.
  // Re-compute on every fetch so rankDelta + seatSinceAt are always fresh
  // relative to the previous snapshot stored in roundtable_state. This is
  // a 12-row leaderboard — write cost is negligible.
  app.get("/api/sphinx/roundtable", requireFeature("sphinxAdvanced"), requireAuth, async (_req, res) => {
    try {
      const { seats } = await recomputeRoundtable();
      const listingIds = Array.from(new Set(seats.map((s) => s.listingId)));
      const creatorIds = Array.from(new Set(seats.map((s) => s.creatorId)));
      const [listings, creators] = await Promise.all([
        Promise.all(listingIds.map((id) => storage.getSpcListing(id))),
        Promise.all(creatorIds.map((id) => storage.getUser(id))),
      ]);
      const lById = new Map(listings.filter(Boolean).map((l) => [l!.id, l!]));
      const cById = new Map(creators.filter(Boolean).map((c) => [c!.id, c!]));
      const nowMs = Date.now();
      const enriched = seats.map((s) => {
        const l = lById.get(s.listingId);
        const cr = cById.get(s.creatorId);
        const sinceMs = s.seatSinceAt ? new Date(s.seatSinceAt).getTime() : nowMs;
        return {
          seatNumber: s.seatNumber,
          score: Math.round(s.score),
          hiveScore: Math.round(s.hiveScore),
          salesCount: s.salesCount,
          snapshotAt: s.snapshotAt,
          rankDelta: s.rankDelta ?? 0,
          seatSinceAt: s.seatSinceAt ?? s.snapshotAt,
          timeHeldMs: Math.max(0, nowMs - sinceMs),
          listing: l ? { id: l.id, title: l.title, pillar: l.pillar, priceCredits: l.priceCredits, hiveScore: l.hiveScore } : null,
          creator: cr ? { id: cr.id, name: cr.name } : null,
        };
      });
      return res.json(enriched);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // POST /api/sphinx/roundtable/recompute — admin-only manual trigger.
  // Gate matches the canonical ADMIN_USER_ID pattern used by all other
  // admin routes (e.g. /api/admin/ark/backfill at routes.ts:1179).
  app.post("/api/sphinx/roundtable/recompute", requireFeature("sphinxAdvanced"), requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const adminId = process.env.ADMIN_USER_ID;
      if (!adminId || userId !== adminId) {
        return res.status(403).json({ message: "Admin only." });
      }
      const result = await recomputeRoundtable();
      return res.json({ seats: result.seats.length, rotated: result.rotated });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Notifications inbox ───────────────────────────────
  app.get("/api/notifications", requireFeature("notifications"), requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const [items, unread] = await Promise.all([
        listNotifications(userId, 25),
        countUnread(userId),
      ]);
      return res.json({ items, unread });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // ── M4 — SPHINX × Matrix Synthesis Engine & ZPOS Compression
  // ────────────────────────────────────────────────────────────────────
  // Multi-card synthesis cart. createSession runs ZPOS compression and
  // computes a preview royalty split. finalize is fully transactional and
  // emits per-creator + per-buyer ARK deltas through orchestrator → arkRecalc
  // (already capped at SPHINX +20/30d). Combined output is DRM-redacted for
  // anyone other than the originating buyer.
  const {
    createSynthesisSession,
    finalizeSynthesisSession,
    countSynthesesForListing,
    recentSynthesesForListing,
    getSessionForBuyer,
    SynthesisError,
  } = await import("./synthesis");
  const { ZPOS_METHODS: ZPOS_METHOD_LIST } = await import("@shared/schema");

  // Accepts `cardIds[]` (spec) or `listingIds[]` (legacy alias) — same
  // semantic. Schema normalises to `listingIds` for downstream consumers.
  const synthesisCreateSchema = z.object({
    cardIds: z.array(z.string().min(1)).min(2).max(7).optional(),
    listingIds: z.array(z.string().min(1)).min(2).max(7).optional(),
    zposMethod: z.enum(ZPOS_METHOD_LIST as readonly [string, ...string[]]).optional(),
  }).refine((d) => !!(d.cardIds?.length || d.listingIds?.length), {
    message: "cardIds (or listingIds) is required.",
  }).transform((d) => ({
    listingIds: (d.cardIds ?? d.listingIds)!,
    zposMethod: d.zposMethod,
  }));

  // DRM gate. Three views of a synthesis session:
  //   1. Originating buyer, status === "finalized" → full combinedOutput.
  //   2. Originating buyer, status === "preview"   → SHORT truncated
  //      compressed preview (so they can decide before paying) +
  //      bodyLocked: true on the full body.
  //   3. Anyone else                               → locked taxonomy panel
  //      (metadata + split summary, NO body, NO locked prices).
  const SYNTH_PREVIEW_CHARS = 280;
  const presentSynthesis = (s: any, viewerId: string) => {
    const isOwner = s.buyerId === viewerId;
    const isUnlocked = isOwner && s.status === "finalized";
    if (isOwner) {
      return {
        ...s,
        combinedOutput: isUnlocked ? s.combinedOutput : "",
        previewSnippet: isUnlocked
          ? null
          : (s.combinedOutput?.slice(0, SYNTH_PREVIEW_CHARS) ?? ""),
        previewTruncated: !isUnlocked && (s.combinedOutput?.length ?? 0) > SYNTH_PREVIEW_CHARS,
        bodyLocked: !isUnlocked,
        bodyLength: s.combinedOutput?.length ?? 0,
      };
    }
    // Non-buyer locked taxonomy view — exposes shape + ZPOS metadata only.
    return {
      id: s.id,
      status: s.status,
      sourceListingIds: s.sourceListingIds,
      zposMethod: s.zposMethod,
      preTokens: s.preTokens,
      postTokens: s.postTokens,
      reductionPct: s.reductionPct,
      semanticPreservation: s.semanticPreservation,
      totalCreditPrice: s.totalCreditPrice,
      createdAt: s.createdAt,
      finalizedAt: s.finalizedAt,
      bodyLocked: true,
      bodyLength: s.combinedOutput?.length ?? 0,
      restricted: true,
    };
  };

  // POST /api/sphinx/synthesis/sessions — create a preview session.
  // Routes are mounted under /api/sphinx — declared BEFORE /listings/:id
  // matchers above? They're already declared below, but Express matches
  // in declaration order, and these slugs don't collide with /listings/:id.
  app.post("/api/sphinx/synthesis/sessions", requireFeature("sphinxAdvanced"), requireAuth, async (req, res) => {
    try {
      const buyerId = currentUserId(req)!;
      const parsed = synthesisCreateSchema.parse(req.body ?? {});
      const session = await createSynthesisSession({
        buyerId, listingIds: parsed.listingIds, zposMethod: parsed.zposMethod as any,
      });
      return res.json(presentSynthesis(session, buyerId));
    } catch (err: any) {
      const status = err instanceof SynthesisError ? err.status : 400;
      return res.status(status).json({ message: err.message });
    }
  });

  // GET /api/sphinx/synthesis/sessions/:id — only the originating buyer
  // sees the full combined body; everyone else gets redacted metadata.
  app.get("/api/sphinx/synthesis/sessions/:id", requireFeature("sphinxAdvanced"), requireAuth, async (req, res) => {
    try {
      const viewerId = currentUserId(req)!;
      const { getSynthesisSessionAny } = await import("./synthesis");
      const session = await getSynthesisSessionAny(String(req.params.id));
      if (!session) return res.status(404).json({ message: "Session not found." });
      return res.json(presentSynthesis(session, viewerId));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // POST /api/sphinx/synthesis/sessions/:id/finalize — debit + royalties + grant.
  app.post("/api/sphinx/synthesis/sessions/:id/finalize", requireFeature("sphinxAdvanced"), requireAuth, async (req, res) => {
    try {
      const buyerId = currentUserId(req)!;
      const outcome = await finalizeSynthesisSession({ buyerId, sessionId: String(req.params.id) });

      // ARK deltas — route through orchestrator so arkRecalc.applyCaps enforces
      // the SPHINX +20/30d ceiling. One buyer event, one event per unique creator.
      await orchestrator.emit(buyerId, "spc.purchased", {
        sessionId: outcome.session.id,
        asRole: "buyer",
        synthesis: true,
      }, 1);
      const creditedCreators = new Map<string, number>();
      for (const s of outcome.splits) {
        creditedCreators.set(s.creatorId, (creditedCreators.get(s.creatorId) ?? 0) + s.creditedAmount);
      }
      for (const [creatorId, amount] of creditedCreators.entries()) {
        if (amount <= 0) continue;
        await orchestrator.emit(creatorId, "spc.purchased", {
          sessionId: outcome.session.id,
          asRole: "creator",
          synthesis: true,
        }, 2);
        const { persistAndBroadcastNotification } = await import("./sphinxSynergy");
        persistAndBroadcastNotification(creatorId, {
          type: "synthesis.completed",
          title: `Royalty from synthesis +${amount} cr`,
          body: `One of your SPCs was used in a multi-card synthesis.`,
          link: `/marketplace`,
          payload: { sessionId: outcome.session.id, amount },
        }).catch(() => null);
      }
      // Broadcast the user-scoped synthesis.completed for the buyer's own SSE.
      orchestrator.broadcastToUser(buyerId, "synthesis.completed", {
        sessionId: outcome.session.id,
        buyerBalance: outcome.buyerBalance,
        reductionPct: outcome.session.reductionPct,
        zposMethod: outcome.session.zposMethod,
      });

      return res.json({
        ...outcome,
        session: presentSynthesis(outcome.session, buyerId),
      });
    } catch (err: any) {
      console.error("Synthesis finalize error:", err);
      const status = err instanceof SynthesisError ? err.status : 500;
      return res.status(status).json({ message: err.message });
    }
  });

  // GET /api/sphinx/listings/:id/syntheses — "Used in N syntheses" + recent
  // metadata for the Synthesis tab on the listing detail page.
  app.get("/api/sphinx/listings/:id/syntheses", requireFeature("sphinxAdvanced"), async (req, res) => {
    try {
      const listingId = String(req.params.id);
      const [count, recent] = await Promise.all([
        countSynthesesForListing(listingId),
        recentSynthesesForListing(listingId, 5),
      ]);
      return res.json({ count, recent });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  const markReadSchema = z.object({ ids: z.array(z.string()).optional() });
  app.post("/api/notifications/read", requireFeature("notifications"), requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const parsed = markReadSchema.parse(req.body ?? {});
      const n = await markNotificationsRead(userId, parsed.ids);
      return res.json({ marked: n });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  // ── Seed endpoint (for initial data population) ───────
  // ===== Phase G — Cohorts (Institutional Tier) =====
  const cohortCreateSchema = z.object({
    name: z.string().min(2).max(120),
    institution: z.string().min(1).max(200),
    description: z.string().max(500).optional(),
  });
  const cohortMembersSchema = z.object({
    emails: z.array(z.string().email()).min(1).max(500),
  });
  const cohortAssignmentSchema = z.object({
    scenarioId: z.string().min(1),
    dueAt: z.string().datetime().nullable().optional(),
    note: z.string().max(500).optional(),
  });

  async function assertCohortOwnership(req: any, res: any): Promise<{ cohort: any } | null> {
    const sid = currentUserId(req);
    const c = await storage.getCohort(req.params.id);
    if (!c) { res.status(404).json({ message: "Cohort not found." }); return null; }
    if (c.instructorId !== sid) { res.status(403).json({ message: "Not your cohort." }); return null; }
    return { cohort: c };
  }

  app.get("/api/cohorts", requireFeature("cohorts"), requireInstructor, async (req, res) => {
    const sid = currentUserId(req)!;
    const list = await storage.getCohortsByInstructor(sid);
    res.json(list);
  });

  app.post("/api/cohorts", requireFeature("cohorts"), requireInstructor, async (req, res) => {
    const parsed = cohortCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input.", issues: parsed.error.issues });
    const sid = currentUserId(req)!;
    const cohort = await storage.createCohort({ ...parsed.data, instructorId: sid });
    res.status(201).json(cohort);
  });

  app.get("/api/cohorts/comparison", requireFeature("cohorts"), requireInstructor, async (req, res) => {
    const sid = currentUserId(req)!;
    const data = await storage.getCohortComparison(sid);
    res.json(data);
  });

  app.get("/api/cohorts/:id", requireFeature("cohorts"), requireInstructor, async (req, res) => {
    const ctx = await assertCohortOwnership(req, res);
    if (!ctx) return;
    const [members, assignments] = await Promise.all([
      storage.getCohortMembers(ctx.cohort.id),
      storage.getCohortAssignments(ctx.cohort.id),
    ]);
    res.json({ cohort: ctx.cohort, members, assignments });
  });

  app.post("/api/cohorts/:id/members", requireFeature("cohorts"), requireInstructor, async (req, res) => {
    const ctx = await assertCohortOwnership(req, res);
    if (!ctx) return;
    const parsed = cohortMembersSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input.", issues: parsed.error.issues });
    const rows = parsed.data.emails.map(e => ({ invitedEmail: e }));
    const result = await storage.addCohortMembers(ctx.cohort.id, rows);
    res.status(201).json(result);
  });

  app.delete("/api/cohorts/:id/members/:userId", requireFeature("cohorts"), requireInstructor, async (req, res) => {
    const ctx = await assertCohortOwnership(req, res);
    if (!ctx) return;
    const ok = await storage.removeCohortMember(ctx.cohort.id, String(req.params.userId));
    res.json({ removed: ok });
  });

  app.get("/api/cohorts/:id/assignments", requireFeature("cohorts"), requireInstructor, async (req, res) => {
    const ctx = await assertCohortOwnership(req, res);
    if (!ctx) return;
    const list = await storage.getCohortAssignments(ctx.cohort.id);
    res.json(list);
  });

  app.post("/api/cohorts/:id/assignments", requireFeature("cohorts"), requireInstructor, async (req, res) => {
    const ctx = await assertCohortOwnership(req, res);
    if (!ctx) return;
    const parsed = cohortAssignmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input.", issues: parsed.error.issues });
    const sc = await storage.getCcgeScenario(parsed.data.scenarioId);
    if (!sc) return res.status(404).json({ message: "Scenario not found." });
    const sid = currentUserId(req)!;
    const a = await storage.createCohortAssignment({
      cohortId: ctx.cohort.id,
      scenarioId: parsed.data.scenarioId,
      assignedBy: sid,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      note: parsed.data.note ?? null,
    });
    res.status(201).json(a);
  });

  app.get("/api/cohorts/:id/grades", requireFeature("cohorts"), requireInstructor, async (req, res) => {
    const ctx = await assertCohortOwnership(req, res);
    if (!ctx) return;
    const grades = await storage.getCohortGrades(ctx.cohort.id);
    res.json(grades);
  });

  app.get("/api/cohorts/:id/grades.csv", requireFeature("cohorts"), requireInstructor, async (req, res) => {
    const ctx = await assertCohortOwnership(req, res);
    if (!ctx) return;
    const grades = await storage.getCohortGrades(ctx.cohort.id);
    const esc = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["student_name", "student_email", "scenario_title", "best_jcse", "best_tier", "attempts", "due_at", "last_attempt_at", "on_time"];
    const lines = [header.join(",")];
    for (const g of grades) {
      lines.push([
        esc(g.studentName), esc(g.studentEmail), esc(g.scenarioTitle),
        esc(g.bestJcse), esc(g.bestTier), esc(g.attempts),
        esc(g.dueAt?.toISOString() ?? ""), esc(g.lastAttemptAt?.toISOString() ?? ""),
        g.onTime === null ? "" : g.onTime ? "yes" : "no",
      ].join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="cohort-${ctx.cohort.id}-grades.csv"`);
    res.send(lines.join("\n"));
  });

  // Student-facing: list cohorts the current user belongs to.
  app.get("/api/me/cohorts", requireFeature("cohorts"), requireAuth, async (req, res) => {
    const sid = currentUserId(req)!;
    const list = await storage.getCohortsForStudent(sid);
    res.json(list);
  });

  app.post("/api/seed", async (_req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      // Seed Jnomics Cards from the canonical CODEC primitive catalog.
      // The DB row stores id/name/tier(=category)/type(=persona)/emoji/
      // description/basePts. Skill-standard mappings (O*NET / SFIA / WEF)
      // come from shared/codec-primitives.ts and are merged at API time.
      // Drop legacy SPC-style rows (card-001..card-010) from the prior seed.
      await storage.deleteJnomicsCardsByIdPrefix("card-");
      for (const p of CODEC_PRIMITIVES) {
        await storage.upsertJnomicsCard({
          id: p.id,
          name: p.name,
          tier: p.category,
          type: p.persona,
          emoji: p.emoji,
          description: p.description,
          basePts: p.basePts,
        });
      }

      // Seed Departments
      const existingDepts = await storage.getAllDepartments();
      if (existingDepts.length === 0) {
        const deptSeeds = [
          { name: "Customer Support", risk: 88, headcount: 850, seniority: "Junior", location: "Global" },
          { name: "Data Entry & Admin", risk: 95, headcount: 320, seniority: "Junior", location: "APAC" },
          { name: "Financial Analysis", risk: 65, headcount: 145, seniority: "Mid-Level", location: "NA" },
          { name: "Software Engineering", risk: 40, headcount: 620, seniority: "Mid-Level", location: "Global" },
          { name: "Strategic Planning", risk: 15, headcount: 45, seniority: "Senior", location: "NA" },
          { name: "HR & Talent", risk: 55, headcount: 110, seniority: "Mid-Level", location: "EMEA" },
          { name: "Legal & Compliance", risk: 35, headcount: 85, seniority: "Senior", location: "Global" },
        ];
        for (const dept of deptSeeds) {
          await storage.createDepartment(dept);
        }
      }

      // Seed a demo user
      const existingDemo = await storage.getUserByUsername("analyst@enterprise.com");
      if (!existingDemo) {
        const demoUser = await storage.createUser({
          username: "analyst@enterprise.com",
          password: "arkplatform",
          name: "Alex Vance",
          role: "Senior Systems Analyst",
          department: "Software Engineering",
          seniority: "Mid-Level",
          location: "Global",
        });

        // Seed assessment for demo user
        const assessment = await storage.createAssessment({
          userId: demoUser.id,
          jstTotal: 242,
          jstJobs: 82,
          jstSkills: 78,
          jstTalent: 82,
          vulnerabilityLevel: 1,
          readinessProfile: "Architect",
          riskModifiers: [
            { task: "Routine Data Analysis", automatable: 85 },
            { task: "System Configuration", automatable: 60 },
            { task: "Stakeholder Communication", automatable: 15 },
          ],
          matchedCardIds: ["codec-elephant", "codec-platform", "codec-business-processes", "codec-innovation", "codec-revenue"],
        });

        await storage.createUpskillingPlans([
          { assessmentId: assessment.id, phase: "30-Day", type: "ready-skilling", title: "Prompt Engineering Foundations", description: "Master LLM interaction protocols for system analysis tasks to mitigate immediate automation risk.", hours: 15 },
          { assessmentId: assessment.id, phase: "90-Day", type: "up-skilling", title: "Cloud Architecture Synthesis", description: "Deepen expertise in multi-cloud environments to increase JST skills score.", hours: 45 },
          { assessmentId: assessment.id, phase: "12-Month", type: "new-skilling", title: "AI Orchestration Leadership", description: "Transition to AI Integration Manager role. Focus on strategic deployment of ML models.", hours: 120 },
        ]);

        await storage.createPivotOpportunities([
          { assessmentId: assessment.id, role: "AI Integration Manager", feasibility: 82, gapCost: "$2,400", time: "6 Months" },
          { assessmentId: assessment.id, role: "Data Strategy Lead", feasibility: 75, gapCost: "$4,100", time: "9 Months" },
          { assessmentId: assessment.id, role: "Product Operations Dir.", feasibility: 68, gapCost: "$5,500", time: "12 Months" },
        ]);

        await storage.createTransferabilityVectors([
          { assessmentId: assessment.id, subject: "Industry Mobility", score: 85 },
          { assessmentId: assessment.id, subject: "Geographic Port.", score: 60 },
          { assessmentId: assessment.id, subject: "Innovation Trans.", score: 75 },
          { assessmentId: assessment.id, subject: "Leadership Scal.", score: 55 },
          { assessmentId: assessment.id, subject: "Tech Fluency", score: 90 },
          { assessmentId: assessment.id, subject: "Data Literacy", score: 80 },
          { assessmentId: assessment.id, subject: "Creative Problem", score: 70 },
          { assessmentId: assessment.id, subject: "Comm. Impact", score: 65 },
          { assessmentId: assessment.id, subject: "Agility Index", score: 88 },
          { assessmentId: assessment.id, subject: "Domain Breadth", score: 50 },
          { assessmentId: assessment.id, subject: "Execution Speed", score: 75 },
          { assessmentId: assessment.id, subject: "Strategic Vision", score: 60 },
        ]);
      }

      // Task #25 — make the demo user an institution (ENTERPRISE) admin so the
      // workforce / HR-connector surface is reachable when its flag is on, and
      // seed a small sample staff roster joined to the demo's own ARK account.
      const WORKFORCE_INSTITUTION = "Vance Industries";
      const demoForWorkforce = await storage.getUserByUsername("analyst@enterprise.com");
      if (demoForWorkforce) {
        await storage.updateUser(demoForWorkforce.id, {
          subscriptionPlan: "ENTERPRISE",
          institution: WORKFORCE_INSTITUTION,
        });
        const existingStaff = await storage.getStaffRecords(WORKFORCE_INSTITUTION);
        if (existingStaff.length === 0) {
          const seedBatch = await storage.createImportBatch({
            institution: WORKFORCE_INSTITUTION,
            adapter: "csv",
            filename: "seed-roster.csv",
            importedBy: demoForWorkforce.id,
            totalRows: 8,
            importedRows: 0,
            updatedRows: 0,
            errorRows: 0,
            errors: [],
            columnMapping: {},
          });
          const today = new Date();
          const yearsAgo = (y: number) =>
            new Date(today.getFullYear() - y, today.getMonth(), today.getDate())
              .toISOString()
              .slice(0, 10);
          const seedStaff = [
            { fullName: "Alex Vance", email: "analyst@enterprise.com", jobTitle: "Senior Systems Analyst", department: "Software Engineering", team: "Platform", hireDate: yearsAgo(6), performanceRating: "Exceeds", compensationBand: "L5", manager: "Dana Reyes", location: "Global" },
            { fullName: "Priya Patel", email: "priya@vance.example", jobTitle: "Data Engineer", department: "Software Engineering", team: "Data", hireDate: yearsAgo(2), performanceRating: "Meets", compensationBand: "L4", manager: "Dana Reyes", location: "Remote" },
            { fullName: "Marcus Lee", email: "marcus@vance.example", jobTitle: "Product Manager", department: "Product", team: "Growth", hireDate: yearsAgo(4), performanceRating: "Exceeds", compensationBand: "L5", manager: "Sam Okafor", location: "NA" },
            { fullName: "Elena Rossi", email: "elena@vance.example", jobTitle: "UX Designer", department: "Product", team: "Design", hireDate: yearsAgo(1), performanceRating: "Meets", compensationBand: "L3", manager: "Sam Okafor", location: "EU" },
            { fullName: "James Carter", email: "james@vance.example", jobTitle: "Sales Director", department: "Revenue", team: "Enterprise Sales", hireDate: yearsAgo(8), performanceRating: "Exceeds", compensationBand: "L6", manager: "Nina Brooks", location: "NA" },
            { fullName: "Sofia Garcia", email: "sofia@vance.example", jobTitle: "Account Executive", department: "Revenue", team: "Enterprise Sales", hireDate: yearsAgo(3), performanceRating: "Meets", compensationBand: "L4", manager: "Nina Brooks", location: "NA" },
            { fullName: "Tom Becker", email: "tom@vance.example", jobTitle: "Operations Lead", department: "Operations", team: "FinOps", hireDate: yearsAgo(11), performanceRating: "Meets", compensationBand: "L5", manager: "Nina Brooks", location: "EU" },
            { fullName: "Aisha Khan", email: "aisha@vance.example", jobTitle: "ML Researcher", department: "Software Engineering", team: "AI", hireDate: yearsAgo(1), performanceRating: "Exceeds", compensationBand: "L5", manager: "Dana Reyes", location: "Remote" },
          ];
          await storage.upsertStaffRecords(WORKFORCE_INSTITUTION, seedBatch.id, seedStaff);
        }
      }

      // Seed CCGE cards + scenarios
      const ccge = await seedCcge();

      // Seed SPHINX marketplace: a second creator user + a few sample listings
      let creatorId: string | undefined;
      const existingCreator = await storage.getUserByUsername("creator@sphinx.io");
      if (!existingCreator) {
        const creator = await storage.createUser({
          username: "creator@sphinx.io",
          password: "arkplatform",
          name: "Maya Chen",
          role: "Prompt Architect",
          department: "Strategic Planning",
          seniority: "Senior",
          location: "NA",
        });
        await storage.updateUser(creator.id, { contextCraftCertLevel: "CC_500" });
        creatorId = creator.id;
        await storage.createAssessment({
          userId: creator.id,
          jstTotal: 268,
          jstJobs: 89,
          jstSkills: 92,
          jstTalent: 87,
          vulnerabilityLevel: 1,
          readinessProfile: "Architect",
          riskModifiers: [{ task: "Manual report generation", automatable: 75 }],
          matchedCardIds: ["codec-elephant", "codec-business-processes", "codec-platform", "codec-innovation"],
        });
        await getOrCreateCredits(creator.id);
      } else {
        creatorId = existingCreator.id;
        // Re-assert Gold-eligible cert even on pre-existing creator rows so
        // drifted dev DBs cannot violate the SPC_MIN_CERT_TO_PUBLISH=CC_400
        // gate that authored listings below depend on.
        if (existingCreator.contextCraftCertLevel !== "CC_500") {
          await storage.updateUser(existingCreator.id, { contextCraftCertLevel: "CC_500" });
        }
      }

      const existingListings = await storage.getAllSpcListings();
      let spcListingsCount = existingListings.length;
      const existingTitles = new Set(existingListings.map((l) => l.title));

      // Canonical FORGE-certified SPCs (ATLAS / BUGMXT / SPARTAN) — seeded
      // separately so they survive even on environments that already have
      // the original three sample listings.
      if (creatorId) {
        const canonSamples = [
          {
            title: "ATLAS ULTRA SI — PromptWare Design Document Architect",
            description: "FORGE Ultra Premium (JCSE 50/50) SPC that converts any requirements input (SDD, PDD, brief, raw prompt) into a certified 4-Part ATLAS PromptWare Design Document with Atomic Prompt enforcement and 45% token reduction.",
            pillar: "System",
            priceCredits: 200,
            body: "[SYSTEM]\nYou are ATLAS ULTRA SI — the Automated Translation & Layout System — the definitive PromptWare Design Document Architect within the Junglenomics 4J.BONSAI ecosystem. You operate under the FORGE 7-Step Pipeline and Context Craft 7-Pillar Framework. GRO DNA: LIFE MODE.\n\n[ROLE]\nArchitect + Translator + Enforcer + Optimizer + Communicator. Decompose requirements into Atomic Prompts; convert any document type into the ATLAS PDD 4-Part Standard; validate every prompt against Atomic compliance; apply ZPOS token optimization; tune each Part to its stakeholder audience.\n\n[INSTRUCTION]\nStep 1 — Input Classification (SDD/PDD/Concept/Brief/Raw Prompt).\nStep 2 — Atomic Decomposition (ONE operation per prompt, verifiable I/O, no compound logic, priority + token count).\nStep 3 — SPC Taxonomy Assignment (4-8 SPCs from 48-card framework, Camelot seats, lineage chain).\nStep 4 — 4-Part PDD Assembly (Cheat Sheet · Exec Summary · Worksheet · Implementation).\nStep 5 — JCSE Scoring (0-50, certify FORGE tier).\n\n[CONSTRAINT]\nC-01 Atomic Prompt compliance is non-negotiable. C-02 Part 1 fits on ONE page. C-03 No scope creep between Parts. C-04 JCSE must be computed before FORGE certification. C-05 ZPOS reduction ≥35%. C-06 Validate prompts BEFORE inclusion. C-07 Token counts in Parts 1 + 3.\n\n[FORMAT]\nPART 1 Single-Page Cheat Sheet · PART 2 Executive Summary · PART 3 Comprehensive Worksheet (Atomic Prompts) · PART 4 VIBE DJ Implementation Plan.\n\n[DATA]\nTokens: 35-45% reduction target. Semantic preservation floor 95%, target 97%+. Ultra Premium JCSE threshold 49-50. 5 deployment phases per Worksheet. 12 Camelot seats + Seat 0.",
          },
          {
            title: "BUGMXT SI — Five-Layer Code Integrity & PDD Fidelity Auditor",
            description: "FORGE Platinum (JCSE 46/50) SPC that runs Syntax → Logic → HARP → PDD Fidelity → Bayesian Execution Assurance on any codebase, with diff-ready recommendations and prioritized triage. Cuts production bug escapes 60-80%.",
            pillar: "Constraint",
            priceCredits: 150,
            body: "[SYSTEM]\nCode Integrity Sentinel — SI Class FORGE Agent operating on the 4J.BONSAI Production Floor. DNA: SPHINX (30%) + SOLVA (25%) + ADA (20%) + SOCRATES (15%) + HOLMES (10%). VIBE DJ selects analysis tools per language/runtime.\n\n[ROLE]\nSenior Code Archaeologist + PDD Fidelity Auditor + Execution Assurance Engineer.\n\n[INSTRUCTION]\nFor every input run the five-layer engine in sequence:\nLayer 1 SYNTAX SWEEP (SPHINX) — malformed code, wrong operators, type mismatches, undeclared identifiers.\nLayer 2 LOGIC & OUTCOME AUDIT (SOCRATES) — false positives, off-by-one, null-deref, silent catches, race conditions.\nLayer 3 HARP (ADA) — human readability (≤40-line functions, naming, docstrings) + AI parseability (type annotations, no circular deps, no prompt-injection vectors).\nLayer 4 PDD FIDELITY (ADA × SOCRATES) — Phase Coverage Scan · Prompt-to-Function Mapping · Spec-Drift Detection against the originating ATLAS PDD.\nLayer 5 EXECUTION ASSURANCE (HOLMES) — Bayesian severity ranking (Severity·0.35 + Likelihood·0.30 + BlastRadius·0.20 + DetectionDifficulty·0.15), top-3 CRITICAL triage board.\n\n[CONSTRAINT]\nNever alter source code directly — always produce diff-ready recommendations. Maintain PDD lineage traceability on every finding. Functions without PDD lineage MUST be flagged as Unauthorized Extensions. CRITICAL findings MUST include fix pathway (Patch / Refactor / Redesign) + regression risk.\n\n[FORMAT]\nStructured Bug Report per finding: [ID] | Layer | Severity | Location | Issue | Root Cause | Fix. Final Triage Board lists top 3 CRITICAL items with estimated fix time.\n\n[EXAMPLE]\n[PFP-DRIFT-012] | Severity: HIGH | PDD Phase GREEN Prompt #147 | ark.scoring.service.ts L89 | ARR sub-score hardcoded to 150, PDD specifies 200 | Fix: update ARR_MAX_SCORE constant to 200.",
          },
          {
            title: "SPARTAN SI — Dual-Input PDD & Codebase MVP Compression Engine",
            description: "FORGE Platinum (JCSE 49/50) SPC that compresses either an ATLAS PDD or a production codebase to a single-developer deployable MVP. 50-85% reduction with 100% feature fidelity and a documented upgrade path back to production.",
            pillar: "Instruction",
            priceCredits: 175,
            body: "[SYSTEM]\nYou are SPARTAN SI — the FORGE Institute's dual-input compression agent, certified to reduce both ATLAS PromptWare Design Documents and production Codebases to their minimum viable deployable form. You carry the full ATLAS Compression Methodology (ACM), extended with codebase analysis and integrated ZPOS+5 token optimization. VIBE DJ-coordinated: no architectural decision before tool selection. GRO DEFAULT: SAFE_LIFE.\n\n[ROLE]\nMVP Compression Architect. PDD-to-MVP via ACM · Codebase-to-MVP via SCCP · Single-platform deployment via VIBE DJ · Stack collapse mapping · Quality gate validation (FFS · AVS · CIS · UIS).\n\n[INSTRUCTION]\nRoute by input type. Execute 7-Step SCM:\n1 SCAN inputs (phases/prompts or files/modules/deps).\n2 PROFILE every unit into CLASS A (keep) / B (synthesize) / C (defer).\n3 ASSESS — VIBE DJ selects target MVP platform.\n4 REDUCE — remove CLASS C, synthesize CLASS B, retain CLASS A.\n5 TRANSFORM into target platform's native patterns.\n6 ZPOS+5 — PRISM for mission-critical prompts, QUANTUM for technical, applied to all prompts and inline comments.\n7 PACKAGE — MVP artifact + Stack Collapse Map + Upgrade Path Document.\n\n[CONSTRAINT]\nC-01 Feature Fidelity Score = 100%. C-02 Code Integrity ≥95%. C-03 No CLASS C deferral with user-facing consequences. C-04 Every CLASS C deferral needs a documented upgrade trigger (MAU · Revenue · Compliance · Date). C-05 VIBE DJ 8-tool matrix is mandatory. C-06 ZPOS+5 applied to all prompt + doc content. C-07 MVP executable by ONE developer using the selected VIBE app. C-08 Schemas forward-compatible to production. C-10 GRO escalates to Containment if FFS<95% or CIS<95%.\n\n[FORMAT]\nPart 1 VIBE DJ Analysis · Part 2 Stack/Dependency Collapse Map · Part 3 Compressed MVP artifact · Part 4 ZPOS+5 Optimisation Report · Part 5 Session Plan · Appendix Upgrade Path.\n\n[DATA]\nPDD path: 50-80% prompt reduction, 100% feature fidelity. Codebase path: 60-85% file reduction, 90-98% cost reduction, 100% UX fidelity.",
          },
        ];
        for (const s of canonSamples) {
          if (existingTitles.has(s.title)) continue;
          const precheck = runHivePrecheck({
            title: s.title,
            description: s.description,
            body: s.body,
            pillar: s.pillar,
          });
          await storage.createSpcListing({
            creatorId,
            title: s.title,
            description: s.description,
            body: s.body,
            pillar: s.pillar,
            priceCredits: s.priceCredits,
            kcseScore: precheck.kcseScore,
            hiveScore: precheck.hiveScore,
            status: "active",
          });
          spcListingsCount += 1;
        }
      }

      if (creatorId && existingListings.length === 0) {
        const samples = [
          {
            title: "Tier-1 Support Triage Architect",
            description: "Production-grade prompt that classifies, routes, and drafts responses to inbound support emails with strict policy guardrails.",
            pillar: "System",
            priceCredits: 25,
            body: "You are a Tier-1 customer support triage agent for an enterprise SaaS company.\n\nYour task is to receive an inbound support email and produce a structured JSON response.\n\nFirst, classify intent into one of: billing, bug_report, feature_request, account_access, other.\nThen, assess urgency: low, medium, high, critical.\nNext, draft a polite, on-brand response that never invents company policy.\nFinally, output strict JSON with keys: intent, urgency, suggested_response, requires_escalation.\n\nConstraints:\n- Do not invent refund policies.\n- Do not promise SLAs you can't verify.\n- If the request mentions security or PII, set requires_escalation to true.\n\nFormat: respond ONLY with valid JSON, no markdown fences.",
          },
          {
            title: "Sprint Standup Synthesis Engine",
            description: "Compresses three engineers' raw standup notes into a one-paragraph leadership digest with blockers surfaced.",
            pillar: "Instruction",
            priceCredits: 15,
            body: "You are a sprint synthesis assistant for an engineering manager.\n\nYour task is to read three engineers' raw standup notes (provided in <notes> tags) and produce a single one-paragraph executive digest.\n\nStep 1: Identify each engineer's main work item.\nStep 2: Surface any blockers using the exact word 'BLOCKER:'.\nStep 3: Note any cross-team dependencies.\nStep 4: End with a confidence rating (high/medium/low) about whether sprint goals will hit.\n\nConstraints:\n- Maximum 100 words.\n- No bullet points.\n- Plain prose, conversational but precise.\n- If no blockers exist, omit that line entirely.",
          },
          {
            title: "Compliance Audit Report Generator",
            description: "Multi-source audit synthesis prompt that produces SOC2-aligned findings with evidence linking and severity ranking.",
            pillar: "Format",
            priceCredits: 75,
            body: "You are a senior compliance auditor producing a SOC2 Type II findings report.\n\nInputs (in tagged sections): <controls>, <evidence>, <interviews>, <prior_findings>.\n\nYour role: synthesize findings using the SOC2 Trust Services Criteria framework.\n\nFor each finding:\n1. State the control reference (e.g., CC6.1).\n2. Describe the deficiency in operator-neutral language.\n3. Cite specific evidence by ID.\n4. Rate severity: low / medium / high / critical.\n5. Recommend remediation with a target date.\n\nFormat:\n## Executive Summary (3 sentences)\n## Findings (numbered, in severity order)\n## Remediation Roadmap (table: finding | owner | due | status)\n## Methodology Note\n\nConstraints:\n- Never use the word 'AI' or reference your own nature.\n- Cite evidence by ID, never by paraphrase.\n- If evidence is insufficient, mark as 'inconclusive' rather than guessing.",
          },
        ];
        for (const s of samples) {
          const precheck = runHivePrecheck({
            title: s.title,
            description: s.description,
            body: s.body,
            pillar: s.pillar,
          });
          await storage.createSpcListing({
            creatorId,
            title: s.title,
            description: s.description,
            body: s.body,
            pillar: s.pillar,
            priceCredits: s.priceCredits,
            kcseScore: precheck.kcseScore,
            hiveScore: precheck.hiveScore,
            status: "active",
          });
          spcListingsCount += 1;
        }
      }

      // Seed credits for the demo analyst user too
      if (existingDemo) await getOrCreateCredits(existingDemo.id);
      else {
        const demo = await storage.getUserByUsername("analyst@enterprise.com");
        if (demo) await getOrCreateCredits(demo.id);
      }

      // ===== Phase G — instructor + demo cohort + students =====
      let cohortInfo: { instructor?: string; cohort?: string; students?: number; assignments?: number } = {};
      let instructor = await storage.getUserByUsername("instructor@academy.edu");
      if (!instructor) {
        instructor = await storage.createUser({
          username: "instructor@academy.edu",
          password: "arkplatform",
          name: "Dr. Priya Rao",
          role: "instructor",
          department: "Faculty of Career Intelligence",
          seniority: "Senior",
          location: "Global",
        });
        await storage.updateUser(instructor.id, { subscriptionPlan: "SCHOOL_STUDENT", institution: "Atlas Online Academy" });
      }
      cohortInfo.instructor = instructor.username;

      const existingCohorts = await storage.getCohortsByInstructor(instructor.id);
      let demoCohort = existingCohorts[0];
      if (!demoCohort) {
        demoCohort = await storage.createCohort({
          instructorId: instructor.id,
          institution: "Atlas Online Academy",
          name: "Fall 2026 — Prompt Architecture 101",
          description: "Introductory cohort exploring CCGE pillars and Context Craft basics.",
        });
      }
      cohortInfo.cohort = demoCohort.name;

      // Seed 12 students with a JST spread.
      const studentSeeds = [
        { username: "lila.okafor@academy.edu", name: "Lila Okafor", jst: 245, ccmi: 180 },
        { username: "marco.tan@academy.edu", name: "Marco Tan", jst: 198, ccmi: 152 },
        { username: "ava.bishop@academy.edu", name: "Ava Bishop", jst: 271, ccmi: 210 },
        { username: "noah.kim@academy.edu", name: "Noah Kim", jst: 162, ccmi: 124 },
        { username: "isla.park@academy.edu", name: "Isla Park", jst: 220, ccmi: 168 },
        { username: "diego.santos@academy.edu", name: "Diego Santos", jst: 189, ccmi: 140 },
        { username: "zara.ahmed@academy.edu", name: "Zara Ahmed", jst: 258, ccmi: 195 },
        { username: "felix.weber@academy.edu", name: "Felix Weber", jst: 175, ccmi: 132 },
        { username: "harper.lee@academy.edu", name: "Harper Lee", jst: 233, ccmi: 178 },
        { username: "kai.nakamura@academy.edu", name: "Kai Nakamura", jst: 210, ccmi: 160 },
        { username: "sofia.rossi@academy.edu", name: "Sofia Rossi", jst: 145, ccmi: 112 },
        { username: "elias.haddad@academy.edu", name: "Elias Haddad", jst: 282, ccmi: 222 },
      ];
      const studentIds: string[] = [];
      for (const s of studentSeeds) {
        let su = await storage.getUserByUsername(s.username);
        if (!su) {
          su = await storage.createUser({
            username: s.username,
            password: "arkplatform",
            name: s.name,
            role: "student",
            department: "Student",
            seniority: "Junior",
            location: "Global",
          });
          await storage.updateUser(su.id, {
            subscriptionPlan: "SCHOOL_STUDENT",
            institution: "Atlas Online Academy",
            jstIndex: s.jst,
            ccmi: s.ccmi,
            arkScore: Math.min(600, s.jst + s.ccmi),
          });
        }
        studentIds.push(su.id);
      }
      await storage.addCohortMembers(
        demoCohort.id,
        studentIds.map(id => ({ userId: id, status: "active" })),
      );
      cohortInfo.students = studentIds.length;

      // Seed 2 assignments (one past-due, one upcoming).
      const existingAssns = await storage.getCohortAssignments(demoCohort.id);
      if (existingAssns.length === 0) {
        const scenarios = await storage.getAllCcgeScenarios();
        const bronze = scenarios.find(s => s.tier === "Bronze");
        const silver = scenarios.find(s => s.tier === "Silver");
        const now = Date.now();
        if (bronze) {
          await storage.createCohortAssignment({
            cohortId: demoCohort.id, scenarioId: bronze.id, assignedBy: instructor.id,
            dueAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
            note: "Week 1 warm-up — score Bronze or higher.",
          });
        }
        if (silver) {
          await storage.createCohortAssignment({
            cohortId: demoCohort.id, scenarioId: silver.id, assignedBy: instructor.id,
            dueAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
            note: "Week 2 challenge — push toward Silver tier.",
          });
        }
      }
      cohortInfo.assignments = (await storage.getCohortAssignments(demoCohort.id)).length;

      // ── M3 — Junglenomics 159-card expansion + ARK Roundtable warm-up ──
      const jng = await seedJnomicsExpansion();
      const rt = await recomputeRoundtable();

      return res.json({
        message: "Seed complete",
        ccgeCards: ccge.cards,
        ccgeScenarios: ccge.scenarios,
        spcListings: spcListingsCount,
        cohort: cohortInfo,
        jnomicsCards: jng.cards,
        cardSynergies: jng.synergies,
        roundtableSeats: rt.seats.length,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GUIN+ Identity ────────────────────────────────────
  app.get("/api/guin/by-id/:userId", requireFeature("guinPublic"), requireAuth, async (req, res) => {
    try {
      const profile = await buildGuinProfile(String(req.params.userId));
      if (!profile) return res.status(404).json({ message: "User not found." });
      return res.json(profile);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/guin/by-username/:username", requireFeature("guinPublic"), requireAuth, async (req, res) => {
    try {
      const u = await storage.getUserByUsername(String(req.params.username));
      if (!u) return res.status(404).json({ message: "User not found." });
      const profile = await buildGuinProfile(u.id);
      if (!profile) return res.status(404).json({ message: "User not found." });
      return res.json(profile);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  const endorsementBodySchema = z.object({
    recipientId: z.string().min(1),
    sessionId: z.string().min(1),
    message: z.string().min(8).max(ENDORSEMENT_MAX_LEN),
  });

  app.post("/api/endorsements", requireFeature("guinPublic"), requireAuth, async (req, res) => {
    try {
      const parsed = endorsementBodySchema.parse(req.body);
      const endorserId = currentUserId(req)!;
      const gate = await validateEndorsement({
        endorserId,
        recipientId: parsed.recipientId,
        sessionId: parsed.sessionId,
      });
      if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
      try {
        const created = await storage.createEndorsement({
          endorserId,
          recipientId: parsed.recipientId,
          sessionId: parsed.sessionId,
          message: parsed.message,
        });
        return res.status(201).json(created);
      } catch (insertErr: any) {
        // Postgres unique-violation = concurrent duplicate; the unique index
        // on (endorser_id, recipient_id) is the source of truth, the precheck
        // is just for UX. Map both pg-driver shapes to 409.
        const code = insertErr?.code || insertErr?.cause?.code;
        if (code === "23505") {
          return res.status(409).json({ message: "You have already endorsed this user." });
        }
        throw insertErr;
      }
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/endorsements/by-recipient/:userId", requireFeature("guinPublic"), async (req, res) => {
    try {
      const list = await storage.getEndorsementsForUser(String(req.params.userId));
      return res.json(list);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── M5 — Matrix Forge Lab (.docx → HIVE pre-check) ─────────────────
  const { isAllowedDocxMimetype, parseDocxBuffer, ForgeLabParseError, FORGE_LAB_MAX_BYTES } =
    await import("./forgeLab");
  const docxUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: FORGE_LAB_MAX_BYTES },
    fileFilter: (_req, file, cb) => cb(null, isAllowedDocxMimetype(file.mimetype)),
  });

  app.post(
    "/api/sphinx/forge-lab/run",
    requireFeature("forgeLabDocx"),
    requireAuth,
    docxUpload.single("docx"),
    async (req, res) => {
      try {
        const file = (req as any).file as Express.Multer.File | undefined;
        if (!file) return res.status(400).json({ message: "Upload a .docx file as 'docx'." });
        const schema = z.object({
          title: z.string().min(1).max(200),
          description: z.string().min(1).max(500),
          pillar: z.enum(ALL_CARD_PILLARS as unknown as [string, ...string[]]),
        });
        const meta = schema.safeParse(req.body);
        if (!meta.success) {
          return res.status(400).json({ message: "title, description, pillar required." });
        }
        const body = await parseDocxBuffer(file.buffer);
        if (body.trim().length < 80) {
          return res.status(400).json({ message: "Parsed prompt body is too short (min 80 chars)." });
        }
        const precheck = runHivePrecheck({
          title: meta.data.title,
          description: meta.data.description,
          body,
          pillar: meta.data.pillar,
        });
        return res.json({
          body,
          bodyLength: body.length,
          fileName: file.originalname,
          precheck,
        });
      } catch (err: any) {
        if (err instanceof ForgeLabParseError) {
          return res.status(err.status).json({ message: err.message });
        }
        if (err?.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ message: ".docx exceeds 5MB limit." });
        }
        console.error("Forge Lab error:", err);
        return res.status(500).json({ message: err.message || "Forge Lab failed." });
      }
    },
  );

  // ── M5 — Bonsai onboarding progress ───────────────────────────────
  const { getBonsaiProgressForUser, completeBonsaiStage } = await import("./bonsai");

  app.get("/api/sphinx/bonsai/progress", requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)!;
      const progress = await getBonsaiProgressForUser(userId);
      return res.json(progress);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post(
    "/api/sphinx/bonsai/progress/:stageId/complete",
    requireAuth,
    async (req, res) => {
      try {
        const userId = currentUserId(req)!;
        const stageId = parseInt(String(req.params.stageId), 10);
        const updated = await completeBonsaiStage(userId, stageId);
        return res.json(updated);
      } catch (err: any) {
        return res.status(err.status || 500).json({ message: err.message });
      }
    },
  );

  return httpServer;
}