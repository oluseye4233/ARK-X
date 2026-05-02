import { db } from "../db";
import { aiUsage, AI_PRICING_PER_MTOK, AI_TIER_MONTHLY_TOKENS, type AiKind, type SubscriptionPlan } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";

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
  const budget = AI_TIER_MONTHLY_TOKENS[plan as keyof typeof AI_TIER_MONTHLY_TOKENS] ?? AI_TIER_MONTHLY_TOKENS.INDIVIDUAL_FREE;
  const { total } = await getMonthlyTokens(userId);
  if (total >= budget) throw new AiBudgetExceededError(total, budget);
}
