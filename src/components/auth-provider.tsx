import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, Loader2, LogOut, RefreshCw } from "lucide-react";
import { AuthAccessContext } from "@/lib/auth-access-context";
import { BrandIcon } from "@/components/brand-icon";
import { useAuthStore, type AuthFailure } from "@/lib/auth-store";
import { api, setClerkTokenGetter } from "@/lib/api";
import {
  clearProtectedPosConfig,
  loadProtectedPosConfig,
  loadPublicPosConfig,
  usePosConfig,
} from "@/lib/pos-config";
import { isPosAccessError, posMaintenanceAccess } from "@/lib/pos-maintenance";
import { clearCatalogCache } from "@/lib/catalog-cache";
import { setPosSessionOwner } from "@/lib/pos-transaction-guard";
import { PosMaintenanceGate } from "./pos-maintenance-gate";

interface AccessResponse {
  data?: {
    user?: {
      _id?: string;
      id?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      isSuperAdmin?: boolean | number;
      organizationId?: string | null;
      mustChangePassword?: boolean;
    };
    permissions?: string[];
    scopes?: Array<{
      type: "store" | "warehouse" | "city";
      id: string;
      name: string;
    }>;
    clerkOrganizationId?: string | null;
  };
}

function LoadingScreen() {
  const config = usePosConfig((state) => state.config);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4 text-center">
      <div className="relative flex flex-col items-center space-y-4">
        {config.logoUrl ? (
          <img
            src={config.logoUrl}
            alt=""
            className="size-14 animate-pulse rounded-xl object-contain"
          />
        ) : (
          <BrandIcon className="size-14 animate-pulse rounded-xl shadow-lg shadow-orange-500/25" />
        )}
        <div className="flex items-center space-x-2 text-sm font-medium text-slate-400">
          <Loader2 className="size-4 animate-spin text-orange-500" />
          <span>Verifying session...</span>
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({
  failure,
  onRetry,
  onSignOut,
}: {
  failure: AuthFailure;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const config = usePosConfig((state) => state.config);
  const title = failure.code === "NO_LOCAL_ACCOUNT" ? "Account not linked" : "Session unavailable";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4 text-center">
      <div className="relative flex max-w-sm flex-col items-center space-y-4">
        <div className="flex size-14 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
          <AlertTriangle className="size-7" />
        </div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <p className="text-sm text-slate-400">{failure.message}</p>
        {config.supportText && <p className="text-xs text-slate-500">{config.supportText}</p>}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
          >
            <RefreshCw className="size-4" />
            Retry
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function toAuthFailure(error: unknown): AuthFailure {
  const serverError = error as { code?: unknown; message?: unknown };
  if (
    [
      "NO_LOCAL_ACCOUNT",
      "ACTIVE_ORGANIZATION_REQUIRED",
      "CLERK_ORGANIZATION_NOT_LINKED",
      "CLERK_MEMBERSHIP_REQUIRED",
    ].includes(String(serverError?.code || ""))
  ) {
    return {
      code: "NO_LOCAL_ACCOUNT",
      message:
        typeof serverError.message === "string"
          ? serverError.message
          : "No GROS account is linked to this session. Contact your administrator.",
    };
  }

  return {
    code: "ACCESS_UNAVAILABLE",
    message:
      typeof serverError?.message === "string"
        ? serverError.message
        : "We could not verify your POS access. Check the connection and try again.",
  };
}

// Protected config uses the maintenance-gated client, so it can only load once the gate opens.
function ProtectedConfigBoundary({ children }: { children: React.ReactNode }) {
  const setError = useAuthStore((state) => state.setError);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await loadProtectedPosConfig();
        if (active) setLoaded(true);
      } catch (caught) {
        if (!active || isPosAccessError(caught)) return;
        console.error("[AuthProvider] Failed to load POS configuration:", caught);
        setError(toAuthFailure(caught));
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [setError]);

  return loaded ? <>{children}</> : <LoadingScreen />;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut, orgId, userId, sessionId } = useAuth();
  const queryClient = useQueryClient();
  const [attemptedSession, setAttemptedSession] = useState<string | null>(null);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const user = useAuthStore((state) => state.user);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setGrosAccess = useAuthStore((state) => state.setGrosAccess);
  const setError = useAuthStore((state) => state.setError);
  const clearGrosAccess = useAuthStore((state) => state.clearGrosAccess);
  const identity = JSON.stringify([orgId, userId, sessionId]);
  const sessionKey = sessionId || userId ? identity : null;
  const resolvedIdentityRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const accessController = useRef<AbortController | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    setClerkTokenGetter(() => getToken());
    return () => setClerkTokenGetter(null);
  }, [getToken]);

  const refreshAccess = useCallback(() => {
    if (!isLoaded || !isSignedIn || !sessionKey) return Promise.resolve();
    if (inFlightRef.current) return inFlightRef.current;

    const requestId = ++requestIdRef.current;
    setAttemptedSession(sessionKey);
    setLoading();
    posMaintenanceAccess.reset();
    const controller = new AbortController();
    accessController.current = controller;

    const request = (async () => {
      try {
        const response = (await api.get("/auth/me", {
          signal: controller.signal,
          timeout: 10_000,
        })) as AccessResponse;
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;

        const { user: accessUser, permissions, scopes, clerkOrganizationId } = response?.data ?? {};
        const userId = accessUser?._id ?? accessUser?.id ?? "";
        if (!accessUser || !userId)
          throw new Error("The access service returned an invalid response.");

        resolvedIdentityRef.current = identity;
        setGrosAccess({
          user: {
            id: userId,
            firstName: accessUser.firstName ?? "",
            lastName: accessUser.lastName ?? "",
            email: accessUser.email ?? "",
            phone: accessUser.phone ?? "",
            isSuperAdmin: Boolean(accessUser.isSuperAdmin),
            organizationId: accessUser.organizationId ?? null,
            mustChangePassword: Boolean(accessUser.mustChangePassword),
          },
          permissions: permissions ?? [],
          scopes: scopes ?? [],
          clerkOrganizationId: clerkOrganizationId ?? null,
        });
      } catch (caught) {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;
        console.error("[AuthProvider] Failed to load POS access:", caught);
        setError(toAuthFailure(caught));
      } finally {
        if (requestId === requestIdRef.current) inFlightRef.current = null;
      }
    })();

    inFlightRef.current = request;
    return request;
  }, [isLoaded, isSignedIn, identity, sessionKey, setError, setGrosAccess, setLoading]);

  useEffect(() => {
    requestIdRef.current += 1;
    accessController.current?.abort();
    inFlightRef.current = null;
    posMaintenanceAccess.reset();
    void queryClient.cancelQueries();
    queryClient.clear();
    void clearCatalogCache();
    clearGrosAccess();
    clearProtectedPosConfig();
    void loadPublicPosConfig();
    setAttemptedSession(null);
    setPosSessionOwner(isLoaded && isSignedIn ? (userId ?? sessionKey) : null);
    if (isLoaded && isSignedIn && sessionKey) void refreshAccess();
    return () => {
      requestIdRef.current += 1;
      accessController.current?.abort();
      inFlightRef.current = null;
      posMaintenanceAccess.reset();
      clearProtectedPosConfig();
    };
  }, [clearGrosAccess, isLoaded, isSignedIn, sessionKey, userId, queryClient, refreshAccess]);

  const handleSignOut = () => {
    posMaintenanceAccess.reset();
    queryClient.clear();
    clearGrosAccess();
    clearProtectedPosConfig();
    void signOut();
  };

  useEffect(() => {
    const isLoginPath = pathname === "/login";
    const isPasswordPath = pathname === "/change-password";
    if (!isLoaded) return;
    if (!isSignedIn) {
      if (!isLoginPath) navigate({ to: "/login", replace: true });
      return;
    }
    if (status !== "ready" || resolvedIdentityRef.current !== identity) return;
    if (user?.mustChangePassword && !isPasswordPath) {
      navigate({ to: "/change-password", replace: true });
    } else if (!user?.mustChangePassword && isPasswordPath) {
      navigate({ to: "/", replace: true });
    } else if (isLoginPath) {
      navigate({ to: user?.mustChangePassword ? "/change-password" : "/", replace: true });
    }
  }, [isLoaded, isSignedIn, navigate, pathname, status, user?.mustChangePassword, identity]);

  const accessContext = useMemo(() => ({ refreshAccess }), [refreshAccess]);

  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return pathname === "/login" ? <>{children}</> : <LoadingScreen />;
  if (pathname === "/login") return <LoadingScreen />;

  if (attemptedSession !== sessionKey) return <LoadingScreen />;

  if (status === "error" && error) {
    return (
      <ErrorScreen failure={error} onRetry={() => void refreshAccess()} onSignOut={handleSignOut} />
    );
  }

  if (status !== "ready" || resolvedIdentityRef.current !== identity) return <LoadingScreen />;
  if (user?.mustChangePassword && pathname !== "/change-password") return <LoadingScreen />;

  return (
    <AuthAccessContext.Provider value={accessContext}>
      <PosMaintenanceGate key={sessionKey} onSignOut={handleSignOut}>
        <ProtectedConfigBoundary>{children}</ProtectedConfigBoundary>
      </PosMaintenanceGate>
    </AuthAccessContext.Provider>
  );
}
