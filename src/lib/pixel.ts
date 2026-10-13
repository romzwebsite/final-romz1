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

/**
 * Browser signals the backend needs for the Conversions API Purchase: the
 * pixel's _fbp / _fbc cookies and the page the purchase happens on.
 */
export function pixelServerTracking() {
  if (typeof document === "undefined") return { fbp: "", fbc: "", eventSourceUrl: "" };
  // Called inside checkout's submit: must never throw (e.g. on a malformed cookie)
  // or send a value over the order API's limits, which would reject the order.
  const cookie = (name: string, maxLength: number) => {
    const raw =
      document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${name}=`))
        ?.slice(name.length + 1) ?? "";
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {}
    value = value.trim();
    return value.length <= maxLength ? value : "";
  };
  const url = `${window.location.origin}${window.location.pathname}`;
  return {
    fbp: cookie("_fbp", 200),
    fbc: cookie("_fbc", 500),
    eventSourceUrl: url.length <= 1000 ? url : "",
  };
}

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

/**
 * Standard e-commerce params from a list of line items. Line ids are variant
 * SKUs — the item ids in the Meta catalog feed (lib/catalog).
 */
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
