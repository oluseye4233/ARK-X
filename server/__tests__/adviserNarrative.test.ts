import { test } from "node:test";
import assert from "node:assert/strict";

import { buildAdviserReport } from "@/lib/arkAdviserNarrative";

/* The Career Adviser guide must derive its plain-English explanations purely
   from the same data the ARK Report consumes, so the two never drift. */

const fullIdentity = {
  arkScore: 420,
  jstIndex: 210,
  ccmi: 210,
  pillars: { P1: 80, P2: 40, P3: 70, P4: 60, P5: 50, P6: 55, P7: 65, tier: "T3" },
  arkIdString: "ARK-TEST",
};
const fullLhcs = {
  readinessPct: 72,
  cprScore: 80,
  cprLight: "green",
  mpsScore: 65,
  mpsLight: "amber",
  lcisScore: 30,
  lcisLight: "red",
};
const fullAssessment = {
  jstJobs: 70,
  jstSkills: 80,
  jstTalent: 60,
  vulnerabilityLevel: 3,
  archetypeArchitect: 50,
  archetypeOrchestrator: 30,
  archetypeConductor: 20,
  transferabilityVectors: [
    { subject: "Data", score: 90 },
    { subject: "Design", score: 40 },
    { subject: "Ops", score: 65 },
  ],
};

test("covers every ARK metric section", () => {
  const { sections } = buildAdviserReport(fullIdentity, fullLhcs, fullAssessment);
  const ids = sections.map((s) => s.id);
  for (const expected of ["ark", "jst", "ccmi", "lhcs", "vulnerability", "archetype", "transferability"]) {
    assert.ok(ids.includes(expected), `missing section: ${expected}`);
  }
});

test("each section has plain-English explanation, result and next step", () => {
  const { sections } = buildAdviserReport(fullIdentity, fullLhcs, fullAssessment);
  for (const s of sections) {
    assert.ok(s.whatItIs.length > 20, `whatItIs too short for ${s.id}`);
    assert.ok(s.yourResult.length > 20, `yourResult too short for ${s.id}`);
    assert.ok(s.nextStep.length > 20, `nextStep too short for ${s.id}`);
    assert.ok(s.valueLabel.length > 0, `valueLabel empty for ${s.id}`);
  }
});

test("ARK section reflects the user's actual score and tier band", () => {
  const { headline, sections } = buildAdviserReport(fullIdentity, fullLhcs, fullAssessment);
  const ark = sections.find((s) => s.id === "ark")!;
  assert.equal(ark.valueLabel, "420 / 600");
  assert.equal(ark.band, "Strong"); // 400-479 band per ARK_TIERS
  assert.match(ark.yourResult, /420/);
  assert.match(headline, /420\/600/);
});

test("narrative tracks data changes (stays in sync with the ARK Report)", () => {
  const low = buildAdviserReport({ ...fullIdentity, arkScore: 120 }, fullLhcs, fullAssessment);
  const arkLow = low.sections.find((s) => s.id === "ark")!;
  assert.equal(arkLow.valueLabel, "120 / 600");
  assert.equal(arkLow.band, "Foundation"); // 0-199 band
  assert.notEqual(arkLow.band, "Strong");
});

test("higher AI-vulnerability level is described as more resilient", () => {
  const resilient = buildAdviserReport(fullIdentity, fullLhcs, { ...fullAssessment, vulnerabilityLevel: 4 });
  const exposed = buildAdviserReport(fullIdentity, fullLhcs, { ...fullAssessment, vulnerabilityLevel: 0 });
  const vR = resilient.sections.find((s) => s.id === "vulnerability")!;
  const vE = exposed.sections.find((s) => s.id === "vulnerability")!;
  assert.match(vR.valueLabel, /Level 4/);
  assert.match(vE.valueLabel, /Level 0/);
  assert.match(vR.nextStep, /resilient/i);
});

test("transferability highlights strongest and weakest directions", () => {
  const { sections } = buildAdviserReport(fullIdentity, fullLhcs, fullAssessment);
  const t = sections.find((s) => s.id === "transferability")!;
  assert.match(t.yourResult, /Data/); // highest score
  assert.match(t.yourResult, /Design/); // lowest score
});

test("handles empty / not-yet-measured data without throwing", () => {
  const { sections, headline } = buildAdviserReport({}, null, {});
  assert.equal(sections.length, 7);
  const ark = sections.find((s) => s.id === "ark")!;
  assert.ok(ark.valueLabel.length > 0);
  assert.ok(headline.length > 0);
});
