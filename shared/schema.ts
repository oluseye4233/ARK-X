import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const CONTEXT_CRAFT_LEVELS = {
  NONE: { key: "NONE", label: "No Certification", multiplier: 0.5, color: "#FF4444" },
  CC_100: { key: "CC_100", label: "CC-100 Foundational", multiplier: 1.0, color: "#FFA500" },
  CC_200: { key: "CC_200", label: "CC-200 Practitioner", multiplier: 1.1, color: "#FFDD00" },
  CC_300: { key: "CC_300", label: "CC-300 Specialist", multiplier: 1.2, color: "#4488FF" },
  CC_400: { key: "CC_400", label: "CC-400 Expert", multiplier: 1.35, color: "#44AA44" },
  CC_500: { key: "CC_500", label: "CC-500 Master Architect", multiplier: 1.5, color: "#AA44FF" },
} as const;

export type ContextCraftLevel = keyof typeof CONTEXT_CRAFT_LEVELS;

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
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
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