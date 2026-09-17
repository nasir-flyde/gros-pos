import { useAuth } from "@clerk/react";
import { AlertTriangle, LogOut, RefreshCw } from "lucide-react";
import { useAuthAccess } from "@/lib/auth-access-context";
import { useAuthStore } from "@/lib/auth-store";

export function StoreScopeGate({ children }: { children: React.ReactNode }) {
  const scopes = useAuthStore((state) => state.scopes);
  const { refreshAccess } = useAuthAccess();
  const { signOut } = useAuth();
  const hasStore = scopes.some((scope) => scope.type === "store" && scope.id.trim().length > 0);

  if (hasStore) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <div className="grid size-14 place-items-center rounded-xl bg-amber-500/10 text-amber-400">
          <AlertTriangle className="size-7" />
        </div>
        <h1 className="text-xl font-bold text-white">No store assigned</h1>
        <p className="text-sm text-slate-400">
          Your account needs an active store assignment before this POS terminal can be used.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => void refreshAccess()}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"
          >
            <RefreshCw className="size-4" />
            Retry access
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
