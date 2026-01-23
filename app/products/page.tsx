"use client"; 
// "use client" directive tells Next.js that this file is a Client Component, meaning it will be rendered on the client side and can use React hooks like useState and useEffect.

// Import necessary React hooks and components
import React, { useEffect, useMemo, useState } from "react";
import FilterSidebar from "@/components/products/FilterSidebar";
import ProductGrid from "@/components/products/ProductGrid";
import { type Product } from "@/components/products/ProductCard";

// Define available product categories for filtering
const CATEGORIES = ["Long Sleeve T-Shirt", "Jackets"];

// Base URL for API requests, loaded from environment variables
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");
}

// Conversion rate from RMB to USD, loaded from environment variables
// This is used to convert prices from RMB to USD by multiplying RMB price by this rate.
const RMB_TO_USD = Number(process.env.NEXT_PUBLIC_RMB_TO_USD ?? "0.14");

export default function ProductsPage() {
  // State to keep track of the currently selected category filter
  // useState<string | null> means the state can hold either a string or null.
  // The generic type parameter <string | null> tells TypeScript what type of value this state holds.
  // The union type 'string | null' means the value can be either a string or null (no category selected).
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // State to hold the raw product data fetched from the backend API
  // Using any[] here means this is an array of any type of objects.
  // This is not ideal because it disables type checking for the product data.
  // Ideally, we would define a specific type/interface for the product data.
  const [productsData, setProductsData] = useState<any[]>([]);

  // State to indicate whether the product data is currently being loaded
  const [loading, setLoading] = useState(false);

  // State to store any error messages encountered during data fetching
  const [error, setError] = useState<string | null>(null);

  // useEffect runs side effects after the component renders.
  // Here, it fetches product data whenever the selectedCategory changes.
  // The dependency array [selectedCategory] means this effect runs whenever selectedCategory changes.
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        // encodeURIComponent safely encodes the selectedCategory string to be used in a URL,
        // escaping characters that could break the URL.
        const url =
          selectedCategory === null
            ? `${API_BASE_URL}/products`
            : `${API_BASE_URL}/products/styles/${encodeURIComponent(selectedCategory)}`;

        const res = await fetch(url);
        // res.ok is true if the HTTP status code is in the 200-299 range, indicating success.
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

  // useMemo memoizes the computed products array to avoid recalculating on every render
  // It only recalculates when selectedCategory or productsData change.
  // We use it here to efficiently map backend product data to the shape expected by ProductCard components.
  const products = useMemo(() => {
    return productsData.map((p) => ({
      slug: String(p.product_id),
      name: p.name,
      brand: p.brand,
      // Array.isArray checks if photos or images are arrays before accessing the first element to avoid errors.
      imageUrl: p.photos[0],
      colors: p.colors,
      // Convert price from RMB to USD by multiplying the RMB price by RMB_TO_USD conversion rate.
      price: p.lowest_cost_rmb * RMB_TO_USD,
    }));
  }, [selectedCategory, productsData]);

  // Render the product page including the filter sidebar and product grid
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
                Showing{" "}
                <span className="font-medium text-zinc-900">{products.length}</span> item
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
