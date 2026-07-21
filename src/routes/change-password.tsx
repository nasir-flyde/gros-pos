import { useState } from "react";
import { useAuth } from "@clerk/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, LockKeyhole, LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { usePosConfig } from "@/lib/pos-config";

export const Route = createFileRoute("/change-password")({
  head: () => ({
    meta: [
      { title: "Set Password" },
      { name: "description", content: "Create your POS password before continuing." },
    ],
  }),
  component: PosAccountSettingsPage,
});

function PosAccountSettingsPage() {
  const { isSignedIn, signOut } = useAuth();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const config = usePosConfig((state) => state.config);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isSignedIn) {
    navigate({ to: "/login", replace: true });
    return null;
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await api.post("/auth/setup-password", { newPassword });
      const refreshed = (await api.get("/auth/me")) as {
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
          scopes?: Array<{ type: "store" | "warehouse" | "city"; id: string; name: string }>;
          clerkOrganizationId?: string | null;
        };
      };
      const nextUser = refreshed?.data?.user;
      if (nextUser) {
        useAuthStore.getState().setGrosAccess({
          user: {
            id: nextUser._id ?? nextUser.id ?? "",
            firstName: nextUser.firstName ?? "",
            lastName: nextUser.lastName ?? "",
            email: nextUser.email ?? "",
            phone: nextUser.phone ?? "",
            isSuperAdmin: Boolean(nextUser.isSuperAdmin),
            organizationId: nextUser.organizationId ?? null,
            mustChangePassword: Boolean(nextUser.mustChangePassword),
          },
          permissions: refreshed?.data?.permissions ?? [],
          scopes: refreshed?.data?.scopes ?? [],
          clerkOrganizationId: refreshed?.data?.clerkOrganizationId ?? null,
        });
      }
      navigate({ to: "/", replace: true });
    } catch (err) {
      const serverErr = err as { message?: string };
      setError(serverErr?.message || "We could not save your password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const initials = config.organizationName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();

  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-hidden bg-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute top-1/4 left-1/4 -z-10 size-[300px] rounded-full bg-orange-600/10 blur-[80px]" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 size-[300px] rounded-full bg-yellow-500/10 blur-[80px]" />

      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          {config.logoUrl ? (
            <img src={config.logoUrl} alt="" className="size-12 rounded-2xl object-contain" />
          ) : (
            <div
              style={{ backgroundColor: config.primaryColor }}
              className="grid size-12 place-items-center rounded-2xl text-sm font-black text-white shadow-xl"
            >
              {initials || "POS"}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">Set your password</h2>
            <p className="text-sm text-slate-400">
              Create a password for {user?.firstName || "your account"} before starting the shift.
            </p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-start gap-3 rounded-2xl bg-slate-900/80 p-4">
            <div className="grid size-10 place-items-center rounded-xl bg-orange-500 text-white">
              <LockKeyhole className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">One-time password setup</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Use 8+ characters with one uppercase letter, one number, and one special
                character.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="block w-full rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              placeholder="Create a strong password"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="block w-full rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              placeholder="Repeat your password"
              autoComplete="new-password"
              required
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center rounded-xl bg-orange-500 py-3 px-6 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save password"}
          </button>

          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 py-3 px-6 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            <LogOut className="size-4" />
            Sign out
          </button>

          {config.supportText ? (
            <p className="text-center text-xs text-slate-500">{config.supportText}</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
