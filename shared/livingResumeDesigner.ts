/**
 * LIVING RESUME DESIGNER — Shared Domain Model
 * SPARTAN-Certified MVP · Add-On for ARK HARNESS
 * Production ID: JNGL-PDD-ARKH-LRD-2026-001
 *
 * This module defines the canonical types, Zod schemas, and validation logic
 * for the Living Resume Designer feature. All LRD components (server routes,
 * client pages, storage layer) import from this module to ensure fidelity.
 */

import { z } from "zod";
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// ════════════════════════════════════════════════════════════════════════════
// ENUMS & CONSTANTS (LRD Vocabulary)
// ════════════════════════════════════════════════════════════════════════════

/** Theme palette options (LRD-101: Theme Picker) */
export const LRD_THEME_OPTIONS = ["navy_gold", "palette_2", "palette_3"] as const;
export type LrdTheme = typeof LRD_THEME_OPTIONS[number];

/** Export formats (LRD-105, LRD-405) */
export const LRD_EXPORT_FORMATS = ["html", "pdf"] as const;
export type LrdExportFormat = typeof LRD_EXPORT_FORMATS[number];

/** Certificate completion badges (LRD-402) */
export const LRD_CERTIFICATE_BADGES = ["DRAFT", "COMPLETE", "EXTENSIVE"] as const;
export type LrdCertificateBadge = typeof LRD_CERTIFICATE_BADGES[number];

/** Headshot crop types (LRD-106) */
export const LRD_CROP_TYPES = ["circular", "square", null] as const;
export type LrdCropType = typeof LRD_CROP_TYPES[number];

/** ARK import status (LRD-301) */
export const LRD_IMPORT_STATUSES = ["pending", "success", "failed"] as const;
export type LrdImportStatus = typeof LRD_IMPORT_STATUSES[number];

/** Telemetry event types (LRD-304) */
export const LRD_TELEMETRY_EVENTS = [
  "session_started",
  "field_completed",
  "tag_selected",
  "card_linked",
  "export_initiated",
  "export_completed",
] as const;
export type LrdTelemetryEvent = typeof LRD_TELEMETRY_EVENTS[number];

/** Project card schema (up to 8, LRD-102) */
export const lrdProjectCardSchema = z.object({
  id: z.string().optional(),  // client-side unique key
  name: z.string().min(1, "Project name required"),
  role: z.string().min(1, "Role required"),
  status: z.string().optional(),  // e.g., "shipped", "in progress"
  summary: z.string().min(1, "Summary required"),
  detail: z.string().optional(),  // longer description
  link: z.string().url().optional(),  // project link
});
export type LrdProjectCard = z.infer<typeof lrdProjectCardSchema>;

/** AI-native app showcase schema (up to 4, LRD-202) */
export const lrdAiNativeAppSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "App name required"),
  pitch: z.string().min(1, "One-line pitch required"),
  stack: z.string().optional(),  // e.g., "Claude + React + Supabase"
  link: z.string().url(),  // where to find the app
  testEmbed: z.string().optional(),  // optional in-page demo (srcdoc/base64)
  forgeVerified: z.boolean().default(false),  // requires Architect+ tier
});
export type LrdAiNativeApp = z.infer<typeof lrdAiNativeAppSchema>;

/** Main session wizard state (LRD-101) */
export const lrdWizardStateSchema = z.object({
  // Theme
  theme: z.enum(LRD_THEME_OPTIONS).default("navy_gold"),

  // Identity section
  fullName: z.string().optional(),
  currentRole: z.string().optional(),
  professionalSummary: z.string().optional(),

  // Contact section
  email: z.string().email().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional(),
  portfolioUrl: z.string().url().optional(),

  // Headshot (base64 data URL)
  headshotDataUrl: z.string().optional(),

  // Projects (up to 8 cards)
  projects: z.array(lrdProjectCardSchema).max(8).default([]),

  // Methodology tags
  methodologyTags: z.array(z.string()).default([]),

  // YouTube intro (click-to-load facade)
  youtubeUrl: z.string().url().optional(),

  // SPC Portfolio Panel (Domain 5 read)
  linkedSpcListingIds: z.array(z.string()).default([]),
  spcAutoSyncEnabled: z.boolean().default(false),

  // AI-native app showcase
  aiNativeApps: z.array(lrdAiNativeAppSchema).max(4).default([]),

  // ARK RESUME import (Domain 2 read)
  arkResumeImported: z.boolean().default(false),
  arkScoreSnapshot: z.number().int().min(0).max(600).optional(),

  // Completeness heuristic
  completenessPercent: z.number().int().min(0).max(100).default(0),
});
export type LrdWizardState = z.infer<typeof lrdWizardStateSchema>;

/** Honesty Gate validation result (LRD-404) */
export const lrdHonestyGateResultSchema = z.object({
  passed: z.boolean(),
  flags: z.array(
    z.object({
      severity: z.enum(["warning", "error"]),
      field: z.string(),
      message: z.string(),
    })
  ).default([]),
  checkedAt: z.date().optional(),
});
export type LrdHonestyGateResult = z.infer<typeof lrdHonestyGateResultSchema>;

/** Field provenance (source labeling, LRD-403) */
export const lrdFieldProvenanceSchema = z.object({
  fieldName: z.string(),
  source: z.enum(["user_entered", "ark_resume", "spc_listing", "calculated"]),
  sourceRecord: z.string().optional(),  // reference to the source (e.g., listing ID)
  verified: z.boolean().default(false),
});
export type LrdFieldProvenance = z.infer<typeof lrdFieldProvenanceSchema>;

/** Export request payload */
export const lrdExportRequestSchema = z.object({
  format: z.enum(LRD_EXPORT_FORMATS).default("html"),
  includeArkScore: z.boolean().default(true),
  includeSpcPanel: z.boolean().default(true),
  includeAiApps: z.boolean().default(true),
  includeYoutubeVideo: z.boolean().default(true),
});
export type LrdExportRequest = z.infer<typeof lrdExportRequestSchema>;

/** Export response (metadata only; the HTML/PDF is streamed) */
export const lrdExportResponseSchema = z.object({
  exportId: z.string(),
  format: z.enum(LRD_EXPORT_FORMATS),
  completenessPercent: z.number().int(),
  honestyGateResult: lrdHonestyGateResultSchema,
  certificateUrl: z.string().url().optional(),
  pdfUrl: z.string().url().optional(),
  downloadUrl: z.string().url(),
});
export type LrdExportResponse = z.infer<typeof lrdExportResponseSchema>;

// ════════════════════════════════════════════════════════════════════════════
// DATABASE TABLES (Drizzle ORM)
// ════════════════════════════════════════════════════════════════════════════

/** LRD-101: Main wizard session state */
export const livingResumeSessions = pgTable("living_resume_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  theme: varchar("theme", { enum: LRD_THEME_OPTIONS }).notNull().default("navy_gold"),

  // Identity
  fullName: text("full_name"),
  currentRole: text("current_role"),
  professionalSummary: text("professional_summary"),

  // Contact
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  portfolioUrl: text("portfolio_url"),

  // Headshot
  headshotDataUrl: text("headshot_data_url"),

  // Projects (JSONB array)
  projects: jsonb("projects").$type<LrdProjectCard[]>().notNull().default([]),

  // Methodology tags
  methodologyTags: text("methodology_tags").array().default([]),

  // YouTube intro
  youtubeUrl: text("youtube_url"),

  // SPC portfolio
  linkedSpcListingIds: text("linked_spc_listing_ids").array().default([]),
  spcAutoSyncEnabled: boolean("spc_auto_sync_enabled").notNull().default(false),

  // AI apps
  aiNativeApps: jsonb("ai_native_apps").$type<LrdAiNativeApp[]>().notNull().default([]),

  // ARK integration
  arkResumeImported: boolean("ark_resume_imported").notNull().default(false),
  arkScoreSnapshot: integer("ark_score_snapshot"),

  // Completeness
  completenessPercent: integer("completeness_pct").notNull().default(0),

  // Entitlement snapshot
  tierAtExport: varchar("tier_at_export"),

  // Honesty Gate audit
  lastHonestyCheck: jsonb("last_honesty_check").$type<LrdHonestyGateResult>(),
  lastHonestyCheckAt: timestamp("last_honesty_check_at"),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  exportedAt: timestamp("exported_at"),
}, (t) => ({
  userIdUnique: uniqueIndex("living_resume_sessions_user_id_uniq").on(t.userId),
  userIdIdx: index("living_resume_sessions_user_id_idx").on(t.userId),
  exportedAtIdx: index("living_resume_sessions_exported_at_idx").on(t.exportedAt),
}));
export const insertLivingResumeSessionSchema = createInsertSchema(livingResumeSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLivingResumeSession = z.infer<typeof insertLivingResumeSessionSchema>;
export type LivingResumeSession = typeof livingResumeSessions.$inferSelect;

/** LRD-105: Export history */
export const livingResumeExports = pgTable("living_resume_exports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  sessionId: varchar("session_id").notNull(),
  format: varchar("format", { enum: LRD_EXPORT_FORMATS }).notNull().default("html"),
  completenessPercent: integer("completeness_pct").notNull(),
  tierAtExport: varchar("tier_at_export"),
  spcPanelEnabled: boolean("spc_panel_enabled").notNull().default(false),
  aiAppShowcaseEnabled: boolean("ai_app_showcase_enabled").notNull().default(false),
  forgeVerifiedBadgesEnabled: boolean("forge_verified_badges_enabled").notNull().default(false),
  honestyGatePassed: boolean("honesty_gate_passed").notNull().default(true),
  honestyGateWarnings: text("honesty_gate_warnings").array(),
  telemetryEventId: varchar("telemetry_event_id"),
  exportedAt: timestamp("exported_at").notNull().defaultNow(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
}, (t) => ({
  userIdIdx: index("living_resume_exports_user_id_idx").on(t.userId),
  sessionIdIdx: index("living_resume_exports_session_id_idx").on(t.sessionId),
  exportedAtIdx: index("living_resume_exports_exported_at_idx").on(t.exportedAt),
}));
export const insertLivingResumeExportSchema = createInsertSchema(livingResumeExports).omit({
  id: true,
  exportedAt: true,
});
export type InsertLivingResumeExport = z.infer<typeof insertLivingResumeExportSchema>;
export type LivingResumeExport = typeof livingResumeExports.$inferSelect;

/** LRD-402: SPARTAN export certificate */
export const livingResumeCertificates = pgTable("living_resume_certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  exportId: varchar("export_id").notNull().unique(),
  userId: varchar("user_id").notNull(),
  sectionPopulated: text("sections_populated").array().notNull(),
  completenessHeuristic: integer("completeness_heuristic").notNull(),
  badge: varchar("badge", { enum: LRD_CERTIFICATE_BADGES }).notNull().default("DRAFT"),
  certificateJson: jsonb("certificate_json").notNull(),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
});
export const insertLivingResumeCertificateSchema = createInsertSchema(livingResumeCertificates).omit({
  id: true,
  issuedAt: true,
});
export type InsertLivingResumeCertificate = z.infer<typeof insertLivingResumeCertificateSchema>;
export type LivingResumeCertificate = typeof livingResumeCertificates.$inferSelect;

/** LRD-405: PDF export metadata */
export const livingResumePdfExports = pgTable("living_resume_pdf_exports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  exportId: varchar("export_id").notNull(),
  pageCount: integer("page_count"),
  fileSizeBytes: integer("file_size_bytes"),
  linksActive: boolean("links_active").notNull().default(true),
  primarySiteUrl: text("primary_site_url"),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});
export const insertLivingResumePdfExportSchema = createInsertSchema(livingResumePdfExports).omit({
  id: true,
  generatedAt: true,
});
export type InsertLivingResumePdfExport = z.infer<typeof insertLivingResumePdfExportSchema>;
export type LivingResumePdfExport = typeof livingResumePdfExports.$inferSelect;

/** LRD-106: Headshot management */
export const livingResumeHeadshots = pgTable("living_resume_headshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  sessionId: varchar("session_id").notNull(),
  originalFilename: text("original_filename").notNull(),
  originalMimeType: varchar("original_mime_type", { length: 64 }).notNull(),
  originalSizeBytes: integer("original_size_bytes").notNull(),
  base64DataUrl: text("base64_data_url").notNull(),
  cropType: varchar("crop_type", { enum: ["circular", "square"] }),
  altText: text("alt_text").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  usedInExports: text("used_in_exports").array(),
}, (t) => ({
  userIdIdx: index("living_resume_headshots_user_id_idx").on(t.userId),
}));
export const insertLivingResumeHeadshotSchema = createInsertSchema(livingResumeHeadshots).omit({
  id: true,
  uploadedAt: true,
});
export type InsertLivingResumeHeadshot = z.infer<typeof insertLivingResumeHeadshotSchema>;
export type LivingResumeHeadshot = typeof livingResumeHeadshots.$inferSelect;

/** LRD-301: ARK RESUME import bridge */
export const livingResumeArkImports = pgTable("living_resume_ark_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull().unique(),
  sessionId: varchar("session_id").notNull(),
  importedName: text("imported_name"),
  importedBio: text("imported_bio"),
  importedCurrentRole: text("imported_current_role"),
  importedCurrentEmployer: text("imported_current_employer"),
  arkScoreSnapshot: integer("ark_score_snapshot"),
  jstIndexSnapshot: integer("jst_index_snapshot"),
  importStatus: varchar("import_status", { enum: LRD_IMPORT_STATUSES }).notNull().default("pending"),
  importErrorMessage: text("import_error_message"),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  spcAutoSyncEnabled: boolean("spc_auto_sync_enabled").notNull().default(false),
  lastSpcSyncAt: timestamp("last_spc_sync_at"),
}, (t) => ({
  userIdIdx: index("living_resume_ark_imports_user_id_idx").on(t.userId),
}));
export const insertLivingResumeArkImportSchema = createInsertSchema(livingResumeArkImports).omit({
  id: true,
  importedAt: true,
});
export type InsertLivingResumeArkImport = z.infer<typeof insertLivingResumeArkImportSchema>;
export type LivingResumeArkImport = typeof livingResumeArkImports.$inferSelect;

/** LRD-303: Entitlement gate state */
export const livingResumeEntitlements = pgTable("living_resume_entitlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  sessionId: varchar("session_id").notNull(),
  tierAtSessionCreation: varchar("tier_at_session_creation").notNull(),
  canUseSpcPanel: boolean("can_use_spc_panel").notNull().default(false),
  canUseAiAppShowcase: boolean("can_use_ai_app_showcase").notNull().default(false),
  canUseYoutubeIntro: boolean("can_use_youtube_intro").notNull().default(false),
  canUseForgeVerifiedBadges: boolean("can_use_forge_verified_badges").notNull().default(false),
  canUsePdfExport: boolean("can_use_pdf_export").notNull().default(false),
  checkedAt: timestamp("checked_at").notNull().defaultNow(),
});
export const insertLivingResumeEntitlementSchema = createInsertSchema(livingResumeEntitlements).omit({
  id: true,
  checkedAt: true,
});
export type InsertLivingResumeEntitlement = z.infer<typeof insertLivingResumeEntitlementSchema>;
export type LivingResumeEntitlement = typeof livingResumeEntitlements.$inferSelect;

/** LRD-304: Command Deck telemetry */
export const livingResumeTelemetry = pgTable("living_resume_telemetry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  sessionId: varchar("session_id").notNull(),
  exportId: varchar("export_id"),
  eventType: varchar("event_type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  consentGiven: boolean("consent_given").notNull().default(true),
  loggedAt: timestamp("logged_at").notNull().defaultNow(),
}, (t) => ({
  userIdIdx: index("living_resume_telemetry_user_id_idx").on(t.userId),
  sessionIdIdx: index("living_resume_telemetry_session_id_idx").on(t.sessionId),
  eventTypeIdx: index("living_resume_telemetry_event_type_idx").on(t.eventType),
}));
export const insertLivingResumeTelemetrySchema = createInsertSchema(livingResumeTelemetry).omit({
  id: true,
  loggedAt: true,
});
export type InsertLivingResumeTelemetry = z.infer<typeof insertLivingResumeTelemetrySchema>;
export type LivingResumeTelemetry = typeof livingResumeTelemetry.$inferSelect;

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Compute completeness heuristic (0-100) based on populated sections.
 * Used by LRD-402 certificate generation and the live preview.
 */
export function computeCompletenessHeuristic(state: LrdWizardState): number {
  let score = 0;
  const weights = {
    identity: 20,      // name + role + bio
    contact: 15,       // email + links
    projects: 25,      // at least 2-3 projects
    methodology: 10,   // tags selected
    spc: 15,          // SPC cards linked
    apps: 10,         // AI apps listed
    youtube: 5,       // video intro
  };

  if (state.fullName && state.currentRole && state.professionalSummary) {
    score += weights.identity;
  }
  if (state.email && (state.linkedinUrl || state.githubUrl || state.portfolioUrl)) {
    score += weights.contact;
  }
  if (state.projects.length >= 2) {
    score += weights.projects;
  }
  if (state.methodologyTags.length > 0) {
    score += weights.methodology;
  }
  if (state.linkedSpcListingIds.length > 0) {
    score += weights.spc;
  }
  if (state.aiNativeApps.length > 0) {
    score += weights.apps;
  }
  if (state.youtubeUrl) {
    score += weights.youtube;
  }

  return Math.min(100, score);
}

/**
 * Validate wizard state against Honesty Gate (LRD-404).
 * Flags missing or unverified data before export.
 */
export function validateHonestyGate(state: LrdWizardState): LrdHonestyGateResult {
  const flags: LrdHonestyGateResult["flags"] = [];

  // Required identity fields
  if (!state.fullName) {
    flags.push({ severity: "error", field: "fullName", message: "Full name is required" });
  }
  if (!state.email) {
    flags.push({ severity: "error", field: "email", message: "Email is required" });
  }

  // Project validation
  state.projects.forEach((project, i) => {
    if (!project.summary) {
      flags.push({
        severity: "warning",
        field: `projects[${i}].summary`,
        message: `Project "${project.name}" is missing a summary`,
      });
    }
    if (!project.link) {
      flags.push({
        severity: "warning",
        field: `projects[${i}].link`,
        message: `Project "${project.name}" is missing a link`,
      });
    }
  });

  // ARK Score badge check (if enabled)
  if (!state.arkScoreSnapshot) {
    flags.push({
      severity: "warning",
      field: "arkScore",
      message: "ARK Score not available; badge will not be shown",
    });
  }

  const passed = flags.filter((f) => f.severity === "error").length === 0;

  return {
    passed,
    flags,
    checkedAt: new Date(),
  };
}

/**
 * Tier-based entitlements (cumulative model, mirroring Domain 1).
 */
export function getEntitlementsByTier(tier: string): Omit<LivingResumeEntitlement, 'id' | 'userId' | 'sessionId' | 'checkedAt'> {
  const defaults = {
    canUseSpcPanel: false,
    canUseAiAppShowcase: false,
    canUseYoutubeIntro: false,
    canUseForgeVerifiedBadges: false,
    canUsePdfExport: true,  // Explorer gets PDF
  };

  const tiers: Record<string, Partial<typeof defaults>> = {
    INDIVIDUAL_EXPLORER: {
      ...defaults,
      canUsePdfExport: true,
    },
    INDIVIDUAL_PRO: {
      ...defaults,
      canUseSpcPanel: true,
      canUseAiAppShowcase: true,
      canUseYoutubeIntro: true,
      canUsePdfExport: true,
    },
    INDIVIDUAL_ARCHITECT: {
      canUseSpcPanel: true,
      canUseAiAppShowcase: true,
      canUseYoutubeIntro: true,
      canUseForgeVerifiedBadges: true,
      canUsePdfExport: true,
    },
    SCHOOL_STUDENT: {
      canUseSpcPanel: true,
      canUseAiAppShowcase: true,
      canUseYoutubeIntro: true,
      canUseForgeVerifiedBadges: true,
      canUsePdfExport: true,
    },
    ENTERPRISE: {
      canUseSpcPanel: true,
      canUseAiAppShowcase: true,
      canUseYoutubeIntro: true,
      canUseForgeVerifiedBadges: true,
      canUsePdfExport: true,
    },
  };

  return {
    tierAtSessionCreation: tier,
    ...defaults,
    ...tiers[tier],
  };
}
