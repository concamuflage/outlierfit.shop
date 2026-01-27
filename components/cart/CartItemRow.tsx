"use client";

import React from "react";
import { type CartItem } from "@/components/cart/CartContext";
import { formatUsd } from "@/lib/formatters";

// This component represents a single row in the shopping cart.
// It displays the product image, information, quantity controls, and a remove button.
type CartItemRowProps = {
  // The cart item data to display
  item: CartItem;
  // Callback function to remove the item from the cart
  onRemove: (id: string) => void;
  // Callback function to update the quantity of the item in the cart
  onUpdateQty: (id: string, qty: number) => void;
};

export default function CartItemRow({ item, onRemove, onUpdateQty }: CartItemRowProps) {
  return (
    <div className="flex gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
      {/* Product image section */}
      <div className="h-20 w-20 flex-none overflow-hidden rounded-xl bg-zinc-100">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
            No image
          </div>
        )}
      </div>

      {/* Product info and controls */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Product name, color, size, and price */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-zinc-900">{item.name}</div>
            <div className="mt-1 text-xs text-zinc-500">
              {item.color ? `Color: ${item.color}` : ""}
              {item.color && item.size ? " · " : ""}
              {item.size ? `Size: ${item.size}` : ""}
            </div>
          </div>
          <div className="text-sm font-semibold text-zinc-900">{formatUsd(item.price)}</div>
        </div>

        {/* Quantity controls and remove button */}
        <div className="flex items-center justify-between">
          {/* Quantity adjustment buttons */}
          <div className="flex items-center gap-2">
            {/* Decrease quantity button */}
            <button
              type="button"
              // Calls onUpdateQty with the new quantity decreased by 1
              // onUpdateQty is nice function so we don't have to write two functions. 
  
              onClick={() => onUpdateQty(item.id, item.qty - 1)}
              className="h-8 w-8 rounded-full border border-zinc-200 text-sm hover:border-zinc-400"
              aria-label="Decrease quantity"
            >
              -
            </button>
            {/* Current quantity display */}
            <div className="w-6 text-center text-sm">{item.qty}</div>
            {/* Increase quantity button */}
            <button
              type="button"
              // Calls onUpdateQty with the new quantity increased by 1
              onClick={() => onUpdateQty(item.id, item.qty + 1)}
              className="h-8 w-8 rounded-full border border-zinc-200 text-sm hover:border-zinc-400"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          {/* Remove item button */}
          <button
            type="button"
            // Calls onRemove to remove this item from the cart
            onClick={() => onRemove(item.id)}
            className="text-xs text-zinc-500 hover:text-zinc-900"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
