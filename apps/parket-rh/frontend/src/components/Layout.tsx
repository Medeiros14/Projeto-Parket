import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Users, UserPlus, Sun, Receipt, GraduationCap,
  Star, UserMinus, FileText, ClipboardCheck, Building, Settings, LogOut,
  Clock, BadgeCheck, Calendar,
} from "lucide-react";
import { signOut, type AppUser } from "@/lib/auth";
import { initials } from "@/lib/format";

type Item = { kind?: undefined; to: string; label: string; icon: any; adminOnly?: boolean };
type Section = { kind: "section"; label: string };

const navItems: (Item | Section)[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { kind: "section", label: "Pessoas" },
  { to: "/colaboradores", label: "Colaboradores", icon: Users },
  { to: "/admissoes", label: "Admissões", icon: UserPlus },
  { to: "/desligamentos", label: "Desligamentos", icon: UserMinus },
  { kind: "section", label: "Operação" },
  { to: "/ferias", label: "Férias", icon: Sun },
  { to: "/calendario", label: "Calendário", icon: Calendar },
  { to: "/ponto", label: "Ponto eletrônico", icon: Clock },
  { to: "/holerites", label: "Holerites", icon: Receipt },
  { kind: "section", label: "Desenvolvimento" },
  { to: "/treinamentos", label: "Treinamentos", icon: GraduationCap },
  { to: "/avaliacoes", label: "Avaliações", icon: Star },
  { kind: "section", label: "Documentos" },
  { to: "/documentos", label: "Pasta digital", icon: FileText },
  { to: "/murais", label: "Murais", icon: FileText },
  { to: "/contratos", label: "Contratos", icon: ClipboardCheck },
  { kind: "section", label: "Sistema" },
  { to: "/empresas", label: "Empresas (CNPJs)", icon: Building, adminOnly: true },
  { to: "/usuarios", label: "Usuários", icon: BadgeCheck, adminOnly: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
];

export function Layout({ appUser }: { appUser: AppUser }) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-60 shrink-0 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <span className="text-primary text-sm font-bold">P</span>
            </div>
            <div className="leading-tight">
              <div className="text-[11px] font-bold tracking-wide">PARKET</div>
              <div className="text-[10px] text-primary font-semibold">RH</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item, i) => {
            if ("kind" in item && item.kind === "section") {
              return (
                <div key={`s-${i}`} className="px-4 pt-4 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </div>
              );
            }
            const it = item as Item;
            if (it.adminOnly && appUser.role !== "admin") return null;
            const Icon = it.icon;
            return (
              <NavLink
                key={it.to} to={it.to} end={it.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 mx-2 px-2.5 py-1.5 rounded-md text-[11px] transition ${
                    isActive
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-foreground/80 hover:bg-secondary"
                  }`
                }
              >
                <Icon size={13} />
                {it.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">
              {initials(appUser.nome || appUser.email)}
            </div>
            <div className="leading-tight min-w-0 flex-1">
              <div className="text-[11px] font-semibold truncate">{appUser.nome || appUser.email.split("@")[0]}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{appUser.role}</div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            <LogOut size={11} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
