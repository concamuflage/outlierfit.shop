"use client";

import React from "react";
import { type CartItem } from "@/components/cart/CartContext";
import { formatUsd } from "@/lib/formatters";

type CartItemRowProps = {
  item: CartItem;
  onRemove: (id: string) => void;
  onUpdateQty: (id: string, qty: number) => void;
};

export default function CartItemRow({ item, onRemove, onUpdateQty }: CartItemRowProps) {
  return (
    <div className="flex gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
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

      <div className="flex min-w-0 flex-1 flex-col gap-2">
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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdateQty(item.id, item.qty - 1)}
              className="h-8 w-8 rounded-full border border-zinc-200 text-sm hover:border-zinc-400"
              aria-label="Decrease quantity"
            >
              -
            </button>
            <div className="w-6 text-center text-sm">{item.qty}</div>
            <button
              type="button"
              onClick={() => onUpdateQty(item.id, item.qty + 1)}
              className="h-8 w-8 rounded-full border border-zinc-200 text-sm hover:border-zinc-400"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          <button
            type="button"
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
