// ─────────────────────────────────────────────────────────────────────────
// ARK MATCHMAKING ENGINE (pure) — the Cognitive Talent Exchange.
//
// Matches people to opportunities (jobs & projects) and assembles project
// teams, scored PURELY on VERIFIED PRIMITIVE CARDS (card_verifications) plus
// JST evidence and archetype fit. No resume keywords, no self-claims — only
// banked verification tiers count as evidence.
//
// All functions here are pure (no DB, no IO) so the scoring contract is unit-
// testable via `npm run test:matchmaking`. The DB layer (storage) feeds them
// candidate profiles and requirement rows; routes assemble the response.
// ─────────────────────────────────────────────────────────────────────────

import { TIER_RANK, type Archetype } from "@shared/schema";
import { CODEC_BY_ID } from "@shared/codec-primitives";

// A single banked verification for one primitive (tier ≥ Bronze).
export interface VerifiedCard {
  cardId: string;
  tier: string; // Bronze | Silver | Gold | Platinum
}

// Everything the engine needs to know about a person — derived ONLY from
// verified evidence + the ARK identity snapshot.
export interface CandidateProfile {
  userId: string;
  name: string;
  jstIndex: number; // 0-300
  archetype: Archetype | null; // dominant archetype, or null if unknown
  verifications: VerifiedCard[];
}

export interface RequirementInput {
  cardId: string;
  minTier: string; // Bronze | Silver | Gold | Platinum
  weight: number; // relative importance (>= 1)
  roleLabel?: string | null;
}

export interface OpportunityInput {
  jstFloor: number; // 0-300
  archetypePreference: Archetype | null;
  requirements: RequirementInput[];
}

// Per-requirement evidence outcome for a candidate.
export type RequirementStatus = "met" | "partial" | "missing";

export interface RequirementResult {
  cardId: string;
  cardName: string;
  minTier: string;
  weight: number;
  roleLabel: string | null;
  status: RequirementStatus;
  userTier: string | null; // the candidate's verified tier for this card, if any
}

export interface MatchBreakdown {
  matchScore: number; // 0-100 overall
  coveragePct: number; // 0-100 weighted verified-card coverage
  jstFactorPct: number; // 0-100 JST-floor evidence factor
  archetypeFitPct: number; // 0-100 archetype fit
  evidenceCount: number; // # requirements fully met
  totalRequirements: number;
  // What the score would be if every missing/partial requirement were
  // verified at its minimum tier — the upside of closing the skill gap.
  projectedMatchScore: number;
  requirements: RequirementResult[];
}

// Weighting of the three match components. Verified-card coverage dominates —
// the whole premise is "verified primitive cards only".
const W_COVERAGE = 0.7;
const W_JST = 0.2;
const W_ARCHETYPE = 0.1;

// Soft archetype signal: a mismatch is a gentle penalty, never a hard filter.
const ARCHETYPE_MATCH = 1;
const ARCHETYPE_MISMATCH = 0.6;
// A verification below the required tier still proves real capability.
const PARTIAL_CREDIT = 0.5;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function tierRank(tier: string | null | undefined): number {
  if (!tier) return 0;
  return TIER_RANK[tier] ?? 0;
}

function cardName(cardId: string): string {
  return CODEC_BY_ID[cardId]?.name ?? cardId;
}

function archetypeFactor(
  preference: Archetype | null,
  candidate: Archetype | null,
): number {
  if (!preference) return 1; // no preference → neutral
  if (!candidate) return ARCHETYPE_MISMATCH; // unknown → soft penalty
  return candidate === preference ? ARCHETYPE_MATCH : ARCHETYPE_MISMATCH;
}

function jstFactor(jstIndex: number, jstFloor: number): number {
  if (jstFloor <= 0) return 1;
  return clamp01(jstIndex / jstFloor);
}

// Evaluate one candidate against a set of requirements (verified-card only).
function evaluateRequirements(
  reqs: RequirementInput[],
  verified: Map<string, string>, // cardId → best tier
): { results: RequirementResult[]; coverage: number; metCount: number } {
  if (reqs.length === 0) {
    return { results: [], coverage: 1, metCount: 0 };
  }
  let weightSum = 0;
  let creditSum = 0;
  let metCount = 0;
  const results: RequirementResult[] = reqs.map((r) => {
    const w = Math.max(1, r.weight || 1);
    weightSum += w;
    const userTier = verified.get(r.cardId) ?? null;
    let status: RequirementStatus;
    let credit: number;
    if (userTier && tierRank(userTier) >= tierRank(r.minTier)) {
      status = "met";
      credit = 1;
      metCount += 1;
    } else if (userTier) {
      status = "partial";
      credit = PARTIAL_CREDIT;
    } else {
      status = "missing";
      credit = 0;
    }
    creditSum += credit * w;
    return {
      cardId: r.cardId,
      cardName: cardName(r.cardId),
      minTier: r.minTier,
      weight: w,
      roleLabel: r.roleLabel ?? null,
      status,
      userTier,
    };
  });
  const coverage = weightSum > 0 ? creditSum / weightSum : 1;
  return { results, coverage, metCount };
}

function verifiedMap(verifications: VerifiedCard[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const v of verifications) {
    if (!v.tier) continue;
    const prev = m.get(v.cardId);
    if (!prev || tierRank(v.tier) > tierRank(prev)) m.set(v.cardId, v.tier);
  }
  return m;
}

// ── Layer 1 — Human ↔ Opportunity match ────────────────────────────────
export function scoreUserForOpportunity(
  candidate: CandidateProfile,
  opportunity: OpportunityInput,
): MatchBreakdown {
  const verified = verifiedMap(candidate.verifications);
  const { results, coverage, metCount } = evaluateRequirements(
    opportunity.requirements,
    verified,
  );
  const jf = jstFactor(candidate.jstIndex, opportunity.jstFloor);
  const af = archetypeFactor(opportunity.archetypePreference, candidate.archetype);

  const score = coverage * W_COVERAGE + jf * W_JST + af * W_ARCHETYPE;

  // Projected score assumes full coverage (all reqs met) — keeps JST/archetype
  // fixed so the delta isolates the value of closing the verification gap.
  const projected = 1 * W_COVERAGE + jf * W_JST + af * W_ARCHETYPE;

  return {
    matchScore: Math.round(score * 100),
    coveragePct: Math.round(coverage * 100),
    jstFactorPct: Math.round(jf * 100),
    archetypeFitPct: Math.round(af * 100),
    evidenceCount: metCount,
    totalRequirements: opportunity.requirements.length,
    projectedMatchScore: Math.round(projected * 100),
    requirements: results,
  };
}

// ── Layer 4 (lite) — Skill gap: what to verify next ─────────────────────
export interface SkillGapItem {
  cardId: string;
  cardName: string;
  minTier: string;
  currentTier: string | null;
  gap: "missing" | "upgrade"; // not verified at all vs verified below the bar
}

export function skillGapForOpportunity(
  candidate: CandidateProfile,
  opportunity: OpportunityInput,
): SkillGapItem[] {
  const { requirements } = scoreUserForOpportunity(candidate, opportunity);
  return requirements
    .filter((r) => r.status !== "met")
    .map((r) => ({
      cardId: r.cardId,
      cardName: r.cardName,
      minTier: r.minTier,
      currentTier: r.userTier,
      gap: r.userTier ? ("upgrade" as const) : ("missing" as const),
    }));
}

// ── Layer 2 — Project Team Formation + Team Exchange Score (TXS) ─────────
export interface TeamRoleAssignment {
  roleLabel: string;
  requirements: RequirementInput[];
  assigned: {
    userId: string;
    name: string;
    archetype: Archetype | null;
    coveragePct: number;
    jstIndex: number;
  } | null;
}

export interface TeamFormationResult {
  txs: number; // 0-100 Team Exchange Score
  skillCoveragePct: number;
  diversityPct: number;
  jstDepthPct: number;
  filledRoles: number;
  totalRoles: number;
  roles: TeamRoleAssignment[];
}

const W_TXS_COVERAGE = 0.6;
const W_TXS_DIVERSITY = 0.25;
const W_TXS_JST = 0.15;

// Group an opportunity's requirements into roles. Requirements without an
// explicit roleLabel collapse into a single "Core Team" role.
export function groupRequirementsByRole(
  reqs: RequirementInput[],
): { roleLabel: string; requirements: RequirementInput[] }[] {
  const order: string[] = [];
  const byRole = new Map<string, RequirementInput[]>();
  for (const r of reqs) {
    const label = r.roleLabel?.trim() || "Core Team";
    if (!byRole.has(label)) {
      byRole.set(label, []);
      order.push(label);
    }
    byRole.get(label)!.push(r);
  }
  return order.map((label) => ({ roleLabel: label, requirements: byRole.get(label)! }));
}

// Greedy assignment: for each role pick the highest-coverage unassigned
// candidate (tie-break on JST). One person per role; a person can only fill
// one role on the squad. Roles are filled in descending order of their best
// available candidate so the strongest fits are locked first.
export function assembleTeam(
  opportunity: OpportunityInput,
  pool: CandidateProfile[],
): TeamFormationResult {
  const roles = groupRequirementsByRole(opportunity.requirements);

  // Pre-compute each candidate's coverage for each role.
  const coverageByRole = new Map<string, Map<string, number>>(); // role → (userId → coverage)
  for (const role of roles) {
    const m = new Map<string, number>();
    for (const c of pool) {
      const { coverage } = evaluateRequirements(role.requirements, verifiedMap(c.verifications));
      m.set(c.userId, coverage);
    }
    coverageByRole.set(role.roleLabel, m);
  }

  // Order roles by the strength of their single best candidate (desc).
  const rolesByStrength = [...roles].sort((a, b) => {
    const ba = Math.max(0, ...Array.from(coverageByRole.get(a.roleLabel)!.values()));
    const bb = Math.max(0, ...Array.from(coverageByRole.get(b.roleLabel)!.values()));
    return bb - ba;
  });

  const taken = new Set<string>();
  const assignment = new Map<string, TeamRoleAssignment["assigned"]>();
  const byId = new Map(pool.map((c) => [c.userId, c]));

  for (const role of rolesByStrength) {
    const cov = coverageByRole.get(role.roleLabel)!;
    let best: { userId: string; coverage: number } | null = null;
    for (const c of pool) {
      if (taken.has(c.userId)) continue;
      const coverage = cov.get(c.userId) ?? 0;
      if (coverage <= 0) continue;
      if (
        !best ||
        coverage > best.coverage ||
        (coverage === best.coverage && c.jstIndex > (byId.get(best.userId)?.jstIndex ?? 0))
      ) {
        best = { userId: c.userId, coverage };
      }
    }
    if (best) {
      taken.add(best.userId);
      const c = byId.get(best.userId)!;
      assignment.set(role.roleLabel, {
        userId: c.userId,
        name: c.name,
        archetype: c.archetype,
        coveragePct: Math.round(best.coverage * 100),
        jstIndex: c.jstIndex,
      });
    } else {
      assignment.set(role.roleLabel, null);
    }
  }

  const roleResults: TeamRoleAssignment[] = roles.map((r) => ({
    roleLabel: r.roleLabel,
    requirements: r.requirements,
    assigned: assignment.get(r.roleLabel) ?? null,
  }));

  const filled = roleResults.filter((r) => r.assigned);
  const totalRoles = roleResults.length;

  // Skill coverage = average role coverage across ALL roles (unfilled = 0).
  const coverageSum = roleResults.reduce(
    (s, r) => s + (r.assigned ? r.assigned.coveragePct / 100 : 0),
    0,
  );
  const skillCoverage = totalRoles > 0 ? coverageSum / totalRoles : 0;

  // Diversity = distinct archetypes among the assigned members, normalized by
  // the smaller of "roles filled" and the 3 possible archetypes. A solo or
  // single-archetype squad scores low; a mixed A/O/C squad scores high.
  const distinctArchetypes = new Set(
    filled.map((r) => r.assigned!.archetype).filter(Boolean),
  ).size;
  const diversityDenom = Math.max(1, Math.min(filled.length, 3));
  const diversity = filled.length > 0 ? distinctArchetypes / diversityDenom : 0;

  // JST depth = average normalized JST of assigned members (jstIndex / 300).
  const jstSum = filled.reduce((s, r) => s + clamp01(r.assigned!.jstIndex / 300), 0);
  const jstDepth = filled.length > 0 ? jstSum / filled.length : 0;

  const txs =
    skillCoverage * W_TXS_COVERAGE +
    diversity * W_TXS_DIVERSITY +
    jstDepth * W_TXS_JST;

  return {
    txs: Math.round(txs * 100),
    skillCoveragePct: Math.round(skillCoverage * 100),
    diversityPct: Math.round(diversity * 100),
    jstDepthPct: Math.round(jstDepth * 100),
    filledRoles: filled.length,
    totalRoles,
    roles: roleResults,
  };
}

// Derive a candidate's dominant archetype from the three 0-100 archetype
// scores on their assessment. Ties resolve Architect > Orchestrator >
// Conductor (stable, deterministic).
export function dominantArchetype(
  architect: number,
  orchestrator: number,
  conductor: number,
): Archetype | null {
  const max = Math.max(architect, orchestrator, conductor);
  if (max <= 0) return null;
  if (architect === max) return "ARCHITECT";
  if (orchestrator === max) return "ORCHESTRATOR";
  return "CONDUCTOR";
}
