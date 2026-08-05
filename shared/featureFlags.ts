/**
 * Feature flags — single source of truth for which surfaces are live.
 *
 * Stage 1 / MVP scope (per exports/ARK_PDD_MVP_Spartan.md):
 *   - ON  : the 7 CLASS A surfaces (Identity, Resume Analyzer, CCGE Arena,
 *           SPHINX MVP, Bonsai onboarding, Billing FREE+PRO, GDPR) PLUS every
 *           CLASS C surface — all deferred modules have been activated.
 *   - OFF : none. (Flip any flag OFF via env if a trigger needs to be gated
 *           again; see Part 4 of the MVP PDD for trigger families.)
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
  | "arkResume" // /ark-resume ATS resume artifact + confirmations + headshot
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
  | "cardVerification" // /api/verification/* + VERIFY button + per-card badge
  // ── Suggested Training Providers (freemium · Explorer tier) — JST-matched
  //    provider directory + self-serve registration + sponsored/affiliate
  //    revenue. Launched live as an Explorer-tier freemium feature. ──
  | "trainingProviders" // /training + /api/training/* + provider portal
  // ── F1000 (First 1000) soft-launch promo — QR-driven invite codes (1..1000)
  //    granting EXPLORER free + capped PRO $10 / SCHOOL $9 upgrade pricing.
  //    Launched ON for go-live; flip OFF once the 1000 codes are exhausted. ──
  | "f1000Promo" // /f1000 + /api/f1000/* + landing QR offer
  // ── ARK Matchmaking Engine — the Cognitive Talent Exchange. Matches people
  //    to jobs/projects and assembles project teams scored PURELY on VERIFIED
  //    PRIMITIVE CARDS (+ JST + archetype). Launched ON. ──
  | "matchmaking" // /matchmaking + /api/matchmaking/* + opportunity posting
  // ── Living Resume Designer (JNGL-PDD-ARKH-LRD-2026-001) — self-service
  //    shareable resume builder, additive to ARK RESUME. Launched ON. ──
  | "livingResumeDesigner"; // /living-resume-designer + /api/living-resume/*

/**
 * MVP defaults. Editing this constant is the canonical way to flip a
 * client-visible flag. As deferred CLASS C trigger families fire, modules are
 * promoted here from OFF → ON.
 *
 * All flags are now ON. The two former stubs are finished: `enterpriseDashboard`
 * (/enterprise now renders real aggregated workforce intelligence, reusing the
 * same `getWorkforceIntelligence` aggregation as `institutionWorkforce`) and
 * `assessmentEmail` (POST /api/notifications/assessment-summary now sends a real
 * email via the shared Gmail transport to the user's own account address).
 */
export const MVP_FEATURES: Readonly<Record<FeatureKey, boolean>> = Object.freeze({
  sphinxAdvanced: true,
  guinPublic: true,
  notifications: true,
  claudeNarrative: true,
  executiveReport: true,
  arkResume: true,
  subscriptionCancel: true,
  assessmentEmail: true,
  cohorts: true,
  enterpriseDashboard: true,
  institutionWorkforce: true,
  corporateMarketplace: true,
  investorDemo: true,
  forgeLabDocx: true,
  drm: true,
  customScenarios: true,
  adminCcgeImport: true,
  contextCraftPage: true,
  revenueGuardrail: true,
  bookCompanion: true,
  cardVerification: true,
  trainingProviders: true,
  f1000Promo: true,
  matchmaking: true,
  livingResumeDesigner: true,
});

/**
 * `FEATURES` is the static, build-time view of the flag map used by the client.
 * The server overlays env vars on top of this map; see `server/featureFlags.ts`.
 */
export const FEATURES = MVP_FEATURES;

/** Stage label surfaced in /api/features and (optionally) in the UI footer. */
export const STAGE = "Stage 1 · MVP" as const;
