import { useSyncExternalStore } from "react";
import { posMaintenanceAccess } from "@/lib/pos-maintenance";

export function usePosMaintenance() {
  return useSyncExternalStore(
    posMaintenanceAccess.subscribe,
    posMaintenanceAccess.getSnapshot,
    posMaintenanceAccess.getServerSnapshot,
  );
}
