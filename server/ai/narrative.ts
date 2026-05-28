import { getAnthropic, MODELS, isClaudeAvailable, assertModelAllowed } from "./client";
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
}): Promise<ResumeNarrative> {
  if (!PRO_TIERS.includes(opts.plan)) throw new ProTierRequiredError();
  if (!isClaudeAvailable()) {
    const err: any = new Error("Claude AI not configured on this server.");
    err.status = 503;
    throw err;
  }

  const key = cacheKey(["narrative", NARRATIVE_PROMPT_VERSION, MODELS.SONNET, opts.assessment.id]);
  const cached = await cacheGet<Omit<ResumeNarrative, "cached">>(key);
  if (cached) {
    return { ...cached, cached: true };
  }

  await enforceBudget(opts.userId, opts.plan);
  await enforceCostBudget(opts.userId, opts.plan);
  assertModelAllowed(opts.plan, MODELS.SONNET, "narrative");

  const client = getAnthropic();
  const message = await client.messages.create({
    model: MODELS.SONNET,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildPrompt(opts.assessment) }],
  });

  await logUsage({
    userId: opts.userId,
    kind: "narrative",
    model: MODELS.SONNET,
    tokensIn: message.usage.input_tokens,
    tokensOut: message.usage.output_tokens,
  });

  const block = message.content[0];
  const raw = block.type === "text" ? block.text : "";
  const parsed = parseNarrative(raw);
  if (!parsed) {
    const err: any = new Error("Failed to parse Claude narrative response.");
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
