module.exports = {
  siteUrl: "https://outlierfit.shop",
  generateRobotsTxt: true,
  exclude: [
    "/api/*", "/backend/*",
    "/cart", "/cart/*",
    "/checkout", "/checkout/*",
    "/profile", "/profile/*",
    "/admin", "/admin/*",
    "/login", "/signup", "/forgot-password", "/reset-password", "/verify-email",
  ],
  /** Adds the public catalog's numeric product routes, e.g. product_id 13 becomes /products/13. */
  additionalPaths: async (config) => {
    const pool = require("./backend/database/pool");
    try {
      // Reuse the storefront's catalog selection and aggregation; no loopback HTTP server is needed at build time.
      const { getAllProducts } = require("./backend/controllers/productsController");
      const response = await getAllProducts();
      if (!response.ok) throw new Error("Cannot generate product sitemap: catalog query failed.");
      const products = await response.json();
      /** Uses the same numeric route as the storefront, e.g. catalog product_id 13 yields /products/13. */
      return products.map((product) => {
        const id = Number(product.product_id);
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Cannot generate product sitemap: invalid product ID.");
        return { loc: `/products/${id}`, changefreq: config.changefreq, priority: config.priority };
      });
    } catch (error) {
      // next-sitemap logs rejected hooks but otherwise exits successfully; do not deploy stale XML after a catalog failure.
      process.exitCode = 1;
      throw error;
    } finally {
      // next-sitemap runs in its own postbuild process; close its DB pool so generation can exit cleanly.
      await pool.end();
    }
  },
};
