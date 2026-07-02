# ARK Platform — Changelog

Historical record of completed phases. Current architecture lives in `replit.md`.
Phases are listed newest-first; each entry preserves the original spec at completion.

---

## Stage 1 — Flag Activation Detail (Jun–Jul 2026)

Full implementation notes for the flag families that went live during Stage 1. Summary lives in `replit.md → Stage 1`; this preserves the detailed per-flag descriptions.

### Core seven (promoted individually)

**`investorDemo`** — the public, no-auth `/demo` (Sarah Chen persona) + `/demo-tour` (6-step guided walkthrough) marketing surfaces. The home page CTAs link straight to `/demo-tour`, so this flag must stay on for those buttons to resolve.

**`executiveReport`** — the one-page **ARK REPORT** (`/report`): ATANDA-branded executive summary of the full ARK assessment (ARK/JST/CCMI/LHCS/vulnerability/archetype/12-vector radar), each metric with a plain-language one-liner; exports to PDF + PNG + JPEG via html2canvas/jsPDF. Pro+ gated via `useSubscription().canAccessReport`. Dashboard surfaces a `/report` CTA when this flag is on.

**`cardVerification`** — the **Primitive Card Verification** surface: subscribers verify the CODEC primitives on their latest assessment (evidence-gated to `matchedCardIds`) via a Context-Craft Verification Quest (author one prompt per O*NET/SFIA/WEF standard → score 0-100 → tier Bronze60/Silver70/Gold80/Platinum90 → per-card badge). Verification JST is weighted heavier than CCGE (ARK deltas 6/12/20/30 vs 2/4/6/9), daily cap +40 ARK. Routes `/api/verification/*`; client VERIFY footer + quest modal in `JnomicsCardList`.
- **DATA-pillar evidence**: subscribers attach supporting documents/certifications under each primitive (base64 data URL in `verification_documents`, mirrors the headshot pattern; PDF/PNG/JPEG/WebP, capped under the 1MB body limit; `migrations/0021_verification_documents.sql`). Uploading ≥1 doc SATISFIES the **Data** pillar (one of the 7 Context-Craft pillars) for that card: the deterministic craft scorer counts "Data" as covered (`evaluateCustomCard(..., forcedPillars=["Data"])` via `scoreVerificationPrompt(..., dataPillarSatisfied)`) and pushes a "Data grounded by evidence" signal, lifting the verification score. Doc routes `GET`/`POST /api/verification/:cardId/documents` + `DELETE /api/verification/documents/:id` — all `requireFeature("cardVerification")` + `requireAuth`, evidence-gated to `matchedCardIds`, owner-scoped. CCGE scoring is unchanged (forcedPillars defaults to none).
- **Name-Job-Role guide**: in the quest the author can name the job role they're writing for (e.g. "Project Manager") to pull a standards reference that steers their 7-pillar prompt — O*NET matching occupations/codes, SFIA typical level(s) of control (autonomy/influence), and WEF Future-of-Jobs outlook (ASCENDING/DECLINING/STABLE). AI-generated (Claude Haiku) in `server/ai/jobRoleGuide.ts`, cached GLOBALLY by normalized role (30-day TTL) so repeat lookups are near-zero cost; deterministic clamp/validate on the JSON; throws `{status:503}` when Claude is unavailable. Route `GET /api/verification/job-role-guide?role=` (`requireFeature("cardVerification")` + `requireAuth`, role 2-80 chars). Reference-only — NOT part of the verification score.

**`arkResume`** — the single-page, ATS-optimized **ARK RESUME** (`/ark-resume`): the shareable counterpart to ARK REPORT that fuses the lifted static resume (name, contact, links, multi-company work history, education, certs — extracted in `server/profileExtract.ts`) with a "living" verified layer (CODEC/Primitive Cards mapped to O*NET/SFIA/WEF, tiers Bronze→Platinum) plus a third-party **confirmation** layer (Confirmed/Pending/Rejected/Unverified badges per employment/skill/credential). Cards render BOTH as a global "Verified Skills & Roles" deck AND best-effort AI-mapped per company (Claude with keyword fallback in `server/arkResume.ts::aiMapCardsToCompanies`/`keywordMapCardsToCompanies`). JST sits prominently top-right. Includes an **ATS score 0-100** with a per-section breakdown (contact/links, work-history structure, quantified impact, education, certifications, verified-skill keywords). **Eligibility gate**: subscriber must be Pro+ AND hold ≥1 Primitive Card verified at **Silver+** (`checkResumeEligibility`); ineligible users get a locked state. PDF export uses **selectable jsPDF text APIs** (NOT html2canvas) so the resume is machine-readable; PNG/JPEG fall back to html2canvas (`client/src/lib/arkResumeExport.ts`). Routes `GET /api/ark-resume`, `POST`/`DELETE /api/ark-resume/headshot`, `GET`/`POST /api/confirmations`. Dashboard surfaces an `/ark-resume` CTA when this flag is on.

**`matchmaking`** — the **ARK Talent Exchange** (`/matchmaking` + `/matchmaking/:id`): the "Cognitive Talent Exchange" that matches people to opportunities (JOB/PROJECT) and assembles project teams scored PURELY on banked verifications (`card_verifications`) + JST evidence + archetype fit — never resume keywords or self-claims. Pure engine in `server/matchmaking.ts` (unit-tested via `npm run test:matchmaking`): `scoreUserForOpportunity` (coverage·.7 + jstFactor·.2 + archetypeFit·.1; under-tier verifications get 0.5 partial credit; `projectedMatchScore` shows upside of closing gaps), `skillGapForOpportunity` (Layer 4-lite "what to verify next" → CCGE/verify CTAs), `assembleTeam` (greedy one-person-per-role → **TXS** = skillCoverage·.6 + archetypeDiversity·.25 + jstDepth·.15). Tables `opportunities` / `opportunity_requirements` / `opportunity_applications` (`migrations/0020_matchmaking.sql`). Routes `GET /api/matchmaking/opportunities`, `/my-matches`, `/my-applications`, `GET`/`POST /api/matchmaking/opportunities/:id` (detail returns team formation for PROJECTs), `POST /api/matchmaking/opportunities`, `POST /api/matchmaking/opportunities/:id/apply` — all gated `requireFeature("matchmaking")` BEFORE `requireAuth`. "Match" nav group in `AppLayout`. Deferred follow-ups: Layer 3 (AI-agent matching), Layer 5 (startup formation).

### Deferred-module activation (15 flag flips)

The following 15 fully-built CLASS C modules went live (flag flip only — routes, storage, and UI already existed): `cohorts` (instructor cohort manager + student view, `/school`), `guinPublic` (public GUIN+ profiles, `/u/:username`), `notifications` (bell + SSE stream), `claudeNarrative` (Pro+ AI resume narrative), `subscriptionCancel` (self-serve cancel in billing), `institutionWorkforce` (ENTERPRISE-admin Workforce Intelligence + HR connectors, `/workforce`, live aggregation via `storage.getWorkforceIntelligence`), `corporateMarketplace` (institution-scoped SPHINX corporate listings + feedback), `forgeLabDocx` (DOCX export), `drm` (content protection), `customScenarios` (author custom CCGE scenarios), `adminCcgeImport` (admin CCGE bulk import), `contextCraftPage` (`/context-craft`), `revenueGuardrail` (two-gate AI budget: token cap AND dollar cost cap + model policy), `bookCompanion` (book companion surface), `sphinxAdvanced` (advanced SPHINX tooling). Institution surfaces are seeded via `POST /api/seed` (demo `analyst@enterprise.com` → ENTERPRISE admin of "Vance Industries" with an 8-row staff roster; `instructor@academy.edu` → cohort).

### Two former stubs completed

**`enterpriseDashboard`** — the `/enterprise` Workforce Intelligence overview renders **real aggregated data** (headcount, avg JST, avg vulnerability, critical-risk units, a vulnerability-strata pie by headcount, a per-department JST bar chart with an org-average reference line, and a department automation-exposure heatmap). It **reuses the same `storage.getWorkforceIntelligence` aggregation** as `institutionWorkforce` via `GET /api/enterprise/intelligence` (`requireFeature("enterpriseDashboard")` + `requireAuth` + `requireInstitutionAdmin`, org derived from session). Non-admins get a graceful restricted state; empty rosters get an empty state. The legacy `/api/departments` route remains but is no longer used by the page. Subsequently extended with AND-stacked dimension filters (tenure band, location), bounded department drill-down (top-25 default, 100-row cap, search + offset paging), org-wide staff search, and the upskill nudge (in-app SSE notification + best-effort email, 7-day cooldown, truthful delivery status; `migrations/0022_staff_nudge.sql`).

**`assessmentEmail`** — `POST /api/notifications/assessment-summary` **sends a real plain-text summary email** via the shared Gmail transport (`server/mail.ts`), reusing the `deliverConfirmationInvite` send/fallback pattern (`server/assessmentSummaryEmail.ts`: `buildAssessmentSummaryEmail` + `deliverAssessmentSummary`, never throws). The recipient is **always the authenticated user's own account email** (never a client-supplied address — no open-relay), the body carries only derived scores (JST/Jobs/Skills/Talent, readiness profile, vulnerability band — no secrets or raw resume text), and delivery failures surface a truthful **502** with a human-readable message instead of a fake success.

Phase J implementation code is preserved verbatim — no deletion.

---

## Phase G — Institutional Tier Hardening (May 2026)

Real cohorts, instructor role, scenario assignments with due dates, CSV bulk import, graded CSV export, cohort comparison.

- **Schema** (`shared/schema.ts`): `USER_ROLES = ["student","instructor","admin"]` + `isInstructor(role)` helper; three new tables — `cohorts` (instructorId/institution/name/description), `cohortMemberships` (cohortId/userId/status∈active|invited|removed/invitedEmail) with unique (cohort_id,user_id) index, `cohortAssignments` (cohortId/scenarioId/assignedBy/dueAt/note).
- **Migration**: `migrations/0002_phase_g_cohorts.sql` (idempotent CREATE TABLE/INDEX IF NOT EXISTS) — applied to live DB via psql since drizzle-kit push needs a TTY.
- **Authz** (`server/auth.ts`): `requireInstructor` middleware reads `users.role` and 403s anyone not `instructor`/`admin`. **`PUT /api/users/:id/profile` no longer accepts `role`** — role is privilege-bearing and changes only through admin/seed paths. Verified: a logged-in analyst sending `{"role":"instructor"}` is silently dropped and cohort routes still 403.
- **Routes** (`server/routes.ts`): all under `requireInstructor` + per-cohort `assertCohortOwnership` re-check:
  - `GET/POST /api/cohorts`, `GET /api/cohorts/:id` (cohort+members+assignments), `POST/DELETE /api/cohorts/:id/members[/userId]`, `GET/POST /api/cohorts/:id/assignments`, `GET /api/cohorts/:id/grades` (JSON) + `/grades.csv` (RFC4180-ish escaping, attachment), `GET /api/cohorts/comparison` (registered BEFORE `:id` to avoid path shadowing).
  - `POST /api/cohorts/:id/assignments` validates that `scenarioId` exists (404 on unknown) so gradebook joins never orphan.
  - Bulk-import: `POST /api/cohorts/:id/members` takes `{emails: string[]}` (Zod `.email()`, max 500). Unregistered emails become placeholder memberships keyed on `invite:<email>` so the unique index still works.
  - Student-facing `GET /api/me/cohorts` (requireAuth).
- **Invite reconciliation** (`server/storage.ts::reconcileCohortInvitesForUser`): called from both `/api/auth/login` and `/api/auth/register` in a transaction — converts every `invite:<email>` placeholder for the user's email into a real `userId`-keyed active membership, dropping conflicts when the user is already a member.
- **Frontend** (`client/src/pages/school-dashboard.tsx`): mock data removed. Instructor view renders cohort selector, comparison bar chart (avg JST/CCMI/ARK per cohort), and a tabbed manager (Roster · Assignments · Import · Grades) with inline cohort creation and CSV download link. Student view lists cohorts via `/api/me/cohorts`. `client/src/lib/api.ts` adds the cohort client methods (`getCohorts`, `createCohort`, `getCohort`, `addCohortMembers`, `removeCohortMember`, `createCohortAssignment`, `getCohortGrades`, `getCohortComparison`, `cohortGradesCsvUrl`, `getMyCohorts`).
- **Seed**: `instructor@academy.edu` / `arkplatform` (role=`instructor`, plan=SCHOOL_STUDENT) + cohort "Fall 2026 — Prompt Architecture 101" + 12 students with realistic JST/CCMI/ARK spread + 2 assignments (one past-due Bronze, one upcoming Silver).

---

## Phase J — PDD MVP Alignment (May 2026)

ARK ONECRAFT implements the Product Definition Document §3.4 scoring spec end-to-end. Current canon — full active notes live in `replit.md`.

- **Core score model:** ARK = JST (0-300) + CCMI (0-300) → 0-600.
  - JST formula: `((J×0.30 + S×0.40 + T×0.30) × 3)` from resume sub-scores.
  - CCMI formula: `((P1×0.18 + P2×0.14 + P3×0.18 + P4×0.12 + P5×0.10 + P6×0.10 + P7×0.18) × 3)` from 7 prompt-craft pillars.
  - Tiers: Foundation / Developing / Capable / Strong / Exceptional / Legendary. CCMI bands T0-T5 with multipliers 1.00-1.35. VMST levels L0-L4.
- **Schema additions:** 12 identity columns on `users` (arkScore, jstIndex, ccmi, ccmiTier, vmstLevel, typology, arkIdString, cprScore, mpsScore, lcisScore, lhcsStatus, resumeReplacementPct) + 3 new tables: `ccmi_pillar_scores`, `ark_score_history`, `lhcs_signals`.
- **New server modules:**
  - `server/scoringEngine.ts` — pure JST/CCMI/ARK math + ARK-ID hash.
  - `server/ccmiDerivation.ts` — derives 7-pillar vector from resume signals + cert level.
  - `server/lhcs.ts` — Live Human Career Signal (CPR/MPS/LCIS lights).
  - `server/flywheelCta.ts` — 10-branch decision tree for the next-best-move CTA.
  - `server/arkRecalc.ts` — single recalc entry point with daily/30d caps (CCGE +15/day, SPHINX +20/30d) and atomic persistence.
  - `server/arkBackfill.ts` — migration backfill for existing users.
  - `server/ai/identity.ts` — 3-stage Claude narrative pipeline with deterministic fallback.
- **New API endpoints:** `GET /api/ark/identity`, `POST /api/ark/recalc`, `GET /api/ark/flywheel-cta`, `GET /api/ark/history?days=N`, `GET /api/ark/lhcs`, `POST /api/admin/ark/backfill`. The `/api/ark-score/stream` SSE channel also emits `ark.identity` events.
- **Orchestrator wiring:** every `assessment.completed`, `game.session.finished`, `cert.upgraded`, `spc.published`, and `spc.purchased` event triggers `recalcArkForUser(...)` post-write. Caps bypass for assessment/cert events.
- **New client surfaces:**
  - `client/src/components/dashboard/ArkIdentityCard.tsx` — top-of-dashboard ARK score + ARK-ID string.
  - `client/src/components/dashboard/LhcsSignal.tsx` — 3-light readiness signal.
  - `client/src/components/dashboard/CcmiPillars.tsx` — 7-pillar radar.
  - `client/src/components/dashboard/FlywheelCard.tsx` — next highest-leverage move CTA.
  - `client/src/pages/ark-history.tsx` — `/ark/history` route with 30/90/180/365-day score-trajectory area chart and event log.

---

## Phase I — Launch Readiness

- **Security headers**: `helmet()` in `server/index.ts` — production CSP, HSTS, X-Frame-Options SAMEORIGIN, COOP/CORP, no-referrer. Verified in response headers.
- **Body limits**: `express.json({ limit: "1mb" })` and urlencoded matching to mitigate payload-bomb DoS.
- **Rate limiting** (`express-rate-limit`):
  - `apiLimiter` — 240 req/min per IP, applied globally to `/api`. Emits `RateLimit-*` headers.
  - `authLimiter` — 20 req/15min per IP, scoped to `/api/auth/login` + `/register`, `skipSuccessfulRequests: true`. 429 on the 21st failed attempt (verified).
- **GDPR / CCPA endpoints** (`server/routes.ts`):
  - `GET /api/users/me/export` — streams full JSON dump of every user-scoped row across 16 tables. `Content-Disposition: attachment`.
  - `DELETE /api/users/me` — requires JSON body `{ "confirm": "DELETE" }`; runs `storage.deleteUserCascade(userId)` inside a `db.transaction` with `FOR UPDATE` lock, cascades through 13 dependent tables in FK-safe order, then destroys the express session and clears the `ark.sid` cookie.
  - Both protected by `requireAuth`; CSRF deemed unnecessary (sameSite=lax cookies + same-origin SPA + auth limiter).
- **Frontend**:
  - `client/src/components/ErrorBoundary.tsx` wraps `<App>` — catches render-time crashes with a recoverable on-brand fallback.
  - `client/src/pages/not-found.tsx` — on-brand 404.
  - `client/src/pages/legal/privacy.tsx` + `terms.tsx` — substantive policy text covering collection, processing, retention, GDPR rights, contact. Routes `/privacy`, `/terms` registered in `App.tsx`. Footer links in `AppLayout.tsx`.
  - `DataPrivacySection` in `client/src/pages/profile.tsx` — "Download JSON Export" button + "Permanently Delete Account" flow with `DELETE` typed-confirmation gate, redirects to `/login` on success.

---

## Phase F — Claude AI Hardening

- **Integration**: `javascript_anthropic_ai_integrations` blueprint — credentials auto-provisioned via `AI_INTEGRATIONS_ANTHROPIC_API_KEY` + `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, billed to user's Replit credits. No own API key.
- **Models** (`server/ai/client.ts`): `MODELS.HAIKU = "claude-haiku-4-5"` (KCSE), `MODELS.SONNET = "claude-sonnet-4-6"` (narrative + scenario gen). `isClaudeAvailable()` guards every entry point.
- **Schema additions**: `aiUsage` (append-only ledger of userId/kind/model/tokensIn/tokensOut/costCents), `aiCache` (cacheKey PK, kind, value jsonb, expiresAt). `AI_PRICING_PER_MTOK`: haiku $0.80/$4, sonnet $3/$15. `AI_TIER_MONTHLY_TOKENS`: free=20k, pro=500k, school=200k, enterprise=2M.
- **Plumbing**:
  - `server/ai/usage.ts` — `logUsage()` writes ledger row + computes cost. `getMonthlyTokens(userId)` aggregates current calendar month. `enforceBudget(userId, plan)` throws 429 (`BudgetExceededError`) before any Claude call.
  - `server/ai/cache.ts` — `cacheKey(parts)` = sha256(JSON.stringify(parts)) (canonical, collision-safe). `cacheGet/cacheSet` with TTL, expired rows deleted on read; `maybeSweepExpired()` background sweep throttled to once/min.
- **KCSE Claude scoring** (`server/ai/kcse.ts`): Haiku call with strict JSON output, 10s timeout, 1hr cache (key includes prompt version + model + scenarioId + sorted card IDs). Returns `{kcseDelta -5..+5, narrative, strengths, weaknesses}`. Any failure (timeout, parse, budget) returns null → deterministic score stands. Final score clamped 0-50 after delta.
- **Resume narrative** (`server/ai/narrative.ts`): Sonnet call, 24hr cache. Pro/School/Enterprise gated via `ProTierRequiredError` (HTTP 402). Returns `{summary, archetypeInsight, topRisks[3], growthPath[3]}`.
- **Scenario generation** (`server/ai/scenarioGen.ts`): Sonnet, admin-gated via `ADMIN_USER_ID` env. Validates tier ∈ CCGE_TIERS, ≥2 valid pillars, clamps tokenBudget 30-120 + difficulty 1-5. Optional `persist:true` body upserts via `storage.upsertCcgeScenario`.
- **Routes** (`server/routes.ts`):
  - `GET /api/ai/status` — `{available, usage:{tokensIn, tokensOut, total, costCents}}` for current user month.
  - `POST /api/ccge/sessions/:id/finish` — accepts optional `useClaude:boolean` body flag; defaults off (backward compatible). Adds Claude `kcseDelta` to deterministic breakdown before tier/flywheel; response includes `claude` field.
  - `POST /api/ai/resume-narrative/:assessmentId` — requireAuth + assessment ownership + Pro+ gate.
  - `POST /api/admin/ai/generate-scenario` — requireAuth + ADMIN_USER_ID match.

---

## Phase E — Flywheel Orchestration

- `shared/schema.ts` defines `arkEvents` (id, userId, type, payload jsonb, scoreDelta, createdAt) + `ARK_EVENT_TYPES` + `ARK_SCORE_DELTAS`.
- `server/orchestrator.ts` — singleton typed event bus. `emit(userId, type, payload, scoreDelta)` writes to `ark_events` and fans out to SSE subscribers (best-effort: emit failures are logged, never throw). `subscribe(userId, res)`, `getRecentEvents(userId, limit)`.
- `server/storage.ts` `finalizeSession({sessionId, actorUserId, playedCardIds, breakdown, tier})` — atomic `db.transaction` doing SELECT FOR UPDATE on session+user, in-txn ownership re-check (uses authenticated actor, not session.userId), `status≠in_progress→409`, latest assessment lookup, pure `planFlywheel` compute, conditional updates to user.cert + assessment.jst + gameSession in one txn.
- `server/ccge.ts` `planFlywheel(currentLevel, jcse, latestAssessment)` is pure (no DB writes); txn handler does writes.
- SSE: `GET /api/ark-score/stream` (requireAuth) — initial `ark.snapshot` event + per-user `ark.event` push, 25s heartbeat, full cleanup on `req.close`. Read-only fallback: `GET /api/ark-score/events`.
- Emit sites: `POST /api/assessments`, `POST /api/resume/upload`, `POST /api/ccge/sessions/:id/finish` (game.session.finished + conditional cert.upgraded), `POST /api/sphinx/listings`, `POST /api/sphinx/listings/:id/purchase` (buyer + creator emits).
- Client: `client/src/lib/useArkStream.ts` (EventSource hook with snapshot + live merge + pulse counter), Live ARK Score widget on dashboard with animated JST and last-5 activity feed.

---

## Phase D.2 — Billing (Stripe Stub)

- **Status**: STUBBED OUT (no Stripe key wired). Stripe integration unavailable in this Replit environment; column shapes mirror real Stripe so future swap is mechanical.
- **Schema** (`shared/schema.ts`):
  - `users` adds `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionCurrentPeriodEnd`, `subscriptionCanceledAt` (all nullable).
  - `checkoutSessions` (id, userId, plan, amountCents, status ∈ CHECKOUT_STATUSES, institution, externalSessionId, createdAt, completedAt).
  - `billingEvents` audit ledger (id, userId, type ∈ BILLING_EVENT_TYPES, fromPlan, toPlan, amountCents, externalId, payload jsonb, createdAt). Indexed by (user_id, created_at DESC).
  - `ARK_EVENT_TYPES` extended with `billing.checkout.completed`, `billing.subscription.canceled`, `billing.payment.failed` (orchestrator emits with scoreDelta=0 — no JST impact).
- **Helpers** (`server/billing.ts`): `priceCentsForPlan`, `isPaidPlan`, `nextPeriodEnd` (30d), `syntheticStripe{Customer,Subscription,Checkout}Id` (deterministic stubs prefixed `cus_stub_/sub_stub_/cs_stub_`), `transitionType` → upgraded/downgraded/null.
- **Routes** (`server/routes.ts`):
  - `GET /api/billing/me` → `{plan, status, currentPeriodEnd, canceledAt, stripeCustomerId, stripeSubscriptionId, recentEvents[10]}`.
  - `POST /api/billing/checkout {plan, institution?}` → creates pending session, writes `checkout.created` event. Returns `{sessionId, externalSessionId, plan, amountCents, requiresPayment, redirectUrl: "/checkout/:id"}`. 409 if same plan already active; 409 for ENTERPRISE (sales contact); 400 for SCHOOL_STUDENT without institution.
  - `GET /api/billing/checkout/:id` → session details (auth + ownership).
  - `POST /api/billing/checkout/:id/complete {success}` → on success: updates user (plan, status=active, stripe IDs, currentPeriodEnd=now+30d, canceledAt=null) + `checkout.completed` + `subscription.upgraded|downgraded` event + emits `billing.checkout.completed`. On failure: marks session `failed`, emits `billing.payment.failed`, returns 402. 409 if already completed.
  - `POST /api/billing/cancel` → sets status=`canceling`, canceledAt=now, preserves currentPeriodEnd; emits `billing.subscription.canceled`. 409 on free plan / already canceling.
  - `POST /api/admin/billing/webhook-simulate {targetUserId, type}` (ADMIN_USER_ID gated) → simulates `payment.failed` (sets past_due) or `subscription.canceled/deleted` (immediate downgrade). Used to test failure recovery paths.
  - `PUT /api/users/:id/subscription` retained as legacy ENTERPRISE-only path (returns 409 for any other plan with pointer to `/api/billing/checkout`).
- **Frontend**:
  - `client/src/pages/subscription.tsx` — `handleSubscribe` calls `api.startCheckout`, navigates to `/checkout/:id` for paid plans (free auto-completes inline). Cancel button on current-plan card. Status pill reflects `canceling`. Inline error banner.
  - `client/src/pages/checkout.tsx` (route `/checkout/:id`) — fetches session, renders fake card form (4242 4242 4242 4242 / 12/28 / 123). "Pay" button → `completeCheckout(true)`. "Simulate Payment Failure" button → `completeCheckout(false)` → renders failure state. Auto-redirects to `/subscription` 1.6s after success.
  - `client/src/lib/api.ts` adds `getBillingMe`, `startCheckout`, `getCheckoutSession`, `completeCheckout`, `cancelSubscription`.
- **Future Stripe swap** (mechanical):
  - Replace `syntheticStripe*` calls with `stripe.checkout.sessions.create / customers.create`.
  - Replace `/checkout/:id` redirect with `session.url` from Stripe.
  - Replace `/complete` route with real Stripe webhook handler that verifies signature and writes the same `billingEvents` rows + emits same orchestrator events.
  - DB columns and event types stay identical; UI flow unchanged.

---

## Phase D.1 — Auth & Authorization

- **Server-side sessions** via `express-session` + `connect-pg-simple` (PG-backed `session` table, auto-created). Cookie name `ark.sid`, httpOnly + sameSite=lax, `secure: true` in production, 14-day rolling expiry, `trust proxy` enabled. `SESSION_SECRET` is required in production — process refuses to start without it; dev falls back to a clearly-labelled insecure default with a startup warning.
- **`server/auth.ts`** exports: `buildSessionMiddleware()`, `requireAuth`, `requireSelf(paramName)`, `currentUserId(req)`, `loginSession(req, userId)` (regenerates the session ID before binding userId to mitigate session fixation).
- **Auth routes**: `POST /api/auth/login`, `POST /api/auth/register` (auto-login), `POST /api/auth/logout`, `GET /api/auth/me`. Register and login both go through `loginSession` so a fresh session ID is minted on every auth boundary.
- **Platform-wide IDOR lockdown**: every mutation derives identity from `req.session.userId`, never from request body or path. Routes wear one of two middlewares:
  - `requireAuth` — endpoint reads/writes the current session user. Examples: `POST /api/ccge/sessions`, `POST /api/sphinx/listings/:id/purchase`, `POST /api/endorsements`, `POST /api/sphinx/listings`, `DELETE /api/sphinx/listings/:id`.
  - `requireSelf(paramName)` — path param must equal session userId. Examples: `PUT /api/users/:id/profile`, `PUT /api/users/:id/subscription`, `GET /api/assessments/user/:userId`, `GET /api/sphinx/credits/:userId`, `GET /api/sphinx/sales/:userId`, `GET /api/sphinx/purchases/:userId`, `GET /api/ccge/sessions/user/:userId`.
  - Object-ownership endpoints (`GET /api/ccge/sessions/:id`, `POST /api/ccge/sessions/:id/finish`) re-check `session.userId === currentUserId(req)` after loading the row.
- **`PUT /api/users/:id/context-craft-cert` permanently 403s**. Cert level is computed only by the CCGE flywheel — clients cannot self-promote.
- **Public reads minimised**: `GET /api/users/:id` returns a public DTO (`id, name, role, contextCraftCertLevel`) for non-self viewers; full record is only returned to the user themselves and via `/api/auth/me`.
- **Client `useAuth`** is a thin wrapper around `useQuery(["/api/auth/me"])`. No more localStorage. All fetches send `credentials: "include"`. Logout calls `POST /api/auth/logout` and clears the React Query cache.
- **Client `api.ts`** stops sending the actor's userId in any request body — the server derives it from the session. Method signatures still accept `userId` for backward compatibility but ignore it for actor identity.

---

## Phase C — GUIN+ Identity

- **Schema** (`shared/schema.ts`): `endorsements` (id, endorserId, recipientId, sessionId, message, createdAt) — peer endorsements gated by cert tier and backed by a real CCGE session as evidence.
- **Constants**: `KNIGHT_RANKS` (Squire 0 / Knight 50 / Paladin 150 / Champion 350 / Legend 650 — thresholds in cumulative KCSE earned), `ENDORSEMENT_MAX_LEN=240`.
- **Helpers**: `computeKnightRank(totalKcseEarned)` returns `{ current, next, progress, totalKcseEarned }` for the rank ribbon.
- **Aggregator** (`server/guin.ts`): `buildGuinProfile(userId)` returns user, knight rank, 30-day KCSE radar (avg of knowledge/clarity/specificity/efficiency from `gameSessions.kcseBreakdown`), owned cards (CCGE cards used in finished sessions where `certTierEarned` is non-null = "won"), published SPCs (active only), endorsements enriched with endorser metadata, recent finished sessions.
- **Endorsement gate** (`validateEndorsement`): blocks self-endorse, blocks endorsers whose `CERT_LEVEL_RANK` is below recipient's, requires session that exists / belongs to endorser / is finished + KCSE-scored, blocks duplicates per (endorser, recipient) pair.
- **Frontend** (`client/src/pages/guin-public.tsx`): exports `GuinProfileView` (reusable identity card with knight ribbon, KCSE radar via Recharts `RadarChart`, owned-cards grid, published-SPC portfolio, endorsements list with inline endorse form). Default export is the public `/u/:username` page.
- **Embedded on `/profile`**: the existing edit-mode profile page renders the full `GuinProfileView` below the editable details (`viewerCanEndorse=false` for self), plus a "View Public Profile →" link.
- **Public route** `/u/:username`: read-only GUIN+ card; if a viewer is logged in and holds an equal-or-higher cert tier, the "Endorse" button shows an inline form with a session picker and a 240-char message field.

---

## Phase B — SPHINX Marketplace

- **Schema** (`shared/schema.ts`): `spcListings` (creator, title/desc/body, pillar, priceCredits, kcseScore, hiveScore, status, salesCount, totalEarned), `spcPurchases` (buyer, listing, creator, priceCredits, creatorShare, platformShare, isFirstSaleForCreator), `userCredits` (userId PK, balance, lifetimeEarned, lifetimeSpent).
- **Constants**: `SPC_CREATOR_SHARE_PCT=70`, `SPC_PLATFORM_SHARE_PCT=30`, `SPC_STARTING_CREDITS=100`, `SPC_MIN_CERT_TO_PUBLISH=CC_400`, `SPC_PRICE_MIN=5`, `SPC_PRICE_MAX=500`, `SPC_HIVE_MIN_TO_PUBLISH=80` (raised from 60 to canon HIVE Gold floor), `SPC_FIRST_SALE_TALENT_BOOST=3`.
- **Engine** (`server/sphinx.ts`):
  - `runHivePrecheck(input)` — deterministic 0-100 HIVE score from title/desc/body length, structural keyword matches, formatting heuristics; rejects red-flag terms (lorem ipsum, todo, placeholder); also computes proxied KCSE 0-50 (Phase F replaces with Claude call).
  - `getOrCreateCredits(userId)` — idempotent starter-credit grant (100 credits).
  - `executePurchase(buyerId, listingId)` — **fully transactional** via `db.transaction`: locks buyer + creator + listing rows `FOR UPDATE`, validates balance + non-self-purchase + active status, splits 70/30, inserts purchase row, bumps listing counters, on first sale grants creator JST Talent +3 (capped 100/300). Any failure rolls back entire purchase.
- **Cert gate**: publishing requires `CONTEXT_CRAFT_LEVELS[user.contextCraftCertLevel]` rank ≥ CC-400 Expert (Gold tier in CCGE).
- **Seed**: second creator user (`creator@sphinx.io` / `arkplatform`, CC-500) with 3 sample SPCs across System/Instruction/Format pillars (15/25/75 credits).
- **Frontend** (`client/src/pages/marketplace.tsx`): single-file router with three views (`ListingsList`, `ListingDetail`, `PublishPage`); shows credits header, pillar filter chips, locked-state for non-Gold users, live HIVE pre-check panel before publish, transactional purchase confirmation with first-sale Talent boost callout.
- **Profile widget** (`client/src/pages/profile.tsx`): SPHINX card showing credits / lifetime earned / sales count.

---

## Phase A — CCGE (Context Craft Game Engine)

- **Schema** (`shared/schema.ts`): `ccgeCards` (14 seeded across 7 pillars + SuperPrompt), `ccgeScenarios` (6: 2 Bronze / 2 Silver / 2 Gold), `gameSessions` (hand/played/score/flywheel result).
- **Constants**: `CC_PILLARS`, `CARD_TYPES`, `JCSE_TIER_THRESHOLDS` (Bronze 30, Silver 36, Gold 43, Platinum 48 — renamed from `KCSE_TIER_THRESHOLDS` to match canon Term 3), `ARK_SCORE_DELTAS`, `CERT_LEVEL_RANK`.
- **Helpers**: `jcseToContextCraftLevel(jcse)` auto-promotes cert; `jcseToTier(jcse)` returns tier label.
- **Game engine** (`server/ccge.ts`):
  - `dealHand(allCards, scenario, 5)` — biased deal toward target pillars for the scenario.
  - `scoreSession(playedCards, scenario)` — deterministic JCSE 0-50 score across 4 KCSE dimensions (Knowledge 30%, Clarity 30%, Specificity 20%, Efficiency 20%) with synergy multipliers: Alpha Prime ×1.15 (≥2 Ultra), Solo Legend ×1.10 (SuperPrompt), Full Context ×1.20 (≥5 unique pillars), Precision Engine ×1.10 (≥4 cards covering all targets), Expert Clarity ×1.08 (≥3 Premium+).
  - `applyFlywheel(userId, jcse)` — ONECRAFT loop: computes ARK delta, auto-promotes user's `contextCraftCertLevel` if rank increases, bumps latest assessment's `jstSkills`/`jstTotal` (clamped at 100/300).
- **Seed** (`server/ccgeSeed.ts`): exported as `seedCcge()`; called from `POST /api/seed`.
