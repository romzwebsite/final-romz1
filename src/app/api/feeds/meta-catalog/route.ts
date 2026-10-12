import { getAllProducts, getCategories } from "@/lib/api";
import {
  CATALOG_BRAND,
  catalogImages,
  catalogPrice,
  catalogSalePrice,
  catalogText,
  productInStock,
  productPageUrl,
  siteOrigin,
} from "@/lib/catalog";
import type { Locale, Product } from "@/lib/types";

// Meta Commerce Manager product feed (RSS 2.0 with g: fields, the format Meta
// and Google Merchant Center both accept). Add it in Commerce Manager as a
// scheduled data feed so the catalog refreshes itself from the live store:
//   https://www.romz.net/api/feeds/meta-catalog          (English)
//   https://www.romz.net/api/feeds/meta-catalog?lang=ar  (Arabic language feed)
// One item per product; g:id is the product id, matching the pixel's content_ids.

export const dynamic = "force-dynamic";

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5000;
const MAX_EXTRA_IMAGES = 10;

// XML-escape and drop control characters that are invalid in XML 1.0.
const xml = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const tag = (name: string, value: string) => `    <g:${name}>${xml(value)}</g:${name}>\n`;

function itemXml(p: Product, origin: string, locale: Locale, categoryName: (slug: string) => string) {
  const images = catalogImages(p);
  const title = catalogText(p.name, locale).slice(0, MAX_TITLE);
  const description = (catalogText(p.description, locale) || title).slice(0, MAX_DESCRIPTION);
  const sale = catalogSalePrice(p);
  const categoryNames = p.categories.map(categoryName).filter(Boolean);

  let out = "  <item>\n";
  out += tag("id", p.id);
  out += tag("title", title);
  out += tag("description", description);
  out += tag("link", productPageUrl(origin, p.slug, locale));
  out += tag("image_link", images[0]);
  for (const extra of images.slice(1, 1 + MAX_EXTRA_IMAGES)) out += tag("additional_image_link", extra);
  out += tag("availability", productInStock(p) ? "in stock" : "out of stock");
  out += tag("condition", "new");
  out += tag("price", catalogPrice(p.basePrice));
  if (sale !== null) out += tag("sale_price", catalogPrice(sale));
  out += tag("brand", CATALOG_BRAND);
  out += tag("google_product_category", "Apparel & Accessories > Clothing");
  if (categoryNames[0]) out += tag("product_type", categoryNames[0]);
  // Every category the product is in (e.g. "Men, Women") for ad-set filters.
  if (categoryNames.length) out += tag("custom_label_0", categoryNames.join(", "));
  out += "  </item>\n";
  return out;
}

export async function GET(request: Request) {
  const locale: Locale = new URL(request.url).searchParams.get("lang") === "ar" ? "ar" : "en";
  const origin = siteOrigin(request.headers);

  let products: Product[];
  let names = new Map<string, string>();
  try {
    const [all, categories] = await Promise.all([getAllProducts(), getCategories()]);
    products = all;
    names = new Map(categories.map((c) => [c.slug, catalogText(c.name, locale)]));
  } catch (error) {
    console.error("[catalog feed] could not load products", error);
    return new Response("Catalog temporarily unavailable", { status: 503 });
  }

  // Meta rejects items without a photo, so those are left out of the feed.
  const items = products
    .filter((p) => catalogImages(p).length > 0)
    .map((p) => itemXml(p, origin, locale, (slug) => names.get(slug) ?? ""))
    .join("");

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `<channel>\n` +
    `  <title>${xml(CATALOG_BRAND)}</title>\n` +
    `  <link>${xml(origin)}</link>\n` +
    `  <description>${xml(`${CATALOG_BRAND} product catalog`)}</description>\n` +
    items +
    `</channel>\n</rss>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Meta fetches on its own schedule; a short CDN cache spares the API.
      "Cache-Control": "public, max-age=0, s-maxage=900",
    },
  });
}
