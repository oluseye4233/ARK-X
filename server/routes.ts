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
import { insertUserSchema, insertAssessmentSchema, CONTEXT_CRAFT_LEVELS, type ContextCraftLevel, SUBSCRIPTION_PLANS, type SubscriptionPlan, CCGE_TIERS, type CcgeTier, jcseToTier } from "@shared/schema";
import { dealHand, scoreSession, applyFlywheel } from "./ccge";
import { seedCcge } from "./ccgeSeed";
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
      const { password: _, ...safeUser } = user;
      return res.status(201).json(safeUser);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  // ── Users ─────────────────────────────────────────────
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = user;
      return res.json(safeUser);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Profile Update ──────────────────────────────────
  app.put("/api/users/:id/profile", async (req, res) => {
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
  app.post("/api/notifications/assessment-summary", async (req, res) => {
    try {
      const { userId, email } = req.body;
      if (!userId || !email) {
        return res.status(400).json({ message: "userId and email are required" });
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

  app.put("/api/users/:id/context-craft-cert", async (req, res) => {
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
  });

  app.get("/api/context-craft/levels", (_req, res) => {
    return res.json(CONTEXT_CRAFT_LEVELS);
  });

  // ── Subscription Plans ─────────────────────────────────
  const validSubscriptionPlans = z.enum(Object.keys(SUBSCRIPTION_PLANS) as [string, ...string[]]);

  app.get("/api/subscription/plans", (_req, res) => {
    return res.json(SUBSCRIPTION_PLANS);
  });

  app.put("/api/users/:id/subscription", async (req, res) => {
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
  app.post("/api/assessments", async (req, res) => {
    try {
      const { assessment, upskillingPlans, pivotOpportunities, transferabilityVectors } = req.body;
      
      const created = await storage.createAssessment(assessment);

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

  app.get("/api/assessments/user/:userId", async (req, res) => {
    try {
      const results = await storage.getAssessmentsByUser(req.params.userId);
      return res.json(results);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/assessments/user/:userId/latest", async (req, res) => {
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
  app.post("/api/resume/upload", upload.single("resume"), async (req, res) => {
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

      const userId = req.body.userId;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

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

  app.post("/api/ccge/sessions", async (req, res) => {
    try {
      const schema = z.object({
        userId: z.string().min(1),
        scenarioId: z.string().min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "userId and scenarioId required" });
      }
      const { userId, scenarioId } = parsed.data;

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

  app.get("/api/ccge/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getGameSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      const scenario = await storage.getCcgeScenario(session.scenarioId);
      return res.json({ session, scenario });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/ccge/sessions/:id/finish", async (req, res) => {
    try {
      const schema = z.object({ playedCardIds: z.array(z.string()).min(1).max(5) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "playedCardIds must be an array of 1–5 card IDs" });
      }
      const { playedCardIds } = parsed.data;

      const session = await storage.getGameSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
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

  app.get("/api/ccge/sessions/user/:userId", async (req, res) => {
    try {
      const sessions = await storage.getGameSessionsByUser(req.params.userId);
      return res.json(sessions);
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

      return res.json({ message: "Seed complete", ccgeCards: ccge.cards, ccgeScenarios: ccge.scenarios });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}