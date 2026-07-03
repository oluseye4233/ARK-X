import { MODELS } from "./client";
import { resolveModelChain, generateWithChain } from "./providers";
import { logUsage, enforceBudget, enforceCostBudget } from "./usage";
import { ALL_CARD_PILLARS, CCGE_TIERS, type SubscriptionPlan, type InsertCcgeScenario } from "@shared/schema";

const SYSTEM_PROMPT = `You are ARK Game Designer. Generate a single CCGE scenario as strict JSON:

{"id": kebab-case slug ≤40 chars, "tier": one of ["Bronze","Silver","Gold","Platinum"], "title": ≤60 chars, "prompt": 2-4 sentences describing the real-world prompt-engineering challenge, "targetPillars": 2-4 entries from ${JSON.stringify(ALL_CARD_PILLARS)}, "tokenBudget": int 30-120 scaled with tier, "difficulty": int 1-5}

Difficulty + tokenBudget guide: Bronze=1-2/40-60, Silver=2-3/60-80, Gold=3-4/80-100, Platinum=4-5/100-120.
No prose around the JSON.`;

export async function generateScenario(opts: {
  userId: string;
  plan: SubscriptionPlan;
  brief: string;
  industry?: string;
  role?: string;
  tierHint?: string;
  preferredModel?: string | null;
}): Promise<InsertCcgeScenario> {
  // No Anthropic-only precheck — resolveModelChain throws 503 when no
  // provider at all is usable (LLM-resilient).
  await enforceBudget(opts.userId, opts.plan);
  await enforceCostBudget(opts.userId, opts.plan);
  const chain = resolveModelChain({
    plan: opts.plan,
    kind: "scenario_gen",
    preferred: opts.preferredModel,
    defaultModel: MODELS.SONNET,
  });

  const contextLines: string[] = [];
  if (opts.industry) contextLines.push(`Industry / Sector: ${opts.industry}`);
  if (opts.role) contextLines.push(`Practitioner Role: ${opts.role}`);
  if (opts.tierHint) contextLines.push(`Target Tier: ${opts.tierHint}`);
  contextLines.push(`Brief: ${opts.brief.slice(0, 800)}`);
  if (opts.industry || opts.role) {
    contextLines.push(
      `Ground the scenario in a realistic problem this practitioner faces day-to-day. The title and prompt MUST reference the industry context explicitly.`,
    );
  }

  const gen = await generateWithChain({
    chain,
    system: SYSTEM_PROMPT,
    prompt: contextLines.join("\n"),
    maxTokens: 8192,
  });

  await logUsage({
    userId: opts.userId,
    kind: "scenario_gen",
    model: gen.model,
    tokensIn: gen.tokensIn,
    tokensOut: gen.tokensOut,
  });

  const raw = gen.text;
  let obj: any;
  try {
    obj = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    const e: any = new Error("Failed to parse AI scenario JSON.");
    e.status = 502; throw e;
  }

  if (!CCGE_TIERS.includes(obj.tier)) { const e: any = new Error("Invalid tier from AI model."); e.status = 502; throw e; }
  const targetPillars: string[] = Array.isArray(obj.targetPillars)
    ? obj.targetPillars.filter((p: any) => (ALL_CARD_PILLARS as readonly string[]).includes(p))
    : [];
  if (targetPillars.length < 2) { const e: any = new Error("AI model returned <2 valid target pillars."); e.status = 502; throw e; }

  return {
    id: String(obj.id || `gen-${Date.now()}`).slice(0, 40),
    tier: obj.tier,
    title: String(obj.title || "Untitled").slice(0, 60),
    prompt: String(obj.prompt || "").slice(0, 1000),
    targetPillars,
    tokenBudget: Math.max(30, Math.min(120, parseInt(obj.tokenBudget) || 60)),
    difficulty: Math.max(1, Math.min(5, parseInt(obj.difficulty) || 2)),
  };
}
