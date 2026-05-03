/**
 * PDD §3.4 — Pure scoring engine.
 *
 * Inputs are 0-100 sub-scores; outputs are PDD-canonical:
 *   JST  = [(J×0.30)+(S×0.40)+(T×0.30)]×3   → 0-300
 *   CCMI = [(P1×0.18)+(P2×0.14)+(P3×0.18)+(P4×0.12)+(P5×0.10)+(P6×0.10)+(P7×0.18)]×3 → 0-300
 *   ARK  = JST + CCMI                          → 0-600
 *
 * Side-effect free. Tested via /api/health/scoring.
 */
import {
  JST_WEIGHTS,
  CCMI_PILLAR_WEIGHTS,
  CCMI_TIER_BANDS,
  ARK_TIERS,
  VMST_LEVELS,
  TYPOLOGIES,
  type CcmiPillarKey,
  type CcmiTier,
  type ArkTierKey,
  type VmstLevel,
  type TypologyKey,
} from "@shared/schema";

export type JstSubscores = { jobs: number; skills: number; talent: number };
export type CcmiPillarVector = Record<CcmiPillarKey, number>;

const clamp01 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const clampRange = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

export function computeJst(s: JstSubscores): { jstIndex: number; sub: JstSubscores } {
  const sub = { jobs: clamp01(s.jobs), skills: clamp01(s.skills), talent: clamp01(s.talent) };
  const raw =
    (sub.jobs * JST_WEIGHTS.jobs +
      sub.skills * JST_WEIGHTS.skills +
      sub.talent * JST_WEIGHTS.talent) * 3;
  return { jstIndex: clampRange(raw, 0, 300), sub };
}

export function computeCcmi(p: CcmiPillarVector): {
  ccmi: number;
  pillars: CcmiPillarVector;
  tier: CcmiTier;
  multiplier: number;
  label: string;
} {
  const pillars: CcmiPillarVector = {
    P1: clamp01(p.P1), P2: clamp01(p.P2), P3: clamp01(p.P3),
    P4: clamp01(p.P4), P5: clamp01(p.P5), P6: clamp01(p.P6), P7: clamp01(p.P7),
  };
  const raw =
    (pillars.P1 * CCMI_PILLAR_WEIGHTS.P1 +
      pillars.P2 * CCMI_PILLAR_WEIGHTS.P2 +
      pillars.P3 * CCMI_PILLAR_WEIGHTS.P3 +
      pillars.P4 * CCMI_PILLAR_WEIGHTS.P4 +
      pillars.P5 * CCMI_PILLAR_WEIGHTS.P5 +
      pillars.P6 * CCMI_PILLAR_WEIGHTS.P6 +
      pillars.P7 * CCMI_PILLAR_WEIGHTS.P7) * 3;
  const ccmi = clampRange(raw, 0, 300);
  const band = CCMI_TIER_BANDS.find((b) => ccmi >= b.min && ccmi <= b.max)!;
  return { ccmi, pillars, tier: band.tier, multiplier: band.multiplier, label: band.label };
}

export function arkTier(arkScore: number): { key: ArkTierKey; color: string } {
  const t = ARK_TIERS.find((b) => arkScore >= b.min && arkScore <= b.max) ?? ARK_TIERS[ARK_TIERS.length - 1];
  return { key: t.key, color: t.color };
}

// CC tier multiplier band → numeric multiplier for a given CCMI score (0-300).
export function ccMultiplierForCcmi(ccmi: number): number {
  const c = clampRange(ccmi, 0, 300);
  const band = CCMI_TIER_BANDS.find((b) => c >= b.min && c <= b.max);
  return band?.multiplier ?? 1.0;
}

// ARK = JST + CCMI, clamped to 0-600.
export function computeArkScore(jstIndex: number, ccmi: number): number {
  return clampRange(clampRange(jstIndex, 0, 300) + clampRange(ccmi, 0, 300), 0, 600);
}

export function arkTierLabel(arkScore: number): ArkTierKey {
  return arkTier(arkScore).key;
}

// LHCS three-light signal — PDD §3.4 weighted composite + threshold status.
// Production callers use server/lhcs.ts::computeLhcsForUser; this pure helper
// exists so the formula can be unit-tested in isolation.
import { lhcsReadiness, lhcsStatusFromReadiness, lhcsLight } from "@shared/schema";
export function computeLhcs(opts: { cpr: number; mps: number; lcis: number }): {
  status: "green" | "amber" | "red";
  readinessPct: number;
  cprLight: "green" | "amber" | "red";
  mpsLight: "green" | "amber" | "red";
  lcisLight: "green" | "amber" | "red";
} {
  const cprLight = lhcsLight(opts.cpr);
  const mpsLight = lhcsLight(opts.mps);
  const lcisLight = lhcsLight(opts.lcis);
  const readinessPct = lhcsReadiness(opts.cpr, opts.mps, opts.lcis);
  const status = lhcsStatusFromReadiness(readinessPct);
  return { status, readinessPct, cprLight, mpsLight, lcisLight };
}

export function vmstFromArk(arkScore: number): { key: VmstLevel; label: string; color: string } {
  // Highest band whose min ≤ arkScore wins.
  let chosen: (typeof VMST_LEVELS)[number] = VMST_LEVELS[0];
  for (const lvl of VMST_LEVELS) if (arkScore >= lvl.min) chosen = lvl;
  return chosen;
}

/**
 * Pick typology from archetype scores. Highest wins; ties → A > O > C.
 */
export function typologyFromArchetypes(a: { architect: number; orchestrator: number; conductor: number }): TypologyKey {
  const ranked = [
    { k: "A" as TypologyKey, v: a.architect },
    { k: "O" as TypologyKey, v: a.orchestrator },
    { k: "C" as TypologyKey, v: a.conductor },
  ].sort((x, y) => y.v - x.v);
  return ranked[0].k;
}

/**
 * ARK Professional ID — "ARK-{tier}-{ccmiTier}-{typology}-{vmstLevel}-{6charHash}"
 */
export function buildArkIdString(opts: {
  userId: string;
  arkTierKey: ArkTierKey;
  ccmiTier: CcmiTier;
  typology: TypologyKey;
  vmstLevel: VmstLevel;
}): string {
  // Tiny stable hash — 32-bit FNV-1a → 6 hex chars.
  let h = 0x811c9dc5;
  for (let i = 0; i < opts.userId.length; i++) {
    h ^= opts.userId.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  const hex = h.toString(16).padStart(8, "0").slice(0, 6).toUpperCase();
  const tierShort = opts.arkTierKey.slice(0, 3).toUpperCase();
  return `ARK-${tierShort}-${opts.ccmiTier}-${opts.typology}-${opts.vmstLevel}-${hex}`;
}

export type ArkScoreSnapshot = {
  arkScore: number;
  jstIndex: number;
  jstSub: JstSubscores;
  ccmi: number;
  ccmiTier: CcmiTier;
  ccmiTierLabel: string;
  ccmiMultiplier: number;
  ccmiPillars: CcmiPillarVector;
  arkTierKey: ArkTierKey;
  arkTierColor: string;
  vmstLevel: VmstLevel;
  vmstLabel: string;
  typology: TypologyKey | null;
  arkIdString: string | null;
  resumeReplacementPct: number;
};

/**
 * Compose full ARK identity snapshot from raw inputs.
 * resumeReplacementPct is the headline "% of your resume that's automatable" from JST analysis.
 */
export function buildSnapshot(opts: {
  userId: string;
  jst: JstSubscores;
  pillars: CcmiPillarVector;
  archetypes?: { architect: number; orchestrator: number; conductor: number };
  resumeReplacementPct?: number;
}): ArkScoreSnapshot {
  const { jstIndex, sub } = computeJst(opts.jst);
  const cc = computeCcmi(opts.pillars);
  const arkScore = clampRange(jstIndex + cc.ccmi, 0, 600);
  const tier = arkTier(arkScore);
  const vmst = vmstFromArk(arkScore);
  const typology = opts.archetypes ? typologyFromArchetypes(opts.archetypes) : null;
  const arkIdString = typology
    ? buildArkIdString({
        userId: opts.userId,
        arkTierKey: tier.key,
        ccmiTier: cc.tier,
        typology,
        vmstLevel: vmst.key,
      })
    : null;
  return {
    arkScore,
    jstIndex,
    jstSub: sub,
    ccmi: cc.ccmi,
    ccmiTier: cc.tier,
    ccmiTierLabel: cc.label,
    ccmiMultiplier: cc.multiplier,
    ccmiPillars: cc.pillars,
    arkTierKey: tier.key,
    arkTierColor: tier.color,
    vmstLevel: vmst.key,
    vmstLabel: vmst.label,
    typology,
    arkIdString,
    resumeReplacementPct: clampRange(opts.resumeReplacementPct ?? 0, 0, 100),
  };
}
