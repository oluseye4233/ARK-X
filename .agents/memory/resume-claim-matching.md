---
name: Resume claim confirmation matching
description: How third-party confirmations attach to resume claims (employment/cert/skill) and why matching is split exact-vs-fuzzy.
---

Confirmations attach to resume claims by string comparison in three coordinated spots that must stay in lockstep: the write-time existence check (`POST /api/confirmations`), the server read-time attach (`buildArkResume`), and the client cert badge lookup (`ark-resume.tsx`).

- **SKILL** matches on the stable CODEC card id — keep this EXACT (lowercased). Fuzzing card ids would cross-attach distinct primitives.
- **EMPLOYMENT** and **CERTIFICATION** are tolerant via `shared/claimMatch.ts` (`companyMatches` / `certMatches`): normalize punctuation/casing/diacritics, strip generic company descriptor tokens (Inc/LLC AND industries/solutions/group…), then token-containment + length-relative Levenshtein.

**Why:** confirmers phrase claims differently than the resume ("Vance Inc." vs "Vance Industries"); an exact lowercased match silently orphaned legitimate confirmations. Company suffix stripping is deliberately aggressive (drops descriptor words, not just legal suffixes) so "Vance Inc."→"vance"==="Vance Industries"→"vance".

**How to apply:** any new place that links a confirmation to a claim must reuse `companyMatches`/`certMatches` (never re-implement exact match). Storage still dedups confirmations on exact `(userId, type, targetRef)` — that's the confirmer's own phrasing and is intentionally not fuzzed.
