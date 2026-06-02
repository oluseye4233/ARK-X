import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  finalizeApiRecords,
  detectFieldMapping,
  normalizeHireDate,
} from "../hrConnectors/normalize";
import bamboohrAdapter from "../hrConnectors/bamboohrAdapter";
import gustoAdapter from "../hrConnectors/gustoAdapter";
import workdayAdapter from "../hrConnectors/workdayAdapter";
import type { RawMappedRecord } from "../hrConnectors/normalize";

// ─────────────────────────────────────────────────────────────
// fetch + env stubs for the live API adapters
// ─────────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
const HR_ENV_KEYS = [
  "BAMBOOHR_API_KEY",
  "BAMBOOHR_SUBDOMAIN",
  "GUSTO_ACCESS_TOKEN",
  "GUSTO_COMPANY_ID",
  "GUSTO_API_BASE",
  "WORKDAY_REPORT_URL",
  "WORKDAY_USERNAME",
  "WORKDAY_PASSWORD",
];
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of HR_ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of HR_ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  globalThis.fetch = realFetch;
});

/** Stub global fetch to return a single JSON body for any URL. */
function stubFetchJson(body: unknown, status = 200) {
  globalThis.fetch = (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
}

// ─────────────────────────────────────────────────────────────
// normalizeHireDate
// ─────────────────────────────────────────────────────────────
test("normalizeHireDate: ISO date is zero-padded to YYYY-MM-DD", () => {
  assert.equal(normalizeHireDate("2024-3-5"), "2024-03-05");
  assert.equal(normalizeHireDate("2024-12-31"), "2024-12-31");
});

test("normalizeHireDate: US M/D/Y with 2-digit year expands to 20YY", () => {
  assert.equal(normalizeHireDate("3/5/24"), "2024-03-05");
  assert.equal(normalizeHireDate("12/31/2020"), "2020-12-31");
});

test("normalizeHireDate: blank/garbage returns null", () => {
  assert.equal(normalizeHireDate(""), null);
  assert.equal(normalizeHireDate(null), null);
  assert.equal(normalizeHireDate(undefined), null);
  assert.equal(normalizeHireDate("not a date"), null);
});

// ─────────────────────────────────────────────────────────────
// finalizeApiRecords — required Full Name
// ─────────────────────────────────────────────────────────────
test("finalizeApiRecords: row missing Full Name is dropped with an error", () => {
  const raw: RawMappedRecord[] = [
    { fullName: "Ada Lovelace", email: "ada@example.com" },
    { email: "nobody@example.com", jobTitle: "Ghost" },
  ];
  const result = finalizeApiRecords("bamboohr", raw);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].fullName, "Ada Lovelace");
  assert.equal(result.totalRows, 2);
  assert.deepEqual(result.errors, [
    { row: 2, message: "Missing required Full Name." },
  ]);
});

test("finalizeApiRecords: whitespace-only Full Name counts as missing", () => {
  const result = finalizeApiRecords("gusto", [{ fullName: "   ", email: "x@y.com" }]);
  assert.equal(result.records.length, 0);
  assert.equal(result.errors[0].message, "Missing required Full Name.");
});

test("finalizeApiRecords: fully-empty record is skipped silently (no totalRows, no error)", () => {
  const result = finalizeApiRecords("workday", [
    { fullName: "Real Person" },
    { email: undefined, jobTitle: null },
    {},
  ]);
  assert.equal(result.records.length, 1);
  assert.equal(result.totalRows, 1);
  assert.deepEqual(result.errors, []);
});

// ─────────────────────────────────────────────────────────────
// finalizeApiRecords — email sanity
// ─────────────────────────────────────────────────────────────
test("finalizeApiRecords: invalid email is dropped but the row is kept", () => {
  const result = finalizeApiRecords("bamboohr", [
    { fullName: "Bad Email", email: "not-an-email" },
  ]);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].fullName, "Bad Email");
  assert.equal(result.records[0].email, undefined);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /Invalid email/);
});

test("finalizeApiRecords: valid email is preserved", () => {
  const result = finalizeApiRecords("bamboohr", [
    { fullName: "Good Email", email: "good@example.com" },
  ]);
  assert.equal(result.records[0].email, "good@example.com");
  assert.deepEqual(result.errors, []);
});

// ─────────────────────────────────────────────────────────────
// finalizeApiRecords — de-duplication
// ─────────────────────────────────────────────────────────────
test("finalizeApiRecords: dedupes on email case-insensitively, keeping the first", () => {
  const result = finalizeApiRecords("gusto", [
    { fullName: "First Wins", email: "Dup@Example.com" },
    { fullName: "Second Loses", email: "dup@example.com" },
  ]);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].fullName, "First Wins");
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /Duplicate/);
});

test("finalizeApiRecords: with no email, dedupes on lowercased name", () => {
  const result = finalizeApiRecords("workday", [
    { fullName: "Jane Doe" },
    { fullName: "jane doe" },
    { fullName: "Other Person" },
  ]);
  assert.equal(result.records.length, 2);
  assert.deepEqual(
    result.records.map((r) => r.fullName),
    ["Jane Doe", "Other Person"],
  );
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /Duplicate/);
});

test("finalizeApiRecords: same name but distinct emails are NOT duplicates", () => {
  const result = finalizeApiRecords("gusto", [
    { fullName: "John Smith", email: "john1@example.com" },
    { fullName: "John Smith", email: "john2@example.com" },
  ]);
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.errors, []);
});

// ─────────────────────────────────────────────────────────────
// finalizeApiRecords — hire-date + trimming + mapping passthrough
// ─────────────────────────────────────────────────────────────
test("finalizeApiRecords: normalizes hire date and errors on garbage", () => {
  const ok = finalizeApiRecords("gusto", [
    { fullName: "Has Date", hireDate: "1/2/2021" },
  ]);
  assert.equal(ok.records[0].hireDate, "2021-01-02");

  const bad = finalizeApiRecords("gusto", [
    { fullName: "Bad Date", hireDate: "sometime last spring" },
  ]);
  assert.equal(bad.records[0].hireDate, undefined);
  assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0].message, /Unrecognized hire date/);
});

test("finalizeApiRecords: trims values and drops empties before validating", () => {
  const result = finalizeApiRecords("bamboohr", [
    { fullName: "  Padded Name  ", email: "  pad@example.com  ", jobTitle: "   " },
  ]);
  assert.equal(result.records[0].fullName, "Padded Name");
  assert.equal(result.records[0].email, "pad@example.com");
  assert.equal(result.records[0].jobTitle, undefined);
});

test("finalizeApiRecords: passes the supplied columnMapping through verbatim", () => {
  const mapping = { displayName: "fullName", workEmail: "email" };
  const result = finalizeApiRecords("bamboohr", [{ fullName: "X Y" }], mapping);
  assert.deepEqual(result.columnMapping, mapping);
  assert.equal(result.adapter, "bamboohr");
  assert.deepEqual(result.unmappedColumns, []);
});

// ─────────────────────────────────────────────────────────────
// detectFieldMapping
// ─────────────────────────────────────────────────────────────
test("detectFieldMapping: exact synonym match wins (case-insensitive)", () => {
  const mapping = detectFieldMapping(["Full Name", "Work Email", "Job Title"]);
  assert.deepEqual(mapping, {
    "Full Name": "fullName",
    "Work Email": "email",
    "Job Title": "jobTitle",
  });
});

test("detectFieldMapping: falls back to a loose contains match", () => {
  // "Employee Full Name" is not an exact synonym but contains "full name".
  const mapping = detectFieldMapping(["Employee Full Name"]);
  assert.equal(mapping["Employee Full Name"], "fullName");
});

test("detectFieldMapping: each field is claimed only once (first source key wins)", () => {
  const mapping = detectFieldMapping(["Name", "Employee Name"]);
  assert.equal(mapping["Name"], "fullName");
  assert.equal(mapping["Employee Name"], undefined);
});

test("detectFieldMapping: blank / unknown keys are ignored", () => {
  const mapping = detectFieldMapping(["", "   ", "Totally Unrelated Column"]);
  assert.deepEqual(mapping, {});
});

// ─────────────────────────────────────────────────────────────
// BambooHR adapter
// ─────────────────────────────────────────────────────────────
test("bamboohrAdapter: fails closed when unconfigured, naming the missing secrets", async () => {
  assert.equal(bamboohrAdapter.isConfigured?.(), false);
  await assert.rejects(() => bamboohrAdapter.fetchRecords!(), (err: Error) => {
    assert.match(err.message, /BambooHR is not configured/);
    assert.match(err.message, /BAMBOOHR_API_KEY/);
    assert.match(err.message, /BAMBOOHR_SUBDOMAIN/);
    return true;
  });
});

test("bamboohrAdapter: maps the directory payload onto normalized records", async () => {
  process.env.BAMBOOHR_API_KEY = "key";
  process.env.BAMBOOHR_SUBDOMAIN = "acme";
  assert.equal(bamboohrAdapter.isConfigured?.(), true);
  stubFetchJson({
    employees: [
      {
        id: 101,
        displayName: "Grace Hopper",
        workEmail: "grace@acme.com",
        jobTitle: "Rear Admiral",
        department: "Engineering",
        division: "Navy",
        location: "Arlington",
        supervisor: "The Navy",
      },
      // No displayName → falls back to first + last name.
      { id: 102, firstName: "Alan", lastName: "Turing", workEmail: "alan@acme.com" },
    ],
  });

  const result = await bamboohrAdapter.fetchRecords!();
  assert.equal(result.adapter, "bamboohr");
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records[0], {
    externalId: "101",
    fullName: "Grace Hopper",
    email: "grace@acme.com",
    jobTitle: "Rear Admiral",
    department: "Engineering",
    team: "Navy",
    location: "Arlington",
    manager: "The Navy",
  });
  assert.equal(result.records[1].fullName, "Alan Turing");
  assert.deepEqual(result.columnMapping, {
    id: "externalId",
    displayName: "fullName",
    workEmail: "email",
    jobTitle: "jobTitle",
    department: "department",
    division: "team",
    location: "location",
    supervisor: "manager",
  });
});

// ─────────────────────────────────────────────────────────────
// Gusto adapter
// ─────────────────────────────────────────────────────────────
test("gustoAdapter: fails closed when unconfigured, naming the missing secrets", async () => {
  await assert.rejects(() => gustoAdapter.fetchRecords!(), (err: Error) => {
    assert.match(err.message, /Gusto is not configured/);
    assert.match(err.message, /GUSTO_ACCESS_TOKEN/);
    assert.match(err.message, /GUSTO_COMPANY_ID/);
    return true;
  });
});

test("gustoAdapter: picks the primary job, normalizes hire date, falls back email", async () => {
  process.env.GUSTO_ACCESS_TOKEN = "tok";
  process.env.GUSTO_COMPANY_ID = "co_1";
  stubFetchJson([
    {
      uuid: "u-1",
      preferred_first_name: "Maggie",
      first_name: "Margaret",
      last_name: "Hamilton",
      work_email: "maggie@nasa.gov",
      department: "Apollo",
      manager: { full_name: "Dr. Director" },
      jobs: [
        { title: "Junior Dev", hire_date: "2019-01-01", primary: false },
        { title: "Lead Engineer", hire_date: "5/6/2020", primary: true },
      ],
    },
    {
      id: 7,
      first_name: "Katherine",
      last_name: "Johnson",
      email: "katherine@nasa.gov", // no work_email → falls back to email
      jobs: [{ title: "Mathematician", hire_date: "1953-06-01" }],
    },
  ]);

  const result = await gustoAdapter.fetchRecords!();
  assert.equal(result.adapter, "gusto");
  assert.equal(result.records.length, 2);
  // Primary job + preferred name + hire-date normalization.
  assert.deepEqual(result.records[0], {
    externalId: "u-1",
    fullName: "Maggie Hamilton",
    email: "maggie@nasa.gov",
    jobTitle: "Lead Engineer",
    hireDate: "2020-05-06",
    department: "Apollo",
    manager: "Dr. Director",
  });
  // Email fallback + first (only) job when none flagged primary.
  assert.equal(result.records[1].email, "katherine@nasa.gov");
  assert.equal(result.records[1].jobTitle, "Mathematician");
  assert.equal(result.records[1].externalId, "7");
});

// ─────────────────────────────────────────────────────────────
// Workday adapter
// ─────────────────────────────────────────────────────────────
test("workdayAdapter: fails closed when unconfigured, naming the missing secrets", async () => {
  await assert.rejects(() => workdayAdapter.fetchRecords!(), (err: Error) => {
    assert.match(err.message, /Workday is not configured/);
    assert.match(err.message, /WORKDAY_REPORT_URL/);
    assert.match(err.message, /WORKDAY_USERNAME/);
    assert.match(err.message, /WORKDAY_PASSWORD/);
    return true;
  });
});

test("workdayAdapter: auto-detects columns and flattens descriptor references", async () => {
  process.env.WORKDAY_REPORT_URL = "https://wd.example.com/report";
  process.env.WORKDAY_USERNAME = "isu";
  process.env.WORKDAY_PASSWORD = "pw";
  stubFetchJson({
    Report_Entry: [
      {
        "Full Name": "Linus Torvalds",
        "Work Email": "linus@kernel.org",
        "Job Title": "Maintainer",
        Department: "Kernel",
        "Hire Date": "1991-08-25",
        Manager: { descriptor: "Self" },
        "Unmapped Custom Field": "ignore me",
      },
    ],
  });

  const result = await workdayAdapter.fetchRecords!();
  assert.equal(result.adapter, "workday");
  assert.equal(result.records.length, 1);
  assert.deepEqual(result.records[0], {
    fullName: "Linus Torvalds",
    email: "linus@kernel.org",
    jobTitle: "Maintainer",
    department: "Kernel",
    hireDate: "1991-08-25",
    manager: "Self",
  });
  assert.equal(result.columnMapping["Full Name"], "fullName");
  assert.equal(result.columnMapping["Manager"], "manager");
  assert.deepEqual(result.unmappedColumns, ["Unmapped Custom Field"]);
});

test("workdayAdapter: empty report returns an empty, error-free result", async () => {
  process.env.WORKDAY_REPORT_URL = "https://wd.example.com/report";
  process.env.WORKDAY_USERNAME = "isu";
  process.env.WORKDAY_PASSWORD = "pw";
  stubFetchJson({ Report_Entry: [] });

  const result = await workdayAdapter.fetchRecords!();
  assert.deepEqual(result.records, []);
  assert.deepEqual(result.errors, []);
  assert.equal(result.totalRows, 0);
});
