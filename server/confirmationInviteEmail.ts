// Delivery + fallback contract for confirmation-invite emails.
//
// The invite row and its tokenised link are created BEFORE we ever attempt to
// send. That ordering is deliberate: if delivery fails for any reason we must
// keep the invite valid and hand the candidate a manual link to forward —
// never a silent success. This module owns that contract so it can be unit
// tested in isolation from the HTTP/session/storage stack (mirrors the
// `workforceConnectionTest` extraction pattern).

import {
  sendMail as realSendMail,
  MailNotConfiguredError as RealMailNotConfiguredError,
  type SendMailOptions,
} from "./mail";
import type { ConfirmationInvite } from "@shared/schema";

export interface ConfirmationInviteEmail {
  invite: ConfirmationInvite;
  path: string;
  link: string;
  subject: string;
  body: string;
}

export interface ConfirmationInviteResult {
  invite: ConfirmationInvite;
  path: string;
  link: string;
  emailSent: boolean;
  emailError?: string;
}

// Injectable so tests can substitute the mail transport without touching the
// static `./mail` import. Defaults to the real Gmail-connector transport.
export interface ConfirmationInviteMailDeps {
  sendMail: (opts: SendMailOptions) => Promise<void>;
  MailNotConfiguredError: typeof RealMailNotConfiguredError;
}

const defaultDeps: ConfirmationInviteMailDeps = {
  sendMail: realSendMail,
  MailNotConfiguredError: RealMailNotConfiguredError,
};

// Attempts real delivery of an already-persisted invite and returns the API
// response body. On success → emailSent:true. On ANY failure → emailSent:false
// with a clear, human-readable emailError, while the invite + link are kept so
// the UI can offer the manual fallback. Never throws.
export async function deliverConfirmationInvite(
  email: ConfirmationInviteEmail,
  deps: ConfirmationInviteMailDeps = defaultDeps,
): Promise<ConfirmationInviteResult> {
  const { invite, path, link, subject, body } = email;
  try {
    await deps.sendMail({ to: invite.recipientEmail, subject, text: body });
    return { invite, path, link, emailSent: true };
  } catch (mailErr: any) {
    const reason =
      mailErr instanceof deps.MailNotConfiguredError
        ? "Email delivery isn't connected yet, so no email was sent. Copy the link below and send it to your confirmer."
        : `We couldn't email this invite (${mailErr.message}). Copy the link below and send it to your confirmer.`;
    return { invite, path, link, emailSent: false, emailError: reason };
  }
}
