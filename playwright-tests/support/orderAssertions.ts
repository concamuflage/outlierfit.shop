import type { APIRequestContext, APIResponse } from "@playwright/test";
import { expect } from "@playwright/test";
import type { Product, Sandbox, Account } from "./sandbox";


/** Creates the same two-item order fixture Java uses, but owned by a unique account and catalog variant. */
export async function checkoutFixture(sandbox: Sandbox, account: Account) {
  const product = await sandbox.product();
  const shipping = await sandbox.address(account, "shipping", "PW Shipping", true);
  const billing = await sandbox.address(account, "billing", "PW Billing", true);
  return { product, shipping, billing };
}


/** Preserves cart ID, quantity, address selections, and removal of the retired international shipping ID. */
export async function assertCart(response: APIResponse, product: Product, shipping: number, billing: number) {
  expect(response.status()).toBe(200);
  const cart = await response.json();
  expect(cart.items).toHaveLength(1);
  expect(cart.items[0]).toMatchObject({ id: product.cartItemId, qty: 2 });
  expect(cart.shippingAddressId).toBe(shipping);
  expect(cart.billingAddressId).toBe(billing);
  expect(cart.shippingId ?? null).toBeNull();
}


/** Checks stored list/detail snapshots, including product identity, sizes, prices, and paid/unshipped state. */
export async function assertOrder(request: APIRequestContext, order: { id: number; invoiceNumber: string }, product: Product) {
  const list = await request.get("/api/profile/orders");
  expect(list.status()).toBe(200);
  expect(await list.json()).toContainEqual(expect.objectContaining({ id: order.id, paymentStatus: "paid", shipmentStatus: "unshipped" }));
  const response = await request.get(`/api/profile/orders/${order.id}`);
  expect(response.status()).toBe(200);
  const detail = await response.json();
  expect(detail).toMatchObject({ id: order.id, invoiceNumber: order.invoiceNumber, paymentStatus: "paid", shipmentStatus: "unshipped", shipping: { method: "USPS" } });
  expect(detail.items).toHaveLength(1);
  expect(detail.items[0]).toMatchObject({ productId: product.id, variantId: product.variantId, quantity: 2,
    productName: product.name, color: product.color, size: product.size, variantExists: true });
  expect(detail.items[0].unitPriceUsd).toBeCloseTo(product.price, 2);
}


/** Preserves every invoice metadata, address, and item assertion from OrdersApiSteps.java. */
export async function assertInvoice(request: APIRequestContext, order: { id: number; invoiceNumber: string }, product: Product, account: Account) {
  const response = await request.get(`/api/profile/orders/${order.id}/invoice`);
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload).toMatchObject({ invoiceNumber: order.invoiceNumber, customerEmail: account.email, shippingModeLabel: "USPS" });
  expect(payload.paidAt).toBeTruthy();
  expect(payload.subtotalUsd).toBeCloseTo(product.price * 2, 2);
  expect(payload.shippingUsd).toBe(8.95);
  expect(payload.totalUsd).toBeCloseTo(product.price * 2 + 8.95, 2);
  for (const kind of ["shippingAddress", "billingAddress"]) {
    for (const key of ["name", "street", "city", "state", "zipCode", "country", "phone"]) expect(payload[kind][key]).toBeTruthy();
  }
  expect(payload.items).toHaveLength(1);
  expect(payload.items[0]).toMatchObject({ name: product.name, color: product.color, size: product.size, quantity: 2 });
  expect(payload.items[0].unitPriceUsd).toBeCloseTo(product.price, 2);
  return payload;
}


/** Checks both the download contract and actual PDF magic bytes, not just a successful HTTP status. */
export async function assertPdf(response: APIResponse) {
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect(response.headers()["content-disposition"]).toMatch(/attachment;.*invoice-/);
  const data = await response.body();
  expect(data.length).toBeGreaterThan(100);
  expect(data.subarray(0, 5).toString()).toBe("%PDF-");
}

