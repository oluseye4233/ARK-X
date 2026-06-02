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

// ── Card Design stage ────────────────────────────────────────
// Deterministic 0-50 evaluation of the player's authored custom card (the
// SYSTEM-style prompt they type/paste). This is the FINAL stage of every game
// sequence; it runs for every player (free + paid) so the typed prompt always
// matters, and is optionally refined by Claude on paid plans.

export type CustomCardCraft = { craft: number; signals: string[] };

// Keyword cues that signal each KCSE pillar is expressed in free-form prompt text.
const PILLAR_KEYWORDS: Record<string, RegExp> = {
  System: /\b(you are|act as|your role is|operate as|system)\b/i,
  Role: /\b(persona|voice|tone|expert|specialist|as an?)\b/i,
  Instruction: /\b(write|generate|produce|create|analyze|summari[sz]e|explain|step|task|please)\b/i,
  Example: /\b(example|e\.g\.|for instance|such as|sample|like this)\b/i,
  Constraint: /\b(must|do not|don't|never|always|only|limit|no more than|avoid|within)\b/i,
  Format: /\b(format|json|markdown|bullet|table|list|heading|schema|output as)\b/i,
  Data: /\b(context|given|based on|using the|data|document|reference|the following)\b/i,
};

const CRAFT_SIGNAL_DEFS: { label: string; test: RegExp }[] = [
  { label: "Role framing", test: /\b(you are|act as|your role is|as an?|persona)\b/i },
  { label: "Explicit instruction", test: /\b(write|generate|produce|create|analyze|summari[sz]e|explain|provide|list)\b/i },
  { label: "Constraints set", test: /\b(must|do not|don't|never|always|only|limit|no more than|avoid|within)\b/i },
  { label: "Output format pinned", test: /\b(format|json|markdown|bullet|table|list|heading|schema|output as)\b/i },
  { label: "Example provided", test: /\b(example|e\.g\.|for instance|such as|sample)\b/i },
  { label: "Context grounding", test: /\b(context|given|based on|using the|the following|reference)\b/i },
  { label: "Step-by-step structure", test: /(\n\s*[-*\d]|step\s*\d|\d\.\s)/i },
];

export function evaluateCustomCard(opts: {
  name: string;
  body: string;
  scenario: CcgeScenario;
}): CustomCardCraft {
  const name = (opts.name || "").trim();
  const body = (opts.body || "").trim();
  const signals: string[] = [];

  if (body.length === 0) {
    return { craft: 0, signals: [] };
  }

  const words = body.split(/\s+/).filter(Boolean).length;

  // Substance (0-16): healthy length band. Tiny prompts score low; a couple of
  // solid sentences hit the sweet spot; rambling walls of text plateau.
  let substance: number;
  if (words < 6) substance = words * 1.0;
  else if (words < 40) substance = 6 + ((words - 6) / 34) * 10;
  else if (words <= 220) substance = 16;
  else substance = Math.max(11, 16 - (words - 220) / 60);

  // Craft signals (0-21): up to 3 points per detected structural cue.
  let signalScore = 0;
  for (const def of CRAFT_SIGNAL_DEFS) {
    if (def.test.test(body)) {
      signalScore += 3;
      signals.push(def.label);
    }
  }

  // Target-pillar coverage (0-10): how many of the scenario's target pillars are
  // reflected in the authored prompt text.
  const targets = opts.scenario.targetPillars ?? [];
  const covered = targets.filter((p) => PILLAR_KEYWORDS[p]?.test(body)).length;
  const coverage = targets.length > 0 ? (covered / targets.length) * 10 : 7;
  if (covered > 0) signals.push(`Targets ${covered}/${targets.length} pillars`);

  // Naming (0-3): a deliberate, non-trivial card name.
  const naming = name.length >= 4 ? 3 : name.length >= 2 ? 1.5 : 0;

  const craft = Math.max(
    0,
    Math.min(50, Math.round((substance + signalScore + coverage + naming) * 10) / 10),
  );
  return { craft, signals };
}

// Blend the card-selection score with the authored-card craft. The design stage
// is the final evaluation, so craft carries real weight (40%) while the card
// hand still matters (60%). Capped at the 0-50 JCSE ceiling.
export function blendCraftIntoFinal(cardFinal: number, craft: number): number {
  return Math.max(0, Math.min(50, Math.round((cardFinal * 0.6 + craft * 0.4) * 10) / 10));
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
