CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  processed_at timestamp NOT NULL DEFAULT now()
);

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS position
  FROM checkout_sessions
  WHERE status = 'pending' AND amount_cents > 0
)
UPDATE checkout_sessions
SET status = 'failed', completed_at = now()
WHERE id IN (SELECT id FROM ranked WHERE position > 1);

CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_one_pending_paid_per_user
  ON checkout_sessions (user_id)
  WHERE status = 'pending' AND amount_cents > 0;