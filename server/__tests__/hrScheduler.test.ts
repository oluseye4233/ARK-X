import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { HrConnectorAdapter } from "../hrConnectors/types";
import type { HrConnectorParseResult } from "@shared/schema";
import { registerHrConnector } from "../hrConnectors";
import { runConnectorSync } from "../hrConnectors/sync";
import { isDue, syncConfigNow, tick, startHrScheduler, stopHrScheduler, TICK_MS } from "../hrScheduler";
import { getResolvedFeatures } from "../featureFlags";
import { storage } from "../storage";

// ─────────────────────────────────────────────────────────────
// Scheduled HR-roster sync — Task #47.
//
// The background scheduler (server/hrScheduler.ts) refreshes per-institution
// rosters unattended in production. These tests pin down the three moving
// parts the manual verification covered:
//   • isDue            — cadence / "is this config due?" logic
//   • runConnectorSync — the shared runner's success/skip/error outcomes
//   • syncConfigNow    — recording each outcome onto the config row
// They never touch a real DB or HR API: adapters are fakes registered into the
// shared registry and the storage layer is mocked per test.
// ─────────────────────────────────────────────────────────────

const MIN = 60_000;

// ─────────────────────────────────────────────────────────────
// isDue — cadence logic
// ─────────────────────────────────────────────────────────────
test("isDue: never-synced config (lastSyncedAt = null) is due immediately", () => {
  assert.equal(isDue({ lastSyncedAt: null, intervalMinutes: 60 }, Date.now()), true);
});

test("isDue: recently-synced config (elapsed < interval) is NOT due", () => {
  const now = Date.now();
  // synced 10 minutes ago, interval 60 → not due
  const lastSyncedAt = new Date(now - 10 * MIN);
  assert.equal(isDue({ lastSyncedAt, intervalMinutes: 60 }, now), false);
});

test("isDue: elapsed interval (elapsed > interval) is due", () => {
  const now = Date.now();
  // synced 90 minutes ago, interval 60 → due
  const lastSyncedAt = new Date(now - 90 * MIN);
  assert.equal(isDue({ lastSyncedAt, intervalMinutes: 60 }, now), true);
});

test("isDue: boundary — elapsed exactly equals interval is due (>=)", () => {
  const now = Date.now();
  const lastSyncedAt = new Date(now - 60 * MIN); // exactly 60 min ago
  assert.equal(isDue({ lastSyncedAt, intervalMinutes: 60 }, now), true);
  // one millisecond short of the interval → not yet due
  const lastSyncedAtShort = new Date(now - 60 * MIN + 1);
  assert.equal(isDue({ lastSyncedAt: lastSyncedAtShort, intervalMinutes: 60 }, now), false);
});

// ─────────────────────────────────────────────────────────────
// runConnectorSync — outcome mapping
// ─────────────────────────────────────────────────────────────
const okRecords = [
  { externalId: "1", fullName: "Alice", email: "alice@x.io" },
  { externalId: "2", fullName: "Bob", email: "bob@x.io" },
] as any;

function okParseResult(): HrConnectorParseResult {
  return {
    adapter: "sched_ok" as any,
    columnMapping: { Name: "fullName" },
    unmappedColumns: [],
    records: okRecords,
    errors: [{ rowNumber: 3, message: "bad row" }],
    totalRows: 3,
  } as any;
}

const okSyncAdapter = {
  key: "sched_ok",
  label: "Scheduler OK",
  acceptsFile: false,
  async fetchRecords() {
    return okParseResult();
  },
} as unknown as HrConnectorAdapter;

const emptySyncAdapter = {
  key: "sched_empty",
  label: "Scheduler Empty",
  acceptsFile: false,
  async fetchRecords() {
    return {
      adapter: "sched_empty",
      columnMapping: {},
      unmappedColumns: [],
      records: [],
      errors: [],
      totalRows: 0,
    } as any;
  },
} as unknown as HrConnectorAdapter;

const unconfiguredSyncAdapter = {
  key: "sched_unconfigured",
  label: "Scheduler Unconfigured",
  acceptsFile: false,
  requiredSecrets: ["SCHED_API_KEY"],
  isConfigured() {
    return false;
  },
  async fetchRecords() {
    throw new Error("must never run — unconfigured");
  },
} as unknown as HrConnectorAdapter;

const throwSyncAdapter = {
  key: "sched_throw",
  label: "Scheduler Throws",
  acceptsFile: false,
  async fetchRecords(): Promise<never> {
    throw new Error("Gusto auth failed: 401");
  },
} as unknown as HrConnectorAdapter;

const fileOnlySyncAdapter = {
  key: "sched_file_only",
  label: "Scheduler File Only",
  acceptsFile: true,
  parse() {
    return { adapter: "sched_file_only", columnMapping: {}, unmappedColumns: [], records: [], errors: [], totalRows: 0 } as any;
  },
} as unknown as HrConnectorAdapter;

registerHrConnector(okSyncAdapter);
registerHrConnector(emptySyncAdapter);
registerHrConnector(unconfiguredSyncAdapter);
registerHrConnector(throwSyncAdapter);
registerHrConnector(fileOnlySyncAdapter);

/** Mock the storage writes runConnectorSync performs on the success path so it
 *  never touches a DB. Returns the spies + a restore() helper. */
function mockSyncStorage(opts?: { inserted?: number; updated?: number; linked?: number }) {
  const upserted = { inserted: opts?.inserted ?? 2, updated: opts?.updated ?? 0, linked: opts?.linked ?? 0 };
  const createSpy = mock.method(storage, "createImportBatch", async (batch: any) => ({
    id: "batch-test-1",
    ...batch,
  }));
  const upsertSpy = mock.method(storage, "upsertStaffRecords", async () => upserted);
  const countsSpy = mock.method(storage, "updateImportBatchCounts", async () => undefined);
  return {
    createSpy,
    upsertSpy,
    countsSpy,
    restore() {
      createSpy.mock.restore();
      upsertSpy.mock.restore();
      countsSpy.mock.restore();
    },
  };
}

test("runConnectorSync: success → ok, records upserted + import batch recorded", async () => {
  const m = mockSyncStorage({ inserted: 2, updated: 0 });
  try {
    const result = await runConnectorSync({
      institution: "Acme U",
      adapterKey: "sched_ok",
      importedBy: "system:hr-scheduler",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.batchId, "batch-test-1");
    assert.equal(result.summary.inserted, 2);
    assert.equal(result.summary.updated, 0);
    assert.equal(result.summary.totalRows, 3);
    assert.equal(result.summary.errorRows, 1);
    // exactly one batch created and counts updated once
    assert.equal(m.createSpy.mock.callCount(), 1);
    assert.equal(m.upsertSpy.mock.callCount(), 1);
    assert.equal(m.countsSpy.mock.callCount(), 1);
    // the batch records the scheduler as the actor
    assert.equal(m.createSpy.mock.calls[0].arguments[0].importedBy, "system:hr-scheduler");
    assert.equal(m.createSpy.mock.calls[0].arguments[0].institution, "Acme U");
  } finally {
    m.restore();
  }
});

test("runConnectorSync: empty roster → no_records, NO batch created", async () => {
  const m = mockSyncStorage();
  try {
    const result = await runConnectorSync({
      institution: "Acme U",
      adapterKey: "sched_empty",
      importedBy: "system:hr-scheduler",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "no_records");
    assert.equal(m.createSpy.mock.callCount(), 0, "empty roster must not create a batch");
    assert.equal(m.upsertSpy.mock.callCount(), 0);
  } finally {
    m.restore();
  }
});

test("runConnectorSync: unconfigured adapter → not_configured (lists missing secrets)", async () => {
  const m = mockSyncStorage();
  try {
    const result = await runConnectorSync({
      institution: "Acme U",
      adapterKey: "sched_unconfigured",
      importedBy: "system:hr-scheduler",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "not_configured");
    assert.match(result.message, /SCHED_API_KEY/);
    assert.equal(m.createSpy.mock.callCount(), 0);
  } finally {
    m.restore();
  }
});

test("runConnectorSync: adapter fetch throw → fetch_failed surfacing the message", async () => {
  const m = mockSyncStorage();
  try {
    const result = await runConnectorSync({
      institution: "Acme U",
      adapterKey: "sched_throw",
      importedBy: "system:hr-scheduler",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "fetch_failed");
    assert.equal(result.message, "Gusto auth failed: 401");
    assert.equal(m.createSpy.mock.callCount(), 0);
  } finally {
    m.restore();
  }
});

test("runConnectorSync: unknown adapter → unknown_adapter", async () => {
  const result = await runConnectorSync({
    institution: "Acme U",
    adapterKey: "does_not_exist",
    importedBy: "system:hr-scheduler",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "unknown_adapter");
});

test("runConnectorSync: file-only adapter (no fetchRecords) → not_api", async () => {
  const result = await runConnectorSync({
    institution: "Acme U",
    adapterKey: "sched_file_only",
    importedBy: "system:hr-scheduler",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "not_api");
});

// ─────────────────────────────────────────────────────────────
// syncConfigNow — records outcome onto the config row
// ─────────────────────────────────────────────────────────────
/** Mock recordConnectorSyncResult to capture the status it persists. The real
 *  storage method advances lastSyncedAt; here we just verify syncConfigNow
 *  delegates to it with the right (id, status, message, summary). */
function mockRecord() {
  const spy = mock.method(storage, "recordConnectorSyncResult", async () => undefined);
  return spy;
}

test("syncConfigNow: success records status 'success' with a summary onto the config", async () => {
  const m = mockSyncStorage({ inserted: 2, updated: 0 });
  const recordSpy = mockRecord();
  try {
    await syncConfigNow({ id: "cfg-success", institution: "Acme U", adapter: "sched_ok" });
    assert.equal(recordSpy.mock.callCount(), 1);
    const [id, payload] = recordSpy.mock.calls[0].arguments as [string, any];
    assert.equal(id, "cfg-success");
    assert.equal(payload.status, "success");
    assert.deepEqual(payload.summary, { inserted: 2, updated: 0, totalRows: 3, errorRows: 1 });
  } finally {
    recordSpy.mock.restore();
    m.restore();
  }
});

test("syncConfigNow: empty roster records status 'skipped' (benign, not an error)", async () => {
  const m = mockSyncStorage();
  const recordSpy = mockRecord();
  try {
    await syncConfigNow({ id: "cfg-skipped", institution: "Acme U", adapter: "sched_empty" });
    assert.equal(recordSpy.mock.callCount(), 1);
    const [id, payload] = recordSpy.mock.calls[0].arguments as [string, any];
    assert.equal(id, "cfg-skipped");
    assert.equal(payload.status, "skipped");
    assert.equal(payload.summary, null);
  } finally {
    recordSpy.mock.restore();
    m.restore();
  }
});

test("syncConfigNow: adapter failure records status 'error' and never throws", async () => {
  const m = mockSyncStorage();
  const recordSpy = mockRecord();
  const errSpy = mock.method(console, "error", () => {});
  try {
    // must not throw — failure is captured as the config's last-sync status
    await syncConfigNow({ id: "cfg-error", institution: "Acme U", adapter: "sched_throw" });
    assert.equal(recordSpy.mock.callCount(), 1);
    const [id, payload] = recordSpy.mock.calls[0].arguments as [string, any];
    assert.equal(id, "cfg-error");
    assert.equal(payload.status, "error");
    assert.match(payload.message, /Gusto auth failed/);
    assert.equal(payload.summary, null);
  } finally {
    errSpy.mock.restore();
    recordSpy.mock.restore();
    m.restore();
  }
});

test("syncConfigNow: unexpected storage error is swallowed and recorded as 'error'", async () => {
  const m = mockSyncStorage();
  const errSpy = mock.method(console, "error", () => {});
  // First record call (success branch) throws; the defensive catch then records
  // an 'error' status. Track which payloads were attempted.
  const seen: any[] = [];
  let call = 0;
  const recordSpy = mock.method(storage, "recordConnectorSyncResult", async (_id: string, payload: any) => {
    call += 1;
    seen.push(payload);
    if (call === 1) throw new Error("DB write failed");
    return undefined as any;
  });
  try {
    await syncConfigNow({ id: "cfg-defensive", institution: "Acme U", adapter: "sched_ok" });
    // first attempt was the success record (threw); second is the defensive error record
    assert.equal(recordSpy.mock.callCount(), 2);
    assert.equal(seen[0].status, "success");
    assert.equal(seen[1].status, "error");
    assert.match(seen[1].message, /DB write failed/);
  } finally {
    errSpy.mock.restore();
    recordSpy.mock.restore();
    m.restore();
  }
});

test("syncConfigNow: per-config in-flight guard prevents an overlapping double-run", async () => {
  const m = mockSyncStorage();
  const recordSpy = mockRecord();
  // Slow adapter so the second call arrives while the first is still in flight.
  let resolveFetch: (v: HrConnectorParseResult) => void = () => {};
  const slowAdapter = {
    key: "sched_slow",
    label: "Scheduler Slow",
    acceptsFile: false,
    fetchRecords() {
      return new Promise<HrConnectorParseResult>((res) => {
        resolveFetch = res;
      });
    },
  } as unknown as HrConnectorAdapter;
  registerHrConnector(slowAdapter);
  try {
    const first = syncConfigNow({ id: "cfg-inflight", institution: "Acme U", adapter: "sched_slow" });
    // second call for the SAME id while first is mid-flight → immediate no-op
    const second = syncConfigNow({ id: "cfg-inflight", institution: "Acme U", adapter: "sched_slow" });
    await second; // returns right away
    assert.equal(recordSpy.mock.callCount(), 0, "second call must not record anything");
    resolveFetch(okParseResult());
    await first;
    assert.equal(recordSpy.mock.callCount(), 1, "only the first call records a result");
  } finally {
    recordSpy.mock.restore();
    m.restore();
  }
});

// ─────────────────────────────────────────────────────────────
// tick — the scheduler's selection loop (Task #49)
//
// tick() decides WHICH enabled configs get synced each pass. It must:
//   • sync enabled, configured, API-capable, due configs
//   • skip file-only adapters (no fetchRecords)
//   • skip adapters reporting isConfigured() === false
//   • skip configs that aren't due yet
//   • never run two passes concurrently (the module-level `ticking` guard)
// We drive it with fake adapters in the shared registry + a mocked
// storage.getEnabledConnectorConfigs — no real DB or HR API.
// ─────────────────────────────────────────────────────────────

test("tick: syncs only enabled, configured, API-capable, due configs and skips the rest", async () => {
  const now = Date.now();
  const configs = [
    // due (never synced) + API + configured → SHOULD sync
    { id: "cfg-due", institution: "Acme U", adapter: "sched_ok", lastSyncedAt: null, intervalMinutes: 60 },
    // API + configured but synced 10m ago, interval 60 → NOT due, skip
    {
      id: "cfg-not-due",
      institution: "Acme U",
      adapter: "sched_ok",
      lastSyncedAt: new Date(now - 10 * MIN),
      intervalMinutes: 60,
    },
    // file-only adapter has no fetchRecords → skip
    { id: "cfg-file-only", institution: "Acme U", adapter: "sched_file_only", lastSyncedAt: null, intervalMinutes: 60 },
    // adapter reports isConfigured() === false → skip
    {
      id: "cfg-unconfigured",
      institution: "Acme U",
      adapter: "sched_unconfigured",
      lastSyncedAt: null,
      intervalMinutes: 60,
    },
    // unknown adapter (getHrConnector → undefined) → skip
    { id: "cfg-unknown", institution: "Acme U", adapter: "does_not_exist", lastSyncedAt: null, intervalMinutes: 60 },
  ];
  const getSpy = mock.method(storage, "getEnabledConnectorConfigs", async () => configs as any);
  const m = mockSyncStorage();
  const recordSpy = mockRecord();
  try {
    await tick();
    // exactly one config synced: only cfg-due met every gate
    assert.equal(recordSpy.mock.callCount(), 1, "only the due, configured, API-capable config should sync");
    assert.equal(recordSpy.mock.calls[0].arguments[0], "cfg-due");
    const payload = recordSpy.mock.calls[0].arguments[1] as any;
    assert.equal(payload.status, "success");
  } finally {
    recordSpy.mock.restore();
    m.restore();
    getSpy.mock.restore();
  }
});

test("tick: a no-config pass is a clean no-op (nothing synced)", async () => {
  const getSpy = mock.method(storage, "getEnabledConnectorConfigs", async () => [] as any);
  const recordSpy = mockRecord();
  try {
    await tick();
    assert.equal(getSpy.mock.callCount(), 1);
    assert.equal(recordSpy.mock.callCount(), 0);
  } finally {
    recordSpy.mock.restore();
    getSpy.mock.restore();
  }
});

test("tick: overlapping-tick guard makes a second concurrent tick a no-op", async () => {
  // Gate getEnabledConnectorConfigs so the first tick is still mid-flight (and
  // has already flipped `ticking` true) when the second tick is invoked.
  let releaseConfigs: () => void = () => {};
  const gate = new Promise<void>((res) => {
    releaseConfigs = res;
  });
  const getSpy = mock.method(storage, "getEnabledConnectorConfigs", async () => {
    await gate;
    return [] as any;
  });
  const recordSpy = mockRecord();
  try {
    const first = tick(); // runs to the first await, sets ticking = true
    const second = tick(); // sees ticking === true → immediate no-op
    await second;
    assert.equal(getSpy.mock.callCount(), 1, "second tick must not even reach storage");
    releaseConfigs();
    await first;
    assert.equal(getSpy.mock.callCount(), 1, "still only the first tick queried configs");
    assert.equal(recordSpy.mock.callCount(), 0);
  } finally {
    recordSpy.mock.restore();
    getSpy.mock.restore();
  }
});

test("tick: clears the `ticking` guard so a later pass can run again", async () => {
  // After the previous tests, ticking must have been reset in `finally`. Run two
  // sequential passes; both should query storage (proving the guard released).
  const getSpy = mock.method(storage, "getEnabledConnectorConfigs", async () => [] as any);
  try {
    await tick();
    await tick();
    assert.equal(getSpy.mock.callCount(), 2, "sequential ticks should each query configs");
  } finally {
    getSpy.mock.restore();
  }
});

// ─────────────────────────────────────────────────────────────
// startHrScheduler / stopHrScheduler — the start/stop lifecycle (Task #50)
//
// These wire tick() to a real interval timer in production. The contract:
//   • NOT started when the `institutionWorkforce` feature flag is off
//   • NOT started when HR_SYNC_DISABLED=true (kill switch)
//   • a second start while already running is a no-op (no duplicate timer)
//   • stop clears the interval so a later start can succeed again
//
// We never let a timer actually fire: fake timers (no advance) keep both the
// recurring interval AND the one-shot 5s warm-up tick inert, so no real DB or
// HR API is touched. The `institutionWorkforce` flag is flipped on the live
// resolved-flags object (the same reference isFeatureEnabled reads), and the
// HR_SYNC_DISABLED env var is set/cleared per test — both restored in finally.
// ─────────────────────────────────────────────────────────────

const flags = getResolvedFeatures() as Record<string, boolean>;

/** Run `fn` with the workforce flag forced on/off and HR_SYNC_DISABLED set to a
 *  chosen value, with fake timers enabled. Restores all global state after. */
async function withSchedulerEnv(
  opts: { workforce: boolean; disabled?: boolean },
  fn: () => void | Promise<void>,
): Promise<void> {
  const origFlag = flags.institutionWorkforce;
  const origDisabled = process.env.HR_SYNC_DISABLED;
  flags.institutionWorkforce = opts.workforce;
  if (opts.disabled === undefined) delete process.env.HR_SYNC_DISABLED;
  else process.env.HR_SYNC_DISABLED = opts.disabled ? "true" : "false";
  mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  const logSpy = mock.method(console, "log", () => {});
  try {
    await fn();
  } finally {
    stopHrScheduler(); // ensure no timer leaks into the next test
    logSpy.mock.restore();
    mock.timers.reset();
    flags.institutionWorkforce = origFlag;
    if (origDisabled === undefined) delete process.env.HR_SYNC_DISABLED;
    else process.env.HR_SYNC_DISABLED = origDisabled;
  }
}

test("startHrScheduler: no-op (returns false) when institutionWorkforce flag is off", async () => {
  await withSchedulerEnv({ workforce: false }, () => {
    assert.equal(startHrScheduler(), false, "must not start when the feature is off");
    // A second call is still a no-op; nothing was ever scheduled to stop.
    assert.equal(startHrScheduler(), false);
  });
});

test("startHrScheduler: no-op (returns false) when HR_SYNC_DISABLED=true even with the flag on", async () => {
  await withSchedulerEnv({ workforce: true, disabled: true }, () => {
    assert.equal(startHrScheduler(), false, "kill switch must win over an enabled flag");
  });
});

test("startHrScheduler: starts (returns true) when the flag is on and not disabled", async () => {
  await withSchedulerEnv({ workforce: true, disabled: false }, () => {
    assert.equal(startHrScheduler(), true, "should start when enabled and not disabled");
  });
});

test("startHrScheduler: a second start while already running is a no-op (returns false)", async () => {
  await withSchedulerEnv({ workforce: true }, () => {
    assert.equal(startHrScheduler(), true, "first start succeeds");
    assert.equal(startHrScheduler(), false, "second start must not create a duplicate timer");
    assert.equal(startHrScheduler(), false, "still a no-op while running");
  });
});

test("stopHrScheduler: clears the timer so a later start succeeds again", async () => {
  await withSchedulerEnv({ workforce: true }, () => {
    assert.equal(startHrScheduler(), true, "first start succeeds");
    assert.equal(startHrScheduler(), false, "running → second start is a no-op");
    stopHrScheduler();
    // With the interval cleared, the next start is allowed to run again.
    assert.equal(startHrScheduler(), true, "start succeeds again after stop");
  });
});

test("stopHrScheduler: is safe to call when nothing is running", () => {
  // No timer set — must not throw, and a subsequent start (flag off here) still
  // returns false for the right reason rather than crashing.
  assert.doesNotThrow(() => stopHrScheduler());
  assert.doesNotThrow(() => stopHrScheduler());
});

test("stopHrScheduler: cancels the one-shot warm-up tick when stopped before it fires", async () => {
  // start() schedules a warm-up tick() ~5s after boot. Stopping inside that
  // window must cancel it, otherwise a fast start→stop still hits the sync
  // pipeline once. We prove no tick ran by spying getEnabledConnectorConfigs
  // (the first thing tick touches) and advancing fake time past the warm-up.
  const getSpy = mock.method(storage, "getEnabledConnectorConfigs", async () => [] as any);
  try {
    await withSchedulerEnv({ workforce: true, disabled: false }, () => {
      assert.equal(startHrScheduler(), true, "scheduler should start");
      stopHrScheduler(); // stop immediately, inside the warm-up window
      // Advance well past both the 5s warm-up and a full recurring interval.
      mock.timers.tick(120_000);
      assert.equal(getSpy.mock.callCount(), 0, "no tick() should fire after an immediate stop");
    });
  } finally {
    getSpy.mock.restore();
  }
});

// ─────────────────────────────────────────────────────────────
// Interval wiring — proves the setInterval(tick, TICK_MS) plumbing (Task #52)
//
// The lifecycle tests above never let a timer fire. These advance fake time and
// prove the recurring interval actually drives tick(): each call reaches
// storage.getEnabledConnectorConfigs (the first thing tick() does), so its spy
// count is a faithful tally of how many times tick() ran. Configs resolve to []
// so each tick is a clean no-op that touches no DB or HR API.
// ─────────────────────────────────────────────────────────────

/** Drain the microtask queue so an awaited tick() settles (and clears the
 *  `ticking` guard) before we advance fake time again. */
async function flushMicrotasks() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

test("startHrScheduler: the recurring interval invokes tick() once per elapsed TICK_MS", async () => {
  await withSchedulerEnv({ workforce: true }, async () => {
    const getSpy = mock.method(storage, "getEnabledConnectorConfigs", async () => [] as any);
    try {
      assert.equal(startHrScheduler(), true, "scheduler should start");

      // Consume the one-shot ~5s warm-up tick first so we count only the
      // recurring interval afterwards (warm-up fires before the first interval).
      mock.timers.tick(5_000);
      await flushMicrotasks();
      const afterWarmup = getSpy.mock.callCount();
      assert.equal(afterWarmup, 1, "warm-up pass should run ~5s after start");

      // Advancing one TICK_MS at a time must fire exactly one more tick each
      // time. (Advancing several intervals in a single jump would collapse into
      // one tick via the in-flight `ticking` guard, so we step + flush.)
      for (let i = 1; i <= 3; i++) {
        mock.timers.tick(TICK_MS);
        await flushMicrotasks();
        assert.equal(
          getSpy.mock.callCount(),
          afterWarmup + i,
          `interval should have driven tick() ${i} time(s)`,
        );
      }
    } finally {
      getSpy.mock.restore();
    }
  });
});

test("stopHrScheduler: after stop, advancing time fires no further ticks", async () => {
  await withSchedulerEnv({ workforce: true }, async () => {
    const getSpy = mock.method(storage, "getEnabledConnectorConfigs", async () => [] as any);
    try {
      assert.equal(startHrScheduler(), true, "scheduler should start");

      // Let the warm-up and one interval fire so the timer is demonstrably live.
      mock.timers.tick(5_000);
      await flushMicrotasks();
      mock.timers.tick(TICK_MS);
      await flushMicrotasks();
      const before = getSpy.mock.callCount();
      assert.ok(before >= 1, "at least one tick should have fired before stop");

      stopHrScheduler();

      // Advance well past several intervals — the cleared interval must be dead.
      mock.timers.tick(TICK_MS * 5);
      await flushMicrotasks();
      assert.equal(getSpy.mock.callCount(), before, "no ticks may fire after stop");
    } finally {
      getSpy.mock.restore();
    }
  });
});
