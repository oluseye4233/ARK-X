import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deliverConfirmationInvite,
  type ConfirmationInviteEmail,
  type ConfirmationInviteMailDeps,
} from "../confirmationInviteEmail";
import { MailNotConfiguredError, MailSendError } from "../mail";
import type { ConfirmationInvite } from "@shared/schema";

// ─────────────────────────────────────────────────────────────
// Confirmation-invite email delivery + fallback contract.
//
// This is the seam exercised by POST /api/ark-resume/confirmation-invites
// (the route is a thin wrapper that persists the invite, builds the message,
// then delegates to deliverConfirmationInvite and returns its result verbatim).
//
// The contract under test:
//   • a successful send returns the invite + link + emailSent:true
//   • ANY transport failure (MailNotConfiguredError / MailSendError) still
//     keeps the invite + link and returns emailSent:false with a clear
//     emailError — never a silent success, never a thrown error.
// ─────────────────────────────────────────────────────────────

const invite = {
  id: "inv-1",
  userId: "user-1",
  token: "tok-abc123",
  type: "EMPLOYMENT",
  targetRef: "Acme Corp — Senior Engineer",
  targetLabel: "Senior Engineer at Acme Corp",
  recipientEmail: "manager@acme.example",
  recipientName: "Dana Lee",
  recipientOrg: "Acme Corp",
  note: null,
  status: "PENDING",
} as unknown as ConfirmationInvite;

const email: ConfirmationInviteEmail = {
  invite,
  path: `/confirm/${invite.token}`,
  link: `https://ark.example/confirm/${invite.token}`,
  subject: "Please confirm a résumé claim on ARK",
  body: "Hi Dana, please confirm…",
};

// Builds injectable mail deps whose sendMail either resolves or rejects with the
// supplied error. MailNotConfiguredError is passed through so the helper's
// `instanceof` branch resolves against the real class.
function depsThatThrow(err: unknown): ConfirmationInviteMailDeps {
  return {
    async sendMail() {
      throw err;
    },
    MailNotConfiguredError,
  };
}

// ── Success path ─────────────────────────────────────────────
test("successful send → emailSent:true, invite + link returned, no emailError", async () => {
  const calls: Array<{ to: string; subject: string; text: string }> = [];
  const deps: ConfirmationInviteMailDeps = {
    async sendMail(opts) {
      calls.push(opts);
    },
    MailNotConfiguredError,
  };

  const result = await deliverConfirmationInvite(email, deps);

  assert.equal(result.emailSent, true);
  assert.equal(result.emailError, undefined);
  assert.equal(result.invite, invite, "invite is returned");
  assert.equal(result.link, email.link);
  assert.equal(result.path, email.path);

  // The transport was actually invoked with the recipient + message.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, invite.recipientEmail);
  assert.equal(calls[0].subject, email.subject);
  assert.equal(calls[0].text, email.body);
});

// ── Failure: connector not linked yet ────────────────────────
test("MailNotConfiguredError → invite kept, emailSent:false, 'not connected' emailError", async () => {
  const result = await deliverConfirmationInvite(
    email,
    depsThatThrow(new MailNotConfiguredError()),
  );

  // The invite row + tokenised link MUST survive a failed send.
  assert.equal(result.invite, invite, "invite is still returned after a send failure");
  assert.equal(result.link, email.link);
  assert.equal(result.path, email.path);

  assert.equal(result.emailSent, false);
  assert.ok(result.emailError, "an explicit emailError is present");
  assert.match(String(result.emailError), /isn't connected/i);
  assert.match(String(result.emailError), /Copy the link/i);
});

// ── Failure: transport/delivery error ────────────────────────
test("MailSendError → invite kept, emailSent:false, emailError surfaces the cause", async () => {
  const result = await deliverConfirmationInvite(
    email,
    depsThatThrow(new MailSendError("Email delivery failed (500): upstream boom")),
  );

  assert.equal(result.invite, invite, "invite is still returned after a send failure");
  assert.equal(result.link, email.link);

  assert.equal(result.emailSent, false);
  assert.ok(result.emailError, "an explicit emailError is present");
  // The underlying transport message is surfaced for the user/ops.
  assert.match(String(result.emailError), /upstream boom/);
  assert.match(String(result.emailError), /Copy the link/i);
});

// ── Never a silent success / never throws ────────────────────
test("an unexpected (non-Mail) error still resolves to emailSent:false, never throws", async () => {
  const result = await deliverConfirmationInvite(
    email,
    depsThatThrow(new Error("totally unexpected")),
  );

  assert.equal(result.emailSent, false);
  assert.equal(result.invite, invite);
  assert.ok(result.emailError);
  assert.match(String(result.emailError), /totally unexpected/);
});
