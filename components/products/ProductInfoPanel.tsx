"use client";

import React, { type ReactNode } from "react";
import { formatUsd } from "@/lib/formatters";

// This component displays the "text" portion of a product detail page:
// brand, name, price, attributes (style/color/size/sku/stock), measurements,
// materials, and description.
//


export type ProductMaterial = {
  material: string;
  percentage: number | null;
};

export type GarmentMeasurements = {
  chest_cm: number | null;
  shoulder_width_cm: number | null;
  body_length_cm: number | null;
  sleeve_length_cm: number | null;
  hem_circumference_cm?: number | null;
};

// This type matches the product JSON you showed from GET /products/:id.
export type ProductInfoPanelProduct = {
  sku: string;
  size: string;
  height_cm: number | null;
  chest_cm: number | null;
  garment_measurements?: GarmentMeasurements | null;
  weight_kg: number | null;
  description: string;
  id: number;
  name: string;
  brand: string;
  style: string;
  color: string;
  qty: number | null;
  price_usd: number | null;
  materials: ProductMaterial[];
};

export type ProductInfoPanelProps = {
  product: ProductInfoPanelProduct;
  variantControls?: ReactNode;
};

/**
 * Displays product details and the selected variant's recorded garment measurements.
 * Measurements show inches first and centimeters third, e.g. chest: 40.2 inches, 102 cm.
 * Actual item weight shows pounds first, with kilograms secondary, e.g. 0.99 lb (0.45 kg).
 * Recorded hem measurements are included, e.g. a stored 108 cm hem displays as 42.5 inches.
 * Retail prices come directly from the database, e.g. 19.9 displays as $19.90.
 * The brand is labeled explicitly, e.g. Generic displays as "Brand: Generic".
 * Preserves description line breaks, e.g. size M and size L weight ranges appear on separate lines.
 */
export default function ProductInfoPanel({ product, variantControls }: ProductInfoPanelProps) {
  // Missing measurements stay hidden for catalog items created before measurement entry.
  const measurementRows = [
    { label: "Chest circumference", value: product.garment_measurements?.chest_cm },
    { label: "Shoulder width", value: product.garment_measurements?.shoulder_width_cm },
    { label: "Body length", value: product.garment_measurements?.body_length_cm },
    { label: "Sleeve length", value: product.garment_measurements?.sleeve_length_cm },
    { label: "Hem circumference", value: product.garment_measurements?.hem_circumference_cm },
  ].filter(
    (measurement): measurement is { label: string; value: number } => measurement.value != null
  );

  const priceUsdText = product.price_usd == null ? "N/A" : formatUsd(product.price_usd, 2);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
      <div className="mt-1 text-base font-semibold text-zinc-700">Brand: {product.brand}</div>
      <div className="mt-3 text-lg font-semibold">{priceUsdText}</div>
      {variantControls ? <div className="mt-6">{variantControls}</div> : null}

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
          <span className="text-zinc-500">Weight:</span>{" "}
          <span data-testid="product-weight" data-weight-kg={product.weight_kg ?? undefined}>
            {product.weight_kg == null ? "N/A" : `${(product.weight_kg / 0.45359237).toFixed(2)} lb (${product.weight_kg.toFixed(2)} kg)`}
          </span>
        </div>
        <div>
          <span className="text-zinc-500">SKU:</span> {product.sku}
        </div>
        <div>
          <span className="text-zinc-500">Stock:</span>{product.qty}
        </div>
      </div>

      {Array.isArray(product.materials) && product.materials.length > 0 ? (
        <div className="mt-3 text-sm">
          <span className="text-zinc-500">Materials:</span>{" "}
          {product.materials
            .map((m) => (m.percentage == null ? m.material : `${m.material} ${m.percentage}%`))
            .join(", ")}
        </div>
      ) : null}

      {measurementRows.length > 0 ? (
        <section className="mt-6" aria-labelledby="garment-measurements-heading">
          <h2 id="garment-measurements-heading" className="text-sm font-medium">
            Garment measurements
          </h2>
          <table className="mt-3 w-full border-collapse text-sm" aria-labelledby="garment-measurements-heading">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th scope="col" className="py-2 pr-4 text-left font-medium">Measurement</th>
                <th scope="col" className="w-20 py-2 pr-3 text-right font-medium">Inches</th>
                <th scope="col" className="w-16 py-2 text-right font-medium">cm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {measurementRows.map(({ label, value }) => (
                <tr key={label}>
                  <th scope="row" className="py-2 pr-4 text-left font-normal text-zinc-600">{label}</th>
                  {/* Convert the stored centimeters at display time: 102 / 2.54 = 40.2 in. */}
                  <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{(value / 2.54).toFixed(1)}</td>
                  <td className="whitespace-nowrap py-2 text-right tabular-nums">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* Description */}
      <div className="mt-8">
        <h2 className="text-base font-medium">Description</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">{product.description}</p>
      </div>

    </div>
  );
}
