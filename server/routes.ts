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
import { requireAuth, requireSelf, requireInstructor, currentUserId, loginSession } from "./auth";
import { insertUserSchema, insertAssessmentSchema, CONTEXT_CRAFT_LEVELS, type ContextCraftLevel, SUBSCRIPTION_PLANS, type SubscriptionPlan, CCGE_TIERS, type CcgeTier, jcseToTier, ALL_CARD_PILLARS, SPC_MIN_CERT_TO_PUBLISH, SPC_PRICE_MIN, SPC_PRICE_MAX, SPC_STATUSES, CERT_LEVEL_RANK, ARK_SCORE_DELTAS, type CardPillar, type SpcStatus } from "@shared/schema";
import { dealHand, scoreSession } from "./ccge";
import { orchestrator } from "./orchestrator";
import { recalcArkForUser } from "./arkRecalc";
import { computeLhcsForUser } from "./lhcs";
import { pickFlywheelCta, rankAllCtas } from "./flywheelCta";
import { backfillAllUsers } from "./arkBackfill";
import { scoreSessionWithClaude } from "./ai/kcse";
import { generateResumeNarrative, ProTierRequiredError } from "./ai/narrative";
import { CODEC_PRIMITIVES, CODEC_BY_ID } from "@shared/codec-primitives";
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
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      const { verifyPassword, hashPassword } = await import("./passwords");
      const { ok, needsRehash } = await verifyPassword(password, user.password);
      if (!ok) return res.status(401).json({ message: "Invalid credentials" });
      // Phase G: convert any pending `invite:<email>` cohort memberships into
      // real memberships keyed by this user's id, best-effort.
      try { await storage.reconcileCohortInvitesForUser(user.id, user.username); } catch {}
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
        let pdfTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
        const pdfTimeout = new Promise<never>((_, reject) => {
          pdfTimeoutHandle = setTimeout(() => reject(new Error("PDF parsing timed out")), 15_000);
        });
        let pdfData: { text: string };
        try {
          pdfData = await Promise.race([pdfParse(file.buffer), pdfTimeout]);
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
      const payload = await runAssessmentFromText(userId, resumeText, "resume.upload");
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

  app.post("/api/drm/event", async (req, res) => {
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
  app.get("/api/admin/drm/violators", requireAuth, async (req, res) => {
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
      const allowedSources = ["self", "linkedin"] as const;
      if (typeof text !== "string" || text.trim().length < 50) {
        return res.status(400).json({
          message: "Please provide at least 50 characters of profile content so we can build a meaningful assessment.",
        });
      }
      if (!allowedSources.includes(source)) {
        return res.status(400).json({ message: "Invalid assessment source." });
      }
      const userId = currentUserId(req)!;
      const sourceTag = source === "self" ? "self.assessment" : "linkedin.import";
      const payload = await runAssessmentFromText(userId, text, sourceTag);
      return res.status(201).json(payload);
    } catch (err: any) {
      console.error("[/api/assessment/text] error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // Helper extracted from the original /api/resume/upload body — runs the
  // full analyze→persist→recalc→narrative pipeline against arbitrary text
  // input. Used by both the file upload route and the text intake route so
  // self-assessments and LinkedIn imports behave identically to CV uploads.
  async function runAssessmentFromText(
    userId: string,
    resumeText: string,
    sourceTag: string,
  ): Promise<any> {
      const user = await storage.getUser(userId);
      const certLevel = (user?.contextCraftCertLevel as ContextCraftLevel) || "NONE";
      const userPlan = (user?.subscriptionPlan as SubscriptionPlan) || "INDIVIDUAL_FREE";

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

  // Admin-only CCGE compendium import — parse compendium-format Markdown
  // and upsert into ccge_cards. Mirrors the SPC import flow (paste/upload).
  const ccgeImportSchema = z.object({
    markdown: z.string().min(50).max(500000),
    dryRun: z.boolean().optional().default(false),
  });

  app.post("/api/admin/ccge/import-compendium", requireAuth, async (req, res) => {
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
  app.post("/api/ccge/scenarios/custom", requireAuth, async (req, res) => {
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
    body: z.string().min(80).max(50000),
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
  app.post("/api/sphinx/synergies/calculate", requireAuth, async (req, res) => {
    try {
      const parsed = synergyCalcSchema.parse(req.body);
      const result = await calculateSynergy(parsed.cardIds);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  // GET /api/sphinx/pairs/top — top-15 strongest synergy pairs platform-wide.
  app.get("/api/sphinx/pairs/top", requireAuth, async (_req, res) => {
    try {
      const rows = await getTopPairsPlatform(15);
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // GET /api/sphinx/listings/:id/complementary — top-5 listing partners.
  app.get("/api/sphinx/listings/:id/complementary", requireAuth, async (req, res) => {
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
  app.get("/api/sphinx/roundtable", requireAuth, async (_req, res) => {
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
  app.post("/api/sphinx/roundtable/recompute", requireAuth, async (req, res) => {
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
  app.get("/api/notifications", requireAuth, async (req, res) => {
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

  const synthesisCreateSchema = z.object({
    listingIds: z.array(z.string().min(1)).min(2).max(7),
    zposMethod: z.enum(ZPOS_METHOD_LIST as readonly [string, ...string[]]).optional(),
  });

  const redactSynthesisBody = (s: any) => ({ ...s, combinedOutput: "", bodyLocked: true, bodyLength: s.combinedOutput?.length ?? 0 });

  // POST /api/sphinx/synthesis/sessions — create a preview session.
  // Routes are mounted under /api/sphinx — declared BEFORE /listings/:id
  // matchers above? They're already declared below, but Express matches
  // in declaration order, and these slugs don't collide with /listings/:id.
  app.post("/api/sphinx/synthesis/sessions", requireAuth, async (req, res) => {
    try {
      const buyerId = currentUserId(req)!;
      const parsed = synthesisCreateSchema.parse(req.body ?? {});
      const session = await createSynthesisSession({
        buyerId, listingIds: parsed.listingIds, zposMethod: parsed.zposMethod as any,
      });
      return res.json(session);
    } catch (err: any) {
      const status = err instanceof SynthesisError ? err.status : 400;
      return res.status(status).json({ message: err.message });
    }
  });

  // GET /api/sphinx/synthesis/sessions/:id — only the originating buyer
  // sees the full combined body; everyone else gets redacted metadata.
  app.get("/api/sphinx/synthesis/sessions/:id", requireAuth, async (req, res) => {
    try {
      const buyerId = currentUserId(req)!;
      const session = await getSessionForBuyer(String(req.params.id), buyerId);
      if (!session) return res.status(404).json({ message: "Session not found." });
      return res.json({ ...session, bodyLocked: false, bodyLength: session.combinedOutput.length });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // POST /api/sphinx/synthesis/sessions/:id/finalize — debit + royalties + grant.
  app.post("/api/sphinx/synthesis/sessions/:id/finalize", requireAuth, async (req, res) => {
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
        session: { ...outcome.session, bodyLocked: false, bodyLength: outcome.session.combinedOutput.length },
      });
    } catch (err: any) {
      console.error("Synthesis finalize error:", err);
      const status = err instanceof SynthesisError ? err.status : 500;
      return res.status(status).json({ message: err.message });
    }
  });

  // GET /api/sphinx/listings/:id/syntheses — "Used in N syntheses" + recent
  // metadata for the Synthesis tab on the listing detail page.
  app.get("/api/sphinx/listings/:id/syntheses", async (req, res) => {
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
  app.post("/api/notifications/read", requireAuth, async (req, res) => {
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

  app.get("/api/cohorts", requireInstructor, async (req, res) => {
    const sid = currentUserId(req)!;
    const list = await storage.getCohortsByInstructor(sid);
    res.json(list);
  });

  app.post("/api/cohorts", requireInstructor, async (req, res) => {
    const parsed = cohortCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input.", issues: parsed.error.issues });
    const sid = currentUserId(req)!;
    const cohort = await storage.createCohort({ ...parsed.data, instructorId: sid });
    res.status(201).json(cohort);
  });

  app.get("/api/cohorts/comparison", requireInstructor, async (req, res) => {
    const sid = currentUserId(req)!;
    const data = await storage.getCohortComparison(sid);
    res.json(data);
  });

  app.get("/api/cohorts/:id", requireInstructor, async (req, res) => {
    const ctx = await assertCohortOwnership(req, res);
    if (!ctx) return;
    const [members, assignments] = await Promise.all([
      storage.getCohortMembers(ctx.cohort.id),
      storage.getCohortAssignments(ctx.cohort.id),
    ]);
    res.json({ cohort: ctx.cohort, members, assignments });
  });

  app.post("/api/cohorts/:id/members", requireInstructor, async (req, res) => {
    const ctx = await assertCohortOwnership(req, res);
    if (!ctx) return;
    const parsed = cohortMembersSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input.", issues: parsed.error.issues });
    const rows = parsed.data.emails.map(e => ({ invitedEmail: e }));
    const result = await storage.addCohortMembers(ctx.cohort.id, rows);
    res.status(201).json(result);
  });

  app.delete("/api/cohorts/:id/members/:userId", requireInstructor, async (req, res) => {
    const ctx = await assertCohortOwnership(req, res);
    if (!ctx) return;
    const ok = await storage.removeCohortMember(ctx.cohort.id, String(req.params.userId));
    res.json({ removed: ok });
  });

  app.get("/api/cohorts/:id/assignments", requireInstructor, async (req, res) => {
    const ctx = await assertCohortOwnership(req, res);
    if (!ctx) return;
    const list = await storage.getCohortAssignments(ctx.cohort.id);
    res.json(list);
  });

  app.post("/api/cohorts/:id/assignments", requireInstructor, async (req, res) => {
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

  app.get("/api/cohorts/:id/grades", requireInstructor, async (req, res) => {
    const ctx = await assertCohortOwnership(req, res);
    if (!ctx) return;
    const grades = await storage.getCohortGrades(ctx.cohort.id);
    res.json(grades);
  });

  app.get("/api/cohorts/:id/grades.csv", requireInstructor, async (req, res) => {
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
  app.get("/api/me/cohorts", requireAuth, async (req, res) => {
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
  app.get("/api/guin/by-id/:userId", requireAuth, async (req, res) => {
    try {
      const profile = await buildGuinProfile(String(req.params.userId));
      if (!profile) return res.status(404).json({ message: "User not found." });
      return res.json(profile);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/guin/by-username/:username", requireAuth, async (req, res) => {
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