import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Enterprise pricing is presented as custom rather than free", () => {
  const source = readFileSync("client/src/pages/subscription.tsx", "utf8");
  assert.match(source, /\{isEnterprise \? "Custom" : "Free"\}/);
});