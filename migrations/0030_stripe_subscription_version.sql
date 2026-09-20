ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_subscription_version integer NOT NULL DEFAULT 0;