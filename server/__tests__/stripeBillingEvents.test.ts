import { test } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { billingEvents, checkoutSessions, stripeBillingOperations, stripeWebhookEvents, users } from "@shared/schema";
import {
  createPlanPreviewToken,
  cancelStripePlanForUser,
  processStripeEvent,
  reconcileExistingStripeEntitlements,
  getStripeBillingRecoveryHealth,
  resumePendingStripeBillingOperations,
  switchStripePlanForUser,
} from "../stripeBilling";
import { resolveCanonicalEntitlement } from "../billing";
import { storage } from "../storage";
import type Stripe from "stripe";
import { pollStripeBillingRecoveryHealth, stopStripeBillingRecoveryMonitor } from "../stripeClient";

test("Stripe lifecycle activates only the owner, ignores replay, and records payment failure", async () => {
  const ownerId = "stripe-test-owner";
  const otherId = "stripe-test-other";
  const localId = "stripe-test-checkout";
  const ids = [ownerId, otherId];
  await db.delete(billingEvents).where(inArray(billingEvents.userId, ids));
  await db.delete(checkoutSessions).where(eq(checkoutSessions.id, localId));
  await db.delete(users).where(inArray(users.id, ids));
  await db.delete(stripeWebhookEvents).where(inArray(stripeWebhookEvents.id, ["evt_success", "evt_cross", "evt_failed"]));
  await db.insert(users).values([
    { id: ownerId, name: "Owner", username: ownerId, password: "not-used", stripeCustomerId: "cus_owner" },
    { id: otherId, name: "Other", username: otherId, password: "not-used", stripeCustomerId: "cus_other" },
  ]);
  const pendingInput = {
    id: localId, userId: ownerId, plan: "INDIVIDUAL_PRO", amountCents: 2999,
    status: "pending", externalSessionId: "cs_owner", billingInterval: "year",
  } as const;
  const [firstPending, replayedPending] = await Promise.all([
    storage.createOrGetPendingCheckoutSession(pendingInput),
    storage.createOrGetPendingCheckoutSession(pendingInput),
  ]);
  assert.equal(firstPending.session.id, replayedPending.session.id);
  assert.equal(Number(firstPending.created) + Number(replayedPending.created), 1);
  const subscription = {
    id: "sub_owner", customer: "cus_owner", status: "active",
    metadata: { userId: ownerId, plan: "INDIVIDUAL_PRO", billingInterval: "year" },
    items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 31536000, price: { recurring: { interval: "year" } } }] },
  } as unknown as Stripe.Subscription;
  const retrieveSubscription = async () => subscription;
  const success = {
    id: "evt_success", type: "checkout.session.completed",
    data: { object: {
      id: "cs_owner", payment_status: "paid", customer: "cus_owner", subscription: "sub_owner",
       client_reference_id: localId, metadata: { localSessionId: localId, userId: ownerId, plan: "INDIVIDUAL_PRO", billingInterval: "year" },
    } },
  } as unknown as Stripe.Event;

  try {
    assert.equal(await processStripeEvent(success, { retrieveSubscription }), "processed");
    assert.equal(await processStripeEvent(success, { retrieveSubscription }), "duplicate");
    const paidOwner = (await db.select().from(users).where(eq(users.id, ownerId)))[0];
    assert.equal(paidOwner.subscriptionPlan, "INDIVIDUAL_PRO");
    assert.equal(paidOwner.entitlementSource, "provider");
    assert.equal(paidOwner.entitlementVerificationStatus, "verified");
    assert.equal(resolveCanonicalEntitlement(paidOwner).subscriptionPlan, "INDIVIDUAL_PRO");
    assert.equal((await storage.getUser(ownerId))?.subscriptionPlan, "INDIVIDUAL_PRO");
    assert.equal((await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, localId)))[0].billingInterval, "year");

    const cross = structuredClone(success) as Stripe.Event;
    (cross as any).id = "evt_cross";
    (cross.data.object as any).metadata.userId = otherId;
    await assert.rejects(() => processStripeEvent(cross, { retrieveSubscription }), /ownership/i);

    const failed = {
      id: "evt_failed", type: "invoice.payment_failed",
      data: { object: { id: "in_failed", customer: "cus_owner", subscription: "sub_owner" } },
    } as unknown as Stripe.Event;
    assert.equal(await processStripeEvent(failed), "processed");
    assert.equal((await db.select().from(users).where(eq(users.id, ownerId)))[0].subscriptionStatus, "past_due");
  } finally {
    await db.delete(billingEvents).where(inArray(billingEvents.userId, ids));
    await db.delete(checkoutSessions).where(eq(checkoutSessions.id, localId));
    await db.delete(stripeWebhookEvents).where(inArray(stripeWebhookEvents.id, ["evt_success", "evt_cross", "evt_failed"]));
    await db.delete(users).where(inArray(users.id, ids));
  }
});

test("Stripe plan events handle upgrade, downgrade, retry, and stale ordering", async () => {
  const userId = "stripe-switch-unverified";
  const eventIds = ["evt_switch_upgrade", "evt_switch_stale", "evt_switch_downgrade", "evt_switch_delete", "evt_switch_other"];
  await db.delete(billingEvents).where(eq(billingEvents.userId, userId));
  await db.delete(stripeWebhookEvents).where(inArray(stripeWebhookEvents.id, eventIds));
  await db.delete(users).where(eq(users.id, userId));
  await db.insert(users).values({
    id: userId,
    name: "Switch Owner",
    username: userId,
    password: "not-used",
    subscriptionPlan: "INDIVIDUAL_PRO",
    subscriptionStatus: "active",
    stripeCustomerId: "cus_switch",
    stripeSubscriptionId: "sub_switch",
    entitlementSource: "provider",
    entitlementVerificationStatus: "verified",
  });

  const subscriptionEvent = (
    id: string,
    created: number,
    plan: string,
    subscriptionId = "sub_switch",
    version = 0,
  ) => ({
    id,
    created,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: subscriptionId,
        customer: "cus_switch",
        status: "active",
        cancel_at_period_end: false,
        metadata: { userId, plan, ...(version ? { planVersion: String(version) } : {}) },
        items: { data: [{ current_period_end: created + 2_592_000 }] },
      },
    },
  }) as unknown as Stripe.Event;

  try {
    const upgrade = subscriptionEvent("evt_switch_upgrade", 2_000, "ARCHITECT", "sub_switch", 2);
    assert.equal(await processStripeEvent(upgrade), "processed");
    assert.equal(await processStripeEvent(upgrade), "duplicate", "provider retries are idempotent");
    assert.equal((await db.select().from(users).where(eq(users.id, userId)))[0].subscriptionPlan, "ARCHITECT");

    const stale = subscriptionEvent("evt_switch_stale", 2_000, "SCHOOL_STUDENT", "sub_switch", 1);
    assert.equal(await processStripeEvent(stale), "processed");
    assert.equal(
      (await db.select().from(users).where(eq(users.id, userId)))[0].subscriptionPlan,
      "ARCHITECT",
      "a delayed older event cannot overwrite the newer plan",
    );

    const downgrade = subscriptionEvent("evt_switch_downgrade", 2_000, "INDIVIDUAL_PRO", "sub_switch", 3);
    assert.equal(await processStripeEvent(downgrade), "processed");
    assert.equal((await db.select().from(users).where(eq(users.id, userId)))[0].subscriptionPlan, "INDIVIDUAL_PRO");

    const staleDeletion = {
      id: "evt_switch_delete",
      created: 2_001,
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_switch",
          customer: "cus_switch",
          metadata: { userId, plan: "ARCHITECT", planVersion: "2" },
        },
      },
    } as unknown as Stripe.Event;
    assert.equal(await processStripeEvent(staleDeletion), "processed");
    assert.equal(
      (await db.select().from(users).where(eq(users.id, userId)))[0].subscriptionPlan,
      "INDIVIDUAL_PRO",
      "a delayed deletion from an older plan version cannot clear the newer plan",
    );

    const otherSubscription = subscriptionEvent("evt_switch_other", 4_000, "ARCHITECT", "sub_other");
    assert.equal(await processStripeEvent(otherSubscription), "processed");
    assert.equal(
      (await db.select().from(users).where(eq(users.id, userId)))[0].subscriptionPlan,
      "INDIVIDUAL_PRO",
      "a customer-level match cannot transfer ownership to another subscription",
    );
  } finally {
    await db.delete(billingEvents).where(eq(billingEvents.userId, userId));
    await db.delete(stripeWebhookEvents).where(inArray(stripeWebhookEvents.id, eventIds));
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("unverified paid records cannot initiate a Stripe plan switch", async () => {
  const userId = "stripe-switch-unverified";
  await db.delete(users).where(eq(users.id, userId));
  await db.insert(users).values({
    id: userId,
    name: "Unverified Owner",
    username: userId,
    password: "not-used",
    subscriptionPlan: "INDIVIDUAL_PRO",
    stripeCustomerId: "cus_unverified",
    stripeSubscriptionId: "sub_unverified",
    entitlementSource: "unverified",
    entitlementVerificationStatus: "unverified",
  });
  try {
    const previewToken = createPlanPreviewToken({
      userId,
      subscriptionId: "sub_unverified",
      fromPlan: "INDIVIDUAL_PRO",
      toPlan: "ARCHITECT",
      institution: null,
      subscriptionVersion: 0,
      targetAmountCents: 9900,
      targetBillingInterval: "month",
      sourceItemId: "si_unverified",
      sourcePriceId: "price_pro",
      sourceQuantity: 1,
      sourcePeriodStart: Math.floor(Date.now() / 1000) - 100,
      sourcePeriodEnd: Math.floor(Date.now() / 1000) + 86_400,
      prorationDate: Math.floor(Date.now() / 1000),
      prorationAmountCents: 100,
      nextBillingAt: new Date(Date.now() + 86_400_000).toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    });
    await assert.rejects(
      () => switchStripePlanForUser({ userId, previewToken }),
      /not verified by Stripe/i,
    );
  } finally {
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("Stripe reconciliation preserves an existing active paid entitlement", async () => {
  const userId = "stripe-existing-owner";
  await db.delete(billingEvents).where(eq(billingEvents.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await db.insert(users).values({
    id: userId,
    name: "Existing Owner",
    username: userId,
    password: "not-used",
    subscriptionPlan: "INDIVIDUAL_PRO",
    stripeCustomerId: "cus_existing",
    stripeSubscriptionId: "sub_existing",
    entitlementSource: "unverified",
    entitlementVerificationStatus: "unverified",
  });
  const subscription = {
    id: "sub_existing",
    status: "active",
    customer: "cus_existing",
    metadata: { userId, plan: "INDIVIDUAL_PRO", billingInterval: "month" },
  } as unknown as Stripe.Subscription;
  const stripe = {
    subscriptions: {
      retrieve: async (id: string) => {
        return id === "sub_existing"
          ? subscription
          : { id, status: "canceled", customer: "unknown", metadata: {} } as unknown as Stripe.Subscription;
      },
    },
  } as unknown as Pick<Stripe, "subscriptions">;

  try {
    assert.equal(await reconcileExistingStripeEntitlements(stripe), 1);
    const canonical = await storage.getUser(userId);
    assert.equal(canonical?.subscriptionPlan, "INDIVIDUAL_PRO");
    assert.equal(canonical?.entitlementSource, "provider");
    assert.equal(canonical?.entitlementVerificationStatus, "verified");
    assert.equal(canonical?.stripeSubscriptionId, "sub_existing");
  } finally {
    await db.delete(billingEvents).where(eq(billingEvents.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("a forced post-Stripe failure converges local state from the provider", async () => {
  const userId = "stripe-switch-recovery";
  await db.delete(billingEvents).where(eq(billingEvents.userId, userId));
  await db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await db.insert(users).values({
    id: userId,
    name: "Recovery Owner",
    username: userId,
    password: "not-used",
    subscriptionPlan: "INDIVIDUAL_PRO",
    subscriptionStatus: "active",
    stripeCustomerId: "cus_recovery",
    stripeSubscriptionId: "sub_recovery",
    entitlementSource: "provider",
    entitlementVerificationStatus: "verified",
    stripeSubscriptionVersion: 0,
  });
  const periodStart = Math.floor(Date.now() / 1000) - 100;
  const periodEnd = periodStart + 2_592_000;
  let provider = {
    id: "sub_recovery",
    customer: "cus_recovery",
    status: "active",
    cancel_at_period_end: false,
    metadata: { userId, plan: "INDIVIDUAL_PRO", billingInterval: "month", planVersion: "0" },
    items: { data: [{
      id: "si_recovery",
      quantity: 1,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      price: { id: "price_pro", unit_amount: 2900, recurring: { interval: "month" } },
    }] },
  } as unknown as Stripe.Subscription;
  let providerUpdates = 0;
  const stripe = {
    subscriptions: {
      retrieve: async () => provider,
      update: async (_id: string, input: any) => {
        providerUpdates += 1;
        provider = {
          ...provider,
          metadata: input.metadata,
          items: { data: [{
            ...provider.items.data[0],
            price: { id: "price_architect", unit_amount: 4999, recurring: { interval: "month" } },
          }] },
        } as Stripe.Subscription;
        return provider;
      },
    },
    products: { search: async () => ({ data: [{ id: "prod_architect" }] }) },
    prices: { list: async () => ({ data: [{
      id: "price_architect", unit_amount: 4999, currency: "usd", recurring: { interval: "month" },
    }] }) },
  } as unknown as Stripe;
  const previewToken = createPlanPreviewToken({
    userId,
    subscriptionId: "sub_recovery",
    fromPlan: "INDIVIDUAL_PRO",
    toPlan: "ARCHITECT",
    institution: null,
    subscriptionVersion: 0,
    targetAmountCents: 4999,
    targetBillingInterval: "month",
    sourceItemId: "si_recovery",
    sourcePriceId: "price_pro",
    sourceQuantity: 1,
    sourcePeriodStart: periodStart,
    sourcePeriodEnd: periodEnd,
    prorationDate: Math.floor(Date.now() / 1000),
    prorationAmountCents: 2000,
    nextBillingAt: new Date(periodEnd * 1000).toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + 300,
  });
  await db.insert(stripeBillingOperations).values({
    id: "op_stale_preview",
    userId,
    subscriptionId: "sub_recovery",
    kind: "switch",
    fromPlan: "INDIVIDUAL_PRO",
    targetPlan: "ARCHITECT",
    targetVersion: 1,
    payload: { sourcePriceId: "price_from_stale_preview", prorationAmountCents: 1000 },
  });
  let injected = false;

  try {
    const result = await switchStripePlanForUser(
      { userId, previewToken },
      {
        stripeClient: stripe,
        beforeProviderMutation: async () => {
          if (!injected) {
            injected = true;
            throw new Error("forced failure before Stripe mutation");
          }
        },
      },
    );
    assert.equal(result.plan, "ARCHITECT");
    assert.equal(providerUpdates, 1);
    const local = (await db.select().from(users).where(eq(users.id, userId)))[0];
    assert.equal(local.subscriptionPlan, "ARCHITECT");
    assert.equal(local.stripeSubscriptionVersion, 1);
    const operations = await db.select().from(stripeBillingOperations)
      .where(eq(stripeBillingOperations.userId, userId));
    assert.equal(operations.length, 2);
    assert.equal(operations.find((operation) => operation.id === "op_stale_preview")?.status, "superseded");
    assert.equal(operations.find((operation) => operation.id !== "op_stale_preview")?.status, "completed");
  } finally {
    await db.delete(billingEvents).where(eq(billingEvents.userId, userId));
    await db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("invoice events cannot overwrite a scheduled cancellation", async () => {
  const userId = "stripe-cancel-invoice-order";
  const eventIds = ["evt_cancel_invoice_success", "evt_cancel_invoice_failed"];
  await db.delete(billingEvents).where(eq(billingEvents.userId, userId));
  await db.delete(stripeWebhookEvents).where(inArray(stripeWebhookEvents.id, eventIds));
  await db.delete(users).where(eq(users.id, userId));
  await db.insert(users).values({
    id: userId,
    name: "Canceling Owner",
    username: userId,
    password: "not-used",
    subscriptionPlan: "INDIVIDUAL_PRO",
    subscriptionStatus: "canceling",
    subscriptionCanceledAt: new Date(),
    stripeCustomerId: "cus_cancel_order",
    stripeSubscriptionId: "sub_cancel_order",
  });
  const invoiceEvent = (id: string, type: "invoice.payment_succeeded" | "invoice.payment_failed") => ({
    id,
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object: {
      id: `in_${id}`,
      customer: "cus_cancel_order",
      subscription: "sub_cancel_order",
      amount_paid: 2900,
    } },
  }) as unknown as Stripe.Event;
  try {
    await processStripeEvent(invoiceEvent(eventIds[0], "invoice.payment_succeeded"));
    await processStripeEvent(invoiceEvent(eventIds[1], "invoice.payment_failed"));
    assert.equal((await db.select().from(users).where(eq(users.id, userId)))[0].subscriptionStatus, "canceling");
  } finally {
    await db.delete(billingEvents).where(eq(billingEvents.userId, userId));
    await db.delete(stripeWebhookEvents).where(inArray(stripeWebhookEvents.id, eventIds));
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("cancellation rejects an ownership mismatch before updating Stripe", async () => {
  const userId = "stripe-cancel-ownership";
  await db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await db.insert(users).values({
    id: userId,
    name: "Cancel Owner",
    username: userId,
    password: "not-used",
    subscriptionPlan: "INDIVIDUAL_PRO",
    stripeCustomerId: "cus_expected",
    stripeSubscriptionId: "sub_misbound",
    entitlementSource: "provider",
    entitlementVerificationStatus: "verified",
  });
  let updates = 0;
  const stripe = {
    subscriptions: {
      retrieve: async () => ({
        id: "sub_misbound",
        customer: "cus_other",
        status: "active",
        cancel_at_period_end: false,
        metadata: { userId: "another-user", planVersion: "0" },
        items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86_400 }] },
      }),
      update: async () => {
        updates += 1;
        throw new Error("must not update");
      },
    },
  } as unknown as Stripe;
  try {
    await assert.rejects(() => cancelStripePlanForUser(userId, 0, { stripeClient: stripe }), /ownership/i);
    assert.equal(updates, 0);
  } finally {
    await db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("cancellation reconciles a newer provider version without mutating Stripe", async () => {
  const userId = "stripe-cancel-provider-ahead";
  await db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await db.insert(users).values({
    id: userId,
    name: "Provider Ahead Owner",
    username: userId,
    password: "not-used",
    subscriptionPlan: "INDIVIDUAL_PRO",
    subscriptionStatus: "active",
    stripeCustomerId: "cus_provider_ahead",
    stripeSubscriptionId: "sub_provider_ahead",
    entitlementSource: "provider",
    entitlementVerificationStatus: "verified",
    stripeSubscriptionVersion: 0,
  });
  const provider = {
    id: "sub_provider_ahead",
    customer: "cus_provider_ahead",
    status: "past_due",
    cancel_at_period_end: false,
    metadata: { userId, plan: "ARCHITECT", planVersion: "2", billingInterval: "month" },
    items: { data: [{
      current_period_end: Math.floor(Date.now() / 1000) + 86_400,
      price: { id: "price_architect", recurring: { interval: "month" } },
    }] },
  } as unknown as Stripe.Subscription;
  let updates = 0;
  const stripe = {
    subscriptions: {
      retrieve: async () => provider,
      update: async () => {
        updates += 1;
        return provider;
      },
    },
  } as unknown as Stripe;
  try {
    await assert.rejects(
      () => cancelStripePlanForUser(userId, 0, { stripeClient: stripe }),
      (error: any) => error?.code === "SUBSCRIPTION_VERSION_CONFLICT",
    );
    assert.equal(updates, 0);
    const local = (await db.select().from(users).where(eq(users.id, userId)))[0];
    assert.equal(local.subscriptionPlan, "ARCHITECT");
    assert.equal(local.subscriptionStatus, "past_due");
    assert.equal(local.stripeSubscriptionVersion, 2);
    assert.equal((await db.select().from(stripeBillingOperations)
      .where(eq(stripeBillingOperations.userId, userId)))[0].status, "superseded");
  } finally {
    await db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("billing recovery health surfaces old pending operations with safe retry metadata", async () => {
  const userId = "stripe-stuck-recovery-owner";
  const operationId = "stripe-stuck-recovery-operation";
  const now = new Date("2026-09-06T12:30:00.000Z");
  await db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.id, operationId));
  await db.delete(users).where(eq(users.id, userId));
  await db.insert(users).values({
    id: userId,
    name: "Recovery Owner",
    username: userId,
    password: "not-used",
    stripeCustomerId: "cus_recovery",
    stripeSubscriptionId: "sub_recovery",
  });
  await db.insert(stripeBillingOperations).values({
    id: operationId,
    userId,
    subscriptionId: "sub_recovery",
    kind: "cancel",
    fromPlan: "INDIVIDUAL_PRO",
    targetVersion: 1,
    createdAt: new Date("2026-09-06T12:00:00.000Z"),
  });
  const stripe = {
    subscriptions: {
      retrieve: async () => {
        throw Object.assign(new Error("secret provider detail sk_test_must_not_surface"), { status: 503 });
      },
    },
  } as unknown as Stripe;
  const alerts: Array<Awaited<ReturnType<typeof getStripeBillingRecoveryHealth>>> = [];
  try {
    assert.equal(await resumePendingStripeBillingOperations(stripe, userId, health => alerts.push(health)), 0);
    assert.equal(await resumePendingStripeBillingOperations(stripe, userId, health => alerts.push(health)), 0);
    const [storedOperation] = await db.select().from(stripeBillingOperations)
      .where(eq(stripeBillingOperations.id, operationId));
    assert.equal(storedOperation.lastError, "Billing recovery failed (provider_unavailable).");
    assert.equal(storedOperation.lastError.includes("sk_test"), false);
    const health = await getStripeBillingRecoveryHealth(now);
    assert.equal(health.ok, false);
    assert.equal(health.stuckCount, 1);
    assert.deepEqual(health.stuckOperations, [{
      operationId,
      kind: "cancel",
      ageSeconds: 1800,
      recoveryAttempts: 2,
      errorCategory: "provider_unavailable",
    }]);
    assert.equal(JSON.stringify(health).includes("secret provider detail"), false);
    assert.equal(alerts.length, 2);
    assert.equal(alerts[1].stuckOperations[0].operationId, operationId);
    assert.equal(JSON.stringify(alerts).includes("secret provider detail"), false);
  } finally {
    await db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.id, operationId));
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("billing recovery monitor alerts once per unhealthy operation state and re-arms after recovery", async () => {
  stopStripeBillingRecoveryMonitor();
  const unhealthy = {
    ok: false,
    stuckOperations: [{
      operationId: "op_stuck",
      recoveryAttempts: 3,
      errorCategory: "provider_unavailable",
    }],
  };
  const healthy = { ok: true, stuckOperations: [] };
  const alerts: typeof unhealthy[] = [];
  await pollStripeBillingRecoveryHealth({
    getHealth: async () => unhealthy,
    alertMaintainers: health => alerts.push(health as typeof unhealthy),
  });
  await pollStripeBillingRecoveryHealth({
    getHealth: async () => unhealthy,
    alertMaintainers: health => alerts.push(health as typeof unhealthy),
  });
  assert.equal(alerts.length, 1);
  await pollStripeBillingRecoveryHealth({ getHealth: async () => healthy });
  await pollStripeBillingRecoveryHealth({
    getHealth: async () => unhealthy,
    alertMaintainers: health => alerts.push(health as typeof unhealthy),
  });
  assert.equal(alerts.length, 2);
  stopStripeBillingRecoveryMonitor();
});
