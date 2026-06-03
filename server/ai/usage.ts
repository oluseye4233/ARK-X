import { db } from "../db";
import {
  aiUsage,
  users,
  F1000_PROMO,
  AI_PRICING_PER_MTOK,
  AI_TIER_MONTHLY_TOKENS,
  AI_TIER_DAILY_QUOTA,
  AI_TIER_MONTHLY_TOKENS_V2,
  AI_TIER_DAILY_QUOTA_V2,
  AI_TIER_COST_BUDGET_CENTS,
  type AiKind,
  type SubscriptionPlan,
} from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { isFeatureEnabled } from "../featureFlags";

/** Is this user an F1000 promo member? Resolved per-call so AI call sites
 * need not thread the flag through. */
async function isF1000Member(userId: string): Promise<boolean> {
  const [u] = await db.select({ f: users.f1000Member }).from(users).where(eq(users.id, userId));
  return !!u?.f;
}

/**
 * Phase O — pick V1 (legacy) vs V2 (rebalanced) budgets based on the
 * `revenueGuardrail` flag. With the flag OFF the engine returns the exact
 * same numbers as before Phase O — no behaviour change on merge.
 */
function tierTokenCap(plan: SubscriptionPlan, f1000 = false): number {
  if (f1000 && F1000_PROMO.aiMonthlyTokens[plan as keyof typeof F1000_PROMO.aiMonthlyTokens] != null) {
    return F1000_PROMO.aiMonthlyTokens[plan as keyof typeof F1000_PROMO.aiMonthlyTokens];
  }
  const table = isFeatureEnabled("revenueGuardrail")
    ? AI_TIER_MONTHLY_TOKENS_V2
    : AI_TIER_MONTHLY_TOKENS;
  return table[plan as keyof typeof table] ?? table.INDIVIDUAL_FREE;
}

function tierDailyQuotas(plan: SubscriptionPlan): Record<string, number> {
  const table = isFeatureEnabled("revenueGuardrail")
    ? AI_TIER_DAILY_QUOTA_V2
    : AI_TIER_DAILY_QUOTA;
  return (table[plan as keyof typeof table] ?? table.INDIVIDUAL_FREE) as Record<string, number>;
}

function tierCostCapCents(plan: SubscriptionPlan, f1000 = false): number {
  if (f1000 && F1000_PROMO.aiCostBudgetCents[plan as keyof typeof F1000_PROMO.aiCostBudgetCents] != null) {
    return F1000_PROMO.aiCostBudgetCents[plan as keyof typeof F1000_PROMO.aiCostBudgetCents];
  }
  return (
    AI_TIER_COST_BUDGET_CENTS[plan as keyof typeof AI_TIER_COST_BUDGET_CENTS] ??
    AI_TIER_COST_BUDGET_CENTS.INDIVIDUAL_FREE
  );
}

export function computeCostCents(model: keyof typeof AI_PRICING_PER_MTOK, tokensIn: number, tokensOut: number): number {
  const p = AI_PRICING_PER_MTOK[model];
  if (!p) return 0;
  const cents = (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
  return Math.max(1, Math.round(cents * 100) / 100);
}

export async function logUsage(opts: {
  userId: string;
  kind: AiKind;
  model: string;
  tokensIn: number;
  tokensOut: number;
}): Promise<void> {
  const costCents = AI_PRICING_PER_MTOK[opts.model as keyof typeof AI_PRICING_PER_MTOK]
    ? computeCostCents(opts.model as any, opts.tokensIn, opts.tokensOut)
    : 0;
  try {
    await db.insert(aiUsage).values({
      userId: opts.userId,
      kind: opts.kind,
      model: opts.model,
      tokensIn: opts.tokensIn,
      tokensOut: opts.tokensOut,
      costCents,
    });
  } catch (err) {
    console.error("[ai/usage] log failed (best-effort):", err);
  }
}

export async function getMonthlyTokens(userId: string): Promise<{ tokensIn: number; tokensOut: number; total: number; costCents: number }> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({
      tokensIn: sql<number>`COALESCE(SUM(${aiUsage.tokensIn}), 0)::int`,
      tokensOut: sql<number>`COALESCE(SUM(${aiUsage.tokensOut}), 0)::int`,
      costCents: sql<number>`COALESCE(SUM(${aiUsage.costCents}), 0)::int`,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, monthStart)));
  const tokensIn = row?.tokensIn ?? 0;
  const tokensOut = row?.tokensOut ?? 0;
  return { tokensIn, tokensOut, total: tokensIn + tokensOut, costCents: row?.costCents ?? 0 };
}

export class AiBudgetExceededError extends Error {
  status = 429;
  constructor(public used: number, public budget: number) {
    super(`AI monthly token budget exceeded (${used}/${budget}). Upgrade your plan for more.`);
  }
}

export async function enforceBudget(userId: string, plan: SubscriptionPlan): Promise<void> {
  const budget = tierTokenCap(plan, await isF1000Member(userId));
  const { total } = await getMonthlyTokens(userId);
  if (total >= budget) throw new AiBudgetExceededError(total, budget);
}

export class AiCostBudgetExceededError extends Error {
  status = 429;
  upgradePath = "/subscription";
  constructor(public usedCents: number, public capCents: number) {
    super(
      `AI monthly cost budget exceeded ($${(usedCents / 100).toFixed(2)} of $${(capCents / 100).toFixed(2)}). Upgrade your plan for more.`,
    );
  }
}

/**
 * Phase O — second, cost-denominated gate. Dead code when
 * `revenueGuardrail` is OFF (returns immediately). When ON, sums the
 * trailing-month `cost_cents` from `ai_usage` and throws if ≥ cap.
 * Pairs with `enforceBudget` (token-cap) — both must pass.
 */
export async function enforceCostBudget(userId: string, plan: SubscriptionPlan): Promise<void> {
  if (!isFeatureEnabled("revenueGuardrail")) return;
  const cap = tierCostCapCents(plan, await isF1000Member(userId));
  const { costCents } = await getMonthlyTokens(userId);
  if (costCents >= cap) throw new AiCostBudgetExceededError(costCents, cap);
}

/** Count of fresh AI calls of a given kind in the trailing UTC day. */
export async function getDailyUsageCount(userId: string, kind: AiKind): Promise<number> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.kind, kind), gte(aiUsage.createdAt, dayStart)));
  return row?.n ?? 0;
}

export class AiDailyQuotaExceededError extends Error {
  status = 429;
  constructor(public kind: AiKind, public used: number, public quota: number) {
    super(`AI daily quota exceeded for ${kind} (${used}/${quota}). Try again tomorrow or upgrade your plan.`);
  }
}

/** Per-user daily quota check. Only fresh (uncached) calls should invoke this. */
export async function enforceDailyQuota(userId: string, plan: SubscriptionPlan, kind: AiKind): Promise<void> {
  const quota = tierDailyQuotas(plan)[kind] ?? 0;
  if (quota <= 0) throw new AiDailyQuotaExceededError(kind, 0, 0);
  const used = await getDailyUsageCount(userId, kind);
  if (used >= quota) throw new AiDailyQuotaExceededError(kind, used, quota);
}

/**
 * Phase O — single surface for `/api/ai/status` and `<AiBudgetBanner/>`.
 * Returns both gates' caps + the user's % consumption against the binding
 * (max) one. When the flag is OFF, `costCapCents` is still reported (so the
 * client can preview the ratio) but enforcement is token-only.
 */
export async function getTierStatus(userId: string, plan: SubscriptionPlan): Promise<{
  usage: { tokensIn: number; tokensOut: number; total: number; costCents: number };
  caps: { tokenCap: number; costCapCents: number };
  remaining: { tokens: number; costCents: number };
  ratioPct: number;
  upgradeAtPct: 80;
  hardStopAtPct: 100;
  guardrailActive: boolean;
}> {
  const usage = await getMonthlyTokens(userId);
  const f1000 = await isF1000Member(userId);
  const tokenCap = tierTokenCap(plan, f1000);
  const costCapCents = tierCostCapCents(plan, f1000);
  const tokenPct = tokenCap > 0 ? (usage.total / tokenCap) * 100 : 0;
  const costPct = costCapCents > 0 ? (usage.costCents / costCapCents) * 100 : 0;
  const ratioPct = Math.round(Math.max(tokenPct, costPct));
  return {
    usage,
    caps: { tokenCap, costCapCents },
    remaining: {
      tokens: Math.max(0, tokenCap - usage.total),
      costCents: Math.max(0, costCapCents - usage.costCents),
    },
    ratioPct,
    upgradeAtPct: 80,
    hardStopAtPct: 100,
    guardrailActive: isFeatureEnabled("revenueGuardrail"),
  };
}
