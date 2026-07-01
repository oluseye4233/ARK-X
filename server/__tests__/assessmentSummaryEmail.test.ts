import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAssessmentSummaryEmail,
  deliverAssessmentSummary,
  handleAssessmentSummary,
  type AssessmentSummaryMailDeps,
  type AssessmentSummaryHandlerDeps,
} from "../assessmentSummaryEmail";
import { MailNotConfiguredError, MailSendError } from "../mail";
import type { Assessment } from "@shared/schema";

// ─────────────────────────────────────────────────────────────
// "Email me my assessment summary" delivery contract.
//
// Three seams are covered:
//   • buildAssessmentSummaryEmail — subject/body carry ONLY derived scores,
//     never secrets or raw resume text.
//   • deliverAssessmentSummary — success → emailSent:true; ANY transport
//     failure → emailSent:false + a friendly emailError; never throws.
//   • handleAssessmentSummary — the route's branch logic: 200 on success,
//     502 on delivery failure, 400 when the account has no valid email, 404
//     when the user/assessment is missing, and the recipient is ALWAYS the
//     looked-up user's own email (never a client-supplied address).
// ─────────────────────────────────────────────────────────────

// A representative assessment. `rawResumeText` and a fake secret are attached to
// prove the built email never leaks anything beyond the derived scores.
const assessment = {
  id: "asmt-1",
  userId: "user-1",
  jstTotal: 231,
  jstJobs: 74,
  jstSkills: 88,
  jstTalent: 69,
  readinessProfile: "Orchestrator",
  vulnerabilityLevel: 2,
  rawResumeText:
    "CONFIDENTIAL RESUME BODY — SSN 123-45-6789, home address, salary history",
  apiSecret: "sk-should-never-appear",
} as unknown as Assessment;

// ── buildAssessmentSummaryEmail ──────────────────────────────
test("build: subject carries the JST total", () => {
  const { subject } = buildAssessmentSummaryEmail(assessment, "Sarah Chen");
  assert.match(subject, /231\/300/);
});

test("build: body greets by name and lists only derived scores", () => {
  const { body } = buildAssessmentSummaryEmail(assessment, "Sarah Chen");
  assert.match(body, /Hi Sarah Chen,/);
  assert.match(body, /JST Index: 231 \/ 300/);
  assert.match(body, /Jobs: 74/);
  assert.match(body, /Skills: 88/);
  assert.match(body, /Talent: 69/);
  assert.match(body, /Readiness Profile: Orchestrator/);
  // Vulnerability level 2 → the "Transitional" band label.
  assert.match(body, /AI Vulnerability: Transitional/);
});

test("build: falls back to a generic greeting when no name is given", () => {
  const { body } = buildAssessmentSummaryEmail(assessment);
  assert.match(body, /^Hi,/);
});

test("build: never leaks raw resume text or secrets", () => {
  const { subject, body } = buildAssessmentSummaryEmail(assessment, "Sarah Chen");
  const combined = `${subject}\n${body}`;
  assert.doesNotMatch(combined, /CONFIDENTIAL RESUME BODY/);
  assert.doesNotMatch(combined, /123-45-6789/);
  assert.doesNotMatch(combined, /sk-should-never-appear/);
});

test("build: clamps out-of-range vulnerability levels to a valid band", () => {
  const low = buildAssessmentSummaryEmail(
    { ...assessment, vulnerabilityLevel: -5 } as unknown as Assessment,
  );
  assert.match(low.body, /AI Vulnerability: Flourishing/);
  const high = buildAssessmentSummaryEmail(
    { ...assessment, vulnerabilityLevel: 99 } as unknown as Assessment,
  );
  assert.match(high.body, /AI Vulnerability: Critical/);
});

// ── deliverAssessmentSummary ─────────────────────────────────
const sendArgs = {
  to: "sarah@example.com",
  subject: "Your ARK JST Assessment Summary — Score: 231/300",
  body: "Hi Sarah Chen, …",
};

function depsThatThrow(err: unknown): AssessmentSummaryMailDeps {
  return {
    async sendMail() {
      throw err;
    },
    MailNotConfiguredError,
  };
}

test("deliver: success → emailSent:true, no emailError, transport invoked", async () => {
  const calls: Array<{ to: string; subject: string; text: string }> = [];
  const deps: AssessmentSummaryMailDeps = {
    async sendMail(opts) {
      calls.push(opts);
    },
    MailNotConfiguredError,
  };

  const result = await deliverAssessmentSummary(sendArgs, deps);

  assert.equal(result.emailSent, true);
  assert.equal(result.emailError, undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, sendArgs.to);
  assert.equal(calls[0].subject, sendArgs.subject);
  assert.equal(calls[0].text, sendArgs.body);
});

test("deliver: MailNotConfiguredError → emailSent:false, 'not connected' message", async () => {
  const result = await deliverAssessmentSummary(
    sendArgs,
    depsThatThrow(new MailNotConfiguredError()),
  );
  assert.equal(result.emailSent, false);
  assert.ok(result.emailError);
  assert.match(String(result.emailError), /isn't connected/i);
});

test("deliver: MailSendError → emailSent:false, surfaces the cause", async () => {
  const result = await deliverAssessmentSummary(
    sendArgs,
    depsThatThrow(new MailSendError("Email delivery failed (500): upstream boom")),
  );
  assert.equal(result.emailSent, false);
  assert.ok(result.emailError);
  assert.match(String(result.emailError), /upstream boom/);
  assert.match(String(result.emailError), /try again/i);
});

test("deliver: an unexpected (non-Mail) error still resolves to emailSent:false, never throws", async () => {
  const result = await deliverAssessmentSummary(
    sendArgs,
    depsThatThrow(new Error("totally unexpected")),
  );
  assert.equal(result.emailSent, false);
  assert.ok(result.emailError);
  assert.match(String(result.emailError), /totally unexpected/);
});

// ── handleAssessmentSummary (route branch logic) ─────────────
const okUser = { username: "sarah@example.com", name: "Sarah Chen" };

function baseDeps(
  over: Partial<AssessmentSummaryHandlerDeps> = {},
): AssessmentSummaryHandlerDeps {
  return {
    async getUser() {
      return okUser;
    },
    async getLatestAssessment() {
      return assessment;
    },
    async deliver() {
      return { emailSent: true };
    },
    ...over,
  };
}

test("handle: 200 on success, message names the account email", async () => {
  const sent: Array<{ to: string; subject: string; body: string }> = [];
  const res = await handleAssessmentSummary(
    "user-1",
    baseDeps({
      async deliver(args) {
        sent.push(args);
        return { emailSent: true };
      },
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.match(String(res.body.message), /sarah@example\.com/);
  // Recipient came from the looked-up user, not from any client input.
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "sarah@example.com");
});

test("handle: recipient is the session user's email even if getUser ignores input", async () => {
  const sent: Array<{ to: string }> = [];
  const res = await handleAssessmentSummary(
    "user-1",
    baseDeps({
      async getUser() {
        // Simulates a session-scoped lookup: always returns the owner, so an
        // attacker-supplied address can never become the recipient.
        return { username: "owner@example.com", name: "Owner" };
      },
      async deliver(args) {
        sent.push(args);
        return { emailSent: true };
      },
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(sent[0].to, "owner@example.com");
});

test("handle: 502 when delivery fails, surfaces the emailError", async () => {
  const res = await handleAssessmentSummary(
    "user-1",
    baseDeps({
      async deliver() {
        return { emailSent: false, emailError: "We couldn't send your summary (boom)." };
      },
    }),
  );
  assert.equal(res.status, 502);
  assert.equal(res.body.success, false);
  assert.match(String(res.body.message), /couldn't send/i);
});

test("handle: 400 when the account has no valid email address", async () => {
  const sent: unknown[] = [];
  const res = await handleAssessmentSummary(
    "user-1",
    baseDeps({
      async getUser() {
        return { username: "not-an-email", name: "Nobody" };
      },
      async deliver(args) {
        sent.push(args);
        return { emailSent: true };
      },
    }),
  );
  assert.equal(res.status, 400);
  assert.match(String(res.body.message), /no valid email/i);
  // No send is attempted for an invalid recipient.
  assert.equal(sent.length, 0);
});

test("handle: 404 when the user record is missing", async () => {
  const res = await handleAssessmentSummary(
    "ghost",
    baseDeps({
      async getUser() {
        return undefined;
      },
    }),
  );
  assert.equal(res.status, 404);
  assert.match(String(res.body.message), /user not found/i);
});

test("handle: 404 when no assessment exists yet", async () => {
  const res = await handleAssessmentSummary(
    "user-1",
    baseDeps({
      async getLatestAssessment() {
        return undefined;
      },
    }),
  );
  assert.equal(res.status, 404);
  assert.match(String(res.body.message), /no assessment/i);
});
