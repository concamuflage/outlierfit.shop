"use client"; // This directive marks the component to be rendered on the client side. This is necessary because this component uses React hooks and stateful logic that require client-side rendering.

import React from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartContext"; // useCart is a custom hook that provides access to the shopping cart's state and actions.
import CartItemRow from "@/components/cart/CartItemRow"; // Component representing a single item row in the cart.
import { formatUsd } from "@/lib/formatters"; // Utility function to format numbers as USD currency strings.

export default function CartDrawer() {
  
  // Destructure values and functions from useCart hook:
  // - items: array of cart items
  // - isOpen: boolean indicating if the cart drawer is open
  // - subtotal: total price of items in cart
  // - closeCart: function to close the cart drawer
  // - removeItem: function to remove an item from the cart
  // - updateQty: function to update quantity of an item
  // - clearCart: function to remove all items from the cart
  const { items, isOpen, subtotal, closeCart, removeItem, updateQty, clearCart } = useCart();

  return (
    <div
      className={
        "fixed inset-0 z-50 transition " +
        // isOpen controls pointer events to enable or disable interaction with the drawer and backdrop
        (isOpen ? "pointer-events-auto" : "pointer-events-none") // toggle so mouse events on this element is allowed or disabled.
      }
      // aria-hidden is true when cart is closed to improve accessibility by hiding from screen readers
      // “Pretend this element and all its children do NOT exist for people who are visually impaired and use screen readers"
      aria-hidden={!isOpen}
    >
      {/* Backdrop: a semi-transparent overlay behind the cart drawer */}
      <div
        className={
          "absolute inset-0 bg-black/40 transition-opacity " +
          // isOpen controls the opacity of the backdrop for fade-in/out effect
          (isOpen ? "opacity-100" : "opacity-0")
        }
        // Clicking the backdrop calls closeCart to close the drawer
        onClick={closeCart}
      />

      <aside
        className={
          "absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transition-transform " +
          // isOpen controls the drawer sliding in and out from the right
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
              onClick={closeCart} // Close button closes the cart drawer
              className="text-sm text-zinc-500 hover:text-zinc-900"
            >
              Close
            </button>
          </div>

          {/* Main content area: scrollable list of cart items or empty message */}

          <div className="flex-1 space-y-4 overflow-auto px-6 py-4">
            {items.length === 0 ? (
              // Conditional rendering: if no items, show a message indicating empty cart
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-600">
                Your cart is empty.
              </div>
            ) : (
              // Otherwise, map over items to render a CartItemRow for each
              items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item} // Pass individual cart item data
                  onRemove={removeItem} // Pass removeItem function to allow removing this item
                  onUpdateQty={updateQty} // Pass updateQty function to update quantity
                />
              ))
            )}
          </div>

          {/* Footer area showing subtotal and action buttons */}
          <div className="border-t border-zinc-200 px-6 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-600">Subtotal</span>
              {/* subtotal is the total price of all items; formatUsd formats it as a USD currency string */}
              <span className="font-semibold text-zinc-900">{formatUsd(subtotal)}</span>
            </div>

            <div className="mt-4 grid gap-2">
              {/* Link to the full cart page; clicking it also closes the drawer */}
              <Link
                href="/cart"
                className="rounded-full border border-zinc-200 px-4 py-2 text-center text-sm text-zinc-900 hover:border-zinc-400"
                onClick={closeCart}
              >
                View cart
              </Link>
              {/* Checkout button (no action defined here) */}
              <button
                type="button"
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
              >
                Checkout
              </button>
              {/* If there are items, show a Clear cart button to remove all items */}
              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={clearCart} // Clears all items from the cart
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
