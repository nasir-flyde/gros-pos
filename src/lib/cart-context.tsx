import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Product, Customer } from "./pos-data";

export type CartItem = { product: Product; qty: number };

type CheckoutInfo = {
  payment: "Cash" | "UPI" | "Card" | "Wallet" | "Split";
  delivery: "Home" | "Pickup" | "Walk-Out";
  orderId: string;
  total: number;
  customer: Customer | null;
};

type CartCtx = {
  items: CartItem[];
  customer: Customer | null;
  add: (p: Product) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  setCustomer: (c: Customer | null) => void;
  subtotal: number;
  discount: number;
  delivery: number;
  tax: number;
  total: number;
  count: number;
  lastCheckout: CheckoutInfo | null;
  setLastCheckout: (c: CheckoutInfo | null) => void;
};

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lastCheckout, setLastCheckout] = useState<CheckoutInfo | null>(null);

  const add = (p: Product) =>
    setItems((prev) => {
      const ex = prev.find((i) => i.product.id === p.id);
      if (ex) return prev.map((i) => (i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { product: p, qty: 1 }];
    });
  const inc = (id: string) =>
    setItems((prev) => prev.map((i) => (i.product.id === id ? { ...i, qty: i.qty + 1 } : i)));
  const dec = (id: string) =>
    setItems((prev) =>
      prev
        .map((i) => (i.product.id === id ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0),
    );
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.product.id !== id));
  const clear = () => {
    setItems([]);
    setCustomer(null);
  };

  const { subtotal, discount, delivery, tax, total, count } = useMemo(() => {
    const sub = items.reduce((s, i) => s + i.product.mrp * i.qty, 0);
    const disc = items.reduce((s, i) => s + (i.product.mrp - i.product.price) * i.qty, 0);
    const afterDisc = sub - disc;
    const dlv = afterDisc > 500 || items.length === 0 ? 0 : 30;
    const tx = Math.round(afterDisc * 0.05);
    return {
      subtotal: sub,
      discount: disc,
      delivery: dlv,
      tax: tx,
      total: afterDisc + dlv + tx,
      count: items.reduce((s, i) => s + i.qty, 0),
    };
  }, [items]);

  return (
    <Ctx.Provider
      value={{
        items, customer, add, inc, dec, remove, clear, setCustomer,
        subtotal, discount, delivery, tax, total, count,
        lastCheckout, setLastCheckout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}
