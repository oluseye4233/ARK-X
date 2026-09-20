import { test, mock } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "http";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "../db";
import { storage } from "../storage";
import { registerRoutes } from "../routes";
import { resolveCanonicalEntitlement } from "../billing";
import {
  arkEvents,
  billingEvents,
  stripeBillingOperations,
  users,
  type CheckoutSession,
  type User,
} from "@shared/schema";
import { cancelStripePlanForUser } from "../stripeBilling";

const OWNER_ID = "billing-owner";

function session(overrides: Partial<CheckoutSession>): CheckoutSession {
  return {
    id: "free-session",
    userId: OWNER_ID,
    plan: "INDIVIDUAL_FREE",
    amountCents: 0,
    status: "pending",
    institution: null,
    externalSessionId: null,
    createdAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

test("checkout completion enforces ownership, awaits Stripe for paid sessions, and reports replay conflicts", async () => {
  const sessions = new Map<string, CheckoutSession>([
    ["other-session", session({ id: "other-session", userId: "someone-else" })],
    ["paid-session", session({ id: "paid-session", plan: "INDIVIDUAL_PRO", amountCents: 2000 })],
    ["replayed-session", session({ id: "replayed-session", status: "completed", completedAt: new Date() })],
  ]);
  const user = {
    id: OWNER_ID,
    subscriptionPlan: "INDIVIDUAL_FREE",
    subscriptionStatus: "active",
  } as User;

  const getUserSpy = mock.method(storage, "getUser", async () => user);
  const getSessionSpy = mock.method(storage, "getCheckoutSession", async (id: string) => sessions.get(id));
  const completeSpy = mock.method(storage, "completeCheckoutSession", async ({ sessionId }: { sessionId: string }) => {
    if (sessionId === "replayed-session") {
      const error = Object.assign(new Error("Session already completed."), { status: 409 });
      throw error;
    }
    throw new Error("completion should not be reached");
  });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId: OWNER_ID };
    next();
  });
  const server = await registerRoutes(createServer(app), app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test server address");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const ownership = await fetch(`${baseUrl}/api/billing/checkout/other-session/complete`, { method: "POST" });
    assert.equal(ownership.status, 403);
    assert.match((await ownership.json()).message, /not your checkout/i);

    const unverifiedPaid = await fetch(`${baseUrl}/api/billing/checkout/paid-session/complete`, { method: "POST" });
    assert.equal(unverifiedPaid.status, 409);
    assert.equal((await unverifiedPaid.json()).code, "AWAITING_PROVIDER_CONFIRMATION");

    const replay = await fetch(`${baseUrl}/api/billing/checkout/replayed-session/complete`, { method: "POST" });
    assert.equal(replay.status, 409);
    assert.match((await replay.json()).message, /already completed/i);

    assert.equal(completeSpy.mock.callCount(), 1, "only the replay reaches transactional completion");
  } finally {
    getUserSpy.mock.restore();
    getSessionSpy.mock.restore();
    completeSpy.mock.restore();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("admin Enterprise provisioning records verified contract provenance", async () => {
  const originalAdminId = process.env.ADMIN_USER_ID;
  process.env.ADMIN_USER_ID = OWNER_ID;
  const target = {
    id: "enterprise-target",
    subscriptionPlan: "INDIVIDUAL_FREE",
    subscriptionStatus: "active",
  } as User;
  let writtenPatch: Record<string, unknown> | undefined;

  const getUserSpy = mock.method(storage, "getUser", async (id: string) =>
    id === target.id ? target : undefined,
  );
  const updateSpy = mock.method(storage, "updateUser", async (id: string, patch: Record<string, unknown>) => {
    writtenPatch = patch;
    return { ...target, ...patch } as User;
  });
  const eventSpy = mock.method(storage, "createBillingEvent", async () => ({} as any));

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId: OWNER_ID };
    next();
  });
  const server = await registerRoutes(createServer(app), app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test server address");

  try {
    target.stripeSubscriptionId = "sub_active";
    const blocked = await fetch(
      `http://127.0.0.1:${address.port}/api/users/${target.id}/subscription`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "ENTERPRISE" }),
      },
    );
    assert.equal(blocked.status, 409);
    assert.match((await blocked.json()).message, /cancel the active Stripe subscription/i);
    assert.equal(writtenPatch, undefined);
    assert.equal(eventSpy.mock.callCount(), 0);
    target.stripeSubscriptionId = null;

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/users/${target.id}/subscription`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "ENTERPRISE" }),
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(writtenPatch, {
      subscriptionPlan: "ENTERPRISE",
      subscriptionStatus: "active",
      entitlementSource: "contract",
      entitlementVerificationStatus: "verified",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionCanceledAt: null,
    });
    assert.equal(
      resolveCanonicalEntitlement({ ...target, ...writtenPatch } as User).subscriptionPlan,
      "ENTERPRISE",
    );
  } finally {
    getUserSpy.mock.restore();
    updateSpy.mock.restore();
    eventSpy.mock.restore();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (originalAdminId === undefined) delete process.env.ADMIN_USER_ID;
    else process.env.ADMIN_USER_ID = originalAdminId;
  }
});

test("simultaneous and later cancellation retries return success with one mutation and notification", async () => {
  const userId = "billing-cancel-concurrent";
  const periodEnd = Math.floor(Date.now() / 1000) + 2_592_000;
  await db.delete(arkEvents).where(eq(arkEvents.userId, userId));
  await db.delete(billingEvents).where(eq(billingEvents.userId, userId));
  await db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await db.insert(users).values({
    id: userId,
    name: "Concurrent Cancellation",
    username: userId,
    password: "not-used",
    subscriptionPlan: "INDIVIDUAL_PRO",
    subscriptionStatus: "active",
    stripeCustomerId: "cus_cancel_concurrent",
    stripeSubscriptionId: "sub_cancel_concurrent",
    entitlementSource: "provider",
    entitlementVerificationStatus: "verified",
    stripeSubscriptionVersion: 0,
  });

  let provider = {
    id: "sub_cancel_concurrent",
    customer: "cus_cancel_concurrent",
    status: "active",
    cancel_at_period_end: false,
    metadata: { userId, plan: "INDIVIDUAL_PRO", billingInterval: "month", planVersion: "0" },
    items: { data: [{
      id: "si_cancel_concurrent",
      quantity: 1,
      current_period_start: periodEnd - 2_592_000,
      current_period_end: periodEnd,
      price: { id: "price_pro", unit_amount: 2900, recurring: { interval: "month" } },
    }] },
  } as unknown as Stripe.Subscription;
  const mutationKeys: string[] = [];
  const stripe = {
    subscriptions: {
      retrieve: async () => provider,
      update: async (_id: string, input: any, options: { idempotencyKey?: string }) => {
        mutationKeys.push(options.idempotencyKey ?? "");
        provider = {
          ...provider,
          cancel_at_period_end: input.cancel_at_period_end,
          metadata: input.metadata,
        } as Stripe.Subscription;
        return provider;
      },
    },
  } as unknown as Stripe;

  let arrivals = 0;
  let releaseBoth!: () => void;
  const bothArrived = new Promise<void>((resolve) => { releaseBoth = resolve; });
  const synchronizedCancel: typeof cancelStripePlanForUser = async (id, version) => {
    arrivals += 1;
    if (arrivals === 2) releaseBoth();
    await bothArrived;
    return cancelStripePlanForUser(id, version, { stripeClient: stripe });
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId };
    next();
  });
  const server = await registerRoutes(createServer(app), app, {
    cancelStripePlanForUser: synchronizedCancel,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test server address");
  const url = `http://127.0.0.1:${address.port}/api/billing/cancel`;

  try {
    const responses = await Promise.all([
      fetch(url, { method: "POST" }),
      fetch(url, { method: "POST" }),
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    assert.equal(bodies.filter((body) => body.ok === true).length, 2);
    assert.equal(bodies[0].effectiveAt, bodies[1].effectiveAt);
    assert.deepEqual(bodies.map((body) => body.alreadyScheduled), [false, false]);

    const retry = await fetch(url, { method: "POST" });
    const retryBody = await retry.json();
    assert.equal(retry.status, 200);
    assert.deepEqual(retryBody, {
      ok: true,
      effectiveAt: bodies[0].effectiveAt,
      alreadyScheduled: true,
    });

    const operations = await db.select().from(stripeBillingOperations)
      .where(eq(stripeBillingOperations.userId, userId));
    const events = await db.select().from(billingEvents).where(eq(billingEvents.userId, userId));
    const notifications = await db.select().from(arkEvents).where(eq(arkEvents.userId, userId));
    assert.equal(operations.length, 1);
    assert.equal(operations[0].status, "completed");
    assert.deepEqual(mutationKeys, [`billing-operation-${operations[0].id}`]);
    assert.equal(events.filter((event) => event.type === "subscription.canceled").length, 1);
    assert.equal(
      notifications.filter((event) => event.type === "billing.subscription.canceled").length,
      1,
    );
    assert.equal(notifications[0].id, operations[0].id);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(arkEvents).where(eq(arkEvents.userId, userId));
    await db.delete(billingEvents).where(eq(billingEvents.userId, userId));
    await db.delete(stripeBillingOperations).where(eq(stripeBillingOperations.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }
});
