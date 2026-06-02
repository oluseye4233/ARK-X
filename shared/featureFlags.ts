/**
 * Feature flags — single source of truth for which surfaces are live.
 *
 * Stage 1 / MVP scope (per exports/ARK_PDD_MVP_Spartan.md):
 *   - ON  : the 7 CLASS A surfaces — Identity, Resume Analyzer, CCGE Arena,
 *           SPHINX MVP (browse + publish-paste + purchase), Bonsai onboarding,
 *           Billing FREE+PRO, GDPR.
 *   - OFF : all CLASS C surfaces — flip via env when their trigger fires
 *           (see Part 4 of the MVP PDD for trigger families).
 *
 * Server-side: read via `isFeatureEnabled(key)` from `server/featureFlags.ts`.
 *              Gate routes with the `requireFeature(key)` middleware — flagged
 *              routes return 404 (not 403) so they're indistinguishable from
 *              unimplemented endpoints.
 *
 * Client-side: import `FEATURES` directly. Hide nav items and gate routes;
 *              flagged routes should render the 404 page so the URL behaves
 *              exactly like the server thinks it does.
 *
 * Override mechanism (server only): set env `FEATURE_<key>=true|false` to
 * flip without a redeploy (e.g. `FEATURE_COHORTS=true`). The client reads the
 * static defaults below at build time — flip a client-visible flag by editing
 * this file and rebuilding.
 */

export type FeatureKey =
  // ── Network-effects gated (trigger: ≥100 listings / ≥25 creators) ──
  | "sphinxAdvanced" // synergies, pairs, roundtable, synthesis, complementary
  | "guinPublic" // public /u/:slug profile, endorsements, knight ranks
  | "notifications" // notification bell + stream + read state
  // ── PRO / paid features (trigger: PRO billing live) ──
  | "claudeNarrative" // Sonnet narrative endpoint + dashboard button
  | "executiveReport" // /report PDF export
  | "subscriptionCancel" // billing cancel flow + dunning
  | "assessmentEmail" // POST /api/notifications/assessment-summary
  // ── School / Enterprise SKU (trigger: first SCHOOL_STUDENT licence) ──
  | "cohorts" // /school page + all /api/cohorts/* + /api/me/cohorts
  | "enterpriseDashboard" // /enterprise page + /api/departments
  | "institutionWorkforce" // /workforce page + HR-connector import + workforce intelligence (institution/ENTERPRISE admins)
  | "corporateMarketplace" // /marketplace/corporate page + corporate-scoped listings + star feedback
  // ── Investor / pre-Series A (trigger: first investor meeting) ──
  | "investorDemo" // /demo + /demo-tour public personas
  // ── Marketplace .docx ingest (trigger: 100+ Forge Lab requests) ──
  | "forgeLabDocx" // .docx upload path (paste-text remains MVP)
  // ── Ops / admin tooling (trigger: support load / scale) ──
  | "drm" // DRM event ingest + violators
  | "customScenarios" // admin scenario gen + user custom CCGE scenarios
  | "adminCcgeImport" // admin compendium bulk import UI + route
  // ── SEO / reference (trigger: post-launch SEO push) ──
  | "contextCraftPage" // /context-craft levels reference page
  // ── Phase O — Revenue / Token-Cost 10% Invariant (trigger: first $1k MRR
  //    OR first user crossing 80% of any cost cap) ──
  | "revenueGuardrail" // cost-cap second gate + model policy + V2 budgets
  // ── Book Companion (Task #22) — reader onboarding journey (trigger: book
  //    launch / first reader cohort) ──
  | "bookCompanion" // /book journey + /b/:slug QR resolver + chapter badges + Ledger
  // ── Primitive Card Verification (Task #55) — subscribers verify the CODEC
  //    primitives on their assessment via a Context-Craft Verification Quest
  //    (trigger: first paid subscriber cohort / verification GA) ──
  | "cardVerification"; // /api/verification/* + VERIFY button + per-card badge

/**
 * MVP defaults — every CLASS C surface is OFF.
 * Editing this constant is the canonical way to flip a client-visible flag.
 */
export const MVP_FEATURES: Readonly<Record<FeatureKey, boolean>> = Object.freeze({
  sphinxAdvanced: false,
  guinPublic: false,
  notifications: false,
  claudeNarrative: false,
  executiveReport: true,
  subscriptionCancel: false,
  assessmentEmail: false,
  cohorts: false,
  enterpriseDashboard: false,
  institutionWorkforce: false,
  corporateMarketplace: false,
  investorDemo: true,
  forgeLabDocx: false,
  drm: false,
  customScenarios: false,
  adminCcgeImport: false,
  contextCraftPage: false,
  revenueGuardrail: false,
  bookCompanion: false,
  cardVerification: true,
});

/**
 * `FEATURES` is the static, build-time view of the flag map used by the client.
 * The server overlays env vars on top of this map; see `server/featureFlags.ts`.
 */
export const FEATURES = MVP_FEATURES;

/** Stage label surfaced in /api/features and (optionally) in the UI footer. */
export const STAGE = "Stage 1 · MVP" as const;
