// API layer - the single place the UI talks to for data.
//
// Every function calls the ROMZ Express backend at NEXT_PUBLIC_API_URL
// and maps its response to the types in ./types.

import type {
  Badge,
  AdminReview,
  Category,
  ContactMessage,
  ContactStatus,
  Coupon,
  LocalizedText,
  Order,
  OrderStatus,
  PageMeta,
  PaymentIntent,
  PaymentMethod,
  PaymentStatus,
  Product,
  Review,
  ShippingZone,
  Governorate,
  GovernorateZone,
  ShippingQuote,
} from "./types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
const API_ORIGIN = API_URL.replace(/\/api\/v1$/, "");

const mediaUrl = (url?: string | null) => {
  if (!url) return "";
  if (/^(?:https?:|data:)/i.test(url)) {
    return url;
  }
  return `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public data?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  /** Present on paginated list endpoints. */
  meta?: PageMeta;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function detailMessage(data: unknown): string {
  if (Array.isArray(data)) {
    return data
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return typeof record.message === "string"
            ? record.message
            : typeof record.msg === "string"
              ? record.msg
              : "";
        }
        return "";
      })
      .filter(Boolean)
      .join(" · ");
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const messages = Object.values(record)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value): value is string => typeof value === "string");
    return messages.join(" · ");
  }

  return "";
}

function apiErrorMessage<T>(body: ApiEnvelope<T> | null, fallback: string) {
  const details = detailMessage(body?.data);
  const base = body?.message ?? fallback;
  return details && details !== base ? `${base}: ${details}` : base;
}

// Core request: returns the full response envelope so callers that need `meta`
// (paginated lists) can read it. `apiFetch` wraps this for the common case of
// just wanting `data`.
async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  { retries = 2 }: { retries?: number } = {}
): Promise<ApiEnvelope<T>> {
  if (!API_URL) {
    throw new ApiError(
      "Backend is not configured (NEXT_PUBLIC_API_URL is missing).",
      500
    );
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (error) {
    // Network-level failure (backend unreachable) — retry idempotent GETs a
    // couple of times with a short backoff before surfacing the error.
    const method = (init?.method ?? "GET").toUpperCase();
    if (retries > 0 && method === "GET") {
      await sleep(300 * (3 - retries));
      return apiRequest<T>(path, init, { retries: retries - 1 });
    }
    throw new ApiError(
      error instanceof Error ? error.message : "Network request failed.",
      0
    );
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // 204 or non-JSON error page
  }

  if (!res.ok) {
    // Retry transient server errors on GET; never retry 4xx.
    const method = (init?.method ?? "GET").toUpperCase();
    if (retries > 0 && method === "GET" && res.status >= 500) {
      await sleep(300 * (3 - retries));
      return apiRequest<T>(path, init, { retries: retries - 1 });
    }
    throw new ApiError(apiErrorMessage(body, res.statusText), res.status, body?.data);
  }

  return body ?? ({ success: true, message: "", data: undefined as T });
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  opts?: { retries?: number }
): Promise<T> {
  const body = await apiRequest<T>(path, init, opts);
  return body.data as T;
}

interface BeLocalized {
  en?: string;
  ar?: string;
}

interface BeImage {
  url: string;
  publicId?: string;
  color?: string;
  categories?: string[]; // category ids (not populated)
}

const loc = (value: BeLocalized | string | null | undefined): LocalizedText =>
  typeof value === "string"
    ? { en: value, ar: value }
    : { en: value?.en ?? "", ar: value?.ar ?? "" };

interface BeCategory {
  _id: string;
  slug: string;
  name: BeLocalized;
  order?: number;
  parent?: string | { _id?: string; slug?: string } | null;
  image?: string | BeImage | null;
  children?: BeCategory[];
}

interface BeVariant {
  _id?: string;
  sku: string;
  size: string;
  color?: { name?: string; hex?: string };
  stock?: number;
  priceOverride?: number | null;
}

interface BeProduct {
  _id: string;
  slug: string;
  name: BeLocalized;
  description?: BeLocalized;
  category?: string | BeCategory | null;
  categories?: (string | BeCategory)[] | null;
  basePrice: number;
  salePrice?: number | null;
  images?: BeImage[];
  variants?: BeVariant[];
  badges?: string[];
  ratingAvg?: number;
  ratingCount?: number;
  sold?: number;
  sizeChart?: {
    columns?: BeLocalized[];
    rows?: unknown[][];
    note?: BeLocalized;
  } | null;
  fabricCare?: {
    fabric?: BeLocalized;
    care?: BeLocalized;
  } | null;
}

interface BeReview {
  _id: string;
  product?: string | { _id: string; name?: LocalizedText };
  user?: { name?: string } | null;
  guestName?: string;
  rating: number;
  comment?: string;
  isVerifiedPurchase?: boolean;
  isApproved?: boolean;
  createdAt?: string;
}

interface BeShippingZone {
  _id: string;
  governorate: string;
  fee: number;
  estimatedDays?: string;
  isActive?: boolean;
}

interface BeOrderItem {
  product?: string;
  nameSnapshot?: BeLocalized;
  sku: string;
  size: string;
  color?: { name?: string; hex?: string };
  qty: number;
  unitPrice: number;
}

interface BeOrder {
  _id: string;
  orderNumber: string;
  customer?: { name?: string; email?: string; phone?: string };
  shippingAddress?: {
    governorate?: string;
    city?: string;
    street?: string;
    apartment?: string;
    postal?: string;
    governorateCode?: string;
    zoneCode?: string;
  };
  items?: BeOrderItem[];
  subtotal: number;
  shippingFee: number;
  shippingVat?: number;
  discount?: { couponCode?: string; amount?: number };
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  courier?: {
    name?: string;
    provider?: string;
    trackingNumber?: string;
    pickupOrderCode?: string;
    status?: string;
  };
  createdAt: string;
}

const parentId = (parent: BeCategory["parent"]): string | null =>
  parent == null
    ? null
    : typeof parent === "object"
      ? parent._id ?? null
      : String(parent);

const parentSlug = (parent: BeCategory["parent"]): string | null =>
  parent && typeof parent === "object" ? parent.slug ?? null : null;

const mapCategory = (c: BeCategory): Category => ({
  id: c._id,
  slug: c.slug,
  name: loc(c.name),
  order: c.order ?? 0,
  parentId: parentId(c.parent),
  parentSlug: parentSlug(c.parent),
  image: (() => {
    const backendUrl = typeof c.image === "object" ? c.image?.url : c.image;
    if (!backendUrl) return undefined;
    return {
      url: mediaUrl(backendUrl),
      backendUrl,
      publicId: typeof c.image === "object" ? c.image?.publicId : undefined,
    };
  })(),
});

/**
 * Arranges a flat category list into a parent → children tree. Categories whose
 * parent isn't in the list (or that have no parent) become top-level roots.
 * `parentSlug` is backfilled from each parent so the storefront can build
 * breadcrumbs without a second lookup.
 */
export function buildCategoryTree(categories: Category[]): Category[] {
  const byId = new Map(categories.map((c) => [c.id, { ...c, children: [] as Category[] }]));
  const roots: Category[] = [];
  for (const cat of byId.values()) {
    const parent = cat.parentId ? byId.get(cat.parentId) : undefined;
    if (parent) {
      cat.parentSlug = parent.slug;
      parent.children!.push(cat);
    } else {
      roots.push(cat);
    }
  }
  const sortByOrder = (list: Category[]) => {
    list.sort((a, b) => a.order - b.order);
    list.forEach((c) => c.children && sortByOrder(c.children));
  };
  sortByOrder(roots);
  return roots;
}

const catSlug = (c: string | BeCategory | null | undefined): string =>
  typeof c === "object" && c !== null ? c.slug : String(c ?? "");

export const mapProduct = (p: BeProduct): Product => {
  const primary = catSlug(p.category);
  // Prefer the backend's `categories` array when present; otherwise fall back
  // to the single primary category. Always includes the primary, deduped.
  const extra = Array.isArray(p.categories) ? p.categories.map(catSlug) : [];
  const categories = [...new Set([primary, ...extra].filter(Boolean))];
  // Image category tags come back as ids; translate them via the populated
  // product categories so the storefront can work with slugs throughout.
  const slugById = new Map<string, string>();
  for (const c of [p.category, ...(p.categories ?? [])]) {
    if (typeof c === "object" && c !== null) slugById.set(String(c._id), c.slug);
  }
  return {
  id: p._id,
  slug: p.slug,
  name: loc(p.name),
  description: loc(p.description),
  category: primary,
  categories,
  basePrice: p.basePrice,
  salePrice: p.salePrice ?? null,
  images: (p.images ?? []).map((image) => ({
    url: mediaUrl(image.url),
    backendUrl: image.url,
    publicId: image.publicId,
    color: image.color,
    categories: (image.categories ?? [])
      .map((id) => slugById.get(String(id)))
      .filter((slug): slug is string => Boolean(slug)),
  })),
  variants: (p.variants ?? []).map((v) => ({
    id: v._id ?? "",
    sku: v.sku,
    size: v.size,
    color: { name: loc(v.color?.name), hex: v.color?.hex ?? "" },
    stock: v.stock ?? 0,
    priceOverride: v.priceOverride ?? undefined,
  })),
  badges: (p.badges ?? []) as Badge[],
  ratingAvg: p.ratingAvg ?? 0,
  ratingCount: p.ratingCount ?? 0,
  sold: p.sold ?? 0,
  sizeChart: {
    // Map defensively — rows/cells may be missing or non-string on old data.
    columns: (p.sizeChart?.columns ?? []).map(loc),
    rows: (p.sizeChart?.rows ?? []).map((row) =>
      (Array.isArray(row) ? row : []).map((cell) => String(cell ?? ""))
    ),
    note: loc(p.sizeChart?.note),
  },
  fabricCare: {
    fabric: loc(p.fabricCare?.fabric),
    care: loc(p.fabricCare?.care),
  },
  };
};

const mapReview = (r: BeReview): Review => ({
  id: r._id,
  productId:
    typeof r.product === "object" && r.product !== null
      ? r.product._id
      : String(r.product ?? ""),
  name: r.guestName || r.user?.name || "ROMZ Customer",
  rating: r.rating,
  comment: loc(r.comment),
  isVerifiedPurchase: r.isVerifiedPurchase ?? false,
});

const mapShippingZone = (z: BeShippingZone): ShippingZone => ({
  id: z._id,
  governorate: loc(z.governorate),
  fee: z.fee,
  estimatedDays: z.estimatedDays ?? "1-3",
  // Older zones created before the isActive field default to active.
  isActive: z.isActive ?? true,
});

const mapOrder = (o: BeOrder): Order => ({
  id: o._id,
  orderNumber: o.orderNumber,
  customer: {
    name: o.customer?.name ?? "",
    email: o.customer?.email ?? "",
    phone: o.customer?.phone ?? "",
  },
  shippingAddress: {
    governorate: o.shippingAddress?.governorate ?? "",
    city: o.shippingAddress?.city ?? "",
    street: o.shippingAddress?.street ?? "",
    apartment: o.shippingAddress?.apartment || undefined,
    postal: o.shippingAddress?.postal || undefined,
    governorateCode: o.shippingAddress?.governorateCode || undefined,
    zoneCode: o.shippingAddress?.zoneCode || undefined,
  },
  items: (o.items ?? []).map((item) => ({
    productId: String(item.product ?? ""),
    name: loc(item.nameSnapshot),
    sku: item.sku,
    size: item.size,
    colorName: item.color?.name ?? "",
    colorHex: item.color?.hex ?? "",
    qty: item.qty,
    unitPrice: item.unitPrice,
  })),
  subtotal: o.subtotal,
  shippingFee: o.shippingFee,
  shippingVat: o.shippingVat,
  discount: o.discount?.amount
    ? { couponCode: o.discount.couponCode ?? "", amount: o.discount.amount }
    : undefined,
  total: o.total,
  paymentMethod: o.paymentMethod as PaymentMethod,
  paymentStatus: o.paymentStatus as PaymentStatus,
  status: o.status as OrderStatus,
  courier: o.courier
    ? {
        provider: o.courier.name ?? o.courier.provider,
        trackingNumber: o.courier.trackingNumber,
        pickupOrderCode: o.courier.pickupOrderCode,
        status: o.courier.status,
      }
    : undefined,
  createdAt: o.createdAt,
});

export async function getCategories(): Promise<Category[]> {
  const { categories } = await apiFetch<{ categories: BeCategory[] }>("/categories");
  return categories.map(mapCategory);
}

/** Categories arranged as a parent → children tree (top-level roots first). */
export async function getCategoryTree(): Promise<Category[]> {
  return buildCategoryTree(await getCategories());
}

export interface ProductFilters {
  category?: string;
  badge?: string;
  sort?: "newest" | "price-asc" | "price-desc" | "best-selling";
}

const SORT_MAP: Record<string, string> = {
  newest: "newest",
  "price-asc": "price-low",
  "price-desc": "price-high",
  "best-selling": "best-selling",
};

export async function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const params = new URLSearchParams({ limit: "100" });
  if (filters.category) params.set("category", filters.category);
  if (filters.badge) params.set("badge", filters.badge);
  if (filters.sort) params.set("sort", SORT_MAP[filters.sort] ?? filters.sort);

  const { products } = await apiFetch<{ products: BeProduct[] }>(
    `/products?${params.toString()}`
  );

  return products.map(mapProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  try {
    const { product } = await apiFetch<{ product: BeProduct }>(
      `/products/${encodeURIComponent(slug)}`
    );
    return mapProduct(product);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

export async function getRelatedProducts(product: Product): Promise<Product[]> {
  try {
    const { products } = await apiFetch<{ products: BeProduct[] }>(
      `/products/${encodeURIComponent(product.slug)}/related?limit=4`
    );
    return products.map(mapProduct);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  }
}

export async function getProductReviews(productId: string): Promise<Review[]> {
  const { reviews } = await apiFetch<{ reviews: BeReview[] }>(
    `/reviews/product/${encodeURIComponent(productId)}`
  );
  return reviews.map(mapReview);
}

export interface CreateReviewInput {
  /** 1–5 stars. */
  rating: number;
  /** Reviewer display name (sent as guestName). */
  name: string;
  comment?: string;
}

/**
 * Submit a product review/rating. Public — a logged-in customer token is
 * forwarded when available so the review is attributed to their account,
 * otherwise the guest name is used. POST /reviews/product/:productId.
 */
export async function createReview(
  productId: string,
  input: CreateReviewInput,
  token?: string
): Promise<void> {
  await apiFetch(`/reviews/product/${encodeURIComponent(productId)}`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(token),
    body: JSON.stringify({
      rating: input.rating,
      guestName: input.name,
      ...(input.comment ? { comment: input.comment } : {}),
    }),
  });
}

export interface HomeData {
  newArrivals: Product[];
  bestSellers: Product[];
  categories: Category[];
  reviews: Review[];
}

export async function getHomeData(): Promise<HomeData> {
  const [home, { categories }] = await Promise.all([
    apiFetch<{ newArrivals: BeProduct[]; bestSellers: BeProduct[] }>("/products/home"),
    apiFetch<{ categories: BeCategory[] }>("/categories"),
  ]);

  return {
    newArrivals: home.newArrivals.slice(0, 4).map(mapProduct),
    bestSellers: home.bestSellers.slice(0, 4).map(mapProduct),
    // Only top-level categories are shown as home tiles.
    categories: buildCategoryTree(categories.map(mapCategory)),
    reviews: [],
  };
}

export async function getShippingZones(): Promise<ShippingZone[]> {
  const { zones } = await apiFetch<{ zones: BeShippingZone[] }>("/shipping-zones");
  return zones.map(mapShippingZone);
}

interface BeGovernorate {
  code: string;
  nameEn: string;
  nameAr: string;
  zones?: { code: string; nameEn: string; nameAr: string }[];
}

/** Governorates + nested zones for the checkout dropdowns (public, cached). */
export async function getGovernorates(): Promise<Governorate[]> {
  const { governorates } = await apiFetch<{ governorates: BeGovernorate[] }>(
    "/shipping/governorates"
  );
  return governorates.map((g) => ({
    code: g.code,
    nameEn: g.nameEn,
    nameAr: g.nameAr,
    zones: (g.zones ?? []).map(
      (z): GovernorateZone => ({
        code: z.code,
        nameEn: z.nameEn,
        nameAr: z.nameAr,
      })
    ),
  }));
}

export interface ShippingQuoteInput {
  zoneCode: string;
  /** Selected governorate nameEn — lets the backend fall back if Mylerz is down. */
  governorate?: string;
  items: { product: string; variantId?: string; sku?: string; qty: number }[];
  couponCode?: string;
  paymentMethod?: PaymentMethod;
}

/** Live shipping fee + cart totals for the selected zone (public). */
export async function getShippingQuote(
  input: ShippingQuoteInput,
  token?: string
): Promise<ShippingQuote> {
  const { quote } = await apiFetch<{ quote: ShippingQuote }>("/shipping/quote", {
    method: "POST",
    credentials: "include",
    headers: authHeaders(token),
    body: JSON.stringify({
      zoneCode: input.zoneCode,
      ...(input.governorate ? { governorate: input.governorate } : {}),
      items: input.items.map((item) => ({
        product: item.product,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        ...(item.sku ? { sku: item.sku } : {}),
        qty: item.qty,
      })),
      couponCode: input.couponCode ?? "",
      paymentMethod: input.paymentMethod ?? "cod",
    }),
  });
  return quote;
}

// ── Contact ─────────────────────────────────────────────
// POST /contact is public; the GET/PATCH/DELETE admin endpoints require the
// admin Bearer token (writes live in ./adminApi, reads use these with a token).

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

export const mapContactMessage = (m: BeContactMessage): ContactMessage => ({
  id: m._id,
  name: m.name,
  email: m.email,
  phone: m.phone ?? "",
  subject: m.subject,
  message: m.message,
  status: m.status,
  adminNotes: m.adminNotes ?? "",
  source: m.source ?? "",
  ipAddress: m.ipAddress ?? "",
  userAgent: m.userAgent ?? "",
  user:
    m.user && typeof m.user === "object" ? m.user._id ?? null : m.user ?? null,
  readAt: m.readAt ?? null,
  repliedAt: m.repliedAt ?? null,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
});

export interface ContactFormInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  source?: string;
}

/**
 * Submits the public storefront contact form. A logged-in customer's Bearer
 * token is optional and simply attaches the message to their account.
 * Throws {@link ApiError} on 400 (validation) / 429 (rate limit) so the form
 * can surface the right message.
 */
export async function submitContact(
  input: ContactFormInput,
  token?: string
): Promise<{ id: string; status: string; createdAt: string }> {
  const { message } = await apiFetch<{
    message: { id: string; status: string; createdAt: string };
  }>("/contact", {
    method: "POST",
    ...(token ? { credentials: "include", headers: authHeaders(token) } : {}),
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      ...(input.phone ? { phone: input.phone } : {}),
      subject: input.subject,
      message: input.message,
      source: input.source ?? "contact-page",
    }),
  });
  return message;
}

export interface ContactListParams {
  page?: number;
  limit?: number;
  /** Omit (or "all") to fetch every status. */
  status?: ContactStatus;
  search?: string;
}

export interface ContactListResult {
  messages: ContactMessage[];
  meta: PageMeta;
}

export function contactListQuery(params: ContactListParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.limit ?? 12));
  if (params.status) qs.set("status", params.status);
  if (params.search?.trim()) qs.set("search", params.search.trim());
  return qs.toString();
}

/** Admin inbox listing with backend pagination meta. Requires an admin token. */
export async function getContactMessages(
  params: ContactListParams,
  token?: string
): Promise<ContactListResult> {
  const body = await apiRequest<{ messages: BeContactMessage[] }>(
    `/contact?${contactListQuery(params)}`,
    { headers: authHeaders(token) }
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

/** Single admin contact message by id. Requires an admin token. */
export async function getContactMessage(
  id: string,
  token?: string
): Promise<ContactMessage> {
  const { message } = await apiFetch<{ message: BeContactMessage }>(
    `/contact/${encodeURIComponent(id)}`,
    { headers: authHeaders(token) }
  );
  return mapContactMessage(message);
}

interface BeValidatedCartItem {
  product: string;
  productName?: BeLocalized;
  slug?: string;
  image?: BeImage | null;
  variantId: string;
  sku: string;
  size: string;
  color?: { name?: string; hex?: string };
  qty: number;
  availableQty?: number;
  unitPrice: number;
  lineTotal: number;
  inStock?: boolean;
}

interface BeUnavailableCartItem {
  product?: string;
  productName?: BeLocalized;
  variantId?: string;
  sku?: string;
  size?: string;
  color?: { name?: string; hex?: string };
  qty?: number;
  requestedQty?: number;
  availableQty?: number;
  reason?: string;
}

export interface ValidatedCartItem {
  product: string;
  productName: LocalizedText;
  slug: string;
  image?: string;
  variantId: string;
  sku: string;
  size: string;
  colorName: string;
  colorHex: string;
  qty: number;
  availableQty: number;
  unitPrice: number;
  lineTotal: number;
  inStock: boolean;
}

export interface UnavailableCartItem {
  product?: string;
  productName?: LocalizedText;
  variantId?: string;
  sku?: string;
  size?: string;
  colorName?: string;
  colorHex?: string;
  qty: number;
  availableQty?: number;
  reason: string;
}

export interface ValidatedCart {
  items: ValidatedCartItem[];
  unavailableItems: UnavailableCartItem[];
  subtotal: number;
  discount: { couponCode: string; amount: number };
  total: number;
  isValid: boolean;
}

const mapValidatedCart = (cart: {
  items?: BeValidatedCartItem[];
  unavailableItems?: BeUnavailableCartItem[];
  subtotal?: number;
  discount?: { couponCode?: string; amount?: number };
  total?: number;
  isValid?: boolean;
}): ValidatedCart => ({
  items: (cart.items ?? []).map((item) => ({
    product: String(item.product),
    productName: loc(item.productName),
    slug: item.slug ?? "",
    image: mediaUrl(item.image?.url) || undefined,
    variantId: String(item.variantId),
    sku: item.sku,
    size: item.size,
    colorName: item.color?.name ?? "",
    colorHex: item.color?.hex ?? "",
    qty: item.qty,
    availableQty: item.availableQty ?? 0,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    inStock: item.inStock ?? false,
  })),
  unavailableItems: (cart.unavailableItems ?? []).map((item) => ({
    product: item.product ? String(item.product) : undefined,
    productName: item.productName ? loc(item.productName) : undefined,
    variantId: item.variantId ? String(item.variantId) : undefined,
    sku: item.sku,
    size: item.size,
    colorName: item.color?.name,
    colorHex: item.color?.hex,
    qty: item.requestedQty ?? item.qty ?? 0,
    availableQty: item.availableQty,
    reason: item.reason ?? "Item is unavailable",
  })),
  subtotal: cart.subtotal ?? 0,
  discount: {
    couponCode: cart.discount?.couponCode ?? "",
    amount: cart.discount?.amount ?? 0,
  },
  total: cart.total ?? 0,
  isValid: cart.isValid ?? false,
});

export async function validateCart(
  input: {
    items: { product: string; variantId?: string; sku?: string; qty: number }[];
    couponCode?: string;
  },
  token?: string
): Promise<ValidatedCart> {
  const { cart } = await apiFetch<{
    cart: Parameters<typeof mapValidatedCart>[0];
  }>("/cart/validate", {
    method: "POST",
    credentials: "include",
    headers: authHeaders(token),
    body: JSON.stringify({
      items: input.items.map((item) => ({
        product: item.product,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        ...(item.sku ? { sku: item.sku } : {}),
        qty: item.qty,
      })),
      couponCode: input.couponCode ?? "",
    }),
  });

  return mapValidatedCart(cart);
}

export interface CreateOrderInput {
  customer: { name: string; email: string; phone: string };
  shippingAddress: {
    governorate: string;
    city: string;
    governorateCode: string;
    zoneCode: string;
    street: string;
    apartment?: string;
    postal?: string;
  };
  items: { product: string; variantId: string; qty: number }[];
  couponCode?: string;
  paymentMethod: PaymentMethod;
}

export interface CreateOrderResult {
  id: string;
  orderNumber: string;
  subtotal: number;
  shippingFee: number;
  discount: { couponCode: string; amount: number };
  total: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
}

export async function createOrder(
  input: CreateOrderInput,
  token?: string
): Promise<CreateOrderResult> {
  const { order } = await apiFetch<{ order: BeOrder }>("/orders", {
    method: "POST",
    // optionalAuth: a Bearer token attaches the order to the logged-in customer.
    credentials: "include",
    headers: authHeaders(token),
    body: JSON.stringify({
      customer: input.customer,
      shippingAddress: input.shippingAddress,
      items: input.items.map((item) => ({
        product: item.product,
        variantId: item.variantId,
        qty: item.qty,
      })),
      couponCode: input.couponCode ?? "",
      paymentMethod: input.paymentMethod,
    }),
  });

  return {
    id: order._id,
    orderNumber: order.orderNumber,
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    discount: {
      couponCode: order.discount?.couponCode ?? "",
      amount: order.discount?.amount ?? 0,
    },
    total: order.total,
    paymentStatus: (order.paymentStatus as PaymentStatus) ?? "pending",
    status: (order.status as OrderStatus) ?? "pending",
  };
}

export interface PaymentIntentInput {
  orderId: string;
  contact?: string;
  redirectionUrl: string;
  notificationUrl: string;
  customer: { name: string; email: string; phone: string };
}

/**
 * Order-first Paymob flow: create the order (paymentMethod "paymob") first,
 * then exchange its id for a hosted checkout / iframe URL. A Bearer token is
 * forwarded for logged-in customers; guests are identified by contact details.
 */
export async function createPaymentIntent(
  input: PaymentIntentInput,
  token?: string
): Promise<PaymentIntent> {
  const data = await apiFetch<{ payment?: PaymentIntent } & PaymentIntent>(
    "/payments/paymob/intent",
    {
      method: "POST",
      credentials: "include",
      headers: authHeaders(token),
      body: JSON.stringify({
        orderId: input.orderId,
        contact: input.contact || input.customer.phone || input.customer.email,
        redirectionUrl: input.redirectionUrl,
        notificationUrl: input.notificationUrl,
      }),
    }
  );

  // The backend may nest under `payment` or return the fields at the top level.
  const payment = data.payment ?? data;
  return {
    redirectUrl: payment.redirectUrl,
    checkoutUrl: payment.checkoutUrl,
    iframeUrl: payment.iframeUrl,
    provider: payment.provider,
    flow: payment.flow,
  };
}

/** Picks the URL to redirect to based on the provider the intent reports. */
export function paymentRedirectUrl(intent: PaymentIntent): string | null {
  return intent.redirectUrl || intent.checkoutUrl || intent.iframeUrl || null;
}

export async function trackOrder(
  orderNumber: string,
  contact: string
): Promise<Order | undefined> {
  try {
    const params = new URLSearchParams({
      orderNumber: orderNumber.trim(),
      contact: contact.trim(),
    });

    const { order } = await apiFetch<{ order: BeOrder }>(`/orders/track?${params}`);
    return mapOrder(order);
  } catch (error) {
    if (error instanceof ApiError && [400, 404, 429].includes(error.status)) {
      return undefined;
    }
    throw error;
  }
}

const authHeaders = (token?: string) =>
  token ? { Authorization: `Bearer ${token}` } : undefined;

interface BeCoupon {
  _id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrderTotal?: number;
  usedCount?: number;
  isActive?: boolean;
}

const mapCoupon = (c: BeCoupon): Coupon => ({
  id: c._id,
  code: c.code,
  type: c.type,
  value: c.value,
  minOrderTotal: c.minOrderTotal ?? 0,
  usedCount: c.usedCount ?? 0,
  discountGiven: 0,
  revenueGenerated: 0,
  isActive: c.isActive ?? true,
});

export async function getOrders(token?: string): Promise<Order[]> {
  const { orders } = await apiFetch<{ orders: BeOrder[] }>("/orders?limit=100", {
    headers: authHeaders(token),
  });
  return orders.map(mapOrder);
}

export async function getCoupons(token?: string): Promise<Coupon[]> {
  const { coupons } = await apiFetch<{ coupons: BeCoupon[] }>("/coupons?limit=100", {
    headers: authHeaders(token),
  });
  return coupons.map(mapCoupon);
}

export async function getProductById(
  id: string,
  token?: string
): Promise<Product | undefined> {
  try {
    const { product } = await apiFetch<{ product: BeProduct }>(
      `/products/admin/${encodeURIComponent(id)}`,
      { headers: authHeaders(token) }
    );
    return mapProduct(product);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return undefined;
    }
    throw error;
  }
}

export async function getReviews(token?: string): Promise<Review[]> {
  const { reviews } = await apiFetch<{ reviews: BeReview[] }>("/reviews/admin?limit=100", {
    headers: authHeaders(token),
  });
  return reviews.map(mapReview);
}

const mapAdminReview = (r: BeReview): AdminReview => {
  const product =
    typeof r.product === "object" && r.product !== null ? r.product : null;
  return {
    id: r._id,
    productId: product ? product._id : String(r.product ?? ""),
    productName: product?.name?.en || product?.name?.ar || "",
    name: r.guestName || r.user?.name || "ROMZ Customer",
    rating: r.rating,
    comment: r.comment ?? "",
    isApproved: r.isApproved ?? false,
    isVerifiedPurchase: r.isVerifiedPurchase ?? false,
    createdAt: r.createdAt ?? "",
  };
};

/** All reviews (approved + pending) for the admin moderation screen. */
export async function getAdminReviews(token?: string): Promise<AdminReview[]> {
  const { reviews } = await apiFetch<{ reviews: BeReview[] }>(
    "/reviews/admin?limit=100",
    { headers: authHeaders(token) }
  );
  return reviews.map(mapAdminReview);
}

export interface AnalyticsMetric {
  value: number;
  changePercent?: number;
}

export interface AnalyticsOverview {
  revenue: AnalyticsMetric;
  orders: AnalyticsMetric;
  averageOrderValue: AnalyticsMetric;
  itemsSold: AnalyticsMetric;
  pendingOrders: AnalyticsMetric;
  lowStock: AnalyticsMetric & { threshold?: number };
}

export async function getAnalyticsOverview(token?: string): Promise<AnalyticsOverview> {
  return apiFetch<AnalyticsOverview>("/analytics/overview", {
    headers: authHeaders(token),
  });
}

export interface OrderStatusCount {
  status: string;
  count: number;
}

export async function getOrdersByStatus(token?: string): Promise<OrderStatusCount[]> {
  const { statuses } = await apiFetch<{ statuses: OrderStatusCount[] }>(
    "/analytics/orders-by-status",
    { headers: authHeaders(token) }
  );

  return statuses;
}

export interface BestSeller {
  product: string;
  name: LocalizedText;
  slug: string;
  image: string | null;
  qty: number;
  revenue: number;
}

interface BeBestSeller {
  product: string;
  name: BeLocalized;
  slug: string;
  image: string | BeImage | null;
  qty: number;
  revenue: number;
}

export async function getBestSellers(limit = 5, token?: string): Promise<BestSeller[]> {
  const { products } = await apiFetch<{ products: BeBestSeller[] }>(
    `/analytics/best-sellers?limit=${limit}`,
    { headers: authHeaders(token) }
  );

  return products.map((p) => ({
    ...p,
    name: loc(p.name),
    image: typeof p.image === "string" ? mediaUrl(p.image) : mediaUrl(p.image?.url),
  }));
}

export interface LowStockVariant {
  product: string;
  name: LocalizedText;
  slug: string;
  sku: string;
  size: string;
  colorName: string;
  stock: number;
  threshold: number;
}

interface BeLowStock {
  product: string;
  name: BeLocalized;
  slug: string;
  sku: string;
  size: string;
  color?: { name?: string; hex?: string };
  stock: number;
  threshold: number;
}

export async function getLowStock(limit = 10, token?: string): Promise<LowStockVariant[]> {
  const { variants } = await apiFetch<{ variants: BeLowStock[] }>(
    `/analytics/low-stock?limit=${limit}`,
    { headers: authHeaders(token) }
  );

  return variants.map((v) => ({
    product: v.product,
    name: loc(v.name),
    slug: v.slug,
    sku: v.sku,
    size: v.size,
    colorName: v.color?.name ?? "",
    stock: v.stock,
    threshold: v.threshold,
  }));
}

export interface CouponAnalytics {
  code: string;
  type: "percent" | "fixed";
  value: number;
  uses: number;
  totalDiscountGiven: number;
  revenueGenerated: number;
}

export async function getCouponAnalytics(token?: string): Promise<CouponAnalytics[]> {
  const { coupons } = await apiFetch<{ coupons: CouponAnalytics[] }>(
    "/analytics/coupons",
    { headers: authHeaders(token) }
  );

  return coupons;
}

export type Granularity = "day" | "week" | "month";

export interface RevenuePoint {
  period: string;
  revenue: number;
  paymob: number;
  cod: number;
  orders: number;
}

interface BeRevenuePoint {
  period: string;
  revenue: number;
  orders: number;
  byPaymentMethod?: { paymentMethod: string; revenue: number; orders: number }[];
}

export async function getRevenueSeries(
  granularity: Granularity = "week",
  token?: string
): Promise<RevenuePoint[]> {
  const { series } = await apiFetch<{ series: BeRevenuePoint[] }>(
    `/analytics/revenue-series?granularity=${granularity}`,
    { headers: authHeaders(token) }
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
