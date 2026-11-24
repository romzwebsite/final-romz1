"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useCart } from "@/components/cart/CartProvider";
import CollectionProductView from "@/components/collections/CollectionProductView";
import { lt, formatEGP } from "@/lib/format";
import type { Collection, Locale, Product, Variant } from "@/lib/types";

const unitPrice = (product: Product, variant?: Variant) =>
  variant?.priceOverride ?? product.salePrice ?? product.basePrice;

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
    <section className="mx-auto max-w-7xl px-4 py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-brand">
            {collection.category
              ? lt(collection.category.name, locale)
              : ar
                ? "كولكشن"
                : "Collection"}
          </p>
          <h1 className="mt-1 font-display uppercase text-4xl md:text-5xl text-navy">
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

      <div className="mt-4 flex flex-col gap-6">
        {collection.products.map((product) => (
          <CollectionProductView
            key={product.id}
            product={product}
            highlight={triedAdd}
            onSelectVariant={(variantId) =>
              setSelected((s) => ({ ...s, [product.id]: variantId }))
            }
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

      <div className="sticky bottom-0 mt-6 flex flex-col items-start gap-3 bg-page/95 py-4 backdrop-blur sm:flex-row sm:items-center">
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
