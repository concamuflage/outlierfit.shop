"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

function getPreferredCoverPhoto(photos: string[] | null | undefined) {
  if (!Array.isArray(photos)) return "";

  const cleanedPhotos = photos
    .filter((photo): photo is string => typeof photo === "string")
    .map((photo) => photo.trim())
    .filter((photo) => photo.length > 0);

  const preferredPhoto = cleanedPhotos.find((photo) => {
    const fileName = photo.split("/").pop() ?? "";
    const baseName = fileName.replace(/\.[^.]+$/, "");
    return baseName === "1";
  });

  return preferredPhoto ?? cleanedPhotos[0] ?? "";
}

export default function ProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  const categoryFromUrl = searchParams.get("category");
  const selectedCategory =
    categoryFromUrl && categories.includes(categoryFromUrl) ? categoryFromUrl : null;

  const handleSelectCategory = (category: string | null) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (category === null) {
      nextParams.delete("category");
    } else {
      nextParams.set("category", category);
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (categoryFromUrl === null) return;
    if (categories.length === 0) return;
    if (categories.includes(categoryFromUrl)) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("category");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [categories, categoryFromUrl, pathname, router, searchParams]);

  const filteredProductsData = useMemo(() => {
    if (selectedCategory === null) return productsData;
    return productsData.filter((p) => p?.style === selectedCategory);
  }, [productsData, selectedCategory]);

  const products = useMemo<Product[]>(() => {
    return filteredProductsData.map((p) => ({
      slug: String(p.product_id ?? p.id ?? ""),
      name: p.name ?? "",
      brand: p.brand ?? "",
      imageUrl: getPreferredCoverPhoto(p.photos),
      colors: Array.isArray(p.colors) ? p.colors : [],
      price: p.lowest_cost_rmb == null ? 0 : Number(p.lowest_cost_rmb) * RMB_TO_USD,
    }));
  }, [filteredProductsData]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[280px_1fr]">
          <FilterSidebar
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
          />

          <div>
            {loading ? <div className="mb-4 text-sm text-zinc-600">Loading...</div> : null}
            {error ? <div className="mb-4 text-sm text-red-600">{error}</div> : null}

            <ProductGrid products={products} />
          </div>
        </div>
      </main>
    </div>
  );
}
