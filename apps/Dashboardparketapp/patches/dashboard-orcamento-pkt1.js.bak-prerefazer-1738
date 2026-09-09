// dashboard-orcamento-pkt1.js
// Dashboard de Orçamentos — métricas, gráficos e tabela detalhada.
//
// Fontes de dados (todas Supabase, 100% reais):
//   • kanban_cards (dept_id='orcamento') — distribuição por fase, totais
//   • simulacao_projetos — cadastro de orçamentos (vendedor, orcamentista, datas)
//   • orcamento_tracking — engajamento (abriu, tempo, visualizações)
//
// É exibido em 2 lugares:
//   • Setor Orçamento como aba "📊 Dashboard"
//   • CEO Dashboard via iframe (espelhamento sem duplicar código)

import { r as RE, s as SB, j as o } from "./index-DZtetJYP.js";

const ACCENT = "#FF6B35";
const BG_PANEL = "#111";
const BG_CARD = "#1a1a1a";
const BORDER = "#2a2a2a";
const TXT = "#fafafa";
const TXT_DIM = "#a1a1aa";
const TXT_MUTED = "#71717a";

function fmtDate(s) {
  if (!s) return "";
  try { return new Date(s).toLocaleDateString("pt-BR"); } catch { return s; }
}
function fmtPct(n) {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}
function fmtTempo(seg) {
  if (!seg || !isFinite(seg)) return "—";
  if (seg < 60) return `${Math.round(seg)}s`;
  if (seg < 3600) return `${Math.round(seg / 60)}min`;
  return `${(seg / 3600).toFixed(1)}h`;
}

function MetricCard({ label, value, sub, color }) {
  return o.jsxs("div", {
    style: {
      flex: 1, minWidth: 140,
      background: BG_CARD, border: `1px solid ${BORDER}`,
      borderTop: `3px solid ${color || ACCENT}`,
      borderRadius: 6, padding: "12px 14px",
    },
    children: [
      o.jsx("div", {
        style: { fontSize: "0.55rem", color: TXT_MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 },
        children: label,
      }),
      o.jsx("div", { style: { fontSize: "1.4rem", fontWeight: 700, color: TXT }, children: value }),
      sub ? o.jsx("div", { style: { fontSize: "0.6rem", color: TXT_DIM, marginTop: 2 }, children: sub }) : null,
    ],
  });
}

function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return o.jsxs("div", {
    style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontSize: "0.65rem" },
    children: [
      o.jsx("div", { style: { width: 140, color: TXT_DIM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: label }),
      o.jsx("div", {
        style: { flex: 1, height: 14, background: "#0a0a0a", borderRadius: 2 },
        children: o.jsx("div", { style: { width: `${pct}%`, height: "100%", background: color || ACCENT, borderRadius: 2 } }),
      }),
      o.jsx("div", { style: { width: 36, textAlign: "right", color: TXT, fontWeight: 600 }, children: value }),
    ],
  });
}

function DashboardOrcamentoPage() {
  const [cards, setCards] = RE.useState([]);
  const [cols, setCols] = RE.useState([]);
  const [sims, setSims] = RE.useState([]);
  const [tracking, setTracking] = RE.useState([]);
  const [loading, setLoading] = RE.useState(true);
  const [err, setErr] = RE.useState(null);
  const [search, setSearch] = RE.useState("");
  const [page, setPage] = RE.useState(0);
  const PAGE_SIZE = 25;

  RE.useEffect(() => {
    let alive = true;
    Promise.all([
      SB.from("kanban_cards").select("*").eq("dept_id", "orcamento").limit(2000),
      SB.from("kanban_columns").select("*").eq("dept_id", "orcamento").order("position"),
      SB.from("simulacao_projetos").select("id,numero,cliente,vendedor,orcamentista,obra_code,arquiteto,desconto_perc,validade_dias,status,created_at,frete_valor,card_id"),
      SB.from("orcamento_tracking").select("simulacao_id,abriu,visualizacoes,tempo_segundos,valor_total,abriu_em,created_at"),
    ]).then(([cR, colR, sR, tR]) => {
      if (!alive) return;
      if (cR.error) { setErr(cR.error.message); setLoading(false); return; }
      setCards(cR.data || []);
      setCols(colR.data || []);
      setSims(sR.data || []);
      setTracking(tR.data || []);
      setLoading(false);
    }).catch((e) => {
      if (alive) { setErr(String(e)); setLoading(false); }
    });
    return () => { alive = false; };
  }, []);

  const colsBySlug = RE.useMemo(() => {
    const m = new Map();
    cols.forEach((c) => m.set(c.slug, c));
    return m;
  }, [cols]);

  // ── Métricas agregadas ──
  const m = RE.useMemo(() => {
    const total = cards.length;
    const aprovados = cards.filter((c) => c.column_id === "proposta-aceita").length;
    const enviadas = cards.filter((c) => c.column_id === "handoff-com" || c.column_id === "proposta-pronta").length;
    const emAnalise = cards.filter((c) => c.column_id === "analise-orc" || c.column_id === "analise-douglas").length;
    const novos = cards.filter((c) => c.column_id === "solicitacao").length;
    const taxa = total > 0 ? (aprovados / total) * 100 : 0;

    // Tempo médio de engajamento (tracking)
    const tempos = tracking.filter((t) => t.tempo_segundos > 0).map((t) => t.tempo_segundos);
    const tempoMedio = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
    const totalAbriu = tracking.filter((t) => t.abriu).length;
    const totalViews = tracking.reduce((a, t) => a + (t.visualizacoes || 0), 0);

    // Esta semana / mês
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const seteDiasAtras = new Date(now.getTime() - 7 * 86400000);
    const novosMes = sims.filter((s) => s.created_at && new Date(s.created_at) >= inicioMes).length;
    const novosSemana = sims.filter((s) => s.created_at && new Date(s.created_at) >= seteDiasAtras).length;

    return { total, aprovados, enviadas, emAnalise, novos, taxa,
             tempoMedio, totalAbriu, totalViews, novosMes, novosSemana };
  }, [cards, sims, tracking]);

  // Distribuição por fase (usa kanban_columns pra ter ordem)
  const distFases = RE.useMemo(() => {
    return cols.map((col) => ({
      col, qtd: cards.filter((c) => c.column_id === col.slug).length,
    }));
  }, [cards, cols]);

  // Top vendedores
  const topVendedores = RE.useMemo(() => {
    const m = new Map();
    for (const s of sims) {
      const v = (s.vendedor || "—").trim();
      m.set(v, (m.get(v) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [sims]);

  // Top orcamentistas
  const topOrcamentistas = RE.useMemo(() => {
    const m = new Map();
    for (const s of sims) {
      const v = (s.orcamentista || "—").trim();
      m.set(v, (m.get(v) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [sims]);

  // Por mês (últimos 12)
  const porMes = RE.useMemo(() => {
    const m = new Map();
    for (const s of sims) {
      if (!s.created_at) continue;
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      m.set(key, (m.get(key) || 0) + 1);
    }
    // Últimos 12 meses incluindo zerados
    const arr = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      arr.push({ key, qtd: m.get(key) || 0, label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }) });
    }
    return arr;
  }, [sims]);

  // Funil (criados → enviados → visualizados → aprovados)
  const funil = RE.useMemo(() => {
    const criados = m.total;
    const enviados = m.enviadas + m.aprovados;
    const visualizados = m.totalAbriu;
    const aprovados = m.aprovados;
    return [
      { label: "Criados", qtd: criados, color: "#3b82f6" },
      { label: "Enviados ao cliente", qtd: enviados, color: "#8b5cf6" },
      { label: "Cliente abriu/leu", qtd: visualizados, color: "#f59e0b" },
      { label: "Aprovados", qtd: aprovados, color: "#10b981" },
    ];
  }, [m]);

  // Tabela de orçamentos recentes
  const filteredSims = RE.useMemo(() => {
    let arr = sims.slice().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter((x) =>
        (x.cliente || "").toLowerCase().includes(s) ||
        (x.numero || "").toLowerCase().includes(s) ||
        (x.vendedor || "").toLowerCase().includes(s) ||
        (x.orcamentista || "").toLowerCase().includes(s)
      );
    }
    return arr;
  }, [sims, search]);

  const totalPages = Math.max(1, Math.ceil(filteredSims.length / PAGE_SIZE));
  const pageRows = filteredSims.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Mapa simulacao_id → tracking
  const trackBySim = RE.useMemo(() => {
    const t = new Map();
    for (const x of tracking) {
      if (x.simulacao_id) t.set(x.simulacao_id, x);
    }
    return t;
  }, [tracking]);

  if (loading) {
    return o.jsx("div", { style: { padding: 40, textAlign: "center", color: TXT_DIM }, children: "Carregando dashboard…" });
  }
  if (err) {
    return o.jsx("div", { style: { padding: 20, color: "#f87171" }, children: `Erro: ${err}` });
  }

  return o.jsxs("div", {
    style: { padding: 16, color: TXT, background: "#0a0a0a", minHeight: "100%" },
    children: [
      // Header
      o.jsxs("div", {
        style: { marginBottom: 14 },
        children: [
          o.jsx("div", { style: { fontSize: "1.1rem", fontWeight: 700, color: ACCENT }, children: "📊 Dashboard de Orçamentos" }),
          o.jsx("div", { style: { fontSize: "0.65rem", color: TXT_DIM, marginTop: 2 }, children: "Acompanhamento de propostas — geradas, enviadas, visualizadas e aprovadas. Dados em tempo real do Supabase." }),
        ],
      }),

      // KPIs principais
      o.jsxs("div", {
        style: { display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" },
        children: [
          o.jsx(MetricCard, { label: "Total de orçamentos", value: m.total, sub: `${m.novosMes} criados este mês`, color: ACCENT }),
          o.jsx(MetricCard, { label: "Aprovados", value: m.aprovados, sub: `${fmtPct(m.taxa)} de taxa`, color: "#10b981" }),
          o.jsx(MetricCard, { label: "Propostas enviadas", value: m.enviadas, sub: "Aguardando cliente", color: "#8b5cf6" }),
          o.jsx(MetricCard, { label: "Em análise/cálculo", value: m.emAnalise, sub: "Equipe trabalhando", color: "#f59e0b" }),
          o.jsx(MetricCard, { label: "Esta semana", value: m.novosSemana, sub: "novos orçamentos", color: "#06b6d4" }),
        ],
      }),

      // KPIs secundários (engajamento)
      o.jsxs("div", {
        style: { display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" },
        children: [
          o.jsx(MetricCard, { label: "Cliente abriu proposta", value: m.totalAbriu, sub: `de ${tracking.length} compartilhadas`, color: "#3b82f6" }),
          o.jsx(MetricCard, { label: "Total de visualizações", value: m.totalViews, sub: "Cliques no link", color: "#3b82f6" }),
          o.jsx(MetricCard, { label: "Tempo médio de leitura", value: fmtTempo(m.tempoMedio), sub: "engajamento do cliente", color: "#3b82f6" }),
          o.jsx(MetricCard, { label: "Aguardando início", value: m.novos, sub: "fila de solicitações", color: TXT_DIM }),
        ],
      }),

      // Funil
      o.jsxs("div", {
        style: { background: BG_PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12, marginBottom: 12 },
        children: [
          o.jsx("div", { style: { fontSize: "0.7rem", fontWeight: 700, color: ACCENT, marginBottom: 10 }, children: "🎯 Funil de Conversão" }),
          o.jsx("div", {
            style: { display: "flex", gap: 8, alignItems: "flex-end", height: 110 },
            children: funil.map((f, idx) => {
              const maxQ = Math.max(1, ...funil.map((x) => x.qtd));
              const h = Math.max(8, (f.qtd / maxQ) * 100);
              const conv = idx > 0 && funil[idx - 1].qtd > 0
                ? (f.qtd / funil[idx - 1].qtd) * 100 : 100;
              return o.jsxs("div", {
                style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
                children: [
                  o.jsx("div", { style: { fontSize: "0.75rem", color: TXT, fontWeight: 700 }, children: f.qtd }),
                  o.jsx("div", { style: { width: "100%", height: `${h}%`, background: f.color, borderRadius: 3, minHeight: 8 } }),
                  o.jsx("div", { style: { fontSize: "0.55rem", color: TXT_DIM, textAlign: "center", marginTop: 4 }, children: f.label }),
                  idx > 0 ? o.jsx("div", { style: { fontSize: "0.5rem", color: TXT_MUTED }, children: `${conv.toFixed(0)}%` }) : null,
                ],
              }, f.label);
            }),
          }),
        ],
      }),

      // Gráficos lado a lado
      o.jsxs("div", {
        style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10, marginBottom: 12 },
        children: [
          // Por fase
          o.jsxs("div", {
            style: { background: BG_PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 10 },
            children: [
              o.jsx("div", { style: { fontSize: "0.65rem", fontWeight: 700, color: ACCENT, marginBottom: 8 }, children: "📊 Por fase do Kanban" }),
              o.jsx("div", {
                children: distFases.map((d) => {
                  const maxQ = Math.max(1, ...distFases.map((x) => x.qtd));
                  return o.jsx(BarRow, { label: d.col.title, value: d.qtd, max: maxQ, color: d.col.color || ACCENT }, d.col.slug);
                }),
              }),
            ],
          }),
          // Top vendedores
          o.jsxs("div", {
            style: { background: BG_PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 10 },
            children: [
              o.jsx("div", { style: { fontSize: "0.65rem", fontWeight: 700, color: ACCENT, marginBottom: 8 }, children: "🏆 Top Vendedores" }),
              o.jsx("div", {
                children: topVendedores.map(([nome, n]) => {
                  const maxN = Math.max(1, ...topVendedores.map((x) => x[1]));
                  return o.jsx(BarRow, { label: nome, value: n, max: maxN, color: "#10b981" }, nome);
                }),
              }),
            ],
          }),
          // Top orcamentistas
          o.jsxs("div", {
            style: { background: BG_PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 10 },
            children: [
              o.jsx("div", { style: { fontSize: "0.65rem", fontWeight: 700, color: ACCENT, marginBottom: 8 }, children: "👷 Top Orçamentistas" }),
              o.jsx("div", {
                children: topOrcamentistas.length === 0
                  ? o.jsx("div", { style: { fontSize: "0.65rem", color: TXT_MUTED }, children: "Sem orçamentista atribuído" })
                  : topOrcamentistas.map(([nome, n]) => {
                      const maxN = Math.max(1, ...topOrcamentistas.map((x) => x[1]));
                      return o.jsx(BarRow, { label: nome, value: n, max: maxN, color: "#8b5cf6" }, nome);
                    }),
              }),
            ],
          }),
          // Por mês
          o.jsxs("div", {
            style: { background: BG_PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 10 },
            children: [
              o.jsx("div", { style: { fontSize: "0.65rem", fontWeight: 700, color: ACCENT, marginBottom: 8 }, children: "📅 Orçamentos por mês" }),
              o.jsx("div", {
                style: { display: "flex", alignItems: "flex-end", gap: 4, height: 100, padding: "4px 0" },
                children: porMes.map((d) => {
                  const maxN = Math.max(1, ...porMes.map((x) => x.qtd));
                  const h = (d.qtd / maxN) * 100;
                  return o.jsxs("div", {
                    style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
                    children: [
                      o.jsx("div", { style: { fontSize: "0.55rem", color: TXT, fontWeight: 600 }, children: d.qtd || "" }),
                      o.jsx("div", { style: { width: "100%", height: `${h}%`, background: ACCENT, borderRadius: 1, minHeight: 1 } }),
                      o.jsx("div", { style: { fontSize: "0.5rem", color: TXT_MUTED, textAlign: "center" }, children: d.label }),
                    ],
                  }, d.key);
                }),
              }),
            ],
          }),
        ],
      }),

      // Tabela detalhada
      o.jsxs("div", {
        style: { background: BG_PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, overflow: "hidden" },
        children: [
          o.jsxs("div", {
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, gap: 8 },
            children: [
              o.jsxs("div", { style: { fontSize: "0.65rem", fontWeight: 700, color: ACCENT }, children: [`📋 Orçamentos (${filteredSims.length})`] }),
              o.jsx("input", {
                type: "search", placeholder: "🔍 Buscar cliente / vendedor / orcamentista", value: search,
                onChange: (e) => { setSearch(e.target.value); setPage(0); },
                style: { flex: 1, maxWidth: 320, padding: "5px 8px", borderRadius: 3, background: BG_CARD, border: `1px solid ${BORDER}`, color: TXT, fontSize: "0.65rem" },
              }),
              o.jsxs("div", {
                style: { display: "flex", gap: 4, alignItems: "center" },
                children: [
                  o.jsx("button", {
                    onClick: () => setPage(Math.max(0, page - 1)),
                    style: { padding: "3px 7px", background: "transparent", color: TXT_DIM, border: `1px solid ${BORDER}`, borderRadius: 3, cursor: "pointer", fontSize: "0.6rem" },
                    children: "‹",
                  }),
                  o.jsx("span", { style: { fontSize: "0.6rem", color: TXT_DIM }, children: `Pág ${page + 1}/${totalPages}` }),
                  o.jsx("button", {
                    onClick: () => setPage(Math.min(totalPages - 1, page + 1)),
                    style: { padding: "3px 7px", background: "transparent", color: TXT_DIM, border: `1px solid ${BORDER}`, borderRadius: 3, cursor: "pointer", fontSize: "0.6rem" },
                    children: "›",
                  }),
                ],
              }),
            ],
          }),
          o.jsx("div", {
            style: { overflowX: "auto", maxHeight: 500, overflowY: "auto" },
            children: o.jsxs("table", {
              style: { width: "100%", borderCollapse: "collapse", fontSize: "0.6rem" },
              children: [
                o.jsx("thead", {
                  style: { position: "sticky", top: 0, background: BG_CARD, zIndex: 1 },
                  children: o.jsxs("tr", { children: [
                    ["Nº", "Cliente", "Obra", "Vendedor", "Orçamentista", "Desconto", "Abriu?", "Tempo lendo", "Criado"].map((h) =>
                      o.jsx("th", { style: { padding: "6px 8px", textAlign: "left", color: TXT_MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}` }, children: h }, h)
                    ),
                  ]}),
                }),
                o.jsx("tbody", {
                  children: pageRows.map((s) => {
                    const t = trackBySim.get(s.id);
                    return o.jsxs("tr", {
                      style: { borderBottom: `1px solid ${BORDER}` },
                      children: [
                        o.jsx("td", { style: { padding: "5px 8px", color: TXT_DIM }, children: s.numero || "—" }),
                        o.jsx("td", { style: { padding: "5px 8px", color: TXT, fontWeight: 600 }, children: s.cliente || "—" }),
                        o.jsx("td", { style: { padding: "5px 8px", color: TXT_DIM }, children: s.obra_code || "—" }),
                        o.jsx("td", { style: { padding: "5px 8px", color: TXT_DIM }, children: s.vendedor || "—" }),
                        o.jsx("td", { style: { padding: "5px 8px", color: TXT_DIM }, children: s.orcamentista || "—" }),
                        o.jsx("td", { style: { padding: "5px 8px", color: TXT_DIM, textAlign: "right" }, children: s.desconto_perc ? `${s.desconto_perc}%` : "—" }),
                        o.jsx("td", { style: { padding: "5px 8px", color: t && t.abriu ? "#10b981" : TXT_MUTED, textAlign: "center" }, children: t && t.abriu ? "✓" : "—" }),
                        o.jsx("td", { style: { padding: "5px 8px", color: TXT_DIM, textAlign: "right" }, children: t ? fmtTempo(t.tempo_segundos) : "—" }),
                        o.jsx("td", { style: { padding: "5px 8px", color: TXT_MUTED }, children: fmtDate(s.created_at) }),
                      ],
                    }, s.id);
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
    ],
  });
}

export { DashboardOrcamentoPage as D };
