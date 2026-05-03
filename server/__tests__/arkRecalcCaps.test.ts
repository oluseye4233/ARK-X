/**
 * Integration tests for recalcArkForUser cap enforcement.
 *
 * Hits a live PostgreSQL DB (via DATABASE_URL). Each test creates an isolated
 * user with deterministic inputs (pillarOverride + assessment) so the raw
 * delta is large and predictable, then asserts the persisted history row's
 * `delta` is clamped by the relevant FLYWHEEL_CAPS rule.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import {
  users, assessments, arkScoreHistory, ccmiPillarScores, lhcsSignals,
  FLYWHEEL_CAPS,
} from "@shared/schema";
import { storage } from "../storage";
import { recalcArkForUser } from "../arkRecalc";

const createdUserIds: string[] = [];

// PDD §3.4 caps are STRICT ceilings. After proportional JST/CCMI scaling,
// the engine hard-clamps any rounding overshoot off the CCMI component so
// the persisted delta is guaranteed ≤ the nominal cap (and may be 1-2
// points BELOW it when the round-down lands short — that's fine, under-cap
// is permitted). Tests assert (a) delta never exceeds the cap and (b)
// delta is within 2 points of the cap (so rounding can't silently zero it).
function assertCapStrict(actual: number, cap: number, msg?: string) {
  assert.ok(
    actual <= cap,
    msg ?? `cap exceeded: ${actual} > ${cap} (caps are STRICT ceilings per PDD §3.4)`,
  );
  assert.ok(
    actual >= cap - 2,
    `cap under-shot by more than 2: ${actual} < ${cap - 2} (suggests rounding regression)`,
  );
}

async function makeUser(prefix: string): Promise<string> {
  const username = `caps-test-${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const u = await storage.createUser({
    username,
    password: "x",
    name: "Caps Test",
    role: null,
    department: null,
    seniority: null,
    location: null,
    contextCraftCertLevel: "NONE",
  });
  createdUserIds.push(u.id);
  return u.id;
}

async function seedHighScoreInputs(userId: string) {
  // Assessment with maxed JST sub-scores → JST = 300.
  await storage.createAssessment({
    userId,
    jstTotal: 300,
    jstJobs: 100,
    jstSkills: 100,
    jstTalent: 100,
    vulnerabilityLevel: 4,
    readinessProfile: "Architect",
    archetypeArchitect: 60,
    archetypeOrchestrator: 25,
    archetypeConductor: 15,
  });
}

// Bumps the createdAt of the most-recent history row backward so it doesn't
// fall outside (or inside) a cap window we want to control. We use this to
// pre-seed "used" cap budget without waiting real wall-clock time.
async function setLatestHistoryAge(userId: string, ageMs: number) {
  await db.execute(sql`
    UPDATE ${arkScoreHistory}
    SET created_at = NOW() - (${ageMs}::bigint || ' milliseconds')::interval
    WHERE id = (
      SELECT id FROM ${arkScoreHistory}
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 1
    )
  `);
}

before(async () => {
  // Sanity — ensure DB is reachable.
  await db.execute(sql`SELECT 1`);
});

after(async () => {
  for (const id of createdUserIds) {
    try { await storage.deleteUserCascade(id); } catch { /* best-effort */ }
  }
});

// ─────────────────────────────────────────────────────────────
// CCGE daily cap (+15 / 24h)
// ─────────────────────────────────────────────────────────────
test("recalcArkForUser: ccge.session daily cap clamps delta to FLYWHEEL_CAPS.CCGE_PER_DAY", async () => {
  const userId = await makeUser("ccge-fresh");
  await seedHighScoreInputs(userId);

  const pillarOverride = { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100, P6: 100, P7: 100 };
  const result = await recalcArkForUser({
    userId,
    trigger: "ccge.session",
    pillarOverride,
  });

  // Raw composed score is 600; previous user.arkScore default is 0 → rawDelta=600.
  // With no prior ccge.session rows in the 24h window, the daily cap fires.
  assert.equal(result.rawDelta, 600);
  assertCapStrict(result.cappedDelta, FLYWHEEL_CAPS.CCGE_PER_DAY);
  assert.ok(result.cappedDelta < result.rawDelta, "cap must shrink raw delta");
  assert.match(result.capReason!, /Daily CCGE cap/);

  // Persisted history row delta must equal the applied delta.
  const hist = await storage.getArkScoreHistory(userId, 1);
  const last = hist[hist.length - 1];
  assert.equal(last.delta, result.cappedDelta);
});

test("recalcArkForUser: ccge.session subsequent calls within 24h consume remaining budget then clamp to 0", async () => {
  const userId = await makeUser("ccge-window");
  await seedHighScoreInputs(userId);

  // Pre-seed the 24h window with a prior ccge.session row that consumed 10/15.
  await db.insert(arkScoreHistory).values({
    userId,
    arkScore: 10, jstIndex: 5, ccmi: 5,
    delta: 10,
    trigger: "ccge.session",
    triggerMeta: {},
  });

  const pillarOverride = { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100, P6: 100, P7: 100 };
  const r1 = await recalcArkForUser({
    userId,
    trigger: "ccge.session",
    pillarOverride,
  });
  // 5 budget remaining (15 cap - 10 used). Allow ±2 rounding tolerance.
  assertCapStrict(r1.cappedDelta, 5);
  assert.match(r1.capReason!, /Daily CCGE cap/);

  // Another call → 0 budget left → clamped to 0.
  const r2 = await recalcArkForUser({
    userId,
    trigger: "ccge.session",
    pillarOverride,
  });
  assert.equal(r2.cappedDelta, 0, "cap fully consumed → 0 awarded");
});

test("recalcArkForUser: ccge.session prior usage older than 24h does NOT consume budget", async () => {
  const userId = await makeUser("ccge-old");
  await seedHighScoreInputs(userId);

  // Insert a prior ccge.session row, then age it past the 24h window.
  await db.insert(arkScoreHistory).values({
    userId,
    arkScore: 15, jstIndex: 8, ccmi: 7,
    delta: 15,
    trigger: "ccge.session",
    triggerMeta: {},
  });
  await setLatestHistoryAge(userId, 25 * 60 * 60 * 1000); // 25 hours ago

  const pillarOverride = { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100, P6: 100, P7: 100 };
  const r = await recalcArkForUser({
    userId,
    trigger: "ccge.session",
    pillarOverride,
  });
  assertCapStrict(r.cappedDelta, FLYWHEEL_CAPS.CCGE_PER_DAY);
  assert.match(r.capReason!, /Daily CCGE cap/);
});

// ─────────────────────────────────────────────────────────────
// SPHINX 30-day cap (+20 / 30d)
// ─────────────────────────────────────────────────────────────
test("recalcArkForUser: spc.published 30-day cap clamps delta to FLYWHEEL_CAPS.SPHINX_PER_30D", async () => {
  const userId = await makeUser("sphinx-fresh");
  await seedHighScoreInputs(userId);

  const pillarOverride = { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100, P6: 100, P7: 100 };
  const r = await recalcArkForUser({
    userId,
    trigger: "spc.published",
    pillarOverride,
  });

  assert.equal(r.rawDelta, 600);
  assert.equal(r.cappedDelta, FLYWHEEL_CAPS.SPHINX_PER_30D);
  assert.match(r.capReason!, /30-day SPHINX cap/);

  const hist = await storage.getArkScoreHistory(userId, 1);
  const last = hist[hist.length - 1];
  assert.equal(last.delta, FLYWHEEL_CAPS.SPHINX_PER_30D);
});

test("recalcArkForUser: spc.sold consumes the same 30-day SPHINX budget as spc.published", async () => {
  const userId = await makeUser("sphinx-shared");
  await seedHighScoreInputs(userId);

  // Pre-seed creator-side spc.published row that already consumed 18/20.
  await db.insert(arkScoreHistory).values({
    userId,
    arkScore: 18, jstIndex: 9, ccmi: 9,
    delta: 18,
    trigger: "spc.published",
    triggerMeta: {},
  });

  const pillarOverride = { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100, P6: 100, P7: 100 };
  const r = await recalcArkForUser({
    userId,
    trigger: "spc.sold",
    pillarOverride,
  });
  // 20 cap - 18 used = 2 remaining.
  assert.equal(r.cappedDelta, 2, "spc.sold must respect cap budget already used by spc.published");
  assert.match(r.capReason!, /30-day SPHINX cap/);
});

test("recalcArkForUser: buyer-side spc.purchased rows do NOT consume seller's SPHINX budget", async () => {
  const userId = await makeUser("sphinx-buyer");
  await seedHighScoreInputs(userId);

  // Buyer-side purchase: triggerMeta.payload.asRole is NOT "creator".
  // Per applyCaps' isCreatorSphinxRow filter, this row must be ignored
  // when computing remaining 30-day SPHINX budget for a creator action.
  await db.insert(arkScoreHistory).values({
    userId,
    arkScore: 20, jstIndex: 10, ccmi: 10,
    delta: 20, // Would otherwise fully consume the cap
    trigger: "spc.purchased",
    triggerMeta: { payload: { asRole: "buyer" } },
  });

  const pillarOverride = { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100, P6: 100, P7: 100 };
  const r = await recalcArkForUser({
    userId,
    trigger: "spc.published",
    pillarOverride,
  });
  // Buyer row excluded → full +20 cap budget still available.
  assert.equal(r.cappedDelta, FLYWHEEL_CAPS.SPHINX_PER_30D);
});

// ─────────────────────────────────────────────────────────────
// Sync-trigger guard — manual.recompute / backfill never award positive ARK
// ─────────────────────────────────────────────────────────────
test("recalcArkForUser: manual.recompute always clamps positive delta to 0", async () => {
  const userId = await makeUser("sync-manual");
  await seedHighScoreInputs(userId);

  const pillarOverride = { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100, P6: 100, P7: 100 };
  const r = await recalcArkForUser({
    userId,
    trigger: "manual.recompute",
    pillarOverride,
  });
  assert.ok(r.rawDelta > 0, "raw delta must be positive for the test to be meaningful");
  assert.equal(r.cappedDelta, 0);
  assert.match(r.capReason!, /Sync recompute/);
});

test("recalcArkForUser: backfill trigger always clamps positive delta to 0", async () => {
  const userId = await makeUser("sync-backfill");
  await seedHighScoreInputs(userId);

  const pillarOverride = { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100, P6: 100, P7: 100 };
  const r = await recalcArkForUser({
    userId,
    trigger: "backfill",
    pillarOverride,
  });
  assert.equal(r.cappedDelta, 0);
  assert.match(r.capReason!, /Sync recompute/);
});

// ─────────────────────────────────────────────────────────────
// bypassCaps escape hatch (assessment.completed pathway)
// ─────────────────────────────────────────────────────────────
test("recalcArkForUser: bypassCaps=true awards the full raw delta (assessment pathway)", async () => {
  const userId = await makeUser("bypass");
  await seedHighScoreInputs(userId);

  const pillarOverride = { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100, P6: 100, P7: 100 };
  const r = await recalcArkForUser({
    userId,
    trigger: "assessment.completed",
    pillarOverride,
    bypassCaps: true,
  });
  assert.equal(r.rawDelta, 600);
  assert.equal(r.cappedDelta, 600);
  assert.equal(r.snapshot.arkScore, 600);
  assert.equal(r.capReason, null);
});

// ─────────────────────────────────────────────────────────────
// PDD invariant after caps clamp the delta
// ─────────────────────────────────────────────────────────────
test("recalcArkForUser: ARK = JST + CCMI invariant holds after cap-driven scaling", async () => {
  const userId = await makeUser("invariant");
  await seedHighScoreInputs(userId);

  const pillarOverride = { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100, P6: 100, P7: 100 };
  const r = await recalcArkForUser({
    userId,
    trigger: "ccge.session",
    pillarOverride,
  });
  assert.equal(r.snapshot.arkScore, r.snapshot.jstIndex + r.snapshot.ccmi);
  // Persisted user row must also satisfy the invariant.
  const u = await storage.getUser(userId);
  assert.ok(u);
  assert.equal(u!.arkScore, u!.jstIndex + u!.ccmi);
});
