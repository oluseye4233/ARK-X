import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { HrConnectorAdapter } from "../hrConnectors/types";
import type { HrConnectorParseResult } from "@shared/schema";
import { registerHrConnector } from "../hrConnectors";
import { runConnectorSync } from "../hrConnectors/sync";
import { isDue, syncConfigNow, tick } from "../hrScheduler";
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
