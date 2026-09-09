import { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { fonts, useTheme, useTokens } from "./theme";
import Projetos from "./pages/Projetos";
import Timeline from "./pages/Timeline";
import Projeto from "./pages/Projeto";
import ReuniaoPage from "./pages/Reuniao";
import Fiscal from "./pages/Fiscal";
import Obras from "./pages/Obras";
import Relacionamento from "./pages/Relacionamento";
import Compras from "./pages/Compras";
import Acompanhamento from "./pages/Acompanhamento";
import Equipes from "./pages/Equipes";
import Crises from "./pages/Crises";
import Tarefas from "./pages/Tarefas";
import CustosTerceiros from "./pages/CustosTerceiros";
import ObraPublica from "./pages/ObraPublica";
import AssinarLaudo from "./pages/AssinarLaudo";
import Login from "./pages/Login";
import AdminAcessos from "./pages/AdminAcessos";
import { useAuth, signOut } from "./lib/auth";

/** Menu lateral — mesma UX do Homebroker.
 *  Sidebar recolhível (persiste em localStorage). Quando recolhida mostra só
 *  ícones + tooltip. Expandida mostra ícone + label. Rota ativa marcada com
 *  border-left accent. Padrão SO Parket (Cinzel + Inter). */

type MenuItem = { to: string; label: string; icon: (p: { size: number }) => JSX.Element; sec: string };
type MenuSection = { section: string; items: MenuItem[] };

const MENU: MenuSection[] = [
  {
    section: "PROJETOS",
    items: [
      { to: "/", label: "Gestão de Obras", icon: IconKanban, sec: "projetos" },
      { to: "/timeline", label: "Timeline", icon: IconGantt, sec: "projetos" },
    ],
  },
  {
    section: "OPERAÇÕES",
    items: [
      { to: "/fiscal",  label: "Fiscal",          icon: IconClipboard, sec: "fiscal" },
      { to: "/equipes", label: "Instaladores",    icon: IconUsers, sec: "equipes" },
      { to: "/compras", label: "Compras",         icon: IconCart, sec: "compras" },
      { to: "/crises",  label: "Crises",          icon: IconAlert, sec: "projetos" },
      { to: "/tarefas", label: "Tarefas",         icon: IconTasks, sec: "projetos" },
      // Custos de Terceiros: gasto do prestador que se desloca ate a obra.
      // Mesma secao de permissao dos outros itens de obra ("projetos"): quem
      // enxerga a obra lanca; o papel de financeiro/admin o backend resolve.
      { to: "/custos",  label: "Custos de Terceiros", icon: IconCustos, sec: "projetos" },
    ],
  },
  {
    section: "ATENDIMENTO",
    items: [
      { to: "/relacionamento", label: "Relacionamento", icon: IconChat, sec: "relacionamento" },
      { to: "/acompanhamento", label: "Acompanhamento", icon: IconCamera, sec: "relacionamento" },
    ],
  },
];

const SIDEBAR_KEY = "gestao-sidebar-collapsed";

export default function App() {
  const loc = useLocation();
  const t = useTokens();
  const [mode, , toggle] = useTheme();
  const { appUser, loading: authLoading, error: authError } = useAuth();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  });
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  // Página pública do acompanhamento — sem sidebar/chrome interno e SEM login
  if (loc.pathname.startsWith("/obra/") || loc.pathname.startsWith("/assinar/")) {
    return (
      <Routes>
        <Route path="/obra/:token" element={<ObraPublica />} />
        <Route path="/assinar/:token" element={<AssinarLaudo />} />
      </Routes>
    );
  }

  // Gate de acesso — mesma estrutura HB/Valoria (login Space + user_profiles)
  if (authLoading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: t.bg, color: t.textTertiary, fontFamily: fonts.cinzel,
        fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase",
      }}>
        Verificando sessão…
      </div>
    );
  }
  if (!appUser) return <Login initialError={authError} />;

  // Gate por seção (dept_permissions.gestao_secoes — null = todas; admin = todas)
  const canSec = (sec: string) =>
    appUser.isAdmin || !appUser.secoes || appUser.secoes.includes(sec);
  const menu: MenuSection[] = MENU
    .map(s => ({ ...s, items: s.items.filter(it => canSec(it.sec)) }))
    .filter(s => s.items.length > 0);
  if (appUser.isAdmin) {
    menu.push({
      section: "ADMIN",
      items: [{ to: "/admin/acessos", label: "Acessos", icon: IconShield, sec: "admin" }],
    });
  }

  const widthCollapsed = 56;
  const widthExpanded = 220;

  return (
    <div style={{
      height: "calc(100vh / var(--pkz, 1))", display: "grid",
      gridTemplateColumns: `${collapsed ? widthCollapsed : widthExpanded}px 1fr`,
      gridTemplateRows: "1fr",
      background: t.bg, color: t.textPrimary, fontFamily: fonts.inter,
      transition: "grid-template-columns 0.22s ease, background-color 0.25s, color 0.25s",
    }}>
      {/* ─── SIDEBAR ────────────────────────────────────────────── */}
      <aside style={{
        position: "relative",
        display: "grid", gridTemplateRows: "auto 1fr auto",
        background: mode === "dark" ? "#030303" : "#CBC6BA",
        borderRight: `1px solid ${t.border1}`,
        transition: "background-color 0.25s, border-color 0.25s",
        overflow: "visible", // pra setinha flutuar fora
      }}>
        {/* Header do sidebar */}
        <Link to="/" style={{
          textDecoration: "none", color: t.textPrimary,
          padding: collapsed ? "20px 0 18px" : "20px 20px 18px",
          borderBottom: `1px solid ${t.border1}`,
          display: "flex", alignItems: "center", gap: 10,
          justifyContent: collapsed ? "center" : "flex-start",
          overflow: "hidden",
        }}>
          <div style={{
            width: 26, height: 26, flexShrink: 0,
            border: `1px solid ${t.accent}`,
            background: mode === "dark" ? "rgba(150,132,115,0.12)" : "rgba(150,132,115,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconLogo size={14} />
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.20em" }}>
                PARKET
              </div>
              <div style={{ fontSize: 8, letterSpacing: "0.22em", color: t.textTertiary, textTransform: "uppercase", marginTop: 3 }}>
                Gestor de Projetos
              </div>
            </div>
          )}
        </Link>

        {/* Setinha flutuante recolher/expandir — replica o padrão Homebroker */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          style={{
            position: "absolute", right: -12, top: 52, zIndex: 30,
            width: 24, height: 24, borderRadius: "50%",
            background: t.card1, border: `1px solid ${t.border1}`,
            color: t.textSecondary,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
            transition: "color 0.15s, border-color 0.15s, background 0.15s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = t.textPrimary;
            (e.currentTarget as HTMLButtonElement).style.borderColor = t.accent;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = t.textSecondary;
            (e.currentTarget as HTMLButtonElement).style.borderColor = t.border1;
          }}
        >
          {collapsed ? <IconPanelOpen size={11} /> : <IconPanelClose size={11} />}
        </button>

        <nav style={{ padding: collapsed ? "10px 0" : "14px 0", overflowY: "auto" }}>
          {menu.map((section) => (
            <div key={section.section} style={{ marginBottom: 18 }}>
              {!collapsed && (
                <div style={{
                  padding: "6px 20px 8px",
                  fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.24em",
                  color: t.textTertiary, textTransform: "uppercase",
                }}>
                  {section.section}
                </div>
              )}
              {section.items.map((it) => (
                <NavItem key={it.to} to={it.to}
                  active={loc.pathname === it.to || (it.to !== "/" && loc.pathname.startsWith(it.to))}
                  t={t} collapsed={collapsed}
                  icon={it.icon} label={it.label}
                />
              ))}
            </div>
          ))}
        </nav>

        <div style={{
          padding: collapsed ? "10px 8px" : "12px 16px",
          borderTop: `1px solid ${t.border1}`,
          display: "flex", alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 8,
        }}>
          {!collapsed && (
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <div style={{
                fontSize: 9, letterSpacing: "0.10em", color: t.textSecondary,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }} title={appUser.email}>
                {appUser.nome || appUser.email}
              </div>
              <div style={{ fontSize: 7, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase", marginTop: 2 }}>
                {appUser.isAdmin ? "Admin" : "Operacional"}
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <ThemeToggle mode={mode} onToggle={toggle} t={t} />
            <button
              onClick={() => { signOut(); }}
              title="Sair"
              aria-label="Sair"
              style={{
                background: "transparent", border: `1px solid ${t.border1}`,
                color: t.textSecondary, padding: "6px 8px", cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 30, height: 26, transition: "color 0.2s, border-color 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = t.textPrimary;
                (e.currentTarget as HTMLButtonElement).style.borderColor = t.border2;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = t.textSecondary;
                (e.currentTarget as HTMLButtonElement).style.borderColor = t.border1;
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN ───────────────────────────────────────────────── */}
      <main style={{ overflow: "hidden" }}>
        <Routes>
          <Route path="/" element={canSec("projetos") ? <Projetos /> : <SemAcesso t={t} />} />
          <Route path="/projetos/:id" element={canSec("projetos") ? <Projeto /> : <SemAcesso t={t} />} />
          <Route path="/timeline" element={canSec("projetos") ? <Timeline /> : <SemAcesso t={t} />} />
          <Route path="/reuniao" element={canSec("projetos") ? <ReuniaoPage /> : <SemAcesso t={t} />} />
          <Route path="/fiscal/*" element={canSec("fiscal") ? <Fiscal /> : <SemAcesso t={t} />} />
          <Route path="/obras/*"  element={canSec("projetos") ? <Obras /> : <SemAcesso t={t} />} />
          <Route path="/relacionamento" element={canSec("relacionamento") ? <Relacionamento /> : <SemAcesso t={t} />} />
          <Route path="/acompanhamento" element={canSec("relacionamento") ? <Acompanhamento /> : <SemAcesso t={t} />} />
          <Route path="/equipes" element={canSec("equipes") ? <Equipes /> : <SemAcesso t={t} />} />
          <Route path="/crises" element={canSec("projetos") ? <Crises /> : <SemAcesso t={t} />} />
          <Route path="/tarefas" element={canSec("projetos") ? <Tarefas /> : <SemAcesso t={t} />} />
          <Route path="/custos" element={canSec("projetos") ? <CustosTerceiros /> : <SemAcesso t={t} />} />
          <Route path="/compras" element={canSec("compras") ? <Compras /> : <SemAcesso t={t} />} />
          <Route path="/admin/acessos" element={appUser.isAdmin ? <AdminAcessos /> : <SemAcesso t={t} />} />
        </Routes>
      </main>
    </div>
  );
}

function NavItem({ to, active, children, t, collapsed, icon: Icon, label }: {
  to: string; active: boolean; children?: any; t: any;
  collapsed: boolean; icon: (p: { size: number }) => JSX.Element; label: string;
}) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      style={{
        display: "flex", alignItems: "center",
        gap: 10,
        padding: collapsed ? "10px 0" : "9px 20px",
        justifyContent: collapsed ? "center" : "flex-start",
        textDecoration: "none",
        fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: active ? t.textPrimary : t.textSecondary,
        background: active ? t.card1 : "transparent",
        borderLeft: active ? `2px solid ${t.accent}` : "2px solid transparent",
        transition: "color 0.15s, background-color 0.15s, border-color 0.15s",
      }}>
      <span style={{
        display: "inline-flex", flexShrink: 0,
        color: active ? t.accent : t.textTertiary,
      }}>
        <Icon size={collapsed ? 16 : 13} />
      </span>
      {!collapsed && (
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      )}
      {children}
    </Link>
  );
}

function ThemeToggle({ mode, onToggle, t }: { mode: "dark" | "light"; onToggle: () => void; t: any }) {
  return (
    <button
      onClick={onToggle}
      title={mode === "dark" ? "Modo claro" : "Modo escuro"}
      aria-label={mode === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      style={{
        background: "transparent", border: `1px solid ${t.border1}`,
        color: t.textSecondary, padding: "6px 8px", cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 26, transition: "color 0.2s, border-color 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = t.textPrimary;
        (e.currentTarget as HTMLButtonElement).style.borderColor = t.border2;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = t.textSecondary;
        (e.currentTarget as HTMLButtonElement).style.borderColor = t.border1;
      }}
    >
      {mode === "dark" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Ícones SVG inline (sem lib externa — mesmo stroke pattern do lucide)
// ═══════════════════════════════════════════════════════════════════

function IconLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: "#968473" }}>
      <path d="M4 6h16M4 12h10M4 18h6" />
    </svg>
  );
}

function IconKanban({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="10" rx="1" />
    </svg>
  );
}

function IconMic({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function IconGantt({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="13" y2="6" />
      <line x1="8" y1="12" x2="18" y2="12" />
      <line x1="6" y1="18" x2="14" y2="18" />
      <line x1="20" y1="3" x2="20" y2="21" />
    </svg>
  );
}

function IconClipboard({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

function IconCart({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 8H6" />
    </svg>
  );
}

function IconChat({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconCamera({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5l-2-3z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function IconUsers({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13A4 4 0 0 1 16 11" />
    </svg>
  );
}

function IconAlert({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconTasks({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5.5l1.5 1.5L7 4.5" />
      <path d="M3 12l1.5 1.5L7 11" />
      <path d="M3 18.5l1.5 1.5L7 17.5" />
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12.5" x2="21" y2="12.5" />
      <line x1="10" y1="19" x2="21" y2="19" />
    </svg>
  );
}

// Nota fiscal com moeda: representa a despesa do terceiro que vira ordem de pagamento.
function IconCustos({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="M14 2v5h5" />
      <line x1="12" y1="10.5" x2="12" y2="18" />
      <path d="M14 12.2a2 2 0 0 0-2-1.2c-1.1 0-2 .6-2 1.6s.9 1.4 2 1.6 2 .6 2 1.6-.9 1.6-2 1.6a2 2 0 0 1-2-1.2" />
    </svg>
  );
}

function IconShield({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function SemAcesso({ t }: { t: any }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "60vh", gap: 10, color: t.textTertiary,
    }}>
      <IconShield size={22} />
      <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.2em" }}>SEM ACESSO</div>
      <div style={{ fontFamily: fonts.inter, fontSize: 12 }}>
        Você não tem permissão para esta seção. Fale com o administrador.
      </div>
    </div>
  );
}

function IconPanelClose({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M16 15l-3-3 3-3" />
    </svg>
  );
}

function IconPanelOpen({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M13 15l3-3-3-3" />
    </svg>
  );
}
