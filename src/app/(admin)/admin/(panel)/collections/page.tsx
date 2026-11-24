import { getAdminCollections, getCategories, getProducts } from "@/lib/api";
import { adminCall } from "@/lib/adminAuth";
import CollectionsClient from "./CollectionsClient";

export default async function AdminCollectionsPage() {
  const [collections, products, categories] = await Promise.all([
    adminCall((token) => getAdminCollections(token)),
    getProducts(),
    getCategories(),
  ]);

  return (
    <CollectionsClient
      collections={collections}
      products={products}
      categories={categories}
    />
  );
}
