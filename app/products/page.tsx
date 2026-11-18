"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterSidebar from "@/components/products/FilterSidebar";
import ProductGrid from "@/components/products/ProductGrid";
import { type Product } from "@/components/products/ProductCard";
import { CLIENT_API_BASE_PATH } from "@/lib/api-base";

type ProductsApiItem = {
  product_id?: number | string | null;
  id?: number | string | null;
  name?: string | null;
  brand?: string | null;
  style?: string | null;
  photos?: string[] | null;
  colors?: string[] | null;
  lowest_price_usd?: number | string | null;
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

/**
 * Renders the catalog with category filtering and no brand selector.
 * Retired brand URLs are cleaned up, for example /products?brand=Nike becomes /products.
 * Recorded USD prices are passed through unchanged, e.g. 19.90 displays as $19.90.
 */
function ProductsPageContent() {
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
        const res = await fetch(`${CLIENT_API_BASE_PATH}/products`);
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
    const nextParams = new URLSearchParams(searchParams.toString());
    // Clean up brand and invalid-category parameters together to avoid competing redirects.
    nextParams.delete("brand");
    if (categoryFromUrl !== null && categories.length > 0 && !categories.includes(categoryFromUrl)) {
      nextParams.delete("category");
    }

    const nextQuery = nextParams.toString();
    if (nextQuery === searchParams.toString()) return;

    const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(`${nextPath}${window.location.hash}`, { scroll: false });
  }, [categories, categoryFromUrl, pathname, router, searchParams]);

  const filteredProductsData = useMemo(() => {
    return productsData.filter((p) => selectedCategory === null || p?.style === selectedCategory);
  }, [productsData, selectedCategory]);

  const products = useMemo<Product[]>(() => {
    return filteredProductsData.map((p) => ({
      slug: String(p.product_id ?? p.id ?? ""),
      name: p.name ?? "",
      brand: p.brand ?? "",
      imageUrl: getPreferredCoverPhoto(p.photos),
      colors: Array.isArray(p.colors) ? p.colors : [],
      price: p.lowest_price_usd == null ? null : Number(p.lowest_price_usd),
    }));
  }, [filteredProductsData]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] lg:gap-8">
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

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsPageContent />
    </Suspense>
  );
}
