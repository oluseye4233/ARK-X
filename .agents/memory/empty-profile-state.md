---
name: Empty profile / no-sources state
description: How the cumulative ARK profile signals "no sources contributed" vs legacy untracked assessments.
---

# Empty profile (all sources removed)

When a user removes their last assessment source, `runCumulativeAssessment`
must NOT run the keyword analyzer over empty text — the analyzer clamps to
misleading floor-baseline JST/ARK scores (a weak-but-real-looking profile).
Instead it takes an empty-input branch that persists an honest zeroed
assessment and syncs ARK downward.

**Detection signal:** `isEmptyProfile(sourcesUsed, completeness)` in
`shared/assessmentMerge.ts` — true only when `sourcesUsed` is an *empty array*
(NOT null) and `completeness === 0`.

**Why the empty-array-vs-null distinction matters:** legacy single-assessment
rows (e.g. created via `POST /api/assessments`) have `sourcesUsed = null` and
real scores — they are NOT empty and must still render normally. Only the
cumulative path writes `sourcesUsed = []`. So any new surface guarding the empty
state must use `Array.isArray(sourcesUsed) && length === 0 && completeness === 0`,
never a falsy check on `sourcesUsed`.

**How to apply:** any surface that reads the latest assessment and shows scores
(dashboard, ARK Report, and any future history/identity views) should branch on
`isEmptyProfile` and show a "no sources contributed yet — add one on /upload"
state rather than the zeroed/floor numbers.
