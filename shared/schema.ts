import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, jsonb, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const SUBSCRIPTION_PLANS = {
  INDIVIDUAL_FREE: {
    key: "INDIVIDUAL_FREE",
    label: "Individual Free",
    type: "individual",
    price: 0,
    period: "forever",
    color: "#888888",
    features: ["1 resume upload", "Basic JST Score", "Vulnerability Level"],
    limits: { uploadsPerMonth: 1, dashboardAccess: true, pathwaysAccess: false, enterpriseAccess: false, reportAccess: false, forgeCards: false },
  },
  INDIVIDUAL_PRO: {
    key: "INDIVIDUAL_PRO",
    label: "Individual Pro",
    type: "individual",
    price: 29,
    period: "month",
    color: "#00B4D8",
    features: ["Unlimited uploads", "Full JST Dashboard", "12-Vector Radar", "Career Pathways", "FORGE Cards", "Executive Report", "Context Craft Integration"],
    limits: { uploadsPerMonth: -1, dashboardAccess: true, pathwaysAccess: true, enterpriseAccess: false, reportAccess: true, forgeCards: true },
  },
  SCHOOL_STUDENT: {
    key: "SCHOOL_STUDENT",
    label: "School / Student",
    type: "school",
    price: 9,
    period: "month",
    color: "#AA44FF",
    features: ["Unlimited uploads", "Full JST Dashboard", "12-Vector Radar", "Career Pathways", "FORGE Cards", "Executive Report", "Context Craft Integration", "Institution Dashboard"],
    limits: { uploadsPerMonth: -1, dashboardAccess: true, pathwaysAccess: true, enterpriseAccess: false, reportAccess: true, forgeCards: true },
  },
  ENTERPRISE: {
    key: "ENTERPRISE",
    label: "Enterprise",
    type: "corporate",
    price: 0,
    period: "custom",
    color: "#44AA44",
    features: ["Everything in Pro", "Workforce Intelligence", "Department Analytics", "Bulk Assessment", "Custom Integrations", "Priority Support"],
    limits: { uploadsPerMonth: -1, dashboardAccess: true, pathwaysAccess: true, enterpriseAccess: true, reportAccess: true, forgeCards: true },
  },
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;

export const CONTEXT_CRAFT_LEVELS = {
  NONE: { key: "NONE", label: "No Certification", multiplier: 0.5, color: "#FF4444" },
  CC_100: { key: "CC_100", label: "CC-100 Foundational", multiplier: 1.0, color: "#FFA500" },
  CC_200: { key: "CC_200", label: "CC-200 Practitioner", multiplier: 1.1, color: "#FFDD00" },
  CC_300: { key: "CC_300", label: "CC-300 Specialist", multiplier: 1.2, color: "#4488FF" },
  CC_400: { key: "CC_400", label: "CC-400 Expert", multiplier: 1.35, color: "#44AA44" },
  CC_500: { key: "CC_500", label: "CC-500 Master Architect", multiplier: 1.5, color: "#AA44FF" },
} as const;

export type ContextCraftLevel = keyof typeof CONTEXT_CRAFT_LEVELS;

// ── CCGE: Context Craft Game Engine ──────────────────────────
export const CC_PILLARS = ["System", "Role", "Instruction", "Example", "Constraint", "Format", "Data"] as const;
export type CCPillar = typeof CC_PILLARS[number];
export const ALL_CARD_PILLARS = [...CC_PILLARS, "SuperPrompt"] as const;
export type CardPillar = typeof ALL_CARD_PILLARS[number];

export const CARD_TYPES = ["Standard", "Premium", "Ultra", "SuperPrompt"] as const;
export type CardType = typeof CARD_TYPES[number];

export const CCGE_TIERS = ["Bronze", "Silver", "Gold", "Platinum"] as const;
export type CcgeTier = typeof CCGE_TIERS[number];

// JCSE thresholds (session score, 0-50) → cert tier.
// Canon alignment: thresholds map to General Technical Terms Registry v1.0
// Term 8 (HIVE Dimension-1 Quality-and-Fitness break-points): Bronze 30+,
// Silver 36-42, Gold 43-47, Platinum 48-50. The underlying 0-50 score is
// the Composite AI Agent Quality Score (Term 3); the Bronze/Silver/Gold/
// Platinum tier *labels* come from Term 8 (HIVE MATRIX LABS), not from
// Term 3's Standard/Premium/Ultra-Premium/Perfect-Elite labels — those are
// equivalent break-points under a different naming convention.
export const JCSE_TIER_THRESHOLDS = {
  BRONZE: 30,
  SILVER: 36,
  GOLD: 43,
  PLATINUM: 48,
} as const;

// JCSE score → CC certification level earned this session (auto-promotion).
// Returns NONE for sub-Bronze sessions so applyFlywheel will not promote
// users from NONE → CC_100 just for engaging — CC_100 (Foundational) is
// reserved for users who actually completed the foundation assessment.
export function jcseToContextCraftLevel(jcse: number): ContextCraftLevel {
  if (jcse >= JCSE_TIER_THRESHOLDS.PLATINUM) return "CC_500";
  if (jcse >= JCSE_TIER_THRESHOLDS.GOLD) return "CC_400";
  if (jcse >= JCSE_TIER_THRESHOLDS.SILVER) return "CC_300";
  if (jcse >= JCSE_TIER_THRESHOLDS.BRONZE) return "CC_200";
  return "NONE";
}

export function jcseToTier(jcse: number): CcgeTier | null {
  if (jcse >= JCSE_TIER_THRESHOLDS.PLATINUM) return "Platinum";
  if (jcse >= JCSE_TIER_THRESHOLDS.GOLD) return "Gold";
  if (jcse >= JCSE_TIER_THRESHOLDS.SILVER) return "Silver";
  if (jcse >= JCSE_TIER_THRESHOLDS.BRONZE) return "Bronze";
  return null;
}

// ARK Score deltas per flywheel event (PDD §3.10, lean adaptation)
export const ARK_SCORE_DELTAS = {
  SESSION_BRONZE: 2,
  SESSION_SILVER: 4,
  SESSION_GOLD: 6,
  SESSION_PLATINUM: 9,
  CERT_UPGRADE_TO_CC_200: 4,
  CERT_UPGRADE_TO_CC_300: 7,
  CERT_UPGRADE_TO_CC_400: 10,
  CERT_UPGRADE_TO_CC_500: 15,
  SPC_PUBLISHED: 2,
  SPC_PURCHASED_AS_BUYER: 1,
  SPC_FIRST_SALE_AS_CREATOR: 8,
} as const;

// ─────────────────────────────────────────────────────────────────────
// SCORE_GLOSSARY — single source of truth for every quantitative term
// used across the platform. Aligned to the canonical Junglenomics FORGE
// Institute registries (General Technical Terms Registry v1.0 + Master
// SPC & Platform Registry v1.0, May 2026). Cite this object — do not
// re-define these terms elsewhere.
// ─────────────────────────────────────────────────────────────────────
export const SCORE_GLOSSARY = {
  ARK: {
    range: [0, 600] as const,
    formula: "JST + CCMI",
    canon: "ARK MAXIMUS ULTRA SI — Integrated Career Intelligence Engine",
    note: "Composite career-intelligence score. Max 600.",
  },
  JST: {
    range: [0, 300] as const,
    formula: "(Jobs·0.30 + Skills·0.40 + Talent·0.30) · 3",
    canon: "ARK SI — Jobs-Skills-Talent Career Assessment Agent",
    note: "Three-composite index: Jobs Fitness, Skills Competency, Talent Aptitude.",
  },
  CCMI: {
    range: [0, 300] as const,
    formula: "weighted P1-P7 sum · 3 (weights total 1.0)",
    canon: "Context Craft Mastery Index (ARK MAXIMUS)",
    note: "Per-pillar mastery 0-100 each → composite 0-300.",
  },
  JCSE: {
    range: [0, 50] as const,
    formula: "Composite AI Agent Quality Score (canon Term 3)",
    canon: "General Technical Terms Registry v1.0 Term 3",
    note: "Session/agent quality. Tier break-points: Bronze 30 / Silver 36 / Gold 43 / Platinum 48.",
  },
  KCSE_DIMENSIONS: {
    range: [0, 50] as const,
    formula: "Knowledge·0.30 + Clarity·0.30 + Specificity·0.20 + Efficiency·0.20",
    canon: "ARK-internal CCGE in-game rubric (NOT the canon JCSE rubric)",
    note: "Four-dimension breakdown that produces the per-session JCSE in the CCGE game.",
  },
  HIVE: {
    range: [0, 100] as const,
    formula: "14-dimensional cert framework, per-dimension percentage",
    canon: "HIVE MATRIX LABS — General Technical Terms Registry Term 8",
    note: "Tier break-points: Bronze 60 / Silver 70 / Gold 80 / Platinum 90. Publish gate: Gold (80).",
  },
  CC_LEVELS: {
    range: ["NONE", "CC_100", "CC_200", "CC_300", "CC_400", "CC_500"] as const,
    canon: "ARK-internal ladder; maps to canon cert tiers via jcseToContextCraftLevel().",
    note: "CC_200=Bronze, CC_300=Silver, CC_400=Gold, CC_500=Platinum. CC_100=Foundational (assessment-only).",
  },
  KNIGHT_RANK: {
    canon: "ARK-internal GUIN+ contributor rank (NOT the canon Six-Stage Agent Lifecycle).",
    note: "Peer-endorsement gamification: Squire/Knight/Paladin/Champion/Legend keyed on cumulative JCSE earned.",
  },
} as const;

// ── PDD §3.4: ARK Score / JST / CCMI / VMST identity layer ──
// JST  = [(J×0.30)+(S×0.40)+(T×0.30)]×3   (J/S/T 0-100 → JST 0-300)
// CCMI = [(P1×0.18)+(P2×0.14)+(P3×0.18)+(P4×0.12)+(P5×0.10)+(P6×0.10)+(P7×0.18)]×3 (P1-P7 0-100 → CCMI 0-300)
// ARK  = JST + CCMI (0-600)
export const JST_WEIGHTS = { jobs: 0.30, skills: 0.40, talent: 0.30 } as const;
export const CCMI_PILLAR_WEIGHTS = {
  P1: 0.18, P2: 0.14, P3: 0.18, P4: 0.12, P5: 0.10, P6: 0.10, P7: 0.18,
} as const;
export type CcmiPillarKey = keyof typeof CCMI_PILLAR_WEIGHTS;
export const CCMI_PILLAR_LABELS: Record<CcmiPillarKey, string> = {
  P1: "System & Architecture",
  P2: "Role Clarity",
  P3: "Instruction Mastery",
  P4: "Example Curation",
  P5: "Constraint Discipline",
  P6: "Format Precision",
  P7: "Data Stewardship",
};

// CC multiplier bands keyed off CCMI score (PDD §3.4)
export const CCMI_TIER_BANDS = [
  { min: 270, max: 300, tier: "T5", label: "Master",       multiplier: 1.35 },
  { min: 240, max: 269, tier: "T4", label: "Expert",       multiplier: 1.30 },
  { min: 200, max: 239, tier: "T3", label: "Specialist",   multiplier: 1.20 },
  { min: 150, max: 199, tier: "T2", label: "Practitioner", multiplier: 1.10 },
  { min: 100, max: 149, tier: "T1", label: "Foundational", multiplier: 1.05 },
  { min: 0,   max: 99,  tier: "T0", label: "Unverified",   multiplier: 1.00 },
] as const;
export type CcmiTier = typeof CCMI_TIER_BANDS[number]["tier"];

// ARK Score tier labels (0-600)
export const ARK_TIERS = [
  { min: 540, max: 600, key: "Legendary",   color: "#AA44FF" },
  { min: 480, max: 539, key: "Exceptional", color: "#44AA44" },
  { min: 400, max: 479, key: "Strong",      color: "#4488FF" },
  { min: 300, max: 399, key: "Capable",     color: "#FFDD00" },
  { min: 200, max: 299, key: "Developing",  color: "#FFA500" },
  { min: 0,   max: 199, key: "Foundation",  color: "#FF4444" },
] as const;
export type ArkTierKey = typeof ARK_TIERS[number]["key"];

// VMST (Vulnerability-Mitigation Status Tier) — 5 levels L0-L4
export const VMST_LEVELS = [
  { key: "L0", label: "Exposed",    min: 0,   color: "#FF4444" },
  { key: "L1", label: "At Risk",    min: 100, color: "#FFA500" },
  { key: "L2", label: "Stable",     min: 200, color: "#FFDD00" },
  { key: "L3", label: "Protected",  min: 350, color: "#4488FF" },
  { key: "L4", label: "Flourishing",min: 480, color: "#44AA44" },
] as const;
export type VmstLevel = typeof VMST_LEVELS[number]["key"];

export const TYPOLOGIES = ["A", "O", "C"] as const; // Architect / Orchestrator / Conductor
export type TypologyKey = typeof TYPOLOGIES[number];

// LHCS thresholds (PDD ARK-MVP-011) — three-light signal
export const LHCS_THRESHOLDS = { green: 70, amber: 40 } as const;
// PDD §3.4 — LHCS composite is a weighted blend, NOT a simple average.
export const LHCS_WEIGHTS = { cpr: 0.35, mps: 0.35, lcis: 0.30 } as const;
export type LhcsLight = "green" | "amber" | "red";
// Aggregate status uses the same tri-state palette as the individual lights so
// the client can render a single LhcsLight badge for either field.
export type LhcsStatus = LhcsLight;

export function lhcsLight(score: number): LhcsLight {
  if (score >= LHCS_THRESHOLDS.green) return "green";
  if (score >= LHCS_THRESHOLDS.amber) return "amber";
  return "red";
}

// PDD §3.4 — composite readiness is the threshold target, not the lights.
//   readiness = round(0.35·CPR + 0.35·MPS + 0.30·LCIS)
//   status:    readiness ≥ 70 → green (ACTIVE)
//              40 ≤ readiness < 70 → amber (DEVELOPING)
//              readiness < 40 → red (BASELINE)
export function lhcsReadiness(cpr: number, mps: number, lcis: number): number {
  const c = Math.max(0, Math.min(100, cpr));
  const m = Math.max(0, Math.min(100, mps));
  const l = Math.max(0, Math.min(100, lcis));
  return Math.round(c * LHCS_WEIGHTS.cpr + m * LHCS_WEIGHTS.mps + l * LHCS_WEIGHTS.lcis);
}
export function lhcsStatusFromReadiness(readiness: number): LhcsStatus {
  return lhcsLight(readiness);
}

// Daily / monthly caps per PDD §3.4 flywheel rules
export const FLYWHEEL_CAPS = {
  CCGE_PER_DAY: 15,
  SPHINX_PER_30D: 20,
} as const;

export const ARK_TRIGGER_TYPES = [
  "assessment.completed",
  "ccge.session",
  "cert.upgraded",
  "spc.published",
  "spc.sold",
  "spc.purchased",
  "manual.recompute",
  "backfill",
] as const;
export type ArkTriggerType = typeof ARK_TRIGGER_TYPES[number];

// ── SPHINX Marketplace constants ───────────────────────────
export const SPC_CREATOR_SHARE_PCT = 70;
export const SPC_PLATFORM_SHARE_PCT = 30;
export const SPC_STARTING_CREDITS = 100;
export const SPC_MIN_CERT_TO_PUBLISH: ContextCraftLevel = "CC_400";
export const SPC_PRICE_MIN = 5;
export const SPC_PRICE_MAX = 500;
// Marketplace publish gate. Canon alignment: General Technical Terms Registry
// v1.0 Term 8 (14-Dimensional Quality Certification): Bronze 60-69, Silver
// 70-79, Gold 80-89, Platinum 90-100. We require Gold (80) so the listing's
// HIVE tier matches the publisher's user cert floor (CC-400 Gold).
export const SPC_HIVE_MIN_TO_PUBLISH = 80;
export const SPC_FIRST_SALE_TALENT_BOOST = 3;

export const SPC_STATUSES = ["draft", "active", "delisted"] as const;
export type SpcStatus = typeof SPC_STATUSES[number];

export const CERT_LEVEL_RANK: Record<ContextCraftLevel, number> = {
  NONE: 0,
  CC_100: 1,
  CC_200: 2,
  CC_300: 3,
  CC_400: 4,
  CC_500: 5,
};

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  department: text("department"),
  seniority: text("seniority"),
  location: text("location"),
  contextCraftCertLevel: text("context_craft_cert_level").default("NONE"),
  subscriptionPlan: text("subscription_plan").default("INDIVIDUAL_FREE"),
  subscriptionStatus: text("subscription_status").default("active"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end"),
  subscriptionCanceledAt: timestamp("subscription_canceled_at"),
  institution: text("institution"),
  uploadsThisMonth: integer("uploads_this_month").default(0),
  uploadResetDate: timestamp("upload_reset_date"),
  // PDD §3.4 ARK identity surface (denormalized snapshot of latest scoring run)
  arkScore: integer("ark_score").notNull().default(0),
  jstIndex: integer("jst_index").notNull().default(0),
  ccmi: integer("ccmi").notNull().default(0),
  ccmiTier: text("ccmi_tier").notNull().default("T0"),
  vmstLevel: text("vmst_level").notNull().default("L0"),
  typology: text("typology"),
  arkIdString: text("ark_id_string"),
  cprScore: integer("cpr_score").notNull().default(0),
  mpsScore: integer("mps_score").notNull().default(0),
  lcisScore: integer("lcis_score").notNull().default(0),
  lhcsStatus: text("lhcs_status").notNull().default("red"),
  resumeReplacementPct: integer("resume_replacement_pct").notNull().default(0),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  institution: true,
  uploadsThisMonth: true,
  uploadResetDate: true,
  contextCraftCertLevel: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  arkScore: true,
  jstIndex: true,
  ccmi: true,
  ccmiTier: true,
  vmstLevel: true,
  typology: true,
  arkIdString: true,
  cprScore: true,
  mpsScore: true,
  lcisScore: true,
  lhcsStatus: true,
  resumeReplacementPct: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
// UpdateUser is the type used by storage.updateUser for server-side patches.
// Unlike InsertUser (which strips privileged fields to prevent registration-time
// privilege escalation — see Task #7), updates legitimately need to write
// contextCraftCertLevel (admin cert grant) and stripeCustomerId/SubscriptionId
// (billing webhooks). These fields are server-controlled, never sourced from
// untrusted client bodies without their own auth + validation.
export type UpdateUser = Partial<typeof users.$inferInsert>;
export type User = typeof users.$inferSelect;

export const assessments = pgTable("assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  jstTotal: integer("jst_total").notNull().default(0),
  jstJobs: integer("jst_jobs").notNull().default(0),
  jstSkills: integer("jst_skills").notNull().default(0),
  jstTalent: integer("jst_talent").notNull().default(0),
  vulnerabilityLevel: integer("vulnerability_level").notNull().default(2),
  readinessProfile: text("readiness_profile").notNull().default("Conductor"),
  riskModifiers: jsonb("risk_modifiers").$type<Array<{ task: string; automatable: number }>>(),
  matchedCardIds: text("matched_card_ids").array(),
  archetypeArchitect: integer("archetype_architect").notNull().default(34),
  archetypeOrchestrator: integer("archetype_orchestrator").notNull().default(33),
  archetypeConductor: integer("archetype_conductor").notNull().default(33),
  automationMilestones: jsonb("automation_milestones").$type<Array<{ year: number; event: string; automationPct: number; impact: string }>>(),
  contextCraftLevel: text("context_craft_level").default("NONE"),
  contextCraftMultiplier: real("context_craft_multiplier").default(0.5),
  jstRawTotal: integer("jst_raw_total"),
  jstRawJobs: integer("jst_raw_jobs"),
  jstRawSkills: integer("jst_raw_skills"),
  jstRawTalent: integer("jst_raw_talent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({ id: true, createdAt: true });
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessments.$inferSelect;

export const upskillingPlans = pgTable("upskilling_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").notNull(),
  phase: text("phase").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  hours: integer("hours").notNull(),
});

export const insertUpskillingPlanSchema = createInsertSchema(upskillingPlans).omit({ id: true });
export type InsertUpskillingPlan = z.infer<typeof insertUpskillingPlanSchema>;
export type UpskillingPlan = typeof upskillingPlans.$inferSelect;

export const pivotOpportunities = pgTable("pivot_opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").notNull(),
  role: text("role").notNull(),
  feasibility: integer("feasibility").notNull(),
  gapCost: text("gap_cost").notNull(),
  time: text("time").notNull(),
});

export const insertPivotOpportunitySchema = createInsertSchema(pivotOpportunities).omit({ id: true });
export type InsertPivotOpportunity = z.infer<typeof insertPivotOpportunitySchema>;
export type PivotOpportunity = typeof pivotOpportunities.$inferSelect;

export const transferabilityVectors = pgTable("transferability_vectors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").notNull(),
  subject: text("subject").notNull(),
  score: integer("score").notNull(),
});

export const insertTransferabilityVectorSchema = createInsertSchema(transferabilityVectors).omit({ id: true });
export type InsertTransferabilityVector = z.infer<typeof insertTransferabilityVectorSchema>;
export type TransferabilityVector = typeof transferabilityVectors.$inferSelect;

export const jnomicsCards = pgTable("jnomics_cards", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  tier: text("tier").notNull(),
  type: text("type").notNull(),
  emoji: text("emoji").notNull(),
  description: text("description").notNull(),
  basePts: integer("base_pts").notNull(),
  // ── Phase M1 (SPHINX × Matrix) — 5 taxonomy columns ──
  // `tier` pre-existed (notNull) before M1; the other four are nullable.
  // All five collectively satisfy the M1 jnomics_cards taxonomy requirement.
  disc: text("disc"),
  rarity: text("rarity"),
  version: text("version"),
  category: text("category"),
});

export const insertJnomicsCardSchema = createInsertSchema(jnomicsCards);
export type InsertJnomicsCard = z.infer<typeof insertJnomicsCardSchema>;
export type JnomicsCard = typeof jnomicsCards.$inferSelect;

export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  risk: integer("risk").notNull(),
  headcount: integer("headcount").notNull(),
  seniority: text("seniority").notNull(),
  location: text("location").notNull(),
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true });
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

// ── CCGE Tables ───────────────────────────────────────────────
export const ccgeCards = pgTable("ccge_cards", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  pillar: text("pillar").notNull(),
  type: text("type").notNull(),
  baseKcse: integer("base_kcse").notNull(),
  tokenCost: integer("token_cost").notNull(),
  emoji: text("emoji").notNull(),
  description: text("description").notNull(),
  body: text("body").notNull(),
});

export const insertCcgeCardSchema = createInsertSchema(ccgeCards);
export type InsertCcgeCard = z.infer<typeof insertCcgeCardSchema>;
export type CcgeCard = typeof ccgeCards.$inferSelect;

export const ccgeScenarios = pgTable("ccge_scenarios", {
  id: varchar("id").primaryKey(),
  tier: text("tier").notNull(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  targetPillars: text("target_pillars").array().notNull(),
  tokenBudget: integer("token_budget").notNull(),
  difficulty: integer("difficulty").notNull(),
  // Phase J.1 — Custom industry scenarios. NULL creatorUserId = canon scenario
  // visible to everyone; non-null = private to that user. industry is a freeform
  // sector label set by the creator (e.g. "Healthcare", "FinTech").
  creatorUserId: varchar("creator_user_id"),
  industry: text("industry"),
  isCustom: boolean("is_custom").default(false).notNull(),
});

// Industry presets shown in the "Create Your Own Scenario" picker. Users can
// also free-type, but the dropdown anchors the most common sectors.
export const CCGE_INDUSTRY_PRESETS = [
  "Finance & Banking",
  "Healthcare & Life Sciences",
  "Technology & Software",
  "Manufacturing & Industrial",
  "Retail & E-commerce",
  "Education & EdTech",
  "Legal & Compliance",
  "Marketing & Advertising",
  "Energy & Utilities",
  "Real Estate & Construction",
  "Media & Entertainment",
  "Government & Public Sector",
  "Non-profit & NGO",
  "Consulting & Professional Services",
  "Other",
] as const;
export type CcgeIndustryPreset = typeof CCGE_INDUSTRY_PRESETS[number];

export const insertCcgeScenarioSchema = createInsertSchema(ccgeScenarios);
export type InsertCcgeScenario = z.infer<typeof insertCcgeScenarioSchema>;
export type CcgeScenario = typeof ccgeScenarios.$inferSelect;

export type KcseBreakdown = {
  knowledge: number;
  clarity: number;
  specificity: number;
  efficiency: number;
  pillarsCovered: string[];
  synergies: { name: string; multiplier: number }[];
  tokenUsed: number;
  tokenBudget: number;
  base: number;
  final: number;
};

export const gameSessions = pgTable("game_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  scenarioId: varchar("scenario_id").notNull(),
  hand: jsonb("hand").$type<string[]>().notNull(),
  played: jsonb("played").$type<string[]>().default([]).notNull(),
  status: text("status").notNull().default("in_progress"),
  kcseScore: real("kcse_score"),
  kcseBreakdown: jsonb("kcse_breakdown").$type<KcseBreakdown>(),
  certTierEarned: text("cert_tier_earned"),
  arkScoreDelta: integer("ark_score_delta").default(0),
  certUpgradedFrom: text("cert_upgraded_from"),
  certUpgradedTo: text("cert_upgraded_to"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
});

export const insertGameSessionSchema = createInsertSchema(gameSessions).omit({
  id: true,
  startedAt: true,
  finishedAt: true,
});
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessions.$inferSelect;

// ── SPHINX Marketplace Tables ────────────────────────────────
export const spcListings = pgTable("spc_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: varchar("creator_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  body: text("body").notNull(),
  pillar: text("pillar").notNull(),
  priceCredits: integer("price_credits").notNull(),
  kcseScore: real("kcse_score").notNull(),
  hiveScore: real("hive_score").notNull(),
  status: text("status").notNull().default("active"),
  salesCount: integer("sales_count").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0),
  // ── Phase M1 (SPHINX × Matrix) additive column ──
  // Optional Junglenomics card IDs this listing is synergy-tagged with;
  // populated in M3 by the synergy engine. Nullable + empty default so
  // existing inserts continue to work unchanged.
  synergyTagIds: text("synergy_tag_ids").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSpcListingSchema = createInsertSchema(spcListings).omit({
  id: true,
  kcseScore: true,
  hiveScore: true,
  status: true,
  salesCount: true,
  totalEarned: true,
  createdAt: true,
});
export type InsertSpcListing = z.infer<typeof insertSpcListingSchema>;
// `bodyLocked` and `bodyLength` are added by the API layer (not stored in DB)
// so the client can render the SpcTaxonomyPanel without ever touching prompt
// content. `body` is empty string when locked.
export type SpcListing = typeof spcListings.$inferSelect & {
  bodyLocked?: boolean;
  bodyLength?: number;
};

export const spcPurchases = pgTable(
  "spc_purchases",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    buyerId: varchar("buyer_id").notNull(),
    listingId: varchar("listing_id").notNull(),
    creatorId: varchar("creator_id").notNull(),
    priceCredits: integer("price_credits").notNull(),
    creatorShare: integer("creator_share").notNull(),
    platformShare: integer("platform_share").notNull(),
    isFirstSaleForCreator: boolean("is_first_sale_for_creator").notNull().default(false),
    purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("spc_purchases_buyer_listing_uidx").on(t.buyerId, t.listingId)],
);

export const insertSpcPurchaseSchema = createInsertSchema(spcPurchases).omit({
  id: true,
  purchasedAt: true,
});
export type InsertSpcPurchase = z.infer<typeof insertSpcPurchaseSchema>;
export type SpcPurchase = typeof spcPurchases.$inferSelect;

// ── GUIN+ Identity Layer ─────────────────────────────────────
export const endorsements = pgTable(
  "endorsements",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    endorserId: varchar("endorser_id").notNull(),
    recipientId: varchar("recipient_id").notNull(),
    sessionId: varchar("session_id").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Race-safe duplicate prevention: even if two concurrent requests pass
    // the validateEndorsement precheck, the second insert will fail with a
    // unique-violation that the route handler maps to HTTP 409.
    endorserRecipientUnique: uniqueIndex("endorsements_endorser_recipient_uniq").on(
      t.endorserId,
      t.recipientId
    ),
  })
);

export const insertEndorsementSchema = createInsertSchema(endorsements).omit({
  id: true,
  createdAt: true,
});
export type InsertEndorsement = z.infer<typeof insertEndorsementSchema>;
export type Endorsement = typeof endorsements.$inferSelect;

export const KNIGHT_RANKS = [
  { key: "Squire",   label: "Squire",   min: 0,   color: "#888888", icon: "🛡" },
  { key: "Knight",   label: "Knight",   min: 50,  color: "#FFA500", icon: "⚔" },
  { key: "Paladin",  label: "Paladin",  min: 150, color: "#FFDD00", icon: "🏆" },
  { key: "Champion", label: "Champion", min: 350, color: "#4488FF", icon: "👑" },
  { key: "Legend",   label: "Legend",   min: 650, color: "#AA44FF", icon: "🐉" },
] as const;
export type KnightRankKey = typeof KNIGHT_RANKS[number]["key"];

export function computeKnightRank(totalKcseEarned: number) {
  let current: (typeof KNIGHT_RANKS)[number] = KNIGHT_RANKS[0];
  for (const r of KNIGHT_RANKS) {
    if (totalKcseEarned >= r.min) current = r;
  }
  const idx = KNIGHT_RANKS.findIndex((r) => r.key === current.key);
  const next = idx < KNIGHT_RANKS.length - 1 ? KNIGHT_RANKS[idx + 1] : null;
  const progress = next
    ? Math.max(0, Math.min(1, (totalKcseEarned - current.min) / (next.min - current.min)))
    : 1;
  return { current: { ...current }, next: next ? { ...next } : null, progress, totalKcseEarned };
}

export const ENDORSEMENT_MAX_LEN = 240;

export const userCredits = pgTable("user_credits", {
  userId: varchar("user_id").primaryKey(),
  balance: integer("balance").notNull().default(0),
  lifetimeEarned: integer("lifetime_earned").notNull().default(0),
  lifetimeSpent: integer("lifetime_spent").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserCredits = typeof userCredits.$inferSelect;

export const ARK_EVENT_TYPES = [
  "assessment.completed",
  "game.session.finished",
  "cert.upgraded",
  "spc.published",
  "spc.purchased",
  "billing.checkout.completed",
  "billing.subscription.canceled",
  "billing.payment.failed",
  // Phase M1 (SPHINX × Matrix) — synergy bonuses are SPHINX-class events,
  // capped under the existing SPHINX +20/30d ceiling via arkRecalc.applyCaps.
  "synergy.awarded",
] as const;

export const CHECKOUT_STATUSES = ["pending", "completed", "failed", "canceled"] as const;
export type CheckoutStatus = typeof CHECKOUT_STATUSES[number];

export const BILLING_EVENT_TYPES = [
  "checkout.created",
  "checkout.completed",
  "checkout.failed",
  "subscription.upgraded",
  "subscription.downgraded",
  "subscription.canceled",
  "payment.succeeded",
  "payment.failed",
] as const;
export type BillingEventType = typeof BILLING_EVENT_TYPES[number];

export const checkoutSessions = pgTable("checkout_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  plan: text("plan").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("pending"),
  institution: text("institution"),
  externalSessionId: text("external_session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertCheckoutSessionSchema = createInsertSchema(checkoutSessions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type InsertCheckoutSession = z.infer<typeof insertCheckoutSessionSchema>;
export type CheckoutSession = typeof checkoutSessions.$inferSelect;

export const billingEvents = pgTable("billing_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  fromPlan: text("from_plan"),
  toPlan: text("to_plan"),
  amountCents: integer("amount_cents"),
  externalId: text("external_id"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBillingEventSchema = createInsertSchema(billingEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertBillingEvent = z.infer<typeof insertBillingEventSchema>;
export type BillingEvent = typeof billingEvents.$inferSelect;
export type ArkEventType = typeof ARK_EVENT_TYPES[number];

// ARK event source — classifies where an event originated. M1 adds `synergy`
// for SPHINX × Matrix synergy-bonus events. Nullable for backfill compatibility.
export const ARK_EVENT_SOURCES = [
  "system",
  "flywheel",
  "ccge",
  "sphinx",
  "synergy",
  "billing",
  "admin",
] as const;
export type ArkEventSource = typeof ARK_EVENT_SOURCES[number];

export const arkEvents = pgTable("ark_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  source: text("source").$type<ArkEventSource>(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  scoreDelta: integer("score_delta").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertArkEventSchema = createInsertSchema(arkEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertArkEvent = z.infer<typeof insertArkEventSchema>;
export type ArkEvent = typeof arkEvents.$inferSelect;

export const AI_KINDS = ["kcse", "narrative", "scenario_gen"] as const;
export type AiKind = typeof AI_KINDS[number];

export const AI_MODELS = {
  HAIKU: "claude-haiku-4-5",
  SONNET: "claude-sonnet-4-6",
} as const;

export const AI_PRICING_PER_MTOK = {
  "claude-haiku-4-5": { in: 80, out: 400 },
  "claude-sonnet-4-6": { in: 300, out: 1500 },
} as const;

export const AI_TIER_MONTHLY_TOKENS = {
  INDIVIDUAL_FREE: 20000,
  INDIVIDUAL_PRO: 500000,
  SCHOOL_STUDENT: 200000,
  ENTERPRISE: 2000000,
} as const;

// Per-user daily AI call quota by kind. Cached hits never count toward
// the quota — only fresh Claude invocations do. Counts the number of
// `ai_usage` rows for that kind in the trailing UTC day.
export const AI_TIER_DAILY_QUOTA = {
  INDIVIDUAL_FREE: { kcse: 5,  narrative: 0,  scenario_gen: 0   },
  INDIVIDUAL_PRO:  { kcse: 50, narrative: 30, scenario_gen: 10  },
  SCHOOL_STUDENT:  { kcse: 20, narrative: 10, scenario_gen: 5   },
  ENTERPRISE:      { kcse: 200, narrative: 100, scenario_gen: 50 },
} as const;

export const aiUsage = pgTable("ai_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  kind: text("kind").notNull(),
  model: text("model").notNull(),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  costCents: integer("cost_cents").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiCache = pgTable("ai_cache", {
  cacheKey: varchar("cache_key").primaryKey(),
  kind: text("kind").notNull(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAiUsageSchema = createInsertSchema(aiUsage).omit({ id: true, createdAt: true });
export type InsertAiUsage = z.infer<typeof insertAiUsageSchema>;
export type AiUsage = typeof aiUsage.$inferSelect;
export type AiCache = typeof aiCache.$inferSelect;

export type HivePrecheck = {
  hiveScore: number;
  kcseScore: number;
  passes: boolean;
  reasons: string[];
  warnings: string[];
};

// ── PDD §3.4 new identity tables ───────────────────────────
// CCMI pillar scores — 1 row per user (latest snapshot), pillars 0-100
export const ccmiPillarScores = pgTable("ccmi_pillar_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  p1: integer("p1").notNull().default(0),
  p2: integer("p2").notNull().default(0),
  p3: integer("p3").notNull().default(0),
  p4: integer("p4").notNull().default(0),
  p5: integer("p5").notNull().default(0),
  p6: integer("p6").notNull().default(0),
  p7: integer("p7").notNull().default(0),
  composite: integer("composite").notNull().default(0),
  tier: text("tier").notNull().default("T0"),
  multiplier: real("multiplier").notNull().default(1.0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertCcmiPillarScoresSchema = createInsertSchema(ccmiPillarScores).omit({ id: true, updatedAt: true });
export type InsertCcmiPillarScores = z.infer<typeof insertCcmiPillarScoresSchema>;
export type CcmiPillarScores = typeof ccmiPillarScores.$inferSelect;

// ARK score history — append-only timeline of score deltas + triggers
export const arkScoreHistory = pgTable("ark_score_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  arkScore: integer("ark_score").notNull(),
  jstIndex: integer("jst_index").notNull(),
  ccmi: integer("ccmi").notNull(),
  delta: integer("delta").notNull().default(0),
  trigger: text("trigger").notNull(),
  triggerMeta: jsonb("trigger_meta").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertArkScoreHistorySchema = createInsertSchema(arkScoreHistory).omit({ id: true, createdAt: true });
export type InsertArkScoreHistory = z.infer<typeof insertArkScoreHistorySchema>;
export type ArkScoreHistory = typeof arkScoreHistory.$inferSelect;

// LHCS signals — 1 row per user (latest CPR/MPS/LCIS snapshot)
export const lhcsSignals = pgTable("lhcs_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  cprScore: integer("cpr_score").notNull().default(0),
  mpsScore: integer("mps_score").notNull().default(0),
  lcisScore: integer("lcis_score").notNull().default(0),
  cprLight: text("cpr_light").notNull().default("red"),
  mpsLight: text("mps_light").notNull().default("red"),
  lcisLight: text("lcis_light").notNull().default("red"),
  status: text("status").notNull().default("red"),
  readinessPct: integer("readiness_pct").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertLhcsSignalsSchema = createInsertSchema(lhcsSignals).omit({ id: true, updatedAt: true });
export type InsertLhcsSignals = z.infer<typeof insertLhcsSignalsSchema>;
export type LhcsSignals = typeof lhcsSignals.$inferSelect;


// ===== Phase G — Institutional Tier (Cohorts) =====
export const USER_ROLES = ["student", "instructor", "admin"] as const;
export type UserRole = typeof USER_ROLES[number];
export const isInstructor = (role: string | null | undefined) =>
  role === "instructor" || role === "admin";

export const cohorts = pgTable("cohorts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instructorId: varchar("instructor_id").notNull(),
  institution: text("institution").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertCohortSchema = createInsertSchema(cohorts).omit({ id: true, createdAt: true });
export type InsertCohort = z.infer<typeof insertCohortSchema>;
export type Cohort = typeof cohorts.$inferSelect;

export const cohortMemberships = pgTable("cohort_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cohortId: varchar("cohort_id").notNull(),
  userId: varchar("user_id").notNull(),
  status: text("status").notNull().default("active"), // active | invited | removed
  invitedEmail: text("invited_email"), // set when status=invited and user not yet registered
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});
export const insertCohortMembershipSchema = createInsertSchema(cohortMemberships).omit({ id: true, joinedAt: true });
export type InsertCohortMembership = z.infer<typeof insertCohortMembershipSchema>;
export type CohortMembership = typeof cohortMemberships.$inferSelect;

export const cohortAssignments = pgTable("cohort_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cohortId: varchar("cohort_id").notNull(),
  scenarioId: varchar("scenario_id").notNull(),
  assignedBy: varchar("assigned_by").notNull(),
  dueAt: timestamp("due_at"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertCohortAssignmentSchema = createInsertSchema(cohortAssignments).omit({ id: true, createdAt: true });
export type InsertCohortAssignment = z.infer<typeof insertCohortAssignmentSchema>;
export type CohortAssignment = typeof cohortAssignments.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// Phase M1 — SPHINX × Matrix Foundation
// ═══════════════════════════════════════════════════════════════════
// All Matrix-side feature tables, currency-display helpers, and derived
// display bands. No behavior change yet — M2-M5 wire these into UI.
// Credits remain canonical; USD is a display-only conversion at a
// fixed rate. There is no USD write path anywhere in this codebase.

/** 1 credit ≡ this many USD. Display-only; never a write. */
export const CREDITS_TO_USD = 0.10;

/** Render a credit value as the canonical dual format used everywhere
 *  on `/marketplace*`. Example: `formatPriceDual(120)` → `"120 cr ≈ $12.00"`.
 *  Pass `mode: 'compact'` for short renders like `"120 cr"` when space is tight. */
export function formatPriceDual(credits: number, mode: "full" | "compact" = "full"): string {
  const n = Math.max(0, Math.round(credits));
  if (mode === "compact") return `${n} cr`;
  const usd = (n * CREDITS_TO_USD).toFixed(2);
  return `${n} cr ≈ $${usd}`;
}

/** USD-only side of a dual render. Use when the credit number is shown in
 *  a styled span and the USD half needs its own element. Always returns the
 *  prefix `≈ $` so callers never reconstruct the format. */
export function formatPriceUsd(credits: number): string {
  const n = Math.max(0, Math.round(credits));
  return `≈ $${(n * CREDITS_TO_USD).toFixed(2)}`;
}

/** HIVE-score → tier badge mapping for the Matrix-style listing card.
 *  See merge-spec §"Tier badge mapping (M13)". Publish gate (HIVE 80)
 *  means anything below STANDARD won't appear publicly. */
export const TIER_BADGE_THRESHOLDS = {
  ULTRA: 90,
  PREMIUM: 80,
  STANDARD: 60,
} as const;
export type TierBadgeKey = keyof typeof TIER_BADGE_THRESHOLDS;
export function hiveToTierBadge(hive: number): TierBadgeKey | null {
  if (hive >= TIER_BADGE_THRESHOLDS.ULTRA) return "ULTRA";
  if (hive >= TIER_BADGE_THRESHOLDS.PREMIUM) return "PREMIUM";
  if (hive >= TIER_BADGE_THRESHOLDS.STANDARD) return "STANDARD";
  return null;
}

/** HIVE-score → letter-grade display band. Pure display derivation;
 *  no new storage. See merge-spec §"Quality letter grade (M3)". */
export const LETTER_GRADE_BANDS = [
  { grade: "S", min: 95, color: "#AA44FF" },
  { grade: "A", min: 85, color: "#44AA44" },
  { grade: "B", min: 75, color: "#4488FF" },
  { grade: "C", min: 60, color: "#FFA500" },
  { grade: "D", min: 0,  color: "#FF4444" },
] as const;
export type LetterGrade = typeof LETTER_GRADE_BANDS[number]["grade"];
export function hiveToLetterGrade(hive: number): { grade: LetterGrade; color: string } {
  for (const band of LETTER_GRADE_BANDS) {
    if (hive >= band.min) return { grade: band.grade, color: band.color };
  }
  return { grade: "D", color: "#FF4444" };
}

/** Static registry of the 20 absorbed Matrix features (M1-M20).
 *  Reference only; consumed by docs/admin surfaces. Not a runtime gate. */
export const MATRIX_FEATURES = {
  M1:  "Synergy Engine",
  M2:  "Complementary Pairs",
  M3:  "AI Letter-Grade Analysis",
  M4:  "Synthesis Engine",
  M5:  "ZPOS Compression",
  M6:  "ARK Roundtable (Top-12)",
  M7:  "Notification Bell + SSE",
  M8:  "169-Card Junglenomics Taxonomy",
  M9:  "Bonsai Seller Onboarding (18 stages)",
  M10: ".docx Forge Lab",
  M11: "Grade-Based Pricing Matrix",
  M12: "Performance Metric Bars",
  M13: "Tier Badges (ULTRA/PREMIUM/STANDARD)",
  M14: "Bonsai DAG Visualization",
  M15: "Per-Listing AI Suggestions Panel",
  M16: "5-Tab Detail Layout",
  M17: "6-Dimension Filter Sidebar",
  M18: "Free-Text Search",
  M19: "Category Chips",
  M20: "Inline Pillar Suggestions",
} as const;

// ── Marketplace categories (M19) ────────────────────────────────────
// 6-category mapping over the 8 CC pillars + SuperPrompt. Pure display
// derivation; no DB column. Used by the browse chip filter.
export const MARKETPLACE_CATEGORIES = [
  "Engineering",
  "Productivity",
  "Creative",
  "Data",
  "Personas",
  "Elite",
] as const;
export type MarketplaceCategory = typeof MARKETPLACE_CATEGORIES[number];

const PILLAR_TO_CATEGORY: Record<CardPillar, MarketplaceCategory> = {
  System: "Engineering",
  Constraint: "Engineering",
  Instruction: "Productivity",
  Format: "Productivity",
  Example: "Creative",
  Data: "Data",
  Role: "Personas",
  SuperPrompt: "Elite",
};
export function pillarToCategory(pillar: string): MarketplaceCategory | null {
  return (PILLAR_TO_CATEGORY as Record<string, MarketplaceCategory>)[pillar] ?? null;
}
export function categoryToPillars(category: MarketplaceCategory): CardPillar[] {
  return (Object.keys(PILLAR_TO_CATEGORY) as CardPillar[])
    .filter((p) => PILLAR_TO_CATEGORY[p] === category);
}

// ── Performance metric bars (M12) ───────────────────────────────────
// Pure display derivation from HIVE + KCSE + body length. Never stored.
// Spec mapping (see merge-spec §"Performance metric bars"):
//   Speed       = body-length compactness
//   Efficiency  = HIVE / token-count ratio (tokens ≈ body/4)
//   Innovation  = KCSE Knowledge proxy (we only have aggregate KCSE 0-50)
//   Reliability = KCSE Clarity + Specificity blend
export type PerfBars = {
  speed: number;        // 0-100
  efficiency: number;   // 0-100
  innovation: number;   // 0-100
  reliability: number;  // 0-100
};
const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
export function derivePerfBars(input: {
  hiveScore: number;
  kcseScore: number;
  bodyLength: number;
}): PerfBars {
  const { hiveScore, kcseScore, bodyLength } = input;
  const tokens = Math.max(1, Math.round(bodyLength / 4));
  // Speed: short = fast. Optimum ≤300 chars (100), 4000+ chars (0).
  const speed = clamp100(100 - Math.max(0, bodyLength - 300) / 37);
  // Efficiency: HIVE earned per 100 tokens, scaled.
  const efficiency = clamp100((hiveScore * 100) / Math.max(tokens, 50));
  // Innovation: KCSE acts as Knowledge proxy (0-50 → 0-100), small HIVE-bonus.
  const innovation = clamp100(kcseScore * 1.8 + (hiveScore - 60) * 0.3);
  // Reliability: KCSE acts as Clarity+Specificity blend, anchored by HIVE.
  const reliability = clamp100(kcseScore * 1.6 + hiveScore * 0.25);
  return { speed, efficiency, innovation, reliability };
}

// ── Grade-based pricing matrix (M11) ────────────────────────────────
// Static suggestion banner shown on /marketplace/publish. Each band maps
// a tier badge to a recommended credit-price range. Display-only — the
// server still enforces SPC_PRICE_MIN / SPC_PRICE_MAX.
export const GRADE_PRICING_MATRIX = [
  { tier: "ULTRA",    minHive: 90, suggestedMin: 80, suggestedMax: 100, label: "Top-shelf — price aggressively" },
  { tier: "PREMIUM",  minHive: 80, suggestedMin: 40, suggestedMax: 79,  label: "Strong — fair-value zone" },
  { tier: "STANDARD", minHive: 60, suggestedMin: 10, suggestedMax: 39,  label: "Baseline — entry pricing" },
] as const;
export type GradePricingBand = typeof GRADE_PRICING_MATRIX[number];
export function suggestedPriceForHive(hive: number): GradePricingBand | null {
  for (const band of GRADE_PRICING_MATRIX) {
    if (hive >= band.minHive) return band;
  }
  return null;
}

// ── AI Analysis (M3 / M15 / M20) ────────────────────────────────────
// Per-listing Claude-powered letter grade + per-pillar improvement
// suggestions. Cached 24h via server/ai/cache.ts; Pro+ gated.
export const SPC_AI_ANALYSIS_TTL_MS = 24 * 60 * 60 * 1000;
export type SpcPillarSuggestion = {
  pillar: CCPillar;
  currentStrength: number; // 0-100
  suggestion: string;
};
export type SpcAiAnalysis = {
  letterGrade: LetterGrade;
  letterGradeColor: string;
  hiveScore: number;
  pillarSuggestions: SpcPillarSuggestion[];
  generatedAt: string;
  cached: boolean;
};

// ── Card synergies (M1) ─────────────────────────────────────────────
// Symmetric pairing table — only one row per unordered pair (cardA < cardB).
// IMPORTANT: writers MUST canonicalize via `canonicalCardPair()` so that
// `cardAId < cardBId` always holds. The DB also enforces this via a CHECK
// constraint (`card_synergies_ordered_chk`) — see migration 0004.
export const cardSynergies = pgTable(
  "card_synergies",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    cardAId: varchar("card_a_id").notNull(),
    cardBId: varchar("card_b_id").notNull(),
    synergyScore: integer("synergy_score").notNull().default(0), // 0-100
    rationale: text("rationale"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    pairUnique: uniqueIndex("card_synergies_pair_uniq").on(t.cardAId, t.cardBId),
  }),
);
/** Canonicalize an unordered card pair so that `a < b` (lexicographic).
 *  All `cardSynergies` writes MUST go through this helper. */
export function canonicalCardPair(x: string, y: string): { cardAId: string; cardBId: string } {
  return x < y ? { cardAId: x, cardBId: y } : { cardAId: y, cardBId: x };
}
export const insertCardSynergySchema = createInsertSchema(cardSynergies).omit({ id: true, updatedAt: true });
export type InsertCardSynergy = z.infer<typeof insertCardSynergySchema>;
export type CardSynergy = typeof cardSynergies.$inferSelect;

// ── Complementary pairs (M2) ────────────────────────────────────────
// Precomputed top-N partners for each SPC listing, refreshed by a job.
export const complementaryPairs = pgTable(
  "complementary_pairs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    listingId: varchar("listing_id").notNull(),
    partnerListingId: varchar("partner_listing_id").notNull(),
    score: integer("score").notNull().default(0), // 0-100
    rank: integer("rank").notNull().default(0),   // 1..N within listing
    computedAt: timestamp("computed_at").defaultNow().notNull(),
  },
  (t) => ({
    pairUnique: uniqueIndex("complementary_pairs_listing_partner_uniq").on(t.listingId, t.partnerListingId),
  }),
);
export const insertComplementaryPairSchema = createInsertSchema(complementaryPairs).omit({ id: true, computedAt: true });
export type InsertComplementaryPair = z.infer<typeof insertComplementaryPairSchema>;
export type ComplementaryPair = typeof complementaryPairs.$inferSelect;

// ── Synthesis sessions (M4) ─────────────────────────────────────────
// One row per buyer-initiated synthesis. `status`: draft|finalized|failed.
export const synthesisSessions = pgTable("synthesis_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buyerId: varchar("buyer_id").notNull(),
  sourceListingIds: text("source_listing_ids").array().notNull(),
  combinedBody: text("combined_body"),        // null until finalized
  totalPriceCredits: integer("total_price_credits").notNull().default(0),
  platformShare: integer("platform_share").notNull().default(0),
  creatorShareTotal: integer("creator_share_total").notNull().default(0),
  zposTokensIn: integer("zpos_tokens_in").notNull().default(0),
  zposTokensOut: integer("zpos_tokens_out").notNull().default(0),
  zposCompressionPct: real("zpos_compression_pct").notNull().default(0),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  finalizedAt: timestamp("finalized_at"),
});
export const insertSynthesisSessionSchema = createInsertSchema(synthesisSessions).omit({
  id: true, createdAt: true, finalizedAt: true,
});
export type InsertSynthesisSession = z.infer<typeof insertSynthesisSessionSchema>;
export type SynthesisSession = typeof synthesisSessions.$inferSelect;

// ── Synthesis royalty splits (M4) ───────────────────────────────────
// Per-creator ledger row for each finalized synthesis session.
export const synthesisCreatorsSplit = pgTable("synthesis_creators_split", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  creatorId: varchar("creator_id").notNull(),
  sourceListingId: varchar("source_listing_id").notNull(),
  weight: real("weight").notNull(),                 // 0..1, source-price-weighted
  creditsAwarded: integer("credits_awarded").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertSynthesisCreatorSplitSchema = createInsertSchema(synthesisCreatorsSplit).omit({
  id: true, createdAt: true,
});
export type InsertSynthesisCreatorSplit = z.infer<typeof insertSynthesisCreatorSplitSchema>;
export type SynthesisCreatorSplit = typeof synthesisCreatorsSplit.$inferSelect;

// ── Forge Lab test results (M10) ────────────────────────────────────
// Pre-publish HIVE precheck history; streamed to the Forge Lab terminal UI.
export const testResults = pgTable("test_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  source: text("source").notNull(),         // 'docx' | 'paste' | 'import'
  filename: text("filename"),
  hiveScore: real("hive_score").notNull().default(0),
  kcseScore: real("kcse_score").notNull().default(0),
  passes: boolean("passes").notNull().default(false),
  log: jsonb("log").$type<{ step: string; ok: boolean; msg: string }[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertTestResultSchema = createInsertSchema(testResults).omit({ id: true, createdAt: true });
export type InsertTestResult = z.infer<typeof insertTestResultSchema>;
export type TestResult = typeof testResults.$inferSelect;

// ── Notifications (M7) ──────────────────────────────────────────────
// Per-user inbox for SSE-driven events (seat rotation, synergy discovered, etc).
export const NOTIFICATION_TYPES = [
  "roundtable.seat_rotation",
  "synergy.discovered",
  "synthesis.completed",
  "spc.purchased",
  "spc.first_sale",
] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true, createdAt: true, readAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// ── ARK Roundtable (M6) ─────────────────────────────────────────────
// Top-N leaderboard snapshot; refreshed by a periodic ranker.
export const roundtableState = pgTable(
  "roundtable_state",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    listingId: varchar("listing_id").notNull(),
    creatorId: varchar("creator_id").notNull(),
    seatNumber: integer("seat_number").notNull(), // 1..12
    score: real("score").notNull(),               // 0.6·HIVE + 0.4·sales_norm
    hiveScore: real("hive_score").notNull(),
    salesCount: integer("sales_count").notNull(),
    snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
  },
  (t) => ({
    seatUnique: uniqueIndex("roundtable_state_seat_uniq").on(t.seatNumber),
  }),
);
export const insertRoundtableStateSchema = createInsertSchema(roundtableState).omit({
  id: true, snapshotAt: true,
});
export type InsertRoundtableState = z.infer<typeof insertRoundtableStateSchema>;
export type RoundtableState = typeof roundtableState.$inferSelect;

// ── Bonsai onboarding progress (M9 / M14) ───────────────────────────
// One row per user; tracks 18-stage seller-onboarding walkthrough.
export const bonsaiProgress = pgTable("bonsai_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  currentStage: integer("current_stage").notNull().default(1), // 1..18
  completedStages: integer("completed_stages").array().notNull().default(sql`'{}'::int[]`),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertBonsaiProgressSchema = createInsertSchema(bonsaiProgress).omit({
  id: true, updatedAt: true,
});
export type InsertBonsaiProgress = z.infer<typeof insertBonsaiProgressSchema>;
export type BonsaiProgress = typeof bonsaiProgress.$inferSelect;
