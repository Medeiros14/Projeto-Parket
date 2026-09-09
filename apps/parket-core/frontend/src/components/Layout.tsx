import { NavLink, Outlet } from "react-router-dom";
import { signOut, type AppUser } from "../lib/auth";
import { EmpresaSelector } from "./EmpresaSelector";
import { ThemeToggle } from "./ThemeToggle";
import {
  LayoutDashboard, Building2, ArrowUpFromLine, ArrowDownToLine, Landmark,
  Settings, LogOut, ChevronDown, ChevronRight, HardHat, CheckCircle2,
  Users, Building, FileSignature, Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

// v2 (task #1669): navegação Nubank minimalista — 5 rotas core + Cadastros
// colapsados. Aposentadas: DRE, Fluxo, Custo por Obra, Plano de Contas,
// Centros de Custo, Impostos, Viagens, Fretes, Relatórios, Funcionários,
// Comissões/RTs (viram abas do Pagamentos), Conciliação (some da nav, ainda
// acessível via link do Painel).

const MAIN = [
  { to: "/", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/obras", label: "Obras", icon: Building2 },
  { to: "/aprovacoes", label: "Aprovações", icon: CheckCircle2 },
  { to: "/pagamentos", label: "Pagamentos", icon: ArrowUpFromLine },
  { to: "/recebimentos", label: "Recebimentos", icon: ArrowDownToLine },
  { to: "/fretes", label: "Fretes", icon: Truck },
  { to: "/contas-bancarias", label: "Contas bancárias", icon: Landmark },
] as const;

const CADASTROS = [
  { to: "/empresas", label: "Empresas", icon: Building },
  { to: "/parceiros", label: "Clientes & Fornecedores", icon: Users },
  { to: "/contratos", label: "Contratos", icon: FileSignature },
  { to: "/prestadores", label: "Prestadores", icon: HardHat, prestadoresOnly: true },
];

export function Layout({ appUser }: { appUser: AppUser }) {
  const [cadOpen, setCadOpen] = useState(false);
  const [pending, setPending] = useState(0);

  // Badge Aprovações: pergunta o total a cada 60s + escuta o evento que a página
  // dispara logo após aprovar/rejeitar pra refletir na hora. Prestadores-only
  // não vê a rota, então nem tenta.
  useEffect(() => {
    if (appUser.prestadoresOnly) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await api.aprovacoesPendingCounts();
        if (alive) setPending(r.total);
      } catch { /* ignora — badge é enfeite */ }
    };
    load();
    const iv = setInterval(load, 60_000);
    const onReload = () => load();
    window.addEventListener("aprovacoes:reload", onReload);
    return () => { alive = false; clearInterval(iv); window.removeEventListener("aprovacoes:reload", onReload); };
  }, [appUser.prestadoresOnly]);

  return (
    <div className="flex h-screen bg-parket-bg text-parket-text">
      <aside
        className="w-[220px] shrink-0 flex flex-col border-r border-parket-border"
        style={{ background: "var(--parket-sidebar)" }}
      >
        <div className="px-5 py-5 border-b border-parket-border">
          <div className="flex items-center gap-2.5">
            <div className="w-[26px] h-[26px] shrink-0 border border-parket-accent flex items-center justify-center"
                 style={{ background: "rgba(150,132,115,0.12)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#968473" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h10M4 18h6" />
              </svg>
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-[12px]" style={{ fontFamily: '"Cinzel", Georgia, serif', letterSpacing: "0.20em" }}>PARKET</div>
              <div className="text-[8px] text-parket-textDim uppercase mt-[3px]" style={{ letterSpacing: "0.22em" }}>Core · Financeiro</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-[14px]">
          {MAIN.map((item) => {
            // Prestadores-only user vê só o módulo Prestadores
            if (appUser.prestadoresOnly) return null;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={"end" in item ? item.end : false}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-5 py-[9px] transition ` +
                  (isActive
                    ? "text-parket-text bg-parket-panel border-l-2 border-parket-accent"
                    : "text-parket-textDim hover:text-parket-text border-l-2 border-transparent")
                }
                style={{
                  fontFamily: '"Inter", -apple-system, sans-serif',
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    <Icon size={13} style={{ color: isActive ? "var(--parket-accent)" : "var(--parket-textDim)" }} />
                    <span className="truncate flex-1">{item.label}</span>
                    {item.to === "/aprovacoes" && pending > 0 && (
                      <span
                        className="ml-1 text-[9px] font-bold tabular-nums px-1.5 py-[1px] rounded-full"
                        style={{ background: "var(--parket-accent)", color: "var(--parket-bg)", letterSpacing: 0 }}
                        title={`${pending} pendente(s)`}
                      >
                        {pending > 99 ? "99+" : pending}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Cadastros — colapsável, secundário */}
          {!appUser.prestadoresOnly && (
            <>
              <button
                onClick={() => setCadOpen((v) => !v)}
                className="w-full flex items-center gap-2.5 px-5 py-[9px] text-parket-textDim hover:text-parket-text text-[10px] uppercase tracking-wider mt-4"
                style={{ fontFamily: '"Cinzel", Georgia, serif', letterSpacing: "0.24em" }}
              >
                {cadOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                Cadastros
              </button>
              {cadOpen && CADASTROS.map((it) => {
                if (it.prestadoresOnly && !appUser.prestadoresPerm) return null;
                const Icon = it.icon;
                return (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 pl-10 pr-5 py-[7px] transition text-[10px] ` +
                      (isActive ? "text-parket-accent" : "text-parket-textDim hover:text-parket-text")
                    }
                    style={{
                      fontFamily: '"Inter", -apple-system, sans-serif',
                      letterSpacing: "0.14em",
                    }}
                  >
                    <Icon size={11} />
                    <span className="truncate">{it.label}</span>
                  </NavLink>
                );
              })}
            </>
          )}

          {/* Prestadores-only: só o módulo dele */}
          {appUser.prestadoresOnly && (
            <NavLink to="/prestadores"
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-5 py-[9px] transition ` +
                (isActive
                  ? "text-parket-text bg-parket-panel border-l-2 border-parket-accent"
                  : "text-parket-textDim hover:text-parket-text border-l-2 border-transparent")
              }
              style={{
                fontFamily: '"Inter", -apple-system, sans-serif',
                fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
              }}
            >
              <HardHat size={13} />
              <span>Prestadores</span>
            </NavLink>
          )}

          {appUser.role === "admin" && (
            <NavLink to="/usuarios"
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-5 py-[9px] transition mt-4 text-[10px] uppercase tracking-wider ` +
                (isActive ? "text-parket-accent" : "text-parket-textDim hover:text-parket-text")
              }
              style={{ fontFamily: '"Inter", -apple-system, sans-serif', letterSpacing: "0.18em" }}
            >
              <Settings size={11} /> Usuários
            </NavLink>
          )}
        </nav>

        <div className="px-4 py-3 border-t border-parket-border flex items-center justify-between gap-2">
          <div className="min-w-0 overflow-hidden">
            <div className="text-[9px] text-parket-text truncate" style={{ letterSpacing: "0.10em" }} title={appUser.email}>
              {appUser.nome || appUser.email.split("@")[0]}
            </div>
            <div className="text-[7px] text-parket-textDim uppercase mt-[2px]" style={{ letterSpacing: "0.20em" }}>
              {appUser.role}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggle />
            <button
              onClick={() => signOut()}
              title="Sair" aria-label="Sair"
              className="inline-flex items-center justify-center border border-parket-border text-parket-textDim hover:text-parket-text hover:border-parket-borderHover transition bg-transparent px-0"
              style={{ width: 30, height: 26 }}
            >
              <LogOut size={12} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto flex flex-col">
        <div
          className="sticky top-0 z-20 backdrop-blur border-b border-parket-border px-8 py-2.5 flex items-center justify-between"
          style={{ background: "color-mix(in srgb, var(--parket-bg) 95%, transparent)" }}
        >
          <span className="text-[9px] uppercase text-parket-textDim" style={{ fontFamily: '"Cinzel", Georgia, serif', letterSpacing: "0.22em" }}>
            Parket Core — Gestão Financeira
          </span>
          <EmpresaSelector />
        </div>
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
