import { Given, When, Then } from "../support/bdd";
import { authenticate, expect } from "../support/fixtures";
import { StorePage } from "../pages/StorePage";

/** Logs in a fresh customer through the API; page.request shares its session cookies with /products. */
Given("I am a verified disposable customer", async ({ page, account, state }) => {
  state.account = account; state.email = account.email;
  await authenticate(page.request, account);
  await page.goto("/products");
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
});

/** Seeds owned address choices, then API-authenticates the same browser before profile loading, e.g. Shipping One/Two. */
Given("I am a returning disposable customer with saved addresses", async ({ page, account, sandbox, state }) => {
  state.account = account; state.email = account.email;
  for (const type of ["shipping", "billing"] as const) {
    const title = type === "shipping" ? "Shipping" : "Billing";
    await sandbox.address(account, type, `${title} One`, true);
    await sandbox.address(account, type, `${title} Two`);
  }
  await authenticate(page.request, account);
  await page.goto("/products");
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
});

/** Adds a private product through its category filter, e.g. Shirts costs 3499 cents, T-shirts 2499. */
When("I add a {string} product to the cart", async ({ page, sandbox, state }, category: string) => {
  const price = category === "T-shirts" ? 24.99 : 34.99;
  const product = await sandbox.product(category, price);
  if (!state.product) state.product = product; else state.second = product;
  state.subtotal += Math.round(price * 100);
  await new StorePage(page).add(product, category);
});

/** Opens the actual drawer link, covering cart routing rather than a direct page.goto shortcut. */
When("I view the cart from the drawer", async ({ page }) => { await new StorePage(page).cart(); });

/** Checks cent-precision product arithmetic and one flat 895-cent fee. */
Then("the cart should show the correct subtotal and flat shipping fee", async ({ page, state }) => { await new StorePage(page).totals(state.subtotal); });

/** Changes a selected private variant on /cart and updates the independent expected subtotal. */
When("I increase the quantity of cart item {int}", async ({ page, state }, index: number) => {
  const product = index === 1 ? state.product! : state.second!;
  await new StorePage(page).increase(product);
  state.subtotal += Math.round(product.price * 100);
});

/** Opens the existing drawer without toggling it closed or clicking through its backdrop. */
When("I open the cart drawer", async ({ page }) => { await new StorePage(page).drawer(); });

/** Changes quantity through the drawer while retaining its variant ID and price expectation. */
When("I increase the first cart drawer item quantity", async ({ page, state }) => {
  await new StorePage(page).increase(state.product!, "cart-drawer");
  state.subtotal += Math.round(state.product!.price * 100);
});

/** Captures exact cart line identities/quantities before changing views. */
When("I remember the {word} items and totals", async ({ page, state }, view: string) => {
  const store = new StorePage(page), prefix = view === "drawer" ? "cart-drawer" : "cart";
  await store.totals(state.subtotal, prefix);
  state.expectedItems = await store.items(prefix);
});

/** Compares actual line IDs/quantities and independent totals on the other view. */
Then("the {word} should match the remembered items and totals", async ({ page, state }, view: string) => {
  const store = new StorePage(page), prefix = view === "drawer" ? "cart-drawer" : "cart";
  expect(await store.items(prefix)).toEqual(state.expectedItems);
  await store.totals(state.subtotal, prefix);
});

/** Expands checkout review and verifies its essential order, shipping, billing, and payment headings. */
When("I review checkout", async ({ page }) => { await new StorePage(page).review(); });

/** Verifies essential order data and precise totals after profile loading. */
Then("the essential order details should be visible", async ({ page, state }) => {
  await expect(page.getByRole("heading", { name: "Essential order details", exact: true })).toBeVisible();
  await new StorePage(page).totals(state.subtotal);
});

/** Selects an actual alternative in each address panel and checks its radio state after rerender. */
When("I choose another shipping and billing address", async ({ page }) => {
  const store = new StorePage(page);
  for (const type of ["shipping", "billing"] as const) {
    if (type === "billing") await page.getByRole("checkbox", { name: /Billing address is the same/ }).uncheck();
    const panel = store.addressSection(type), title = type === "shipping" ? "Shipping" : "Billing";
    await expect(panel.getByText(`${title} One`, { exact: true })).toBeVisible();
    const alternative = panel.locator("label").filter({ hasText: `${title} Two` }).locator("input[type=radio]");
    await alternative.check();
    await expect(alternative).toBeChecked();
  }
});

/** Proves editing works by saving and observing distinct new names on both selected cards. */
Then("I can edit the selected shipping and billing addresses", async ({ page }) => {
  const store = new StorePage(page);
  for (const type of ["shipping", "billing"] as const) {
    await store.addressSection(type).getByRole("button", { name: "Edit", exact: true }).click();
    await store.fillAddress(type, `${type === "shipping" ? "Shipping" : "Billing"} Edited`);
  }
});

/** Verifies empty profile arrays, the same-as-shipping question, and disabled payment before adding addresses. */
Then("checkout should ask for new shipping and billing information", async ({ page }) => {
  const response = await page.request.get("/api/profile");
  expect(response.status()).toBe(200);
  const profile = await response.json();
  expect(profile.shippingAddresses).toEqual([]); expect(profile.billingAddresses).toEqual([]);
  await expect(page.getByRole("button", { name: "Pay with card", exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: /Billing address is the same/ })).toBeChecked();
  await expect(page.getByRole("button", { name: "Add shipping address", exact: true })).toBeVisible();
});

/** Creates shipping and a genuinely separate billing address via the inline editors. */
When("I add new shipping and separate billing addresses", async ({ page }) => {
  const store = new StorePage(page);
  await page.getByRole("button", { name: "Add shipping address", exact: true }).click();
  await store.fillAddress("shipping", "New Shipping");
  await page.getByRole("checkbox", { name: /Billing address is the same/ }).uncheck();
  await store.fillAddress("billing", "New Billing");
});

/** Checks the app is ready to start Checkout without submitting a payment. */
Then("card checkout should be enabled", async ({ page }) => { await expect(page.getByRole("button", { name: "Pay with card", exact: true })).toBeEnabled(); });
