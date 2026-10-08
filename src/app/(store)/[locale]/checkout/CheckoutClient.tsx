"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, CreditCard, Banknote, Lock, Truck } from "lucide-react";
import clsx from "clsx";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import Button, { btn } from "@/components/ui/Button";
import { formatEGP, lt } from "@/lib/format";
import {
  ApiError,
  createOrder,
  createPaymentIntent,
  getShippingQuote,
  paymentRedirectUrl,
  validateCart,
  type ValidatedCart,
} from "@/lib/api";
import { savePendingOrder } from "@/lib/payment";
import { pixelCartParams, trackPixel } from "@/lib/pixel";
import type {
  Governorate,
  Locale,
  ShippingQuote,
  StorefrontSettings,
} from "@/lib/types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");

interface FormState {
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  apartment: string;
  postal: string;
  governorateCode: string;
  zoneCode: string;
  phone: string;
  payment: "paymob" | "cod";
}

const initialForm: FormState = {
  email: "",
  firstName: "",
  lastName: "",
  address: "",
  apartment: "",
  postal: "",
  governorateCode: "",
  zoneCode: "",
  phone: "",
  payment: "cod",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display uppercase text-2xl text-navy">
        {title}
      </h2>
      <div className="mb-6 mt-2 h-1 w-14 bg-brand" />
      {children}
    </section>
  );
}

const inputCls =
  "w-full border-0 border-b-2 border-navy/30 bg-transparent px-1 py-2.5 text-sm text-navy placeholder:text-muted outline-none focus:border-brand transition-colors";

const checkoutErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return "Cannot reach the server. Please check that the backend is running and try again.";
    }
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

const needsLoginForOrder = (error: unknown) => {
  if (!(error instanceof ApiError)) return false;
  const message = error.message.toLowerCase();
  return (
    error.status === 401 ||
    error.status === 403 ||
    message.includes("cannot access this order") ||
    message.includes("access this order")
  );
};

const couponRequirementMessage = (error: unknown, locale: Locale) => {
  if (!(error instanceof ApiError) || !error.data || typeof error.data !== "object") {
    return null;
  }
  const data = error.data as Record<string, unknown>;
  const subtotal =
    typeof data.subtotal === "number" ? data.subtotal : Number(data.subtotal);
  const minOrderTotal =
    typeof data.minOrderTotal === "number"
      ? data.minOrderTotal
      : Number(data.minOrderTotal);

  if (!Number.isFinite(subtotal) || !Number.isFinite(minOrderTotal)) {
    return null;
  }

  return `Coupon requires minimum order of ${formatEGP(
    minOrderTotal,
    locale
  )}. Current backend subtotal is ${formatEGP(subtotal, locale)}.`;
};

export default function CheckoutClient({
  governorates,
  settings,
}: {
  governorates: Governorate[];
  settings: StorefrontSettings;
}) {
  const t = useTranslations("checkout");
  const locale = useLocale() as Locale;
  const { items, clear } = useCart();
  const { authRequest } = useAuth();
  const submittingRef = useRef(false);
  const paymobActive = settings.payments.paymob.active;

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [validatedCart, setValidatedCart] = useState<ValidatedCart | null>(null);
  const [validatingCart, setValidatingCart] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<string | null>(null);
  const [confirmedInfo, setConfirmedInfo] = useState({ name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loginRequiredOrder, setLoginRequiredOrder] = useState<{
    orderNumber: string;
    contact: string;
  } | null>(null);
  // Live Mylerz shipping fee for the selected zone (POST /shipping/quote).
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Two-step governorate → zone selection drives the live shipping quote.
  const selectedGov = governorates.find((g) => g.code === form.governorateCode);
  const zoneOptions = selectedGov?.zones ?? [];
  const selectedZone = zoneOptions.find((z) => z.code === form.zoneCode);
  const zoneName = (z: { nameEn: string; nameAr: string }) =>
    locale === "ar" ? z.nameAr || z.nameEn : z.nameEn;

  const backendTotal = validatedCart?.total ?? 0;
  const shippingFee = selectedZone ? shippingQuote?.shippingFee ?? null : null;
  // Total is authoritative from the backend: the quote's `total` already
  // includes cart + shipping + VAT. Before a zone is picked (no quote yet),
  // fall back to the cart-only total from cart validation.
  const total = shippingQuote
    ? shippingQuote.total
    : validatedCart
      ? backendTotal
      : 0;

  // Meta Pixel: one InitiateCheckout per checkout visit, as soon as the
  // persisted cart has loaded (it hydrates from localStorage after mount).
  const initiatedCheckout = useRef(false);
  useEffect(() => {
    if (initiatedCheckout.current || items.length === 0) return;
    initiatedCheckout.current = true;
    trackPixel(
      "InitiateCheckout",
      pixelCartParams(
        items.map((i) => ({ id: i.productId, quantity: i.qty, item_price: i.unitPrice })),
        items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)
      )
    );
  }, [items]);

  const validationItems = useMemo(
    () =>
      items.map((item) => ({
        product: item.productId,
        variantId: item.variantId || undefined,
        sku: item.sku,
        qty: item.qty,
      })),
    [items]
  );

  const set = (key: keyof FormState, value: string) => {
    setLoginRequiredOrder(null);
    setSubmitError(null);
    setForm((f) => ({
      ...f,
      [key]: value,
      // Changing the governorate invalidates the previously picked zone.
      ...(key === "governorateCode" ? { zoneCode: "" } : {}),
    }));
  };

  const validateCurrentCart = useCallback(
    (coupon = appliedCoupon) =>
      authRequest((token) =>
        validateCart(
          {
            items: validationItems,
            couponCode: coupon,
          },
          token
        )
      ),
    [appliedCoupon, authRequest, validationItems]
  );

  useEffect(() => {
    if (validationItems.length === 0) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setValidatingCart(true);
      setValidatedCart(null);
      setValidationError(null);
    });

    validateCurrentCart()
      .then((cart) => {
        if (cancelled) return;
        setValidatedCart(cart);
        setCouponError(null);
        if (!cart.isValid) {
          setValidationError(
            cart.unavailableItems[0]?.reason ?? "Cart has unavailable items."
          );
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const message = checkoutErrorMessage(error, t("orderFailed"));
        setValidatedCart(null);
        setValidationError(message);
        if (appliedCoupon) {
          setAppliedCoupon("");
          setCouponError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setValidatingCart(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appliedCoupon, t, validateCurrentCart, validationItems.length]);

  // Fetch the live shipping fee whenever the zone, cart, coupon, or payment
  // method changes. The backend re-computes the authoritative fee on order.
  const govNameEn = selectedGov?.nameEn;
  useEffect(() => {
    if (!form.zoneCode || validationItems.length === 0) {
      setShippingQuote(null);
      setQuoteError(null);
      return;
    }

    let cancelled = false;
    setQuoting(true);
    setQuoteError(null);

    authRequest((token) =>
      getShippingQuote(
        {
          zoneCode: form.zoneCode,
          governorate: govNameEn,
          items: validationItems,
          couponCode: appliedCoupon,
          paymentMethod: form.payment,
        },
        token
      )
    )
      .then((quote) => {
        if (!cancelled) setShippingQuote(quote);
      })
      .catch((error) => {
        if (cancelled) return;
        setShippingQuote(null);
        setQuoteError(checkoutErrorMessage(error, t("shippingUnavailable")));
      })
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    form.zoneCode,
    form.payment,
    govNameEn,
    appliedCoupon,
    validationItems,
    authRequest,
    t,
  ]);

  const applyCoupon = async () => {
    setCouponError(null);
    const normalized = couponCode.trim().toUpperCase();
    if (!normalized) return;

    setValidatingCart(true);
    setValidationError(null);
    setValidatedCart(null);

    try {
      const cart = await validateCurrentCart(normalized);
      setValidatedCart(cart);
      setAppliedCoupon(cart.discount.couponCode || normalized);
      if (!cart.isValid) {
        setValidationError(
          cart.unavailableItems[0]?.reason ?? "Cart has unavailable items."
        );
      }
    } catch (error) {
      const message = couponRequirementMessage(error, locale) ??
        checkoutErrorMessage(error, t("invalidCoupon"));
      setAppliedCoupon("");
      setCouponError(message);
      setValidationError(message);

      try {
        const cart = await validateCurrentCart("");
        setValidatedCart(cart);
        setValidationError(
          cart.isValid
            ? null
            : cart.unavailableItems[0]?.reason ?? "Cart has unavailable items."
        );
      } catch {
        // Keep the coupon error visible; checkout stays blocked until revalidated.
      }
    } finally {
      setValidatingCart(false);
    }
  };

  const submit = async () => {
    if (submittingRef.current || loginRequiredOrder) return;

    const required: (keyof FormState)[] = [
      "email",
      "firstName",
      "lastName",
      "address",
      "governorateCode",
      "zoneCode",
      "phone",
    ];
    const newErrors: typeof errors = {};
    for (const key of required) if (!form[key].trim()) newErrors[key] = true;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    if (submitting) return;
    if (validatingCart || !validatedCart || validationError || !validatedCart.isValid) {
      setSubmitError(validationError ?? t("cartValidating"));
      return;
    }
    if (!selectedGov || !selectedZone) {
      setSubmitError(t("shippingUnavailable"));
      return;
    }
    if (quoting || quoteError || shippingFee === null) {
      setSubmitError(quoteError ?? t("cartValidating"));
      return;
    }
    if (form.payment === "paymob" && !paymobActive) {
      set("payment", "cod");
      setSubmitError(t("cardUnavailable"));
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setLoginRequiredOrder(null);

    const customer = {
      name: `${form.firstName} ${form.lastName}`.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    };
    // Contact used for order tracking on the callback page (phone preferred).
    const contact = customer.phone || customer.email;

    try {
      // Order-first flow: create the order (COD or Paymob) before any payment.
      const order = await authRequest((token) =>
        createOrder(
          {
            customer,
            shippingAddress: {
              // Labels for the dashboard/emails, codes for Mylerz shipping.
              governorate: selectedGov.nameEn,
              city: selectedZone.nameEn,
              governorateCode: selectedGov.code,
              zoneCode: selectedZone.code,
              street: form.address,
              // Optional on the backend; omit when the customer leaves it blank.
              apartment: form.apartment.trim() || undefined,
              postal: form.postal.trim() || undefined,
            },
            items: validatedCart.items.map((item) => ({
              product: item.product,
              variantId: item.variantId,
              qty: item.qty,
            })),
            couponCode: validatedCart.discount.couponCode || undefined,
            paymentMethod: form.payment,
          },
          token
        )
      );

      if (form.payment === "paymob") {
        // Step 2: exchange the order id for a Paymob checkout/iframe URL.
        let intent;
        try {
          intent = await authRequest((token) =>
            createPaymentIntent(
              {
                orderId: order.id,
                contact,
                redirectionUrl: `${window.location.origin}/${locale}/payment/callback`,
                notificationUrl: `${API_URL}/payments/paymob/webhook`,
                customer,
              },
              token
            )
          );
        } catch (error) {
          if (needsLoginForOrder(error)) {
            savePendingOrder({ orderNumber: order.orderNumber, contact });
            setLoginRequiredOrder({ orderNumber: order.orderNumber, contact });
            setSubmitError(t("loginRequiredAfterOrder"));
            clear();
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }
          throw error;
        }
        const redirect = paymentRedirectUrl(intent);
        if (!redirect) throw new Error(t("paymentUrlMissing"));

        // Stash order number + contact so the callback page can poll the
        // backend (the single source of truth) for the real payment status.
        savePendingOrder({ orderNumber: order.orderNumber, contact });
        clear();
        window.location.assign(redirect);
        return;
      }

      // COD: order is confirmed immediately. (Card orders report Purchase from
      // the payment callback page, once the backend confirms the payment.)
      trackPixel(
        "Purchase",
        pixelCartParams(
          validatedCart.items.map((item) => ({
            id: item.product,
            quantity: item.qty,
            item_price: item.unitPrice,
          })),
          order.total
        ),
        { eventID: order.orderNumber }
      );
      setConfirmedInfo({ name: form.firstName, email: form.email });
      setConfirmedOrder(order.orderNumber);
      clear();
      window.scrollTo({ top: 0 });
    } catch (error) {
      console.error("Checkout failed", error);
      const couponMessage = couponRequirementMessage(error, locale);
      if (couponMessage) {
        setAppliedCoupon("");
        setCouponError(couponMessage);
        setSubmitError(couponMessage);
        try {
          const refreshed = await validateCurrentCart("");
          setValidatedCart(refreshed);
          setValidationError(
            refreshed.isValid
              ? null
              : refreshed.unavailableItems[0]?.reason ?? "Cart has unavailable items."
          );
        } catch {
          // The original order error is clearer for the customer here.
        }
      } else {
        setSubmitError(checkoutErrorMessage(error, t("orderFailed")));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const summaryItems = validatedCart?.items ?? [];

  if (confirmedOrder) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display uppercase text-4xl text-navy">
          {t("confirmedTitle")}
        </h1>
        <div className="mx-auto mt-3 h-1 w-16 bg-brand" />
        <p className="mt-6 text-muted">
          {t("confirmedBody", {
            name: confirmedInfo.name,
            email: confirmedInfo.email,
          })}
        </p>
        <div className="mt-8 border-2 border-navy/10 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            {t("orderNumber")}
          </p>
          <p className="mt-1 font-display text-3xl text-brand">{confirmedOrder}</p>
        </div>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/track-order" className={btn("primary", "md")}>
            <span>{t("trackCta")}</span>
          </Link>
          <Link href="/" className={btn("outline", "md")}>
            <span>{t("backHome")}</span>
          </Link>
        </div>
      </div>
    );
  }

  if (loginRequiredOrder) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <AlertCircle size={48} className="mx-auto text-brand" />
        <h1 className="mt-6 font-display uppercase text-3xl text-navy">
          {t("orderCreatedLoginTitle")}
        </h1>
        <p className="mt-4 text-muted">{t("orderCreatedLoginBody")}</p>
        <div className="mt-8 border-2 border-navy/10 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            {t("orderNumber")}
          </p>
          <p className="mt-1 font-display text-3xl text-brand">
            {loginRequiredOrder.orderNumber}
          </p>
        </div>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/account/login" className={btn("primary", "md")}>
            <span>{t("signInToPay")}</span>
          </Link>
          <Link href="/track-order" className={btn("outline", "md")}>
            <span>{t("trackCta")}</span>
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-muted">{t("emptyCart")}</p>
        <Link href="/" className={btn("primary", "md", "mt-6")}>
          <span>{t("backHome")}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_420px] lg:py-14">
      {/* ── Left column ── */}
      <div className="space-y-10">
        <Section title={t("contact")}>
          <input
            type="email"
            placeholder={t("email")}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className={clsx(inputCls, errors.email && "border-brand")}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-brand">{t("required")}</p>
          )}
        </Section>

        <Section title={t("delivery")}>
          <div className="space-y-5">
            <select disabled className={clsx(inputCls, "appearance-none opacity-70")}>
              <option>{t("country")}</option>
            </select>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <input
                  placeholder={t("firstName")}
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  className={clsx(inputCls, errors.firstName && "border-brand")}
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-brand">{t("required")}</p>
                )}
              </div>
              <div>
                <input
                  placeholder={t("lastName")}
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  className={clsx(inputCls, errors.lastName && "border-brand")}
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-brand">{t("required")}</p>
                )}
              </div>
            </div>
            <div>
              <input
                placeholder={t("address")}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                className={clsx(inputCls, errors.address && "border-brand")}
              />
              {errors.address && (
                <p className="mt-1 text-xs text-brand">{t("required")}</p>
              )}
            </div>
            <div>
              <input
                placeholder={t("apartment")}
                value={form.apartment}
                onChange={(e) => set("apartment", e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <select
                  value={form.governorateCode}
                  onChange={(e) => set("governorateCode", e.target.value)}
                  className={clsx(
                    inputCls,
                    "bg-transparent",
                    errors.governorateCode && "border-brand"
                  )}
                >
                  <option value="">{t("governorate")}</option>
                  {governorates.map((g) => (
                    <option key={g.code} value={g.code}>
                      {zoneName(g)}
                    </option>
                  ))}
                </select>
                {errors.governorateCode && (
                  <p className="mt-1 text-xs text-brand">{t("required")}</p>
                )}
              </div>
              <div>
                <select
                  value={form.zoneCode}
                  onChange={(e) => set("zoneCode", e.target.value)}
                  disabled={!selectedGov}
                  className={clsx(
                    inputCls,
                    "bg-transparent disabled:opacity-60",
                    errors.zoneCode && "border-brand"
                  )}
                >
                  <option value="">
                    {selectedGov ? t("zone") : t("zonePickGovernorate")}
                  </option>
                  {zoneOptions.map((z) => (
                    <option key={z.code} value={z.code}>
                      {zoneName(z)}
                    </option>
                  ))}
                </select>
                {errors.zoneCode && (
                  <p className="mt-1 text-xs text-brand">{t("required")}</p>
                )}
              </div>
            </div>
            <div>
              <input
                placeholder={t("postal")}
                value={form.postal}
                onChange={(e) => set("postal", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 border-b-2 border-navy/30 focus-within:border-brand transition-colors">
                <span className="text-lg">🇪🇬</span>
                <input
                  placeholder={t("phone")}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="w-full border-0 bg-transparent px-1 py-2.5 text-sm text-navy placeholder:text-muted outline-none"
                  dir="ltr"
                />
              </div>
              {errors.phone && (
                <p className="mt-1 text-xs text-brand">{t("required")}</p>
              )}
            </div>
          </div>
        </Section>

        <Section title={t("shippingMethod")}>
          {!selectedZone ? (
            <div className="flex items-center gap-3 border-2 border-dashed border-navy/25 bg-white px-4 py-3.5 text-sm text-muted">
              <Truck size={20} className="shrink-0" />
              <span>{t("selectGovernorate")}</span>
            </div>
          ) : quoteError ? (
            <div className="flex items-center gap-3 border-2 border-brand/50 bg-white px-4 py-3.5 text-sm text-brand">
              <AlertCircle size={20} className="shrink-0" />
              <span>{quoteError}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between border-2 border-brand bg-white px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-brand/10 text-brand">
                  <Truck size={20} />
                </span>
                <div className="text-start">
                  <p className="text-sm font-bold text-navy">
                    {zoneName(selectedZone)}
                    {selectedGov ? `, ${zoneName(selectedGov)}` : ""}
                  </p>
                  <p className="text-xs text-muted">
                    {quoting
                      ? t("cartValidating")
                      : shippingQuote?.freeShipping
                        ? t("freeShipping")
                        : t("shipping")}
                  </p>
                </div>
              </div>
              <span
                className={clsx(
                  "text-sm font-extrabold",
                  shippingFee === 0 ? "text-brand" : "text-navy"
                )}
              >
                {quoting
                  ? "…"
                  : shippingFee !== null
                    ? shippingFee === 0
                      ? t("freeShipping")
                      : formatEGP(shippingFee, locale)
                    : "—"}
              </span>
            </div>
          )}
        </Section>

        <Section title={t("payment")}>
          <div className="space-y-3">
            {paymobActive ? (
              <button
                type="button"
                onClick={() => set("payment", "paymob")}
                className={clsx(
                  "flex w-full items-center justify-between border-2 bg-white px-4 py-3.5 cursor-pointer transition-colors",
                  form.payment === "paymob" ? "border-brand" : "border-navy/15"
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={clsx(
                      "flex h-5 w-5 items-center justify-center rounded-full border-2",
                      form.payment === "paymob" ? "border-brand" : "border-navy/30"
                    )}
                  >
                    {form.payment === "paymob" && (
                      <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                    )}
                  </span>
                  <div className="text-start">
                    <p className="text-sm font-bold text-navy">{t("card")}</p>
                    <p className="text-xs text-muted">{t("cardNote")}</p>
                  </div>
                </div>
                <CreditCard size={20} className="text-navy" />
              </button>
            ) : (
              <div className="flex w-full items-center justify-between border-2 border-navy/10 bg-surface px-4 py-3.5 text-muted">
                <div className="text-start">
                  <p className="text-sm font-bold text-navy">{t("card")}</p>
                  <p className="text-xs">{t("cardUnavailable")}</p>
                </div>
                <CreditCard size={20} />
              </div>
            )}

            <button
              type="button"
              onClick={() => set("payment", "cod")}
              className={clsx(
                "flex w-full items-center justify-between border-2 bg-white px-4 py-3.5 cursor-pointer transition-colors",
                form.payment === "cod" ? "border-brand" : "border-navy/15"
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={clsx(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2",
                    form.payment === "cod" ? "border-brand" : "border-navy/30"
                  )}
                >
                  {form.payment === "cod" && (
                    <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                  )}
                </span>
                <p className="text-sm font-bold text-navy">{t("cod")}</p>
              </div>
              <Banknote size={20} className="text-navy" />
            </button>
          </div>
        </Section>
      </div>

      {/* ── Order summary ── */}
      <aside className="h-fit bg-navy p-6 text-white lg:sticky lg:top-24">
        <h2 className="font-display uppercase text-2xl">
          {t("orderSummary")}
        </h2>

        <div className="mt-6 space-y-4">
          {summaryItems.map((item) => (
            <div key={item.variantId} className="flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 bg-white/10">
                {item.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
                <span className="absolute -top-2 -end-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-extrabold">
                  {item.qty}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase">
                  {lt(item.productName, locale)}
                </p>
                <p className="text-[11px] text-white/60">
                  {item.size} / {item.colorName}
                </p>
              </div>
              <span className="text-sm font-bold">
                {formatEGP(item.lineTotal, locale)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2 border-t border-white/15 pt-6">
          <input
            placeholder={t("discountCode")}
            value={couponCode}
            onChange={(e) => {
              const next = e.target.value;
              setCouponCode(next);
              setCouponError(null);
              if (appliedCoupon && next.trim().toUpperCase() !== appliedCoupon) {
                setAppliedCoupon("");
              }
            }}
            className="w-full border border-white/25 bg-transparent px-3 py-2 text-sm placeholder:text-white/40 outline-none focus:border-brand"
          />
          <button
            onClick={applyCoupon}
            disabled={validatingCart || !couponCode.trim()}
            className="shrink-0 bg-brand px-4 py-2 text-sm font-extrabold uppercase hover:bg-brand-dark transition-colors cursor-pointer disabled:opacity-60"
          >
            {validatingCart && appliedCoupon ? "..." : t("apply")}
          </button>
        </div>
        {couponError && (
          <p className="mt-2 text-xs text-brand">{couponError}</p>
        )}
        {validatingCart && (
          <p className="mt-2 text-xs text-white/60">{t("cartValidating")}</p>
        )}
        {validationError && !validatingCart && (
          <div className="mt-3 border-2 border-brand/50 bg-white px-3 py-2 text-xs text-brand">
            <p className="font-extrabold uppercase">{t("checkoutErrorTitle")}</p>
            <p className="mt-1">{validationError}</p>
            {validatedCart?.unavailableItems.map((item, index) => (
              <p key={`${item.variantId ?? item.sku ?? index}`} className="mt-1">
                {item.sku ? `${item.sku}: ` : ""}
                {item.reason}
              </p>
            ))}
          </div>
        )}

        <div className="mt-6 space-y-2 border-t border-white/15 pt-6 text-sm">
          <div className="flex justify-between text-white/80">
            <span>{t("subtotal")}</span>
            <span>
              {validatedCart ? formatEGP(validatedCart.subtotal, locale) : "..."}
            </span>
          </div>
          <div className="flex justify-between text-white/80">
            <span>{t("shipping")}</span>
            <span>
              {quoting
                ? "…"
                : selectedZone && shippingFee !== null
                  ? shippingFee === 0
                    ? t("freeShipping")
                    : formatEGP(shippingFee ?? 0, locale)
                  : "—"}
            </span>
          </div>
          {(validatedCart?.discount.amount ?? 0) > 0 && (
            <div className="flex justify-between text-brand">
              <span>{t("discount")}</span>
              <span>-{formatEGP(validatedCart?.discount.amount ?? 0, locale)}</span>
            </div>
          )}
          {(shippingQuote?.shippingVat ?? 0) > 0 && (
            <div className="flex justify-between text-white/80">
              <span>{t("vat")}</span>
              <span>{formatEGP(shippingQuote?.shippingVat ?? 0, locale)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 text-lg font-extrabold">
            <span>{t("total")}</span>
            <span>{validatedCart ? formatEGP(total, locale) : "..."}</span>
          </div>
        </div>

        <Button
          size="lg"
          className="mt-6 w-full"
          onClick={submit}
          disabled={
            submitting ||
            validatingCart ||
            !validatedCart ||
            Boolean(validationError) ||
            !validatedCart.isValid ||
            Boolean(loginRequiredOrder) ||
            !selectedZone ||
            quoting ||
            Boolean(quoteError) ||
            shippingFee === null
          }
          aria-busy={submitting || validatingCart || quoting}
        >
          {submitting ? "…" : t("payNow")}
        </Button>
        {submitError && (
          <div
            role="alert"
            className="mt-3 flex gap-3 border-2 border-brand/50 bg-white px-4 py-3 text-start text-sm text-brand"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-extrabold uppercase">{t("checkoutErrorTitle")}</p>
              <p className="mt-1 text-xs leading-relaxed">{submitError}</p>
            </div>
          </div>
        )}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/60">
          <Lock size={12} />
          {t("secure")}
        </p>
      </aside>
    </div>
  );
}
