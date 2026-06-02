/* Career Adviser narrative engine — the single source of truth for the
   plain-English explanation of every ARK metric. It is a PURE function of the
   same data that feeds the ARK Report (identity + lhcs + assessment), so the
   adviser guide always stays in sync: whenever a number on the ARK Report
   changes, the guidance derived from that number changes with it.

   Kept JSX-free so it can be unit-tested in isolation. */

import {
  ARK_TIERS,
  CCMI_TIER_BANDS,
  CCMI_PILLAR_LABELS,
  LHCS_THRESHOLDS,
  type CcmiPillarKey,
} from "@shared/schema";

/* Plain-English vulnerability bands. Mirrors the ARK Report's VULN_LEVELS
   semantics exactly: higher level = more resilient / less exposed to AI. */
const VULN_BANDS: Record<number, { name: string; gist: string }> = {
  0: { name: "Critical Exposure", gist: "most of your day-to-day tasks could be automated soon" },
  1: { name: "Significant Exposure", gist: "a large share of your tasks are at risk of automation" },
  2: { name: "Mixed Exposure", gist: "some of your work is exposed, but a meaningful part is hard to automate" },
  3: { name: "Low Exposure", gist: "most of your work is hard to automate and you adapt well" },
  4: { name: "AI-Augmented Growth", gist: "your work is hard to automate and you actively use AI to get further ahead" },
};

const ARCHETYPE_GIST: Record<string, string> = {
  Architect: "you design the systems, structures and plans that others build on",
  Orchestrator: "you coordinate people, tools and AI to get complex work delivered",
  Conductor: "you direct and refine work in real time, steering quality as it happens",
};

export interface AdviserSection {
  /** stable id for keys / test ids */
  id: string;
  /** canonical metric name, e.g. "ARK Score" */
  metric: string;
  /** the user's headline value as a label, e.g. "420 / 600" or "Not measured yet" */
  valueLabel: string;
  /** short band/tier name when one applies, e.g. "Strong" */
  band?: string;
  /** plain-English: what this metric is */
  whatItIs: string;
  /** plain-English, personalised: what the user's own result means */
  yourResult: string;
  /** plain-English, actionable: the single highest-leverage next step */
  nextStep: string;
}

export interface AdviserReport {
  /** one-line orientation for the whole guide */
  headline: string;
  sections: AdviserSection[];
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function arkTier(score: number) {
  return ARK_TIERS.find((t) => score >= t.min && score <= t.max) ?? ARK_TIERS[ARK_TIERS.length - 1];
}

function ccmiTier(score: number) {
  return (
    CCMI_TIER_BANDS.find((t) => score >= t.min && score <= t.max) ??
    CCMI_TIER_BANDS[CCMI_TIER_BANDS.length - 1]
  );
}

function lightWord(score: number): string {
  if (score >= LHCS_THRESHOLDS.green) return "green (strong)";
  if (score >= LHCS_THRESHOLDS.amber) return "amber (developing)";
  return "red (just getting started)";
}

/* Build the full Career Adviser guide from the live ARK data. Accepts the same
   loosely-typed shapes the ARK Report consumes so the two never drift. */
export function buildAdviserReport(identity: any, lhcs: any, assessment: any): AdviserReport {
  const a = assessment || {};
  const id = identity || {};

  const ark: number | null = typeof id.arkScore === "number" ? id.arkScore : null;
  const jst = num(id.jstIndex, num(a.jstTotal, 0));
  const ccmi = num(id.ccmi, 0);
  const jobs = num(a.jstJobs);
  const skills = num(a.jstSkills);
  const talent = num(a.jstTalent);
  const pillars = id.pillars || null;
  const readiness: number | null =
    lhcs && typeof lhcs.readinessPct === "number" ? lhcs.readinessPct : null;
  const cpr = num(lhcs?.cprScore);
  const mps = num(lhcs?.mpsScore);
  const lcis = num(lhcs?.lcisScore);
  const vuln = typeof a.vulnerabilityLevel === "number" ? a.vulnerabilityLevel : 2;
  const vInfo = VULN_BANDS[vuln] || VULN_BANDS[2];

  const arch = [
    { label: "Architect", v: num(a.archetypeArchitect) },
    { label: "Orchestrator", v: num(a.archetypeOrchestrator) },
    { label: "Conductor", v: num(a.archetypeConductor) },
  ].sort((x, y) => y.v - x.v);
  const topArch = arch[0];

  const vectors: Array<{ subject: string; score: number }> = Array.isArray(a.transferabilityVectors)
    ? a.transferabilityVectors
    : [];
  const sortedVectors = [...vectors].sort((x, y) => num(y.score) - num(x.score));

  const sections: AdviserSection[] = [];

  /* ── ARK Score ── */
  {
    const tier = ark !== null ? arkTier(ark) : null;
    sections.push({
      id: "ark",
      metric: "ARK Score",
      valueLabel: ark !== null ? `${ark} / 600` : "Building — needs JST + CCMI",
      band: tier?.key,
      whatItIs:
        "Your single headline number for career strength, from 0 to 600. It adds two things together: what the job market values about you today (your JST Index) and how skillfully you can direct AI (your CCMI). A higher number means you are more future-proof.",
      yourResult:
        ark !== null
          ? `You scored ${ark} out of 600, which sits in the "${tier?.key}" band. In plain terms, this is the sum of your market value (${jst}) and your AI-direction skill (${ccmi}). It is the one number to watch over time — if it climbs, you are getting more valuable and more resilient.`
          : `Your ARK Score isn't fully formed yet. It is built from your JST Index (${jst}) plus your CCMI (${ccmi}). Complete a CV upload and play a few CCGE rounds and this headline number will appear.`,
      nextStep:
        "Treat ARK as your scoreboard. The two ways to raise it are below: grow your market value (JST) and grow your AI-direction skill (CCMI). Small, steady gains in either one move this number up.",
    });
  }

  /* ── JST Index ── */
  {
    const lead = [
      { l: "Jobs (how in-demand your roles are)", v: jobs },
      { l: "Skills (the depth of what you can do)", v: skills },
      { l: "Talent (your underlying aptitude)", v: talent },
    ].sort((x, y) => y.v - x.v);
    sections.push({
      id: "jst",
      metric: "JST Index",
      valueLabel: `${jst} / 300`,
      whatItIs:
        "What the job market will pay for you today, from 0 to 300. It blends three things — Jobs (how sought-after your roles are), Skills (the depth of what you can actually do) and Talent (your underlying aptitude). Skills count the most.",
      yourResult:
        `Your JST is ${jst} out of 300, built from Jobs ${jobs}, Skills ${skills} and Talent ${talent} (each scored 0-100). Your strongest area is "${lead[0].l}" and your lowest is "${lead[2].l}". Lifting the lowest one is usually the fastest way to raise the whole index.`,
      nextStep:
        `Focus on your weakest of the three. To raise it, add evidence the market recognises — a recognised qualification, a concrete project, or a role that uses the missing strength — then re-upload your CV so the score updates.`,
    });
  }

  /* ── CCMI ── */
  {
    const tier = ccmiTier(ccmi);
    let pillarLine = "";
    if (pillars) {
      const rows = (Object.keys(CCMI_PILLAR_LABELS) as CcmiPillarKey[])
        .map((k) => ({ k, label: CCMI_PILLAR_LABELS[k], v: num(pillars[k]) }))
        .sort((x, y) => y.v - x.v);
      pillarLine = ` Across the 7 mastery pillars your strongest is "${rows[0].label}" and your weakest is "${rows[rows.length - 1].label}".`;
    }
    sections.push({
      id: "ccmi",
      metric: "CCMI · Prompt-Craft Mastery",
      valueLabel: `${ccmi} / 300`,
      band: `${tier.tier} · ${tier.label}`,
      whatItIs:
        "How skillfully you direct AI through context, from 0 to 300. It is measured across 7 pillars of prompt-craft (things like giving the AI a clear role, precise instructions, good examples, and the right data). This is the half of your ARK Score that you build by practising — mainly in the CCGE Arena.",
      yourResult:
        (ccmi > 0
          ? `Your CCMI is ${ccmi} out of 300 — the "${tier.label}" tier. This reflects how well you currently brief and steer AI tools.`
          : `Your CCMI is still at the starting line. This is the skill of briefing AI well, and it is the easiest part of your ARK Score to grow quickly.`) + pillarLine,
      nextStep:
        "Play the CCGE Arena regularly — each session strengthens specific pillars and nudges this score up. Concentrate on your weakest pillar first for the biggest gain.",
    });
  }

  /* ── LHCS Readiness ── */
  {
    sections.push({
      id: "lhcs",
      metric: "LHCS Readiness",
      valueLabel: readiness !== null ? `${readiness}% ready` : "Not measured yet",
      whatItIs:
        "A live 'are you keeping momentum?' signal from 0 to 100%, based on what you actually do on the platform. It blends three lights: CPR (how consistently you practise), MPS (your progress over time) and LCIS (how engaged you are right now). Above 70% is green, 40-70% is amber, below 40% is red.",
      yourResult:
        readiness !== null
          ? `You're at ${readiness}% ready. Your three lights are CPR ${cpr} (${lightWord(cpr)}), MPS ${mps} (${lightWord(mps)}) and LCIS ${lcis} (${lightWord(lcis)}). Unlike your other scores, this one reflects recent activity, so it rises and falls with how active you've been.`
          : "Your readiness signal hasn't enough activity yet. It starts lighting up once you upload a CV, run assessments and play CCGE sessions.",
      nextStep:
        "Keep a light, regular rhythm — a short CCGE session every few days does more for this signal than one big burst. The light that's lowest tells you whether to focus on consistency, progress, or fresh activity.",
    });
  }

  /* ── AI Vulnerability ── */
  {
    sections.push({
      id: "vulnerability",
      metric: "AI Vulnerability",
      valueLabel: `Level ${vuln} · ${vInfo.name}`,
      band: vInfo.name,
      whatItIs:
        "How exposed your current work is to being automated by AI over roughly the next two years, on a scale of L0 to L4. Counter-intuitively, HIGHER is better here: L0 means most of your tasks could be automated, L4 means your work is hard to automate and you're using AI to pull ahead.",
      yourResult:
        `You're at Level ${vuln} (${vInfo.name}) — meaning ${vInfo.gist}. This is based on the mix of tasks in your role and how much of your strength is in areas (like judgement, leadership and AI-direction) that automation struggles to replace.`,
      nextStep:
        vuln >= 3
          ? "You're in a resilient position — protect it by continuing to grow your AI-direction skill (CCMI) so you stay ahead of the curve."
          : "Shift your weekly effort toward tasks AI can't easily do — judgement calls, coordination, and directing AI itself. Raising your CCMI directly lowers your exposure here.",
    });
  }

  /* ── Archetype ── */
  {
    sections.push({
      id: "archetype",
      metric: "Operating Archetype",
      valueLabel: topArch ? `${topArch.label} (${Math.round(topArch.v)}%)` : "Not measured yet",
      band: topArch?.label,
      whatItIs:
        "Your natural way of working with AI, shown as a mix of three styles: Architect (designs systems), Orchestrator (coordinates people and tools) and Conductor (steers work in real time). Most people are a blend, with one style leading.",
      yourResult: topArch
        ? `Your leading style is ${topArch.label} at ${Math.round(topArch.v)}% — ${ARCHETYPE_GIST[topArch.label] ?? "your dominant operating mode"}. The full mix is ${arch
            .map((x) => `${x.label} ${Math.round(x.v)}%`)
            .join(", ")}. There's no 'best' archetype; knowing yours helps you lean into roles that fit it.`
        : "Your archetype mix isn't set yet — it's detected from your CV and the archetype quiz.",
      nextStep:
        "Use this as a compass, not a cage. Lean into roles and projects that reward your lead style, and deliberately stretch a second style when you want to broaden your options.",
    });
  }

  /* ── 12-Vector Transferability ── */
  {
    let result: string;
    if (sortedVectors.length > 0) {
      const top = sortedVectors.slice(0, 3).map((v) => `${v.subject} (${Math.round(num(v.score))})`);
      const weakest = sortedVectors[sortedVectors.length - 1];
      result = `Your strongest directions are ${top.join(", ")}. Your most limited is ${weakest.subject} (${Math.round(
        num(weakest.score),
      )}). A wider, more even shape means you can pivot into more fields with less retraining.`;
    } else {
      result = "Your transferability radar will populate after your first CV upload.";
    }
    sections.push({
      id: "transferability",
      metric: "12-Vector Transferability",
      valueLabel:
        sortedVectors.length > 0
          ? `Top: ${sortedVectors[0].subject} (${Math.round(num(sortedVectors[0].score))})`
          : "Not measured yet",
      whatItIs:
        "How easily your skills carry across into 12 different career directions, each scored 0-100. It answers 'if I wanted to change lanes, how ready am I?' for a range of fields at once.",
      yourResult: result,
      nextStep:
        "If you have a target direction in mind, look at its score: a low number tells you which skills to add before making the move. If you just want flexibility, build up your two lowest vectors to round out your options.",
    });
  }

  const headline =
    ark !== null
      ? `This guide explains, in plain English, every number on your ARK Report. Your headline ARK Score is ${ark}/600 (${arkTier(ark).key}). Read each section to understand what it means and the one thing that moves it.`
      : "This guide explains, in plain English, every number on your ARK Report — what each one means for your career and the single best next step to improve it.";

  return { headline, sections };
}
