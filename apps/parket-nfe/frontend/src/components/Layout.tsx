import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Upload, FileText, LogOut, AlertCircle, Sun, Moon } from "lucide-react";
import { signOut, type AppUser } from "../lib/auth";

// Shell: sidebar minimalista + área principal.
// Badge Pendentes mostra contagem de NFs sem obra (calculado no App.tsx a cada 30s).
export function Layout({ appUser, pendentesCount, children }: {
  appUser: AppUser;
  pendentesCount: number;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();

  // Tema light/dark — persistido em localStorage, alterna classe .light em <html>
  // (as vars CSS de :root.light já estão no index.css, herdadas do SO Parket)
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (typeof localStorage !== "undefined" && (localStorage.getItem("parket-nfe-theme") as "dark" | "light")) || "dark",
  );
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    try { localStorage.setItem("parket-nfe-theme", theme); } catch {}
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen flex bg-hb-bg text-hb-text">
      <aside className="w-56 bg-hb-sidebar border-r border-hb-border flex flex-col shrink-0">
        <div className="h-14 border-b border-hb-border flex items-center px-4 gap-2">
          <FileText size={18} className="text-hb-accent" />
          <div className="text-sm font-display tracking-widest uppercase flex-1">Fiscal</div>
          <button onClick={toggleTheme}
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            className="w-6 h-6 flex items-center justify-center text-hb-textDim hover:text-hb-text transition opacity-60 hover:opacity-100">
            {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
          </button>
        </div>

        <nav className="flex-1 py-3">
          <NavItem to="/upload" icon={<Upload size={14} />} label="Upload" />
          <NavItem to="/notas" icon={<FileText size={14} />} label="Notas Fiscais" />
          <NavItem to="/pendentes" icon={<AlertCircle size={14} />} label="Pendentes" badge={pendentesCount} />
        </nav>

        <div className="border-t border-hb-border p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-hb-textDim">Sessão</div>
          <div className="text-xs text-hb-text truncate" title={appUser.email}>{appUser.nome || appUser.email}</div>
          <button
            onClick={handleSignOut}
            className="w-full text-[10px] uppercase tracking-wider text-hb-textDim hover:text-hb-red flex items-center gap-1.5 py-1"
          >
            <LogOut size={12} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}

function NavItem({ to, icon, label, badge }: {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-4 py-2.5 text-xs uppercase tracking-wider transition-colors border-l-2 ${
          isActive
            ? "bg-hb-panel text-hb-accent border-hb-accent"
            : "text-hb-textDim hover:text-hb-text hover:bg-hb-panel/40 border-transparent"
        }`
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] tabular bg-hb-amber/20 border border-hb-amber/40 text-hb-amber px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </NavLink>
  );
}
