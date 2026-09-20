import type Stripe from "stripe";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "./db";
import { getStripeClient } from "./stripeClient";
import { isPaidPlan, priceCentsForPlan, transitionType } from "./billing";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  arkEvents,
  billingEvents,
  checkoutSessions,
  stripeBillingOperations,
  stripeWebhookEvents,
  users,
  type BillingInterval,
  type StripeBillingOperation,
  type SubscriptionPlan,
} from "@shared/schema";

const ACTIVE = new Set(["active", "trialing"]);

const PLAN_PREVIEW_TTL_SECONDS = 5 * 60;

export const STRIPE_BILLING_STUCK_THRESHOLD_MS = 15 * 60 * 1000;
export async function reconcileExistingStripeEntitlements(
  stripeClient?: Pick<Stripe, "subscriptions">,
): Promise<number> {
  const stripe = stripeClient ?? await getStripeClient();
  const candidates = await db.select().from(users).where(
    and(
      inArray(users.subscriptionPlan, ["INDIVIDUAL_PRO", "SCHOOL_STUDENT", "ARCHITECT"]),
      eq(users.entitlementVerificationStatus, "unverified"),
      sql`${users.stripeSubscriptionId} IS NOT NULL`,
      sql`${users.stripeSubscriptionId} NOT LIKE 'sub_stub_%'`,
      sql`${users.stripeCustomerId} IS NOT NULL`,
    ),
  );
  let verified = 0;
  for (const user of candidates) {
    try {
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId!);
      if (
        ACTIVE.has(subscription.status) &&
        id(subscription.customer) === user.stripeCustomerId &&
        subscription.metadata.userId === user.id &&
        subscription.metadata.plan === user.subscriptionPlan
      ) {
        await db.update(users).set({
          entitlementSource: "provider",
          entitlementVerificationStatus: "verified",
        }).where(and(
          eq(users.id, user.id),
          eq(users.stripeSubscriptionId, subscription.id),
          eq(users.entitlementVerificationStatus, "unverified"),
        ));
        verified += 1;
      }
    } catch (error) {
      console.warn(`Stripe entitlement reconciliation skipped user ${user.id}:`, error);
    }
  }
  return verified;
}
export async function createStripeCheckout(args: {
  localSessionId: string; user: typeof users.$inferSelect; plan: SubscriptionPlan;
  amountCents: number; institution: string | null;
  billingInterval: BillingInterval;
}) {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (!domain) throw new Error("Canonical application domain is not configured.");
  const origin = `https://${domain}`;
  const stripe = await getStripeClient();
  let customerId = args.user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: args.user.name || undefined,
      metadata: { userId: args.user.id },
    });
    customerId = customer.id;
  }
  const products = await stripe.products.search({ query: `active:'true' AND metadata['plan']:'${args.plan}'`, limit: 1 });
  const product = products.data[0];
  if (!product) throw Object.assign(new Error(`Stripe product for ${args.plan} has not been seeded.`), { status: 503 });
  const prices = await stripe.prices.list({ product: product.id, active: true, type: "recurring", limit: 100 });
  const price = prices.data.find((item: Stripe.Price) =>
    item.unit_amount === args.amountCents &&
    item.currency === "usd" &&
    item.recurring?.interval === args.billingInterval
  );
  if (!price) throw Object.assign(new Error(`Stripe price for ${args.plan} is not configured.`), { status: 503 });
  const checkout = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    success_url: `${origin}/checkout/${args.localSessionId}?provider=success`,
    cancel_url: `${origin}/checkout/${args.localSessionId}?provider=canceled`,
    client_reference_id: args.localSessionId,
    metadata: { localSessionId: args.localSessionId, userId: args.user.id, plan: args.plan, billingInterval: args.billingInterval },
    subscription_data: { metadata: { localSessionId: args.localSessionId, userId: args.user.id, plan: args.plan, billingInterval: args.billingInterval } },
  }, { idempotencyKey: `checkout-${args.localSessionId}` });
  await db.transaction(async (tx) => {
    await tx.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, args.user.id));
    await tx.update(checkoutSessions).set({ externalSessionId: checkout.id }).where(eq(checkoutSessions.id, args.localSessionId));
    await tx.update(billingEvents).set({ externalId: checkout.id, payload: { sessionId: args.localSessionId, provider: "stripe" } })
      .where(and(eq(billingEvents.userId, args.user.id), eq(billingEvents.type, "checkout.created")));
  });
  return checkout;
}

function id(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function getStripeSwitchContext(args: {
  subscriptionId: string;
  plan: SubscriptionPlan;
  amountCents: number;
  billingInterval: BillingInterval;
  expectedUserId: string;
  expectedCustomerId: string;
  stripeClient?: Stripe;
}) {
  const stripe = args.stripeClient ?? await getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(args.subscriptionId);
  if (
    id(subscription.customer) !== args.expectedCustomerId ||
    subscription.metadata.userId !== args.expectedUserId
  ) {
    throw Object.assign(new Error("Stripe subscription ownership does not match this account."), { status: 403 });
  }
  if (!ACTIVE.has(subscription.status) || subscription.cancel_at_period_end) {
    throw Object.assign(new Error("Only an active Stripe subscription can change plans."), { status: 409 });
  }
  const item = subscription.items.data[0];
  if (!item) throw new Error("Stripe subscription has no recurring item.");
  const products = await stripe.products.search({
    query: `active:'true' AND metadata['plan']:'${args.plan}'`,
    limit: 1,
  });
  const product = products.data[0];
  if (!product) throw Object.assign(new Error(`Stripe product for ${args.plan} has not been seeded.`), { status: 503 });
  const prices = await stripe.prices.list({ product: product.id, active: true, type: "recurring", limit: 100 });
  const price = prices.data.find((candidate: Stripe.Price) =>
    candidate.unit_amount === args.amountCents &&
    candidate.currency === "usd" &&
    candidate.recurring?.interval === args.billingInterval);
  if (!price) throw Object.assign(new Error(`Stripe price for ${args.plan} is not configured.`), { status: 503 });

  if (id(item.price) === price.id && subscription.metadata.plan === args.plan) {
    return { stripe, subscription, item, price, changed: false };
  }
  return { stripe, subscription, item, price, changed: true };
}
export async function switchStripeSubscription(args: {
  subscriptionId: string;
  plan: SubscriptionPlan;
  amountCents: number;
  billingInterval: BillingInterval;
  version: number;
  expectedUserId: string;
  expectedCustomerId: string;
  prorationDate: number;
  prorationAmountCents: number;
  expectedSourceState: StripeSourceState;
  stripeClient?: Stripe;
  idempotencyKey?: string;
}) {
  const { stripe, subscription, item, price, changed } = await getStripeSwitchContext(args);
  if (Number(subscription.metadata.planVersion || 0) > args.version) {
    throw versionConflict("Stripe has a newer subscription change. Refresh before trying again.");
  }
  if (!changed) {
    const alreadyApplied = Number(subscription.metadata.planVersion || 0) === args.version;
    return {
      subscription,
      prorationAmountCents: alreadyApplied ? args.prorationAmountCents : 0,
      changed: alreadyApplied,
    };
  }
  if (!stripeSourceStateMatches(args.expectedSourceState, item)) {
    throw Object.assign(new Error("Your Stripe subscription changed since this preview. Review a refreshed amount before confirming."), {
      status: 409,
      code: "PREVIEW_STALE",
    });
  }
  const updated = await stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, price: price.id }],
    cancel_at_period_end: false,
    metadata: {
      ...subscription.metadata,
      plan: args.plan,
      billingInterval: args.billingInterval,
      planVersion: String(args.version),
    },
    proration_behavior: "create_prorations",
    proration_date: args.prorationDate,
  }, {
    idempotencyKey: args.idempotencyKey
      ?? `plan-switch-${subscription.id}-${item.price.id}-${price.id}-${args.prorationDate}`,
  });
  return { subscription: updated, prorationAmountCents: args.prorationAmountCents, changed: true };
}

type BillingMutationDeps = {
  stripeClient?: Stripe;
  beforeProviderMutation?: () => Promise<void>;
  afterProviderMutation?: () => Promise<void>;
};

export async function previewStripePlanForUser(args: {
  userId: string;
  plan: SubscriptionPlan;
  institution?: string;
  billingInterval: BillingInterval;
}) {
  const [user] = await db.select().from(users).where(eq(users.id, args.userId));
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  const fromPlan = (user.subscriptionPlan || "INDIVIDUAL_FREE") as SubscriptionPlan;
  validatePlanSwitch(user, fromPlan, args.plan, args.institution);
  const prorationDate = Math.floor(Date.now() / 1000);
  const expiresAt = prorationDate + PLAN_PREVIEW_TTL_SECONDS;
  const targetAmountCents = priceCentsForPlan(args.plan, user.f1000Member, args.billingInterval);
  const preview = await createStripeSubscriptionPreview({
    subscriptionId: user.stripeSubscriptionId!,
    plan: args.plan,
    amountCents: targetAmountCents,
    billingInterval: args.billingInterval,
    expectedUserId: user.id,
    expectedCustomerId: user.stripeCustomerId!,
    prorationDate,
  });
  const institution = args.plan === "SCHOOL_STUDENT" ? (args.institution || user.institution || null) : null;
  const nextBillingAt = preview.nextBillingAt.toISOString();
  return {
    plan: args.plan,
    fromPlan,
    prorationAmountCents: preview.prorationAmountCents,
    currency: "usd",
    nextBillingAt,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    previewToken: createPlanPreviewToken({
      userId: user.id,
      subscriptionId: user.stripeSubscriptionId!,
      fromPlan,
      toPlan: args.plan,
      institution,
      subscriptionVersion: user.stripeSubscriptionVersion,
      targetAmountCents,
      targetBillingInterval: args.billingInterval,
      ...stripeSourceState(preview.item),
      prorationDate,
      prorationAmountCents: preview.prorationAmountCents,
      nextBillingAt,
      expiresAt,
    }),
  };
}
export async function cancelStripePlanForUser(
  userId: string,
  expectedVersion?: number,
  deps: BillingMutationDeps = {},
) {
  const reservation: {
    replay: {
      effectiveAt: Date;
      plan: SubscriptionPlan;
      alreadyScheduled: boolean;
    };
  } | {
    operation: StripeBillingOperation | undefined;
  } = await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    const plan = (user.subscriptionPlan || "INDIVIDUAL_FREE") as SubscriptionPlan;
    if (!isPaidPlan(plan)) throw Object.assign(new Error("Nothing to cancel on a free plan."), { status: 409 });
    if (user.subscriptionCanceledAt) {
      const [completedCancellation] = await tx.select().from(stripeBillingOperations).where(and(
        eq(stripeBillingOperations.userId, userId),
        eq(stripeBillingOperations.kind, "cancel"),
        eq(stripeBillingOperations.targetVersion, user.stripeSubscriptionVersion),
        eq(stripeBillingOperations.status, "completed"),
      ));
      if (completedCancellation && user.subscriptionCurrentPeriodEnd) {
        return {
          replay: {
            effectiveAt: user.subscriptionCurrentPeriodEnd,
            plan: completedCancellation.fromPlan as SubscriptionPlan,
            alreadyScheduled: expectedVersion == null ||
              expectedVersion + 1 !== user.stripeSubscriptionVersion,
          },
        };
      }
      throw Object.assign(new Error("Already scheduled for cancellation."), { status: 409 });
    }
    if (expectedVersion != null && user.stripeSubscriptionVersion !== expectedVersion) {
      throw versionConflict("Subscription changed while cancellation was being requested. Refresh and try again.");
    }
    if (!user.stripeSubscriptionId || !user.stripeCustomerId) {
      throw Object.assign(new Error("No verified Stripe subscription to cancel."), { status: 409 });
    }
    if (user.entitlementSource !== "provider" || user.entitlementVerificationStatus !== "verified") {
      throw Object.assign(new Error("Paid entitlement is not verified by Stripe."), { status: 409 });
    }
    const targetVersion = user.stripeSubscriptionVersion + 1;
    const inserted = await tx.insert(stripeBillingOperations).values({
      userId, subscriptionId: user.stripeSubscriptionId, kind: "cancel",
      fromPlan: plan, targetVersion,
    }).onConflictDoNothing().returning();
    if (inserted[0]) return { operation: inserted[0] };
    return { operation: (await tx.select().from(stripeBillingOperations).where(and(
      eq(stripeBillingOperations.userId, userId),
      eq(stripeBillingOperations.targetVersion, targetVersion),
    )))[0] };
  });
  if ("replay" in reservation) return reservation.replay;
  const operation = reservation.operation;
  if (!operation || operation.kind !== "cancel") {
    throw versionConflict("A different subscription change is already in progress. Refresh and try again.");
  }
  const stripe = deps.stripeClient ?? await getStripeClient();
  let interruptionError: unknown;
  try {
    const current = await stripe.subscriptions.retrieve(operation.subscriptionId);
    const [owner] = await db.select().from(users).where(eq(users.id, operation.userId));
    if (
      !owner ||
      id(current.customer) !== owner.stripeCustomerId ||
      current.metadata.userId !== owner.id
    ) {
      throw Object.assign(new Error("Stripe subscription ownership does not match this account."), { status: 403 });
    }
    if (Number(current.metadata.planVersion || 0) > operation.targetVersion) {
      await completeStripeBillingOperation(operation, current);
      throw versionConflict("Stripe has a newer subscription change. Refresh before trying again.");
    }
    const subscription = current.cancel_at_period_end && Number(current.metadata.planVersion || 0) >= operation.targetVersion
      ? current
      : await stripe.subscriptions.update(operation.subscriptionId, {
        cancel_at_period_end: true,
        metadata: { ...current.metadata, planVersion: String(operation.targetVersion) },
      }, { idempotencyKey: `billing-operation-${operation.id}` });
    try {
      await deps.afterProviderMutation?.();
    } catch (error) {
      interruptionError = error;
      throw error;
    }
    await completeStripeBillingOperation(operation, subscription);
    return {
      effectiveAt: new Date(subscription.items.data[0].current_period_end * 1000),
      plan: operation.fromPlan as SubscriptionPlan,
      alreadyScheduled: false as const,
    };
  } catch (error) {
    if (error === interruptionError) throw error;
    if (await resumePendingStripeBillingOperations(stripe, userId)) {
      const [latestOperation] = await db.select().from(stripeBillingOperations)
        .where(eq(stripeBillingOperations.id, operation.id));
      if (latestOperation?.status === "superseded") {
        throw versionConflict("Stripe has a newer subscription change. Refresh before trying again.");
      }
      const current = await stripe.subscriptions.retrieve(operation.subscriptionId);
      return {
        effectiveAt: new Date(current.items.data[0].current_period_end * 1000),
        plan: operation.fromPlan as SubscriptionPlan,
        alreadyScheduled: false as const,
      };
    }
    throw error;
  }
}

export async function switchStripePlanForUser(args: {
  userId: string;
  previewToken: string;
}, deps: BillingMutationDeps = {}) {
  const acceptedPreview = verifyPlanPreviewToken(args.previewToken);
  if (acceptedPreview.userId !== args.userId) {
    throw Object.assign(new Error("This plan-change preview belongs to another account."), { status: 403, code: "INVALID_PREVIEW" });
  }
  const operation = await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, args.userId)).for("update");
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    const fromPlan = (user.subscriptionPlan || "INDIVIDUAL_FREE") as SubscriptionPlan;
    validatePlanSwitch(user, fromPlan, acceptedPreview.toPlan, acceptedPreview.institution || undefined);
    if (
      acceptedPreview.subscriptionId !== user.stripeSubscriptionId ||
      acceptedPreview.fromPlan !== fromPlan ||
      acceptedPreview.subscriptionVersion !== user.stripeSubscriptionVersion ||
      acceptedPreview.targetAmountCents !== priceCentsForPlan(
        acceptedPreview.toPlan,
        user.f1000Member,
        acceptedPreview.targetBillingInterval,
      )
    ) {
      throw Object.assign(new Error("Your subscription changed since this preview. Review a refreshed amount before confirming."), {
        status: 409,
        code: "PREVIEW_STALE",
      });
    }
    const targetVersion = user.stripeSubscriptionVersion + 1;
    const [pending] = await tx.select().from(stripeBillingOperations).where(and(
      eq(stripeBillingOperations.userId, user.id),
      eq(stripeBillingOperations.targetVersion, targetVersion),
      eq(stripeBillingOperations.status, "pending"),
    )).for("update");
    if (pending) {
      if (pending.kind !== "switch" || pending.targetPlan !== acceptedPreview.toPlan) {
        return pending;
      }
      if (isDeepStrictEqual(pending.payload, acceptedPreview)) {
        return pending;
      }
      await tx.update(stripeBillingOperations).set({
        status: "superseded",
        completedAt: new Date(),
        lastError: "Replaced by a refreshed accepted preview.",
      }).where(eq(stripeBillingOperations.id, pending.id));
    }
    const [inserted] = await tx.insert(stripeBillingOperations).values({
      userId: user.id,
      subscriptionId: user.stripeSubscriptionId!,
      kind: "switch",
      fromPlan,
      targetPlan: acceptedPreview.toPlan,
      targetVersion,
      institution: acceptedPreview.institution,
      payload: acceptedPreview,
    }).returning();
    return inserted;
  });
  if (!operation || operation.kind !== "switch" || operation.targetPlan !== acceptedPreview.toPlan) {
    throw versionConflict("A different subscription change is already in progress. Refresh and try again.");
  }
  const stripe = deps.stripeClient ?? await getStripeClient();
  let interruptionError: unknown;
  try {
    await deps.beforeProviderMutation?.();
    const result = await switchStripeSubscription({
      subscriptionId: operation.subscriptionId,
      plan: acceptedPreview.toPlan,
      amountCents: acceptedPreview.targetAmountCents,
      billingInterval: acceptedPreview.targetBillingInterval,
      version: operation.targetVersion,
      expectedUserId: acceptedPreview.userId,
      expectedCustomerId: (await db.select().from(users).where(eq(users.id, args.userId)))[0].stripeCustomerId!,
      prorationDate: acceptedPreview.prorationDate,
      prorationAmountCents: acceptedPreview.prorationAmountCents,
      expectedSourceState: acceptedPreview,
      stripeClient: stripe,
      idempotencyKey: `billing-operation-${operation.id}`,
    });
    try {
      await deps.afterProviderMutation?.();
    } catch (error) {
      interruptionError = error;
      throw error;
    }
    await completeStripeBillingOperation(operation, result.subscription, {
      prorationAmountCents: result.prorationAmountCents,
    });
    const periodEnd = new Date(result.subscription.items.data[0].current_period_end * 1000);
    const effectiveAt = new Date();
    return {
      plan: acceptedPreview.toPlan,
      effectiveAt,
      nextBillingAt: periodEnd,
      prorationAmountCents: result.prorationAmountCents,
      currency: "usd",
      changed: result.changed,
    };
  } catch (error) {
    if (error === interruptionError) throw error;
    if (await resumePendingStripeBillingOperations(stripe, args.userId)) {
      const [latestOperation] = await db.select().from(stripeBillingOperations)
        .where(eq(stripeBillingOperations.id, operation.id));
      if (latestOperation?.status === "superseded") {
        throw versionConflict("Stripe has a newer subscription change. Refresh before trying again.");
      }
      const current = await stripe.subscriptions.retrieve(operation.subscriptionId);
      return {
        plan: current.metadata.plan as SubscriptionPlan,
        effectiveAt: new Date(),
        nextBillingAt: new Date(current.items.data[0].current_period_end * 1000),
        prorationAmountCents: acceptedPreview.prorationAmountCents,
        currency: "usd",
        changed: true,
      };
    }
    throw error;
  }
}

export async function getStripeCheckout(sessionId: string) {
  return (await getStripeClient()).checkout.sessions.retrieve(sessionId);
}

export async function processStripeEvent(
  event: Stripe.Event,
  deps: {
    retrieveSubscription?: (id: string) => Promise<Stripe.Subscription>;
    resolveDuplicateSubscription?: (subscription: Stripe.Subscription) => Promise<void>;
  } = {},
): Promise<"processed" | "duplicate"> {
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(stripeWebhookEvents).values({ id: event.id, type: event.type })
      .onConflictDoNothing().returning();
    if (!inserted.length) return "duplicate";

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const localId = session.metadata?.localSessionId || session.client_reference_id;
      if (!localId) throw new Error("Stripe checkout is missing local ownership metadata.");
      const [local] = await tx.select().from(checkoutSessions).where(eq(checkoutSessions.id, localId)).for("update");
      if (!local || local.userId !== session.metadata?.userId || local.externalSessionId !== session.id) {
        throw new Error("Stripe checkout ownership does not match the local session.");
      }
      if (session.metadata?.plan !== local.plan || session.metadata?.billingInterval !== local.billingInterval) {
        throw new Error("Stripe checkout plan or billing interval ownership does not match the local session.");
      }
      const subscriptionId = id(session.subscription);
      if (session.payment_status !== "paid" || !subscriptionId) throw new Error("Stripe checkout is not paid.");
      const subscription = deps.retrieveSubscription
        ? await deps.retrieveSubscription(subscriptionId)
        : await (await getStripeClient()).subscriptions.retrieve(subscriptionId);
      const subscriptionInterval = subscription.items.data[0]?.price?.recurring?.interval;
      if (
        !ACTIVE.has(subscription.status) ||
        subscription.metadata.userId !== local.userId ||
        subscription.metadata.plan !== local.plan ||
        subscription.metadata.billingInterval !== local.billingInterval ||
        subscriptionInterval !== local.billingInterval ||
        id(subscription.customer) !== id(session.customer)
      ) {
        throw new Error("Stripe subscription is not active or owned by this account.");
      }
      const [user] = await tx.select().from(users).where(eq(users.id, local.userId)).for("update");
      if (!user) throw new Error("Checkout owner no longer exists.");
      if (user.stripeSubscriptionId && user.stripeSubscriptionId !== subscription.id) {
        if (deps.resolveDuplicateSubscription) {
          await deps.resolveDuplicateSubscription(subscription);
        } else {
          const stripe = await getStripeClient();
          const canceled = await stripe.subscriptions.cancel(subscription.id);
          const invoiceId = id(canceled.latest_invoice);
          if (invoiceId) {
            const invoice: any = await stripe.invoices.retrieve(invoiceId);
            const paymentIntentId = id(invoice.payment_intent);
            if (paymentIntentId && invoice.amount_paid > 0) {
              await stripe.refunds.create({ payment_intent: paymentIntentId });
            }
          }
        }
        await tx.update(checkoutSessions).set({ status: "failed", completedAt: new Date() }).where(eq(checkoutSessions.id, local.id));
        await tx.insert(billingEvents).values({
          userId: user.id, type: "checkout.failed", fromPlan: user.subscriptionPlan, toPlan: local.plan,
          amountCents: local.amountCents, externalId: session.id,
          payload: { provider: "stripe", reason: "active_subscription_already_owned", eventId: event.id },
        });
        return "processed";
      }
      const fromPlan = (user.subscriptionPlan || "INDIVIDUAL_FREE") as SubscriptionPlan;
      const toPlan = local.plan as SubscriptionPlan;
      if (!isPaidPlan(toPlan)) throw new Error("Paid Stripe checkout cannot grant a free plan.");
      const periodEnd = new Date(subscription.items.data[0].current_period_end * 1000);
      await tx.update(users).set({
        subscriptionPlan: toPlan, subscriptionStatus: "active",
        entitlementSource: "provider", entitlementVerificationStatus: "verified",
        stripeCustomerId: id(session.customer), stripeSubscriptionId: subscription.id,
        subscriptionCurrentPeriodEnd: periodEnd, subscriptionCanceledAt: null,
        stripeSubscriptionUpdatedAt: new Date((event.created || Math.floor(Date.now() / 1000)) * 1000),
        stripeSubscriptionVersion: Number(subscription.metadata.planVersion || 0),
        ...(local.institution ? { institution: local.institution } : {}),
      }).where(eq(users.id, user.id));
      await tx.update(checkoutSessions).set({ status: "completed", completedAt: new Date() }).where(eq(checkoutSessions.id, local.id));
      await tx.insert(billingEvents).values({
        userId: user.id, type: "checkout.completed", fromPlan, toPlan,
        amountCents: local.amountCents, externalId: session.id, payload: { provider: "stripe", eventId: event.id },
      });
      const transition = transitionType(fromPlan, toPlan);
      if (transition) await tx.insert(billingEvents).values({
        userId: user.id, type: transition, fromPlan, toPlan, amountCents: local.amountCents,
        externalId: subscription.id, payload: { provider: "stripe", eventId: event.id },
      });
      return "processed";
    }

    const object: any = event.data.object;
    const subscriptionId = event.type.startsWith("customer.subscription.") ? object.id : id(object.subscription);
    const customerId = id(object.customer);
    if (!subscriptionId && !customerId) return "processed";
    const [user] = await tx.select().from(users).where(
      or(
        ...(subscriptionId ? [eq(users.stripeSubscriptionId, subscriptionId)] : []),
        ...(customerId ? [eq(users.stripeCustomerId, customerId)] : []),
      ),
    ).for("update");
    if (!user) return "processed";
    if (event.type.startsWith("customer.subscription.") && subscriptionId !== user.stripeSubscriptionId) {
      return "processed";
    }
    const eventTime = new Date(event.created * 1000);
    const providerVersion = Number(object.metadata?.planVersion || 0);
    if (
      event.type.startsWith("customer.subscription.") &&
      (
        (providerVersion > 0 && providerVersion < user.stripeSubscriptionVersion) ||
        (providerVersion === 0 && user.stripeSubscriptionUpdatedAt && eventTime < user.stripeSubscriptionUpdatedAt)
      )
    ) {
      return "processed";
    }
    const plan = (user.subscriptionPlan || "INDIVIDUAL_FREE") as SubscriptionPlan;

    if (event.type === "invoice.payment_failed") {
      if (!user.subscriptionCanceledAt) {
        await tx.update(users).set({ subscriptionStatus: "past_due" }).where(eq(users.id, user.id));
      }
      await tx.insert(billingEvents).values({ userId: user.id, type: "payment.failed", fromPlan: plan, toPlan: plan, externalId: event.id, payload: { provider: "stripe" } });
    } else if (event.type === "invoice.payment_succeeded") {
      if (!user.subscriptionCanceledAt) {
        await tx.update(users).set({ subscriptionStatus: "active" }).where(eq(users.id, user.id));
      }
      await tx.insert(billingEvents).values({ userId: user.id, type: "payment.succeeded", fromPlan: plan, toPlan: plan, amountCents: object.amount_paid, externalId: event.id, payload: { provider: "stripe" } });
    } else if (event.type === "customer.subscription.updated") {
      const end = new Date(object.items.data[0].current_period_end * 1000);
      const providerPlan = object.metadata?.plan as SubscriptionPlan | undefined;
      await tx.update(users).set({
        ...(providerPlan && isPaidPlan(providerPlan) ? { subscriptionPlan: providerPlan } : {}),
        ...(object.metadata?.userId === user.id && customerId === user.stripeCustomerId
          ? { entitlementSource: "provider", entitlementVerificationStatus: "verified" }
          : {}),
        subscriptionStatus: object.cancel_at_period_end ? "canceling" : ACTIVE.has(object.status) ? "active" : object.status,
        subscriptionCanceledAt: object.cancel_at_period_end ? new Date() : null,
        subscriptionCurrentPeriodEnd: end,
        stripeSubscriptionUpdatedAt: eventTime,
        stripeSubscriptionVersion: Math.max(user.stripeSubscriptionVersion, providerVersion),
      }).where(eq(users.id, user.id));
    } else if (event.type === "customer.subscription.deleted" && subscriptionId === user.stripeSubscriptionId) {
      await tx.update(users).set({
        subscriptionPlan: "INDIVIDUAL_FREE", subscriptionStatus: "active",
        entitlementSource: "unverified", entitlementVerificationStatus: "unverified",
        stripeSubscriptionId: null, subscriptionCurrentPeriodEnd: null, subscriptionCanceledAt: null,
      }).where(eq(users.id, user.id));
      await tx.insert(billingEvents).values({ userId: user.id, type: "subscription.canceled", fromPlan: plan, toPlan: "INDIVIDUAL_FREE", externalId: event.id, payload: { provider: "stripe", reason: event.type } });
    } else if (event.type === "charge.refunded") {
      await tx.insert(billingEvents).values({
        userId: user.id, type: "payment.failed", fromPlan: plan, toPlan: plan,
        amountCents: object.amount_refunded, externalId: event.id,
        payload: { provider: "stripe", reason: "refund", fullRefund: object.refunded === true },
      });
    }
    return "processed";
  });
}

export function stripeSourceStateMatches(expected: StripeSourceState, item: Stripe.SubscriptionItem): boolean {
  const current = stripeSourceState(item);
  return Object.entries(current).every(
    ([key, value]) => expected[key as keyof StripeSourceState] === value,
  );
}

function validatePlanSwitch(
  user: typeof users.$inferSelect,
  fromPlan: SubscriptionPlan,
  toPlan: SubscriptionPlan,
  institution?: string,
) {
  if (!user.stripeSubscriptionId || !isPaidPlan(fromPlan)) {
    throw Object.assign(new Error("No active paid Stripe subscription to change."), { status: 409 });
  }
  if (
    user.entitlementSource !== "provider" ||
    user.entitlementVerificationStatus !== "verified" ||
    !user.stripeCustomerId
  ) {
    throw Object.assign(new Error("Paid entitlement is not verified by Stripe."), { status: 409 });
  }
  if (!isPaidPlan(toPlan) || toPlan === "ENTERPRISE") {
    throw Object.assign(new Error("Plan switching supports Pro, Architect, and Schools."), { status: 409 });
  }
  if (toPlan === fromPlan) throw Object.assign(new Error(`Already on ${toPlan}.`), { status: 409 });
  if (toPlan === "SCHOOL_STUDENT" && !institution && !user.institution) {
    throw Object.assign(new Error("Institution name required for School plan."), { status: 400 });
  }
}

export function createPlanPreviewToken(payload: PlanPreviewTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signPreviewPayload(encoded)}`;
}

type PlanPreviewTokenPayload = {
  userId: string;
  subscriptionId: string;
  fromPlan: SubscriptionPlan;
  toPlan: SubscriptionPlan;
  institution: string | null;
  subscriptionVersion: number;
  targetAmountCents: number;
  targetBillingInterval: BillingInterval;
  sourceItemId: string;
  sourcePriceId: string;
  sourceQuantity: number;
  sourcePeriodStart: number;
  sourcePeriodEnd: number;
  prorationDate: number;
  prorationAmountCents: number;
  nextBillingAt: string;
  expiresAt: number;
};

function signPreviewPayload(encoded: string): string {
  return createHmac("sha256", previewSecret()).update(encoded).digest("base64url");
}

export function verifyPlanPreviewToken(token: string, nowSeconds = Math.floor(Date.now() / 1000)): PlanPreviewTokenPayload {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) {
    throw Object.assign(new Error("Invalid plan-change preview. Please refresh it."), { status: 400, code: "INVALID_PREVIEW" });
  }
  const expected = Buffer.from(signPreviewPayload(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw Object.assign(new Error("Invalid plan-change preview. Please refresh it."), { status: 400, code: "INVALID_PREVIEW" });
  }
  let payload: PlanPreviewTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid plan-change preview. Please refresh it."), { status: 400, code: "INVALID_PREVIEW" });
  }
  if (!payload.expiresAt || payload.expiresAt <= nowSeconds) {
    throw Object.assign(new Error("This price preview expired. Review the refreshed amount before confirming."), {
      status: 409,
      code: "PREVIEW_EXPIRED",
    });
  }
  return payload;
}

async function createStripeSubscriptionPreview(args: {
  subscriptionId: string;
  plan: SubscriptionPlan;
  amountCents: number;
  billingInterval: BillingInterval;
  expectedUserId: string;
  expectedCustomerId: string;
  prorationDate: number;
}) {
  const context = await getStripeSwitchContext(args);
  if (!context.changed) {
    return {
      ...context,
      prorationAmountCents: 0,
      nextBillingAt: new Date(context.item.current_period_end * 1000),
    };
  }
  const preview: any = await (context.stripe.invoices as any).createPreview({
    customer: id(context.subscription.customer),
    subscription: context.subscription.id,
    subscription_details: {
      items: [{ id: context.item.id, price: context.price.id }],
      proration_behavior: "create_prorations",
      proration_date: args.prorationDate,
    },
  });
  const prorationAmountCents = (preview.lines?.data ?? [])
    .filter((line: any) => line.parent?.subscription_item_details?.proration === true || line.proration === true)
    .reduce((sum: number, line: any) => sum + Number(line.amount || 0), 0);
  const nextBillingAt = new Date(
    Number(preview.period_end || context.item.current_period_end) * 1000,
  );
  return { ...context, prorationAmountCents, nextBillingAt };
}

function stripeSourceState(item: Stripe.SubscriptionItem): StripeSourceState {
  return {
    sourceItemId: item.id,
    sourcePriceId: id(item.price)!,
    sourceQuantity: item.quantity ?? 1,
    sourcePeriodStart: item.current_period_start,
    sourcePeriodEnd: item.current_period_end,
  };
}

type StripeSourceState = Pick<
  PlanPreviewTokenPayload,
  "sourceItemId" | "sourcePriceId" | "sourceQuantity" | "sourcePeriodStart" | "sourcePeriodEnd"
>;

function previewSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for billing previews.");
  return secret;
}

async function completeStripeBillingOperation(
  operation: StripeBillingOperation,
  subscription: Stripe.Subscription,
  providerResult?: { prorationAmountCents?: number },
) {
  const acceptedPreview = operation.kind === "switch"
    ? operation.payload as unknown as PlanPreviewTokenPayload
    : undefined;
  const completion = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${operation.userId}))`);
    const [lockedOperation] = await tx.select().from(stripeBillingOperations)
      .where(eq(stripeBillingOperations.id, operation.id)).for("update");
    if (!lockedOperation) throw new Error("Stripe billing operation no longer exists.");
    const [user] = await tx.select().from(users).where(eq(users.id, operation.userId)).for("update");
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    if (
      subscription.id !== operation.subscriptionId ||
      id(subscription.customer) !== user.stripeCustomerId ||
      subscription.metadata.userId !== user.id
    ) {
      throw Object.assign(new Error("Stripe subscription ownership does not match this account."), { status: 403 });
    }
    if (lockedOperation.status === "completed" || lockedOperation.status === "superseded") {
      return { user, newlyCompleted: false };
    }
    const providerVersion = Number(subscription.metadata.planVersion || 0);
    if (providerVersion > operation.targetVersion) {
      const providerPlan = subscription.metadata.plan as SubscriptionPlan | undefined;
      const periodEnd = new Date(subscription.items.data[0].current_period_end * 1000);
      const terminal = subscription.status === "canceled" || subscription.status === "incomplete_expired";
      await tx.update(users).set({
        subscriptionPlan: terminal
          ? "INDIVIDUAL_FREE"
          : providerPlan && isPaidPlan(providerPlan) ? providerPlan : user.subscriptionPlan,
        subscriptionStatus: terminal
          ? "active"
          : subscription.cancel_at_period_end ? "canceling" : ACTIVE.has(subscription.status) ? "active" : subscription.status,
        entitlementSource: terminal ? "unverified" : user.entitlementSource,
        entitlementVerificationStatus: terminal ? "unverified" : user.entitlementVerificationStatus,
        stripeSubscriptionId: terminal ? null : user.stripeSubscriptionId,
        subscriptionCanceledAt: subscription.cancel_at_period_end ? new Date() : null,
        subscriptionCurrentPeriodEnd: terminal ? null : periodEnd,
        stripeSubscriptionUpdatedAt: new Date(),
        stripeSubscriptionVersion: providerVersion,
      }).where(eq(users.id, user.id));
      await tx.update(stripeBillingOperations).set({
        status: "superseded",
        completedAt: new Date(),
        lastError: null,
      }).where(eq(stripeBillingOperations.id, operation.id));
      return { user, newlyCompleted: false };
    }
    if (providerVersion < operation.targetVersion) {
      throw new Error("Stripe has not applied the reserved billing operation.");
    }
    const providerPlan = subscription.metadata.plan as SubscriptionPlan | undefined;
    const locallyAligned = user.stripeSubscriptionVersion >= operation.targetVersion && (
      operation.kind === "cancel"
        ? user.subscriptionCanceledAt != null === subscription.cancel_at_period_end
        : user.subscriptionPlan === providerPlan && user.subscriptionCanceledAt == null
    );
    if (locallyAligned) {
      const alignedTargetPlan = operation.kind === "switch"
        ? operation.targetPlan as SubscriptionPlan
        : operation.fromPlan as SubscriptionPlan;
      const alignedTransition = operation.kind === "switch"
        ? transitionType(operation.fromPlan as SubscriptionPlan, alignedTargetPlan)
        : null;
      await tx.insert(billingEvents).values({
        userId: user.id,
        type: operation.kind === "cancel" ? "subscription.canceled" : alignedTransition!,
        fromPlan: operation.fromPlan,
        toPlan: operation.kind === "cancel" ? "INDIVIDUAL_FREE" : alignedTargetPlan,
        amountCents: operation.kind === "cancel" ? 0 : subscription.items.data[0].price.unit_amount ?? 0,
        externalId: subscription.id,
        payload: {
          provider: "stripe",
          operationId: operation.id,
          reconciled: true,
          planVersion: operation.targetVersion,
        },
      });
      let arkEvent;
      if (operation.kind === "cancel") {
        [arkEvent] = await tx.insert(arkEvents).values({
          id: operation.id,
          userId: user.id,
          type: "billing.subscription.canceled",
          source: "billing",
          payload: {
            plan: operation.fromPlan,
            effectiveAt: new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
          },
          scoreDelta: 0,
        }).onConflictDoNothing().returning();
      }
      await tx.update(stripeBillingOperations).set({ status: "completed", completedAt: new Date(), lastError: null })
        .where(eq(stripeBillingOperations.id, operation.id));
      return { user, newlyCompleted: true, arkEvent };
    }
    if (user.stripeSubscriptionVersion > operation.targetVersion) {
      await tx.update(stripeBillingOperations).set({ status: "completed", completedAt: new Date(), lastError: null })
        .where(eq(stripeBillingOperations.id, operation.id));
      return { user, newlyCompleted: false };
    }
    const periodEnd = new Date(subscription.items.data[0].current_period_end * 1000);
    const completedAt = new Date();
    const targetPlan = operation.kind === "switch" ? operation.targetPlan as SubscriptionPlan : operation.fromPlan as SubscriptionPlan;
    if (operation.kind === "switch" && providerPlan !== targetPlan) {
      throw new Error("Stripe subscription does not reflect the reserved target plan.");
    }
    await tx.update(users).set({
      subscriptionPlan: targetPlan,
      subscriptionStatus: subscription.cancel_at_period_end ? "canceling" : "active",
      subscriptionCanceledAt: subscription.cancel_at_period_end ? completedAt : null,
      subscriptionCurrentPeriodEnd: periodEnd,
      stripeSubscriptionUpdatedAt: completedAt,
      stripeSubscriptionVersion: operation.targetVersion,
      ...(targetPlan === "SCHOOL_STUDENT" ? { institution: operation.institution || user.institution } : {}),
    }).where(eq(users.id, user.id));
    const transition = operation.kind === "switch"
      ? transitionType(operation.fromPlan as SubscriptionPlan, targetPlan)
      : null;
    await tx.insert(billingEvents).values({
      userId: user.id,
      type: operation.kind === "cancel" ? "subscription.canceled" : transition!,
      fromPlan: operation.fromPlan,
      toPlan: operation.kind === "cancel" ? "INDIVIDUAL_FREE" : targetPlan,
      amountCents: operation.kind === "cancel" ? 0 : subscription.items.data[0].price.unit_amount ?? 0,
      externalId: subscription.id,
      payload: {
        provider: "stripe",
        operationId: operation.id,
        effectiveAt: completedAt.toISOString(),
        nextBillingAt: periodEnd.toISOString(),
        prorationAmountCents: providerResult?.prorationAmountCents
          ?? acceptedPreview?.prorationAmountCents
          ?? 0,
        planVersion: operation.targetVersion,
        billingInterval: subscription.items.data[0].price.recurring?.interval,
      },
    });
    let arkEvent;
    if (operation.kind === "cancel") {
      [arkEvent] = await tx.insert(arkEvents).values({
        id: operation.id,
        userId: user.id,
        type: "billing.subscription.canceled",
        source: "billing",
        payload: { plan: operation.fromPlan, effectiveAt: periodEnd.toISOString() },
        scoreDelta: 0,
      }).onConflictDoNothing().returning();
    }
    await tx.update(stripeBillingOperations).set({ status: "completed", completedAt, lastError: null })
      .where(eq(stripeBillingOperations.id, operation.id));
    return {
      user: { ...user, subscriptionPlan: targetPlan, subscriptionCurrentPeriodEnd: periodEnd },
      newlyCompleted: true,
      arkEvent,
    };
  });
  if (completion.arkEvent) {
    const { orchestrator } = await import("./orchestrator");
    orchestrator.publishPersisted(completion.arkEvent);
  }
  return completion;
}

export async function resumePendingStripeBillingOperations(
  stripeClient?: Stripe,
  userId?: string,
  alertMaintainers: (health: StripeBillingRecoveryHealth) => void = emitStripeBillingRecoveryAlert,
): Promise<number> {
  const stripe = stripeClient ?? await getStripeClient();
  const pending = await db.select().from(stripeBillingOperations).where(
    userId
      ? and(eq(stripeBillingOperations.status, "pending"), eq(stripeBillingOperations.userId, userId))
      : eq(stripeBillingOperations.status, "pending"),
  );
  let completed = 0;
  for (const operation of pending) {
    try {
      await applyOrReconcileStripeBillingOperation(operation, stripe);
      completed += 1;
    } catch (error) {
      const errorCategory = billingRecoveryErrorCategory(error);
      await db.update(stripeBillingOperations).set({
        lastError: `Billing recovery failed (${errorCategory}).`,
        lastErrorCategory: errorCategory,
        recoveryAttempts: sql`${stripeBillingOperations.recoveryAttempts} + 1`,
        lastRecoveryAttemptAt: new Date(),
      }).where(eq(stripeBillingOperations.id, operation.id));
      console.warn("Stripe billing recovery failed", {
        operationId: operation.id,
        kind: operation.kind,
        ageSeconds: Math.max(0, Math.floor((Date.now() - operation.createdAt.getTime()) / 1000)),
        targetVersion: operation.targetVersion,
        errorCategory,
      });
    }
  }
  const health = await getStripeBillingRecoveryHealth();
  if (!health.ok) alertMaintainers(health);
  return completed;
}

function versionConflict(message: string) {
  return Object.assign(new Error(message), {
    status: 409,
    code: "SUBSCRIPTION_VERSION_CONFLICT",
  });
}

async function applyOrReconcileStripeBillingOperation(operation: StripeBillingOperation, stripe: Stripe) {
  let subscription = await stripe.subscriptions.retrieve(operation.subscriptionId);
  const [owner] = await db.select().from(users).where(eq(users.id, operation.userId));
  if (
    !owner ||
    id(subscription.customer) !== owner.stripeCustomerId ||
    subscription.metadata.userId !== owner.id
  ) {
    throw Object.assign(new Error("Stripe subscription ownership does not match this account."), { status: 403 });
  }
  const providerVersion = Number(subscription.metadata.planVersion || 0);
  if (providerVersion > operation.targetVersion) {
    return completeStripeBillingOperation(operation, subscription);
  }
  const providerApplied = providerVersion >= operation.targetVersion && (
    operation.kind === "cancel"
      ? subscription.cancel_at_period_end
      : subscription.metadata.plan === operation.targetPlan
  );
  if (!providerApplied) {
    if (operation.kind === "cancel") {
      subscription = await stripe.subscriptions.update(operation.subscriptionId, {
        cancel_at_period_end: true,
        metadata: { ...subscription.metadata, planVersion: String(operation.targetVersion) },
      }, { idempotencyKey: `billing-operation-${operation.id}` });
    } else {
      const [user] = await db.select().from(users).where(eq(users.id, operation.userId));
      if (!user || !user.stripeCustomerId || !operation.targetPlan) {
        throw new Error("Reserved Stripe plan switch no longer has a valid local owner.");
      }
      const acceptedPreview = operation.payload as unknown as PlanPreviewTokenPayload;
      subscription = (await switchStripeSubscription({
        subscriptionId: operation.subscriptionId,
        plan: operation.targetPlan as SubscriptionPlan,
        amountCents: acceptedPreview.targetAmountCents,
        billingInterval: acceptedPreview.targetBillingInterval,
        version: operation.targetVersion,
        expectedUserId: user.id,
        expectedCustomerId: user.stripeCustomerId,
        prorationDate: acceptedPreview.prorationDate,
        prorationAmountCents: acceptedPreview.prorationAmountCents,
        expectedSourceState: acceptedPreview,
        stripeClient: stripe,
        idempotencyKey: `billing-operation-${operation.id}`,
      })).subscription;
    }
  }
  return completeStripeBillingOperation(operation, subscription);
}

type BillingRecoveryError = Error & { code?: unknown; status?: unknown; statusCode?: unknown; type?: unknown };

function billingRecoveryErrorCategory(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  const candidate = error as BillingRecoveryError;
  const status = Number(candidate.status ?? candidate.statusCode);
  if (status === 401 || status === 403) return "ownership_or_auth";
  if (status === 409) return "provider_conflict";
  if (status === 429) return "provider_rate_limit";
  if (status >= 500) return "provider_unavailable";
  if (candidate.code === "ETIMEDOUT" || candidate.code === "ECONNRESET") return "provider_network";
  if (typeof candidate.type === "string" && candidate.type.startsWith("Stripe")) return "stripe_error";
  return "reconciliation_error";
}

export async function getStripeBillingRecoveryHealth(
  now = new Date(),
  thresholdMs = STRIPE_BILLING_STUCK_THRESHOLD_MS,
) {
  const cutoff = new Date(now.getTime() - thresholdMs);
  const operations = await db.select({
    id: stripeBillingOperations.id,
    kind: stripeBillingOperations.kind,
    createdAt: stripeBillingOperations.createdAt,
    recoveryAttempts: stripeBillingOperations.recoveryAttempts,
    lastErrorCategory: stripeBillingOperations.lastErrorCategory,
  }).from(stripeBillingOperations).where(and(
    eq(stripeBillingOperations.status, "pending"),
    sql`${stripeBillingOperations.createdAt} <= ${cutoff}`,
  ));
  const stuckOperations = operations.map((operation) => ({
    operationId: operation.id,
    kind: operation.kind,
    ageSeconds: Math.max(0, Math.floor((now.getTime() - operation.createdAt.getTime()) / 1000)),
    recoveryAttempts: operation.recoveryAttempts,
    errorCategory: operation.lastErrorCategory,
  }));
  return {
    ok: stuckOperations.length === 0,
    thresholdSeconds: Math.floor(thresholdMs / 1000),
    stuckCount: stuckOperations.length,
    stuckOperations,
  };
}

type StripeBillingRecoveryHealth = Awaited<ReturnType<typeof getStripeBillingRecoveryHealth>>;

export function emitStripeBillingRecoveryAlert(health: StripeBillingRecoveryHealth): void {
  // Application and deployment stderr is the maintainer-owned alert stream.
  // This payload is limited to the health signal's safe operation metadata.
  console.error("MAINTAINER_ALERT stripe_billing_recovery_stuck", health);
}
