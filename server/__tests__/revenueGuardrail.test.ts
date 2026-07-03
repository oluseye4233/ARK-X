import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUBSCRIPTION_PLANS,
  AI_TIER_COST_BUDGET_CENTS,
  AI_TIER_MONTHLY_TOKENS_V2,
  AI_TIER_DAILY_QUOTA_V2,
  AI_TIER_MODEL_POLICY,
  AI_PRICING_PER_MTOK,
  AI_MODELS,
  AI_ECONOMY_MODELS,
  AI_PREMIUM_MODELS,
} from "@shared/schema";

// ─────────────────────────────────────────────────────────────
// Phase O — Revenue / Token-Cost 10% Invariant
// These tests prove on every CI run that the constants on disk
// honour the marketing promise: AI COGS ≤ 10% of subscription MRR.
// ─────────────────────────────────────────────────────────────

test("Phase O: cost cap == round(price × 10%) for every paid tier", () => {
  // FREE has an absolute floor; ENTERPRISE is bespoke-priced (price=0 sentinel,
  // negotiated per-seat) so it carries a fixed $20/seat/month AI ceiling rather
  // than a 10%-of-list-price derivation.
  assert.equal(AI_TIER_COST_BUDGET_CENTS.INDIVIDUAL_FREE, 30, "FREE absolute $0.30 ceiling");
  assert.equal(AI_TIER_COST_BUDGET_CENTS.ENTERPRISE, 2000, "ENTERPRISE bespoke $20/seat ceiling");
  for (const planKey of ["INDIVIDUAL_PRO", "SCHOOL_STUDENT"] as const) {
    const plan = SUBSCRIPTION_PLANS[planKey];
    const cap = AI_TIER_COST_BUDGET_CENTS[planKey];
    const expected = Math.round(plan.price * 0.10 * 100);
    assert.equal(
      cap,
      expected,
      `${planKey}: cost cap ${cap}¢ ≠ 10% of $${plan.price} (expected ${expected}¢)`,
    );
  }
});

test("Phase O: V2 token cap × worst-case Sonnet-out cost ≤ cost cap", () => {
  const sonnetOutPerToken = AI_PRICING_PER_MTOK[AI_MODELS.SONNET].out / 1_000_000;
  for (const planKey of Object.keys(AI_TIER_MONTHLY_TOKENS_V2) as Array<
    keyof typeof AI_TIER_MONTHLY_TOKENS_V2
  >) {
    const tokens = AI_TIER_MONTHLY_TOKENS_V2[planKey];
    const policy = AI_TIER_MODEL_POLICY[planKey];
    if (policy.sonnetKindsAllowed.length === 0) continue; // FREE — Haiku-only
    const worstCaseCents = tokens * sonnetOutPerToken;
    const cap = AI_TIER_COST_BUDGET_CENTS[planKey];
    // The cost cap (second gate) must fire BEFORE the token cap under
    // pathological all-Sonnet-output traffic. If this fails, lower the
    // tokenCap or widen sonnetKindsAllowed restriction.
    assert.ok(
      worstCaseCents >= cap,
      `${planKey}: token cap is too tight — Sonnet-only worst case ($${(worstCaseCents / 100).toFixed(2)}) doesn't even reach cost cap ($${(cap / 100).toFixed(2)})`,
    );
  }
});

test("Phase O: FREE plan is economy-only, useClaude disabled, kcse=1/day", () => {
  const free = AI_TIER_MODEL_POLICY.INDIVIDUAL_FREE;
  // Multi-provider roster: FREE may use any economy-class model (Haiku cost
  // class or cheaper) but never a premium (Sonnet-class) model.
  assert.ok(free.allowedModels.includes(AI_MODELS.HAIKU), "FREE must keep Haiku");
  assert.deepEqual(
    [...free.allowedModels].sort(),
    AI_ECONOMY_MODELS ? [...AI_ECONOMY_MODELS].sort() : [],
    "FREE allow-list must equal the economy model set",
  );
  assert.ok(!free.allowedModels.includes(AI_MODELS.SONNET), "FREE must not get Sonnet");
  for (const m of AI_PREMIUM_MODELS) {
    assert.ok(!free.allowedModels.includes(m), `FREE must not get premium model ${m}`);
  }
  assert.equal(free.allowUseClaude, false);
  assert.equal(free.sonnetKindsAllowed.length, 0);
  assert.equal(AI_TIER_DAILY_QUOTA_V2.INDIVIDUAL_FREE.kcse, 1);
  assert.equal(AI_TIER_DAILY_QUOTA_V2.INDIVIDUAL_FREE.narrative, 0);
  assert.equal(AI_TIER_DAILY_QUOTA_V2.INDIVIDUAL_FREE.scenario_gen, 0);
  assert.equal(AI_TIER_MONTHLY_TOKENS_V2.INDIVIDUAL_FREE, 20000, "FREE token cap held constant per spec");
});

test("Phase O: every paid tier permits both models (no accidental Sonnet lockout)", () => {
  for (const planKey of ["INDIVIDUAL_PRO", "SCHOOL_STUDENT", "ENTERPRISE"] as const) {
    const policy = AI_TIER_MODEL_POLICY[planKey];
    assert.ok(policy.allowedModels.includes(AI_MODELS.HAIKU), `${planKey} missing Haiku`);
    assert.ok(policy.allowedModels.includes(AI_MODELS.SONNET), `${planKey} missing Sonnet`);
    assert.equal(policy.allowUseClaude, true, `${planKey} useClaude must be allowed`);
  }
});
