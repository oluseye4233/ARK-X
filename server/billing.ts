import { SUBSCRIPTION_PLANS, F1000_PROMO, type BillingInterval, type SubscriptionPlan, type User } from "@shared/schema";

export const BILLING_PERIOD_DAYS = 30;
export const ENTITLEMENT_SOURCES = ["unverified", "provider", "contract"] as const;
export const ENTITLEMENT_VERIFICATION_STATUSES = ["unverified", "verified"] as const;
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];
export type EntitlementVerificationStatus = (typeof ENTITLEMENT_VERIFICATION_STATUSES)[number];

export type BillingAvailability = {
  provider: "stripe" | null;
  paidCheckoutAvailable: boolean;
  mode: "demo" | "live";
};

let stripeInitializationFailed = false;
export function setStripeInitializationFailed(failed: boolean): void {
  stripeInitializationFailed = failed;
}

export function getBillingAvailability(): BillingAvailability {
  const connected = Boolean(
    process.env.REPLIT_CONNECTORS_HOSTNAME &&
    (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL) &&
    !stripeInitializationFailed,
  );
  return {
    provider: connected ? "stripe" : null,
    paidCheckoutAvailable: connected,
    mode: connected ? "live" : "demo",
  };
}

export function paidCheckoutUnavailableMessage(): string {
  return "Paid checkout is unavailable because the Stripe connection is not configured. No payment or paid entitlement has been created.";
}

export function resolveCanonicalEntitlement(user: User): User {
  const plan = (user.subscriptionPlan || "INDIVIDUAL_FREE") as SubscriptionPlan;
  const source = user.entitlementSource as EntitlementSource;
  const verificationStatus = user.entitlementVerificationStatus as EntitlementVerificationStatus;
  const hasVerifiedPaidProvenance =
    verificationStatus === "verified" &&
    (source === "provider" || source === "contract");

  const requiresVerifiedProvenance = isPaidPlan(plan) || plan === "ENTERPRISE";

  if (!requiresVerifiedProvenance || hasVerifiedPaidProvenance) {
    return user;
  }

  return {
    ...user,
    subscriptionPlan: "INDIVIDUAL_FREE",
    subscriptionStatus: "active",
    subscriptionCurrentPeriodEnd: null,
    subscriptionCanceledAt: null,
  };
}

export function priceCentsForPlan(plan: SubscriptionPlan, f1000 = false, interval: BillingInterval = "month"): number {
  // F1000 members get a price cap on the paid individual/school plans
  // (PRO $10, SCHOOL $9). All other plans bill at their standard price.
  if (f1000 && F1000_PROMO.priceUsd[plan] != null) {
    const monthlyPromo = F1000_PROMO.priceUsd[plan];
    return (interval === "year" ? monthlyPromo * 10 : monthlyPromo) * 100;
  }
  const planData = SUBSCRIPTION_PLANS[plan];
  return (interval === "year" ? planData.annualPrice : planData.price) * 100;
}

export function isPaidPlan(plan: SubscriptionPlan): boolean {
  return SUBSCRIPTION_PLANS[plan].price > 0;
}

export function nextPeriodEnd(from: Date = new Date()): Date {
  return new Date(from.getTime() + BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000);
}

export function syntheticStripeCustomerId(userId: string): string {
  return `cus_stub_${userId.replace(/-/g, "").slice(0, 14)}`;
}

export function syntheticStripeSubscriptionId(sessionId: string): string {
  return `sub_stub_${sessionId.replace(/-/g, "").slice(0, 14)}`;
}

export function syntheticStripeCheckoutId(sessionId: string): string {
  return `cs_stub_${sessionId.replace(/-/g, "").slice(0, 16)}`;
}

export function transitionType(
  fromPlan: SubscriptionPlan,
  toPlan: SubscriptionPlan,
): "subscription.upgraded" | "subscription.downgraded" | null {
  const fromPrice = SUBSCRIPTION_PLANS[fromPlan].price;
  const toPrice = SUBSCRIPTION_PLANS[toPlan].price;
  if (toPrice > fromPrice) return "subscription.upgraded";
  if (toPrice < fromPrice) return "subscription.downgraded";
  return null;
}
