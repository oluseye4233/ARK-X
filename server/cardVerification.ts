/**
 * Primitive Card Verification (Task #55) — engine.
 *
 * A subscriber verifies a CODEC primitive that appears on their assessment by
 * authoring their OWN Context-Craft prompts — one per skill standard the card
 * maps to (O*NET / SFIA / WEF). Each authored prompt is scored 0-50 by the same
 * deterministic craft evaluator the CCGE design stage uses (`evaluateCustomCard`),
 * then aggregated to a 0-100 verification score and a tier.
 *
 * This module is PURE (no DB, no I/O) so it stays unit-testable. The storage +
 * route layers own persistence, the evidence gate (card must be on the user's
 * assessment), and the ARK award via `recalcArkForUser`.
 */
import { CC_PILLARS, type CcgeTier, verificationScoreToTier } from "@shared/schema";
import { CODEC_BY_ID, type CodecPrimitive } from "@shared/codec-primitives";
import { evaluateCustomCard } from "./ccge";

// Token budget assumed for each verification prompt. The craft evaluator only
// reads `targetPillars` + `tokenBudget` off the scenario, so we synthesize a
// scenario-shaped object that asks the author to express all seven Context
// Craft pillars (a verification prompt should be a complete prompt, not a hand
// of cards), within a generous budget.
const VERIFICATION_TOKEN_BUDGET = 600;

export type VerificationStandard = "O*NET" | "SFIA" | "WEF";

export type VerificationChallenge = {
  id: string; // `${cardId}::${standardKey}`
  standard: VerificationStandard;
  standardKey: "onet" | "sfia" | "wef";
  label: string; // human label for the skill set
  skills: string[]; // the concrete skills the author must demonstrate
  instruction: string; // what the author is asked to write
  targetPillars: string[]; // all CC pillars — a full prompt is expected
  tokenBudget: number;
};

export type VerificationQuest = {
  cardId: string;
  cardName: string;
  emoji: string;
  category: string;
  persona: string;
  archetype: CodecPrimitive["archetype"];
  insight: string;
  challenges: VerificationChallenge[];
};

const STANDARD_DEFS: {
  key: "onet" | "sfia" | "wef";
  standard: VerificationStandard;
  label: string;
}[] = [
  { key: "onet", standard: "O*NET", label: "O*NET occupational skills" },
  { key: "sfia", standard: "SFIA", label: "SFIA v8 professional skills" },
  { key: "wef", standard: "WEF", label: "WEF Future-of-Jobs core skills" },
];

/**
 * Build the Verification Quest for a primitive. One challenge per skill standard
 * that actually carries skills on the card. Returns null for unknown card ids.
 */
export function buildVerificationQuest(cardId: string): VerificationQuest | null {
  const card = CODEC_BY_ID[cardId];
  if (!card) return null;

  const challenges: VerificationChallenge[] = [];
  for (const def of STANDARD_DEFS) {
    const skills = card.mappings[def.key] ?? [];
    if (skills.length === 0) continue;
    challenges.push({
      id: `${cardId}::${def.key}`,
      standard: def.standard,
      standardKey: def.key,
      label: def.label,
      skills,
      instruction:
        `Write a complete Context-Craft prompt that proves you can apply "${card.name}" ` +
        `(${card.persona}) against these ${def.standard} skills: ${skills.join(", ")}. ` +
        `Express all seven Context Craft pillars — System, Role, Instruction, Example, ` +
        `Constraint, Format and Data — so the prompt is production-ready.`,
      targetPillars: [...CC_PILLARS],
      tokenBudget: VERIFICATION_TOKEN_BUDGET,
    });
  }

  if (challenges.length === 0) return null;

  return {
    cardId,
    cardName: card.name,
    emoji: card.emoji,
    category: card.category,
    persona: card.persona,
    archetype: card.archetype,
    insight: card.insight,
    challenges,
  };
}

/**
 * Score a single authored prompt against a challenge. Reuses the CCGE craft
 * evaluator with a synthesized scenario carrying the challenge's target pillars
 * and token budget. Returns the 0-50 craft score + detected signals.
 */
export function scoreVerificationPrompt(
  prompt: string,
  challenge: Pick<VerificationChallenge, "label" | "targetPillars" | "tokenBudget">,
): { craft: number; signals: string[] } {
  const scenario = {
    id: "verification",
    tier: "verification",
    title: challenge.label,
    prompt: challenge.label,
    targetPillars: challenge.targetPillars,
    tokenBudget: challenge.tokenBudget,
    difficulty: 3,
    creatorUserId: null,
    industry: null,
    isCustom: false,
  };
  const { craft, signals } = evaluateCustomCard({
    name: challenge.label,
    body: prompt,
    // evaluateCustomCard only reads targetPillars + tokenBudget off the scenario.
    scenario: scenario as Parameters<typeof evaluateCustomCard>[0]["scenario"],
  });
  return { craft, signals };
}

/**
 * Aggregate per-challenge craft scores (each 0-50) into a 0-100 verification
 * score + tier. Average craft → scale to 0-100. Empty input scores 0.
 */
export function aggregateVerification(crafts: number[]): {
  score: number;
  tier: CcgeTier | null;
} {
  if (crafts.length === 0) return { score: 0, tier: null };
  const avgCraft = crafts.reduce((s, c) => s + c, 0) / crafts.length; // 0-50
  const score = Math.max(0, Math.min(100, Math.round(avgCraft * 2)));
  return { score, tier: verificationScoreToTier(score) };
}
