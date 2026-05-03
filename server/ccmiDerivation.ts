/**
 * Derive CCMI pillar scores (P1-P7, 0-100) from a user's signals:
 *   - resume category scores (technical / leadership / analytical / communication / innovation / ai_adjacent)
 *   - CC certification level
 *   - Latest CCGE KCSE breakdown (if available)
 *
 * This is the bridge between the legacy resume analyzer and the PDD §3.4 7-pillar model.
 */
import { CONTEXT_CRAFT_LEVELS, type ContextCraftLevel } from "@shared/schema";
import type { CcmiPillarVector } from "./scoringEngine";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));

export type CategoryScores = {
  technical?: number;
  leadership?: number;
  analytical?: number;
  communication?: number;
  innovation?: number;
  ai_adjacent?: number;
};

export type KcsePillarHints = Partial<Record<"P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7", number>>;

export function derivePillarsFromResume(opts: {
  scores: CategoryScores;
  contextCraftLevel?: ContextCraftLevel;
  kcseHints?: KcsePillarHints;
}): CcmiPillarVector {
  const s = {
    technical: opts.scores.technical ?? 0,
    leadership: opts.scores.leadership ?? 0,
    analytical: opts.scores.analytical ?? 0,
    communication: opts.scores.communication ?? 0,
    innovation: opts.scores.innovation ?? 0,
    ai_adjacent: opts.scores.ai_adjacent ?? 0,
  };
  const cc = (opts.contextCraftLevel && CONTEXT_CRAFT_LEVELS[opts.contextCraftLevel]?.multiplier) ?? 0.5;
  // Cert presence is a meaningful boost on top of resume-derived signals.
  const certBoost = cc >= 1.2 ? 25 : cc >= 1.0 ? 15 : cc >= 0.8 ? 8 : 0;

  // Map signals to pillars (each pillar gets a base + boost). Caps at 100.
  const base: CcmiPillarVector = {
    P1: clamp(s.technical * 4 + s.innovation * 2 + 20 + certBoost),       // System & Architecture
    P2: clamp(s.leadership * 4 + s.communication * 2 + 25 + certBoost),   // Role Clarity
    P3: clamp(s.analytical * 3 + s.ai_adjacent * 4 + 25 + certBoost),     // Instruction Mastery
    P4: clamp(s.innovation * 4 + s.technical * 2 + 20 + certBoost),       // Example Curation
    P5: clamp(s.analytical * 4 + s.leadership * 2 + 20 + certBoost),      // Constraint Discipline
    P6: clamp(s.communication * 4 + s.analytical * 2 + 20 + certBoost),   // Format Precision
    P7: clamp(s.analytical * 4 + s.ai_adjacent * 3 + s.technical + 20 + certBoost), // Data Stewardship
  };

  // Apply KCSE hints (each hint is the pillar's most-recent CCGE-validated score, blended 60/40 with derived).
  if (opts.kcseHints) {
    for (const k of Object.keys(base) as (keyof CcmiPillarVector)[]) {
      const hint = opts.kcseHints[k];
      if (typeof hint === "number") {
        base[k] = clamp(base[k] * 0.4 + hint * 0.6);
      }
    }
  }

  return base;
}

/**
 * Derive resume replacement % from JST + automation risk.
 * Lower JST + higher avg automation = higher replacement risk.
 */
export function deriveResumeReplacementPct(opts: {
  jstIndex: number; // 0-300
  avgAutomation: number; // 0-100
}): number {
  const jstFactor = 1 - opts.jstIndex / 300; // 0 (best) → 1 (worst)
  const blended = jstFactor * 0.55 + (opts.avgAutomation / 100) * 0.45;
  return clamp(blended * 100);
}
