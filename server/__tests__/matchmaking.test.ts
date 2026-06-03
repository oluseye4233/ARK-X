import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreUserForOpportunity,
  skillGapForOpportunity,
  assembleTeam,
  groupRequirementsByRole,
  dominantArchetype,
  type CandidateProfile,
  type OpportunityInput,
} from "../matchmaking";

// Use real CODEC primitive ids so cardName resolution exercises the catalog.
const C1 = "codec-elephant";
const C2 = "codec-platform";
const C3 = "codec-innovation";
const C4 = "codec-revenue";

function candidate(partial: Partial<CandidateProfile> & { userId: string }): CandidateProfile {
  return {
    name: partial.userId,
    jstIndex: 0,
    archetype: null,
    verifications: [],
    ...partial,
  };
}

// ── scoreUserForOpportunity ──────────────────────────────────────────────

test("full verified coverage at/above min tier → 100% coverage", () => {
  const opp: OpportunityInput = {
    jstFloor: 0,
    archetypePreference: null,
    requirements: [
      { cardId: C1, minTier: "Silver", weight: 1 },
      { cardId: C2, minTier: "Bronze", weight: 1 },
    ],
  };
  const me = candidate({
    userId: "u1",
    verifications: [
      { cardId: C1, tier: "Gold" }, // exceeds Silver → met
      { cardId: C2, tier: "Bronze" }, // exactly meets Bronze → met
    ],
  });
  const m = scoreUserForOpportunity(me, opp);
  assert.equal(m.coveragePct, 100);
  assert.equal(m.evidenceCount, 2);
  assert.equal(m.totalRequirements, 2);
  // No jstFloor and no preference → both factors neutral (100). Overall 100.
  assert.equal(m.matchScore, 100);
});

test("verification below required tier → partial credit (0.5)", () => {
  const opp: OpportunityInput = {
    jstFloor: 0,
    archetypePreference: null,
    requirements: [{ cardId: C1, minTier: "Gold", weight: 1 }],
  };
  const me = candidate({ userId: "u1", verifications: [{ cardId: C1, tier: "Bronze" }] });
  const m = scoreUserForOpportunity(me, opp);
  assert.equal(m.coveragePct, 50);
  assert.equal(m.requirements[0].status, "partial");
  assert.equal(m.requirements[0].userTier, "Bronze");
  assert.equal(m.evidenceCount, 0);
});

test("no verification → missing (0 credit)", () => {
  const opp: OpportunityInput = {
    jstFloor: 0,
    archetypePreference: null,
    requirements: [{ cardId: C1, minTier: "Bronze", weight: 1 }],
  };
  const m = scoreUserForOpportunity(candidate({ userId: "u1" }), opp);
  assert.equal(m.coveragePct, 0);
  assert.equal(m.requirements[0].status, "missing");
  assert.equal(m.requirements[0].userTier, null);
});

test("requirement weights bias coverage", () => {
  const opp: OpportunityInput = {
    jstFloor: 0,
    archetypePreference: null,
    requirements: [
      { cardId: C1, minTier: "Bronze", weight: 4 }, // heavy, met
      { cardId: C2, minTier: "Bronze", weight: 1 }, // light, missing
    ],
  };
  const me = candidate({ userId: "u1", verifications: [{ cardId: C1, tier: "Gold" }] });
  const m = scoreUserForOpportunity(me, opp);
  // 4 of 5 weight covered → 80%.
  assert.equal(m.coveragePct, 80);
});

test("jstFloor factor scales below the floor and caps at 1", () => {
  const reqs = [{ cardId: C1, minTier: "Bronze", weight: 1 }];
  const me = candidate({ userId: "u1", jstIndex: 100, verifications: [{ cardId: C1, tier: "Gold" }] });
  const below = scoreUserForOpportunity(me, { jstFloor: 200, archetypePreference: null, requirements: reqs });
  assert.equal(below.jstFactorPct, 50); // 100/200
  const above = scoreUserForOpportunity(me, { jstFloor: 50, archetypePreference: null, requirements: reqs });
  assert.equal(above.jstFactorPct, 100); // capped
});

test("archetype mismatch is a soft penalty (60%), not a filter", () => {
  const reqs = [{ cardId: C1, minTier: "Bronze", weight: 1 }];
  const me = candidate({
    userId: "u1",
    archetype: "CONDUCTOR",
    verifications: [{ cardId: C1, tier: "Gold" }],
  });
  const mismatch = scoreUserForOpportunity(me, {
    jstFloor: 0,
    archetypePreference: "ARCHITECT",
    requirements: reqs,
  });
  assert.equal(mismatch.archetypeFitPct, 60);
  const match = scoreUserForOpportunity(
    candidate({ userId: "u1", archetype: "ARCHITECT", verifications: [{ cardId: C1, tier: "Gold" }] }),
    { jstFloor: 0, archetypePreference: "ARCHITECT", requirements: reqs },
  );
  assert.equal(match.archetypeFitPct, 100);
});

test("overall match is the weighted blend (coverage .7 / jst .2 / archetype .1)", () => {
  const me = candidate({
    userId: "u1",
    jstIndex: 150,
    archetype: "CONDUCTOR",
    verifications: [{ cardId: C1, tier: "Gold" }], // 1 of 2 met → coverage 50
  });
  const opp: OpportunityInput = {
    jstFloor: 300, // 150/300 → jst 50
    archetypePreference: "ARCHITECT", // mismatch → 60
    requirements: [
      { cardId: C1, minTier: "Bronze", weight: 1 },
      { cardId: C2, minTier: "Bronze", weight: 1 },
    ],
  };
  const m = scoreUserForOpportunity(me, opp);
  // 0.5*.7 + 0.5*.2 + 0.6*.1 = .35 + .10 + .06 = .51 → 51
  assert.equal(m.matchScore, 51);
});

test("projected match shows the upside of full verification", () => {
  const me = candidate({ userId: "u1", jstIndex: 300, archetype: "ARCHITECT" });
  const opp: OpportunityInput = {
    jstFloor: 0,
    archetypePreference: null,
    requirements: [
      { cardId: C1, minTier: "Silver", weight: 1 },
      { cardId: C2, minTier: "Silver", weight: 1 },
    ],
  };
  const m = scoreUserForOpportunity(me, opp);
  assert.equal(m.matchScore, 30); // coverage 0 → .0*.7 + 1*.2 + 1*.1 = .30
  assert.equal(m.projectedMatchScore, 100); // full coverage → 1*.7 + .2 + .1
});

test("empty requirements → full coverage", () => {
  const m = scoreUserForOpportunity(candidate({ userId: "u1" }), {
    jstFloor: 0,
    archetypePreference: null,
    requirements: [],
  });
  assert.equal(m.coveragePct, 100);
  assert.equal(m.matchScore, 100);
});

test("best (highest) tier wins when a card is verified more than once", () => {
  const opp: OpportunityInput = {
    jstFloor: 0,
    archetypePreference: null,
    requirements: [{ cardId: C1, minTier: "Gold", weight: 1 }],
  };
  const me = candidate({
    userId: "u1",
    verifications: [
      { cardId: C1, tier: "Bronze" },
      { cardId: C1, tier: "Platinum" },
    ],
  });
  const m = scoreUserForOpportunity(me, opp);
  assert.equal(m.requirements[0].status, "met");
  assert.equal(m.requirements[0].userTier, "Platinum");
});

// ── skillGapForOpportunity ───────────────────────────────────────────────

test("skill gap lists missing and under-tier requirements only", () => {
  const opp: OpportunityInput = {
    jstFloor: 0,
    archetypePreference: null,
    requirements: [
      { cardId: C1, minTier: "Bronze", weight: 1 }, // met
      { cardId: C2, minTier: "Gold", weight: 1 }, // upgrade
      { cardId: C3, minTier: "Silver", weight: 1 }, // missing
    ],
  };
  const me = candidate({
    userId: "u1",
    verifications: [
      { cardId: C1, tier: "Silver" },
      { cardId: C2, tier: "Bronze" },
    ],
  });
  const gap = skillGapForOpportunity(me, opp);
  assert.equal(gap.length, 2);
  const upgrade = gap.find((g) => g.cardId === C2)!;
  assert.equal(upgrade.gap, "upgrade");
  assert.equal(upgrade.currentTier, "Bronze");
  const missing = gap.find((g) => g.cardId === C3)!;
  assert.equal(missing.gap, "missing");
  assert.equal(missing.currentTier, null);
});

// ── groupRequirementsByRole ──────────────────────────────────────────────

test("requirements without a role collapse into 'Core Team'", () => {
  const groups = groupRequirementsByRole([
    { cardId: C1, minTier: "Bronze", weight: 1 },
    { cardId: C2, minTier: "Bronze", weight: 1 },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].roleLabel, "Core Team");
  assert.equal(groups[0].requirements.length, 2);
});

test("roles are grouped and keep first-seen order", () => {
  const groups = groupRequirementsByRole([
    { cardId: C1, minTier: "Bronze", weight: 1, roleLabel: "Lead" },
    { cardId: C2, minTier: "Bronze", weight: 1, roleLabel: "Builder" },
    { cardId: C3, minTier: "Bronze", weight: 1, roleLabel: "Lead" },
  ]);
  assert.deepEqual(groups.map((g) => g.roleLabel), ["Lead", "Builder"]);
  assert.equal(groups[0].requirements.length, 2);
});

// ── assembleTeam ─────────────────────────────────────────────────────────

test("assembleTeam assigns the best candidate per role, one role each", () => {
  const opp: OpportunityInput = {
    jstFloor: 0,
    archetypePreference: null,
    requirements: [
      { cardId: C1, minTier: "Bronze", weight: 1, roleLabel: "Lead" },
      { cardId: C2, minTier: "Bronze", weight: 1, roleLabel: "Builder" },
    ],
  };
  const pool: CandidateProfile[] = [
    candidate({ userId: "lead", archetype: "ARCHITECT", jstIndex: 200, verifications: [{ cardId: C1, tier: "Gold" }] }),
    candidate({ userId: "builder", archetype: "CONDUCTOR", jstIndex: 180, verifications: [{ cardId: C2, tier: "Gold" }] }),
  ];
  const team = assembleTeam(opp, pool);
  assert.equal(team.totalRoles, 2);
  assert.equal(team.filledRoles, 2);
  const lead = team.roles.find((r) => r.roleLabel === "Lead")!;
  const builder = team.roles.find((r) => r.roleLabel === "Builder")!;
  assert.equal(lead.assigned?.userId, "lead");
  assert.equal(builder.assigned?.userId, "builder");
});

test("a candidate cannot fill two roles", () => {
  const opp: OpportunityInput = {
    jstFloor: 0,
    archetypePreference: null,
    requirements: [
      { cardId: C1, minTier: "Bronze", weight: 1, roleLabel: "Lead" },
      { cardId: C1, minTier: "Bronze", weight: 1, roleLabel: "Backup" },
    ],
  };
  const pool: CandidateProfile[] = [
    candidate({ userId: "solo", verifications: [{ cardId: C1, tier: "Gold" }] }),
  ];
  const team = assembleTeam(opp, pool);
  assert.equal(team.filledRoles, 1); // only one role can take the single candidate
  assert.equal(team.totalRoles, 2);
});

test("unfillable role stays empty and drags skill coverage", () => {
  const opp: OpportunityInput = {
    jstFloor: 0,
    archetypePreference: null,
    requirements: [
      { cardId: C1, minTier: "Bronze", weight: 1, roleLabel: "Lead" },
      { cardId: C4, minTier: "Bronze", weight: 1, roleLabel: "Specialist" }, // nobody has C4
    ],
  };
  const pool: CandidateProfile[] = [
    candidate({ userId: "lead", verifications: [{ cardId: C1, tier: "Gold" }] }),
  ];
  const team = assembleTeam(opp, pool);
  assert.equal(team.filledRoles, 1);
  const specialist = team.roles.find((r) => r.roleLabel === "Specialist")!;
  assert.equal(specialist.assigned, null);
  // Coverage averages over ALL roles: (100 + 0) / 2 = 50.
  assert.equal(team.skillCoveragePct, 50);
});

test("TXS rewards archetype diversity", () => {
  const reqs = [
    { cardId: C1, minTier: "Bronze", weight: 1, roleLabel: "A" },
    { cardId: C2, minTier: "Bronze", weight: 1, roleLabel: "B" },
  ];
  const opp: OpportunityInput = { jstFloor: 0, archetypePreference: null, requirements: reqs };
  // Diverse squad: two distinct archetypes.
  const diverse = assembleTeam(opp, [
    candidate({ userId: "a", archetype: "ARCHITECT", jstIndex: 150, verifications: [{ cardId: C1, tier: "Gold" }] }),
    candidate({ userId: "b", archetype: "CONDUCTOR", jstIndex: 150, verifications: [{ cardId: C2, tier: "Gold" }] }),
  ]);
  // Monoculture: same archetype.
  const mono = assembleTeam(opp, [
    candidate({ userId: "a", archetype: "ARCHITECT", jstIndex: 150, verifications: [{ cardId: C1, tier: "Gold" }] }),
    candidate({ userId: "b", archetype: "ARCHITECT", jstIndex: 150, verifications: [{ cardId: C2, tier: "Gold" }] }),
  ]);
  assert.equal(diverse.diversityPct, 100); // 2 distinct / min(2,3)=2
  assert.equal(mono.diversityPct, 50); // 1 distinct / 2
  assert.ok(diverse.txs > mono.txs);
});

test("empty pool → no roles filled, TXS 0", () => {
  const opp: OpportunityInput = {
    jstFloor: 0,
    archetypePreference: null,
    requirements: [{ cardId: C1, minTier: "Bronze", weight: 1, roleLabel: "Lead" }],
  };
  const team = assembleTeam(opp, []);
  assert.equal(team.filledRoles, 0);
  assert.equal(team.txs, 0);
});

// ── dominantArchetype ────────────────────────────────────────────────────

test("dominantArchetype picks the max with stable tie-break", () => {
  assert.equal(dominantArchetype(50, 30, 20), "ARCHITECT");
  assert.equal(dominantArchetype(20, 50, 30), "ORCHESTRATOR");
  assert.equal(dominantArchetype(20, 30, 50), "CONDUCTOR");
  assert.equal(dominantArchetype(40, 40, 20), "ARCHITECT"); // tie → Architect
  assert.equal(dominantArchetype(0, 0, 0), null);
});
