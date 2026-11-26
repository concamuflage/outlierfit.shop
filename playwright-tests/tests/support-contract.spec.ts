import { test, expect, type BrowserContext, type Route } from "@playwright/test";
import { isIP } from "node:net";
import { assertSafeTarget, assertTestStripeKey } from "../support/testEnv";
import { Sandbox } from "../support/sandbox";
import { installLocalAuthClient } from "../support/fixtures";
import { StripePage } from "../pages/StripePage";

for (const collapsed of [true, false]) {
  /** Exercises Card selection and US billing offline, e.g. ZIP 02135 and no Link phone enrollment. */
  test(`Stripe card form ${collapsed ? "opens from the Card button" : "stays open when already expanded"} @regression`, async ({ page }) => {
    await page.setContent('<iframe title="Synthetic hosted Checkout"></iframe>');
    const hosted = page.frameLocator("iframe");
    /** Mounts an isolated Checkout-shaped form; submitting increments a counter instead of contacting Stripe. */
    await hosted.locator("body").evaluate((body, initiallyCollapsed) => {
      body.innerHTML = `
        ${initiallyCollapsed ? '<button type="button" id="card-choice">Card</button>' : ""}
        <form ${initiallyCollapsed ? "hidden" : ""}>
          <input name="cardNumber" autocomplete="cc-number">
          <input name="cardExpiry" autocomplete="cc-exp">
          <input name="cardCvc" autocomplete="cc-csc">
          <input name="billingName" autocomplete="cc-name">
          <input name="email" autocomplete="email">
          <select name="country" autocomplete="billing country" aria-label="Country">
            <option value="CA" selected>Canada</option>
            <option value="US">United States</option>
          </select>
          <input name="postalCode" autocomplete="billing postal-code" required pattern="[0-9]{5}" hidden>
          <label><input type="checkbox" name="linkOptIn" checked>Save my information for faster checkout</label>
          <input name="linkMobilePhone" type="tel" required>
          <button type="submit">Pay</button>
        </form>`;
      const form = body.querySelector("form")!;
      /** Mirrors Stripe's accordion side effect: choosing Card reveals its inputs without submitting. */
      body.querySelector("#card-choice")?.addEventListener("click", () => {
        form.hidden = false;
        body.dataset.cardSelections = String(Number(body.dataset.cardSelections || 0) + 1);
      });
      /** Models country-dependent ZIP mounting; selecting US exposes a required five-digit postal code. */
      body.querySelector("select")!.addEventListener("change", () => {
        body.querySelector<HTMLInputElement>("input[name=postalCode]")!.hidden = false;
      });
      /** Models Link opt-in: an unchecked save-details box removes the phone-number requirement. */
      body.querySelector("input[name=linkOptIn]")!.addEventListener("change", event => {
        const optedIn = (event.target as HTMLInputElement).checked;
        const phone = body.querySelector<HTMLInputElement>("input[name=linkMobilePhone]")!;
        phone.required = optedIn;
        phone.hidden = !optedIn;
      });
      /** Records each submit so the helper cannot silently repeat a payment click. */
      form.addEventListener("submit", event => {
        event.preventDefault();
        body.dataset.submissions = String(Number(body.dataset.submissions || 0) + 1);
      });
    }, collapsed);
    const stripe = new StripePage(page);
    await stripe.fillCard("unit@example.invalid");
    for (const [name, value] of [
      ["cardNumber", "4242424242424242"], ["cardExpiry", "1234"], ["cardCvc", "123"],
      ["billingName", "UI Test User"], ["email", "unit@example.invalid"], ["postalCode", "02135"],
    ]) await expect(hosted.locator(`input[name="${name}"]`)).toHaveValue(value);
    await expect(hosted.getByRole("combobox", { name: "Country", exact: true })).toHaveValue("US");
    await expect(hosted.getByRole("checkbox", { name: "Save my information for faster checkout" })).not.toBeChecked();
    await expect(hosted.locator("input[name=linkMobilePhone]")).toBeHidden();
    await expect(hosted.locator("body")).not.toHaveAttribute("data-submissions");
    if (collapsed) await expect(hosted.locator("body")).toHaveAttribute("data-card-selections", "1");
    await stripe.submit();
    await expect(hosted.locator("body")).toHaveAttribute("data-submissions", "1");
  });
}

/** Records route setup without a browser or HTTP requests, e.g. whether staging was left untouched. */
function authRouteRecorder() {
  const routes: { matches: (url: URL) => boolean; handle: (route: Route) => Promise<void> }[] = [];
  const context = {
    /** Records the auth interceptor instead of registering it with a real browser. */
    async route(matches: (url: URL) => boolean, handle: (route: Route) => Promise<void>) {
      routes.push({ matches, handle });
    },
  } as unknown as BrowserContext;
  return { context, routes };
}

/** Proves local scenarios have distinct, stable client IPs and never attach them to Stripe or other app paths. */
test("local auth rate buckets are isolated per browser @regression", async () => {
  const ips: string[] = [];
  for (let n = 0; n < 2; n++) {
    const recorder = authRouteRecorder();
    await installLocalAuthClient(recorder.context, "http://localhost:3000");
    const [route] = recorder.routes;
    expect(route.matches(new URL("http://localhost:3000/api/store/auth/signup"))).toBe(true);
    expect(route.matches(new URL("http://localhost:3000/api/store/auth/request-password-reset"))).toBe(true);
    for (const url of ["http://localhost:3000/api/orders/checkout-session", "https://checkout.stripe.com/api/store/auth/signup", "http://localhost:3100/api/store/auth/signup"]) {
      expect(route.matches(new URL(url))).toBe(false);
    }
    const headers: Record<string, string>[] = [];
    const request = {
      /** Preserves unrelated request headers while replacing a prior simulated client address. */
      request: () => ({ headers: () => ({ accept: "application/json", "x-forwarded-for": "old-client" }) }),
      /** Observes forwarding without making network requests or bypassing a real app response. */
      continue: async (options: { headers: Record<string, string> }) => { headers.push(options.headers); },
    } as unknown as Route;
    await route.handle(request);
    await route.handle(request);
    expect(headers[0].accept).toBe("application/json");
    expect(headers[0]["x-forwarded-for"]).toBe(headers[1]["x-forwarded-for"]);
    expect(headers[0]["x-real-ip"]).toBe(headers[0]["x-forwarded-for"]);
    expect(isIP(headers[0]["x-forwarded-for"])).toBe(6);
    ips.push(headers[0]["x-forwarded-for"]);
  }
  expect(ips[0]).not.toBe(ips[1]);
});

/** Keeps deployed rate limits intact: staging gets no identity override and production remains forbidden. */
test("local auth identity is never applied to remote servers @regression", async () => {
  const recorder = authRouteRecorder();
  await installLocalAuthClient(recorder.context, "https://staging.outlierfit.shop");
  expect(recorder.routes).toHaveLength(0);
  await expect(installLocalAuthClient(recorder.context, "https://outlierfit.shop")).rejects.toThrow();
  expect(recorder.routes).toHaveLength(0);
});

/** Prevents an accidental live deployment URL, custom alias, or hostname lookalike from running any suite. */
test("test target guard rejects production and lookalikes @regression", () => {
  for (const target of ["https://outlierfit.shop", "https://www.outlierfit.shop", "https://staging.outlierfit.shop.example.com", "http://staging.outlierfit.shop", "https://user:password@staging.outlierfit.shop"]) {
    expect(() => assertSafeTarget(target)).toThrow();
  }
  expect(assertSafeTarget("http://localhost:3100")).toBe("http://localhost:3100");
  expect(assertSafeTarget("https://staging.outlierfit.shop")).toBe("https://staging.outlierfit.shop");
});

/** Exercises both full and restricted live-key rejection without contacting Stripe. */
test("payment key guard rejects live keys @regression", () => {
  for (const key of ["", "sk_live_synthetic", "rk_live_synthetic", "not-a-key"]) {
    expect(() => assertTestStripeKey(key)).toThrow();
  }
  expect(assertTestStripeKey("rk_test_synthetic")).toBe("rk_test_synthetic");
});

/** Verifies failure-path cleanup removes owned paid-order fixtures, not just successful test accounts. */
test("fixture cleanup runs after a forced assertion failure @regression", async ({ baseURL }) => {
  const owned = await Sandbox.open(baseURL!);
  const user = await owned.account();
  const product = await owned.product();
  const shipping = await owned.address(user, "shipping", "Cleanup Fixture", true);
  await owned.order(user, product, shipping, shipping);
  await expect((async () => {
    try { throw new Error("synthetic scenario failure"); } finally { await owned.cleanup(); }
  })()).rejects.toThrow("synthetic scenario failure");
  const verifier = await Sandbox.open(baseURL!);
  try {
    for (const [sql, id] of [
      ["SELECT count(*)::int AS n FROM users WHERE id=$1", user.id],
      ["SELECT count(*)::int AS n FROM products WHERE id=$1", product.id],
      ["SELECT count(*)::int AS n FROM addresses WHERE id=$1", shipping],
      ["SELECT count(*)::int AS n FROM orders WHERE user_id=$1", user.id],
    ] as const) expect((await verifier.db.query(sql, [id])).rows[0].n).toBe(0);
  } finally { await verifier.cleanup(); }
});
