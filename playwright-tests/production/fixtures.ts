import { expect } from "@playwright/test";
import { test as base, createBdd } from "playwright-bdd";

export const test = base.extend({
  /** Blocks browser writes before they reach production, e.g. POST /api/orders/checkout-session is refused. */
  context: async ({ context, baseURL }, provide) => {
    expect(baseURL).toBe("https://outlierfit.shop");
    const blocked: string[] = [];
    await context.route("**/*", async route => {
      const request = route.request();
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        blocked.push(`${request.method()} ${new URL(request.url()).pathname}`);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    try { await provide(context); } finally {
      expect(blocked, "Production smoke must not attempt state-changing browser requests").toEqual([]);
    }
  },
});

export const { Given, When, Then } = createBdd(test);
