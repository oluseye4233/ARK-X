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
const pdfParse = _require("pdf-parse");
import { storage } from "./storage";
import { analyzeResume } from "./resumeAnalyzer";
import { requireAuth, requireSelf, currentUserId, loginSession } from "./auth";
import { insertUserSchema, insertAssessmentSchema, CONTEXT_CRAFT_LEVELS, type ContextCraftLevel, SUBSCRIPTION_PLANS, type SubscriptionPlan, CCGE_TIERS, type CcgeTier, jcseToTier, ALL_CARD_PILLARS, SPC_MIN_CERT_TO_PUBLISH, SPC_PRICE_MIN, SPC_PRICE_MAX, SPC_STATUSES, CERT_LEVEL_RANK, ARK_SCORE_DELTAS, type CardPillar, type SpcStatus } from "@shared/schema";
import { dealHand, scoreSession } from "./ccge";
import { orchestrator } from "./orchestrator";
import { recalcArkForUser } from "./arkRecalc";
import { computeLhcsForUser } from "./lhcs";
import { pickFlywheelCta, rankAllCtas } from "./flywheelCta";
import { backfillAllUsers } from "./arkBackfill";
import { scoreSessionWithClaude } from "./ai/kcse";
import { generateResumeNarrative, ProTierRequiredError } from "./ai/narrative";
import { generateScenario } from "./ai/scenarioGen";
import { getMonthlyTokens } from "./ai/usage";
import { isClaudeAvailable } from "./ai/client";
import {
  isPaidPlan,
  priceCentsForPlan,
  nextPeriodEnd,
  syntheticStripeCheckoutId,
} from "./billing";
import { seedCcge } from "./ccgeSeed";
import { runHivePrecheck, executePurchase, getOrCreateCredits } from "./sphinx";
import { buildGuinProfile, validateEndorsement } from "./guin";
import { ENDORSEMENT_MAX_LEN } from "@shared/schema";
import { z } from "zod";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "text/plain"];
    cb(null, allowed.includes(file.mimetype));
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
      const usage = await getMonthlyTokens(userId);
      return res.json({ available: isClaudeAvailable(), usage });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/ai/resume-narrative/:assessmentId", requireAuth, async (req, res) => {
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

  app.post("/api/admin/ai/generate-scenario", requireAuth, async (req, res) => {
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
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
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
      const parsed = insertUserSchema.parse(req.body);
      const existing = await storage.getUserByUsername(parsed.username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }
      const user = await storage.createUser(parsed);
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
    return res.json(safeUser);
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
      const allowed = ["name", "role", "department", "seniority", "location"];
      const updateData: any = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updateData[key] = req.body[key];
      }
      const updated = await storage.updateUser(String(req.params.id), updateData);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = updated;
      return res.json(safeUser);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Email Notifications ────────────────────────────
  app.post("/api/notifications/assessment-summary", requireAuth, async (req, res) => {
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
      console.log(`[EMAIL] Assessment summary queued for ${email} (userId: ${userId}, JST: ${assessment.jstTotal})`);
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
      const schema = z.object({ success: z.boolean().default(true) });
      const p = schema.safeParse(req.body || {});
      if (!p.success) return res.status(400).json({ message: "Invalid body" });

      const result = await storage.completeCheckoutSession({
        sessionId: String(req.params.id),
        actorUserId: userId,
        success: p.data.success,
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

  app.post("/api/billing/cancel", requireAuth, async (req, res) => {
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
        const pdfData = await pdfParse(file.buffer);
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
      const user = await storage.getUser(userId);
      const certLevel = (user?.contextCraftCertLevel as ContextCraftLevel) || "NONE";

      const analysis = analyzeResume(resumeText, certLevel);

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
          triggerMeta: { assessmentId: created.id, source: "resume.upload" },
          pillarOverride: freshPillars,
          freshScores: { categoryScores: proxy, avgAutomation: avgAuto },
        });
      } catch (recalcErr) {
        console.error("[resume.upload] recalc failed (best-effort):", recalcErr);
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
            snapshot: recalc.snapshot,
            trigger: "assessment.completed",
          });
        } catch (narrErr) {
          console.error("[resume.upload] narrative failed (best-effort):", narrErr);
        }
      }

      // Emit AFTER recalc so the SSE arkEvent payload reflects new ARK score.
      await orchestrator.emit(userId, "assessment.completed", {
        assessmentId: created.id,
        jstTotal: created.jstTotal,
      }, 0);

      return res.status(201).json({
        ...created,
        upskillingPlans: plans,
        pivotOpportunities: pivots,
        transferabilityVectors: vectors,
        extractedTextLength: resumeText.length,
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
      });
    } catch (err: any) {
      console.error("Resume upload error:", err);
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

  // ── Jnomics Cards ────────────────────────────────────
  app.get("/api/jnomics-cards", async (_req, res) => {
    try {
      const cards = await storage.getAllJnomicsCards();
      return res.json(cards);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/jnomics-cards/by-ids", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ message: "ids must be an array" });
      const cards = await storage.getJnomicsCardsByIds(ids);
      return res.json(cards);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Enterprise / Departments ──────────────────────────
  app.get("/api/departments", async (_req, res) => {
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
      const all = await storage.getAllCcgeScenarios();
      const tier = typeof req.query.tier === "string" ? req.query.tier : null;
      const filtered = tier ? all.filter((s) => s.tier === tier) : all;
      return res.json(filtered);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
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
      const schema = z.object({ playedCardIds: z.array(z.string()).min(1).max(5), useClaude: z.boolean().optional() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "playedCardIds must be an array of 1–5 card IDs" });
      }
      const { playedCardIds, useClaude } = parsed.data;

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

      const actorUserId = currentUserId(req)!;
      let claudeKcse: Awaited<ReturnType<typeof scoreSessionWithClaude>> = null;
      if (useClaude) {
        const actor = await storage.getUser(actorUserId);
        const plan = (actor?.subscriptionPlan as SubscriptionPlan) || "INDIVIDUAL_FREE";
        claudeKcse = await scoreSessionWithClaude({
          userId: actorUserId,
          plan,
          scenario,
          playedCards,
          deterministic: breakdown,
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
    body: z.string().min(80).max(4000),
    pillar: z.enum(ALL_CARD_PILLARS as unknown as [string, ...string[]]),
    priceCredits: z.number().int().min(SPC_PRICE_MIN).max(SPC_PRICE_MAX),
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
      });

      await orchestrator.emit(creatorId, "spc.published", {
        listingId: listing.id,
        title: listing.title,
      }, ARK_SCORE_DELTAS.SPC_PUBLISHED);

      return res.status(201).json({ listing, precheck });
    } catch (err: any) {
      console.error("Publish SPC error:", err);
      return res.status(400).json({ message: err.message });
    }
  });

  const listingFiltersSchema = z.object({
    pillar: z.string().optional(),
    status: z.string().optional(),
  });

  // Server-side body redaction protects paid prompt content from being scraped
  // via direct API calls (UI truncation alone is bypassable).
  const SPC_PREVIEW_LEN = 280;
  const redactBody = (body: string) =>
    body.length > SPC_PREVIEW_LEN
      ? body.slice(0, SPC_PREVIEW_LEN) + "\n\n[ … purchase to unlock full prompt … ]"
      : body;

  app.get("/api/sphinx/listings", async (req, res) => {
    try {
      const filters = listingFiltersSchema.parse(req.query);
      const all = await storage.getAllSpcListings({
        pillar: filters.pillar,
        status: filters.status ?? "active",
      });
      // List endpoint always returns redacted bodies — no viewer context here.
      const redacted = all.map((l) => ({ ...l, body: redactBody(l.body), bodyLocked: true }));
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
        ? { ...listing, bodyLocked: false }
        : { ...listing, body: redactBody(listing.body), bodyLocked: true };
      return res.json({ listing: safeListing, creator: safeCreator });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
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
      return res.json(outcome);
    } catch (err: any) {
      console.error("Purchase error:", err);
      const status = /not found|insufficient|own SPC|not available/.test(err.message) ? 400 : 500;
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
      const listings = await storage.getSpcListingsByCreator(String(req.params.userId));
      return res.json(listings);
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

  // ── Seed endpoint (for initial data population) ───────
  app.post("/api/seed", async (_req, res) => {
    try {
      // Seed Jnomics Cards
      const cardSeeds = [
        { id: "card-001", name: "SPHINX ULTRA SI", tier: "Ultra Premium", type: "Lead Architect", emoji: "🏛", description: "Master of platform architecture & API design. High capability in structural synthesis.", basePts: 48 },
        { id: "card-002", name: "ADA ULTRA SI", tier: "Ultra Premium", type: "Technical Lead", emoji: "💻", description: "Full-stack implementation expert. Specializes in transforming complex specs into scalable code.", basePts: 50 },
        { id: "card-003", name: "HOLMES ULTRA SI", tier: "Ultra Premium", type: "Intelligence Lead", emoji: "🧠", description: "Bayesian scoring & API intelligence. Masters pattern recognition and anomaly detection.", basePts: 50 },
        { id: "card-004", name: "STRATEGOS ULTRA SI", tier: "Ultra Premium", type: "Strategy Lead", emoji: "🎯", description: "Roadmap and enterprise deployment specialist. Maximizes transferability and ROI.", basePts: 50 },
        { id: "card-005", name: "ZPOS Expert", tier: "Premium", type: "Optimization Lead", emoji: "⚙", description: "Token optimization and efficiency expert. Minimizes operational drag while preserving semantics.", basePts: 47 },
        { id: "card-006", name: "GRO / ANT KING", tier: "Ultra Premium", type: "Security Lead", emoji: "🔐", description: "Royal DNA governance & ethics. Ensures platform compliance, data integrity, and access control.", basePts: 50 },
        { id: "card-007", name: "LUCI ULTRA SI", tier: "Premium", type: "UX Lead", emoji: "🎨", description: "Design and UX layer specialist. Creates intuitive, data-dense interfaces with clarity.", basePts: 46 },
        { id: "card-008", name: "KLARITY", tier: "Standard", type: "Knowledge Lead", emoji: "📚", description: "Context Craft pillar classification and knowledge store management.", basePts: 42 },
        { id: "card-009", name: "VIBE DJ", tier: "Premium", type: "Tool Orchestrator", emoji: "🎧", description: "Tool orchestration and workflow automation. Coordinates multi-agent pipelines.", basePts: 45 },
        { id: "card-010", name: "ANT QUEEN", tier: "Ultra Premium", type: "Agent Factory", emoji: "👑", description: "Agent factory integration and autonomous system deployment.", basePts: 49 },
      ];

      for (const card of cardSeeds) {
        await storage.upsertJnomicsCard(card);
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
          matchedCardIds: ["card-001", "card-002", "card-004", "card-005"],
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
          matchedCardIds: ["card-001", "card-006", "card-010"],
        });
        await getOrCreateCredits(creator.id);
      } else {
        creatorId = existingCreator.id;
      }

      const existingListings = await storage.getAllSpcListings();
      let spcListingsCount = existingListings.length;
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

      return res.json({
        message: "Seed complete",
        ccgeCards: ccge.cards,
        ccgeScenarios: ccge.scenarios,
        spcListings: spcListingsCount,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GUIN+ Identity ────────────────────────────────────
  app.get("/api/guin/by-id/:userId", async (req, res) => {
    try {
      const profile = await buildGuinProfile(String(req.params.userId));
      if (!profile) return res.status(404).json({ message: "User not found." });
      return res.json(profile);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/guin/by-username/:username", async (req, res) => {
    try {
      const u = await storage.getUserByUsername(req.params.username);
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

  app.post("/api/endorsements", requireAuth, async (req, res) => {
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

  app.get("/api/endorsements/by-recipient/:userId", async (req, res) => {
    try {
      const list = await storage.getEndorsementsForUser(String(req.params.userId));
      return res.json(list);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}