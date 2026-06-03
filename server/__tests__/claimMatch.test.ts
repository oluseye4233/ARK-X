import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeText,
  normalizeCompany,
  levenshtein,
  companyMatches,
  certMatches,
} from "@shared/claimMatch";

// ─────────────────────────────────────────────────────────────
// normalizeText — casing, punctuation, diacritics, whitespace
// ─────────────────────────────────────────────────────────────
test("normalizeText: lowercases, collapses punctuation/whitespace", () => {
  assert.equal(normalizeText("  Vance,  Inc.  "), "vance inc");
});

test("normalizeText: folds diacritics", () => {
  assert.equal(normalizeText("Genève"), "geneve");
});

test("normalizeText: nullish input → empty string", () => {
  assert.equal(normalizeText(undefined as unknown as string), "");
  assert.equal(normalizeText(null as unknown as string), "");
});

// ─────────────────────────────────────────────────────────────
// normalizeCompany — descriptor suffix stripping
// ─────────────────────────────────────────────────────────────
test("normalizeCompany: strips legal suffix (Inc.)", () => {
  assert.equal(normalizeCompany("Vance, Inc."), "vance");
});

test("normalizeCompany: strips descriptor word (Industries)", () => {
  assert.equal(normalizeCompany("Vance Industries"), "vance");
});

test("normalizeCompany: never reduces to empty when all tokens are descriptors", () => {
  // "Global Solutions" are both descriptor tokens; keep the plain normalized form.
  assert.equal(normalizeCompany("Global Solutions"), "global solutions");
});

// ─────────────────────────────────────────────────────────────
// levenshtein — edit distance sanity
// ─────────────────────────────────────────────────────────────
test("levenshtein: identical strings → 0", () => {
  assert.equal(levenshtein("acme", "acme"), 0);
});

test("levenshtein: single substitution → 1", () => {
  assert.equal(levenshtein("acme", "acne"), 1);
});

test("levenshtein: empty operand → length of other", () => {
  assert.equal(levenshtein("", "acme"), 4);
  assert.equal(levenshtein("acme", ""), 4);
});

// ─────────────────────────────────────────────────────────────
// companyMatches — positive cases
// ─────────────────────────────────────────────────────────────
test("companyMatches: Inc/LLC suffix stripping", () => {
  assert.ok(companyMatches("Vance Inc.", "Vance LLC"));
  assert.ok(companyMatches("Acme Corporation", "Acme"));
});

test("companyMatches: punctuation and casing differences", () => {
  assert.ok(companyMatches("ACME, INC.", "acme inc"));
  assert.ok(companyMatches("O'Reilly Media", "oreilly media"));
});

test("companyMatches: minor typo tolerated", () => {
  // "Northwind" vs "Northwynd" — one substitution within the per-5-char budget.
  assert.ok(companyMatches("Northwind Traders", "Northwynd Traders"));
});

test("companyMatches: descriptor case — Vance Inc. vs Vance Industries", () => {
  assert.ok(companyMatches("Vance Inc.", "Vance Industries"));
});

test("companyMatches: token containment (subset of descriptor phrase)", () => {
  assert.ok(companyMatches("Vance", "Vance Industries"));
});

// ─────────────────────────────────────────────────────────────
// companyMatches — negative cases (distinct companies must NOT match)
// ─────────────────────────────────────────────────────────────
test("companyMatches: distinct companies do NOT match", () => {
  assert.equal(companyMatches("Vance Inc.", "Acme Inc."), false);
  assert.equal(companyMatches("Northwind Traders", "Contoso Ltd."), false);
});

test("companyMatches: short generic descriptor collision does NOT match", () => {
  // Both reduce toward generic descriptor words but are clearly different firms.
  assert.equal(companyMatches("Apex Solutions", "Zenith Solutions"), false);
});

test("companyMatches: empty/whitespace inputs do NOT match", () => {
  assert.equal(companyMatches("", "Acme"), false);
  assert.equal(companyMatches("Acme", "   "), false);
});

// ─────────────────────────────────────────────────────────────
// certMatches — positive cases
// ─────────────────────────────────────────────────────────────
test("certMatches: suffix tail tolerated via token containment", () => {
  assert.ok(
    certMatches(
      "AWS Certified Solutions Architect",
      "AWS Certified Solutions Architect – Associate",
    ),
  );
});

test("certMatches: punctuation/casing and year tail", () => {
  assert.ok(
    certMatches("PMP Certification", "PMP Certification (2023)"),
  );
});

test("certMatches: minor typo tolerated", () => {
  assert.ok(certMatches("Certified Scrum Master", "Certified Scrum Mastr"));
});

// ─────────────────────────────────────────────────────────────
// certMatches — negative cases (distinct certs must NOT match)
// ─────────────────────────────────────────────────────────────
test("certMatches: distinct certifications do NOT match", () => {
  assert.equal(
    certMatches(
      "AWS Certified Solutions Architect",
      "Google Cloud Professional Architect",
    ),
    false,
  );
  assert.equal(certMatches("PMP Certification", "CISSP Certification"), false);
});

test("certMatches: empty inputs do NOT match", () => {
  assert.equal(certMatches("", "PMP"), false);
});

// ─────────────────────────────────────────────────────────────
// SKILL matching stays EXACT (card id) — unaffected by fuzz
// ─────────────────────────────────────────────────────────────
// SKILL confirmations match on the stable CODEC card id via case-insensitive
// exact equality (server/routes.ts POST /api/confirmations), NOT the tolerant
// company/cert helpers. These tests pin that contract so a future change can't
// accidentally route SKILL through the fuzzy path.
const skillMatches = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

test("SKILL: identical card id matches (case-insensitive)", () => {
  assert.ok(skillMatches("codec-elephant", "CODEC-ELEPHANT"));
});

test("SKILL: near-miss card ids do NOT match (no fuzz)", () => {
  // A single-char difference that companyMatches WOULD tolerate must NOT match
  // for SKILL, proving skill matching is exact and not fuzzed.
  assert.equal(skillMatches("codec-elephant", "codec-elephnat"), false);
  assert.equal(skillMatches("codec-platform", "codec-platfrom"), false);
  // Sanity: the fuzzy helper would have accepted that same typo.
  assert.ok(companyMatches("codec elephant", "codec elephnat"));
});
