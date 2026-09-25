import type {
  ContactInfo,
  Faq,
  HeroContent,
  HeroImage,
  LocalizedText,
  ShippingReturns,
  StorefrontSettings,
} from "./types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
const API_ORIGIN = API_URL.replace(/\/api\/v1$/, "");

/** Makes a stored media URL loadable: legacy `/uploads/...` paths live on the API host. */
export const resolveMediaUrl = (url: string) =>
  !url || /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;

// Bundled hero photo, used until the admin uploads one (Admin → Hero Banner).
export const DEFAULT_HERO_IMAGE = "/hero/romz-hero.jpg";

export const EMPTY_HERO: HeroContent = {
  title: { en: "", ar: "" },
  subtitle: { en: "", ar: "" },
  ctaLabel: { en: "", ar: "" },
  ctaHref: "",
  image: { url: "", publicId: "" },
  mobileImage: { url: "", publicId: "" },
};

export const DEFAULT_STOREFRONT_SETTINGS: StorefrontSettings = {
  promoBar: {
    active: true,
    text: {
      en: "2 ITEMS = FREE SHIPPING - 3 ITEMS = 15% OFF + FREE SHIPPING",
      ar: "قطعتين = شحن مجاني - 3 قطع = خصم 15% + شحن مجاني",
    },
  },
  payments: {
    paymob: {
      active: true,
    },
  },
  freeShippingThreshold: null,
  lowStockThreshold: 5,
  faqs: [],
  shippingReturns: {
    isActive: false,
    title: { en: "", ar: "" },
    body: { en: "", ar: "" },
  },
  contactInfo: {
    isActive: false,
    email: "",
    phone: "",
    address: { en: "", ar: "" },
    workingHours: { en: "", ar: "" },
  },
  hero: EMPTY_HERO,
};

const textValue = (value: unknown, fallback: string) =>
  typeof value === "string" ? value : fallback;

const localizedValue = (value: unknown, fallback: LocalizedText): LocalizedText => {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return { en: textValue(v.en, fallback.en), ar: textValue(v.ar, fallback.ar) };
};

const EMPTY_TEXT: LocalizedText = { en: "", ar: "" };

/** Normalize the FAQ array. Preserves backend _id so the admin can edit in place. */
export const normalizeFaqs = (value: unknown): Faq[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const v = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const id =
      typeof v._id === "string" ? v._id : typeof v.id === "string" ? v.id : undefined;
    return {
      ...(id ? { id } : {}),
      question: localizedValue(v.question, EMPTY_TEXT),
      answer: localizedValue(v.answer, EMPTY_TEXT),
      isActive: typeof v.isActive === "boolean" ? v.isActive : true,
      order: typeof v.order === "number" ? v.order : index,
    };
  });
};

/** Normalize the Shipping & Returns block. Defaults to hidden when absent. */
export const normalizeShippingReturns = (value: unknown): ShippingReturns => {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    isActive: typeof v.isActive === "boolean" ? v.isActive : false,
    title: localizedValue(v.title, EMPTY_TEXT),
    body: localizedValue(v.body, EMPTY_TEXT),
  };
};

/** Normalize the store contact details. Defaults to hidden when absent. */
export const normalizeContactInfo = (value: unknown): ContactInfo => {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    isActive: typeof v.isActive === "boolean" ? v.isActive : false,
    email: textValue(v.email, ""),
    phone: textValue(v.phone, ""),
    address: localizedValue(v.address, EMPTY_TEXT),
    workingHours: localizedValue(v.workingHours, EMPTY_TEXT),
  };
};

const heroImageValue = (value: unknown): HeroImage => {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return { url: textValue(v.url, ""), publicId: textValue(v.publicId, "") };
};

/**
 * The homepage hero is the first active entry of the backend's `heroSlides`
 * (the storefront shows a single hero). Missing = all-empty, i.e. defaults.
 */
export const normalizeHero = (value: unknown): HeroContent => {
  const slides = Array.isArray(value) ? value : [];
  const first = slides.find(
    (s) => s && typeof s === "object" && (s as Record<string, unknown>).isActive !== false
  );
  if (!first) return EMPTY_HERO;
  const v = first as Record<string, unknown>;
  return {
    title: localizedValue(v.title, EMPTY_TEXT),
    subtitle: localizedValue(v.subtitle, EMPTY_TEXT),
    ctaLabel: localizedValue(v.ctaLabel, EMPTY_TEXT),
    ctaHref: textValue(v.ctaHref, ""),
    image: heroImageValue(v.image),
    mobileImage: heroImageValue(v.mobileImage),
  };
};

export const normalizeStorefrontSettings = (value: unknown): StorefrontSettings => {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const promoBar =
    input.promoBar && typeof input.promoBar === "object"
      ? input.promoBar as Record<string, unknown>
      : {};
  const nestedText =
    promoBar.text && typeof promoBar.text === "object"
      ? promoBar.text as Record<string, unknown>
      : promoBar;
  const payments =
    input.payments && typeof input.payments === "object"
      ? input.payments as Record<string, unknown>
      : {};
  const paymob =
    payments.paymob && typeof payments.paymob === "object"
      ? payments.paymob as Record<string, unknown>
      : {};

  return {
    promoBar: {
      active:
        typeof input.promoBarActive === "boolean"
          ? input.promoBarActive
          : typeof promoBar.active === "boolean"
          ? promoBar.active
          : DEFAULT_STOREFRONT_SETTINGS.promoBar.active,
      text: {
        en: textValue(nestedText.en, DEFAULT_STOREFRONT_SETTINGS.promoBar.text.en),
        ar: textValue(nestedText.ar, DEFAULT_STOREFRONT_SETTINGS.promoBar.text.ar),
      },
    },
    payments: {
      paymob: {
        active:
          typeof paymob.active === "boolean"
            ? paymob.active
            : DEFAULT_STOREFRONT_SETTINGS.payments.paymob.active,
      },
    },
    freeShippingThreshold:
      input.freeShippingThreshold === null
        ? null
        : typeof input.freeShippingThreshold === "number" &&
            Number.isFinite(input.freeShippingThreshold) &&
            input.freeShippingThreshold >= 0
          ? input.freeShippingThreshold
          : DEFAULT_STOREFRONT_SETTINGS.freeShippingThreshold,
    lowStockThreshold:
      typeof input.lowStockThreshold === "number" &&
      Number.isInteger(input.lowStockThreshold) &&
      input.lowStockThreshold >= 0
        ? input.lowStockThreshold
        : DEFAULT_STOREFRONT_SETTINGS.lowStockThreshold,
    faqs: normalizeFaqs(input.faqs),
    shippingReturns: normalizeShippingReturns(input.shippingReturns),
    contactInfo: normalizeContactInfo(input.contactInfo),
    hero: normalizeHero(input.heroSlides),
  };
};

export async function getStorefrontSettings(): Promise<StorefrontSettings> {
  if (!API_URL) {
    throw new Error("Backend is not configured (NEXT_PUBLIC_API_URL is missing).");
  }

  const response = await fetch(`${API_URL}/storefront-settings`, {
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message ?? `Store settings request failed (${response.status}).`);
  }
  return normalizeStorefrontSettings(body?.data?.settings);
}
