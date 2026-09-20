ALTER TABLE stripe_billing_operations
  ADD COLUMN IF NOT EXISTS last_error_category text,
  ADD COLUMN IF NOT EXISTS recovery_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_recovery_attempt_at timestamp;
