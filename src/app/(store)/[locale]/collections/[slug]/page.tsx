import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCollectionBySlug } from "@/lib/api";
import CollectionDetailClient from "./CollectionDetailClient";
import type { Locale } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  return <CollectionDetailClient collection={collection} locale={locale as Locale} />;
}
