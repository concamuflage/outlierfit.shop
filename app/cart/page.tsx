"use client";

import React from "react";
import Link from "next/link";
import CartItemRow from "@/components/cart/CartItemRow";
import { useCart } from "@/components/cart/CartContext";
import { formatUsd } from "@/lib/formatters";

export default function CartPage() {
  const { items, subtotal, removeItem, updateQty, clearCart } = useCart();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Review items, update quantities, and proceed to checkout.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center">
            <div className="text-sm text-zinc-600">Your cart is empty.</div>
            <Link
              href="/products"
              className="mt-4 inline-block rounded-full bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.5fr_0.9fr]">
            <div className="space-y-4">
              {items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  onRemove={removeItem}
                  onUpdateQty={updateQty}
                />
              ))}
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold">Order summary</h2>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-zinc-600">Subtotal</span>
                <span className="font-semibold text-zinc-900">{formatUsd(subtotal)}</span>
              </div>
              <div className="mt-2 text-xs text-zinc-500">Shipping and tax calculated at checkout.</div>
              <button
                type="button"
                className="mt-6 w-full rounded-full bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
              >
                Checkout
              </button>
              <button
                type="button"
                onClick={clearCart}
                className="mt-3 w-full text-xs text-zinc-500 hover:text-zinc-900"
              >
                Clear cart
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
