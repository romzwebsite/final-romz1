import type { CartItem, LocalizedText } from "./types";

export interface CollectionGroup {
  collectionId: string;
  name?: LocalizedText;
  bundlePrice: number;
  /** Full sets present = the min quantity across the collection's products. */
  sets: number;
  /** Sum of one unit of each product in the collection. */
  originalPerSet: number;
  /** Estimated saving vs. buying the items separately. */
  discount: number;
  items: CartItem[];
}

const round = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

// Groups the cart's collection-tagged items and estimates the bundle saving.
// Mirrors the backend; the server stays authoritative at checkout.
export function collectionGroups(items: CartItem[]): CollectionGroup[] {
  const map = new Map<string, CollectionGroup>();

  for (const it of items) {
    if (!it.collectionId) continue;
    const g =
      map.get(it.collectionId) ??
      ({
        collectionId: it.collectionId,
        name: it.collectionName,
        bundlePrice: it.collectionBundlePrice ?? 0,
        sets: 0,
        originalPerSet: 0,
        discount: 0,
        items: [],
      } as CollectionGroup);
    g.items.push(it);
    map.set(it.collectionId, g);
  }

  for (const g of map.values()) {
    const perProduct = new Map<string, { qty: number; unitPrice: number }>();
    for (const it of g.items) {
      const prev = perProduct.get(it.productId) ?? { qty: 0, unitPrice: it.unitPrice };
      prev.qty += it.qty;
      prev.unitPrice = it.unitPrice;
      perProduct.set(it.productId, prev);
    }
    const prods = [...perProduct.values()];
    g.sets = prods.length ? Math.min(...prods.map((p) => p.qty)) : 0;
    g.originalPerSet = round(prods.reduce((s, p) => s + p.unitPrice, 0));
    g.discount = round(Math.max(0, g.originalPerSet - g.bundlePrice) * g.sets);
  }

  return [...map.values()];
}

export function collectionsDiscount(items: CartItem[]): number {
  return round(
    collectionGroups(items).reduce((sum, g) => sum + g.discount, 0)
  );
}
