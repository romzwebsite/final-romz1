"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import clsx from "clsx";
import Rating from "@/components/ui/Rating";
import Price from "@/components/ui/Price";
import Accordion from "@/components/ui/Accordion";
import ProductGallery from "@/components/product/ProductGallery";
import ProductPurchase from "@/components/product/ProductPurchase";
import { lt } from "@/lib/format";
import { orderSizes, productColors } from "@/lib/product";
import {
  PIXEL_CURRENCY,
  isPageReload,
  lastTracked,
  newPixelEventId,
  rememberTracked,
  trackPixel,
  trackPixelAndServer,
} from "@/lib/pixel";
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

  // Meta Pixel + Conversions API: one ViewContent per product page view, for
  // the variant the page opens on (first color, first size in stock) — its SKU
  // is that variant's id in the catalog. A refresh doesn't count as a new view.
  const viewVariant = useMemo(() => {
    const hex = colors[0]?.hex.trim().toLowerCase();
    const ofColor = product.variants.filter((v) => v.color.hex.trim().toLowerCase() === hex);
    const pool = ofColor.length > 0 ? ofColor : product.variants;
    const sizes = orderSizes(pool.map((v) => v.size));
    const ordered = [...pool].sort((a, b) => sizes.indexOf(a.size) - sizes.indexOf(b.size));
    return ordered.find((v) => v.stock > 0) ?? ordered[0];
  }, [product.variants, colors]);
  const viewSku = viewVariant?.sku;
  const viewPrice = viewVariant?.priceOverride ?? product.salePrice ?? product.basePrice;
  const viewedProduct = useRef<string | null>(null);
  useEffect(() => {
    if (viewedProduct.current === product.id) return;
    viewedProduct.current = product.id;
    if (isPageReload() && lastTracked("view") === product.id) return;
    rememberTracked("view", product.id);

    if (!viewSku) {
      // No variants to report: the product id is the catalog's item_group_id.
      trackPixel("ViewContent", {
        content_type: "product_group",
        content_ids: [product.id],
        content_name: product.name.en,
        value: viewPrice,
        currency: PIXEL_CURRENCY,
      });
      return;
    }
    trackPixelAndServer(
      "ViewContent",
      {
        content_type: "product",
        content_ids: [viewSku],
        contents: [{ id: viewSku, quantity: 1, item_price: viewPrice }],
        content_name: product.name.en,
        value: viewPrice,
        currency: PIXEL_CURRENCY,
      },
      newPixelEventId("vc"),
      [{ sku: viewSku, qty: 1 }]
    );
  }, [product.id, product.name.en, viewSku, viewPrice]);

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
