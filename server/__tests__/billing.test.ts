import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getBillingAvailability,
  paidCheckoutUnavailableMessage,
  priceCentsForPlan,
  resolveCanonicalEntitlement,
  setStripeInitializationFailed,
} from "../billing";
import { createPlanPreviewToken, stripeSourceStateMatches, verifyPlanPreviewToken } from "../stripeBilling";
import type Stripe from "stripe";
import type { User } from "@shared/schema";

test("paid checkout reports the connected Stripe provider", () => {
  assert.deepEqual(getBillingAvailability(), {
    provider: "stripe",
    paidCheckoutAvailable: true,
    mode: "live",
  });
  assert.match(paidCheckoutUnavailableMessage(), /Stripe connection/i);
});

test("Stripe initialization failure degrades billing without taking down the app", () => {
  setStripeInitializationFailed(true);
  assert.equal(getBillingAvailability().paidCheckoutAvailable, false);
  setStripeInitializationFailed(false);
});

test("paid plans cannot be mistaken for no-payment plan changes", () => {
  assert.ok(priceCentsForPlan("INDIVIDUAL_PRO") > 0);
  assert.ok(priceCentsForPlan("SCHOOL_STUDENT") > 0);
  assert.equal(priceCentsForPlan("INDIVIDUAL_FREE"), 0);
  assert.equal(priceCentsForPlan("INDIVIDUAL_PRO", false, "year"), 29900);
  assert.equal(priceCentsForPlan("ARCHITECT", false, "year"), 49900);
  assert.equal(priceCentsForPlan("SCHOOL_STUDENT", false, "year"), 9900);
});

test("legacy simulated paid subscriptions resolve to free canonical entitlement", () => {
  const legacySimulated = {
    subscriptionPlan: "INDIVIDUAL_PRO",
    subscriptionStatus: "active",
    stripeSubscriptionId: "sub_stub_legacy",
    entitlementSource: "unverified",
    entitlementVerificationStatus: "unverified",
    subscriptionCurrentPeriodEnd: new Date(),
  } as User;

  const canonical = resolveCanonicalEntitlement(legacySimulated);
  assert.equal(canonical.subscriptionPlan, "INDIVIDUAL_FREE");
  assert.equal(canonical.subscriptionStatus, "active");
  assert.equal(canonical.subscriptionCurrentPeriodEnd, null);
});

test("provider-verified paid entitlements are preserved", () => {
  const verified = {
    subscriptionPlan: "INDIVIDUAL_PRO",
    subscriptionStatus: "active",
    stripeSubscriptionId: "sub_verified_provider",
    entitlementSource: "provider",
    entitlementVerificationStatus: "verified",
  } as User;

  assert.equal(resolveCanonicalEntitlement(verified).subscriptionPlan, "INDIVIDUAL_PRO");
});

test("contract-provisioned Enterprise entitlements remain distinct and active", () => {
  const enterprise = {
    subscriptionPlan: "ENTERPRISE",
    subscriptionStatus: "active",
    stripeSubscriptionId: null,
    entitlementSource: "contract",
    entitlementVerificationStatus: "verified",
  } as User;

  assert.equal(resolveCanonicalEntitlement(enterprise).subscriptionPlan, "ENTERPRISE");
  assert.equal(resolveCanonicalEntitlement(enterprise).entitlementSource, "contract");
});

test("paid records fail closed when source or verification is missing", () => {
  const unverifiedProvider = {
    subscriptionPlan: "INDIVIDUAL_PRO",
    entitlementSource: "provider",
    entitlementVerificationStatus: "unverified",
    stripeSubscriptionId: "sub_real_looking",
  } as User;
  const unverifiedEnterprise = {
    subscriptionPlan: "ENTERPRISE",
    entitlementSource: "unverified",
    entitlementVerificationStatus: "unverified",
  } as User;

  assert.equal(resolveCanonicalEntitlement(unverifiedProvider).subscriptionPlan, "INDIVIDUAL_FREE");
  assert.equal(resolveCanonicalEntitlement(unverifiedEnterprise).subscriptionPlan, "INDIVIDUAL_FREE");
});

test("plan-change previews preserve the accepted proration timestamp and reject tampering or expiry", () => {
  const originalSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "billing-preview-test-secret";
  const payload = {
    userId: "preview-owner",
    subscriptionId: "sub_preview",
    fromPlan: "INDIVIDUAL_PRO" as const,
    toPlan: "ARCHITECT" as const,
    institution: null,
    subscriptionVersion: 4,
    targetAmountCents: 9900,
    targetBillingInterval: "month" as const,
    sourceItemId: "si_source",
    sourcePriceId: "price_source",
    sourceQuantity: 1,
    sourcePeriodStart: 900,
    sourcePeriodEnd: 2_000,
    prorationDate: 1_000,
    prorationAmountCents: 2345,
    nextBillingAt: "2030-01-01T00:00:00.000Z",
    expiresAt: 1_300,
  };
  try {
    const token = createPlanPreviewToken(payload);
    assert.deepEqual(verifyPlanPreviewToken(token, 1_299), payload);

    const [, signature] = token.split(".");
    const tamperedBody = Buffer.from(JSON.stringify({ ...payload, prorationAmountCents: 1 })).toString("base64url");
    assert.throws(
      () => verifyPlanPreviewToken(`${tamperedBody}.${signature}`, 1_100),
      (error: any) => error.code === "INVALID_PREVIEW",
    );
    assert.throws(
      () => verifyPlanPreviewToken(token, 1_300),
      (error: any) => error.code === "PREVIEW_EXPIRED",
    );
  } finally {
    if (originalSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  }
});

test("accepted plan previews become stale when Stripe changes the source subscription state", () => {
  const expected = {
    sourceItemId: "si_source",
    sourcePriceId: "price_pro",
    sourceQuantity: 1,
    sourcePeriodStart: 1_000,
    sourcePeriodEnd: 2_000,
  };
  const item = {
    id: "si_source",
    price: { id: "price_pro" },
    quantity: 1,
    current_period_start: 1_000,
    current_period_end: 2_000,
  } as Stripe.SubscriptionItem;
  assert.equal(stripeSourceStateMatches(expected, item), true);
  assert.equal(stripeSourceStateMatches(expected, { ...item, price: { id: "price_architect" } } as Stripe.SubscriptionItem), false);
  assert.equal(stripeSourceStateMatches(expected, { ...item, current_period_end: 3_000 } as Stripe.SubscriptionItem), false);
  assert.equal(stripeSourceStateMatches(expected, { ...item, quantity: 2 } as Stripe.SubscriptionItem), false);
});
