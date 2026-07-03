import { MODELS } from "./client";
import { resolveModelChain, generateWithChain } from "./providers";
import { cacheGet, cacheSet, cacheKey } from "./cache";
import { logUsage, enforceBudget, enforceCostBudget } from "./usage";
import type { CcgeCard, CcgeScenario, KcseBreakdown, SubscriptionPlan } from "@shared/schema";

export type ClaudeKcseResult = {
  kcseDelta: number;
  narrative: string;
  strengths: string[];
  weaknesses: string[];
  viaClaude: boolean;
  cached: boolean;
};

const KCSE_TTL_MS = 60 * 60 * 1000;
const KCSE_PROMPT_VERSION = "v1";

const SYSTEM_PROMPT = `You are KCSE Judge for Junglenomics' Context Craft Game Engine. The player selects Super Prompt Cards AND then authors a custom card — a real prompt they type — as the final stage. Judge how well their selected cards AND authored prompt together address the scenario. When an authoredCard is present, weigh the quality, clarity, and scenario-fit of the authored prompt most heavily.

Return strict JSON: {"kcseDelta": number (-5 to +5, additive bonus on top of deterministic score), "narrative": string (2 sentences max), "strengths": string[] (≤3), "weaknesses": string[] (≤3)}.

kcseDelta rubric:
+3..+5 = exceptional authored prompt + pillar coverage, addresses scenario explicitly
+1..+2 = competent, on-target
0 = average; matches deterministic
-2..-1 = weak/vague authored prompt or off-topic
-5..-3 = mostly irrelevant or empty authored prompt

Be terse. No prose outside the JSON.`;

function buildUserPrompt(
  scenario: CcgeScenario,
  played: CcgeCard[],
  deterministic: KcseBreakdown,
  customCard?: { name: string; body: string },
): string {
  return JSON.stringify({
    scenario: { tier: scenario.tier, title: scenario.title, prompt: scenario.prompt, targetPillars: scenario.targetPillars, tokenBudget: scenario.tokenBudget },
    playedCards: played.map(c => ({ name: c.name, pillar: c.pillar, type: c.type, baseKcse: c.baseKcse, body: c.body.slice(0, 220) })),
    authoredCard: customCard ? { name: customCard.name.slice(0, 80), body: customCard.body.slice(0, 1500) } : null,
    deterministicScore: { final: deterministic.final, knowledge: deterministic.knowledge, clarity: deterministic.clarity, specificity: deterministic.specificity, efficiency: deterministic.efficiency, craft: deterministic.craft ?? null, synergies: deterministic.synergies.map(s => s.name) },
  });
}

function parseClaudeJson(raw: string): { kcseDelta: number; narrative: string; strengths: string[]; weaknesses: string[] } | null {
  try {
    const trimmed = raw.trim().replace(/^```json\s*|\s*```$/g, "");
    const obj = JSON.parse(trimmed);
    return {
      kcseDelta: Math.max(-5, Math.min(5, Number(obj.kcseDelta) || 0)),
      narrative: String(obj.narrative || "").slice(0, 400),
      strengths: Array.isArray(obj.strengths) ? obj.strengths.slice(0, 3).map(String) : [],
      weaknesses: Array.isArray(obj.weaknesses) ? obj.weaknesses.slice(0, 3).map(String) : [],
    };
  } catch {
    return null;
  }
}

export async function scoreSessionWithClaude(opts: {
  userId: string;
  plan: SubscriptionPlan;
  scenario: CcgeScenario;
  playedCards: CcgeCard[];
  deterministic: KcseBreakdown;
  customCard?: { name: string; body: string };
  preferredModel?: string | null;
}): Promise<ClaudeKcseResult | null> {
  let chain: string[];
  try {
    await enforceBudget(opts.userId, opts.plan);
    await enforceCostBudget(opts.userId, opts.plan);
    // No Anthropic-only precheck: resolveModelChain throws when no provider
    // is usable, and the catch below degrades to deterministic scoring.
    chain = resolveModelChain({
      plan: opts.plan,
      kind: "kcse",
      preferred: opts.preferredModel,
      defaultModel: MODELS.HAIKU,
    });
  } catch (err) {
    console.warn("[ai/kcse] budget/policy blocked, falling back to deterministic");
    return null;
  }

  const sortedIds = [...opts.playedCards.map(c => c.id)].sort();
  // Fold the authored card into the cache key so a different prompt body never
  // reuses a prior verdict (the authored prompt is the dominant scored artifact).
  // Keyed on the intended primary model so switching models re-judges.
  const cardFingerprint = opts.customCard
    ? `${opts.customCard.name}::${opts.customCard.body}`
    : "";
  const key = cacheKey(["kcse", KCSE_PROMPT_VERSION, chain[0], opts.scenario.id, ...sortedIds, cardFingerprint]);
  const cached = await cacheGet<{ kcseDelta: number; narrative: string; strengths: string[]; weaknesses: string[] }>(key);
  if (cached) {
    return { ...cached, viaClaude: true, cached: true };
  }

  try {
    const userPrompt = buildUserPrompt(opts.scenario, opts.playedCards, opts.deterministic, opts.customCard);
    const t0 = Date.now();
    const gen = await generateWithChain({
      chain,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 8192,
      timeoutMs: 10000,
    });

    const parsed = parseClaudeJson(gen.text);

    await logUsage({
      userId: opts.userId,
      kind: "kcse",
      model: gen.model,
      tokensIn: gen.tokensIn,
      tokensOut: gen.tokensOut,
    });

    if (!parsed) {
      console.warn("[ai/kcse] failed to parse AI judge response, raw:", gen.text.slice(0, 200));
      return null;
    }

    await cacheSet(key, "kcse", parsed, KCSE_TTL_MS);
    console.log(`[ai/kcse] scored via ${gen.model} in ${Date.now() - t0}ms tokens=${gen.tokensIn}/${gen.tokensOut}`);
    return { ...parsed, viaClaude: true, cached: false };
  } catch (err) {
    console.error("[ai/kcse] failed, falling back:", err);
    return null;
  }
}
