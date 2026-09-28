import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { CartProvider } from "@/lib/cart-context";
import { BrandIcon } from "@/components/brand-icon";
import { StoreScopeGate } from "@/components/store-scope-gate";
import {
  BadgePercent,
  Bike,
  Clock,
  Home,
  Printer,
  ReceiptText,
  ScanLine,
  ShoppingCart,
  Users,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { canViewShelfLabels } from "@/lib/shelf-label-access";
import { useLiveCatalog } from "@/lib/use-live-catalog";
import { useAuthStore } from "@/lib/auth-store";
import { clearCatalogCache } from "@/lib/catalog-cache";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { usePosConfig } from "@/lib/pos-config";

export const Route = createFileRoute("/_pos")({
  component: PosLayout,
});

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/new-order", label: "New Order", icon: ShoppingCart },
  { to: "/scanner", label: "Scan", icon: ScanLine },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/orders", label: "Orders", icon: ReceiptText },
  { to: "/delivery", label: "Delivery", icon: Bike },
  { to: "/shelf-labels", label: "SEL Printing", icon: Printer, shelfLabelOnly: true },
  { to: "/markdown-damage", label: "Markdown", icon: BadgePercent },
] as const;

function PosLayout() {
  const user = useAuthStore((state) => state.user);
  const storeId = useAuthStore((state) => state.scopes.find((scope) => scope.type === "store")?.id);
  const scopeKey = JSON.stringify([user?.organizationId, user?.id, storeId]);
  return (
    <StoreScopeGate>
      <ScopedTerminal key={scopeKey} scopeKey={scopeKey}>
        <CartProvider scopeKey={scopeKey}>
          <CatalogPrefetch />
          <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
            <TopHeader />
            <div className="flex flex-1 overflow-hidden">
              <SideNav />
              <main className="flex-1 overflow-hidden">
                <Outlet />
              </main>
            </div>
          </div>
        </CartProvider>
      </ScopedTerminal>
    </StoreScopeGate>
  );
}

function ScopedTerminal({ children }: { children: React.ReactNode; scopeKey: string }) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => () => client.clear(), [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function CatalogPrefetch() {
  const storeId = useAuthStore((state) => state.scopes.find((scope) => scope.type === "store")?.id);
  useLiveCatalog("pos-prefetch", storeId);
  return null;
}

function TopHeader() {
  const [now, setNow] = useState(() => new Date());
  const user = useAuthStore((state) => state.user);
  const config = usePosConfig((state) => state.config);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const date = now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  const handleLogout = async () => {
    const organizationId = user?.organizationId || undefined;
    queryClient.clear();
    await clearCatalogCache(organizationId);
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  const cashierName = user ? `${user.firstName} ${user.lastName}` : "Cashier Mode";
  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "POS"
    : config.organizationName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0] || "")
        .join("")
        .toUpperCase() || "POS";
  const isSuperAdmin = user?.isSuperAdmin || false;
  const storeScope = isSuperAdmin ? "Super Admin Access" : "Store Terminal Scope";

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-[var(--brand-blue)] px-4 py-3 text-white sm:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex shrink-0 items-center gap-2.5">
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl bg-white/10 object-contain p-1.5"
            />
          ) : (
            <BrandIcon className="h-12 w-12 shrink-0 rounded-xl" />
          )}
          <div className="min-w-0">
            <div className="truncate text-lg font-extrabold leading-tight tracking-tight">
              {config.organizationName}
            </div>
            <div className="text-[11px] font-medium leading-tight text-white/75">
              {config.tagline}
            </div>
          </div>
        </div>
        <div className="hidden h-10 w-px bg-white/20 md:block" />
        <div className="hidden min-w-0 md:block">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand-green)]" />
            <span className="truncate">{storeScope}</span>
          </div>
          <div className="text-xs text-white/70">Cashier: {cashierName} · Online Session</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden text-right md:block" suppressHydrationWarning>
          <div className="text-lg font-bold leading-tight tabular-nums" suppressHydrationWarning>
            {time}
          </div>
          <div className="text-[11px] text-white/70" suppressHydrationWarning>
            {date}
          </div>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-bold uppercase">
          {initials}
        </div>
        <button
          onClick={handleLogout}
          title="Sign Out"
          className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full bg-red-600/20 text-white transition-colors hover:bg-red-600/40"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

export function SideNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const permissions = useAuthStore((state) => state.permissions);
  const isSuperAdmin = useAuthStore((state) => Boolean(state.user?.isSuperAdmin));
  const visibleNav = NAV.filter((item) => {
    if ("shelfLabelOnly" in item) return canViewShelfLabels(permissions, isSuperAdmin);
    return true;
  });
  return (
    <nav className="flex w-[88px] shrink-0 flex-col gap-1.5 overflow-y-auto bg-[var(--surface)] py-3 shadow-[2px_0_0_var(--color-border)]">
      {visibleNav.map((n) => {
        const active = pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to));
        const Icon = n.icon;
        return (
          <Link
            key={n.to}
            to={n.to}
            className={
              "mx-1.5 flex tap-target flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold transition-colors " +
              (active
                ? "bg-[var(--brand-blue)] text-white"
                : "text-[var(--ink)] hover:bg-[var(--secondary)]")
            }
          >
            <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
            <span>{n.label}</span>
          </Link>
        );
      })}
      <div className="mx-1.5 mt-auto flex items-center justify-center gap-1 rounded-xl bg-[var(--secondary)] py-2 text-[10px] font-semibold text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> v2.4
      </div>
    </nav>
  );
}
