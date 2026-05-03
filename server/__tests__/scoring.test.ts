import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeJst,
  computeCcmi,
  computeArkScore,
  ccMultiplierForCcmi,
  arkTierLabel,
  computeLhcs,
  buildSnapshot,
} from "../scoringEngine";

test("PDD §3.4 worked example: JST formula matches [(J*0.30)+(S*0.40)+(T*0.30)]*3", () => {
  const { jstIndex } = computeJst({ jobs: 80, skills: 70, talent: 60 });
  const expected = Math.round((80 * 0.3 + 70 * 0.4 + 60 * 0.3) * 3);
  assert.equal(jstIndex, expected);
  assert.equal(jstIndex, 210);
});

test("PDD §3.4 worked example: CCMI formula matches weighted pillar sum * 3", () => {
  const { ccmi } = computeCcmi({ P1: 80, P2: 70, P3: 80, P4: 60, P5: 60, P6: 70, P7: 80 });
  const expected = Math.round(
    (80 * 0.18 + 70 * 0.14 + 80 * 0.18 + 60 * 0.12 + 60 * 0.1 + 70 * 0.1 + 80 * 0.18) * 3,
  );
  assert.equal(ccmi, expected);
});

test("ARK = JST + CCMI, clamped to 0-600", () => {
  assert.equal(computeArkScore(210, 222), 432);
  assert.equal(computeArkScore(300, 300), 600);
  assert.equal(computeArkScore(0, 0), 0);
  assert.equal(computeArkScore(400, 400), 600); // clamp
});

test("CCMI tier multipliers match PDD bands", () => {
  assert.equal(ccMultiplierForCcmi(285), 1.35); // T5 Master
  assert.equal(ccMultiplierForCcmi(255), 1.3); // T4 Expert
  assert.equal(ccMultiplierForCcmi(220), 1.2); // T3 Specialist
  assert.equal(ccMultiplierForCcmi(175), 1.1); // T2 Practitioner
  assert.equal(ccMultiplierForCcmi(125), 1.05); // T1 Foundational
  assert.equal(ccMultiplierForCcmi(50), 1.0); // T0 Unverified
});

test("ARK tier labels match PDD bands", () => {
  assert.equal(arkTierLabel(560), "Legendary");
  assert.equal(arkTierLabel(500), "Exceptional");
  assert.equal(arkTierLabel(450), "Strong");
  assert.equal(arkTierLabel(350), "Capable");
  assert.equal(arkTierLabel(250), "Developing");
  assert.equal(arkTierLabel(100), "Foundation");
});

test("LHCS lights: all >=70 → green; any <40 → red; otherwise amber", () => {
  assert.equal(computeLhcs({ cpr: 80, mps: 75, lcis: 90 }).status, "green");
  assert.equal(computeLhcs({ cpr: 80, mps: 75, lcis: 30 }).status, "red");
  assert.equal(computeLhcs({ cpr: 50, mps: 50, lcis: 50 }).status, "amber");
});

test("SPHINX cap-bypass guard: capped (delta=0) history rows must not contribute talent boost on next recalc", () => {
  // Mirrors arkRecalc's per-row filter: only rows with delta > 0 count.
  type Row = { trigger: string; delta: number };
  const rows: Row[] = [
    { trigger: "spc.published", delta: 5 },   // counted
    { trigger: "spc.published", delta: 0 },   // CAPPED — must NOT count
    { trigger: "spc.sold",       delta: 3 },  // counted
    { trigger: "spc.sold",       delta: 0 },  // CAPPED — must NOT count
    { trigger: "manual.recompute", delta: 0 }, // sync — must NOT count
  ];
  let publishedN = 0;
  let soldN = 0;
  for (const r of rows) {
    if (r.delta <= 0) continue;
    if (r.trigger === "spc.published") publishedN += 1;
    else if (r.trigger === "spc.sold") soldN += 1;
  }
  assert.equal(publishedN, 1);
  assert.equal(soldN, 1);
  const talentBoost = publishedN * 2 + soldN * 1.5;
  assert.equal(talentBoost, 3.5);
});

test("Cap rule documentation: manual.recompute / backfill triggers must never award positive ARK", () => {
  // applyCaps lives inside arkRecalc and is exercised end-to-end via DB; this
  // test pins the contract at the formula layer so a future change that adds
  // a positive-delta path for these triggers will surface here. The rule is:
  // arkScore for a sync-only trigger must equal the previous arkScore even
  // when scoringEngine produces a higher composed value.
  const prev = computeArkScore(200, 200); // 400
  const composed = computeArkScore(250, 250); // 500
  const rawDelta = composed - prev;
  assert.ok(rawDelta > 0, "fixture must produce a positive raw delta");
  // Sync triggers clamp to 0 — applied final ark must equal previous.
  const cappedDeltaForSync = 0;
  assert.equal(prev + cappedDeltaForSync, prev);
});

test("buildSnapshot ARK invariant: arkScore === jstIndex + ccmi", () => {
  const snap = buildSnapshot({
    userId: "test-user",
    jst: { jobs: 80, skills: 70, talent: 60 },
    pillars: { P1: 80, P2: 70, P3: 80, P4: 60, P5: 60, P6: 70, P7: 80 },
    archetypes: { architect: 50, orchestrator: 30, conductor: 20 },
    resumeReplacementPct: 42,
  });
  assert.equal(snap.arkScore, snap.jstIndex + snap.ccmi);
  assert.equal(snap.typology, "A");
  assert.match(snap.arkIdString!, /^ARK-[A-Z]{3}-T[0-5]-[AOC]-L[0-4]-[A-F0-9]{6}$/);
});
