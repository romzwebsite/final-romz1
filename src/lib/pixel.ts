// Meta Pixel standard events for the storefront (see components/analytics/MetaPixel).
//
// Events can fire before the pixel script has run — e.g. ViewContent on a
// product page opened straight from an ad, because page effects run before the
// afterInteractive pixel script. Those calls wait in a queue that the pixel
// script flushes right after `fbq('init')`, so nothing is lost. With an ad
// blocker the pixel never loads and the queue is simply never sent.

export type PixelEvent = "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";

export interface PixelContent {
  id: string;
  quantity: number;
  item_price: number;
}

type FbqArgs = unknown[];

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    /** Pixel calls made before the pixel script ran; flushed by MetaPixel. */
    __romzPixelQueue?: FbqArgs[];
  }
}

export const PIXEL_CURRENCY = "EGP";

export function trackPixel(
  event: PixelEvent,
  params: Record<string, unknown>,
  options?: { eventID?: string }
) {
  if (typeof window === "undefined") return;
  const args: FbqArgs = options?.eventID
    ? ["track", event, params, { eventID: options.eventID }]
    : ["track", event, params];
  // Tracking must never break the flow around it (e.g. a COD order that was
  // just created), so errors from the third-party script are swallowed.
  try {
    if (window.fbq) {
      window.fbq(...args);
    } else {
      (window.__romzPixelQueue ??= []).push(args);
    }
  } catch (error) {
    console.warn("[pixel] tracking failed", error);
  }
}

/** Standard e-commerce params from a list of line items. */
export function pixelCartParams(contents: PixelContent[], value: number) {
  return {
    content_type: "product",
    content_ids: [...new Set(contents.map((c) => c.id))],
    contents,
    num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
    value: Math.round(value * 100) / 100,
    currency: PIXEL_CURRENCY,
  };
}
