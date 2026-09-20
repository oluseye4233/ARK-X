CREATE TABLE IF NOT EXISTS stripe_billing_operations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  subscription_id text NOT NULL,
  kind text NOT NULL,
  from_plan text NOT NULL,
  target_plan text,
  target_version integer NOT NULL,
  institution text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  created_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_billing_operations_user_version_idx
  ON stripe_billing_operations (user_id, target_version);