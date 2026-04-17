"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CartItemRow from "@/components/cart/CartItemRow";
import { useCart } from "@/components/cart/CartContext";
import { formatUsd } from "@/lib/formatters";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const RMB_TO_USD = Number(process.env.NEXT_PUBLIC_RMB_TO_USD ?? "0.14");

type ShippingMode = {
  id: number;
  mode: string;
  delivery_time: string | null;
  first_kg_cost_rmb: number | null;
  additional_kg_cost_rmb: number | null;
};

function getBoxWeightKg(clothesWeightKg: number) {
  if (clothesWeightKg <= 0) return 0;
  if (clothesWeightKg <= 1) return 0.25;
  if (clothesWeightKg <= 2) return 0.3;
  if (clothesWeightKg <= 3) return 0.35;
  if (clothesWeightKg <= 4) return 0.4;
  if (clothesWeightKg <= 5) return 0.45;

  // Continue the same pattern above 5 kg.
  const extraKgSteps = Math.ceil(clothesWeightKg) - 5;
  return 0.45 + extraKgSteps * 0.05;
}

function formatShippingMode(mode: string) {
  if (mode === "hybrid") return "Air Sea Land";
  return mode
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getShippingModeSortOrder(mode: string) {
  if (mode === "air") return 0;
  if (mode === "hybrid") return 1;
  if (mode === "sea_land") return 2;
  return 99;
}

function calculateShippingCostRmb(totalWeightKg: number, mode: ShippingMode) {
  if (totalWeightKg <= 0) return 0;

  const firstKgCost = mode.first_kg_cost_rmb ?? 0;
  const additionalKgCost = mode.additional_kg_cost_rmb ?? 0;
  const extraWeightKg = Math.max(totalWeightKg - 1, 0);
  const billedAdditionalKg = extraWeightKg > 0 ? Math.ceil(extraWeightKg) : 0;

  return firstKgCost + billedAdditionalKg * additionalKgCost;
}

export default function CartPage() {
  const { items, subtotal, totalWeightKg, removeItem, updateQty, clearCart } = useCart();
  const [shippingModes, setShippingModes] = useState<ShippingMode[]>([]);
  const [selectedShippingModeId, setSelectedShippingModeId] = useState<number | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [showWeightBreakdown, setShowWeightBreakdown] = useState(false);
  const boxWeightKg = useMemo(() => getBoxWeightKg(totalWeightKg), [totalWeightKg]);
  const shipmentWeightKg = useMemo(() => totalWeightKg + boxWeightKg, [boxWeightKg, totalWeightKg]);

  useEffect(() => {
    if (!API_BASE_URL) {
      setShippingError("Missing API base URL.");
      return;
    }

    const fetchShippingModes = async () => {
      setShippingError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/shipping/costs`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const nextModes = Array.isArray(data) ? data : [];
        setShippingModes(nextModes);
        setSelectedShippingModeId((prev) => prev ?? nextModes[0]?.id ?? null);
      } catch (error: unknown) {
        setShippingModes([]);
        setShippingError(error instanceof Error ? error.message : "Failed to load shipping.");
      }
    };

    fetchShippingModes();
  }, []);

  const shippingOptions = useMemo(() => {
    return shippingModes
      .map((mode) => {
        const shippingCostRmb = calculateShippingCostRmb(shipmentWeightKg, mode);
        return {
          ...mode,
          shippingCostUsd: shippingCostRmb * RMB_TO_USD,
        };
      })
      .sort((a, b) => getShippingModeSortOrder(a.mode) - getShippingModeSortOrder(b.mode));
  }, [shipmentWeightKg, shippingModes]);

  const selectedShippingOption = useMemo(() => {
    return shippingOptions.find((option) => option.id === selectedShippingModeId) ?? null;
  }, [selectedShippingModeId, shippingOptions]);

  const orderTotal = subtotal + (selectedShippingOption?.shippingCostUsd ?? 0);

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
                  priceFractionDigits={2}
                />
              ))}
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold">Order summary</h2>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-zinc-600">Subtotal</span>
                <span className="font-semibold text-zinc-900">{formatUsd(subtotal, 2)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-zinc-600">Shipping weight</span>
                <span className="font-semibold text-zinc-900">{shipmentWeightKg.toFixed(2)} kg</span>
              </div>
              <button
                type="button"
                onClick={() => setShowWeightBreakdown((prev) => !prev)}
                className="mt-1 text-xs text-zinc-500 hover:text-zinc-900"
              >
                {showWeightBreakdown ? "Hide weight details" : "Show weight details"}
              </button>
              {showWeightBreakdown ? (
                <>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Clothes weight</span>
                    <span className="font-semibold text-zinc-900">{totalWeightKg.toFixed(2)} kg</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Box weight</span>
                    <span className="font-semibold text-zinc-900">{boxWeightKg.toFixed(2)} kg</span>
                  </div>
                </>
              ) : null}

              <div className="mt-5">
                <div className="text-sm font-medium text-zinc-900">Shipping options</div>
                <div className="mt-3 space-y-2">
                  {shippingOptions.map((option) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-zinc-200 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="shipping-mode"
                          checked={option.id === selectedShippingModeId}
                          onChange={() => setSelectedShippingModeId(option.id)}
                          className="mt-1"
                        />
                        <div>
                          <div className="text-sm font-medium text-zinc-900">
                            {formatShippingMode(option.mode)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            First kg {formatUsd((option.first_kg_cost_rmb ?? 0) * RMB_TO_USD, 2)}
                            {" · "}
                            Additional kg{" "}
                            {formatUsd((option.additional_kg_cost_rmb ?? 0) * RMB_TO_USD, 2)}
                            {option.delivery_time ? ` · ${option.delivery_time}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {formatUsd(option.shippingCostUsd, 2)}
                      </div>
                    </label>
                  ))}

                  {shippingOptions.length === 0 && !shippingError ? (
                    <div className="text-xs text-zinc-500">No shipping options available.</div>
                  ) : null}

                  {shippingError ? (
                    <div className="text-xs text-red-600">{shippingError}</div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="text-zinc-600">Shipping</span>
                <span className="font-semibold text-zinc-900">
                  {formatUsd(selectedShippingOption?.shippingCostUsd ?? 0, 2)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-zinc-600">Order total</span>
                <span className="font-semibold text-zinc-900">{formatUsd(orderTotal, 2)}</span>
              </div>
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
