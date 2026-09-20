import test from "node:test";
import assert from "node:assert/strict";
import { jobRoleGuideMetadata } from "../ai/jobRoleGuide";

test("job-role guidance identifies its model-generated source and date", () => {
  const metadata = jobRoleGuideMetadata("test-model", new Date("2026-08-31T23:59:59.000Z"));

  assert.deepEqual(metadata, {
    dataAsOf: "2026-08-31",
    provenance: {
      source: "ARK AI-generated role guide (test-model)",
      methodology: "Language-model synthesis; not verified against current O*NET, SFIA, WEF, or labour-market dataset releases.",
    },
  });
});