import { getAnthropic, MODELS, isClaudeAvailable } from "./client";
import { cacheGet, cacheSet, cacheKey } from "./cache";
import { logUsage, enforceBudget } from "./usage";
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

const SYSTEM_PROMPT = `You are KCSE Judge for Junglenomics' Context Craft Game Engine. Score how well the player's selected Super Prompt Cards address the scenario.

Return strict JSON: {"kcseDelta": number (-5 to +5, additive bonus on top of deterministic score), "narrative": string (2 sentences max), "strengths": string[] (≤3), "weaknesses": string[] (≤3)}.

kcseDelta rubric:
+3..+5 = exceptional pillar coverage, novel synergy, addresses scenario explicitly
+1..+2 = competent, on-target
0 = average; matches deterministic
-2..-1 = weak coverage or off-topic
-5..-3 = mostly irrelevant

Be terse. No prose outside the JSON.`;

function buildUserPrompt(scenario: CcgeScenario, played: CcgeCard[], deterministic: KcseBreakdown): string {
  return JSON.stringify({
    scenario: { tier: scenario.tier, title: scenario.title, prompt: scenario.prompt, targetPillars: scenario.targetPillars, tokenBudget: scenario.tokenBudget },
    playedCards: played.map(c => ({ name: c.name, pillar: c.pillar, type: c.type, baseKcse: c.baseKcse, body: c.body.slice(0, 220) })),
    deterministicScore: { final: deterministic.final, knowledge: deterministic.knowledge, clarity: deterministic.clarity, specificity: deterministic.specificity, efficiency: deterministic.efficiency, synergies: deterministic.synergies.map(s => s.name) },
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
}): Promise<ClaudeKcseResult | null> {
  if (!isClaudeAvailable()) return null;

  const sortedIds = [...opts.playedCards.map(c => c.id)].sort();
  const key = cacheKey(["kcse", KCSE_PROMPT_VERSION, MODELS.HAIKU, opts.scenario.id, ...sortedIds]);
  const cached = await cacheGet<{ kcseDelta: number; narrative: string; strengths: string[]; weaknesses: string[] }>(key);
  if (cached) {
    return { ...cached, viaClaude: true, cached: true };
  }

  try {
    await enforceBudget(opts.userId, opts.plan);
  } catch (err) {
    console.warn("[ai/kcse] budget blocked, falling back to deterministic");
    return null;
  }

  try {
    const client = getAnthropic();
    const userPrompt = buildUserPrompt(opts.scenario, opts.playedCards, opts.deterministic);
    const t0 = Date.now();
    const callPromise = client.messages.create({
      model: MODELS.HAIKU,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Claude KCSE timeout 5s")), 5000),
    );
    const message = (await Promise.race([callPromise, timeoutPromise])) as Awaited<typeof callPromise> & {
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const block = message.content[0];
    const raw = block.type === "text" ? block.text : "";
    const parsed = parseClaudeJson(raw);

    await logUsage({
      userId: opts.userId,
      kind: "kcse",
      model: MODELS.HAIKU,
      tokensIn: message.usage.input_tokens,
      tokensOut: message.usage.output_tokens,
    });

    if (!parsed) {
      console.warn("[ai/kcse] failed to parse Claude response, raw:", raw.slice(0, 200));
      return null;
    }

    await cacheSet(key, "kcse", parsed, KCSE_TTL_MS);
    console.log(`[ai/kcse] scored in ${Date.now() - t0}ms tokens=${message.usage.input_tokens}/${message.usage.output_tokens}`);
    return { ...parsed, viaClaude: true, cached: false };
  } catch (err) {
    console.error("[ai/kcse] failed, falling back:", err);
    return null;
  }
}
