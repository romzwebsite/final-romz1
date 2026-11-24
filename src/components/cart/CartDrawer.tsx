"use client";

import { useLocale, useTranslations } from "next-intl";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useCart } from "./CartProvider";
import SuggestedProducts from "./SuggestedProducts";
import { formatEGP, lt } from "@/lib/format";
import { computeBogo } from "@/lib/bogo";
import { btn } from "@/components/ui/Button";
import type { Locale } from "@/lib/types";

export default function CartDrawer() {
  const t = useTranslations("cart");
  const locale = useLocale() as Locale;
  const ar = locale === "ar";
  const reducedMotion = useReducedMotion();
  const { items, subtotal, isOpen, setOpen, updateQty, removeItem, activePromo } =
    useCart();

  // Buy X Get Y preview (the authoritative total is computed at checkout).
  const bogo = activePromo
    ? computeBogo(
        items.map((i) => ({ unitPrice: i.unitPrice, qty: i.qty })),
        activePromo.buyQuantity,
        activePromo.freeQuantity
      )
    : null;
  const minMet = !activePromo || subtotal >= activePromo.minOrderTotal;
  const showBogoDiscount = !!bogo && minMet && bogo.discount > 0;
  const promoTotal = showBogoDiscount ? Math.max(0, subtotal - bogo!.discount) : subtotal;

  // Slide from the logical end side: right in LTR, left in RTL.
  const closedX = locale === "ar" ? "-100%" : "100%";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-navy/60"
            onClick={() => setOpen(false)}
          />
          <motion.aside
            initial={reducedMotion ? { opacity: 0 } : { x: closedX }}
            animate={reducedMotion ? { opacity: 1 } : { x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { x: closedX }}
            transition={
              reducedMotion
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 320, damping: 32 }
            }
            className="absolute end-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
          >
        <div className="flex items-center justify-between border-b-2 border-brand px-5 py-4">
          <h2 className="font-display uppercase text-2xl text-navy">
            {t("title")}
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="text-navy hover:text-brand cursor-pointer"
            aria-label="close"
          >
            <X size={24} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
            <p className="text-muted">{t("empty")}</p>
            <button
              onClick={() => setOpen(false)}
              className={btn("primary", "md")}
            >
              <span>{t("emptyCta")}</span>
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.map((item) => (
                <div
                  key={item.sku}
                  className="flex gap-3 border-b border-navy/10 py-4"
                >
                  <div className="h-20 w-20 shrink-0 bg-surface">
                    {item.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={lt(item.name, locale)}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <p className="text-sm font-bold text-navy">
                      {lt(item.name, locale)}
                    </p>
                    <p className="text-xs text-muted">
                      {item.colorName} / {item.size}
                    </p>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center border border-navy/20">
                        <button
                          onClick={() => updateQty(item.sku, item.qty - 1)}
                          className="p-1.5 hover:bg-surface cursor-pointer"
                          aria-label="decrease"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-sm font-bold">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => updateQty(item.sku, item.qty + 1)}
                          className="p-1.5 hover:bg-surface cursor-pointer"
                          aria-label="increase"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="text-sm font-extrabold text-brand">
                        {formatEGP(item.unitPrice * item.qty, locale)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.sku)}
                    className="self-start text-muted hover:text-brand cursor-pointer"
                    aria-label={t("remove")}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <SuggestedProducts />
            </div>

            <div className="border-t border-navy/10 p-5">
              {activePromo && (
                <div className="mb-3 border-2 border-brand/30 bg-brand/5 px-3 py-2">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-brand">
                    🎁{" "}
                    {ar
                      ? `اشترِ ${activePromo.buyQuantity} والأرخص ${activePromo.freeQuantity} ببلاش`
                      : `Buy ${activePromo.buyQuantity}, get ${activePromo.freeQuantity} free`}
                  </p>
                  {showBogoDiscount ? (
                    <p className="mt-0.5 text-[11px] font-bold text-navy">
                      {ar
                        ? `🎉 ${bogo!.freeUnits} منتج مجانًا في طلبك`
                        : `🎉 ${bogo!.freeUnits} item(s) free in your order`}
                    </p>
                  ) : !minMet ? (
                    <p className="mt-0.5 text-[11px] text-muted">
                      {ar
                        ? `أضف بـ ${formatEGP(activePromo.minOrderTotal - subtotal, locale)} كمان لتفعيل العرض`
                        : `Spend ${formatEGP(activePromo.minOrderTotal - subtotal, locale)} more to unlock the promo`}
                    </p>
                  ) : bogo && bogo.itemsToNextFree > 0 ? (
                    <p className="mt-0.5 text-[11px] text-muted">
                      {ar
                        ? `ضيف ${bogo.itemsToNextFree} منتج كمان والأرخص يبقى ببلاش!`
                        : `Add ${bogo.itemsToNextFree} more item(s) to get the cheapest free!`}
                    </p>
                  ) : null}
                </div>
              )}
              <div className="mb-1 flex items-center justify-between">
                <span className="font-bold uppercase text-sm text-navy">
                  {t("subtotal")}
                </span>
                <span className="font-extrabold text-lg text-navy">
                  {formatEGP(subtotal, locale)}
                </span>
              </div>
              {showBogoDiscount && (
                <>
                  <div className="mb-1 flex items-center justify-between text-brand">
                    <span className="text-sm font-bold">
                      {ar ? "خصم العرض" : "Promo discount"}
                    </span>
                    <span className="text-sm font-extrabold">
                      -{formatEGP(bogo!.discount, locale)}
                    </span>
                  </div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-bold uppercase text-sm text-navy">
                      {ar ? "الإجمالي بعد الخصم" : "Total after discount"}
                    </span>
                    <span className="font-extrabold text-lg text-navy">
                      {formatEGP(promoTotal, locale)}
                    </span>
                  </div>
                </>
              )}
              <p className="mb-4 text-xs text-muted">{t("shippingNote")}</p>
              <button
                onClick={() => setOpen(false)}
                className={btn("outline", "lg", "mb-3 w-full")}
              >
                <span>{t("continueShopping")}</span>
              </button>
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className={btn("primary", "lg", "w-full")}
              >
                <span>{t("checkout")}</span>
              </Link>
            </div>
          </>
        )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
