/**
 * Análise técnica — dashboards profissionais pro gestor.
 * 4 visualizações principais:
 *   1) Funil de conversão (entradas → ganhos) com % de drop entre etapas
 *   2) Lead time médio entre etapas (quantos dias o card passa em cada coluna)
 *   3) Conversão por SDR e por Vendedor (ranking)
 *   4) Heatmap de chegada de leads (dia da semana × hora do dia)
 */
import { useMemo, useState } from "react";
import {
  BarChart3, Loader2, Activity, TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  Cell, ComposedChart, Line, Legend,
} from "recharts";
import { api, useFetch, resolveSlug, DEPT_COMERCIAL, DEPT_ENTRADA, type KanbanCard } from "../../lib/api";
import { fmtIntCompact, fmtPct, parseValueText, fmtBRLCompact } from "../../lib/format";
import { ShieldCheck } from "lucide-react";
import type { AppUser } from "../../lib/auth";

const PERIODOS = [
  { key: "7d",  label: "7 dias",  dias: 7 },
  { key: "15d", label: "15 dias", dias: 15 },
  { key: "1m",  label: "1 mês",   dias: 30 },
  { key: "3m",  label: "3 meses", dias: 90 },
  { key: "6m",  label: "6 meses", dias: 180 },
  { key: "1y",  label: "1 ano",   dias: 365 },
];

// Etapas do funil — slugs reais do kanban Parket (validados no DB).
// dept é necessário porque `contato-inicial` existe nos 2 funis (SDR + Vendedor).
const FUNIL_ORDEM: { slug: string; dept: string; label: string }[] = [
  // ── SDR (comercial-entrada) ──
  { slug: "leads-entrada",          dept: DEPT_ENTRADA,   label: "Leads de Entrada" },
  { slug: "contato-inicial",        dept: DEPT_ENTRADA,   label: "Contato Inicial (SDR)" },
  { slug: "em-qualificacao",        dept: DEPT_ENTRADA,   label: "Em Qualificação" },
  { slug: "qualificado",            dept: DEPT_ENTRADA,   label: "Qualificado" },
  // ── Vendedor (comercial) ──
  { slug: "novas-oportunidades",    dept: DEPT_COMERCIAL, label: "Novas Oportunidades" },
  { slug: "contato-inicial",        dept: DEPT_COMERCIAL, label: "Contato Inicial (V)" },
  { slug: "em-briefing",            dept: DEPT_COMERCIAL, label: "Em Briefing" },
  { slug: "criacao-orcamento",      dept: DEPT_COMERCIAL, label: "Criação de Orçamento" },
  { slug: "apresentacao-proposta",  dept: DEPT_COMERCIAL, label: "Apresentação / Proposta" },
  { slug: "em-negociacao",          dept: DEPT_COMERCIAL, label: "Em Negociação" },
  { slug: "ganho",                  dept: DEPT_COMERCIAL, label: "Ganho" },
];

export function AnalisePage({ appUser }: { appUser?: AppUser | null } = {}) {
  // Análise técnica é uma visão agregada do time todo (funil global, ranking,
  // heatmap). Só faz sentido pra quem vê todos os cards. Vendedor/SDR é bloqueado.
  if (appUser && !appUser.canSeeAll && !appUser.isGestor) {
    return (
      <div className="p-12 text-center text-hb-textDim text-sm">
        <ShieldCheck size={32} className="mx-auto mb-3 opacity-40" />
        Esta área é restrita a gestores e administradores.
      </div>
    );
  }
  return <AnalisePageContent />;
}

function AnalisePageContent() {
  const cards = useFetch(() => api.cardsWithDetails(DEPT_ENTRADA), []);
  const cards2 = useFetch(() => api.cardsWithDetails(DEPT_COMERCIAL), []);
  const cols = useFetch(() => api.columns(), []);
  const [periodoKey, setPeriodoKey] = useState<string>(() => localStorage.getItem("hb-analise-periodo") || "1m");
  const periodo = PERIODOS.find((p) => p.key === periodoKey) || PERIODOS[2];
  const setPeriodo = (k: string) => { setPeriodoKey(k); localStorage.setItem("hb-analise-periodo", k); };

  const allCards: (KanbanCard & { details: any })[] = useMemo(() => {
    return [...(cards.data || []), ...(cards2.data || [])];
  }, [cards.data, cards2.data]);

  const loading = cards.loading || cards2.loading || cols.loading;

  // Janela de período (filtra por updated_at OR created_at)
  const since = useMemo(() => new Date(Date.now() - periodo.dias * 86400000), [periodo.dias]);

  // ────────── 1. Funil de conversão ──────────
  // Snapshot atual de cards em cada etapa, filtrando por dept (slugs duplicados).
  // Largura proporcional ao MAX → visual de funil real.
  // % = relativo ao topo do funil (não vs etapa anterior — evita >100%).
  const funnel = useMemo(() => {
    const colsAll = cols.data || [];
    const counts = FUNIL_ORDEM.map((f) => {
      const n = allCards.filter((c) =>
        c.dept_id === f.dept && resolveSlug(c.column_id, colsAll) === f.slug
      ).length;
      return { ...f, count: n };
    });
    const max = Math.max(1, ...counts.map((c) => c.count));
    const topo = counts[0].count; // Leads de Entrada
    return counts.map((f, i) => ({
      ...f,
      widthPct: (f.count / max) * 100,            // visual: bar proportional to max
      vsTopo: topo > 0 ? Math.min(100, (f.count / topo) * 100) : 0,
      vsPrev: i > 0 && counts[i - 1].count > 0
        ? Math.min(100, (f.count / counts[i - 1].count) * 100)
        : null,
    }));
  }, [allCards, cols.data]);

  // ────────── 2. Lead time por etapa ──────────
  // Proxy: tempo desde created_at até updated_at do card que ESTÁ na etapa
  // (não é perfeito sem `card_movements` por etapa — mas dá uma boa noção)
  const leadTime = useMemo(() => {
    const colsAll = cols.data || [];
    return FUNIL_ORDEM.map((f) => {
      const sliceCards = allCards.filter((c) =>
        c.dept_id === f.dept && resolveSlug(c.column_id, colsAll) === f.slug
      );
      if (sliceCards.length === 0) return { label: f.label, dias: 0, qtde: 0 };
      const dias = sliceCards.reduce((s, c) => {
        const ms = new Date(c.updated_at || c.created_at || 0).getTime() - new Date(c.created_at || 0).getTime();
        return s + Math.max(0, ms / 86400000);
      }, 0) / sliceCards.length;
      return { label: f.label, dias: Math.round(dias * 10) / 10, qtde: sliceCards.length };
    }).filter((x) => x.qtde > 0);
  }, [allCards, cols.data]);

  // ────────── 3. Conversão por SDR/Vendedor (período) ──────────
  const rankSdr = useMemo(() => {
    const colsAll = cols.data || [];
    const m = new Map<string, { total: number; qualif: number }>();
    (cards.data || []).forEach((c) => {
      const r = (c.responsavel || "").trim();
      if (!r) return;
      const t = new Date(c.updated_at || c.created_at || 0);
      if (t < since) return;
      const slug = resolveSlug(c.column_id, colsAll);
      const cur = m.get(r) || { total: 0, qualif: 0 };
      cur.total += 1;
      if (slug === "qualificado" || slug === "qualificado-ia") cur.qualif += 1;
      m.set(r, cur);
    });
    return [...m.entries()]
      .map(([nome, v]) => ({ nome, ...v, conv: v.total > 0 ? (v.qualif / v.total) * 100 : 0 }))
      .filter((x) => x.total >= 3)
      .sort((a, b) => b.qualif - a.qualif)
      .slice(0, 12);
  }, [cards.data, cols.data, since]);

  const rankVend = useMemo(() => {
    const colsAll = cols.data || [];
    const m = new Map<string, { total: number; ganhos: number; valor: number }>();
    (cards2.data || []).forEach((c) => {
      const r = (c.responsavel || "").trim();
      if (!r) return;
      const t = new Date(c.updated_at || c.created_at || 0);
      if (t < since) return;
      const slug = resolveSlug(c.column_id, colsAll);
      const cur = m.get(r) || { total: 0, ganhos: 0, valor: 0 };
      cur.total += 1;
      if (slug === "ganho") {
        cur.ganhos += 1;
        cur.valor += parseValueText(c.value);
      }
      m.set(r, cur);
    });
    return [...m.entries()]
      .map(([nome, v]) => ({ nome, ...v, conv: v.total > 0 ? (v.ganhos / v.total) * 100 : 0 }))
      .filter((x) => x.total >= 3)
      .sort((a, b) => b.ganhos - a.ganhos)
      .slice(0, 12);
  }, [cards2.data, cols.data, since]);

  // ────────── 4. Heatmap de chegada (dia × hora) ──────────
  const heatmap = useMemo(() => {
    // grid 7x24
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    (cards.data || []).forEach((c) => {
      if (!c.created_at) return;
      const t = new Date(c.created_at);
      if (t < since) return;
      g[t.getDay()][t.getHours()] += 1;
    });
    return g;
  }, [cards.data, since]);

  const maxHeat = useMemo(() => heatmap.flat().reduce((m, v) => Math.max(m, v), 0), [heatmap]);
  const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  if (loading) return (
    <div className="p-12 flex items-center justify-center text-hb-textDim text-sm">
      <Loader2 size={16} className="animate-spin mr-2" /> Carregando análise…
    </div>
  );

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-sm font-bold uppercase tracking-wider text-hb-gold flex items-center gap-2">
            <BarChart3 size={14} /> Análise técnica do funil
          </div>
          <div className="text-[10px] text-hb-textDim mt-0.5">
            Conversão · lead time · ranking · heatmap — período {periodo.label.toLowerCase()}
          </div>
        </div>
        <div className="flex gap-1 bg-hb-panel border border-hb-border rounded p-0.5">
          {PERIODOS.map((p) => (
            <button key={p.key} onClick={() => setPeriodo(p.key)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold tabular transition ${
                periodoKey === p.key ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Funil — barras centralizadas, largura proporcional ao MAX (visual de funil) */}
      <Card title="Funil de conversão (snapshot atual)" icon={<TrendingUp size={11} />}>
        <div className="space-y-1">
          {funnel.map((f, i) => {
            const isLast = i === funnel.length - 1;
            const isFirst = i === 0;
            // Mínimo 6% pra mostrar label mesmo em etapas com 0
            const widthPct = Math.max(6, f.widthPct);
            return (
              <div key={`${f.dept}-${f.slug}`} className="flex items-center gap-2">
                <div className="w-44 text-[11px] text-hb-text font-medium truncate text-right pr-2">{f.label}</div>
                {/* Trilha centralizada — barra cresce do centro pros 2 lados */}
                <div className="flex-1 relative h-7 flex items-center justify-center">
                  <div className={`h-full flex items-center justify-center px-2 transition-all ${
                    isLast ? "bg-hb-green/40 border border-hb-green/60"
                    : isFirst ? "bg-hb-gold/30 border border-hb-gold/50"
                    : "bg-hb-accent/25 border border-hb-accent/40"
                  }`} style={{ width: `${widthPct}%`, minWidth: 38 }}>
                    <span className="text-[10px] font-bold tabular text-hb-text">{fmtIntCompact(f.count)}</span>
                  </div>
                </div>
                <div className="w-20 text-[10px] tabular text-right">
                  {isFirst ? (
                    <span className="text-hb-textDim uppercase tracking-wider">topo</span>
                  ) : (
                    <>
                      <span className={f.vsTopo >= 50 ? "text-hb-green" : f.vsTopo >= 15 ? "text-hb-amber" : "text-hb-red"}>
                        {fmtPct(f.vsTopo, 1)}
                      </span>
                      <span className="text-[9px] text-hb-textDim ml-1">topo</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* 2. Lead time */}
        <Card title="Tempo médio em cada etapa" icon={<Activity size={11} />} subtitle="proxy: dias entre criação e última atualização">
          <ResponsiveContainer width="100%" height={Math.max(180, leadTime.length * 28)}>
            <BarChart data={leadTime} layout="vertical" margin={{ left: 90 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--hb-border))" />
              <XAxis type="number" tick={{ fontSize: 9, fill: "rgb(var(--hb-textDim))" }} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: "rgb(var(--hb-text))" }} width={90} />
              <Tooltip contentStyle={{ background: "rgb(var(--hb-panel))", border: "1px solid rgb(var(--hb-border))", fontSize: 11, color: "rgb(var(--hb-text))" }}
                formatter={(v: any) => `${v} dias`} />
              <Bar dataKey="dias" fill="#868365" radius={[0, 0, 0, 0]} /> {/* Shadow */}
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* 4. Heatmap */}
        <Card title="Heatmap de entrada de leads" icon={<BarChart3 size={11} />} subtitle="dia da semana × hora">
          <div className="text-[9px] text-hb-textDim mb-1 flex justify-between">
            <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
          </div>
          <div className="space-y-0.5">
            {DIAS.map((d, di) => (
              <div key={d} className="flex items-center gap-1">
                <div className="w-8 text-[10px] text-hb-textDim text-right pr-1">{d}</div>
                <div className="flex-1 flex gap-px">
                  {heatmap[di].map((v, hi) => {
                    const intensity = maxHeat > 0 ? v / maxHeat : 0;
                    return (
                      <div key={hi} className="flex-1 h-4"
                        title={`${d} ${hi}h — ${v} lead(s)`}
                        style={{ background: v === 0 ? "rgb(var(--hb-border) / 0.5)" : `rgb(var(--hb-shadow) / ${0.25 + intensity * 0.75})` }} />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* 3a. Ranking SDR */}
        <Card title={`Ranking SDR · qualificados (${periodo.label})`} icon={<TrendingUp size={11} />}>
          <ResponsiveContainer width="100%" height={Math.max(180, rankSdr.length * 26)}>
            <ComposedChart data={rankSdr} layout="vertical" margin={{ left: 90 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--hb-border))" />
              <XAxis type="number" tick={{ fontSize: 9, fill: "rgb(var(--hb-textDim))" }} />
              <YAxis dataKey="nome" type="category" tick={{ fontSize: 10, fill: "rgb(var(--hb-text))" }} width={90} />
              <Tooltip contentStyle={{ background: "rgb(var(--hb-panel))", border: "1px solid rgb(var(--hb-border))", fontSize: 11, color: "rgb(var(--hb-text))" }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="qualif" fill="#455763" name="Qualificados" /> {/* Navy */}
              <Bar dataKey="total"  fill="#919C9D" name="Total cards" /> {/* Morning Blue */}
              <Line dataKey="conv"  stroke="#645D3B" name="% conversão" strokeWidth={2} /> {/* Olive */}
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {/* 3b. Ranking Vendedor */}
        <Card title={`Ranking Vendedor · ganhos (${periodo.label})`} icon={<TrendingUp size={11} />}>
          <ResponsiveContainer width="100%" height={Math.max(180, rankVend.length * 26)}>
            <ComposedChart data={rankVend} layout="vertical" margin={{ left: 90 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--hb-border))" />
              <XAxis type="number" tick={{ fontSize: 9, fill: "rgb(var(--hb-textDim))" }} />
              <YAxis dataKey="nome" type="category" tick={{ fontSize: 10, fill: "rgb(var(--hb-text))" }} width={90} />
              <Tooltip contentStyle={{ background: "rgb(var(--hb-panel))", border: "1px solid rgb(var(--hb-border))", fontSize: 11, color: "rgb(var(--hb-text))" }}
                formatter={(v: any, n: string) => n === "valor" ? fmtBRLCompact(Number(v)) : v} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="ganhos" fill="#645D3B" name="Ganhos" /> {/* Olive */}
              <Bar dataKey="total"  fill="#919C9D" name="Total cards" /> {/* Morning Blue */}
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, icon, subtitle, children }: { title: string; icon?: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-hb-panel border border-hb-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider font-bold text-hb-gold flex items-center gap-1.5">
          {icon}{title}
        </div>
        {subtitle && <div className="text-[9px] text-hb-textDim">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}
