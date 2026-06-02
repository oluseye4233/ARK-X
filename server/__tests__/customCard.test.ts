import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateCustomCard, blendCraftIntoFinal } from "../ccge";
import type { CcgeScenario } from "@shared/schema";

const scenario: CcgeScenario = {
  id: "scn-test",
  tier: "Silver",
  title: "Draft a compliance SYSTEM prompt",
  prompt: "Write a SYSTEM prompt for a compliance review assistant.",
  targetPillars: ["System", "Instruction", "Constraint", "Format"],
  tokenBudget: 400,
  difficulty: 3,
  creatorUserId: null,
  industry: null,
  isCustom: false,
};

// ─────────────────────────────────────────────────────────────
// evaluateCustomCard — bounds + monotonicity
// ─────────────────────────────────────────────────────────────
test("evaluateCustomCard: empty body scores 0 with no signals", () => {
  const r = evaluateCustomCard({ name: "Empty", body: "", scenario });
  assert.equal(r.craft, 0);
  assert.deepEqual(r.signals, []);
});

test("evaluateCustomCard: terse vague prompt scores low", () => {
  const r = evaluateCustomCard({ name: "X", body: "do stuff", scenario });
  assert.ok(r.craft < 20, `expected low craft, got ${r.craft}`);
});

test("evaluateCustomCard: structured prompt scores high and surfaces signals", () => {
  const body = [
    "You are a meticulous compliance review assistant.",
    "Your role is to analyze the following document for regulatory risk.",
    "Constraints: you must never invent citations and only use the provided context.",
    "Output format: respond in a markdown table with columns Risk, Severity, Citation.",
    "For example, a missing disclosure should be flagged High.",
    "Steps:",
    "1. Read the document.",
    "2. Identify each risk based on the given policy text.",
  ].join("\n");
  const r = evaluateCustomCard({ name: "Compliance Sentinel", body, scenario });
  assert.ok(r.craft >= 35, `expected high craft, got ${r.craft}`);
  assert.ok(r.signals.length >= 5, `expected many signals, got ${r.signals.length}`);
});

test("evaluateCustomCard: structured beats vague (monotonic)", () => {
  const vague = evaluateCustomCard({ name: "A", body: "do stuff now", scenario });
  const structured = evaluateCustomCard({
    name: "Sentinel",
    body: "You are an expert. You must analyze the given context and output a JSON list. Do not hallucinate.",
    scenario,
  });
  assert.ok(structured.craft > vague.craft);
});

test("evaluateCustomCard: craft never exceeds 0-50 bounds", () => {
  const huge = "You must analyze the given context. ".repeat(200);
  const r = evaluateCustomCard({ name: "Wall of Text", body: huge, scenario });
  assert.ok(r.craft >= 0 && r.craft <= 50, `out of bounds: ${r.craft}`);
});

// ─────────────────────────────────────────────────────────────
// blendCraftIntoFinal — weighting + cap
// ─────────────────────────────────────────────────────────────
test("blendCraftIntoFinal: 60/40 weighting", () => {
  // 30*0.6 + 40*0.4 = 18 + 16 = 34
  assert.equal(blendCraftIntoFinal(30, 40), 34);
});

test("blendCraftIntoFinal: capped at 50", () => {
  assert.equal(blendCraftIntoFinal(50, 50), 50);
});

test("blendCraftIntoFinal: never negative", () => {
  assert.ok(blendCraftIntoFinal(0, 0) >= 0);
});
