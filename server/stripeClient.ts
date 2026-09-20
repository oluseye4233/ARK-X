import Stripe from "stripe";
import { StripeSync, runMigrations as runStripeMigrations } from "stripe-replit-sync";

export const STRIPE_BILLING_MONITOR_INTERVAL_MS = (() => {
  const configured = Number(process.env.STRIPE_BILLING_MONITOR_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 1_000 ? configured : 60_000;
})();

let billingMonitorTimer: NodeJS.Timeout | null = null;
let billingMonitorRunning = false;
let lastBillingAlertSignature: string | null = null;

async function credentials(): Promise<{ secretKey: string; webhookSecret?: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;
  if (!hostname || !token) throw new Error("Stripe integration is not connected.");
  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    { headers: { Accept: "application/json", X_REPLIT_TOKEN: token }, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error(`Stripe connection failed (${response.status}).`);
  const body: any = await response.json();
  const settings = body.items?.[0]?.settings;
  if (!settings?.secret) throw new Error("Stripe connection has no secret key.");
  return { secretKey: settings.secret, webhookSecret: settings.webhook_secret };
}

export async function getStripeClient(): Promise<Stripe> {
  return new Stripe((await credentials()).secretKey);
}

export async function constructStripeEvent(payload: Buffer, signature: string): Promise<Stripe.Event> {
  const { secretKey, webhookSecret } = await credentials();
  if (!webhookSecret) throw new Error("Stripe webhook signing secret is not configured.");
  return new Stripe(secretKey).webhooks.constructEvent(payload, signature, webhookSecret);
}

export async function getStripeSync(): Promise<StripeSync> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for Stripe synchronization.");
  const { secretKey, webhookSecret } = await credentials();
  return new StripeSync({
    poolConfig: { connectionString: process.env.DATABASE_URL, max: 3 },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret,
  });
}

export async function initializeStripe(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for Stripe synchronization.");
  await runStripeMigrations({ databaseUrl: process.env.DATABASE_URL });
  const sync = await getStripeSync();
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (!domain) throw new Error("REPLIT_DOMAINS is required to configure Stripe webhooks.");
  await sync.findOrCreateManagedWebhook(`https://${domain}/api/stripe/webhook`, {
    enabled_events: [
      "checkout.session.completed", "invoice.payment_failed", "invoice.payment_succeeded",
      "customer.subscription.updated", "customer.subscription.deleted", "charge.refunded",
    ],
    description: "ARK Onecraft subscription lifecycle",
  });
  await sync.syncBackfill();
  const { reconcileExistingStripeEntitlements, resumePendingStripeBillingOperations } = await import("./stripeBilling");
  const stripe = await getStripeClient();
  await resumePendingStripeBillingOperations(stripe);
  await reconcileExistingStripeEntitlements(stripe);
  startStripeBillingRecoveryMonitor();
}

type BillingRecoveryMonitorHealth = {
  ok: boolean;
  stuckOperations: Array<{ operationId: string; recoveryAttempts: number; errorCategory: string | null }>;
};

export async function pollStripeBillingRecoveryHealth(deps: {
  getHealth?: () => Promise<BillingRecoveryMonitorHealth>;
  alertMaintainers?: (health: BillingRecoveryMonitorHealth) => void;
} = {}): Promise<void> {
  if (billingMonitorRunning) return;
  billingMonitorRunning = true;
  try {
    const billing = await import("./stripeBilling");
    const health = await (deps.getHealth ?? billing.getStripeBillingRecoveryHealth)();
    if (health.ok) {
      lastBillingAlertSignature = null;
      return;
    }
    const signature = health.stuckOperations
      .map(operation => `${operation.operationId}:${operation.recoveryAttempts}:${operation.errorCategory ?? "none"}`)
      .sort()
      .join("|");
    if (signature === lastBillingAlertSignature) return;
    (deps.alertMaintainers ?? billing.emitStripeBillingRecoveryAlert)(health as any);
    lastBillingAlertSignature = signature;
  } catch (error) {
    console.error("Stripe billing recovery monitor failed:", error);
  } finally {
    billingMonitorRunning = false;
  }
}

export function startStripeBillingRecoveryMonitor(
  intervalMs = STRIPE_BILLING_MONITOR_INTERVAL_MS,
): boolean {
  if (billingMonitorTimer) return false;
  billingMonitorTimer = setInterval(() => {
    void pollStripeBillingRecoveryHealth();
  }, intervalMs);
  billingMonitorTimer.unref?.();
  return true;
}

export function stopStripeBillingRecoveryMonitor(): void {
  if (billingMonitorTimer) {
    clearInterval(billingMonitorTimer);
    billingMonitorTimer = null;
  }
  lastBillingAlertSignature = null;
}

export async function verifyAndRetrieveStripeEvent(payload: Buffer, signature: string): Promise<Stripe.Event> {
  const sync = await getStripeSync();
  await sync.processWebhook(payload, signature);
  const untrustedId = JSON.parse(payload.toString("utf8"))?.id;
  if (typeof untrustedId !== "string") throw new Error("Stripe event has no id.");
  return (await getStripeClient()).events.retrieve(untrustedId);
}

export const STRIPE_BILLING_RACE_TEST_TAG = "stripe-billing-race";
export const STRIPE_SANDBOX_PLAN_FIXTURE_TAG = "stripe-billing-race-fixture";
export const STRIPE_SANDBOX_PLAN_FIXTURE_MANAGER = "stripe-sandbox-validation";
export const STRIPE_SANDBOX_PLAN_FIXTURE_LEGACY_GENERATION = "legacy";

export async function cleanupStripeBillingRaceFixtures(
  stripe: StripeCleanupClient,
  options: { dryRun?: boolean; olderThanMs?: number; now?: number } = {},
): Promise<StripeBillingRaceCleanupResult> {
  const balance = await stripe.balance.retrieve();
  if (balance.livemode) {
    throw new Error("Refusing to clean Stripe billing-race fixtures from a live-mode account.");
  }

  const dryRun = options.dryRun ?? true;
  const olderThanMs = options.olderThanMs ?? 24 * 60 * 60 * 1000;
  if (!Number.isFinite(olderThanMs) || olderThanMs < 0) {
    throw new Error("olderThanMs must be a non-negative finite number.");
  }
  const cutoffUnix = Math.floor(((options.now ?? Date.now()) - olderThanMs) / 1000);
  const query = `metadata['test']:'${STRIPE_BILLING_RACE_TEST_TAG}'`;

  const searchAll = async <T>(
    search: (params: { query: string; limit: number; page?: string }) => Promise<{
      data: T[];
      has_more: boolean;
      next_page?: string | null;
    }>,
  ): Promise<T[]> => {
    const records: T[] = [];
    let page: string | undefined;
    do {
      const result = await search({ query, limit: 100, ...(page ? { page } : {}) });
      records.push(...result.data);
      if (!result.has_more) break;
      if (!result.next_page) throw new Error("Stripe search returned has_more without a next_page cursor.");
      page = result.next_page;
    } while (true);
    return records;
  };

  const fixtureQuery =
    `metadata['test']:'${STRIPE_SANDBOX_PLAN_FIXTURE_TAG}' ` +
    `AND metadata['managedBy']:'${STRIPE_SANDBOX_PLAN_FIXTURE_MANAGER}'`;
  const searchAllWithQuery = async <T>(
    search: (params: { query: string; limit: number; page?: string }) => Promise<{
      data: T[];
      has_more: boolean;
      next_page?: string | null;
    }>,
    searchQuery: string,
  ): Promise<T[]> => {
    const records: T[] = [];
    let page: string | undefined;
    do {
      const result = await search({ query: searchQuery, limit: 100, ...(page ? { page } : {}) });
      records.push(...result.data);
      if (!result.has_more) break;
      if (!result.next_page) throw new Error("Stripe search returned has_more without a next_page cursor.");
      page = result.next_page;
    } while (true);
    return records;
  };

  const [taggedCustomers, taggedSubscriptions, taggedProducts, taggedPrices] = await Promise.all([
    searchAll((params) => stripe.customers.search(params)),
    searchAll((params) => stripe.subscriptions.search(params)),
    searchAllWithQuery((params) => stripe.products.search(params), fixtureQuery),
    searchAllWithQuery((params) => stripe.prices.search(params), fixtureQuery),
  ]);
  const staleCustomers = taggedCustomers.filter((customer) => customer.created <= cutoffUnix);
  const staleSubscriptions = taggedSubscriptions.filter((subscription) => subscription.created <= cutoffUnix);
  const staleSubscriptionIds = new Set(staleSubscriptions.map((subscription) => subscription.id));

  const listSubscriptionIds = async (customerId: string): Promise<string[]> => {
    const ids: string[] = [];
    let startingAfter: string | undefined;
    do {
      const page = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      ids.push(...page.data.map((subscription) => subscription.id));
      if (!page.has_more) return ids;
      startingAfter = page.data.at(-1)?.id;
      if (!startingAfter) throw new Error("Stripe subscription list returned has_more without a cursor.");
    } while (true);
  };

  const customers: string[] = [];
  const skippedCustomers: StripeBillingRaceCleanupResult["skippedCustomers"] = [];
  for (const customer of staleCustomers) {
    const associatedIds = await listSubscriptionIds(customer.id);
    const protectedSubscriptionIds = associatedIds.filter((id) => !staleSubscriptionIds.has(id));
    if (protectedSubscriptionIds.length > 0) {
      skippedCustomers.push({ customerId: customer.id, protectedSubscriptionIds });
    } else {
      customers.push(customer.id);
    }
  }

  const subscriptions = staleSubscriptions.map((subscription) => subscription.id);
  const inUseSubscriptions: Array<{
    id: string;
    status: string;
    items: { data: Array<{ price: { id: string } }> };
  }> = [];
  let subscriptionCursor: string | undefined;
  do {
    const page = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      ...(subscriptionCursor ? { starting_after: subscriptionCursor } : {}),
    });
    inUseSubscriptions.push(...page.data.filter(
      (subscription) => !["canceled", "incomplete_expired"].includes(subscription.status),
    ));
    if (!page.has_more) break;
    subscriptionCursor = page.data.at(-1)?.id;
    if (!subscriptionCursor) {
      throw new Error("Refusing fixture cleanup because subscription pagination returned no cursor.");
    }
  } while (true);
  const protectedPriceIds = new Set(
    inUseSubscriptions.flatMap((subscription) =>
      subscription.items.data.map((item) => item.price.id)),
  );
  const ownedProducts = taggedProducts.filter(
    (product) => product.metadata.managedBy === STRIPE_SANDBOX_PLAN_FIXTURE_MANAGER,
  );
  const ownedPrices = taggedPrices.filter(
    (price) => price.metadata.managedBy === STRIPE_SANDBOX_PLAN_FIXTURE_MANAGER,
  );
  const legacyProducts = ownedProducts.filter(
    (product) => product.metadata.fixtureGeneration !== "current",
  );
  const legacyPrices = ownedPrices.filter(
    (price) => price.metadata.fixtureGeneration !== "current",
  );
  const skippedPrices = legacyPrices
    .filter((price) => price.active && protectedPriceIds.has(price.id))
    .map((price) => price.id);
  const prices = legacyPrices
    .filter((price) => price.active && !protectedPriceIds.has(price.id))
    .map((price) => price.id);
  const protectedProductIds = new Set(
    ownedPrices
      .filter((price) => protectedPriceIds.has(price.id))
      .map((price) => typeof price.product === "string" ? price.product : price.product.id),
  );
  for (const price of ownedPrices) {
    if (price.active && price.metadata.fixtureGeneration === "current") {
      protectedProductIds.add(typeof price.product === "string" ? price.product : price.product.id);
    }
  }
  const skippedProducts = legacyProducts
    .filter((product) => product.active && protectedProductIds.has(product.id))
    .map((product) => product.id);
  const products = legacyProducts
    .filter((product) => product.active && !protectedProductIds.has(product.id))
    .map((product) => product.id);
  if (!dryRun) {
    for (const subscriptionId of subscriptions) await stripe.subscriptions.cancel(subscriptionId);
    for (const customerId of customers) await stripe.customers.del(customerId);
    for (const priceId of prices) await stripe.prices.update(priceId, { active: false });
    for (const productId of products) await stripe.products.update(productId, { active: false });
  }

  return {
    dryRun, cutoffUnix, subscriptions, customers, skippedCustomers,
    products, prices, skippedProducts, skippedPrices,
  };
}

type StripeCleanupClient = {
  balance: { retrieve(): Promise<{ livemode: boolean }> };
  customers: {
    search(params: { query: string; limit: number; page?: string }): Promise<{
      data: Array<{ id: string; created: number }>;
      has_more: boolean;
      next_page?: string | null;
    }>;
    del(id: string): Promise<unknown>;
  };
  subscriptions: {
    search(params: { query: string; limit: number; page?: string }): Promise<{
      data: Array<{ id: string; created: number; customer: string | { id: string }; metadata: Record<string, string> }>;
      has_more: boolean;
      next_page?: string | null;
    }>;
    list(params:
      | { customer: string; status: "all"; limit: number; starting_after?: string }
      | { status: "all"; limit: number; starting_after?: string }
    ): Promise<{
      data: Array<{
        id: string;
        status: string;
        items: { data: Array<{ price: { id: string } }> };
      }>;
      has_more: boolean;
    }>;
    cancel(id: string): Promise<unknown>;
  };
  products: {
    search(params: { query: string; limit: number; page?: string }): Promise<{
      data: Array<{ id: string; active: boolean; metadata: Record<string, string> }>;
      has_more: boolean;
      next_page?: string | null;
    }>;
    update(id: string, params: { active: false }): Promise<unknown>;
  };
  prices: {
    search(params: { query: string; limit: number; page?: string }): Promise<{
      data: Array<{
        id: string;
        active: boolean;
        product: string | { id: string };
        metadata: Record<string, string>;
      }>;
      has_more: boolean;
      next_page?: string | null;
    }>;
    update(id: string, params: { active: false }): Promise<unknown>;
  };
};

export type StripeBillingRaceCleanupResult = {
  dryRun: boolean;
  cutoffUnix: number;
  subscriptions: string[];
  customers: string[];
  skippedCustomers: Array<{ customerId: string; protectedSubscriptionIds: string[] }>;
  products: string[];
  prices: string[];
  skippedProducts: string[];
  skippedPrices: string[];
};
