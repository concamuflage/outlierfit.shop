const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

/** Loads the real payment implementation with an isolated-schema pool, e.g. no public inventory writes. */
function loadSource(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, "../..", relativePath);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  /** Supplies the fixture pool while retaining ordinary dependencies such as the invoice date formatter. */
  loaded.require = function requireDependency(id) {
    return Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(this, id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

/**
 * Exercises actual PostgreSQL row locks and rollback, not simulated SQL results.
 * Run with RUN_INVENTORY_DB_TESTS=1 node --test test/unit/order-inventory.test.cjs.
 * A random schema is created and removed; catalog stock and existing orders are untouched.
 */
test("paid-order inventory transactions", { skip: process.env.RUN_INVENTORY_DB_TESTS !== "1" }, async (t) => {
  const pool = require("../../backend/database/pool");
  const schema = "inventory_test_" + randomUUID().replaceAll("-", "");
  const fixture = await pool.connect();
  try {
    await fixture.query(`CREATE SCHEMA "${schema}"`);
    await fixture.query(`SET search_path TO "${schema}"`);
    await fixture.query(`
      CREATE TABLE product_variants (id INTEGER PRIMARY KEY);
      CREATE TABLE inventory (
        variant_id INTEGER PRIMARY KEY REFERENCES product_variants(id),
        qty INTEGER NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE user_addresses (user_id INTEGER, address_id INTEGER);
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY, user_id INTEGER, shipment_status TEXT, payment_status TEXT,
        payment_provider TEXT, payment_reference TEXT, paid_at TIMESTAMPTZ, currency_code TEXT,
        subtotal_usd NUMERIC, shipping_usd NUMERIC, total_usd NUMERIC, shipping_method TEXT,
        shipping_address_id INTEGER, billing_address_id INTEGER, created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ, invoice_number TEXT, invoice_generated_at TIMESTAMPTZ,
        UNIQUE (payment_provider, payment_reference)
      );
      CREATE TABLE orders_variants (
        order_id INTEGER REFERENCES orders(id), variant_id INTEGER REFERENCES product_variants(id),
        quantity INTEGER, snapshot_price NUMERIC
      );
      CREATE TABLE carts (
        id INTEGER PRIMARY KEY, user_id INTEGER, shipping_address_id INTEGER,
        billing_address_id INTEGER, updated_at TIMESTAMPTZ
      );
      CREATE TABLE cart_items (cart_id INTEGER, variant_id INTEGER, quantity INTEGER);
      CREATE TABLE stripe_checkout_sessions (
        stripe_session_id TEXT PRIMARY KEY, order_id INTEGER REFERENCES orders(id),
        completed_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
      );
    `);
    const payments = loadSource("lib/server/orderPayments.ts", {
      "@/backend/database/pool": {
        /** Confines every transaction to the fixture schema; public is deliberately excluded from search_path. */
        async connect() {
          const client = await pool.connect();
          try {
            await client.query(`SET search_path TO "${schema}"`);
            return client;
          } catch (error) {
            client.release();
            throw error;
          }
        },
      },
      "@/lib/invoice": loadSource("lib/invoice.ts"),
      "@/lib/domestic-shipping": loadSource("lib/domestic-shipping.ts"),
    });

    /** Resets only synthetic fixtures, e.g. variants 1 and 2 each start with 4 units. */
    async function reset() {
      await fixture.query(`
        TRUNCATE stripe_checkout_sessions, orders_variants, orders, cart_items,
          carts, user_addresses, inventory, product_variants RESTART IDENTITY;
        INSERT INTO product_variants VALUES (1), (2);
        INSERT INTO inventory (variant_id, qty) VALUES (1, 4), (2, 4);
        INSERT INTO user_addresses VALUES (1, 1), (1, 2);
        INSERT INTO carts VALUES (1, 1, 1, 2, NOW());
        INSERT INTO cart_items VALUES (1, 1, 2);
        INSERT INTO stripe_checkout_sessions (stripe_session_id) VALUES ('test_a'), ('test_b');
      `);
    }

    /** Calls real finalization, e.g. test_a buys 2 units; provider mock needs no Stripe session. */
    function finalize(reference = "test_a", items = [{ cartItemId: "variant-1", quantity: 2, unitPriceUsd: 10 }], provider = "stripe") {
      return payments.finalizePaidOrder({
        userId: 1, paymentProvider: provider, paymentReference: reference,
        paidAt: new Date("2026-11-18T12:00:00Z"),
        payload: { shippingAddressId: 1, billingAddressId: 2, shippingMethod: "USPS",
          subtotalUsd: 20, shippingUsd: 8.95, totalUsd: 28.95, items },
      });
    }

    /** Reads synthetic stock only, e.g. [4,4] before purchase and [2,4] after purchasing variant 1. */
    async function stock() {
      return (await fixture.query("SELECT qty FROM inventory ORDER BY variant_id")).rows.map(row => row.qty);
    }

    /** Confirms failed transactions retain their cart and create no paid order. */
    async function assertRolledBack() {
      assert.equal((await fixture.query("SELECT COUNT(*)::int AS count FROM orders")).rows[0].count, 0);
      assert.equal((await fixture.query("SELECT COUNT(*)::int AS count FROM cart_items")).rows[0].count, 1);
    }

    // A paid purchase deducts once, creates its order, and clears the cart.
    await t.test("deducts purchased quantity on success", async () => {
      await reset();
      const result = await finalize();
      assert.deepEqual(await stock(), [2, 4]);
      assert.equal((await fixture.query("SELECT order_id FROM stripe_checkout_sessions WHERE stripe_session_id='test_a'")).rows[0].order_id, result.orderId);
      assert.equal((await fixture.query("SELECT COUNT(*)::int AS count FROM cart_items")).rows[0].count, 0);
    });

    // Mock references have no Stripe session, but still create one paid order and deduct once.
    await t.test("mock payment finalizes without a Stripe session", async () => {
      await reset();
      const items = [{ cartItemId: "variant-1", quantity: 2, unitPriceUsd: 10 }];
      const first = await finalize("mock_fixture", items, "mock");
      const duplicate = await finalize("mock_fixture", items, "mock");
      assert.equal(first.orderId, duplicate.orderId);
      assert.deepEqual(await stock(), [2, 4]);
      assert.deepEqual((await fixture.query("SELECT payment_provider, payment_status FROM orders")).rows,
        [{ payment_provider: "mock", payment_status: "paid" }]);
      assert.equal((await fixture.query("SELECT COUNT(*)::int AS count FROM stripe_checkout_sessions WHERE order_id IS NOT NULL")).rows[0].count, 0);
    });

    // Simultaneous deliveries of the same session must return one order and one deduction.
    await t.test("duplicate concurrent webhooks deduct only once", async () => {
      await reset();
      const results = await Promise.all([finalize(), finalize()]);
      assert.equal(results[0].orderId, results[1].orderId);
      await finalize();
      assert.deepEqual(await stock(), [2, 4]);
      assert.equal((await fixture.query("SELECT COUNT(*)::int AS count FROM orders")).rows[0].count, 1);
    });

    // Two independent paid sessions compete for 4 units: only one 3-unit order can be finalized.
    await t.test("concurrent purchases cannot drive inventory negative", async () => {
      await reset();
      const items = [{ cartItemId: "variant-1", quantity: 3, unitPriceUsd: 10 }];
      const results = await Promise.allSettled([finalize("test_a", items), finalize("test_b", items)]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      assert.match(results.find(result => result.status === "rejected").reason.message, /Insufficient stock/);
      assert.deepEqual(await stock(), [1, 4]);
    });

    // A later shortage restores stock already deducted from an earlier variant in the same order.
    await t.test("insufficient stock rolls back every item", async () => {
      await reset();
      await assert.rejects(finalize("test_a", [
        { cartItemId: "variant-1", quantity: 2, unitPriceUsd: 10 },
        { cartItemId: "variant-2", quantity: 5, unitPriceUsd: 10 },
      ]), /Insufficient stock/);
      assert.deepEqual(await stock(), [4, 4]);
      await assertRolledBack();
    });

    // An absent inventory record is unavailable stock, not unlimited inventory.
    await t.test("missing inventory cannot create an order", async () => {
      await reset();
      await fixture.query("DELETE FROM inventory WHERE variant_id=1");
      await assert.rejects(finalize(), /Insufficient stock/);
      await assertRolledBack();
    });

    // Repeated variant lines must consume their combined quantity, e.g. 2 + 2 consumes all 4.
    await t.test("aggregates repeated variants", async () => {
      await reset();
      await finalize("test_a", [
        { cartItemId: "variant-1", quantity: 2, unitPriceUsd: 10 },
        { cartItemId: "variant-1", quantity: 2, unitPriceUsd: 10 },
      ]);
      assert.deepEqual(await stock(), [0, 4]);
      await assert.rejects(finalize("test_b"), /Insufficient stock/);
    });

    // Invalid quantities must never increase stock or create fractional inventory.
    await t.test("rejects nonpositive and fractional quantities", async () => {
      await reset();
      for (const quantity of [0, -1, 1.5, NaN, Infinity, 2147483648]) {
        await assert.rejects(finalize("test_a", [{ cartItemId: "variant-1", quantity, unitPriceUsd: 10 }]), /positive integers/);
      }
      assert.deepEqual(await stock(), [4, 4]);
      await assertRolledBack();
    });

    // A failure after deduction (missing persisted session) must still restore every unit.
    await t.test("later finalization failures restore stock", async () => {
      await reset();
      await assert.rejects(finalize("missing_session"), /Missing persisted Stripe checkout session/);
      assert.deepEqual(await stock(), [4, 4]);
      await assertRolledBack();
    });
  } finally {
    try {
      await fixture.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      fixture.release();
      await pool.end();
    }
  }
});
