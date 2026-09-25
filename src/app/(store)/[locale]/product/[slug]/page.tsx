import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getProductBySlug, getProductReviews, getRelatedProducts } from "@/lib/api";
import { getStorefrontSettings } from "@/lib/storefrontSettings";
import { Link } from "@/i18n/navigation";
import { lt } from "@/lib/format";
import { productCategoryContext, withCategoryImages } from "@/lib/product";
import type { Locale } from "@/lib/types";
import Rating from "@/components/ui/Rating";
import SectionHeading from "@/components/ui/SectionHeading";
import ProductGrid from "@/components/product/ProductGrid";
import ProductView from "@/components/product/ProductView";
import ReviewForm from "@/components/product/ReviewForm";
import { BadgeCheck } from "lucide-react";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const { category: requestedCategory } = await searchParams;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const found = await getProductBySlug(slug);
  if (!found) notFound();

  // Products in several categories can have different photos per category;
  // show the set for the category the shopper came from (?category=slug).
  const categoryContext = productCategoryContext(
    found,
    typeof requestedCategory === "string" ? requestedCategory : null
  );
  const product = withCategoryImages(found, categoryContext);

  const settings = await getStorefrontSettings();

  const t = await getTranslations("product");
  const ts = await getTranslations("sections");
  const tc = await getTranslations("common");
  const related = await getRelatedProducts(product);
  const productReviews = await getProductReviews(product.id);

  // Star distribution (5→1) for the reviews summary.
  const dist = [5, 4, 3, 2, 1].map(
    (star) => productReviews.filter((r) => Math.round(r.rating) === star).length
  );
  const reviewCount = productReviews.length;
  const avg =
    reviewCount > 0
      ? productReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : product.ratingAvg;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
      {/* Breadcrumb */}
      <nav className="mb-5 text-xs font-bold uppercase tracking-wider text-muted">
        <Link href="/" className="hover:text-brand">
          {tc("home")}
        </Link>
        <span className="mx-2 text-navy/30">/</span>
        <Link href={`/category/${categoryContext}`} className="hover:text-brand">
          {categoryContext}
        </Link>
        <span className="mx-2 text-navy/30">/</span>
        <span className="text-navy">{lt(product.name, locale)}</span>
      </nav>

      <ProductView product={product} shippingReturns={settings.shippingReturns} />

      {related.length > 0 && (
        <section className="mt-20 md:mt-28">
          <SectionHeading title={t("related")} ghost="MORE" />
          <ProductGrid products={related} className="mt-10" categorySlug={categoryContext} />
        </section>
      )}

      <section className="mt-20 border-t-2 border-navy pt-12 md:mt-28">
        <h2 className="font-display uppercase text-3xl md:text-5xl text-navy">
          {t("customerReviews")}
        </h2>

        {reviewCount > 0 ? (
          <div className="mt-8 grid gap-10 lg:grid-cols-[280px_1fr]">
            {/* Summary */}
            <div>
              <div className="flex items-end gap-3">
                <span className="font-display text-6xl leading-none text-navy">
                  {avg.toFixed(1)}
                </span>
                <div className="pb-1">
                  <Rating value={avg} size={16} />
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    {t("basedOnReviews", { count: reviewCount })}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-1.5">
                {dist.map((n, i) => {
                  const star = 5 - i;
                  const pct = reviewCount ? (n / reviewCount) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-8 font-bold text-navy">{star} ★</span>
                      <div className="h-2 flex-1 bg-surface">
                        <div
                          className="h-full bg-navy"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-end font-bold text-muted">{n}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Review list */}
            <div className="space-y-4">
              {productReviews.map((review) => (
                <div
                  key={review.id}
                  className="border-2 border-navy/10 bg-white p-6"
                >
                  <Rating value={review.rating} size={14} />
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm font-extrabold uppercase text-navy">
                      {review.name}
                    </span>
                    {review.isVerifiedPurchase && (
                      <span className="flex items-center gap-1 bg-surface px-2 py-0.5 text-[10px] font-bold uppercase text-navy">
                        <BadgeCheck size={12} className="text-brand" />
                        {ts("verified")}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-navy/80">
                    {lt(review.comment, locale)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">{t("noReviewsYet")}</p>
        )}

        <div className="mt-10 max-w-2xl">
          <ReviewForm productId={product.id} />
        </div>
      </section>
    </div>
  );
}
