"use client";

import React, { useEffect, useMemo, useState } from "react";
import FilterSidebar from "@/components/products/FilterSidebar";
import ProductGrid from "@/components/products/ProductGrid";
import { type Product } from "@/components/products/ProductCard";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");
}

const RMB_TO_USD = Number(process.env.NEXT_PUBLIC_RMB_TO_USD ?? "0.14");

type ProductsApiItem = {
  product_id?: number | string | null;
  id?: number | string | null;
  name?: string | null;
  brand?: string | null;
  style?: string | null;
  photos?: string[] | null;
  colors?: string[] | null;
  lowest_cost_rmb?: number | string | null;
};

export default function ProductsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [productsData, setProductsData] = useState<ProductsApiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/products`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setProductsData(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load products");
        setProductsData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const categories = useMemo(() => {
    const styles = new Set<string>();
    for (const p of productsData) {
      if (typeof p?.style === "string" && p.style.trim()) {
        styles.add(p.style.trim());
      }
    }
    return Array.from(styles).sort((a, b) => a.localeCompare(b));
  }, [productsData]);

  useEffect(() => {
    if (selectedCategory !== null && !categories.includes(selectedCategory)) {
      setSelectedCategory(null);
    }
  }, [categories, selectedCategory]);

  const filteredProductsData = useMemo(() => {
    if (selectedCategory === null) return productsData;
    return productsData.filter((p) => p?.style === selectedCategory);
  }, [productsData, selectedCategory]);

  const products = useMemo<Product[]>(() => {
    return filteredProductsData.map((p) => ({
      slug: String(p.product_id ?? p.id ?? ""),
      name: p.name ?? "",
      brand: p.brand ?? "",
      imageUrl: Array.isArray(p.photos) ? (p.photos[0] ?? "") : "",
      colors: Array.isArray(p.colors) ? p.colors : [],
      price: p.lowest_cost_rmb == null ? 0 : Number(p.lowest_cost_rmb) * RMB_TO_USD,
    }));
  }, [filteredProductsData]);

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
            categories={categories}
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
