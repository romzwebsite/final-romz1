"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import clsx from "clsx";
import { Check, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import SectionHeading from "@/components/ui/SectionHeading";
import ProductGrid from "@/components/product/ProductGrid";
import { formatEGP, lt } from "@/lib/format";
import { colorsFromProducts, sizesFromProducts } from "@/lib/product";
import type { Category, Locale, Product } from "@/lib/types";

type Sort = "newest" | "best-selling" | "price-asc" | "price-desc";

const PER_PAGE = 9;

export default function CategoryClient({
  category,
  parent,
  subcategories,
  products,
}: {
  category: Category;
  parent?: Category | null;
  subcategories?: Category[];
  products: Product[];
}) {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;

  const subs = subcategories ?? [];
  const allColors = useMemo(() => colorsFromProducts(products), [products]);
  const allSizes = useMemo(() => sizesFromProducts(products), [products]);
  const priceCeiling = useMemo(
    () =>
      Math.max(
        2000,
        ...products.map((p) => p.salePrice ?? p.basePrice),
        0
      ),
    [products]
  );

  const [subSlug, setSubSlug] = useState<string | null>(null);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(priceCeiling);
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);

  // Collapsible filter sections (matches the Figma +/− toggles).
  const [openSize, setOpenSize] = useState(true);
  const [openPrice, setOpenPrice] = useState(true);
  const [openColor, setOpenColor] = useState(true);

  // On mobile the filter panel is collapsed by default so products are visible
  // without scrolling past a full screen of filters. Always shown on desktop.
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const priceTouched = maxPrice < priceCeiling;

  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      const price = p.salePrice ?? p.basePrice;
      const subOk = !subSlug || p.categories.includes(subSlug);
      const sizeOk =
        sizes.length === 0 ||
        p.variants.some((v) => sizes.includes(v.size) && v.stock > 0);
      const colorOk =
        colors.length === 0 ||
        p.variants.some((v) => colors.includes(v.color.hex));
      const priceOk = price <= maxPrice;
      return subOk && sizeOk && colorOk && priceOk;
    });
    switch (sort) {
      case "price-asc":
        result = [...result].sort(
          (a, b) => (a.salePrice ?? a.basePrice) - (b.salePrice ?? b.basePrice)
        );
        break;
      case "price-desc":
        result = [...result].sort(
          (a, b) => (b.salePrice ?? b.basePrice) - (a.salePrice ?? a.basePrice)
        );
        break;
      case "best-selling":
        result = [...result].sort((a, b) => b.sold - a.sold);
        break;
    }
    return result;
  }, [products, subSlug, sizes, colors, maxPrice, sort]);

  // Reset to the first page whenever the result set changes.
  useEffect(() => {
    setPage(1);
  }, [subSlug, sizes, colors, maxPrice, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const activeCount =
    sizes.length + colors.length + (priceTouched ? 1 : 0) + (subSlug ? 1 : 0);
  const anyFilter = activeCount > 0;
  const clearAll = () => {
    setSizes([]);
    setColors([]);
    setMaxPrice(priceCeiling);
    setSubSlug(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
      {/* Breadcrumb */}
      <nav className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
        <Link href="/" className="hover:text-brand">
          {t("home")}
        </Link>
        {parent && (
          <>
            <span className="mx-2 text-navy/30">›</span>
            <Link href={`/category/${parent.slug}`} className="hover:text-brand">
              {lt(parent.name, locale)}
            </Link>
          </>
        )}
        <span className="mx-2 text-navy/30">›</span>
        <span className="text-navy">{lt(category.name, locale)}</span>
      </nav>

      <SectionHeading
        title={
          parent
            ? `${lt(parent.name, locale)} ${lt(category.name, locale)}`
            : lt(category.name, locale)
        }
        ghost={category.name.en.toUpperCase()}
      />

      {/* Subcategory pills (only when this category has children) */}
      {subs.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSubSlug(null)}
            className={clsx(
              "border-2 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer",
              subSlug === null
                ? "border-brand bg-brand text-white"
                : "border-navy/20 text-navy hover:border-navy"
            )}
          >
            {t("all")}
          </button>
          {subs.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setSubSlug(sub.slug)}
              className={clsx(
                "border-2 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer",
                subSlug === sub.slug
                  ? "border-brand bg-brand text-white"
                  : "border-navy/20 text-navy hover:border-navy"
              )}
            >
              {lt(sub.name, locale)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* ── Filters ── */}
        <aside className="lg:self-start">
          {/* Mobile toggle — collapsed by default so products show first */}
          <div className="mb-4 flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setMobileFiltersOpen((o) => !o)}
              className="flex flex-1 items-center justify-between border-2 border-navy px-4 py-3"
            >
              <span className="flex items-center gap-2 font-display uppercase text-lg text-navy">
                {t("filters")}
                {activeCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-white">
                    {activeCount}
                  </span>
                )}
              </span>
              {mobileFiltersOpen ? <Minus size={18} /> : <Plus size={18} />}
            </button>
            {anyFilter && (
              <button
                onClick={clearAll}
                className="text-xs font-extrabold uppercase tracking-wider text-brand hover:underline cursor-pointer"
              >
                {t("clearAll")}
              </button>
            )}
          </div>

          {/* Filter panel — hidden on mobile unless toggled, always shown on desktop */}
          <div className={clsx(mobileFiltersOpen ? "block" : "hidden", "lg:block")}>
          <div className="mb-6 hidden items-center justify-between border-b-2 border-navy pb-2 lg:flex">
            <h2 className="font-display uppercase text-2xl text-navy">
              {t("filters")}
            </h2>
            {anyFilter && (
              <button
                onClick={clearAll}
                className="text-xs font-extrabold uppercase tracking-wider text-brand hover:underline cursor-pointer"
              >
                {t("clearAll")}
              </button>
            )}
          </div>

          {/* Size */}
          {allSizes.length > 0 && (
            <FilterSection
              title={t("sizeFilter")}
              open={openSize}
              onToggle={() => setOpenSize((o) => !o)}
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {allSizes.map((s) => {
                  const checked = sizes.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggle(sizes, setSizes, s)}
                      className="flex items-center gap-2.5 text-start cursor-pointer group"
                    >
                      <span
                        className={clsx(
                          "flex h-5 w-5 items-center justify-center border-2 transition-colors",
                          checked
                            ? "border-brand bg-brand text-white"
                            : "border-navy/30 group-hover:border-navy"
                        )}
                      >
                        {checked && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className="text-sm font-bold text-navy">{s}</span>
                    </button>
                  );
                })}
              </div>
            </FilterSection>
          )}

          {/* Price */}
          <FilterSection
            title={t("priceFilter")}
            open={openPrice}
            onToggle={() => setOpenPrice((o) => !o)}
          >
            <input
              type="range"
              min={0}
              max={priceCeiling}
              step={50}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="romz-range w-full cursor-pointer"
            />
            <div className="mt-2 flex justify-between text-xs font-bold text-muted">
              <span>{formatEGP(0, locale)}</span>
              <span>
                {formatEGP(maxPrice, locale)}
                {maxPrice >= priceCeiling ? "+" : ""}
              </span>
            </div>
          </FilterSection>

          {/* Color */}
          {allColors.length > 0 && (
            <FilterSection
              title={t("colorFilter")}
              open={openColor}
              onToggle={() => setOpenColor((o) => !o)}
            >
              <div className="flex flex-wrap gap-2">
                {allColors.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => toggle(colors, setColors, c.hex)}
                    className={clsx(
                      "h-8 w-8 rounded-full border-2 p-0.5 cursor-pointer",
                      colors.includes(c.hex) ? "border-brand" : "border-navy/20"
                    )}
                    title={lt(c.name, locale)}
                  >
                    <span
                      className="block h-full w-full rounded-full"
                      style={{ backgroundColor: c.hex }}
                    />
                  </button>
                ))}
              </div>
            </FilterSection>
          )}
          </div>
        </aside>

        {/* ── Results ── */}
        <div>
          {/* Results bar */}
          <div className="mb-6 flex items-center justify-between gap-4 border-s-4 border-brand bg-surface px-4 py-3">
            <p className="text-sm font-bold uppercase tracking-wide text-navy">
              {t("showingResults", { count: filtered.length })}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <span className="hidden font-bold uppercase tracking-wide text-muted sm:inline">
                {t("sortBy")}:
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="border-2 border-navy/20 bg-white px-3 py-2 text-sm font-bold uppercase text-navy outline-none focus:border-brand cursor-pointer"
              >
                <option value="newest">{t("sortNewest")}</option>
                <option value="best-selling">{t("sortBestSelling")}</option>
                <option value="price-asc">{t("sortPriceAsc")}</option>
                <option value="price-desc">{t("sortPriceDesc")}</option>
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <p className="py-20 text-center text-muted">{t("noResults")}</p>
          ) : (
            <>
              <ProductGrid
                products={paged}
                columns={3}
                categorySlug={subSlug ?? category.slug}
              />

              {/* Pagination */}
              {pageCount > 1 && (
                <div className="mt-12 flex items-center justify-center gap-3">
                  <PageBtn
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                    aria-label="previous"
                  >
                    {locale === "ar" ? (
                      <ChevronRight size={18} />
                    ) : (
                      <ChevronLeft size={18} />
                    )}
                  </PageBtn>
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                    <PageBtn
                      key={n}
                      active={n === currentPage}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </PageBtn>
                  ))}
                  <PageBtn
                    disabled={currentPage === pageCount}
                    onClick={() => setPage(currentPage + 1)}
                    aria-label="next"
                  >
                    {locale === "ar" ? (
                      <ChevronLeft size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </PageBtn>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 border-b border-navy/10 pb-6">
      <button
        onClick={onToggle}
        className="mb-4 flex w-full items-center justify-between cursor-pointer"
      >
        <span className="text-sm font-extrabold uppercase tracking-wider text-navy">
          {title}
        </span>
        <span className="text-brand">
          {open ? <Minus size={16} /> : <Plus size={16} />}
        </span>
      </button>
      {open && children}
    </div>
  );
}

function PageBtn({
  children,
  active = false,
  disabled = false,
  onClick,
  ...props
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "skew-cta flex h-11 w-11 items-center justify-center border-2 font-display text-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
        active
          ? "border-brand bg-brand text-white"
          : "border-navy/20 text-navy hover:border-navy"
      )}
      {...props}
    >
      <span>{children}</span>
    </button>
  );
}
