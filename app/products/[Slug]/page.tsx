"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProductGallery from "@/components/products/ProductGallery";

// Backend response shape for GET /products/:id
// This matches the JSON you showed.
type ApiMaterial = {
  material: string;
  percentage: number;
};

type ApiProduct = {
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
  images: string[];
  materials: ApiMaterial[];
};

// In the Next.js App Router, a dynamic route like app/products/[slug]/page.tsx
// receives the URL parameter via `params`.
// Example: /products/1 -> params.slug === "1"
export default function ProductDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  // Prefer the env var if set; otherwise build a sensible default based on the current host.
  // This avoids hardcoding "localhost".
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (typeof window !== "undefined" ? `http://${window.location.hostname}:4000` : "");

  // RMB -> USD conversion factor (you can override in .env.local)
  const RMB_TO_USD = Number(process.env.NEXT_PUBLIC_RMB_TO_USD ?? "0.14");

  const slug = params.slug;

  // Local state for the product details.
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the product details when the page loads OR when the slug changes.
  useEffect(() => {
    const fetchProduct = async () => {
      if (!API_BASE_URL) {
        setError(
          "Missing API base URL. Set NEXT_PUBLIC_API_BASE_URL in your frontend .env.local."
        );
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as ApiProduct;
        setProduct(data);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load product");
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [API_BASE_URL, slug]);

  // Convert price from RMB to USD, ensuring we handle string values like "229.00".
  const priceUsdText = useMemo(() => {
    if (!product) return "";

    const rmb = product.cost_rmb == null ? 0 : Number(product.cost_rmb);
    const usd = rmb * RMB_TO_USD;

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(usd);
  }, [product, RMB_TO_USD]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/products" className="text-lg font-semibold tracking-tight">
            Project888
          </Link>
          <nav className="text-sm text-zinc-600">
            <Link href="/products" className="hover:text-zinc-900">
              Shop
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Loading / error states */}
        {loading ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}

        {/* Product UI */}
        {product ? (
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            {/* Left: image gallery */}
            <div>
              <ProductGallery photos={product.images ?? []} alt={product.name} />
            </div>

            {/* Right: product info */}
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
                  <span className="text-zinc-500">Stock:</span>{" "}
                  {product.qty == null ? "Unknown" : product.qty}
                </div>
              </div>

              {/* Measurements */}
              <div className="mt-8">
                <h2 className="text-base font-medium">Measurements</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-xs text-zinc-500">Height (cm)</div>
                    <div className="mt-1 font-medium">
                      {product.height_cm == null ? "—" : product.height_cm}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-xs text-zinc-500">Chest (cm)</div>
                    <div className="mt-1 font-medium">
                      {product.chest_cm == null ? "—" : product.chest_cm}
                    </div>
                  </div>
                </div>
              </div>

              {/* Materials */}
              <div className="mt-8">
                <h2 className="text-base font-medium">Materials</h2>
                {Array.isArray(product.materials) && product.materials.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm">
                    {product.materials.map((m, idx) => (
                      <li
                        key={`${m.material}-${idx}`}
                        className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3"
                      >
                        <span className="text-zinc-900">{m.material}</span>
                        <span className="text-zinc-600">{m.percentage}%</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2 text-sm text-zinc-600">No materials listed.</div>
                )}
              </div>

              {/* Description */}
              <div className="mt-8">
                <h2 className="text-base font-medium">Description</h2>
                <p className="mt-2 text-sm text-zinc-700">{product.description}</p>
              </div>

              <div className="mt-10">
                <Link
                  href="/products"
                  className="text-sm font-medium text-zinc-900 underline underline-offset-4"
                >
                  Back to shop
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-zinc-600">
          <div>Project888</div>
          <div className="mt-1">© {new Date().getFullYear()} All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}