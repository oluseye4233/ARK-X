import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "http";
import Stripe from "stripe";
import { registerStripeWebhookRoute, verifyStripePayload } from "../stripeWebhookRoute";

test("Stripe webhook HTTP boundary rejects missing/invalid signatures and accepts signed replay safely", async () => {
  const secret = "whsec_test_boundary";
  const event = { id: "evt_boundary", type: "invoice.payment_failed", data: { object: { id: "in_test" } } };
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  const seen = new Set<string>();
  const app = express();
  registerStripeWebhookRoute(app, {
    verify: async (body, sig) => verifyStripePayload(body, sig, secret),
    process: async (verified) => seen.has(verified.id) ? "duplicate" : (seen.add(verified.id), "processed"),
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test address");
  const url = `http://127.0.0.1:${address.port}/api/stripe/webhook`;
  try {
    const missing = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: payload });
    assert.equal(missing.status, 400);
    const invalid = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": "bad" }, body: payload });
    assert.equal(invalid.status, 400);
    const first = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": signature }, body: payload });
    assert.equal(first.status, 200);
    assert.equal((await first.json()).result, "processed");
    const replay = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": signature }, body: payload });
    assert.equal((await replay.json()).result, "duplicate");
    assert.equal(seen.size, 1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});