"use client";

import React from "react";
import { useCart } from "@/components/cart/CartContext";

export default function CartButton() {
  const { itemCount, openCart } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-900 hover:border-zinc-400"
      aria-label="Open cart"
    >
      <span>Cart</span>
      <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-white">
        {itemCount} item{itemCount === 1 ? "" : "s"}
      </span>
    </button>
  );
}
