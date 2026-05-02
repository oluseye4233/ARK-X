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
import { insertUserSchema, insertAssessmentSchema, CONTEXT_CRAFT_LEVELS, type ContextCraftLevel, SUBSCRIPTION_PLANS, type SubscriptionPlan, CCGE_TIERS, type CcgeTier, jcseToTier, ALL_CARD_PILLARS, SPC_MIN_CERT_TO_PUBLISH, SPC_PRICE_MIN, SPC_PRICE_MAX, SPC_STATUSES, CERT_LEVEL_RANK, type CardPillar, type SpcStatus } from "@shared/schema";
import { dealHand, scoreSession, applyFlywheel } from "./ccge";
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
      const user = await storage.getUser(req.params.id);
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
      const updated = await storage.updateUser(req.params.id, updateData);
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
      const updated = await storage.updateUser(req.params.id, {
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

  app.put("/api/users/:id/subscription", requireSelf("id"), async (req, res) => {
    try {
      const parsed = validSubscriptionPlans.safeParse(req.body?.plan);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid subscription plan",
          validPlans: Object.keys(SUBSCRIPTION_PLANS),
        });
      }
      const plan = parsed.data as SubscriptionPlan;
      const planData = SUBSCRIPTION_PLANS[plan];

      const updateData: any = {
        subscriptionPlan: plan,
        subscriptionStatus: "active",
      };

      if (planData.type === "school" && req.body?.institution) {
        updateData.institution = req.body.institution;
      }

      const updated = await storage.updateUser(req.params.id, updateData);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = updated;
      return res.json(safeUser);
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
      const results = await storage.getAssessmentsByUser(req.params.userId);
      return res.json(results);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/assessments/user/:userId/latest", requireSelf("userId"), async (req, res) => {
    try {
      const assessment = await storage.getLatestAssessment(req.params.userId);
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

      return res.status(201).json({
        ...created,
        upskillingPlans: plans,
        pivotOpportunities: pivots,
        transferabilityVectors: vectors,
        extractedTextLength: resumeText.length,
      });
    } catch (err: any) {
      console.error("Resume upload error:", err);
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
      const session = await storage.getGameSession(req.params.id);
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
      const schema = z.object({ playedCardIds: z.array(z.string()).min(1).max(5) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "playedCardIds must be an array of 1–5 card IDs" });
      }
      const { playedCardIds } = parsed.data;

      const session = await storage.getGameSession(req.params.id);
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
      const tier = jcseToTier(breakdown.final);

      // Apply ONECRAFT flywheel
      const flywheel = await applyFlywheel(session.userId, breakdown.final);

      const updated = await storage.updateGameSession(session.id, {
        played: playedCardIds,
        status: "finished",
        kcseScore: breakdown.final,
        kcseBreakdown: breakdown,
        certTierEarned: tier,
        arkScoreDelta: flywheel.arkScoreDelta,
        certUpgradedFrom: flywheel.certUpgradedFrom,
        certUpgradedTo: flywheel.certUpgradedTo,
        finishedAt: new Date(),
      });

      return res.json({
        session: updated,
        scenario,
        breakdown,
        tier,
        flywheel,
      });
    } catch (err: any) {
      console.error("CCGE finish error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/ccge/sessions/user/:userId", requireSelf("userId"), async (req, res) => {
    try {
      const sessions = await storage.getGameSessionsByUser(req.params.userId);
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
      const listing = await storage.getSpcListing(req.params.id);
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
      const listing = await storage.getSpcListing(req.params.id);
      if (!listing) return res.status(404).json({ message: "Listing not found." });
      if (listing.creatorId !== creatorId) {
        return res.status(403).json({ message: "Only the creator can delist." });
      }
      const updated = await storage.updateSpcListing(req.params.id, { status: "delisted" });
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/sphinx/listings/:id/purchase", requireAuth, async (req, res) => {
    try {
      const buyerId = currentUserId(req)!;
      const outcome = await executePurchase(buyerId, req.params.id);
      return res.json(outcome);
    } catch (err: any) {
      console.error("Purchase error:", err);
      const status = /not found|insufficient|own SPC|not available/.test(err.message) ? 400 : 500;
      return res.status(status).json({ message: err.message });
    }
  });

  app.get("/api/sphinx/credits/:userId", requireSelf("userId"), async (req, res) => {
    try {
      const credits = await getOrCreateCredits(req.params.userId);
      return res.json(credits);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sphinx/listings/by-creator/:userId", async (req, res) => {
    try {
      const listings = await storage.getSpcListingsByCreator(req.params.userId);
      return res.json(listings);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sphinx/sales/:userId", requireSelf("userId"), async (req, res) => {
    try {
      const purchases = await storage.getSpcPurchasesByCreator(req.params.userId);
      const totalEarned = purchases.reduce((s, p) => s + p.creatorShare, 0);
      return res.json({ purchases, totalEarned, salesCount: purchases.length });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sphinx/purchases/:userId", requireSelf("userId"), async (req, res) => {
    try {
      const purchases = await storage.getSpcPurchasesByBuyer(req.params.userId);
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
      const profile = await buildGuinProfile(req.params.userId);
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
      const list = await storage.getEndorsementsForUser(req.params.userId);
      return res.json(list);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}