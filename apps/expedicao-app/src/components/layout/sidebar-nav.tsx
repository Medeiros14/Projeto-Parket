import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  BarChart3,
  ClipboardList,
  ArrowLeftRight,
  LogOut,
  CalendarDays,
  Truck,
  BarChart2,
  FileText,
  Wrench,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import { NotificationBell } from "@/components/notifications/notification-bell.tsx";
import { ThemeToggle } from "./theme-toggle.tsx";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Package, label: "Produtos", href: "/produtos" },
  { icon: Users, label: "Clientes", href: "/clientes" },
  { icon: ShoppingCart, label: "Pedidos", href: "/pedidos" },
  { icon: ArrowLeftRight, label: "Movimentações", href: "/movimentacoes" },
  { icon: ClipboardList, label: "Inventário", href: "/inventario" },
  { icon: BarChart3, label: "Relatórios", href: "/relatorios" },
  { icon: CalendarDays, label: "Cliente da Semana", href: "/cliente-semana" },
  { icon: CalendarCheck, label: "Agenda do Dia", href: "/agenda" },
  { icon: Truck, label: "Carta de Frete", href: "/fretes" },
  { icon: Truck, label: "Frota", href: "/frota" },
  { icon: BarChart2, label: "Dashboard Frota", href: "/frota/dashboard" },
  { icon: FileText, label: "Relatórios Frota", href: "/frota/relatorios" },
  { icon: Wrench, label: "Manutenção", href: "/frota/manutencao" },
];

export function SidebarNav() {
  const location = useLocation();
  const { removeUser, user } = useAuth();

  return (
    <aside className="hidden md:flex md:w-64 flex-col bg-sidebar text-sidebar-foreground h-screen sticky top-0 border-r border-sidebar-border">
      <div className="px-4 py-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-9 h-9 bg-primary/15 border border-primary/40 flex items-center justify-center shrink-0">
          <span className="font-serif text-primary text-[14px] leading-none">E</span>
        </div>
        <div>
          <p className="font-serif font-medium text-[13px] leading-tight tracking-[0.16em] text-sidebar-foreground">PARKET</p>
          <p className="text-[8px] uppercase tracking-[0.22em] text-muted-foreground mt-1">EXPEDIÇÃO</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-[11px] font-serif font-medium uppercase tracking-[0.10em] transition-colors cursor-pointer border-l-2",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground border-l-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-l-transparent"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border">
        {user && (
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-medium truncate">{user.profile.name ?? "Usuário"}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user.profile.email ?? ""}</p>
          </div>
        )}
        <div className="px-3 mb-2 flex items-center">
          <NotificationBell />
          <span className="text-xs text-sidebar-foreground/70 ml-2">Notificações</span>
        </div>
        <ThemeToggle />
        <button
          onClick={() => removeUser()}
          className="flex items-center gap-3 px-3 py-2.5 text-[11px] font-serif font-medium uppercase tracking-[0.10em] text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
