"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import clsx from "clsx";
import Rating from "@/components/ui/Rating";
import Price from "@/components/ui/Price";
import Accordion from "@/components/ui/Accordion";
import ProductGallery from "@/components/product/ProductGallery";
import { lt } from "@/lib/format";
import { orderSizes, productColors } from "@/lib/product";
import type { Locale, Product } from "@/lib/types";

// A full product view (gallery + details + color/size) for use inside a
// collection — same as the product page but with no per-product add-to-cart,
// and it reports the chosen variant up to the collection. Nothing is selected
// by default; the customer must pick.
export default function CollectionProductView({
  product,
  onSelectVariant,
  highlight,
}: {
  product: Product;
  onSelectVariant: (variantId: string | undefined) => void;
  highlight: boolean;
}) {
  const t = useTranslations("product");
  const locale = useLocale() as Locale;
  const ar = locale === "ar";

  const colors = useMemo(() => productColors(product), [product]);
  const singleColor = colors.length <= 1;
  const [activeColorHex, setActiveColorHex] = useState<string | null>(
    singleColor ? colors[0]?.hex ?? null : null
  );
  const [previewHex, setPreviewHex] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);

  const normColor = activeColorHex?.trim().toLowerCase();
  const sizesForColor = useMemo(() => {
    const vs = product.variants.filter(
      (v) => v.color.hex.trim().toLowerCase() === normColor
    );
    return orderSizes(vs.map((v) => v.size)).map((s) => ({
      size: s,
      stock: vs.find((v) => v.size === s)?.stock ?? 0,
    }));
  }, [product.variants, normColor]);

  const variant = product.variants.find(
    (v) => v.color.hex.trim().toLowerCase() === normColor && v.size === size
  );
  const priceOverride = variant?.priceOverride ?? null;

  const pickColor = (hex: string) => {
    setActiveColorHex(hex);
    setSize(null);
    onSelectVariant(undefined);
  };
  const pickSize = (s: string) => {
    setSize(s);
    const v = product.variants.find(
      (x) => x.color.hex.trim().toLowerCase() === normColor && x.size === s
    );
    onSelectVariant(v?.id);
  };

  const salePercent =
    product.salePrice != null &&
    product.basePrice > 0 &&
    product.salePrice < product.basePrice
      ? Math.round(100 - (product.salePrice / product.basePrice) * 100)
      : undefined;

  const fabric = lt(product.fabricCare.fabric, locale);
  const care = lt(product.fabricCare.care, locale);
  const fabricCareContent =
    fabric || care ? (
      <div className="space-y-2">
        {fabric && (
          <p>
            <span className="font-bold text-navy">{t("fabric")}:</span> {fabric}
          </p>
        )}
        {care && (
          <p>
            <span className="font-bold text-navy">{t("care")}:</span> {care}
          </p>
        )}
      </div>
    ) : (
      t("fabricCareBody")
    );

  return (
    <div
      className={clsx(
        "grid gap-8 border-2 p-4 md:p-6 lg:grid-cols-2",
        highlight && !variant ? "border-brand" : "border-navy/10"
      )}
    >
      <ProductGallery
        images={product.images}
        alt={lt(product.name, locale)}
        saleLabel={salePercent ? `-${salePercent}%` : undefined}
        colorHex={previewHex ?? activeColorHex ?? colors[0]?.hex}
      />

      <div>
        <h2 className="font-display uppercase leading-[0.95] text-3xl md:text-4xl text-navy">
          {lt(product.name, locale)}
        </h2>
        <div className="mt-2">
          <Rating value={product.ratingAvg} count={product.ratingCount} size={16} />
        </div>
        <Price
          basePrice={product.basePrice}
          salePrice={product.salePrice}
          priceOverride={priceOverride}
          locale={locale}
          size="lg"
          className="mt-3"
        />

        {!singleColor && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-bold uppercase tracking-wide text-navy">
              {t("color")}
            </p>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onMouseEnter={() => setPreviewHex(c.hex)}
                  onMouseLeave={() => setPreviewHex(null)}
                  onClick={() => pickColor(c.hex)}
                  aria-label={lt(c.name, locale)}
                  aria-pressed={c.hex === activeColorHex}
                  className={clsx(
                    "h-9 w-9 rounded-full border-2 p-0.5 cursor-pointer",
                    c.hex === activeColorHex ? "border-brand" : "border-navy/20"
                  )}
                >
                  <span
                    className="block h-full w-full rounded-full"
                    style={{ backgroundColor: c.hex }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <p className="mb-2 text-sm font-bold uppercase tracking-wide text-navy">
            {t("size")}
          </p>
          {!activeColorHex ? (
            <p className="text-xs text-muted">
              {ar ? "اختر اللون أولاً" : "Choose a color first"}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sizesForColor.map(({ size: s, stock }) => {
                const out = stock === 0;
                const active = size === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={out}
                    onClick={() => pickSize(s)}
                    className={clsx(
                      "h-12 min-w-12 border-2 px-3 text-sm font-extrabold uppercase transition-colors cursor-pointer",
                      active
                        ? "border-navy bg-navy text-white"
                        : "border-navy/20 text-navy hover:border-navy",
                      out && "cursor-not-allowed border-navy/10 text-navy/30"
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Accordion
          className="mt-8 border-t border-navy/10"
          items={[
            { title: t("description"), content: lt(product.description, locale) },
            { title: t("fabricCare"), content: fabricCareContent },
          ]}
        />
      </div>
    </div>
  );
}
