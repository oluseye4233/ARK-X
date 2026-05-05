/**
 * PDD §3.4 ARK-MVP-008 — Flywheel CTA engine. 10-branch decision tree that
 * picks the next highest-leverage action for a user given their ARK identity
 * snapshot + LHCS. Branches are ordered by leverage; first match wins.
 *
 * Output contract (per task J.5):
 *   { position, headline, subtext, ctaLabel, ctaHref, urgency }
 *
 * `position` is one of the 10 PDD branch slots (1..10). `urgency` is the
 * traffic-light priority used by the dashboard to colour the card.
 */
import type { User, LhcsSignals, CcmiPillarScores } from "@shared/schema";

export type FlywheelUrgency = "critical" | "high" | "medium" | "low";

export type FlywheelCta = {
  position: number;
  id: string;
  headline: string;
  subtext: string;
  ctaLabel: string;
  ctaHref: string;
  pillar?: string;
  expectedDelta: number;
  urgency: FlywheelUrgency;
};

export type FlywheelInput = {
  user: User;
  lhcs: LhcsSignals | null;
  pillars: CcmiPillarScores | null;
  hasResumeUploaded: boolean;
};

const ACTIONS: Array<(i: FlywheelInput) => FlywheelCta | null> = [
  // 1. No resume → must analyze first.
  (i) =>
    i.hasResumeUploaded
      ? null
      : {
          position: 1,
          id: "upload_resume",
          headline: "Run your AI vulnerability scan",
          subtext: "Upload your resume to compute your JST index, ARK Score, and identity profile.",
          ctaLabel: "Upload resume",
          ctaHref: "/upload",
          expectedDelta: 60,
          urgency: "critical",
        },

  // 2. Foundation tier (ARK < 200) → guided onboarding.
  (i) =>
    i.user.arkScore < 200
      ? {
          position: 2,
          id: "complete_onboarding",
          headline: "Build your baseline ARK Score",
          subtext: "Your score is in Foundation territory. Run the assessment + first CCGE drill to clear 200.",
          ctaLabel: "Start assessment",
          ctaHref: "/assessment",
          expectedDelta: 120,
          urgency: "critical",
        }
      : null,

  // 3. Critical pillar gap (any pillar < 35) → targeted CCGE drill on weakest pillar.
  (i) => {
    if (!i.pillars) return null;
    const entries: Array<[string, number]> = [
      ["P1", i.pillars.p1], ["P2", i.pillars.p2], ["P3", i.pillars.p3],
      ["P4", i.pillars.p4], ["P5", i.pillars.p5], ["P6", i.pillars.p6], ["P7", i.pillars.p7],
    ];
    const weakest = entries.sort((a, b) => a[1] - b[1])[0];
    if (weakest[1] >= 35) return null;
    return {
      position: 3,
      id: `drill_${weakest[0].toLowerCase()}`,
      headline: `Strengthen ${weakest[0]} — your weakest CC pillar`,
      subtext: `Pillar ${weakest[0]} is at ${weakest[1]}/100. A focused CCGE drill can lift your CCMI by 15-25 points.`,
      ctaLabel: "Run CCGE drill",
      ctaHref: "/play",
      pillar: weakest[0],
      expectedDelta: 25,
      urgency: "high",
    };
  },

  // 4. LCIS red → no recent learning activity.
  (i) =>
    i.lhcs && i.lhcs.lcisLight === "red"
      ? {
          position: 4,
          id: "lcis_revival",
          headline: "Restart your learning cycle",
          subtext: "No CCGE sessions in 30 days. One Bronze tier win restores your LCIS signal to amber.",
          ctaLabel: "Play CCGE",
          ctaHref: "/play",
          expectedDelta: 12,
          urgency: "high",
        }
      : null,

  // 5. CCMI tier T2 or higher but no SPC published → publish flywheel.
  (i) =>
    i.user.ccmi >= 150 && !(i.lhcs && i.lhcs.mpsScore > 0)
      ? {
          position: 5,
          id: "publish_first_spc",
          headline: "Publish your first Super Prompt Card",
          subtext: "Your CCMI qualifies you to monetize. Publishing earns +2 JST Talent + opens marketplace lights.",
          ctaLabel: "Publish SPC",
          ctaHref: "/marketplace/publish",
          expectedDelta: 8,
          urgency: "high",
        }
      : null,

  // 6. CPR red → diversify transferable skills.
  (i) =>
    i.lhcs && i.lhcs.cprLight === "red"
      ? {
          position: 6,
          id: "cpr_diversify",
          headline: "Broaden your career-pivot options",
          subtext: "Your transferability profile is narrow. Review pivot opportunities + add 2 new skill areas.",
          ctaLabel: "View pivots",
          ctaHref: "/pathways",
          expectedDelta: 10,
          urgency: "medium",
        }
      : null,

  // 7. MPS amber/red but has listings → drive a sale.
  (i) =>
    i.lhcs && i.lhcs.mpsLight !== "green" && i.lhcs.mpsScore > 0
      ? {
          position: 7,
          id: "mps_promote",
          headline: "Promote your SPC listings",
          subtext: "Listings live but slow sales. Refine titles + ship a $10 prompt to widen reach.",
          ctaLabel: "Manage listings",
          ctaHref: "/marketplace",
          expectedDelta: 6,
          urgency: "medium",
        }
      : null,

  // 8. Strong tier (400-479) → push to Exceptional via cert upgrade.
  (i) =>
    i.user.arkScore >= 400 && i.user.arkScore < 480
      ? {
          position: 8,
          id: "cert_upgrade",
          headline: "Earn your next CC certification tier",
          subtext: "You're 80 ARK points from Exceptional. Win Gold tier in CCGE Arena to upgrade your cert.",
          ctaLabel: "Enter Arena",
          ctaHref: "/play",
          expectedDelta: 20,
          urgency: "medium",
        }
      : null,

  // 9. Exceptional (480-539) → Legendary chase via marketplace volume.
  (i) =>
    i.user.arkScore >= 480 && i.user.arkScore < 540
      ? {
          position: 9,
          id: "legendary_chase",
          headline: "Push for Legendary status",
          subtext: "Stack a Master-tier SPC sale + a Diamond CCGE win to crack 540.",
          ctaLabel: "Open marketplace",
          ctaHref: "/marketplace",
          expectedDelta: 15,
          urgency: "medium",
        }
      : null,

  // 10. Default — Legendary maintenance.
  () => ({
    position: 10,
    id: "maintain_lead",
    headline: "Maintain your Legendary edge",
    subtext: "Run a weekly CCGE drill + curate your top SPC listing to keep all LHCS lights green.",
    ctaLabel: "Open dashboard",
    ctaHref: "/dashboard",
    expectedDelta: 5,
    urgency: "low",
  }),
];

export function pickFlywheelCta(input: FlywheelInput): FlywheelCta {
  for (const fn of ACTIONS) {
    const cta = fn(input);
    if (cta) return cta;
  }
  return ACTIONS[ACTIONS.length - 1](input)!;
}

export function rankAllCtas(input: FlywheelInput, limit = 3): FlywheelCta[] {
  const out: FlywheelCta[] = [];
  for (const fn of ACTIONS) {
    const cta = fn(input);
    if (cta) out.push(cta);
    if (out.length >= limit) break;
  }
  return out;
}
