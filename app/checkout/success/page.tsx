"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const invoiceHref = useMemo(() => {
    if (!orderId) {
      return null;
    }
    return `/api/profile/orders/${encodeURIComponent(orderId)}/invoice/pdf`;
  }, [orderId]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Payment successful
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Thank you for your order.</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Your payment was recorded successfully. We saved your order and your invoice is ready to download.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {invoiceHref ? (
              <a
                href={invoiceHref}
                className="rounded-full bg-zinc-900 px-5 py-2 text-sm text-white hover:bg-zinc-800"
              >
                Download invoice PDF
              </a>
            ) : null}
            <Link
              href="/profile/orders"
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm text-zinc-700 hover:border-zinc-500 hover:text-zinc-900"
            >
              View order history
            </Link>
            <Link
              href="/products"
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm text-zinc-700 hover:border-zinc-500 hover:text-zinc-900"
            >
              Continue shopping
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
