/**
 * Home — réplica do NavonaDashboard do Sistema Operacional Parket.
 * Hero centralizado + stats grid + busca + grid de departamentos.
 * Lê contagens reais do Supabase (kanban_cards por dept).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, CheckSquare, Clock, Search, Users, ChevronRight, Star,
  Sun, Moon, LogOut,
} from "lucide-react";
import { supabase } from "../lib/supabase";
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

type DeptRow = {
  id: string;
  slug: string;
  name: string;
  fullName: string;
  team: string;
  to: string;
  highlight?: boolean;
};

const DEPARTMENTS: DeptRow[] = [
  { id: "comercial",    slug: "COMERCIAL",    name: "Comercial",    fullName: "Departamento Comercial",     team: "Funil de Entrada · Funil de Vendas", to: "/comercial",    highlight: true },
  { id: "projetos",     slug: "PROJETOS",     name: "Projetos",     fullName: "Projetos Técnicos",          team: "Medição · Projeto técnico",          to: "/projetos" },
  { id: "orcamento",    slug: "ORCAMENTO",    name: "Orçamento",    fullName: "Orçamento e Propostas",      team: "Simulador · Aprovação",              to: "/orcamento" },
  { id: "producao",     slug: "PRODUCAO",     name: "Produção",     fullName: "Beneficiamento e PCP",       team: "Linhas · Produtividade",             to: "/producao" },
  { id: "operacional",  slug: "OPERACIONAL",  name: "Operacional",  fullName: "Obras + Fiscal + PMO",       team: "Equipes em campo",                   to: "/operacional" },
  { id: "marketing",    slug: "MARKETING",    name: "Marketing",    fullName: "Performance e Conteúdo",     team: "Campanhas · Leads · Mídia",          to: "/marketing" },
  { id: "rh",           slug: "RH",           name: "RH",           fullName: "Pessoas",                    team: "Recrutamento · Folha · DP",          to: "/rh" },
  { id: "financeiro",   slug: "FINANCEIRO",   name: "Financeiro",   fullName: "Caixa e Contratos",          team: "Faturamento · DocuSign",             to: "/financeiro" },
  { id: "atendimento",  slug: "ATENDIMENTO",  name: "Atendimento",  fullName: "Sala ao Vivo",               team: "WhatsApp · TEKA IA",                 to: "/atendimento" },
  { id: "analise",      slug: "ANALISE",      name: "Análise",      fullName: "KPIs e Funil",               team: "BI · Conversão · SLA",               to: "/analise" },
  { id: "arquivos",     slug: "ARQUIVOS",     name: "Arquivos",     fullName: "Drive e Documentos",         team: "Drive Parket · Backup",              to: "/arquivos" },
  { id: "manutencao",   slug: "MANUTENCAO",   name: "Manutenção",   fullName: "Pós-venda",                  team: "Garantia · Assistência",             to: "/manutencao" },
];

const DEPT_TO_KANBAN: Record<string, string[]> = {
  comercial:    ["comercial-entrada", "comercial"],
  projetos:     ["projetos"],
  orcamento:    ["orcamento"],
  producao:     ["producao"],
  operacional:  ["obras", "fiscal", "pmo", "atendimento-obras"],
  rh:           ["rh"],
  financeiro:   ["financeiro"],
};

export default function Home({ appUser }: { appUser: AppUser }) {
  const { mode, toggle } = useTheme();
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Conta cards ativos por dept (count via PostgREST `head: true`)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const map: Record<string, number> = {};
      let grandTotal = 0;
      await Promise.all(
        Object.entries(DEPT_TO_KANBAN).map(async ([deptId, kanbans]) => {
          try {
            const r = await supabase
              .from("kanban_cards")
              .select("id", { count: "exact", head: true })
              .in("dept_id", kanbans);
            const n = r.count || 0;
            map[deptId] = n;
            grandTotal += n;
          } catch (e) { /* ignora */ }
        })
      );
      if (!alive) return;
      setCounts(map);
      setTotal(grandTotal);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return DEPARTMENTS;
    return DEPARTMENTS.filter((d) =>
      d.name.toLowerCase().includes(q) ||
      d.fullName.toLowerCase().includes(q) ||
      d.team.toLowerCase().includes(q)
    );
  }, [search]);

  const stats = [
    { label: "CARDS ATIVOS",       value: total, icon: CheckSquare },
    { label: "ALERTAS CRÍTICOS",   value: 0,     icon: AlertTriangle },
    { label: "HANDOFFS PENDENTES", value: 0,     icon: Activity },
    { label: "SLAs VENCIDOS",      value: 0,     icon: Clock },
  ];

  const firstName = (appUser.nome || appUser.email).split(/\s|@/)[0];

  return (
    <div className="min-h-screen bg-pk-bg text-pk-text">
      {/* Header fixo estilo SO Parket */}
      <div className="fixed top-0 left-0 right-0 z-10 border-b border-pk-border bg-pk-headerBg/95 backdrop-blur px-16 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="font-display text-[14px] tracking-[0.18em] uppercase font-medium">PARKET</div>
          <div className="w-px h-4 bg-pk-border" />
          <span className="text-[9px] uppercase tracking-[0.18em] text-pk-textDim">SISTEMA OPERACIONAL</span>
        </div>
        <div className="flex items-center gap-3.5">
          <button onClick={toggle}
            className="flex items-center gap-2 px-3.5 py-1.5 border border-pk-border hover:border-pk-borderHover bg-pk-panel/40 text-[9px] uppercase tracking-[0.14em] text-pk-textDim hover:text-pk-text transition">
            {mode === "dark" ? <><Sun size={10} /> MODO CLARO</> : <><Moon size={10} /> MODO ESCURO</>}
          </button>
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 border border-pk-border">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-pk-bg"
                 style={{ background: appUser.avatar_color || "rgb(var(--pk-accent))" }}>
              {firstName.charAt(0).toUpperCase()}
            </div>
            <span className="text-[9px] uppercase tracking-[0.14em] text-pk-textSecondary text-pk-text">{firstName}</span>
          </div>
          <button onClick={() => signOut()}
            className="flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-pk-textDim hover:text-pk-walnut transition">
            <LogOut size={11} /> SAIR
          </button>
        </div>
      </div>

      {/* Conteúdo (padding-top compensa header fixo) */}
      <div className="pt-16">

      {/* Hero centralizado */}
      <div className="max-w-[1200px] mx-auto px-16 py-12 text-center">
        <h1 className="font-display text-[36px] tracking-[0.10em] uppercase font-normal leading-tight">
          SISTEMA OPERACIONAL PARKET
        </h1>
        <div className="w-10 h-px bg-pk-border mx-auto my-6" />
        <p className="text-[12px] leading-[1.9] text-pk-textDim max-w-[580px] mx-auto font-light">
          Selecione o departamento para acessar o painel completo —
          Kanban, KPIs, Alertas IA, Handoffs e Painel 360° de cada obra.
        </p>
      </div>

      {/* Stats — 4 KPIs grandes */}
      <div className="max-w-[1200px] mx-auto px-16 pb-14 grid grid-cols-2 md:grid-cols-4 gap-[2px]">
        {stats.map((s) => (
          <div key={s.label} className="border border-pk-border bg-pk-panel/40 px-8 py-7 flex flex-col gap-3">
            <s.icon size={14} className="text-pk-textDim" />
            <div className={`font-display text-[32px] tabular leading-none font-normal ${s.value > 0 ? "text-pk-text" : "text-pk-border"}`}>
              {loading ? "—" : s.value}
            </div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-pk-textDim">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* CEO banner */}
      <div className="max-w-[1200px] mx-auto px-16 pb-10">
        <div className="border border-pk-borderHover bg-pk-panel/40 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Star size={16} className="text-pk-textDim" />
            <div>
              <div className="font-display text-[12px] tracking-[0.12em] uppercase mb-1.5">
                CEO DASHBOARD — DOUGLAS & PAMELA
              </div>
              <div className="text-[10px] text-pk-textDim tracking-[0.04em]">
                Visão consolidada · {total} cards · {DEPARTMENTS.length} departamentos · Alertas IA · Financeiro · Equipes em campo
              </div>
            </div>
          </div>
          <Link to="/operacional"
            className="flex items-center gap-2 px-6 py-2 border border-pk-border hover:border-pk-borderHover hover:bg-pk-panelLight text-[9px] uppercase tracking-[0.18em] text-pk-textDim hover:text-pk-text transition">
            OPERACIONAL <ChevronRight size={10} />
          </Link>
        </div>
      </div>

      {/* Busca */}
      <div className="max-w-[1200px] mx-auto px-16 pb-6">
        <div className="relative">
          <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-pk-textDim" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar departamento ou líder..."
            className="w-full py-3 pl-10 pr-4 bg-pk-panelLight border border-pk-border text-pk-text text-[12px] outline-none focus:border-pk-borderHover transition placeholder:text-pk-textDim"
          />
        </div>
      </div>

      {/* Contagem de departamentos */}
      <div className="max-w-[1200px] mx-auto px-16">
        <div className="text-[9px] uppercase tracking-[0.24em] text-pk-textDim mb-6">
          {filtered.length} {filtered.length === DEPARTMENTS.length ? "DEPARTAMENTOS" : `DE ${DEPARTMENTS.length} DEPARTAMENTOS`}
        </div>

        {/* Grid 3 cols */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2px] pb-24">
          {filtered.map((d) => {
            const cards = counts[d.id];
            return (
              <Link key={d.id} to={d.to}
                className="group block bg-pk-panel/40 border border-pk-border hover:border-pk-borderHover hover:bg-pk-panel transition p-8 min-h-[200px] flex flex-col gap-5 no-underline text-current">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.20em] text-pk-textDim mb-2.5">{d.slug}</div>
                    <div className="font-display text-[13px] uppercase tracking-[0.08em] mb-1.5">{d.name.toUpperCase()}</div>
                    <div className="text-[10px] text-pk-textDim tracking-[0.03em]">{d.team}</div>
                  </div>
                  {cards != null && cards > 0 && (
                    <span className="text-[8px] uppercase tracking-[0.12em] text-pk-textDim border border-pk-border px-2 py-1 tabular">
                      {cards} CARDS
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-[22px] h-[22px] rounded-full border border-pk-border bg-pk-panel flex items-center justify-center text-[10px] text-pk-textDim">·</div>
                  ))}
                  <span className="text-[9px] uppercase tracking-[0.06em] text-pk-textDim ml-1.5">EQUIPE</span>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-pk-border pt-4">
                  <span className="text-[9px] uppercase tracking-[0.18em] text-pk-textDim group-hover:text-pk-text transition">
                    ACESSAR KANBAN
                  </span>
                  <div className="h-px bg-pk-border group-hover:bg-pk-textDim transition-all w-[14px] group-hover:w-[28px]" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-pk-border px-16 py-5 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.14em] text-pk-textDim">
          PARKET · SISTEMA OPERACIONAL INTERNO · {new Date().getFullYear()}
        </span>
        <span className="text-[9px] uppercase tracking-[0.14em] text-pk-textDim">
          parket.com.br
        </span>
      </div>
      </div> {/* /pt-16 */}
    </div>
  );
}
