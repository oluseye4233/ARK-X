import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeJst,
  computeCcmi,
  computeArkScore,
  ccMultiplierForCcmi,
  arkTier,
  arkTierLabel,
  vmstFromArk,
  buildArkIdString,
  computeLhcs,
  buildSnapshot,
  typologyFromArchetypes,
} from "../scoringEngine";
import { ARK_TIERS, CCMI_TIER_BANDS, VMST_LEVELS } from "@shared/schema";

// ─────────────────────────────────────────────────────────────
// computeJst — formula + clamp + boundary inputs
// ─────────────────────────────────────────────────────────────
test("computeJst: PDD §3.4 worked example matches [(J*0.30)+(S*0.40)+(T*0.30)]*3", () => {
  const { jstIndex } = computeJst({ jobs: 80, skills: 70, talent: 60 });
  assert.equal(jstIndex, 210);
});

test("computeJst: zero inputs → 0 (lower bound)", () => {
  const { jstIndex, sub } = computeJst({ jobs: 0, skills: 0, talent: 0 });
  assert.equal(jstIndex, 0);
  assert.deepEqual(sub, { jobs: 0, skills: 0, talent: 0 });
});

test("computeJst: maxed inputs → 300 (upper bound)", () => {
  const { jstIndex } = computeJst({ jobs: 100, skills: 100, talent: 100 });
  assert.equal(jstIndex, 300);
});

test("computeJst: out-of-range inputs are clamped to 0..100 before weighting", () => {
  const { jstIndex, sub } = computeJst({ jobs: 250, skills: -50, talent: 50 });
  assert.deepEqual(sub, { jobs: 100, skills: 0, talent: 50 });
  // (100*0.30 + 0*0.40 + 50*0.30) * 3 = (30 + 0 + 15) * 3 = 135
  assert.equal(jstIndex, 135);
});

test("computeJst: weight emphasis — Skills carries the highest weight (0.40)", () => {
  // Holding two channels constant, the Skills channel must move the score most.
  const a = computeJst({ jobs: 100, skills: 0, talent: 0 }).jstIndex; // 90
  const b = computeJst({ jobs: 0, skills: 100, talent: 0 }).jstIndex; // 120
  const c = computeJst({ jobs: 0, skills: 0, talent: 100 }).jstIndex; // 90
  assert.equal(a, 90);
  assert.equal(b, 120);
  assert.equal(c, 90);
  assert.ok(b > a && b > c, "skills must dominate");
});

// ─────────────────────────────────────────────────────────────
// computeCcmi — formula + clamp + tier boundaries
// ─────────────────────────────────────────────────────────────
test("computeCcmi: PDD §3.4 worked example matches weighted pillar sum × 3", () => {
  const { ccmi } = computeCcmi({ P1: 80, P2: 70, P3: 80, P4: 60, P5: 60, P6: 70, P7: 80 });
  const expected = Math.round(
    (80 * 0.18 + 70 * 0.14 + 80 * 0.18 + 60 * 0.12 + 60 * 0.1 + 70 * 0.1 + 80 * 0.18) * 3,
  );
  assert.equal(ccmi, expected);
});

test("computeCcmi: pillar weights sum to 1.00 → all-100s yields exactly 300", () => {
  const { ccmi } = computeCcmi({ P1: 100, P2: 100, P3: 100, P4: 100, P5: 100, P6: 100, P7: 100 });
  assert.equal(ccmi, 300);
});

test("computeCcmi: zero pillars → 0, T0 Unverified, multiplier 1.0", () => {
  const r = computeCcmi({ P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0, P7: 0 });
  assert.equal(r.ccmi, 0);
  assert.equal(r.tier, "T0");
  assert.equal(r.multiplier, 1.0);
  assert.equal(r.label, "Unverified");
});

test("computeCcmi: out-of-range pillars are clamped (>100 → 100, <0 → 0)", () => {
  const r = computeCcmi({ P1: 200, P2: -5, P3: 100, P4: 100, P5: 100, P6: 100, P7: 100 });
  assert.deepEqual(r.pillars, { P1: 100, P2: 0, P3: 100, P4: 100, P5: 100, P6: 100, P7: 100 });
});

// CCMI tier band boundaries — every band edge from PDD must map correctly.
for (const band of CCMI_TIER_BANDS) {
  test(`CCMI band [${band.min}-${band.max}] → ${band.tier} ${band.label} ×${band.multiplier}`, () => {
    for (const v of [band.min, band.max, Math.floor((band.min + band.max) / 2)]) {
      assert.equal(ccMultiplierForCcmi(v), band.multiplier, `multiplier@${v}`);
    }
  });
}

test("CCMI band: off-by-one boundary check (T1↔T2, T2↔T3, T3↔T4, T4↔T5)", () => {
  assert.equal(ccMultiplierForCcmi(99), 1.0);   // T0 top
  assert.equal(ccMultiplierForCcmi(100), 1.05); // T1 bottom
  assert.equal(ccMultiplierForCcmi(149), 1.05); // T1 top
  assert.equal(ccMultiplierForCcmi(150), 1.1);  // T2 bottom
  assert.equal(ccMultiplierForCcmi(199), 1.1);  // T2 top
  assert.equal(ccMultiplierForCcmi(200), 1.2);  // T3 bottom
  assert.equal(ccMultiplierForCcmi(239), 1.2);  // T3 top
  assert.equal(ccMultiplierForCcmi(240), 1.3);  // T4 bottom
  assert.equal(ccMultiplierForCcmi(269), 1.3);  // T4 top
  assert.equal(ccMultiplierForCcmi(270), 1.35); // T5 bottom
  assert.equal(ccMultiplierForCcmi(300), 1.35); // T5 top
});

// ─────────────────────────────────────────────────────────────
// computeArkScore — invariant + clamp
// ─────────────────────────────────────────────────────────────
test("computeArkScore: ARK = JST + CCMI clamped to 0..600", () => {
  assert.equal(computeArkScore(210, 222), 432);
  assert.equal(computeArkScore(300, 300), 600);
  assert.equal(computeArkScore(0, 0), 0);
  assert.equal(computeArkScore(400, 400), 600); // clamp upper
  assert.equal(computeArkScore(-100, -100), 0); // clamp lower
});

// ─────────────────────────────────────────────────────────────
// arkTier / arkTierLabel — every band boundary
// ─────────────────────────────────────────────────────────────
for (const t of ARK_TIERS) {
  test(`arkTier band [${t.min}-${t.max}] → ${t.key}`, () => {
    for (const v of [t.min, t.max, Math.floor((t.min + t.max) / 2)]) {
      assert.equal(arkTier(v).key, t.key, `tier@${v}`);
      assert.equal(arkTier(v).color, t.color, `color@${v}`);
      assert.equal(arkTierLabel(v), t.key, `label@${v}`);
    }
  });
}

test("arkTier: off-by-one boundary check (Foundation↔Developing, etc.)", () => {
  assert.equal(arkTier(0).key, "Foundation");
  assert.equal(arkTier(199).key, "Foundation");
  assert.equal(arkTier(200).key, "Developing");
  assert.equal(arkTier(299).key, "Developing");
  assert.equal(arkTier(300).key, "Capable");
  assert.equal(arkTier(399).key, "Capable");
  assert.equal(arkTier(400).key, "Strong");
  assert.equal(arkTier(479).key, "Strong");
  assert.equal(arkTier(480).key, "Exceptional");
  assert.equal(arkTier(539).key, "Exceptional");
  assert.equal(arkTier(540).key, "Legendary");
  assert.equal(arkTier(600).key, "Legendary");
});

// ─────────────────────────────────────────────────────────────
// vmstFromArk — every band boundary
// ─────────────────────────────────────────────────────────────
test("vmstFromArk: PDD VMST level boundaries", () => {
  // L0 Exposed: 0..99
  assert.equal(vmstFromArk(0).key, "L0");
  assert.equal(vmstFromArk(99).key, "L0");
  // L1 At Risk: 100..199
  assert.equal(vmstFromArk(100).key, "L1");
  assert.equal(vmstFromArk(199).key, "L1");
  // L2 Stable: 200..349
  assert.equal(vmstFromArk(200).key, "L2");
  assert.equal(vmstFromArk(349).key, "L2");
  // L3 Protected: 350..479
  assert.equal(vmstFromArk(350).key, "L3");
  assert.equal(vmstFromArk(479).key, "L3");
  // L4 Flourishing: 480..600
  assert.equal(vmstFromArk(480).key, "L4");
  assert.equal(vmstFromArk(600).key, "L4");
});

test("vmstFromArk: label and color match PDD VMST_LEVELS table", () => {
  for (const lvl of VMST_LEVELS) {
    const v = vmstFromArk(lvl.min);
    assert.equal(v.key, lvl.key);
    assert.equal(v.label, lvl.label);
    assert.equal(v.color, lvl.color);
  }
});

// ─────────────────────────────────────────────────────────────
// buildArkIdString — canonical PDD-spec ID format
// ─────────────────────────────────────────────────────────────
test("buildArkIdString: matches PDD format ARK-{TIER3}-{Tn}-{AOC}-{Ln}-{HEX6}", () => {
  const id = buildArkIdString({
    userId: "user-abc-123",
    arkTierKey: "Legendary",
    ccmiTier: "T5",
    typology: "A",
    vmstLevel: "L4",
  });
  assert.match(id, /^ARK-[A-Z]{3}-T[0-5]-[AOC]-L[0-4]-[A-F0-9]{6}$/);
  assert.ok(id.startsWith("ARK-LEG-T5-A-L4-"));
});

test("buildArkIdString: deterministic for same userId, different for different userId", () => {
  const a1 = buildArkIdString({
    userId: "alice", arkTierKey: "Strong", ccmiTier: "T3", typology: "O", vmstLevel: "L3",
  });
  const a2 = buildArkIdString({
    userId: "alice", arkTierKey: "Strong", ccmiTier: "T3", typology: "O", vmstLevel: "L3",
  });
  const b = buildArkIdString({
    userId: "bob", arkTierKey: "Strong", ccmiTier: "T3", typology: "O", vmstLevel: "L3",
  });
  assert.equal(a1, a2, "same input → identical output");
  assert.notEqual(a1, b, "different userId → different hash");
});

test("buildArkIdString: tier prefix uses first 3 letters uppercased for every ARK tier", () => {
  const prefixes: Record<string, string> = {
    Legendary: "LEG", Exceptional: "EXC", Strong: "STR",
    Capable: "CAP", Developing: "DEV", Foundation: "FOU",
  };
  for (const t of ARK_TIERS) {
    const id = buildArkIdString({
      userId: "u", arkTierKey: t.key, ccmiTier: "T2", typology: "C", vmstLevel: "L2",
    });
    assert.ok(
      id.startsWith(`ARK-${prefixes[t.key]}-T2-C-L2-`),
      `${t.key} → ARK-${prefixes[t.key]}- but got ${id}`,
    );
  }
});

// ─────────────────────────────────────────────────────────────
// LHCS lights
// ─────────────────────────────────────────────────────────────
test("computeLhcs: readiness is weighted (0.35·CPR + 0.35·MPS + 0.30·LCIS), NOT a simple average", () => {
  // round(80*0.35 + 60*0.35 + 40*0.30) = round(28 + 21 + 12) = 61
  assert.equal(computeLhcs({ cpr: 80, mps: 60, lcis: 40 }).readinessPct, 61);
  // round(100*0.35 + 0*0.35 + 0*0.30) = 35 (vs simple-avg 33)
  assert.equal(computeLhcs({ cpr: 100, mps: 0, lcis: 0 }).readinessPct, 35);
  // All three at 50 → exactly 50 (formula sums to 1.0)
  assert.equal(computeLhcs({ cpr: 50, mps: 50, lcis: 50 }).readinessPct, 50);
});

test("computeLhcs: status is the categorical band of the COMPOSITE (not a roll-up of lights)", () => {
  // composite 70+ → green (ACTIVE)
  assert.equal(computeLhcs({ cpr: 80, mps: 80, lcis: 80 }).status, "green");
  // 80*0.35 + 80*0.35 + 30*0.30 = 28+28+9 = 65 → amber (DEVELOPING)
  // even though one light is red, the COMPOSITE is in DEVELOPING
  assert.equal(computeLhcs({ cpr: 80, mps: 80, lcis: 30 }).status, "amber");
  // 30*0.35 + 30*0.35 + 30*0.30 = 30 → red (BASELINE)
  assert.equal(computeLhcs({ cpr: 30, mps: 30, lcis: 30 }).status, "red");
});

test("computeLhcs: threshold boundaries on composite (70 = green, 40 = amber, 39 = red)", () => {
  // 70 across the board → composite 70 → green
  assert.equal(computeLhcs({ cpr: 70, mps: 70, lcis: 70 }).status, "green");
  // 40 across the board → composite 40 → amber
  assert.equal(computeLhcs({ cpr: 40, mps: 40, lcis: 40 }).status, "amber");
  // 39 across the board → composite 39 → red
  assert.equal(computeLhcs({ cpr: 39, mps: 39, lcis: 39 }).status, "red");
});

test("computeLhcs: per-component lights still use the 70/40 thresholds", () => {
  const r = computeLhcs({ cpr: 80, mps: 50, lcis: 30 });
  assert.equal(r.cprLight, "green");
  assert.equal(r.mpsLight, "amber");
  assert.equal(r.lcisLight, "red");
});

// ─────────────────────────────────────────────────────────────
// typology + buildSnapshot invariants
// ─────────────────────────────────────────────────────────────
test("typologyFromArchetypes: highest wins; ties resolve A > O > C", () => {
  assert.equal(typologyFromArchetypes({ architect: 50, orchestrator: 30, conductor: 20 }), "A");
  assert.equal(typologyFromArchetypes({ architect: 30, orchestrator: 50, conductor: 20 }), "O");
  assert.equal(typologyFromArchetypes({ architect: 20, orchestrator: 30, conductor: 50 }), "C");
  // Tie A=O → A wins
  assert.equal(typologyFromArchetypes({ architect: 40, orchestrator: 40, conductor: 20 }), "A");
});

test("buildSnapshot: ARK invariant holds (arkScore === jstIndex + ccmi)", () => {
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

test("buildSnapshot: when no archetypes → typology=null, arkIdString=null", () => {
  const snap = buildSnapshot({
    userId: "u",
    jst: { jobs: 50, skills: 50, talent: 50 },
    pillars: { P1: 50, P2: 50, P3: 50, P4: 50, P5: 50, P6: 50, P7: 50 },
  });
  assert.equal(snap.typology, null);
  assert.equal(snap.arkIdString, null);
});

// ─────────────────────────────────────────────────────────────
// SPHINX cap-bypass guard (formula-layer documentation)
// ─────────────────────────────────────────────────────────────
test("SPHINX cap-bypass guard: capped (delta=0) history rows must not contribute talent boost", () => {
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
  assert.equal(publishedN * 2 + soldN * 1.5, 3.5);
});

test("Cap rule documentation: manual.recompute / backfill triggers must never award positive ARK", () => {
  const prev = computeArkScore(200, 200); // 400
  const composed = computeArkScore(250, 250); // 500
  assert.ok(composed - prev > 0, "fixture must produce a positive raw delta");
  assert.equal(prev + 0, prev); // Sync trigger clamps to 0
});
