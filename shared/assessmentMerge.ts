import {
  ASSESSMENT_SOURCES,
  PRIMARY_ASSESSMENT_SOURCES,
  ASSESSMENT_SOURCE_LABELS,
  type AssessmentSourceKey,
} from "./schema";

// Pure helpers for the cumulative ARK profile merge. A user builds ONE evolving
// profile by contributing multiple sources (resume / self / linkedin / quiz);
// re-submitting one source must refine the profile, never clobber the others.
// These functions are extracted from the route handlers so the "refine, don't
// clobber" guarantee can be unit-tested without a database or AI pipeline.

// A minimal view of a persisted assessment-source row.
export interface SourceRow {
  source: string;
  content?: string | null;
}

// Completeness/confidence meter: share of the three PRIMARY intake sources
// (resume / self / linkedin) the user has contributed, as a 0-100 percentage.
// The archetype quiz refines the profile but doesn't count toward the meter.
export function computeCompleteness(present: Set<string>): number {
  const primaryPresent = PRIMARY_ASSESSMENT_SOURCES.filter((k) => present.has(k)).length;
  return Math.round((primaryPresent / PRIMARY_ASSESSMENT_SOURCES.length) * 100);
}

// Canonical (schema-declared) ordering of the sources a user has contributed,
// so the combined document and the `sourcesUsed` list are stable regardless of
// the order the sources were actually submitted in.
export function canonicalSourcesUsed(present: Set<string>): AssessmentSourceKey[] {
  return ASSESSMENT_SOURCES.filter((k) => present.has(k));
}

// Concatenate every present source's raw text into one combined document with
// per-source headers so the downstream keyword analyzer reads them coherently.
// Empty/whitespace-only sources are skipped. Output order is canonical.
export function buildCombinedText(rows: SourceRow[]): string {
  const present = new Set(rows.map((r) => r.source));
  return canonicalSourcesUsed(present)
    .map((key) => {
      const row = rows.find((r) => r.source === key);
      const body = (row?.content ?? "").trim();
      if (!body) return "";
      return `=== ${ASSESSMENT_SOURCE_LABELS[key]} ===\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");
}
