import { setRequestLocale } from "next-intl/server";
import { getCollections } from "@/lib/api";
import CollectionCard from "@/components/collections/CollectionCard";
import SectionHeading from "@/components/ui/SectionHeading";
import type { Locale } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CollectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ar = locale === "ar";
  const collections = await getCollections();

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-16 md:py-24">
      <SectionHeading title={ar ? "الكولكشنز" : "Collections"} ghost="SET" />
      <p className="mt-3 max-w-xl text-sm text-muted">
        {ar
          ? "أطقم مختارة بسعر واحد أوفر — أضف الكولكشن كامل لسلتك."
          : "Curated sets at one lower price — add the whole collection to your cart."}
      </p>

      {collections.length === 0 ? (
        <p className="mt-10 text-muted">
          {ar ? "لا توجد كولكشنز بعد." : "No collections yet."}
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <CollectionCard key={c.id} collection={c} locale={locale as Locale} />
          ))}
        </div>
      )}
    </section>
  );
}
