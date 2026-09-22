"use client";

import { useState } from "react";
import clsx from "clsx";
import Badge from "@/components/ui/Badge";
import type { ProductImage } from "@/lib/types";

export default function ProductGallery({
  images,
  alt,
  saleLabel,
  colorHex,
}: {
  images: ProductImage[];
  alt: string;
  saleLabel?: string;
  /** When set, the gallery jumps to the first image tagged with this color. */
  colorHex?: string;
}) {
  // A manual thumbnail click overrides the color-driven image until the color
  // changes again. Resetting on color change happens during render (the
  // endorsed "adjust state when a prop changes" pattern) — no effect needed.
  const [manualIndex, setManualIndex] = useState<number | null>(null);
  const [prevColor, setPrevColor] = useState(colorHex);
  if (colorHex !== prevColor) {
    setPrevColor(colorHex);
    setManualIndex(null);
  }

  const colorIndex = colorHex
    ? images.findIndex((img) => img.color === colorHex)
    : -1;
  const active = manualIndex ?? (colorIndex >= 0 ? colorIndex : 0);
  const current = images[active] ?? images[0];

  return (
    // self-start: don't stretch to the taller info column in the product grid,
    // so the image box hugs the image height instead of leaving empty space.
    <div className="flex gap-3 self-start">
      {images.length > 1 && (
        <div className="flex flex-col gap-2">
          {images.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              onClick={() => setManualIndex(i)}
              className={clsx(
                "h-16 w-16 shrink-0 border-2 bg-surface cursor-pointer",
                i === active ? "border-brand" : "border-transparent"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="relative flex-1 bg-surface">
        {saleLabel && (
          <div className="absolute top-3 start-3 z-10">
            <Badge variant="sale">{saleLabel}</Badge>
          </div>
        )}
        {current && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={alt}
            // No fixed ratio: the photo keeps its own proportions instead of
            // being cropped into a square, which made portrait shots look
            // zoomed in.
            className="h-auto w-full object-contain transition-opacity duration-200"
          />
        )}
      </div>
    </div>
  );
}
