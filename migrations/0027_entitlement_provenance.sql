-- Make paid entitlement provenance explicit and fail closed for unknown records.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS entitlement_source text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS entitlement_verification_status text NOT NULL DEFAULT 'unverified';

-- Only an existing admin-provision event is independent evidence that a legacy
-- Enterprise plan was provisioned under a contract. Plan value alone is not
-- provenance and must fail closed.
UPDATE users
SET entitlement_source = 'contract',
    entitlement_verification_status = 'verified'
WHERE subscription_plan = 'ENTERPRISE'
  AND entitlement_source = 'unverified'
  AND entitlement_verification_status = 'unverified'
  AND EXISTS (
    SELECT 1
    FROM billing_events
    WHERE billing_events.user_id = users.id
      AND billing_events.type = 'subscription.upgraded'
      AND billing_events.to_plan = 'ENTERPRISE'
      AND billing_events.payload ->> 'source' = 'admin.enterprise.provision'
  );

-- No historical identifier is authoritative proof of provider verification.
-- Keep all legacy self-serve records unverified without deleting their billing
-- history. Restrict this to the initial state so re-running this idempotent
-- migration cannot overwrite provenance established by a later provider or
-- contract flow.
UPDATE users
SET entitlement_source = 'unverified',
    entitlement_verification_status = 'unverified'
WHERE subscription_plan IN ('INDIVIDUAL_PRO', 'SCHOOL_STUDENT')
  AND entitlement_source = 'unverified'
  AND entitlement_verification_status = 'unverified';