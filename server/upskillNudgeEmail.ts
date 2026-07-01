// Delivery contract for the "nudge to upskill" action.
//
// Mirrors `assessmentSummaryEmail.ts`: the body is assembled from the nudged
// staff member's own scores, delivery is attempted via the shared Gmail
// transport, and ANY failure is returned as a truthful `emailSent:false` +
// human-readable `emailError` rather than a fake success. Extracted from the
// HTTP layer so the subject/body composition and the send/fallback contract
// can be unit tested in isolation from the session/storage stack.

import {
  sendMail as realSendMail,
  MailNotConfiguredError as RealMailNotConfiguredError,
  type SendMailOptions,
} from "./mail";

export interface UpskillNudgeResult {
  emailSent: boolean;
  emailError?: string;
}

// Injectable so tests can substitute the mail transport without touching the
// static `./mail` import. Defaults to the real Gmail-connector transport.
export interface UpskillNudgeMailDeps {
  sendMail: (opts: SendMailOptions) => Promise<void>;
  MailNotConfiguredError: typeof RealMailNotConfiguredError;
}

const defaultDeps: UpskillNudgeMailDeps = {
  sendMail: realSendMail,
  MailNotConfiguredError: RealMailNotConfiguredError,
};

// Path the recipient should land on to act on the nudge: the Career Mobility
// surface (12-vector transferability radar, upskilling timeline, skill-gap
// matrix). Exported so the in-app notification link stays in lockstep.
export const UPSKILL_NUDGE_PATH = "/pathways";

// Builds the plain-text nudge email. Only the recipient's own name and the
// upskilling call-to-action are included — no scores of others, no secrets,
// no internal identifiers.
export function buildUpskillNudgeEmail(
  recipientName?: string,
): { subject: string; body: string } {
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi,";
  const subject = "A nudge to close your skill gaps on ARK";
  const body = [
    greeting,
    "",
    "Your organization's workforce lead has flagged an opportunity for you to",
    "strengthen your skill profile and reduce your AI-automation exposure.",
    "",
    "Log in to the ARK Platform and open Career Mobility to see your:",
    "  • 12-vector transferability radar",
    "  • personalized 30 / 90 / 365-day upskilling roadmap",
    "  • skill-gap matrix and pivot opportunities",
    "",
    "A short, focused push now can meaningfully lift your readiness.",
    "",
    "— The ARK Platform",
  ].join("\n");
  return { subject, body };
}

// Attempts real delivery of the nudge and returns the API response fields.
// On success → emailSent:true. On ANY failure → emailSent:false with a clear,
// human-readable emailError. Never throws.
export async function deliverUpskillNudge(
  args: { to: string; subject: string; body: string },
  deps: UpskillNudgeMailDeps = defaultDeps,
): Promise<UpskillNudgeResult> {
  const { to, subject, body } = args;
  try {
    await deps.sendMail({ to, subject, text: body });
    return { emailSent: true };
  } catch (mailErr: any) {
    const reason =
      mailErr instanceof deps.MailNotConfiguredError
        ? "Email delivery isn't connected yet, so no email was sent — but the in-app nudge was delivered. Ask an admin to connect the mail integration."
        : `We couldn't email the nudge (${mailErr.message}) — but the in-app nudge was delivered.`;
    return { emailSent: false, emailError: reason };
  }
}

// A single, valid email address (no whitespace, exactly one @, a dotted
// domain). Used to decide whether the linked account has a usable recipient
// BEFORE any send is attempted.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isValidEmail(value: string | null | undefined): boolean {
  return EMAIL_RE.test((value ?? "").trim());
}
