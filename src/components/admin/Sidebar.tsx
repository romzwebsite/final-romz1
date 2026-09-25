"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  LayoutGrid,
  LogOut,
  Mail,
  Package,
  Shapes,
  ShoppingCart,
  Star,
  Tag,
  Users,
  Settings,
} from "lucide-react";
import clsx from "clsx";
import { clearAdminToken, readAdminRefreshToken } from "@/lib/adminApi";

const items = [
  { label: "Dashboard", href: "/admin", icon: LayoutGrid },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Categories", href: "/admin/categories", icon: Shapes },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Reviews", href: "/admin/reviews", icon: Star },
  { label: "Coupons", href: "/admin/coupons", icon: Tag },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Contact", href: "/admin/contact", icon: Mail },
  { label: "Hero Banner", href: "/admin/hero", icon: ImageIcon },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    if (API_URL) {
      try {
        const refreshToken = readAdminRefreshToken();
        let response = await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
        if (response.status === 401 && refreshToken) {
          response = await fetch(`${API_URL}/auth/logout`, {
            method: "POST",
            credentials: "omit",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
        }
      } catch {
        // Local logout still wins if the network call fails.
      }
    }
    clearAdminToken();
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col bg-navy max-md:w-16">
      <div className="px-5 py-6 max-md:px-3">
        <Link href="/admin" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/romz-mark-white.png"
            alt=""
            aria-hidden
            className="h-7 w-auto select-none max-md:h-6"
          />
          <span className="font-display uppercase text-3xl leading-none text-white max-md:hidden">
            ROMZ
          </span>
        </Link>
        <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.25em] text-white/50 max-md:hidden">
          Athletic Admin
        </p>
      </div>

      <nav className="mt-4 flex-1">
        {items.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "relative flex items-center gap-3 px-5 py-3 text-sm font-bold uppercase tracking-wide transition-colors max-md:justify-center max-md:px-0",
                active
                  ? "bg-brand text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              {active && (
                <span className="absolute inset-y-0 start-0 w-1 bg-white" />
              )}
              <Icon size={18} className="shrink-0" />
              <span className="max-md:hidden">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 max-md:px-2">
        <div className="flex items-center gap-3 max-md:justify-center">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand font-display text-white">
            A
          </div>
          <div className="max-md:hidden">
            <p className="text-xs font-extrabold uppercase text-white">
              Admin User
            </p>
            <p className="text-[10px] text-white/50">admin@romz.local</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-3 flex w-full items-center gap-2 px-1 py-1.5 text-xs font-bold uppercase tracking-wide text-white/60 transition-colors hover:text-white cursor-pointer max-md:justify-center"
        >
          <LogOut size={14} />
          <span className="max-md:hidden">Log out</span>
        </button>
      </div>
    </aside>
  );
}
