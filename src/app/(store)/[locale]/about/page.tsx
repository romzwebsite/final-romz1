import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import LegalPage from "@/components/legal/LegalPage";
import { getPolicy } from "@/content/policies";
import { getStorefrontSettings } from "@/lib/storefrontSettings";
import type { Locale } from "@/lib/types";

export const metadata: Metadata = {
  title: "About Us — ROMZ",
  description: "ROMZ is an Egyptian performance activewear brand. Wear your power.",
};

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Real email/phone from admin Settings replace the placeholders in the text.
  const { contactInfo } = await getStorefrontSettings();
  return <LegalPage content={getPolicy("about", locale as Locale, contactInfo)} ghost="ROMZ" />;
}
