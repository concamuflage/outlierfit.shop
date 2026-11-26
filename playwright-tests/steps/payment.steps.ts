import { Given, When, Then } from "../support/bdd";
import { expect } from "../support/fixtures";
import { StorePage } from "../pages/StorePage";
import { StripePage } from "../pages/StripePage";
import { testStripe, start } from "../support/paymentFlows";
import { findMail } from "../support/gmailVerificationClient";
import { assertSender } from "../support/authFlows";

/** Seeds only the disposable customer's shipping record, preserving cancellation tests' checkout prerequisite. */
Given("I have a saved shipping address", async ({ sandbox, state }) => { await sandbox.address(state.account!, "shipping", "UI Test Shipping", true); });

/** Creates the first shipping address through the checkout UI for a newly registered customer. */
When("I add the new customer's shipping address", async ({ page }) => {
  await page.getByRole("button", { name: "Add shipping address", exact: true }).click();
  await new StorePage(page).fillAddress("shipping", "UI Test User");
});

/** Validates actual Stripe mode and owner before a hosted form can receive any test-card data. */
When("I start a verified test-mode Stripe Checkout session", async ({ page, state }) => {
  state.stripe = testStripe();
  const session = await (await page.request.get("/api/auth/session")).json();
  state.account = { id: Number(session.user.id), email: state.email, password: state.password };
  state.checkout = await start(page, state.stripe, state.account.id);
});

/** Enters only the documented successful test card and clicks the submit button exactly once. */
When("I pay using the successful Stripe test card", async ({ page, state }) => {
  const hosted = new StripePage(page);
  state.resetAt = Date.now();
  await hosted.fillCard(state.email);
  await hosted.submit();
});

/** Waits for genuine webhook fulfillment instead of posting invented session IDs or sleeping a fixed interval. */
Then("the webhook should create a paid order and invoice link", async ({ page, state, baseURL }) => {
  await page.waitForURL(u => u.origin === baseURL && u.pathname === "/checkout/success", { timeout: 90000 });
  await expect(page.getByRole("heading", { name: /Thank you for your order/ })).toBeVisible();
  await expect(async () => {
    const response = await page.request.post("/api/orders/checkout-complete", { data: { sessionId: state.checkout!.id } });
    expect(response.status()).toBe(200);
    const paid = await response.json();
    expect(paid.status).toBe("completed");
    state.order = { id: paid.orderId, invoiceNumber: paid.invoiceNumber };
  }).toPass({ timeout: 90000, intervals: [1000, 2000, 5000] });
  await page.reload();
  const link = page.getByRole("link", { name: "Download invoice PDF", exact: true });
  await expect(link).toBeVisible();
  state.invoiceLink = new URL((await link.getAttribute("href"))!, baseURL).href;
});

/** Preserves the Java email/link checks plus PDF validity and one-unit stock deduction, e.g. 20 to 19. */
Then("the delivered invoice should match the order and its PDF", async ({ page, sandbox, state }) => {
  const invoice = await findMail(state.email, "invoice", state.resetAt);
  assertSender(invoice);
  expect(invoice.body).toContain("Hi there"); expect(invoice.body).toContain("Your invoice");
  expect(invoice.link).toBe(state.invoiceLink);
  const pdf = await page.request.get(state.invoiceLink!);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect((await sandbox.db.query("SELECT qty FROM inventory WHERE variant_id=$1", [state.product!.variantId])).rows[0].qty).toBe(19);
  expect((await sandbox.db.query("SELECT count(*)::int AS n FROM orders WHERE user_id=$1 AND id=$2", [state.account!.id, state.order!.id])).rows[0].n).toBe(1);
});

/** Keeps browser history cancellation separate from Stripe's own Back link. */
When("I cancel Stripe using {string}", async ({ page }, method: string) => {
  if (method === "Browser Back") await page.goBack();
  else { expect(method).toBe("Stripe Back"); await page.getByTestId("business-link").click(); }
});

/** Checks either legitimate cart URL, exact item preservation, unchanged stock, and no paid order. */
Then("I should return to the unchanged cart without a payment", async ({ page, sandbox, state }) => {
  await expect(page).toHaveURL(/\/cart(?:\?checkout=1)?$/);
  await expect(page.getByRole("heading", { name: "Your cart", exact: true })).toBeVisible();
  const store = new StorePage(page);
  await store.totals(state.subtotal);
  expect(await store.items()).toEqual([{ id: state.product!.cartItemId, qty: 1 }]);
  expect((await sandbox.db.query("SELECT qty FROM inventory WHERE variant_id=$1", [state.product!.variantId])).rows[0].qty).toBe(20);
  expect((await sandbox.db.query("SELECT count(*)::int AS n FROM orders WHERE user_id=$1", [state.account!.id])).rows[0].n).toBe(0);
  // The sandbox fixture expires this owned cs_test_ session even if any assertion above fails.
});
