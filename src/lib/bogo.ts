// Client-side mirror of the backend Buy X Get Y calculation, used to preview
// the promo in the cart drawer before the authoritative total is computed at
// checkout. The backend remains the source of truth for the order.

export interface BogoLine {
  unitPrice: number;
  qty: number;
}

export interface BogoResult {
  /** Estimated amount saved (sum of the free units' prices). */
  discount: number;
  /** How many units are free right now. */
  freeUnits: number;
  /** How many more units to add to unlock the next free item (0 = none/pending). */
  itemsToNextFree: number;
}

const round = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function computeBogo(
  lines: BogoLine[],
  buyQuantity: number,
  freeQuantity: number
): BogoResult {
  const buy = Math.max(0, Math.floor(buyQuantity) || 0);
  const free = Math.max(0, Math.floor(freeQuantity) || 0);

  if (buy < 1 || free < 1) {
    return { discount: 0, freeUnits: 0, itemsToNextFree: 0 };
  }

  const groupSize = buy + free;

  // Expand every line into one price entry per unit.
  const prices: number[] = [];
  for (const line of lines) {
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0));
    const price = Number(line.unitPrice) || 0;
    for (let i = 0; i < qty; i += 1) prices.push(price);
  }

  const totalUnits = prices.length;
  // Most expensive first — the free slots in each group fall on the cheapest.
  prices.sort((a, b) => b - a);

  let discount = 0;
  let freeUnits = 0;
  for (let i = 0; i < totalUnits; i += 1) {
    if (i % groupSize >= buy) {
      discount += prices[i];
      freeUnits += 1;
    }
  }

  const inGroup = totalUnits % groupSize;
  const itemsToNextFree = inGroup === 0 ? 0 : groupSize - inGroup;

  return { discount: round(discount), freeUnits, itemsToNextFree };
}
