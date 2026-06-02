import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { HrConnectorAdapter } from "../hrConnectors/types";
import { registerHrConnector } from "../hrConnectors";
import { runHrConnectionTest } from "../workforceConnectionTest";
import { storage } from "../storage";

// ─────────────────────────────────────────────────────────────
// HR "Test connection" endpoint core (POST /api/workforce/test-connection).
//
// The route is a thin wrapper: it derives the adapter key from the session-
// gated request body and delegates entirely to `runHrConnectionTest`. These
// tests pin down the read-only contract:
//   • success path returns record counts (totalRows / validRows / errorRows)
//   • unknown / file-only / unconfigured adapters → 400
//   • adapter fetch failure (auth/network) → 502
//   • a connection test NEVER creates an import batch or upserts staff records
// ─────────────────────────────────────────────────────────────

// Fake live API adapters registered into the shared registry. Keys are cast
// because they're test-only and not part of the canonical adapter union.
const fakeRecords = [
  { externalId: "1", fullName: "A" },
  { externalId: "2", fullName: "B" },
  { externalId: "3", fullName: "C" },
] as any;

const okAdapter = {
  key: "fake_ok",
  label: "Fake OK",
  acceptsFile: false,
  async fetchRecords() {
    return {
      adapter: "fake_ok",
      columnMapping: {},
      unmappedColumns: [],
      records: fakeRecords,
      errors: [{ rowNumber: 4, message: "bad row" }],
      totalRows: 5,
    };
  },
} as unknown as HrConnectorAdapter;

const throwAdapter = {
  key: "fake_throw",
  label: "Fake Throws",
  acceptsFile: false,
  async fetchRecords(): Promise<never> {
    throw new Error("BambooHR auth failed: 401 Unauthorized");
  },
} as unknown as HrConnectorAdapter;

const throwNoMessageAdapter = {
  key: "fake_throw_nomsg",
  label: "Fake Throws No Message",
  acceptsFile: false,
  async fetchRecords(): Promise<never> {
    throw "boom"; // non-Error rejection → no .message
  },
} as unknown as HrConnectorAdapter;

const unconfiguredAdapter = {
  key: "fake_unconfigured",
  label: "Fake Unconfigured",
  acceptsFile: false,
  requiredSecrets: ["FAKE_API_KEY", "FAKE_SUBDOMAIN"],
  isConfigured() {
    return false;
  },
  async fetchRecords() {
    throw new Error("must never be called — unconfigured");
  },
} as unknown as HrConnectorAdapter;

// File-only adapter (no fetchRecords) — like the real CSV adapter.
const fileOnlyAdapter = {
  key: "fake_file_only",
  label: "Fake File Only",
  acceptsFile: true,
  parse() {
    return {
      adapter: "fake_file_only",
      columnMapping: {},
      unmappedColumns: [],
      records: [],
      errors: [],
      totalRows: 0,
    } as any;
  },
} as unknown as HrConnectorAdapter;

registerHrConnector(okAdapter);
registerHrConnector(throwAdapter);
registerHrConnector(throwNoMessageAdapter);
registerHrConnector(unconfiguredAdapter);
registerHrConnector(fileOnlyAdapter);

// ── Success path ─────────────────────────────────────────────
test("success: returns 200 with record counts and never reports an error status", async () => {
  const { status, body } = await runHrConnectionTest("fake_ok");
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.adapter, "fake_ok");
  assert.equal(body.label, "Fake OK");
  // totalRows is the raw upstream count; validRows = normalized records;
  // errorRows = per-row parse errors. These are the numbers the admin sees.
  assert.equal(body.totalRows, 5);
  assert.equal(body.validRows, 3);
  assert.equal(body.errorRows, 1);
});

// ── 400: unknown / file-only / unconfigured ──────────────────
test("unknown adapter → 400", async () => {
  const { status, body } = await runHrConnectionTest("does_not_exist");
  assert.equal(status, 400);
  assert.match(String(body.message), /Unknown HR connector "does_not_exist"/);
});

test("empty adapter key → 400 unknown", async () => {
  const { status, body } = await runHrConnectionTest("");
  assert.equal(status, 400);
  assert.match(String(body.message), /Unknown HR connector/);
});

test("file-only adapter (no fetchRecords) → 400 unsupported", async () => {
  const { status, body } = await runHrConnectionTest("fake_file_only");
  assert.equal(status, 400);
  assert.match(String(body.message), /does not support API sync/);
});

test("unconfigured adapter → 400 with the missing secret names", async () => {
  const { status, body } = await runHrConnectionTest("fake_unconfigured");
  assert.equal(status, 400);
  assert.match(String(body.message), /not configured/);
  assert.match(String(body.message), /FAKE_API_KEY, FAKE_SUBDOMAIN/);
});

// ── 502: upstream fetch failure ──────────────────────────────
test("adapter fetch failure → 502 surfacing the upstream message", async () => {
  const errSpy = mock.method(console, "error", () => {});
  try {
    const { status, body } = await runHrConnectionTest("fake_throw");
    assert.equal(status, 502);
    assert.equal(body.ok, false);
    assert.equal(body.message, "BambooHR auth failed: 401 Unauthorized");
  } finally {
    errSpy.mock.restore();
  }
});

test("adapter fetch failure with no message → 502 with a generic fallback", async () => {
  const errSpy = mock.method(console, "error", () => {});
  try {
    const { status, body } = await runHrConnectionTest("fake_throw_nomsg");
    assert.equal(status, 502);
    assert.equal(body.ok, false);
    assert.equal(body.message, "Fake Throws No Message connection test failed.");
  } finally {
    errSpy.mock.restore();
  }
});

// ── The core invariant: read-only, no writes ─────────────────
test("a connection test creates NO import batch and upserts NO staff records", async () => {
  const batchSpy = mock.method(storage, "createImportBatch", async () => {
    throw new Error("createImportBatch must not be called during a connection test");
  });
  const upsertSpy = mock.method(storage, "upsertStaffRecords", async () => {
    throw new Error("upsertStaffRecords must not be called during a connection test");
  });
  try {
    // Exercise every branch — success, 400s, and 502 — to be sure none of them
    // sneak a write into the read-only path.
    const errSpy = mock.method(console, "error", () => {});
    await runHrConnectionTest("fake_ok");
    await runHrConnectionTest("does_not_exist");
    await runHrConnectionTest("fake_file_only");
    await runHrConnectionTest("fake_unconfigured");
    await runHrConnectionTest("fake_throw");
    errSpy.mock.restore();

    assert.equal(batchSpy.mock.callCount(), 0, "no import batch created");
    assert.equal(upsertSpy.mock.callCount(), 0, "no staff records upserted");
  } finally {
    batchSpy.mock.restore();
    upsertSpy.mock.restore();
  }
});
