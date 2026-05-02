# ARK Platform — Advanced Resume & Karriere Synthesized Intelligence

## Overview
Full-stack AI-powered career intelligence platform featuring JST Index scoring, AI Vulnerability assessment, 12-Vector Transferability Radar, Dynamic Upskilling Navigator, Junglenomics FORGE card integration, and Enterprise Workforce Intelligence dashboard.

## Architecture
- **Frontend**: React + Vite, TailwindCSS, Recharts, Framer Motion, wouter routing
- **Backend**: Express.js on port 5000, serves API + Vite dev server
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: localStorage-based session via `useAuth` hook (demo: analyst@enterprise.com / arkplatform)

## Design System
- Cyberpunk enterprise aesthetic
- Fonts: Orbitron (display/meters), Rajdhani (UI body), Space Grotesk (mono/terminal)
- Dark mode default
- HSL palette: primary=`188 86% 53%` (cyan), secondary=`152 69% 31%` (emerald), destructive=`346 87% 43%` (crimson), background=`222 47% 11%`
- Custom CSS utilities: `.glass`, `.glass-card`, `.neon-text`, `.neon-border`

## Key Files
- `shared/schema.ts` — Drizzle schema: users, assessments, upskilling_plans, pivot_opportunities, transferability_vectors, jnomics_cards, departments
- `server/routes.ts` — Express API routes (auth, assessments, resume upload, jnomics-cards, departments, seed)
- `server/resumeAnalyzer.ts` — Resume parsing & scoring engine (keyword-based JST scoring, vulnerability classification, transferability vectors, upskilling plans, pivot opportunities)
- `server/storage.ts` — DatabaseStorage class implementing IStorage interface
- `server/db.ts` — Drizzle + pg Pool setup
- `client/src/lib/api.ts` — Frontend API client (includes uploadResume for multipart form upload)
- `client/src/lib/useAuth.ts` — Auth hook (localStorage)
- `client/src/components/upload/ResumeUploader.tsx` — File upload UI with drag-drop, progress, error states
- `client/src/App.tsx` — Route definitions
- `client/src/index.css` — Global styles, custom utilities

## Routes (Frontend)
- `/` — Landing page
- `/login` — Enterprise login
- `/upload` — Resume upload
- `/assessment` — Context Craft assessment questionnaire (8 questions, archetype scoring)
- `/dashboard` — Intelligence Hub (JST gauge + radar, vulnerability meter + task heatmap + timeline, archetype handicap, FORGE cards, assessment history chart, email summary)
- `/pathways` — Career Mobility (12-vector radar, pivot opportunities, upskilling timeline, skill gap matrix)
- `/enterprise` — Workforce Intelligence (department heatmap, vulnerability pie, JST trend)
- `/report` — Executive Summary (print-optimized brief, PDF export via jsPDF + html2canvas)
- `/context-craft` — Context Craft Certifications (integration link, cert level management, JST multiplier preview)
- `/subscription` — Subscription Plans with Stripe checkout modal (Individual Free/Pro, School/Student, Enterprise tiers with feature comparison)
- `/profile` — User Profile (editable profile details, subscription status, cert level, institution)
- `/school` — Institution Dashboard (cohort JST scores, skill radar, archetype/vulnerability distributions, School plan gated)
- `/play` — CCGE Arena (single-player Context Craft card game; lobby → session → score → flywheel)
- `/marketplace` — SPHINX Marketplace (browse Smart Prompt Cards, filter by pillar)
- `/marketplace/publish` — Publish a new SPC (Gold+ cert gated, runs HIVE pre-check)
- `/marketplace/:id` — SPC detail page (preview, purchase, ownership view)

## Flywheel Orchestration (Phase E of LEAN_ONECRAFT_ROADMAP.md)
- `shared/schema.ts` defines `arkEvents` (id, userId, type, payload jsonb, scoreDelta, createdAt) + `ARK_EVENT_TYPES` + `ARK_SCORE_DELTAS`.
- `server/orchestrator.ts` — singleton typed event bus. `emit(userId, type, payload, scoreDelta)` writes to `ark_events` and fans out to SSE subscribers (best-effort: emit failures are logged, never throw). `subscribe(userId, res)`, `getRecentEvents(userId, limit)`.
- `server/storage.ts` `finalizeSession({sessionId, actorUserId, playedCardIds, breakdown, tier})` — atomic `db.transaction` doing SELECT FOR UPDATE on session+user, in-txn ownership re-check (uses authenticated actor, not session.userId), `status≠in_progress→409`, latest assessment lookup, pure `planFlywheel` compute, conditional updates to user.cert + assessment.jst + gameSession in one txn.
- `server/ccge.ts` `planFlywheel(currentLevel, jcse, latestAssessment)` is pure (no DB writes); txn handler does writes.
- SSE: `GET /api/ark-score/stream` (requireAuth) — initial `ark.snapshot` event + per-user `ark.event` push, 25s heartbeat, full cleanup on `req.close`. Read-only fallback: `GET /api/ark-score/events`.
- Emit sites: `POST /api/assessments`, `POST /api/resume/upload`, `POST /api/ccge/sessions/:id/finish` (game.session.finished + conditional cert.upgraded), `POST /api/sphinx/listings`, `POST /api/sphinx/listings/:id/purchase` (buyer + creator emits).
- Client: `client/src/lib/useArkStream.ts` (EventSource hook with snapshot + live merge + pulse counter), Live ARK Score widget on dashboard with animated JST and last-5 activity feed.

## Auth & Authorization (Phase D.1 of LEAN_ONECRAFT_ROADMAP.md)
- **Server-side sessions** via `express-session` + `connect-pg-simple` (PG-backed `session` table, auto-created). Cookie name `ark.sid`, httpOnly + sameSite=lax, `secure: true` in production, 14-day rolling expiry, `trust proxy` enabled. `SESSION_SECRET` is required in production — process refuses to start without it; dev falls back to a clearly-labelled insecure default with a startup warning.
- **`server/auth.ts`** exports: `buildSessionMiddleware()`, `requireAuth`, `requireSelf(paramName)`, `currentUserId(req)`, `loginSession(req, userId)` (regenerates the session ID before binding userId to mitigate session fixation).
- **Auth routes**: `POST /api/auth/login`, `POST /api/auth/register` (auto-login), `POST /api/auth/logout`, `GET /api/auth/me`. Register and login both go through `loginSession` so a fresh session ID is minted on every auth boundary.
- **Platform-wide IDOR lockdown**: every mutation derives identity from `req.session.userId`, never from request body or path. Routes wear one of two middlewares:
  - `requireAuth` — endpoint reads/writes the current session user. Examples: `POST /api/ccge/sessions`, `POST /api/sphinx/listings/:id/purchase`, `POST /api/endorsements`, `POST /api/sphinx/listings`, `DELETE /api/sphinx/listings/:id`.
  - `requireSelf(paramName)` — path param must equal session userId. Examples: `PUT /api/users/:id/profile`, `PUT /api/users/:id/subscription`, `GET /api/assessments/user/:userId`, `GET /api/sphinx/credits/:userId`, `GET /api/sphinx/sales/:userId`, `GET /api/sphinx/purchases/:userId`, `GET /api/ccge/sessions/user/:userId`.
  - Object-ownership endpoints (`GET /api/ccge/sessions/:id`, `POST /api/ccge/sessions/:id/finish`) re-check `session.userId === currentUserId(req)` after loading the row.
- **`PUT /api/users/:id/context-craft-cert` permanently 403s**. Cert level is computed only by the CCGE flywheel — clients cannot self-promote.
- **Public reads minimised**: `GET /api/users/:id` returns a public DTO (`id, name, role, contextCraftCertLevel`) for non-self viewers; full record (including username, subscription, institution, upload counters) is only returned to the user themselves and via `/api/auth/me`.
- **Client `useAuth`** is a thin wrapper around `useQuery(["/api/auth/me"])`. No more localStorage. All fetches send `credentials: "include"`. Logout calls `POST /api/auth/logout` and clears the React Query cache.
- **Client `api.ts`** stops sending the actor's userId in any request body — the server derives it from the session. Method signatures still accept `userId` for backward compatibility but ignore it for actor identity.

## GUIN+ Identity (Phase C of LEAN_ONECRAFT_ROADMAP.md)
- **Schema** (`shared/schema.ts`): `endorsements` (id, endorserId, recipientId, sessionId, message, createdAt) — peer endorsements gated by cert tier and backed by a real CCGE session as evidence
- **Constants**: `KNIGHT_RANKS` (Squire 0 / Knight 50 / Paladin 150 / Champion 350 / Legend 650 — thresholds in cumulative KCSE earned), `ENDORSEMENT_MAX_LEN=240`
- **Helpers**: `computeKnightRank(totalKcseEarned)` returns `{ current, next, progress, totalKcseEarned }` for the rank ribbon
- **Aggregator** (`server/guin.ts`): `buildGuinProfile(userId)` returns user, knight rank, 30-day KCSE radar (avg of knowledge/clarity/specificity/efficiency from `gameSessions.kcseBreakdown`), owned cards (CCGE cards used in finished sessions where `certTierEarned` is non-null = "won"), published SPCs (active only), endorsements enriched with endorser metadata, recent finished sessions
- **Endorsement gate** (`validateEndorsement`): blocks self-endorse, blocks endorsers whose `CERT_LEVEL_RANK` is below recipient's, requires session that exists / belongs to endorser / is finished + KCSE-scored, blocks duplicates per (endorser, recipient) pair
- **Frontend** (`client/src/pages/guin-public.tsx`): exports `GuinProfileView` (reusable identity card with knight ribbon, KCSE radar via Recharts `RadarChart`, owned-cards grid, published-SPC portfolio, endorsements list with inline endorse form). Default export is the public `/u/:username` page
- **Embedded on `/profile`**: the existing edit-mode profile page renders the full `GuinProfileView` below the editable details (`viewerCanEndorse=false` for self), plus a "View Public Profile →" link
- **Public route** `/u/:username`: read-only GUIN+ card; if a viewer is logged in and holds an equal-or-higher cert tier, the "Endorse" button shows an inline form with a session picker (auto-loaded via `getCcgeUserSessions`) and a 240-char message field

## SPHINX Marketplace (Phase B of LEAN_ONECRAFT_ROADMAP.md)
- **Schema** (`shared/schema.ts`): `spcListings` (creator, title/desc/body, pillar, priceCredits, kcseScore, hiveScore, status, salesCount, totalEarned), `spcPurchases` (buyer, listing, creator, priceCredits, creatorShare, platformShare, isFirstSaleForCreator), `userCredits` (userId PK, balance, lifetimeEarned, lifetimeSpent)
- **Constants**: `SPC_CREATOR_SHARE_PCT=70`, `SPC_PLATFORM_SHARE_PCT=30`, `SPC_STARTING_CREDITS=100`, `SPC_MIN_CERT_TO_PUBLISH=CC_400`, `SPC_PRICE_MIN=5`, `SPC_PRICE_MAX=500`, `SPC_HIVE_MIN_TO_PUBLISH=60`, `SPC_FIRST_SALE_TALENT_BOOST=3`
- **Engine** (`server/sphinx.ts`):
  - `runHivePrecheck(input)` — deterministic 0-100 HIVE score from title/desc/body length, structural keyword matches, formatting heuristics; rejects red-flag terms (lorem ipsum, todo, placeholder); also computes proxied KCSE 0-50 (Phase F replaces with Claude call)
  - `getOrCreateCredits(userId)` — idempotent starter-credit grant (100 credits)
  - `executePurchase(buyerId, listingId)` — **fully transactional** via `db.transaction`: locks buyer + creator + listing rows `FOR UPDATE`, validates balance + non-self-purchase + active status, splits 70/30, inserts purchase row, bumps listing counters, on first sale grants creator JST Talent +3 (capped 100/300). Any failure rolls back entire purchase.
- **Cert gate**: publishing requires `CONTEXT_CRAFT_LEVELS[user.contextCraftCertLevel]` rank ≥ CC-400 Expert (Gold tier in CCGE)
- **Seed**: a second creator user (`creator@sphinx.io` / `arkplatform`, CC-500) with 3 sample SPCs across System/Instruction/Format pillars (15/25/75 credits)
- **Frontend** (`client/src/pages/marketplace.tsx`): single-file router with three views (`ListingsList`, `ListingDetail`, `PublishPage`); shows credits header, pillar filter chips, locked-state for non-Gold users, live HIVE pre-check panel before publish, transactional purchase confirmation with first-sale Talent boost callout
- **Profile widget** (`client/src/pages/profile.tsx`): SPHINX card showing credits / lifetime earned / sales count

## CCGE — Context Craft Game Engine (Phase A of LEAN_ONECRAFT_ROADMAP.md)
- **Schema** (`shared/schema.ts`): `ccgeCards` (14 seeded across 7 pillars + SuperPrompt), `ccgeScenarios` (6: 2 Bronze / 2 Silver / 2 Gold), `gameSessions` (hand/played/score/flywheel result)
- **Constants**: `CC_PILLARS`, `CARD_TYPES`, `KCSE_TIER_THRESHOLDS` (Bronze 30, Silver 36, Gold 43, Platinum 48), `ARK_SCORE_DELTAS`, `CERT_LEVEL_RANK`
- **Helpers**: `jcseToContextCraftLevel(jcse)` auto-promotes cert; `jcseToTier(jcse)` returns tier label
- **Game engine** (`server/ccge.ts`):
  - `dealHand(allCards, scenario, 5)` — biased deal toward target pillars for the scenario
  - `scoreSession(playedCards, scenario)` — deterministic JCSE 0-50 score across 4 KCSE dimensions (Knowledge 30%, Clarity 30%, Specificity 20%, Efficiency 20%) with synergy multipliers: Alpha Prime ×1.15 (≥2 Ultra), Solo Legend ×1.10 (SuperPrompt), Full Context ×1.20 (≥5 unique pillars), Precision Engine ×1.10 (≥4 cards covering all targets), Expert Clarity ×1.08 (≥3 Premium+)
  - `applyFlywheel(userId, jcse)` — ONECRAFT loop: computes ARK delta, auto-promotes user's `contextCraftCertLevel` if rank increases, bumps latest assessment's `jstSkills`/`jstTotal` (clamped at 100/300)
- **Seed** (`server/ccgeSeed.ts`): exported as `seedCcge()`; called from `POST /api/seed`

## API Endpoints
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Register
- `GET /api/users/:id` — Get user
- `POST /api/resume/upload` — Upload resume (multipart: file + userId), parses PDF/TXT, runs analysis engine, saves full assessment
- `POST /api/assessments` — Create assessment with plans, pivots, vectors (manual)
- `GET /api/assessments/user/:userId/latest` — Latest assessment with full data
- `GET /api/jnomics-cards` — All FORGE cards
- `POST /api/jnomics-cards/by-ids` — Cards by ID array
- `GET /api/departments` — All departments
- `PUT /api/users/:id/context-craft-cert` — Update user's Context Craft certification level (Zod-validated against CONTEXT_CRAFT_LEVELS enum)
- `GET /api/context-craft/levels` — Get all certification level definitions (multipliers, labels, colors)
- `GET /api/subscription/plans` — Get all subscription plan definitions (features, limits, pricing)
- `PUT /api/users/:id/subscription` — Update user's subscription plan (Zod-validated against SUBSCRIPTION_PLANS enum, supports institution field for School plan)
- `PUT /api/users/:id/profile` — Update user profile (name, role, department, seniority, location)
- `GET /api/assessments/user/:userId` — All assessments for user (history)
- `POST /api/notifications/assessment-summary` — Queue email notification with assessment summary
- `POST /api/seed` — Seed demo data (now includes 14 CCGE cards + 6 scenarios)
- `GET /api/ccge/cards` — All CCGE cards
- `GET /api/ccge/scenarios?tier=Bronze|Silver|Gold|Platinum` — Scenarios (optional tier filter)
- `POST /api/ccge/sessions` — Start session (deals 5 cards), body `{userId, scenarioId}` → `{session, scenario}`
- `GET /api/ccge/sessions/:id` — Get session + scenario
- `POST /api/ccge/sessions/:id/finish` — Score and finish, body `{playedCardIds: string[1..5]}` → `{session, scenario, breakdown, tier, flywheel}`. Validates each played ID came from the dealt hand and rejects duplicates.
- `GET /api/ccge/sessions/user/:userId` — Session history (newest first)
- `POST /api/sphinx/hive-precheck` — Deterministic HIVE/KCSE score for a draft SPC (no DB write)
- `POST /api/sphinx/listings` — Publish SPC (cert-gated CC_400+, body Zod-validated, runs HIVE pre-check before insert)
- `GET /api/sphinx/listings?pillar=&status=` — List active SPCs with optional filters
- `GET /api/sphinx/listings/:id` — SPC detail + safe creator info (id, name, cert level)
- `DELETE /api/sphinx/listings/:id` — Delist (creator-only, sets status to "delisted")
- `POST /api/sphinx/listings/:id/purchase` — Atomic purchase via `db.transaction` (debit/credit/insert/JST-bump in one txn)
- `GET /api/sphinx/credits/:userId` — Get-or-create credit balance (grants 100 on first read)
- `GET /api/sphinx/listings/by-creator/:userId` — Creator's listings
- `GET /api/sphinx/sales/:userId` — Sales for creator (purchases + totalEarned + salesCount)
- `GET /api/sphinx/purchases/:userId` — Buyer's purchase history (each enriched with `listing` payload for full prompt access)
- `GET /api/guin/by-id/:userId` — Full GUIN+ profile payload (user, knight rank, KCSE radar, owned cards, published SPCs, endorsements)
- `GET /api/guin/by-username/:username` — Same as above, looked up by username (powers the public `/u/:username` route)
- `POST /api/endorsements` — Create endorsement; validates self-endorse / cert-tier gate / session ownership / session-finished / no-duplicate, returns 400/403/404/409 on each failure mode
- `GET /api/endorsements/by-recipient/:userId` — Raw endorsement rows for a user

## Resume Analysis Engine (`server/resumeAnalyzer.ts`)
- Keyword-based scoring across 6 categories: technical, leadership, analytical, communication, innovation, ai_adjacent
- Each category has weighted keyword lists; scores determine JST sub-dimensions (Jobs, Skills, Talent)
- Automation risk detection via regex patterns matched against resume text (14 task patterns)
- Vulnerability level (0-4) computed from average automation risk adjusted by AI/leadership scores
- **Archetype Handicap System**: Tri-dimensional percentage scoring (Architect/Orchestrator/Conductor)
  - Three scoring signals weighted and combined: job title matches from JST AI MAP (40%), skill category archetype weights (35%), matched FORGE card classifications (25%)
  - `JST_ARCHETYPE_MAP`: 228+ job titles mapped to archetypes from the JST AI MAP document (240+ occupations across 13 sectors)
  - `SKILL_ARCHETYPE_WEIGHTS`: Each of 6 skill categories distributes weight across archetypes (e.g., innovation → 60% Architect, 25% Orchestrator, 15% Conductor)
  - `CARD_ARCHETYPE_MAP`: FORGE cards classified by archetype (card-001/002/003/010 → Architect, card-004/005/009 → Orchestrator, card-006/007/008 → Conductor)
  - Normalization ensures percentages always sum to exactly 100%
  - Primary archetype determines `readinessProfile` (Architect/Orchestrator/Conductor)
- **Context Craft Handicap System**: Multiplicative scoring modifier based on certification level
  - No certification (NONE) = 0.5x multiplier (50% JST penalty)
  - CC-100 Foundational = 1.0x (baseline, penalty removed)
  - CC-200 Practitioner = 1.1x, CC-300 Specialist = 1.2x, CC-400 Expert = 1.35x, CC-500 Master Architect = 1.5x
  - Multiplier applied to each JST sub-dimension independently after raw scoring, before final composite
  - Raw scores (pre-multiplier) stored in `jstRawTotal/Jobs/Skills/Talent` for audit trail
  - Certification level stored on user record, looked up during resume analysis
- FORGE card mapping based on category thresholds
- Generates 12 transferability vectors, 3 upskilling plans, 3 pivot opportunities
- Accepts PDF (via pdf-parse) and plain text files, max 10MB

## Dashboard Components (VIZ Payload Aligned)
- `JSTGauge` (VIZ-001) — Tri-dimensional JST score display (0-300) with 5 color zones (Needs Development/Fair/Good/Excellent/Exceptional), percentile rank, industry average comparison, trend arrow
- `JSTRadar` (VIZ-002) — Three-layer radar chart (Jobs/Skills/Talent) with industry average benchmark overlay
- `VulnerabilityMeter` (VIZ-004) — 5-level AI vulnerability indicator
- `TaskHeatmap` (VIZ-005) — Task-level automation potential heatmap with color scale (green→blue→yellow→orange→red), time allocation estimates, risk labels
- `VulnerabilityTimeline` (VIZ-006) — Recharts AreaChart showing automation milestone projections from current year to 2041, color-coded by impact level
- `ArchetypeHandicap` — Visual archetype percentage breakdown (Architect/Orchestrator/Conductor) with animated bars, trait tags, and composite vector bar
- `JnomicsCardList` — Matched FORGE cards display

## Pathways Components
- `TransferabilityRadar` — 12-vector radar chart for skill mobility
- `UpskillingTimeline` — 30/90/365-day phased upskilling roadmap
- `SkillGapMatrix` (VIZ-008) — Matrix showing required vs current skills for top pivot roles, color-coded by gap size (Minimal/Small/Medium/Large/Critical)

## Upload Pipeline (VIZ-012)
- 5-phase processing UI: Discovery & Extraction → JST Calculation → Vulnerability Assessment → Transferability Analysis → Recommendations
- Each phase shows step progress, descriptions, and animated state transitions

## Database Seeding
Run `POST /api/seed` to populate: 10 Jnomics cards (card-001 through card-010), 7 departments, 1 demo user with full assessment data.

## Deployment
Target: autoscale