ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_subscription_updated_at timestamp;