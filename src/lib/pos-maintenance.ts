export type PosMaintenanceStatus = {
  enabled: boolean;
  canBypass: boolean;
  canManage: boolean;
  updatedAt: string | null;
};

export type PosMaintenanceState = {
  status: PosMaintenanceStatus | null;
  checking: boolean;
  error: string | null;
};

export const PAUSED_TITLE = "Could Not Load Information";
export const PAUSED_DESCRIPTION =
  "The system is not able to load information. Please contact support if the issue persists.";
export const STATUS_CHECK_INTERVAL_MS = 60_000;
export const STATUS_CHECK_COOLDOWN_MS = 5_000;

const INITIAL_STATE: PosMaintenanceState = { status: null, checking: false, error: null };

export function parseMaintenanceStatus(value: unknown): PosMaintenanceStatus {
  if (!value || typeof value !== "object") throw new Error("Invalid availability response");
  const status = value as Record<string, unknown>;
  if (
    typeof status.enabled !== "boolean" ||
    typeof status.canBypass !== "boolean" ||
    typeof status.canManage !== "boolean" ||
    (status.canManage && !status.canBypass)
  )
    throw new Error("Invalid availability response");
  return {
    enabled: status.enabled,
    canBypass: status.canBypass,
    canManage: status.canManage,
    updatedAt: typeof status.updatedAt === "string" ? status.updatedAt : null,
  };
}

// Only these narrowly scoped bootstrap/control requests bypass local gating.
export function posApiPath(url: string) {
  if (!url.startsWith("/") || url.startsWith("//") || /(^|\/)\.\.?([/?#]|$)/.test(url)) {
    throw new Error("POS API requests must use a relative API path");
  }
  if (url === "/auth/me" || url === "/auth/setup-password") return url;
  return url.startsWith("/pos/") ? url : `/pos${url}`;
}

export function isMaintenanceControlRequest(path: string, method = "get") {
  const verb = method.toLowerCase();
  return (path === "/auth/me" && verb === "get") || (path === "/pos/maintenance" && verb === "get");
}

export class PosMaintenanceAccess {
  private state = INITIAL_STATE;
  private listeners = new Set<() => void>();
  private requests = new Set<AbortController>();
  private generation = 0;
  private lastCheck = Number.NEGATIVE_INFINITY;
  private currentCheck: Promise<void> | null = null;
  private checkController: AbortController | null = null;

  getSnapshot = () => this.state;
  getServerSnapshot = () => INITIAL_STATE;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  canUsePos = () => Boolean(this.state.status?.enabled || this.state.status?.canBypass);

  private publish(state: PosMaintenanceState) {
    this.state = state;
    if (!this.canUsePos()) {
      for (const request of this.requests) request.abort();
      this.requests.clear();
    }
    for (const listener of this.listeners) listener();
  }

  reset = () => {
    this.generation += 1;
    this.checkController?.abort();
    this.checkController = null;
    this.currentCheck = null;
    this.lastCheck = Number.NEGATIVE_INFINITY;
    this.publish(INITIAL_STATE);
  };

  assertPosAccess = () => {
    if (this.canUsePos()) return;
    throw {
      success: false,
      code: this.state.status ? "POS_PAUSED" : "POS_ACCESS_PENDING",
      message: this.state.status ? PAUSED_DESCRIPTION : "Checking POS availability",
    };
  };

  acquireRequest = (upstream?: AbortSignal) => {
    this.assertPosAccess();
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (upstream?.aborted) controller.abort();
    else upstream?.addEventListener("abort", abort, { once: true });
    this.requests.add(controller);
    return {
      signal: controller.signal,
      release: () => {
        this.requests.delete(controller);
        upstream?.removeEventListener("abort", abort);
      },
    };
  };

  // Only an explicit POS_PAUSED response can change ordinary API error handling
  // into a pause. Invalidate older status reads so they cannot reopen the panel.
  receivePausedResponse = () => {
    this.applySavedStatus({ enabled: false, canBypass: false, canManage: false, updatedAt: null });
  };

  applySavedStatus = (status: PosMaintenanceStatus) => {
    const parsed = parseMaintenanceStatus(status);
    this.generation += 1;
    this.checkController?.abort();
    this.checkController = null;
    this.currentCheck = null;
    this.lastCheck = Date.now();
    this.publish({ status: parsed, checking: false, error: null });
  };

  checkStatus = (
    fetchStatus: (signal: AbortSignal) => Promise<unknown>,
    now = Date.now(),
  ): Promise<void> => {
    if (this.currentCheck) return this.currentCheck;
    if (now - this.lastCheck < STATUS_CHECK_COOLDOWN_MS) return Promise.resolve();
    this.lastCheck = now;
    const generation = this.generation;
    const controller = new AbortController();
    this.checkController = controller;
    this.publish({ ...this.state, checking: true });
    const check = Promise.resolve()
      .then(() => fetchStatus(controller.signal))
      .then((status) => {
        if (generation !== this.generation) return;
        this.publish({ status: parseMaintenanceStatus(status), checking: false, error: null });
      })
      .catch(() => {
        if (generation !== this.generation) return;
        // Unknown availability is a distinct error, not a persisted pause.
        this.publish({
          status: null,
          checking: false,
          error: "Unable to check POS availability. Please try again.",
        });
      })
      .finally(() => {
        if (generation !== this.generation) return;
        this.currentCheck = null;
        this.checkController = null;
      });
    this.currentCheck = check;
    return check;
  };
}

export const posMaintenanceAccess = new PosMaintenanceAccess();

export function isPosAccessError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "POS_PAUSED" || code === "POS_ACCESS_PENDING" || code === "REQUEST_CANCELLED";
}
