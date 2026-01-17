"use client";

import React, { useMemo, useState } from "react";
import FilterSidebar from "@/components/products/FilterSidebar";
import ProductGrid from "@/components/products/ProductGrid";
import { type Product } from "@/components/products/ProductCard";

const CATEGORIES = ["Long-Sleeve Tees", "Jackets",""];

const PRODUCTS: Array<Product & { category: string }> = [
  {
    slug: "nike-club-tee",
    name: "Nike Club Tee",
    brand: "Nike",
    price: 29,
    imageUrl: "/images/nike-club-tee.jpg",
    fitNote: "Not too long; good everyday tee",
    tags: ["Regular fit", "Soft cotton", "Easy layering"],
    category: "Tops",
  },
  {
    slug: "adidas-essentials-hoodie",
    name: "Adidas Essentials Hoodie",
    brand: "Adidas",
    price: 55,
    imageUrl: "/images/adidas-hoodie.jpg",
    fitNote: "Clean proportions; sleeves run shorter",
    tags: ["Cozy", "Streetwear", "Everyday"],
    category: "Tops",
  },
  {
    slug: "uniqlo-smart-ankle-pants",
    name: "Smart Ankle Pants",
    brand: "Uniqlo",
    price: 49,
    imageUrl: "/images/ankle-pants.jpg",
    fitNote: "Ankle length works well for shorter inseams",
    tags: ["Office", "Stretch", "Slim taper"],
    category: "Bottoms",
  },
  {
    slug: "nike-club-joggers",
    name: "Nike Club Joggers",
    brand: "Nike",
    price: 59,
    imageUrl: "/images/nike-joggers.jpg",
    fitNote: "Tapered leg; easy to cuff",
    tags: ["Tapered", "Casual", "Fleece"],
    category: "Bottoms",
  },
  {
    slug: "bombers-minimal-jacket",
    name: "Minimal Bomber Jacket",
    brand: "Curated",
    price: 89,
    imageUrl: "/images/bomber.jpg",
    fitNote: "Shorter hem and sleeves",
    tags: ["Outerwear", "Minimal", "Layering"],
    category: "Outerwear",
  },
  {
    slug: "new-balance-530",
    name: "New Balance 530",
    brand: "New Balance",
    price: 99,
    imageUrl: "/images/nb-530.jpg",
    fitNote: "Chunky silhouette; versatile styling",
    tags: ["Everyday", "Comfort", "Sneakers"],
    category: "Shoes",
  },
];

export default function ProductsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const products = useMemo(() => {
    if (!selectedCategory) return PRODUCTS;
    return PRODUCTS.filter((p) => p.category === selectedCategory);
  }, [selectedCategory]);

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
                    {" "}in <span className="font-medium text-zinc-900">{selectedCategory}</span>
                  </>
                ) : null}
              </div>
            </div>

            <ProductGrid products={products} />
          </div>
        </div>
      </main>

    </div>
  );
}
