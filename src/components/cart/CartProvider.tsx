"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem } from "@/lib/types";
import type { ActivePromo } from "@/lib/api";

const STORAGE_KEY = "romz-cart";

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  addItem: (item: CartItem) => void;
  updateQty: (sku: string, qty: number) => void;
  removeItem: (sku: string) => void;
  clear: () => void;
  /** The active Buy X Get Y promo, or null. Supplied by the server layout. */
  activePromo: ActivePromo | null;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

export function CartProvider({
  children,
  activePromo = null,
}: {
  children: ReactNode;
  activePromo?: ActivePromo | null;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // Post-mount localStorage read: intentionally syncs state in an effect to
      // avoid a server/client hydration mismatch on the persisted cart.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setItems(JSON.parse(saved));
    } catch {
      // corrupted storage — start fresh
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.sku === item.sku);
      if (existing) {
        return prev.map((i) =>
          i.sku === item.sku
            ? { ...i, qty: Math.min(i.qty + item.qty, i.maxStock) }
            : i
        );
      }
      return [...prev, item];
    });
    setOpen(true);
  };

  const updateQty = (sku: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.sku === sku ? { ...i, qty: Math.min(Math.max(qty, 0), i.maxStock) } : i
        )
        .filter((i) => i.qty > 0)
    );
  };

  const removeItem = (sku: string) =>
    setItems((prev) => prev.filter((i) => i.sku !== sku));

  const clear = () => setItems([]);

  const { count, subtotal } = useMemo(
    () => ({
      count: items.reduce((sum, i) => sum + i.qty, 0),
      subtotal: items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0),
    }),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        count,
        subtotal,
        isOpen,
        setOpen,
        addItem,
        updateQty,
        removeItem,
        clear,
        activePromo,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
