import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import type { BillingInterval } from "@shared/schema";
import {
  ensureF1000PromotionalPrices,
  ensureStripePlanPrices,
} from "../../scripts/seedStripePlans";

test("sandbox plan fixtures wait until a newly created product is searchable", async () => {
  const product = {
    id: "prod_fixture",
    metadata: {
      plan: "INDIVIDUAL_PRO",
      test: "stripe-billing-race-fixture",
      managedBy: "stripe-sandbox-validation",
    },
  };
  const price = {
    id: "price_fixture",
    currency: "usd",
    unit_amount: 2999,
    recurring: { interval: "month" },
  };
  let searchCalls = 0;
  let productCreateCalls = 0;
  let priceCreateCalls = 0;
  const stripe = {
    balance: {
      retrieve: async () => ({ livemode: false }),
    },
    products: {
      search: async () => {
        searchCalls += 1;
        return { data: searchCalls < 3 ? [] : [product] };
      },
      create: async (
        input: { metadata: Record<string, string> },
        options: { idempotencyKey?: string },
      ) => {
        productCreateCalls += 1;
        assert.equal(input.metadata.test, "stripe-billing-race-fixture");
        assert.equal(input.metadata.managedBy, "stripe-sandbox-validation");
        assert.equal(
          options.idempotencyKey,
          "stripe-sandbox-validation-v1-product-INDIVIDUAL_PRO",
        );
        return product;
      },
    },
    prices: {
      list: async () => ({ data: [] }),
      create: async (
        input: { metadata: Record<string, string> },
        options: { idempotencyKey?: string },
      ) => {
        priceCreateCalls += 1;
        assert.equal(input.metadata.test, "stripe-billing-race-fixture");
        assert.equal(input.metadata.billingInterval, "month");
        assert.equal(
          options.idempotencyKey,
          "stripe-sandbox-validation-v1-price-INDIVIDUAL_PRO-month",
        );
        return price;
      },
    },
  } as unknown as Stripe;

  const prepared = await ensureStripePlanPrices(stripe, [
    { plan: "INDIVIDUAL_PRO", billingInterval: "month" },
  ]);

  assert.equal(prepared.get("INDIVIDUAL_PRO:month")?.id, price.id);
  assert.equal(productCreateCalls, 1);
  assert.equal(priceCreateCalls, 1);
  assert.equal(searchCalls, 3);
});

test("simultaneous sandbox fixture preparation reuses one product and price", async () => {
  const product = { id: "prod_shared" };
  const price = {
    id: "price_shared",
    currency: "usd",
    unit_amount: 2999,
    recurring: { interval: "month" },
  };
  const productsByIdempotencyKey = new Map<string, typeof product>();
  const pricesByIdempotencyKey = new Map<string, typeof price>();
  const productCreateAttempts: string[] = [];
  const priceCreateAttempts: string[] = [];
  let initialSearches = 0;
  let releaseInitialSearches!: () => void;
  const bothInitialSearches = new Promise<void>((resolve) => {
    releaseInitialSearches = resolve;
  });

  const stripe = {
    balance: {
      retrieve: async () => ({ livemode: false }),
    },
    products: {
      search: async () => {
        initialSearches += 1;
        if (initialSearches <= 2) {
          if (initialSearches === 2) releaseInitialSearches();
          await bothInitialSearches;
          return { data: [] };
        }
        return { data: [product] };
      },
      create: async (
        _input: unknown,
        options: { idempotencyKey?: string },
      ) => {
        assert.ok(options.idempotencyKey);
        productCreateAttempts.push(options.idempotencyKey);
        const existing = productsByIdempotencyKey.get(options.idempotencyKey);
        if (existing) return existing;
        productsByIdempotencyKey.set(options.idempotencyKey, product);
        return product;
      },
    },
    prices: {
      list: async () => ({ data: [] }),
      create: async (
        _input: unknown,
        options: { idempotencyKey?: string },
      ) => {
        assert.ok(options.idempotencyKey);
        priceCreateAttempts.push(options.idempotencyKey);
        const existing = pricesByIdempotencyKey.get(options.idempotencyKey);
        if (existing) return existing;
        pricesByIdempotencyKey.set(options.idempotencyKey, price);
        return price;
      },
    },
  } as unknown as Stripe;

  const required = [{ plan: "INDIVIDUAL_PRO", billingInterval: "month" }] as const;
  const [first, second] = await Promise.all([
    ensureStripePlanPrices(stripe, required),
    ensureStripePlanPrices(stripe, required),
  ]);

  assert.equal(first.get("INDIVIDUAL_PRO:month")?.id, price.id);
  assert.equal(second.get("INDIVIDUAL_PRO:month")?.id, price.id);
  assert.equal(productsByIdempotencyKey.size, 1);
  assert.equal(pricesByIdempotencyKey.size, 1);
  assert.deepEqual(new Set(productCreateAttempts), new Set([
    "stripe-sandbox-validation-v1-product-INDIVIDUAL_PRO",
  ]));
  assert.deepEqual(new Set(priceCreateAttempts), new Set([
    "stripe-sandbox-validation-v1-price-INDIVIDUAL_PRO-month",
  ]));
});

test("overlapping promotional seed preparation reuses legacy monthly and annual prices", async () => {
  const product = {
    id: "prod_f1000",
    name: "Individual Pro (sandbox validation)",
    metadata: {
      plan: "INDIVIDUAL_PRO",
      test: "stripe-billing-race-fixture",
      managedBy: "stripe-sandbox-validation",
      fixtureGeneration: "legacy",
    },
  } as unknown as Stripe.Product;
  const pricesByIdempotencyKey = new Map<string, Stripe.Price>();
  const createAttempts: string[] = [];
  let listCalls = 0;
  let releaseLists!: () => void;
  const bothListsStarted = new Promise<void>((resolve) => {
    releaseLists = resolve;
  });
  const stripe = {
    balance: {
      retrieve: async () => ({ livemode: false }),
    },
    prices: {
      list: async () => {
        listCalls += 1;
        if (listCalls === 2) releaseLists();
        await bothListsStarted;
        return { data: [] };
      },
      create: async (
        input: {
          unit_amount: number;
          recurring: { interval: BillingInterval };
          metadata: Record<string, string>;
        },
        options: { idempotencyKey?: string },
      ) => {
        assert.ok(options.idempotencyKey);
        createAttempts.push(options.idempotencyKey);
        const existing = pricesByIdempotencyKey.get(options.idempotencyKey);
        if (existing) return existing;
        assert.equal(input.metadata.promotion, "f1000");
        assert.equal(input.metadata.billingInterval, input.recurring.interval);
        assert.equal(input.metadata.fixtureGeneration, "legacy");
        const price = {
          id: `price_${input.recurring.interval}`,
          currency: "usd",
          unit_amount: input.unit_amount,
          recurring: { interval: input.recurring.interval },
        } as Stripe.Price;
        pricesByIdempotencyKey.set(options.idempotencyKey, price);
        return price;
      },
    },
  } as unknown as Stripe;

  const [first, second] = await Promise.all([
    ensureF1000PromotionalPrices(stripe, "INDIVIDUAL_PRO", product),
    ensureF1000PromotionalPrices(stripe, "INDIVIDUAL_PRO", product),
  ]);

  assert.equal(first.get("month")?.id, "price_month");
  assert.equal(second.get("month")?.id, "price_month");
  assert.equal(first.get("year")?.id, "price_year");
  assert.equal(second.get("year")?.id, "price_year");
  assert.equal(pricesByIdempotencyKey.size, 2);
  assert.deepEqual(new Set(createAttempts), new Set([
    "stripe-sandbox-validation-v1-f1000-price-INDIVIDUAL_PRO-month",
    "stripe-sandbox-validation-v1-f1000-price-INDIVIDUAL_PRO-year",
  ]));
});

test("sandbox plan fixture failures identify the plan and interval", async () => {
  const stripe = {
    balance: {
      retrieve: async () => ({ livemode: false }),
    },
    products: {
      search: async () => ({ data: [{ id: "prod_fixture" }] }),
    },
    prices: {
      list: async () => ({ data: [] }),
      create: async () => {
        throw new Error("provider unavailable");
      },
    },
  } as unknown as Stripe;

  await assert.rejects(
    ensureStripePlanPrices(stripe, [
      { plan: "ARCHITECT", billingInterval: "year" },
    ]),
    /plan ARCHITECT, interval year/,
  );
});

test("legacy untagged sandbox products and prices are consolidated under managed metadata", async () => {
  const product = {
    id: "prod_legacy",
    name: "Individual Pro (sandbox validation)",
    metadata: {
      plan: "INDIVIDUAL_PRO",
      test: "stripe-billing-race-fixture",
      managedBy: "stripe-sandbox-validation",
    },
  };
  const ordinaryProduct = {
    id: "prod_checkout_first",
    name: "Individual Pro",
    metadata: { plan: "INDIVIDUAL_PRO" },
  };
  const prices = [
    {
      id: "price_legacy_month",
      currency: "usd",
      unit_amount: 2999,
      recurring: { interval: "month" },
      metadata: {
        plan: "INDIVIDUAL_PRO",
        billingInterval: "month",
        test: "stripe-billing-race-fixture",
        managedBy: "stripe-sandbox-validation",
      },
    },
    {
      id: "price_legacy_year",
      currency: "usd",
      unit_amount: 29900,
      recurring: { interval: "year" },
      metadata: {
        plan: "INDIVIDUAL_PRO",
        billingInterval: "year",
        test: "stripe-billing-race-fixture",
        managedBy: "stripe-sandbox-validation",
      },
    },
  ];
  const productUpdates: unknown[] = [];
  const priceUpdates: unknown[] = [];
  const priceListCursors: Array<string | undefined> = [];
  const stripe = {
    balance: { retrieve: async () => ({ livemode: false }) },
    products: {
      search: async () => ({ data: [ordinaryProduct, product], has_more: false }),
      update: async (id: string, input: unknown) => {
        productUpdates.push({ id, input });
        return {
          ...product,
          metadata: {
            plan: "INDIVIDUAL_PRO",
            test: "stripe-billing-race-fixture",
            managedBy: "stripe-sandbox-validation",
            fixtureGeneration: "legacy",
          },
        };
      },
    },
    prices: {
      list: async (params: { starting_after?: string }) => {
        priceListCursors.push(params.starting_after);
        return params.starting_after
          ? { data: [prices[1]], has_more: false }
          : { data: [prices[0]], has_more: true };
      },
      update: async (id: string, input: { metadata: Record<string, string> }) => {
        priceUpdates.push({ id, input });
        const price = prices.find((candidate) => candidate.id === id);
        return price ? { ...price, metadata: input.metadata } : undefined;
      },
    },
  } as unknown as Stripe;

  await ensureStripePlanPrices(stripe, [
    { plan: "INDIVIDUAL_PRO", billingInterval: "month" },
    { plan: "INDIVIDUAL_PRO", billingInterval: "year" },
  ]);

  assert.deepEqual(productUpdates, [{
    id: "prod_legacy",
    input: {
      metadata: {
        plan: "INDIVIDUAL_PRO",
        test: "stripe-billing-race-fixture",
        managedBy: "stripe-sandbox-validation",
        fixtureGeneration: "legacy",
      },
    },
  }]);
  assert.deepEqual(priceListCursors, [undefined, "price_legacy_month"]);
  assert.deepEqual(priceUpdates, [{
    id: "price_legacy_month",
    input: {
      metadata: {
        plan: "INDIVIDUAL_PRO",
        billingInterval: "month",
        test: "stripe-billing-race-fixture",
        managedBy: "stripe-sandbox-validation",
        fixtureGeneration: "legacy",
      },
    },
  }, {
    id: "price_legacy_year",
    input: {
      metadata: {
        plan: "INDIVIDUAL_PRO",
        billingInterval: "year",
        test: "stripe-billing-race-fixture",
        managedBy: "stripe-sandbox-validation",
        fixtureGeneration: "legacy",
      },
    },
  }]);
});

test("same-named test products without ownership tags are not reclassified as disposable fixtures", async () => {
  const product = {
    id: "prod_checkout",
    name: "Individual Pro (sandbox validation)",
    metadata: { plan: "INDIVIDUAL_PRO" },
  };
  const price = {
    id: "price_checkout",
    currency: "usd",
    unit_amount: 2999,
    recurring: { interval: "month" },
    metadata: {},
  };
  let updates = 0;
  const stripe = {
    balance: { retrieve: async () => ({ livemode: false }) },
    products: {
      search: async () => ({ data: [product] }),
      update: async () => { updates += 1; return product; },
    },
    prices: {
      list: async () => ({ data: [price] }),
      update: async () => { updates += 1; return price; },
    },
  } as unknown as Stripe;

  const result = await ensureStripePlanPrices(stripe, [
    { plan: "INDIVIDUAL_PRO", billingInterval: "month" },
  ]);

  assert.equal(result.get("INDIVIDUAL_PRO:month")?.id, "price_checkout");
  assert.equal(updates, 0);
});

test("sandbox plan fixture preparation refuses live mode before inspecting products", async () => {
  let searched = false;
  const stripe = {
    balance: { retrieve: async () => ({ livemode: true }) },
    products: { search: async () => { searched = true; return { data: [] }; } },
  } as unknown as Stripe;

  await assert.rejects(
    ensureStripePlanPrices(stripe, [{ plan: "INDIVIDUAL_PRO", billingInterval: "month" }]),
    /live mode/,
  );
  assert.equal(searched, false);
});