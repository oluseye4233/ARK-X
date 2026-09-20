export type MerlinPreference = "certification" | "badges" | "resilience" | "mobility";

export type MerlinNode = {
  id: string; order: number; title: string; badge: string; deepLink: string;
  quest: string[]; earned: boolean; earnedAt?: string | null; ccLevel?: string | null;
};

export type MerlinAction = {
  title: string; detail: string; href: string; label: string; kind: "assessment" | "badge" | "certification" | "mobility";
};

export type MerlinGuidance = {
  preference: MerlinPreference; position: string; destination: string; progress: number;
  earnedBadges: number; totalBadges: number; certification: string; bestTier: string | null;
  nextAction: MerlinAction; destinations: Array<{ id: MerlinPreference; title: string; detail: string }>;
  milestones: Array<{ label: string; complete: boolean; detail: string }>; hasAssessment: boolean;
};

const labels: Record<MerlinPreference, { title: string; detail: string }> = {
  certification: { title: "Fastest certification", detail: "Focus the next Context Craft tier outcome." },
  badges: { title: "Complete badges", detail: "Move through the book journey, one earned badge at a time." },
  resilience: { title: "Strengthen AI resilience", detail: "Build evidence of deliberate Context Craft practice." },
  mobility: { title: "Career mobility", detail: "Start with a career-value baseline, then explore pathways." },
};

const tierRank: Record<string, number> = { Bronze: 1, Silver: 2, Gold: 3, Platinum: 4 };
const certRank: Record<string, number> = { NONE: 0, CC_100: 1, CC_200: 2, CC_300: 3, CC_400: 4, CC_500: 5 };
const certLabel: Record<string, string> = {
  NONE: "No Context Craft tier yet", CC_100: "CC-100 Foundational", CC_200: "CC-200 Practitioner",
  CC_300: "CC-300 Specialist", CC_400: "CC-400 Expert", CC_500: "CC-500 Master Architect",
};

function tierFromSession(session: any): string | null {
  const value = session?.certTierEarned ?? session?.certificationTier ?? session?.tier ?? session?.outcome?.tier ?? session?.result?.tier;
  return typeof value === "string" && tierRank[value] ? value : null;
}

export function buildMerlinGuidance(input: {
  preference: MerlinPreference; assessment?: any | null; identity?: any | null; lhcs?: any | null;
  journey?: { nodes?: MerlinNode[]; earnedCount?: number } | null; ledger?: any | null; sessions?: any[] | null;
}): MerlinGuidance {
  const nodes = input.journey?.nodes ?? [];
  const earned = input.journey?.earnedCount ?? nodes.filter(n => n.earned).length;
  const total = nodes.length || 13;
  const hasAssessment = Boolean(input.assessment);
  const identityLevel = input.identity?.contextCraftCertLevel ?? input.identity?.certLevel;
  const level = typeof identityLevel === "string" ? identityLevel : "NONE";
  const bestTier = (input.sessions ?? []).map(tierFromSession).filter(Boolean).sort((a, b) => tierRank[b!] - tierRank[a!])[0] ?? null;
  const firstOpen = [...nodes].sort((a, b) => a.order - b.order).find(n => !n.earned);
  const targetNode = firstOpen ?? nodes[nodes.length - 1];
  const needsAssessment = !hasAssessment;
  const certificationNode = [...nodes].sort((a, b) => a.order - b.order).find(n => !n.earned && n.ccLevel && certRank[n.ccLevel] > certRank[level]);
  let nextAction: MerlinAction;
  if (needsAssessment) nextAction = { title: "Map your starting point", detail: "Run your ARK assessment to establish the career-value baseline MERLIN can navigate from.", href: "/upload", label: "Start assessment", kind: "assessment" };
  else if (input.preference === "mobility") nextAction = { title: "Explore your mobility routes", detail: "Use your completed assessment as the grounding signal for career pathways.", href: "/pathways", label: "View pathways", kind: "mobility" };
  else if (input.preference === "resilience") nextAction = { title: "Strengthen your AI-direction practice", detail: "A focused CCGE session builds the Context Craft evidence that improves your resilience position.", href: "/play", label: "Open Skill Games", kind: "certification" };
  else if (input.preference === "certification" && certificationNode) nextAction = { title: `Work toward ${certificationNode.ccLevel?.replace("_", "-")}`, detail: `${certificationNode.title} is your next available Context Craft practice route.`, href: certificationNode.deepLink, label: "Open challenge", kind: "certification" };
  else if (targetNode) nextAction = { title: `Earn ${targetNode.badge}`, detail: targetNode.quest?.[0] ?? "Continue your Context Craft book journey.", href: targetNode.deepLink, label: "Continue journey", kind: "badge" };
  else nextAction = { title: "Review your growth record", detail: "Your current book journey is complete. Review your ARK trajectory.", href: "/ark/history", label: "View history", kind: "mobility" };
  const readiness = input.lhcs?.readinessPct ?? input.lhcs?.readiness ?? input.lhcs?.composite ?? input.identity?.lhcsReadiness;
  const position = needsAssessment ? "Unmapped — no assessment on record" : `ARK baseline recorded${typeof readiness === "number" ? ` · readiness ${Math.round(readiness)}%` : ""}`;
  return {
    preference: input.preference, position, destination: labels[input.preference].title, progress: Math.round((earned / total) * 100),
    earnedBadges: earned, totalBadges: total, certification: certLabel[level] ?? level.replace("_", "-"), bestTier,
    nextAction, hasAssessment,
    destinations: (Object.keys(labels) as MerlinPreference[]).map(id => ({ id, ...labels[id] })),
    milestones: [
      { label: "Career-value baseline", complete: hasAssessment, detail: hasAssessment ? "Assessment available" : "Assessment needed" },
      { label: "Book-journey badges", complete: earned > 0, detail: `${earned} of ${total} earned` },
      { label: "CCGE tier outcome", complete: Boolean(bestTier), detail: bestTier ? `${bestTier} outcome recorded` : "No tier outcome recorded" },
    ],
  };
}