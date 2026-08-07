import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Truck,
  Receipt,
  ClipboardList,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ausloggen } from "@/lib/gate";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/produkte", label: "Produkte", icon: Package },
  { to: "/lieferanten", label: "Lieferanten", icon: Truck },
  { to: "/rechnungen", label: "Rechnungen", icon: Receipt },
  { to: "/zaehlung", label: "Zählung", icon: ClipboardList },
  { to: "/verkaufszahlen", label: "Verkaufszahlen", icon: TrendingUp },
  { to: "/einstellungen", label: "Einstellungen", icon: Settings },
] as const;

export function AppShell({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    setOffen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {offen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setOffen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:z-auto lg:w-60 lg:translate-x-0",
          offen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-5 py-6">
          <button
            onClick={() => setOffen(false)}
            aria-label="Menü schließen"
            className="absolute right-3 top-5 grid h-10 w-10 place-items-center text-muted-foreground lg:hidden"
          >
            <X size={18} />
          </button>
          <div className="text-base font-semibold tracking-tight text-sidebar-foreground">
            QUNO x CM
          </div>
          <div className="text-xs font-medium text-primary">Inventur</div>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex min-h-12 items-center gap-3 border-l-2 px-3 py-2 text-sm font-medium transition-colors lg:min-h-0",
                  active
                    ? "border-primary bg-primary/10 text-sidebar-foreground"
                    : "border-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => {
            ausloggen();
            onLogout();
          }}
          className="m-2 flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:min-h-0"
        >
          <LogOut size={16} />
          Abmelden
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setOffen(true)}
            aria-label="Menü öffnen"
            className="grid h-12 w-12 place-items-center rounded-lg text-foreground hover:bg-muted"
          >
            <Menu size={22} />
          </button>
          <span className="text-sm font-semibold text-foreground">
            QUNO x CM <span className="text-primary">Inventur</span>
          </span>
        </header>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}