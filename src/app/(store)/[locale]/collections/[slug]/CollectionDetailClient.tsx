"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import Button from "@/components/ui/Button";
import { useCart } from "@/components/cart/CartProvider";
import { lt, formatEGP } from "@/lib/format";
import { orderSizes } from "@/lib/product";
import type { Collection, Locale, Product, Variant } from "@/lib/types";

const unitPrice = (product: Product, variant?: Variant) =>
  variant?.priceOverride ?? product.salePrice ?? product.basePrice;

/** One product card with color/size selection. Nothing is selected by default. */
function ProductPicker({
  product,
  locale,
  selectedVariantId,
  onSelect,
  highlight,
}: {
  product: Product;
  locale: Locale;
  selectedVariantId?: string;
  onSelect: (variantId: string | undefined) => void;
  highlight: boolean;
}) {
  const ar = locale === "ar";
  const colors = useMemo(() => {
    const map = new Map<string, { hex: string; name: Product["variants"][number]["color"]["name"] }>();
    for (const v of product.variants) {
      const key = v.color.hex.trim().toLowerCase();
      if (!map.has(key)) map.set(key, { hex: v.color.hex, name: v.color.name });
    }
    return [...map.values()];
  }, [product.variants]);

  const singleColor = colors.length <= 1;
  const [colorHex, setColorHex] = useState<string | null>(
    singleColor ? colors[0]?.hex ?? null : null
  );
  const [size, setSize] = useState<string | null>(null);

  const normColor = colorHex?.trim().toLowerCase();
  const sizes = useMemo(() => {
    const vs = product.variants.filter(
      (v) => v.color.hex.trim().toLowerCase() === normColor
    );
    return orderSizes(vs.map((v) => v.size)).map((s) => ({
      size: s,
      stock: vs.find((v) => v.size === s)?.stock ?? 0,
    }));
  }, [product.variants, normColor]);

  const pickColor = (hex: string) => {
    setColorHex(hex);
    setSize(null);
    onSelect(undefined);
  };
  const pickSize = (s: string) => {
    setSize(s);
    const v = product.variants.find(
      (x) => x.color.hex.trim().toLowerCase() === normColor && x.size === s
    );
    onSelect(v?.id);
  };

  const image =
    product.images.find((i) => i.color?.trim().toLowerCase() === normColor)?.url ??
    product.images[0]?.url;

  return (
    <div
      className={clsx(
        "flex flex-col gap-4 border-2 bg-white p-4 sm:flex-row",
        highlight && !selectedVariantId ? "border-brand" : "border-navy/10"
      )}
    >
      <div className="h-48 w-full shrink-0 bg-surface sm:h-40 sm:w-40">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={lt(product.name, locale)}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <p className="font-display uppercase text-lg text-navy">
          {lt(product.name, locale)}
        </p>
        <p className="text-sm font-extrabold text-brand">
          {formatEGP(unitPrice(product), locale)}
        </p>

        {!singleColor && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
              {ar ? "اللون" : "Color"}
            </p>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => pickColor(c.hex)}
                  aria-label={lt(c.name, locale)}
                  aria-pressed={c.hex === colorHex}
                  className={clsx(
                    "h-8 w-8 rounded-full border-2 p-0.5 cursor-pointer",
                    c.hex === colorHex ? "border-brand" : "border-navy/20"
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

        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
            {ar ? "المقاس" : "Size"}
          </p>
          {!colorHex ? (
            <p className="text-xs text-muted">
              {ar ? "اختر اللون أولاً" : "Choose a color first"}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sizes.map(({ size: s, stock }) => {
                const out = stock === 0;
                const active = size === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={out}
                    onClick={() => pickSize(s)}
                    className={clsx(
                      "h-10 min-w-10 border-2 px-3 text-sm font-extrabold uppercase transition-colors cursor-pointer",
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
      </div>
    </div>
  );
}

export default function CollectionDetailClient({
  collection,
  locale,
}: {
  collection: Collection;
  locale: Locale;
}) {
  const ar = locale === "ar";
  const { addItem } = useCart();

  // No default selection — the customer must pick for every product.
  const [selected, setSelected] = useState<Record<string, string | undefined>>({});
  const [triedAdd, setTriedAdd] = useState(false);
  const [added, setAdded] = useState(false);

  const save = Math.max(0, collection.originalTotal - collection.bundlePrice);
  const allSelected = collection.products.every((p) => selected[p.id]);

  const addCollection = () => {
    setTriedAdd(true);
    if (!allSelected) return;
    for (const product of collection.products) {
      const variant = product.variants.find((v) => v.id === selected[product.id]);
      if (!variant) return;
      addItem({
        productId: product.id,
        variantId: variant.id,
        slug: product.slug,
        name: product.name,
        sku: variant.sku,
        size: variant.size,
        colorName: lt(variant.color.name, locale),
        colorHex: variant.color.hex,
        qty: 1,
        unitPrice: unitPrice(product, variant),
        image:
          product.images.find(
            (i) =>
              i.color?.trim().toLowerCase() ===
              variant.color.hex.trim().toLowerCase()
          )?.url ?? product.images[0]?.url,
        maxStock: variant.stock,
        collectionId: collection.id,
        collectionName: collection.name,
        collectionBundlePrice: collection.bundlePrice,
      });
    }
    setAdded(true);
  };

  return (
    <section className="mx-auto max-w-[900px] px-6 py-12 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-brand">
            {collection.category
              ? lt(collection.category.name, locale)
              : ar
                ? "كولكشن"
                : "Collection"}
          </p>
          <h1 className="mt-1 font-display uppercase text-4xl text-navy">
            {lt(collection.name, locale)}
          </h1>
          {collection.description && lt(collection.description, locale) && (
            <p className="mt-2 max-w-xl text-sm text-muted">
              {lt(collection.description, locale)}
            </p>
          )}
        </div>
        <div className="text-end">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl text-navy">
              {formatEGP(collection.bundlePrice, locale)}
            </span>
            {save > 0 && (
              <span className="text-lg text-muted line-through">
                {formatEGP(collection.originalTotal, locale)}
              </span>
            )}
          </div>
          {save > 0 && (
            <span className="mt-1 inline-block bg-brand px-2 py-1 text-[11px] font-extrabold uppercase text-white">
              {ar ? `وفّر ${formatEGP(save, locale)}` : `Save ${formatEGP(save, locale)}`}
            </span>
          )}
        </div>
      </div>

      <p className="mt-6 text-sm font-bold text-navy">
        {ar
          ? "اختر اللون والمقاس لكل منتج:"
          : "Choose a color and size for each product:"}
      </p>

      <div className="mt-3 flex flex-col gap-4">
        {collection.products.map((product) => (
          <ProductPicker
            key={product.id}
            product={product}
            locale={locale}
            selectedVariantId={selected[product.id]}
            onSelect={(variantId) =>
              setSelected((s) => ({ ...s, [product.id]: variantId }))
            }
            highlight={triedAdd}
          />
        ))}
      </div>

      {triedAdd && !allSelected && (
        <p className="mt-4 text-sm font-bold text-brand">
          {ar
            ? "من فضلك اختر المقاس لكل منتج قبل الإضافة."
            : "Please choose a size for every product first."}
        </p>
      )}

      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Button size="lg" onClick={addCollection} className="w-full sm:w-auto">
          {ar
            ? `أضف الكولكشن للسلة · ${formatEGP(collection.bundlePrice, locale)}`
            : `Add collection to cart · ${formatEGP(collection.bundlePrice, locale)}`}
        </Button>
        {added && (
          <span className="text-sm font-bold text-success">
            {ar ? "تمت الإضافة للسلة ✓" : "Added to cart ✓"}
          </span>
        )}
      </div>
    </section>
  );
}
