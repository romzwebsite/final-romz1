import { Link } from "@/i18n/navigation";
import { lt, formatEGP } from "@/lib/format";
import type { Collection, Locale } from "@/lib/types";

export default function CollectionCard({
  collection,
  locale,
}: {
  collection: Collection;
  locale: Locale;
}) {
  const save = Math.max(0, collection.originalTotal - collection.bundlePrice);
  const images = collection.products
    .map((p) => p.images[0]?.url)
    .filter(Boolean)
    .slice(0, 4) as string[];

  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="group block overflow-hidden border-2 border-navy/10 bg-white transition-colors hover:border-brand"
    >
      <div className="grid grid-cols-2 gap-0.5 bg-navy/5">
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ))}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display uppercase text-lg leading-tight text-navy">
            {lt(collection.name, locale)}
          </h3>
          {save > 0 && (
            <span className="shrink-0 bg-brand px-2 py-1 text-[10px] font-extrabold uppercase text-white">
              {locale === "ar" ? "وفّر" : "Save"} {formatEGP(save, locale)}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          {collection.products.length} {locale === "ar" ? "منتجات" : "items"}
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-xl text-navy">
            {formatEGP(collection.bundlePrice, locale)}
          </span>
          {save > 0 && (
            <span className="text-sm text-muted line-through">
              {formatEGP(collection.originalTotal, locale)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
