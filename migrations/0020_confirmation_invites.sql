-- Task #60 — Confirmation Invites
-- Tokenized, no-login email invites letting an external party (employer / school /
-- registrar) confirm ONE specific resume claim. Resolution upserts into
-- skill_confirmations (confirmer has no platform account). Idempotent.

CREATE TABLE IF NOT EXISTS confirmation_invites (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  token varchar NOT NULL UNIQUE,
  user_id varchar NOT NULL,
  type text NOT NULL,
  target_ref text NOT NULL,
  target_label text,
  recipient_email text NOT NULL,
  recipient_name text,
  recipient_org text,
  note text,
  status text NOT NULL DEFAULT 'PENDING',
  response_note text,
  expires_at timestamp NOT NULL,
  responded_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS confirmation_invites_token_uidx ON confirmation_invites (token);
