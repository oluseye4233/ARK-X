# ARK / "Onecraft" HR Capability — Reality Check vs. TREE Resurrection

**Document type:** Capability audit / honesty pass
**Scope:** Compares the *actual shipped code* in ARK Platform against the HR / workforce-management narrative ("Ark.Onecraft") and against the TREE Resurrection Report v2.0 (Atanda Publications Forum / Junglenomics FORGE Institute, May 2026).
**Audience:** Engineering leadership, Sales (Enterprise), Sales (School), anyone scoping an AI-transformation engagement against ARK.
**Stance:** No marketing language. If the code doesn't do it, this document says so.
**Last updated:** 2026-05-28

---

## 0. First — the naming honesty

"**Ark.Onecraft**" is not a module, route, table, or named subsystem in the codebase. It does not appear in `replit.md`, `shared/schema.ts`, the route table, or any imported package. It is an **umbrella narrative label** for the HR-adjacent surfaces that ARK happens to expose:

- `/enterprise` — Workforce Intelligence dashboard
- `/school` — Institution / cohort dashboard
- `/report` — Executive Summary
- `/upload`, `/dashboard`, `/pathways` — individual assessment surfaces
- Cohort + department aggregation endpoints
- ARK identity (JST + CCMI + LHCS) as a measurable "AI-readiness" score

This document treats "Ark.Onecraft" as **the set of those surfaces operating in concert**. Everywhere the marketing says *"AI-native HR transformation platform"*, the codebase says *"deterministic resume scorer + cohort gradebook + per-user career-pivot visualisation + one game-loop"*. Both statements describe the same software.

---

## 1. What the code actually does for HR / workforce management

Verified against `server/storage.ts`, `server/routes.ts`, `server/scoringEngine.ts`, `server/resumeAnalyzer.ts`, and `shared/schema.ts`. Anything marked **GAP** is a marketing/code mismatch.

### 1.1 Per-individual assessment surface

| Capability                          | Code reality                                                                                                                                                                | Inputs required                                | Computation type                              |
|-------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------|-----------------------------------------------|
| JST scoring (Jobs/Skills/Talent)    | 6 keyword categories (technical, leadership, analytical, communication, innovation, ai_adjacent), weighted match, multiplied per the canon formula.                          | One resume per user (PDF or text, ≤10MB)        | Deterministic regex/keyword                   |
| Vulnerability level (0-4)           | 14 regex task patterns matched against resume text; average automation risk adjusted by AI/leadership scores.                                                                | Same resume                                    | Deterministic regex                           |
| Archetype handicap                  | Architect / Orchestrator / Conductor — three-signal blend: 228 job-title lookup table (40%) + skill weights (35%) + matched FORGE cards (25%).                              | Resume + the 10 seeded FORGE cards             | Deterministic lookup                          |
| 12-vector transferability radar     | **GAP**: the *backend* generates a fixed vector list per archetype, not 12 independently measured dimensions. The "12" is the radar's render geometry, not 12 signals.       | Resume                                         | Template by archetype                         |
| Upskilling timeline (30/90/365)     | Hard-coded plan template selected by archetype, persisted to `upskilling_plans`.                                                                                            | Resume                                         | Template by archetype                         |
| Pivot opportunities                 | Hard-coded 3-pivot template per archetype, persisted to `pivot_opportunities`.                                                                                              | Resume                                         | Template by archetype                         |
| Resume narrative                    | Real Claude call (Sonnet) producing prose. Flag-gated `claudeNarrative` (currently OFF in Stage 1).                                                                          | Completed assessment, Pro+ tier                | LLM (Claude Sonnet)                           |
| CCMI 7-pillar score                 | Stored per-user. Defaults to **seed-stub zero** unless the user actually plays CCGE sessions or buys/sells on SPHINX.                                                        | User must engage with flywheel                 | Accumulated from events                       |
| LHCS signal (CPR / MPS / LCIS)      | Three weighted "lights" composited via `LHCS_WEIGHTS`. Inputs are derived from the user's own assessment + flywheel activity — **not from any organisation-level signal.**  | Single user's own data                         | Deterministic weighted blend                  |
| Vulnerability heatmap & timeline    | Per-user visualisation of the *same* automation-risk numbers as VulnerabilityMeter, projected to 2041.                                                                       | Same resume                                    | Deterministic projection                      |

### 1.2 Cohort / institution surface

| Capability                                  | Code reality                                                                                                                                                                                           |
|---------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Cohort CRUD                                 | Real. Instructors create cohorts, bulk-invite by email, members reconciled on registration.                                                                                                            |
| Assignments + grades                        | Real. `GET /api/cohorts/:id/grades` and `.csv` roll up `bestJcse` + attempt counts across members.                                                                                                     |
| Cohort comparison                           | Real SQL aggregation (`avgJst`, `avgCcmi`) across cohort members.                                                                                                                                      |
| Department rollups (`GET /api/departments`) | Real SQL aggregation across users tagged with a department. **GAP:** there is no flow that *assigns* users to departments outside of the seed script — no `PUT /api/users/:id/department` ships today. |
| Cross-cohort / cross-org analytics          | **GAP:** does not exist. Aggregation is per-cohort or per-department only.                                                                                                                             |

### 1.3 What is named in marketing but absent in code

These show up in the broader ARK narrative and TREE-adjacent positioning, but **have no committed code** today:

- **AI anxiety mapping / sentiment scoring** — no NLP sentiment model, no survey instrument, no `anxiety_score` column. The closest proxy is LHCS, which measures *the user's own assessment-derived readiness*, not their feelings.
- **Cultural-resistance / change-saturation telemetry** — no events emitted, no dashboards.
- **Executive sponsorship tracking** — not modelled.
- **Failure DNA / forensic-autopsy artifacts** — no schema for incidents, no causal-chain capture.
- **Governance / regulatory architecture** — feature flags exist for `enterpriseDashboard`, but `drm`, `governance`, and audit-trail surfaces are stubs or flagged OFF.
- **Vendor / integration assessment** — not modelled.
- **Kaggle FM-code corpus integration** — does not exist.

---

## 2. How "Ark.Onecraft" maps to TREE Resurrection — phase by phase

TREE's six phases come from the attached *TREE Resurrection Report v2.0 — Command Centre Edition* (APF-FORGE-TREE-2026-002). The mapping below uses TREE's actual category numbers and phase names; the **"What ARK actually does today"** column is grounded in §1 above.

### Legend
- ✅ Ships and works against real data
- 🟡 Ships but needs significant configuration / supplementary process to be useful
- ❌ Does not exist in code — marketing only
- 🔧 Adjacent functionality exists; usable as a *proxy* but not what TREE asks for

### 2.1 Phase 1 — Forensic Autopsy

TREE asks for: a documented causal chain *Root Cause → Trigger Event → Operational Breakdown → Leadership Response → Final Collapse* (the "Failure DNA Map"), Graveyard Classification (DOA / POC Graveyard / Data Collapse / Cultural Rejection / Governance Implosion / Pivot Death), and an FM-code seeded contribution to the Kaggle corpus.

| TREE Cat | TREE need                              | ARK code reality                                                                                              | Verdict |
|---------:|----------------------------------------|---------------------------------------------------------------------------------------------------------------|:-------:|
| Cat 2    | Strategy Absence diagnosis              | Per-user JST/CCMI is not an org-strategy artifact. No org-strategy schema exists.                              | ❌      |
| Cat 10   | Vendor Hype Gap mapping                | Not modelled.                                                                                                  | ❌      |
| —        | Failure DNA Map persistence            | Schema would need `incidents`, `causal_chain`, `failure_classification` tables. None exist.                    | ❌      |
| —        | Graveyard Classification taxonomy      | Vulnerability level (0-4) is the closest analog and it measures **person-risk**, not project-failure-mode.    | 🔧     |

**Honest verdict:** ARK does not contribute to Phase 1 today. Implementing Phase 1 against ARK would require new tables + a new admin surface; the existing assessment engine is the wrong shape.

### 2.2 Phase 2 — AI Readiness Reconstruction

TREE asks for: data-foundation readiness (Gartner four-criteria), pipeline modernisation, executive sponsorship reset, AI literacy calibration, workforce-rehabilitation programmes, AI anxiety mapping, Context Craft onboarding as practitioner entry, legacy-integration assessment, and the budget-allocation rule (50-70% of timeline on data readiness *before* model selection).

| TREE Cat | TREE need                                              | ARK code reality                                                                                                                                                              | Verdict |
|---------:|--------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-------:|
| Cat 1    | Data-foundation AI readiness assessment                | Not modelled. ARK assesses *people*, not *data estates*.                                                                                                                       | ❌      |
| Cat 3    | Leadership reset / executive sponsorship calibration   | No sponsorship telemetry. JST `Leadership` keyword score is per-person, not org-level.                                                                                          | 🔧     |
| Cat 4    | Cultural-resistance / AI-anxiety mapping               | LHCS lights composite *self-assessed readiness*, not sentiment. Adequate as a **proxy** for individual readiness; inadequate for organisational anxiety mapping.                | 🔧     |
| Cat 6    | Talent Vacuum closure / Context Craft onboarding       | This is **the strongest fit**. CCGE (`/play`), Context Craft cert ladder (CC_100→500), JST multiplier preview at `/context-craft` are real and ship.                          | ✅      |
| Cat 9    | Integration / Legacy lock assessment                   | Not modelled.                                                                                                                                                                  | ❌      |

**Honest verdict:** ARK ships exactly one production-grade Phase 2 capability — **Context Craft onboarding as practitioner entry point**, which is precisely what TREE explicitly calls out in its own Phase 2 description. Everything else in Phase 2 is out of scope for the current code.

### 2.3 Phase 3 — Narrow-First Resurrection

TREE asks for: pick *one workflow*, resurrect it before scaling, document the scope-vs-governance-capacity contract.

| TREE need                                            | ARK code reality                                                                                                                                                   | Verdict |
|------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-------:|
| Workflow selection / scoping artifact                | Not modelled.                                                                                                                                                       | ❌      |
| Pivot Opportunities at the individual level          | Real (`pivot_opportunities` table, 3 templates per archetype). Not a workflow-level artifact; it's a career-pivot suggestion per person.                            | 🔧     |
| Per-workflow telemetry & success criteria            | Not modelled.                                                                                                                                                       | ❌      |

**Honest verdict:** ARK does not facilitate Phase 3. The individual *Pivot Opportunities* surface is structurally the wrong unit (person, not workflow).

### 2.4 Phase 4 — Governance Re-Foundation

TREE asks for: bias / ethical landmine catalogue, hallucination & trust validation layer, governance vacuum closure via regulatory architecture, audit trails.

| TREE Cat | TREE need                                  | ARK code reality                                                                                                                                                                                                  | Verdict |
|---------:|--------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-------:|
| Cat 7    | Bias / ethical landmine catalogue          | Not modelled.                                                                                                                                                                                                      | ❌      |
| Cat 8    | Hallucination & trust validation           | Partially: AI calls are budget-gated (Phase O guardrail), there is a usage ledger (`server/ai/usage.ts`). No content-validation / hallucination-check surface ships.                                                | 🔧     |
| Cat 11   | Governance vacuum / regulatory architecture | Stage 1 ships session security + role gating + GDPR export/delete + per-tier model policy. This is **platform-level governance** — not the *organisational governance* TREE asks the engagement to build.          | 🔧     |

**Honest verdict:** ARK has its own platform-governance story (sessions, RBAC, GDPR, AI cost gates). This is real and good for **TREE consultants needing a defensible platform to run their engagement on**, but it does not produce the customer-org governance artifacts TREE Phase 4 demands.

### 2.5 Phase 5 — Telemetry Loop

TREE asks for: every failure event → structured FM signal → Kaggle corpus, continuous loop closure.

| TREE Cat | TREE need                                        | ARK code reality                                                                                                                                                                                          | Verdict |
|---------:|--------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-------:|
| Cat 12   | Change saturation telemetry                       | Not modelled.                                                                                                                                                                                              | ❌      |
| —        | FM-signal emission to external corpus             | Not modelled.                                                                                                                                                                                              | ❌      |
| —        | Event bus / orchestrator                          | Real (`server/orchestrator.ts` — typed event bus + SSE fan-out). Internal only; not exporting to any corpus.                                                                                               | 🔧     |
| —        | ARK identity SSE stream                           | Real (`/api/ark-score/stream`). Carries per-user identity events. Could be tapped as a starting point for an FM-signal exporter if the schema were designed.                                                | 🔧     |

**Honest verdict:** ARK has the right *internal* plumbing (typed event bus + SSE) for Phase 5 to plug into, but the FM-signal export and Kaggle integration are not built.

### 2.6 Phase 6 — Scale & Repeat

TREE asks for: replicable engagement, governance-native repetition across business units.

| TREE need                                              | ARK code reality                                                                                                                                                          | Verdict |
|--------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-------:|
| Multi-cohort / multi-org tenancy                       | Cohorts table exists; **single-tenant deployment** — no `organisations` schema, no enterprise-account boundary.                                                            | 🔧     |
| Cross-org benchmarks                                   | Department rollups exist within a deployment but there's no cross-org comparison surface.                                                                                  | ❌      |
| Engagement-template replication                        | Not modelled.                                                                                                                                                              | ❌      |

---

## 3. What ARK could *actually* do for a TREE engagement today

Stripping all the fluff: if you were running a TREE Resurrection engagement next Monday and someone said *"can we use ARK for any of this?"*, the honest answer is yes — for **a specific, narrow slice**.

### 3.1 The defensible use cases

1. **Per-practitioner readiness baseline (Phase 2 → Cat 6 Talent Vacuum)**
   *Real capability.* Onboard every individual in scope, run their resume through `/upload`, capture JST + Vulnerability + Archetype + LHCS. You get a **deterministic, auditable** per-person readiness score that's the right shape for tracking *individual* AI-anxiety and skill-gap closure over time.
   *Honest framing:* this is a structured intake instrument, not an organisational diagnosis.

2. **Context Craft onboarding as practitioner entry point (Phase 2 → Cat 6)**
   *Real capability.* CCGE (`/play`) is the only game-mechanic-driven prompt-engineering training surface in the platform. The cert ladder (CC-100 → CC-500) provides a measurable progression signal. The JST multiplier (0.5× → 1.5×) gives users a concrete reason to play through.
   *Honest framing:* this is TREE's explicit Phase 2 recommendation and ARK ships it as designed.

3. **Cohort-level readiness rollups for academy / school / training engagements (Phase 2 + Phase 6)**
   *Real capability.* Instructor cohorts + assignments + `bestJcse` grade rollups + `/api/cohorts/:id/grades.csv` export. Adequate for tracking a training cohort through a structured AI-literacy programme.
   *Honest framing:* this is a training-cohort gradebook, not an enterprise workforce-management system.

4. **Career-pivot guidance for displaced workers (post-Phase 3 outcome support)**
   *Real capability.* Pivot Opportunities + Upskilling Timeline + Transferability Radar give individuals a concrete narrative for *where to go next*. Useful as the human-side deliverable when a TREE engagement results in role obsolescence.
   *Honest framing:* the recommendations are **template-by-archetype, not individually optimised** — they're consistent enough for fair use, not bespoke career counselling.

5. **Per-individual AI cost discipline during an engagement (Phase O guardrail)**
   *Real capability.* If the TREE engagement issues Claude-backed feedback to many practitioners, the per-tier cost cap (FREE $0.30, SCHOOL $0.90, PRO $2.90, ENTERPRISE $20.00 per seat/month) is a real budget instrument. Enforce the guardrail flag in prod and your AI COGS cannot drift past 10% of seat revenue.
   *Honest framing:* this is platform-governance, not engagement-governance.

### 3.2 What you must build separately

To stand up a real TREE engagement on top of ARK, the following are **not currently in code** and have to come from outside (spreadsheets, separate tools, or new ARK phases):

- Failure DNA Map artifacts and the underlying incident schema.
- Data-estate / pipeline / integration assessments.
- Organisational anxiety / culture / change-saturation surveys.
- Vendor / hype-gap evaluation.
- Bias / hallucination validation artifacts at the engagement level.
- Workflow-level (not person-level) scope selection for Narrow-First Resurrection.
- FM-signal export to the Kaggle corpus.
- Multi-org tenancy and cross-engagement benchmarks.

### 3.3 Where the marketing gets ahead of the code

| Marketing claim                                                | Code reality                                                                                                  |
|----------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| "12-Vector Transferability Radar"                              | 3 archetypes × template vector list. The 12 is geometry on the radar, not 12 backend signals.                  |
| "Dynamic Upskilling Navigator"                                 | Hard-coded 30/90/365-day plan template per archetype.                                                          |
| "Enterprise Workforce Intelligence"                            | SQL `avg()` over per-user JST/CCMI, filtered by `department` column that lacks an assignment UI.               |
| "AI-Vulnerability Assessment"                                  | 14 regex patterns × deterministic average. Real, but it's keyword scoring — not a model.                       |
| "Context Craft Game with Claude judge"                          | Real, but Claude judge is flagged off in Stage 1 and the deterministic KCSE scorer is the default judge.       |
| "Junglenomics FORGE card integration"                           | 10 seeded cards (`card-001` to `card-010`) matched against resume skills. Real but small.                      |
| "AI anxiety / sentiment / change-saturation telemetry"          | Not in code. LHCS is the nearest proxy and it measures *readiness*, not feelings.                              |
| "Governance-native AI transformation operating system"          | Platform-level governance (auth, RBAC, GDPR, cost gates) ships. Engagement-level governance does not.          |

---

## 4. Bottom line for engagement scoping

For a TREE-style AI transformation engagement, ARK is **a high-quality structured-intake + practitioner-training + cohort-tracking instrument**, with a defensible AI cost guardrail. It is **not** a Forensic Autopsy tool, a data-estate diagnostic, an organisational governance suite, or a failure-telemetry exporter.

The engagement scoping decision reduces to:

- **In scope for ARK today:** TREE Phase 2 (workforce rehab + Context Craft onboarding), partial Phase 6 (cohort-level repetition within one deployment), and platform-side cost / security governance under the engagement.
- **Out of scope for ARK today:** TREE Phases 1, 3, 4 (in the org-governance sense), and 5. These need either supplementary tools, manual artifacts, or new ARK modules. They should not be quoted to a customer as "ARK does this."

If a Sales conversation positions ARK as a complete TREE operating system, the customer will discover the gap during Phase 1, when they go looking for the Failure DNA Map surface and find no route serves it. The honest positioning is:

> *"ARK runs the human-side instrumentation of your TREE engagement — practitioner readiness, training, and cohort progress. The forensic, data-estate, and governance artifacts are produced alongside ARK with the engagement team's own tooling, then referenced inside ARK's reporting surfaces."*

That sentence is defensible against the code as it ships today. Anything stronger is not.
