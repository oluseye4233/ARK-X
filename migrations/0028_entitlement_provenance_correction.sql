-- Correct environments where the first version of 0027 inferred contract
-- verification from an Enterprise plan value alone. Preserve only grants with
-- independent evidence from the admin contract-provisioning event.
UPDATE users
SET entitlement_source = 'unverified',
    entitlement_verification_status = 'unverified'
WHERE subscription_plan = 'ENTERPRISE'
  AND entitlement_source = 'contract'
  AND entitlement_verification_status = 'verified'
  AND NOT EXISTS (
    SELECT 1
    FROM billing_events
    WHERE billing_events.user_id = users.id
      AND billing_events.type = 'subscription.upgraded'
      AND billing_events.to_plan = 'ENTERPRISE'
      AND billing_events.payload ->> 'source' = 'admin.enterprise.provision'
  );