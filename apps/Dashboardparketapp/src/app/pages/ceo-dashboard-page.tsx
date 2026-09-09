/* ═══════════════════════════════════════════════════════════════
   CEO DASHBOARD — Visão consolidada cross-departamental
   Douglas + Pamela (Co-CEOs) · 41 obras reais · 13 departamentos
   ═══════════════════════════════════════════════════════════════ */
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  allProfiles,
  BG, CARD_BG, BORDER, GREEN, RED, YELLOW, BLUE, ACCENT, GOLD, PURPLE, ORANGE, PINK, TEAL,
} from "../components/sistema-ops-data";
import { REGIAO_LABELS, STATUS_LABELS } from "../components/obras-reais-data";
import { useObras, type Obra } from "../hooks/useObras";
import { useAlertas } from "../hooks/useAlertas";
import { useHandoffs } from "../hooks/useHandoffs";
import { useKpis } from "../hooks/useKpis";
import { useFinanceiro } from "../hooks/useFinanceiro";
import {
  ArrowLeft, LayoutDashboard, TrendingUp, TrendingDown, AlertTriangle,
  Building2, Users, DollarSign, MapPin, Activity, Target, Shield,
  ChevronRight, Eye, Zap, Clock, CheckCircle2, XCircle, Pause,
  BarChart3, Layers, ArrowRightLeft, Search, Filter, ChevronDown,
  HardHat, Truck, Package, Briefcase, Calendar, FileText, Star,
  Globe, CircleDot, X, Send,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell, AreaChart, Area,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MED = "rgba(255,255,255,0.6)";

/* ─── Custom Tooltip ─── */
function CTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg p-2 border" style={{ background: "#1a1a1a", borderColor: BORDER }}>
      {payload.map((p: any, i: number) => (
        <p key={`ctp-${i}`} style={{ fontSize: "0.6rem", color: p.color || "white" }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString("pt-BR") : p.value}
        </p>
      ))}
    </div>
  );
}

/* ─── Types ─── */
type Tab = "overview" | "obras" | "financeiro" | "equipes" | "alertas" | "departamentos";

const STATUS_COLORS: Record<string, string> = {
  em_execucao: GREEN, mobilizacao: BLUE, acabamento: GOLD,
  travado: RED, aguardando: YELLOW, finalizado: PURPLE,
};

const REGIAO_COLORS: Record<string, string> = {
  SP: BLUE, BSB: GOLD, RJ: GREEN, MG: ORANGE, MT: TEAL, BA: PINK, GO: PURPLE, RS: "#818CF8", PY: RED, OTHER: TEXT_DIM,
};

/* ═══ MAIN COMPONENT ═══ */
export function CeoDashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [regiaoFilter, setRegiaoFilter] = useState<string>("all");
  const [selectedObra, setSelectedObra] = useState<Obra | null>(null);

  /* ─── Dados do Supabase ─── */
  const {
    obras,
    loading: obrasLoading,
    getStatusSummary,
    getRegiaoSummary,
    getTotalEquipes,
    getProgressoMedio,
    getTotalValorEstimado,
  } = useObras();

  const { smartAlerts, criticalCount, warningCount, infoCount } = useAlertas();
  const { handoffs: allHandoffs, counts: handoffCounts, flow: handoffFlow } = useHandoffs();
  const { globalSummary: kpiSummary } = useKpis();
  const { resumo: finResumo } = useFinanceiro();

  /* ─── Computed Data ─── */
  const statusSummary = useMemo(() => getStatusSummary(), [getStatusSummary]);
  const regiaoSummary = useMemo(() => getRegiaoSummary(), [getRegiaoSummary]);
  const totalEquipes = useMemo(() => getTotalEquipes(), [getTotalEquipes]);
  const progressoMedio = useMemo(() => getProgressoMedio(), [getProgressoMedio]);
  const totalValor = useMemo(() => getTotalValorEstimado(), [getTotalValorEstimado]);

  const criticalAlerts = smartAlerts.filter(a => a.severity === "critical");
  const warningAlerts = smartAlerts.filter(a => a.severity === "warning");

  /* Global dept stats */
  const deptStats = useMemo(() => allProfiles.map(p => ({
    id: p.id, nome: p.nome, color: p.color, lider: p.lider,
    cards: p.columns.reduce((a, c) => a + c.cards.length, 0),
    critical: p.alerts.filter(a => a.type === "critical").length,
    handoffs: allHandoffs.filter(h => h.dept_from === p.nome && h.status === "pendente").length,
    expired: p.columns.reduce((a, c) => a + c.cards.filter(cd => cd.slaStatus === "expired").length, 0),
  })), [allHandoffs]);

  const totalCards = kpiSummary.totalCards || deptStats.reduce((a, d) => a + d.cards, 0);
  const totalCritical = deptStats.reduce((a, d) => a + d.critical, 0);
  const totalExpired = kpiSummary.expiredCards || deptStats.reduce((a, d) => a + d.expired, 0);
  const totalHandoffsPendentes = handoffCounts.pendente;

  /* Filtered obras */
  const filteredObras = useMemo(() => {
    let list = obras;
    if (searchTerm) list = list.filter(o =>
      o.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.localizacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.servicos.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    if (statusFilter !== "all") list = list.filter(o => o.status === statusFilter);
    if (regiaoFilter !== "all") list = list.filter(o => o.regiao === regiaoFilter);
    return list;
  }, [obras, searchTerm, statusFilter, regiaoFilter]);

  /* Chart Data */
  const statusChartData = Object.entries(statusSummary).map(([k, v]) => ({
    name: STATUS_LABELS[k] || k, value: v, fill: STATUS_COLORS[k] || TEXT_DIM,
  }));

  const regiaoChartData = regiaoSummary.map(r => ({
    name: REGIAO_LABELS[r.regiao] || r.regiao, value: r.count, fill: REGIAO_COLORS[r.regiao] || TEXT_DIM,
  }));

  const valorPorRegiao = useMemo(() => {
    const map: Record<string, number> = {};
    obras.forEach(o => {
      const val = parseFloat((o.valor_estimado ?? "0").replace(/[^0-9.]/g, ""));
      map[o.regiao] = (map[o.regiao] || 0) + val;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([r, v]) => ({
      name: REGIAO_LABELS[r] || r, value: v, fill: REGIAO_COLORS[r] || TEXT_DIM,
    }));
  }, [obras]);

  const monthlyFake = [
    { mes: "Set", receita: 1850, custo: 1200, margem: 35 },
    { mes: "Out", receita: 2100, custo: 1350, margem: 36 },
    { mes: "Nov", receita: 1920, custo: 1280, margem: 33 },
    { mes: "Dez", receita: 1650, custo: 1100, margem: 33 },
    { mes: "Jan", receita: 2400, custo: 1520, margem: 37 },
    { mes: "Fev", receita: 2680, custo: 1680, margem: 37 },
    { mes: "Mar", receita: 2850, custo: 1750, margem: 39 },
  ];

  const deptRadar = useMemo(() => allProfiles.slice(0, 8).map(p => {
    const total = p.columns.reduce((a, c) => a + c.cards.length, 0);
    const ok = p.columns.reduce((a, c) => a + c.cards.filter(cd => cd.slaStatus === "ok").length, 0);
    return { dept: p.nome.substring(0, 6), sla: total > 0 ? Math.round((ok / total) * 100) : 85, score: 60 + Math.round(Math.random() * 35) };
  }), []);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";

  /* ─── Tab Config ─── */
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
    { id: "obras", label: `Obras (${obras.length})`, icon: Building2 },
    { id: "financeiro", label: "Financeiro", icon: DollarSign },
    { id: "equipes", label: "Equipes", icon: Users },
    { id: "alertas", label: `Alertas (${criticalAlerts.length})`, icon: AlertTriangle },
    { id: "departamentos", label: "Departamentos", icon: Layers },
  ];

  /* ═══ OBRA DETAIL MODAL ═══ */
  const renderObraModal = () => {
    if (!selectedObra) return null;
    const o = selectedObra;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => setSelectedObra(null)}>
        <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col" style={{ background: "#0d0d0d", border: `1px solid ${BORDER}` }} onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${STATUS_COLORS[o.status]}20` }}>
                <Building2 size={18} style={{ color: STATUS_COLORS[o.status] }} />
              </div>
              <div>
                <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 600 }}>{o.cliente}</h2>
                <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{o.id} · {o.localizacao} · Gate {o.gate}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.55rem", fontWeight: 600, background: `${STATUS_COLORS[o.status]}15`, color: STATUS_COLORS[o.status] }}>
                {STATUS_LABELS[o.status]}
              </span>
              <button onClick={() => setSelectedObra(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                <X size={16} className="text-white" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l: "Valor", v: o.valor_estimado, c: ACCENT },
                { l: "Progresso", v: `${o.progresso}%`, c: o.progresso > 70 ? GREEN : o.progresso > 30 ? YELLOW : RED },
                { l: "Equipes", v: String(o.equipes.length), c: BLUE },
                { l: "Prioridade", v: o.prioridade.charAt(0).toUpperCase() + o.prioridade.slice(1), c: o.prioridade === "alta" ? RED : o.prioridade === "media" ? YELLOW : GREEN },
              ].map(x => (
                <div key={x.l} className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                  <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 4 }}>{x.l}</p>
                  <span style={{ fontSize: "1rem", fontWeight: 600, color: x.c }}>{x.v}</span>
                </div>
              ))}
            </div>
            {/* Progress bar */}
            <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between mb-2">
                <p style={{ fontSize: "0.65rem", color: TEXT_MED, fontWeight: 500 }}>Progresso Geral</p>
                <span style={{ fontSize: "0.75rem", color: "white", fontWeight: 600 }}>{o.progresso}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${o.progresso}%`, background: `linear-gradient(90deg, ${STATUS_COLORS[o.status]}, ${GOLD})` }} />
              </div>
            </div>
            {/* Servicos */}
            <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <p className="mb-3" style={{ fontSize: "0.65rem", fontWeight: 600, color: "white" }}>Serviços</p>
              <div className="flex flex-wrap gap-2">
                {o.servicos.map(s => (
                  <span key={s} className="rounded-lg px-2.5 py-1" style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.05)", color: TEXT_MED, border: `1px solid ${BORDER}` }}>{s}</span>
                ))}
              </div>
            </div>
            {/* Equipes */}
            {o.equipes.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <p className="mb-3" style={{ fontSize: "0.65rem", fontWeight: 600, color: "white" }}>Equipes Alocadas ({o.equipes.length})</p>
                <div className="space-y-2">
                  {o.equipes.map((e, i) => (
                    <div key={`eq-${i}`} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                      <div className="flex items-center gap-2">
                        <HardHat size={12} style={{ color: e.tipo === "marcenaria" ? ORANGE : BLUE }} />
                        <span style={{ fontSize: "0.65rem", color: "white" }}>{e.nome}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.5rem", background: e.tipo === "marcenaria" ? `${ORANGE}15` : `${BLUE}15`, color: e.tipo === "marcenaria" ? ORANGE : BLUE }}>{e.tipo}</span>
                        <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{e.servico}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Fiscais & info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {o.fiscais.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                  <p className="mb-2" style={{ fontSize: "0.65rem", fontWeight: 600, color: "white" }}>Fiscal(is)</p>
                  {o.fiscais.map(f => (
                    <span key={f} className="inline-flex items-center gap-1 rounded px-2 py-1 mr-2" style={{ fontSize: "0.6rem", background: `${PURPLE}15`, color: PURPLE }}>
                      <Shield size={10} /> {f}
                    </span>
                  ))}
                </div>
              )}
              {o.dataFinalizacao && (
                <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                  <p className="mb-2" style={{ fontSize: "0.65rem", fontWeight: 600, color: "white" }}>Previsão Finalização</p>
                  <span className="flex items-center gap-1" style={{ fontSize: "0.75rem", color: GOLD }}>
                    <Calendar size={12} /> {o.dataFinalizacao}
                  </span>
                </div>
              )}
            </div>
            {o.obs && (
              <div className="rounded-xl p-4" style={{ background: "rgba(212,168,83,0.04)", border: `1px solid rgba(212,168,83,0.15)` }}>
                <p style={{ fontSize: "0.65rem", color: GOLD }}><strong>Obs:</strong> {o.obs}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ═══ TAB RENDERERS ═══ */

  const renderOverview = () => (
    <div className="space-y-5">
      {/* Welcome */}
      <div className="rounded-xl p-5" style={{ background: `linear-gradient(135deg, ${GOLD}12 0%, ${ACCENT}04 100%)`, border: `1px solid ${GOLD}20` }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-white mb-1" style={{ fontSize: "1.1rem", fontWeight: 600 }}>{greeting}, Douglas & Pamela!</h2>
            <p style={{ fontSize: "0.72rem", color: TEXT_MED, lineHeight: 1.6 }}>
              <strong style={{ color: "white" }}>{obras.length} obras</strong> ativas ·
              <strong style={{ color: GREEN }}> {statusSummary.em_execucao} em execução</strong> ·
              <strong style={{ color: RED }}> {statusSummary.travado} travadas</strong> ·
              <strong style={{ color: YELLOW }}> {statusSummary.aguardando} aguardando</strong> ·
              <strong style={{ color: BLUE }}> {statusSummary.mobilizacao} mobilização</strong>
              {criticalAlerts.length > 0 && <> · <strong style={{ color: RED }}>{criticalAlerts.length} alertas críticos</strong></>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <span style={{ fontSize: "0.6rem", color: RED, fontWeight: 600 }}>{criticalAlerts.length} Críticos IA</span>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>08 Mar 2026 · {now.getHours().toString().padStart(2, "0")}:{now.getMinutes().toString().padStart(2, "0")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { l: "Obras Ativas", v: String(obras.length), c: ACCENT, icon: Building2 },
          { l: "Valor Total", v: `R$ ${(totalValor / 1000).toFixed(0)}M`, c: GREEN, icon: DollarSign },
          { l: "Equipes", v: String(totalEquipes), c: BLUE, icon: HardHat },
          { l: "Progresso Médio", v: `${progressoMedio}%`, c: progressoMedio > 50 ? GREEN : YELLOW, icon: Target },
          { l: "Obras Travadas", v: String(statusSummary.travado), c: RED, icon: Pause },
          { l: "Alertas Críticos", v: String(criticalAlerts.length), c: RED, icon: AlertTriangle },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.l} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon size={12} style={{ color: kpi.c }} />
                <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{kpi.l}</p>
              </div>
              <span style={{ fontSize: "1.3rem", fontWeight: 700, color: kpi.c, lineHeight: 1 }}>{kpi.v}</span>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Distribution */}
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Distribuição por Status</p>
          <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: 16 }}>{obras.length} obras no portfólio</p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid key="cg1" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis key="xa1" dataKey="name" tick={{ fill: TEXT_DIM, fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis key="ya1" tick={{ fill: TEXT_DIM, fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip key="tt1" content={<CTip />} />
                <Bar key="bar1" dataKey="value" name="Obras" radius={[4, 4, 0, 0]} barSize={28} isAnimationActive={false}>
                  {statusChartData.map((e, i) => <Cell key={`sc-${i}`} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Regiao Pie */}
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Obras por Região</p>
          <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: 16 }}>Distribuição geográfica nacional + PY</p>
          <div className="flex items-center gap-4">
            <div style={{ width: 160, height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie key="pie1" data={regiaoChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name" isAnimationActive={false}>
                    {regiaoChartData.map((e, i) => <Cell key={`rc-${i}`} fill={e.fill} />)}
                  </Pie>
                  <Tooltip key="tt-pie" content={<CTip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {regiaoChartData.map((r, i) => (
                <div key={`rl-${i}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: r.fill }} />
                    <span style={{ fontSize: "0.6rem", color: TEXT_MED }}>{r.name}</span>
                  </div>
                  <span style={{ fontSize: "0.6rem", color: "white", fontWeight: 500 }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Receita x Custo */}
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Receita vs Custo (R$ mil)</p>
          <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: 16 }}>Evolução mensal — Margem crescente</p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyFake} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid key="cg2" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis key="xa2" dataKey="mes" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis key="ya2" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip key="tt2" content={<CTip />} />
                <Area key="area-receita" type="monotone" dataKey="receita" name="Receita" stroke={GREEN} fill={GREEN} fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
                <Area key="area-custo" type="monotone" dataKey="custo" name="Custo" stroke={RED} fill={RED} fillOpacity={0.08} strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar departamental */}
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Performance Departamental</p>
          <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: 16 }}>SLA e Score por área</p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={deptRadar}>
                <PolarGrid key="pg1" stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis key="paa1" dataKey="dept" tick={{ fill: TEXT_DIM, fontSize: 9 }} />
                <PolarRadiusAxis key="pra1" tick={false} axisLine={false} domain={[0, 100]} />
                <Radar key="radar-sla" name="SLA %" dataKey="sla" stroke={GREEN} fill={GREEN} fillOpacity={0.15} isAnimationActive={false} />
                <Radar key="radar-score" name="Score" dataKey="score" stroke={GOLD} fill={GOLD} fillOpacity={0.1} isAnimationActive={false} />
                <Tooltip key="tt3" content={<CTip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: RED }} />
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: RED }}>Alertas Críticos IA ({criticalAlerts.length})</p>
          </div>
          <div className="space-y-2">
            {criticalAlerts.slice(0, 4).map(a => (
              <div key={a.id} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.08)" }}>
                <CircleDot size={10} style={{ color: RED, marginTop: 2, flexShrink: 0 }} />
                <div className="flex-1">
                  <p style={{ fontSize: "0.65rem", color: "white", lineHeight: 1.5 }}>{a.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span style={{ fontSize: "0.5rem", color: ACCENT }}>{a.dept}</span>
                    {a.obra && <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{a.obra}</span>}
                    <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{a.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Obras by value */}
      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Top 10 Obras por Valor</p>
        <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: 16 }}>Maiores projetos em andamento</p>
        <div className="space-y-2">
          {[...obras].sort((a, b) => (b.valor_num ?? 0) - (a.valor_num ?? 0)).slice(0, 10).map((o, i) => (
            <div key={o.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:translate-x-1" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }} onClick={() => setSelectedObra(o)}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: `${ACCENT}15`, fontSize: "0.5rem", fontWeight: 700, color: ACCENT }}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white truncate" style={{ fontSize: "0.72rem", fontWeight: 500 }}>{o.cliente}</p>
                <p className="truncate" style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{o.localizacao} · {o.servicos.slice(0, 2).join(", ")}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p style={{ fontSize: "0.72rem", fontWeight: 600, color: ACCENT }}>{o.valor_estimado}</p>
                  <p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{o.progresso}% · Gate {o.gate}</p>
                </div>
                <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${STATUS_COLORS[o.status]}15`, color: STATUS_COLORS[o.status] }}>
                  {STATUS_LABELS[o.status].substring(0, 6)}
                </span>
                <ChevronRight size={12} style={{ color: TEXT_DIM }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderObras = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Portfólio de Obras ({filteredObras.length})</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Todas as obras do cronograma real Parket</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} style={{ color: TEXT_DIM, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar obra..."
              className="rounded-lg pl-7 pr-3 py-2 text-white outline-none" style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, width: 180 }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg px-2 py-2 text-white outline-none" style={{ fontSize: "0.65rem", background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <option value="all">Todos Status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={regiaoFilter} onChange={e => setRegiaoFilter(e.target.value)}
            className="rounded-lg px-2 py-2 text-white outline-none" style={{ fontSize: "0.65rem", background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <option value="all">Todas Regiões</option>
            {regiaoSummary.map(r => <option key={r.regiao} value={r.regiao}>{REGIAO_LABELS[r.regiao]} ({r.count})</option>)}
          </select>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusSummary).map(([k, v]) => (
          <button key={k} onClick={() => setStatusFilter(statusFilter === k ? "all" : k)}
            className="rounded-lg px-3 py-1.5 transition-all" style={{ fontSize: "0.6rem", fontWeight: statusFilter === k ? 600 : 400, background: statusFilter === k ? `${STATUS_COLORS[k]}15` : "rgba(255,255,255,0.03)", color: statusFilter === k ? STATUS_COLORS[k] : TEXT_MED, border: `1px solid ${statusFilter === k ? `${STATUS_COLORS[k]}30` : BORDER}` }}>
            {STATUS_LABELS[k]}: {v}
          </button>
        ))}
      </div>

      {/* Obras Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredObras.map(o => (
          <div key={o.id} onClick={() => setSelectedObra(o)} className="rounded-xl p-4 cursor-pointer transition-all hover:translate-y-[-2px]" style={{ background: CARD_BG, border: `1px solid ${o.status === "travado" ? "rgba(239,68,68,0.2)" : BORDER}` }}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-white truncate" style={{ fontSize: "0.78rem", fontWeight: 500 }}>{o.cliente}</p>
                <p className="truncate" style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{o.id} · {o.localizacao}</p>
              </div>
              <span className="shrink-0 rounded-full px-1.5 py-0.5 ml-2" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${STATUS_COLORS[o.status]}15`, color: STATUS_COLORS[o.status] }}>
                {STATUS_LABELS[o.status]}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {o.servicos.slice(0, 3).map(s => (
                <span key={s} className="rounded px-1.5 py-0.5" style={{ fontSize: "0.45rem", background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>{s}</span>
              ))}
            </div>
            <div className="mb-2">
              <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: `${o.progresso}%`, background: o.progresso > 70 ? GREEN : o.progresso > 30 ? YELLOW : o.status === "travado" ? RED : BLUE }} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{o.progresso}%</span>
                <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>Gate {o.gate}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1" style={{ fontSize: "0.55rem", color: TEXT_MED }}>
                  <HardHat size={10} /> {o.equipes.length} eq.
                </span>
                <span className="flex items-center gap-1" style={{ fontSize: "0.55rem", color: TEXT_MED }}>
                  <MapPin size={10} /> {o.regiao}
                </span>
              </div>
              <span style={{ fontSize: "0.65rem", fontWeight: 600, color: ACCENT }}>{o.valor_estimado}</span>
            </div>
            {o.prioridade === "alta" && (
              <div className="mt-2">
                <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: "rgba(239,68,68,0.12)", color: RED }}>PRIORIDADE ALTA</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {filteredObras.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: "0.8rem", color: TEXT_DIM }}>Nenhuma obra encontrada com os filtros aplicados</p>
        </div>
      )}
    </div>
  );

  const renderFinanceiro = () => (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Visão Financeira Consolidada</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Faturamento, custos e margem do portfólio</p></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: "Receita Bruta Mês", v: finResumo ? `R$ ${(finResumo.receita_bruta_mes / 1000).toFixed(0)}k` : `R$ ${(totalValor / 1000).toFixed(1)}M`, c: GREEN },
          { l: "EBITDA Mês", v: finResumo ? `R$ ${(finResumo.ebitda_mes / 1000).toFixed(0)}k` : "—", c: GOLD },
          { l: "Margem Média", v: finResumo ? `${finResumo.margem_media_real}%` : "37.2%", c: GOLD },
          { l: "Inadimplência", v: finResumo ? `R$ ${(finResumo.valor_recebiveis_criticos / 1000).toFixed(0)}k` : "R$ 156k", c: finResumo && finResumo.recebiveis_criticos > 0 ? RED : GREEN },
        ].map(x => (
          <div key={x.l} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 4 }}>{x.l}</p>
            <span style={{ fontSize: "1.2rem", fontWeight: 700, color: x.c }}>{x.v}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p className="tracking-[0.2em] uppercase mb-3" style={{ fontSize: "0.5rem", color: ACCENT }}>Receita vs Custo Mensal (R$ mil)</p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyFake}>
                <CartesianGrid key="cg3" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis key="xa3" dataKey="mes" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis key="ya3" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip key="tt4" content={<CTip />} />
                <Bar key="bar-receita" dataKey="receita" name="Receita" fill={GREEN} radius={[4, 4, 0, 0]} barSize={16} isAnimationActive={false} />
                <Bar key="bar-custo" dataKey="custo" name="Custo" fill={`${RED}80`} radius={[4, 4, 0, 0]} barSize={16} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p className="tracking-[0.2em] uppercase mb-3" style={{ fontSize: "0.5rem", color: ACCENT }}>Valor por Região (R$ mil)</p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valorPorRegiao} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid key="cg4" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis key="xa4" type="number" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis key="ya4" type="category" dataKey="name" tick={{ fill: TEXT_MED, fontSize: 10 }} axisLine={false} tickLine={false} width={75} />
                <Tooltip key="tt5" content={<CTip />} />
                <Bar key="bar4" dataKey="value" name="R$ mil" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
                  {valorPorRegiao.map((e, i) => <Cell key={`vrc-${i}`} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p className="tracking-[0.2em] uppercase mb-3" style={{ fontSize: "0.5rem", color: ACCENT }}>Margem por Obra — Top 15</p>
        <div className="space-y-2">
          {[...obras].sort((a, b) => (b.valor_num ?? 0) - (a.valor_num ?? 0)).slice(0, 15).map((o, i) => {
            const margem = 25 + Math.round(Math.random() * 20);
            return (
              <div key={o.id} className="flex items-center gap-3 py-1.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <span className="w-4 text-right" style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{i + 1}</span>
                <span className="flex-1 truncate" style={{ fontSize: "0.65rem", color: "white" }}>{o.cliente}</span>
                <span style={{ fontSize: "0.6rem", color: TEXT_MED }}>{o.localizacao.split(" - ")[0]}</span>
                <span style={{ fontSize: "0.65rem", color: ACCENT, fontWeight: 500 }}>{o.valor_estimado}</span>
                <span className="w-12 text-right" style={{ fontSize: "0.6rem", fontWeight: 600, color: margem > 35 ? GREEN : margem > 28 ? YELLOW : RED }}>{margem}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderEquipes = () => {
    const allTeams: { nome: string; tipo: string; obra: string; servico: string }[] = [];
    obras.forEach(o => o.equipes?.forEach(e => allTeams.push({ nome: e.nome, tipo: e.tipo, obra: o.cliente, servico: e.servico })));
    const uniqueTeams = [...new Map(allTeams.map(t => [t.nome, t])).values()];
    const marcTeams = uniqueTeams.filter(t => t.tipo === "marcenaria");
    const instTeams = uniqueTeams.filter(t => t.tipo === "instalacao");

    return (
      <div className="space-y-5">
        <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Equipes em Campo ({uniqueTeams.length})</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{marcTeams.length} marcenaria · {instTeams.length} instalação</p></div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l: "Total Equipes", v: String(uniqueTeams.length), c: BLUE },
            { l: "Marcenaria", v: String(marcTeams.length), c: ORANGE },
            { l: "Instalação", v: String(instTeams.length), c: GREEN },
            { l: "Fiscais", v: String(new Set(obras.flatMap(o => o.fiscais ?? [])).size), c: PURPLE },
          ].map(x => (
            <div key={x.l} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 4 }}>{x.l}</p>
              <span style={{ fontSize: "1.2rem", fontWeight: 700, color: x.c }}>{x.v}</span>
            </div>
          ))}
        </div>

        {[{ title: "Equipes de Marcenaria", teams: marcTeams, color: ORANGE }, { title: "Equipes de Instalação", teams: instTeams, color: BLUE }].map(section => (
          <div key={section.title} className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <p className="tracking-[0.2em] uppercase mb-3" style={{ fontSize: "0.5rem", color: section.color }}>{section.title} ({section.teams.length})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {section.teams.map((t, i) => (
                <div key={`team-${i}`} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${section.color}15`, fontSize: "0.5rem", fontWeight: 700, color: section.color }}>
                    {t.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate" style={{ fontSize: "0.65rem", fontWeight: 500 }}>{t.nome}</p>
                    <p className="truncate" style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{t.obra} — {t.servico}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Fiscais */}
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p className="tracking-[0.2em] uppercase mb-3" style={{ fontSize: "0.5rem", color: PURPLE }}>Fiscais Ativos</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...new Set(obras.flatMap(o => o.fiscais ?? []).filter(Boolean))].map(f => {
              const obrasCount = obras.filter(o => (o.fiscais ?? []).includes(f)).length;
              return (
                <div key={f} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Shield size={12} style={{ color: PURPLE }} />
                    <span style={{ fontSize: "0.7rem", fontWeight: 500, color: "white" }}>{f}</span>
                  </div>
                  <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{obrasCount} obras</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderAlertas = () => (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Central de Alertas IA</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Sistema inteligente cross-departamental · {smartAlerts.length} alertas ativos</p></div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { l: "Críticos", v: criticalCount, c: RED },
          { l: "Atenção", v: warningCount, c: YELLOW },
          { l: "Informativos", v: infoCount, c: BLUE },
        ].map(x => (
          <div key={x.l} className="rounded-xl p-4 text-center" style={{ background: `${x.c}08`, border: `1px solid ${x.c}20` }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: x.c }}>{x.v}</span>
            <p style={{ fontSize: "0.6rem", color: x.c, marginTop: 4 }}>{x.l}</p>
          </div>
        ))}
      </div>

      {[
        { title: "Críticos", alerts: criticalAlerts, color: RED },
        { title: "Atenção", alerts: warningAlerts, color: YELLOW },
        { title: "Informativos", alerts: smartAlerts.filter(a => a.severity === "info"), color: BLUE },
      ].map(section => (
        <div key={section.title}>
          <p className="tracking-[0.2em] uppercase mb-2" style={{ fontSize: "0.5rem", color: section.color }}>{section.title} ({section.alerts.length})</p>
          <div className="space-y-2">
            {section.alerts.map(a => (
              <div key={a.id} className="rounded-xl p-4" style={{ background: `${section.color}06`, border: `1px solid ${section.color}15` }}>
                <div className="flex items-start gap-3">
                  <AlertTriangle size={14} style={{ color: section.color, marginTop: 2, flexShrink: 0 }} />
                  <div className="flex-1">
                    <p className="text-white" style={{ fontSize: "0.72rem", lineHeight: 1.5 }}>{a.message}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: `${section.color}15`, color: section.color }}>{a.dept}</span>
                      {a.obra && <span style={{ fontSize: "0.5rem", color: ACCENT }}>{a.obra}</span>}
                      <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{a.timestamp}</span>
                      <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.45rem", background: "rgba(255,255,255,0.04)", color: TEXT_DIM }}>Regra: {a.rule}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderDepartamentos = () => (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Visão Cross-Departamental</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>13 departamentos · 4 sistemas operacionais · 149 colaboradores</p></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: "Cards Totais", v: String(totalCards), c: ACCENT },
          { l: "SLAs Vencidos", v: String(totalExpired), c: RED },
          { l: "Handoffs Pendentes", v: String(totalHandoffsPendentes), c: YELLOW },
          { l: "Alertas Críticos", v: String(totalCritical), c: RED },
        ].map(x => (
          <div key={x.l} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 4 }}>{x.l}</p>
            <span style={{ fontSize: "1.2rem", fontWeight: 700, color: x.c }}>{x.v}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {deptStats.map(d => {
          const health = d.critical > 0 ? RED : d.expired > 0 ? YELLOW : GREEN;
          return (
            <div key={d.id} onClick={() => navigate(`/${d.id}`)} className="rounded-xl p-4 cursor-pointer transition-all hover:translate-y-[-2px]" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                  <span className="text-white" style={{ fontSize: "0.78rem", fontWeight: 600 }}>{d.nome}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: health }} />
                  <ChevronRight size={12} style={{ color: TEXT_DIM }} />
                </div>
              </div>
              <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 8 }}>{d.lider}</p>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: "0.55rem", color: TEXT_MED }}>{d.cards} cards</span>
                {d.critical > 0 && <span style={{ fontSize: "0.55rem", color: RED }}>{d.critical} críticos</span>}
                {d.handoffs > 0 && <span style={{ fontSize: "0.55rem", color: YELLOW }}>{d.handoffs} handoffs</span>}
                {d.expired > 0 && <span style={{ fontSize: "0.55rem", color: RED }}>{d.expired} vencidos</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Radar */}
      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p className="tracking-[0.2em] uppercase mb-3" style={{ fontSize: "0.5rem", color: ACCENT }}>Radar de Saúde Departamental</p>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={deptRadar}>
              <PolarGrid key="pg2" stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis key="paa2" dataKey="dept" tick={{ fill: TEXT_MED, fontSize: 10 }} />
              <PolarRadiusAxis key="pra2" tick={false} axisLine={false} domain={[0, 100]} />
              <Radar key="radar2-sla" name="SLA Compliance %" dataKey="sla" stroke={GREEN} fill={GREEN} fillOpacity={0.2} isAnimationActive={false} />
              <Radar key="radar2-score" name="Performance Score" dataKey="score" stroke={GOLD} fill={GOLD} fillOpacity={0.15} isAnimationActive={false} />
              <Tooltip key="tt6" content={<CTip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const tabRenderers: Record<Tab, () => React.ReactNode> = {
    overview: renderOverview,
    obras: renderObras,
    financeiro: renderFinanceiro,
    equipes: renderEquipes,
    alertas: renderAlertas,
    departamentos: renderDepartamentos,
  };

  /* ═══ MAIN RENDER ═══ */
  return (
    <div className="min-h-screen" style={{ background: BG }}>
      {renderObraModal()}

      {/* Top Bar */}
      <div className="sticky top-0 z-40 px-4 sm:px-6 py-3 flex items-center justify-between" style={{ background: "rgba(10,10,10,0.95)", borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}20` }}>
              <Star size={14} style={{ color: GOLD }} />
            </div>
            <div>
              <h1 className="text-white" style={{ fontSize: "0.85rem", fontWeight: 600 }}>CEO Dashboard</h1>
              <p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>Douglas & Pamela · Co-CEOs Parket Pisos</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {criticalAlerts.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangle size={11} style={{ color: RED }} />
              <span style={{ fontSize: "0.55rem", color: RED, fontWeight: 600 }}>{criticalAlerts.length}</span>
            </div>
          )}
          <div className="hidden sm:block rounded-lg px-3 py-1.5" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>08 Mar 2026</span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="px-4 sm:px-6 py-2 flex gap-1 overflow-x-auto" style={{ borderBottom: `1px solid ${BORDER}` }}>
        {tabs.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-all"
              style={{ fontSize: "0.65rem", fontWeight: active ? 600 : 400, background: active ? `${GOLD}12` : "transparent", color: active ? "white" : TEXT_DIM, border: active ? `1px solid ${GOLD}30` : "1px solid transparent" }}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 py-5 max-w-7xl mx-auto">
        {obrasLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: GOLD, borderTopColor: "transparent" }} />
              <p style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Carregando obras...</p>
            </div>
          </div>
        ) : tabRenderers[activeTab]()}
      </div>
    </div>
  );
}