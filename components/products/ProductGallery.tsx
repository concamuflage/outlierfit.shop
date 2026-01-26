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
    // hard to understand
    // make sure the default value is legit. 
    Math.min(
        Math.max(initialIndex, 0), // if someone passes in -5, this will be 0
        Math.max(safePhotos.length - 1, 0) // if length is 4, this will be 3. if the length is 0, this is will be 0. 
    )
  );

  // If the photos list changes (e.g. navigating to a different product),
  // ensure the selected index is still valid.
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (safePhotos.length === 0) return 0;
      return Math.min(Math.max(prev, 0), safePhotos.length - 1);
    });
  }, [safePhotos.length]);

  // When the requested initial index changes (e.g. color selection),
  // move the main photo to that index if it's in range.
  useEffect(() => {
    if (safePhotos.length === 0) return;
    const nextIndex = Math.min(Math.max(initialIndex, 0), safePhotos.length - 1);
    setSelectedIndex(nextIndex);
  }, [initialIndex, safePhotos.length]);


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

  return (
    // Outer grid layout: single column on mobile, switches to two columns at md breakpoint
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[96px_1fr]">
      {/* 
        Thumbnails container:
        On mobile, it's a horizontal scrollable row to fit many thumbnails in limited width.
        On desktop (md and up), switches to vertical column with visible overflow.
      */}
      <div className="order-2 flex gap-3 overflow-auto md:order-1 md:flex-col md:overflow-visible">
        {/*
          Render thumbnails using .map():
          Iterates over safePhotos array to create a button for each thumbnail.
          This is a common React pattern to render lists dynamically.
        */}
        {safePhotos.map((src, idx) => {
          // isActive indicates if this thumbnail is currently selected
          const isActive = idx === selectedIndex;

          return (
            <button
              key={`${src}-${idx}`} // key prop is required by React to uniquely identify elements in a list for efficient updates
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={
                "relative h-20 w-20 flex-none overflow-hidden rounded-2xl border bg-white " +
                (isActive ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-400")
              }
              aria-label={`View photo ${idx + 1}`} // aria-label improves accessibility by describing button purpose to screen readers
            >
              <Image
                src={src}
                alt={alt}
                fill // Next.js <Image fill /> makes the image fill its parent container, which must have position relative
                sizes="80px" // 'sizes' hints to the browser the image display size for optimization
                className="object-cover"
              />
            </button>
          );
        })}
      </div>

      {/* 
        Main image wrapper:
        Uses aspect-square to keep the container square regardless of width.
        This ensures consistent layout and image aspect ratio.
      */}
      <div className="order-1 md:order-2">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white">
          <div className="relative aspect-square w-full">
            <Image
              src={mainSrc}
              alt={alt}
              fill // fill makes image cover the parent container fully
              sizes="(min-width: 768px) 600px, 100vw" // responsive sizes for different viewport widths
              className="object-cover"
              priority // priority tells Next.js to preload this image for faster loading on initial page load
            />
          </div>

          {/* 
            Conditional rendering of navigation buttons:
            Only show if there is more than one image to navigate through.
          */}
          {canNavigate ? (
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button
                type="button"
                onClick={goPrev}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm hover:border-zinc-400"
                aria-label="Previous photo" // Accessibility label for screen readers
              >
                Prev
              </button>
              <button
                type="button"
                onClick={goNext}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm hover:border-zinc-400"
                aria-label="Next photo" // Accessibility label for screen readers
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
