"use client";

import { formatUsd } from "@/lib/formatters";
import { DOMESTIC_SHIPPING_FEE_USD } from "@/lib/domestic-shipping";

type OrderSummaryProps = {
  subtotal: number;
  testIdPrefix?: string;
  legacySubtotalTestId?: string;
  title?: string;
};

/** Shows a flat US fee instead of weight/rate choices; $49.90 + $8.95 totals $58.85. */
export default function OrderSummary({
  subtotal, testIdPrefix, legacySubtotalTestId, title = "Order summary",
}: OrderSummaryProps) {
  return (
    <>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-zinc-600">Subtotal</span>
        <span data-testid={testIdPrefix ? `${testIdPrefix}-summary-subtotal` : undefined} className="font-semibold text-zinc-900">
          {legacySubtotalTestId ? <span data-testid={legacySubtotalTestId}>{formatUsd(subtotal, 2)}</span> : formatUsd(subtotal, 2)}
        </span>
      </div>
      <div className="mt-5 flex items-center justify-between text-sm">
        <span className="text-zinc-600">US shipping (flat rate)</span>
        <span data-testid={testIdPrefix ? `${testIdPrefix}-summary-shipping` : undefined} className="font-semibold text-zinc-900">
          {formatUsd(DOMESTIC_SHIPPING_FEE_USD, 2)}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-zinc-600">Order total</span>
        <span data-testid={testIdPrefix ? `${testIdPrefix}-summary-order-total` : undefined} className="font-semibold text-zinc-900">
          {formatUsd(subtotal + DOMESTIC_SHIPPING_FEE_USD, 2)}
        </span>
      </div>
    </>
  );
}
