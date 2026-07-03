import { MODELS } from "./client";
import { resolveModelChain, generateWithChain } from "./providers";
import { cacheGet, cacheSet, cacheKey } from "./cache";
import { logUsage, enforceBudget, enforceCostBudget, enforceDailyQuota } from "./usage";
import {
  CC_PILLARS,
  hiveToLetterGrade,
  SPC_AI_ANALYSIS_TTL_MS,
  type CCPillar,
  type SpcAiAnalysis,
  type SpcListing,
  type SubscriptionPlan,
} from "@shared/schema";

const PROMPT_VERSION = "spc-analysis-v1";
const PRO_TIERS: SubscriptionPlan[] = ["INDIVIDUAL_PRO", "SCHOOL_STUDENT", "ENTERPRISE"];

export class SpcAnalysisProTierRequiredError extends Error {
  status = 402;
  constructor() {
    super("AI Analysis requires Individual Pro, School/Student, or Enterprise plan.");
  }
}

const SYSTEM_PROMPT = `You are SPHINX AI Analyst, grading a Super Prompt Card (SPC) against the 7 Context-Craft pillars (System, Role, Instruction, Example, Constraint, Format, Data). Output strict JSON only:

{"pillarSuggestions": [{"pillar": "<one of System|Role|Instruction|Example|Constraint|Format|Data>", "currentStrength": <0-100 integer>, "suggestion": "<≤22 words, concrete improvement>"}, ...]}

Rules:
- Return exactly 7 entries — one for each pillar in the order listed above.
- "currentStrength" reflects how well the prompt addresses that pillar (0=absent, 100=excellent).
- "suggestion" must be a single concrete edit the author can apply. Reference the prompt's own structure or wording when possible. No platitudes.
- Voice: cyberpunk-enterprise, terse, technical.`;

function buildUserPrompt(listing: SpcListing): string {
  return JSON.stringify({
    title: listing.title,
    description: listing.description,
    pillar: listing.pillar,
    hiveScore: listing.hiveScore,
    kcseScore: listing.kcseScore,
    body: listing.body.slice(0, 8000),
  });
}

type RawAnalysis = { pillarSuggestions: SpcAiAnalysis["pillarSuggestions"] };

function parseAnalysis(raw: string): RawAnalysis | null {
  try {
    const trimmed = raw.trim().replace(/^```json\s*|\s*```$/g, "");
    const obj = JSON.parse(trimmed);
    if (!Array.isArray(obj.pillarSuggestions)) return null;
    const byPillar = new Map<CCPillar, { strength: number; suggestion: string }>();
    for (const entry of obj.pillarSuggestions) {
      const pillar = String(entry?.pillar || "") as CCPillar;
      if (!CC_PILLARS.includes(pillar)) continue;
      const strength = Math.max(0, Math.min(100, Math.round(Number(entry?.currentStrength ?? 0))));
      const suggestion = String(entry?.suggestion || "").slice(0, 240);
      if (!suggestion) continue;
      byPillar.set(pillar, { strength, suggestion });
    }
    // Ensure all 7 pillars are present; fill gaps with a neutral suggestion.
    const ordered = CC_PILLARS.map((pillar) => {
      const found = byPillar.get(pillar);
      return {
        pillar,
        currentStrength: found?.strength ?? 50,
        suggestion: found?.suggestion ?? "Add an explicit section for this pillar to lift coverage.",
      };
    });
    return { pillarSuggestions: ordered };
  } catch {
    return null;
  }
}

export async function analyzeSpcListing(opts: {
  userId: string;
  plan: SubscriptionPlan;
  listing: SpcListing;
}): Promise<SpcAiAnalysis> {
  if (!PRO_TIERS.includes(opts.plan)) throw new SpcAnalysisProTierRequiredError();

  // Guardrail order: quota + budget gates BEFORE model resolution.
  // NB (Phase O): SPC analysis intentionally maps to the "narrative" AiKind —
  // it shares the Haiku-cost-and-cadence profile of resume narrative gen. If
  // product later wants distinct economics for SPC, add a new AiKind in
  // shared/schema.ts and update AI_TIER_DAILY_QUOTA_V2 + MODEL_POLICY in lockstep.
  await enforceDailyQuota(opts.userId, opts.plan, "narrative");
  await enforceBudget(opts.userId, opts.plan);
  await enforceCostBudget(opts.userId, opts.plan);
  // LLM-resilient: chain falls back across providers; 503 only when no
  // provider is usable (replaces the old Anthropic-only precheck).
  const chain = resolveModelChain({
    plan: opts.plan,
    kind: "narrative",
    defaultModel: MODELS.HAIKU,
  });

  // Cache is keyed on the resolved primary model so fallback output from a
  // different provider never masquerades as another model's cached result.
  const key = cacheKey([
    "spc-analysis",
    PROMPT_VERSION,
    chain[0],
    opts.listing.id,
    opts.listing.hiveScore,
    opts.listing.kcseScore,
    opts.listing.body.length,
  ]);

  const cached = await cacheGet<Omit<SpcAiAnalysis, "cached">>(key);
  if (cached) return { ...cached, cached: true };

  const gen = await generateWithChain({
    chain,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(opts.listing),
    maxTokens: 1500,
  });

  await logUsage({
    userId: opts.userId,
    kind: "narrative",
    model: gen.model,
    tokensIn: gen.tokensIn,
    tokensOut: gen.tokensOut,
  });

  const parsed = parseAnalysis(gen.text);
  if (!parsed) {
    const err: any = new Error("Failed to parse AI analysis response.");
    err.status = 502;
    throw err;
  }

  const grade = hiveToLetterGrade(opts.listing.hiveScore);
  const result: Omit<SpcAiAnalysis, "cached"> = {
    letterGrade: grade.grade,
    letterGradeColor: grade.color,
    hiveScore: opts.listing.hiveScore,
    pillarSuggestions: parsed.pillarSuggestions,
    generatedAt: new Date().toISOString(),
  };
  await cacheSet(key, "spc-analysis", result, SPC_AI_ANALYSIS_TTL_MS);
  return { ...result, cached: false };
}
