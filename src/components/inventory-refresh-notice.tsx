import { AlertTriangle, RefreshCw } from "lucide-react";

import { getErrorMessage } from "@/lib/pos-page-state";

export function InventoryRefreshNotice({
  error,
  isRefreshing,
  onRetry,
}: {
  error: unknown;
  isRefreshing: boolean;
  onRetry: () => void;
}) {
  if (!error) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900"
    >
      <span className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span className="truncate">
          Live inventory is temporarily stale. {getErrorMessage(error, "Refresh failed.")}
        </span>
      </span>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRefreshing}
        className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-amber-400 bg-white px-3 text-xs font-extrabold disabled:opacity-60"
      >
        <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        Retry
      </button>
    </div>
  );
}
