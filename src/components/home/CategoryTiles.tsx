import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import SectionHeading from "@/components/ui/SectionHeading";
import Reveal from "@/components/motion/Reveal";
import { lt } from "@/lib/format";
import type { Category, Collection, Locale } from "@/lib/types";

/* Official campaign photography from "ROMZ BRANDING VOL1" (pages 10-11). */
const tileImages: Record<string, string> = {
  compressions: "/brand/lifestyle/track-sportsbra.webp",
  tops: "/brand/lifestyle/track-cap.webp",
  bottoms: "/brand/lifestyle/street-socks.webp",
};

export default function CategoryTiles({
  categories,
  collections = [],
}: {
  categories: Category[];
  collections?: Collection[];
}) {
  const t = useTranslations("sections");
  const locale = useLocale() as Locale;
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  const collImage = (c: Collection) =>
    c.products.map((p) => p.images[0]?.url).find(Boolean) ??
    "/brand/lifestyle/track-sportsbra.webp";

  return (
    <section className="clip-diagonal-top bg-navy pb-16 pt-24 md:pb-24 md:pt-32">
      <div className="mx-auto max-w-7xl px-4">
        <Reveal direction="start">
          <SectionHeading title={t("shopByCategory")} ghost="CATEGORY" light />
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
          {categories.map((cat, i) => (
            <Reveal key={cat.id} delay={i * 0.12}>
              <Link
                href={`/category/${cat.slug}`}
                className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden bg-navy-deep p-6"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    cat.image?.url ??
                    tileImages[cat.slug] ??
                    "/brand/lifestyle/track-sportsbra.webp"
                  }
                  alt=""
                  aria-hidden
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-navy-deep/90 via-navy-deep/20 to-transparent"
                />
                <div className="relative flex items-end justify-between gap-3">
                  <h3 className="font-display uppercase text-2xl md:text-3xl text-white">
                    {lt(cat.name, locale)}
                  </h3>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-brand text-white transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
                    <Arrow size={18} />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}

          {/* Collections appear here as tiles when any exist; otherwise nothing. */}
          {collections.map((c, i) => (
            <Reveal key={c.id} delay={(categories.length + i) * 0.12}>
              <Link
                href={`/collections/${c.slug}`}
                className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden bg-navy-deep p-6"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={collImage(c)}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-navy-deep/90 via-navy-deep/20 to-transparent"
                />
                <span className="absolute start-4 top-4 bg-brand px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
                  {locale === "ar" ? "كولكشن" : "Collection"}
                </span>
                <div className="relative flex items-end justify-between gap-3">
                  <h3 className="font-display uppercase text-2xl md:text-3xl text-white">
                    {lt(c.name, locale)}
                  </h3>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-brand text-white transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
                    <Arrow size={18} />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
