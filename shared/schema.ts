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

// JCSE thresholds (session score, 0-50) → cert tier
export const KCSE_TIER_THRESHOLDS = {
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
  if (jcse >= KCSE_TIER_THRESHOLDS.PLATINUM) return "CC_500";
  if (jcse >= KCSE_TIER_THRESHOLDS.GOLD) return "CC_400";
  if (jcse >= KCSE_TIER_THRESHOLDS.SILVER) return "CC_300";
  if (jcse >= KCSE_TIER_THRESHOLDS.BRONZE) return "CC_200";
  return "NONE";
}

export function jcseToTier(jcse: number): CcgeTier | null {
  if (jcse >= KCSE_TIER_THRESHOLDS.PLATINUM) return "Platinum";
  if (jcse >= KCSE_TIER_THRESHOLDS.GOLD) return "Gold";
  if (jcse >= KCSE_TIER_THRESHOLDS.SILVER) return "Silver";
  if (jcse >= KCSE_TIER_THRESHOLDS.BRONZE) return "Bronze";
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

// ── SPHINX Marketplace constants ───────────────────────────
export const SPC_CREATOR_SHARE_PCT = 70;
export const SPC_PLATFORM_SHARE_PCT = 30;
export const SPC_STARTING_CREDITS = 100;
export const SPC_MIN_CERT_TO_PUBLISH: ContextCraftLevel = "CC_400";
export const SPC_PRICE_MIN = 5;
export const SPC_PRICE_MAX = 500;
export const SPC_HIVE_MIN_TO_PUBLISH = 60;
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
  institution: text("institution"),
  uploadsThisMonth: integer("uploads_this_month").default(0),
  uploadResetDate: timestamp("upload_reset_date"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  institution: true,
  uploadsThisMonth: true,
  uploadResetDate: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
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
});

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
export type SpcListing = typeof spcListings.$inferSelect;

export const spcPurchases = pgTable("spc_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buyerId: varchar("buyer_id").notNull(),
  listingId: varchar("listing_id").notNull(),
  creatorId: varchar("creator_id").notNull(),
  priceCredits: integer("price_credits").notNull(),
  creatorShare: integer("creator_share").notNull(),
  platformShare: integer("platform_share").notNull(),
  isFirstSaleForCreator: boolean("is_first_sale_for_creator").notNull().default(false),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
});

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
  let current = KNIGHT_RANKS[0];
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

export type HivePrecheck = {
  hiveScore: number;
  kcseScore: number;
  passes: boolean;
  reasons: string[];
  warnings: string[];
};
