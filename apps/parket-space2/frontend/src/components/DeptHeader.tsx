/**
 * DeptHeader — barra de topo padrão das páginas de setor, mirror do
 * DepartamentoView do Sistema Operacional Parket.
 * Layout: [back] [PARKET] › [DEPT NAME] · [breadcrumb] ... [theme] [bell] [user] [sair]
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Sun, Moon, Bell, LogOut } from "lucide-react";
import { signOut, type AppUser } from "../lib/auth";

function useTheme() {
  const [mode, setMode] = useState<"dark" | "light">(() =>
    (localStorage.getItem("pk-theme") as "dark" | "light") || "dark"
  );
  useEffect(() => {
    document.documentElement.classList.toggle("light", mode === "light");
    try { localStorage.setItem("pk-theme", mode); } catch {}
  }, [mode]);
  return { mode, toggle: () => setMode((m) => m === "dark" ? "light" : "dark") };
}

export function DeptHeader({ deptName, breadcrumb, appUser }: {
  deptName: string;
  breadcrumb?: string;
  appUser: AppUser;
}) {
  const { mode, toggle } = useTheme();
  const nav = useNavigate();
  const firstName = (appUser.nome || appUser.email).split(/\s|@/)[0];

  return (
    <header className="h-[52px] border-b border-pk-border bg-pk-headerBg/95 backdrop-blur px-6 flex items-center justify-between shrink-0">
      {/* Esquerda: back + brand + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={() => nav("/")}
          className="p-1 text-pk-textDim hover:text-pk-text transition"
          title="Voltar pro Dashboard">
          <ArrowLeft size={14} />
        </button>
        <div className="w-px h-4 bg-pk-border" />
        <Link to="/" className="font-display text-[11px] tracking-[0.16em] uppercase font-medium text-pk-text no-underline">
          PARKET
        </Link>
        <ChevronRight size={11} className="text-pk-textDim shrink-0" />
        <span className="text-[9px] uppercase tracking-[0.16em] text-pk-textSecondary text-pk-text truncate">
          {deptName}
        </span>
        {breadcrumb && (
          <>
            <div className="w-px h-4 bg-pk-border" />
            <span className="text-[9px] uppercase tracking-[0.08em] text-pk-textDim truncate">
              {breadcrumb}
            </span>
          </>
        )}
      </div>

      {/* Direita: theme + bell + user + sair */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button onClick={toggle}
          className="flex items-center gap-1.5 px-3 py-1 border border-pk-border hover:border-pk-borderHover bg-pk-panel/40 text-[9px] uppercase tracking-[0.12em] text-pk-textDim hover:text-pk-text transition">
          {mode === "dark" ? <><Sun size={10} /> CLARO</> : <><Moon size={10} /> ESCURO</>}
        </button>
        <button className="p-2 text-pk-textDim hover:text-pk-text transition" title="Notificações">
          <Bell size={13} />
        </button>
        <div className="flex items-center gap-2 px-2.5 py-1 border border-pk-border">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-pk-bg"
               style={{ background: appUser.avatar_color || "rgb(var(--pk-accent))" }}>
            {firstName.charAt(0).toUpperCase()}
          </div>
          <span className="text-[9px] uppercase tracking-[0.12em] text-pk-text">{firstName}</span>
        </div>
        <button onClick={() => signOut()} title="Sair"
          className="p-2 text-pk-textDim hover:text-pk-walnut transition">
          <LogOut size={13} />
        </button>
      </div>
    </header>
  );
}
