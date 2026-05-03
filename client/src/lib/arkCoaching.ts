import { ARK_TIERS, ARK_SCORE_DELTAS, CCMI_PILLAR_LABELS, type CcmiPillarKey } from "@shared/schema";

export const PILLAR_TIPS: Record<CcmiPillarKey, string> = {
  P1: "Open with explicit system context and architecture before any task.",
  P2: "State the persona, audience, and tone in the first two lines.",
  P3: "Spell out the goal, steps, and success criteria up front.",
  P4: "Include 2-3 worked examples that show the desired output shape.",
  P5: "Enumerate hard limits — token budget, format, things to avoid.",
  P6: "Pin the exact output schema (JSON keys, headings, length).",
  P7: "Cite the source data and separate assumptions from ground truth.",
};

export type WeakestPillar = {
  key: CcmiPillarKey;
  label: string;
  score: number;
  tip: string;
};

export function getWeakestPillar(
  pillars: Partial<Record<CcmiPillarKey, number>> | null | undefined,
): WeakestPillar | null {
  if (!pillars) return null;
  const keys: CcmiPillarKey[] = ["P1", "P2", "P3", "P4", "P5", "P6", "P7"];
  const scored = keys
    .map((k) => ({ key: k, score: pillars[k] ?? 0 }))
    .filter((p) => p.score > 0 || pillars[p.key] === 0);
  if (scored.length === 0) return null;
  const weakest = scored.reduce((m, p) => (p.score < m.score ? p : m), scored[0]);
  return {
    key: weakest.key,
    label: CCMI_PILLAR_LABELS[weakest.key],
    score: weakest.score,
    tip: PILLAR_TIPS[weakest.key],
  };
}

export type NextTierInfo = {
  currentTier: string;
  nextTier: string | null;
  pointsToNext: number;
  perRound: number;
  roundsNeeded: number;
  pathLabel: string;
};

// Use the SESSION_GOLD delta (+6) as the representative "good CCGE round"
// estimate so the cheapest-path copy is grounded in ARK_SCORE_DELTAS rather
// than aspirational numbers.
const PER_ROUND_DELTA = ARK_SCORE_DELTAS.SESSION_GOLD;

export function getNextTier(arkScore: number): NextTierInfo {
  const sorted = [...ARK_TIERS].sort((a, b) => a.min - b.min);
  const current = sorted.find((b) => arkScore >= b.min && arkScore <= b.max) ?? sorted[0];
  const next = sorted.find((b) => b.min > arkScore) ?? null;
  if (!next) {
    return {
      currentTier: current.key,
      nextTier: null,
      pointsToNext: 0,
      perRound: PER_ROUND_DELTA,
      roundsNeeded: 0,
      pathLabel: "Top tier — maintain with weekly drills.",
    };
  }
  const pointsToNext = next.min - arkScore;
  const roundsNeeded = Math.max(1, Math.ceil(pointsToNext / PER_ROUND_DELTA));
  const pathLabel =
    roundsNeeded === 1
      ? `+1 CCGE Gold round ≈ +${PER_ROUND_DELTA} ARK`
      : `~${roundsNeeded} CCGE Gold rounds (~+${PER_ROUND_DELTA} ARK each)`;
  return {
    currentTier: current.key,
    nextTier: next.key,
    pointsToNext,
    perRound: PER_ROUND_DELTA,
    roundsNeeded,
    pathLabel,
  };
}
