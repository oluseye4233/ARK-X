// Transactional mail transport backed by the Replit Gmail connector.
//
// Credentials are fetched from the Replit connectors credential proxy on every
// send (OAuth tokens expire, so we never cache them) — there is no stored API
// key or SMTP password anywhere in the codebase. Mail is sent from the Google
// account the user connected via the Gmail integration.
//
// Every failure path throws an Error so callers can surface a clear, explicit
// error instead of silently "succeeding" with no delivery. `MAIL_NOT_CONFIGURED`
// specifically means the Gmail connector has not been linked yet.

const CONNECTOR_NAME = "google-mail";

export class MailNotConfiguredError extends Error {
  constructor() {
    super("MAIL_NOT_CONFIGURED");
    this.name = "MailNotConfiguredError";
  }
}

export class MailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailSendError";
  }
}

function replitToken(): string | null {
  if (process.env.REPL_IDENTITY) return "repl " + process.env.REPL_IDENTITY;
  if (process.env.WEB_REPL_RENEWAL) return "depl " + process.env.WEB_REPL_RENEWAL;
  return null;
}

// True only when the platform connector plumbing is present. It does NOT
// guarantee the user has finished OAuth — that is proven by a successful token
// fetch — but it lets callers short-circuit with a friendly message.
export function isMailConfigured(): boolean {
  return !!(process.env.REPLIT_CONNECTORS_HOSTNAME && replitToken());
}

async function getGmailAccessToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token = replitToken();
  if (!hostname || !token) throw new MailNotConfiguredError();

  let resp: Response;
  try {
    resp = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=${CONNECTOR_NAME}`,
      { headers: { Accept: "application/json", X_REPLIT_TOKEN: token } },
    );
  } catch (e: any) {
    throw new MailSendError(`Could not reach the mail service: ${e.message}`);
  }
  if (!resp.ok) {
    throw new MailSendError(`Mail service returned ${resp.status} while fetching credentials.`);
  }

  const data: any = await resp.json();
  const settings = data?.items?.[0]?.settings;
  const accessToken =
    settings?.access_token ||
    settings?.oauth?.credentials?.access_token;
  if (!accessToken) throw new MailNotConfiguredError();
  return accessToken;
}

// RFC 2047 encoded-word so non-ASCII subjects/names survive transport.
function encodeHeaderWord(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function buildRawMessage(opts: {
  to: string;
  subject: string;
  text: string;
}): string {
  const headers = [
    `To: ${opts.to}`,
    `Subject: ${encodeHeaderWord(opts.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  const body = Buffer.from(opts.text, "utf-8").toString("base64");
  const mime = headers.join("\r\n") + "\r\n\r\n" + body;
  // Gmail API expects base64url (no padding) of the full RFC 822 message.
  return Buffer.from(mime, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
}

// Sends one plain-text email via the connected Gmail account. Throws
// MailNotConfiguredError if the connector is not linked, or MailSendError for
// any delivery failure.
export async function sendMail(opts: SendMailOptions): Promise<void> {
  const accessToken = await getGmailAccessToken();
  const raw = buildRawMessage(opts);

  let resp: Response;
  try {
    resp = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      },
    );
  } catch (e: any) {
    throw new MailSendError(`Email delivery failed: ${e.message}`);
  }

  if (!resp.ok) {
    let detail = "";
    try {
      const err: any = await resp.json();
      detail = err?.error?.message || JSON.stringify(err);
    } catch {
      detail = await resp.text().catch(() => "");
    }
    throw new MailSendError(
      `Email delivery failed (${resp.status})${detail ? `: ${detail}` : ""}`,
    );
  }
}
