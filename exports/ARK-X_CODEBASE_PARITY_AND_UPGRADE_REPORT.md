<div class="cover">
  <div class="cover-inner">
    <div class="tag">ATANDA · ATLAS 360 · DECISION BRIEF</div>
    <h1>ARK-X Codebase<br/>Parity &amp; Upgrade Report</h1>
    <div class="subtitle">Evidence-bound comparison of the GitHub ARK-X draft and the present project baseline</div>
    <div class="manifesto"><strong>Merge semantics, not snapshots.</strong> The recommended path retains the present codebase’s consent, lifecycle, SEO, and migration protections while importing the remote Living Resume Designer and Atomic Gauntlet as reviewed, additive capabilities.</div>
    <div class="meta"><div>06 September 2026<br/>ATANDA-ARKX-PARITY-2026-001</div><div class="atanda"><strong>ATANDA</strong><span>ATLAS 360 PLAN</span></div></div>
  </div>
</div>

# Executive verdict

## Decision: do not overwrite either `main`; pursue a guarded, bidirectional reconciliation branch

The present project at `d3b19e6a71884ceff1fed7529af9cb8d05c389f3` is the safer integration baseline. It contains material additions not in GitHub ARK-X at `dc172c425b252ba09d66fe4c3ceba916fa56a151`: MERLIN guidance, GUIN MAX’s consent/evidence gates, Talent Exchange introduction lifecycle controls, SEO delivery, migration-inventory health checks, and targeted tests. The GitHub snapshot contains two meaningful additive product surfaces absent locally: **Living Resume Designer** and **Atomic Gauntlet**.

**Approve discovery and implementation planning now; do not approve a file-level merge or production release from this comparison.** Import the remote capabilities semantically into a new integration branch, keep both new flags off by default until validation, and resolve the migration-number collision before any database is touched. The remote Gauntlet’s balance check and later debit are not atomic; it must be redesigned as an atomic conditional debit plus durable run recording before it is enabled.

## One-page leadership summary

| Decision area | Evidence-bound finding | Direction |
|---|---|---|
| Baseline | 344 of the compared paths have identical content; the present workspace was clean at the stated HEAD. | Branch from present HEAD; preserve it as the integration base. |
| Product gain | GitHub-only files implement a client-local Living Resume wizard/export and an AI/heuristic Gauntlet review. | Import as additive, flagged modules after design/security review. |
| Product safeguards | Present-only GUIN MAX and introductions use opt-in, adult attestation, verified evidence, narrow cards, pending-only transitions, and regression tests. | Treat these as non-negotiable preservation requirements. |
| Database | Both lines use filename prefix `0024` for incompatible DDL. | Never rename a published migration blindly; create a new next migration for Gauntlet and support both historical ledgers. |
| Release confidence | This is static repository evidence, not a union build, test, staging, or production observation. | Require the validation matrix before enabling either new capability. |

> **Honesty gate.** No claim is made that the two branches have been merged, that their union compiles or passes tests, that any migration ledger exists in a live database, or that any AI provider, federation, GRO process, payment, or production deployment operates as described.

# 1. Method, provenance and evidence limits

| Field | Evidence |
|---|---|
| Remote comparator | GitHub ARK-X `dc172c425b252ba09d66fe4c3ceba916fa56a151`, 06 Sep 2026 16:51:57Z, “Add ARK-X PDD (ATLAS 360 PLAN) draft”; mirror of changed/remote-only files: `/tmp/arkx-remote`. |
| Present comparator | Clean workspace HEAD `d3b19e6a71884ceff1fed7529af9cb8d05c389f3`, dated 06 Sep 2026. |
| Inventory authority | `/tmp/arkx-comparison.json`: path inventory and content-hash classification. |
| Review method | Static review of the inventory and relevant source, migrations, feature flags, routes, storage/schema, tests, and PDD style source. |
| Document presentation | The cover uses the `.cover`, `.cover-inner`, `.tag`, `.subtitle`, `.manifesto`, and `.meta` classes supported by `scripts/pddStyles.ts`; A4 table sizing is inherited from that stylesheet. |

“Same” means the same relative tracked path and same compared content hash; “changed” means the same relative path with different content; “remote-only” and “local-only” mean a path is absent from the other inventory. Counts are **not** a line-count, quality score, feature-completeness score, deployment inventory, or security certification. Docs, exports, screenshots, attached assets, agent metadata, and image files are retained in the inventory figures but are excluded from functional parity conclusions unless a source file references them.

# 2. Quantitative file comparison

| Measure | Count | Interpretation |
|---|---:|---|
| Remote files | 397 | Files represented at the remote comparison commit. |
| Local tracked files | 418 | Files represented at present HEAD. |
| Same path/hash | 344 | Shared stable base; not proof of runtime equivalence. |
| Changed shared paths | 33 | Merge review surface, concentrated in client (14), server (9), shared (2), and supporting config. |
| Remote-only | 20 | 16 client, 2 server, 1 migration, 1 docs/export path. |
| Local-only | 41 | Includes 12 client, 8 server, 2 migrations, 1 shared, 5 tests, 7 docs/exports, plus assets/metadata. |

The remote-only functional set is `client/src/pages/living-resume-designer.tsx`, `client/src/pages/gauntlet.tsx`, `client/src/components/living-resume-designer/*`, `client/src/lib/livingResumeExport.ts`, `server/livingResumeDesigner.ts`, `server/gauntlet.ts`, and `migrations/0024_gauntlet_runs.sql`. The remote PDD at `docs/ARK-X_PDD_ATLAS_360_PLAN.md` is documentary, not executable evidence.

Local-only functional additions include `server/guinMax.ts`, `client/src/pages/guin-match.tsx`, `client/src/pages/matchmaking-candidates.tsx`, `server/migrationStatus.ts`, `server/seo.ts`, `shared/publicSeo.ts`, MERLIN client modules, tests under `server/__tests__/`, and `migrations/0024_guin_max.sql` / `0025_matchmaking_introductions.sql`. Local-only images, screenshots, attached assets, exports, and `.agents` files should not drive feature decisions.

# 3. Capability comparison and recommended direction

| Capability | GitHub `dc172…` | Present `d3b19…` | Recommended direction |
|---|---|---|---|
| Core ARK identity, report, resume, marketplace | Shared base, with changed integration files | Shared base, with refinements | Reconcile hotspot files manually; do not select a whole tree. |
| Living Resume Designer | Present: wizard components, export helper, read-only prefill, telemetry, routes and flag. | Absent. | Import, but review privacy/export UX and default flag off. |
| Atomic Gauntlet | Present: schema/migration, scorer, history, routes/page and flag. Scope explicitly excludes code execution/RL sandboxing. | Absent. | Import after atomic credit and cost controls are corrected; default off. |
| MERLIN completion guidance | Absent. | Present: `merlin.tsx`, `MerlinCopilot.tsx`, `useMerlin.ts`, `merlin-guidance.ts`. | Keep and regression-test during layout/API merges. |
| GUIN MAX mentor discovery | Absent. | Present: consented discovery and requests. | Keep as canonical network-safety pattern. |
| Talent Exchange introductions | Older/shared matchmaking surface; present-specific introduction lifecycle absent. | Present with candidate/employer introduction records and tests. | Keep; reuse its transition discipline for Gauntlet-sensitive flows. |
| SEO/discoverability | Changed generic static/meta files; no present SEO module inventory. | Present route metadata injection, sitemap, robots, public page map and tests. | Preserve present implementation; add public new-page metadata only after product approval. |
| Migration health | No local-only inventory checker. | Present `migrationStatus.ts`, migration runner integration and test. | Retain and extend for dual-`0024` compatibility. |
| Tests | Remote-only capability tests are not in the supplied remote-only inventory. | Tests specifically cover GUIN, introductions, MERLIN, migration status, SEO. | Preserve and add new capability/security tests before release. |

# 4. What GitHub has that present lacks

## Living Resume Designer

GitHub adds `/living-resume-designer` in `client/src/App.tsx`, a navigation item in `client/src/components/layout/AppLayout.tsx`, and a `livingResumeDesigner` feature key in `shared/featureFlags.ts`. Its component directory includes `WizardShell`, identity/headshot/video steps, live preview, methodology tags, project repeater, SPC portfolio panel, honesty review, ARK score badge, showcase, export panel, and types. The server endpoint `GET /api/living-resume/prefill` is gated by `requireFeature("livingResumeDesigner")` and `requireAuth`; `server/livingResumeDesigner.ts` is a read-only aggregation of the user, latest assessment, and active self-created SPC listings. A telemetry endpoint is `POST /api/living-resume/telemetry`.

**Value:** a coherent self-service, shareable/offline résumé artifact that can surface existing ARK identity, evidence, history, and portfolio data without a new primary persistence model.

**Risks to address:** the prefill includes assessment contact fields (`contactEmail`, `contactPhone`) and user-supplied resume content; export, browser storage, telemetry, third-party links, and Pro+ gating need privacy/product review. Confirm server-side authorization is retained, avoid logging personal content, and make claims/export labels evidence-bound. It is not evidence of a verified résumé, employment outcome, or external sharing consent.

## Atomic Gauntlet

GitHub adds `/gauntlet`, `POST /api/gauntlet/run`, `GET /api/gauntlet/runs`, `server/gauntlet.ts`, `gauntletRuns` in `shared/schema.ts`, and `migrations/0024_gauntlet_runs.sql`, behind the `gauntlet` feature key. It evaluates a submitted AI-native app showcase across functionality, clarity, stack coherence, demo completeness, and honesty; it calls the configured utility AI chain or a deterministic heuristic fallback. Its own source explicitly says it is **not** code execution, an RL environment, or sandbox infrastructure.

**Value:** a structured feedback loop and recorded quality review for a portfolio/app showcase, potentially strengthening the Living Resume narrative.

**Current risks:** `runAndRecordGauntlet` reads credits, performs AI work, then unconditionally updates the balance by user ID before inserting the run (`server/gauntlet.ts`). Concurrent requests can each pass the pre-check and over-debit a balance; debit and run insert are separate operations, so a later failure can charge without a run. AI input/output, hosted URLs, and embedded demo material need bounded validation, safe rendering, rate limits, cost limits, auditability, and disclosure. The heuristic fallback is a product policy decision, not equivalent to AI assessment.

# 5. What present has that GitHub lacks

| Present addition | Evidence | Why it must survive reconciliation |
|---|---|---|
| MERLIN | `client/src/pages/merlin.tsx`, `components/merlin/MerlinCopilot.tsx`, `lib/useMerlin.ts`, `lib/merlin-guidance.ts`. | Progress-aware completion guidance is a distinct user-support refinement; protect its authenticated UI and error state. |
| GUIN MAX | `server/guinMax.ts`, `/guin-match`, `migrations/0024_guin_max.sql`, `server/__tests__/guinMax.test.ts`. | Eligibility requires opt-in, adult attestation, availability, selected tier, and verified evidence; narrow cards do not expose email. |
| Talent Exchange introductions | `migrations/0025_matchmaking_introductions.sql`, matching schema/storage/routes and `matchmakingIntroductionsRoute.test.ts`. | CXS/evidence snapshots and a pending-only accept/decline/cancel lifecycle protect candidate agency and races. |
| Consent safeguards | `guinMax.ts` and introduction route tests. | Eligibility is re-evaluated; stale consent/evidence does not silently authorize contact disclosure. |
| Confirmation lifecycle fixes | Changed shared route/storage/schema area plus current PDD evidence in `exports/ARK-X_PDD_ATLAS_360_CURRENT.md`. | Preserve expiry, owner action, narrow DTO, and atomic terminal-transition patterns during route merge. |
| SEO | `server/seo.ts`, `shared/publicSeo.ts`, `components/SeoMetadata.tsx`, `seo.test.ts`. | Sitemap/robots, canonical, public-page metadata, and private-path noindex behavior are explicit protections. |
| Migration health | `server/migrationStatus.ts`, `server/migrate.ts`, `checkPublishedMigrations.ts`, tests. | Repository-versus-ledger visibility is essential while reconciling migrations. |
| Test protections | Current tests include GUIN, introductions, MERLIN guidance, migration status, and SEO. | These form the minimum non-regression fence, not proof of full coverage. |
| Report/UI refinements | Changed report, shared report, adviser report, home, demo tour, API/theme/export files; present PDD exports. | Review selectively against UX intent; preserve validated refinements rather than replacing screens wholesale. |

# 6. Conflict and hotspot register

| Hotspot | Collision / review concern | Resolution direction |
|---|---|---|
| `shared/schema.ts` | Both add different domain tables amid shared changed schema. | Reapply Gauntlet table/type next to present GUIN/introduction schema; verify generated insert/select contracts. |
| `server/routes.ts` | Both change a large route registry; remote adds LRD/Gauntlet while present adds consent/lifecycle/SEO-adjacent behavior. | Start from present; add routes with existing auth, DTO, error, flag, and transition conventions. |
| `server/storage.ts` | Present has GUIN/introduction persistence; remote Gauntlet uses direct DB access. | Preserve present methods; introduce a transactional Gauntlet storage/domain operation rather than copy direct calls. |
| `client/src/App.tsx` | Both alter imports and route registration. | Add routes without losing MERLIN, GUIN MAX, candidate, SEO, or existing fallback guards. |
| `AppLayout.tsx` | Remote navigation adds two entries; present layout may contain MERLIN/UI refinements. | Add flagged nav entries only; retain present accessibility and navigation changes. |
| `client/src/lib/api.ts` | Shared changed API client can silently break query contracts. | Reconcile request/query keys and add component/API contract tests. |
| `shared/featureFlags.ts` / `server/featureFlags.ts` | Remote keys/default-on policy conflicts with safe rollout. | Add both keys but set defaults false for the integrated release; server/client behavior must agree. |
| `package.json`, lock/runtime/static/Vite files | Changed dependencies/build/serving/meta behavior can alter deployment or SEO. | Diff dependency and runtime intent line-by-line; retain present SEO/static injection and add only required packages/config. |

# 7. Mandatory migration reconciliation

This is a **Critical** collision. Both branches use migration number `0024` for different objects:

| Filename | DDL purpose |
|---|---|
| Present `migrations/0024_guin_max.sql` | `guin_max_profiles`, `guin_max_match_requests`, indexes, pending-pair uniqueness. |
| Remote `migrations/0024_gauntlet_runs.sql` | `gauntlet_runs` and user index. |
| Present `migrations/0025_matchmaking_introductions.sql` | `matchmaking_introductions`, lifecycle constraint/indexes/pending-pair uniqueness. |

**Recommendation:** preserve the current published `0024_guin_max.sql` and `0025_matchmaking_introductions.sql`. Bring Gauntlet in as the next new migration filename in the present sequence (number chosen only after re-inventorying the target branch). Include idempotent compatibility checks for databases whose `schema_migrations` ledger recorded remote `0024_gauntlet_runs.sql`: inspect the ledger and actual table shape; create `gauntlet_runs` only when absent; report an incompatible `0024` filename/content situation explicitly for operator remediation.

Never rename, replace, or blindly reuse a migration filename that may already be published/applied. Migration runners commonly use filenames as ledger identities; renaming can cause an already-applied DDL change to appear missing, replay a different change, or hide drift. Test a clean database and both historical ledger histories before any rollout. Extend the present migration-status tooling rather than masking the discrepancy.

# 8. Security, privacy and integrity review

1. **Do not regress GUIN consent.** Preserve opt-in, adult attestation, availability, tier/evidence eligibility, stale-state rechecks, narrow result cards, and no automatic contact exchange. The implementation in `server/guinMax.ts` and its tests is the baseline.
2. **Make Gauntlet debit atomic.** Use one transaction or a conditional `UPDATE ... WHERE balance >= cost` with affected-row verification, then record the run/ledger within the same transaction. Define retry/idempotency behavior and compensate only through audited logic.
3. **Keep contact privacy.** LRD prefill/export must keep contact fields user-controlled; never place personal contact data in telemetry, broad logs, public URLs, unauthenticated APIs, or Gauntlet prompts unless specifically approved and minimized.
4. **Flags remain off until validated.** New `livingResumeDesigner` and `gauntlet` flags should default false in the reconciled branch, with server routes gated and client nav/routes hidden consistently.
5. **Bound inputs and cost.** Validate payload size/URLs, constrain AI prompt/output handling, rate-limit, set credit/cost caps, and record safe operational audit events. Treat model output as untrusted content.
6. **No inflated claims.** Do not represent Gauntlet as executing applications, operating an RL environment, independently verifying claims, or providing GRO/production assurance. Do not claim external federation, legal compliance, or live provider operation from these sources.

# 9. Prioritized bidirectional upgrade roadmap

| Phase | Work and exit evidence | Rough effort | Primary owners |
|---|---|---:|---|
| 0. Inventory and freeze | Tag both commits, archive hash inventory, create integration branch, freeze migration naming decisions. | 0.5–1 day | Tech lead, release engineer |
| 1. Migration reconciliation | Model both `0024` ledgers; write next Gauntlet migration and compatibility checks; exercise all histories. | 1–2 days | Backend/DB engineer |
| 2. Preserve local safeguards | Lock GUIN, introductions, confirmations, SEO, migration health, MERLIN and existing tests as acceptance gates. | 1 day | Backend + QA |
| 3. Semantic remote import | Import LRD components/prefill/export and Gauntlet UI/domain behavior—not remote whole-file replacements. | 3–5 days | Frontend + backend |
| 4. Integrate seams | Reconcile schema, storage, routes, App, AppLayout, API client, flags, packages and static/Vite changes. | 2–4 days | Full-stack engineer |
| 5. Test and harden | Add atomic-credit, authorization, privacy, flag, migration, export, prompt/render, and race tests. | 2–4 days | QA/SDET + security reviewer |
| 6. Staging | Apply clean and historical ledgers, run feature-off/on smoke tests, inspect SEO and rollback procedure. | 1–2 days | Release engineer, product owner |
| 7. Controlled production rollout | Enable one feature at a time only after approvals and operational observations. | 1–3 days | Product, operations, security |

Effort is directional engineering planning, not a delivery commitment; unknown dependency/runtime differences can change it.

# 10. Exact recommendations

## Updates GitHub needs

- Adopt present HEAD’s GUIN MAX, introductions, consent/lifecycle protections, MERLIN, SEO metadata/sitemap/robots, migration health tooling, and related tests.
- Replace Gauntlet’s check-then-debit/separate-insert sequence with an atomic, idempotent financial/credit operation.
- Move Gauntlet out of remote `0024`; support migration-ledger compatibility rather than renumbering history in place.
- Make remote capability flags disabled by default in the reconciliation branch, regardless of remote defaults.

## Updates present project needs

- Add Living Resume Designer as a reviewed, flagged, privacy-safe feature: page, components, export helper, authenticated prefill, telemetry policy, route, navigation and tests.
- Add Atomic Gauntlet only after schema/migration reconciliation and redesigned credit concurrency controls; add page, history API, server operation, and tests.
- Add public-page SEO entries only if either new page is intentionally public; authenticated/private pages should remain non-indexed.

## Shared reconciliation work

- Manually reconcile every changed hotspot listed above, with present HEAD as the starting file.
- Establish a single feature-flag policy across client build-time defaults and server environment overrides.
- Establish versioned API DTOs and error behavior for the imported routes; do not expose raw assessment/contact data.
- Document migration ledger detection, staging procedure, and rollback/forward-fix runbook.

## Items not to merge

- No direct remote-to-local or local-to-remote overwrite of `main`.
- No remote `0024_gauntlet_runs.sql` filename replacement for present `0024_guin_max.sql`.
- No regression of GUIN consent, contact minimization, introduction terminal-state checks, confirmation fixes, SEO private-path protections, or current migration health checks.
- No claim or implementation implication that Gauntlet is a code executor, RL sandbox, independent verifier, federation, or GRO/production system.
- Do not treat docs, PDF exports, screenshots, asset duplicates, or agent metadata as application capability changes.

# 11. Validation matrix

| Validation | Required evidence before enablement |
|---|---|
| Database histories | Clean DB; present historical ledger (`0024_guin_max`, `0025_introductions`); remote historical ledger (`0024_gauntlet_runs`); inspect both ledger/table states and compatibility behavior. |
| Code health | `npm run check`, `npm test`, and `npm run build` on the reconciled branch. Record results; none are asserted by this report. |
| Feature gating | Feature-off returns expected hidden/404 behavior; feature-on route/nav/API happy paths for both LRD and Gauntlet. |
| Auth and privacy | Unauthenticated, cross-user, malformed payload, telemetry, export, contact-field, and public-indexing tests. |
| Consent/lifecycle | GUIN eligibility/withdrawal/stale evidence; introduction accept/decline/cancel races; confirmation lifecycle regression tests. |
| Gauntlet integrity | Parallel debit attempts, insufficient balance, failure between score/debit/run, retry/idempotency, credit ledger totals, AI-cost caps, prompt/output/render safety. |
| SEO | Sitemap and robots responses, canonical/meta/OG output for approved public paths, and noindex behavior for authenticated/private/new-feature routes. |
| Deployment/rollback | Migration preflight, backup/restore policy, forward-only remediation, flag-off rollback, monitoring and owner sign-off. |

# 12. Target parity architecture

The target is one present-HEAD-derived ARK-X application with:

`Client routes/nav (flagged)` → `typed API client` → `Express routes (auth + feature gates + narrow DTOs)` → `domain/storage transactions` → `Drizzle schema + append-only migrations`.

Within that shape, Living Resume Designer is a user-authorized read/prefill and local/export experience; Gauntlet is a bounded, rate-limited assessment operation with an atomic credit/run transaction; GUIN MAX and Talent Exchange remain consented, evidence-based networks with no automatic contact disclosure. `shared/featureFlags.ts` is the declared cross-client/server surface contract, while server overrides are controlled release operations. SEO routes and HTML injection remain at the static-serving boundary; private routes stay non-indexable. Migration status reads the repository and ledger without rewriting history.

## Final acceptance criteria

1. All three migration histories pass on isolated databases with documented results and no renamed published migration.
2. `livingResumeDesigner` and `gauntlet` compile behind default-off flags; feature-on behavior passes the matrix.
3. A concurrent Gauntlet test proves balance cannot fall below the permitted amount and no charge/run inconsistency is possible within the specified transaction semantics.
4. GUIN/MAX and Talent Exchange consent, evidence, privacy, and lifecycle regression suites pass unchanged or with stronger assertions.
5. No LRD contact data reaches telemetry/logs/public APIs; export and AI content are safely handled.
6. SEO/public route outputs are intentional; private routes remain protected from indexing.
7. Product, engineering, database, security/privacy, and release owners approve a staged enablement and forward-fix rollback plan.

# 13. Ranked risks

| Rank | Risk | Mitigation / decision gate |
|---|---|---|
| **Critical** | Incompatible `0024` migration identities can corrupt or misrepresent schema history. | Dual-ledger test, new next migration, explicit compatibility preflight; never rename blindly. |
| **Critical** | Gauntlet’s non-atomic credit sequence permits concurrency and partial-failure inconsistency. | Conditional debit/transaction plus idempotency, tests, and default-off flag. |
| **High** | Whole-file merge of routes/schema/layout/API loses present consent, lifecycle, MERLIN, or SEO controls. | Semantic/cherry-picked integration with protected regression suite and code review. |
| **High** | Resume prefill/export or telemetry leaks contact/resume data. | Data-flow review, minimization, authentication, safe telemetry, privacy tests. |
| **High** | AI inputs/outputs or demo links create cost, unsafe rendering, or unbounded-input exposure. | Validation, escaping/sandboxing policy, rate/cost limits, monitoring. |
| **Medium** | Client/server feature flag mismatch exposes an unready route or misleading navigation. | Unified flags, off/on smoke tests, release checklist. |
| **Medium** | Config/runtime/static/Vite reconciliation changes SEO or deployment behavior. | Line-level config review and build/deploy validation. |
| **Low** | Docs/assets/agent metadata create noisy conflicts or misleading parity conclusions. | Keep outside functional merge scope; retain provenance separately. |

# 14. Suggested immediate next action

Create `integration/arkx-parity-dc172c4-into-d3b19e6` **from present HEAD**. Commit the comparison inventory and this report as review artifacts, then open a draft pull request. In that branch: first add a migration-ledger design/test, then preserve present safeguards as regression gates, then import remote LRD and Gauntlet in small commits (schema/migration, domain transaction, routes/flags, UI, tests). Keep both features default-off. Use a separate compatibility/staging branch if database rehearsal needs isolated changes. Merge only reviewed, tested pull requests into the project’s mainline; do not push one main branch over the other.

---

## Output and sanity record

**Output:** `exports/ARK-X_CODEBASE_PARITY_AND_UPGRADE_REPORT.md`  
**Summary:** Decision-ready static parity report comparing remote `dc172c425b252ba09d66fe4c3ceba916fa56a151` with present `d3b19e6a71884ceff1fed7529af9cb8d05c389f3`; identifies two additive remote capabilities, preserves local safeguards, and makes migration reconciliation and atomic credits release blockers. Markdown structure and required cover/table sections were checked as a document artifact only; no application code was edited, run, built, or tested.