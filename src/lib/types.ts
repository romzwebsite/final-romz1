// Shared TypeScript types — this is the API contract with the backend.
// Field names mirror the Mongoose models in the project plan (section 2).

export type Locale = "en" | "ar";

export interface LocalizedText {
  en: string;
  ar: string;
}

export interface ProductImage {
  /** Absolute URL used by the browser. */
  url: string;
  /** Exact URL returned by the backend, retained for existingImages updates. */
  backendUrl?: string;
  publicId?: string;
  color?: string; // hex of the color this image belongs to
  /** Category slugs this image is shown in; empty/undefined = every category. */
  categories?: string[];
  /** Admin editor only: the same tags as category ids (what the API stores). */
  categoryIds?: string[];
}

export interface Category {
  id: string;
  slug: string;
  name: LocalizedText;
  order: number;
  /** Parent category id — null/undefined for top-level categories. */
  parentId?: string | null;
  /** Parent category slug, resolved for storefront routing/breadcrumbs. */
  parentSlug?: string | null;
  image?: ProductImage;
  /** Subcategories, populated when the flat list is arranged into a tree. */
  children?: Category[];
}

export interface StorefrontSettings {
  promoBar: {
    active: boolean;
    text: LocalizedText;
  };
  payments: {
    paymob: {
      active: boolean;
    };
  };
  freeShippingThreshold: number | null;
  lowStockThreshold: number;
  /** Home-page FAQ entries (backend-driven). */
  faqs: Faq[];
  /** Shipping & Returns block shown on product pages (backend-driven). */
  shippingReturns: ShippingReturns;
  /** Store contact details shown on the contact page (backend-driven). */
  contactInfo: ContactInfo;
}

/** A single FAQ entry from storefront settings (data.settings.faqs). */
export interface Faq {
  /** Backend _id, kept so the admin can update items in place. */
  id?: string;
  question: LocalizedText;
  answer: LocalizedText;
  isActive: boolean;
  order: number;
}

/** Shipping & Returns block from storefront settings. */
export interface ShippingReturns {
  isActive: boolean;
  title: LocalizedText;
  body: LocalizedText;
}

/** Store contact details shown on the contact page (backend-driven). */
export interface ContactInfo {
  isActive: boolean;
  email: string;
  phone: string;
  address: LocalizedText;
  workingHours: LocalizedText;
}

export interface ProductColor {
  name: LocalizedText;
  hex: string;
}

export interface Variant {
  id: string;
  sku: string;
  size: string;
  color: ProductColor;
  stock: number;
  priceOverride?: number | null;
}

export type Badge = "new" | "best-seller" | "sale";

/**
 * Localized measurement table shown on the product page. Column headers are
 * localized; row cells are plain strings (e.g. "90" or "90-94"). All parts are
 * optional — older products may have an empty chart.
 */
export interface SizeChart {
  columns: LocalizedText[];
  rows: string[][];
  note: LocalizedText;
}

/** Localized fabric composition and care instructions. */
export interface FabricCare {
  fabric: LocalizedText;
  care: LocalizedText;
}

export interface Product {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  category: string; // primary category slug
  /**
   * All category slugs the product belongs to (includes the primary).
   * Falls back to `[category]` until the backend exposes a `categories` array.
   */
  categories: string[];
  basePrice: number;
  salePrice?: number | null;
  images: ProductImage[];
  variants: Variant[];
  badges: Badge[];
  ratingAvg: number;
  ratingCount: number;
  sold: number;
  /** Localized size/measurement table. Empty when unset. */
  sizeChart: SizeChart;
  /** Localized fabric composition and care instructions. Empty when unset. */
  fabricCare: FabricCare;
}

export interface Review {
  id: string;
  productId: string;
  name: string;
  rating: number;
  comment: LocalizedText;
  isVerifiedPurchase: boolean;
}

/** A review as seen by the admin moderation screen (includes approval state). */
export interface AdminReview {
  id: string;
  productId: string;
  /** Product display name if the backend populated it, else "". */
  productName: string;
  name: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

export interface ShippingZone {
  id: string;
  governorate: LocalizedText;
  fee: number;
  estimatedDays: string;
  /** Inactive zones are hidden from checkout but still shown in the admin. */
  isActive: boolean;
}

/** A Mylerz delivery zone (neighborhood) inside a governorate. */
export interface GovernorateZone {
  code: string;
  nameEn: string;
  nameAr: string;
}

/** A governorate with its nested zones, from GET /shipping/governorates. */
export interface Governorate {
  code: string;
  nameEn: string;
  nameAr: string;
  zones: GovernorateZone[];
}

/** Live shipping/cart quote from POST /shipping/quote. */
export interface ShippingQuote {
  currency: string;
  subtotal: number;
  discount: number;
  cartTotal: number;
  shippingFee: number;
  /** VAT charged on the shipping fee. total already includes it. */
  shippingVat?: number;
  freeShipping: boolean;
  total: number;
}

export interface Coupon {
  /** Mongo _id — present when loaded from the backend, absent in mock data. */
  id?: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrderTotal: number;
  usedCount: number;
  discountGiven: number;
  revenueGenerated: number;
  isActive: boolean;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export type PaymentMethod = "paymob" | "cod";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

/** Paymob checkout mode returned by the payment intent. */
export type PaymentProvider = "unified_checkout" | "legacy_iframe";

export interface PaymentIntent {
  redirectUrl?: string;
  /** Hosted checkout URL — used when provider is `unified_checkout`. */
  checkoutUrl?: string;
  /** Legacy iframe URL — used when provider is `legacy_iframe`. */
  iframeUrl?: string;
  provider?: PaymentProvider | string;
  /** Newer backend field for the checkout mode. */
  flow?: PaymentProvider | string;
}

export interface OrderItem {
  productId: string;
  name: LocalizedText;
  sku: string;
  size: string;
  colorName: string;
  colorHex: string;
  qty: number;
  unitPrice: number;
  image?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: { name: string; email: string; phone: string };
  shippingAddress: {
    governorate: string;
    city: string;
    street: string;
    apartment?: string;
    postal?: string;
    /** Mylerz governorate code (maps to courier cityCode). New orders only. */
    governorateCode?: string;
    /** Mylerz zone code (maps to courier neighborhoodCode). New orders only. */
    zoneCode?: string;
  };
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  /** VAT charged on the shipping fee. total already includes it. */
  shippingVat?: number;
  discount?: { couponCode: string; amount: number };
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  courier?: {
    provider?: string;
    trackingNumber?: string;
    pickupOrderCode?: string;
    status?: string;
  };
  createdAt: string; // ISO date
}

export type ContactStatus = "new" | "read" | "replied" | "archived";

export interface ContactMessage {
  id: string;
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
  /** Registered account id if the sender was logged in, otherwise null. */
  user?: string | null;
  readAt?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Backend pagination envelope (`meta`) shared by list endpoints. */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CartItem {
  productId: string;
  variantId: string;
  slug: string;
  name: LocalizedText;
  sku: string;
  size: string;
  colorName: string;
  colorHex: string;
  qty: number;
  unitPrice: number;
  image?: string;
  maxStock: number;
}
