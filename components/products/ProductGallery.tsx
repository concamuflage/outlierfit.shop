"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";

// ProductGallery shows a main product photo plus a list of thumbnails.
// The user can click thumbnails or use Previous/Next buttons to switch photos.
//
// Props:
// - photos: array of image URLs (strings)
// - alt: alt text for accessibility
// - initialIndex: which photo to show first (default 0)
export type ProductGalleryProps = {
  photos: string[];
  alt: string;
  initialIndex?: number;
};

export default function ProductGallery({ photos, alt, initialIndex = 0 }: ProductGalleryProps) {
  // Defensive: filter out empty/non-string values.
  const safePhotos = useMemo(() => {
    return (Array.isArray(photos) ? photos : [])
      .filter((p) => typeof p === "string")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }, [photos]);

  // Keep track of which photo is currently selected.
  const [selectedIndex, setSelectedIndex] = useState<number>(
    Math.min(Math.max(initialIndex, 0), Math.max(safePhotos.length - 1, 0))
  );

  // If the photos list changes (e.g. navigating to a different product),
  // ensure the selected index is still valid.
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (safePhotos.length === 0) return 0;
      return Math.min(Math.max(prev, 0), safePhotos.length - 1);
    });
  }, [safePhotos.length]);

  // Optional: allow keyboard navigation with arrow keys.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (safePhotos.length <= 1) return;

      if (e.key === "ArrowLeft") {
        setSelectedIndex((prev) => (prev - 1 + safePhotos.length) % safePhotos.length);
      }
      if (e.key === "ArrowRight") {
        setSelectedIndex((prev) => (prev + 1) % safePhotos.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [safePhotos.length]);

  const mainSrc = safePhotos[selectedIndex];

  const canNavigate = safePhotos.length > 1;

  const goPrev = () => {
    if (!canNavigate) return;
    setSelectedIndex((prev) => (prev - 1 + safePhotos.length) % safePhotos.length);
  };

  const goNext = () => {
    if (!canNavigate) return;
    setSelectedIndex((prev) => (prev + 1) % safePhotos.length);
  };

  // If we have no photos, show a simple placeholder box.
  if (safePhotos.length === 0) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-6">
        <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-zinc-100 text-sm text-zinc-600">
          No images
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[96px_1fr]">
      {/* Thumbnails: left column on desktop, horizontal row on mobile */}
      <div className="order-2 flex gap-3 overflow-auto md:order-1 md:flex-col md:overflow-visible">
        {safePhotos.map((src, idx) => {
          const isActive = idx === selectedIndex;

          return (
            <button
              key={`${src}-${idx}`}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={
                "relative h-20 w-20 flex-none overflow-hidden rounded-2xl border bg-white " +
                (isActive ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-400")
              }
              aria-label={`View photo ${idx + 1}`}
            >
              <Image
                src={src}
                alt={alt}
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          );
        })}
      </div>

      {/* Main image */}
      <div className="order-1 md:order-2">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white">
          <div className="relative aspect-square w-full">
            <Image
              src={mainSrc}
              alt={alt}
              fill
              sizes="(min-width: 768px) 600px, 100vw"
              className="object-cover"
              priority
            />
          </div>

          {/* Navigation buttons (only shown if there is more than one image) */}
          {canNavigate ? (
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button
                type="button"
                onClick={goPrev}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm hover:border-zinc-400"
                aria-label="Previous photo"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={goNext}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm hover:border-zinc-400"
                aria-label="Next photo"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>

        {/* Small helper text */}
        {canNavigate ? (
          <div className="mt-2 text-xs text-zinc-600">
            Photo {selectedIndex + 1} of {safePhotos.length}
          </div>
        ) : null}
      </div>
    </div>
  );
}
