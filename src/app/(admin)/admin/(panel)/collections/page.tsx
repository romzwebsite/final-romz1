import { getAdminCollections, getProducts } from "@/lib/api";
import { adminCall } from "@/lib/adminAuth";
import CollectionsClient from "./CollectionsClient";

export default async function AdminCollectionsPage() {
  const [collections, products] = await Promise.all([
    adminCall((token) => getAdminCollections(token)),
    getProducts(),
  ]);

  return <CollectionsClient collections={collections} products={products} />;
}
