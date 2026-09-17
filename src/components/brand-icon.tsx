import { Store } from "lucide-react";
import { usePosConfig } from "@/lib/pos-config";
import { cn } from "@/lib/utils";

export function BrandIcon({ className }: { className?: string }) {
  const config = usePosConfig((state) => state.config);
  return config.logoUrl ? (
    <img
      src={config.logoUrl}
      alt={config.organizationName}
      className={cn("rounded-md object-contain", className)}
    />
  ) : (
    <span
      style={{ backgroundColor: config.primaryColor }}
      className={cn("grid place-items-center rounded-md text-white", className)}
    >
      <Store aria-label={config.organizationName} className="size-8" />
    </span>
  );
}
