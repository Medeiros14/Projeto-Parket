import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import {
  KanbanSquare, DraftingCompass, Layers, Hammer,
  Warehouse, CheckCircle2, Eye, ShoppingCart,
  Sun, Moon, LogOut,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";

/** Estrutura idêntica ao Homebroker (parket-homebroker/frontend/src/components/Layout.tsx):
 *  sidebar colapsável, toggle Sun/Moon 11px no header do sidebar, nav items uppercase
 *  Cinzel 10px com border-l-2 accent quando ativo, rodapé com user info + Sair.
 *  Cantos retos em tudo (SO Parket = border-radius 0).
 */
const NAV = [
  { to: "/",           icon: KanbanSquare,    label: "Kanban" },
  { to: "/validacao",  icon: DraftingCompass, label: "Validação" },
  { to: "/prensa",     icon: Layers,          label: "Prensa" },
  { to: "/marcenaria", icon: Hammer,          label: "Produção" },
  { to: "/almoxarifado", icon: Warehouse,     label: "Almoxarifado" },
  { to: "/finalizado", icon: CheckCircle2,    label: "Finalizado" },
  { to: "/visao360",   icon: Eye,             label: "Visão 360º" },
  { to: "/solicitar",  icon: ShoppingCart,    label: "Solicitar Compra" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { mode, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("producao-sidebar-collapsed") === "1";
  });
  useEffect(() => {
    try { localStorage.setItem("producao-sidebar-collapsed", collapsed ? "1" : "0"); } catch { /* noop */ }
  }, [collapsed]);

  return (
    <div className="flex h-screen bg-va-bg text-va-text">
      {/* ─── SIDEBAR ────────────────────────────────────────────────── */}
      <aside
        className={`${collapsed ? "w-14" : "w-52"} shrink-0 bg-va-sidebar border-r border-va-border flex flex-col transition-[width] duration-200 relative`}
      >
        {/* Header sidebar: marca + toggle tema */}
        <div className={`${collapsed ? "p-2 justify-center" : "p-4"} border-b border-va-border flex items-center gap-2`}>
          <div className="w-8 h-8 bg-va-accent/15 border border-va-accent/40 flex items-center justify-center shrink-0">
            <span className="font-display text-va-accent text-[13px] leading-none">P</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="font-display font-medium text-[13px] leading-tight tracking-[0.16em] text-va-text">PARKET</div>
              <div className="text-[8px] uppercase tracking-[0.22em] text-va-textDim mt-1">PRODUÇÃO · PCP ARVO</div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={toggle}
              title={mode === "dark" ? "Modo claro" : "Modo escuro"}
              aria-label={mode === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
              className="shrink-0 w-6 h-6 flex items-center justify-center text-va-textDim hover:text-va-text transition opacity-60 hover:opacity-100"
            >
              {mode === "dark" ? <Sun size={11} /> : <Moon size={11} />}
            </button>
          )}
        </div>

        {/* Setinha recolher/expandir — flutuante na borda direita do sidebar */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className="absolute -right-3 top-[52px] z-30 w-6 h-6 rounded-full bg-va-panel border border-va-border text-va-textDim hover:text-va-text hover:border-va-accent flex items-center justify-center shadow transition"
        >
          {collapsed ? <PanelLeftOpen size={11} /> : <PanelLeftClose size={11} />}
        </button>

        {/* Nav items — padrão Homebroker verbatim:
            - Active: bg-va-accent/15 (Chai 15% alpha, quase invisível) + text-va-accent + border-l-2 Chai
            - Inactive: text-va-textDim + hover:bg-va-panelLight
            - border-t/r/b transparent nos dois estados pra evitar layout shift */}
        <nav className={`flex-1 ${collapsed ? "p-1.5" : "p-2"} space-y-0.5 overflow-y-auto`}>
          {NAV.map((n) => {
            const active = pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to));
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                title={collapsed ? n.label : undefined}
                className={[
                  "relative flex items-center gap-2.5 transition",
                  collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                  "text-[10px] uppercase tracking-[0.10em] font-medium font-display",
                  active
                    ? "bg-va-accent/15 text-va-accent border-l-2 border-l-va-accent border-t border-r border-b border-transparent"
                    : "text-va-textDim hover:bg-va-panelLight hover:text-va-text border-l-2 border-l-transparent border-t border-r border-b border-transparent",
                ].join(" ")}
              >
                <Icon size={collapsed ? 16 : 12} className="shrink-0 opacity-70" />
                {!collapsed && <span className="truncate">{n.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer sidebar: user info + Sair */}
        {user && (
          <div className={`${collapsed ? "p-2" : "p-4"} border-t border-va-border`}>
            {!collapsed ? (
              <>
                <div className="text-[10px] uppercase tracking-[0.16em] text-va-textDim truncate">
                  {user.nome || user.email}
                </div>
                {user.email && user.nome && (
                  <div className="text-[9px] text-va-textMuted tracking-[0.10em] mt-0.5 truncate">
                    {user.email}
                  </div>
                )}
                <button
                  onClick={() => logout()}
                  className="mt-2 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-va-textDim hover:text-va-text transition"
                >
                  <LogOut size={10} /> Sair
                </button>
              </>
            ) : (
              <button
                onClick={() => logout()}
                title="Sair"
                aria-label="Sair"
                className="w-full flex items-center justify-center text-va-textDim hover:text-va-text transition"
              >
                <LogOut size={12} />
              </button>
            )}
          </div>
        )}
      </aside>

      {/* ─── MAIN ───────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
