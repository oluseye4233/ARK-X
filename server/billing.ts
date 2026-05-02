import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@shared/schema";

export const BILLING_PERIOD_DAYS = 30;

export function priceCentsForPlan(plan: SubscriptionPlan): number {
  return SUBSCRIPTION_PLANS[plan].price * 100;
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
