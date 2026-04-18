import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Bell,
  BarChart3,
  Settings,
  ShieldHalf,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function SidebarContent({ collapsed = false, onItemClick }: { collapsed?: boolean; onItemClick?: () => void }) {
  const location = useLocation();
  
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-hairline px-4">
        <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-transparent">
          <img src="/logo.png" alt="Killswitch Logo" className="h-full w-full object-contain" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-semibold tracking-tight">Killswitch</span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Protocol Guardian
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onItemClick}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-foreground"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="h-[16px] w-[16px] shrink-0" strokeWidth={1.75} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative hidden h-screen flex-col border-r border-hairline bg-sidebar transition-[width] duration-300 ease-out md:flex",
        collapsed ? "w-[68px]" : "w-[232px]"
      )}
    >
      <SidebarContent collapsed={collapsed} />

      {/* Footer / collapse */}
      <div className="border-t border-hairline p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center rounded-md border border-hairline px-2 py-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "›" : "‹  Collapse"}
        </button>
      </div>
    </aside>
  );
}
