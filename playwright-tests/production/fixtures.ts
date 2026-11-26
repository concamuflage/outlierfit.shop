import { expect } from "@playwright/test";
import { test as base, createBdd } from "playwright-bdd";

export const test = base.extend({
  /** Blocks writes and discards Google collection beacons, e.g. POST /g/collect never reaches analytics. */
  context: async ({ context, baseURL }, provide) => {
    expect(baseURL).toBe("https://outlierfit.shop");
    const blocked: string[] = [];
    /** Suppresses known analytics traffic without exempting same-origin writes or lookalike domains. */
    await context.route("**/*", async route => {
      const request = route.request();
      const url = new URL(request.url());
      // Page views generate these POSTs automatically; discard them so smoke runs do not pollute analytics.
      if (request.method() === "POST" && url.pathname === "/g/collect"
        && ["https://www.google-analytics.com", "https://www.google.com"].includes(url.origin)) {
        await route.abort("blockedbyclient");
        return;
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        blocked.push(`${request.method()} ${url.pathname}`);
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
