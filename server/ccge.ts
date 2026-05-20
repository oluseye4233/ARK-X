import {
  type CcgeCard,
  type CcgeScenario,
  type KcseBreakdown,
  type ContextCraftLevel,
  type Assessment,
  ARK_SCORE_DELTAS,
  JCSE_TIER_THRESHOLDS,
  jcseToContextCraftLevel,
  jcseToTier,
  CERT_LEVEL_RANK,
  CONTEXT_CRAFT_LEVELS,
} from "@shared/schema";
import { storage } from "./storage";

export function dealHand(allCards: CcgeCard[], scenario: CcgeScenario, handSize = 5): string[] {
  const targetSet = new Set(scenario.targetPillars);
  const targetCards = allCards.filter((c) => targetSet.has(c.pillar));
  const otherCards = allCards.filter((c) => !targetSet.has(c.pillar));

  const shuffled = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const targetTake = Math.min(targetCards.length, Math.max(2, Math.min(handSize - 1, scenario.targetPillars.length)));
  const dealt = [
    ...shuffled(targetCards).slice(0, targetTake),
    ...shuffled(otherCards).slice(0, handSize - targetTake),
  ];
  if (dealt.length < handSize) {
    const remaining = allCards.filter((c) => !dealt.find((d) => d.id === c.id));
    dealt.push(...shuffled(remaining).slice(0, handSize - dealt.length));
  }
  return shuffled(dealt).slice(0, handSize).map((c) => c.id);
}

export function scoreSession(played: CcgeCard[], scenario: CcgeScenario): KcseBreakdown {
  if (played.length === 0) {
    return {
      knowledge: 0,
      clarity: 0,
      specificity: 0,
      efficiency: 0,
      pillarsCovered: [],
      synergies: [],
      tokenUsed: 0,
      tokenBudget: scenario.tokenBudget,
      base: 0,
      final: 0,
    };
  }

  // Knowledge: avg baseKcse mapped from 0-100 → 0-50
  const knowledge = (played.reduce((s, c) => s + c.baseKcse, 0) / played.length) / 2;

  // Clarity: % of target pillars covered → 0-50
  const playedPillars = new Set(played.map((c) => c.pillar));
  const targetCovered = scenario.targetPillars.filter((p) => playedPillars.has(p)).length;
  const clarity = scenario.targetPillars.length > 0
    ? (targetCovered / scenario.targetPillars.length) * 50
    : 50;

  // Specificity: pillar diversity + Super Prompt bonus
  const uniquePillars = playedPillars.size;
  let specificity = Math.min(50, uniquePillars * 8);
  if (played.some((c) => c.pillar === "SuperPrompt")) specificity = Math.min(50, specificity + 10);

  // Efficiency: token budget alignment
  const tokensUsed = played.reduce((s, c) => s + c.tokenCost, 0);
  let efficiency: number;
  if (tokensUsed > scenario.tokenBudget) {
    efficiency = Math.max(0, 50 - (tokensUsed - scenario.tokenBudget) * 3);
  } else if (tokensUsed < scenario.tokenBudget * 0.4) {
    efficiency = 25 + (tokensUsed / Math.max(1, scenario.tokenBudget * 0.4)) * 25;
  } else {
    efficiency = 50;
  }

  const base = knowledge * 0.30 + clarity * 0.30 + specificity * 0.20 + efficiency * 0.20;

  // Synergies (PDD §1.3 — lean multipliers)
  const synergies: { name: string; multiplier: number }[] = [];
  let mult = 1.0;
  const ultraCount = played.filter((c) => c.type === "Ultra").length;
  if (ultraCount >= 2) {
    synergies.push({ name: "Alpha Prime", multiplier: 1.15 });
    mult *= 1.15;
  }
  if (played.some((c) => c.type === "SuperPrompt")) {
    synergies.push({ name: "Solo Legend", multiplier: 1.10 });
    mult *= 1.10;
  }
  if (uniquePillars >= 5) {
    synergies.push({ name: "Full Context", multiplier: 1.20 });
    mult *= 1.20;
  }
  if (played.length >= 4 && targetCovered === scenario.targetPillars.length && scenario.targetPillars.length > 0) {
    synergies.push({ name: "Precision Engine", multiplier: 1.10 });
    mult *= 1.10;
  }
  const premiumOrUp = played.filter((c) => c.type === "Premium" || c.type === "Ultra" || c.type === "SuperPrompt").length;
  if (premiumOrUp >= 3) {
    synergies.push({ name: "Expert Clarity", multiplier: 1.08 });
    mult *= 1.08;
  }

  const final = Math.min(50, Math.round(base * mult * 10) / 10);

  return {
    knowledge: Math.round(knowledge * 10) / 10,
    clarity: Math.round(clarity * 10) / 10,
    specificity: Math.round(specificity * 10) / 10,
    efficiency: Math.round(efficiency * 10) / 10,
    pillarsCovered: Array.from(playedPillars),
    synergies,
    tokenUsed: tokensUsed,
    tokenBudget: scenario.tokenBudget,
    base: Math.round(base * 10) / 10,
    final,
  };
}

export function arkDeltaForSession(jcse: number): number {
  if (jcse >= JCSE_TIER_THRESHOLDS.PLATINUM) return ARK_SCORE_DELTAS.SESSION_PLATINUM;
  if (jcse >= JCSE_TIER_THRESHOLDS.GOLD) return ARK_SCORE_DELTAS.SESSION_GOLD;
  if (jcse >= JCSE_TIER_THRESHOLDS.SILVER) return ARK_SCORE_DELTAS.SESSION_SILVER;
  if (jcse >= JCSE_TIER_THRESHOLDS.BRONZE) return ARK_SCORE_DELTAS.SESSION_BRONZE;
  return 0;
}

export function arkDeltaForCertUpgrade(toLevel: ContextCraftLevel): number {
  switch (toLevel) {
    case "CC_500": return ARK_SCORE_DELTAS.CERT_UPGRADE_TO_CC_500;
    case "CC_400": return ARK_SCORE_DELTAS.CERT_UPGRADE_TO_CC_400;
    case "CC_300": return ARK_SCORE_DELTAS.CERT_UPGRADE_TO_CC_300;
    case "CC_200": return ARK_SCORE_DELTAS.CERT_UPGRADE_TO_CC_200;
    default: return 0;
  }
}

export type FlywheelOutcome = {
  arkScoreDelta: number;
  certUpgradedFrom: ContextCraftLevel | null;
  certUpgradedTo: ContextCraftLevel | null;
  newJstTotal: number | null;
  newJstSkills: number | null;
};

export type FlywheelPlan = {
  arkScoreDelta: number;
  certUpgradedFrom: ContextCraftLevel | null;
  certUpgradedTo: ContextCraftLevel | null;
  newJstSkills: number | null;
  newJstTotal: number | null;
};

export function planFlywheel(
  currentLevel: ContextCraftLevel,
  jcse: number,
  latestAssessment: Assessment | null,
): FlywheelPlan {
  let arkScoreDelta = arkDeltaForSession(jcse);
  let certUpgradedFrom: ContextCraftLevel | null = null;
  let certUpgradedTo: ContextCraftLevel | null = null;

  const candidateLevel = jcseToContextCraftLevel(jcse);
  if (CERT_LEVEL_RANK[candidateLevel] > CERT_LEVEL_RANK[currentLevel]) {
    certUpgradedFrom = currentLevel;
    certUpgradedTo = candidateLevel;
    arkScoreDelta += arkDeltaForCertUpgrade(candidateLevel);
  }

  let newJstSkills: number | null = null;
  let newJstTotal: number | null = null;
  if (latestAssessment && arkScoreDelta > 0) {
    const skills = Math.min(100, latestAssessment.jstSkills + arkScoreDelta);
    const skillsDelta = skills - latestAssessment.jstSkills;
    newJstSkills = skills;
    newJstTotal = Math.min(300, latestAssessment.jstTotal + skillsDelta);
  }

  return { arkScoreDelta, certUpgradedFrom, certUpgradedTo, newJstSkills, newJstTotal };
}
