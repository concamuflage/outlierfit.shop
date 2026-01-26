"use client";

import React, { useMemo } from "react";
import { formatUsd } from "@/lib/formatters";

// This component displays the "text" portion of a product detail page:
// brand, name, price, attributes (style/color/size/sku/stock), measurements,
// materials, and description.
//


export type ProductMaterial = {
  material: string;
  percentage: number;
};

// This type matches the product JSON you showed from GET /products/:id.
export type ProductInfoPanelProduct = {
  sku: string;
  size: string;
  height_cm: number | null;
  chest_cm: number | null;
  description: string;
  id: number;
  name: string;
  brand: string;
  style: string;
  color: string;
  qty: number | null;
  cost_rmb: string | number | null;
  materials: ProductMaterial[];
};

export type ProductInfoPanelProps = {
  product: ProductInfoPanelProduct;
};

export default function ProductInfoPanel({ product }: ProductInfoPanelProps) {
  const RMB_TO_USD = Number(process.env.NEXT_PUBLIC_RMB_TO_USD);

  // Convert cost_rmb (often a string like "229.00") to a number,
  // then format it as USD for display.
  const priceUsdText = useMemo(() => {
    const rmb = product.cost_rmb == null ? 0 : Number(product.cost_rmb);
    const usd = rmb * RMB_TO_USD;
    return formatUsd(usd)
  }, [product.cost_rmb, RMB_TO_USD]);

  return (
    <div>
      <div className="text-sm text-zinc-500">{product.brand}</div>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{product.name}</h1>
      <div className="mt-3 text-lg font-semibold">{priceUsdText}</div>

      <div className="mt-6 space-y-3 text-sm">
        <div>
          <span className="text-zinc-500">Style:</span> {product.style}
        </div>
        <div>
          <span className="text-zinc-500">Color:</span> {product.color}
        </div>
        <div>
          <span className="text-zinc-500">Size:</span> {product.size}
        </div>
        <div>
          <span className="text-zinc-500">SKU:</span> {product.sku}
        </div>
        <div>
          <span className="text-zinc-500">Stock:</span>{product.qty}
        </div>
      </div>

      {/* Materials */}
      {/* This section renders the materials composition of the product */}
      {/* The conditional here checks if product.materials is an array and has at least one element */}
      {/* The `? (...) : (...)` syntax is a ternary operator used for conditional rendering */}
      {Array.isArray(product.materials) && product.materials.length > 0 ? (
        /* <ul> represents an unordered list, and <li> represents each list item */
        <ul className="mt-3 grid grid-cols-2 gap-3 text-sm">
          {/* .map((m, idx) => ...) iterates over each material in the materials array */}
          {/* `m` is the current material object, `idx` is its index in the array */}
          {product.materials.map((m, idx) => (
            <li
              /* The `key` prop helps React identify which items have changed, added, or removed */
              key={`${m.material}-${idx}`}
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3"
            >
              {/* {m.material} is the material name, {m.percentage} is its percentage */}
              <span className="text-zinc-900">{m.material}</span>
              <span className="text-zinc-600">{m.percentage}%</span>
            </li>
          ))}
        </ul>
      ) : (
        /* This fallback message shows when there are no materials listed */
        <div className="mt-2 text-sm text-zinc-600">No materials listed.</div>
      )}

      {/* Description */}
      <div className="mt-8">
        <h2 className="text-base font-medium">Description</h2>
        <p className="mt-2 text-sm text-zinc-700">{product.description}</p>
      </div>

    </div>
  );
}