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
} from "lucide-react";
import type { ReactNode } from "react";
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

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="px-5 py-6">
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
                  "flex items-center gap-3 border-l-2 px-3 py-2 text-sm font-medium transition-colors",
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
          className="m-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut size={16} />
          Abmelden
        </button>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}