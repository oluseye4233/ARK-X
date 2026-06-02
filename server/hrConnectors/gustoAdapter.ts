// Gusto live HR-connector adapter — Task #28.
//
// Pulls the company employee list from the Gusto API and maps it onto the
// normalized HR field set. Credentials come from server-side secrets only:
// an OAuth/API access token + the company id. The API base defaults to
// production but can be pointed at the demo environment via GUSTO_API_BASE.
//
//   GET {base}/v1/companies/{company_id}/employees?include=jobs
//   Auth: Bearer access token
//
// Docs: https://docs.gusto.com/embedded-payroll/reference/get-v1-companies-company_id-employees

import type { HrConnectorAdapter, HrConnectorParseResult } from "./types";
import {
  assertConfigured,
  fetchJson,
  finalizeApiRecords,
  secretsPresent,
  type RawMappedRecord,
} from "./normalize";

const REQUIRED = ["GUSTO_ACCESS_TOKEN", "GUSTO_COMPANY_ID"] as const;

type GustoJob = {
  title?: string;
  hire_date?: string;
  primary?: boolean;
  current_compensation?: { payment_unit?: string; rate?: string } | null;
};

type GustoEmployee = {
  uuid?: string;
  id?: string | number;
  first_name?: string;
  last_name?: string;
  preferred_first_name?: string;
  email?: string;
  work_email?: string;
  department?: string | null;
  manager?: { full_name?: string } | null;
  jobs?: GustoJob[];
};

const SOURCE_MAPPING: Record<string, string> = {
  uuid: "externalId",
  full_name: "fullName",
  email: "email",
  "jobs[].title": "jobTitle",
  "jobs[].hire_date": "hireDate",
  department: "department",
  "manager.full_name": "manager",
};

/** Pick the primary job, else the first one. */
function primaryJob(jobs: GustoJob[] | undefined): GustoJob | undefined {
  if (!jobs?.length) return undefined;
  return jobs.find((j) => j.primary) ?? jobs[0];
}

const gustoAdapter: HrConnectorAdapter = {
  key: "gusto",
  label: "Gusto",
  acceptsFile: false,
  requiredSecrets: REQUIRED,

  isConfigured() {
    return secretsPresent(REQUIRED);
  },

  async fetchRecords(): Promise<HrConnectorParseResult> {
    assertConfigured("Gusto", REQUIRED);
    const token = process.env.GUSTO_ACCESS_TOKEN!.trim();
    const companyId = process.env.GUSTO_COMPANY_ID!.trim();
    const base = (process.env.GUSTO_API_BASE?.trim() || "https://api.gusto.com").replace(/\/+$/, "");
    const url = `${base}/v1/companies/${encodeURIComponent(companyId)}/employees?include=jobs`;

    const data = await fetchJson(url, {
      label: "Gusto",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    const employees: GustoEmployee[] = Array.isArray(data) ? data : Array.isArray(data?.employees) ? data.employees : [];
    const raw: RawMappedRecord[] = employees.map((e) => {
      const job = primaryJob(e.jobs);
      const fullName = [e.preferred_first_name || e.first_name, e.last_name].filter(Boolean).join(" ").trim();
      return {
        externalId: e.uuid ? String(e.uuid) : e.id != null ? String(e.id) : undefined,
        fullName,
        email: e.work_email ?? e.email ?? undefined,
        jobTitle: job?.title ?? undefined,
        hireDate: job?.hire_date ?? undefined,
        compensationBand: job?.current_compensation?.payment_unit ?? undefined,
        department: e.department ?? undefined,
        manager: e.manager?.full_name ?? undefined,
      };
    });

    return finalizeApiRecords("gusto", raw, SOURCE_MAPPING);
  },
};

export default gustoAdapter;
