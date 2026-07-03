import { MODELS } from "./client";
import { resolveModelChain, generateWithChain } from "./providers";
import { cacheGet, cacheSet, cacheKey } from "./cache";
import { logUsage, enforceBudget, enforceCostBudget } from "./usage";
import type { Assessment, SubscriptionPlan } from "@shared/schema";

export type ResumeNarrative = {
  summary: string;
  archetypeInsight: string;
  topRisks: string[];
  growthPath: string[];
  generatedAt: string;
  cached: boolean;
};

const NARRATIVE_TTL_MS = 24 * 60 * 60 * 1000;
const NARRATIVE_PROMPT_VERSION = "v1";

const SYSTEM_PROMPT = `You are ARK Career Intelligence, drafting a personalized executive briefing for a single professional. Output strict JSON, no prose around it:

{"summary": string (3 sentences), "archetypeInsight": string (2 sentences on what their dominant archetype means for their career), "topRisks": string[] (3 items, each a concrete AI/automation risk for their role, ≤18 words), "growthPath": string[] (3 items, each a concrete next move ordered by leverage, ≤18 words)}

Voice: cyberpunk-enterprise. Concrete, specific, no platitudes. Reference their actual JST score and archetype.`;

function buildPrompt(a: Assessment): string {
  return JSON.stringify({
    jst: { total: a.jstTotal, jobs: a.jstJobs, skills: a.jstSkills, talent: a.jstTalent },
    vulnerabilityLevel: a.vulnerabilityLevel,
    readinessProfile: a.readinessProfile,
    archetypes: { architect: a.archetypeArchitect, orchestrator: a.archetypeOrchestrator, conductor: a.archetypeConductor },
    contextCraftLevel: a.contextCraftLevel,
    riskModifiers: (a.riskModifiers || []).slice(0, 8),
    matchedCardCount: (a.matchedCardIds || []).length,
  });
}

function parseNarrative(raw: string): Omit<ResumeNarrative, "generatedAt" | "cached"> | null {
  try {
    const trimmed = raw.trim().replace(/^```json\s*|\s*```$/g, "");
    const obj = JSON.parse(trimmed);
    return {
      summary: String(obj.summary || "").slice(0, 800),
      archetypeInsight: String(obj.archetypeInsight || "").slice(0, 500),
      topRisks: Array.isArray(obj.topRisks) ? obj.topRisks.slice(0, 3).map((s: any) => String(s).slice(0, 200)) : [],
      growthPath: Array.isArray(obj.growthPath) ? obj.growthPath.slice(0, 3).map((s: any) => String(s).slice(0, 200)) : [],
    };
  } catch {
    return null;
  }
}

const PRO_TIERS: SubscriptionPlan[] = ["INDIVIDUAL_PRO", "SCHOOL_STUDENT", "ENTERPRISE"];

export class ProTierRequiredError extends Error {
  status = 402;
  constructor() { super("AI Resume Narrative requires Individual Pro, School/Student, or Enterprise plan."); }
}

export async function generateResumeNarrative(opts: {
  userId: string;
  plan: SubscriptionPlan;
  assessment: Assessment;
  preferredModel?: string | null;
}): Promise<ResumeNarrative> {
  if (!PRO_TIERS.includes(opts.plan)) throw new ProTierRequiredError();

  // Guardrail order: budget gates BEFORE model resolution/generation.
  await enforceBudget(opts.userId, opts.plan);
  await enforceCostBudget(opts.userId, opts.plan);

  // resolveModelChain throws 503 NoAiProviderAvailableError when no
  // provider is usable — no Anthropic-only precheck (LLM-resilient).
  const chain = resolveModelChain({
    plan: opts.plan,
    kind: "narrative",
    preferred: opts.preferredModel,
    defaultModel: MODELS.SONNET,
  });

  // Cache is keyed on the intended primary model so switching models
  // regenerates rather than serving another model's cached output.
  const key = cacheKey(["narrative", NARRATIVE_PROMPT_VERSION, chain[0], opts.assessment.id]);
  const cached = await cacheGet<Omit<ResumeNarrative, "cached">>(key);
  if (cached) {
    return { ...cached, cached: true };
  }

  const gen = await generateWithChain({
    chain,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(opts.assessment),
    maxTokens: 8192,
  });

  await logUsage({
    userId: opts.userId,
    kind: "narrative",
    model: gen.model,
    tokensIn: gen.tokensIn,
    tokensOut: gen.tokensOut,
  });

  const parsed = parseNarrative(gen.text);
  if (!parsed) {
    const err: any = new Error("Failed to parse AI narrative response.");
    err.status = 502;
    throw err;
  }

  const result: Omit<ResumeNarrative, "cached"> = {
    ...parsed,
    generatedAt: new Date().toISOString(),
  };
  await cacheSet(key, "narrative", result, NARRATIVE_TTL_MS);
  return { ...result, cached: false };
}
