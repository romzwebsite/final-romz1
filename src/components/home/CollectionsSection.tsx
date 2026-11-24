import { Link } from "@/i18n/navigation";
import { btn } from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";
import Reveal from "@/components/motion/Reveal";
import CollectionCard from "@/components/collections/CollectionCard";
import type { Collection, Locale } from "@/lib/types";

export default function CollectionsSection({
  collections,
  locale,
}: {
  collections: Collection[];
  locale: Locale;
}) {
  if (collections.length === 0) return null;
  const ar = locale === "ar";

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-16 md:py-24">
      <Reveal direction="start">
        <SectionHeading title={ar ? "الكولكشنز" : "Collections"} ghost="SET" />
      </Reveal>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {collections.slice(0, 3).map((c) => (
          <CollectionCard key={c.id} collection={c} locale={locale} />
        ))}
      </div>
      <Reveal className="mt-10 text-center">
        <Link href="/collections" className={btn("primary", "md")}>
          <span>{ar ? "كل الكولكشنز" : "View all collections"}</span>
        </Link>
      </Reveal>
    </section>
  );
}
