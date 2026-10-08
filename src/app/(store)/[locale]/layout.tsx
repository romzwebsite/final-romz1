import type { Metadata } from "next";
import { Anton, Be_Vietnam_Pro, Cairo } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CartProvider } from "@/components/cart/CartProvider";
import CartDrawer from "@/components/cart/CartDrawer";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PromoBar from "@/components/layout/PromoBar";
import MetaPixel from "@/components/analytics/MetaPixel";
import { getCategoryTree } from "@/lib/api";
import { getStorefrontSettings } from "@/lib/storefrontSettings";
import type { Category } from "@/lib/types";
import "@/app/globals.css";

// Anton stands in for SF Kleeshay (brand display face, not a free webfont).
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});
// "Be Vietnam" is the body typeface named in the ROMZ brand book (page 8).
const beVietnam = Be_Vietnam_Pro({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-body",
});
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "ROMZ — Wear Your Power",
  description:
    "ROMZ performance activewear. Wear your power. Made in Egypt.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// The storefront reads live catalog data on every request (no-store fetches),
// so it renders dynamically rather than being prerendered at build time.
export const dynamic = "force-dynamic";

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  // Storefront navigation is driven by the live category tree — no hardcoded
  // links. If the backend is unreachable the header simply renders its static
  // entries (home, track order).
  let categories: Category[] = [];
  const settings = await getStorefrontSettings();
  try {
    categories = await getCategoryTree();
  } catch {
    categories = [];
  }

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className={`${anton.variable} ${beVietnam.variable} ${cairo.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <CartProvider>
              <PromoBar locale={locale} promoBar={settings.promoBar} />
              <Header categories={categories} />
              <main>{children}</main>
              <Footer categories={categories} />
              <CartDrawer />
            </CartProvider>
          </AuthProvider>
        </NextIntlClientProvider>
        {/* Storefront only — the admin panel has its own layout and isn't tracked. */}
        <MetaPixel />
      </body>
    </html>
  );
}
