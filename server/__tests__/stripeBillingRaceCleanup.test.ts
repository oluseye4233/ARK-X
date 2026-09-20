import test from "node:test";
import assert from "node:assert/strict";
import { cleanupStripeBillingRaceFixtures } from "../stripeClient";

function fakeStripe(options: { livemode?: boolean } = {}) {
  const calls: string[] = [];
  const customers = [
    { id: "cus_stale", created: 100 },
    { id: "cus_recent", created: 950 },
  ];
  const subscriptions = [
    { id: "sub_stale", created: 100, customer: "cus_stale", metadata: { test: "stripe-billing-race" } },
    { id: "sub_recent", created: 950, customer: "cus_recent", metadata: { test: "stripe-billing-race" } },
  ];
  const products = [{
    id: "prod_plan_fixture",
    active: true,
    metadata: { managedBy: "stripe-sandbox-validation" },
  }];
  const prices = [{
    id: "price_plan_fixture",
    active: true,
    product: "prod_plan_fixture",
    metadata: { managedBy: "stripe-sandbox-validation" },
  }];
  return {
    calls,
    client: {
      balance: { retrieve: async () => ({ livemode: options.livemode ?? false }) },
      customers: {
        search: async () => ({ data: customers, has_more: false }),
        del: async (id: string) => { calls.push(`customer:${id}`); },
      },
      subscriptions: {
        search: async () => ({ data: subscriptions, has_more: false }),
        list: async (params: { customer?: string; status: string }) => params.customer
          ? {
              data: subscriptions
                .filter((subscription) => subscription.customer === params.customer)
                .map(({ id }) => ({ id, status: "active", items: { data: [] } })),
              has_more: false,
            }
          : { data: [], has_more: false },
        cancel: async (id: string) => { calls.push(`subscription:${id}`); },
      },
      products: {
        search: async () => ({ data: products, has_more: false }),
        update: async (id: string) => { calls.push(`product:${id}`); },
      },
      prices: {
        search: async () => ({ data: prices, has_more: false }),
        update: async (id: string) => { calls.push(`price:${id}`); },
      },
    },
  };
}

test("Stripe billing-race cleanup dry-run identifies generation-less legacy fixtures", async () => {
  const stripe = fakeStripe();
  const result = await cleanupStripeBillingRaceFixtures(stripe.client, {
    dryRun: true,
    now: 1_000_000,
    olderThanMs: 100_000,
  });

  assert.deepEqual(result.subscriptions, ["sub_stale"]);
  assert.deepEqual(result.customers, ["cus_stale"]);
  assert.deepEqual(result.products, ["prod_plan_fixture"]);
  assert.deepEqual(result.prices, ["price_plan_fixture"]);
  assert.deepEqual(result.skippedProducts, []);
  assert.deepEqual(result.skippedPrices, []);
  assert.deepEqual(stripe.calls, []);
});

test("Stripe fixture cleanup protects prices and products used by active subscriptions", async () => {
  const stripe = fakeStripe();
  stripe.client.subscriptions.list = async (params) => "customer" in params
    ? { data: [], has_more: false }
    : {
        data: [{
          id: "sub_active",
          status: "active",
          items: { data: [{ price: { id: "price_plan_fixture" } }] },
        }],
        has_more: false,
      };

  const result = await cleanupStripeBillingRaceFixtures(stripe.client, { dryRun: false });

  assert.deepEqual(result.prices, []);
  assert.deepEqual(result.products, []);
  assert.deepEqual(result.skippedPrices, ["price_plan_fixture"]);
  assert.deepEqual(result.skippedProducts, ["prod_plan_fixture"]);
  assert.ok(!stripe.calls.some((call) => call.startsWith("price:") || call.startsWith("product:")));
});

test("Stripe fixture cleanup protects a legacy product used through any tagged price generation", async () => {
  const stripe = fakeStripe();
  stripe.client.prices.search = async () => ({
    data: [{
      id: "price_current_on_legacy",
      active: true,
      product: "prod_plan_fixture",
      metadata: { fixtureGeneration: "current", managedBy: "stripe-sandbox-validation" },
    }],
    has_more: false,
  });
  stripe.client.subscriptions.list = async (params) => "customer" in params
    ? { data: [], has_more: false }
    : {
        data: [{
          id: "sub_trialing",
          status: "trialing",
          items: { data: [{ price: { id: "price_current_on_legacy" } }] },
        }],
        has_more: false,
      };

  const result = await cleanupStripeBillingRaceFixtures(stripe.client, { dryRun: false });

  assert.deepEqual(result.products, []);
  assert.deepEqual(result.skippedProducts, ["prod_plan_fixture"]);
  assert.deepEqual(result.prices, []);
  assert.deepEqual(result.skippedPrices, []);
  assert.ok(!stripe.calls.includes("product:prod_plan_fixture"));
});

test("Stripe fixture cleanup leaves the current canonical fixture generation active", async () => {
  const stripe = fakeStripe();
  stripe.client.products.search = async () => ({
    data: [{
      id: "prod_current",
      active: true,
      metadata: { fixtureGeneration: "current", managedBy: "stripe-sandbox-validation" },
    }],
    has_more: false,
  });
  stripe.client.prices.search = async () => ({
    data: [{
      id: "price_current",
      active: true,
      product: "prod_current",
      metadata: { fixtureGeneration: "current", managedBy: "stripe-sandbox-validation" },
    }],
    has_more: false,
  });

  const result = await cleanupStripeBillingRaceFixtures(stripe.client, { dryRun: false });

  assert.deepEqual(result.products, []);
  assert.deepEqual(result.prices, []);
  assert.ok(!stripe.calls.some((call) => call === "product:prod_current" || call === "price:price_current"));
});

test("Stripe fixture cleanup ignores legacy-like resources without the ownership marker", async () => {
  const stripe = fakeStripe();
  stripe.client.products.search = async () => ({
    data: [{ id: "prod_unowned", active: true, metadata: { fixtureGeneration: "legacy" } }],
    has_more: false,
  });
  stripe.client.prices.search = async () => ({
    data: [{
      id: "price_unowned",
      active: true,
      product: "prod_unowned",
      metadata: { fixtureGeneration: "legacy" },
    }],
    has_more: false,
  });

  const result = await cleanupStripeBillingRaceFixtures(stripe.client, { dryRun: false });

  assert.deepEqual(result.products, []);
  assert.deepEqual(result.prices, []);
  assert.ok(!stripe.calls.includes("product:prod_unowned"));
  assert.ok(!stripe.calls.includes("price:price_unowned"));
});

test("Stripe billing-race cleanup cancels subscriptions before deleting customers", async () => {
  const stripe = fakeStripe();
  await cleanupStripeBillingRaceFixtures(stripe.client, {
    dryRun: false,
    now: 1_000_000,
    olderThanMs: 100_000,
  });

  assert.deepEqual(stripe.calls, [
    "subscription:sub_stale",
    "customer:cus_stale",
    "price:price_plan_fixture",
    "product:prod_plan_fixture",
  ]);
});

test("Stripe billing-race cleanup preserves a tagged customer with unrelated subscriptions", async () => {
  const stripe = fakeStripe();
  const originalList = stripe.client.subscriptions.list;
  stripe.client.subscriptions.list = async (params) => {
    const result = await originalList(params);
    return params.customer === "cus_stale"
      ? { data: [...result.data, { id: "sub_unrelated" }], has_more: false }
      : result;
  };

  const result = await cleanupStripeBillingRaceFixtures(stripe.client, {
    dryRun: false,
    now: 1_000_000,
    olderThanMs: 100_000,
  });

  assert.deepEqual(stripe.calls, [
    "subscription:sub_stale",
    "price:price_plan_fixture",
    "product:prod_plan_fixture",
  ]);
  assert.deepEqual(result.customers, []);
  assert.deepEqual(result.skippedCustomers, [{
    customerId: "cus_stale",
    protectedSubscriptionIds: ["sub_unrelated"],
  }]);
});

test("Stripe billing-race cleanup refuses live-mode accounts before searching", async () => {
  const stripe = fakeStripe({ livemode: true });
  await assert.rejects(
    cleanupStripeBillingRaceFixtures(stripe.client, { dryRun: false }),
    /live-mode account/,
  );
  assert.deepEqual(stripe.calls, []);
});