import { strict as assert } from "node:assert";
import { test } from "node:test";
import { computeRoyaltySplit } from "../synthesis";
import { SPC_CREATOR_SHARE_PCT } from "@shared/schema";

function check(
  desc: string,
  lockedPrices: { listingId: string; creatorId: string; priceCredits: number }[],
  totalCreditPrice: number,
) {
  const { splits, platformShare } = computeRoyaltySplit(lockedPrices, totalCreditPrice);
  const creditSum = splits.reduce((s, x) => s + x.creditedAmount, 0);
  const expectedCreatorPool = Math.floor((totalCreditPrice * SPC_CREATOR_SHARE_PCT) / 100);
  assert.equal(
    creditSum + platformShare, totalCreditPrice,
    `${desc}: credits leaked — sum(${creditSum}) + platform(${platformShare}) !== total(${totalCreditPrice})`,
  );
  assert.ok(creditSum <= expectedCreatorPool, `${desc}: creator pool exceeded — ${creditSum} > ${expectedCreatorPool}`);
  assert.ok(platformShare >= totalCreditPrice - expectedCreatorPool,
    `${desc}: platform under-credited — ${platformShare} < min ${totalCreditPrice - expectedCreatorPool}`);
  for (const s of splits) {
    assert.ok(s.creditedAmount >= 0, `${desc}: negative split for ${s.creatorId}`);
  }
}

test("royalty split: 2 creators, equal weights, even total", () => {
  check("2-even", [
    { listingId: "l1", creatorId: "c1", priceCredits: 10 },
    { listingId: "l2", creatorId: "c2", priceCredits: 10 },
  ], 100);
});

test("royalty split: 3 creators, varied weights, odd total", () => {
  check("3-varied", [
    { listingId: "l1", creatorId: "c1", priceCredits: 11 },
    { listingId: "l2", creatorId: "c2", priceCredits: 23 },
    { listingId: "l3", creatorId: "c3", priceCredits: 47 },
  ], 97);
});

test("royalty split: 5 creators with rounding tax", () => {
  check("5-rounding", [
    { listingId: "l1", creatorId: "c1", priceCredits: 7 },
    { listingId: "l2", creatorId: "c2", priceCredits: 7 },
    { listingId: "l3", creatorId: "c3", priceCredits: 7 },
    { listingId: "l4", creatorId: "c4", priceCredits: 7 },
    { listingId: "l5", creatorId: "c5", priceCredits: 7 },
  ], 33);
});

test("royalty split: 7 creators, mixed weights", () => {
  check("7-mixed", [
    { listingId: "l1", creatorId: "c1", priceCredits: 5 },
    { listingId: "l2", creatorId: "c2", priceCredits: 13 },
    { listingId: "l3", creatorId: "c3", priceCredits: 19 },
    { listingId: "l4", creatorId: "c4", priceCredits: 31 },
    { listingId: "l5", creatorId: "c5", priceCredits: 41 },
    { listingId: "l6", creatorId: "c6", priceCredits: 53 },
    { listingId: "l7", creatorId: "c7", priceCredits: 67 },
  ], 211);
});

test("royalty split: same creator across multiple listings still sums correctly", () => {
  check("shared-creator", [
    { listingId: "l1", creatorId: "c1", priceCredits: 10 },
    { listingId: "l2", creatorId: "c1", priceCredits: 20 },
    { listingId: "l3", creatorId: "c2", priceCredits: 30 },
  ], 60);
});

test("royalty split: tiny total never goes negative", () => {
  check("tiny", [
    { listingId: "l1", creatorId: "c1", priceCredits: 1 },
    { listingId: "l2", creatorId: "c2", priceCredits: 1 },
  ], 2);
});
