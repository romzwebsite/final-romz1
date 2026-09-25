import { getTranslations, setRequestLocale } from "next-intl/server";
import { getHomeData } from "@/lib/api";
import { getStorefrontSettings } from "@/lib/storefrontSettings";
import { Link } from "@/i18n/navigation";
import { btn } from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";
import ProductGrid from "@/components/product/ProductGrid";
import Reveal from "@/components/motion/Reveal";
import Hero from "@/components/home/Hero";
import CategoryTiles from "@/components/home/CategoryTiles";
import CompleteTheFit from "@/components/home/CompleteTheFit";
import ReviewsSection from "@/components/home/ReviewsSection";
import FaqSection from "@/components/home/FaqSection";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("sections");
  const [{ newArrivals, bestSellers, categories, reviews }, settings] =
    await Promise.all([getHomeData(), getStorefrontSettings()]);

  return (
    <>
      <Hero hero={settings.hero} />

      {/* New Arrivals */}
      <section
        id="new-arrivals"
        className="mx-auto max-w-[1440px] scroll-mt-24 px-6 py-16 md:py-24"
      >
        <Reveal direction="start">
          <SectionHeading title={t("newArrivals")} ghost="01" />
        </Reveal>
        <ProductGrid products={newArrivals} className="mt-10" />
        {categories[0] && (
          <Reveal className="mt-10 text-center">
            <Link
              href={`/category/${categories[0].slug}`}
              className={btn("primary", "md")}
            >
              <span>{t("shopTheDrop")}</span>
            </Link>
          </Reveal>
        )}
      </section>

      <CategoryTiles categories={categories} />

      {/* Best Sellers */}
      <section className="mx-auto max-w-[1440px] px-6 py-16 md:py-24">
        <Reveal direction="start">
          <SectionHeading title={t("bestSellers")} ghost="02" />
        </Reveal>
        <ProductGrid products={bestSellers} className="mt-10" />
      </section>

      <CompleteTheFit product={bestSellers.find((p) => p.salePrice) ?? bestSellers[0]} />

      <ReviewsSection reviews={reviews} />

      <FaqSection faqs={settings.faqs} />
    </>
  );
}
