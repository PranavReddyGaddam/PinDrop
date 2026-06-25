"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface CartItem {
  campaignId: string;
  title: string;
  imageUrl: string | null;
  unitPrice: number; // price at the time it was added
  quantity: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (campaignId: string) => void;
  setQuantity: (campaignId: string, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
}

const CartCtx = createContext<CartState | null>(null);
const STORAGE_KEY = "pindrop_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Hydrate from localStorage once on mount. This must run in an effect (localStorage is
  // unavailable during SSR), so the one-time setState here is intentional.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore malformed cart */
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full / unavailable */
    }
  }, [items]);

  const add = useCallback(
    (item: Omit<CartItem, "quantity">, qty = 1) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.campaignId === item.campaignId);
        if (existing) {
          return prev.map((i) =>
            i.campaignId === item.campaignId
              ? { ...i, quantity: i.quantity + qty, unitPrice: item.unitPrice }
              : i,
          );
        }
        return [...prev, { ...item, quantity: qty }];
      });
      setIsOpen(true);
    },
    [],
  );

  const remove = useCallback((campaignId: string) => {
    setItems((prev) => prev.filter((i) => i.campaignId !== campaignId));
  }, []);

  const setQuantity = useCallback((campaignId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.campaignId !== campaignId)
        : prev.map((i) =>
            i.campaignId === campaignId ? { ...i, quantity: qty } : i,
          ),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const count = useMemo(
    () => items.reduce((n, i) => n + i.quantity, 0),
    [items],
  );
  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    [items],
  );

  const value: CartState = {
    items,
    isOpen,
    count,
    subtotal,
    add,
    remove,
    setQuantity,
    clear,
    open,
    close,
  };

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}
