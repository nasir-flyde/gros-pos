import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface CartProduct {
  _id: string;
  name: string;
  weight: string;
  mrp: number;
  price: number;
  imageUrl?: string;
  taxRate: number;
}

export interface PosCartCustomer {
  _id: string;
  name: string;
  mobile: string;
  area?: string;
}

export type CartItem = { product: CartProduct; qty: number };

type CheckoutInfo = {
  payment: "Cash" | "UPI" | "Card" | "Wallet" | "Split";
  delivery: "Home" | "Pickup" | "Walk-Out";
  orderId: string;
  total: number;
  receiptData?: Record<string, unknown>;
  customer: PosCartCustomer | null;
};

type CartCtx = {
  items: CartItem[];
  customer: PosCartCustomer | null;
  add: (p: CartProduct) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  setCustomer: (c: PosCartCustomer | null) => void;
  subtotal: number;
  discount: number;
  afterDisc: number;
  tax: number;
  count: number;
  lastCheckout: CheckoutInfo | null;
  setLastCheckout: (c: CheckoutInfo | null) => void;
};

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<PosCartCustomer | null>(null);
  const [lastCheckout, setLastCheckout] = useState<CheckoutInfo | null>(null);

  const add = (p: CartProduct) =>
    setItems((prev) => {
      const ex = prev.find((i) => i.product._id === p._id);
      if (ex) return prev.map((i) => (i.product._id === p._id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { product: p, qty: 1 }];
    });
  const inc = (id: string) =>
    setItems((prev) => prev.map((i) => (i.product._id === id ? { ...i, qty: i.qty + 1 } : i)));
  const dec = (id: string) =>
    setItems((prev) =>
      prev
        .map((i) => (i.product._id === id ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0),
    );
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.product._id !== id));
  const clear = () => {
    setItems([]);
    setCustomer(null);
  };

  const { subtotal, discount, afterDisc, tax, count } = useMemo(() => {
    const sub = items.reduce((s, i) => s + i.product.mrp * i.qty, 0);
    const disc = items.reduce((s, i) => s + (i.product.mrp - i.product.price) * i.qty, 0);
    const after = sub - disc;
    const tx = items.reduce(
      (s, i) => s + Math.round((i.product.price * i.qty * (i.product.taxRate ?? 0)) / 100),
      0,
    );
    return {
      subtotal: sub,
      discount: disc,
      afterDisc: after,
      tax: tx,
      count: items.reduce((s, i) => s + i.qty, 0),
    };
  }, [items]);

  return (
    <Ctx.Provider
      value={{
        items,
        customer,
        add,
        inc,
        dec,
        remove,
        clear,
        setCustomer,
        subtotal,
        discount,
        afterDisc,
        tax,
        count,
        lastCheckout,
        setLastCheckout,
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
