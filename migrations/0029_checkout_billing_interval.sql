ALTER TABLE checkout_sessions
  ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'month';