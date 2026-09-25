import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import LegalPage from "@/components/legal/LegalPage";
import { getPolicy } from "@/content/policies";
import { getStorefrontSettings } from "@/lib/storefrontSettings";
import type { Locale } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shipping Policy — ROMZ",
  description: "Delivery coverage, times and fees for ROMZ orders across Egypt.",
};

export default async function ShippingPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Real email/phone from admin Settings replace the placeholders in the text.
  const { contactInfo } = await getStorefrontSettings();
  return (
    <LegalPage content={getPolicy("shipping-policy", locale as Locale, contactInfo)} ghost="SHIPPING" />
  );
}
