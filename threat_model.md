# Threat Model

## Project Overview

ARK Platform is a full-stack TypeScript career intelligence application. The production app is an Express server (`server/index.ts`) serving a React/Vite frontend and JSON/SSE APIs backed by PostgreSQL through Drizzle ORM. Users register/login with local credentials, maintain profile and assessment data, upload resumes for scoring, play CCGE game sessions, publish and purchase SPHINX marketplace listings, access billing/subscription flows, and optionally invoke Anthropic Claude-backed AI features.

## Assets

- **User accounts and sessions** -- usernames/emails, bcrypt password hashes, `ark.sid` session cookies, and account profile data. Compromise allows impersonation and access to private assessment and billing information.
- **Career and resume data** -- uploaded resume text-derived assessments, readiness profiles, risk modifiers, ARK/JST/CCMI scores, game sessions, endorsements, and export/deletion data. These can contain sensitive professional and personal data.
- **Marketplace content and credits** -- paid Super Prompt Card (SPC) bodies, user credit balances, purchases, creator sales, and related ARK score deltas. Unauthorized access or tampering affects business logic and paid content.
- **Subscription and billing state** -- plan, subscription status, synthetic Stripe IDs, checkout sessions, and billing event audit history. Tampering can unlock paid features or corrupt audit trails.
- **Application secrets and external API access** -- `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USER_ID`, and Anthropic integration credentials. Disclosure or misuse can compromise the whole deployment or create unbounded AI costs.

## Trust Boundaries

- **Browser to Express API** -- all request bodies, route parameters, file uploads, and query strings are untrusted. Server-side authentication, authorization, validation, size limits, and rate limits must be enforced on every sensitive route.
- **Authenticated user to other users** -- routes returning assessments, exports, credits, purchases, game sessions, billing events, and private marketplace bodies must be scoped to `req.session.userId`, not client-supplied IDs.
- **Public to privileged/admin functions** -- seed, backfill, admin AI scenario generation, webhook simulation, and enterprise provisioning must not be reachable by unauthenticated or non-admin users in production.
- **Express API to PostgreSQL** -- database access is centralized in `server/storage.ts` and related service files. Queries must remain parameterized and transactional where money/credits/scores are modified.
- **Express API to uploaded files and parsers** -- resume uploads cross into PDF/text parsing and scoring. File type/size limits and parser error handling are required to avoid disclosure and denial of service.
- **Express API to Anthropic** -- user and assessment-derived content is sent to Claude through `server/ai/*`. Prompt construction, output parsing, token budgets, timeouts, and usage logging protect against cost abuse and unsafe downstream trust.
- **Production versus development/demo utilities** -- mockup sandbox and development-only conveniences are out of production scope unless reachable when `NODE_ENV=production`. In production, `NODE_ENV` is assumed to be `production`, platform TLS is automatic, and Vite/dev-server surfaces are out of scope.

## Scan Anchors

- Production entry points: `server/index.ts`, `server/routes.ts`, `server/auth.ts`, `server/storage.ts`, `server/static.ts`, `shared/schema.ts`.
- Highest-risk route groups: authentication and session routes; `/api/resume/upload`; `/api/billing/*`; `/api/sphinx/*`; `/api/ccge/*`; `/api/admin/*`; `/api/seed`; GDPR export/delete endpoints; public GUIN/profile and marketplace read APIs.
- External/AI surfaces: `server/ai/client.ts`, `server/ai/kcse.ts`, `server/ai/narrative.ts`, `server/ai/scenarioGen.ts`, `server/ai/usage.ts`, `server/ai/cache.ts`.
- Business-logic surfaces: `server/sphinx.ts`, `server/billing.ts`, `server/ccge.ts`, `server/arkRecalc.ts`, `server/orchestrator.ts`.
- Dev-only areas usually ignored in production unless proven reachable: Vite dev setup (`server/vite.ts`), client mock data, tests, build tooling, attached assets, and the mockup sandbox.

## Threat Categories

### Spoofing

Users authenticate with local credentials and server-side sessions. Login and register must resist brute force, passwords must remain hashed, sessions must be regenerated on login, and production must refuse missing `SESSION_SECRET`. Admin-only decisions based on `ADMIN_USER_ID` must fail closed when unset and must never rely on client-controlled identifiers.

### Tampering

Clients can submit assessments, resume uploads, game actions, marketplace listings, purchases, checkout completions, endorsements, and profile updates. The server must derive actor identity from the session, validate request bodies with narrow schemas, reject client-controlled score/credit/plan manipulation, and use transactions for any operation that changes credits, subscriptions, certifications, or ARK/JST/CCMI state.

### Repudiation

Billing transitions, marketplace purchases, ARK events, AI usage, and account deletion/export are sensitive. The system should persist audit records with actor, target, timestamp, and event type, and must not allow unauthenticated endpoints to mutate data without attribution.

### Information Disclosure

Assessments, resume-derived intelligence, billing data, credits, private paid prompt bodies, user exports, and session-specific game data must be restricted to owners or deliberately public DTOs. API responses and logs must avoid leaking passwords, secrets, private prompt bodies, full user records, raw resume content, stack traces, or unnecessary PII.

### Denial of Service

The app accepts JSON bodies, multipart resume uploads, PDF parsing, long-lived SSE connections, public marketplace/listing queries, seed operations, and AI calls. It must keep request/file size limits, rate limits, bounded parser/AI execution, and protection against unauthenticated expensive state-changing operations.

### Elevation of Privilege

Users must not be able to upgrade subscription plans, certification levels, ARK scores, credits, admin scenarios, or marketplace ownership outside the intended flows. Admin and seed/backfill functionality must be strongly gated server-side. All object-level access checks must be repeated inside transactions for high-value state changes.