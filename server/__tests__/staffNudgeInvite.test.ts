/**
 * Cross-tenant safety + validity tests for the workforce drill-down's per-row
 * invite / nudge actions (Task #87).
 *
 * These lock in the access rules that keep one institution's staff data walled
 * off from another's, plus the "nudge is only valid for an assessed staff
 * member" rule. A future refactor that silently opened a cross-tenant hole (or
 * let an unassessed staff member be nudged) would fail here.
 *
 * The storage-level tests hit a live PostgreSQL DB (via DATABASE_URL) with two
 * isolated institutions. The admin-gate tests exercise the `requireInstitutionAdmin`
 * middleware both routes share, with `storage.getUser` mocked per case.
 */
import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { users, staffRecords } from "@shared/schema";
import { storage, UPSKILL_NUDGE_COOLDOWN_DAYS } from "../storage";
import { requireInstitutionAdmin } from "../auth";

// ─────────────────────────────────────────────────────────────
// Shared fixtures — two institutions, isolated by a per-run suffix so parallel
// or repeated runs never collide on the (institution, email) unique index.
// ─────────────────────────────────────────────────────────────
const SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const INST_A = `Inst-A-${SUFFIX}`;
const INST_B = `Inst-B-${SUFFIX}`;

const createdUserIds: string[] = [];
const createdStaffIds: string[] = [];

async function makeUser(email: string, arkScore: number): Promise<string> {
  const u = await storage.createUser({
    username: email,
    password: "x",
    name: "Staff Nudge Test",
    role: null,
    department: null,
    seniority: null,
    location: null,
    contextCraftCertLevel: "NONE",
  });
  createdUserIds.push(u.id);
  if (arkScore > 0) {
    await db
      .update(users)
      .set({ arkScore, jstIndex: 210, ccmi: 240, resumeReplacementPct: 72 })
      .where(eq(users.id, u.id));
  }
  return u.id;
}

async function makeStaff(opts: {
  institution: string;
  fullName: string;
  email: string | null;
  department: string;
  arkUserId?: string | null;
  invitedAt?: Date | null;
}): Promise<string> {
  const [row] = await db
    .insert(staffRecords)
    .values({
      institution: opts.institution,
      fullName: opts.fullName,
      email: opts.email,
      department: opts.department,
      arkUserId: opts.arkUserId ?? null,
      invitedAt: opts.invitedAt ?? null,
    })
    .returning({ id: staffRecords.id });
  createdStaffIds.push(row.id);
  return row.id;
}

before(async () => {
  await db.execute(sql`SELECT 1`);
});

after(async () => {
  for (const id of createdStaffIds) {
    try { await db.delete(staffRecords).where(eq(staffRecords.id, id)); } catch { /* best-effort */ }
  }
  for (const id of createdUserIds) {
    try { await storage.deleteUserCascade(id); } catch { /* best-effort */ }
  }
});

// ─────────────────────────────────────────────────────────────
// Cross-tenant isolation — a staff id from another institution must never be
// acted on when the caller's scope is a different institution.
// ─────────────────────────────────────────────────────────────
test("nudgeStaff: a staff id from institution B is rejected under institution A's scope", async () => {
  const assessed = await makeUser(`b-assessed-${SUFFIX}@x.test`, 500);
  // A fully-nudgeable staff member — linked to an ASSESSED account — but in B.
  const staffB = await makeStaff({
    institution: INST_B,
    fullName: "Bianca B",
    email: `bianca-${SUFFIX}@x.test`,
    department: "Engineering",
    arkUserId: assessed,
  });

  // Scoped to A → must NOT resolve the B staff member at all (null → route 404/422).
  const wrongScope = await storage.nudgeStaff(staffB, INST_A);
  assert.equal(wrongScope, null, "cross-tenant nudge must return null (out-of-scope staff never acted on)");

  // The row is untouched: no nudgedAt was written by the rejected call.
  const [after] = await db
    .select({ nudgedAt: staffRecords.nudgedAt })
    .from(staffRecords)
    .where(eq(staffRecords.id, staffB));
  assert.equal(after.nudgedAt, null, "rejected cross-tenant nudge must not write nudgedAt");

  // Correct scope still works — proving the null above was scope, not a broken record.
  const rightScope = await storage.nudgeStaff(staffB, INST_B);
  assert.ok(rightScope, "same-institution nudge on an assessed member succeeds");
  assert.equal(rightScope!.suppressed, false, "first nudge is not suppressed");
  assert.ok(rightScope!.staff.nudgedAt, "same-institution nudge stamps nudgedAt");
});

test("inviteStaff: a staff id from institution B is rejected under institution A's scope", async () => {
  const staffB = await makeStaff({
    institution: INST_B,
    fullName: "Bruno B",
    email: `bruno-${SUFFIX}@x.test`,
    department: "Sales",
  });

  const wrongScope = await storage.inviteStaff(staffB, INST_A);
  assert.equal(wrongScope, null, "cross-tenant invite must return null (out-of-scope staff never acted on)");

  const [after] = await db
    .select({ invitedAt: staffRecords.invitedAt })
    .from(staffRecords)
    .where(eq(staffRecords.id, staffB));
  assert.equal(after.invitedAt, null, "rejected cross-tenant invite must not write invitedAt");
});

// ─────────────────────────────────────────────────────────────
// Nudge validity — only an assessed (linked + arkScore>0) staff member can be
// nudged. Unlinked or linked-but-not-yet-assessed → null (route → 422).
// ─────────────────────────────────────────────────────────────
test("nudgeStaff: an unlinked (never-invited) staff member returns null (→ 422)", async () => {
  const staff = await makeStaff({
    institution: INST_A,
    fullName: "Una Unlinked",
    email: `una-${SUFFIX}@x.test`,
    department: "Engineering",
  });
  const result = await storage.nudgeStaff(staff, INST_A);
  assert.equal(result, null, "unlinked staff cannot be nudged");
});

test("nudgeStaff: a linked-but-pending (not-yet-assessed) staff member returns null (→ 422)", async () => {
  const pendingUser = await makeUser(`pending-${SUFFIX}@x.test`, 0); // arkScore stays 0
  const staff = await makeStaff({
    institution: INST_A,
    fullName: "Pia Pending",
    email: `pia-${SUFFIX}@x.test`,
    department: "Engineering",
    arkUserId: pendingUser,
  });
  const result = await storage.nudgeStaff(staff, INST_A);
  assert.equal(result, null, "pending (unassessed) staff cannot be nudged");

  const [after] = await db
    .select({ nudgedAt: staffRecords.nudgedAt })
    .from(staffRecords)
    .where(eq(staffRecords.id, staff));
  assert.equal(after.nudgedAt, null, "rejected nudge on a pending member must not write nudgedAt");
});

// ─────────────────────────────────────────────────────────────
// Cooldown — re-nudging inside the window is suppressed (no nudgedAt re-stamp,
// caller told to skip delivery); once the window passes, the nudge sends again.
// ─────────────────────────────────────────────────────────────
test("nudgeStaff: re-nudge within the cooldown window is suppressed and does not re-stamp nudgedAt", async () => {
  const assessed = await makeUser(`cool-assessed-${SUFFIX}@x.test`, 450);
  const staff = await makeStaff({
    institution: INST_A,
    fullName: "Cora Cooldown",
    email: `cora-${SUFFIX}@x.test`,
    department: "Engineering",
    arkUserId: assessed,
  });

  const first = await storage.nudgeStaff(staff, INST_A);
  assert.ok(first, "first nudge succeeds");
  assert.equal(first!.suppressed, false, "first nudge delivers");
  const firstStamp = first!.staff.nudgedAt;
  assert.ok(firstStamp, "first nudge stamps nudgedAt");

  const second = await storage.nudgeStaff(staff, INST_A);
  assert.ok(second, "re-nudge still resolves the staff member (not a 422)");
  assert.equal(second!.suppressed, true, "re-nudge within cooldown is suppressed");
  assert.equal(
    second!.lastNudgedAt,
    new Date(firstStamp as any).toISOString(),
    "suppressed result reports the ORIGINAL delivery time",
  );
  assert.ok(
    new Date(second!.nextNudgeAvailableAt).getTime() > Date.now(),
    "cooldown lift time is in the future",
  );

  // The DB row keeps the original stamp — the cooldown never slides forward.
  const [row] = await db
    .select({ nudgedAt: staffRecords.nudgedAt })
    .from(staffRecords)
    .where(eq(staffRecords.id, staff));
  assert.equal(
    row.nudgedAt!.toISOString(),
    new Date(firstStamp as any).toISOString(),
    "suppressed re-nudge must not re-stamp nudgedAt",
  );
});

test(`nudgeStaff: a nudge older than ${UPSKILL_NUDGE_COOLDOWN_DAYS} days re-sends (cooldown expired)`, async () => {
  const assessed = await makeUser(`stale-assessed-${SUFFIX}@x.test`, 450);
  const staff = await makeStaff({
    institution: INST_A,
    fullName: "Stan Stale",
    email: `stan-${SUFFIX}@x.test`,
    department: "Engineering",
    arkUserId: assessed,
  });

  // Backdate the last nudge to just past the cooldown window.
  const stale = new Date(Date.now() - (UPSKILL_NUDGE_COOLDOWN_DAYS * 24 + 1) * 60 * 60 * 1000);
  await db.update(staffRecords).set({ nudgedAt: stale }).where(eq(staffRecords.id, staff));

  const result = await storage.nudgeStaff(staff, INST_A);
  assert.ok(result, "expired-cooldown nudge resolves");
  assert.equal(result!.suppressed, false, "expired cooldown → nudge delivers again");
  assert.ok(
    new Date(result!.staff.nudgedAt as any).getTime() > stale.getTime(),
    "nudgedAt is re-stamped to the new delivery time",
  );
});

// ─────────────────────────────────────────────────────────────
// Invite flips an unlinked staff member to "invited".
// ─────────────────────────────────────────────────────────────
test("inviteStaff: an unlinked staff member (no ARK account) flips to invited", async () => {
  const staff = await makeStaff({
    institution: INST_A,
    fullName: "Ivan Invitee",
    email: `ivan-${SUFFIX}@x.test`, // no user with this username exists
    department: "Marketing",
  });

  const result = await storage.inviteStaff(staff, INST_A);
  assert.ok(result, "invite on an emailed staff member succeeds");
  assert.equal(result!.assessmentStatus, "invited", "no matching account → status becomes invited");
  assert.ok(result!.invitedAt, "invite stamps invitedAt");
  assert.equal(result!.arkUserId, null, "no account exists yet, so no link");

  const [after] = await db
    .select({ invitedAt: staffRecords.invitedAt })
    .from(staffRecords)
    .where(eq(staffRecords.id, staff));
  assert.ok(after.invitedAt, "invitedAt persisted");
});

// ─────────────────────────────────────────────────────────────
// The drill-down row reflects the action (status / nudgedAt).
// ─────────────────────────────────────────────────────────────
test("getDepartmentStaff: reflects a nudge (complete status + nudgedAt) and an invite (invited status)", async () => {
  const dept = `Drilldown-${SUFFIX}`;

  const assessed = await makeUser(`dd-assessed-${SUFFIX}@x.test`, 480);
  const nudgeStaffId = await makeStaff({
    institution: INST_A,
    fullName: "Nora Nudged",
    email: `nora-${SUFFIX}@x.test`,
    department: dept,
    arkUserId: assessed,
  });
  const inviteStaffId = await makeStaff({
    institution: INST_A,
    fullName: "Ingrid Invited",
    email: `ingrid-${SUFFIX}@x.test`,
    department: dept,
  });

  // Baseline: nudged member not yet nudged, invited member still unlinked.
  // getDepartmentStaff returns a paginated page — rows carry the drill-down.
  const before = await storage.getDepartmentStaff(INST_A, dept);
  const beforeNudge = before.rows.find((r) => r.id === nudgeStaffId);
  const beforeInvite = before.rows.find((r) => r.id === inviteStaffId);
  assert.ok(beforeNudge && beforeInvite, "both staff appear in the drill-down");
  assert.equal(beforeNudge!.nudgedAt, null, "not nudged yet");
  assert.equal(beforeNudge!.assessmentStatus, "complete", "assessed staff shows complete");
  assert.equal(beforeInvite!.assessmentStatus, "unlinked", "un-invited staff shows unlinked");

  // Act.
  await storage.nudgeStaff(nudgeStaffId, INST_A);
  await storage.inviteStaff(inviteStaffId, INST_A);

  // The drill-down row now reflects both actions.
  const after = await storage.getDepartmentStaff(INST_A, dept);
  const afterNudge = after.rows.find((r) => r.id === nudgeStaffId);
  const afterInvite = after.rows.find((r) => r.id === inviteStaffId);
  assert.ok(afterNudge!.nudgedAt, "drill-down row now carries nudgedAt");
  assert.equal(afterNudge!.assessmentStatus, "complete");
  assert.equal(afterInvite!.assessmentStatus, "invited", "drill-down row flips to invited");
});

// ─────────────────────────────────────────────────────────────
// Both routes share `requireInstitutionAdmin` — the single gate that scopes
// every workforce action to the caller's own institution. Assert it fails
// CLOSED and only lets a real institution admin through (with scope derived
// from the session, never the client).
// ─────────────────────────────────────────────────────────────
function fakeReqRes(sessionUserId?: string) {
  const req: any = { session: sessionUserId ? { userId: sessionUserId } : {} };
  const res: any = {
    statusCode: 0,
    body: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  return { req, res, next: next as any, wasNextCalled: () => nextCalled };
}

test("requireInstitutionAdmin: no session → 401 (fails closed)", async () => {
  const { req, res, next, wasNextCalled } = fakeReqRes(undefined);
  await requireInstitutionAdmin(req, res, next);
  assert.equal(res.statusCode, 401);
  assert.equal(wasNextCalled(), false);
});

test("requireInstitutionAdmin: non-ENTERPRISE plan → 403", async () => {
  const spy = mock.method(storage, "getUser", async () => ({
    id: "u1",
    subscriptionPlan: "INDIVIDUAL_FREE",
    institution: "Acme",
  }) as any);
  try {
    const { req, res, next, wasNextCalled } = fakeReqRes("u1");
    await requireInstitutionAdmin(req, res, next);
    assert.equal(res.statusCode, 403);
    assert.equal(wasNextCalled(), false);
    assert.equal(req.institutionScope, undefined);
  } finally {
    spy.mock.restore();
  }
});

test("requireInstitutionAdmin: ENTERPRISE but no institution → 403", async () => {
  const spy = mock.method(storage, "getUser", async () => ({
    id: "u1",
    subscriptionPlan: "ENTERPRISE",
    institution: "   ",
  }) as any);
  try {
    const { req, res, next, wasNextCalled } = fakeReqRes("u1");
    await requireInstitutionAdmin(req, res, next);
    assert.equal(res.statusCode, 403);
    assert.equal(wasNextCalled(), false);
    assert.equal(req.institutionScope, undefined);
  } finally {
    spy.mock.restore();
  }
});

test("requireInstitutionAdmin: ENTERPRISE admin → next() with session-derived scope", async () => {
  const spy = mock.method(storage, "getUser", async () => ({
    id: "u1",
    subscriptionPlan: "ENTERPRISE",
    institution: "Vance Industries",
  }) as any);
  try {
    const { req, res, next, wasNextCalled } = fakeReqRes("u1");
    await requireInstitutionAdmin(req, res, next);
    assert.equal(wasNextCalled(), true, "admin passes the gate");
    assert.equal(res.statusCode, 0, "no error status set");
    assert.equal(req.institutionScope, "Vance Industries", "scope derived from session user, never the client");
  } finally {
    spy.mock.restore();
  }
});
