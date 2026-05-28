---
name: Revenue Guardrail two-gate AI budget
description: Why ARK enforces both a token cap AND a cost cap per tier, and how the legacy/V2 picker stays flag-safe.
---

# Two-gate AI budget — token cap + cost cap

**Rule.** Every paid AI call MUST clear both `enforceBudget` (token cap) AND `enforceCostBudget` (cents cap) BEFORE `assertModelAllowed`. Whichever gate fires first wins. The cost cap exists because a token-only cap can be blown out 10× by Sonnet-out traffic.

**Why:** a single token cap was bypassable — pathological Sonnet-output traffic at $15 / Mtok-out turns the same token budget into 10× the COGS. The 10% Rule (AI COGS ≤ 10% of MRR/tier) only holds if a second cents-denominated ceiling exists and fires independently.

**How to apply:**
- Any new AI call site (anything that hits `getAnthropic().messages.create`) must call, in order: `enforceBudget` → `enforceCostBudget` → `assertModelAllowed`. Missing one of the three silently breaks the invariant.
- The cap constants live in `shared/schema.ts` (`AI_TIER_COST_BUDGET_CENTS`, `AI_TIER_MONTHLY_TOKENS_V2`, `AI_TIER_MODEL_POLICY`). Any change to a paid tier's `SUBSCRIPTION_PLANS[X].price` MUST update `AI_TIER_COST_BUDGET_CENTS[X]` to `round(price × 10)` cents in the same commit, or the CI invariant test fails.
- `INDIVIDUAL_FREE` carries an absolute $0.30 floor (price is $0); `ENTERPRISE` carries a bespoke $20/seat ceiling (price is the $0 "contact us" sentinel) — both are exceptions to the 10% derivation. Encode them explicitly in any new invariant test, don't loop them through the `price × 0.10` formula.
- The `revenueGuardrail` flag toggles V1↔V2 tables via the picker in `server/ai/usage.ts`. With the flag OFF, `enforceCostBudget` and `assertModelAllowed` MUST be hard no-ops — never call into them at the storage layer, never log a denial, never mutate quota counters. Otherwise a flag-off rollback flips behavior in ways the rollback was supposed to undo.
