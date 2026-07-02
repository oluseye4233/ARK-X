import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildUpskillNudgeEmail,
  deliverUpskillNudge,
  resolveNudgeEmailDelivery,
  isValidEmail,
  UPSKILL_NUDGE_PATH,
  type UpskillNudgeMailDeps,
  type UpskillNudgeResult,
} from "../upskillNudgeEmail";
import { MailNotConfiguredError, MailSendError } from "../mail";

// ─────────────────────────────────────────────────────────────
// "Nudge to upskill" delivery contract.
//
// Three seams are covered (mirrors assessmentSummaryEmail.test.ts):
//   • buildUpskillNudgeEmail — subject/body carry ONLY the recipient's own
//     name and the upskilling CTA; never scores, secrets, or identifiers.
//   • deliverUpskillNudge — success → emailSent:true; ANY transport failure
//     → emailSent:false + a friendly emailError that is truthful about the
//     in-app leg still landing; never throws.
//   • resolveNudgeEmailDelivery — the recipient is ALWAYS derived from the
//     linked account's own email (never client input), and a missing or
//     invalid account email yields emailSent:false WITHOUT any send attempt.
// ─────────────────────────────────────────────────────────────

// ── buildUpskillNudgeEmail ───────────────────────────────────
test("build: greets by name and carries the upskilling CTA", () => {
  const { subject, body } = buildUpskillNudgeEmail("Jordan Diaz");
  assert.match(subject, /nudge/i);
  assert.match(body, /Hi Jordan Diaz,/);
  assert.match(body, /Career Mobility/);
  assert.match(body, /transferability radar/);
  assert.match(body, /upskilling roadmap/);
});

test("build: falls back to a generic greeting when no name is given", () => {
  const { body } = buildUpskillNudgeEmail();
  assert.match(body, /^Hi,/);
});

test("build: body contains no scores, ids, or internal identifiers", () => {
  const { subject, body } = buildUpskillNudgeEmail("Jordan Diaz");
  const combined = `${subject}\n${body}`;
  // No numeric scores or record ids leak into the nudge.
  assert.doesNotMatch(combined, /\bJST\b.*\d/);
  assert.doesNotMatch(combined, /staffRecordId/i);
  assert.doesNotMatch(combined, /userId/i);
});

test("nudge path constant points at the Career Mobility surface", () => {
  assert.equal(UPSKILL_NUDGE_PATH, "/pathways");
});

// ── deliverUpskillNudge ──────────────────────────────────────
const sendArgs = {
  to: "jordan@example.com",
  subject: "A nudge to close your skill gaps on ARK",
  body: "Hi Jordan Diaz, …",
};

function depsThatThrow(err: unknown): UpskillNudgeMailDeps {
  return {
    async sendMail() {
      throw err;
    },
    MailNotConfiguredError,
  };
}

test("deliver: success → emailSent:true, no emailError, transport invoked once", async () => {
  const calls: Array<{ to: string; subject: string; text: string }> = [];
  const deps: UpskillNudgeMailDeps = {
    async sendMail(opts) {
      calls.push(opts);
    },
    MailNotConfiguredError,
  };

  const result = await deliverUpskillNudge(sendArgs, deps);

  assert.equal(result.emailSent, true);
  assert.equal(result.emailError, undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, sendArgs.to);
  assert.equal(calls[0].subject, sendArgs.subject);
  assert.equal(calls[0].text, sendArgs.body);
});

test("deliver: MailNotConfiguredError → emailSent:false, 'not connected' message, in-app leg acknowledged", async () => {
  const result = await deliverUpskillNudge(
    sendArgs,
    depsThatThrow(new MailNotConfiguredError()),
  );
  assert.equal(result.emailSent, false);
  assert.ok(result.emailError);
  assert.match(String(result.emailError), /isn't connected/i);
  // Truthful about the fallback: the in-app nudge still landed.
  assert.match(String(result.emailError), /in-app nudge was delivered/i);
});

test("deliver: MailSendError → emailSent:false, surfaces the cause", async () => {
  const result = await deliverUpskillNudge(
    sendArgs,
    depsThatThrow(new MailSendError("Email delivery failed (500): upstream boom")),
  );
  assert.equal(result.emailSent, false);
  assert.ok(result.emailError);
  assert.match(String(result.emailError), /upstream boom/);
  assert.match(String(result.emailError), /in-app nudge was delivered/i);
});

test("deliver: an unexpected (non-Mail) error still resolves to emailSent:false, never throws", async () => {
  const result = await deliverUpskillNudge(
    sendArgs,
    depsThatThrow(new Error("totally unexpected")),
  );
  assert.equal(result.emailSent, false);
  assert.ok(result.emailError);
  assert.match(String(result.emailError), /totally unexpected/);
});

// ── isValidEmail ─────────────────────────────────────────────
test("isValidEmail: accepts a plain dotted address, rejects junk", () => {
  assert.equal(isValidEmail("jordan@example.com"), true);
  assert.equal(isValidEmail("  jordan@example.com  "), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("two@@example.com"), false);
  assert.equal(isValidEmail("no-domain@host"), false);
  assert.equal(isValidEmail("spaced address@example.com"), false);
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail(null), false);
  assert.equal(isValidEmail(undefined), false);
});

// ── resolveNudgeEmailDelivery (recipient derivation) ─────────
function capturingDeliver(sent: Array<{ to: string; subject: string; body: string }>) {
  return async (args: { to: string; subject: string; body: string }): Promise<UpskillNudgeResult> => {
    sent.push(args);
    return { emailSent: true };
  };
}

test("resolve: recipient is the linked account's own email, greeting uses their name", async () => {
  const sent: Array<{ to: string; subject: string; body: string }> = [];
  const result = await resolveNudgeEmailDelivery(
    { username: "owner@example.com", name: "Owner Person" },
    capturingDeliver(sent),
  );
  assert.equal(result.emailSent, true);
  assert.equal(sent.length, 1);
  // Derived from the linked account — there is no parameter through which a
  // client-supplied address could ever become the recipient.
  assert.equal(sent[0].to, "owner@example.com");
  assert.match(sent[0].body, /Hi Owner Person,/);
});

test("resolve: invalid account email → emailSent:false, NO send attempted", async () => {
  const sent: unknown[] = [];
  const result = await resolveNudgeEmailDelivery(
    { username: "not-an-email", name: "Nobody" },
    capturingDeliver(sent as Array<{ to: string; subject: string; body: string }>),
  );
  assert.equal(result.emailSent, false);
  assert.match(String(result.emailError), /no valid email/i);
  assert.match(String(result.emailError), /in-app nudge was delivered/i);
  assert.equal(sent.length, 0);
});

test("resolve: null account email → emailSent:false, NO send attempted", async () => {
  const sent: unknown[] = [];
  const result = await resolveNudgeEmailDelivery(
    { username: null, name: null },
    capturingDeliver(sent as Array<{ to: string; subject: string; body: string }>),
  );
  assert.equal(result.emailSent, false);
  assert.match(String(result.emailError), /no valid email/i);
  assert.equal(sent.length, 0);
});

test("resolve: missing linked user entirely → emailSent:false, NO send attempted", async () => {
  const sent: unknown[] = [];
  const result = await resolveNudgeEmailDelivery(
    undefined,
    capturingDeliver(sent as Array<{ to: string; subject: string; body: string }>),
  );
  assert.equal(result.emailSent, false);
  assert.match(String(result.emailError), /no valid email/i);
  assert.equal(sent.length, 0);
});

test("resolve: transport failure propagates as truthful emailSent:false, never throws", async () => {
  const result = await resolveNudgeEmailDelivery(
    { username: "owner@example.com", name: "Owner" },
    async () => ({
      emailSent: false,
      emailError: "We couldn't email the nudge (boom) — but the in-app nudge was delivered.",
    }),
  );
  assert.equal(result.emailSent, false);
  assert.match(String(result.emailError), /boom/);
});
