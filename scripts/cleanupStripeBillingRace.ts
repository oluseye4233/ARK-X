import {
  cleanupStripeBillingRaceFixtures,
  getStripeClient,
} from "../server/stripeClient";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const unknownArgs = [...args].filter((arg) => arg !== "--apply");
if (unknownArgs.length > 0) {
  throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}. Use --apply to delete; otherwise the command is a dry run.`);
}

const result = await cleanupStripeBillingRaceFixtures(await getStripeClient(), {
  dryRun: !apply,
});

console.log(`${result.dryRun ? "Dry run" : "Cleanup complete"}:`);
console.log(`  stale subscriptions ${result.dryRun ? "found" : "deleted"}: ${result.subscriptions.length}`);
console.log(`  stale customers ${result.dryRun ? "eligible" : "deleted"}: ${result.customers.length}`);
console.log(`  customers skipped to protect other subscriptions: ${result.skippedCustomers.length}`);
console.log(`  sandbox plan prices ${result.dryRun ? "to archive" : "archived"}: ${result.prices.length}`);
for (const priceId of result.prices) console.log(`    ${priceId}`);
console.log(`  sandbox plan products ${result.dryRun ? "to archive" : "archived"}: ${result.products.length}`);
for (const productId of result.products) console.log(`    ${productId}`);
console.log(`  sandbox plan prices skipped (active subscriptions): ${result.skippedPrices.length}`);
for (const priceId of result.skippedPrices) console.log(`    ${priceId}`);
console.log(`  sandbox plan products skipped (in use or mixed generation): ${result.skippedProducts.length}`);
for (const productId of result.skippedProducts) console.log(`    ${productId}`);
for (const skipped of result.skippedCustomers) {
  console.log(`  skipped ${skipped.customerId}: protected subscriptions ${skipped.protectedSubscriptionIds.join(", ")}`);
}
if (result.dryRun) console.log("Run again with --apply to perform these deletions.");