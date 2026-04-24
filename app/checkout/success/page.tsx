"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/components/cart/CartContext";

const FINALIZE_RETRY_LIMIT = 6;
const FINALIZE_RETRY_DELAY_MS = 1500;

function CheckoutSuccessPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const orderIdFromUrl = searchParams.get("orderId");
  const stripeSessionId = searchParams.get("session_id");
  const storageKey = stripeSessionId ? `stripe-order:${stripeSessionId}` : null;
  const [orderId, setOrderId] = useState(() => {
    if (orderIdFromUrl) {
      return orderIdFromUrl;
    }
    if (typeof window === "undefined" || !storageKey) {
      return null;
    }
    return window.sessionStorage.getItem(storageKey);
  });
  const [loading, setLoading] = useState(Boolean(stripeSessionId && !orderIdFromUrl));
  const [error, setError] = useState<string | null>(null);
  const finalizedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (orderIdFromUrl) {
      setOrderId(orderIdFromUrl);
      setLoading(false);
      setError(null);
      if (storageKey) {
        window.sessionStorage.setItem(storageKey, orderIdFromUrl);
      }
      return;
    }
    if (typeof window !== "undefined" && storageKey) {
      const storedOrderId = window.sessionStorage.getItem(storageKey);
      if (storedOrderId) {
        setOrderId(storedOrderId);
        setLoading(false);
        setError(null);
      }
    }
  }, [orderIdFromUrl, storageKey]);

  useEffect(() => {
    if (!stripeSessionId || orderIdFromUrl || orderId) {
      return;
    }
    if (finalizedSessionIdRef.current === stripeSessionId) {
      return;
    }

    finalizedSessionIdRef.current = stripeSessionId;

    let cancelled = false;

    async function finalizeOrder() {
      setLoading(true);
      setError(null);
      let attempt = 0;

      while (!cancelled && attempt < FINALIZE_RETRY_LIMIT) {
        const response = await fetch("/api/orders/checkout-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: stripeSessionId }),
        });

        const payload = await response.json().catch(() => null);
        if (cancelled) {
          return;
        }

        if (response.ok && payload?.orderId != null) {
          const nextOrderId = String(payload.orderId);
          setOrderId(nextOrderId);
          if (storageKey) {
            window.sessionStorage.setItem(storageKey, nextOrderId);
          }
          clearCart();
          setLoading(false);
          router.replace(`/checkout/success?orderId=${encodeURIComponent(nextOrderId)}`);
          return;
        }

        if (payload?.status === "failed") {
          setError(payload?.error ?? "Payment failed. Please try again.");
          setLoading(false);
          return;
        }

        if (response.status !== 409) {
          setError(payload?.error ?? "Unable to finalize your order after payment.");
          setLoading(false);
          return;
        }

        attempt += 1;
        if (attempt < FINALIZE_RETRY_LIMIT) {
          await new Promise((resolve) => window.setTimeout(resolve, FINALIZE_RETRY_DELAY_MS));
        }
      }

      if (!cancelled) {
        setError("Payment is still being confirmed. Refresh this page in a moment if your invoice does not appear.");
        setLoading(false);
      }
    }

    void finalizeOrder();

    return () => {
      cancelled = true;
    };
  }, [clearCart, orderId, orderIdFromUrl, router, storageKey, stripeSessionId]);

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
          {loading ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              Confirming payment
            </div>
          ) : null}

          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Thank you for your order.</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            {loading
              ? "Your payment succeeded. We are waiting for Stripe to confirm the order and prepare your invoice."
              : "Your payment was recorded successfully. We saved your order and your invoice is ready to download."}
          </p>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {invoiceHref && !loading && !error ? (
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

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutSuccessPageContent />
    </Suspense>
  );
}
