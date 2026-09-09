import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import {
  TrendingUp, AlertTriangle, CheckCircle2, Clock, XCircle,
  ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight,
  Layers, Activity, Target, Gauge, Package, Star,
  Wrench, ChevronLeft, Users, Zap, Eye, Truck, HardHat, Briefcase,
  DollarSign, Building2, ArrowRight, Flame, Shield, Radio, BarChart3,
  Factory, Handshake, Bot, Crown, CircleAlert, TriangleAlert, Info,
} from "lucide-react";
import {
  ACCENT, BG, CARD_BG, CARD_BORDER, GREEN, GREEN_DIM, RED, RED_DIM,
  YELLOW, YELLOW_DIM, BLUE, BLUE_DIM, TEAL, PURPLE, PURPLE_DIM,
  ORANGE, ORANGE_DIM,
  obrasData as staticObrasData, deptData as staticDeptData,
  priorities, lossesData as staticLossesData, founderDecisions,
  handoffsData as staticHandoffsData,
  alertsRed as staticAlertsRed, alertsYellow as staticAlertsYellow, alertsBlue as staticAlertsBlue,
  trendData,
  getRiskColor, getRiskBg, getRiskLabel, getScoreColor, getScoreBg,
} from "../components/dashboard-data";
import { useDashboardData } from "../hooks/useDashboardData";

/* ─── Context para dados dinâmicos do Supabase ─── */
type DashCtx = ReturnType<typeof useDashboardData>;
const DashboardCtx = React.createContext<DashCtx>({
  obrasCC: staticObrasData as any, alertsRed: staticAlertsRed, alertsYellow: staticAlertsYellow,
  alertsBlue: staticAlertsBlue, handoffsData: staticHandoffsData as any, deptData: staticDeptData,
  lossesData: staticLossesData, totalValue: 0, loading: false,
});
const useDash = () => React.useContext(DashboardCtx);

/* ─── Aliases para compatibilidade com código existente ─── */
const obrasData = staticObrasData;
const deptData = staticDeptData;
const lossesData = staticLossesData;
const handoffsData = staticHandoffsData;
const alertsRed = staticAlertsRed;
const alertsYellow = staticAlertsYellow;
const alertsBlue = staticAlertsBlue;

type Tab = "executive" | "engine" | "risk" | "departments" | "productivity" | "losses" | "handoffs" | "warroom" | "tower" | "team";

/* ---- Shared UI ---- */

function Card({ children, className, onClick, active }: {
  children: React.ReactNode; className?: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <div
      className={"rounded-lg border transition-all duration-200 " + (onClick ? "cursor-pointer hover:border-[#B8AA9A]/30 " : "") + (className || "")}
      style={{ background: active ? "rgba(184,170,154,0.08)" : CARD_BG, borderColor: active ? "rgba(184,170,154,0.3)" : CARD_BORDER }}
      onClick={onClick}
    >{children}</div>
  );
}

function CTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg p-2.5 border" style={{ background: "#1a1a1a", borderColor: CARD_BORDER }}>
      <p style={{ fontSize: "0.65rem", color: ACCENT, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ fontSize: "0.6rem", color: p.color }}>{p.name}: <span className="text-white">{p.value}</span></p>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} style={{ color }} />
        <span style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.35)" }}>{label}</span>
      </div>
      <span className="text-white block" style={{ fontSize: "1.1rem", fontWeight: 300 }}>{value}</span>
      {sub && <span style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.2)" }}>{sub}</span>}
    </Card>
  );
}

function ScoreBadge({ score, size = "md" }: { score: string; size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "w-10 h-10 text-lg" : size === "md" ? "w-7 h-7 text-sm" : "w-5 h-5 text-xs";
  return (
    <span className={`${s} rounded-lg inline-flex items-center justify-center`}
      style={{ background: getScoreBg(score), color: getScoreColor(score), fontWeight: 600 }}>{score}</span>
  );
}

function RiskBadge({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
      style={{ background: getRiskBg(score), color: getRiskColor(score), fontSize: "0.6rem", fontWeight: 500 }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: getRiskColor(score) }} />
      {score} - {getRiskLabel(score)}
    </span>
  );
}

const DEPT_ICONS: Record<string, React.ElementType> = {
  Comercial: Briefcase, Projetos: Eye, Compras: Package, Financeiro: DollarSign,
  Producao: Factory, Logistica: Truck, Obras: HardHat, Relacionamento: Handshake,
  PMO: Target, Marketing: Star,
};
const DEPT_COLORS: Record<string, string> = {
  Comercial: GREEN, Projetos: BLUE, Compras: YELLOW, Financeiro: TEAL,
  Producao: ORANGE, Logistica: PURPLE, Obras: ACCENT, Relacionamento: GREEN,
  PMO: BLUE, Marketing: TEAL,
};
const LOSS_COLORS = [RED, ORANGE, YELLOW, PURPLE, BLUE];

/* ======================= EXECUTIVE ======================= */

function ExecutiveTab() {
  const { obrasCC: liveObrasCC, alertsRed: liveRed, alertsYellow: liveYellow, alertsBlue: liveBlue,
          handoffsData: liveHandoffs, deptData: liveDepts, lossesData: liveLosses } = useDash();
  const obras = liveObrasCC.length > 0 ? liveObrasCC : (obrasData as any[]);
  const deps = liveDepts.length > 0 ? liveDepts : deptData;
  const hoffs = liveHandoffs.length > 0 ? liveHandoffs : (handoffsData as any[]);
  const losses = liveLosses.length > 0 ? liveLosses : lossesData;
  const redAlerts = liveRed.length > 0 ? liveRed : alertsRed;

  const totalVal = obras.reduce((s: number, o: any) => s + (o.valueNum ?? o.contrato_num ?? 0), 0);
  const avgRisk = obras.length > 0 ? Math.round(obras.reduce((s: number, o: any) => s + o.riskScore, 0) / obras.length) : 0;
  const critCount = obras.filter((o: any) => o.riskScore < 60).length;
  const totalLoss = losses.reduce((s: number, l: any) => s + l.value, 0);
  const avgMargin = obras.length > 0 ? (obras.reduce((s: number, o: any) => s + (o.marginReal ?? 0), 0) / obras.length).toFixed(1) : "0";
  const vencidos = hoffs.filter((h: any) => h.status === "vencido").length;

  const scoreDist = [
    { name: "A", value: deps.filter((d: any) => d.score === "A").length, fill: GREEN },
    { name: "B", value: deps.filter((d: any) => d.score === "B").length, fill: BLUE },
    { name: "C", value: deps.filter((d: any) => d.score === "C").length, fill: YELLOW },
  ].filter(d => d.value > 0);

  const riskDist = [
    { name: "90+", count: obras.filter((o: any) => o.riskScore >= 90).length, fill: GREEN },
    { name: "75-89", count: obras.filter((o: any) => o.riskScore >= 75 && o.riskScore < 90).length, fill: YELLOW },
    { name: "60-74", count: obras.filter((o: any) => o.riskScore >= 60 && o.riskScore < 75).length, fill: ORANGE },
    { name: "<60", count: obras.filter((o: any) => o.riskScore < 60).length, fill: RED },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        <Kpi label="Obras Ativas" value="7" color={ACCENT} icon={Building2} />
        <Kpi label="Pipeline" value={`R$ ${(totalVal / 1000).toFixed(0)}k`} color={GREEN} icon={DollarSign} />
        <Kpi label="Obras Criticas" value={String(critCount)} sub="score <60" color={RED} icon={Flame} />
        <Kpi label="Score Medio" value={String(avgRisk)} color={getRiskColor(avgRisk)} icon={Gauge} />
        <Kpi label="Margem Media" value={`${avgMargin}%`} color={ACCENT} icon={BarChart3} />
        <Kpi label="Perdas Mes" value={`R$ ${(totalLoss / 1000).toFixed(1)}k`} color={RED} icon={TrendingUp} />
        <Kpi label="Handoffs Vencidos" value={String(vencidos)} color={RED} icon={ArrowRight} />
        <Kpi label="Dept Score D" value="0" color={GREEN} icon={Shield} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card className="p-4">
            <span className="uppercase tracking-[0.2em] block mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Tendencia 90 Dias</span>
            <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Perdas (R$k) vs Margem (%) vs Produtividade</p>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} id="exec-trend-chart">
                  <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis key="xaxis" dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis key="yaxis" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip key="tooltip" content={<CTip />} />
                  <Area key="area-perdas" type="monotone" dataKey="perdas" name="Perdas (R$k)" stroke={RED} fill={RED} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
                  <Area key="area-margem" type="monotone" dataKey="margem" name="Margem (%)" stroke={GREEN} fill={GREEN} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
                  <Area key="area-prod" type="monotone" dataKey="produtividade" name="Produtividade" stroke={BLUE} fill="none" strokeWidth={1.5} strokeDasharray="4 2" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <span className="uppercase tracking-[0.2em] block mb-3" style={{ fontSize: "0.5rem", color: ACCENT }}>Score Departamentos</span>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDist} id="exec-score-chart">
                  <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis key="xaxis" dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis key="yaxis" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip key="tooltip" content={<CTip />} />
                  <Bar dataKey="value" name="Dept" radius={[4, 4, 0, 0]} barSize={28} isAnimationActive={false}>
                    {scoreDist.map((e) => <Cell key={`score-${e.name}`} fill={e.fill} fillOpacity={0.7} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-4">
            <span className="uppercase tracking-[0.2em] block mb-3" style={{ fontSize: "0.5rem", color: ACCENT }}>Obras por Faixa de Risco</span>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskDist} id="exec-risk-chart">
                  <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis key="xaxis" dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis key="yaxis" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip key="tooltip" content={<CTip />} />
                  <Bar dataKey="count" name="Obras" radius={[4, 4, 0, 0]} barSize={28} isAnimationActive={false}>
                    {riskDist.map((d) => <Cell key={`risk-${d.name}`} fill={d.fill} fillOpacity={0.6} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-4">
        <span className="uppercase tracking-[0.2em] block mb-3" style={{ fontSize: "0.5rem", color: RED }}>Top 5 Prioridades</span>
        <div className="space-y-2">
          {priorities.slice(0, 5).map(p => (
            <div key={p.rank} className="flex items-center gap-3 p-2 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: p.rank <= 2 ? RED_DIM : YELLOW_DIM, color: p.rank <= 2 ? RED : YELLOW, fontSize: "0.6rem", fontWeight: 600 }}>{p.rank}</span>
              <div className="flex-1 min-w-0">
                <span className="text-white block" style={{ fontSize: "0.65rem", fontWeight: 500 }}>{p.title}</span>
                <span style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.3)" }}>{p.obra} - {p.responsible} - {p.deadline}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ======================= ACTION ENGINE ======================= */

function ActionEngineTab() {
  const [block, setBlock] = useState(0);
  const blocks = ["Top 10 Prioridades", "Top 5 Obras", "Top 5 Gargalos", "Top 5 Perdas", "Top 5 Decisoes CEO"];
  const topObras = [...obrasData].sort((a, b) => a.riskScore - b.riskScore).slice(0, 5);
  const gargalos = [
    { dept: "Projetos", issue: "Requisicoes voltando por falta de spec", count: 11, fix: "Travar requisicao sem versao aprovada" },
    { dept: "Producao", issue: "QA reprovando pecas por ficha desatualizada", count: 4, fix: "Versao ficha tecnica obrigatoria" },
    { dept: "Compras", issue: "Fornecedores sem confirmacao de prazo", count: 3, fix: "SLA 24h para confirmacao" },
    { dept: "Obras", issue: "Frentes nao liberadas na data", count: 2, fix: "Vistoria D-2 obrigatoria" },
    { dept: "Logistica", issue: "Romaneio com divergencia", count: 2, fix: "Conferencia 100% com foto" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {blocks.map((b, i) => (
          <button key={i} onClick={() => setBlock(i)} className="px-3 py-2 rounded-lg whitespace-nowrap transition-all"
            style={{ fontSize: "0.6rem", fontWeight: block === i ? 600 : 400, background: block === i ? "rgba(184,170,154,0.15)" : "rgba(255,255,255,0.03)", color: block === i ? ACCENT : "rgba(255,255,255,0.35)", border: `1px solid ${block === i ? "rgba(184,170,154,0.3)" : "transparent"}` }}>
            {b}
          </button>
        ))}
      </div>

      {block === 0 && <div className="space-y-2">
        {priorities.map(p => (
          <Card key={p.rank} className="p-3">
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: p.rank <= 3 ? RED_DIM : p.rank <= 6 ? YELLOW_DIM : BLUE_DIM, color: p.rank <= 3 ? RED : p.rank <= 6 ? YELLOW : BLUE, fontSize: "0.75rem", fontWeight: 600 }}>
                {String(p.rank).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white" style={{ fontSize: "0.7rem", fontWeight: 500 }}>{p.title}</span>
                  <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "0.45rem", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>{p.obra}</span>
                </div>
                <p style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.35)" }}>Motivo: {p.reason}</p>
                <div className="flex items-center gap-4 mt-2 pt-2" style={{ borderTop: "1px solid " + CARD_BORDER }}>
                  <span style={{ fontSize: "0.5rem", color: ACCENT }}>{p.responsible}</span>
                  <span style={{ fontSize: "0.5rem", color: RED }}>{p.deadline}</span>
                  <span style={{ fontSize: "0.5rem", color: GREEN }}>{p.action}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>}

      {block === 1 && <div className="space-y-3">
        {topObras.map(o => (
          <Card key={o.id} className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: getRiskBg(o.riskScore), fontSize: "1.1rem", fontWeight: 300, color: getRiskColor(o.riskScore) }}>{o.riskScore}</span>
              <div>
                <span className="text-white" style={{ fontSize: "0.75rem", fontWeight: 500 }}>{o.code} - {o.client}</span>
                <div className="flex items-center gap-1 mt-1">
                  {o.riskTrend < 0 ? <ArrowDownRight size={10} style={{ color: RED }} /> : <ArrowUpRight size={10} style={{ color: GREEN }} />}
                  <span style={{ fontSize: "0.5rem", color: o.riskTrend < 0 ? RED : GREEN }}>{o.riskTrend > 0 ? "+" : ""}{o.riskTrend} pts</span>
                </div>
              </div>
            </div>
            <div className="p-2 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span style={{ fontSize: "0.45rem", color: ACCENT }}>Riscos:</span>
              {o.topRisks.map((r, i) => <span key={i} style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.4)" }}>{" "}| {r}</span>)}
            </div>
          </Card>
        ))}
      </div>}

      {block === 2 && <div className="space-y-3">
        {gargalos.map((g, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 rounded-lg" style={{ fontSize: "0.6rem", fontWeight: 600, background: "rgba(184,170,154,0.12)", color: ACCENT }}>{g.dept}</span>
              <span className="ml-auto px-2 py-0.5 rounded-full" style={{ fontSize: "0.5rem", background: RED_DIM, color: RED }}>{g.count}x</span>
            </div>
            <p className="text-white" style={{ fontSize: "0.7rem", fontWeight: 500, marginBottom: 4 }}>{g.issue}</p>
            <div className="mt-2 p-2 rounded" style={{ background: GREEN_DIM }}>
              <span style={{ fontSize: "0.5rem", color: GREEN, fontWeight: 600 }}>Acao: </span>
              <span style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.5)" }}>{g.fix}</span>
            </div>
          </Card>
        ))}
      </div>}

      {block === 3 && <div className="space-y-3">
        {lossesData.map((l, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: (LOSS_COLORS[i] || RED) + "20" }}>
                <DollarSign size={14} style={{ color: LOSS_COLORS[i] || RED }} />
              </div>
              <div className="flex-1">
                <span className="text-white" style={{ fontSize: "0.7rem", fontWeight: 500 }}>{l.type}</span>
                <span className="ml-2 px-1.5 py-0.5 rounded" style={{ fontSize: "0.45rem", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>{l.obra}</span>
              </div>
              <span style={{ fontSize: "0.85rem", fontWeight: 300, color: RED }}>R$ {(l.value / 1000).toFixed(1)}k</span>
            </div>
            <p style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.35)" }}>Causa: {l.cause}</p>
            <div className="mt-2 p-2 rounded" style={{ background: GREEN_DIM }}>
              <span style={{ fontSize: "0.5rem", color: GREEN, fontWeight: 600 }}>Contramedida: </span>
              <span style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.5)" }}>{l.fix} - Dono: {l.owner}</span>
            </div>
          </Card>
        ))}
      </div>}

      {block === 4 && <div className="space-y-3">
        {founderDecisions.map(d => (
          <Card key={d.id} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(184,170,154,0.15)", color: ACCENT }}><Crown size={14} /></span>
              <span className="text-white" style={{ fontSize: "0.75rem", fontWeight: 500 }}>{d.title}</span>
            </div>
            <p style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.35)" }}><b style={{ color: ACCENT }}>Contexto:</b> {d.context}</p>
            <p style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.35)" }}><b style={{ color: BLUE }}>Recomendacao IA:</b> {d.rec}</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="p-2 rounded" style={{ background: GREEN_DIM }}>
                <span style={{ fontSize: "0.45rem", color: GREEN, fontWeight: 600 }}>Se decidir hoje</span>
                <p style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{d.ifNow}</p>
              </div>
              <div className="p-2 rounded" style={{ background: RED_DIM }}>
                <span style={{ fontSize: "0.45rem", color: RED, fontWeight: 600 }}>Se adiar</span>
                <p style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{d.ifLater}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>}
    </div>
  );
}

/* ======================= RISK ======================= */

function RiskTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const sorted = [...obrasData].sort((a, b) => a.riskScore - b.riskScore);
  return (
    <div className="space-y-3">
      {sorted.map(o => {
        const isExp = expanded === o.id;
        return (
          <Card key={o.id} className="overflow-hidden">
            <div className="p-3 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => setExpanded(isExp ? null : o.id)}>
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: getRiskBg(o.riskScore), fontSize: "1.1rem", fontWeight: 300, color: getRiskColor(o.riskScore) }}>{o.riskScore}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white" style={{ fontSize: "0.7rem", fontWeight: 500 }}>{o.code}</span>
                    <RiskBadge score={o.riskScore} />
                    <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "0.45rem", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>{o.typeLabel}</span>
                    {o.riskScore < 60 && <span className="px-1.5 py-0.5 rounded animate-pulse" style={{ fontSize: "0.45rem", background: RED_DIM, color: RED }}>WAR ROOM</span>}
                  </div>
                  <span style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.4)" }}>{o.client} - {o.location} - {o.responsible}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-white block" style={{ fontSize: "0.7rem" }}>{o.value}</span>
                  <div className="flex items-center gap-1 justify-end">
                    {o.riskTrend < 0 ? <ArrowDownRight size={10} style={{ color: RED }} /> : <ArrowUpRight size={10} style={{ color: GREEN }} />}
                    <span style={{ fontSize: "0.5rem", color: o.riskTrend < 0 ? RED : GREEN }}>{o.riskTrend > 0 ? "+" : ""}{o.riskTrend}</span>
                  </div>
                </div>
                {isExp ? <ChevronDown size={14} style={{ color: ACCENT }} /> : <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.2)" }} />}
              </div>
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: o.progress + "%", background: getRiskColor(o.riskScore) }} />
              </div>
            </div>
            {isExp && (
              <div className="px-3 pb-3" style={{ borderTop: "1px solid " + CARD_BORDER }}>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3 mb-3">
                  {[
                    { l: "Avanco", v: o.progress + "%" },
                    { l: "Dias", v: o.daysRemaining + "d", c: o.daysRemaining < 10 ? RED : undefined },
                    { l: "Custo Orc.", v: "R$ " + (o.costBudget / 1000).toFixed(0) + "k" },
                    { l: "Custo Real", v: "R$ " + (o.costReal / 1000).toFixed(0) + "k", c: o.costReal > o.costBudget ? RED : undefined },
                    { l: "Margem Orc.", v: o.marginBudget + "%" },
                    { l: "Margem Real", v: o.marginReal + "%", c: o.marginReal < o.marginBudget ? YELLOW : GREEN },
                  ].map(x => (
                    <div key={x.l}><span style={{ fontSize: "0.45rem", color: "rgba(255,255,255,0.25)" }}>{x.l}</span><p style={{ fontSize: "0.65rem", color: x.c || "rgba(255,255,255,0.6)" }}>{x.v}</p></div>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div><span style={{ fontSize: "0.45rem", color: "rgba(255,255,255,0.25)" }}>NC</span><p style={{ fontSize: "0.65rem", color: o.ncOpen > 0 ? RED : GREEN }}>{o.ncOpen}</p></div>
                  <div><span style={{ fontSize: "0.45rem", color: "rgba(255,255,255,0.25)" }}>Retrabalho</span><p style={{ fontSize: "0.65rem", color: o.rework > 2 ? YELLOW : "rgba(255,255,255,0.6)" }}>{o.rework}h</p></div>
                  <div><span style={{ fontSize: "0.45rem", color: "rgba(255,255,255,0.25)" }}>Bloqueios</span><p style={{ fontSize: "0.65rem", color: o.blockers > 0 ? RED : GREEN }}>{o.blockers}</p></div>
                  <div><span style={{ fontSize: "0.45rem", color: "rgba(255,255,255,0.25)" }}>Mud. Escopo</span><p style={{ fontSize: "0.65rem", color: o.scopeChanges > 1 ? YELLOW : "rgba(255,255,255,0.6)" }}>{o.scopeChanges}</p></div>
                </div>
                <div className="p-2 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <span style={{ fontSize: "0.45rem", color: ACCENT }}>Riscos: </span>
                  {o.topRisks.map((r, i) => <span key={i} style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.4)" }}>{i > 0 ? " | " : ""}{r}</span>)}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ======================= DEPARTMENTS ======================= */

function DepartmentsTab() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {["A", "B", "C", "D"].map(s => (
          <Card key={s} className="p-3 text-center">
            <ScoreBadge score={s} size="lg" />
            <p style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{deptData.filter(d => d.score === s).length} dept.</p>
          </Card>
        ))}
        <Card className="p-3 text-center">
          <span className="text-white block" style={{ fontSize: "1.3rem", fontWeight: 300 }}>{(deptData.reduce((s, d) => s + d.slaPct, 0) / deptData.length).toFixed(0)}%</span>
          <p style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>SLA medio</p>
        </Card>
      </div>
      {deptData.map(d => {
        const Icon = DEPT_ICONS[d.name] || Target;
        const color = DEPT_COLORS[d.name] || ACCENT;
        return (
          <Card key={d.name} className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: color + "20" }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white" style={{ fontSize: "0.75rem", fontWeight: 500 }}>{d.name}</span>
                  <ScoreBadge score={d.score} />
                  <span className="ml-auto" style={{ fontSize: "0.5rem", color: d.trend === "caindo" ? RED : d.trend === "subindo" ? GREEN : "rgba(255,255,255,0.3)" }}>{d.trend}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { l: "SLA", v: d.slaPct + "%", c: d.slaPct >= 90 ? GREEN : d.slaPct >= 80 ? YELLOW : RED },
                { l: "Handoffs OK", v: d.handoffOk + "%", c: d.handoffOk >= 90 ? GREEN : d.handoffOk >= 80 ? YELLOW : RED },
                { l: "Bloqueados", v: String(d.blocked), c: d.blocked === 0 ? GREEN : RED },
                { l: "Retrabalho", v: String(d.rework), c: d.rework === 0 ? GREEN : d.rework <= 1 ? YELLOW : RED },
                { l: "Backlog", v: String(d.backlog), c: d.backlog === 0 ? GREEN : d.backlog <= 1 ? YELLOW : RED },
                { l: "Checklist", v: d.checklist + "%", c: d.checklist >= 90 ? GREEN : d.checklist >= 80 ? YELLOW : RED },
              ].map(m => (
                <div key={m.l} className="text-center p-1.5 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <span style={{ fontSize: "0.45rem", color: "rgba(255,255,255,0.25)" }}>{m.l}</span>
                  <p style={{ fontSize: "0.65rem", color: m.c, fontWeight: 500 }}>{m.v}</p>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ======================= PRODUCTIVITY ======================= */

function ProductivityTab() {
  const margins = obrasData.map(o => ({ name: o.code, orcado: o.marginBudget, real: o.marginReal }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Kpi label="Margem Media" value="34.2%" color={GREEN} icon={BarChart3} />
        <Kpi label="Custo Hora" value="R$ 85" color={ACCENT} icon={Clock} />
        <Kpi label="Produtividade" value="78%" color={BLUE} icon={Activity} />
        <Kpi label="Horas Improd." value="22%" color={RED} icon={Clock} />
        <Kpi label="Retrabalho" value="R$ 12.7k" color={RED} icon={Wrench} />
        <Kpi label="Frete Extra" value="R$ 3.8k" color={ORANGE} icon={Truck} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <span className="uppercase tracking-[0.2em] block mb-3" style={{ fontSize: "0.5rem", color: ACCENT }}>Margem por Obra</span>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={margins} id="prod-margin-chart">
                <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis key="xaxis" dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis key="yaxis" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip key="tooltip" content={<CTip />} />
                <Bar key="bar-orcado" dataKey="orcado" name="Orcado (%)" fill={ACCENT} fillOpacity={0.3} radius={[4, 4, 0, 0]} barSize={14} isAnimationActive={false} />
                <Bar key="bar-real" dataKey="real" name="Real (%)" fill={GREEN} fillOpacity={0.7} radius={[4, 4, 0, 0]} barSize={14} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <span className="uppercase tracking-[0.2em] block mb-3" style={{ fontSize: "0.5rem", color: ACCENT }}>Tendencia</span>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} id="prod-trend-chart">
                <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis key="xaxis" dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis key="yaxis" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip key="tooltip" content={<CTip />} />
                <Area key="area-prod2" type="monotone" dataKey="produtividade" name="Produtividade (%)" stroke={BLUE} fill={BLUE} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
                <Area key="area-perdas2" type="monotone" dataKey="perdas" name="Perdas (R$k)" stroke={RED} fill="none" strokeWidth={1.5} strokeDasharray="4 2" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ======================= LOSSES ======================= */

function LossesTab() {
  const total = lossesData.reduce((s, l) => s + l.value, 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <Kpi label="Total Perdas" value={`R$ ${(total / 1000).toFixed(1)}k`} color={RED} icon={TrendingUp} />
        <Kpi label="Retrabalho" value="R$ 8.2k" color={RED} icon={Wrench} />
        <Kpi label="Frete Extra" value="R$ 3.8k" color={ORANGE} icon={Truck} />
        <Kpi label="Urgencia" value="R$ 2.9k" color={YELLOW} icon={Package} />
        <Kpi label="Improdutividade" value="R$ 4.5k" color={PURPLE} icon={Clock} />
      </div>
      {lossesData.map((l, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: (LOSS_COLORS[i] || RED) + "20" }}>
              <DollarSign size={14} style={{ color: LOSS_COLORS[i] || RED }} />
            </div>
            <div className="flex-1">
              <span className="text-white" style={{ fontSize: "0.7rem", fontWeight: 500 }}>{l.type}</span>
              <span className="ml-2 px-1.5 py-0.5 rounded" style={{ fontSize: "0.45rem", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>{l.obra}</span>
            </div>
            <span style={{ fontSize: "0.85rem", fontWeight: 300, color: RED }}>R$ {(l.value / 1000).toFixed(1)}k</span>
          </div>
          <p style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.35)" }}>Causa: {l.cause}</p>
          <div className="mt-2 p-2 rounded" style={{ background: GREEN_DIM }}>
            <span style={{ fontSize: "0.5rem", color: GREEN, fontWeight: 600 }}>Contramedida: </span>
            <span style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.5)" }}>{l.fix} - Dono: {l.owner}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ======================= HANDOFFS ======================= */

function HandoffsTab() {
  const ok = handoffsData.filter(h => h.status === "ok").length;
  const pend = handoffsData.filter(h => h.status === "pendente").length;
  const venc = handoffsData.filter(h => h.status === "vencido").length;
  const sorted = [...handoffsData].sort((a, b) => a.status === "vencido" ? -1 : b.status === "vencido" ? 1 : a.status === "pendente" ? -1 : 1);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Total" value={String(handoffsData.length)} color={ACCENT} icon={ArrowRight} />
        <Kpi label="OK" value={String(ok)} color={GREEN} icon={CheckCircle2} />
        <Kpi label="Pendentes" value={String(pend)} color={YELLOW} icon={Clock} />
        <Kpi label="Vencidos" value={String(venc)} color={RED} icon={XCircle} />
      </div>
      <div className="space-y-2">
        {sorted.map(h => {
          const c = h.status === "ok" ? GREEN : h.status === "vencido" ? RED : YELLOW;
          const bg = h.status === "ok" ? GREEN_DIM : h.status === "vencido" ? RED_DIM : YELLOW_DIM;
          return (
            <Card key={h.id} className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                  {h.status === "ok" ? <CheckCircle2 size={14} style={{ color: c }} /> : h.status === "vencido" ? <XCircle size={14} style={{ color: c }} /> : <Clock size={14} style={{ color: c }} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white" style={{ fontSize: "0.7rem", fontWeight: 500 }}>{h.from} &gt; {h.to}</span>
                    <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "0.45rem", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>{h.obra}</span>
                    <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "0.45rem", background: bg, color: c }}>{h.status.toUpperCase()}</span>
                  </div>
                  {h.status !== "ok" && (
                    <span style={{ fontSize: "0.5rem", color: h.slaLeft < 0 ? RED : YELLOW }}>
                      {h.slaLeft < 0 ? `Vencido ha ${Math.abs(h.slaLeft)} dias` : `${h.slaLeft} dias restantes`}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ======================= WAR ROOM ======================= */

function WarRoomTab() {
  const warObras = obrasData.filter(o => o.riskScore < 60);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Obras War Room" value={String(warObras.length)} color={RED} icon={Flame} />
        <Kpi label="Gates Vencidos" value={String(handoffsData.filter(h => h.status === "vencido").length)} color={RED} icon={XCircle} />
        <Kpi label="Margem Negativa" value="0" color={GREEN} icon={DollarSign} />
      </div>
      {warObras.length > 0 ? warObras.map(o => (
        <Card key={o.id} className="p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Flame size={14} style={{ color: RED }} className="animate-pulse" />
            <span className="uppercase tracking-[0.15em]" style={{ fontSize: "0.55rem", color: RED, fontWeight: 600 }}>War Room Ativa</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ background: RED_DIM, fontSize: "1.4rem", fontWeight: 300, color: RED }}>{o.riskScore}</span>
            <div>
              <span className="text-white block" style={{ fontSize: "0.85rem", fontWeight: 500 }}>{o.code} - {o.client}</span>
              <span style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.4)" }}>{o.location} - {o.typeLabel} - {o.value}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
              <span style={{ fontSize: "0.5rem", color: RED, fontWeight: 600 }}>Causa Raiz</span>
              {o.topRisks.map((r, i) => <p key={i} style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>- {r}</p>)}
            </div>
            <div className="p-3 rounded" style={{ background: GREEN_DIM }}>
              <span style={{ fontSize: "0.5rem", color: GREEN, fontWeight: 600 }}>Plano</span>
              <p style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>1. Resolver bloqueio em 24h</p>
              <p style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.5)" }}>2. Alinhar stakeholders</p>
              <p style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.5)" }}>3. Revalidar cronograma</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: "1px solid " + CARD_BORDER }}>
            <span style={{ fontSize: "0.5rem", color: ACCENT }}>Dono: {o.responsible}</span>
            <span style={{ fontSize: "0.5rem", color: RED }}>Prazo: 48h</span>
            <span style={{ fontSize: "0.5rem", color: YELLOW }}>Saida: Score &gt; 65</span>
          </div>
        </Card>
      )) : (
        <Card className="p-8 text-center">
          <CheckCircle2 size={32} style={{ color: GREEN, margin: "0 auto 12px" }} />
          <p className="text-white" style={{ fontSize: "0.85rem", fontWeight: 500 }}>Nenhuma War Room ativa</p>
          <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Todas as obras acima do score 60</p>
        </Card>
      )}
    </div>
  );
}

/* ======================= CONTROL TOWER ======================= */

function ControlTowerTab() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Vermelhos" value={String(alertsRed.length)} color={RED} icon={CircleAlert} />
        <Kpi label="Amarelos" value={String(alertsYellow.length)} color={YELLOW} icon={TriangleAlert} />
        <Kpi label="Azuis" value={String(alertsBlue.length)} color={BLUE} icon={Info} />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: RED }} />
          <span className="uppercase tracking-[0.2em]" style={{ fontSize: "0.55rem", color: RED, fontWeight: 600 }}>Vermelho - Imediato</span>
        </div>
        {alertsRed.map((a, i) => (
          <div key={i} className="p-3 rounded-lg border mb-2" style={{ background: RED_DIM, borderColor: "rgba(248,113,113,0.2)" }}>
            <div className="flex items-center gap-2 mb-1">
              <XCircle size={12} style={{ color: RED }} />
              <span style={{ fontSize: "0.6rem", color: RED, fontWeight: 600 }}>{a.obra}</span>
              <span className="ml-auto px-1.5 py-0.5 rounded" style={{ fontSize: "0.45rem", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>{a.responsible}</span>
            </div>
            <p style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.5)" }}>{a.msg}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full" style={{ background: YELLOW }} />
          <span className="uppercase tracking-[0.2em]" style={{ fontSize: "0.55rem", color: YELLOW, fontWeight: 600 }}>Amarelo - Diario</span>
        </div>
        {alertsYellow.map((a, i) => (
          <div key={i} className="p-3 rounded-lg border mb-2" style={{ background: YELLOW_DIM, borderColor: "rgba(251,191,36,0.15)" }}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={12} style={{ color: YELLOW }} />
              <span style={{ fontSize: "0.6rem", color: YELLOW, fontWeight: 600 }}>{a.obra}</span>
              <span className="ml-auto px-1.5 py-0.5 rounded" style={{ fontSize: "0.45rem", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>{a.responsible}</span>
            </div>
            <p style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.5)" }}>{a.msg}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full" style={{ background: BLUE }} />
          <span className="uppercase tracking-[0.2em]" style={{ fontSize: "0.55rem", color: BLUE, fontWeight: 600 }}>Azul - Insights</span>
        </div>
        {alertsBlue.map((a, i) => (
          <div key={i} className="p-3 rounded-lg border mb-2" style={{ background: BLUE_DIM, borderColor: "rgba(96,165,250,0.15)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Info size={12} style={{ color: BLUE }} />
              <span style={{ fontSize: "0.6rem", color: BLUE, fontWeight: 600 }}>{a.obra}</span>
            </div>
            <p style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.5)" }}>{a.msg}</p>
          </div>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={14} style={{ color: ACCENT }} />
          <span className="uppercase tracking-[0.2em]" style={{ fontSize: "0.55rem", color: ACCENT }}>Sugestoes IA</span>
        </div>
        {[
          "Destravar PKT-047 (score 52) deve ser prioridade #1",
          "Projetos gerando 11 retornos por falta de spec - criar campo obrigatorio",
          "Equipe Alpha com 28% acima da media - considerar bonus",
          "PKT-053 precisa vistoria antes de sexta ou entra em War Room",
        ].map((s, i) => (
          <div key={i} className="flex items-start gap-2 mb-2">
            <Zap size={10} style={{ color: ACCENT, marginTop: 3, flexShrink: 0 }} />
            <p style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{s}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ======================= TEAM ======================= */

function TeamTab() {
  const team = [
    { name: "Talita", role: "Coord. Atendimento", color: ACCENT, obras: 2, icon: Users },
    { name: "Tainara", role: "Projetista", color: BLUE, obras: 2, icon: Eye },
    { name: "Carla", role: "Gerente Comercial", color: GREEN, obras: 1, icon: Briefcase },
    { name: "Ailton", role: "Logistica", color: YELLOW, obras: 7, icon: Truck },
    { name: "Dani", role: "Admin/RH", color: PURPLE, obras: 7, icon: Shield },
    { name: "Nat", role: "Marketing", color: TEAL, obras: 0, icon: Star },
    { name: "Germano", role: "Marcenaria", color: RED, obras: 2, icon: HardHat },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {team.map(m => {
          const Icon = m.icon;
          return (
            <Card key={m.name} className="p-3 text-center">
              <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-2" style={{ background: m.color + "20" }}>
                <Icon size={16} style={{ color: m.color }} />
              </div>
              <p className="text-white" style={{ fontSize: "0.7rem", fontWeight: 500 }}>{m.name}</p>
              <p style={{ fontSize: "0.5rem", color: m.color }}>{m.role}</p>
              <p style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{m.obras} obras</p>
            </Card>
          );
        })}
      </div>
      <Card className="p-4">
        <span className="uppercase tracking-[0.2em] block mb-3" style={{ fontSize: "0.5rem", color: ACCENT }}>Carga por Membro</span>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={team} id="team-chart">
              <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis key="xaxis" dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis key="yaxis" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip key="tooltip" content={<CTip />} />
              <Bar dataKey="obras" name="Obras" radius={[4, 4, 0, 0]} barSize={24} isAnimationActive={false}>
                {team.map((m) => <Cell key={`team-${m.name}`} fill={m.color} fillOpacity={0.6} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

/* ======================= MAIN ======================= */

export function DashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("executive");
  const dashData = useDashboardData();
  /* Use dynamic obrasCC if loaded, else fall back to static */
  const liveObras = dashData.obrasCC.length > 0 ? dashData.obrasCC : (obrasData as any[]);
  const critCount = liveObras.filter((o: any) => o.riskScore < 60).length;
  const warActive = critCount > 0;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "executive", label: "Executivo", icon: Building2 },
    { id: "engine", label: "Action Engine", icon: Zap },
    { id: "risk", label: "Obras & Risco", icon: Gauge },
    { id: "departments", label: "Departamentos", icon: Layers },
    { id: "productivity", label: "Produtividade", icon: BarChart3 },
    { id: "losses", label: "Perdas", icon: TrendingUp },
    { id: "handoffs", label: "Handoffs", icon: ArrowRight },
    { id: "warroom", label: "War Room", icon: Flame },
    { id: "tower", label: "Control Tower", icon: Radio },
    { id: "team", label: "Equipe", icon: Users },
  ];

  return (
    <DashboardCtx.Provider value={dashData}>
    <div className="min-h-screen w-full overflow-auto" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b" style={{ background: "rgba(10,10,10,0.85)", borderColor: CARD_BORDER }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="p-1.5 rounded hover:bg-white/[0.05] transition-colors" title="Voltar">
              <ChevronLeft size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
            </button>
            <div className="h-4 w-px" style={{ background: CARD_BORDER }} />
            <div>
              <h1 className="text-white" style={{ fontSize: "0.8rem", fontWeight: 500, letterSpacing: "0.05em" }}>Parket Command Center</h1>
              <span style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.25)" }}>7 obras - 10 departamentos - 60+ indicadores</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {warActive && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full animate-pulse" style={{ background: RED_DIM, fontSize: "0.55rem", color: RED }}>
                <Flame size={10} /> {critCount} War Room
              </span>
            )}
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: GREEN_DIM, fontSize: "0.55rem", color: GREEN }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: GREEN }} />
              Live
            </span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-0.5 -mb-px overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-2.5 transition-colors relative whitespace-nowrap"
                  style={{ color: isActive ? (tab.id === "warroom" && warActive ? RED : ACCENT) : "rgba(255,255,255,0.3)" }}>
                  <Icon size={12} />
                  <span style={{ fontSize: "0.6rem", fontWeight: isActive ? 600 : 400 }}>{tab.label}</span>
                  {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: tab.id === "warroom" && warActive ? RED : ACCENT }} />}
                  {tab.id === "warroom" && warActive && !isActive && <span className="w-1.5 h-1.5 rounded-full absolute top-2 right-1 animate-pulse" style={{ background: RED }} />}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {activeTab === "executive" && <ExecutiveTab />}
        {activeTab === "engine" && <ActionEngineTab />}
        {activeTab === "risk" && <RiskTab />}
        {activeTab === "departments" && <DepartmentsTab />}
        {activeTab === "productivity" && <ProductivityTab />}
        {activeTab === "losses" && <LossesTab />}
        {activeTab === "handoffs" && <HandoffsTab />}
        {activeTab === "warroom" && <WarRoomTab />}
        {activeTab === "tower" && <ControlTowerTab />}
        {activeTab === "team" && <TeamTab />}
      </main>

      <footer className="border-t py-4 mt-8" style={{ borderColor: CARD_BORDER }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between flex-wrap gap-2">
          <span style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.15)" }}>Parket Pisos - Command Center v2</span>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/command-center")} className="flex items-center gap-1 hover:text-white/50 transition-colors" style={{ fontSize: "0.55rem", color: ACCENT }}>
              Slides <ArrowUpRight size={10} />
            </button>
            <button onClick={() => navigate("/enterprise-os")} className="flex items-center gap-1 hover:text-white/50 transition-colors" style={{ fontSize: "0.55rem", color: ACCENT }}>
              Enterprise OS <ArrowUpRight size={10} />
            </button>
          </div>
        </div>
      </footer>
    </div>
    </DashboardCtx.Provider>
  );
}
