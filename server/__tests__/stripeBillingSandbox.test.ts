import { test } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";
import {
  billingEvents,
  F1000_PROMO,
  stripeBillingOperations,
  stripeWebhookEvents,
  users,
  type SubscriptionPlan,
} from "@shared/schema";
import { priceCentsForPlan } from "../billing";
import { db } from "../db";
import { getStripeClient } from "../stripeClient";
import {
  cancelStripePlanForUser,
  previewStripePlanForUser,
  processStripeEvent,
  switchStripePlanForUser,
} from "../stripeBilling";
import {
  ensureF1000PromotionalPrices,
  ensureStripePlanPrices,
} from "../../scripts/seedStripePlans";

const runSandbox = process.env.STRIPE_SANDBOX_TESTS === "1";

test("Stripe sandbox fixture preparation refuses live mode before creating products or prices", async () => {
  let productCreateCalls = 0;
  let priceCreateCalls = 0;
  const stripe = {
    balance: {
      retrieve: async () => ({ livemode: true }),
    },
    products: {
      create: async () => {
        productCreateCalls += 1;
      },
    },
    prices: {
      create: async () => {
        priceCreateCalls += 1;
      },
    },
  } as unknown as Stripe;

  await assert.rejects(
    ensureStripePlanPrices(stripe, [{ plan: "INDIVIDUAL_PRO", billingInterval: "month" }]),
    /Refusing to prepare Stripe plan fixtures in live mode\./,
  );
  assert.equal(productCreateCalls, 0);
  assert.equal(priceCreateCalls, 0);
});



test("Stripe sandbox keeps overlapping F1000 promotional seed preparation unique", {
  skip: runSandbox ? false : "Set STRIPE_SANDBOX_TESTS=1 to run provider-backed Stripe tests.",
  timeout: 120_000,
}, async () => {
  const stripe = await getStripeClient();
  const plan: SubscriptionPlan = "INDIVIDUAL_PRO";
  const balance = await stripe.balance.retrieve();
  assert.equal(balance.livemode, false, "This destructive integration test must only run in a Stripe sandbox.");

  const planPrices = await ensureStripePlanPrices(stripe, [
    { plan, billingInterval: "month" },
    { plan, billingInterval: "year" },
  ]);
  const monthlyPlanPrice = planPrices.get(`${plan}:month`);
  assert.ok(monthlyPlanPrice, `Missing prepared ${plan} monthly price.`);
  const productId = typeof monthlyPlanPrice.product === "string"
    ? monthlyPlanPrice.product
    : monthlyPlanPrice.product.id;
  const product = await stripe.products.retrieve(productId);
  assert.equal(product.deleted, undefined, `Expected an active sandbox product for ${plan}.`);

  const [first, second] = await Promise.all([
    ensureF1000PromotionalPrices(stripe, plan, product),
    ensureF1000PromotionalPrices(stripe, plan, product),
  ]);

  for (const billingInterval of ["month", "year"] as const) {
    assert.equal(
      first.get(billingInterval)?.id,
      second.get(billingInterval)?.id,
      `Overlapping ${billingInterval} preparation must resolve to the same Stripe price.`,
    );
  }

  const activePrices = await stripe.prices.list({
    product: product.id,
    active: true,
    type: "recurring",
    limit: 100,
  });
  const promoPrice = F1000_PROMO.priceUsd[plan];
  assert.ok(promoPrice != null, `Missing F1000 promotional price for ${plan}.`);
  const expectedAmounts = {
    month: promoPrice * 100,
    year: promoPrice * 1000,
  };

  for (const billingInterval of ["month", "year"] as const) {
    const matching = activePrices.data.filter((price) =>
      price.currency === "usd" &&
      price.unit_amount === expectedAmounts[billingInterval] &&
      price.recurring?.interval === billingInterval);
    assert.equal(
      matching.length,
      1,
      `Expected exactly one active F1000 ${billingInterval} price for ${plan}.`,
    );
    assert.equal(matching[0].id, first.get(billingInterval)?.id);
  }
});

test("Stripe sandbox keeps simultaneous monthly and annual cancellation/plan switches consistent", {
  skip: runSandbox ? false : "Set STRIPE_SANDBOX_TESTS=1 to run provider-backed Stripe tests.",
  timeout: 120_000,
}, async () => {
  const stripe = await getStripeClient();
  const initialPlan: SubscriptionPlan = "INDIVIDUAL_PRO";
  const targetPlan: SubscriptionPlan = "ARCHITECT";

  const balance = await stripe.balance.retrieve();
  assert.equal(balance.livemode, false, "This destructive integration test must only run in a Stripe sandbox.");
  const prices = await ensureStripePlanPrices(
    stripe,
    [initialPlan, targetPlan].flatMap((plan) =>
      (["month", "year"] as const).map((billingInterval) => ({ plan, billingInterval }))),
  );

  for (const billingInterval of ["month", "year"] as const) {
    const userId = `stripe-race-${billingInterval}-${Date.now()}`;
    const eventIds = [
      `evt_race_initial_${billingInterval}_${Date.now()}`,
      `evt_race_winner_${billingInterval}_${Date.now()}`,
      `evt_race_invoice_${billingInterval}_${Date.now()}`,
    ];
    let customerId: string | undefined;
    let subscriptionId: string | undefined;
    try {
      const initialPrice = prices.get(`${initialPlan}:${billingInterval}`);
      assert.ok(initialPrice, `Missing prepared ${initialPlan} ${billingInterval} price.`);
      const customer = await stripe.customers.create({
        name: "ARK billing concurrency test",
        metadata: { test: "stripe-billing-race", userId },
        payment_method: "pm_card_visa",
        invoice_settings: { default_payment_method: "pm_card_visa" },
      });
      customerId = customer.id;
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: initialPrice.id }],
        metadata: { userId, plan: initialPlan, billingInterval, planVersion: "0", test: "stripe-billing-race" },
        payment_behavior: "error_if_incomplete",
      });
      subscriptionId = subscription.id;

      await db.insert(users).values({
        id: userId,
        name: "Stripe Race Owner",
        username: userId,
        password: "not-used",
        subscriptionPlan: initialPlan,
        subscriptionStatus: "active",
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        entitlementSource: "provider",
        entitlementVerificationStatus: "verified",
        stripeSubscriptionVersion: 0,
      });

      const preview = await previewStripePlanForUser({
        userId,
        plan: targetPlan,
        billingInterval,
      });
      const outcomes = await Promise.allSettled([
        cancelStripePlanForUser(userId, 0),
        switchStripePlanForUser({ userId, previewToken: preview.previewToken }),
      ]);
      assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
      const rejected = outcomes.find((result): result is PromiseRejectedResult => result.status === "rejected");
      assert.equal(rejected?.reason?.status, 409);
      assert.ok(
        rejected?.reason?.code === "SUBSCRIPTION_VERSION_CONFLICT" ||
        rejected?.reason?.code === "PREVIEW_STALE",
      );

      const provider = await stripe.subscriptions.retrieve(subscription.id);
      const local = (await db.select().from(users).where(eq(users.id, userId)))[0];
      assert.equal(local.stripeSubscriptionVersion, Number(provider.metadata.planVersion));
      assert.equal(local.subscriptionCanceledAt != null, provider.cancel_at_period_end);
      assert.equal(local.subscriptionStatus, provider.cancel_at_period_end ? "canceling" : "active");
      assert.equal(local.subscriptionPlan, provider.metadata.plan);

      assert.equal(provider.items.data[0].price.recurring?.interval, billingInterval);
      assert.equal(provider.metadata.billingInterval, billingInterval);
      assert.equal(
        provider.items.data[0].price.unit_amount,
        priceCentsForPlan(local.subscriptionPlan as SubscriptionPlan, false, billingInterval),
      );

      const initialReplay = {
      id: eventIds[0],
      created: Math.max(1, Math.floor(Date.now() / 1000) - 60),
      type: "customer.subscription.updated",
      data: { object: {
        ...provider,
        cancel_at_period_end: false,
        metadata: { ...provider.metadata, plan: initialPlan, planVersion: "0" },
        items: { data: [{ ...provider.items.data[0], price: initialPrice }] },
      } },
      } as unknown as Stripe.Event;
      const winnerReplay = {
      id: eventIds[1],
      created: Math.floor(Date.now() / 1000),
      type: "customer.subscription.updated",
      data: { object: provider },
      } as unknown as Stripe.Event;
      const invoiceReplay = {
      id: eventIds[2],
      created: Math.floor(Date.now() / 1000),
      type: "invoice.payment_succeeded",
      data: { object: {
        id: `in_race_${Date.now()}`,
        customer: customer.id,
        subscription: subscription.id,
        amount_paid: initialPrice.unit_amount,
      } },
      } as unknown as Stripe.Event;
      assert.equal(await processStripeEvent(initialReplay), "processed");
      assert.equal(await processStripeEvent(invoiceReplay), "processed");
      assert.equal(await processStripeEvent(winnerReplay), "processed");
      assert.equal(await processStripeEvent(winnerReplay), "duplicate");

      const afterReplay = (await db.select().from(users).where(eq(users.id, userId)))[0];
      assert.equal(afterReplay.subscriptionPlan, local.subscriptionPlan);
      assert.equal(afterReplay.subscriptionStatus, local.subscriptionStatus);
      assert.equal(afterReplay.stripeSubscriptionVersion, local.stripeSubscriptionVersion);
    } finally {
      const cleanupFailures: unknown[] = [];
      const attemptCleanup = async (cleanup: () => Promise<unknown>) => {
        try {
          await cleanup();
        } catch (error) {
          cleanupFailures.push(error);
        }
      };

      await attemptCleanup(() => db.delete(billingEvents).where(eq(billingEvents.userId, userId)));
      await attemptCleanup(() => db.delete(stripeWebhookEvents).where(inArray(stripeWebhookEvents.id, eventIds)));
      await attemptCleanup(() => db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.userId, userId)));
      await attemptCleanup(() => db.delete(users).where(eq(users.id, userId)));
      if (subscriptionId) await attemptCleanup(() => stripe.subscriptions.cancel(subscriptionId));
      if (customerId) await attemptCleanup(() => stripe.customers.del(customerId));

      if (cleanupFailures.length > 0) {
        throw new AggregateError(cleanupFailures, "Stripe sandbox test cleanup failed.");
      }
    }
  }
});

test("Stripe sandbox keeps duplicate concurrent cancellations idempotent", {
  skip: runSandbox ? false : "Set STRIPE_SANDBOX_TESTS=1 to run provider-backed Stripe tests.",
  timeout: 120_000,
}, async () => {
  const stripe = await getStripeClient();
  const plan: SubscriptionPlan = "INDIVIDUAL_PRO";
  const billingInterval = "month";
  const userId = `stripe-duplicate-cancel-${Date.now()}`;
  let customerId: string | undefined;
  let subscriptionId: string | undefined;

  const balance = await stripe.balance.retrieve();
  assert.equal(balance.livemode, false, "This destructive integration test must only run in a Stripe sandbox.");

  try {
    const prices = await ensureStripePlanPrices(stripe, [{ plan, billingInterval }]);
    const price = prices.get(`${plan}:${billingInterval}`);
    assert.ok(price, `Missing prepared ${plan} ${billingInterval} price.`);

    const customer = await stripe.customers.create({
      name: "ARK duplicate cancellation test",
      metadata: { test: "stripe-duplicate-cancel", userId },
      payment_method: "pm_card_visa",
      invoice_settings: { default_payment_method: "pm_card_visa" },
    });
    customerId = customer.id;
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      metadata: {
        userId,
        plan,
        billingInterval,
        planVersion: "0",
        test: "stripe-duplicate-cancel",
      },
      payment_behavior: "error_if_incomplete",
    });
    subscriptionId = subscription.id;
    assert.equal(subscription.status, "active");
    assert.equal(subscription.cancel_at_period_end, false);

    await db.insert(users).values({
      id: userId,
      name: "Stripe Duplicate Cancellation Owner",
      username: userId,
      password: "not-used",
      subscriptionPlan: plan,
      subscriptionStatus: "active",
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      entitlementSource: "provider",
      entitlementVerificationStatus: "verified",
      stripeSubscriptionVersion: 0,
    });

    const [first, second] = await Promise.all([
      cancelStripePlanForUser(userId, 0),
      cancelStripePlanForUser(userId, 0),
    ]);

    assert.equal(first.effectiveAt.toISOString(), second.effectiveAt.toISOString());
    assert.equal(first.plan, plan);
    assert.equal(second.plan, plan);

    const provider = await stripe.subscriptions.retrieve(subscription.id);
    assert.equal(provider.status, "active");
    assert.equal(provider.cancel_at_period_end, true);
    assert.equal(provider.metadata.planVersion, "1");
    assert.equal(
      first.effectiveAt.toISOString(),
      new Date(provider.items.data[0].current_period_end * 1000).toISOString(),
    );

    const [local] = await db.select().from(users).where(eq(users.id, userId));
    assert.equal(local.subscriptionStatus, "canceling");
    assert.equal(local.stripeSubscriptionVersion, 1);
    assert.equal(local.subscriptionCurrentPeriodEnd?.toISOString(), first.effectiveAt.toISOString());

    const operations = await db.select().from(stripeBillingOperations)
      .where(eq(stripeBillingOperations.userId, userId));
    assert.equal(operations.length, 1);
    assert.equal(operations[0].kind, "cancel");
    assert.equal(operations[0].status, "completed");
  } finally {
    const cleanupFailures: unknown[] = [];
    const attemptCleanup = async (cleanup: () => Promise<unknown>) => {
      try {
        await cleanup();
      } catch (error) {
        cleanupFailures.push(error);
      }
    };

    await attemptCleanup(() => db.delete(billingEvents).where(eq(billingEvents.userId, userId)));
    await attemptCleanup(() => db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.userId, userId)));
    await attemptCleanup(() => db.delete(users).where(eq(users.id, userId)));
    if (subscriptionId) await attemptCleanup(() => stripe.subscriptions.cancel(subscriptionId));
    if (customerId) await attemptCleanup(() => stripe.customers.del(customerId));

    if (cleanupFailures.length > 0) {
      throw new AggregateError(cleanupFailures, "Stripe duplicate cancellation sandbox cleanup failed.");
    }
  }
});

test("Stripe sandbox keeps duplicate concurrent plan changes idempotent", {
  skip: runSandbox ? false : "Set STRIPE_SANDBOX_TESTS=1 to run provider-backed Stripe tests.",
  timeout: 120_000,
}, async () => {
  const stripe = await getStripeClient();
  const initialPlan: SubscriptionPlan = "INDIVIDUAL_PRO";
  const targetPlan: SubscriptionPlan = "ARCHITECT";
  const initialBillingInterval = "month";
  const targetBillingInterval = "year";
  const userId = `stripe-duplicate-switch-${Date.now()}`;
  let customerId: string | undefined;
  let subscriptionId: string | undefined;

  const balance = await stripe.balance.retrieve();
  assert.equal(balance.livemode, false, "This destructive integration test must only run in a Stripe sandbox.");

  try {
    const prices = await ensureStripePlanPrices(stripe, [
      { plan: initialPlan, billingInterval: initialBillingInterval },
      { plan: targetPlan, billingInterval: targetBillingInterval },
    ]);
    const initialPrice = prices.get(`${initialPlan}:${initialBillingInterval}`);
    const targetPrice = prices.get(`${targetPlan}:${targetBillingInterval}`);
    assert.ok(initialPrice, `Missing prepared ${initialPlan} ${initialBillingInterval} price.`);
    assert.ok(targetPrice, `Missing prepared ${targetPlan} ${targetBillingInterval} price.`);

    const customer = await stripe.customers.create({
      name: "ARK duplicate plan change test",
      metadata: { test: "stripe-duplicate-switch", userId },
      payment_method: "pm_card_visa",
      invoice_settings: { default_payment_method: "pm_card_visa" },
    });
    customerId = customer.id;
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: initialPrice.id }],
      metadata: {
        userId,
        plan: initialPlan,
        billingInterval: initialBillingInterval,
        planVersion: "0",
        test: "stripe-duplicate-switch",
      },
      payment_behavior: "error_if_incomplete",
    });
    subscriptionId = subscription.id;
    assert.equal(subscription.status, "active");

    await db.insert(users).values({
      id: userId,
      name: "Stripe Duplicate Plan Change Owner",
      username: userId,
      password: "not-used",
      subscriptionPlan: initialPlan,
      subscriptionStatus: "active",
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      entitlementSource: "provider",
      entitlementVerificationStatus: "verified",
      stripeSubscriptionVersion: 0,
    });

    const preview = await previewStripePlanForUser({
      userId,
      plan: targetPlan,
      billingInterval: targetBillingInterval,
    });
    const [first, second] = await Promise.all([
      switchStripePlanForUser({ userId, previewToken: preview.previewToken }),
      switchStripePlanForUser({ userId, previewToken: preview.previewToken }),
    ]);

    assert.equal(first.plan, targetPlan);
    assert.equal(second.plan, targetPlan);
    assert.equal(first.nextBillingAt.toISOString(), second.nextBillingAt.toISOString());
    assert.equal(first.prorationAmountCents, preview.prorationAmountCents);
    assert.equal(second.prorationAmountCents, preview.prorationAmountCents);
    assert.equal(first.currency, second.currency);

    const provider = await stripe.subscriptions.retrieve(subscription.id);
    assert.equal(provider.status, "active");
    assert.equal(provider.cancel_at_period_end, false);
    assert.equal(provider.metadata.plan, targetPlan);
    assert.equal(provider.metadata.billingInterval, targetBillingInterval);
    assert.equal(provider.metadata.planVersion, "1");
    assert.equal(provider.items.data.length, 1);
    assert.equal(provider.items.data[0].price.id, targetPrice.id);
    assert.equal(provider.items.data[0].price.recurring?.interval, targetBillingInterval);
    assert.equal(
      first.nextBillingAt.toISOString(),
      new Date(provider.items.data[0].current_period_end * 1000).toISOString(),
    );

    const [local] = await db.select().from(users).where(eq(users.id, userId));
    assert.equal(local.subscriptionPlan, targetPlan);
    assert.equal(local.subscriptionStatus, "active");
    assert.equal(local.stripeSubscriptionVersion, 1);
    assert.equal(local.subscriptionCurrentPeriodEnd?.toISOString(), first.nextBillingAt.toISOString());

    const operations = await db.select().from(stripeBillingOperations)
      .where(eq(stripeBillingOperations.userId, userId));
    assert.equal(operations.length, 1);
    assert.equal(operations[0].kind, "switch");
    assert.equal(operations[0].status, "completed");
    assert.equal(operations[0].targetPlan, targetPlan);
    assert.equal(
      (operations[0].payload as { prorationAmountCents?: number }).prorationAmountCents,
      preview.prorationAmountCents,
    );
  } finally {
    const cleanupFailures: unknown[] = [];
    const attemptCleanup = async (cleanup: () => Promise<unknown>) => {
      try {
        await cleanup();
      } catch (error) {
        cleanupFailures.push(error);
      }
    };

    await attemptCleanup(() => db.delete(billingEvents).where(eq(billingEvents.userId, userId)));
    await attemptCleanup(() => db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.userId, userId)));
    await attemptCleanup(() => db.delete(users).where(eq(users.id, userId)));
    if (subscriptionId) await attemptCleanup(() => stripe.subscriptions.cancel(subscriptionId));
    if (customerId) await attemptCleanup(() => stripe.customers.del(customerId));

    if (cleanupFailures.length > 0) {
      throw new AggregateError(cleanupFailures, "Stripe duplicate plan change sandbox cleanup failed.");
    }
  }
});

test("Stripe sandbox lets only one of two different concurrent plan changes reach Stripe", {
  skip: runSandbox ? false : "Set STRIPE_SANDBOX_TESTS=1 to run provider-backed Stripe tests.",
  timeout: 120_000,
}, async () => {
  const stripe = await getStripeClient();
  const initialPlan: SubscriptionPlan = "INDIVIDUAL_PRO";
  const initialBillingInterval = "month";
  const targets = [
    { plan: "ARCHITECT" as const, billingInterval: "year" as const },
    { plan: "SCHOOL_STUDENT" as const, billingInterval: "month" as const, institution: "Stripe Race School" },
  ];
  const userId = `stripe-competing-switch-${Date.now()}`;
  let customerId: string | undefined;
  let subscriptionId: string | undefined;

  const balance = await stripe.balance.retrieve();
  assert.equal(balance.livemode, false, "This destructive integration test must only run in a Stripe sandbox.");

  try {
    const prices = await ensureStripePlanPrices(stripe, [
      { plan: initialPlan, billingInterval: initialBillingInterval },
      ...targets.map(({ plan, billingInterval }) => ({ plan, billingInterval })),
    ]);
    const initialPrice = prices.get(`${initialPlan}:${initialBillingInterval}`);
    assert.ok(initialPrice, `Missing prepared ${initialPlan} ${initialBillingInterval} price.`);

    const customer = await stripe.customers.create({
      name: "ARK competing plan change test",
      metadata: { test: "stripe-competing-switch", userId },
      payment_method: "pm_card_visa",
      invoice_settings: { default_payment_method: "pm_card_visa" },
    });
    customerId = customer.id;
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: initialPrice.id }],
      metadata: {
        userId,
        plan: initialPlan,
        billingInterval: initialBillingInterval,
        planVersion: "0",
        test: "stripe-competing-switch",
      },
      payment_behavior: "error_if_incomplete",
    });
    subscriptionId = subscription.id;
    assert.equal(subscription.status, "active");

    await db.insert(users).values({
      id: userId,
      name: "Stripe Competing Plan Change Owner",
      username: userId,
      password: "not-used",
      subscriptionPlan: initialPlan,
      subscriptionStatus: "active",
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      entitlementSource: "provider",
      entitlementVerificationStatus: "verified",
      stripeSubscriptionVersion: 0,
    });

    const previews = await Promise.all(targets.map((target) =>
      previewStripePlanForUser({ userId, ...target })));
    const outcomes = await Promise.allSettled(previews.map((preview) =>
      switchStripePlanForUser({ userId, previewToken: preview.previewToken })));

    const fulfilled = outcomes.filter(
      (outcome): outcome is PromiseFulfilledResult<Awaited<ReturnType<typeof switchStripePlanForUser>>> =>
        outcome.status === "fulfilled",
    );
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected",
    );
    assert.equal(fulfilled.length, 1, "Exactly one competing plan confirmation must succeed.");
    assert.equal(rejected.length, 1, "Exactly one competing plan confirmation must lose.");
    assert.equal(rejected[0].reason?.status, 409);
    assert.equal(rejected[0].reason?.code, "SUBSCRIPTION_VERSION_CONFLICT");

    const winner = targets.find((target) => target.plan === fulfilled[0].value.plan);
    assert.ok(winner, "The successful response must identify one of the accepted targets.");
    const winningPrice = prices.get(`${winner.plan}:${winner.billingInterval}`);
    assert.ok(winningPrice, `Missing prepared ${winner.plan} ${winner.billingInterval} price.`);

    const provider = await stripe.subscriptions.retrieve(subscription.id);
    const [local] = await db.select().from(users).where(eq(users.id, userId));
    const operations = await db.select().from(stripeBillingOperations)
      .where(eq(stripeBillingOperations.userId, userId));

    assert.equal(operations.length, 1, "The losing confirmation must not reserve a second operation.");
    assert.equal(operations[0].status, "completed");
    assert.equal(operations[0].targetPlan, winner.plan);
    assert.equal(
      (operations[0].payload as { targetBillingInterval?: string }).targetBillingInterval,
      winner.billingInterval,
    );

    assert.equal(provider.metadata.plan, winner.plan);
    assert.equal(provider.metadata.billingInterval, winner.billingInterval);
    assert.equal(provider.metadata.planVersion, "1");
    assert.equal(provider.items.data.length, 1);
    assert.equal(provider.items.data[0].price.id, winningPrice.id);
    assert.equal(provider.items.data[0].price.recurring?.interval, winner.billingInterval);

    assert.equal(local.subscriptionPlan, winner.plan);
    assert.equal(local.subscriptionStatus, "active");
    assert.equal(local.stripeSubscriptionVersion, 1);
    assert.equal(
      local.subscriptionCurrentPeriodEnd?.toISOString(),
      new Date(provider.items.data[0].current_period_end * 1000).toISOString(),
    );
  } finally {
    const cleanupFailures: unknown[] = [];
    const attemptCleanup = async (cleanup: () => Promise<unknown>) => {
      try {
        await cleanup();
      } catch (error) {
        cleanupFailures.push(error);
      }
    };

    await attemptCleanup(() => db.delete(billingEvents).where(eq(billingEvents.userId, userId)));
    await attemptCleanup(() => db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.userId, userId)));
    await attemptCleanup(() => db.delete(users).where(eq(users.id, userId)));
    if (subscriptionId) await attemptCleanup(() => stripe.subscriptions.cancel(subscriptionId));
    if (customerId) await attemptCleanup(() => stripe.customers.del(customerId));

    if (cleanupFailures.length > 0) {
      throw new AggregateError(cleanupFailures, "Stripe competing plan change sandbox cleanup failed.");
    }
  }
});

test("Stripe sandbox recovers an interrupted plan change without a second proration", {
  skip: runSandbox ? false : "Set STRIPE_SANDBOX_TESTS=1 to run provider-backed Stripe tests.",
  timeout: 120_000,
}, async () => {
  const stripe = await getStripeClient();
  const initialPlan: SubscriptionPlan = "INDIVIDUAL_PRO";
  const targetPlan: SubscriptionPlan = "ARCHITECT";
  const initialBillingInterval = "month";
  const targetBillingInterval = "year";
  const userId = `stripe-interrupted-switch-${Date.now()}`;
  let customerId: string | undefined;
  let subscriptionId: string | undefined;

  const balance = await stripe.balance.retrieve();
  assert.equal(balance.livemode, false, "This destructive integration test must only run in a Stripe sandbox.");

  try {
    const prices = await ensureStripePlanPrices(stripe, [
      { plan: initialPlan, billingInterval: initialBillingInterval },
      { plan: targetPlan, billingInterval: targetBillingInterval },
    ]);
    const initialPrice = prices.get(`${initialPlan}:${initialBillingInterval}`);
    const targetPrice = prices.get(`${targetPlan}:${targetBillingInterval}`);
    assert.ok(initialPrice, `Missing prepared ${initialPlan} ${initialBillingInterval} price.`);
    assert.ok(targetPrice, `Missing prepared ${targetPlan} ${targetBillingInterval} price.`);

    const customer = await stripe.customers.create({
      name: "ARK interrupted plan change test",
      metadata: { test: "stripe-interrupted-switch", userId },
      payment_method: "pm_card_visa",
      invoice_settings: { default_payment_method: "pm_card_visa" },
    });
    customerId = customer.id;
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: initialPrice.id }],
      metadata: {
        userId,
        plan: initialPlan,
        billingInterval: initialBillingInterval,
        planVersion: "0",
        test: "stripe-interrupted-switch",
      },
      payment_behavior: "error_if_incomplete",
    });
    subscriptionId = subscription.id;
    assert.equal(subscription.status, "active");

    await db.insert(users).values({
      id: userId,
      name: "Stripe Interrupted Plan Change Owner",
      username: userId,
      password: "not-used",
      subscriptionPlan: initialPlan,
      subscriptionStatus: "active",
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      entitlementSource: "provider",
      entitlementVerificationStatus: "verified",
      stripeSubscriptionVersion: 0,
    });

    const preview = await previewStripePlanForUser({
      userId,
      plan: targetPlan,
      billingInterval: targetBillingInterval,
    });
    const interruption = new Error("Simulated request interruption after Stripe accepted the plan change.");
    await assert.rejects(
      switchStripePlanForUser(
        { userId, previewToken: preview.previewToken },
        { afterProviderMutation: async () => { throw interruption; } },
      ),
      (error) => error === interruption,
    );

    const providerAfterInterruption = await stripe.subscriptions.retrieve(subscription.id);
    assert.equal(providerAfterInterruption.metadata.plan, targetPlan);
    assert.equal(providerAfterInterruption.metadata.billingInterval, targetBillingInterval);
    assert.equal(providerAfterInterruption.metadata.planVersion, "1");
    assert.equal(providerAfterInterruption.items.data.length, 1);
    assert.equal(providerAfterInterruption.items.data[0].price.id, targetPrice.id);

    const [localAfterInterruption] = await db.select().from(users).where(eq(users.id, userId));
    assert.equal(localAfterInterruption.subscriptionPlan, initialPlan);
    assert.equal(localAfterInterruption.stripeSubscriptionVersion, 0);
    const [pendingOperation] = await db.select().from(stripeBillingOperations)
      .where(eq(stripeBillingOperations.userId, userId));
    assert.equal(pendingOperation.status, "pending");

    const recovered = await switchStripePlanForUser({
      userId,
      previewToken: preview.previewToken,
    });
    assert.equal(recovered.plan, targetPlan);
    assert.equal(recovered.prorationAmountCents, preview.prorationAmountCents);
    assert.equal(recovered.currency, preview.currency);
    assert.equal(
      recovered.nextBillingAt.toISOString(),
      new Date(providerAfterInterruption.items.data[0].current_period_end * 1000).toISOString(),
    );

    const providerAfterRetry = await stripe.subscriptions.retrieve(subscription.id);
    assert.equal(providerAfterRetry.id, providerAfterInterruption.id);
    assert.equal(providerAfterRetry.items.data.length, 1);
    assert.equal(providerAfterRetry.items.data[0].id, providerAfterInterruption.items.data[0].id);
    assert.equal(providerAfterRetry.items.data[0].price.id, providerAfterInterruption.items.data[0].price.id);
    assert.equal(providerAfterRetry.metadata.planVersion, providerAfterInterruption.metadata.planVersion);
    assert.equal(
      providerAfterRetry.items.data[0].current_period_end,
      providerAfterInterruption.items.data[0].current_period_end,
    );

    const [localAfterRetry] = await db.select().from(users).where(eq(users.id, userId));
    assert.equal(localAfterRetry.subscriptionPlan, targetPlan);
    assert.equal(localAfterRetry.subscriptionStatus, "active");
    assert.equal(localAfterRetry.stripeSubscriptionVersion, 1);

    const [completedOperation] = await db.select().from(stripeBillingOperations)
      .where(eq(stripeBillingOperations.userId, userId));
    assert.equal(completedOperation.id, pendingOperation.id);
    assert.equal(completedOperation.status, "completed");

    const events = await db.select().from(billingEvents).where(eq(billingEvents.userId, userId));
    assert.equal(events.length, 1);
    assert.equal(
      (events[0].payload as { prorationAmountCents?: number }).prorationAmountCents,
      preview.prorationAmountCents,
    );
    assert.equal(
      (events[0].payload as { billingInterval?: string }).billingInterval,
      targetBillingInterval,
    );
  } finally {
    const cleanupFailures: unknown[] = [];
    const attemptCleanup = async (cleanup: () => Promise<unknown>) => {
      try {
        await cleanup();
      } catch (error) {
        cleanupFailures.push(error);
      }
    };

    await attemptCleanup(() => db.delete(billingEvents).where(eq(billingEvents.userId, userId)));
    await attemptCleanup(() => db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.userId, userId)));
    await attemptCleanup(() => db.delete(users).where(eq(users.id, userId)));
    if (subscriptionId) await attemptCleanup(() => stripe.subscriptions.cancel(subscriptionId));
    if (customerId) await attemptCleanup(() => stripe.customers.del(customerId));

    if (cleanupFailures.length > 0) {
      throw new AggregateError(cleanupFailures, "Stripe interrupted plan change sandbox cleanup failed.");
    }
  }
});
