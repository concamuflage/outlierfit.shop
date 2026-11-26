import { Given, When, Then } from "../support/bdd";
import { expect, authenticate } from "../support/fixtures";
import { checkoutFixture, assertCart, assertOrder, assertInvoice, assertPdf } from "../support/orderAssertions";

/** Authenticates the exact seeded DB user through real NextAuth CSRF/session cookies. */
Given("I am authenticated for the API as a disposable customer", async ({ request, account, state }) => {
  state.account = account; state.email = account.email;
  await authenticate(request, account);
});

/** Seeds owned product/address fixtures; the normal catalog and personal accounts stay untouched. */
Given("a private checkout fixture exists", async ({ sandbox, state }) => {
  const fixture = await checkoutFixture(sandbox, state.account!);
  Object.assign(state, fixture); state.subtotal = fixture.product.price * 200;
});

/** Seeds a paid/unshipped order snapshot, matching the original Java orders fixture. */
Given("a paid order exists for the disposable customer", async ({ sandbox, state }) => {
  state.order = await sandbox.order(state.account!, state.product!, state.shipping!, state.billing!);
});

/** Saves two units and both address selections through the real cart API. */
When("I save the private cart and address selections", async ({ request, state }) => {
  state.response = await request.put("/api/cart", { data: { items: [{ id: state.product!.cartItemId, qty: 2 }], shippingAddressId: state.shipping, billingAddressId: state.billing } });
});

/** Retrieves persisted cart state, not client-side localStorage. */
When("I retrieve the private cart", async ({ request, state }) => { state.response = await request.get("/api/cart"); });

/** Reuses all Java ID, quantity, address, and retired-shipping-ID assertions. */
Then("the cart response should preserve the fixture and selections", async ({ state }) => { await assertCart(state.response!, state.product!, state.shipping!, state.billing!); });

/** Clears only the current disposable customer's cart. */
When("I clear the private cart", async ({ request, state }) => { state.response = await request.put("/api/cart", { data: { items: [] } }); });

/** Confirms an empty API response after clear. */
Then("the cart response should be empty", async ({ state }) => { expect(state.response!.status()).toBe(200); expect((await state.response!.json()).items).toEqual([]); });

/** Requests the list separately so the scenario reports the API interaction as its own Gherkin step. */
When("I retrieve the customer's order list", async ({ request, state }) => { state.response = await request.get("/api/profile/orders"); });

/** Checks paid/unshipped list membership before validating the complete single-order snapshot. */
Then("the order list and single order should match the fixture", async ({ request, state }) => {
  expect(state.response!.status()).toBe(200);
  expect(await state.response!.json()).toContainEqual(expect.objectContaining({ id: state.order!.id, paymentStatus: "paid", shipmentStatus: "unshipped" }));
  await assertOrder(request, state.order!, state.product!);
});

/** Checks every original invoice field and retains the payload for direct-PDF generation. */
Then("the invoice payload should include complete order information", async ({ request, state }) => { state.invoice = await assertInvoice(request, state.order!, state.product!, state.account!); });

/** Submits the dev-only mock payload without weakening the application's production-mode gate. */
When("I submit a mock payment for the private cart", async ({ request, state }) => {
  const price = state.product!.price;
  state.response = await request.post("/api/orders/mock-payment", { data: {
    subtotalUsd: price * 2, shippingUsd: 8.95, totalUsd: price * 2 + 8.95, shippingMethod: "USPS",
    shippingAddressId: state.shipping, billingAddressId: state.billing,
    items: [{ cartItemId: state.product!.cartItemId, quantity: 2, unitPriceUsd: price }],
  } });
});

/** Checks finalization metadata and the exact private variant's two-unit inventory deduction. */
Then("the mock response should create a paid order", async ({ sandbox, state }) => {
  expect(state.response!.status()).toBe(200);
  const paid = await state.response!.json();
  expect(paid.invoiceNumber).toBeTruthy(); expect(paid.paidAt).toBeTruthy();
  state.order = { id: paid.orderId, invoiceNumber: paid.invoiceNumber };
  expect((await sandbox.db.query("SELECT qty FROM inventory WHERE variant_id=$1", [state.product!.variantId])).rows[0].qty).toBe(18);
});

/** Downloads both invoice endpoints and checks attachment headers, bytes, and PDF magic. */
Then("both invoice PDF endpoints should return downloadable PDFs", async ({ request, state }) => {
  await assertPdf(await request.get(`/api/profile/orders/${state.order!.id}/invoice/pdf`));
  await assertPdf(await request.post("/api/invoice", { data: state.invoice }));
});

/** Checks unauthenticated deletion before a session exists. */
When("I delete an account without authentication", async ({ request, account, state }) => { state.account = account; state.response = await request.delete("/api/account", { data: { password: account.password } }); });

/** Confirms the protected API rejects unauthenticated deletion with 401. */
Then("account deletion should return unauthorized", async ({ state }) => { expect(state.response!.status()).toBe(401); });

/** Sends either the owned password or a deliberate mismatch through the account API. */
When("I delete the account using the {word} password", async ({ request, state }, kind: string) => { state.response = await request.delete("/api/account", { data: { password: kind === "correct" ? state.account!.password : "WrongPass123A" } }); });

/** Preserves the exact wrong-password status. */
Then("account deletion should reject password confirmation", async ({ state }) => { expect(state.response!.status()).toBe(403); });

/** Checks successful deletion and rejects a subsequent direct login with the formerly valid credentials. */
Then("the account should be deleted and unable to log in", async ({ request, state }) => {
  expect(state.response!.status()).toBe(200); expect((await state.response!.json()).message).toBe("Account deleted.");
  const response = await request.post("/api/store/auth/login", { data: { email: state.account!.email, password: state.account!.password } });
  expect([401, 403]).toContain(response.status());
});
