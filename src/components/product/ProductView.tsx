"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import clsx from "clsx";
import Rating from "@/components/ui/Rating";
import Price from "@/components/ui/Price";
import Accordion from "@/components/ui/Accordion";
import ProductGallery from "@/components/product/ProductGallery";
import ProductPurchase from "@/components/product/ProductPurchase";
import { lt } from "@/lib/format";
import { productColors } from "@/lib/product";
import { PIXEL_CURRENCY, trackPixel } from "@/lib/pixel";
import type { Locale, Product, ShippingReturns } from "@/lib/types";

export default function ProductView({
  product,
  shippingReturns,
}: {
  product: Product;
  shippingReturns: ShippingReturns;
}) {
  const t = useTranslations("product");
  const locale = useLocale() as Locale;

  const colors = useMemo(() => productColors(product), [product]);
  const [activeColorHex, setActiveColorHex] = useState(colors[0]?.hex);
  // Desktop hover preview — falls back to the selected color for the image.
  const [previewHex, setPreviewHex] = useState<string | null>(null);
  const [priceOverride, setPriceOverride] = useState<number | null>(null);

  // Meta Pixel: one ViewContent per product page view.
  const viewPrice = product.salePrice ?? product.basePrice;
  useEffect(() => {
    trackPixel("ViewContent", {
      content_type: "product",
      content_ids: [product.id],
      content_name: product.name.en,
      value: viewPrice,
      currency: PIXEL_CURRENCY,
    });
  }, [product.id, product.name.en, viewPrice]);

  const salePercent =
    product.salePrice !== null &&
    product.salePrice !== undefined &&
    product.basePrice > 0 &&
    product.salePrice < product.basePrice
    ? Math.round(100 - (product.salePrice / product.basePrice) * 100)
    : undefined;

  // Real fabric/care when the admin set it; otherwise the generic fallback copy.
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

  // Shipping & Returns is backend-driven; localize with an English fallback.
  const shippingTitle =
    shippingReturns.title[locale] || shippingReturns.title.en;
  const shippingBody = shippingReturns.body[locale] || shippingReturns.body.en;

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <ProductGallery
        images={product.images}
        alt={lt(product.name, locale)}
        saleLabel={salePercent ? `-${salePercent}%` : undefined}
        colorHex={previewHex ?? activeColorHex}
      />

      <div>
        <h1 className="font-display uppercase leading-[0.92] text-4xl md:text-6xl text-navy">
          {lt(product.name, locale)}
        </h1>
        <div className="mt-3 flex items-center gap-3">
          <Rating value={product.ratingAvg} count={product.ratingCount} size={16} />
        </div>
        <Price
          basePrice={product.basePrice}
          salePrice={product.salePrice}
          priceOverride={priceOverride}
          locale={locale}
          size="lg"
          className="mt-4"
        />

        <div className="mt-8">
          <ProductPurchase
            product={product}
            colors={colors}
            activeColorHex={activeColorHex}
            onSelectColor={setActiveColorHex}
            onHoverColor={setPreviewHex}
            onPriceOverrideChange={setPriceOverride}
          />
        </div>

        <Accordion
          className="mt-10 border-t border-navy/10"
          items={[
            { title: t("description"), content: lt(product.description, locale) },
            { title: t("fabricCare"), content: fabricCareContent },
            // Backend-driven Shipping & Returns — shown only when active and
            // both a title and body are set. Body preserves line breaks.
            ...(shippingReturns.isActive && shippingTitle && shippingBody
              ? [
                  {
                    title: shippingTitle,
                    content: (
                      <div
                        dir={locale === "ar" ? "rtl" : "ltr"}
                        className={clsx(
                          "whitespace-pre-line",
                          locale === "ar" && "text-right"
                        )}
                      >
                        {shippingBody}
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>
    </div>
  );
}
