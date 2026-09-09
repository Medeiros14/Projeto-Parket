/* ═══ COMERCIAL — Visao completa do time Comercial (BDR, SDR, Closers) ═══ */
import React, { useState, useEffect, useCallback } from "react";
import {
  DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem,
  CTip, TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT,
  BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD, TEAL, PINK,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  LineChart, Line, PieChart, Pie, Area, AreaChart,
  Target, Users, Calendar, DollarSign, BarChart3, Briefcase,
} from "../components/dept-layout";
import { Phone, Globe, UserPlus, Eye, Percent, MapPin, Star, Filter, Award, TrendingUp, X, MessageCircle, Search, Plus, FileBarChart, Clock, Mic } from "lucide-react";
import { useCRM } from "../hooks/useCRM";
import { supabase, createAdminClient } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { RelatorioTekaTab, RelatorioFunilTab, HistoricoCardTab, GravacoesWavoipTab } from "../components/tab-stubs";

/* ═══ Admin check — usuarios autorizados para gestao completa ═══ */
const COMERCIAL_ADMINS = [
  "administrador", "douglas", "douglas2", "douglas oliveira",
  "raphael camargo", "raphael camargo lima da silva",
  "pamella", "pamela", "pamela oliveira",
];

function isComercialAdmin(user: any): boolean {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  const fullName = (user.full_name ?? "").toLowerCase().trim();
  const email = (user.email ?? "").toLowerCase().trim();
  if (!fullName && !email) return false;
  return COMERCIAL_ADMINS.some(name =>
    !name ? false : (fullName === name || fullName.startsWith(name + " ") || email.split("@")[0] === name)
  );
}

/* ═══ Dados especificos ═══ */
const FUNNEL_DATA = [
  { name: "Novas Oportunidades", value: 47, fill: "#9CA3AF" },
  { name: "Contato Inicial", value: 35, fill: BLUE },
  { name: "Criacao de Orcamento", value: 20, fill: PURPLE },
  { name: "Apresentacao Proposta", value: 12, fill: ORANGE },
  { name: "Em Negociacao", value: 6, fill: YELLOW },
  { name: "Ganho", value: 4, fill: GREEN },
];

const CONVERSION_MONTHLY = [
  { mes: "Set", taxa: 22, leads: 38 }, { mes: "Out", taxa: 28, leads: 42 },
  { mes: "Nov", taxa: 31, leads: 45 }, { mes: "Dez", taxa: 25, leads: 35 },
  { mes: "Jan", taxa: 30, leads: 48 }, { mes: "Fev", taxa: 34, leads: 47 },
];

const LEAD_SOURCE = [
  { name: "Indicacao", value: 38, fill: GREEN },
  { name: "Google Ads", value: 25, fill: BLUE },
  { name: "Instagram", value: 18, fill: PINK },
  { name: "Showroom", value: 12, fill: ORANGE },
  { name: "Outros", value: 7, fill: PURPLE },
];

const PIPELINE_VALUE = [
  { stage: "Contato Inicial", value: 275, deals: 2 },
  { stage: "Criacao Orcamento", value: 570, deals: 2 },
  { stage: "Apres. Proposta", value: 185, deals: 1 },
  { stage: "Em Negociacao", value: 142, deals: 1 },
  { stage: "Ganho", value: 320, deals: 1 },
];

const CLOSER_RANKING = [
  { nome: "Rafael", propostas: 5, fechados: 2, valor: "R$ 505k", taxa: "40%", star: true },
  { nome: "Marina", propostas: 4, fechados: 1, valor: "R$ 250k", taxa: "25%", star: false },
  { nome: "Ana (BDR)", propostas: 0, fechados: 0, valor: "-", taxa: "-", star: false },
  { nome: "Carlos (BDR)", propostas: 0, fechados: 0, valor: "-", taxa: "-", star: false },
];

const SHOWROOM_AGENDA = [
  { dia: "Seg 10/03", hora: "10:00", cliente: "Arq. Patricia Gomes", status: "confirmado" },
  { dia: "Ter 11/03", hora: "14:00", cliente: "Eng. Roberto Campos", status: "pendente" },
  { dia: "Qua 12/03", hora: "11:00", cliente: "Studio Debora Aguiar", status: "confirmado" },
  { dia: "Qui 13/03", hora: "15:00", cliente: "Res. Alphaville", status: "pendente" },
  { dia: "Sex 14/03", hora: "09:30", cliente: "Corp. Berrini", status: "confirmado" },
];

/* ═══ SDR KPI Dashboard ═══ */
const SDR_NAMES = ["Matheus Lopes", "Vinicius Arruda"];
const KPI_THRESHOLDS = [
  { id: "ligacoes", label: "Contatos/dia", unit: "", min: 100, bom: 200, exc: 300 },
  { id: "qualificacoes", label: "Qualificações/dia", unit: "", min: 10, bom: 15, exc: 20 },
  { id: "taxa_resposta", label: "Taxa de resposta", unit: "%", min: 15, bom: 25, exc: 40 },
  { id: "leads_vendedor", label: "Leads → vendedor/dia", unit: "", min: 5, bom: 10, exc: 15 },
  { id: "sla_contato", label: "SLA 1º contato", unit: "min", min: 120, bom: 60, exc: 30, invert: true },
  { id: "conversao", label: "Conversão qualif→vend", unit: "%", min: 30, bom: 50, exc: 70 },
];

function kpiColor(value: number, kpi: typeof KPI_THRESHOLDS[0]): string {
  if (kpi.invert) {
    if (value <= kpi.exc) return GOLD;
    if (value <= kpi.bom) return GREEN;
    if (value <= kpi.min) return YELLOW;
    return RED;
  }
  if (value >= kpi.exc) return GOLD;
  if (value >= kpi.bom) return GREEN;
  if (value >= kpi.min) return YELLOW;
  return RED;
}

function kpiLabel(value: number, kpi: typeof KPI_THRESHOLDS[0]): string {
  if (kpi.invert) {
    if (value <= kpi.exc) return "Excelente";
    if (value <= kpi.bom) return "Bom";
    if (value <= kpi.min) return "Mínimo";
    return "Abaixo";
  }
  if (value >= kpi.exc) return "Excelente";
  if (value >= kpi.bom) return "Bom";
  if (value >= kpi.min) return "Mínimo";
  return "Abaixo";
}

function SDRKpiDashboard() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"hoje" | "semana" | "mes">("semana");
  const [selectedSDR, setSelectedSDR] = useState<string>("");
  const [dailyData, setDailyData] = useState<any[]>([]);

  // Fetch cards do funil de entrada
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("kanban_cards")
        .select("id, column_id, responsavel, details, created_at, updated_at")
        .eq("dept_id", "comercial-entrada");
      setCards(data ?? []);
      setLoading(false);
    })();
    // Realtime
    const ch = supabase.channel("sdr_kpis").on("postgres_changes",
      { event: "*", schema: "public", table: "kanban_cards", filter: "dept_id=eq.comercial-entrada" },
      () => {
        supabase.from("kanban_cards")
          .select("id, column_id, responsavel, details, created_at, updated_at")
          .eq("dept_id", "comercial-entrada")
          .then(({ data }) => setCards(data ?? []));
      }
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Calcular KPIs quando cards ou filtros mudam
  useEffect(() => {
    if (cards.length === 0) return;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const periodStart = period === "hoje" ? startOfDay : period === "semana" ? startOfWeek : startOfMonth;

    // Filtrar por SDR e período
    const filtered = cards.filter(c => {
      const det = c.details ?? {};
      const sdr = det.sdr || c.responsavel || "";
      if (selectedSDR && sdr !== selectedSDR) return false;
      return true;
    });

    // Agrupar por dia
    const days: Record<string, { contatos: Set<string>; qualifs: number; respostas: number; totalContatos: number; vendedor: number; slaMinutos: number[]; qualifTotal: number; vendedorTotal: number }> = {};

    const getDayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

    // Preencher dias do período
    const cursor = new Date(periodStart);
    while (cursor <= now) {
      days[getDayKey(cursor)] = { contatos: new Set(), qualifs: 0, respostas: 0, totalContatos: 0, vendedor: 0, slaMinutos: [], qualifTotal: 0, vendedorTotal: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const card of filtered) {
      const det = card.details ?? {};
      const msgs: any[] = det.mensagens_ia ?? [];
      const createdAt = new Date(card.created_at);
      const updatedAt = new Date(card.updated_at);
      const dayKey = getDayKey(updatedAt);

      if (!days[dayKey]) continue;

      // Contatos (leads únicos tocados)
      if (card.column_id !== "leads-entrada") {
        days[dayKey].contatos.add(card.id);
      }

      // Qualificações
      if (["qualificado", "qualificado-ia"].includes(card.column_id)) {
        days[dayKey].qualifs++;
        days[dayKey].qualifTotal++;
      }

      // Leads movidos pra vendedor
      if (card.column_id === "vendedor") {
        days[dayKey].vendedor++;
        days[dayKey].vendedorTotal++;
      }

      // Taxa de resposta (msgs com de="cliente" após de="teka")
      const tekaEnviou = msgs.some((m: any) => m.de === "teka");
      const clienteRespondeu = msgs.filter((m: any) => m.de === "cliente").length > 1;
      if (tekaEnviou) {
        days[dayKey].totalContatos++;
        if (clienteRespondeu) days[dayKey].respostas++;
      }

      // SLA primeiro contato
      if (msgs.length > 0) {
        const firstTeka = msgs.find((m: any) => m.de === "teka");
        if (firstTeka?.ts) {
          const tekaTime = new Date(firstTeka.ts);
          const diffMin = (tekaTime.getTime() - createdAt.getTime()) / 60000;
          if (diffMin > 0 && diffMin < 1440) {
            days[dayKey].slaMinutos.push(diffMin);
          }
        }
      }
    }

    // Calcular dados diários pra gráfico
    const dayEntries = Object.entries(days)
      .filter(([k]) => new Date(k) >= periodStart)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => {
        const contatos = d.contatos.size;
        const taxaResp = d.totalContatos > 0 ? Math.round(d.respostas / d.totalContatos * 100) : 0;
        const slaAvg = d.slaMinutos.length > 0 ? Math.round(d.slaMinutos.reduce((a, b) => a + b, 0) / d.slaMinutos.length) : 0;
        const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
        return { date, dayLabel, contatos, qualifs: d.qualifs, taxaResp, vendedor: d.vendedor, slaAvg };
      });

    setDailyData(dayEntries);
  }, [cards, period, selectedSDR]);

  // Totais do período
  const totals = dailyData.reduce((acc, d) => ({
    contatos: acc.contatos + d.contatos,
    qualifs: acc.qualifs + d.qualifs,
    vendedor: acc.vendedor + d.vendedor,
    taxaRespSum: acc.taxaRespSum + d.taxaResp,
    slaSum: acc.slaSum + d.slaAvg,
    days: acc.days + 1,
    slaCount: acc.slaCount + (d.slaAvg > 0 ? 1 : 0),
    taxaCount: acc.taxaCount + (d.taxaResp > 0 ? 1 : 0),
  }), { contatos: 0, qualifs: 0, vendedor: 0, taxaRespSum: 0, slaSum: 0, days: 0, slaCount: 0, taxaCount: 0 });

  const activeDays = Math.max(totals.days, 1);
  const kpiValues: Record<string, number> = {
    ligacoes: Math.round(totals.contatos / activeDays),
    qualificacoes: Math.round(totals.qualifs / activeDays),
    taxa_resposta: totals.taxaCount > 0 ? Math.round(totals.taxaRespSum / totals.taxaCount) : 0,
    leads_vendedor: Math.round(totals.vendedor / activeDays),
    sla_contato: totals.slaCount > 0 ? Math.round(totals.slaSum / totals.slaCount) : 0,
    conversao: totals.qualifs > 0 ? Math.round(totals.vendedor / totals.qualifs * 100) : 0,
  };

  if (loading) return <div style={{ padding: 20, color: TEXT_DIM, fontSize: "0.7rem" }}>Carregando KPIs...</div>;

  return (
    <div style={{ padding: 16 }}>
      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.55rem", color: TEXT_DIM, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>KPIs SDR</span>
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: `1px solid ${BORDER}` }}>
          {(["hoje", "semana", "mes"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: "4px 10px", fontSize: "0.55rem", fontWeight: 600, cursor: "pointer", border: "none",
              background: period === p ? TEAL : "rgba(255,255,255,0.03)",
              color: period === p ? "white" : TEXT_DIM,
            }}>{p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}</button>
          ))}
        </div>
        <select value={selectedSDR} onChange={e => setSelectedSDR(e.target.value)} style={{
          fontSize: "0.55rem", padding: "4px 8px", borderRadius: 6,
          background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`,
          color: selectedSDR ? "white" : TEXT_DIM, cursor: "pointer", outline: "none",
        }}>
          <option value="">Todos os SDRs</option>
          {SDR_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: "0.5rem", color: TEXT_DIM, marginLeft: "auto" }}>
          {totals.contatos} contatos · {totals.qualifs} qualif · {totals.vendedor} vendedor
        </span>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        {KPI_THRESHOLDS.map(kpi => {
          const val = kpiValues[kpi.id] ?? 0;
          const color = kpiColor(val, kpi);
          const status = kpiLabel(val, kpi);
          const displayVal = kpi.id === "sla_contato" ? (val < 60 ? `${val}min` : `${(val/60).toFixed(1)}h`) : `${val}${kpi.unit}`;
          return (
            <div key={kpi.id} style={{
              background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 8, padding: "10px 12px",
            }}>
              <div style={{ fontSize: "0.45rem", color: TEXT_DIM, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color }}>{displayVal}</div>
              <div style={{ fontSize: "0.42rem", color: `${color}CC`, fontWeight: 600, marginTop: 2 }}>
                {status} · Meta: {kpi.invert ? `≤${kpi.exc}${kpi.unit}` : `≥${kpi.exc}${kpi.unit}`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráfico diário */}
      {dailyData.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: "0.5rem", color: TEXT_DIM, fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>Contatos & Qualificações por dia</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="dayLabel" tick={{ fontSize: 9, fill: TEXT_DIM }} />
              <YAxis tick={{ fontSize: 9, fill: TEXT_DIM }} width={30} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${BORDER}`, fontSize: "0.6rem" }} />
              <Bar dataKey="contatos" name="Contatos" fill={BLUE} radius={[3,3,0,0]} />
              <Bar dataKey="qualifs" name="Qualificações" fill={GREEN} radius={[3,3,0,0]} />
              <Bar dataKey="vendedor" name="→ Vendedor" fill={GOLD} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela diária */}
      <div style={{ fontSize: "0.5rem", color: TEXT_DIM, fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Detalhamento diário</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: "0.5rem", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              <th style={{ textAlign: "left", padding: "4px 6px", color: TEXT_DIM, fontWeight: 600 }}>Dia</th>
              <th style={{ textAlign: "right", padding: "4px 6px", color: TEXT_DIM }}>Contatos</th>
              <th style={{ textAlign: "right", padding: "4px 6px", color: TEXT_DIM }}>Qualif.</th>
              <th style={{ textAlign: "right", padding: "4px 6px", color: TEXT_DIM }}>→ Vend.</th>
              <th style={{ textAlign: "right", padding: "4px 6px", color: TEXT_DIM }}>Resp %</th>
              <th style={{ textAlign: "right", padding: "4px 6px", color: TEXT_DIM }}>SLA</th>
            </tr>
          </thead>
          <tbody>
            {dailyData.map(d => (
              <tr key={d.date} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                <td style={{ padding: "4px 6px", color: TEXT_MED }}>{d.dayLabel}</td>
                <td style={{ padding: "4px 6px", textAlign: "right", color: kpiColor(d.contatos, KPI_THRESHOLDS[0]) }}>{d.contatos}</td>
                <td style={{ padding: "4px 6px", textAlign: "right", color: kpiColor(d.qualifs, KPI_THRESHOLDS[1]) }}>{d.qualifs}</td>
                <td style={{ padding: "4px 6px", textAlign: "right", color: kpiColor(d.vendedor, KPI_THRESHOLDS[3]) }}>{d.vendedor}</td>
                <td style={{ padding: "4px 6px", textAlign: "right", color: kpiColor(d.taxaResp, KPI_THRESHOLDS[2]) }}>{d.taxaResp}%</td>
                <td style={{ padding: "4px 6px", textAlign: "right", color: d.slaAvg > 0 ? kpiColor(d.slaAvg, KPI_THRESHOLDS[4]) : TEXT_DIM }}>{d.slaAvg > 0 ? `${d.slaAvg}min` : "—"}</td>
              </tr>
            ))}
            {/* Totais */}
            <tr style={{ borderTop: `2px solid ${BORDER}`, fontWeight: 700 }}>
              <td style={{ padding: "6px", color: "white" }}>TOTAL</td>
              <td style={{ padding: "6px", textAlign: "right", color: "white" }}>{totals.contatos}</td>
              <td style={{ padding: "6px", textAlign: "right", color: "white" }}>{totals.qualifs}</td>
              <td style={{ padding: "6px", textAlign: "right", color: "white" }}>{totals.vendedor}</td>
              <td style={{ padding: "6px", textAlign: "right", color: "white" }}>{kpiValues.taxa_resposta}%</td>
              <td style={{ padding: "6px", textAlign: "right", color: "white" }}>{kpiValues.sla_contato > 0 ? `${kpiValues.sla_contato}min` : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══ Sub-componentes dinâmicos ═══ */
function FunilPipelineTab() {
  const { funil: dbFunil, pipeline: dbPipeline, conversion: dbConversion } = useCRM();
  const funilData = dbFunil.length > 0 ? dbFunil.map(f => ({ name: f.name, value: f.value, fill: f.cor })) : FUNNEL_DATA;
  const pipelineData = dbPipeline.length > 0 ? dbPipeline.map(p => ({ stage: p.stage, value: Number(p.value_k), deals: p.deals })) : PIPELINE_VALUE;
  const conversionData = dbConversion.length > 0 ? dbConversion.map(c => ({ mes: c.mes, taxa: Number(c.taxa), leads: c.leads })) : CONVERSION_MONTHLY;
  const totalPipeline = pipelineData.reduce((s, p) => s + p.value, 0);

  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Funil de Conversao & Pipeline</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Visao completa do pipeline comercial Parket</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Funil de Conversao</p>
          <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: 16 }}>Leads → Fechamento</p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funilData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid key="cg" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis key="xa" type="number" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis key="ya" type="category" dataKey="name" tick={{ fill: TEXT_MED, fontSize: 10 }} axisLine={false} tickLine={false} width={75} />
                <Tooltip key="tt" content={<CTip />} />
                <Bar key="bar" dataKey="value" name="Quantidade" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
                  {funilData.map((entry, idx) => <Cell key={`f-${idx}`} fill={entry.fill} fillOpacity={0.7} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Taxa de Conversao Mensal</p>
          <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: 16 }}>Evolucao dos ultimos 6 meses</p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={conversionData}>
                <CartesianGrid key="cg" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis key="xa" dataKey="mes" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
                <YAxis key="ya" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
                <Tooltip key="tt" content={<CTip />} />
                <Line key="l1" type="monotone" dataKey="taxa" name="Conversao (%)" stroke={GREEN} strokeWidth={2} dot={{ fill: GREEN, r: 3 }} isAnimationActive={false} />
                <Line key="l2" type="monotone" dataKey="leads" name="Leads" stroke={BLUE} strokeWidth={1.5} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p className="tracking-[0.2em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Valor do Pipeline por Etapa (R$ mil)</p>
        <div className="space-y-3">
          {pipelineData.map((p, i) => {
            const maxVal = Math.max(...pipelineData.map(x => x.value), 600);
            return (
              <div key={i} className="flex items-center gap-3">
                <span style={{ fontSize: "0.65rem", color: TEXT_MED, width: 100, flexShrink: 0 }}>{p.stage}</span>
                <div className="flex-1 h-6 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="h-full rounded flex items-center px-2" style={{ width: `${(p.value / maxVal) * 100}%`, background: `${BLUE}20`, minWidth: 60 }}>
                    <span style={{ fontSize: "0.6rem", color: BLUE, fontWeight: 600 }}>R$ {p.value}k</span>
                  </div>
                </div>
                <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>{p.deals} deals</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: "0.7rem", color: TEXT_MED }}>Pipeline Total</span>
          <span style={{ fontSize: "1.1rem", fontWeight: 700, color: GREEN }}>R$ {totalPipeline >= 1000 ? `${(totalPipeline / 1000).toFixed(2)}M` : `${totalPipeline}k`}</span>
        </div>
      </div>
      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p className="tracking-[0.2em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Origem dos Leads</p>
        <div className="flex flex-wrap gap-4 items-center">
          <div style={{ width: 160, height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={LEAD_SOURCE} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" isAnimationActive={false}>
                  {LEAD_SOURCE.map((entry, idx) => <Cell key={`ls-${idx}`} fill={entry.fill} fillOpacity={0.8} />)}
                </Pie>
                <Tooltip content={<CTip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-2">
            {LEAD_SOURCE.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ background: s.fill }} />
                <span style={{ fontSize: "0.65rem", color: TEXT_MED }}>{s.name}</span>
                <span style={{ fontSize: "0.65rem", color: "white", fontWeight: 600 }}>{s.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RankingClosersTab() {
  const { closers: dbClosers } = useCRM();
  const closers = dbClosers.length > 0 ? dbClosers.map(c => ({
    nome: c.nome, propostas: c.propostas, fechados: c.fechados,
    valor: c.valor_k > 0 ? `R$ ${c.valor_k}k` : "-",
    taxa: c.taxa_pct != null ? `${c.taxa_pct}%` : "-",
    star: c.destaque,
  })) : CLOSER_RANKING;

  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Ranking de Vendedores</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Performance individual do time comercial este mes</p></div>
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <table className="w-full" style={{ fontSize: "0.7rem" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)" }}>
              <th className="text-left py-3 px-4" style={{ color: TEXT_DIM, fontWeight: 600, fontSize: "0.6rem" }}>#</th>
              <th className="text-left py-3 px-4" style={{ color: TEXT_DIM, fontWeight: 600, fontSize: "0.6rem" }}>Vendedor</th>
              <th className="text-center py-3 px-4" style={{ color: TEXT_DIM, fontWeight: 600, fontSize: "0.6rem" }}>Propostas</th>
              <th className="text-center py-3 px-4" style={{ color: TEXT_DIM, fontWeight: 600, fontSize: "0.6rem" }}>Fechados</th>
              <th className="text-center py-3 px-4" style={{ color: TEXT_DIM, fontWeight: 600, fontSize: "0.6rem" }}>Valor</th>
              <th className="text-center py-3 px-4" style={{ color: TEXT_DIM, fontWeight: 600, fontSize: "0.6rem" }}>Taxa</th>
            </tr>
          </thead>
          <tbody>
            {closers.map((c, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${BORDER}`, background: c.star ? "rgba(212,168,83,0.04)" : "transparent" }}>
                <td className="py-3 px-4" style={{ color: c.star ? GOLD : TEXT_DIM }}>{c.star ? <Star size={12} style={{ color: GOLD }} /> : i + 1}</td>
                <td className="py-3 px-4 text-white" style={{ fontWeight: 500 }}>{c.nome}</td>
                <td className="py-3 px-4 text-center" style={{ color: TEXT_MED }}>{c.propostas}</td>
                <td className="py-3 px-4 text-center" style={{ color: GREEN, fontWeight: 600 }}>{c.fechados}</td>
                <td className="py-3 px-4 text-center" style={{ color: ACCENT }}>{c.valor}</td>
                <td className="py-3 px-4 text-center" style={{ color: c.taxa !== "-" ? GREEN : TEXT_DIM }}>{c.taxa}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShowroomAgendaTab() {
  const { agenda: dbAgenda, updateAgendaStatus } = useCRM();
  const rawAgenda = dbAgenda.length > 0 ? dbAgenda : null;
  const agenda = rawAgenda ?? SHOWROOM_AGENDA.map((a, i) => ({ ...a, id: String(i), data: "", closer: undefined as string | undefined }));
  const [localStatus, setLocalStatus] = React.useState<Record<string, string>>({});

  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Agenda de Showroom</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Visitas agendadas para esta semana</p></div>
      <div className="space-y-2">
        {agenda.map((v, i) => {
          const effectiveStatus = localStatus[v.id] ?? v.status;
          const sc = effectiveStatus === "confirmado" ? GREEN : effectiveStatus === "cancelado" ? RED : effectiveStatus === "realizado" ? BLUE : YELLOW;
          const handleStatusChange = async (newStatus: "confirmado" | "cancelado" | "realizado") => {
            if (rawAgenda) { await updateAgendaStatus(v.id, newStatus); }
            else { setLocalStatus(s => ({ ...s, [v.id]: newStatus })); }
          };
          return (
            <div key={i} className="rounded-xl p-4 flex items-center gap-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="text-center" style={{ minWidth: 60 }}>
                <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{v.dia.split(" ")[0]}</p>
                <p className="text-white" style={{ fontSize: "0.85rem", fontWeight: 600 }}>{v.dia.split(" ")[1]}</p>
              </div>
              <div className="w-px h-10" style={{ background: BORDER }} />
              <div className="flex-1">
                <p className="text-white" style={{ fontSize: "0.78rem", fontWeight: 500 }}>{v.cliente}</p>
                <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{v.hora}</p>
              </div>
              <span className="rounded-full px-2.5 py-1" style={{ fontSize: "0.5rem", fontWeight: 600, background: `${sc}12`, color: sc }}>{effectiveStatus}</span>
              {effectiveStatus === "pendente" && (
                <div className="flex gap-1">
                  <button onClick={() => handleStatusChange("confirmado")} className="rounded-lg px-2 py-1" style={{ fontSize: "0.45rem", fontWeight: 600, background: "rgba(16,185,129,0.12)", color: GREEN, border: "1px solid rgba(16,185,129,0.2)", cursor: "pointer" }}>Confirmar</button>
                  <button onClick={() => handleStatusChange("cancelado")} className="rounded-lg px-2 py-1" style={{ fontSize: "0.45rem", fontWeight: 600, background: "rgba(239,68,68,0.1)", color: RED, border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>Cancelar</button>
                </div>
              )}
              {effectiveStatus === "confirmado" && (
                <button onClick={() => handleStatusChange("realizado")} className="rounded-lg px-2 py-1" style={{ fontSize: "0.45rem", fontWeight: 600, background: "rgba(59,130,246,0.1)", color: BLUE, border: "1px solid rgba(59,130,246,0.2)", cursor: "pointer" }}>Realizado</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ Equipe Comercial Tab — gestao de membros e permissoes ═══ */
interface MemberPerm { view: boolean; edit: boolean; add: boolean; manage: boolean }
interface ComercialMember { id: string; full_name: string; email: string; role: string; dept: string; permissions: MemberPerm }

function EquipeComercialTab() {
  const { user } = useAuth();
  const admin = isComercialAdmin(user);
  const [members, setMembers] = useState<ComercialMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addCandidates, setAddCandidates] = useState<{ id: string; full_name: string; email: string }[]>([]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const adminClient = createAdminClient();
      const { data, error } = await adminClient.from("user_profiles").select("*").order("full_name");
      if (error) {
        console.warn("loadMembers admin error, trying regular:", error);
        const { data: fallback } = await supabase.from("user_profiles").select("*").order("full_name");
        if (fallback) parseMembersFromRows(fallback);
      } else if (data) {
        parseMembersFromRows(data);
      }
    } catch {
      const { data } = await supabase.from("user_profiles").select("*").order("full_name");
      if (data) parseMembersFromRows(data);
    }
    setLoading(false);
  };

  const parseMembersFromRows = (rows: any[]) => {
    const filtered = rows.filter((r: any) => {
      const dp = r.dept_permissions;
      if (!dp) return false;
      if (typeof dp === "object" && dp.comercial) return true;
      if (typeof dp === "string") {
        try { if (JSON.parse(dp).comercial) return true; } catch { /* ignore */ }
        if (dp.includes("comercial")) return true;
      }
      return r.role === "admin";
    }).map((r: any) => {
      let perms: MemberPerm = { view: true, edit: false, add: false, manage: false };
      const dp = r.dept_permissions;
      if (typeof dp === "object" && dp.comercial && typeof dp.comercial === "object") {
        perms = { view: dp.comercial.view || false, edit: dp.comercial.edit || false, add: dp.comercial.add || false, manage: dp.comercial.manage || false };
      } else if (typeof dp === "string" && dp.includes("comercial")) {
        perms = { view: true, edit: dp.includes("edit") || dp.includes("manage"), add: dp.includes("manage"), manage: dp.includes("manage") };
      }
      if (r.role === "admin") perms = { view: true, edit: true, add: true, manage: true };
      return { id: r.id, full_name: r.full_name || "", email: r.email || "", role: r.role || "member", dept: "comercial", permissions: perms };
    });
    setMembers(filtered);
  };

  useEffect(() => { loadMembers(); }, []);

  const togglePermission = async (memberId: string, perm: keyof MemberPerm) => {
    if (!admin) return;
    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const updated = { ...m.permissions, [perm]: !m.permissions[perm] };
      const payload = JSON.stringify({ comercial: updated });
      supabase.from("user_profiles").update({ dept_permissions: payload }).eq("id", memberId).then(() => {});
      return { ...m, permissions: updated };
    }));
  };

  const changeRole = async (memberId: string, newRole: string) => {
    if (!admin) return;
    await supabase.from("user_profiles").update({ role: newRole }).eq("id", memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
  };

  const filtered = members.filter(m =>
    !searchTerm || m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const permLabels: Record<string, string> = { view: "Visualizar", edit: "Editar", manage: "Gerenciar", add: "Adicionar" };
  const roleStyles: Record<string, { label: string; color: string }> = {
    admin: { label: "Administrador", color: RED },
    dept_leader: { label: "Lider", color: GOLD },
    member: { label: "Membro", color: BLUE },
    viewer: { label: "Visualizador", color: TEXT_DIM },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 600 }}>Equipe Comercial</h2>
          <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Gerencie membros, permissoes e acessos do funil comercial</p>
        </div>
        <span style={{ fontSize: "0.55rem", color: admin ? GREEN : TEXT_DIM }}>{admin ? "Acesso administrador" : "Somente visualizacao"}</span>
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3">
        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: TEXT_DIM }} />
          <input
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar membro..."
            style={{ width: "100%", padding: "7px 10px 7px 30px", borderRadius: 8, fontSize: "0.65rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white", outline: "none" }}
          />
        </div>
        {admin && (
          <button
            onClick={async () => {
              const { data } = await supabase.from("user_profiles").select("id, full_name, email").order("full_name");
              setAddCandidates((data || []).filter((u: any) => !members.some(m => m.id === u.id && m.dept === "comercial")));
              setShowAddPanel(true);
            }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: "0.6rem", fontWeight: 600, cursor: "pointer", background: "rgba(16,185,129,0.1)", color: GREEN, border: "1px solid rgba(16,185,129,0.25)" }}
          >
            <Plus size={13} /> Adicionar Membro
          </button>
        )}
      </div>

      {/* Add panel */}
      {showAddPanel && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, maxHeight: 200, overflowY: "auto" }}>
          <p style={{ fontSize: "0.5rem", fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Selecione um usuario para adicionar ao comercial</p>
          {addCandidates.length === 0 && <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Todos os usuarios ja fazem parte do setor</p>}
          {addCandidates.map(c => (
            <button
              key={c.id}
              onClick={async () => {
                const payload = JSON.stringify({ comercial: { view: true, edit: true, add: false, manage: false } });
                await supabase.from("user_profiles").update({ dept_permissions: payload }).eq("id", c.id);
                setShowAddPanel(false);
                loadMembers();
              }}
              className="w-full text-left flex items-center gap-3 px-3 py-2"
              style={{ background: "transparent", border: "none", borderBottom: `1px solid ${BORDER}`, cursor: "pointer" }}
            >
              <span style={{ fontSize: "0.62rem", color: "white" }}>{c.full_name || c.email}</span>
              <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{c.email}</span>
            </button>
          ))}
          <button onClick={() => setShowAddPanel(false)} style={{ marginTop: 6, fontSize: "0.55rem", color: TEXT_DIM, background: "none", border: "none", cursor: "pointer" }}>Cancelar</button>
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-3">
        <div style={{ flex: 1, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
          <p style={{ fontSize: "1rem", fontWeight: 700, color: BLUE, margin: 0 }}>{filtered.length}</p>
          <p style={{ fontSize: "0.45rem", color: TEXT_DIM, margin: 0 }}>MEMBROS</p>
        </div>
        <div style={{ flex: 1, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
          <p style={{ fontSize: "1rem", fontWeight: 700, color: RED, margin: 0 }}>{filtered.filter(m => m.role === "admin").length}</p>
          <p style={{ fontSize: "0.45rem", color: TEXT_DIM, margin: 0 }}>ADMINS</p>
        </div>
        <div style={{ flex: 1, background: "rgba(212,168,83,0.08)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
          <p style={{ fontSize: "1rem", fontWeight: 700, color: GOLD, margin: 0 }}>{filtered.filter(m => m.role === "dept_leader").length}</p>
          <p style={{ fontSize: "0.45rem", color: TEXT_DIM, margin: 0 }}>LIDERES</p>
        </div>
      </div>

      {/* Members list */}
      {loading ? (
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM, textAlign: "center", padding: 40 }}>Carregando equipe...</p>
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM, textAlign: "center", padding: 40 }}>
          Nenhum membro encontrado. {admin ? 'Clique em "Adicionar Membro" para incluir pessoas no setor.' : ""}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(member => {
            const rs = roleStyles[member.role] || roleStyles.member;
            return (
              <div key={member.id} className="rounded-lg p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${rs.color}20`, fontSize: "0.55rem", fontWeight: 700, color: rs.color }}>
                      {(member.full_name || member.email)[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>{member.full_name || member.email}</p>
                      <p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "0.48rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: `${rs.color}15`, color: rs.color }}>{rs.label}</span>
                    {admin && (
                      <select
                        value={member.role} onChange={e => changeRole(member.id, e.target.value)}
                        style={{ fontSize: "0.5rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT_MED, padding: "3px 6px", outline: "none", cursor: "pointer" }}
                      >
                        <option value="admin">Administrador</option>
                        <option value="dept_leader">Lider</option>
                        <option value="member">Membro</option>
                        <option value="viewer">Visualizador</option>
                      </select>
                    )}
                    {admin && member.role !== "admin" && (
                      <button
                        onClick={async () => {
                          if (confirm(`Remover ${member.full_name || member.email} do setor comercial?`)) {
                            await supabase.from("user_profiles").update({ dept_permissions: JSON.stringify({}) }).eq("id", member.id);
                            loadMembers();
                          }
                        }}
                        style={{ fontSize: "0.45rem", color: RED, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
                      >Remover</button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(["view", "edit", "add", "manage"] as (keyof MemberPerm)[]).map(perm => {
                    const active = member.permissions[perm] || member.role === "admin";
                    const locked = member.role === "admin";
                    return (
                      <button
                        key={perm}
                        onClick={() => !locked && togglePermission(member.id, perm)}
                        disabled={!admin || locked}
                        style={{
                          fontSize: "0.48rem", fontWeight: 600, padding: "3px 10px", borderRadius: 5,
                          cursor: admin && !locked ? "pointer" : "default",
                          background: active ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)",
                          color: active ? GREEN : TEXT_DIM,
                          border: `1px solid ${active ? "rgba(16,185,129,0.25)" : BORDER}`,
                          opacity: locked ? 0.6 : 1,
                        }}
                      >
                        {active ? "\u2713 " : ""}{permLabels[perm]}
                      </button>
                    );
                  })}
                </div>
                {member.role === "admin" && (
                  <p style={{ fontSize: "0.45rem", color: TEXT_DIM, marginTop: 4 }}>Administradores possuem todas as permissoes automaticamente</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ WhatsApp Conversa Modal ═══ */
function WhatsAppConversaModal({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [opened, setOpened] = useState(false);

  const openConversation = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) return;
    setOpened(true);
    // Open WhatsApp Web in new tab with the phone number
    const waNumber = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(`https://wa.me/${waNumber}`, "_blank");
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
    >
      <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, width: "100%", maxWidth: 560, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(37,211,102,0.15)", border: "1px solid rgba(37,211,102,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageCircle size={14} style={{ color: "#25D366" }} />
            </div>
            <div>
              <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "white", margin: 0 }}>{opened ? (contactName || phone) : "Nova Conversa"}</p>
              {opened && <p style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.4)", margin: 0 }}>{phone}</p>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)" }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: opened ? "14px 18px" : "24px 20px" }}>
          {opened ? (
            <div className="flex flex-col items-center justify-center gap-3" style={{ padding: "40px 0" }}>
              <MessageCircle size={32} style={{ color: "#25D366" }} />
              <p style={{ fontSize: "0.7rem", color: "white", fontWeight: 600 }}>Conversa aberta no WhatsApp</p>
              <p style={{ fontSize: "0.58rem", color: TEXT_DIM, textAlign: "center" }}>
                A conversa com {contactName || phone} foi aberta em uma nova aba.
              </p>
              <button
                onClick={() => {
                  const digits = phone.replace(/\D/g, "");
                  const waNumber = digits.startsWith("55") ? digits : `55${digits}`;
                  window.open(`https://wa.me/${waNumber}`, "_blank");
                }}
                style={{ background: "#25D366", border: "none", borderRadius: 8, padding: "8px 16px", color: "white", fontSize: "0.6rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <MessageCircle size={13} /> Abrir novamente
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Informe o numero para iniciar uma nova conversa via WhatsApp.</p>
              <div>
                <label style={{ display: "block", fontSize: "0.44rem", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 5 }}>Numero (WhatsApp) *</label>
                <input
                  autoFocus
                  value={phone} onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") openConversation(); }}
                  placeholder="Ex: (11) 99999-9999 ou 5511999999999"
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: "0.72rem", padding: "10px 13px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.44rem", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 5 }}>Nome do contato (opcional)</label>
                <input
                  value={contactName} onChange={e => setContactName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") openConversation(); }}
                  placeholder="Ex: Joao Silva"
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: "0.72rem", padding: "10px 13px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <button
                onClick={openConversation}
                disabled={phone.replace(/\D/g, "").length < 8}
                style={{
                  background: phone.replace(/\D/g, "").length >= 8 ? "#25D366" : "rgba(37,211,102,0.15)",
                  border: "none", borderRadius: 10, padding: "11px",
                  color: "white", fontSize: "0.7rem", fontWeight: 700,
                  cursor: phone.replace(/\D/g, "").length >= 8 ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: phone.replace(/\D/g, "").length >= 8 ? 1 : 0.5,
                }}
              >
                <MessageCircle size={15} /> Abrir Conversa
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ Extra tabs ═══ */
const team: TeamMember[] = [];

const activity: ActivityItem[] = [
  { id: "1", text: "Rafael enviou proposta v2 para Corp. Berrini — R$ 185k", time: "Hoje 14:30", type: "action" },
  { id: "2", text: "Proposta PKT-058 aprovada pelo cliente — contrato em revisao", time: "Hoje 11:00", type: "completed" },
  { id: "3", text: "Lead Arq. Patricia sem contato ha 3 dias — risco de perda", time: "Hoje 09:15", type: "alert" },
  { id: "4", text: "Marina agendou showroom com Res. Alphaville para Qui 15h", time: "Ontem 17:00", type: "action" },
  { id: "5", text: "Meta de fechamento batida: 34% vs 30% — parabens equipe!", time: "Ontem 08:00", type: "completed" },
  { id: "6", text: "BDR Ana qualificou 3 novos leads via Google Ads", time: "Ontem 16:20", type: "update" },
  { id: "7", text: "CRM atualizado: 5 leads sem proximo passo definido", time: "Ontem 09:00", type: "alert" },
];

export function DeptComercialPage() {
  const tabRef = React.useRef<((tabId: string) => void) | null>(null);
  const { user, isAdmin } = useAuth();
  const admin = isComercialAdmin(user);

  const [showWaModal, setShowWaModal] = useState(false);
  const [funnelMode, setFunnelMode] = useState<"vendas" | "entrada">("vendas");

  /* "Meu Funil" — SEMPRE ativo para non-admins (vendedor só vê seus leads) */
  const [meuFunil, setMeuFunil] = useState(!admin);

  /* Vendedor + SDR filters (admin only) */
  const [selectedVendedor, setSelectedVendedor] = useState("");
  const [selectedSDR, setSelectedSDR] = useState("");
  const [vendedores, setVendedores] = useState<{ id: string; full_name: string; email: string }[]>([]);

  const SDR_LIST = ["Matheus Lopes", "Vinicius Arruda"];
  const currentUserName = user?.full_name ?? user?.email ?? "";

  /* Seed vendedor list: hardcoded + responsavel from kanban_cards */
  const SEED_VENDEDORES = ["Ana Paula Pereira Varaschin", "Cristian Lopes", "Guilherme Fonseca", "Gustavo Oliveira", "Vinicius Arruda"];

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("kanban_cards").select("responsavel").in("dept_id", ["comercial", "comercial-entrada"]);
        const set = new Set((data ?? []).map((d: any) => d.responsavel as string).filter(Boolean));
        SEED_VENDEDORES.forEach(v => set.add(v));
        const sorted = [...set].sort();
        setVendedores(sorted.map(v => ({ id: v, full_name: v, email: "" })));
      } catch (err) {
        console.error("Erro ao carregar vendedores:", err);
      }
    })();
  }, []);

  /* Card filter — admin can filter by vendedor/SDR; non-admin sees "Meu Funil" */
  const cardFilter = admin
    ? (selectedVendedor || selectedSDR)
      ? (card: any) => {
          if (selectedVendedor) {
            const lower = selectedVendedor.toLowerCase();
            const resp = (card.responsavel ?? "").toLowerCase();
            const vendedor = (card.details?.vendedor ?? "").toLowerCase();
            if (resp !== lower && vendedor !== lower) return false;
          }
          if (selectedSDR) {
            const lower = selectedSDR.toLowerCase();
            const sdr = (card.details?.sdr ?? "").toLowerCase();
            if (sdr !== lower) return false;
          }
          return true;
        }
      : undefined
    : currentUserName
      ? (card: any) => {
          const lower = currentUserName.toLowerCase();
          const resp = (card.responsavel ?? "").toLowerCase();
          const vendedor = (card.details?.vendedor ?? "").toLowerCase();
          const sdr = (card.details?.sdr ?? "").toLowerCase();
          return resp === lower || vendedor === lower || sdr === lower;
        }
      : undefined;

  /* Kanban header extra — funnel toggle + filters + WhatsApp button */
  const kanbanHeaderExtra = (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Funnel toggle */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
          <button
            onClick={() => setFunnelMode("entrada")}
            style={{
              padding: "6px 14px", fontSize: "0.6rem", fontWeight: 600, cursor: "pointer", border: "none",
              background: funnelMode === "entrada" ? "#14B8A6" : "rgba(255,255,255,0.03)",
              color: funnelMode === "entrada" ? "white" : TEXT_DIM,
            }}
          >Funil de Entrada</button>
          <button
            onClick={() => setFunnelMode("vendas")}
            style={{
              padding: "6px 14px", fontSize: "0.6rem", fontWeight: 600, cursor: "pointer", border: "none",
              background: funnelMode === "vendas" ? BLUE : "rgba(255,255,255,0.03)",
              color: funnelMode === "vendas" ? "white" : TEXT_DIM,
            }}
          >Funil de Vendas</button>
        </div>

        {/* Vendedor + SDR filters (admin) */}
        <div className="flex items-center gap-2">
          {admin && (
            <>
              <Eye size={12} style={{ color: TEXT_DIM, flexShrink: 0 }} />
              <select
                value={selectedVendedor} onChange={e => setSelectedVendedor(e.target.value)}
                style={{
                  fontSize: "0.58rem", fontWeight: 500, padding: "5px 10px", borderRadius: 7,
                  border: `1px solid ${selectedVendedor ? BLUE + "60" : BORDER}`,
                  background: selectedVendedor ? `${BLUE}10` : "rgba(255,255,255,0.03)",
                  color: selectedVendedor ? "white" : TEXT_DIM, cursor: "pointer", outline: "none",
                }}
              >
                <option value="">Todos os vendedores</option>
                {vendedores.map(v => <option key={v.id} value={v.full_name || v.email}>{v.full_name || v.email}</option>)}
              </select>
              {selectedVendedor && (
                <button onClick={() => setSelectedVendedor("")} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 0, lineHeight: 1 }}>
                  <X size={12} />
                </button>
              )}
            </>
          )}
          <select
            value={selectedSDR} onChange={e => setSelectedSDR(e.target.value)}
            style={{
              fontSize: "0.58rem", fontWeight: 500, padding: "5px 10px", borderRadius: 7,
              border: `1px solid ${selectedSDR ? "#A855F760" : BORDER}`,
              background: selectedSDR ? "rgba(168,85,247,0.1)" : "rgba(255,255,255,0.03)",
              color: selectedSDR ? "white" : TEXT_DIM, cursor: "pointer", outline: "none",
            }}
          >
            <option value="">Todos os SDRs</option>
            {SDR_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {selectedSDR && (
            <button onClick={() => setSelectedSDR("")} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 0, lineHeight: 1 }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Indicador de funil do vendedor (non-admin vê apenas seus leads) */}
        {!admin && currentUserName && (
          <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Meu Funil — <span style={{ color: BLUE }}>{currentUserName}</span></span>
        )}

        {/* WhatsApp Nova Conversa */}
        <button
          onClick={() => setShowWaModal(true)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 ml-auto"
          style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.25)", color: "#25D366", fontSize: "0.6rem", fontWeight: 600, cursor: "pointer" }}
        >
          <MessageCircle size={13} /> Nova Conversa
        </button>
      </div>
      {showWaModal && <WhatsAppConversaModal onClose={() => setShowWaModal(false)} />}
    </>
  );

  const deptId = funnelMode === "entrada" ? "comercial-entrada" : "comercial";

  // CONVFIX2026 port: HistoricoCom é restrita a admin/marketing
  const isMarketing = user?.email === "marketing@parket.com.br";
  const showHistorico = admin || isMarketing;

  const extraTabs: ExtraTab[] = [
    { id: "funil", label: "Funil & Pipeline", icon: Filter, render: () => <FunilPipelineTab /> },
    { id: "sdr-kpis", label: "KPIs SDR", icon: TrendingUp, render: () => <SDRKpiDashboard /> },
    { id: "ranking", label: "Ranking & Closers", icon: Award, render: () => <RankingClosersTab /> },
    { id: "showroom", label: "Agenda Showroom", icon: Calendar, render: () => <ShowroomAgendaTab /> },
    { id: "equipe", label: "Equipe", icon: Users, render: () => <EquipeComercialTab /> },
    { id: "relatorio-teka", label: "Relatório TEKA", icon: BarChart3, render: () => <RelatorioTekaTab /> },
    { id: "relatorio-funil", label: "Relatório Funil", icon: FileBarChart, render: () => <RelatorioFunilTab /> },
    ...(showHistorico ? [{ id: "historico", label: "Histórico", icon: Clock, render: () => <HistoricoCardTab /> }] : []),
    { id: "gravacoes-wavoip", label: "Gravações", icon: Mic, render: () => <GravacoesWavoipTab /> },
  ];

  const qa: QuickAction[] = [
    { label: "Novo Lead", icon: UserPlus, color: BLUE, onClick: () => tabRef.current?.("funil") },
    { label: "Nova Proposta", icon: Briefcase, color: PURPLE, badge: "3", onClick: () => tabRef.current?.("funil") },
    { label: "Showroom", icon: MapPin, color: ORANGE, badge: "2", onClick: () => tabRef.current?.("showroom") },
    { label: "Follow-up", icon: Phone, color: GREEN, badge: "5", onClick: () => tabRef.current?.("funil") },
  ];

  return (
    <DeptPage
      key={deptId}
      deptId={deptId}
      baseRoute="comercial"
      extraTabs={extraTabs}
      team={team}
      quickActions={qa}
      activity={activity}
      tabSwitcherRef={tabRef}
      kanbanHeaderExtra={kanbanHeaderExtra}
      cardFilter={cardFilter}
    />
  );
}
