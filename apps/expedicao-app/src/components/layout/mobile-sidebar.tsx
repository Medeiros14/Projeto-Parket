import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  ArrowLeftRight,
  ClipboardList,
  BarChart3,
  LogOut,
  X,
  Menu,
  CalendarDays,
  Truck,
  BarChart2,
  FileText,
  Wrench,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import { useState, useEffect } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell.tsx";
import { ThemeToggle } from "./theme-toggle.tsx";

type NavItem = { icon: React.ElementType; label: string; href: string };
type NavGroup = { title: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    title: "Principal",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      { icon: Package, label: "Produtos", href: "/produtos" },
      { icon: Users, label: "Clientes", href: "/clientes" },
      { icon: ShoppingCart, label: "Pedidos", href: "/pedidos" },
      { icon: ArrowLeftRight, label: "Movimentações", href: "/movimentacoes" },
      { icon: ClipboardList, label: "Inventário", href: "/inventario" },
      { icon: BarChart3, label: "Relatórios", href: "/relatorios" },
      { icon: CalendarDays, label: "Cliente da Semana", href: "/cliente-semana" },
      { icon: CalendarCheck, label: "Agenda do Dia", href: "/agenda" },
      { icon: Truck, label: "Carta de Frete", href: "/fretes" },
    ],
  },
  {
    title: "Frota",
    items: [
      { icon: Truck, label: "Controle de Frota", href: "/frota" },
      { icon: BarChart2, label: "Dashboard Frota", href: "/frota/dashboard" },
      { icon: FileText, label: "Relatórios Frota", href: "/frota/relatorios" },
      { icon: Wrench, label: "Manutenção", href: "/frota/manutencao" },
    ],
  },
];

export function MobileSidebar() {
  const location = useLocation();
  const { removeUser, user } = useAuth();
  const [open, setOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const isActive = (href: string) =>
    location.pathname === href ||
    (href !== "/" && href !== "/dashboard" && location.pathname.startsWith(href)) ||
    (href === "/dashboard" && location.pathname === "/dashboard");

  return (
    <>
      {/* Top bar with hamburger */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <img
          src="/logo-parket.png"
          alt="Parket"
          className="h-7"
        />
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in sidebar */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 h-full w-72 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/15 border border-primary/40 flex items-center justify-center shrink-0">
              <span className="font-serif text-primary text-[14px] leading-none">E</span>
            </div>
            <div>
              <p className="font-serif font-medium text-[13px] leading-tight tracking-[0.16em] text-sidebar-foreground">PARKET</p>
              <p className="text-[8px] uppercase tracking-[0.22em] text-muted-foreground mt-1">EXPEDIÇÃO</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 text-[11px] font-serif font-medium uppercase tracking-[0.10em] transition-colors cursor-pointer border-l-2",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground border-l-primary"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-l-transparent"
                      )}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          {user && (
            <div className="px-3 py-2 mb-2">
              <p className="text-xs font-medium truncate">{user.profile.name ?? "Usuário"}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{user.profile.email ?? ""}</p>
            </div>
          )}
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
    </>
  );
}
