# ARK‑X — Product / Project / Program Documentation (PDD)
ATLAS 360 PLAN — PDD (Parts 0–8) for ARK‑X  
Production ID: JNGL-PDD-ARKX-2026-001
Date / Time Stamp: 2026-09-06T00:00:00Z (capture at final assembly)
Author (human principal): [REPLACE WITH FULL NAME]
Repo: https://github.com/oluseye4233/ARK-X
Default branch: main
Primary language: TypeScript
JCSE / Certification Status: self-assigned, Tier 0 (not HIVE‑certified) — G3-D1
GRO Mode: LIFE
Honesty Gate Tier: Tier 0

---
PART 0 — Title & Contents Page (MANDATORY provenance block present)
Authorship & Provenance Block (MUST appear on Title page and page footer)
| Field | Value |
| --- | --- |
| Author | [FULL NAME — required before publish] |
| Document Title | ARK‑X — Advanced Resume & Karriere Synthesized Intelligence (PDD) |
| Production ID | JNGL-PDD-ARKX-2026-001 |
| Date / Time Stamp | 2026-09-06T00:00:00Z (update at final assembly) |
| SPC Roster Used | ATLAS 360 PLAN (host); SPARTAN SI; CODE DJ; BUGMXT SI; CODON (if used); CORDON (if used); KONSA (evidence, DESIGN‑INTENT if external deps unresolved); CARTER v3.0 (terminology); SKRIBE ULTRA SI (SBIS) |
| JCSE / Certification Status | self-assigned — Tier 0; list per-SPC JCSE where known |
| GRO Mode | LIFE |
| Honesty Gate Tier | Tier 0 |

Publication rule: If any provenance field is empty, document remains DRAFT and publishing is blocked.

Contents (auto-generate page refs in final assembly)
0. Title & Contents Page  
1. Statement of Requirements  
2. Business Case & SOLVA Verdict (Executive Summary)  
3. SPC Roster & Dev Kit  
4. Platform Specifics (Features, APIs, Data Flows)  
5. Atomic Prompt Worksheet (Feature → Atomic Task → Atomic Prompt)  
6. DJ Implementation Plan (Tooling & CI/CD)  
7. Summary of Sources (Cited Works Ledger)  
8. Definition of Terms (CARTER grounding)  
Appendices: KONSA raw logs, SOLVA output, CARTER grounding report, Atomic Prompt tests

---
PART 1 — Statement of Requirements
Owning SPC: KONSTRUCT + KONSA + KLARITY

1.0 Executive problem statement
- ARK‑X provides resume intelligence, career readiness scoring, AI‑automation vulnerability assessment, and upskilling guidance for individuals and enterprises.

1.1 Key stakeholders
- Candidate users (individuals)
- HR / enterprise customers
- Instructors (cohort managers)
- Marketplace participants (SPHINX sellers/buyers)
- Platform operators / admins

1.2 High-level goals & success metrics
- JST Index adoption and accuracy: JST adoption targets, 0–300 subscore validity checks
- ARK Identity Score distribution and percentile mapping
- Reduction in resume review time (enterprise target)
- Retention / engagement metrics from CCGE Arena (daily ARK accrual target)
- Enterprise ROI signals (L&D uplift, attrition risk reduction)

1.3 Constraints / non-functional requirements
- Privacy: GDPR/CCPA compliance for personal data
- Multi-provider AI resiliency (Anthropic/OpenAI/Gemini)
- Latency budget for resume analysis (target: ≤ Xs per resume)
- Security: CSP/HSTS, rate limiting, session hardening

1.4 Evidence & inputs
- Primary internal sources: README.md (core features), dev_plan.md (frontend design & batches)
- External evidence (KONSA needed): ergonomics of segmented documentation or evidence for scoring models (SOLVA & KONSA runs required; none attached).

Required actions before Part 6 finalization:
- Produce SDD (software design document) or mark fallback to Part 1 (currently no SDD file found; dev_plan.md exists — treat as design intent but not formal SDD). Per Section 17, SDD is mandatory alignment benchmark; if absent, explicitly disclose fallback (done here).

---
PART 2 — Business Case, Financial Projections & SOLVA Validation
Owning SPC: EVE ULTRA SI + SOLVA ULTRA SI

2.0 Executive summary (front-loaded)
- Platform monetization: SPHINX marketplace fees, enterprise subscriptions, premium ARK features.
- Core proposition: Improved candidate matching, upskill nudging, and living resume artifacts for verification.

2.1 Market assumptions (sourced from internal product strategy — not yet SOLVA-adjudicated)
- TAM/SAM/SOM placeholders — requires market research / EVE inputs.

2.2 Financials & guardrails
- Financial projection templates exist in repo scripts? (no financial files found) — requires EVE modeling.

SOLVA Gate (MANDATORY)
- SOLVA GAUNTLET must produce an SVS verdict (VIABLE / CONDITIONALLY VIABLE / FUNDAMENTALLY FLAWED / TERMINATE) and raw output attached to Part 2.
- Current status: SOLVA not run — Part 2 is DESIGN‑INTENT until SOLVA output attached.

Presentation requirement
- Executive summary must appear in first 1–2 pages per SKRIBE SBIS.

---
PART 3 — SPC Roster: Skills, Industry Focus & Dev Kit (mandatory)
Owning SPC: ATLAS ULTRA SI

SPC Roster (initial)
- ATLAS 360 PLAN (host) — assembly & PDD discipline
- SPARTAN SI — PDD→MVP conversion (present in Dev Kit)
- CODE DJ — code synthesis & reverse-engineer (living PDD)
- BUGMXT SI — debugging & fidelity checks
- CODON — code-synthesis engine (Pre‑Build / Tier 0; DESIGN‑INTENT)
- CORDON — prompt sequencing (Pre‑Build / Tier 0; DESIGN‑INTENT)
- KONSA — evidence retrieval (DESIGN‑INTENT for external Consensus.app dependency if used)
- CARTER v3.0 — terminology grounding (VERIFIED‑INTERNAL for repo-sourced terms)
- SKRIBE ULTRA SI — SBIS styling & final pass
- OSIRIS ULTRA SI — observability / Living PDD custody (if used)

Dev Kit inclusion disclosure
- CODON and CORDON are Pre‑Build/Tier‑0 in the default Dev Kit. Inclusion flagged—integration evidence must be attached or the PDD carries a Tool/Platform Integration risk flag.

Roster deliverables
- For each SPC, assign owner, deliverable artifact, and timeline (to be filled).

---
PART 4 — Platform Specifics (Feature list & architecture)
Owning SPC: ATLAS ULTRA SI + STRATEGOS ULTRA SI

4.0 Top-level architecture (summary)
- Frontend: React 19 + Vite (client/)
- Backend: Express.js (TypeScript) (server/), SSE event bus for live updates
- DB: PostgreSQL + Drizzle ORM (migrations/)
- AI layer: multi-provider chain (Anthropic, OpenAI, Gemini) in server/ai/
- Auth: express-session + PG-backed session store
- Feature-flagging: FEATURE_* env toggles (404 gating)

4.1 Feature inventory (extracted from README + dev_plan)
- Feature F1: ARK Identity Score (composite: JST + CCMI) — scoring engine in server/score*
- Feature F2: Resume Intelligence — 5‑phase resume pipeline (parsing, keyword scoring, JST calculation, AI vulnerability assessment, evidence linking)
- Feature F3: Archetype Handicap System — job title classification and archetype mapping
- Feature F4: CCGE Arena — gamified prompt-craft training mini-game
- Feature F5: SPHINX Marketplace — publish/purchase Super Prompt Cards (payments & HIVE gating)
- Feature F6: ARK Resume — living resume with verified cards & PDF export
- Feature F7: Enterprise Workforce Intelligence — dashboards, drill-downs, cohort analytics
- Feature F8: Institutional Cohorts — instructor-managed cohorts & grade exports
- Feature F9: GUIN+ Identity — contributor profiles and endorsements
- Feature F10: Multi-provider AI Resilience — model policy, per-user budgets, cross-provider fallbacks

4.2 API surface (where found)
- /api/seed (seed demo data)
- Many server endpoints inferred under server/ (inspect code for full list)

4.3 Missing SDD
- No explicit SDD file (e.g., ARCHITECTURE.md or SDD.md) discovered. dev_plan.md provides frontend design and batch tasks but is not an SDD. Per Section 17, produce SDD or record fallback to Part 1.

---
PART 5 — The PDD Atomic Prompt Worksheet (Color‑Coded)
Owning SPC: ATLAS ULTRA SI (with CORDON sequencing where multi-domain)

Note: SDD absent. Using Part 1 + dev_plan.md as fallback (disclose). This worksheet must be validated against a formal SDD once produced.

Feature → Atomic Task → Atomic Prompt (sample, traceable chain)
- Feature F1: ARK Identity Score
  - Atomic Task F1.T1: Implement JST calculation pipeline from parsed resume tokens.
    - Atomic Prompt F1.T1.P1: "Given parsed resume JSON, compute JST score: return {jobsScore:int, skillsScore:int, talentScore:int, JST_total:int} with explanation of top 5 contributing tokens." (🔴 Critical) — I/O spec: input schema, output schema, validation tests.
  - Atomic Task F1.T2: Store score history in DB and expose SSE updates.
    - Atomic Prompt F1.T2.P1: "Append JST snapshot to user_score_history table and emit SSE message {userId, newSnapshot}."

- Feature F2: Resume Intelligence
  - Atomic Task F2.T1: Resume parsing and text extraction (PDF and docx)
    - Atomic Prompt F2.T1.P1: "Extract structured resume JSON (experience[], education[], skills[]) from uploaded PDF; include page offsets and confidence scores."
  - Atomic Task F2.T2: Keyword scoring across 6 categories
    - Atomic Prompt F2.T2.P1: "Given resume JSON and category definitions, return categoryScores map and matched keyword list with positions."

- Feature F4: CCGE Arena (example)
  - Atomic Task F4.T1: Evaluate a prompt-craft hand and compute CCGE score
    - Atomic Prompt F4.T1.P1: "Score prompt-craft hand on Knowledge, Clarity, Specificity, Efficiency; return {K:0-100, C:0-100, S:0-100, E:0-100, CCMI_total:0-300}."

Traceability checks (must pass)
- Every Atomic Task includes parent Feature ID (violation = containment trigger).
- Every Atomic Prompt includes parent Atomic Task ID (violation = containment trigger).
- Each prompt has single-operation I/O spec and automated unit test placeholder.

CORDON sequencing: If multi-domain build exists, run topological sort; currently CORDON is DESIGN‑INTENT — attach sequencing artifact when available.

---
PART 6 — The DJ Implementation Plan (Tool / Code / Host)
Owning SPC: ATLAS ULTRA SI (DJ selection gated by Section 1)

Tooling & scripts (from package.json)
- Dev server: npm run dev  (tsx server/index.ts)
- Frontend dev: npm run dev:client (vite)
- Migrations: npm run db:migrate
- PDD render/check: npm run pdd:render ; npm run pdd:check
- Tests: npm test (many test scripts defined)

CI/CD checklist (minimum)
- Run: npm ci && npm run check && npm test
- Run: npm run db:migrate (with DB URL configured for CI migration sandbox)
- Static checks: TypeScript compile
- PDD checks: npm run pdd:check — integrate into CI to fail publish if PDD checks fail
- SKRIBE pass: automated layout check (visual diff) step — currently not implemented; include SKRIBE plugin or manual QA.

Deployment targets
- Host: Express + Vite on Node (production start: npm run start)
- DB: PostgreSQL (DATABASE_URL)
- Env vars required (from README): DATABASE_URL, SESSION_SECRET, AI integration keys (optional degrade)

Enforcement
- Part 6 cannot be finalized until KONSTRUCT diagnosis (Part 1) and Part 4 are complete.

---
PART 7 — Summary of Sources (Cited Works Ledger)
Owning SPC: KONSA (evidence retrieval) — NOT RUN

Internal sources (VERIFIED‑INTERNAL)
| Source | Identifier | Use in PDD |
| --- | --- | --- |
| README.md (repo) | https://github.com/oluseye4233/ARK-X/blob/main/README.md | Core features, tech stack, scripts |
| dev_plan.md (repo) | https://github.com/oluseye4233/ARK-X/blob/main/dev_plan.md | Frontend design, feature pages, batches |

External sources (REQUIRED for claims)
- No KONSA outputs attached. Any external evidence (e.g., studies on scoring validity, privacy compliance, EU AI Act mapping) must be collected with KONSA pipeline and included here. Mark DESIGN‑INTENT until done.

KONSA dependency note
- If Consensus.app is used, disclose dependency and operational status per ATLAS 360 PLAN §1.2.

---
PART 8 — Definition of Terms (CARTER grounding) — CARTER grounding run REQUIRED
Owning SPC: CARTER v3.0 + KLARITY

Intro: CARTER must ground each term below against the repo (VERIFIED‑INTERNAL) and append entries to the persistent ATLAS Terminology Library (JNGL-LIB-TERM-2026-001). Any duplicate names must be flagged.

CARTER Terminology Table (initial grounding from repo files)
| term | definition | type | source_pdd | first_grounded_date | duplicate_of | status |
| --- | --- | --- | --- | --- | --- | --- |
| ARK Identity Score | Composite score (0–600) comprised of JST (0–300) and CCMI (0–300), with history & SSE updates. | metric | README.md (repo) | 2026-09-06 | null | VERIFIED‑INTERNAL |
| JST (Jobs‑Skills‑Talent) | Subscore component (0–300) used in ARK Identity Score; input: parsed resume tokens and category scores. | metric | README.md | 2026-09-06 | null | VERIFIED‑INTERNAL |
| CCMI (Context Craft Mastery Index) | Subscore (0–300) measuring prompt-craft mastery / context craft. | metric | README.md / CCGE Arena (dev_plan.md) | 2026-09-06 | null | VERIFIED‑INTERNAL |
| CCGE Arena | Single-player prompt-craft training game that influences ARK flywheel. | feature / SPC | README.md / dev_plan.md | 2026-09-06 | null | VERIFIED‑INTERNAL |
| SPHINX Marketplace | Marketplace for Super Prompt Cards; publishing gated by HIVE certification. | component | README.md | 2026-09-06 | null | VERIFIED‑INTERNAL |
| ARK Resume | Living ATS-optimized resume artifact with verified-card evidence. | artifact | README.md | 2026-09-06 | null | VERIFIED‑INTERNAL |
| GUIN+ Identity | Public contributor profile with endorsements and gamified ranks. | concept | README.md | 2026-09-06 | null | VERIFIED‑INTERNAL |
| Multi-provider AI Chain | Resilient LLM chain across Anthropic, OpenAI, Gemini with policy & per-user budgets. | component | README.md | 2026-09-06 | null | VERIFIED‑INTERNAL |

CARTER enforcement actions required
- Run grounding pipeline (scripts TBD) to append entries to JNGL-LIB-TERM-2026-001.
- If CARTER finds duplicates or conflicting definitions, flag for human/SOLVA merge.

KLARITY pass
- KLARITY must do a plain‑language pass on Part 8 definitions before publishing.

---
SKRIBE SBIS — Styling & Layout (BINDING)
Owning SPC: SKRIBE ULTRA SI — REQUIRED final pass

Default Consultancy Configuration (binding)
- Running header: Document title + Production ID
- Footer: copyright + "Page X of Y"
- Typography:
  - Headers: Arial/Helvetica-family (or nearest sans-serif)
  - Body: Times New Roman (or nearest readable serif)
- Color palette:
  - Primary: Navy #0D1B4B
  - Accent: Gold #C8962A (use sparingly)
- Margins: minimum 1.35"
- Table style: header-row shading navy, minimal gridlines, alt-row light gold banding for tables >4 rows
- ExecutiveSummary: front-loaded first 1–2 pages
- Verdict rendering: SOLVA verdicts & scores bolded and color‑coded single-line callouts
- Logo: placeholder on cover. Client-brand override allowed only when explicitly documented in this PDD.

Client design override (from dev_plan.md)
- dev_plan.md requests dark mode and specific display fonts (Orbitron / Space Grotesk + Inter). This is allowed as a documented client-brand override:
  - Document override: Use dark-mode presentation and fonts [Orbitron/Space Grotesk (display) + Inter (UI)] for HTML/CSS deliverables; keep SKRIBE callouts (verdicts, color codes) consistent with primary palette in PDF deliverables. Include override justification and QA sign-off (SKRIBE gate).

SKRIBE gate
- A PDD fails delivery if any required SKRIBE rule is not satisfied. Attach SKRIBE pass artifact (visual diff or QA checklist).

---
Appendices & Artifacts (to attach)
- A. README.md (attached link) — done
- B. dev_plan.md (attached link) — done
- C. package.json (attached link) — done
- D. KONSA raw queries & retrieval logs — NOT PRESENT (KONSA run required)
- E. SOLVA GAUNTLET raw output — NOT PRESENT (SOLVA run required)
- F. CARTER grounding report — NOT PRESENT (run required)
- G. Atomic Prompt unit tests / validation harness — placeholders created; implement tests using server/__tests__ scripts

---
CI / Gating checklist (automatable)
Commands (from repo)
- Install: npm ci
- Typecheck: npm run check
- Run tests: npm test
- Migrations (CI sandbox): npm run db:migrate
- PDD render/check: npm run pdd:render
- Validate PDDs: npm run pdd:check

Mandatory CI gates before publishing PDD:
1. Authorship & Provenance Block present (script verifies non-empty fields) — run pdd:check
2. KONSTRUCT diagnosis attached — existence check (file or artifact)
3. KONSA evidence attached or marked DESIGN‑INTENT — pdd:check enforces a manifest entry
4. SOLVA GAUNTLET verdict attached (Part 2) — required
5. CARTER grounding report attached and Terminology Library entries created — required
6. SKRIBE pass artifact present (visual QA or automated check) — required
7. Atomic Prompt traceability matrix auto-check (prompt → task → feature) — pdd:check validates trace links
8. CODON/CORDON integration evidence or disclosed DESIGN‑INTENT flag — pdd:check validates presence

Add pdd:check to CI and require green to allow release artifacts.

---
Next actions & outstanding items (what I will do or need from you)
1. Provide Author full name to finalize provenance block.
2. Provide or create SDD / ARCHITECTURE.md (required per Section 17). If unavailable, confirm fallback acceptance to Part 1 with explicit disclosure.
3. Run KONSA pipeline (collect external evidence) and attach logs — add to Part 7.
4. Run SOLVA GAUNTLET for Business Case and attach verdict — add to Part 2.
5. Run CARTER grounding job (script or manual) to commit terminology entries to JNGL-LIB-TERM-2026-001 and attach report.
6. Produce SKRIBE pass artifact (PDF visual QA or automated tool) and attach before delivery.
7. For CODON/CORDON: provide integration evidence (CORDON topological sort output, CODON handoff) or keep them marked Pre‑Build/Tier‑0.

---
Appendix: Quick commands
- Dev server: npm run dev
- Dev client: npm run dev:client
- Seed demo data: curl -X POST localhost:5000/api/seed
- Render PDDs: npm run pdd:render
- Validate PDDs: npm run pdd:check

---
Change log
- v0.1-draft — 2026-09-06 — initial ARK‑X PDD populated from README.md, package.json, dev_plan.md. Missing artifacts: SDD, KONSA outputs, SOLVA verdict, CARTER run, SKRIBE pass.
