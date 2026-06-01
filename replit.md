# ARK Platform — Advanced Resume & Karriere Synthesized Intelligence

> Full-stack AI-powered career intelligence platform: JST Index scoring, AI Vulnerability assessment, 12-Vector Transferability Radar, Dynamic Upskilling Navigator, Junglenomics FORGE card integration, Enterprise Workforce Intelligence dashboard, CCGE prompt-craft game, SPHINX marketplace, GUIN+ identity, institutional cohorts.

📜 **Historical phase notes** (A through I, plus older Phase J detail) live in [`CHANGELOG.md`](./CHANGELOG.md). This file holds active architecture only.

---

## Canonical Score Glossary

All quantitative terms align to the Junglenomics FORGE Institute registries (General Technical Terms Registry v1.0 + Master SPC & Platform Registry v1.0, May 2026). Single source of truth: `shared/schema.ts::SCORE_GLOSSARY`.

- **ARK** (0-600) = JST + CCMI. Canon: ARK MAXIMUS ULTRA SI.
- **JST** (0-300) = `(Jobs·.30 + Skills·.40 + Talent·.30)·3`. Canon: ARK SI — Jobs-Skills-Talent Career Assessment Agent.
- **CCMI** (0-300) = weighted P1-P7 sum · 3. Canon: Context Craft Mastery Index.
- **JCSE** (0-50) = session/agent quality. Canon Term 3 Composite AI Agent Quality Score. Tier break-points: Bronze 30 / Silver 36 / Gold 43 / Platinum 48. Constant: `JCSE_TIER_THRESHOLDS`.
- **KCSE dimensions** (Knowledge·.30 + Clarity·.30 + Specificity·.20 + Efficiency·.20) = ARK-internal CCGE in-game rubric that produces the per-session JCSE. **Distinct from** the canon JCSE rubric (Context Engineering Pillar 40% + Synergy 30% + Compression 20% + Semantic Preservation 10%); we use K-C-S-E because the CCGE game grades player card hands, not finished prompt artifacts.
- **HIVE** (0-100) = 14-dimensional cert framework (canon Term 8). Tier break-points: Bronze 60 / Silver 70 / Gold 80 / Platinum 90. Publish gate is **80 (Gold)** to match the CC-400 user cert floor.
- **CC_xxx levels** = ARK-internal ladder; CC_200=Bronze, CC_300=Silver, CC_400=Gold, CC_500=Platinum, CC_100=Foundational (assessment-only).
- **Knight ranks** (Squire/Knight/Paladin/Champion/Legend) = GUIN+ contributor gamification, **not** the canon Six-Stage Agent Lifecycle (Newborn→Enterprise).

---

## Stage 1 — MVP (active)

Per `exports/ARK_PDD_MVP_Spartan.md`, the deployed surface is the 7 CLASS A features only (Identity, Resume Analyzer, CCGE Arena, SPHINX MVP, Bonsai onboarding, Billing FREE+PRO, GDPR). Every CLASS C surface is **feature-flagged off** so we can lift the gate as each trigger family fires (≥100 listings, first SCHOOL_STUDENT licence, etc.) without redeploying.

- **Single source of truth**: `shared/featureFlags.ts::FEATURES` — 18 flag keys; only `investorDemo` defaults `true` (Stage-1 public demo), all others default `false`.
- **Server gate**: `server/featureFlags.ts::requireFeature(key)` middleware returns **404** (not 403 — flagged surfaces are indistinguishable from unimplemented routes). Env overlay: `FEATURE_<SNAKE_CASE>=true` flips a flag without code change.
- **Client gate**: `client/src/App.tsx` only registers a `<Route>` when its flag is on; `AppLayout` filters `NAV_GROUPS` / `SECONDARY_LINKS` and gates `NotificationBell` + `useNotificationStream`.
- **Introspection**: `GET /api/features` returns `{ stage, features }` for ops checks.

**Currently flagged ON (Stage 1)**: `investorDemo` — the public, no-auth `/demo` (Sarah Chen persona) + `/demo-tour` (6-step guided walkthrough) marketing surfaces. The home page CTAs link straight to `/demo-tour`, so this flag must stay on for those buttons to resolve. `executiveReport` — the one-page **ARK REPORT** (`/report`): ATANDA-branded executive summary of the full ARK assessment (ARK/JST/CCMI/LHCS/vulnerability/archetype/12-vector radar), each metric with a plain-language one-liner; exports to PDF + PNG + JPEG via html2canvas/jsPDF. Pro+ gated via `useSubscription().canAccessReport`. Dashboard surfaces a `/report` CTA when this flag is on.

**Currently flagged OFF (Stage 1)**: `cohorts`, `guinPublic`, `notifications`, `claudeNarrative`, `subscriptionCancel`, `assessmentEmail`, `enterpriseDashboard`, `corporateMarketplace`, `revenueGuardrail`, `bookCompanion`, `forgeLabDocx`, `drm`, `customScenarios`, `adminCcgeImport`, `contextCraftPage`, `sphinxAdvanced`. Phase J implementation code is preserved verbatim — no deletion.

---

## Current Phase — J: PDD MVP Alignment

ARK identity is the canonical product surface. Single scorer, single writer, atomic flywheel, live SSE updates.

- **Identity formulas**: ARK = JST + CCMI, max 600. JST = (J·.30+S·.40+T·.30)·3, CCMI = weighted P1-P7 sum · 3.
- **Canonical scorer**: `server/scoringEngine.ts` (pure, unit-tested via `npm run test:scoring`).
- **Single writer of identity fields**: `server/arkRecalc.ts` updates `users` + `ccmi_pillar_scores` + `lhcs_signals` + `ark_score_history` atomically and preserves the ARK invariant under cap scaling.
- **Flywheel caps**: CCGE +15 ARK/day, SPHINX +20 ARK/30d. Caps are STRICT ceilings — any rounding overshoot from proportional JST/CCMI scaling is hard-clamped off CCMI before persistence (`applyCaps` returns `intendedCap`; recalc enforces `delta ≤ intendedCap`). `manual.recompute` and `backfill` triggers can never award positive ARK (downward sync only).
- **LHCS composite**: PDD-exact weighted blend `round(0.35·CPR + 0.35·MPS + 0.30·LCIS)`, with status as the threshold band of the COMPOSITE (≥70 green/ACTIVE, 40-69 amber/DEVELOPING, <40 red/BASELINE) — NOT a roll-up of the three lights. Constants in `shared/schema.ts::LHCS_WEIGHTS`, helpers `lhcsReadiness` / `lhcsStatusFromReadiness`.
- **Live updates**: orchestrator emits `ark.identity` SSE on flywheel events; dashboard consumes via `useArkStream`.
- **History stat semantics**: `/ark/history` "Top CCMI Pillar" reflects the current top pillar (not 30-day lift) — `ark_score_history` rows don't persist per-pillar snapshots; true per-pillar lift needs a schema addition.
- **Migration**: `migrations/0000_phase_j_pdd_alignment.sql` is fully idempotent (CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS).

See `CHANGELOG.md → Phase J` for the full implementation note (new modules, endpoints, client surfaces).

---

## Architecture

- **Frontend**: React + Vite + TailwindCSS + Recharts + Framer Motion + wouter routing.
- **Backend**: Express.js on port 5000, serves API + Vite dev server.
- **Database**: PostgreSQL with Drizzle ORM, `connect-pg-simple` PG-backed session store.
- **AI**: Anthropic Claude via `javascript_anthropic_ai_integrations` blueprint (Haiku for KCSE, Sonnet for narrative + scenario gen). See `CHANGELOG.md → Phase F`.
- **Auth**: Server-side sessions (`express-session`, cookie `ark.sid`, httpOnly + sameSite=lax, 14-day rolling). `SESSION_SECRET` required in production. Bcrypt passwords (cost 10) at the storage boundary with transparent legacy-plaintext rehash on first login. See `CHANGELOG.md → Phase D.1`.
- **Authorization**: Two middlewares — `requireAuth` (session-derived identity) and `requireSelf(:param)` (path param must equal session userId). All mutations derive actor from `req.session.userId`, never from body/path. Object-ownership endpoints re-check inside transactions. Instructor-gated routes use `requireInstructor`.
- **Security headers**: `helmet()` with prod CSP, HSTS, X-Frame-Options SAMEORIGIN, COOP/CORP, no-referrer. Body limits 1MB. Rate limits: 240 req/min global, 20 failed auths/15min.

---

## Design System

- Cyberpunk enterprise aesthetic
- Fonts: Orbitron (display/meters), Rajdhani (UI body), Space Grotesk (mono/terminal)
- Dark mode default
- HSL palette: primary=`188 86% 53%` (cyan), secondary=`152 69% 31%` (emerald), destructive=`346 87% 43%` (crimson), background=`222 47% 11%`
- Custom CSS utilities: `.glass`, `.glass-card`, `.neon-text`, `.neon-border`

---

## Key Files

### Shared
- `shared/schema.ts` — Drizzle schema (users, assessments, cohorts/memberships/assignments, ccge*, spc*, billing*, arkEvents, etc.) + all canonical constants and Zod insert schemas.

### Server
- `server/index.ts` — Express bootstrap, helmet, rate limits, session middleware, Vite dev integration.
- `server/auth.ts` — `buildSessionMiddleware`, `requireAuth`, `requireSelf`, `requireInstructor`, `loginSession`.
- `server/routes.ts` — all HTTP routes (auth, assessments, cohorts, CCGE, SPHINX, billing, GDPR, admin, seed).
- `server/storage.ts` — `DatabaseStorage` (IStorage impl) — single DB access surface. Transactional `finalizeSession`, `executePurchase`, `deleteUserCascade`, `reconcileCohortInvitesForUser`.
- `server/scoringEngine.ts` — pure JST/CCMI/ARK math + ARK-ID hash.
- `server/arkRecalc.ts` — single recalc entry point with caps + atomic persistence.
- `server/orchestrator.ts` — typed event bus, SSE fan-out.
- `server/resumeAnalyzer.ts` — Resume parsing & keyword scoring engine.
- `server/sphinx.ts`, `server/ccge.ts`, `server/billing.ts`, `server/guin.ts` — feature engines.
- `server/ai/*` — Claude client, KCSE, narrative, scenario-gen, usage ledger, cache.

### Client
- `client/src/App.tsx` — route table.
- `client/src/lib/useAuth.ts` — `useQuery(["/api/auth/me"])` wrapper. No localStorage.
- `client/src/lib/api.ts` — typed API client; all fetches send `credentials: "include"`.
- `client/src/lib/useArkStream.ts` — EventSource hook with snapshot + live merge.
- `client/src/components/layout/AppLayout.tsx` — chrome (sidebar, footer with legal links).
- `client/src/components/ErrorBoundary.tsx` — global render-time crash fallback.
- `client/src/components/dashboard/*`, `client/src/components/pathways/*` — visualizations (see below).
- `client/src/index.css` — global styles, custom utilities.

---

## Frontend Routes

- `/` — Landing page
- `/demo` — **Public investor demo** (no login). Hardcoded `Sarah Chen` persona with JST gauge + radar, vulnerability meter, archetype, 12-vector transferability radar, pivot opportunities, upskilling timeline, CTA back to `/login`.
- `/login` — Enterprise login (seed: `analyst@enterprise.com` / `arkplatform`)
- `/upload` — Resume upload (5-phase pipeline UI)
- `/assessment` — Context Craft 8-question questionnaire
- `/dashboard` — Intelligence Hub (ARK identity card, JST gauge + radar, LHCS signal, CCMI pillars, flywheel CTA, vulnerability meter + heatmap + timeline, archetype handicap, FORGE cards, history chart, email summary, live ARK widget)
- `/pathways` — Career Mobility (12-vector transferability radar, pivot opportunities, upskilling timeline, skill gap matrix)
- `/enterprise` — Workforce Intelligence (department heatmap, vulnerability pie, JST trend)
- `/report` — Executive Summary (print-optimized brief, PDF export via jsPDF + html2canvas)
- `/context-craft` — Context Craft Certifications + JST multiplier preview
- `/subscription` — Subscription plans + checkout entry
- `/checkout/:id` — Fake card form (Stripe stub; see `CHANGELOG.md → Phase D.2`)
- `/profile` — User Profile (editable details + GUIN+ identity card + SPHINX widget + Data Privacy section)
- `/school` — Institution Dashboard (instructor cohort manager / student "your cohort" view)
- `/play` — CCGE Arena (single-player Context Craft card game)
- `/marketplace`, `/marketplace/publish`, `/marketplace/:id` — SPHINX Marketplace (browse, publish, detail)
- `/u/:username` — Public GUIN+ profile
- `/ark/history` — Score-trajectory area chart + event log
- `/privacy`, `/terms` — Legal

---

## API Endpoints (active surface)

**Auth & users**
- `POST /api/auth/login` · `POST /api/auth/register` (auto-login) · `POST /api/auth/logout` · `GET /api/auth/me`
- `GET /api/users/:id` (self → full record; others → public DTO with id/name/role/contextCraftCertLevel only)
- `PUT /api/users/:id/profile` (requireSelf; **strips `role`** — privilege-bearing)
- `PUT /api/users/:id/subscription` (legacy ENTERPRISE-only path; 409s for other plans → use `/api/billing/checkout`)
- `PUT /api/users/:id/context-craft-cert` → permanently **403** (cert is flywheel-only)
- `GET /api/context-craft/levels` · `GET /api/subscription/plans`

**Assessments & resume**
- `POST /api/resume/upload` (multipart) — parses PDF/TXT, runs analyzer, saves full assessment, emits `assessment.completed`
- `POST /api/assessments` — manual create
- `GET /api/assessments/user/:userId/latest` · `GET /api/assessments/user/:userId` (history)
- `POST /api/notifications/assessment-summary`

**ARK identity (Phase J)**
- `GET /api/ark/identity` · `POST /api/ark/recalc` · `GET /api/ark/flywheel-cta` · `GET /api/ark/history?days=N` · `GET /api/ark/lhcs`
- `GET /api/ark-score/stream` (SSE) · `GET /api/ark-score/events` (fallback)
- `POST /api/admin/ark/backfill` (admin)

**CCGE — Context Craft game**
- `GET /api/ccge/cards` · `GET /api/ccge/scenarios?tier=` · `GET /api/ccge/sessions/:id` · `GET /api/ccge/sessions/user/:userId`
- `POST /api/ccge/sessions` (start, deals 5) · `POST /api/ccge/sessions/:id/finish` (atomic finalize, optional `useClaude`)

**SPHINX marketplace**
- `POST /api/sphinx/hive-precheck` · `POST /api/sphinx/listings` (publish, CC_400+ gated) · `GET /api/sphinx/listings?pillar=&status=` · `GET /api/sphinx/listings/:id` · `DELETE /api/sphinx/listings/:id`
- `POST /api/sphinx/listings/:id/purchase` (transactional)
- `GET /api/sphinx/credits/:userId` · `GET /api/sphinx/listings/by-creator/:userId` · `GET /api/sphinx/sales/:userId` · `GET /api/sphinx/purchases/:userId`

**GUIN+ identity & endorsements**
- `GET /api/guin/by-id/:userId` · `GET /api/guin/by-username/:username`
- `POST /api/endorsements` · `GET /api/endorsements/by-recipient/:userId`

**Cohorts (Phase G — instructor-gated)**
- `GET/POST /api/cohorts` · `GET /api/cohorts/:id` · `GET /api/cohorts/comparison`
- `POST /api/cohorts/:id/members` (bulk by email) · `DELETE /api/cohorts/:id/members/:userId`
- `GET/POST /api/cohorts/:id/assignments` · `GET /api/cohorts/:id/grades` · `GET /api/cohorts/:id/grades.csv`
- `GET /api/me/cohorts` (student)

**Billing (Stripe stub — Phase D.2)**
- `GET /api/billing/me` · `POST /api/billing/checkout` · `GET /api/billing/checkout/:id` · `POST /api/billing/checkout/:id/complete` · `POST /api/billing/cancel`
- `POST /api/admin/billing/webhook-simulate` (admin)

**AI**
- `GET /api/ai/status` · `POST /api/ai/resume-narrative/:assessmentId` (Pro+) · `POST /api/admin/ai/generate-scenario` (admin)

**GDPR / CCPA**
- `GET /api/users/me/export` · `DELETE /api/users/me` (body `{ "confirm": "DELETE" }`)

**Reference data & seed**
- `GET /api/jnomics-cards` · `POST /api/jnomics-cards/by-ids` · `GET /api/departments`
- `POST /api/seed` (dev only; 403 in production)

---

## Resume Analysis Engine (`server/resumeAnalyzer.ts`)

- Keyword-based scoring across 6 categories: technical, leadership, analytical, communication, innovation, ai_adjacent.
- Each category has weighted keyword lists; scores determine JST sub-dimensions (Jobs, Skills, Talent).
- Automation risk detection via 14 regex task patterns; vulnerability level (0-4) computed from average automation risk adjusted by AI/leadership scores.
- **Archetype Handicap System** (Architect/Orchestrator/Conductor): three weighted signals — job titles from `JST_ARCHETYPE_MAP` (228+ titles, 40%), skill-category weights (35%), matched FORGE card classifications (25%). Normalized to sum 100%; primary archetype sets `readinessProfile`.
- **Context Craft Handicap**: multiplicative JST modifier — NONE=0.5×, CC-100=1.0×, CC-200=1.1×, CC-300=1.2×, CC-400=1.35×, CC-500=1.5×. Raw pre-multiplier scores preserved in `jstRawTotal/Jobs/Skills/Talent` for audit.
- Generates 12 transferability vectors, 3 upskilling plans, 3 pivot opportunities.
- Accepts PDF (via pdf-parse) and plain text, max 10MB.

---

## Visualization Components

### Dashboard (VIZ Payload Aligned)
- `ArkIdentityCard` — Top-of-dashboard ARK score + ARK-ID string (Phase J)
- `LhcsSignal` — 3-light readiness signal (CPR/MPS/LCIS)
- `CcmiPillars` — 7-pillar CCMI radar
- `FlywheelCard` — next highest-leverage CTA
- `JSTGauge` (VIZ-001) — Tri-dim JST display (0-300) with 5 color zones, percentile, industry avg, trend
- `JSTRadar` (VIZ-002) — Three-layer radar (Jobs/Skills/Talent) with industry benchmark overlay
- `VulnerabilityMeter` (VIZ-004) — 5-level AI vulnerability indicator
- `TaskHeatmap` (VIZ-005) — Per-task automation potential heatmap with time allocation
- `VulnerabilityTimeline` (VIZ-006) — AreaChart of automation milestones to 2041
- `ArchetypeHandicap` — Animated bars + trait tags + composite vector
- `JnomicsCardList` — Matched FORGE cards
- `JstCcmiDoughnuts` — Side-by-side identity rings

### Pathways
- `TransferabilityRadar` — 12-vector skill mobility radar
- `UpskillingTimeline` — 30/90/365-day phased roadmap
- `SkillGapMatrix` (VIZ-008) — Required vs current skills per pivot role, color-coded gap

### Upload pipeline (VIZ-012)
- 5 phases: Discovery & Extraction → JST Calculation → Vulnerability Assessment → Transferability Analysis → Recommendations.

---

## Seed Data

`POST /api/seed` (dev-only; 403 in prod) populates:
- 10 Jnomics cards (card-001 through card-010)
- 7 departments
- Demo user `analyst@enterprise.com` (password `arkplatform`) with full assessment
- SPHINX creator `creator@sphinx.io` (CC-500) with 3 sample SPCs
- Cohorts instructor `instructor@academy.edu` (role=instructor, plan=SCHOOL_STUDENT) + "Fall 2026 — Prompt Architecture 101" cohort + 12 students + 3 assignments
- 14 CCGE cards + 6 scenarios (2 each Bronze/Silver/Gold)

---

## Deployment

Target: **autoscale**. Production requires `SESSION_SECRET`; refuses to start without it. `DATABASE_URL` auto-provisioned. Anthropic credentials auto-injected via the Replit AI integration.

---

## User Preferences

_None recorded. Add here when the user explicitly asks you to remember a preference or convention._
