import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { OrderItem, PosOrder } from "./order-api";

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
  orderObjectId: string;
  total: number;
  receiptData?: Record<string, unknown>;
  receiptStatus?: "generated" | "unavailable" | "pending_fulfillment";
  receiptWarning?: string;
  customer: PosCartCustomer | null;
};

type CartCtx = {
  items: CartItem[];
  customer: PosCartCustomer | null;
  activeOrderId: string | null;
  add: (p: CartProduct) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  setCustomer: (c: PosCartCustomer | null) => void;
  setActiveOrderId: (orderId: string | null) => void;
  loadHeldOrder: (order: PosOrder) => void;
  subtotal: number;
  discount: number;
  afterDisc: number;
  tax: number;
  count: number;
  lastCheckout: CheckoutInfo | null;
  setLastCheckout: (c: CheckoutInfo | null) => void;
};

const Ctx = createContext<CartCtx | null>(null);

const CART_STORAGE_KEY = "pos_active_cart";

type PersistedCartState = {
  items: CartItem[];
  customer: PosCartCustomer | null;
  activeOrderId: string | null;
};

const defaultCartState: PersistedCartState = {
  items: [],
  customer: null,
  activeOrderId: null,
};

function readPersistedCartState(): PersistedCartState {
  if (typeof window === "undefined") return defaultCartState;

  try {
    const raw = window.sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return defaultCartState;

    const parsed = JSON.parse(raw) as Partial<PersistedCartState> | null;
    return {
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      customer: parsed?.customer ?? null,
      activeOrderId: typeof parsed?.activeOrderId === "string" ? parsed.activeOrderId : null,
    };
  } catch {
    return defaultCartState;
  }
}

function persistCartState(state: PersistedCartState) {
  if (typeof window === "undefined") return;

  if (state.items.length === 0 && !state.customer && !state.activeOrderId) {
    window.sessionStorage.removeItem(CART_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [initialState] = useState<PersistedCartState>(readPersistedCartState);
  const [items, setItems] = useState<CartItem[]>(initialState.items);
  const [customer, setCustomerState] = useState<PosCartCustomer | null>(initialState.customer);
  const [activeOrderId, setActiveOrderIdState] = useState<string | null>(initialState.activeOrderId);
  const [lastCheckout, setLastCheckout] = useState<CheckoutInfo | null>(null);
  const itemsRef = useRef(items);
  const customerRef = useRef(customer);
  const activeOrderIdRef = useRef(activeOrderId);

  const commitCartState = ({
    nextItems = itemsRef.current,
    nextCustomer = customerRef.current,
    nextActiveOrderId = activeOrderIdRef.current,
  }: {
    nextItems?: CartItem[];
    nextCustomer?: PosCartCustomer | null;
    nextActiveOrderId?: string | null;
  }) => {
    itemsRef.current = nextItems;
    customerRef.current = nextCustomer;
    activeOrderIdRef.current = nextActiveOrderId;

    setItems(nextItems);
    setCustomerState(nextCustomer);
    setActiveOrderIdState(nextActiveOrderId);
    persistCartState({
      items: nextItems,
      customer: nextCustomer,
      activeOrderId: nextActiveOrderId,
    });
  };

  const add = (p: CartProduct) =>
    commitCartState({
      nextItems: (() => {
        const ex = itemsRef.current.find((i) => i.product._id === p._id);
        if (ex) {
          return itemsRef.current.map((i) =>
            i.product._id === p._id ? { ...i, qty: i.qty + 1 } : i,
          );
        }
        return [...itemsRef.current, { product: p, qty: 1 }];
      })(),
    });
  const inc = (id: string) =>
    commitCartState({
      nextItems: itemsRef.current.map((i) => (i.product._id === id ? { ...i, qty: i.qty + 1 } : i)),
    });
  const dec = (id: string) =>
    commitCartState({
      nextItems: itemsRef.current
        .map((i) => (i.product._id === id ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0),
    });
  const remove = (id: string) =>
    commitCartState({
      nextItems: itemsRef.current.filter((i) => i.product._id !== id),
    });
  const clear = () => commitCartState({ nextItems: [], nextCustomer: null, nextActiveOrderId: null });
  const setCustomer = (nextCustomer: PosCartCustomer | null) =>
    commitCartState({ nextCustomer });
  const setActiveOrderId = (nextActiveOrderId: string | null) =>
    commitCartState({ nextActiveOrderId });

  const loadHeldOrder = (order: PosOrder) => {
    const nextItems = (order.items ?? []).map((item: OrderItem) => ({
      product: {
        _id:
          typeof item.productVariantId === "string"
            ? item.productVariantId
            : item.productVariantId?._id || item.sku || item.variantName || item._id,
        name:
          item.variantName ||
          (typeof item.productVariantId === "object" ? item.productVariantId?.variantName : "") ||
          "Variant",
        weight: typeof item.productVariantId === "object" ? item.productVariantId?.unitType || "" : "",
        mrp: item.unitPrice,
        price: item.unitPrice,
        taxRate: item.taxRate || 0,
      },
      qty: item.quantity,
    }));

    commitCartState({
      nextItems,
      nextActiveOrderId: order._id,
      nextCustomer: order.customerId
        ? {
            _id: order.customerId._id,
            name: order.customerId.name,
            mobile: order.customerId.mobile,
          }
        : null,
    });
  };

  const { subtotal, discount, afterDisc, tax, count } = useMemo(() => {
    const sub = items.reduce((s, i) => s + i.product.mrp * i.qty, 0);
    const disc = items.reduce((s, i) => s + (i.product.mrp - i.product.price) * i.qty, 0);
    const after = sub - disc;
    const tx = items.reduce(
      (s, i) => {
        const rate = i.product.taxRate ?? 0;
        // GST INCLUSIVE: extract tax from price, not add on top
        return s + Math.round((i.product.price * i.qty * rate) / (100 + rate));
      },
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
        activeOrderId,
        add,
        inc,
        dec,
        remove,
        clear,
        setCustomer,
        setActiveOrderId,
        loadHeldOrder,
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
