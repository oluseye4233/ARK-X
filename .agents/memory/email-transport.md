---
name: email transport
description: How ARK sends real outbound email and the deliberate fallback contract
---

# Email transport (Gmail connector)

ARK has no SMTP/API-key mailer. Outbound email goes through the **Replit Gmail
connector** ("google-mail") via `@replit/connectors-sdk` (`connectors.proxy(...)`),
which injects + refreshes OAuth automatically. Sends come from the connected
Google account. Code lives in `server/mail.ts`.

**Why:** searchIntegrations only surfaces OAuth connectors (Gmail/Outlook/Mailchimp)
— there is no SendGrid/Resend blueprint. Gmail is the transactional fit.

**How to apply:**
- `connectors.proxy` returns a raw `Response` — call `.json()` yourself.
- Send = `POST /gmail/v1/users/me/messages/send` with `{ raw }` where `raw` is
  base64url (no padding) of a full RFC822 message. Encode non-ASCII subjects as
  RFC 2047 encoded-words or they arrive garbled.
- `isMailConfigured()` only checks env presence — real proof of a working
  connection is a successful send (401/403 ⇒ treat as not-configured).

**Fallback contract (don't break it):** the confirmation-invite POST creates the
invite + tokenised link FIRST, then attempts send. On any mail failure it still
returns HTTP 200 with `emailSent:false` + `emailError` and the link, so the UI
shows a clear "not sent — copy this link" warning. It must never claim success
silently, and must never 4xx/5xx away the already-valid link (the client's
apiRequest discards bodies on non-2xx).
