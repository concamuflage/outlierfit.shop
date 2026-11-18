"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import ProductGallery from "@/components/products/ProductGallery";
import ProductInfoPanel, {
  type ProductInfoPanelProduct,
  type GarmentMeasurements,
} from "@/components/products/ProductInfoPanel";
import { useCart } from "@/components/cart/CartContext";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { CLIENT_API_BASE_PATH } from "@/lib/api-base";

type ProductMaterial = { material: string; percentage: number | null };

type ProductVariant = {
  variant_id: number;
  sku: string;
  color: string;
  size: string;
  height_cm: number | null;
  chest_cm: number | null;
  garment_measurements?: GarmentMeasurements;
  price_usd: number | null;
  weight_kg: number | null;
  qty: number | null;
  images: string[];
};

type ProductDetail = {
  product_id: number;
  name: string;
  description: string;
  brand: string;
  style: string;
  weight_kg: number | null;
  materials: ProductMaterial[];
  variants: ProductVariant[];
};

function productPageTitle(productName: string) {
  return `${productName} | OutlierFit`;
}

// Older catalog data may still contain retired chart images; keep them out of the gallery.
const PRODUCT_SIZE_GUIDE_SUFFIX = "/size-guide.png";

/**
 * Renders product variants, photos, and database-backed garment measurements.
 * For example, selecting SKU 9653 size M displays chest 102 cm / 40.2 in and weight 0.06 kg.
 * Adding that variant to the cart uses its recorded $49.90 USD retail price.
 */
export default function ProductDetailClient({ slug }: { slug: string }) {
  const { addItem, openCart } = useCart();
  const { status } = useSession();
  const { openLoginModal } = useAuthModal();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const productId = useMemo(() => {
    const parsed = Number(slug);
    return Number.isFinite(parsed) ? parsed : null;
  }, [slug]);

  useEffect(() => {
    if (productId == null) {
      setProduct(null);
      setError("Invalid product id");
      return;
    }

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${CLIENT_API_BASE_PATH}/products/${productId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (typeof data !== "object" || data === null || !Array.isArray(data.variants)) {
          setError("Invalid product data");
          setProduct(null);
          return;
        }
        setProduct(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load product");
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  const variants = useMemo(
    () => (product?.variants && Array.isArray(product.variants) ? product.variants : []),
    [product]
  );

  const availableColors = useMemo(() => {
    const s = new Set<string>();
    for (const v of variants) {
      if (typeof v?.color === "string" && v.color.trim()) s.add(v.color);
    }
    return Array.from(s);
  }, [variants]);

  const availableSizes = useMemo(() => {
    const s = new Set<string>();
    for (const v of variants) {
      if (typeof v?.size === "string" && v.size.trim()) s.add(v.size);
    }
    return Array.from(s);
  }, [variants]);

  const lowestPricedVariant = useMemo(() => {
    if (variants.length === 0) return null;

    return variants.reduce<ProductVariant | null>((lowest, variant) => {
      if (lowest == null) return variant;
      const lowestCost = lowest.price_usd == null ? Number.POSITIVE_INFINITY : Number(lowest.price_usd);
      const variantCost = variant.price_usd == null ? Number.POSITIVE_INFINITY : Number(variant.price_usd);
      return variantCost < lowestCost ? variant : lowest;
    }, null);
  }, [variants]);

  const sizesForSelectedColor = useMemo(() => {
    const s = new Set<string>();
    for (const v of variants) {
      if (selectedColor && v.color !== selectedColor) continue;
      if (typeof v?.size === "string" && v.size.trim()) s.add(v.size);
    }
    return Array.from(s);
  }, [variants, selectedColor]);

  const selectedVariant = useMemo(() => {
    if (variants.length === 0) return null;
    if (selectedColor && selectedSize) {
      const exact = variants.find((v) => v.color === selectedColor && v.size === selectedSize);
      if (exact) return exact;
    }
    if (selectedColor || selectedSize) return null;
    return lowestPricedVariant ?? variants[0];
  }, [lowestPricedVariant, variants, selectedColor, selectedSize]);

  const displayVariant = useMemo(() => {
    if (selectedVariant) return selectedVariant;
    if (selectedColor) {
      const byColor = variants.find((v) => v.color === selectedColor);
      if (byColor) return byColor;
    }
    return lowestPricedVariant ?? variants[0] ?? null;
  }, [lowestPricedVariant, variants, selectedColor, selectedVariant]);

  const selectedColorFirstImage = useMemo(() => {
    if (!selectedColor) return null;
    const match = variants.find((v) => v.color === selectedColor && Array.isArray(v.images) && v.images.length > 0);
    if (!match) return null;
    const first = match.images.find((img) => typeof img === "string" && img.trim().length > 0);
    return first ?? null;
  }, [variants, selectedColor]);

  const galleryPhotos = useMemo(() => {
    const allImages = new Set<string>();
    for (const v of variants) {
      const imgs = Array.isArray(v.images) ? v.images : [];
      for (const img of imgs) {
        if (
          typeof img === "string" &&
          img.trim().length > 0 &&
          !img.endsWith(PRODUCT_SIZE_GUIDE_SUFFIX)
        ) {
          allImages.add(img);
        }
      }
    }
    return Array.from(allImages);
  }, [variants]);

  const galleryInitialIndex = useMemo(() => {
    if (!selectedColorFirstImage) return 0;
    const idx = galleryPhotos.indexOf(selectedColorFirstImage);
    return idx >= 0 ? idx : 0;
  }, [galleryPhotos, selectedColorFirstImage]);

  const infoProduct = useMemo<ProductInfoPanelProduct | null>(() => {
    if (!product || !displayVariant) return null;
    return {
      sku: selectedVariant?.sku ?? displayVariant.sku,
      size: selectedSize ?? selectedVariant?.size ?? displayVariant.size,
      height_cm: selectedVariant?.height_cm ?? displayVariant.height_cm,
      chest_cm: selectedVariant?.chest_cm ?? displayVariant.chest_cm,
      garment_measurements: (selectedVariant ?? displayVariant).garment_measurements ?? null,
      weight_kg: displayVariant.weight_kg ?? null,
      description: product.description,
      id: product.product_id,
      name: product.name,
      brand: product.brand,
      style: product.style,
      color: selectedColor ?? selectedVariant?.color ?? displayVariant.color,
      qty: selectedVariant?.qty ?? displayVariant.qty,
      price_usd: (selectedVariant ?? displayVariant).price_usd,
      materials: product.materials ?? [],
    };
  }, [displayVariant, product, selectedColor, selectedSize, selectedVariant]);

  useEffect(() => {
    if (!lowestPricedVariant) return;
    if (selectedColor !== null) return;
    setSelectedColor(lowestPricedVariant.color);
  }, [lowestPricedVariant, selectedColor]);

  useEffect(() => {
    if (!lowestPricedVariant) return;
    if (selectedSize !== null) return;
    setSelectedSize(lowestPricedVariant.size);
  }, [lowestPricedVariant, selectedSize]);

  useEffect(() => {
    if (!product?.name) return;
    document.title = productPageTitle(product.name);
  }, [product?.name]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-600">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        {error}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-600">
        Product not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <ProductGallery
            key={`${product.product_id}-${galleryInitialIndex}-${galleryPhotos.length}`}
            photos={galleryPhotos}
            alt={product.name}
            initialIndex={galleryInitialIndex}
          />

          <div>
            {infoProduct ? (
              <ProductInfoPanel
                product={infoProduct}
                variantControls={
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">Color</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {availableColors.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setSelectedColor(c)}
                            className={
                              "rounded-full border px-4 py-2 text-sm " +
                              (c === selectedColor
                                ? "border-zinc-900 bg-zinc-900 text-white"
                                : "border-zinc-200 bg-white text-zinc-900")
                            }
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-zinc-900">Size</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {availableSizes.map((s) => {
                          const isSelected = s === selectedSize;
                          const isAvailableForColor =
                            selectedColor === null || sizesForSelectedColor.includes(s);
                          return (
                            <div key={s}>
                              <button
                                type="button"
                                onClick={() => setSelectedSize(s)}
                                className={
                                  "w-fit rounded-full border px-4 py-2 text-sm " +
                                  (isSelected
                                    ? "border-zinc-900 bg-zinc-900 text-white"
                                    : isAvailableForColor
                                      ? "border-zinc-200 bg-white text-zinc-900"
                                      : "border-zinc-200 bg-zinc-100 text-zinc-400")
                                }
                              >
                                {s}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                }
              />
            ) : null}
            {infoProduct ? (
              <button
                type="button"
                disabled={!selectedVariant || selectedVariant.price_usd == null || selectedVariant.price_usd <= 0}
                onClick={() => {
                  if (!selectedVariant || selectedVariant.price_usd == null || selectedVariant.price_usd <= 0) return;
                  if (status !== "authenticated") {
                    openLoginModal();
                    return;
                  }
                  addItem({
                    id: `${product.product_id}-${selectedVariant.variant_id}`,
                    name: product.name,
                    price: Number(selectedVariant.price_usd),
                    weightKg: selectedVariant.weight_kg ?? null,
                    imageUrl: galleryPhotos[0] ?? null,
                    color: selectedVariant.color,
                    size: selectedVariant.size,
                    qty: 1,
                  });
                  openCart();
                }}
                className={
                  "mt-6 w-full rounded-full px-4 py-3 text-sm text-white " +
                  (selectedVariant
                    ? "bg-zinc-900 hover:bg-zinc-800"
                    : "cursor-not-allowed bg-zinc-400")
                }
                data-testid="add-to-cart-button"
              >
                {selectedVariant ? "Add to cart" : "Select an available size"}
              </button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
