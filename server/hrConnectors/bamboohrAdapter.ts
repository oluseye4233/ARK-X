// BambooHR live HR-connector adapter — Task #28.
//
// Pulls the company employee directory from the BambooHR REST API and maps it
// onto the normalized HR field set. Credentials come from server-side secrets
// only (never the client): an API key + the company subdomain.
//
//   GET https://api.bamboohr.com/api/gateway.php/{subdomain}/v1/employees/directory
//   Auth: HTTP Basic, username = API key, password = "x"
//
// Docs: https://documentation.bamboohr.com/reference/get-employees-directory-1

import type { HrConnectorAdapter, HrConnectorParseResult } from "./types";
import {
  assertConfigured,
  fetchJson,
  finalizeApiRecords,
  secretsPresent,
  type RawMappedRecord,
} from "./normalize";

const REQUIRED = ["BAMBOOHR_API_KEY", "BAMBOOHR_SUBDOMAIN"] as const;

/** BambooHR directory employee shape (subset we consume). */
type BambooEmployee = {
  id?: string | number;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  jobTitle?: string;
  workEmail?: string;
  department?: string;
  division?: string;
  location?: string;
  supervisor?: string;
};

const SOURCE_MAPPING: Record<string, string> = {
  id: "externalId",
  displayName: "fullName",
  workEmail: "email",
  jobTitle: "jobTitle",
  department: "department",
  division: "team",
  location: "location",
  supervisor: "manager",
};

const bamboohrAdapter: HrConnectorAdapter = {
  key: "bamboohr",
  label: "BambooHR",
  acceptsFile: false,
  requiredSecrets: REQUIRED,

  isConfigured() {
    return secretsPresent(REQUIRED);
  },

  async fetchRecords(): Promise<HrConnectorParseResult> {
    assertConfigured("BambooHR", REQUIRED);
    const apiKey = process.env.BAMBOOHR_API_KEY!.trim();
    const subdomain = process.env.BAMBOOHR_SUBDOMAIN!.trim();
    const url = `https://api.bamboohr.com/api/gateway.php/${encodeURIComponent(subdomain)}/v1/employees/directory`;
    const auth = Buffer.from(`${apiKey}:x`).toString("base64");

    const data = await fetchJson(url, {
      label: "BambooHR",
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });

    const employees: BambooEmployee[] = Array.isArray(data?.employees) ? data.employees : [];
    const raw: RawMappedRecord[] = employees.map((e) => {
      const fullName =
        e.displayName?.trim() ||
        [e.firstName, e.lastName].filter(Boolean).join(" ").trim() ||
        e.preferredName?.trim() ||
        "";
      return {
        externalId: e.id != null ? String(e.id) : undefined,
        fullName,
        email: e.workEmail ?? undefined,
        jobTitle: e.jobTitle ?? undefined,
        department: e.department ?? undefined,
        team: e.division ?? undefined,
        location: e.location ?? undefined,
        manager: e.supervisor ?? undefined,
      };
    });

    return finalizeApiRecords("bamboohr", raw, SOURCE_MAPPING);
  },
};

export default bamboohrAdapter;
