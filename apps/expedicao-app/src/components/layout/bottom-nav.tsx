import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Package, label: "Produtos", href: "/produtos" },
  { icon: ShoppingCart, label: "Pedidos", href: "/pedidos" },
  { icon: Truck, label: "Frota", href: "/frota" },
  { icon: BarChart3, label: "Relatórios", href: "/relatorios" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t bg-sidebar text-sidebar-foreground md:hidden z-50 safe-area-inset-bottom">
      {navItems.map((item) => {
        const active =
          location.pathname === item.href ||
          (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors cursor-pointer min-w-0 flex-1",
              active ? "text-white" : "text-sidebar-foreground/50"
            )}
          >
            <item.icon className={cn("w-5 h-5 shrink-0", active && "drop-shadow-sm")} />
            <span className="truncate w-full text-center">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
