"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Menu, Minus, Plus, Search, ShoppingCart, User, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { lt } from "@/lib/format";
import type { Category, Locale } from "@/lib/types";
import LanguageSwitcher from "./LanguageSwitcher";
import Logo from "./Logo";

export default function Header({ categories = [] }: { categories?: Category[] }) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const isRtl = locale === "ar";
  const reducedMotion = useReducedMotion();
  const { count, setOpen } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Mobile drawer: which category's subcategories are expanded (one at a time).
  const [expandedCat, setExpandedCat] = useState<Category["id"] | null>(null);
  // Drawer slides in from the start edge: left in English, right in Arabic.
  const drawerOffscreenX = isRtl ? "100%" : "-100%";

  return (
    <>
      <header className="sticky top-0 z-40 border-b-2 border-navy bg-page/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-6 py-3">
        <button
          className="lg:hidden text-navy cursor-pointer"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <Link href="/" className="shrink-0">
          <Logo className="text-4xl text-brand md:text-5xl" />
        </Link>

        <nav className="hidden lg:flex items-center gap-9">
          <Link
            href="/"
            className="text-sm font-extrabold uppercase text-navy hover:text-brand transition-colors"
          >
            {t("newDrop")}
          </Link>

          {categories.map((cat) => (
            <div key={cat.id} className="group relative">
              <Link
                href={`/category/${cat.slug}`}
                className="flex items-center gap-1 text-sm font-extrabold uppercase text-navy hover:text-brand transition-colors"
              >
                {lt(cat.name, locale)}
                {cat.children && cat.children.length > 0 && (
                  <ChevronDown size={14} className="mt-0.5" />
                )}
              </Link>
              {cat.children && cat.children.length > 0 && (
                <div className="invisible absolute start-0 top-full z-50 min-w-44 border-2 border-brand bg-white opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                  {cat.children.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/category/${sub.slug}`}
                      className="block px-4 py-2.5 text-sm font-extrabold uppercase text-navy hover:bg-brand hover:text-white transition-colors"
                    >
                      {lt(sub.name, locale)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          <Link
            href="/track-order"
            className="text-sm font-extrabold uppercase text-navy hover:text-brand transition-colors"
          >
            {t("trackOrder")}
          </Link>

          <Link
            href="/contact"
            className="text-sm font-extrabold uppercase text-navy hover:text-brand transition-colors"
          >
            {t("contact")}
          </Link>
        </nav>

        <div className="flex items-center gap-3 md:gap-4">
          <LanguageSwitcher />
          <button className="hidden md:block text-brand hover:text-navy cursor-pointer" aria-label="search">
            <Search size={20} />
          </button>
          <Link
            href="/account"
            className="hidden md:block text-brand hover:text-navy"
            aria-label="account"
          >
            <User size={20} />
          </Link>
          <button
            onClick={() => setOpen(true)}
            className="relative text-brand hover:text-navy cursor-pointer"
            aria-label="cart"
          >
            <ShoppingCart size={20} />
            {count > 0 && (
              <span
                key={count}
                className="animate-badge-pop absolute -top-2 -end-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-extrabold text-white"
              >
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-navy/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            {/* Side drawer: slides in from the start edge (left LTR / right RTL) */}
            <motion.nav
              initial={reducedMotion ? { opacity: 0 } : { x: drawerOffscreenX }}
              animate={reducedMotion ? { opacity: 1 } : { x: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { x: drawerOffscreenX }}
              transition={
                reducedMotion
                  ? { duration: 0.15 }
                  : { type: "spring", stiffness: 320, damping: 32 }
              }
              className="absolute inset-y-0 start-0 flex w-4/5 max-w-xs flex-col overflow-y-auto border-e-2 border-navy bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b-2 border-navy/10 px-4 py-3">
                <Logo className="text-2xl text-brand" />
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="close menu"
                  className="text-navy hover:text-brand cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="px-4 py-3">
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className="block py-2.5 font-display uppercase text-navy hover:text-brand"
                >
                  {t("newDrop")}
                </Link>

                {categories.map((cat) => {
                  const hasChildren = !!cat.children && cat.children.length > 0;
                  const isExpanded = expandedCat === cat.id;
                  return (
                    <div key={cat.id}>
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/category/${cat.slug}`}
                          onClick={() => setMobileOpen(false)}
                          className="block flex-1 py-2.5 font-display uppercase text-navy hover:text-brand"
                        >
                          {lt(cat.name, locale)}
                        </Link>
                        {hasChildren && (
                          <button
                            type="button"
                            onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                            aria-expanded={isExpanded}
                            aria-controls={`mobile-subcats-${cat.id}`}
                            aria-label={isExpanded ? "collapse" : "expand"}
                            className="flex h-9 w-9 items-center justify-center text-navy hover:text-brand cursor-pointer"
                          >
                            {isExpanded ? <Minus size={18} /> : <Plus size={18} />}
                          </button>
                        )}
                      </div>
                      <AnimatePresence initial={false}>
                        {hasChildren && isExpanded && (
                          <motion.div
                            id={`mobile-subcats-${cat.id}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: reducedMotion ? 0 : 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mb-1 ms-4 border-s-2 border-navy/10 ps-3">
                              {cat.children!.map((sub) => (
                                <Link
                                  key={sub.id}
                                  href={`/category/${sub.slug}`}
                                  onClick={() => setMobileOpen(false)}
                                  className="block py-1.5 text-sm font-bold uppercase text-muted hover:text-brand"
                                >
                                  {lt(sub.name, locale)}
                                </Link>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                <Link
                  href="/track-order"
                  onClick={() => setMobileOpen(false)}
                  className="block py-2.5 font-display uppercase text-navy hover:text-brand"
                >
                  {t("trackOrder")}
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setMobileOpen(false)}
                  className="block py-2.5 font-display uppercase text-navy hover:text-brand"
                >
                  {t("contact")}
                </Link>
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 border-t border-navy/10 py-2.5 font-display uppercase text-navy hover:text-brand"
                >
                  <User size={16} />
                  {t("account")}
                </Link>
              </div>
            </motion.nav>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
