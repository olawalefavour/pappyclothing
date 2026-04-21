import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface CartItem {
  product_id: string;
  product_name: string;
  color: string;
  size: string;
  qty: number;
  unit_price_kobo: number;
  image: string;
}

interface CartContextValue {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (idx: number) => void;
  updateQty: (idx: number, qty: number) => void;
  clear: () => void;
  subtotalKobo: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pappy_cart");
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore corrupt cart data
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pappy_cart", JSON.stringify(items));
  }, [items]);

  const add = (item: CartItem) =>
    setItems((prev) => {
      const existing = prev.findIndex(
        (i) => i.product_id === item.product_id && i.color === item.color && i.size === item.size,
      );
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = { ...copy[existing], qty: copy[existing].qty + item.qty };
        return copy;
      }
      return [...prev, item];
    });

  const remove = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));
  const updateQty = (idx: number, qty: number) =>
    setItems((p) => p.map((it, i) => (i === idx ? { ...it, qty: Math.max(1, qty) } : it)));
  const clear = () => setItems([]);

  const subtotalKobo = items.reduce((acc, it) => acc + it.unit_price_kobo * it.qty, 0);
  const count = items.reduce((a, i) => a + i.qty, 0);

  return (
    <CartContext.Provider value={{ items, add, remove, updateQty, clear, subtotalKobo, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};

export const formatNaira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
