"use client";

import { useState } from "react";
import clsx from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Badge from "@/components/ui/Badge";
import Rating from "@/components/ui/Rating";
import Price from "@/components/ui/Price";
import { lt } from "@/lib/format";
import { productColors } from "@/lib/product";
import type { Locale, Product } from "@/lib/types";

export default function ProductCard({
  product,
  categorySlug,
}: {
  product: Product;
  /** Category being browsed; carried to the product page so it shows the same images. */
  categorySlug?: string;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("product");

  const colors = productColors(product);
  // Which color is being previewed on the card (hover on desktop, tap on mobile).
  const [activeHex, setActiveHex] = useState<string | null>(null);

  const mainImage = product.images[0];
  const colorImage = activeHex
    ? product.images.find((i) => i.color?.trim().toLowerCase() === activeHex)
    : undefined;
  const current = colorImage ?? mainImage;
  // Generic second-image hover, only when a color isn't being previewed.
  const hoverImage = product.images[1];

  const badgeLabel: Record<string, string> = {
    new: t("new"),
    "best-seller": t("bestSeller"),
    sale: t("sale"),
  };

  return (
    <div className="group relative border-t-2 border-transparent transition-[border-color,translate,box-shadow] duration-300 hover:border-brand hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-colors motion-reduce:hover:translate-y-0">
      <div className="relative aspect-[3/4] overflow-hidden bg-surface">
        {current && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={lt(product.name, locale)}
            className="h-full w-full object-cover transition-[opacity,scale] duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
          />
        )}
        {hoverImage && !activeHex && !colorImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hoverImage.url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-[opacity,scale] duration-500 group-hover:opacity-100 group-hover:scale-105 motion-reduce:group-hover:scale-100"
          />
        )}
        <div className="absolute top-2 start-2 flex flex-col items-start gap-1">
          {product.badges.map((b) => (
            <Badge key={b} variant={b}>
              {badgeLabel[b]}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 py-3">
        {colors.length > 0 && (
          <div
            className="relative z-20 flex items-center gap-1.5"
            onMouseLeave={() => setActiveHex(null)}
          >
            {colors.map((c) => (
              <button
                key={c.hex}
                type="button"
                onMouseEnter={() => setActiveHex(c.hex.toLowerCase())}
                onClick={(e) => {
                  // On touch devices there is no hover — a tap previews the
                  // color; keep the card link from firing.
                  e.preventDefault();
                  const hex = c.hex.toLowerCase();
                  setActiveHex((prev) => (prev === hex ? null : hex));
                }}
                aria-label={lt(c.name, locale)}
                title={lt(c.name, locale)}
                className={clsx(
                  "h-4 w-4 rounded-full border transition-transform hover:scale-125 cursor-pointer",
                  activeHex === c.hex.toLowerCase()
                    ? "border-brand ring-1 ring-brand"
                    : "border-navy/20"
                )}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        )}
        <h3 className="text-sm font-bold uppercase tracking-wide text-navy group-hover:text-brand transition-colors">
          {lt(product.name, locale)}
        </h3>
        <Rating value={product.ratingAvg} count={product.ratingCount} />
        <Price
          basePrice={product.basePrice}
          salePrice={product.salePrice}
          locale={locale}
          size="sm"
        />
      </div>

      {/* Stretched link makes the whole card clickable while the color swatches
          above (higher z-index) stay independently interactive. */}
      <Link
        href={
          categorySlug && product.categories.includes(categorySlug)
            ? `/product/${product.slug}?category=${encodeURIComponent(categorySlug)}`
            : `/product/${product.slug}`
        }
        aria-label={lt(product.name, locale)}
        className="absolute inset-0 z-10"
      />
    </div>
  );
}
