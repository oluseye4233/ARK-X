import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DatabaseStorage,
  type WorkforceFilter,
} from "../storage";
import type { StaffRecordWithArk } from "@shared/schema";

// These tests exercise the pure filter/aggregation logic of
// `getEnterpriseIntelligence` — the AND intersection of stacked dimension
// filters, the empty-intersection empty state, and the drop-invalid-slice
// degradation. We instantiate the real storage and stub only the two DB reads
// it depends on (`getStaffRecords` for the roster, `getInstitutionJstTrend` for
// the trend), so no database is touched.

const INSTITUTION = "Vance Industries";

function staff(
  p: Partial<StaffRecordWithArk> & { id: string },
): StaffRecordWithArk {
  return {
    id: p.id,
    institution: INSTITUTION,
    importBatchId: null,
    externalId: null,
    fullName: p.fullName ?? p.id,
    email: p.email ?? `${p.id}@vance.test`,
    jobTitle: null,
    department: p.department ?? "Engineering",
    team: null,
    hireDate: null,
    performanceRating: null,
    compensationBand: p.compensationBand ?? null,
    manager: p.manager ?? null,
    location: p.location ?? null,
    arkUserId: p.arkUserId ?? null,
    invitedAt: null,
    nudgedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    assessmentStatus: p.assessmentStatus ?? "complete",
    tenureBand: p.tenureBand ?? "Unknown",
    ark:
      p.ark ??
      { arkScore: 300, jstIndex: 150, ccmi: 150, vulnerabilityPct: 30 },
  };
}

// A roster spanning two tenure bands x two locations, plus one outlier used to
// construct a valid-but-empty intersection.
//   A: 5-10y  / EU
//   B: 5-10y  / US
//   C: 1-3y   / EU
//   D: 1-3y   / US
//   E: 10y+   / APAC   (outlier: no 5-10y staff are in APAC)
const ROSTER: StaffRecordWithArk[] = [
  staff({ id: "A", tenureBand: "5-10y", location: "EU", arkUserId: "u-A" }),
  staff({ id: "B", tenureBand: "5-10y", location: "US", arkUserId: "u-B" }),
  staff({ id: "C", tenureBand: "1-3y", location: "EU", arkUserId: "u-C" }),
  staff({ id: "D", tenureBand: "1-3y", location: "US", arkUserId: "u-D" }),
  staff({ id: "E", tenureBand: "10y+", location: "APAC", arkUserId: "u-E" }),
];

function makeStorage(roster: StaffRecordWithArk[] = ROSTER) {
  const s = new DatabaseStorage();
  (s as unknown as { getStaffRecords: (i: string) => Promise<StaffRecordWithArk[]> })
    .getStaffRecords = async () => roster;
  (s as unknown as { getInstitutionJstTrend: (...a: unknown[]) => Promise<unknown[]> })
    .getInstitutionJstTrend = async () => [];
  return s;
}

// ── AND intersection ────────────────────────────────────────────────────

test("two stacked filters return only staff matching BOTH values (AND, not OR)", async () => {
  const s = makeStorage();
  const filters: WorkforceFilter[] = [
    { dimension: "tenureBand", value: "5-10y" },
    { dimension: "location", value: "EU" },
  ];

  const intel = await s.getEnterpriseIntelligence(INSTITUTION, filters);

  // Only A is both 5-10y AND EU. An OR would have yielded 3 (A, B, C).
  assert.equal(intel.totals.staff, 1);
  assert.equal(intel.totals.assessed, 1);

  // Both slices survive validation and are echoed back in canonical order.
  assert.deepEqual(intel.activeFilters, [
    { dimension: "tenureBand", value: "5-10y" },
    { dimension: "location", value: "EU" },
  ]);

  // The department heatmap only reflects the one matching person.
  const heatmapTotal = intel.byDepartment.reduce((n, r) => n + r.count, 0);
  assert.equal(heatmapTotal, 1);

  // filterOptions always reflect the WHOLE roster, never the filtered subset.
  const tenureOpt = intel.filterOptions.find((o) => o.dimension === "tenureBand");
  assert.ok(tenureOpt);
  assert.deepEqual(tenureOpt!.values, ["1-3y", "10y+", "5-10y"]);
});

// ── empty intersection ──────────────────────────────────────────────────

test("an impossible (valid) combination yields a clean empty state with zeroed totals", async () => {
  const s = makeStorage();
  // Both values exist in the roster (5-10y via A/B, APAC via E) so neither is
  // dropped — but no single person is both. This is the true empty intersection.
  const filters: WorkforceFilter[] = [
    { dimension: "tenureBand", value: "5-10y" },
    { dimension: "location", value: "APAC" },
  ];

  const intel = await s.getEnterpriseIntelligence(INSTITUTION, filters);

  // Both filters were honoured (they degraded nothing).
  assert.equal(intel.activeFilters.length, 2);

  // No fabricated rows anywhere; every total zeroed.
  assert.equal(intel.totals.staff, 0);
  assert.equal(intel.totals.linked, 0);
  assert.equal(intel.totals.assessed, 0);
  assert.equal(intel.totals.avgArk, 0);
  assert.equal(intel.totals.avgJst, 0);
  assert.equal(intel.totals.avgVulnerability, 0);
  assert.equal(intel.byDepartment.length, 0);
  assert.equal(intel.byTenureBand.length, 0);
  assert.equal(intel.byLocation.length, 0);

  // Vulnerability distribution has its 5 bands but every count is 0.
  assert.equal(intel.vulnerabilityDistribution.length, 5);
  assert.equal(
    intel.vulnerabilityDistribution.reduce((n, b) => n + b.value, 0),
    0,
  );
});

// ── invalid/fabricated slice degradation ─────────────────────────────────

test("a fabricated dimension is dropped and degrades to the unfiltered overview", async () => {
  const s = makeStorage();
  const filters = [
    // `department` is deliberately NOT a filterable dimension (it is the heatmap
    // axis) — this must be dropped, not honoured.
    { dimension: "department", value: "Engineering" },
  ] as unknown as WorkforceFilter[];

  const intel = await s.getEnterpriseIntelligence(INSTITUTION, filters);

  assert.equal(intel.activeFilters.length, 0);
  assert.equal(intel.totals.staff, ROSTER.length);
});

test("a fabricated value on a real dimension is dropped and degrades to unfiltered", async () => {
  const s = makeStorage();
  const filters: WorkforceFilter[] = [
    { dimension: "location", value: "Mars" }, // no staff on Mars
  ];

  const intel = await s.getEnterpriseIntelligence(INSTITUTION, filters);

  assert.equal(intel.activeFilters.length, 0);
  assert.equal(intel.totals.staff, ROSTER.length);
});

test("a valid slice survives while an invalid one is dropped from the same request", async () => {
  const s = makeStorage();
  const filters: WorkforceFilter[] = [
    { dimension: "location", value: "EU" }, // valid → kept
    { dimension: "location", value: "Mars" }, // invalid → dropped
  ];

  const intel = await s.getEnterpriseIntelligence(INSTITUTION, filters);

  // At most one filter per dimension is honoured (last valid wins), and the
  // fabricated value never widens the result. Only EU staff (A, C) remain.
  assert.deepEqual(intel.activeFilters, [{ dimension: "location", value: "EU" }]);
  assert.equal(intel.totals.staff, 2);
});
