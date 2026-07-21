import { SignIn } from "@clerk/react";
import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { usePosConfig } from "@/lib/pos-config";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "POS Login" },
      { name: "description", content: "Sign in to access the store POS terminal." },
    ],
  }),
  component: PosLoginPage,
});

function PosLoginPage() {
  const config = usePosConfig((state) => state.config);
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute top-1/3 left-1/3 -z-10 size-[320px] rounded-full bg-orange-600/10 blur-[90px]" />
      <div className="absolute bottom-1/3 right-1/3 -z-10 size-[320px] rounded-full bg-yellow-500/10 blur-[90px]" />

      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt=""
              className="h-16 w-16 rounded-2xl object-contain shadow-lg"
            />
          ) : (
            <div
              style={{ backgroundColor: config.primaryColor }}
              className="grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lg"
            >
              <Store className="h-9 w-9" />
            </div>
          )}
          <h2 className="mt-6 text-3xl font-black tracking-tight text-white uppercase">
            {config.loginHeading}
          </h2>
          <p className="mt-2 text-sm text-slate-400">{config.loginSubtitle}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-8 shadow-2xl backdrop-blur-md">
          <SignIn
            appearance={{
              elements: {
                card: "shadow-none bg-transparent",
                header: "hidden",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton:
                  "bg-slate-800 border-slate-700 text-white hover:bg-slate-700 rounded-xl py-3",
                socialButtonsBlockButtonText: "text-sm font-medium text-white",
                dividerLine: "bg-slate-700",
                dividerText: "text-slate-500 text-xs",
                formFieldLabel:
                  "block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1",
                formFieldInput:
                  "block w-full rounded-xl border bg-slate-900/50 py-3.5 px-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500 border-slate-800",
                formButtonPrimary:
                  "flex w-full items-center justify-center rounded-xl bg-orange-500 py-4 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 active:scale-[0.98]",
                footerAction: "text-slate-400",
                footerActionLink: "text-orange-400 hover:text-orange-300",
                identityPreviewEditButton: "text-orange-400",
                formFieldError: "text-red-400 text-xs mt-1",
              },
            }}
          />
        </div>

        <p className="text-center text-[10.5px] uppercase tracking-wider text-slate-600">
          {config.supportText || `${config.consoleName} Secure Sign-In`}
        </p>
      </div>
    </div>
  );
}
