// ─────────────────────────────────────────────────────────────────────────
// ATOMIC GAUNTLET (adapted, JNGL-ACC-PDD-AGL-2026-001)
//
// Honesty note: the source PDD describes running an "agent under test"
// through a registered RL environment. ARK-X has no code-execution or
// sandboxing infrastructure — building one is a separate, much larger
// project, not something to fabricate here. This is a deliberately
// reduced-scope reinterpretation: an AI-judged quality/functionality
// review of a user's AI-Native App Showcase entry (the same data the
// Living Resume Designer's AiAppShowcase already collects), scored via
// the existing multi-provider AI chain, with a deterministic fallback —
// same resilience pattern used throughout this codebase (e.g.
// aiMapCardsToCompanies in server/arkResume.ts).
// ─────────────────────────────────────────────────────────────────────────
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import { gauntletRuns, userCredits, type GauntletRun } from "@shared/schema";
import { MODELS } from "./ai/client";
import { resolveUtilityChain, generateWithChain } from "./ai/providers";
import { runHivePrecheck, getOrCreateCredits } from "./sphinx";

export type GauntletVerdict = "VIABLE" | "NEEDS_WORK" | "INCOMPLETE";

export interface GauntletAppInput {
  name: string;
  pitch: string;
  stack: string;
  url: string;
  testDemoSrcdoc?: string;
}

export interface GauntletScoreResult {
  hiveVector: Record<string, number>;
  hiveScore: number;
  verdict: GauntletVerdict;
  reasons: string[];
}

const HIVE_DIMENSIONS = [
  "functionality", "clarity", "stackCoherence", "demoCompleteness", "honesty",
] as const;

function verdictFromScore(score: number): GauntletVerdict {
  if (score >= 70) return "VIABLE";
  if (score >= 40) return "NEEDS_WORK";
  return "INCOMPLETE";
}

// Deterministic fallback — extends runHivePrecheck's keyword/length
// heuristic to the app's pitch/stack text. Used when no AI provider chain
// is configured, matching the resilience pattern used everywhere else in
// this codebase; never blocks the feature on a missing API key.
function scoreAppGauntletHeuristic(input: GauntletAppInput): GauntletScoreResult {
  const reasons: string[] = [];
  const pre = runHivePrecheck({
    title: input.name,
    description: input.pitch,
    body: `${input.stack}\n${input.testDemoSrcdoc ?? ""}`,
    pillar: "System",
  });
  reasons.push(...pre.reasons, ...pre.warnings);

  let functionality = pre.hiveScore;
  if (input.url.trim()) functionality += 5; else reasons.push("No hosted link provided.");
  const demoCompleteness = input.testDemoSrcdoc?.trim() ? 70 : 30;
  if (!input.testDemoSrcdoc?.trim()) reasons.push("No 'Test My Work' demo provided.");
  const stackCoherence = input.stack.trim().length > 3 ? 60 : 20;
  const clarity = input.pitch.trim().length >= 20 ? 65 : 25;
  const honesty = 60; // no independent signal without an AI judge — neutral baseline

  const hiveVector: Record<string, number> = {
    functionality: clamp(functionality),
    clarity: clamp(clarity),
    stackCoherence: clamp(stackCoherence),
    demoCompleteness: clamp(demoCompleteness),
    honesty: clamp(honesty),
  };
  const hiveScore = meanScore(hiveVector);
  return { hiveVector, hiveScore, verdict: verdictFromScore(hiveScore), reasons };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function meanScore(vector: Record<string, number>): number {
  const values = Object.values(vector);
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

export async function scoreAppGauntlet(input: GauntletAppInput): Promise<GauntletScoreResult> {
  const chain = resolveUtilityChain(MODELS.HAIKU);
  if (chain.length === 0) {
    return scoreAppGauntletHeuristic(input);
  }

  try {
    const prompt = `Evaluate this AI-native app submission across 5 dimensions (0-100 each): functionality (does the described functionality sound real and coherent), clarity (is the pitch clear and specific, not vague marketing), stackCoherence (does the declared stack make sense for the described app), demoCompleteness (is there a working "Test My Work" demo), honesty (does the submission avoid overstated/unverifiable claims). Return ONLY a JSON object: {"functionality":N,"clarity":N,"stackCoherence":N,"demoCompleteness":N,"honesty":N,"reasons":["..."]}.

App name: ${input.name}
Pitch: ${input.pitch}
Stack: ${input.stack}
Hosted URL: ${input.url || "(none provided)"}
Has demo: ${input.testDemoSrcdoc?.trim() ? "yes" : "no"}`;

    const gen = await generateWithChain({
      chain,
      system: "You are a precise, skeptical JSON-only app-quality evaluator. Never inflate scores for vague or unverifiable claims.",
      prompt,
      maxTokens: 400,
    });
    const raw = gen.text;
    const jsonStr = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    const hiveVector: Record<string, number> = {};
    for (const dim of HIVE_DIMENSIONS) {
      const v = parsed[dim];
      hiveVector[dim] = typeof v === "number" ? clamp(v) : 0;
    }
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((r): r is string => typeof r === "string").slice(0, 8)
      : [];
    const hiveScore = meanScore(hiveVector);
    return { hiveVector, hiveScore, verdict: verdictFromScore(hiveScore), reasons };
  } catch (err) {
    console.error("[gauntlet] AI scoring failed, using heuristic fallback:", err);
    return scoreAppGauntletHeuristic(input);
  }
}

export const GAUNTLET_RUN_COST = 10;

export class InsufficientCreditsError extends Error {}

// Debits GAUNTLET_RUN_COST, records the run, and returns both — the one
// entry point routes.ts calls, keeping direct Drizzle access inside this
// module rather than routes.ts (matching this codebase's convention: raw
// db.* calls live in server/*.ts domain modules like sphinx.ts, not in the
// routes.ts handler layer itself).
export async function runAndRecordGauntlet(
  userId: string,
  input: GauntletAppInput,
): Promise<{ run: GauntletRun; guidance: string[]; newBalance: number }> {
  const credits = await getOrCreateCredits(userId);
  if (credits.balance < GAUNTLET_RUN_COST) {
    throw new InsufficientCreditsError(`Insufficient credits — a Gauntlet run costs ${GAUNTLET_RUN_COST}.`);
  }

  const result = await scoreAppGauntlet(input);
  const guidance = fixGuidance(result);

  const [updated] = await db
    .update(userCredits)
    .set({
      balance: sql`${userCredits.balance} - ${GAUNTLET_RUN_COST}`,
      lifetimeSpent: sql`${userCredits.lifetimeSpent} + ${GAUNTLET_RUN_COST}`,
      updatedAt: new Date(),
    })
    .where(eq(userCredits.userId, userId))
    .returning({ balance: userCredits.balance });

  const [run] = await db
    .insert(gauntletRuns)
    .values({
      userId,
      appName: input.name,
      hiveVector: result.hiveVector,
      hiveScore: result.hiveScore,
      verdict: result.verdict,
      reasons: result.reasons,
      creditsCharged: GAUNTLET_RUN_COST,
    })
    .returning();

  return { run, guidance, newBalance: updated?.balance ?? credits.balance - GAUNTLET_RUN_COST };
}

export async function listGauntletRuns(userId: string): Promise<GauntletRun[]> {
  return db
    .select()
    .from(gauntletRuns)
    .where(eq(gauntletRuns.userId, userId))
    .orderBy(desc(gauntletRuns.createdAt))
    .limit(50);
}

export function fixGuidance(result: GauntletScoreResult): string[] {
  if (result.verdict === "VIABLE") return [];
  const guidance: string[] = [...result.reasons];
  if (result.hiveVector.demoCompleteness < 50) {
    guidance.push("Add a working 'Test My Work' demo — this is the single highest-leverage fix.");
  }
  if (result.hiveVector.clarity < 50) {
    guidance.push("Sharpen the one-line pitch: state exactly what the app does and for whom.");
  }
  if (result.hiveVector.stackCoherence < 50) {
    guidance.push("List the actual technologies used — vague or mismatched stacks read as unverified.");
  }
  return guidance;
}
