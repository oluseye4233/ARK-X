import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import React from "react";
import { JSDOM } from "jsdom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@/lib/api";
import SubscriptionPage, { getCancellationMessage } from "./subscription";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/subscription",
});
Object.assign(globalThis, {
  React,
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  location: dom.window.location,
  history: dom.window.history,
  addEventListener: dom.window.addEventListener.bind(dom.window),
  removeEventListener: dom.window.removeEventListener.bind(dom.window),
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  MutationObserver: dom.window.MutationObserver,
  getComputedStyle: dom.window.getComputedStyle,
  requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
  cancelAnimationFrame: (id: number) => clearTimeout(id),
  confirm: () => true,
});

const { cleanup, fireEvent, render, screen, waitFor } = await import("@testing-library/react");

const effectiveAt = "2030-04-15T12:00:00.000Z";
const visibleEndDate = new Date(effectiveAt).toLocaleDateString();

test("first-time cancellation preserves the subscription end-date wording", () => {
  const message = getCancellationMessage({ effectiveAt });

  assert.equal(message, `Subscription will end on ${visibleEndDate}.`);
  assert.match(message, new RegExp(visibleEndDate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("replayed cancellation reassures the customer and keeps the end date visible", () => {
  const message = getCancellationMessage({ effectiveAt, alreadyScheduled: true });

  assert.equal(
    message,
    `Cancellation was already scheduled. Subscription will end on ${visibleEndDate}.`,
  );
  assert.match(message, new RegExp(visibleEndDate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

type CancellationResponse = {
  effectiveAt: string;
  alreadyScheduled?: boolean;
};

function renderSubscriptionPage({
  cancellation,
  subscriptionPlan = "INDIVIDUAL_PRO",
}: {
  cancellation?: CancellationResponse;
  subscriptionPlan?: string;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  queryClient.setQueryData(["/api/auth/me"], {
    id: "customer-1",
    username: "customer",
    name: "Customer",
    subscriptionPlan,
    subscriptionStatus: "active",
  });
  queryClient.setQueryData(["/api/billing/me"], {
    plan: subscriptionPlan,
    status: "active",
    paidCheckoutAvailable: true,
    mode: "live",
    stripeSubscriptionId: subscriptionPlan === "INDIVIDUAL_FREE" ? null : "sub_123",
  });
  queryClient.setQueryData(["/api/f1000/me"], { member: false });

  if (cancellation) {
    mock.method(api, "cancelSubscription", async () => cancellation);
  }

  render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(SubscriptionPage),
    ),
  );
  return queryClient;
}

afterEach(() => {
  cleanup();
  mock.restoreAll();
});

test("successful first-time cancellation renders the dated confirmation in the success banner", async () => {
  renderSubscriptionPage({ cancellation: { effectiveAt } });

  fireEvent.click(screen.getByTestId("button-cancel-subscription"));

  const success = await screen.findByTestId("alert-subscription-updated");
  assert.match(success.textContent ?? "", new RegExp(`Subscription will end on ${visibleEndDate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.equal(screen.queryByTestId("alert-billing-error"), null);
});

test("repeated cancellation keeps the already-scheduled confirmation out of the billing error banner", async () => {
  renderSubscriptionPage({ cancellation: { effectiveAt, alreadyScheduled: true } });

  fireEvent.click(screen.getByTestId("button-cancel-subscription"));

  const success = await screen.findByTestId("alert-subscription-updated");
  assert.match(success.textContent ?? "", /Cancellation was already scheduled/);
  assert.match(success.textContent ?? "", new RegExp(visibleEndDate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(screen.queryByTestId("alert-billing-error"), null);
});

test("cancellation stays disabled and sends only one request while billing is pending", async () => {
  let resolveCancellation!: (value: CancellationResponse) => void;
  const pendingCancellation = new Promise<CancellationResponse>((resolve) => {
    resolveCancellation = resolve;
  });
  const cancelSubscription = mock.fn(() => pendingCancellation);
  mock.method(api, "cancelSubscription", cancelSubscription);
  renderSubscriptionPage();

  const cancelButton = screen.getByTestId("button-cancel-subscription") as HTMLButtonElement;
  fireEvent.click(cancelButton);

  await waitFor(() => {
    assert.equal(cancelSubscription.mock.callCount(), 1);
    assert.equal(cancelButton.disabled, true);
  });

  fireEvent.click(cancelButton);
  fireEvent.click(cancelButton);
  assert.equal(cancelSubscription.mock.callCount(), 1);

  resolveCancellation({ effectiveAt });

  const success = await screen.findByTestId("alert-subscription-updated");
  assert.match(success.textContent ?? "", new RegExp(visibleEndDate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(screen.getByTestId("text-subscription-status").textContent?.trim(), "CANCELING");
  assert.equal(screen.queryByTestId("button-cancel-subscription"), null);
  assert.equal(cancelSubscription.mock.callCount(), 1);
});

test("declining cancellation leaves the active subscription unchanged", async () => {
  const cancelSubscription = mock.fn(async () => {
    throw new Error("Stripe could not cancel this subscription. Please try again.");
  });
  mock.method(globalThis, "confirm", () => false);
  mock.method(api, "cancelSubscription", cancelSubscription);
  renderSubscriptionPage();

  fireEvent.click(screen.getByTestId("button-cancel-subscription"));

  await waitFor(() => {
    assert.equal(cancelSubscription.mock.callCount(), 0);
    assert.equal(screen.queryByTestId("alert-subscription-updated"), null);
    assert.equal(screen.queryByTestId("alert-billing-error"), null);
    assert.equal(screen.getByTestId("text-subscription-status").textContent?.trim(), "ACTIVE");
  });
});

test("failed cancellation keeps the active subscription and cancellation control visible", async () => {
  const cancelSubscription = mock.fn(async () => {
    throw new Error("Stripe could not cancel this subscription. Please try again.");
  });
  mock.method(api, "cancelSubscription", cancelSubscription);
  const queryClient = renderSubscriptionPage({ subscriptionPlan: "SCHOOL_STUDENT" });

  fireEvent.click(screen.getByTestId("button-cancel-subscription"));

  const error = await screen.findByTestId("alert-billing-error");
  assert.equal(cancelSubscription.mock.callCount(), 1);
  assert.equal(
    error.textContent?.trim(),
    "Stripe could not cancel this subscription. Please try again.",
  );
  assert.equal(screen.queryByTestId("alert-subscription-updated"), null);
  assert.equal(screen.getByTestId("text-subscription-status").textContent?.trim(), "ACTIVE");
  assert.ok(screen.getByTestId("button-cancel-subscription"));
  assert.equal(
    queryClient.getQueryData<{ subscriptionStatus: string }>(["/api/auth/me"])?.subscriptionStatus,
    "active",
  );
  assert.equal(
    queryClient.getQueryData<{ status: string }>(["/api/billing/me"])?.status,
    "active",
  );
});

test("rejected cancellation replaces an earlier billing success and keeps the subscription active", async () => {
  const consoleError = mock.method(console, "error", () => {});
  const queryClient = renderSubscriptionPage({ subscriptionPlan: "SCHOOL_STUDENT" });
  mock.method(api, "previewSubscriptionSwitch", async () => ({
    plan: "INDIVIDUAL_PRO" as const,
    fromPlan: "SCHOOL_STUDENT" as const,
    prorationAmountCents: 500,
    currency: "USD",
    nextBillingAt: "2030-05-15T12:00:00.000Z",
    expiresAt: "2030-04-15T12:10:00.000Z",
    previewToken: "preview-1",
  }));
  mock.method(api, "switchSubscription", async () => ({
    plan: "INDIVIDUAL_PRO" as const,
    prorationAmountCents: 500,
    currency: "USD",
    nextBillingAt: "2030-05-15T12:00:00.000Z",
  }));
  mock.method(api, "cancelSubscription", async () => {
    throw new Error("Cancellation is temporarily unavailable.");
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    ...queryClient.getQueryData<object>(["/api/auth/me"]),
    subscriptionPlan: "INDIVIDUAL_PRO",
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    fireEvent.click(screen.getByTestId("button-subscribe-individual_pro"));
    fireEvent.click(await screen.findByTestId("button-confirm-plan-switch"));
    await screen.findByTestId("alert-subscription-updated");

    fireEvent.click(screen.getByTestId("button-cancel-subscription"));

    const error = await screen.findByTestId("alert-billing-error");
    assert.match(error.textContent ?? "", /Cancellation is temporarily unavailable/);
    assert.equal(screen.queryByTestId("alert-subscription-updated"), null);
    assert.equal(screen.getByTestId("text-subscription-status").textContent?.trim(), "ACTIVE");
    const duplicateKeyWarnings = consoleError.mock.calls.filter((call) =>
      call.arguments.some((argument) =>
        typeof argument === "string" && argument.includes("Encountered two children with the same key"),
      ),
    );
    assert.equal(duplicateKeyWarnings.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cancellation can be retried after a temporary failure and clears the stale error", async () => {
  let resolveRetry!: (value: CancellationResponse) => void;
  const retryResponse = new Promise<CancellationResponse>((resolve) => {
    resolveRetry = resolve;
  });
  let attempts = 0;
  const cancelSubscription = mock.fn(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error("Stripe could not cancel this subscription. Please try again.");
    }
    return retryResponse;
  });
  mock.method(api, "cancelSubscription", cancelSubscription);
  const queryClient = renderSubscriptionPage();

  fireEvent.click(screen.getByTestId("button-cancel-subscription"));

  await screen.findByTestId("alert-billing-error");
  const retryButton = screen.getByTestId("button-cancel-subscription");
  assert.equal(cancelSubscription.mock.callCount(), 1);
  assert.equal((retryButton as HTMLButtonElement).disabled, false);

  fireEvent.click(retryButton);

  await waitFor(() => {
    assert.equal(cancelSubscription.mock.callCount(), 2);
    assert.equal(screen.queryByTestId("alert-billing-error"), null);
  });

  resolveRetry({ effectiveAt });

  const success = await screen.findByTestId("alert-subscription-updated");
  assert.match(
    success.textContent ?? "",
    new RegExp(`Subscription will end on ${visibleEndDate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  );
  assert.equal(screen.queryByTestId("alert-billing-error"), null);
  assert.equal(screen.getByTestId("text-subscription-status").textContent?.trim(), "CANCELING");
  assert.equal(screen.queryByTestId("button-cancel-subscription"), null);
  assert.equal(
    queryClient.getQueryData<{ subscriptionStatus: string }>(["/api/auth/me"])?.subscriptionStatus,
    "canceling",
  );
});

test("successful checkout still renders the plan-updated success copy", async () => {
  const queryClient = renderSubscriptionPage({ subscriptionPlan: "INDIVIDUAL_FREE" });
  mock.method(api, "startCheckout", async () => ({
    sessionId: "checkout-1",
    requiresPayment: false as const,
  }));
  mock.method(api, "completeCheckout", async () => ({
    success: true as const,
  }));
  mock.method(api, "getBillingMe", async () => ({
    plan: "INDIVIDUAL_PRO" as const,
    status: "active",
    paidCheckoutAvailable: true,
    mode: "live" as const,
    stripeSubscriptionId: "sub_123",
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    ...queryClient.getQueryData<object>(["/api/auth/me"]),
    subscriptionPlan: "INDIVIDUAL_PRO",
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    fireEvent.click(screen.getByTestId("button-subscribe-individual_pro"));
    await waitFor(() => {
      assert.equal(
        screen.getByTestId("alert-subscription-updated").textContent?.trim(),
        "Subscription updated successfully. Your new plan features are now active.",
      );
    });
    assert.equal(screen.queryByTestId("alert-billing-error"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("successful plan switch still renders the plan-updated success copy", async () => {
  const queryClient = renderSubscriptionPage({ subscriptionPlan: "SCHOOL_STUDENT" });
  mock.method(api, "previewSubscriptionSwitch", async () => ({
    plan: "INDIVIDUAL_PRO" as const,
    fromPlan: "SCHOOL_STUDENT" as const,
    prorationAmountCents: 500,
    currency: "USD",
    nextBillingAt: "2030-05-15T12:00:00.000Z",
    expiresAt: "2030-04-15T12:10:00.000Z",
    previewToken: "preview-1",
  }));
  mock.method(api, "switchSubscription", async () => ({
    plan: "INDIVIDUAL_PRO" as const,
    prorationAmountCents: 500,
    currency: "USD",
    nextBillingAt: "2030-05-15T12:00:00.000Z",
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    ...queryClient.getQueryData<object>(["/api/auth/me"]),
    subscriptionPlan: "INDIVIDUAL_PRO",
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    fireEvent.click(screen.getByTestId("button-subscribe-individual_pro"));
    fireEvent.click(await screen.findByTestId("button-confirm-plan-switch"));
    await waitFor(() => {
      assert.equal(
        screen.getByTestId("alert-subscription-updated").textContent?.trim(),
        "Subscription updated successfully. Your new plan features are now active.",
      );
    });
    assert.equal(screen.queryByTestId("alert-billing-error"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
