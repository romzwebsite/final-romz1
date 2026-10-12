// Product data for Meta's catalog: the scheduled feed (app/api/feeds/meta-catalog)
// and the structured data on product pages. Item ids are the product ids, the
// same values the pixel sends as content_ids, so Meta can match events to items.

import { withCategoryImages } from "./product";
import type { Locale, LocalizedText, Product } from "./types";

export const CATALOG_BRAND = "ROMZ";
export const CATALOG_CURRENCY = "EGP";

// Canonical store address (romz.net redirects here).
const PRODUCTION_ORIGIN = "https://www.romz.net";

/**
 * Public origin of the store. Production never trusts request headers: a
 * spoofed Host could otherwise put another domain into the (CDN-cached) feed
 * and canonical links. Request headers are only used for local development.
 */
export function siteOrigin(headers: Headers): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return PRODUCTION_ORIGIN;
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/** Localized text, falling back to English when the translation is empty. */
export const catalogText = (text: LocalizedText, locale: Locale) =>
  text[locale]?.trim() || text.en.trim();

export const productInStock = (p: Product) => p.variants.some((v) => v.stock > 0);

/** The sale price, only when it is a real discount. */
export const catalogSalePrice = (p: Product) =>
  p.salePrice != null && p.salePrice > 0 && p.salePrice < p.basePrice ? p.salePrice : null;

export const catalogPrice = (amount: number) => `${amount.toFixed(2)} ${CATALOG_CURRENCY}`;

export const productPageUrl = (origin: string, slug: string, locale: Locale) =>
  `${origin}/${locale}/product/${encodeURIComponent(slug)}`;

/** Photos in storefront order for the product's main category (main photo first). */
export const catalogImages = (p: Product) =>
  withCategoryImages(p)
    .images.map((image) => image.url)
    .filter((url) => /^https?:\/\//i.test(url));

/** schema.org Product for the product page (read by Meta's pixel and by search engines). */
export function productJsonLd(p: Product, origin: string, locale: Locale) {
  const sale = catalogSalePrice(p);
  const name = catalogText(p.name, locale);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    productID: p.id,
    sku: p.id,
    name,
    description: catalogText(p.description, locale) || name,
    image: catalogImages(p),
    url: productPageUrl(origin, p.slug, locale),
    brand: { "@type": "Brand", name: CATALOG_BRAND },
    offers: {
      "@type": "Offer",
      price: (sale ?? p.basePrice).toFixed(2),
      priceCurrency: CATALOG_CURRENCY,
      availability: productInStock(p)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url: productPageUrl(origin, p.slug, locale),
    },
  };
}
