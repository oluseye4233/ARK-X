import { pathToFileURL } from "node:url";
import type Stripe from "stripe";
import { F1000_PROMO, SUBSCRIPTION_PLANS, type BillingInterval, type SubscriptionPlan } from "@shared/schema";
import { priceCentsForPlan } from "../server/billing";
import { getStripeClient } from "../server/stripeClient";

const plans = Object.entries(SUBSCRIPTION_PLANS)
  .filter(([key, plan]) => plan.price > 0 && key !== "ENTERPRISE") as Array<[SubscriptionPlan, typeof SUBSCRIPTION_PLANS[SubscriptionPlan]]>;

export const STRIPE_SANDBOX_PLAN_FIXTURE_TAG = "stripe-billing-race-fixture";
export const STRIPE_SANDBOX_PLAN_FIXTURE_MANAGER = "stripe-sandbox-validation";
export const STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY = "fixtureGeneration";
export const STRIPE_SANDBOX_PLAN_FIXTURE_CURRENT_GENERATION = "current";
export const STRIPE_SANDBOX_PLAN_FIXTURE_LEGACY_GENERATION = "legacy";
export const SANDBOX_FIXTURE_METADATA = {
  test: STRIPE_SANDBOX_PLAN_FIXTURE_TAG,
  managedBy: STRIPE_SANDBOX_PLAN_FIXTURE_MANAGER,
  [STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY]: STRIPE_SANDBOX_PLAN_FIXTURE_CURRENT_GENERATION,
};
const SANDBOX_VALIDATION_NAME_SUFFIX = " (sandbox validation)";
const SEARCH_VISIBILITY_TIMEOUT_MS = 30_000;
const SEARCH_VISIBILITY_RETRY_MS = 500;
const SANDBOX_FIXTURE_IDEMPOTENCY_VERSION = "v1";

function sandboxFixtureIdempotencyKey(
  resource: "product" | "price" | "f1000-price",
  plan: SubscriptionPlan,
  billingInterval?: BillingInterval,
): string {
  return [
    "stripe-sandbox-validation",
    SANDBOX_FIXTURE_IDEMPOTENCY_VERSION,
    resource,
    plan,
    billingInterval,
  ].filter(Boolean).join("-");
}

async function assertTestMode(stripe: Stripe): Promise<void> {
  const balance = await stripe.balance.retrieve();
  if (balance.livemode) {
    throw new Error("Refusing to prepare Stripe plan fixtures in live mode.");
  }
}

export async function ensureStripePlanPrices(
  stripe: Stripe,
  required: ReadonlyArray<{ plan: SubscriptionPlan; billingInterval: BillingInterval }>,
): Promise<Map<string, Stripe.Price>> {
  await assertTestMode(stripe);
  const prepared = new Map<string, Stripe.Price>();
  const productsByPlan = new Map<SubscriptionPlan, Stripe.Product>();
  const legacyGenerationByPlan = new Map<SubscriptionPlan, boolean>();
  const migratedPricesByProduct = new Map<string, Stripe.Price[]>();
  const createdProducts = new Map<SubscriptionPlan, Stripe.Product>();

  for (const { plan, billingInterval } of required) {
    const key = `${plan}:${billingInterval}`;
    const amount = priceCentsForPlan(plan, false, billingInterval);
    try {
      let product = productsByPlan.get(plan);
      let productIsLegacy = legacyGenerationByPlan.get(plan) ?? false;
      if (!product) {
        const candidates: Stripe.Product[] = [];
        let page: string | undefined;
        do {
          const result = await stripe.products.search({
            query: `active:'true' AND metadata['plan']:'${plan}'`,
            limit: 100,
            ...(page ? { page } : {}),
          });
          candidates.push(...result.data);
          if (!result.has_more) break;
          if (!result.next_page) {
            throw new Error("Stripe product search returned has_more without a next_page cursor.");
          }
          page = result.next_page;
        } while (true);

        const fixtureCandidates = candidates.filter(
          (candidate) =>
            candidate.name?.endsWith(SANDBOX_VALIDATION_NAME_SUFFIX) &&
            candidate.metadata.test === STRIPE_SANDBOX_PLAN_FIXTURE_TAG &&
            candidate.metadata.managedBy === STRIPE_SANDBOX_PLAN_FIXTURE_MANAGER,
        );
        const migratedCandidates: Stripe.Product[] = [];
        for (const candidate of fixtureCandidates) {
          const candidateIsLegacy =
            candidate.metadata[STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY] !==
              STRIPE_SANDBOX_PLAN_FIXTURE_CURRENT_GENERATION;
          const generation = candidateIsLegacy
            ? STRIPE_SANDBOX_PLAN_FIXTURE_LEGACY_GENERATION
            : STRIPE_SANDBOX_PLAN_FIXTURE_CURRENT_GENERATION;
          const migratedProduct = await stripe.products.update(candidate.id, {
            metadata: {
              ...candidate.metadata,
              plan,
              ...SANDBOX_FIXTURE_METADATA,
              [STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY]: generation,
            },
          });
          const migratedPrices: Stripe.Price[] = [];
          let priceCursor: string | undefined;
          do {
            const candidatePrices = await stripe.prices.list({
              product: candidate.id,
              active: true,
              type: "recurring",
              limit: 100,
              ...(priceCursor ? { starting_after: priceCursor } : {}),
            });
            for (const candidatePrice of candidatePrices.data) {
              const interval = candidatePrice.recurring?.interval;
              migratedPrices.push(await stripe.prices.update(candidatePrice.id, {
                metadata: {
                  ...candidatePrice.metadata,
                  plan,
                  ...(interval ? { billingInterval: interval } : {}),
                  ...SANDBOX_FIXTURE_METADATA,
                  [STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY]: generation,
                },
              }));
            }
            if (!candidatePrices.has_more) break;
            priceCursor = candidatePrices.data.at(-1)?.id;
            if (!priceCursor) {
              throw new Error("Stripe price list returned has_more without a cursor.");
            }
          } while (true);
          migratedPricesByProduct.set(candidate.id, migratedPrices);
          migratedCandidates.push(migratedProduct);
        }

        product =
          migratedCandidates.find((candidate) =>
            candidate.metadata[STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY] ===
              STRIPE_SANDBOX_PLAN_FIXTURE_CURRENT_GENERATION) ??
          migratedCandidates[0] ??
          candidates[0];
        if (!product) {
          const planData = SUBSCRIPTION_PLANS[plan];
          product = await stripe.products.create(
            {
              name: `${planData.label} (sandbox validation)`,
              description: planData.features.join(" · "),
              metadata: { plan, ...SANDBOX_FIXTURE_METADATA },
            },
            { idempotencyKey: sandboxFixtureIdempotencyKey("product", plan) },
          );
          createdProducts.set(plan, product);
        }
        productIsLegacy =
          product.metadata?.[STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY] ===
            STRIPE_SANDBOX_PLAN_FIXTURE_LEGACY_GENERATION;
        productsByPlan.set(plan, product);
        legacyGenerationByPlan.set(plan, productIsLegacy);
      }

      const migratedPrices = migratedPricesByProduct.get(product.id);
      const prices = migratedPrices
        ? { data: migratedPrices }
        : await stripe.prices.list({
            product: product.id,
            active: true,
            type: "recurring",
            limit: 100,
          });
      let price = prices.data.find((candidate) =>
        candidate.currency === "usd" &&
        candidate.unit_amount === amount &&
        candidate.recurring?.interval === billingInterval);
      const productIsManagedFixture =
        product.name?.endsWith(SANDBOX_VALIDATION_NAME_SUFFIX) &&
        product.metadata?.test === STRIPE_SANDBOX_PLAN_FIXTURE_TAG &&
        product.metadata?.managedBy === STRIPE_SANDBOX_PLAN_FIXTURE_MANAGER;
      if (price && productIsManagedFixture && (
        price.metadata.test !== SANDBOX_FIXTURE_METADATA.test ||
        price.metadata.managedBy !== SANDBOX_FIXTURE_METADATA.managedBy ||
        price.metadata.plan !== plan ||
        price.metadata.billingInterval !== billingInterval ||
        price.metadata[STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY] !==
          (productIsLegacy
            ? STRIPE_SANDBOX_PLAN_FIXTURE_LEGACY_GENERATION
            : STRIPE_SANDBOX_PLAN_FIXTURE_CURRENT_GENERATION)
      )) {
        price = await stripe.prices.update(price.id, {
          metadata: {
            ...price.metadata,
            plan,
            billingInterval,
            ...SANDBOX_FIXTURE_METADATA,
            [STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY]: productIsLegacy
              ? STRIPE_SANDBOX_PLAN_FIXTURE_LEGACY_GENERATION
              : STRIPE_SANDBOX_PLAN_FIXTURE_CURRENT_GENERATION,
          },
        });
      } else if (!price) {
        price = await stripe.prices.create(
          {
            product: product.id,
            unit_amount: amount,
            currency: "usd",
            recurring: { interval: billingInterval },
            metadata: {
              plan,
              billingInterval,
              ...SANDBOX_FIXTURE_METADATA,
              [STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY]: productIsLegacy
                ? STRIPE_SANDBOX_PLAN_FIXTURE_LEGACY_GENERATION
                : STRIPE_SANDBOX_PLAN_FIXTURE_CURRENT_GENERATION,
            },
          },
          { idempotencyKey: sandboxFixtureIdempotencyKey("price", plan, billingInterval) },
        );
      }
      prepared.set(key, price);
    } catch (error) {
      throw new Error(
        `Could not prepare Stripe sandbox price for plan ${plan}, interval ${billingInterval}.`,
        { cause: error },
      );
    }
  }

  for (const [plan, product] of createdProducts) {
    const deadline = Date.now() + SEARCH_VISIBILITY_TIMEOUT_MS;
    let visible = false;
    while (!visible && Date.now() < deadline) {
      const search = await stripe.products.search({
        query: `active:'true' AND metadata['plan']:'${plan}'`,
        limit: 100,
      });
      visible = search.data.some((candidate) => candidate.id === product.id);
      if (!visible) {
        await new Promise((resolve) => setTimeout(resolve, SEARCH_VISIBILITY_RETRY_MS));
      }
    }
    if (!visible) {
      throw new Error(
        `Could not prepare Stripe sandbox price for plan ${plan}: the created product was not searchable after ${SEARCH_VISIBILITY_TIMEOUT_MS}ms.`,
      );
    }
  }

  return prepared;
}

export async function ensureF1000PromotionalPrices(
  stripe: Stripe,
  plan: SubscriptionPlan,
  product: Stripe.Product,
): Promise<Map<BillingInterval, Stripe.Price>> {
  await assertTestMode(stripe);
  const prepared = new Map<BillingInterval, Stripe.Price>();
  const promoPrice = F1000_PROMO.priceUsd[plan];
  if (promoPrice == null) return prepared;
  const fixtureGeneration =
    product.metadata?.[STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY] ===
      STRIPE_SANDBOX_PLAN_FIXTURE_LEGACY_GENERATION
      ? STRIPE_SANDBOX_PLAN_FIXTURE_LEGACY_GENERATION
      : STRIPE_SANDBOX_PLAN_FIXTURE_CURRENT_GENERATION;

  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    type: "recurring",
    limit: 100,
  });
  const promotionalPrices = [
    { billingInterval: "month" as const, unitAmount: promoPrice * 100 },
    { billingInterval: "year" as const, unitAmount: promoPrice * 1000 },
  ];

  for (const { billingInterval, unitAmount } of promotionalPrices) {
    let price = prices.data.find((candidate) =>
      candidate.unit_amount === unitAmount &&
      candidate.currency === "usd" &&
      candidate.recurring?.interval === billingInterval);
    const productIsManagedFixture =
      product.name?.endsWith(SANDBOX_VALIDATION_NAME_SUFFIX) &&
      product.metadata?.test === STRIPE_SANDBOX_PLAN_FIXTURE_TAG &&
      product.metadata?.managedBy === STRIPE_SANDBOX_PLAN_FIXTURE_MANAGER;
    if (price && productIsManagedFixture && (
      price.metadata.test !== SANDBOX_FIXTURE_METADATA.test ||
      price.metadata.managedBy !== SANDBOX_FIXTURE_METADATA.managedBy ||
      price.metadata.plan !== plan ||
      price.metadata.promotion !== "f1000" ||
      price.metadata.billingInterval !== billingInterval ||
      price.metadata[STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY] !== fixtureGeneration
    )) {
      price = await stripe.prices.update(price.id, {
        metadata: {
          ...price.metadata,
          plan,
          promotion: "f1000",
          billingInterval,
          ...SANDBOX_FIXTURE_METADATA,
          [STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY]: fixtureGeneration,
        },
      });
    } else if (!price) {
      price = await stripe.prices.create(
        {
          product: product.id,
          unit_amount: unitAmount,
          currency: "usd",
          recurring: { interval: billingInterval },
          metadata: {
            plan,
            promotion: "f1000",
            billingInterval,
            ...SANDBOX_FIXTURE_METADATA,
            [STRIPE_SANDBOX_PLAN_FIXTURE_GENERATION_KEY]: fixtureGeneration,
          },
        },
        {
          idempotencyKey: sandboxFixtureIdempotencyKey(
            "f1000-price",
            plan,
            billingInterval,
          ),
        },
      );
    }
    prepared.set(billingInterval, price);
  }

  return prepared;
}

async function seedAllStripePlans(): Promise<void> {
  const stripe = await getStripeClient();
  await assertTestMode(stripe);
  await ensureStripePlanPrices(
    stripe,
    plans.flatMap(([plan]) => [
      { plan, billingInterval: "month" as const },
      { plan, billingInterval: "year" as const },
    ]),
  );

  for (const [planId] of plans) {
    const existing = await stripe.products.search({ query: `active:'true' AND metadata['plan']:'${planId}'`, limit: 1 });
    const product = existing.data[0];
    if (!product) throw new Error(`Could not prepare Stripe sandbox prices for plan ${planId}.`);
    await ensureF1000PromotionalPrices(stripe, planId, product);
    console.log(`Configured ${planId}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await seedAllStripePlans();
}