import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  storage,
  DEPARTMENT_STAFF_MAX_LIMIT,
  DEPARTMENT_STAFF_DEFAULT_LIMIT,
} from "../storage";
import type { StaffRecordWithArk, StaffAssessmentStatus } from "@shared/schema";

// ─────────────────────────────────────────────────────────────
// Department drill-down bounding (storage.getDepartmentStaff).
//
// The drill-down is deliberately bounded so a unit with hundreds of staff can
// never return an unbounded payload: default top-25, a 100-row hard cap,
// name/title search, and offset paging. These tests lock that contract in
// against a large synthetic department so a future refactor can't quietly
// reintroduce the unbounded response.
//
// getDepartmentStaff delegates to this.getStaffRecords(institution) for the raw
// roster, then does all sorting/filtering/paging in-process. We mock that one
// method with a large synthetic roster so the assertions are deterministic and
// don't depend on database state.
// ─────────────────────────────────────────────────────────────

const INSTITUTION = "Test Institute";
const BIG_DEPT = "Engineering";
const BIG_DEPT_SIZE = 250; // "well over 100"

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

/** Build a minimal StaffRecordWithArk; only the fields getDepartmentStaff reads
 *  need to be real, so the rest are filled with harmless defaults. */
function makeStaff(
  overrides: {
    id: string;
    fullName: string;
    jobTitle?: string | null;
    department?: string | null;
    assessmentStatus?: StaffAssessmentStatus;
    vulnerabilityPct?: number | null;
    nudgedAt?: Date | null;
  },
): StaffRecordWithArk {
  const status = overrides.assessmentStatus ?? "complete";
  const linked = status === "complete" || status === "pending";
  // Respect an explicitly-passed department (including null / ""), only
  // defaulting when the caller omits the key entirely.
  const department = "department" in overrides ? overrides.department ?? null : BIG_DEPT;
  return {
    id: overrides.id,
    institution: INSTITUTION,
    importBatchId: null,
    externalId: null,
    fullName: overrides.fullName,
    email: `${overrides.id}@test.io`,
    jobTitle: "jobTitle" in overrides ? overrides.jobTitle ?? null : "Software Engineer",
    department,
    team: null,
    hireDate: null,
    performanceRating: null,
    compensationBand: null,
    manager: null,
    location: null,
    arkUserId: linked ? `u-${overrides.id}` : null,
    invitedAt: status === "invited" ? new Date() : null,
    nudgedAt: overrides.nudgedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    assessmentStatus: status,
    tenureBand: "unknown" as any,
    ark:
      status === "complete"
        ? {
            arkScore: 300,
            jstIndex: 150,
            ccmi: 150,
            vulnerabilityPct: overrides.vulnerabilityPct ?? 0,
          }
        : null,
  } as StaffRecordWithArk;
}

/** A large Engineering department plus decoys in another department, so the
 *  tests also prove the department filter isolates the right cohort. */
function buildRoster(): StaffRecordWithArk[] {
  const roster: StaffRecordWithArk[] = [];

  // 250 assessed Engineering staff. vulnerabilityPct === index, so the
  // most-at-risk-first sort produces a fully predictable descending order:
  // index 249 first, index 0 last.
  for (let i = 0; i < BIG_DEPT_SIZE; i++) {
    roster.push(
      makeStaff({
        id: `eng-${pad(i)}`,
        fullName: `Engineer ${pad(i)}`,
        jobTitle: "Software Engineer",
        vulnerabilityPct: i,
      }),
    );
  }

  // One searchable-by-name needle and one searchable-by-title needle, both in
  // Engineering. Low vulnerability so they don't collide with the top page.
  roster.push(
    makeStaff({
      id: "eng-needle-name",
      fullName: "Zephyr Nightingale",
      jobTitle: "Software Engineer",
      vulnerabilityPct: 5,
    }),
  );
  roster.push(
    makeStaff({
      id: "eng-needle-title",
      fullName: "Ordinary Person",
      jobTitle: "Principal Quantum Architect",
      vulnerabilityPct: 5,
    }),
  );

  // Decoys in a different department that must never appear in Engineering.
  for (let i = 0; i < 40; i++) {
    roster.push(
      makeStaff({
        id: `sales-${pad(i)}`,
        fullName: `Seller ${pad(i)}`,
        jobTitle: "Account Executive",
        department: "Sales",
        vulnerabilityPct: 999, // would top the sort if the filter leaked
      }),
    );
  }

  return roster;
}

const ENG_TOTAL = BIG_DEPT_SIZE + 2; // 250 engineers + 2 needles

function withRoster<T>(run: () => Promise<T>): Promise<T> {
  const spy = mock.method(storage, "getStaffRecords", async () => buildRoster());
  return run().finally(() => spy.mock.restore());
}

// ── Default page: top-25, most-at-risk first ─────────────────
test("default page returns 25 rows sorted most-at-risk first", async () => {
  await withRoster(async () => {
    const page = await storage.getDepartmentStaff(INSTITUTION, BIG_DEPT);

    assert.equal(page.limit, DEPARTMENT_STAFF_DEFAULT_LIMIT);
    assert.equal(page.limit, 25);
    assert.equal(page.offset, 0);
    assert.equal(page.rows.length, 25);

    // total = the whole department (before search); filtered = same (no search).
    assert.equal(page.total, ENG_TOTAL);
    assert.equal(page.filtered, ENG_TOTAL);

    // Most-at-risk first: index 249 down to 225.
    assert.deepEqual(
      page.rows.map((r) => r.id),
      Array.from({ length: 25 }, (_, k) => `eng-${pad(249 - k)}`),
    );
    // Vulnerability strictly descending across the page.
    for (let i = 1; i < page.rows.length; i++) {
      assert.ok(
        (page.rows[i - 1].vulnerabilityPct ?? -1) >=
          (page.rows[i].vulnerabilityPct ?? -1),
        "rows must be sorted by vulnerability descending",
      );
    }
    // The Sales decoys (vulnerabilityPct 999) must never leak in.
    assert.ok(page.rows.every((r) => r.id.startsWith("eng-")));
  });
});

// ── Hard cap at 100 ──────────────────────────────────────────
test("limit is hard-capped at 100 even when a larger page is requested", async () => {
  await withRoster(async () => {
    const page = await storage.getDepartmentStaff(INSTITUTION, BIG_DEPT, {
      limit: 500,
    });
    assert.equal(page.limit, DEPARTMENT_STAFF_MAX_LIMIT);
    assert.equal(page.limit, 100);
    assert.equal(page.rows.length, 100);
    assert.equal(page.total, ENG_TOTAL);
    // First 100 are still the 100 most at risk, in order.
    assert.deepEqual(
      page.rows.map((r) => r.id),
      Array.from({ length: 100 }, (_, k) => `eng-${pad(249 - k)}`),
    );
  });
});

test("a zero/negative requested limit is floored to at least one row", async () => {
  await withRoster(async () => {
    const zero = await storage.getDepartmentStaff(INSTITUTION, BIG_DEPT, { limit: 0 });
    assert.equal(zero.limit, 1);
    assert.equal(zero.rows.length, 1);

    const neg = await storage.getDepartmentStaff(INSTITUTION, BIG_DEPT, { limit: -10 });
    assert.equal(neg.limit, 1);
    assert.equal(neg.rows.length, 1);
  });
});

// ── Offset paging returns disjoint, contiguous pages ─────────
test("offset paging returns disjoint pages that tile the roster in order", async () => {
  await withRoster(async () => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const pageSize = 100;

    for (let offset = 0; offset < ENG_TOTAL; offset += pageSize) {
      const page = await storage.getDepartmentStaff(INSTITUTION, BIG_DEPT, {
        limit: pageSize,
        offset,
      });
      assert.equal(page.offset, offset);
      assert.equal(page.total, ENG_TOTAL);
      for (const row of page.rows) {
        assert.ok(!seen.has(row.id), `row ${row.id} appeared in two pages`);
        seen.add(row.id);
        ordered.push(row.id);
      }
    }

    // Every department member is returned exactly once across the pages.
    assert.equal(seen.size, ENG_TOTAL);
    assert.equal(ordered.length, ENG_TOTAL);

    // Two explicit adjacent pages are provably disjoint.
    const p1 = await storage.getDepartmentStaff(INSTITUTION, BIG_DEPT, {
      limit: 25,
      offset: 0,
    });
    const p2 = await storage.getDepartmentStaff(INSTITUTION, BIG_DEPT, {
      limit: 25,
      offset: 25,
    });
    const p1ids = new Set(p1.rows.map((r) => r.id));
    assert.ok(p2.rows.every((r) => !p1ids.has(r.id)));
  });
});

test("an offset past the end returns an empty page but truthful counts", async () => {
  await withRoster(async () => {
    const page = await storage.getDepartmentStaff(INSTITUTION, BIG_DEPT, {
      limit: 25,
      offset: 10_000,
    });
    assert.equal(page.rows.length, 0);
    assert.equal(page.total, ENG_TOTAL);
    assert.equal(page.filtered, ENG_TOTAL);
  });
});

// ── Search filters by name and title ─────────────────────────
test("search filters by name (case-insensitive) and reports filtered count", async () => {
  await withRoster(async () => {
    const page = await storage.getDepartmentStaff(INSTITUTION, BIG_DEPT, {
      search: "zephyr",
    });
    assert.equal(page.total, ENG_TOTAL); // total is the pre-search department size
    assert.equal(page.filtered, 1); // filtered reflects the search
    assert.equal(page.rows.length, 1);
    assert.equal(page.rows[0].id, "eng-needle-name");
  });
});

test("search filters by job title", async () => {
  await withRoster(async () => {
    const page = await storage.getDepartmentStaff(INSTITUTION, BIG_DEPT, {
      search: "quantum",
    });
    assert.equal(page.total, ENG_TOTAL);
    assert.equal(page.filtered, 1);
    assert.equal(page.rows.length, 1);
    assert.equal(page.rows[0].id, "eng-needle-title");
  });
});

test("a broad search still respects the 100-row hard cap", async () => {
  await withRoster(async () => {
    // Every engineer plus the name-needle carry the title "Software Engineer"
    // (only the title-needle differs), so this matches 251 people but must
    // still be capped and counted honestly.
    const page = await storage.getDepartmentStaff(INSTITUTION, BIG_DEPT, {
      search: "software engineer",
      limit: 500,
    });
    assert.equal(page.total, ENG_TOTAL);
    assert.equal(page.filtered, BIG_DEPT_SIZE + 1); // 250 engineers + name-needle
    assert.equal(page.rows.length, DEPARTMENT_STAFF_MAX_LIMIT); // capped at 100
  });
});

test("a search matching nobody returns zero rows with total intact", async () => {
  await withRoster(async () => {
    const page = await storage.getDepartmentStaff(INSTITUTION, BIG_DEPT, {
      search: "no-such-person-anywhere",
    });
    assert.equal(page.total, ENG_TOTAL);
    assert.equal(page.filtered, 0);
    assert.equal(page.rows.length, 0);
  });
});

// ── Status ordering: assessed float above unassessed ─────────
test("assessed staff sort above unassessed regardless of vulnerability", async () => {
  const smallDept = "Support";
  const roster: StaffRecordWithArk[] = [
    makeStaff({
      id: "s-complete-lo",
      fullName: "Complete Low",
      department: smallDept,
      assessmentStatus: "complete",
      vulnerabilityPct: 10,
    }),
    makeStaff({
      id: "s-complete-hi",
      fullName: "Complete High",
      department: smallDept,
      assessmentStatus: "complete",
      vulnerabilityPct: 90,
    }),
    makeStaff({
      id: "s-pending",
      fullName: "Pending Person",
      department: smallDept,
      assessmentStatus: "pending",
    }),
    makeStaff({
      id: "s-invited",
      fullName: "Invited Person",
      department: smallDept,
      assessmentStatus: "invited",
    }),
    makeStaff({
      id: "s-unlinked",
      fullName: "Unlinked Person",
      department: smallDept,
      assessmentStatus: "unlinked",
    }),
  ];
  const spy = mock.method(storage, "getStaffRecords", async () => roster);
  try {
    const page = await storage.getDepartmentStaff(INSTITUTION, smallDept);
    assert.deepEqual(
      page.rows.map((r) => r.id),
      ["s-complete-hi", "s-complete-lo", "s-pending", "s-invited", "s-unlinked"],
    );
    assert.equal(page.total, 5);
    assert.equal(page.filtered, 5);
  } finally {
    spy.mock.restore();
  }
});

// ── Department filter isolates the cohort (incl. "Unspecified") ──
test("staff with no department bucket into 'Unspecified' and are isolated", async () => {
  const roster: StaffRecordWithArk[] = [
    makeStaff({ id: "u-1", fullName: "No Dept One", department: null, vulnerabilityPct: 3 }),
    makeStaff({ id: "u-2", fullName: "No Dept Two", department: "", vulnerabilityPct: 7 }),
    makeStaff({ id: "e-1", fullName: "Has Dept", department: "Engineering", vulnerabilityPct: 50 }),
  ];
  const spy = mock.method(storage, "getStaffRecords", async () => roster);
  try {
    const page = await storage.getDepartmentStaff(INSTITUTION, "Unspecified");
    assert.equal(page.total, 2);
    assert.deepEqual(
      page.rows.map((r) => r.id),
      ["u-2", "u-1"],
    );
  } finally {
    spy.mock.restore();
  }
});
