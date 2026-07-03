/**
 * PDD §3.4 J.3 — 3-stage assessment narration pipeline.
 *
 * Stage 1: JST narrator      — explains the JST sub-scores in plain English
 * Stage 2: CCMI narrator     — interprets CCMI tier + weakest pillars
 * Stage 3: ARK identity copy — composes 1-paragraph identity summary
 *
 * Fully degrades to deterministic fallback templates when Claude is unavailable
 * (no API key, budget exceeded, parse error). Never throws.
 */
import { MODELS } from "./client";
import { resolveModelChain, generateWithChain } from "./providers";
import { logUsage, enforceBudget, enforceCostBudget } from "./usage";
import {
  CCMI_PILLAR_LABELS,
  type ArkTriggerType,
  type SubscriptionPlan,
} from "@shared/schema";
import type { ArkScoreSnapshot } from "../scoringEngine";

export type IdentityNarrative = {
  jstParagraph: string;
  ccmiParagraph: string;
  arkParagraph: string;
  source: "claude" | "fallback";
  generatedAt: string;
};

function deterministicJst(s: ArkScoreSnapshot): string {
  const dominant = (() => {
    const r = [
      ["Jobs", s.jstSub.jobs] as const,
      ["Skills", s.jstSub.skills] as const,
      ["Talent", s.jstSub.talent] as const,
    ].sort((a, b) => b[1] - a[1]);
    return r[0][0];
  })();
  return `Your JST Index sits at ${s.jstIndex}/300, with ${dominant} as your strongest dimension (${
    dominant === "Jobs" ? s.jstSub.jobs : dominant === "Skills" ? s.jstSub.skills : s.jstSub.talent
  }/100). The composite places you in the ${s.arkTierKey} band. Resume replacement risk is ${s.resumeReplacementPct}%.`;
}

function deterministicCcmi(s: ArkScoreSnapshot): string {
  const sorted = (Object.entries(s.ccmiPillars) as Array<[keyof typeof s.ccmiPillars, number]>)
    .sort((a, b) => a[1] - b[1]);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  return `Your CCMI of ${s.ccmi}/300 maps to tier ${s.ccmiTier} (${s.ccmiTierLabel}, ${s.ccmiMultiplier}× CC multiplier). Strongest pillar: ${CCMI_PILLAR_LABELS[strongest[0]]} at ${strongest[1]}/100. Focus area: ${CCMI_PILLAR_LABELS[weakest[0]]} at ${weakest[1]}/100 — closing this gap is your highest-leverage move.`;
}

function deterministicArk(s: ArkScoreSnapshot): string {
  return `ARK Score ${s.arkScore}/600 — ${s.arkTierKey} tier, VMST ${s.vmstLevel} (${s.vmstLabel}). Identity ${s.arkIdString ?? "pending"}. Maintain trajectory by capturing daily CCGE wins and 30-day SPHINX activity.`;
}

const SYSTEM_PROMPT = `You are ARK Career Intelligence, a cyberpunk-enterprise narrator. You will receive a single JSON object with three sub-blocks (jst, ccmi, ark) and must produce three short paragraphs (~3 sentences each) — one per block — explaining the score in concrete, actionable language. Never use the word "AI" or refer to your own nature. Output strict JSON only:

{"jstParagraph": string, "ccmiParagraph": string, "arkParagraph": string}

Be specific, reference the actual numbers, name the weakest pillar by its label, and end the ARK paragraph with one concrete next move.`;

export async function generateIdentityNarrative(opts: {
  userId: string;
  plan: SubscriptionPlan;
  snapshot: ArkScoreSnapshot;
  trigger: ArkTriggerType;
}): Promise<IdentityNarrative> {
  const fallback = (): IdentityNarrative => ({
    jstParagraph: deterministicJst(opts.snapshot),
    ccmiParagraph: deterministicCcmi(opts.snapshot),
    arkParagraph: deterministicArk(opts.snapshot),
    source: "fallback",
    generatedAt: new Date().toISOString(),
  });

  try {
    await enforceBudget(opts.userId, opts.plan);
    await enforceCostBudget(opts.userId, opts.plan);
    // LLM-resilient: chain replaces the Anthropic-only precheck; any
    // failure (no provider, policy, budget) degrades to the deterministic
    // fallback via the catch below.
    const chain = resolveModelChain({
      plan: opts.plan,
      kind: "narrative",
      defaultModel: MODELS.SONNET,
    });
    const userPayload = JSON.stringify({
      jst: { index: opts.snapshot.jstIndex, sub: opts.snapshot.jstSub, replacementPct: opts.snapshot.resumeReplacementPct },
      ccmi: {
        score: opts.snapshot.ccmi,
        tier: opts.snapshot.ccmiTier,
        tierLabel: opts.snapshot.ccmiTierLabel,
        multiplier: opts.snapshot.ccmiMultiplier,
        pillars: Object.fromEntries(
          (Object.entries(opts.snapshot.ccmiPillars) as Array<[string, number]>).map(([k, v]) => [
            CCMI_PILLAR_LABELS[k as keyof typeof CCMI_PILLAR_LABELS],
            v,
          ]),
        ),
      },
      ark: {
        score: opts.snapshot.arkScore,
        tier: opts.snapshot.arkTierKey,
        vmst: opts.snapshot.vmstLabel,
        identity: opts.snapshot.arkIdString,
        typology: opts.snapshot.typology,
      },
      trigger: opts.trigger,
    });

    const gen = await generateWithChain({
      chain,
      system: SYSTEM_PROMPT,
      prompt: userPayload,
      maxTokens: 600,
    });
    const raw = gen.text.trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(raw) as Partial<IdentityNarrative>;
    if (!parsed.jstParagraph || !parsed.ccmiParagraph || !parsed.arkParagraph) {
      return fallback();
    }
    try {
      await logUsage({
        userId: opts.userId,
        kind: "narrative",
        model: gen.model,
        tokensIn: gen.tokensIn,
        tokensOut: gen.tokensOut,
      });
    } catch {/* best-effort */}
    return {
      jstParagraph: String(parsed.jstParagraph).slice(0, 600),
      ccmiParagraph: String(parsed.ccmiParagraph).slice(0, 600),
      arkParagraph: String(parsed.arkParagraph).slice(0, 600),
      source: "claude",
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[ai/identity] claude pipeline failed, falling back:", err);
    return fallback();
  }
}
