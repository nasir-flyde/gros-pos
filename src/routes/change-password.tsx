import { useAuth, UserProfile } from "@clerk/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/change-password")({
  head: () => ({
    meta: [
      { title: "Account Settings — Chota Bazaar POS" },
      { name: "description", content: "Manage your account security." },
    ],
  }),
  component: PosAccountSettingsPage,
});

function PosAccountSettingsPage() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  if (!isSignedIn) {
    navigate({ to: "/login", replace: true });
    return null;
  }

  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-hidden bg-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute top-1/4 left-1/4 -z-10 size-[300px] rounded-full bg-orange-600/10 blur-[80px]" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 size-[300px] rounded-full bg-yellow-500/10 blur-[80px]" />

      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/" })}
            className="flex size-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-orange-600 text-white shadow-xl shadow-orange-600/20">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">Account Settings</h2>
              <p className="text-sm text-slate-400">Manage your password and security from Clerk</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-md">
          <UserProfile
            appearance={{
              elements: {
                card: "shadow-none bg-transparent",
                navbar: "hidden",
                pageScrollBox: "p-0",
                rootBox: "w-full",
                headerTitle: "text-white text-lg font-bold",
                headerSubtitle: "text-slate-400 text-sm",
                profileSectionTitle: "text-white font-semibold",
                profileSectionSubtitle: "text-slate-400",
                profileSectionContent: "text-slate-300",
                formFieldLabel: "text-xs font-bold uppercase tracking-wider text-slate-400",
                formFieldInput:
                  "block w-full rounded-xl border bg-slate-900/50 py-3 px-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500 border-slate-800",
                formButtonPrimary:
                  "rounded-xl bg-orange-500 py-3 px-6 text-sm font-bold text-white hover:bg-orange-600 transition",
                footer: "hidden",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
