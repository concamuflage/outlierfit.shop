import Stripe from "stripe";
import type { Page, Route } from "@playwright/test";
import { expect } from "@playwright/test";
import { assertTestStripeKey, requiredEnvValue } from "./testEnv";


/** Requires deliberate opt-in and a test-only key before a test can create or visit a Checkout Session. */
export function testStripe() {
  const key = assertTestStripeKey(requiredEnvValue("STRIPE_SECRET_KEY"));
  return new Stripe(key, { timeout: 20000, maxNetworkRetries: 0 });
}


/** Captures the real response and reports server errors directly, e.g. Missing APP_URL, before checking Stripe mode. */
export async function start(page: Page, stripe: Stripe, userId: number) {
  let captured: { status: number; sessionId?: string; error?: string } | undefined;
  const pattern = "**/api/orders/checkout-session";
  /** Forwards the actual request once; buffering avoids Chrome discarding its body on cross-origin navigation. */
  const capture = async (route: Route) => {
    const response = await route.fetch({ maxRetries: 0 });
    const body = await response.json();
    captured = { status: response.status(), sessionId: body.sessionId, error: typeof body.error === "string" ? body.error : undefined };
    await route.fulfill({ response });
  };
  await page.route(pattern, capture);
  try {
    await page.getByRole("button", { name: "Pay with card", exact: true }).click();
    await expect.poll(() => Boolean(captured)).toBe(true);
  } finally {
    await page.unroute(pattern, capture);
  }
  const body = captured!;
  // A completed HTTP 500 is a server failure, not a missing browser redirect that needs more waiting.
  expect(body.status, body.error || "Checkout session creation failed.").toBe(200);
  expect(body.sessionId).toMatch(/^cs_test_/);
  const session = await stripe.checkout.sessions.retrieve(body.sessionId!);
  expect(session.livemode).toBe(false);
  expect(session.client_reference_id).toBe(String(userId));
  await page.waitForURL(u => u.protocol === "https:" && ["checkout.stripe.com", "pay.stripe.com"].includes(u.hostname), { timeout: 60000 });
  return session;
}

