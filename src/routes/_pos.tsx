import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { CartProvider } from "@/lib/cart-context";
import {
  Home, ShoppingCart, Users, Pause, RotateCcw, Bike, Wallet,
  Package, BarChart3, ScanLine, Store, Clock,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_pos")({
  component: PosLayout,
});

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/new-order", label: "New Order", icon: ShoppingCart },
  { to: "/scanner", label: "Scan", icon: ScanLine },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/hold", label: "Held", icon: Pause },
  { to: "/returns", label: "Returns", icon: RotateCcw },
  { to: "/delivery", label: "Delivery", icon: Bike },
  { to: "/cash", label: "Cash", icon: Wallet },
  { to: "/inventory", label: "Stock", icon: Package },
  { to: "/reports", label: "Reports", icon: BarChart3 },
] as const;

function PosLayout() {
  return (
    <CartProvider>
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
  );
}

function TopHeader() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const date = now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-[var(--brand-blue)] px-4 py-3 text-white sm:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--brand-yellow)] text-[var(--brand-blue)]">
            <Store className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-extrabold leading-tight tracking-tight">CHOTA BAZAAR</div>
            <div className="text-[11px] font-medium leading-tight text-white/75">Sab Kuch. Kareeb Se.</div>
          </div>
        </div>
        <div className="hidden h-10 w-px bg-white/20 md:block" />
        <div className="hidden min-w-0 md:block">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand-green)]" />
            <span className="truncate">Karol Bagh Store · ST-018</span>
          </div>
          <div className="text-xs text-white/70">Cashier: Anjali Mehta · Shift A (08:00–16:00)</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden text-right md:block">
          <div className="text-lg font-bold leading-tight tabular-nums">{time}</div>
          <div className="text-[11px] text-white/70">{date}</div>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-bold">
          AM
        </div>
      </div>
    </header>
  );
}

function SideNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex w-[88px] shrink-0 flex-col gap-1.5 overflow-y-auto bg-[var(--surface)] py-3 shadow-[2px_0_0_var(--color-border)]">
      {NAV.map((n) => {
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
      <div className="mt-auto mx-1.5 flex items-center justify-center gap-1 rounded-xl bg-[var(--secondary)] py-2 text-[10px] font-semibold text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> v2.4
      </div>
    </nav>
  );
}
