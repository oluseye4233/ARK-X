import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeCompleteness,
  canonicalSourcesUsed,
  buildCombinedText,
  type SourceRow,
} from "@shared/assessmentMerge";
import { ASSESSMENT_SOURCES, PRIMARY_ASSESSMENT_SOURCES } from "@shared/schema";

// ─────────────────────────────────────────────────────────────
// Cumulative profile merge — the "refine, don't clobber" engine.
// A user builds ONE evolving ARK profile from up to four sources
// (resume / self / linkedin / quiz). These tests pin down the
// guarantees verified previously only by manual curl:
//   • completeness grows ONLY with the three primary sources
//   • the archetype quiz feeds sourcesUsed but NOT completeness
//   • re-submitting one source preserves the others
//   • sourcesUsed / combined document are in canonical order
// ─────────────────────────────────────────────────────────────

// Helper: simulate the persisted-row set after a series of upserts.
// upsertAssessmentSource replaces only the matching source row (unique on
// user+source) and leaves the rest intact, so a Map keyed by source models it.
function applyUpsert(rows: SourceRow[], source: string, content: string): SourceRow[] {
  const map = new Map(rows.map((r) => [r.source, r.content ?? ""] as const));
  map.set(source, content);
  return [...map.entries()].map(([s, c]) => ({ source: s, content: c }));
}

// ── computeCompleteness ──────────────────────────────────────
test("completeness: a single primary source → 33%", () => {
  assert.equal(computeCompleteness(new Set(["resume"])), 33);
});

test("completeness: adding a second primary source → 67%", () => {
  assert.equal(computeCompleteness(new Set(["resume", "self"])), 67);
});

test("completeness: all three primary sources → 100%", () => {
  assert.equal(computeCompleteness(new Set(["resume", "self", "linkedin"])), 100);
});

test("completeness: no sources → 0%", () => {
  assert.equal(computeCompleteness(new Set()), 0);
});

test("completeness: the quiz contributes 0 toward the meter (excluded)", () => {
  // quiz alone → 0, and quiz never lifts an existing primary-derived value.
  assert.equal(computeCompleteness(new Set(["quiz"])), 0);
  assert.equal(computeCompleteness(new Set(["resume", "quiz"])), 33);
  assert.equal(
    computeCompleteness(new Set(["resume", "self", "linkedin", "quiz"])),
    100,
  );
});

test("completeness: denominator is the primary-source count, not all sources", () => {
  // Guards against a regression that divides by ASSESSMENT_SOURCES.length (4)
  // instead of PRIMARY_ASSESSMENT_SOURCES.length (3).
  assert.equal(PRIMARY_ASSESSMENT_SOURCES.length, 3);
  assert.equal(computeCompleteness(new Set(["resume"])), 33);
});

// ── canonicalSourcesUsed ─────────────────────────────────────
test("sourcesUsed: ordering is canonical regardless of insertion order", () => {
  // Submitted linkedin → resume → quiz → self, but output must be schema order.
  const present = new Set(["linkedin", "resume", "quiz", "self"]);
  assert.deepEqual(canonicalSourcesUsed(present), ["resume", "self", "linkedin", "quiz"]);
});

test("sourcesUsed: only present sources are listed, in canonical order", () => {
  assert.deepEqual(canonicalSourcesUsed(new Set(["quiz", "resume"])), ["resume", "quiz"]);
  assert.deepEqual(canonicalSourcesUsed(new Set()), []);
});

test("sourcesUsed: the quiz IS included even though it doesn't count toward completeness", () => {
  const present = new Set(["resume", "quiz"]);
  assert.ok(canonicalSourcesUsed(present).includes("quiz"));
  assert.equal(computeCompleteness(present), 33);
});

test("sourcesUsed: canonical order matches the schema-declared source order", () => {
  const present = new Set(ASSESSMENT_SOURCES);
  assert.deepEqual(canonicalSourcesUsed(present), [...ASSESSMENT_SOURCES]);
});

// ── buildCombinedText (the actual merge) ─────────────────────
test("merge: combined document concatenates present sources in canonical order with headers", () => {
  const rows: SourceRow[] = [
    { source: "self", content: "self body" },
    { source: "resume", content: "resume body" },
  ];
  const combined = buildCombinedText(rows);
  assert.equal(
    combined,
    "=== Resume ===\nresume body\n\n=== Self-Assessment ===\nself body",
  );
  // Resume header must precede Self regardless of row insertion order.
  assert.ok(combined.indexOf("Resume") < combined.indexOf("Self-Assessment"));
});

test("merge: empty / whitespace-only sources are skipped in the combined document", () => {
  const rows: SourceRow[] = [
    { source: "resume", content: "resume body" },
    { source: "self", content: "   " },
    { source: "linkedin", content: "" },
  ];
  assert.equal(buildCombinedText(rows), "=== Resume ===\nresume body");
});

test("re-submitting one source refines it but preserves the others (refine, don't clobber)", () => {
  // Start with resume + self.
  let rows = applyUpsert([], "resume", "resume v1");
  rows = applyUpsert(rows, "self", "self body");

  const present1 = new Set(rows.map((r) => r.source));
  assert.deepEqual(canonicalSourcesUsed(present1), ["resume", "self"]);
  assert.equal(computeCompleteness(present1), 67);

  // Re-submit ONLY the resume with new content.
  rows = applyUpsert(rows, "resume", "resume v2");

  const present2 = new Set(rows.map((r) => r.source));
  // Both sources still present; completeness unchanged.
  assert.deepEqual(canonicalSourcesUsed(present2), ["resume", "self"]);
  assert.equal(computeCompleteness(present2), 67);

  // The self body survived; the resume body was refined.
  const combined = buildCombinedText(rows);
  assert.ok(combined.includes("self body"), "other source preserved");
  assert.ok(combined.includes("resume v2"), "re-submitted source refined");
  assert.ok(!combined.includes("resume v1"), "old content replaced");
});

test("accumulation: sources add up across submissions, completeness grows monotonically", () => {
  let rows = applyUpsert([], "resume", "r");
  assert.equal(computeCompleteness(new Set(rows.map((x) => x.source))), 33);

  rows = applyUpsert(rows, "linkedin", "l");
  assert.equal(computeCompleteness(new Set(rows.map((x) => x.source))), 67);

  rows = applyUpsert(rows, "self", "s");
  assert.equal(computeCompleteness(new Set(rows.map((x) => x.source))), 100);

  // Adding the quiz on top keeps completeness at 100 but extends sourcesUsed.
  rows = applyUpsert(rows, "quiz", "q");
  const present = new Set(rows.map((x) => x.source));
  assert.equal(computeCompleteness(present), 100);
  assert.deepEqual(canonicalSourcesUsed(present), ["resume", "self", "linkedin", "quiz"]);
});
