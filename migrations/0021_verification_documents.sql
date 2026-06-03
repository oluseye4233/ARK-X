-- Verification Documents — DATA-pillar evidence for Primitive Card Verification.
-- Subscribers attach supporting documents and certifications under a CODEC
-- primitive; uploading >=1 document satisfies the DATA pillar for that card's
-- verification. Idempotent.

CREATE TABLE IF NOT EXISTS verification_documents (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  card_id varchar NOT NULL,
  kind text NOT NULL DEFAULT 'DOCUMENT',
  file_name text NOT NULL,
  mime_type text NOT NULL,
  label text,
  data_url text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_documents_user_card_idx
  ON verification_documents (user_id, card_id);
