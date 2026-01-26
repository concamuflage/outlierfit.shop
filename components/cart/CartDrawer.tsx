"use client";

import React from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartContext";
import CartItemRow from "@/components/cart/CartItemRow";
import { formatUsd } from "@/lib/formatters";

export default function CartDrawer() {
  const { items, isOpen, subtotal, closeCart, removeItem, updateQty, clearCart } = useCart();

  return (
    <div
      className={
        "fixed inset-0 z-50 transition " +
        (isOpen ? "pointer-events-auto" : "pointer-events-none")
      }
      aria-hidden={!isOpen}
    >
      <div
        className={
          "absolute inset-0 bg-black/40 transition-opacity " +
          (isOpen ? "opacity-100" : "opacity-0")
        }
        onClick={closeCart}
      />

      <aside
        className={
          "absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transition-transform " +
          (isOpen ? "translate-x-0" : "translate-x-full")
        }
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
            <div className="text-base font-semibold">Cart</div>
            <button
              type="button"
              onClick={closeCart}
              className="text-sm text-zinc-500 hover:text-zinc-900"
            >
              Close
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-auto px-6 py-4">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-600">
                Your cart is empty.
              </div>
            ) : (
              items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  onRemove={removeItem}
                  onUpdateQty={updateQty}
                />
              ))
            )}
          </div>

          <div className="border-t border-zinc-200 px-6 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-600">Subtotal</span>
              <span className="font-semibold text-zinc-900">{formatUsd(subtotal)}</span>
            </div>

            <div className="mt-4 grid gap-2">
              <Link
                href="/cart"
                className="rounded-full border border-zinc-200 px-4 py-2 text-center text-sm text-zinc-900 hover:border-zinc-400"
                onClick={closeCart}
              >
                View cart
              </Link>
              <button
                type="button"
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
              >
                Checkout
              </button>
              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs text-zinc-500 hover:text-zinc-900"
                >
                  Clear cart
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
