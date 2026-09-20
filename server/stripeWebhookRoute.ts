import express, { type Express } from "express";
import Stripe from "stripe";
import { verifyAndRetrieveStripeEvent } from "./stripeClient";
import { processStripeEvent } from "./stripeBilling";

export function verifyStripePayload(payload: Buffer, signature: string, secret: string): Stripe.Event {
  return new Stripe("sk_test_signature_only").webhooks.constructEvent(payload, signature, secret);
}

export function registerStripeWebhookRoute(
  app: Express,
  deps: {
    verify?: (payload: Buffer, signature: string) => Promise<Stripe.Event>;
    process?: (event: Stripe.Event) => Promise<unknown>;
  } = {},
) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    try {
      const signature = req.headers["stripe-signature"];
      if (!signature || Array.isArray(signature)) return res.status(400).json({ message: "Missing Stripe signature." });
      const event = await (deps.verify ?? verifyAndRetrieveStripeEvent)(req.body as Buffer, signature);
      const result = await (deps.process ?? processStripeEvent)(event);
      return res.json({ received: true, result });
    } catch (error: any) {
      console.error("Stripe webhook rejected:", error.message);
      return res.status(400).json({ message: "Invalid Stripe webhook." });
    }
  });
}