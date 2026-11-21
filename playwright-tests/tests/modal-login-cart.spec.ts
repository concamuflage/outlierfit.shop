import { expect, test } from "@playwright/test";

// Use only a dedicated verified test account; this regression never edits a cart or starts a payment.
test.use({ headless: true, channel: "chrome" });

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  /** Reproduces guest navigation then modal login; View cart must open /cart, not its cached login redirect. */
  test(`modal login opens the cart from the drawer on ${viewport.name}`, async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    test.skip(!email || !password, "Requires a dedicated verified TEST_USER_EMAIL and TEST_USER_PASSWORD.");
    await page.setViewportSize(viewport);

    // Establish the negative control before exercising the same browser after login.
    await page.goto("/cart");
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
    await page.goto("/products", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const form = page.locator("form").filter({ has: page.locator("input[type=email]") });
    await form.locator("input[type=email]").fill(email!);
    await form.locator("input[type=password]").fill(password!);
    await form.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();

    await page.getByTestId("cart-button").click();
    await page.getByTestId("cart-drawer-view-cart").click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole("heading", { name: "Your cart", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();

    // A full reload checks the server-side guard too, not only the client router cache.
    await page.reload();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole("heading", { name: "Your cart", exact: true })).toBeVisible();
  });
}
