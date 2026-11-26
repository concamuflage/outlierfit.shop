import { expect, type Locator, type Page } from "@playwright/test";
import type { Product } from "../support/sandbox";

/** Groups existing storefront controls, e.g. comparing the drawer and /cart without changing app selectors. */
export class StorePage {
  /** Uses the isolated Playwright page; each test gets a fresh cookie jar and router cache. */
  constructor(readonly page: Page) {}

  /** Selects a real category and this test's own product instead of a fragile first/Hoodies result. */
  async add(product: Product, category = "Shirts") {
    await this.page.goto("/products");
    await this.page.getByRole("button", { name: category, exact: true }).click();
    await this.page.getByTestId(`product-card-${product.id}`).click();
    await expect(this.page.getByRole("heading", { name: product.name, exact: true })).toBeVisible();
    await this.page.getByTestId("add-to-cart-button").click();
  }

  /** Opens the actual View cart link, retaining coverage of drawer-to-page navigation. */
  async cart() {
    await this.drawer();
    await this.page.getByTestId("cart-drawer-view-cart").click();
    await expect(this.page).toHaveURL(/\/cart$/);
    await expect(this.page.getByRole("heading", { name: "Your cart", exact: true })).toBeVisible();
  }

  /** Opens the drawer only when closed, avoiding clicks on a header covered by its own overlay. */
  async drawer() {
    if (await this.page.getByTestId("cart-drawer").locator("..").getAttribute("aria-hidden") === "true") {
      await this.page.getByTestId("cart-button").click();
    }
  }

  /** Reads an exact test-id money value in cents, e.g. $43.94 becomes 4394. */
  async money(testId: string) {
    return Math.round(Number((await this.page.getByTestId(testId).innerText()).replace(/[^\d.]/g, "")) * 100);
  }

  /** Waits for item arithmetic and one flat fee, e.g. 3499 + 895 = 4394 cents. */
  async totals(subtotal: number, prefix = "cart") {
    await expect.poll(() => this.money(`${prefix}-summary-subtotal`)).toBe(subtotal);
    expect(await this.money(`${prefix}-summary-shipping`)).toBe(895);
    expect(await this.money(`${prefix}-summary-order-total`)).toBe(subtotal + 895);
  }

  /** Captures variant IDs and quantities, e.g. [{id:'13-26',qty:2}], for cross-view equality checks. */
  async items(prefix = "cart") {
    const rows = this.page.locator(`[data-testid^="${prefix}-line-item-"]`);
    const result = [];
    for (const row of await rows.all()) {
      const id = (await row.getAttribute("data-testid"))!.replace(`${prefix}-line-item-`, "");
      result.push({ id, qty: Number(await row.getByTestId(`${prefix}-item-qty-${id}`).innerText()) });
    }
    return result;
  }

  /** Increments one visible line and waits for its quantity rather than pausing every test step. */
  async increase(product: Product, prefix = "cart") {
    const qty = this.page.getByTestId(`${prefix}-item-qty-${product.cartItemId}`);
    const before = Number(await qty.innerText());
    await this.page.getByTestId(`${prefix}-item-increase-${product.cartItemId}`).click();
    await expect(qty).toHaveText(String(before + 1));
  }

  /** Opens review and asserts items, shipping, billing, and payment sections without starting Stripe. */
  async review() {
    await this.page.getByRole("button", { name: "Checkout", exact: true }).click();
    for (const name of ["Essential order details", "Shipping info", "Billing info", "Payment"]) {
      await expect(this.page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
  }

  /** Finds the existing address panel by heading, e.g. Billing info, without adding app-only test markup. */
  addressSection(type: "shipping" | "billing"): Locator {
    return this.page.getByRole("heading", { name: type === "shipping" ? "Shipping info" : "Billing info", exact: true }).locator("../../..");
  }

  /** Fills the current editor in one panel; country remains United States and phone is a synthetic number. */
  async fillAddress(type: "shipping" | "billing", name: string) {
    const panel = this.addressSection(type);
    for (const [label, value] of Object.entries({ "Full name": name, Phone: "2015550123", Street: "123 Test Street", City: "Boston", "ZIP code": "02135" })) {
      // The nested phone prefix produces the accessible name "Phone +1".
      await panel.getByRole("textbox", { name: label === "Phone" ? /^Phone/ : label, exact: label !== "Phone" }).fill(value);
    }
    await panel.getByRole("combobox", { name: "State", exact: true }).selectOption("MA");
    await panel.getByRole("button", { name: /^(Save shipping address|Save billing address|Save changes)$/ }).click();
    await expect(panel.getByText(name, { exact: true })).toBeVisible();
  }
}
