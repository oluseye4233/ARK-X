// Delivery contract for the "email me my assessment summary" action.
//
// Mirrors `confirmationInviteEmail.ts`: the body is assembled from the user's
// latest assessment, delivery is attempted via the shared Gmail transport, and
// ANY failure is returned as a truthful `emailSent:false` + human-readable
// `emailError` rather than a fake success. Extracted from the HTTP layer so the
// subject/body composition and the send/fallback contract can be unit tested in
// isolation from the session/storage stack.

import {
  sendMail as realSendMail,
  MailNotConfiguredError as RealMailNotConfiguredError,
  type SendMailOptions,
} from "./mail";
import type { Assessment } from "@shared/schema";

export interface AssessmentSummaryResult {
  emailSent: boolean;
  emailError?: string;
}

// Injectable so tests can substitute the mail transport without touching the
// static `./mail` import. Defaults to the real Gmail-connector transport.
export interface AssessmentSummaryMailDeps {
  sendMail: (opts: SendMailOptions) => Promise<void>;
  MailNotConfiguredError: typeof RealMailNotConfiguredError;
}

const defaultDeps: AssessmentSummaryMailDeps = {
  sendMail: realSendMail,
  MailNotConfiguredError: RealMailNotConfiguredError,
};

const VULNERABILITY_LABELS = [
  "Flourishing (minimal automation exposure)",
  "Resilient (low automation exposure)",
  "Transitional (moderate automation exposure)",
  "At Risk (elevated automation exposure)",
  "Critical (high automation exposure)",
];

function vulnerabilityLabel(level: number): string {
  const idx = Math.max(0, Math.min(VULNERABILITY_LABELS.length - 1, level));
  return VULNERABILITY_LABELS[idx];
}

// Builds the plain-text summary email. Only derived, user-owned scores are
// included — no secrets, no raw resume text, no internal identifiers.
export function buildAssessmentSummaryEmail(
  assessment: Assessment,
  recipientName?: string,
): { subject: string; body: string } {
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi,";
  const subject = `Your ARK JST Assessment Summary — Score: ${assessment.jstTotal}/300`;
  const body = [
    greeting,
    "",
    "Here is a snapshot of your latest ARK assessment:",
    "",
    `  JST Index: ${assessment.jstTotal} / 300`,
    `    • Jobs: ${assessment.jstJobs}`,
    `    • Skills: ${assessment.jstSkills}`,
    `    • Talent: ${assessment.jstTalent}`,
    "",
    `  Readiness Profile: ${assessment.readinessProfile}`,
    `  AI Vulnerability: ${vulnerabilityLabel(assessment.vulnerabilityLevel)}`,
    "",
    "Log in to the ARK Platform to see your full assessment, 12-vector",
    "transferability radar, upskilling roadmap, and pivot opportunities.",
    "",
    "— The ARK Platform",
  ].join("\n");
  return { subject, body };
}

// Attempts real delivery of the summary and returns the API response body.
// On success → emailSent:true. On ANY failure → emailSent:false with a clear,
// human-readable emailError. Never throws.
export async function deliverAssessmentSummary(
  args: { to: string; subject: string; body: string },
  deps: AssessmentSummaryMailDeps = defaultDeps,
): Promise<AssessmentSummaryResult> {
  const { to, subject, body } = args;
  try {
    await deps.sendMail({ to, subject, text: body });
    return { emailSent: true };
  } catch (mailErr: any) {
    const reason =
      mailErr instanceof deps.MailNotConfiguredError
        ? "Email delivery isn't connected yet, so no summary was sent. Ask an admin to connect the mail integration."
        : `We couldn't send your summary (${mailErr.message}). Please try again shortly.`;
    return { emailSent: false, emailError: reason };
  }
}
