import test from "node:test";
import assert from "node:assert/strict";
import { buildMerlinGuidance, type MerlinPreference } from "../../client/src/lib/merlin-guidance";

const nodes = [
  {
    id: "prologue",
    order: 0,
    title: "The Starting Line",
    badge: "ARK Initiate",
    deepLink: "/upload",
    quest: ["Complete your first assessment."],
    earned: true,
    ccLevel: "CC_100",
  },
  {
    id: "ch1",
    order: 1,
    title: "The Foundation",
    badge: "Role Architect",
    deepLink: "/play?scenario=bc-f1-role",
    quest: ["Play the ROLE challenge."],
    earned: false,
    ccLevel: "CC_200",
  },
];

function guidance(preference: MerlinPreference, overrides: Record<string, unknown> = {}) {
  return buildMerlinGuidance({
    preference,
    assessment: { id: "assessment-1" },
    identity: { contextCraftCertLevel: "CC_100" },
    lhcs: { readinessPct: 62.6 },
    journey: { nodes, earnedCount: 1 },
    sessions: [{ certTierEarned: "Silver" }],
    ...overrides,
  });
}

test("MERLIN reports the real badge, readiness and stored CCGE tier position", () => {
  const result = guidance("certification");
  assert.equal(result.progress, 50);
  assert.equal(result.position, "ARK baseline recorded · readiness 63%");
  assert.equal(result.bestTier, "Silver");
  assert.equal(result.certification, "CC-100 Foundational");
});

test("certification preference routes to the next eligible Context Craft challenge", () => {
  const result = guidance("certification");
  assert.equal(result.nextAction.href, "/play?scenario=bc-f1-role");
  assert.match(result.nextAction.title, /CC-200/);
});

test("resilience and mobility preferences produce distinct truthful routes", () => {
  assert.equal(guidance("resilience").nextAction.href, "/play");
  assert.equal(guidance("mobility").nextAction.href, "/pathways");
});

test("an assessment is always the first action when the user's position is unmapped", () => {
  const result = guidance("badges", { assessment: null });
  assert.equal(result.hasAssessment, false);
  assert.equal(result.nextAction.href, "/upload");
  assert.equal(result.nextAction.kind, "assessment");
});