---
name: Flywheel cap models (two distinct philosophies)
description: ARK has TWO different flywheel-cap mechanisms; pick the one matching the sibling feature you mirror.
---

# Two flywheel cap models coexist in arkRecalc

The ARK recalc pipeline applies daily/30d caps, but there are **two distinct
mechanisms** for how a feature's JST boost is sourced — they cap differently:

1. **Assessment-mutation + daily throttle** (CCGE, and Card Verification).
   The boost is written directly into `assessments.jstSkills/jstTotal` inside the
   feature's storage transaction (e.g. `finalizeSession`, `finalizeCardVerification`).
   `recalcArkForUser` then reads `assessment.jstSkills` as the JST source. The daily
   cap (`CCGE_PER_DAY`, `VERIFICATION_PER_DAY`) limits the *applied ARK delta per day*
   via proportional scaling — but the full boost stays baked in the assessment, so
   withheld delta is released on subsequent days' recalcs. **The daily cap throttles
   the RATE of ARK gain, not the lifetime total.** This is intentional for daily events.

2. **Stateless / event-derived hard cap** (SPHINX talent boost).
   The boost is NOT stored on the assessment. `recalcArkForUser` re-derives it each run
   by counting `arkScoreHistory` rows where `delta > 0` (capped rows have `delta = 0`
   and are excluded forever). The 30-day cap is therefore a **hard lifetime ceiling** —
   capped gains never leak.

**Why this matters:** an architect review may flag the assessment-mutation model as a
"cap-bypass" vs SPHINX. It is not a bug — it is the deliberate CCGE design. When adding
a new flywheel surface, mirror the SIBLING the task references. Card Verification was
specified to mirror CCGE (heavier weight), so it correctly uses model #1.

**How to apply:** Model #1 features MUST lock the user row (`.for("update")` on `users`)
at the top of their finalize transaction before mutating the latest assessment — this
serializes concurrent finishes for the same user and prevents lost updates (two submits
for different cards both reading the same `jstSkills`). CCGE's `finalizeSession` and
`finalizeCardVerification` both do this.
