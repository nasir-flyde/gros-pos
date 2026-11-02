import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { usePosMaintenance } from "@/hooks/use-pos-maintenance";
import {
  posMaintenanceAccess,
  PAUSED_DESCRIPTION,
  PAUSED_TITLE,
  STATUS_CHECK_INTERVAL_MS,
} from "@/lib/pos-maintenance";
import { checkPosMaintenance } from "@/lib/pos-maintenance-api";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export function PosMaintenanceGate({
  children,
  onSignOut,
}: {
  children: React.ReactNode;
  onSignOut: () => void;
}) {
  const state = usePosMaintenance();
  const queryClient = useQueryClient();

  useEffect(() => {
    let wasAllowed = posMaintenanceAccess.canUsePos();
    const unsubscribe = posMaintenanceAccess.subscribe(() => {
      const allowed = posMaintenanceAccess.canUsePos();
      if (wasAllowed && !allowed) {
        void queryClient.cancelQueries();
        queryClient.clear();
      }
      wasAllowed = allowed;
    });
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState !== "hidden") await checkPosMaintenance();
      if (!stopped) timer = setTimeout(() => void poll(), STATUS_CHECK_INTERVAL_MS);
    };
    const onFocus = () => void checkPosMaintenance();
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    // One deduplicated status request per minute (10s timeout, no retries).
    // Focus/explicit retry is throttled to prevent an unavailable backend storm.
    void poll();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      posMaintenanceAccess.reset();
    };
  }, [queryClient]);

  if (state.status?.enabled || state.status?.canBypass) return <>{children}</>;
  if (!state.status && !state.error) {
    return <div className="min-h-screen bg-background" />;
  }
  return (
    <div className="min-h-screen bg-background">
      <AlertDialog open>
        <AlertDialogContent onEscapeKeyDown={(event) => event.preventDefault()}>
          <AlertDialogTitle>
            {state.status ? PAUSED_TITLE : "Could not verify site availability"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {state.status ? PAUSED_DESCRIPTION : state.error}
          </AlertDialogDescription>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={onSignOut}>
              Sign out
            </Button>
            <Button disabled={state.checking} onClick={() => void checkPosMaintenance()}>
              {state.checking ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Try again
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
