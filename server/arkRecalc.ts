/**
 * PDD §3.4 — ARK score recalculation pipeline.
 *
 * Single entry point that:
 *   1. Loads latest assessment + cert + CCGE hints + LHCS signals
 *   2. Derives 7-pillar CCMI vector via ccmiDerivation
 *   3. Composes ARK identity snapshot via scoringEngine.buildSnapshot
 *   4. Applies daily/30d caps from FLYWHEEL_CAPS for the trigger source
 *   5. Persists user fields, ccmi_pillar_scores, lhcs_signals, ark_score_history
 *   6. Returns the resulting snapshot + applied delta
 */
import { db } from "./db";
import { eq, and, gte, sql } from "drizzle-orm";
import {
  users, ccmiPillarScores, lhcsSignals, arkScoreHistory,
  FLYWHEEL_CAPS, ARK_TIERS, VMST_LEVELS, CCMI_TIER_BANDS,
  type User, type ArkTriggerType, type ContextCraftLevel,
  type CcmiPillarKey, type ArkTierKey, type VmstLevel, type CcmiTier,
} from "@shared/schema";
import { storage } from "./storage";
import {
  buildSnapshot, buildArkIdString,
  type ArkScoreSnapshot, type CcmiPillarVector, type JstSubscores,
} from "./scoringEngine";
import { derivePillarsFromResume, deriveResumeReplacementPct } from "./ccmiDerivation";
import { computeLhcsForUser } from "./lhcs";

// Re-derive resume category scores from the signals we already persisted.
// (Resume text isn't stored — we use jstJobs/jstSkills/jstTalent as inverse hints.)
function reverseCategoryScores(jst: { jobs: number; skills: number; talent: number }): {
  technical: number; leadership: number; analytical: number;
  communication: number; innovation: number; ai_adjacent: number;
} {
  // Approximate inverse of resumeAnalyzer.ts JST formula. Good enough for re-derivation.
  return {
    technical: Math.max(0, (jst.jobs - 30) / 5),
    leadership: Math.max(0, (jst.talent - 25) / 5),
    analytical: Math.max(0, (jst.skills - 25) / 5),
    communication: Math.max(0, (jst.talent - 25) / 6),
    innovation: Math.max(0, (jst.skills - 25) / 6),
    ai_adjacent: Math.max(0, (jst.jobs - 30) / 6),
  };
}

export type RecalcOptions = {
  userId: string;
  trigger: ArkTriggerType;
  triggerMeta?: Record<string, unknown>;
  // Optional pre-computed pillar override (from a fresh resume analysis).
  pillarOverride?: ReturnType<typeof derivePillarsFromResume>;
  // Optional fresh scores from a just-finished resume analysis.
  freshScores?: { categoryScores: Record<string, number>; avgAutomation: number };
  // Skip cap enforcement (e.g., for assessment.completed which is unbounded).
  bypassCaps?: boolean;
};

export type RecalcResult = {
  snapshot: ArkScoreSnapshot;
  appliedDelta: number;
  cappedDelta: number;
  rawDelta: number;
  capReason: string | null;
  user: User;
};

/**
 * Cap rules per PDD §3.4 flywheel:
 *   - CCGE: max +15 ARK / day
 *   - SPHINX (publish/sold/purchase): max +20 ARK / 30 days
 */
async function applyCaps(
  userId: string,
  trigger: ArkTriggerType,
  rawDelta: number,
): Promise<{ cappedDelta: number; intendedCap: number | null; reason: string | null }> {
  // intendedCap is the strict upper bound on the persisted delta when a cap
  // fires. Returned alongside cappedDelta so the caller can hard-clamp after
  // proportional scaling rounds JST/CCMI components and would otherwise drift
  // ±1-2 above the cap.
  if (rawDelta <= 0) return { cappedDelta: rawDelta, intendedCap: null, reason: null };

  // User-driven sync paths (manual recompute, self-backfill) must never
  // award positive ARK — otherwise they'd let a user "catch up" deltas
  // previously withheld by CCGE/SPHINX caps. Downward sync still applies.
  if (trigger === "manual.recompute" || trigger === "backfill") {
    return { cappedDelta: 0, intendedCap: 0, reason: "Sync recompute does not award ARK" };
  }

  if (trigger === "ccge.session") {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await db
      .select({ delta: arkScoreHistory.delta })
      .from(arkScoreHistory)
      .where(
        and(
          eq(arkScoreHistory.userId, userId),
          eq(arkScoreHistory.trigger, "ccge.session"),
          gte(arkScoreHistory.createdAt, since),
        ),
      );
    const used = recent.reduce((s, r) => s + Math.max(0, r.delta), 0);
    const remaining = Math.max(0, FLYWHEEL_CAPS.CCGE_PER_DAY - used);
    if (rawDelta > remaining) {
      return {
        cappedDelta: remaining,
        intendedCap: remaining,
        reason: `Daily CCGE cap (+${FLYWHEEL_CAPS.CCGE_PER_DAY}) reached`,
      };
    }
  }

  if (trigger === "spc.published" || trigger === "spc.sold" || trigger === "spc.purchased") {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recent = await db
      .select({
        delta: arkScoreHistory.delta,
        trigger: arkScoreHistory.trigger,
        triggerMeta: arkScoreHistory.triggerMeta,
      })
      .from(arkScoreHistory)
      .where(and(eq(arkScoreHistory.userId, userId), gte(arkScoreHistory.createdAt, since)));
    // Buyer-side spc.purchased events are *not* monetization activity — they
    // must not consume the seller's 30-day SPHINX cap budget. Filter to
    // creator-side / publish / sale triggers only.
    const used = recent
      .filter((r) => isCreatorSphinxRow(r.trigger, r.triggerMeta))
      .reduce((s, r) => s + Math.max(0, r.delta), 0);
    const remaining = Math.max(0, FLYWHEEL_CAPS.SPHINX_PER_30D - used);
    if (rawDelta > remaining) {
      return {
        cappedDelta: remaining,
        intendedCap: remaining,
        reason: `30-day SPHINX cap (+${FLYWHEEL_CAPS.SPHINX_PER_30D}) reached`,
      };
    }
  }

  return { cappedDelta: rawDelta, intendedCap: null, reason: null };
}

export async function recalcArkForUser(opts: RecalcOptions): Promise<RecalcResult> {
  const user = await storage.getUser(opts.userId);
  if (!user) throw new Error(`User not found: ${opts.userId}`);

  const assessment = await storage.getLatestAssessment(opts.userId);

  // PDD §3.4 flywheel — SPHINX events boost JST Talent: +2.0 per publish,
  // +1.5 per sale (creator-side ONLY). We re-derive the cumulative boost
  // from arkScoreHistory so the math is stateless and idempotent across
  // replays. Only rows with a positive applied delta count toward the
  // boost — rows that were capped to 0 (SPHINX 30d cap hit, sync recompute)
  // must not contribute talent later, otherwise an uncapped trigger could
  // unlock the previously-blocked gain (cap-bypass). Buyer-side
  // spc.purchased rows are filtered out by triggerMeta so a buyer never
  // accrues seller-only Talent boost.
  const sphinxRows = await db
    .select({
      trigger: arkScoreHistory.trigger,
      triggerMeta: arkScoreHistory.triggerMeta,
      delta: arkScoreHistory.delta,
    })
    .from(arkScoreHistory)
    .where(eq(arkScoreHistory.userId, opts.userId));
  let publishedN = 0;
  let soldN = 0;
  for (const r of sphinxRows) {
    if (r.delta <= 0) continue;
    if (r.trigger === "spc.published") publishedN += 1;
    else if (
      (r.trigger === "spc.sold" || r.trigger === "spc.purchased") &&
      isCreatorSphinxRow(r.trigger, r.triggerMeta)
    ) {
      soldN += 1;
    }
  }
  // Count the in-flight trigger (history not yet written) so the boost
  // shows up on this same recalc. If the cap clamps this recalc's delta,
  // the proportional scaling at the bottom of recalcArkForUser shrinks
  // jstSub.talent so the persisted state matches the awarded delta — and
  // because this row will then be written with delta == cappedDelta, the
  // delta>0 filter above naturally excludes it from future boost on the
  // next recalc when cappedDelta was 0.
  const inFlightAsRole = (opts.triggerMeta as { payload?: { asRole?: string } } | undefined)
    ?.payload?.asRole;
  if (opts.trigger === "spc.published") publishedN += 1;
  else if (opts.trigger === "spc.sold") soldN += 1;
  else if (opts.trigger === "spc.purchased" && inFlightAsRole === "creator") soldN += 1;
  // Keep fractional precision for the +1.5/sale increment until the final
  // JST sub-score clamp, so low sale counts aren't over-awarded by an early
  // round (e.g. 1 sale → 1.5, not 2).
  const talentBoost = publishedN * 2 + soldN * 1.5;

  // Use fresh assessment values if present, else fall back to user identity defaults.
  const jst = {
    jobs: assessment?.jstJobs ?? 0,
    skills: assessment?.jstSkills ?? 0,
    talent: Math.max(0, Math.min(100, Math.round((assessment?.jstTalent ?? 0) + talentBoost))),
  };
  const archetypes = assessment
    ? {
        architect: assessment.archetypeArchitect ?? 34,
        orchestrator: assessment.archetypeOrchestrator ?? 33,
        conductor: assessment.archetypeConductor ?? 33,
      }
    : undefined;

  // Compute pillars: prefer override, else derive from JST sub-scores + cert level.
  let pillars = opts.pillarOverride;
  if (!pillars) {
    const scores = opts.freshScores?.categoryScores ?? reverseCategoryScores(jst);
    pillars = derivePillarsFromResume({
      scores,
      contextCraftLevel: (user.contextCraftCertLevel as ContextCraftLevel) || "NONE",
    });
  }

  // Compute resume replacement %.
  const avgAuto =
    opts.freshScores?.avgAutomation ??
    (assessment?.riskModifiers?.length
      ? assessment.riskModifiers.reduce((s, r) => s + r.automatable, 0) / assessment.riskModifiers.length
      : 50);
  const resumeReplacementPct = deriveResumeReplacementPct({
    jstIndex: assessment?.jstTotal ?? 0,
    avgAutomation: avgAuto,
  });

  const snapshot = buildSnapshot({
    userId: opts.userId,
    jst,
    pillars,
    archetypes,
    resumeReplacementPct,
  });

  // Compute LHCS.
  const lhcs = await computeLhcsForUser(opts.userId);

  // Compute raw delta vs previously stored ARK score.
  const previousArk = user.arkScore ?? 0;
  const previousJst = user.jstIndex ?? 0;
  const previousCcmi = user.ccmi ?? 0;
  const rawDelta = snapshot.arkScore - previousArk;

  // Apply caps (only on positive deltas; downward adjustments always apply).
  let cappedDelta = rawDelta;
  let intendedCap: number | null = null;
  let capReason: string | null = null;
  if (!opts.bypassCaps && rawDelta > 0) {
    const r = await applyCaps(opts.userId, opts.trigger, rawDelta);
    cappedDelta = r.cappedDelta;
    intendedCap = r.intendedCap;
    capReason = r.reason;
  }

  // Preserve the PDD invariant ARK = JST + CCMI even after caps clamp the
  // applied delta. We scale every component (jstIndex, ccmi, pillar vector,
  // jst sub-scores) toward the previous stored values by the same factor so
  // the persisted snapshot remains internally consistent and recomposable.
  let finalSnapshot: ArkScoreSnapshot = snapshot;
  if (cappedDelta !== rawDelta && rawDelta > 0) {
    const k = cappedDelta / rawDelta; // 0 ≤ k < 1
    const scaledJstIndex = clampInt(previousJst + (snapshot.jstIndex - previousJst) * k, 0, 300);
    const scaledCcmi = clampInt(previousCcmi + (snapshot.ccmi - previousCcmi) * k, 0, 300);

    // Scale JST sub-scores so they recompose to scaledJstIndex (linearity of
    // the JST formula means scaling each sub by the same ratio preserves it).
    const jstRatio = snapshot.jstIndex > 0 ? scaledJstIndex / snapshot.jstIndex : 0;
    const scaledJstSub: JstSubscores = {
      jobs: clampInt(snapshot.jstSub.jobs * jstRatio, 0, 100),
      skills: clampInt(snapshot.jstSub.skills * jstRatio, 0, 100),
      talent: clampInt(snapshot.jstSub.talent * jstRatio, 0, 100),
    };

    // Scale each pillar from its previous stored value (or 0 when none).
    const prevPillarRow = await storage.getCcmiPillars(opts.userId);
    const prevPillar = (key: CcmiPillarKey): number => {
      if (!prevPillarRow) return 0;
      const map: Record<CcmiPillarKey, number> = {
        P1: prevPillarRow.p1, P2: prevPillarRow.p2, P3: prevPillarRow.p3,
        P4: prevPillarRow.p4, P5: prevPillarRow.p5, P6: prevPillarRow.p6, P7: prevPillarRow.p7,
      };
      return map[key];
    };
    const scaledPillars: CcmiPillarVector = {
      P1: clampInt(prevPillar("P1") + (snapshot.ccmiPillars.P1 - prevPillar("P1")) * k, 0, 100),
      P2: clampInt(prevPillar("P2") + (snapshot.ccmiPillars.P2 - prevPillar("P2")) * k, 0, 100),
      P3: clampInt(prevPillar("P3") + (snapshot.ccmiPillars.P3 - prevPillar("P3")) * k, 0, 100),
      P4: clampInt(prevPillar("P4") + (snapshot.ccmiPillars.P4 - prevPillar("P4")) * k, 0, 100),
      P5: clampInt(prevPillar("P5") + (snapshot.ccmiPillars.P5 - prevPillar("P5")) * k, 0, 100),
      P6: clampInt(prevPillar("P6") + (snapshot.ccmiPillars.P6 - prevPillar("P6")) * k, 0, 100),
      P7: clampInt(prevPillar("P7") + (snapshot.ccmiPillars.P7 - prevPillar("P7")) * k, 0, 100),
    };

    // Re-derive ccmiTier band + ark tier + vmst from the scaled composite.
    const scaledArk = clampInt(scaledJstIndex + scaledCcmi, 0, 600);
    const ccmiBand = CCMI_TIER_BANDS.find((b) => scaledCcmi >= b.min && scaledCcmi <= b.max)!;
    const arkBand = ARK_TIERS.find((b) => scaledArk >= b.min && scaledArk <= b.max)
      ?? ARK_TIERS[ARK_TIERS.length - 1];
    let vmst: (typeof VMST_LEVELS)[number] = VMST_LEVELS[0];
    for (const lvl of VMST_LEVELS) if (scaledArk >= lvl.min) vmst = lvl;
    const newArkId = snapshot.typology
      ? buildArkIdString({
          userId: opts.userId,
          arkTierKey: arkBand.key as ArkTierKey,
          ccmiTier: ccmiBand.tier as CcmiTier,
          typology: snapshot.typology,
          vmstLevel: vmst.key as VmstLevel,
        })
      : null;

    // HARD-CAP ENFORCEMENT — independent integer rounding of jstIndex/ccmi
    // can leave (scaledJstIndex + scaledCcmi - previousArk) drifting up to
    // ±1-2 above the intended cap. Per PDD §3.4 the +15/day CCGE and
    // +20/30d SPHINX caps are STRICT ceilings, never approximate, so we
    // shave any overshoot off scaledCcmi (and re-derive its dependent
    // bands). We pick CCMI as the absorber because shaving it preserves
    // the JST sub-score recomposition (jobs/skills/talent → jstIndex).
    let finalScaledJst = scaledJstIndex;
    let finalScaledCcmi = scaledCcmi;
    let finalScaledArk = scaledArk;
    let finalCcmiBand = ccmiBand;
    let finalArkBand = arkBand;
    let finalVmst = vmst;
    let finalArkId = newArkId;
    if (intendedCap !== null && finalScaledArk - previousArk > intendedCap) {
      const overshoot = finalScaledArk - previousArk - intendedCap;
      // Absorber #1: shave from CCMI (preserves JST sub-score recomposition).
      finalScaledCcmi = clampInt(finalScaledCcmi - overshoot, 0, 300);
      finalScaledArk = clampInt(finalScaledJst + finalScaledCcmi, 0, 600);
      // Absorber #2 (fallback): if CCMI saturated at 0 and overshoot remains
      // (e.g. JST rounding contributed), shave the residual off JST so the
      // post-condition `delta ≤ intendedCap` is provably strict in every
      // branch, including invariant-drift edges. Sub-scores are not exposed
      // by the snapshot used for cap-respecting awards, so leaving them
      // proportional from the earlier scaling is acceptable.
      const residual = finalScaledArk - previousArk - intendedCap;
      if (residual > 0) {
        finalScaledJst = clampInt(finalScaledJst - residual, 0, 300);
        finalScaledArk = clampInt(finalScaledJst + finalScaledCcmi, 0, 600);
      }
      finalCcmiBand = CCMI_TIER_BANDS.find((b) => finalScaledCcmi >= b.min && finalScaledCcmi <= b.max)!;
      finalArkBand =
        ARK_TIERS.find((b) => finalScaledArk >= b.min && finalScaledArk <= b.max)
        ?? ARK_TIERS[ARK_TIERS.length - 1];
      finalVmst = VMST_LEVELS[0];
      for (const lvl of VMST_LEVELS) if (finalScaledArk >= lvl.min) finalVmst = lvl;
      finalArkId = snapshot.typology
        ? buildArkIdString({
            userId: opts.userId,
            arkTierKey: finalArkBand.key as ArkTierKey,
            ccmiTier: finalCcmiBand.tier as CcmiTier,
            typology: snapshot.typology,
            vmstLevel: finalVmst.key as VmstLevel,
          })
        : null;
    }

    finalSnapshot = {
      ...snapshot,
      arkScore: finalScaledArk,
      jstIndex: finalScaledJst,
      jstSub: scaledJstSub,
      ccmi: finalScaledCcmi,
      ccmiTier: finalCcmiBand.tier as CcmiTier,
      ccmiTierLabel: finalCcmiBand.label,
      ccmiMultiplier: finalCcmiBand.multiplier,
      ccmiPillars: scaledPillars,
      arkTierKey: finalArkBand.key as ArkTierKey,
      arkTierColor: finalArkBand.color,
      vmstLevel: finalVmst.key as VmstLevel,
      vmstLabel: finalVmst.label,
      arkIdString: finalArkId,
    };
    // Recompute the actual applied delta after rounding so persisted history
    // is exact, and the PDD invariant arkScore === jstIndex + ccmi holds.
    cappedDelta = finalScaledArk - previousArk;
    // Final post-condition — caps are STRICT ceilings per PDD §3.4. If we
    // ever land here, both absorbers above failed (shouldn't be reachable
    // because previousArk + intendedCap ∈ [0,600] always), so fail loud.
    if (intendedCap !== null && cappedDelta > intendedCap) {
      throw new Error(
        `arkRecalc cap invariant violated: delta=${cappedDelta} > intendedCap=${intendedCap} ` +
          `(prevArk=${previousArk}, finalJst=${finalScaledJst}, finalCcmi=${finalScaledCcmi})`,
      );
    }
  }
  const finalArk = finalSnapshot.arkScore;

  // Persist all surfaces inside one transaction. Note: every persisted field
  // is sourced from `finalSnapshot`, which preserves the invariant
  // arkScore === jstIndex + ccmi even when caps scaled the delta down.
  const updatedUser = await db.transaction(async (tx) => {
    const [u] = await tx
      .update(users)
      .set({
        arkScore: finalArk,
        jstIndex: finalSnapshot.jstIndex,
        ccmi: finalSnapshot.ccmi,
        ccmiTier: finalSnapshot.ccmiTier,
        vmstLevel: finalSnapshot.vmstLevel,
        typology: finalSnapshot.typology,
        arkIdString: finalSnapshot.arkIdString,
        cprScore: lhcs.cprScore,
        mpsScore: lhcs.mpsScore,
        lcisScore: lhcs.lcisScore,
        lhcsStatus: lhcs.status,
        resumeReplacementPct: finalSnapshot.resumeReplacementPct,
      })
      .where(eq(users.id, opts.userId))
      .returning();

    await tx
      .insert(ccmiPillarScores)
      .values({
        userId: opts.userId,
        p1: finalSnapshot.ccmiPillars.P1, p2: finalSnapshot.ccmiPillars.P2, p3: finalSnapshot.ccmiPillars.P3,
        p4: finalSnapshot.ccmiPillars.P4, p5: finalSnapshot.ccmiPillars.P5, p6: finalSnapshot.ccmiPillars.P6,
        p7: finalSnapshot.ccmiPillars.P7,
        composite: finalSnapshot.ccmi,
        tier: finalSnapshot.ccmiTier,
        multiplier: finalSnapshot.ccmiMultiplier,
      })
      .onConflictDoUpdate({
        target: ccmiPillarScores.userId,
        set: {
          p1: finalSnapshot.ccmiPillars.P1, p2: finalSnapshot.ccmiPillars.P2, p3: finalSnapshot.ccmiPillars.P3,
          p4: finalSnapshot.ccmiPillars.P4, p5: finalSnapshot.ccmiPillars.P5, p6: finalSnapshot.ccmiPillars.P6,
          p7: finalSnapshot.ccmiPillars.P7,
          composite: finalSnapshot.ccmi,
          tier: finalSnapshot.ccmiTier,
          multiplier: finalSnapshot.ccmiMultiplier,
          updatedAt: sql`now()`,
        },
      });

    await tx
      .insert(lhcsSignals)
      .values({
        userId: opts.userId,
        cprScore: lhcs.cprScore,
        mpsScore: lhcs.mpsScore,
        lcisScore: lhcs.lcisScore,
        cprLight: lhcs.cprLight,
        mpsLight: lhcs.mpsLight,
        lcisLight: lhcs.lcisLight,
        status: lhcs.status,
        readinessPct: lhcs.readinessPct,
      })
      .onConflictDoUpdate({
        target: lhcsSignals.userId,
        set: {
          cprScore: lhcs.cprScore,
          mpsScore: lhcs.mpsScore,
          lcisScore: lhcs.lcisScore,
          cprLight: lhcs.cprLight,
          mpsLight: lhcs.mpsLight,
          lcisLight: lhcs.lcisLight,
          status: lhcs.status,
          readinessPct: lhcs.readinessPct,
          updatedAt: sql`now()`,
        },
      });

    await tx.insert(arkScoreHistory).values({
      userId: opts.userId,
      arkScore: finalArk,
      jstIndex: finalSnapshot.jstIndex,
      ccmi: finalSnapshot.ccmi,
      delta: cappedDelta,
      trigger: opts.trigger,
      triggerMeta: { ...(opts.triggerMeta || {}), capReason, rawDelta },
    });

    return u;
  });

  return {
    snapshot: finalSnapshot,
    appliedDelta: cappedDelta,
    cappedDelta,
    rawDelta,
    capReason,
    user: updatedUser,
  };
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

// Creator-side SPHINX rows are: spc.published, spc.sold, or spc.purchased
// where triggerMeta.payload.asRole === "creator". Buyer-side spc.purchased
// rows are excluded — they represent *consumption*, not monetization, and
// must not feed the seller-only Talent boost or consume seller cap budget.
function isCreatorSphinxRow(
  trigger: string,
  triggerMeta: Record<string, unknown> | null,
): boolean {
  if (trigger === "spc.published" || trigger === "spc.sold") return true;
  if (trigger !== "spc.purchased") return false;
  const payload = (triggerMeta as { payload?: { asRole?: string } } | null)?.payload;
  return payload?.asRole === "creator";
}
