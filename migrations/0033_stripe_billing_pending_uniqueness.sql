DROP INDEX IF EXISTS stripe_billing_operations_user_version_idx;

CREATE UNIQUE INDEX stripe_billing_operations_user_version_idx
  ON stripe_billing_operations (user_id, target_version)
  WHERE status = 'pending';