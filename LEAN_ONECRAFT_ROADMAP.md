# Lean ONECRAFT Roadmap

A living, Replit-feasible adaptation of the **ARK ONECRAFT PDD v1.0** (340 prompts, 10 phases, 42 weeks, 12-microservice NestJS platform).

This document is the source of truth for what we are *actually* going to build, session by session, on top of the current ARK Platform monolith. It maps the PDD's enterprise vision onto a lean, single-app architecture that ships quickly and proves the **ONECRAFT Flywheel** with real users.

---

## Guiding Principles

1. **Prove the flywheel before scaling the architecture.** The flywheel — *Score reveals gap → Game closes gap → Cert unlocks marketplace → Sales raise score* — is the entire product. Until it's visible to a user, no microservice split is justified.
2. **One app, one database, one deployment.** Stay on Express + Vite + PostgreSQL until pain forces a split. Replit's autoscale handles us well past MVP.
3. **Substitute, don't skip.** For every "enterprise" PDD requirement, choose a lean substitute that delivers the same user-visible behavior. (e.g. signed PDF + DB flag instead of Polygon NFT.)
4. **Wire the flywheel in every phase.** Every new module must update `ark_score` so the loop is felt immediately.
5. **Each phase = one chat session.** Scope each phase to be completable and testable in a single working session.

---

## Architecture Decisions (Now vs. PDD Target)

| Concern | PDD Target | Lean ONECRAFT Substitute |
|---|---|---|
| Topology | 12 NestJS microservices on EKS | Single Express app on Replit autoscale |
| API gateway | Kong + JWT plugin | Express middleware + simple rate limit |
| Auth | Auth0 + SAML + Social | Replit Auth (or current localStorage stub until Phase D) |
| Event bus | BullMQ + Redis cluster | In-process EventEmitter + Postgres triggers |
| Game state | XState FSM, server-deterministic | Simple reducer + Postgres `game_sessions` table |
| Real-time | WebSocket via Kong | Server-Sent Events from Express |
| Vector search | Pinecone | Postgres `pgvector` extension |
| Graph (GUIN+) | Neo4j | Postgres relational tables + recursive CTEs |
| Full-text search | Elasticsearch | Postgres `tsvector` + `pg_trgm` |
| Time-series | TimescaleDB | Plain Postgres + materialized views |
| Cert NFTs | ERC-721 on Polygon Mainnet | Signed PDF cert + DB `verified=true` flag |
| Royalties | ERC-2981 smart contract | Postgres `royalty_splits` table + Stripe Connect (Phase D) |
| KCSE scoring | Claude Haiku 4.5 < 200ms | Claude Haiku via Anthropic SDK, cached by `(scenarioId, cardHash)` |
| ARK assessment | Claude Sonnet 4 (full pipeline) | Existing keyword engine + Claude Sonnet on Pro tier (later) |
| Mobile/Desktop | Expo + Electron | Vite PWA only (responsive web) |
| Compliance | SOC 2, EU AI Act, PCI-DSS | Stripe handles PCI; basic GDPR delete endpoint |

If/when one of these substitutes becomes a real bottleneck, *that* is the moment to upgrade — not before.

---

## The Three Pillars (Lean Mapping)

| PDD Pillar | What's Already Built | What's Missing for Lean MVP |
|---|---|---|
| **ARK MAXIMUS v2** (Career Intelligence) | JST score, vulnerability meter, 12-vector radar, archetype handicap, FORGE cards, history chart, PDF report | LHCS Layer 03 readiness signal; CC Protection Factor visible on the meter |
| **CCGE** (Game Engine) | Subscription/cert level field on user; cert multiplier in scoring | The actual card game — cards, scenarios, KCSE scoring, cert tiers, badges |
| **SPHINX** (Marketplace) | Subscription plans page | SPC listings, purchase flow, creator economy stub, royalties view |
| **GUIN+** (Identity Layer) | Profile page (editable), assessment history | KCSE radar over time, knight rank, owned cards, published SPCs, endorsements |

---

## Phase Plan — Each Phase = One Session

### ✅ Phase 0 — Foundation Already Shipped
**Status: COMPLETE (commit `f97251341`)**

- Stripe checkout modal (simulated)
- PDF export with print fallback
- Assessment history line chart
- Email summary endpoint
- School/Institution dashboard
- Profile page with persistence
- 8-question Context Craft assessment
- Sidebar nav: Profile + Institution

---

### ✅ Phase A — CCGE Card Game MVP
**Status: COMPLETE**

What shipped:
- 4 new Drizzle tables (`ccgeCards`, `ccgeScenarios`, `gameSessions`) + constants (`CC_PILLARS`, `CARD_TYPES`, `KCSE_TIER_THRESHOLDS`, `ARK_SCORE_DELTAS`, `CERT_LEVEL_RANK`)
- 14 seed cards across 7 pillars + Sphinx Super Prompt; 6 seed scenarios (2 Bronze / 2 Silver / 2 Gold)
- Deterministic JCSE 0–50 scoring engine (`server/ccge.ts`) with 5 synergy multipliers (Alpha Prime, Solo Legend, Full Context, Precision Engine, Expert Clarity)
- ONECRAFT flywheel: session finish auto-promotes `contextCraftCertLevel` (only at Bronze threshold or higher) and bumps latest assessment `jstSkills`/`jstTotal`
- 6 `/api/ccge/*` REST endpoints with anti-cheat validation (played cards must be in dealt hand; no duplicates)
- Full `/play` UI: lobby → active session → result screen with KCSE breakdown, tier badge, ARK delta, cert upgrade banner
- Sidebar `CCGE Arena` nav link

Known limitations (deferred by design — see linked phases):
- **IDOR / broken access control**: `userId` is trusted from request body. Same pattern as every other endpoint in the app today. Locked down platform-wide in **Phase D**.
- **Non-atomic finish**: `applyFlywheel` performs 3 independent writes (user, assessment, session). Wrapped in a DB transaction in **Phase E**.

---

### 🟡 Phase B — SPHINX Marketplace Stub *(start here next)*
**Goal:** Gold+ users (CC_400 cert or higher, achievable via Phase A's CCGE Arena) can publish a "Smart Prompt Card" (SPC); anyone can browse and "purchase" with platform credits.

**Scope:**
- `shared/schema.ts`: `spc_listings` (id, creator_id, title, description, body, price_credits, kcse_score, hive_score, status, created_at), `spc_purchases` (id, buyer_id, listing_id, price_credits, creator_share, platform_share, purchased_at), `user_credits` (user_id, balance)
- `/marketplace` route: list view + filter by pillar/tier, detail view with Buy button
- `/marketplace/publish` route (Gold+ gated): form for title/desc/body/price + simulated HIVE pre-check
- Purchase flow: deduct credits from buyer, credit 70% to creator, 30% to platform, write split rows
- Creator dashboard widget on `/profile`: total earnings, # sales, top SPC
- First sale of any creator → JST Talent +3 (flywheel)

**Acceptance:** Gold cert user publishes an SPC, second user buys it, both see balances and JST update.

**Out of scope this phase:** NFT mint, ERC-2981 royalties, ZPOS optimization, ULTRA SI synthesis.

---

### 🔵 Phase C — GUIN+ Identity Evolution
**Goal:** Upgrade `/profile` into the full GUIN+ professional identity card.

**Scope:**
- KCSE radar over last 30 days (recharts, pulled from `card_plays` aggregate)
- Knight rank progression: Squire → Knight → Paladin → Champion → Legend (computed from total KCSE earned)
- "Owned Cards" gallery (cards used in winning sessions)
- "Published SPCs" portfolio block
- Endorsements: any user at equal/higher cert tier can endorse, requires linking a KCSE-scored game session as evidence
- Public profile route `/u/:username` (read-only view of GUIN+ card)

**Acceptance:** User visits their public profile, sees radar + rank + cards + SPCs + endorsements rendered live.

**Out of scope this phase:** AI mentor matching, guilds, follow graph, knowledge feed.

---

### 💳 Phase D — Real Stripe + Real Auth *(absorbs ALL platform IDOR fixes)*
**Goal:** Replace the simulated checkout and localStorage auth with real, billable infrastructure. **This is the phase where every existing API endpoint that currently trusts `userId` from the request body gets locked down.**

**Scope:**
- Wire the Replit Stripe integration (connector `ccfg_stripe_default_org_ejpl33`)
- Real Stripe Checkout sessions for all 4 plans (Free/Pro/School/Enterprise)
- Webhook receiver: `payment_succeeded` → activate, `payment_failed` → suspend, `subscription.deleted` → downgrade
- Replace localStorage `useAuth` with Replit Auth (or a server-session cookie)
- **Platform-wide IDOR sweep** — every endpoint that takes `:userId` (in body or path) must derive the acting user from the auth session, not the request payload. Apply to: `/api/notifications/assessment-summary`, `/api/users/:id/profile`, `/api/users/:id/subscription`, `/api/users/:id/context-craft-cert`, `/api/resume/upload`, `/api/assessments`, all `/api/ccge/*` routes
- Stripe Connect (Express accounts) for SPHINX creator payouts in credits → fiat conversion

**Acceptance:** Real card payment promotes user to Pro tier; real creator payout request transfers funds; no endpoint accepts a userId in its body.

**Out of scope this phase:** SAML, SSO, MFA enforcement, seat management for institutions.

---

### ⚙️ Phase E — Flywheel Orchestration Layer *(also adds DB transactions)*
**Goal:** Make the flywheel observable, reactive, and atomic — every meaningful action triggers a recompute, the user *sees* the loop turn, and partial-failure split-brain becomes impossible.

**Scope:**
- `server/orchestrator.ts`: in-process EventEmitter with typed events (`assessment.completed`, `game.session.finished`, `cert.upgraded`, `spc.published`, `spc.purchased`)
- Each event handler appends to an `ark_events` table (audit log + analytics source)
- **Wrap every multi-write flywheel mutation in a DB transaction.** Specifically the CCGE `/finish` path (currently `applyFlywheel` user/assessment updates + `updateGameSession` are 3 independent writes). Add `storage.finalizeSession(sessionId, sessionPatch, userPatch, assessmentPatch)` that does all writes inside `db.transaction(...)`.
- Live ARK Score endpoint via Server-Sent Events: `GET /api/ark-score/stream/:userId`
- Dashboard ARK Score widget subscribes to SSE and animates score changes in real time
- "Flywheel Activity" feed on dashboard — last 10 events with score deltas
- Score impact reference table (from PDD §3.10) implemented as `ARK_SCORE_DELTAS` constant in `shared/schema.ts`

**Acceptance:** User finishes a card session in one tab; ARK Score animates upward in another tab within 5 seconds.

**Out of scope this phase:** BullMQ, Redis, multi-instance fanout, cross-region.

---

### 🧠 Phase F — Claude AI Hardening *(when keys are available)*
**Goal:** Replace deterministic scoring stubs with real Claude calls where they matter.

**Scope:**
- Anthropic SDK integration in `server/ai/`
- KCSE scoring via Claude Haiku 4.5 with 1hr Postgres cache keyed on `(scenarioId, cardHash)`
- Resume narrative summary via Claude Sonnet (Pro tier feature)
- Scenario generation tool for admins (Sonnet)
- Cost accounting: every Claude call logs `tokens_in/out/cost_cents` to `ai_usage` table
- Per-tier monthly token budget enforcement

**Acceptance:** Card play scored by real Claude under 1 second on cache miss, instant on cache hit.

**Out of scope this phase:** Fine-tuning, multi-model routing, vector embeddings (deferred).

---

### 🏢 Phase G — Institutional Tier Hardening
**Goal:** Make `/school` actually usable by a real cohort of students.

**Scope:**
- Cohort import: CSV upload of student emails → bulk invite + auto-assign to institution
- Per-cohort assignments: instructor assigns scenarios with due dates
- Grade passback (CSV export first; LTI 1.3 deferred)
- Cohort comparison: scatter plot of CCMI vs JST across multiple cohorts
- Instructor role on user table; instructor-only routes gated

**Acceptance:** Instructor uploads 30 students, assigns a scenario, exports a graded CSV.

**Out of scope this phase:** LTI 1.3, LMS deep-link, SCORM.

---

### 📊 Phase H — Analytics & OSIRIS Lite
**Goal:** Platform-wide analytics dashboard for the operator.

**Scope:**
- `/admin/analytics` route (single-user gated by env var `ADMIN_USER_ID`)
- Materialized views: DAU/WAU/MAU, conversion funnel (signup → assessment → cert → purchase), GMV, top creators, top SPCs
- HIVE 14-D heatmap for published SPCs
- Cohort retention curves
- Refresh script run on cron (Replit Scheduled Deployment)

**Acceptance:** Operator opens admin dashboard, sees real-time platform health metrics.

**Out of scope this phase:** OSIRIS external feed, ML-driven anomaly detection.

---

### 🚀 Phase I — Launch Readiness
**Goal:** Go from "demo" to "I'd give this to a paying customer."

**Scope:**
- Security pass: rate limiting, input validation across all endpoints, CSRF, helmet headers
- Seed quality: 30 cards, 50 scenarios (10 per tier), 20 sample SPCs
- GDPR: `/api/users/:id/export` (JSON dump) + `/api/users/:id/delete` (soft + hard delete cascade)
- Privacy policy + Terms of Service pages
- Open Graph + Twitter Card tags on every route
- 404/500 pages, error boundary, Sentry hookup
- Loadtest with `autocannon` against critical endpoints

**Acceptance:** All launch-readiness checks pass; deployment is publish-ready.

**Out of scope this phase:** SOC 2, HIVE Platinum cert, formal pen test (engage a pro for these).

---

## Deferred to Post-MVP (Explicit "Not Now" List)

These appear in the PDD but should NOT be built until product-market fit is proven:

- 12-microservice split + Kong + EKS
- Polygon mainnet smart contracts + IPFS metadata
- React Native mobile + Electron desktop
- Auth0 + SAML + LTI 1.3 + Okta/Azure AD/Google Workspace IdP
- Neo4j + Pinecone + Elasticsearch + TimescaleDB
- BullMQ + Redis cluster + multi-region
- HIVE MATRIX LABS 14-D formal certification
- ZPOS+5 token optimization (AEOS/NEXUS/PRISM/QUANTUM/SYNTHESIS)
- ULTRA SI synthesis (multi-SPC parent agents)
- Camelot Chapter (Platinum-only guild)
- Tournaments, leagues, season champion system

Revisit each item only when blocked by a real, observed limitation — not by the PDD's aspiration.

---

## Status Tracker

| Phase | Status | Session | Notes |
|---|---|---|---|
| 0 — Foundation | ✅ Done | prior | commit `f97251341` |
| A — CCGE Card Game MVP | ✅ Done | this | Game playable end-to-end; flywheel wired; IDOR + atomicity deferred to D & E (documented) |
| B — SPHINX Marketplace Stub | ⬜ Next | — | Depends on A (cert tiers) |
| C — GUIN+ Identity | ⬜ | — | Depends on A + B (radar/SPC data) |
| D — Real Stripe + Auth | ⬜ | — | Independent; can run in parallel |
| E — Flywheel Orchestration | ⬜ | — | Best after A+B; touches both |
| F — Claude Hardening | ⬜ | — | Needs `ANTHROPIC_API_KEY` |
| G — Institutional Tier | ⬜ | — | Independent of A-F |
| H — Analytics Lite | ⬜ | — | After D (real users to count) |
| I — Launch Readiness | ⬜ | — | Final pass before public launch |

---

## How to Use This Document

- At the start of each session, pick a phase (or sub-scope of a phase).
- Update the **Status Tracker** when a phase ships.
- If you discover a substitute is no longer adequate, edit the **Architecture Decisions** table — that's the moment to consider an upgrade.
- If something from the **Deferred** list becomes urgent, move it into a phase with explicit justification.
- Reference: full PDD lives at `attached_assets/ARK_ONECRAFT_PDD_2_1777754861165.docx`.

---

*Living plan — last updated when commit `8ae943a` was the head.*
