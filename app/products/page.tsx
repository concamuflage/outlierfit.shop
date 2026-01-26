"use client";

import React, { useEffect, useMemo, useState } from "react";
import FilterSidebar from "@/components/products/FilterSidebar";
import ProductGrid from "@/components/products/ProductGrid";
import { type Product } from "@/components/products/ProductCard";

const CATEGORIES = ["Long Sleeve T-Shirt", "Jackets"];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");
}

const RMB_TO_USD = Number(process.env.NEXT_PUBLIC_RMB_TO_USD ?? "0.14");

export default function ProductsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const url =
          selectedCategory === null
            ? `${API_BASE_URL}/products`
            : `${API_BASE_URL}/products/styles/${encodeURIComponent(selectedCategory)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setProductsData(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load products");
        setProductsData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategory]);

  const products = useMemo<Product[]>(() => {
    return productsData.map((p) => ({
      slug: String(p.product_id ?? p.id ?? ""),
      name: p.name,
      brand: p.brand,
      imageUrl: Array.isArray(p.photos) ? p.photos[0] : "",
      colors: Array.isArray(p.colors) ? p.colors : [],
      price: p.lowest_cost_rmb == null ? 0 : Number(p.lowest_cost_rmb) * RMB_TO_USD,
    }));
  }, [productsData]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Shop</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Curated picks with better proportions for shorter frames.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[280px_1fr]">
          <FilterSidebar
            categories={CATEGORIES}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-zinc-600">
                Showing <span className="font-medium text-zinc-900">{products.length}</span> item
                {products.length === 1 ? "" : "s"}
                {selectedCategory ? (
                  <>
                    {" "}
                    in <span className="font-medium text-zinc-900">{selectedCategory}</span>
                  </>
                ) : null}
              </div>
            </div>

            {loading ? <div className="mb-4 text-sm text-zinc-600">Loading...</div> : null}
            {error ? <div className="mb-4 text-sm text-red-600">{error}</div> : null}

            <ProductGrid products={products} />
          </div>
        </div>
      </main>
    </div>
  );
}
