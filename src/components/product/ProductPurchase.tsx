"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import clsx from "clsx";
import { useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import { useCart } from "@/components/cart/CartProvider";
import SizeChartModal, { hasSizeChart } from "@/components/product/SizeChartModal";
import { lt } from "@/lib/format";
import { orderSizes } from "@/lib/product";
import type { Locale, Product, ProductColor } from "@/lib/types";

export default function ProductPurchase({
  product,
  colors,
  activeColorHex,
  onSelectColor,
  onHoverColor,
  onPriceOverrideChange,
}: {
  product: Product;
  colors: ProductColor[];
  activeColorHex?: string;
  onSelectColor: (hex: string) => void;
  onHoverColor: (hex: string | null) => void;
  onPriceOverrideChange?: (price: number | null) => void;
}) {
  const t = useTranslations("product");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { addItem } = useCart();

  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const chartAvailable = hasSizeChart(product.sizeChart);

  // Reset the size selection whenever the active color changes (adjusted during
  // render — the endorsed pattern for reacting to a prop change without effects).
  const [prevColorHex, setPrevColorHex] = useState(activeColorHex);
  if (activeColorHex !== prevColorHex) {
    setPrevColorHex(activeColorHex);
    setSize(null);
    setSizeError(false);
  }

  const normalizedColor = activeColorHex?.trim().toLowerCase();
  const sizesForColor = useMemo(() => {
    const variants = product.variants.filter(
      (v) => v.color.hex.trim().toLowerCase() === normalizedColor
    );
    return orderSizes(variants.map((v) => v.size)).map((s) => ({
      size: s,
      stock: variants.find((v) => v.size === s)?.stock ?? 0,
    }));
  }, [product.variants, normalizedColor]);

  const hasSizes = sizesForColor.length > 0;
  const variant = product.variants.find(
    (v) => v.color.hex.trim().toLowerCase() === normalizedColor && v.size === size
  );
  const selectedColor = colors.find(
    (c) => c.hex.trim().toLowerCase() === normalizedColor
  );
  // With sizes, a variant is required; sizeless products add their sole variant.
  const soleVariant = !hasSizes
    ? product.variants.find(
        (v) => v.color.hex.trim().toLowerCase() === normalizedColor
      )
    : undefined;
  const cartVariant = variant ?? soleVariant;
  const unitPrice =
    cartVariant?.priceOverride ?? product.salePrice ?? product.basePrice;
  const canAdd = Boolean(cartVariant && cartVariant.stock > 0);
  // Before a size is picked the CTA asks for one (and stays clickable so the
  // size error shows); it only reads "out of stock" when nothing is left.
  const needsSize = hasSizes && !size && sizesForColor.some((s) => s.stock > 0);
  const ctaEnabled = canAdd || needsSize;

  useEffect(() => {
    onPriceOverrideChange?.(cartVariant?.priceOverride ?? null);
  }, [cartVariant?.priceOverride, onPriceOverrideChange]);

  const addToCart = () => {
    // Size validation: block adding a sized product until a size is picked.
    if (hasSizes && !size) {
      setSizeError(true);
      return;
    }
    if (!cartVariant || !selectedColor) return;
    addItem({
      productId: product.id,
      variantId: cartVariant.id,
      slug: product.slug,
      name: product.name,
      sku: cartVariant.sku,
      size: cartVariant.size,
      colorName: lt(selectedColor.name, locale),
      colorHex: selectedColor.hex,
      qty,
      unitPrice,
      image:
        product.images.find(
          (i) => i.color?.trim().toLowerCase() === normalizedColor
        )?.url ??
        product.images[0]?.url,
      maxStock: cartVariant.stock,
    });
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Color */}
      <div>
        <p className="mb-2 text-sm font-bold uppercase tracking-wide text-navy">
          {t("color")}:{" "}
          <span className="font-normal text-muted">
            {selectedColor ? lt(selectedColor.name, locale) : ""}
          </span>
        </p>
        <div className="flex gap-2">
          {colors.map((c) => (
            <button
              key={c.hex}
              // Desktop: hovering previews the color's image. Mobile/tap:
              // clicking selects it (hover doesn't exist on touch devices).
              onMouseEnter={() => onHoverColor(c.hex)}
              onMouseLeave={() => onHoverColor(null)}
              onClick={() => onSelectColor(c.hex)}
              className={clsx(
                "h-9 w-9 rounded-full border-2 p-0.5 cursor-pointer",
                c.hex === activeColorHex ? "border-brand" : "border-navy/20"
              )}
              aria-label={lt(c.name, locale)}
              aria-pressed={c.hex === activeColorHex}
            >
              <span
                className="block h-full w-full rounded-full"
                style={{ backgroundColor: c.hex }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Size */}
      {hasSizes && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-wide text-navy">
              {t("size")}
            </p>
            {chartAvailable && (
              <button
                type="button"
                onClick={() => setShowSizeChart(true)}
                className="text-xs font-extrabold uppercase tracking-wide text-brand underline underline-offset-2 hover:text-brand-dark cursor-pointer"
              >
                {t("sizeChart")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {sizesForColor.map(({ size: s, stock }) => {
              const out = stock === 0;
              const active = size === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={out}
                  onClick={() => {
                    setSize(s);
                    setSizeError(false);
                  }}
                  className={clsx(
                    "relative h-12 min-w-12 border-2 px-3 text-sm font-extrabold uppercase transition-colors cursor-pointer",
                    active
                      ? "border-navy bg-navy text-white"
                      : "border-navy/20 text-navy hover:border-navy",
                    out &&
                      "cursor-not-allowed border-navy/10 text-navy/30 hover:border-navy/10",
                    sizeError && !active && "border-brand"
                  )}
                >
                  {s}
                  {out && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    >
                      <span className="h-[140%] w-px rotate-45 bg-navy/20" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {sizeError && (
            <p className="mt-2 text-xs font-bold text-brand">{t("chooseSize")}</p>
          )}
          {variant && variant.stock <= 5 && variant.stock > 0 && (
            <p className="mt-2 text-xs font-bold text-brand">
              {t("lowStock", { count: variant.stock })}
            </p>
          )}
        </div>
      )}

      {/* Quantity */}
      <div>
        <p className="mb-2 text-sm font-bold uppercase tracking-wide text-navy">
          {t("quantity")}
        </p>
        <div className="inline-flex items-center border-2 border-navy/20">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="p-3 hover:bg-surface cursor-pointer"
            aria-label="decrease"
          >
            <Minus size={14} />
          </button>
          <span className="w-12 text-center font-extrabold">{qty}</span>
          <button
            onClick={() => setQty(Math.min(cartVariant?.stock ?? 99, qty + 1))}
            className="p-3 hover:bg-surface cursor-pointer"
            aria-label="increase"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* CTAs */}
      <div className="space-y-3">
        <Button
          size="lg"
          className="w-full"
          disabled={!ctaEnabled}
          onClick={addToCart}
        >
          {canAdd ? t("addToCart") : needsSize ? t("selectSize") : t("outOfStock")}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={!ctaEnabled}
          onClick={() => {
            if (addToCart()) router.push("/checkout");
          }}
        >
          {t("buyNow")}
        </Button>
      </div>

      {showSizeChart && (
        <SizeChartModal
          chart={product.sizeChart}
          onClose={() => setShowSizeChart(false)}
        />
      )}
    </div>
  );
}
