import { TIER_RANK, type Archetype } from "@shared/schema";

/** Inputs are server-derived projections only; no contact or free-text data. */
export type GuinMaxEvidence = { cardId: string; tier: string; status: string };
export type GuinMaxCandidate = {
  userId: string; name: string; optIn: boolean; adultAttested: boolean; available: boolean;
  selectedTier: string | null; region: string | null; language: string | null;
  jstIndex: number; archetype: Archetype | null; ccmiPillars: number[] | null;
  verifications: GuinMaxEvidence[];
};
export type GuinMaxSearch = {
  needs: Array<{ cardId: string; minTier: string }>; tierFloor?: string | null;
  region?: string | null; language?: string | null; requesterArchetype?: Archetype | null;
};
export type GuinMaxCard = {
  userId: string; name: string; cxs: number;
  radar: { needCoverage: number; ccmiAffinity: number; jstReadiness: number; archetypeComplement: number };
  rationale: string[]; evidence: Array<{ cardId: string; tier: string }>;
};
const validTier = (tier: string | null | undefined) => !!tier && (TIER_RANK[tier] ?? 0) > 0;
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
// An unspecified search constraint is neutral. Once a requester specifies a
// region/language, an unknown candidate value is not evidence of compatibility.
const same = (a?: string | null, b?: string | null) => !a || (!!b && a.trim().toLowerCase() === b.trim().toLowerCase());

export function isGuinMaxEligible(candidate: GuinMaxCandidate, search: GuinMaxSearch): boolean {
  if (!candidate.optIn || !candidate.adultAttested || !candidate.available || !validTier(candidate.selectedTier)) return false;
  if (!candidate.verifications.some(v => v.status === "verified" && validTier(v.tier) &&
    (TIER_RANK[v.tier] ?? 0) >= (TIER_RANK[candidate.selectedTier!] ?? Infinity))) return false;
  if (search.tierFloor && (TIER_RANK[candidate.selectedTier!] ?? 0) < (TIER_RANK[search.tierFloor] ?? Infinity)) return false;
  return same(search.region, candidate.region) && same(search.language, candidate.language);
}

function complement(a: Archetype | null | undefined, b: Archetype | null): number {
  if (!a || !b) return .5;
  return a === b ? .6 : 1; // A/O/C are ARK typologies, not personality labels.
}
function cosine(a: number[] | null, b: number[] | null): number {
  if (!a || !b || a.length !== 7 || b.length !== 7) return .5;
  const dot = a.reduce((s, v, i) => s + clamp(v / 100) * clamp((b[i] ?? 0) / 100), 0);
  const ma = Math.sqrt(a.reduce((s, v) => s + clamp(v / 100) ** 2, 0));
  const mb = Math.sqrt(b.reduce((s, v) => s + clamp(v / 100) ** 2, 0));
  return ma && mb ? clamp(dot / (ma * mb)) : .5;
}

export function scoreGuinMaxCandidate(
  candidate: GuinMaxCandidate, search: GuinMaxSearch, requesterCcmi: number[] | null = null,
): GuinMaxCard | null {
  if (!isGuinMaxEligible(candidate, search)) return null;
  const verified = new Map<string, string>();
  for (const v of candidate.verifications) if (v.status === "verified" && validTier(v.tier) &&
    (!verified.has(v.cardId) || TIER_RANK[v.tier] > TIER_RANK[verified.get(v.cardId)!])) verified.set(v.cardId, v.tier);
  const needCoverage = search.needs.length === 0 ? 1 : search.needs.filter(n =>
    (TIER_RANK[verified.get(n.cardId) ?? ""] ?? 0) >= (TIER_RANK[n.minTier] ?? Infinity)).length / search.needs.length;
  const radar = {
    needCoverage: Math.round(60 * needCoverage),
    ccmiAffinity: Math.round(20 * cosine(requesterCcmi, candidate.ccmiPillars)),
    jstReadiness: Math.round(10 * clamp(candidate.jstIndex / 300)),
    archetypeComplement: Math.round(10 * complement(search.requesterArchetype, candidate.archetype)),
  };
  const evidence = [...verified].sort(([a], [b]) => a.localeCompare(b)).map(([cardId, tier]) => ({ cardId, tier }));
  const covered = search.needs.filter(n => verified.has(n.cardId)).length;
  return {
    userId: candidate.userId, name: candidate.name, cxs: radar.needCoverage + radar.ccmiAffinity + radar.jstReadiness + radar.archetypeComplement,
    radar, evidence,
    rationale: [
      `${covered} of ${search.needs.length} selected verified needs are covered.`,
      `CXS uses verified card evidence, current CCMI, JST readiness, and A/O/C complement.`,
    ],
  };
}

export function discoverGuinMax(
  candidates: GuinMaxCandidate[], search: GuinMaxSearch, requesterCcmi: number[] | null = null,
): GuinMaxCard[] {
  return candidates.map(c => scoreGuinMaxCandidate(c, search, requesterCcmi)).filter((c): c is GuinMaxCard => !!c)
    .sort((a, b) => b.cxs - a.cxs || a.userId.localeCompare(b.userId));
}