import { useCallback, useEffect } from "react";
import { useAuth, useOrganization } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2, AlertTriangle } from "lucide-react";
import { useAuthStore } from "../lib/auth-store";
import { api, setClerkTokenGetter } from "../lib/api";
import {
  clearProtectedPosConfig,
  loadProtectedPosConfig,
  loadPublicPosConfig,
  usePosConfig,
} from "../lib/pos-config";

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
          <div
            style={{ backgroundColor: config.primaryColor }}
            className="flex size-14 items-center justify-center rounded-xl text-white font-extrabold text-xl shadow-lg animate-pulse"
          >
            POS
          </div>
        )}
        <div className="flex items-center space-x-2 text-slate-400 text-sm font-medium">
          <Loader2 className="size-4 animate-spin text-orange-500" />
          <span>Verifying session...</span>
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onSignOut }: { message: string; onSignOut: () => void }) {
  const config = usePosConfig((state) => state.config);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4 text-center">
      <div className="relative flex flex-col items-center space-y-4 max-w-sm">
        <div className="flex size-14 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
          <AlertTriangle className="size-7" />
        </div>
        <h1 className="text-lg font-semibold text-white">Access Denied</h1>
        <p className="text-sm text-slate-400">{message}</p>
        {config.supportText && <p className="text-xs text-slate-500">{config.supportText}</p>}
        <button
          onClick={onSignOut}
          className="mt-2 inline-flex items-center justify-center rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const pathname = location.pathname;

  const isResolved = useAuthStore((s) => s.isResolved);
  const error = useAuthStore((s) => s.error);
  const setGrosAccess = useAuthStore((s) => s.setGrosAccess);
  const setError = useAuthStore((s) => s.setError);
  const clearGrosAccess = useAuthStore((s) => s.clearGrosAccess);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setClerkTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    clearGrosAccess();
    queryClient.clear();
  }, [organization?.id, clearGrosAccess, queryClient]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || isResolved) return;

    const loadGrosAccess = async () => {
      try {
        const res = (await api.get("/auth/me")) as {
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
        };
        const { user, permissions, scopes, clerkOrganizationId } = res?.data ?? {};
        if (!user) throw new Error("Invalid /me response");
        setGrosAccess({
          user: {
            id: user._id ?? user.id ?? "",
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            email: user.email ?? "",
            phone: user.phone ?? "",
            isSuperAdmin: Boolean(user.isSuperAdmin),
            organizationId: user.organizationId ?? null,
            mustChangePassword: Boolean(user.mustChangePassword),
          },
          permissions: permissions ?? [],
          scopes: scopes ?? [],
          clerkOrganizationId: clerkOrganizationId ?? null,
        });
        await loadProtectedPosConfig();
      } catch (err) {
        const serverErr = err as Record<string, unknown>;
        if (
          [
            "NO_LOCAL_ACCOUNT",
            "ACTIVE_ORGANIZATION_REQUIRED",
            "CLERK_ORGANIZATION_NOT_LINKED",
            "CLERK_MEMBERSHIP_REQUIRED",
          ].includes(String(serverErr?.code || ""))
        ) {
          setError(
            (serverErr?.message as string) ??
              "No GROS account linked to this session. Contact your administrator.",
          );
        } else {
          console.error("[AuthProvider] Failed to load GROS access bundle:", err);
        }
      }
    };

    loadGrosAccess();
  }, [isLoaded, isSignedIn, isResolved, organization?.id, setGrosAccess, setError]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      clearGrosAccess();
      clearProtectedPosConfig();
      void loadPublicPosConfig();
    }
  }, [isLoaded, isSignedIn, clearGrosAccess]);

  if (!isLoaded) return <LoadingScreen />;

  const isLoginPath = pathname === "/login";
  const isPasswordPath = pathname === "/change-password";

  if (!isSignedIn) {
    if (!isLoginPath && !isPasswordPath) {
      navigate({ to: "/login", replace: true });
    }
    return <>{children}</>;
  }

  if (isResolved && user?.mustChangePassword && !isPasswordPath) {
    navigate({ to: "/change-password", replace: true });
    return null;
  }

  if (isResolved && !user?.mustChangePassword && isPasswordPath) {
    navigate({ to: "/", replace: true });
    return null;
  }

  if (isSignedIn && isLoginPath) {
    navigate({ to: user?.mustChangePassword ? "/change-password" : "/", replace: true });
    return null;
  }

  if (error) {
    return <ErrorScreen message={error} onSignOut={() => signOut()} />;
  }

  if (!isResolved) return <LoadingScreen />;

  return <>{children}</>;
}
