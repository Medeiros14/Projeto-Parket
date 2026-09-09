/**
 * DeptSidebar — sidebar 210px estilo DepartamentoView do Sistema Operacional Parket.
 * Estrutura: user chip + status + AÇÕES RÁPIDAS (grid 2x2) + MEU DEPARTAMENTO
 *           + seções específicas (colapsáveis) + bottom links.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, AlertTriangle, Bell, ChevronDown, ChevronRight,
  Home, LayoutGrid, Repeat2, Settings, Users,
} from "lucide-react";
import type { AppUser } from "../lib/auth";
import type { DeptData } from "../lib/dept-data";
import { useDeptCounts } from "../lib/dept-counts";

export type QuickActionKey = "novo-lead" | "nova-proposta" | "showroom" | "follow-up";
export type DeptView =
  | "kanban" | "dashboard" | "alertas" | "handoffs"
  | "funil" | "ranking" | "agenda" | "relatorio"
  | "precos" | "catalogo" | "argumentario" | "scripts"
  | "performance" | "metas" | "treinamentos";

export function DeptSidebar({ dept, appUser, view, onView, onQuickAction }: {
  dept: DeptData;
  appUser: AppUser;
  view?: DeptView;
  onView?: (v: DeptView) => void;
  onQuickAction?: (k: QuickActionKey) => void;
}) {
  // Contagens reais com realtime
  const counts = useDeptCounts(dept.id);
  const kanbanCount  = counts.kanban   || 0;
  const alertsCount  = counts.alertas  || 0;
  const handoffsCount = counts.handoffs || 0;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(dept.sidebarSections.map((s) => [s.title, true]))
  );
  const nav = useNavigate();
  const activeView = view || "kanban";

  useEffect(() => {
    setOpenSections(Object.fromEntries(dept.sidebarSections.map((s) => [s.title, true])));
  }, [dept.id]);

  const toggleSection = (title: string) =>
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = (appUser.nome || appUser.email).split(/\s|@/)[0];
  const userInitial = firstName.charAt(0).toUpperCase();

  // Mapeia ação rápida → handler
  const qa = (k: QuickActionKey) => () => onQuickAction?.(k);

  return (
    <aside className="w-[210px] shrink-0 bg-pk-panel border-r border-pk-border flex flex-col overflow-y-auto py-3">
      {/* User chip — agora usa dados do USER logado, não do dept */}
      <div className="flex items-center gap-2.5 px-3 pb-3 border-b border-pk-border mb-3">
        <div className="w-7 h-7 rounded-full border border-pk-border bg-pk-panelLight flex items-center justify-center text-[9px] font-display text-pk-text shrink-0 uppercase font-medium"
          style={{ background: appUser.avatar_color || undefined }}>
          {userInitial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] uppercase tracking-[0.08em] text-pk-text truncate font-medium">
            {firstName.toUpperCase()}
          </div>
          <div className="text-[8px] text-pk-textDim tracking-[0.06em] truncate uppercase">
            {appUser.role || dept.userRole}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-pk-olive" />
          <Bell size={11} className="text-pk-textDim" />
        </div>
      </div>

      <div className="px-3 mb-3.5">
        <div className="text-[7px] tracking-[0.12em] text-pk-textDim leading-snug">
          Online · {greeting}, {firstName}
        </div>
      </div>

      {/* AÇÕES RÁPIDAS — todas wired */}
      {dept.quickActions.length > 0 && (
        <div className="px-2.5 mb-4">
          <SectionLabel>AÇÕES RÁPIDAS</SectionLabel>
          <div className="grid grid-cols-2 gap-[3px] mt-2">
            <QABtn onClick={qa("novo-lead")}>Novo Lead</QABtn>
            <QABtn onClick={qa("nova-proposta")}>Nova Proposta</QABtn>
            <QABtn onClick={qa("showroom")}>Showroom</QABtn>
            <QABtn onClick={qa("follow-up")}>Follow-up</QABtn>
          </div>
        </div>
      )}

      {/* MEU DEPARTAMENTO — agora navega entre views */}
      <div className="px-2.5 mb-4">
        <SectionLabel>MEU DEPARTAMENTO</SectionLabel>
        <div className="mt-1.5 space-y-px">
          <SidebarLink label="Meu Kanban" icon={<LayoutGrid size={10} />}
            active={activeView === "kanban"} onClick={() => onView?.("kanban")}
            badge={kanbanCount > 0 ? kanbanCount : undefined} />
          <SidebarLink label="Dashboard & KPIs" icon={<Activity size={10} />}
            active={activeView === "dashboard"} onClick={() => onView?.("dashboard")} />
          <SidebarLink label="Alertas" icon={<AlertTriangle size={10} />}
            active={activeView === "alertas"} onClick={() => onView?.("alertas")}
            badge={alertsCount > 0 ? alertsCount : undefined} />
          <SidebarLink label="Handoffs" icon={<Repeat2 size={10} />}
            active={activeView === "handoffs"} onClick={() => onView?.("handoffs")}
            badge={handoffsCount > 0 ? handoffsCount : undefined} />
        </div>
      </div>

      {/* Seções específicas do setor */}
      {dept.sidebarSections.map((section) => (
        <div key={section.title} className="px-2.5 mb-3.5">
          <button onClick={() => toggleSection(section.title)}
            className="w-full flex items-center justify-between px-0.5 mb-1.5 bg-transparent border-none cursor-pointer">
            <span className="text-[7px] tracking-[0.20em] text-pk-textDim uppercase">{section.title}</span>
            {openSections[section.title]
              ? <ChevronDown size={8} className="text-pk-textDim" />
              : <ChevronRight size={8} className="text-pk-textDim" />}
          </button>
          {openSections[section.title] && (
            <div className="space-y-px">
              {section.items.map((item) => (
                <SidebarLink key={item.label} label={item.label} badge={item.badge}
                  active={item.viewKey ? activeView === item.viewKey : false}
                  onClick={item.viewKey ? () => onView?.(item.viewKey as DeptView) : undefined} />
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex-1" />

      {/* Bottom */}
      <div className="border-t border-pk-border px-2.5 pt-2.5 mt-2">
        <SidebarLink label="CEO Dashboard"      icon={<Home size={10} />}     onClick={() => nav("/")} />
        <SidebarLink label="Gerenciar Usuários" icon={<Users size={10} />} />
        <SidebarLink label="Trocar Perfil"      icon={<Settings size={10} />} onClick={() => nav("/")} />
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-0.5 text-[7px] tracking-[0.20em] text-pk-textDim uppercase">
      {children}
    </div>
  );
}

function QABtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center justify-between gap-1 px-2 py-1.5 bg-pk-panelLight border border-pk-border text-pk-textDim hover:text-pk-cream hover:border-pk-accent text-[8px] tracking-[0.08em] transition truncate uppercase font-medium">
      <span className="truncate">{children}</span>
    </button>
  );
}

function SidebarLink({ label, icon, active, onClick, badge }: {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-[9px] tracking-[0.10em] uppercase font-medium transition ${
        active
          ? "bg-pk-accent/15 text-pk-cream border-l-2 border-l-pk-accent"
          : "text-pk-textDim hover:text-pk-text hover:bg-pk-panelLight border-l-2 border-l-transparent"
      }`}>
      <span className="flex items-center gap-2 min-w-0">
        {icon && <span className="opacity-70 shrink-0">{icon}</span>}
        <span className="truncate">{label}</span>
      </span>
      {badge !== undefined && badge > 0 && (
        <span className={`text-[7px] px-1 py-px leading-none shrink-0 tabular ${
          active ? "bg-pk-walnut text-pk-cream" : "bg-pk-accent text-pk-bg"
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}
