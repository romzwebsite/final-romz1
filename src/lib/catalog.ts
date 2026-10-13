// Product data for Meta's catalog: the scheduled feed (app/api/feeds/meta-catalog)
// and the structured data on product pages.
//
// Catalog shape (Meta's recommended setup for apparel): one item per variant
// (color + size) whose id is the variant SKU, grouped by item_group_id = the
// product id. The pixel sends the product id with content_type "product_group"
// on product views (no size picked yet) and the variant SKUs with content_type
// "product" on AddToCart / InitiateCheckout / Purchase, so every event matches
// either an item id or a group id.

import { withCategoryImages } from "./product";
import type { Locale, LocalizedText, Product, Variant } from "./types";

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

/**
 * What a variant sells for — the same rule as the cart: a variant price
 * override replaces the product price (shown without a sale price).
 */
export function variantPricing(p: Product, v: Variant): { price: number; sale: number | null } {
  if (v.priceOverride != null) return { price: v.priceOverride, sale: null };
  return { price: p.basePrice, sale: catalogSalePrice(p) };
}

export const catalogPrice = (amount: number) => `${amount.toFixed(2)} ${CATALOG_CURRENCY}`;

export const productPageUrl = (origin: string, slug: string, locale: Locale) =>
  `${origin}/${locale}/product/${encodeURIComponent(slug)}`;

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);
const normHex = (hex?: string) => hex?.trim().toLowerCase() ?? "";

/** Photos in storefront order for the product's main category (main photo first). */
export const catalogImages = (p: Product) =>
  withCategoryImages(p)
    .images.map((image) => image.url)
    .filter(isHttpUrl);

/** Same photos, with the ones tagged with this color first. */
export function variantImages(p: Product, colorHex: string) {
  const images = withCategoryImages(p).images;
  const color = normHex(colorHex);
  const matching = images.filter((image) => normHex(image.color) === color);
  const rest = images.filter((image) => normHex(image.color) !== color);
  return [...matching, ...rest].map((image) => image.url).filter(isHttpUrl);
}

/**
 * schema.org ProductGroup for the product page (read by Meta's pixel and by
 * search engines): the product id as the group, one Product per variant SKU.
 */
export function productJsonLd(p: Product, origin: string, locale: Locale) {
  const name = catalogText(p.name, locale);
  const url = productPageUrl(origin, p.slug, locale);
  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    productGroupID: p.id,
    name,
    description: catalogText(p.description, locale) || name,
    image: catalogImages(p),
    url,
    brand: { "@type": "Brand", name: CATALOG_BRAND },
    variesBy: ["https://schema.org/size", "https://schema.org/color"],
    hasVariant: p.variants.map((v) => {
      const { price, sale } = variantPricing(p, v);
      const color = catalogText(v.color.name, locale);
      return {
        "@type": "Product",
        sku: v.sku,
        productID: v.sku,
        name: `${name} - ${color} / ${v.size}`,
        color,
        size: v.size,
        image: variantImages(p, v.color.hex)[0],
        offers: {
          "@type": "Offer",
          price: (sale ?? price).toFixed(2),
          priceCurrency: CATALOG_CURRENCY,
          availability:
            v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          url,
        },
      };
    }),
  };
}
