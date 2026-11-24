"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { useCart } from "@/components/cart/CartProvider";
import { lt, formatEGP } from "@/lib/format";
import type { Collection, Locale, Product, Variant } from "@/lib/types";

const unitPrice = (product: Product, variant?: Variant) =>
  variant?.priceOverride ?? product.salePrice ?? product.basePrice;

const firstInStock = (product: Product): Variant | undefined =>
  product.variants.find((v) => v.stock > 0) ?? product.variants[0];

export default function CollectionDetailClient({
  collection,
  locale,
}: {
  collection: Collection;
  locale: Locale;
}) {
  const ar = locale === "ar";
  const { addItem } = useCart();

  // One chosen variant per product (defaults to the first in-stock variant).
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of collection.products) {
      const v = firstInStock(p);
      if (v) init[p.id] = v.id;
    }
    return init;
  });
  const [added, setAdded] = useState(false);

  const save = Math.max(0, collection.originalTotal - collection.bundlePrice);

  const everyProductHasStock = useMemo(
    () => collection.products.every((p) => p.variants.some((v) => v.stock > 0)),
    [collection.products]
  );

  const addCollection = () => {
    for (const product of collection.products) {
      const variant =
        product.variants.find((v) => v.id === selections[product.id]) ??
        firstInStock(product);
      if (!variant || variant.stock < 1) return;
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
            (i) => i.color?.trim().toLowerCase() === variant.color.hex.trim().toLowerCase()
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
    <section className="mx-auto max-w-[1100px] px-6 py-12 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-brand">
            {ar ? "كولكشن" : "Collection"}
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {collection.products.map((product) => {
          const inStockVariants = product.variants.filter((v) => v.stock > 0);
          const outOfStock = inStockVariants.length === 0;
          const selectedId = selections[product.id];
          return (
            <div
              key={product.id}
              className="flex gap-4 border-2 border-navy/10 bg-white p-4"
            >
              <div className="h-24 w-24 shrink-0 bg-surface">
                {product.images[0]?.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.images[0].url}
                    alt={lt(product.name, locale)}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col">
                <p className="text-sm font-bold text-navy">
                  {lt(product.name, locale)}
                </p>
                <p className="text-xs text-muted">
                  {formatEGP(unitPrice(product), locale)}
                </p>
                {outOfStock ? (
                  <p className="mt-auto text-xs font-bold text-brand">
                    {ar ? "غير متوفر" : "Out of stock"}
                  </p>
                ) : (
                  <label className="mt-auto block">
                    <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-muted">
                      {ar ? "اللون / المقاس" : "Color / Size"}
                    </span>
                    <select
                      value={selectedId ?? ""}
                      onChange={(e) =>
                        setSelections((s) => ({ ...s, [product.id]: e.target.value }))
                      }
                      className="w-full border-2 border-navy/15 bg-white px-2 py-1.5 text-sm text-navy outline-none focus:border-brand"
                    >
                      {inStockVariants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {lt(v.color.name, locale)} / {v.size}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Button
          size="lg"
          onClick={addCollection}
          disabled={!everyProductHasStock}
          className="w-full sm:w-auto"
        >
          {everyProductHasStock
            ? ar
              ? `أضف الكولكشن للسلة · ${formatEGP(collection.bundlePrice, locale)}`
              : `Add collection to cart · ${formatEGP(collection.bundlePrice, locale)}`
            : ar
              ? "بعض المنتجات غير متوفرة"
              : "Some items unavailable"}
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
