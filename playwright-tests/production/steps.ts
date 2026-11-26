import { expect } from "@playwright/test";
import { Given, When, Then } from "./fixtures";

/** Opens the real production catalog, e.g. GET https://outlierfit.shop/products, without signing in. */
Given("I browse the public product catalog", async ({ page }) => {
  const response = await page.goto("/products");
  expect(response?.ok()).toBe(true);
  await expect(page.getByTestId("products-filter-all")).toBeVisible();
});

/** Preserves the original browser smoke's catalog/photo assertions without creating fixture products. */
Then("the catalog should display products with loaded photos", async ({ page }) => {
  const cards = page.locator('[data-testid^="product-card-"]');
  await expect(async () => { expect(await cards.count()).toBeGreaterThanOrEqual(2); }).toPass({ timeout: 15000 });
  for (const image of await cards.locator("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(img => (img as HTMLImageElement).decode());
    expect(await image.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
});

/** Uses a public product link rather than a synthetic product or any customer's cart. */
When("I open a listed product", async ({ page }) => {
  await page.locator('[data-testid^="product-card-"]').first().click();
});

/** Confirms the visible title and Generic brand, e.g. Cotton Shirt, without placing an order. */
Then("the product detail should display its name and generic brand", async ({ page }) => {
  const heading = page.locator("main h1");
  await expect(heading).toBeVisible();
  await expect(heading).not.toHaveText("");
  await expect(page.getByText("Brand: Generic", { exact: true })).toBeVisible();
});

/** Opens the customer-facing footer link so a broken production policy route fails this smoke test. */
When("I open the shipping and returns policy", async ({ page }) => {
  await page.getByRole("link", { name: "Shipping and Returns", exact: true }).click();
});

/** Checks both policy sections, e.g. /policies/shipping-and-returns contains Shipping and Returns headings. */
Then("the shipping and returns policy should be available", async ({ page }) => {
  await expect(page).toHaveURL("https://outlierfit.shop/policies/shipping-and-returns");
  await expect(page.getByRole("heading", { name: "Shipping and Returns", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shipping", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Returns", exact: true })).toBeVisible();
});
