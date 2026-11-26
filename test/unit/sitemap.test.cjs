const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");

/** Loads the real sitemap config with an offline catalog, e.g. product IDs 13/14 without querying PostgreSQL. */
function loadSitemap(catalog = Response.json([])) {
  let closed = 0;
  const filename = path.resolve(__dirname, "../../next-sitemap.config.js");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  /** Only the two sitemap dependencies are allowed; no real application pool or network can be loaded. */
  loaded.require = id => {
    if (id === "./backend/database/pool") return {
      /** Records postbuild resource cleanup on success and failure. */
      end: async () => { closed += 1; },
    };
    if (id === "./backend/controllers/productsController") return {
      /** Supplies public-catalog responses or throws a synthetic database error. */
      getAllProducts: async () => {
        if (catalog instanceof Error) throw catalog;
        return catalog;
      },
    };
    throw new Error(`Unexpected sitemap dependency: ${id}`);
  };
  loaded._compile(fs.readFileSync(filename, "utf8"), filename);
  return {
    config: loaded.exports,
    /** Reports how many times the build pool closed, e.g. one after a failed catalog read. */
    closed: () => closed,
  };
}

/** Keeps auth/private route roots and descendants out, e.g. /profile and /profile/orders, without blocking products. */
test("sitemap excludes account and checkout pages", () => {
  const { config } = loadSitemap();
  for (const route of ["/cart", "/cart/*", "/checkout", "/checkout/*", "/profile", "/profile/*", "/admin", "/admin/*", "/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/api/*", "/backend/*"]) {
    assert.ok(config.exclude.includes(route), `Missing sitemap exclusion: ${route}`);
  }
  for (const route of ["/", "/about", "/contact", "/products", "/policies/shipping-and-returns"]) {
    assert.ok(!config.exclude.includes(route));
  }
});

/** Uses real catalog IDs rather than product names, e.g. 13 maps to /products/13, not /products/cotton-shirt. */
test("sitemap adds catalog product URLs and closes the build connection", async () => {
  const fixture = loadSitemap(Response.json([{ product_id: 13 }, { product_id: 14 }]));
  const paths = await fixture.config.additionalPaths({ changefreq: "daily", priority: 0.7 });
  assert.deepEqual(paths, [
    { loc: "/products/13", changefreq: "daily", priority: 0.7 },
    { loc: "/products/14", changefreq: "daily", priority: 0.7 },
  ]);
  assert.equal(fixture.closed(), 1);
});

/** A failed catalog must fail generation, not silently publish another sitemap without product pages. */
test("sitemap releases the connection when the catalog fails or has an invalid ID", async () => {
  const originalExitCode = process.exitCode;
  try {
    for (const catalog of [Response.json({}, { status: 500 }), new Error("offline catalog"), Response.json([{ product_id: "not-an-id" }])]) {
      const fixture = loadSitemap(catalog);
      await assert.rejects(fixture.config.additionalPaths({}), /catalog|product ID/);
      assert.equal(fixture.closed(), 1);
      assert.equal(process.exitCode, 1);
    }
  } finally {
    process.exitCode = originalExitCode;
  }
});
