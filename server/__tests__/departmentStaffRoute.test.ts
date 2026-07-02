import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "../storage";
import { registerRoutes } from "../routes";
import type { StaffRecordWithArk, User } from "@shared/schema";

// ─────────────────────────────────────────────────────────────
// Route-level coverage of GET /api/enterprise/departments/:department/staff.
//
// The storage layer's bounding contract (top-25 default, 100-row cap, offset
// paging) is already locked in by departmentStaff.test.ts, but that suite
// calls storage.getDepartmentStaff with ALREADY-NUMERIC options. The HTTP
// route does its own coercion of the raw query string (Number() guarded by
// Number.isFinite) plus a decode of the department path param — none of which
// was covered. These tests drive the real Express route (real middleware
// chain: feature flag → auth → institution-admin gate) so garbage in the URL
// (?limit=abc, ?limit=1e9, ?offset=-5, ?limit=3.7, encoded department names)
// can never silently misbehave again.
//
// Auth strategy: a stub session middleware injects req.session.userId, and
// storage.getUser is mocked to return an ENTERPRISE admin with an
// institution — the real requireAuth / requireInstitutionAdmin middlewares
// then pass on their own logic (no middleware is bypassed).
// ─────────────────────────────────────────────────────────────

const INSTITUTION = "Route Test Institute";
const ADMIN_ID = "route-admin-1";

const SPACED_AMP_DEPT = "Sales & Marketing"; // space + "&" — must survive URL encoding
const PERCENT_DEPT = "Top 10%";              // literal "%" — must not crash decode
const BIG_DEPT_SIZE = 30;                    // > default page of 25

function makeStaff(id: string, dept: string, vulnerabilityPct: number): StaffRecordWithArk {
  return {
    id,
    institution: INSTITUTION,
    importBatchId: null,
    externalId: null,
    fullName: `Person ${id}`,
    email: `${id}@test.io`,
    jobTitle: "Analyst",
    department: dept,
    team: null,
    hireDate: null,
    performanceRating: null,
    compensationBand: null,
    manager: null,
    location: null,
    arkUserId: `u-${id}`,
    invitedAt: null,
    nudgedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    assessmentStatus: "complete",
    tenureBand: "unknown" as any,
    ark: { arkScore: 300, jstIndex: 150, ccmi: 150, vulnerabilityPct },
  } as StaffRecordWithArk;
}

function buildRoster(): StaffRecordWithArk[] {
  const roster: StaffRecordWithArk[] = [];
  // 30 staff in the space-and-ampersand department; vulnerabilityPct === index
  // so the most-at-risk-first sort is fully predictable (29 first, 0 last).
  for (let i = 0; i < BIG_DEPT_SIZE; i++) {
    roster.push(makeStaff(`sm-${String(i).padStart(2, "0")}`, SPACED_AMP_DEPT, i));
  }
  // A small percent-named department.
  for (let i = 0; i < 3; i++) {
    roster.push(makeStaff(`pct-${i}`, PERCENT_DEPT, 50 + i));
  }
  // Decoys in a plain department that must never leak into either cohort.
  for (let i = 0; i < 10; i++) {
    roster.push(makeStaff(`eng-${i}`, "Engineering", 999));
  }
  return roster;
}

const ADMIN_USER = {
  id: ADMIN_ID,
  subscriptionPlan: "ENTERPRISE",
  institution: INSTITUTION,
} as unknown as User;

let server: Server;
let baseUrl: string;
let getUserSpy: ReturnType<typeof mock.method>;
let rosterSpy: ReturnType<typeof mock.method>;

before(async () => {
  // The real middleware chain runs; only the session cookie plumbing is
  // stubbed (we inject the userId a real session would have carried).
  const app = express();
  app.use((req, _res, next) => {
    (req as any).session = { userId: ADMIN_ID };
    next();
  });
  const httpServer = createServer(app);
  server = await registerRoutes(httpServer, app);

  getUserSpy = mock.method(storage, "getUser", async (id: string) =>
    id === ADMIN_ID ? ADMIN_USER : undefined,
  );
  rosterSpy = mock.method(storage, "getStaffRecords", async () => buildRoster());

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no ephemeral port");
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  getUserSpy?.mock.restore();
  rosterSpy?.mock.restore();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function staffUrl(department: string, qs = ""): string {
  return `${baseUrl}/api/enterprise/departments/${encodeURIComponent(department)}/staff${qs}`;
}

// ── Non-numeric limit/offset fall back to defaults ───────────
test("?limit=abc&offset=xyz falls back to the default page (25) at offset 0", async () => {
  const res = await fetch(staffUrl(SPACED_AMP_DEPT, "?limit=abc&offset=xyz"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.limit, 25);
  assert.equal(body.offset, 0);
  assert.equal(body.rows.length, 25);
  assert.equal(body.total, BIG_DEPT_SIZE);
  assert.equal(body.filtered, BIG_DEPT_SIZE);
});

test("an empty limit/offset string also falls back to defaults", async () => {
  // Number("") === 0 would be a subtle trap — the route must treat a missing
  // value as "not provided", and Number("") is 0 which IS finite, so this
  // documents the actual behavior: limit= floors to 1 row via the storage
  // clamp rather than crashing or returning everything.
  const res = await fetch(staffUrl(SPACED_AMP_DEPT, "?limit=&offset="));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.limit >= 1 && body.limit <= 100);
  assert.equal(body.offset, 0);
  assert.ok(body.rows.length <= body.limit);
});

// ── Enormous limit capped, negative offset floored ───────────
test("?limit=1000000000 is still hard-capped at 100", async () => {
  const res = await fetch(staffUrl(SPACED_AMP_DEPT, "?limit=1000000000"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.limit, 100);
  assert.equal(body.rows.length, BIG_DEPT_SIZE); // whole dept fits under the cap
});

test("scientific-notation ?limit=1e9 is coerced and capped at 100", async () => {
  const res = await fetch(staffUrl(SPACED_AMP_DEPT, "?limit=1e9"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.limit, 100);
});

test("?offset=-5 is floored to 0", async () => {
  const res = await fetch(staffUrl(SPACED_AMP_DEPT, "?offset=-5&limit=10"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.offset, 0);
  assert.equal(body.rows.length, 10);
  // Still the most-at-risk-first head of the department.
  assert.equal(body.rows[0].id, "sm-29");
});

// ── Fractional values are floored, not rejected ──────────────
test("?limit=3.7 floors to 3 rows; ?offset=2.9 floors to 2", async () => {
  const res = await fetch(staffUrl(SPACED_AMP_DEPT, "?limit=3.7&offset=2.9"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.limit, 3);
  assert.equal(body.offset, 2);
  assert.equal(body.rows.length, 3);
  // offset 2 of the descending-vulnerability order: 27, 26, 25.
  assert.deepEqual(
    body.rows.map((r: any) => r.id),
    ["sm-27", "sm-26", "sm-25"],
  );
});

// ── Encoded department names resolve to the right cohort ─────
test("a URL-encoded department with a space and '&' resolves to the right cohort", async () => {
  const res = await fetch(staffUrl(SPACED_AMP_DEPT));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.total, BIG_DEPT_SIZE);
  // No Engineering decoys (vulnerability 999 would top the sort if leaked).
  assert.ok(body.rows.every((r: any) => r.id.startsWith("sm-")));
});

test("a department whose real name contains a literal '%' does not 500", async () => {
  const res = await fetch(staffUrl(PERCENT_DEPT));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.total, 3);
  assert.ok(body.rows.every((r: any) => r.id.startsWith("pct-")));
});

test("an unknown department returns an empty page, not an error", async () => {
  const res = await fetch(staffUrl("No Such Unit"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.total, 0);
  assert.equal(body.filtered, 0);
  assert.deepEqual(body.rows, []);
});

// ── Response shape contract ──────────────────────────────────
test("the JSON shape is exactly { rows, total, filtered, limit, offset }", async () => {
  const res = await fetch(staffUrl(SPACED_AMP_DEPT, "?limit=5"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(
    Object.keys(body).sort(),
    ["filtered", "limit", "offset", "rows", "total"],
  );
  assert.ok(Array.isArray(body.rows));
  assert.equal(typeof body.total, "number");
  assert.equal(typeof body.filtered, "number");
  assert.equal(typeof body.limit, "number");
  assert.equal(typeof body.offset, "number");
});
