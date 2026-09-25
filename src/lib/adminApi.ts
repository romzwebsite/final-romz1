// Client-side admin mutations. These run in "use client" components inside
// /admin: the admin JWT lives in a non-httpOnly cookie set by the login page,
// so the browser can call the backend directly with a Bearer header.
//
// Read paths stay in ./api (server components via adminCall); everything
// here writes.

import type {
  Badge,
  Category,
  ContactInfo,
  ContactMessage,
  ContactStatus,
  FabricCare,
  Faq,
  Order,
  OrderStatus,
  PageMeta,
  Product,
  ProductImage,
  ShippingReturns,
  SizeChart,
  StorefrontSettings,
  Variant,
} from "./types";
import type {
  ContactListParams,
  ContactListResult,
  Granularity,
  RevenuePoint,
} from "./api";
import { contactListQuery, mapContactMessage, mapProduct } from "./api";
import {
  normalizeContactInfo,
  normalizeFaqs,
  normalizeShippingReturns,
  normalizeStorefrontSettings,
} from "./storefrontSettings";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
const ADMIN_TOKEN_COOKIE = "romz_admin_token";
const ADMIN_REFRESH_TOKEN_COOKIE = "romz_admin_refresh_token";
// Keep in sync with JWT_ACCESS_EXPIRES_IN in backend/.env (12h).
const TOKEN_MAX_AGE_SECONDS = 12 * 60 * 60;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function readCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function readToken(): string | null {
  return readCookie(ADMIN_TOKEN_COOKIE);
}

export function readAdminRefreshToken(): string | null {
  return readCookie(ADMIN_REFRESH_TOKEN_COOKIE);
}

export function hasUsableAdminToken(): boolean {
  const token = readToken();
  if (!token) return false;

  try {
    const [, payload] = token.split(".");
    if (!payload) return true;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized)) as { exp?: unknown };
    if (typeof decoded.exp !== "number") return true;
    return decoded.exp * 1000 > Date.now() + 60 * 1000;
  } catch {
    return true;
  }
}

function writeToken(token: string) {
  document.cookie = `${ADMIN_TOKEN_COOKIE}=${token}; path=/; max-age=${TOKEN_MAX_AGE_SECONDS}; samesite=lax`;
}

export function writeAdminRefreshToken(token: string) {
  document.cookie = `${ADMIN_REFRESH_TOKEN_COOKIE}=${token}; path=/; max-age=${REFRESH_TOKEN_MAX_AGE_SECONDS}; samesite=lax`;
}

export function clearAdminToken() {
  document.cookie = `${ADMIN_TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
  document.cookie = `${ADMIN_REFRESH_TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

function redirectToLogin(): never {
  clearAdminToken();
  window.location.href = "/admin/login";
  throw new Error("Admin session expired — redirecting to login.");
}

let adminRefreshPromise: Promise<string | null> | null = null;

async function requestAdminRefresh(refreshToken?: string | null) {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: refreshToken ? "omit" : "include",
    ...(refreshToken
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        }
      : {}),
  });
  const body = await res.json().catch(() => null);
  return { res, body };
}

// Exchanges the admin refresh token for a fresh access token and stores both
// when the backend rotates them. Concurrent 401s share one refresh request.
async function performAdminRefresh(): Promise<string | null> {
  if (!API_URL) return null;
  try {
    const refreshToken = readAdminRefreshToken();
    let { res, body } = await requestAdminRefresh(refreshToken);
    if (!res.ok && refreshToken && res.status === 401) {
      ({ res, body } = await requestAdminRefresh());
    }
    if (!res.ok) return null;
    const token: string | undefined = body?.data?.accessToken;
    const nextRefreshToken: string | undefined = body?.data?.refreshToken;
    const role: string | undefined = body?.data?.user?.role;
    if (!token || role !== "admin") return null;
    writeToken(token);
    if (nextRefreshToken) writeAdminRefreshToken(nextRefreshToken);
    return token;
  } catch {
    return null;
  }
}

export function refreshAdminToken(): Promise<string | null> {
  if (!adminRefreshPromise) {
    adminRefreshPromise = performAdminRefresh().finally(() => {
      adminRefreshPromise = null;
    });
  }
  return adminRefreshPromise;
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  /** Present on paginated list endpoints. */
  meta?: PageMeta;
}

// Core request: returns the full envelope so list callers can read `meta`.
// `adminFetch` wraps this for the common "just want data" case.
async function adminRequest<T>(
  path: string,
  init: { method: string; json?: unknown; formData?: FormData },
  retried = false
): Promise<Envelope<T>> {
  if (!API_URL) {
    throw new Error(
      "Backend is not configured (NEXT_PUBLIC_API_URL is missing)."
    );
  }

  // Use the current access token, or try a silent refresh before giving up.
  let token = readToken();
  if (!token) {
    token = await refreshAdminToken();
    if (!token) redirectToLogin();
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body:
      init.json !== undefined ? JSON.stringify(init.json) : init.formData,
  });

  // Expired/invalid token → refresh once and retry, then give up to login.
  if (res.status === 401) {
    if (!retried && (await refreshAdminToken())) {
      return adminRequest<T>(path, init, true);
    }
    redirectToLogin();
  }

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    // 204 No Content or non-JSON error body
  }
  if (!res.ok) {
    if (res.status === 413) {
      throw new Error(
        "Upload is too large for the server. Use fewer images or smaller source files and try again."
      );
    }
    // Validation errors put the specific field messages in `data` (an array
    // of strings). Surface them so the admin sees exactly what to fix.
    const details = Array.isArray(body?.data)
      ? (body.data as unknown[]).filter((d) => typeof d === "string").join(" · ")
      : "";
    const base = body?.message ?? `Request failed (${res.status})`;
    throw new Error(details ? `${base}: ${details}` : base);
  }
  return body ?? ({ success: true, message: "", data: undefined as T });
}

async function adminFetch<T>(
  path: string,
  init: { method: string; json?: unknown; formData?: FormData },
  retried = false
): Promise<T> {
  const body = await adminRequest<T>(path, init, retried);
  return body.data as T;
}

// ── Products ────────────────────────────────────────────
// The backend expects multipart/form-data with JSON-string fields. Existing
// product photos travel through `existingImages`; newly selected files are
// appended under `images`, with `imageColors` aligned to those files only.

export interface ProductPayload {
  name: { en: string; ar: string };
  description: { en: string; ar: string };
  slug: string;
  category: string; // legacy single category _id fallback
  categories?: string[]; // all category _ids the product belongs to
  basePrice: number;
  salePrice: number | null;
  badges: Badge[];
  images: ProductImage[]; // existing hosted images to keep (each may carry a color hex)
  imageFiles?: File[]; // new images picked from the admin's device
  imageFileColors?: (string | undefined)[]; // color hex per new file (aligned to imageFiles)
  imageFileCategoryIds?: string[][]; // category ids per new file (aligned to imageFiles)
  imageFileMainForIds?: string[][]; // categories each new file is the main image of
  variants: Variant[];
  isActive: boolean;
  sizeChart: SizeChart; // localized measurement table (empty chart clears it)
  fabricCare: FabricCare; // localized fabric + care (empty strings clear it)
}

function productFormData(
  payload: ProductPayload,
  { includeExistingImages }: { includeExistingImages: boolean }
): FormData {
  const fd = new FormData();
  fd.set("name", JSON.stringify(payload.name));
  fd.set("description", JSON.stringify(payload.description));
  fd.set("slug", payload.slug);
  fd.set("category", payload.category);
  // All selected categories. The legacy `category` field above is kept only as
  // a compatibility fallback for older backend validation.
  fd.set("categories", JSON.stringify(payload.categories ?? [payload.category]));
  fd.set("basePrice", String(payload.basePrice));
  if (payload.salePrice !== null) {
    fd.set("salePrice", String(payload.salePrice));
  }
  fd.set("badges", JSON.stringify(payload.badges));
  if (includeExistingImages) {
    const existingImages = payload.images.map((image) => ({
      url: image.backendUrl ?? image.url,
      publicId: image.publicId ?? "",
      color: image.color ?? "",
      categories: image.categoryIds ?? [],
      mainFor: image.mainForIds ?? [],
    }));
    fd.set("existingImages", JSON.stringify(existingImages));
  }
  const imageFiles = payload.imageFiles ?? [];
  imageFiles.forEach((file) => fd.append("images", file));
  if (imageFiles.length > 0) {
    fd.set(
      "imageColors",
      JSON.stringify(
        imageFiles.map((_, index) => payload.imageFileColors?.[index] ?? "")
      )
    );
    fd.set(
      "imageCategories",
      JSON.stringify(
        imageFiles.map((_, index) => payload.imageFileCategoryIds?.[index] ?? [])
      )
    );
    fd.set(
      "imageMainFor",
      JSON.stringify(
        imageFiles.map((_, index) => payload.imageFileMainForIds?.[index] ?? [])
      )
    );
  }
  fd.set(
    "variants",
    JSON.stringify(
      payload.variants.map((v) => ({
        sku: v.sku,
        size: v.size,
        // The backend stores color names as plain strings.
        color: { name: v.color.name.en, hex: v.color.hex },
        stock: v.stock,
        priceOverride: v.priceOverride ?? null,
      }))
    )
  );
  // Object fields go as JSON strings — the backend JSON.parses them. Rows are
  // normalized to the column count so each row matches the header width.
  const columnCount = payload.sizeChart.columns.length;
  fd.set(
    "sizeChart",
    JSON.stringify({
      columns: payload.sizeChart.columns,
      rows:
        columnCount === 0
          ? []
          : payload.sizeChart.rows.map((row) =>
              Array.from({ length: columnCount }, (_, i) => row[i] ?? "")
            ),
      note: payload.sizeChart.note,
    })
  );
  fd.set(
    "fabricCare",
    JSON.stringify({
      fabric: payload.fabricCare.fabric,
      care: payload.fabricCare.care,
    })
  );
  fd.set("isActive", String(payload.isActive));
  return fd;
}

export async function createProduct(payload: ProductPayload): Promise<{ _id: string }> {
  const { product } = await adminFetch<{ product: { _id: string } }>("/products", {
    method: "POST",
    formData: productFormData(payload, { includeExistingImages: false }),
  });
  return product;
}

export async function updateProduct(id: string, payload: ProductPayload): Promise<void> {
  await adminFetch(`/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    formData: productFormData(payload, { includeExistingImages: true }),
  });

  // Multipart scalar parsing cannot represent null. A small JSON PATCH is the
  // documented way to remove an existing product-wide sale.
  if (payload.salePrice === null) {
    await adminFetch(`/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      json: { salePrice: null },
    });
  }
}

export async function getAdminProduct(id: string): Promise<Product> {
  const { product } = await adminFetch<{
    product: Parameters<typeof mapProduct>[0];
  }>(`/products/admin/${encodeURIComponent(id)}`, { method: "GET" });
  return mapProduct(product);
}

export async function deleteProduct(id: string): Promise<void> {
  await adminFetch(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Categories ──────────────────────────────────────────

export interface CategoryPayload {
  name: { en: string; ar: string };
  slug: string;
  /** Parent category _id — omit / null for a top-level category. */
  parent?: string | null;
  order?: number;
  imageFile?: File | null;
  removeImage?: boolean;
}

function categoryRequest(payload: Partial<CategoryPayload>) {
  const fd = new FormData();
  if (payload.name !== undefined) fd.set("name", JSON.stringify(payload.name));
  if (payload.slug !== undefined) fd.set("slug", payload.slug);
  if (payload.parent !== undefined) fd.set("parent", payload.parent ?? "");
  if (payload.order !== undefined) fd.set("order", String(payload.order));
  if (payload.removeImage !== undefined) {
    fd.set("removeImage", String(payload.removeImage));
  }

  if (payload.imageFile) {
    fd.set("image", payload.imageFile);
  }

  return { formData: fd };
}

export async function createCategory(payload: CategoryPayload): Promise<Category> {
  const request = categoryRequest(payload);
  const { category } = await adminFetch<{ category: { _id: string } }>("/categories", {
    method: "POST",
    ...request,
  });
  return {
    id: category._id,
    slug: payload.slug,
    name: payload.name,
    order: payload.order ?? 0,
    parentId: payload.parent ?? null,
  };
}

export async function updateCategory(id: string, payload: Partial<CategoryPayload>): Promise<void> {
  const request = categoryRequest(payload);
  await adminFetch(`/categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    ...request,
  });
}

export async function deleteCategory(id: string): Promise<void> {
  await adminFetch(`/categories/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Coupons ─────────────────────────────────────────────

export interface CouponPayload {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrderTotal?: number;
  expiresAt?: string;
  usageLimit?: number;
  isActive?: boolean;
}

export async function createCoupon(payload: CouponPayload): Promise<void> {
  await adminFetch("/coupons", { method: "POST", json: payload });
}

export async function updateCoupon(id: string, payload: Partial<CouponPayload>): Promise<void> {
  await adminFetch(`/coupons/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: payload,
  });
}

export async function deleteCoupon(id: string): Promise<void> {
  await adminFetch(`/coupons/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Contact ─────────────────────────────────────────────
// The public POST /contact lives in ./api. These admin reads/writes run in the
// browser with the login-cookie Bearer token. Never exposed on the storefront.

interface BeContactMessage {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: ContactStatus;
  adminNotes?: string;
  source?: string;
  ipAddress?: string;
  userAgent?: string;
  user?: string | { _id?: string } | null;
  readAt?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchContactMessages(
  params: ContactListParams
): Promise<ContactListResult> {
  const body = await adminRequest<{ messages: BeContactMessage[] }>(
    `/contact?${contactListQuery(params)}`,
    { method: "GET" }
  );
  return {
    messages: (body.data?.messages ?? []).map(mapContactMessage),
    meta:
      body.meta ?? {
        page: params.page ?? 1,
        limit: params.limit ?? 12,
        total: body.data?.messages?.length ?? 0,
        pages: 1,
      },
  };
}

export interface ContactUpdatePayload {
  status?: ContactStatus;
  adminNotes?: string;
}

export async function updateContactMessage(
  id: string,
  payload: ContactUpdatePayload
): Promise<ContactMessage> {
  const { message } = await adminFetch<{ message: BeContactMessage }>(
    `/contact/${encodeURIComponent(id)}`,
    { method: "PATCH", json: payload }
  );
  return mapContactMessage(message);
}

export async function deleteContactMessage(id: string): Promise<void> {
  await adminFetch(`/contact/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Shipping zones ──────────────────────────────────────
// GET is public (see api.ts getShippingZones); create/update/delete are admin.

export interface ShippingZonePayload {
  governorate: string;
  fee: number;
  estimatedDays?: string;
  isActive?: boolean;
}

export async function createShippingZone(payload: ShippingZonePayload): Promise<void> {
  await adminFetch("/shipping-zones", { method: "POST", json: payload });
}

export async function updateShippingZone(
  id: string,
  payload: Partial<ShippingZonePayload>
): Promise<void> {
  await adminFetch(`/shipping-zones/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: payload,
  });
}

export async function deleteShippingZone(id: string): Promise<void> {
  await adminFetch(`/shipping-zones/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Reviews (moderation) ────────────────────────────────
// Customer reviews arrive pending (isApproved: false) and only show on the
// storefront once approved. GET list is api.ts getAdminReviews.

export async function approveReview(id: string): Promise<void> {
  await adminFetch(`/reviews/${encodeURIComponent(id)}/approve`, { method: "PATCH" });
}

export async function deleteReview(id: string): Promise<void> {
  await adminFetch(`/reviews/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// Storefront settings are persisted by the backend. This replaces the old
// frontend-local JSON settings file so checkout and admin share one source.
export async function updateStorefrontSettings(
  settings: StorefrontSettings
): Promise<StorefrontSettings> {
  const data = await adminFetch<{ settings: unknown }>(
    "/admin/storefront-settings",
    {
      method: "PATCH",
      json: {
        promoBar: {
          en: settings.promoBar.text.en,
          ar: settings.promoBar.text.ar,
          active: settings.promoBar.active,
        },
        payments: settings.payments,
        freeShippingThreshold: settings.freeShippingThreshold,
        lowStockThreshold: settings.lowStockThreshold,
      },
    }
  );
  return normalizeStorefrontSettings(data.settings);
}

/**
 * Replace the whole FAQ array. The backend swaps `faqs` wholesale, so we send
 * the full current list. Existing items keep their _id (so the backend updates
 * in place); new items omit it.
 */
export async function updateFaqs(faqs: Faq[]): Promise<Faq[]> {
  const data = await adminFetch<{ settings: { faqs?: unknown } }>(
    "/admin/storefront-settings",
    {
      method: "PATCH",
      json: {
        faqs: faqs.map((f) => ({
          ...(f.id ? { _id: f.id } : {}),
          question: f.question,
          answer: f.answer,
          isActive: f.isActive,
          order: f.order,
        })),
      },
    }
  );
  return normalizeFaqs(data.settings?.faqs);
}

/**
 * Patch the Shipping & Returns block (shallow-merged). A full save sends
 * { isActive, title, body }; a quick hide can send just { isActive: false }.
 */
export async function updateShippingReturns(
  shippingReturns: ShippingReturns | Partial<ShippingReturns>
): Promise<ShippingReturns> {
  const data = await adminFetch<{ settings: { shippingReturns?: unknown } }>(
    "/admin/storefront-settings",
    { method: "PATCH", json: { shippingReturns } }
  );
  return normalizeShippingReturns(data.settings?.shippingReturns);
}

/**
 * Patch the store contact details (shallow-merged). Full save sends all
 * fields; a quick hide can send just { isActive: false }.
 */
export async function updateContactInfo(
  contactInfo: ContactInfo | Partial<ContactInfo>
): Promise<ContactInfo> {
  const data = await adminFetch<{ settings: { contactInfo?: unknown } }>(
    "/admin/storefront-settings",
    { method: "PATCH", json: { contactInfo } }
  );
  return normalizeContactInfo(data.settings?.contactInfo);
}

// ── Analytics (client-side) ─────────────────────────────
// The revenue chart re-fetches when the admin switches granularity, so it
// runs in the browser with the token from the login cookie.

interface BeRevenuePoint {
  period: string;
  revenue: number;
  orders: number;
  byPaymentMethod?: { paymentMethod: string; revenue: number; orders: number }[];
}

export async function fetchRevenueSeries(
  granularity: Granularity
): Promise<RevenuePoint[]> {
  const { series } = await adminFetch<{ series: BeRevenuePoint[] }>(
    `/analytics/revenue-series?granularity=${granularity}`,
    { method: "GET" }
  );
  return series.map((point) => {
    const byMethod = point.byPaymentMethod ?? [];
    const find = (m: string) =>
      byMethod.find((b) => b.paymentMethod === m)?.revenue ?? 0;
    return {
      period: point.period,
      revenue: point.revenue,
      paymob: find("paymob"),
      cod: find("cod"),
      orders: point.orders,
    };
  });
}

// ── Orders ──────────────────────────────────────────────

export type AdminOrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export async function updateOrderStatus(
  id: string,
  status: AdminOrderStatus,
  note?: string
): Promise<void> {
  await adminFetch(`/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    json: { status, ...(note ? { note } : {}) },
  });
}

// Mylerz courier integration. All calls go through adminFetch, so the admin
// Bearer token and refresh-once behavior are applied consistently.

export interface MylerzWarehouse {
  /** Mylerz warehouse name (.Name) — sent back as `warehouseName` on a shipment. */
  name: string;
}

/** A delivery zone (neighborhood) inside a Mylerz city. */
export interface MylerzZone {
  code: string;
  enName: string;
  arName: string;
}

/**
 * A Mylerz city with its nested delivery zones (from CityDTO). The shipment
 * needs the city `.Code` as cityCode and the selected zone `.Code` as
 * neighborhoodCode — free-text city/governorate is rejected by Mylerz.
 */
export interface MylerzCity {
  code: string;
  enName: string;
  arName: string;
  zones: MylerzZone[];
}

// Per the courier API, cityCode + neighborhoodCode must be real Mylerz codes;
// omitting them falls back to the order's free-text address, which usually
// fails Mylerz validation. warehouseName defaults to the account's warehouse.
export interface MylerzShipmentPayload {
  warehouseName?: string;
  cityCode?: string;
  neighborhoodCode?: string;
  totalWeight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  specialNotes?: string;
}

export interface MylerzExpectedChargesInput {
  /** Cash to collect — the order total for COD, 0 for prepaid. */
  codValue: number;
  warehouseName: string;
  /** Mylerz zone (.Code) the parcel is delivered to. */
  customerZoneCode: string;
  packageWeight: number;
  paymentTypeCode: "COD" | "PP";
}

export interface MylerzCharges {
  shippingFees: number;
  vat: number;
  totalTransfer: number;
  codValue: number;
}

export interface MylerzShipmentResult {
  courier?: Order["courier"];
}

type MaybeList<T> = T[] | Record<string, unknown>;

function listFromResponse<T>(data: MaybeList<T>, keys: string[]): T[] {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

function courierFromResponse(data: Record<string, unknown>): Order["courier"] {
  const order = data.order as { courier?: Order["courier"] } | undefined;
  const shipment = (data.shipment ?? data.package) as
    | Record<string, unknown>
    | undefined;
  const courier = (data.courier as Order["courier"] | undefined) ?? order?.courier;
  return {
    provider: courier?.provider ?? "mylerz",
    trackingNumber:
      courier?.trackingNumber ??
      (data.trackingNumber as string | undefined) ??
      (data.awb as string | undefined) ??
      (data.AWB as string | undefined) ??
      (shipment?.trackingNumber as string | undefined) ??
      (shipment?.awb as string | undefined) ??
      (shipment?.AWB as string | undefined),
    pickupOrderCode:
      courier?.pickupOrderCode ??
      (data.pickupOrderCode as string | undefined) ??
      (data.PickupOrderCode as string | undefined) ??
      (shipment?.pickupOrderCode as string | undefined) ??
      (shipment?.PickupOrderCode as string | undefined),
    status:
      courier?.status ??
      (data.status as string | undefined) ??
      (shipment?.status as string | undefined),
  };
}

export async function getMylerzWarehouses(): Promise<MylerzWarehouse[]> {
  const data = await adminFetch<MaybeList<Record<string, unknown>>>(
    "/couriers/mylerz/warehouses",
    { method: "GET" }
  );
  return listFromResponse<Record<string, unknown>>(data, ["warehouses", "items"])
    .map((w) => ({
      name: String(w.Name ?? w.name ?? w.warehouseName ?? ""),
    }))
    .filter((w) => w.name.length > 0);
}

export async function getMylerzCityZones(): Promise<MylerzCity[]> {
  const data = await adminFetch<MaybeList<Record<string, unknown>>>(
    "/couriers/mylerz/city-zones",
    { method: "GET" }
  );
  const cities = listFromResponse<Record<string, unknown>>(data, [
    "zones",
    "cityZones",
    "items",
  ]);
  return cities
    .map((c) => ({
      code: String(c.Code ?? ""),
      enName: String(c.EnName ?? c.Code ?? ""),
      arName: String(c.ArName ?? ""),
      zones: Array.isArray(c.Zones)
        ? (c.Zones as Record<string, unknown>[])
            .map((z) => ({
              code: String(z.Code ?? ""),
              enName: String(z.EnName ?? z.Code ?? ""),
              arName: String(z.ArName ?? ""),
            }))
            .filter((z) => z.code.length > 0)
        : [],
    }))
    .filter((c) => c.code.length > 0);
}

export async function getMylerzExpectedCharges(
  input: MylerzExpectedChargesInput
): Promise<MylerzCharges> {
  const data = await adminFetch<{ charges?: Record<string, unknown> }>(
    "/couriers/mylerz/expected-charges",
    {
      method: "POST",
      json: {
        codValue: input.codValue,
        warehouseName: input.warehouseName,
        customerZoneCode: input.customerZoneCode,
        packageWeight: input.packageWeight,
        isFulfillment: false,
        packageServiceTypeCode: "DTD",
        packageServiceCode: "ND",
        paymentTypeCode: input.paymentTypeCode,
        serviceCategoryCode: "DELIVERY",
      },
    }
  );
  const c = data.charges ?? {};
  return {
    shippingFees: Number(c.ShippingFees ?? 0),
    vat: Number(c.VAT ?? 0),
    totalTransfer: Number(c.TotalTransfer ?? 0),
    codValue: Number(c.CODValue ?? 0),
  };
}

export async function createMylerzShipment(
  orderId: string,
  overrides: MylerzShipmentPayload = {}
): Promise<MylerzShipmentResult> {
  // Only forward fields the admin actually set, so anything left blank falls
  // back to the backend's order-derived default (an empty body ships as-is).
  const body: Record<string, unknown> = {};
  if (overrides.warehouseName) body.warehouseName = overrides.warehouseName;
  if (overrides.cityCode) body.cityCode = overrides.cityCode;
  if (overrides.neighborhoodCode) body.neighborhoodCode = overrides.neighborhoodCode;
  if (typeof overrides.totalWeight === "number") {
    body.totalWeight = overrides.totalWeight;
  }
  if (overrides.dimensions) {
    const { length, width, height } = overrides.dimensions;
    body.dimensions = `${length}*${width}*${height}`;
  }
  if (overrides.specialNotes) body.specialNotes = overrides.specialNotes;

  const data = await adminFetch<Record<string, unknown>>(
    `/couriers/mylerz/orders/${encodeURIComponent(orderId)}/shipment`,
    { method: "POST", json: body }
  );
  return { courier: courierFromResponse(data) };
}

// Result of syncing an order's status from the live Mylerz delivery status.
// The server owns the mapping/advancement rules; we just apply what it returns.
export interface OrderStatusSync {
  /** true when order.status actually changed. */
  changed: boolean;
  /** Mapped order status (shipped|delivered|returned|cancelled) or null. */
  mappedStatus: OrderStatus | null;
  /** Live Mylerz text to show as the courier status line. */
  courierStatus: string;
  /** order.status after the sync (undefined if the server omitted it). */
  status?: OrderStatus;
  /** order.courier.status text. */
  courierStatusText?: string;
  trackingNumber?: string;
  /** mylerz.StatusDate — "last update" timestamp. */
  statusDate?: string;
}

/**
 * Sync an order's status from the live Mylerz delivery status. Returns null
 * when there's nothing to sync (400 — order has no tracking number), so
 * callers can treat it as a no-op.
 */
export async function syncOrderStatus(
  orderId: string
): Promise<OrderStatusSync | null> {
  try {
    const data = await adminFetch<{
      changed?: boolean;
      mappedStatus?: string | null;
      courierStatus?: string;
      order?: {
        status?: string;
        courier?: { status?: string; trackingNumber?: string };
      };
      mylerz?: { StatusDate?: string };
    }>(`/couriers/mylerz/orders/${encodeURIComponent(orderId)}/sync-status`, {
      method: "POST",
    });
    return {
      changed: Boolean(data.changed),
      mappedStatus: (data.mappedStatus as OrderStatus | null) ?? null,
      courierStatus: data.courierStatus ?? data.order?.courier?.status ?? "",
      status: (data.order?.status as OrderStatus | undefined) ?? undefined,
      courierStatusText: data.order?.courier?.status,
      trackingNumber: data.order?.courier?.trackingNumber,
      statusDate: data.mylerz?.StatusDate,
    };
  } catch (error) {
    // 400 = order has no Mylerz tracking → nothing to sync (no-op).
    if (error instanceof Error && /tracking|\b400\b/i.test(error.message)) {
      return null;
    }
    throw error;
  }
}

export async function getMylerzPackageStatus(awb: string): Promise<unknown> {
  return adminFetch(`/couriers/mylerz/packages/${encodeURIComponent(awb)}/status`, {
    method: "GET",
  });
}

export async function getMylerzPackageDetails(awb: string): Promise<unknown> {
  return adminFetch(`/couriers/mylerz/packages/${encodeURIComponent(awb)}/details`, {
    method: "GET",
  });
}

export async function getMylerzPackageTracking(awb: string): Promise<unknown> {
  return adminFetch(`/couriers/mylerz/packages/${encodeURIComponent(awb)}/tracking`, {
    method: "GET",
  });
}

export async function getMylerzPackageTrackingUrl(awb: string): Promise<unknown> {
  return adminFetch(
    `/couriers/mylerz/packages/${encodeURIComponent(awb)}/tracking-url`,
    { method: "GET" }
  );
}

export async function cancelMylerzPackage(awb: string): Promise<unknown> {
  return adminFetch(`/couriers/mylerz/packages/${encodeURIComponent(awb)}/cancel`, {
    method: "POST",
  });
}
