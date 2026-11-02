import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { OrderItem, PosOrder } from "./order-api";
import type { MarkdownLabelResolution } from "./markdown-api";
import { roundCurrency } from "./order-payload";
import { normalizeKg } from "./weight";

export interface CartProduct {
  _id: string;
  name: string;
  weight: string;
  mrp: number;
  price: number;
  imageUrl?: string;
  taxRate: number;
  quantityAvailable?: number;
  lineKey?: string;
  markdownCode?: string;
  batchId?: string;
  batchNumber?: string;
  expiryDate?: string;
  basePrice?: number;
  remainingMarkdownQuantity?: number;
  markdownOption?: MarkdownLabelResolution;
  sellingMode?: "FIXED" | "WEIGHT";
  unitType?: string;
  unitValue?: number;
}

export interface PosCartCustomer {
  _id: string;
  name: string;
  mobile: string;
  area?: string;
}

export type CartItem = { product: CartProduct; qty: number; enteredQuantity?: string };

export type QuantityUpdateResult = { success: true } | { success: false; error: string };

type CheckoutInfo = {
  payment: "Cash" | "UPI" | "Card" | "Wallet" | "Split" | "Paytm POS";
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
  add: (p: CartProduct, quantity?: number, enteredQuantity?: string) => boolean;
  setQuantity: (id: string, quantity: number, enteredQuantity?: string) => QuantityUpdateResult;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  setCustomer: (c: PosCartCustomer | null) => void;
  setActiveOrderId: (orderId: string | null) => void;
  updateStockLevels: (stockByVariantId: Record<string, number>) => void;
  updateMarkdownAvailability: (markdownCode: string, remainingQuantity: number) => void;
  applyMarkdown: (id: string) => QuantityUpdateResult;
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

function readPersistedCartState(storageKey: string): PersistedCartState {
  if (typeof window === "undefined") return defaultCartState;

  try {
    const raw = window.sessionStorage.getItem(storageKey);
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

function persistCartState(state: PersistedCartState, storageKey: string) {
  if (typeof window === "undefined") return;

  if (state.items.length === 0 && !state.customer && !state.activeOrderId) {
    window.sessionStorage.removeItem(storageKey);
    return;
  }

  window.sessionStorage.setItem(storageKey, JSON.stringify(state));
}

export function CartProvider({
  children,
  scopeKey = "",
}: {
  children: ReactNode;
  scopeKey?: string;
}) {
  return (
    <ScopedCartProvider
      key={scopeKey}
      storageKey={scopeKey ? `${CART_STORAGE_KEY}:${scopeKey}` : CART_STORAGE_KEY}
    >
      {children}
    </ScopedCartProvider>
  );
}

function ScopedCartProvider({ children, storageKey }: { children: ReactNode; storageKey: string }) {
  const [initialState] = useState<PersistedCartState>(() => readPersistedCartState(storageKey));
  const [items, setItems] = useState<CartItem[]>(initialState.items);
  const [customer, setCustomerState] = useState<PosCartCustomer | null>(initialState.customer);
  const [activeOrderId, setActiveOrderIdState] = useState<string | null>(
    initialState.activeOrderId,
  );
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
    persistCartState(
      {
        items: nextItems,
        customer: nextCustomer,
        activeOrderId: nextActiveOrderId,
      },
      storageKey,
    );
  };

  const add = (p: CartProduct, quantity = 1, enteredQuantity?: string) => {
    const lineKey = p.lineKey || p._id;
    const normalized = { ...p, lineKey };
    const normalizedQuantity = p.sellingMode === "WEIGHT" ? normalizeKg(quantity) : quantity;
    if (!Number.isFinite(quantity) || normalizedQuantity <= 0) return false;
    if (
      p.sellingMode === "WEIGHT" &&
      (quantity < 0.001 || Math.abs(quantity - normalizedQuantity) > 0.0000001)
    ) {
      return false;
    }
    if (p.sellingMode !== "WEIGHT" && !Number.isInteger(normalizedQuantity)) return false;
    const existing = itemsRef.current.find(
      (item) => (item.product.lineKey || item.product._id) === lineKey,
    );
    const limit = p.quantityAvailable;
    if (
      (limit !== undefined && limit <= 0) ||
      (limit !== undefined && (existing?.qty ?? 0) + normalizedQuantity > limit + 0.000001)
    ) {
      return false;
    }

    const nextItems = existing
      ? itemsRef.current.map((item) =>
          (item.product.lineKey || item.product._id) === lineKey
            ? {
                ...item,
                product: { ...item.product, ...normalized },
                qty:
                  p.sellingMode === "WEIGHT"
                    ? normalizeKg(item.qty + normalizedQuantity)
                    : item.qty + normalizedQuantity,
                enteredQuantity,
              }
            : item,
        )
      : [...itemsRef.current, { product: normalized, qty: normalizedQuantity, enteredQuantity }];
    commitCartState({ nextItems });
    return true;
  };
  const setQuantity = (
    id: string,
    quantity: number,
    enteredQuantity?: string,
  ): QuantityUpdateResult => {
    const item = itemsRef.current.find(
      (entry) => (entry.product.lineKey || entry.product._id) === id,
    );
    if (!item) return { success: false, error: "Cart item was not found." };
    const normalizedQuantity =
      item.product.sellingMode === "WEIGHT" ? normalizeKg(quantity) : quantity;
    if (!Number.isFinite(quantity) || normalizedQuantity <= 0)
      return { success: false, error: "Quantity must be greater than zero." };
    if (
      item.product.sellingMode === "WEIGHT" &&
      (quantity < 0.001 || Math.abs(quantity - normalizedQuantity) > 0.0000001)
    ) {
      return { success: false, error: "Weight must be at least 1g with at most 3 decimal places." };
    }
    if (item.product.sellingMode !== "WEIGHT" && !Number.isInteger(normalizedQuantity)) {
      return { success: false, error: "Fixed products require a whole-number quantity." };
    }
    if (
      item.product.quantityAvailable !== undefined &&
      normalizedQuantity > item.product.quantityAvailable + 0.000001
    ) {
      return { success: false, error: `Only ${item.product.quantityAvailable} is available.` };
    }
    commitCartState({
      nextItems: itemsRef.current.map((entry) =>
        (entry.product.lineKey || entry.product._id) === id
          ? { ...entry, qty: normalizedQuantity, enteredQuantity }
          : entry,
      ),
    });
    return { success: true };
  };
  const inc = (id: string) => {
    const item = itemsRef.current.find(
      (entry) => (entry.product.lineKey || entry.product._id) === id,
    );
    if (!item) return;
    const limit = item.product.quantityAvailable;
    const step = item.product.sellingMode === "WEIGHT" ? 0.1 : 1;
    if (limit !== undefined && item.qty + step > limit + 0.000001) return;
    commitCartState({
      nextItems: itemsRef.current.map((entry) =>
        (entry.product.lineKey || entry.product._id) === id
          ? {
              ...entry,
              qty:
                entry.product.sellingMode === "WEIGHT"
                  ? normalizeKg(entry.qty + step)
                  : entry.qty + step,
            }
          : entry,
      ),
    });
  };
  const dec = (id: string) =>
    commitCartState({
      nextItems: itemsRef.current
        .map((i) => {
          if ((i.product.lineKey || i.product._id) !== id) return i;
          const step = i.product.sellingMode === "WEIGHT" ? 0.1 : 1;
          return {
            ...i,
            qty: i.product.sellingMode === "WEIGHT" ? normalizeKg(i.qty - step) : i.qty - step,
          };
        })
        .filter((i) => i.qty > 0),
    });
  const remove = (id: string) =>
    commitCartState({
      nextItems: itemsRef.current.filter((i) => (i.product.lineKey || i.product._id) !== id),
    });
  const clear = () =>
    commitCartState({ nextItems: [], nextCustomer: null, nextActiveOrderId: null });
  const setCustomer = (nextCustomer: PosCartCustomer | null) => commitCartState({ nextCustomer });
  const setActiveOrderId = (nextActiveOrderId: string | null) =>
    commitCartState({ nextActiveOrderId });
  const updateStockLevels = (stockByVariantId: Record<string, number>) => {
    commitCartState({
      nextItems: itemsRef.current.map((item) =>
        !item.product.markdownCode &&
        Object.prototype.hasOwnProperty.call(stockByVariantId, item.product._id)
          ? {
              ...item,
              product: {
                ...item.product,
                quantityAvailable: stockByVariantId[item.product._id],
              },
            }
          : item,
      ),
    });
  };
  const applyMarkdown = (id: string): QuantityUpdateResult => {
    if (activeOrderIdRef.current) {
      return {
        success: false,
        error: "Markdown stock cannot be added to a resumed held order.",
      };
    }
    const item = itemsRef.current.find(
      (entry) => (entry.product.lineKey || entry.product._id) === id,
    );
    const markdown = item?.product.markdownOption;
    if (!item || !markdown) {
      return { success: false, error: "No active markdown price is available." };
    }
    if (item.qty > markdown.remainingQuantity) {
      return {
        success: false,
        error: `Only ${markdown.remainingQuantity} markdown units remain. Reduce the cart quantity first.`,
      };
    }
    const existingMarkdownLine = itemsRef.current.find(
      (entry) => entry.product.markdownCode === markdown.markdownCode,
    );
    if (existingMarkdownLine && existingMarkdownLine !== item) {
      return { success: false, error: "This markdown batch is already in the cart." };
    }

    commitCartState({
      nextItems: itemsRef.current.map((entry) =>
        entry === item
          ? {
              ...entry,
              product: {
                ...entry.product,
                lineKey: markdown.markdownCode,
                mrp: markdown.basePrice,
                basePrice: markdown.basePrice,
                price: markdown.effectivePrice,
                quantityAvailable: markdown.remainingQuantity,
                remainingMarkdownQuantity: markdown.remainingQuantity,
                markdownCode: markdown.markdownCode,
                batchId: markdown.batchId,
                batchNumber: markdown.batchNumber,
                expiryDate: markdown.expiryDate,
                markdownOption: undefined,
              },
            }
          : entry,
      ),
    });
    return { success: true };
  };

  const updateMarkdownAvailability = (markdownCode: string, remainingQuantity: number) => {
    commitCartState({
      nextItems: itemsRef.current.map((item) =>
        item.product.markdownCode === markdownCode
          ? {
              ...item,
              product: {
                ...item.product,
                quantityAvailable: remainingQuantity,
                remainingMarkdownQuantity: remainingQuantity,
              },
            }
          : item,
      ),
    });
  };

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
        weight:
          typeof item.productVariantId === "object" ? item.productVariantId?.unitType || "" : "",
        mrp: item.unitPrice,
        price: item.unitPrice,
        taxRate: item.taxRate || 0,
        sellingMode: item.sellingMode || "FIXED",
        unitType: item.quantityUnit || "PCS",
      },
      qty: item.quantity,
      enteredQuantity: item.enteredQuantity,
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
    const tx = items.reduce((s, i) => {
      const rate = i.product.taxRate ?? 0;
      // GST INCLUSIVE: extract tax from price, not add on top
      return s + roundCurrency((i.product.price * i.qty * rate) / (100 + rate));
    }, 0);
    return {
      subtotal: sub,
      discount: disc,
      afterDisc: after,
      tax: tx,
      count: items.length,
    };
  }, [items]);

  return (
    <Ctx.Provider
      value={{
        items,
        customer,
        activeOrderId,
        add,
        setQuantity,
        inc,
        dec,
        remove,
        clear,
        setCustomer,
        setActiveOrderId,
        updateStockLevels,
        updateMarkdownAvailability,
        applyMarkdown,
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
