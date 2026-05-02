import { getAnthropic, MODELS, isClaudeAvailable } from "./client";
import { logUsage, enforceBudget } from "./usage";
import { ALL_CARD_PILLARS, CCGE_TIERS, type SubscriptionPlan, type InsertCcgeScenario } from "@shared/schema";

const SYSTEM_PROMPT = `You are ARK Game Designer. Generate a single CCGE scenario as strict JSON:

{"id": kebab-case slug ≤40 chars, "tier": one of ["Bronze","Silver","Gold","Platinum"], "title": ≤60 chars, "prompt": 2-4 sentences describing the real-world prompt-engineering challenge, "targetPillars": 2-4 entries from ${JSON.stringify(ALL_CARD_PILLARS)}, "tokenBudget": int 30-120 scaled with tier, "difficulty": int 1-5}

Difficulty + tokenBudget guide: Bronze=1-2/40-60, Silver=2-3/60-80, Gold=3-4/80-100, Platinum=4-5/100-120.
No prose around the JSON.`;

export async function generateScenario(opts: {
  userId: string;
  plan: SubscriptionPlan;
  brief: string;
}): Promise<InsertCcgeScenario> {
  if (!isClaudeAvailable()) {
    const err: any = new Error("Claude AI not configured.");
    err.status = 503;
    throw err;
  }

  await enforceBudget(opts.userId, opts.plan);

  const client = getAnthropic();
  const message = await client.messages.create({
    model: MODELS.SONNET,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Brief: ${opts.brief.slice(0, 800)}` }],
  });

  await logUsage({
    userId: opts.userId,
    kind: "scenario_gen",
    model: MODELS.SONNET,
    tokensIn: message.usage.input_tokens,
    tokensOut: message.usage.output_tokens,
  });

  const block = message.content[0];
  const raw = block.type === "text" ? block.text : "";
  let obj: any;
  try {
    obj = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    const e: any = new Error("Failed to parse Claude scenario JSON.");
    e.status = 502; throw e;
  }

  if (!CCGE_TIERS.includes(obj.tier)) { const e: any = new Error("Invalid tier from Claude."); e.status = 502; throw e; }
  const targetPillars: string[] = Array.isArray(obj.targetPillars)
    ? obj.targetPillars.filter((p: any) => (ALL_CARD_PILLARS as readonly string[]).includes(p))
    : [];
  if (targetPillars.length < 2) { const e: any = new Error("Claude returned <2 valid target pillars."); e.status = 502; throw e; }

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
