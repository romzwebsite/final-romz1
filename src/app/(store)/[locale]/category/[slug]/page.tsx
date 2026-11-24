import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCategories, getProducts } from "@/lib/api";
import CategoryClient from "./CategoryClient";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // The reserved "collections" category lists collections, not products.
  if (slug === "collections") redirect(`/${locale}/collections`);

  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const subcategories = categories.filter((c) => c.parentId === category.id);
  const parent = category.parentId
    ? categories.find((c) => c.id === category.parentId) ?? null
    : null;

  // A parent category page shows its own products plus everything in its
  // subcategories; a leaf/subcategory page shows just its own.
  const slugs = [category.slug, ...subcategories.map((s) => s.slug)];
  const products = (await getProducts()).filter((product) =>
    product.categories.some((productCategory) => slugs.includes(productCategory))
  );

  return (
    <CategoryClient
      category={category}
      parent={parent}
      subcategories={subcategories}
      products={products}
    />
  );
}
