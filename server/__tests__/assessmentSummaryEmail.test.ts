import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAssessmentSummaryEmail,
  deliverAssessmentSummary,
  type AssessmentSummaryMailDeps,
} from "../assessmentSummaryEmail";
import { MailNotConfiguredError, MailSendError } from "../mail";
import type { Assessment } from "@shared/schema";

// ─────────────────────────────────────────────────────────────
// Assessment-summary email composition + delivery/fallback contract.
//
// This is the seam exercised by POST /api/notifications/assessment-summary
// (the route is a thin wrapper that loads the session user + their latest
// assessment, builds the message, then delegates to deliverAssessmentSummary
// and maps its result to 200 / 502).
//
// The contract under test:
//   • buildAssessmentSummaryEmail emits ONLY derived, user-owned scores —
//     never raw resume text, secrets, or internal identifiers.
//   • a successful send returns emailSent:true and actually invokes the
//     transport with the recipient + message.
//   • ANY transport failure (MailNotConfiguredError / MailSendError / an
//     unexpected error) resolves to emailSent:false with a clear emailError —
//     never a silent success, never a thrown error.
// ─────────────────────────────────────────────────────────────

const assessment = {
  id: "asmt-1",
  userId: "user-1",
  jstTotal: 218,
  jstJobs: 71,
  jstSkills: 88,
  jstTalent: 59,
  readinessProfile: "Orchestrator",
  vulnerabilityLevel: 2,
  // Fields that MUST NOT leak into the email body:
  rawResumeText: "SECRET RESUME BODY — SSN 123-45-6789, salary $250k",
} as unknown as Assessment;

// Builds injectable mail deps whose sendMail either records the call or rejects
// with the supplied error. MailNotConfiguredError is passed through so the
// helper's `instanceof` branch resolves against the real class.
function depsThatThrow(err: unknown): AssessmentSummaryMailDeps {
  return {
    async sendMail() {
      throw err;
    },
    MailNotConfiguredError,
  };
}

// ── Composition ──────────────────────────────────────────────
test("buildAssessmentSummaryEmail includes only derived scores, never raw resume", () => {
  const { subject, body } = buildAssessmentSummaryEmail(assessment, "Alex");

  // Subject carries the headline JST score.
  assert.match(subject, /218\s*\/\s*300/);

  // Greeting uses the provided name.
  assert.match(body, /Hi Alex,/);

  // All three JST sub-dimensions + readiness are present.
  assert.match(body, /Jobs: 71/);
  assert.match(body, /Skills: 88/);
  assert.match(body, /Talent: 59/);
  assert.match(body, /Readiness Profile: Orchestrator/);
  assert.match(body, /AI Vulnerability:/);

  // CRITICAL: no raw resume text / secrets leak into the message.
  assert.ok(
    !body.includes("SECRET RESUME BODY") && !subject.includes("SECRET RESUME BODY"),
    "raw resume text must never appear",
  );
  assert.ok(!body.includes("123-45-6789"), "PII must never appear");
  assert.ok(!body.includes("$250k"), "salary must never appear");
});

test("buildAssessmentSummaryEmail falls back to a neutral greeting without a name", () => {
  const { body } = buildAssessmentSummaryEmail(assessment);
  assert.match(body, /^Hi,/);
});

test("buildAssessmentSummaryEmail clamps out-of-range vulnerability levels", () => {
  const low = buildAssessmentSummaryEmail(
    { ...assessment, vulnerabilityLevel: -5 } as unknown as Assessment,
  ).body;
  const high = buildAssessmentSummaryEmail(
    { ...assessment, vulnerabilityLevel: 99 } as unknown as Assessment,
  ).body;
  assert.match(low, /Flourishing/);
  assert.match(high, /Critical/);
});

// ── Success path ─────────────────────────────────────────────
test("successful send → emailSent:true, transport invoked with recipient + message", async () => {
  const calls: Array<{ to: string; subject: string; text: string }> = [];
  const deps: AssessmentSummaryMailDeps = {
    async sendMail(opts) {
      calls.push(opts);
    },
    MailNotConfiguredError,
  };
  const { subject, body } = buildAssessmentSummaryEmail(assessment, "Alex");

  const result = await deliverAssessmentSummary(
    { to: "alex@example.com", subject, body },
    deps,
  );

  assert.equal(result.emailSent, true);
  assert.equal(result.emailError, undefined);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, "alex@example.com");
  assert.equal(calls[0].subject, subject);
  assert.equal(calls[0].text, body);
});

// ── Failure: connector not linked yet ────────────────────────
test("MailNotConfiguredError → emailSent:false, 'not connected' emailError, no throw", async () => {
  const result = await deliverAssessmentSummary(
    { to: "alex@example.com", subject: "s", body: "b" },
    depsThatThrow(new MailNotConfiguredError()),
  );

  assert.equal(result.emailSent, false);
  assert.ok(result.emailError, "an explicit emailError is present");
  assert.match(String(result.emailError), /isn't connected/i);
});

// ── Failure: transport/delivery error ────────────────────────
test("MailSendError → emailSent:false, emailError surfaces the cause", async () => {
  const result = await deliverAssessmentSummary(
    { to: "alex@example.com", subject: "s", body: "b" },
    depsThatThrow(new MailSendError("Email delivery failed (500): upstream boom")),
  );

  assert.equal(result.emailSent, false);
  assert.ok(result.emailError, "an explicit emailError is present");
  assert.match(String(result.emailError), /upstream boom/);
});

// ── Never a silent success / never throws ────────────────────
test("an unexpected (non-Mail) error still resolves to emailSent:false, never throws", async () => {
  const result = await deliverAssessmentSummary(
    { to: "alex@example.com", subject: "s", body: "b" },
    depsThatThrow(new Error("totally unexpected")),
  );

  assert.equal(result.emailSent, false);
  assert.ok(result.emailError);
  assert.match(String(result.emailError), /totally unexpected/);
});
