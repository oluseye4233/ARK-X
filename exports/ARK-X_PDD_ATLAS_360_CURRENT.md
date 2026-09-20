<div class="cover">
  <div class="cover-inner">
    <div class="tag">ATLAS 360 · LIVING PRODUCT DEFINITION</div>
    <h1>ARK Platform<br/>Product Definition Document</h1>
    <div class="subtitle">Current repository baseline — evidence-led career intelligence, learning and verified capability exchange</div>
    <div class="manifesto"><strong>Evidence before assertion.</strong> This is a reverse-engineered living PDD: it describes the code now present, distinguishes controls from outcomes, and keeps unverified production, legal, and commercial claims outside the record.</div>
    <div class="meta"><div>Version 1.2.0 · 19 Sep 2026<br/>JNGL-ARK-PDD-LIVE-2026-014</div><div class="atanda"><strong>ATANDA</strong><span>ATLAS 360 PLAN</span></div></div>
  </div>
</div>

# ARK Platform — ATLAS 360 Living PDD
## Current Codebase Baseline · 19 September 2026

> **Living document status:** current repository baseline | **Version:** 1.2.0 | **Production ID:** `JNGL-ARK-PDD-LIVE-2026-014`
> **Honesty Gate:** Tier 1 — codebase verified; not independently production-certified | **GRO mode:** HUMAN_IN_LOOP  
> **Document owner:** ATLAS 360 PLAN format · ATANDA Publications Forum / Koncentric Labs Inc. | **Human principal:** Oluseye Shay Amusa
> **Date/time stamp:** 2026-09-19 23:59 CDT (America/Chicago) | **SPC roster used:** ATLAS 360 PLAN v4.0.1; ATLAS 360 SCAN v2.1.1; CODE DJ reverse translation; KLARITY/CARTER editorial rules; ALBERT IP boundary
> **JCSE / certification status:** WITHHELD — no separate independent assessor and no dimension-level scorecard; this is an internal living specification, not a certification

This revision updates, rather than replaces, `exports/ARK_PDD_Current_ATLAS_360.md`. It is a present-tense reconstruction of the synchronized ARK-X repository, hosted by ATLAS 360 SCAN and assembled in the ATLAS 360 PLAN 12-part format. It is not proof of a deployment, customer outcome, financial result, legal compliance, external federation, IP clearance, or infrastructure capability not demonstrated in source.

---

# PART 0 · Title, Contents & Provenance

## Contents
1. [Statement of Requirements](#part-1--statement-of-requirements)
2. [Business Case, Validation and Executive Summary](#part-2--business-case-validation-and-executive-summary)
3. [SPC Roster and System Inventory](#part-3--spc-roster-and-system-inventory)
4. [Platform Specifics](#part-4--platform-specifics)
5. [Atomic Prompt Worksheet](#part-5--atomic-prompt-worksheet)
6. [DJ Implementation and Maintenance Plan](#part-6--dj-implementation-and-maintenance-plan)
7. [Summary of Sources](#part-7--summary-of-sources)
8. [Definition of Terms](#part-8--definition-of-terms)
9. [IP Pre-Registration Screening](#part-9--ip-pre-registration-screening)
10. [Security and Governance Control Domains](#part-10--security-and-governance-control-domains)
11. [Regulatory Conformity Mapping](#part-11--regulatory-conformity-mapping)
12. [Living Delta and Review Rules](#appendix-a--living-delta-and-review-rules)

## Authorship and provenance

| Field | Value |
|---|---|
| Document title | ARK Platform — ATLAS 360 Living PDD · Current Codebase Baseline |
| Production ID / snapshot | `JNGL-ARK-PDD-LIVE-2026-014` · 19 September 2026 |
| Primary evidence | Current workspace source: routes, schema, flags, migrations, feature modules, and test source |
| Reference method | ATLAS 360 PLAN v4.0.1 12-part standard and ATLAS 360 SCAN v2.1.1 reconstruction/assurance discipline |
| Certification | No JCSE/HIVE/FORGE certification is assigned to this document |
| Review trigger | Merged feature, route/flag/schema change, material test change, or stage change |

**Scope boundary.** Code establishes intended executable behavior, not production traffic, production migration state, uptime, deliverability, payment settlement, customer outcomes, regulatory compliance, external system connection, or live register results.

---

# PART 1 · Statement of Requirements

## 1.1 Product requirements

| Requirement | Acceptance boundary |
|---|---|
| Produce bounded career intelligence | JST and CCMI remain within 0–300 each and ARK within 0–600; score provenance is explicit. |
| Turn evidence into useful action | Intake, assessment, pathways, practice, proof, reporting, identity and exchange remain linked without treating recommendations as credentials. |
| Protect identity and consent | Actors derive from authenticated sessions; public and matching DTOs remain narrow; contact details are not disclosed automatically. |
| Make paid access verifiable | Entitlement requires explicit Stripe or contract provenance; identifier shape, email match, badge URL or browser claim is not proof. |
| Survive interrupted commerce | Plan changes and cancellations are idempotent, recoverable and protected against competing operations. |
| Keep the journey understandable | ATOMIC UI exposes one primary action and L0–L9.5 progress while advanced tooling remains available through disclosure. |
| Keep documentation honest and living | Material route, schema, entitlement, consent, security or regulatory changes trigger PDD reconciliation. |

## 1.2 Single-page cheat sheet

| Field | Current evidence-bound state |
|---|---|
| Product | ARK — Advanced Resume & Karriere Synthesized Intelligence |
| Stage / experience | `Stage 1 · MVP`; ATOMIC UI presents an L0–L9.5 learning cockpit with one primary action, progress, origin/current/next context, document controls and progressive disclosure. |
| Identity | **ARK 0–600 = JST 0–300 + CCMI 0–300**; centralized recalc preserves the invariant. |
| Individual loop | Intake → scored identity → pathways/practice/verification → bounded recorded evidence → report, résumé and guidance surfaces. |
| Network surfaces | GUIN+ public profile is distinct from GUIN MAX consented mentor discovery and ARK Talent Exchange employer opportunity matching. |
| Client surface | 40 page files and 45 route definitions in the centralized client route registry, plus fallback behavior. |
| Server surface | 180 `app.get/post/put/patch/delete` declarations in `server/routes.ts`; declaration count is not an external reachability count. |
| Persistence | PostgreSQL through Drizzle; startup migration runner and `schema_migrations`; 39 SQL migration files through `0034_stripe_billing_recovery_health.sql`. |
| Quality inventory | 44 client/server/browser test files; TypeScript and focused ATOMIC UI validation passed on 19 September 2026. The full suite has extensive billing, privacy, matching and scoring coverage; this revision does not claim a fresh all-suite pass. |
| Delivery claim | Stripe-backed checkout, entitlement verification and billing recovery are implemented in source. No production settlement, external federation, or customer result is claimed without dated external evidence. |

**Atomic solution summary.** ARK computes a bounded career-intelligence identity from assessment/resume-derived signals and wraps it with practice, evidence, marketplace, learning, workforce, reporting, and matching surfaces. The newer consented network paths disclose no contact details automatically and re-check current eligibility before acceptance.

---

# PART 2 · Business Case, Validation and Executive Summary

## 2.1 Business case and validation boundary

ARK addresses fragmented career evidence: résumés, assessments, verified skills, contextual practice, learning pathways and marketplace activity commonly sit in separate systems. The product value hypothesis is that a single evidence-led loop can help an individual understand current capability, select a next action, package proof and participate in controlled exchange.

No revenue projection, market-size figure, demographic outcome, conversion result, employment result or ROI is asserted in this revision. Validation evidence is limited to repository behavior, tests actually run, source controls, and the explicit product journeys represented in code. Commercial validation requires dated production analytics and financial records outside this document.

## 2.2 Product intent and capability matrix

| Capability | Current implementation evidence | Boundary |
|---|---|---|
| Identity, assessment and pathways | `scoringEngine.ts`, `arkRecalc.ts`, `resumeAnalyzer.ts`, `/dashboard`, `/upload`, `/assessment`, `/pathways` | Scores are product metrics, not employment guarantees. |
| Practice and verification | `ccge.ts`, `cardVerification.ts`, `/play`, `/api/verification/*` | Recorded evidence and tiers are not a professional licence. |
| ARK Report, Guide and résumé | `/report`, `/r/:token`, `/ark-resume`, `arkResume.ts` | Report sharing is tokenized; résumé eligibility is plan/evidence gated. |
| Confirmation requests | `confirmation_invites`, `/confirm/:token`, confirmation routes | Claim matching, expiry, owner revoke/resend, narrow public DTO, atomic response. |
| Learning and marketplace | training routes, `trainingMatch.ts`, `sphinx.ts` | Provider recommendations/affiliate clicks and credits do not prove external credentials or live payment processing. |
| Workforce | `/enterprise`, `/workforce`, HR connector modules | Institution/role scoped; adapters/configuration are not proof of live external HR federation. |
| GUIN+ public profile | `/u/:username`, `guin.ts` | Public identity/profile surface; not mentor consent or employer review authority. |
| GUIN MAX | `/guin-match`, `guinMax.ts`, `/api/guin-max/*` | Consented, adult-attested, available, tier-and-evidence-gated mentor discovery only. |
| Talent Exchange | `/matchmaking*`, `matchmaking.ts`, introduction routes | Opportunity owner review of narrow consented cards; no automatic contact disclosure. |
| Billing and entitlement | Stripe checkout, monthly/annual plans, verified entitlement provenance, switching, cancellation and operation recovery | Source controls do not prove live settlement or production webhook health. |
| ACC-FACTORY bridge | RS256 HIVE eligibility assertion and JWKS routes | ACC-FACTORY remains the ARCHITECT subscription authority; ARK-X asserts eligibility only. |
| ATOMIC UI learning cockpit | `JourneyShell`, centralized route registry and responsive browser coverage | “L” means Learning; L0–L9.5 is a presentation/navigation model, not a new scoring system. |

## 2.3 Primary requirements and controls

| Requirement | Current control |
|---|---|
| Canonical score integrity | `server/arkRecalc.ts` is the single identity writer; caps and non-positive manual/backfill behavior are server-side. |
| Actor and object authorization | Session-derived `currentUserId`, `requireAuth`, `requireSelf`, role/institution checks, and owner checks in route flows. |
| Gated surface behavior | `requireFeature` returns 404 for disabled flagged server surfaces; client routes use static defaults. |
| Data minimization | Public user DTOs, GUIN/MAX narrow result DTOs, candidate inbox exclusions, and no contact disclosure on accepted requests. |
| Atomic terminal transitions | Storage transition methods and pending-only route checks protect accept/decline/cancel races. |
| Discoverability without indexing private application paths | `SeoMetadata.tsx` sets canonical/meta/OG/Twitter data and makes only mapped public pages `index, follow`; others are `noindex, nofollow`. |

## 2.4 Material risks

| Risk | Present mitigation | Evidence gap |
|---|---|---|
| Score farming | source/window caps, transactional recalc and tests | production adversarial monitoring |
| Cross-user or employer overreach | session/owner checks and narrow DTOs | independent security review |
| Consent/evidence becoming stale | acceptance re-evaluates open/owner/consent/evidence eligibility and cancels if invalid | policy/legal review |
| Confirmation misuse | cited-claim validation, expiry, one-use resolution, revoke/resend replacement tokens | deliverability and abuse monitoring |
| SEO overexposure | public-page map and noindex default | deployed crawler validation |
| Billing state drift or replay | verified Stripe provenance, operation records, idempotency, supersession, recovery health and concurrency coverage | production settlement/reconciliation evidence |
| Cross-platform entitlement overreach | signed short-lived ARK eligibility; ACC remains subscription authority; no email or badge-URL proof | activation in the actual ACC workspace and SPHINX reverse-publish contract |

---

# PART 3 · SPC Roster and System Inventory

## 3.1 PDD method roster

| Contributor / method | Role | Status |
|---|---|---|
| ATLAS 360 PLAN | Ten-part assembly, Honesty Gate, atomic decomposition | Method applied |
| CODE DJ / reverse translation | Source-to-PDD inventory and traceability | Human/agent document method, not an ARK runtime dependency |
| KLARITY / CARTER editorial rules | Plain language and stable terminology | Editorial rule |
| ALBERT layer | Candidate IP-screening boundary | Included as unrun, non-advisory section |

## 3.2 Measured repository inventory

| Item | Observed count |
|---|---:|
| Client page files | 40 |
| Explicit client route declarations | 45 |
| Server TypeScript files | 113 |
| Shared TypeScript files | 8 |
| SQL migrations | 39 |
| Static feature keys | 22 |
| Client/server/browser test files | 44 |
| Server route declarations | 180 |
| Registered client routes | 45 |
| Tracked repository files | 474 |

The last row is supplied GitHub recursive-tree context and uses a different inclusion rule from local extension/file scans; it should not be combined arithmetically with the other rows.

## 3.3 Ownership map

| Domain | Primary locations |
|---|---|
| Runtime, sessions, headers | `server/index.ts`, `server/auth.ts`, `server/static.ts` |
| Database and lifecycle | `server/db.ts`, `server/storage.ts`, `server/migrate.ts`, `shared/schema.ts`, `migrations/` |
| Identity and events | `server/scoringEngine.ts`, `server/arkRecalc.ts`, `server/lhcs.ts`, `server/orchestrator.ts` |
| AI | `server/ai/*`, `server/resumeAnalyzer.ts`, `server/profileExtract.ts` |
| Workforce | `server/workforceConnectionTest.ts`, `server/hrConnectors/*`, `server/hrScheduler.ts` |
| Matching | `server/matchmaking.ts`, `server/guinMax.ts`, `server/guin.ts` |
| Web routes/UI | `server/routes.ts`, `client/src/App.tsx`, `client/src/pages/*`, `client/src/components/SeoMetadata.tsx` |
| Learning cockpit | `client/src/components/layout/JourneyShell.tsx`, `client/src/routes.ts`, `client/src/components/layout/AppLayout.tsx` |
| Billing | `server/stripe.ts`, billing routes/storage, Stripe migrations and billing test suites |
| ACC eligibility | `server/accFactoryBridge.ts` and bridge routes/tests |

---

# PART 4 · Platform Specifics

## 4.1 Identity, evidence and score semantics

```text
JST  = (Jobs × .30 + Skills × .40 + Talent × .30) × 3
CCMI = weighted P1–P7 × 3
ARK  = JST + CCMI
0 ≤ JST, CCMI ≤ 300; 0 ≤ ARK ≤ 600
```

`server/scoringEngine.ts` calculates the score model and `server/arkRecalc.ts` persists identity fields atomically. CCGE, verification, book, and marketplace records are different evidence types. A training recommendation is not a credential; a verification record is not automatically a public badge; ARK résumé eligibility is not a licence.

## 4.2 Three deliberately separate people/network products

| Surface | Who can see/use it | Admission and disclosure |
|---|---|---|
| **GUIN+ public profiles** | Public route `/u/:username` when `guinPublic` is on | Profile/endorsement identity surface. It is not proof of GUIN MAX opt-in and does not itself permit mentor or employer contact. |
| **GUIN MAX mentor discovery** | Authenticated `/guin-match` and `/api/guin-max/*` when `guinMax` is on | Both discovery participants must currently opt in, attest adulthood, be available, select a recognized tier, and have qualifying `verified` evidence. Region/language constraints require explicit matches. |
| **Employer opportunity matching** | Authenticated `/matchmaking*` when `matchmaking` is on; candidate review/introduction additionally requires `guinMax` | An owner of an **open** opportunity alone may review eligible narrow candidate cards and request an introduction. It uses consented candidates, not unrestricted profiles. |

### GUIN MAX mechanics

`isGuinMaxEligible` rejects missing opt-in, adult attestation, availability, a recognized selected tier, insufficient selected-tier evidence, unmet tier floor, and mismatched constrained region/language. `discoverGuinMax` is deterministic: CXS is 60% verified-need coverage, 20% CCMI cosine affinity, 10% JST readiness, and 10% A/O/C complement; ties sort by user ID. Discovery records return evidence/rationale/radar rather than contact fields. Requests have pending/accepted/declined/cancelled transitions; only requester may cancel and only candidate may accept or decline. Acceptance rechecks both parties’ consent and current verified evidence, cancelling stale requests instead of accepting them.

### Talent Exchange hiring-company integration

An authenticated user can post validated JOB or PROJECT opportunities with known CODEC primitives, tier requirements, weights, JST floor, and optional archetype/location conditions. `scoreUserForOpportunity` is deterministic and evidence-led: weighted verified-card coverage 70%, JST factor 20%, archetype fit 10%. It returns **current fit** and a separately labelled **projected fit** that assumes missing/under-tier requirements reach their stated minimum; projected fit is not current evidence.

Employer candidate review runs only for the owner of an open opportunity. The response carries CXS, algorithm version `ark-cxs-verified-evidence-v1`, evidence, requirements, gaps, rationale, and fit/radar fields—not résumé data, contact data, raw submissions, usernames, or passwords. A pending unique pair prevents duplicate active introductions. Candidate inboxes include limited opportunity context and employer label but no employer contact/private account fields. Candidate acceptance refreshes owner/open/consent/evidence eligibility and score snapshot; stale requests cancel. Terminal actions are pending-only/authorized and storage transitions make concurrent terminal actions single-winner. Acceptance explicitly leaves contact details private.

## 4.3 Confirmation request lifecycle

ARK résumé confirmation invitations validate that the cited SKILL, EMPLOYMENT, or CERTIFICATION claim exists under the same matching semantics used by résumé rendering. Candidate-owned pending invitations can be revoked (token becomes unusable) or resent; resend mints a new token and expiry, invalidating the prior link. Public token reads expose only recipient decision data. Public response validates bounded fields, expires stale invitations, atomically records the outcome/confirmation, rejects a second answer, and makes candidate notification best-effort. Email delivery has an explicit manual-link fallback rather than silent success. Source includes branded confirmation-email coverage, but mail configuration/delivery is not asserted.

## 4.4 Privacy, deletion and security boundaries

Authenticated users can export their data and request deletion with literal `DELETE` confirmation. `deleteUserCascade` is transactional and explicitly deletes Talent Exchange introductions where the user is employer or candidate before deleting the user. **Deletion caveat:** the observed cascade does not explicitly delete `guin_max_profiles` or `guin_max_match_requests`; `0024_guin_max.sql` does not show foreign-key cascade clauses. That is a material cleanup gap to resolve before claiming full GUIN MAX deletion cleanup. Session cookies, bcrypt at storage boundary, `helmet`, body limits, rate limits, server-derived actor IDs, and scoped DTOs are implementation controls. They are not a claim of an independent penetration test.

## 4.5 Workforce, search, PDF and SEO

The workforce/enterprise surfaces provide institution-scoped aggregation, AND-stacked filter slices, bounded department drill-down and organization-wide name search, connector test/configuration and scheduled-sync code, and respectful staff nudges with a shared seven-day cooldown. Source also contains workforce PDF/export-oriented work; no claim is made that a particular generated PDF was reviewed or that an HR adapter is connected to a live provider.

Public-page SEO is explicitly mapped in `shared/publicSeo.ts` and applied client-side by `SeoMetadata.tsx`: canonical URLs, title/description, Open Graph and Twitter metadata; public mapped pages index/follow and unrecognized/private paths default noindex/nofollow. `server/__tests__/seo.test.ts` exists. This is source behavior, not proof of search-engine crawling or ranking.

## 4.6 Verified commerce and cross-platform authority

ARK-X uses Stripe-backed checkout and explicit provider/contract provenance for paid access. Monthly and annual plans, safe prorated switching, cancellation, idempotent recovery, supersession of stale operations and recovery-health visibility are implemented as source controls. Stripe Search is treated as eventually consistent in fixture validation. These controls reduce duplicate or stale side effects; they do not by themselves prove production settlement.

ARCHITECT subscriptions remain owned by ACC-FACTORY. ARK-X may issue a short-lived RS256 eligibility assertion when durable HIVE evidence is verified, score is at least 80, and tier is Gold or Platinum. ACC must authenticate and link its own customer, verify the assertion against pinned keys and claims, and own discount redemption and checkout. Public badges, share links, browser claims, shared sessions and email matching are never authority.

## 4.7 ATOMIC UI learning journey

The product shell presents eleven learning checkpoints: L0 Start, L1 Intake, L2 Assessment, L3 Intelligence, L4 Pathways, L5 Context, L6 Proof, L7 Report, L8 Identity, L9 Exchange and L9.5 MERLIN. Each route resolves through a centralized registry into a current stage. The cockpit shows progress, where the user came from, the current action, the next destination, upload/download controls and one connected feature. Advanced tools remain available through disclosure rather than competing with the primary action. The black ATANDA palette improves contrast while preserving the supplied yellow, blue, red, teal, coral and purple identity.

---

# PART 5 · Atomic Prompt Worksheet

| ID | Atomic operation | Input → output | Validation/evidence | Owner |
|---|---|---|---|---|
| FND-001 | Apply migrations | SQL files → ledgered schema update | `server/migrate.ts`; migration-status test source | `server/migrate.ts` |
| IDN-001 | Recalculate identity | event/state → atomic ARK/JST/CCMI state | scoring/cap test sources | `server/arkRecalc.ts` |
| IDN-002 | Stream identity event | recalculation → SSE snapshot/update | `server/orchestrator.ts`, `/api/ark-score/stream` | `server/routes.ts` |
| EVD-001 | Finalize CCGE | owned session/cards → scored outcome | transactional finalize contract | `server/storage.ts` |
| EVD-002 | Verify primitive | evidence prompts → tiered verification record | verification engine/routes | `server/cardVerification.ts` |
| CNF-001 | Create confirmation invite | owned existing claim + recipient → expiring token | claim matcher and invite storage | `server/routes.ts` |
| CNF-002 | Resolve confirmation once | valid pending token + response → confirmation/status | expiry/duplicate response branches | `server/storage.ts` |
| CNF-003 | Revoke/resend confirmation | owner + pending/expired invitation → invalidated or fresh token | owner-scoped routes | `server/routes.ts` |
| MNT-001 | Qualify mentor | profile/evidence/search → eligible or excluded | `isGuinMaxEligible`; `guinMax.test.ts` | `server/guinMax.ts` |
| MNT-002 | Rank mentors | qualified rows → deterministic CXS cards | stable tie sort and no-sensitive-field test | `server/guinMax.ts` |
| MNT-003 | Resolve mentor request | pending request + authorized action → one terminal state | current consent/evidence recheck, race tests | `server/routes.ts` |
| HIR-001 | Score candidate fit | verified cards + opportunity → current/projected fit | pure `matchmaking.ts` contract | `server/matchmaking.ts` |
| HIR-002 | Review candidate cards | open opportunity owner → narrow eligible cards | owner/open/consent/tier test | `server/routes.ts` |
| HIR-003 | Request/resolve introduction | owner request or candidate action → protected state transition | consent/evidence recheck and race test | `server/routes.ts` |
| GOV-001 | Delete account-owned data | authenticated `DELETE` confirmation → transactional listed-table cascade + session removal | privacy route/storage contract; GUIN MAX orphan-risk caveat in Part 4 | `server/storage.ts` |
| WFR-001 | Search workforce | scoped query/paging → bounded staff result page | department/workforce test sources | `server/storage.ts` |
| SEO-001 | Set page metadata | browser location → canonical/meta/robots values | `SeoMetadata.tsx`, `seo.test.ts` | `client/src/components/SeoMetadata.tsx` |
| BIL-001 | Establish paid entitlement | verified Stripe/contract evidence → explicit access provenance | checkout/webhook/entitlement tests | billing routes and storage |
| BIL-002 | Recover interrupted billing change | durable operation + Stripe state → one applied outcome | replay, supersession and concurrency tests | billing routes and recovery |
| ACC-001 | Assert HIVE eligibility | verified HIVE evidence → bounded RS256 assertion | bridge route tests and JWKS | `server/accFactoryBridge.ts` |
| UI-001 | Resolve learning stage | registered route + feature state → L0–L9.5 cockpit state | unit and responsive browser tests | `JourneyShell` and client route registry |

**Traceability rule:** every future atomic row must name a parent capability, actual code owner, observable input/output, and validation evidence. A proposal without a parent is diagnosis/backlog, not current implementation.

---

# PART 6 · DJ Implementation and Maintenance Plan

## 6.1 Current tool/runtime map

| Concern | Current source-backed selection |
|---|---|
| Application | TypeScript, React/Vite client, Express server, wouter routing |
| Data | PostgreSQL and Drizzle ORM; PG-backed sessions |
| AI | Anthropic/OpenAI/Gemini provider-layer support, plan/model policy, usage/budget/cache controls |
| Test/tooling | Node tests via `tsx`, client component tests and responsive browser tests; TypeScript and focused journey checks passed on 19 September 2026 |
| PDD rendering | `scripts/renderPdd.ts`, Puppeteer/Chromium and `scripts/pddStyles.ts` |

## 6.2 Maintenance cadence

| Trigger | PDD action |
|---|---|
| Route/page/flag change | Recount inventory; revise Parts 1, 3, 4 and worksheet. |
| Migration | Update SQL count, highest filename and schema/data-flow notes. |
| Consent/matching change | Re-evaluate eligibility, DTO disclosure, stale-request and deletion boundaries; add/record tests. |
| Workforce/SEO/PDF change | Separate source capability from a deployed/crawler/rendered outcome. |
| Production evidence | Add it as dated evidence; never infer it from source. |

## 6.3 Known non-claims / follow-on evidence

No external HR federation, Neo4j, Pinecone, GRO AI runtime, IP-register search, production deployment certification, customer KPI, or legal clearance is established by this PDD. Stripe integration exists in source, but live settlement and production reconciliation are not certified here. ACC production activation and SPHINX reverse-publish remain outside this repository baseline.

---

# PART 7 · Summary of Sources

| Source | Use | Confidence |
|---|---|---|
| `replit.md` | Active architecture, formulas, security and feature context | VERIFIED-INTERNAL |
| `shared/schema.ts`, `shared/featureFlags.ts` | Schema contracts, 25 flags, constants, matching entities | VERIFIED-INTERNAL |
| `server/routes.ts`, `server/storage.ts` | Endpoint behavior, lifecycle, authorization, transaction boundaries | VERIFIED-INTERNAL |
| `server/guinMax.ts`, `server/matchmaking.ts` | Eligibility, deterministic score and fit semantics | VERIFIED-INTERNAL |
| `server/__tests__/guinMax.test.ts`, `matchmakingIntroductionsRoute.test.ts` and other test files | Regression intent/protections | VERIFIED-INTERNAL; full suite rerun on 06 September 2026: 313 passing |
| `client/src/App.tsx`, `SeoMetadata.tsx`, `shared/publicSeo.ts` | Route and metadata behavior | VERIFIED-INTERNAL |
| `migrations/*.sql` | Migration inventory/history | VERIFIED-INTERNAL |
| `attached_assets/ATLAS_360_PLAN_v3_0_0_ALBERT_Integration_1788458849105.pdf` | PDD method/structure | VERIFIED-REFERENCE |

Historical PDDs, task titles, future plans, and comments are not proof where they conflict with executable current source. Current source wins.

---

# PART 8 · Definition of Terms

| Term | Definition in this PDD |
|---|---|
| ARK / JST / CCMI | Bounded composite identity / Jobs-Skills-Talent index / seven-pillar Context Craft Mastery Index. |
| CCGE / JCSE / KCSE / HIVE | Practice engine / session quality vocabulary / in-game rubric / marketplace quality gate; do not collapse them into one credential. |
| GUIN+ | Public identity/profile layer, distinct from discovery consent. |
| GUIN MAX | Consent-controlled, adult-attested, availability/evidence-gated mentor discovery and request lifecycle. |
| CXS | Match score label. In GUIN MAX it is the specified radar sum; in employer review it is the verified-evidence opportunity match score and algorithm version. |
| Current fit | Score from evidence held now. |
| Projected fit | Counterfactual score if listed gaps reach required tiers; never current verified evidence. |
| Introduction | Owner-requested, candidate-controlled Talent Exchange lifecycle; acceptance does not disclose contact details. |
| Confirmation invite | Expiring tokenized request to substantiate an existing résumé claim. |
| Living PDD | Repository-derived document requiring reconciliation after material change. |
| L0–L9.5 | ATOMIC UI learning-stage sequence; “L” means Learning. |

---

# PART 9 · IP Pre-Registration Screening

## 9.1 Status
**No live register search was run.** This is a candidate inventory, not a trademark clearance, patentability view, filing recommendation, freedom-to-operate conclusion, legal advice, or legal opinion.

| Candidate | Current context | Status |
|---|---|---|
| ARK, ARK Report, ARK Guide, ARK Resume | identity/report/résumé surfaces | UNSEARCHED |
| MERLIN, Context Craft, CCMI, JST, CCGE | guidance/scoring/practice vocabulary | UNSEARCHED |
| SPHINX, GUIN+, GUIN MAX, Talent Exchange, CXS | marketplace/profile/discovery/matching vocabulary | UNSEARCHED |
| HIVE | publishing quality-gate vocabulary | UNSEARCHED |

Any future authorized screening record must state jurisdiction/class, date, exact variants, registers queried, results/source links, search scope, and the same non-advisory caveat.

---

# PART 10 · Security and Governance Control Domains

The ATLAS 360 SCAN v2.1.1 assurance rule separates **Presence** from **Effectiveness**. “Observed” means source or configuration was inspected. “Tested” means a relevant automated check was run or is present; it does not mean an independent security assessment occurred.

| Control domain | Presence | Effectiveness evidence | Confidence / target | Owner / gap |
|---|---|---|---|---|
| Identity and access | Observed | Session-derived actors, authentication/ownership checks and narrow DTO tests | High / independent access-control review | Application routes and storage |
| Tool permissions | Observed | Server-side feature and role gates; external connector permissions not independently audited | Moderate / least-privilege connector review | Platform operations |
| Human approval | Observed | Customer confirmations, consent gates and fail-closed ACC customer-auth boundary | Moderate / production workflow evidence | Product and operations |
| Data governance | Observed-Tested | Privacy export/deletion paths and regression coverage | Moderate / large-account and schema-drift assurance | Privacy owner |
| Prompt injection | Artifact | AI provider and budget controls exist; no independent adversarial prompt assessment recorded here | Low / threat-led red-team evidence | AI security owner |
| Cost containment | Observed-Tested | Token and absolute cost gates, plan limits and cache controls | High for source behavior / production spend reconciliation | AI and billing owners |
| Marketplace / supply chain | Observed-Tested | Verified evidence gates, consent rechecks, signed ACC eligibility and strict ownership boundaries | Moderate / external ACC and SPHINX contract tests | Marketplace owners |
| Auditability | Observed-Tested | Migration ledger, billing operations, provenance and ARK history surfaces | Moderate / production retention review | Platform owner |
| Incident response | Artifact | Recovery-health and retry behavior exist for billing; no organization-wide incident exercise is evidenced | Low / runbook exercise and named responders | Operations |

**Containment triggers:** Part 10 or Part 11 absent; a control called Effective without linked test evidence; an Evidence-Backed-or-higher conformity claim without a named assessor; a bare “certified” claim; or external-standard language without currency data.

---

# PART 11 · Regulatory Conformity Mapping

## 11.1 Conformity status and honesty boundary

ATLAS 360 v4.0.1 defines: **Unmapped → Mapped → Self-Attested → Evidence-Backed → Independently Audited → Certified by Accredited Body**. This PDD does not grant the last two states. No accredited-body certification, legal determination or regulatory compliance outcome is claimed.

The Regulatory Conformity Layer components—Control Framework Registry, Jurisdiction & Industry Classifier, Control Mapping Engine, Conformity Evidence Binding and Conformity Status Model—are reference-method requirements. ARK-X does not currently implement a complete atomic regulatory control registry or automated jurisdiction classifier. Therefore mappings below remain **Mapped** or, where source evidence is named, **Self-Attested**.

## 11.2 External framework mapping

| External framework / regime | As-of / reverify | Relevant ARK-X control areas | Evidence confidence | Status |
|---|---|---|---|---|
| NIST AI RMF 1.0 | As published Jan 2023 / reverify annually | provenance, human oversight, bounded scoring, monitoring gaps | Moderate | Mapped; not certified |
| NIST Cybersecurity Framework 2.0 | As published Feb 2024 / reverify annually | identity, protection, auditability, recovery and incident-response gaps | Moderate | Mapped; not certified |
| ISO/IEC 42001:2023 | Reverify annually | AI management, risk, provider controls and human-in-loop boundaries | Low–Moderate | Mapped only |
| ISO/IEC 27001:2022 | Reverify annually | access control, data governance, logging, supplier and incident domains | Low–Moderate | Mapped only |
| EU AI Act | Phased obligations through 2027 / reverify quarterly | transparency, data governance, human oversight and consequential-use classification | Low | Applicability not legally determined |
| Applicable privacy law | Jurisdiction-dependent / reverify before launch in each market | export, deletion, consent, minimization and retention | Moderate for source controls | No legal compliance claim |

## 11.3 Internal framework naming integrity

ARK, JST, CCMI, CCGE, JCSE, KCSE, HIVE, SPHINX, GUIN and ATLAS are internal product/framework terms. They must not carry ISO, IEC, NIST or another standards-body prefix. External standards and internal frameworks remain in separate tables and no unqualified use of “certified” is permitted.

## 11.4 Regulatory evidence gaps

1. No named independent assessor or security reviewer has evaluated this PDD.
2. No complete atomic Control Framework Registry or evidence ledger exists.
3. No jurisdiction/industry classifier has established which legal regimes apply to a specific deployment.
4. No accredited certification body has assessed ARK-X.
5. Production processing locations, subprocessors, retention periods and incident exercises require external evidence.

---

# APPENDIX A · Living Delta and Review Rules

## A.1 Delta from the 06 September baseline

- Inventory updated to **39 migrations**, **40 page files**, **45 registered client routes**, **180 server route declarations**, **44 test files**, and **474 tracked files**.
- Adds real Stripe checkout, monthly/annual billing, verified entitlement provenance, switching, cancellation, concurrency controls, idempotent operation recovery, stale-operation supersession and recovery-health evidence.
- Adds expanded privacy export/deletion coverage and keeps explicit caveats where future tables must remain synchronized.
- Adds labour-market provenance and clarifies that JST is deterministic and standards-aligned through curated O*NET, SFIA and WEF mappings—not a live feed from those sources.
- Adds the ARK-X side of the ACC-FACTORY ARCHITECT bridge with signed HIVE eligibility and strict ownership boundaries.
- Adds the black ATANDA ATOMIC UI cockpit, centralized route registry and L0–L9.5 learning-stage model with unit and responsive browser coverage.
- Retains score, consent, matching, confirmation, SEO, workforce, provenance, glossary and IP non-advisory constraints.

## A.2 Drift bands and update protocol

| Band | Meaning | Response |
|---|---|---|
| GREEN | Route/schema/behavior and this PDD agree; no unsupported claim | routine next-increment review |
| AMBER | Source changed without reconciliation | do not call this document current until reviewed |
| RED | Unsupported capability, security omission, misleading credential, or production/legal assertion | invalidate affected section and re-baseline |

1. Recount files/routes/migrations/flags/tests using repeatable commands.
2. Inspect source contracts, not only UI text or issue titles.
3. Update affected ATLAS parts and atomic rows, preserving provenance and non-claims.
4. Run the repository’s check/test/migration health commands and record actual dated results only when run.
5. Render and visually inspect separately; do not overwrite historical PDFs.

> **Closing statement:** This is an ATLAS 360 living PDD of the ARK-X repository observed on 19 September 2026. It must move with the code, not be trusted after the code moves.

© 2026 Oluseye Shay Amusa · Koncentric Labs Inc. · ATANDA Publications Forum. No certification or legal conclusion is implied.