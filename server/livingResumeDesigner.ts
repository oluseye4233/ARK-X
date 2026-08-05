// ─────────────────────────────────────────────────────────────────────────
// LIVING RESUME DESIGNER (add-on, per JNGL-PDD-ARKH-LRD-2026-001)
// Read-only aggregation feeding the client wizard's prefill step (LRD-301):
// identity/bio from the user's latest assessment, ARK Score + JST tier from
// the user record, and the user's own SPHINX Marketplace listings for the
// SPC Portfolio Panel (LRD-201). The wizard itself is client-side/localStorage
// state — this module never writes resume content, only reads existing
// platform data.
// ─────────────────────────────────────────────────────────────────────────
import { storage } from "./storage";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan, type WorkHistoryEntry } from "@shared/schema";

export interface LivingResumeSpcListing {
  id: string;
  title: string;
  pillar: string;
  priceCredits: number;
  kcseScore: number | null;
  hiveScore: number | null;
  salesCount: number;
}

export interface LivingResumeDesignerPrefill {
  identity: {
    candidateName: string | null;
    currentRole: string | null;
    currentEmployer: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    linkLinkedin: string | null;
    linkGithub: string | null;
    linkPortfolio: string | null;
  };
  workHistory: WorkHistoryEntry[];
  headshotDataUrl: string | null;
  arkScore: {
    total: number;
    jstIndex: number;
    ccmiTier: string | null;
    typology: string | null;
    arkIdString: string | null;
  };
  isProPlus: boolean;
  spcListings: LivingResumeSpcListing[];
}

// Pro+ = the same gate used across the app for reportAccess (executive report,
// ARK Resume). Folds the PDD's "Architect+" gate into this same boolean —
// ARK-X has no separate Architect billing tier.
function isProPlusPlan(plan: string | null | undefined): boolean {
  const key = (plan || "INDIVIDUAL_FREE") as SubscriptionPlan;
  const planData = SUBSCRIPTION_PLANS[key] || SUBSCRIPTION_PLANS.INDIVIDUAL_FREE;
  return planData.limits.reportAccess === true;
}

export async function buildLivingResumeDesignerPrefill(
  userId: string,
): Promise<LivingResumeDesignerPrefill | null> {
  const [user, assessment, listings] = await Promise.all([
    storage.getUser(userId),
    storage.getLatestAssessment(userId),
    storage.getSpcListingsByCreator(userId),
  ]);
  if (!user) return null;

  const isProPlus = isProPlusPlan(user.subscriptionPlan);

  return {
    identity: {
      candidateName: assessment?.candidateName ?? user.name,
      currentRole: assessment?.currentRole ?? user.role ?? null,
      currentEmployer: assessment?.currentEmployer ?? null,
      contactEmail: assessment?.contactEmail ?? null,
      contactPhone: assessment?.contactPhone ?? null,
      linkLinkedin: assessment?.linkLinkedin ?? null,
      linkGithub: assessment?.linkGithub ?? null,
      linkPortfolio: assessment?.linkPortfolio ?? null,
    },
    workHistory: ((assessment?.workHistory ?? []) as WorkHistoryEntry[]) || [],
    headshotDataUrl: user.headshotDataUrl ?? null,
    arkScore: {
      total: user.arkScore,
      jstIndex: user.jstIndex,
      ccmiTier: user.ccmiTier ?? null,
      typology: user.typology ?? null,
      arkIdString: user.arkIdString ?? null,
    },
    isProPlus,
    // SPC listings themselves aren't Pro+-gated at the source (creators of any
    // plan can publish) but the client only renders the panel for Pro+ per
    // PDD §5 — still returned here so the client doesn't need a second round
    // trip once a user upgrades mid-session.
    spcListings: listings
      .filter((l) => l.status === "active")
      .map((l) => ({
        id: l.id,
        title: l.title,
        pillar: l.pillar,
        priceCredits: l.priceCredits,
        kcseScore: l.kcseScore ?? null,
        hiveScore: l.hiveScore ?? null,
        salesCount: l.salesCount,
      })),
  };
}
