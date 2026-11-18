const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

/** Loads JS/TS/TSX with isolated dependencies, e.g. renders OrderSummary without a database connection. */
function loadSource(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, "../..", relativePath);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  /** Resolves explicit test doubles first, e.g. the in-memory @/backend/database/pool. */
  loaded.require = function requireDependency(id) {
    return Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(this, id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}

/** Builds test-only cart rows, e.g. two $49.90 shirts with an unrelated 88 RMB supplier cost. */
function cartRow(overrides = {}) {
  return {
    shipping_address_id: 1, billing_address_id: 2,
    quantity: 2, variant_id: 40, product_id: 13, product_name: "Cotton Long Sleeve Shirt",
    price_usd: "49.90", cost_rmb: "88.00", weight_kg: "0.45", color: "White", size: "M",
    ...overrides,
  };
}

/** Supplies saved cart/address/rate rows without writes; the flat fee comes from shared domestic configuration. */
function checkoutModules(rows) {
  const pool = {
    /** Returns deterministic query fixtures, e.g. owned address IDs 1 and 2. */
    async query(sql) {
      if (/FROM carts cts/.test(sql)) return { rows };
      if (/FROM user_addresses/.test(sql)) return { rows: [{ address_id: 1 }, { address_id: 2 }] };
      if (/^\s*(CREATE|ALTER)\b/.test(sql)) return { rows: [] };
      throw new Error(`Unexpected test query: ${sql}`);
    },
  };
  const orderPayments = loadSource("lib/server/orderPayments.ts", {
    "@/backend/database/pool": pool,
    "@/lib/domestic-shipping": loadSource("lib/domestic-shipping.ts"),
    "@/lib/invoice": loadSource("lib/invoice.ts"),
  });
  return { ...orderPayments, ...loadSource("lib/server/cartStore.ts", { "@/backend/database/pool": pool }) };
}

// Retail prices are independent of supplier costs: $49.90 + $19.90 = $69.80.
test("cart and checkout use recorded USD prices, not yuan costs", async () => {
  const modules = checkoutModules([
    cartRow({ quantity: 1, cost_rmb: "9999.00" }),
    cartRow({ quantity: 1, variant_id: 42, product_id: 14, price_usd: "19.90", cost_rmb: "1.00", weight_kg: "0.25" }),
  ]);
  const cart = await modules.getCart(1);
  assert.deepEqual(cart.items.map(item => item.price), [49.9, 19.9]);
  const checkout = await modules.buildAuthoritativeCheckoutOrderPayload({ userId: 1 });
  assert.deepEqual(checkout.items.map(item => item.unitPriceUsd), [49.9, 19.9]);
  assert.equal(checkout.subtotalUsd, 69.8);
  assert.ok(modules.isValidCheckoutOrderPayload(checkout));
  assert.equal(modules.isValidCheckoutOrderPayload({ ...checkout, shippingMethod: null }), false);
  assert.equal(checkout.shippingUsd, 8.95);
  assert.equal(checkout.shippingMethod, "USPS");
  assert.equal(checkout.totalUsd, Math.round((69.8 + checkout.shippingUsd) * 100) / 100);
  assert.equal(modules.expectedStripeAmountCents(checkout), 6980 + Math.round(checkout.shippingUsd * 100));
});

// Missing or invalid prices must not silently produce a free item or a cost-derived price.
test("checkout rejects missing and invalid USD prices", async () => {
  for (const price_usd of [null, undefined, "invalid", "0.00", "-1.00", Infinity]) {
    const modules = checkoutModules([cartRow({ price_usd })]);
    await assert.rejects(modules.buildAuthoritativeCheckoutOrderPayload({ userId: 1 }), /Retail price is missing/);
  }
});

// Neither order quantity nor missing item weights can trigger the retired international rate calculation.
test("domestic shipping is flat and independent of item weight", async () => {
  const modules = checkoutModules([cartRow({ quantity: 13, weight_kg: null })]);
  const checkout = await modules.buildAuthoritativeCheckoutOrderPayload({ userId: 1 });
  assert.equal(checkout.subtotalUsd, 648.7);
  assert.equal("shippingId" in checkout, false);
  assert.equal("shippingWeightKg" in checkout, false);
  assert.equal(checkout.shippingUsd, 8.95);
});

// Render a synthetic invoice; its business contact must be the requested personal address.
test("invoice uses the new business contact email", () => {
  const address = { name: "Test Customer", street: "Test Street", city: "Test City", state: "NY", zipCode: "00000", country: "US", phone: "" };
  const pdf = Buffer.from(loadSource("lib/invoice.ts").buildInvoicePdf({
    invoiceNumber: "OF-20261112-1", paidAt: "2026-11-12T00:00:00Z", shippingModeLabel: "USPS",
    subtotalUsd: 19.9, shippingUsd: 0, totalUsd: 19.9,
    items: [{ name: "Cotton Short Sleeve T-Shirt", quantity: 1, unitPriceUsd: 19.9 }],
    shippingAddress: address, billingAddress: address,
  })).toString("latin1");
  assert.match(pdf, /apple_banana_2026@proton\.me/);
  assert.doesNotMatch(pdf, /unodostreszlm@gmail\.com/);
  assert.doesNotMatch(pdf, /info@outlierfit\.shop/);
});

// Decode the actual contact-page helper, e.g. Reveal Email must use the same address as invoices.
test("contact page reveals the new public address", () => {
  const filename = path.resolve(__dirname, "../../app/contact/page.tsx");
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const helper = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "buildEmail");
  assert.ok(helper);
  const contactEmail = new Function(`${helper.getText(source)}; return buildEmail();`)();
  assert.equal(contactEmail, "apple_banana_2026@proton.me");
});

// Both cart views share this component; no international selector or calculated package weight remains.
test("order summary displays one flat domestic fee and no international choices", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const summary = loadSource("components/cart/OrderSummary.tsx", {
    "@/lib/formatters": { formatUsd: value => "$" + value.toFixed(2) },
    "@/lib/domestic-shipping": loadSource("lib/domestic-shipping.ts"),
  }).default;
  const html = renderToStaticMarkup(React.createElement(summary, { subtotal: 49.9 }));
  assert.match(html, /US shipping \(flat rate\)/);
  assert.match(html, /\$8\.95/);
  assert.match(html, /\$58\.85/);
  assert.doesNotMatch(html, /Shipping options|Air Sea Land|Sea Land|Shipping weight|Box weight|radio/);
});

/** Verifies pounds-first product weights, e.g. 0.99 lb (0.45 kg), without changing stored kilograms. */
test("product details show pounds first and preserve multiline descriptions", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const Panel = loadSource("components/products/ProductInfoPanel.tsx", {
    "@/lib/formatters": { formatUsd: value => "$" + value.toFixed(2) },
  }).default;
  for (const [weight_kg, label] of [[0.45, "0.99 lb (0.45 kg)"], [0.25, "0.55 lb (0.25 kg)"], [null, "N/A"]]) {
    const product = { name: "Cotton Shirt", brand: "Generic", style: "Shirts", color: "White", size: "M", sku: "9653", qty: 4, price_usd: 34.99, weight_kg, description: "Size M: approximately 110-132 lb (50-60 kg).\nSize L: approximately 132-154 lb (60-70 kg).", materials: [] };
    const html = renderToStaticMarkup(React.createElement(Panel, { product }));
    assert.ok(html.includes(`>${label}</span>`));
    assert.match(html, /whitespace-pre-line/);
    assert.ok(html.includes(product.description));
    assert.equal(product.weight_kg, weight_kg);
  }
});

/** Verifies inches-first garment tables, e.g. a 106 cm chest renders 41.7 inches in column two and 106 cm in column three. */
test("product measurement tables show inches second and centimeters third", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const Panel = loadSource("components/products/ProductInfoPanel.tsx", {
    "@/lib/formatters": { formatUsd: value => "$" + value.toFixed(2) },
  }).default;
  const garment_measurements = { chest_cm: 106, shoulder_width_cm: 46, body_length_cm: 72, sleeve_length_cm: 62, hem_circumference_cm: null };
  const product = { name: "Cotton Shirt", brand: "Generic", style: "Shirts", color: "White", size: "L", sku: "9653", qty: 4, price_usd: 34.99, weight_kg: 0.45, description: "", materials: [], garment_measurements };
  const html = renderToStaticMarkup(React.createElement(Panel, { product }));
  const table = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/)?.[0];
  assert.ok(table);
  assert.match(table, />Inches<\/th>/);
  assert.match(table, />cm<\/th>/);
  assert.ok(table.indexOf(">Inches</th>") < table.indexOf(">cm</th>"));
  assert.equal((table.match(/scope="col"/g) || []).length, 3);
  for (const inches of ["41.7", "18.1", "28.3", "24.4"]) assert.ok(table.includes(`>${inches}</td>`));
  for (const cm of [106, 46, 72, 62]) assert.ok(table.includes(`>${cm}</td>`));
  assert.doesNotMatch(table, /Hem circumference/);
  assert.equal(garment_measurements.chest_cm, 106);
});

// Historical monetary snapshots are not recalculated using today's domestic fee.
test("historical invoices retain their shipping charge without a rate-table join", async () => {
  const invoice = loadSource("lib/server/orderInvoiceStore.ts", { "@/backend/database/pool": {
    /** Returns a synthetic historical order and rejects any dependency on the retired rate table. */
    async query(sql) {
      assert.doesNotMatch(sql, /shipping_cost/);
      if (/FROM orders o/.test(sql)) return { rows: [{
        invoice_number: "OF-20261101-1", subtotal_usd: "49.90", shipping_usd: "22.19",
        total_usd: "72.09", paid_at: new Date("2026-11-01T00:00:00Z"),
        shipping_method: "Air 7-15 days",
      }] };
      return { rows: [{ quantity: 1, snapshot_price: "49.90", product_name: "Cotton Shirt" }] };
    },
  } });
  const payload = await invoice.getInvoicePayloadForOrder(1, 1);
  assert.equal(payload.shippingUsd, 22.19);
  assert.equal(payload.totalUsd, 72.09);
  assert.equal(payload.shippingModeLabel, "Air 7-15 days");
});
