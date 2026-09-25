import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import LegalPage from "@/components/legal/LegalPage";
import { getPolicy } from "@/content/policies";
import { getStorefrontSettings } from "@/lib/storefrontSettings";
import type { Locale } from "@/lib/types";

export const metadata: Metadata = {
  title: "Refund & Return Policy — ROMZ",
  description: "How returns, exchanges and refunds work at ROMZ — 14-day returns.",
};

export default async function RefundPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Real email/phone from admin Settings replace the placeholders in the text.
  const { contactInfo } = await getStorefrontSettings();
  return (
    <LegalPage content={getPolicy("refund-policy", locale as Locale, contactInfo)} ghost="RETURNS" />
  );
}
