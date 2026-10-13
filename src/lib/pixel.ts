// Meta Pixel standard events for the storefront (see components/analytics/MetaPixel).
//
// Events can fire before the pixel script has run — e.g. ViewContent on a
// product page opened straight from an ad, because page effects run before the
// afterInteractive pixel script. Those calls wait in a queue that the pixel
// script flushes right after `fbq('init')`, so nothing is lost. With an ad
// blocker the pixel never loads and the queue is simply never sent.
//
// ViewContent, AddToCart and InitiateCheckout are also sent server-side
// (Conversions API): trackPixelAndServer gives the browser event an eventID and
// posts the same id to the backend, so Meta keeps one of the two. Purchase is
// sent server-side by the backend itself when the order is confirmed.

import { CUSTOMER_STORAGE_KEY, type AuthSession } from "./auth";

export type PixelEvent = "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";
type ServerRelayedEvent = Exclude<PixelEvent, "Purchase">;

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

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");

// The order and event APIs reject longer values (see the backend validation).
const MAX_FBP = 200;
const MAX_FBC = 500;
const MAX_URL = 2000;

/** A cookie value, or "" when missing, malformed or too long. Never throws. */
function readCookie(name: string, maxLength: number) {
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
}

/**
 * Browser signals the backend needs for the Conversions API Purchase: the
 * pixel's _fbp / _fbc cookies and the page the purchase happens on.
 */
export function pixelServerTracking() {
  if (typeof document === "undefined") return { fbp: "", fbc: "", eventSourceUrl: "" };
  // Called inside checkout's submit: must never throw (e.g. on a malformed cookie)
  // or send a value over the order API's limits, which would reject the order.
  const url = `${window.location.origin}${window.location.pathname}`;
  return {
    fbp: readCookie("_fbp", MAX_FBP),
    fbc: readCookie("_fbc", MAX_FBC),
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

/** A unique id for one interaction, shared by the browser and server events. */
export function newPixelEventId(prefix: string) {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}.${id}`;
}

function signedInCustomer() {
  try {
    const raw = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
    const user = raw ? (JSON.parse(raw) as AuthSession).user : null;
    return user ? { email: user.email ?? "", phone: user.phone ?? "", name: user.name ?? "" } : undefined;
  } catch {
    return undefined;
  }
}

/** Up to `maxMs` for the pixel to set _fbp (it may still be loading). */
async function waitForFbp(maxMs: number) {
  const start = Date.now();
  while (!readCookie("_fbp", MAX_FBP) && Date.now() - start < maxMs) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function relayToServer(
  eventName: ServerRelayedEvent,
  eventId: string,
  items: { sku: string; qty: number }[]
) {
  if (!API_URL || items.length === 0) return;
  try {
    await waitForFbp(3000);
    const { origin, pathname, search } = window.location;
    const fullUrl = `${origin}${pathname}${search}`;
    await fetch(`${API_URL}/storefront-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      // Still delivered if the shopper navigates away right after.
      keepalive: true,
      body: JSON.stringify({
        eventName,
        eventId,
        eventSourceUrl: fullUrl.length <= MAX_URL ? fullUrl : `${origin}${pathname}`,
        items,
        fbp: readCookie("_fbp", MAX_FBP),
        fbc: readCookie("_fbc", MAX_FBC),
        customer: signedInCustomer(),
      }),
    });
  } catch {
    // Server-side tracking is best effort; the browser event already went out.
  }
}

/**
 * Sends an event from the browser pixel and, with the same eventID, from the
 * server (Conversions API). Line ids are variant SKUs, as in the catalog feed.
 */
export function trackPixelAndServer(
  event: ServerRelayedEvent,
  params: Record<string, unknown>,
  eventID: string,
  items: { sku: string; qty: number }[]
) {
  if (typeof window === "undefined") return;
  trackPixel(event, params, { eventID });
  void relayToServer(event, eventID, items);
}

/** What was last reported for `key` in this tab (sessionStorage), if anything. */
export function lastTracked(key: string): string | null {
  try {
    return window.sessionStorage.getItem(`romz_pixel_${key}`);
  } catch {
    return null;
  }
}

export function rememberTracked(key: string, value: string) {
  try {
    window.sessionStorage.setItem(`romz_pixel_${key}`, value);
  } catch {}
}

/**
 * True when the shopper refreshed the page they're on now (not when they
 * refreshed another page and then navigated here client-side).
 */
export function isPageReload() {
  try {
    const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    const withoutHash = (url: string) => url.split("#")[0];
    return nav?.type === "reload" && withoutHash(nav.name) === withoutHash(window.location.href);
  } catch {
    return false;
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
