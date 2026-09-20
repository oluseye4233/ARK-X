# ATANDA.ai ↔ ARK-X Capability and API Alignment Matrix

**Purpose:** make every capability presented by ATANDA.ai traceable to an ARK-X-owned contract, server-enforced control, persistent record, and testable user journey.

**Evidence cut:** ATANDA.ai public homepage reviewed 6 September 2026; ARK-X current workspace reviewed on the same date.

## Status language

- **Live in code:** a persistent ARK-X implementation and server contract exist. This does not, by itself, prove production readiness.
- **Partial:** important parts exist, but the advertised journey or its controls are incomplete or unverified.
- **Demo:** illustrative data or simulated behavior; it must be labelled as such.
- **Blocked:** must not be represented as live until the named dependency is completed.
- **Planned:** no complete operational contract exists.

## Alignment matrix

| Capability or public claim | ARK-X-owned contract and persistence | Current controls | Evidence-based status | Alignment action |
|---|---|---|---|---|
| Upload a CV or paste text | `/api/resume/upload`, `/api/assessment/text`, assessment and source records | Authentication, self-scoped assessment access, upload limits | **Live in code** | Add a production journey test for PDF, DOCX, pasted text, malformed files, and source removal. |
| “In under 60 seconds” analysis | Resume extraction, scoring, synthesis and assessment routes | Rate limits exist on the public assessment path; authenticated processing is user-scoped | **Partial** | Measure production p50/p95 completion time. Replace the absolute claim if the measured service level cannot support it. |
| Dated, curated career-capital scoring | Scoring, CCGE/Jnomics, vulnerability and pathway modules | Score responses expose `provenance` and `dataAsOf`; server computes results from static code-defined rules | **Live in code — not a live data feed** | Public wording now states the actual curated update cadence. A future external dataset must identify its provider and dated release before “live” claims are restored. |
| JST Index valuation | Assessment, identity and scoring APIs | User ownership on assessment reads/writes; score version, methodology and date are returned | **Live in code** | Keep provenance contract tests and update the model date/version whenever scoring inputs are reviewed. |
| AI vulnerability classification | Assessment/scoring pipeline and task-risk outputs | User-scoped assessment access; AI budget controls where AI is invoked | **Live in code** | Verify public level labels match server enums and add an end-to-end result rendering test. |
| 12-vector mobility and pivot pathways | Vector, pathway and upskilling records linked to an assessment | User-scoped assessment access | **Live in code** | Define a canonical pathway DTO and test empty, partial and recomputed assessments. |
| ARK Guide and report export | Report, executive-report and sharing routes; persisted assessment/profile data | Feature gate, authenticated owner operations, public token for shared report | **Partial** | Add route tests for owner-only create/revoke, expired/revoked/invalid tokens and public-response redaction. |
| Profile, privacy, export and deletion | Self profile update, `/api/users/me/export`, `/api/users/me` deletion | Authentication and self checks | **Partial** | Add cross-user denial, export-redaction, deletion-idempotency and complete account-cleanup tests. |
| Pricing and paid subscriptions | Plan, checkout, completion, cancellation and billing-event records | Authentication and checkout ownership | **Demo / Blocked for paid production** | Current checkout is explicitly simulated. Connect a real payment provider, verify webhooks server-side, and reload entitlements from `/api/billing/me`; do not advertise paid activation as live beforehand. |
| Institution workforce intelligence | Workforce import, connector, staff, intelligence and CSV routes | Feature gate, authentication, ENTERPRISE plan, institution derived from session | **Live in code; assurance incomplete** | Complete the existing institution-admin route regression work across every read, mutation and export. |
| Schools and cohorts | Cohort, membership, assignment and grade routes | Instructor role gate | **Partial** | Verify institution/tenant boundaries in addition to instructor role; add cross-institution route tests. |
| Training provider discovery | Provider directory, suggestions, registration, moderation and click tracking | Feature gate, authentication, plan entitlement, owner/admin checks | **Live in code** | Add contract tests for entitlement, ownership, moderation, outbound URL safety and sponsored-result disclosure. |
| GUIN MAX mentor discovery | Profile, discover, request and inbox APIs; consent/evidence records | Adult attestation, opt-in, availability, verified evidence and participant authorization | **Live in code** | Add route-level unauthenticated, malformed-payload, duplicate-request and feature-off tests. |
| Talent Exchange and employer matching | Opportunity, candidate, application, team and introduction APIs | Authentication, opportunity ownership, consent/evidence revalidation and atomic transitions | **Live in code; assurance incomplete** | Add contract tests for the full create/list/detail/apply lifecycle and client navigation for verification prerequisites. |
| Public GUIN profile and endorsements | Public profile and endorsement APIs | Feature gates; selected reads are intentionally public | **Partial** | Define the public DTO explicitly and test private/unapproved profiles plus sensitive-field redaction. |
| Investor/demo experience | `/demo` and `/demo-tour` use illustrative personas and metrics | Feature gate only; no backend is expected | **Demo** | Display “Illustrative demo data — not live analytics” prominently anywhere the experience could be mistaken for an account result. |
| Administrative scenario generation, billing simulation and imports | `/api/admin/*` route families | Authentication plus configured administrator checks on reviewed mutation routes | **Internal only** | Consolidate the repeated administrator check into shared middleware and add non-admin denial tests for every admin mutation. |
| Development database seed | `/api/seed` writes canonical and demonstration records | Production hard stop; authentication and configured administrator authorization | **Internal only — corrected** | Keep inaccessible to anonymous and non-admin users in every environment; retain regression coverage. |

## API control standard

Every data-bearing operation should apply the relevant controls in this order:

1. Feature availability.
2. Authentication.
3. Tenant or institution scope derived from the session.
4. Role and entitlement.
5. Resource ownership or participant relationship.
6. Consent and verified-evidence requirements.
7. Valid lifecycle transition and atomic persistence.
8. Audit event.
9. Response minimization and stable error code.

Client routing and hidden navigation are user-experience aids only. They are never authorization.

## Priority register

### P0 — truth and financial integrity

1. Retain the dated provenance contract and do not restore “live labour-market data” wording without a traceable external provider and refresh process.
2. Mark checkout as simulated or remove paid purchase calls to action until a real provider and verified webhook flow are connected.
3. Keep destructive seed/admin operations unavailable to anonymous or ordinary authenticated users.
4. Add report-token and profile/privacy redaction tests.

### P1 — privileged operational journeys

1. Complete workforce route authorization and institution-isolation coverage.
2. Verify cohort isolation, not only instructor status.
3. Add a shared administrator middleware and denial suite for every `/api/admin/*` mutation.
4. Add complete matchmaking create-to-introduction contract coverage.

### P2 — presentation alignment

1. Add route-level sign-in and authorization states to privileged frontend pages while retaining server enforcement.
2. Label all illustrative demo data.
3. Remove or wire dead workflow controls.
4. Generate frontend request/response types from ARK-X-owned schemas instead of maintaining parallel service/type authorities.

## Release rule

A capability may be described as **live** only when:

- its public wording matches the implemented contract;
- the server enforces authentication, scope, role, ownership, consent and entitlement as applicable;
- success persists and can be read back from the system of record;
- failure, empty, expired and revoked states are represented;
- the critical journey has an automated contract or browser test; and
- production monitoring can distinguish user error, policy denial, dependency failure and server failure.

Anything else must be labelled **Beta**, **Preview**, **Demo**, or **Planned**.