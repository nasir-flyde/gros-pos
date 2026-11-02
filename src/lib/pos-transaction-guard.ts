import { useSyncExternalStore } from "react";

export type PendingPosTransaction = {
  id: string;
  path: string;
  paymentId?: string;
  phase: "sending" | "uncertain" | "payment";
};
const listeners = new Set<() => void>();
let owner: string | null = null;
let pending: PendingPosTransaction | null = null;
const key = () => `pos_pending_transaction:${owner}`;
const publish = (value: PendingPosTransaction | null) => {
  if (!owner || typeof window === "undefined") throw new Error("POS session is unavailable");
  if (value) window.sessionStorage.setItem(key(), JSON.stringify(value));
  else window.sessionStorage.removeItem(key());
  pending = value;
  for (const listener of listeners) listener();
};
export function setPosSessionOwner(value: string | null) {
  owner = value;
  pending = null;
  if (typeof window !== "undefined" && value) {
    const previous = window.sessionStorage.getItem("pos_session_owner");
    if (previous !== value) {
      // Cart/receipt data from another account must not enter the new session.
      window.sessionStorage.removeItem("pos_active_cart");
      window.sessionStorage.removeItem("pos_last_checkout");
      window.sessionStorage.setItem("pos_session_owner", value);
    }
    const raw = window.sessionStorage.getItem(key());
    if (raw) {
      try {
        pending = { ...JSON.parse(raw), phase: "uncertain" };
      } catch {
        pending = { id: "unknown", path: "unknown", phase: "uncertain" };
      }
      if (pending?.paymentId) pending.phase = "payment";
    }
  }
  for (const listener of listeners) listener();
}
export function beginPosTransaction(path: string) {
  if (pending)
    throw {
      code: "POS_TRANSACTION_UNRESOLVED",
      message:
        "A previous checkout or payment needs verification. Check Orders and the payment provider before starting another transaction.",
    };
  const id = crypto.randomUUID();
  publish({ id, path, phase: "sending" });
  return id;
}
export function completePosTransaction(id: string, paymentId?: string) {
  if (pending?.id !== id) return;
  publish(paymentId ? { ...pending, paymentId, phase: "payment" } : null);
}
export function interruptPosTransaction(id: string, error: { code?: string; status?: number }) {
  if (pending?.id !== id) return;
  // A server pause rejects before business handlers; other explicit client errors
  // are definitive. Transport cancellation/timeouts/server errors are ambiguous.
  const definitive =
    error.code === "POS_PAUSED" ||
    (error.status &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 408 &&
      !error.code?.startsWith("IDEMPOTENCY_"));
  publish(definitive ? null : { ...pending, phase: "uncertain" });
}
export function resolvePosPayment(paymentId: string) {
  if (pending?.paymentId === paymentId) publish(null);
}
export function acknowledgePosTransaction() {
  publish(null);
}
export const getPendingPosTransaction = () => pending;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function usePendingPosTransaction() {
  return useSyncExternalStore(subscribe, getPendingPosTransaction, () => null);
}
