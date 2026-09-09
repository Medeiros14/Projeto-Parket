/* ═══ PROJETOS — Visao da Thainara (Coordenadora de Projetos) ═══ */
import React from "react";
import {
  DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem,
  CTip, TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT,
  BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD, TEAL,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  LineChart, Line,
} from "../components/dept-layout";
import { GitBranch, FileCheck, Layers, Clock, Eye, FileText, Ruler, CheckCircle2, Users, Target, Calendar, BarChart2, ShoppingCart } from "lucide-react";
import { useProjetos } from "../hooks/useProjetos";
import { Btn } from "../components/modal";
import { EquipeDemandasTab, SlaTemplatesTab, CalendarioProjetosTab, TimelineProjetosTab } from "./projetos-extra-tabs";
import { SolicitacaoComprasTab } from "../components/dept-layout";

const LEAD_TIME_DATA = [
  { mes: "Set", tempo: 12.5 }, { mes: "Out", tempo: 11.2 }, { mes: "Nov", tempo: 10.1 },
  { mes: "Dez", tempo: 9.8 }, { mes: "Jan", tempo: 9.2 }, { mes: "Fev", tempo: 8.5 },
];

const VERSION_HISTORY = [
  { obra: "PKT-047", versoes: 3, status: "bloqueado", dias: 12, cliente: "Nao responde" },
  { obra: "PKT-051", versoes: 2, status: "bloqueado", dias: 8, cliente: "Compatibilizacao" },
  { obra: "PKT-048", versoes: 1, status: "em andamento", dias: 3, cliente: "Desenvolvimento" },
  { obra: "PKT-053", versoes: 2, status: "aprovado", dias: 0, cliente: "Aprovado hoje" },
  { obra: "PKT-045", versoes: 2, status: "bom pronto", dias: 0, cliente: "BOM gerado" },
];

const BOM_TRACKER = [
  { obra: "PKT-045", itens: 42, conferidos: 42, status: "completo", valor: "R$ 28k" },
  { obra: "PKT-048", itens: 38, conferidos: 12, status: "parcial", valor: "R$ 35k" },
  { obra: "PKT-053", itens: 25, conferidos: 25, status: "completo", valor: "R$ 67k" },
  { obra: "PKT-058", itens: 0, conferidos: 0, status: "pendente", valor: "R$ 180k" },
];

const APPROVAL_QUEUE = [
  { obra: "PKT-047", tipo: "Gate Freeze", versao: "v3", diasPendente: 12, urgencia: "critico", arq: "Arq. Carolina" },
  { obra: "PKT-051", tipo: "Compatibilizacao", versao: "v2", diasPendente: 8, urgencia: "critico", arq: "Arq. Fernanda" },
  { obra: "PKT-048", tipo: "Revisao Paginacao", versao: "v1", diasPendente: 2, urgencia: "normal", arq: "Arq. Marina" },
  { obra: "PKT-058", tipo: "Pre-Projeto", versao: "-", diasPendente: 0, urgencia: "novo", arq: "Arq. Debora Aguiar" },
];

function VersosBOMTab() {
  const { leadTime: dbLT, versoes: dbVersoes, bom: dbBOM } = useProjetos();
  const leadTimeData = dbLT.length > 0 ? dbLT : LEAD_TIME_DATA;
  const versoes = dbVersoes.length > 0 ? dbVersoes.map(v => ({
    obra: v.obra_code, versoes: v.versoes, status: v.status, dias: v.dias, cliente: v.cliente,
  })) : VERSION_HISTORY;
  const bom = dbBOM.length > 0 ? dbBOM.map(b => ({
    obra: b.obra_code, itens: b.itens, conferidos: b.conferidos, status: b.status, valor: b.valor,
  })) : BOM_TRACKER;
  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Controle de Versoes & BOM</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Historico de versoes e lista de materiais por obra</p></div>

      {/* Lead Time Chart */}
      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Evolucao do Lead Time (dias)</p>
        <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: 16 }}>Meta: menor que 10 dias</p>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={leadTimeData}>
              <CartesianGrid key="cg" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis key="xa" dataKey="mes" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
              <YAxis key="ya" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} domain={[6, 14]} />
              <Tooltip key="tt" content={<CTip />} />
              <Line key="lt" type="monotone" dataKey="tempo" name="Lead Time" stroke="#60A5FA" strokeWidth={2} dot={{ fill: "#60A5FA", r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Version History Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>Historico de Versoes por Obra</p>
        </div>
        {versoes.map((v, i) => {
          const statusColor = v.status === "bloqueado" ? RED : v.status === "aprovado" ? GREEN : v.status === "bom pronto" ? PURPLE : BLUE;
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <span className="text-white" style={{ fontSize: "0.72rem", fontWeight: 600, width: 70 }}>{v.obra}</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: v.versoes }).map((_, vi) => (
                  <div key={vi} className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${statusColor}20`, fontSize: "0.45rem", fontWeight: 700, color: statusColor }}>v{vi + 1}</div>
                ))}
              </div>
              <span className="flex-1 truncate" style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{v.cliente}</span>
              {v.dias > 0 && <span style={{ fontSize: "0.55rem", color: v.dias > 5 ? RED : YELLOW }}>{v.dias}d pendente</span>}
              <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${statusColor}15`, color: statusColor }}>{v.status}</span>
            </div>
          );
        })}
      </div>

      {/* BOM Tracker */}
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>BOM Tracker — Lista de Materiais</p>
        </div>
        {bom.map((b, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <span className="text-white" style={{ fontSize: "0.72rem", fontWeight: 600, width: 70 }}>{b.obra}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{b.conferidos}/{b.itens} itens</span>
                <span style={{ fontSize: "0.55rem", color: ACCENT }}>{b.valor}</span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: b.itens > 0 ? `${(b.conferidos / b.itens) * 100}%` : "0%", background: b.status === "completo" ? GREEN : b.status === "parcial" ? ORANGE : YELLOW }} />
              </div>
            </div>
            <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: b.status === "completo" ? "rgba(16,185,129,0.12)" : b.status === "parcial" ? "rgba(249,115,22,0.12)" : "rgba(245,158,11,0.12)", color: b.status === "completo" ? GREEN : b.status === "parcial" ? ORANGE : YELLOW }}>{b.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AprovacoesFila() {
  const { aprovacoes: dbAprovacoes, aprovarAprovacao, escalarAprovacao } = useProjetos();
  const rawAprovacoes = dbAprovacoes.length > 0 ? dbAprovacoes : null;
  const aprovacoes = rawAprovacoes
    ? rawAprovacoes.map(a => ({ id: a.id, obra: a.obra_code, tipo: a.tipo, versao: a.versao, diasPendente: a.dias_pendente, urgencia: a.urgencia as string, arq: a.arquiteto }))
    : APPROVAL_QUEUE.map((a, i) => ({ id: String(i), ...a, arq: a.arq }));
  const [localUrgencia, setLocalUrgencia] = React.useState<Record<string, string>>({});
  const [localAprovados, setLocalAprovados] = React.useState<Set<string>>(new Set());
  const [contatoMsg, setContatoMsg] = React.useState<string | null>(null);
  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Fila de Aprovacoes</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Projetos aguardando aprovacao de cliente ou compatibilizacao</p></div>
      {contatoMsg && (
        <div className="rounded-xl p-3" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}>
          <p style={{ fontSize: "0.65rem", color: BLUE }}>{contatoMsg}</p>
        </div>
      )}
      <div className="space-y-3">
        {aprovacoes.filter(a => !localAprovados.has(a.id)).map((a, i) => {
          const effectiveUrgencia = localUrgencia[a.id] ?? a.urgencia;
          const uc = effectiveUrgencia === "critico" ? RED : effectiveUrgencia === "novo" ? BLUE : GREEN;
          return (
            <div key={i} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${effectiveUrgencia === "critico" ? "rgba(239,68,68,0.15)" : BORDER}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-white" style={{ fontSize: "0.82rem", fontWeight: 600 }}>{a.obra}</span>
                  {a.versao !== "-" && <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.45rem", background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>{a.versao}</span>}
                </div>
                <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: `${uc}15`, color: uc }}>{effectiveUrgencia}</span>
              </div>
              <p style={{ fontSize: "0.7rem", color: TEXT_MED }}>{a.tipo} — {a.arq}</p>
              {a.diasPendente > 0 && <p className="mt-1" style={{ fontSize: "0.6rem", color: a.diasPendente > 5 ? RED : YELLOW }}>Pendente ha {a.diasPendente} dias</p>}
              <div className="flex gap-2 mt-3">
                {rawAprovacoes && effectiveUrgencia !== "critico" && (
                  <Btn color={RED} onClick={() => escalarAprovacao(a.id)}>Escalar</Btn>
                )}
                {rawAprovacoes && (
                  <Btn color={GREEN} onClick={() => aprovarAprovacao(a.id)}>Aprovar</Btn>
                )}
                {!rawAprovacoes && effectiveUrgencia !== "critico" && (
                  <Btn color={RED} onClick={() => setLocalUrgencia(s => ({ ...s, [a.id]: "critico" }))}>Escalar</Btn>
                )}
                {!rawAprovacoes && (
                  <>
                    <Btn color={GREEN} onClick={() => setLocalAprovados(s => new Set([...s, a.id]))}>Aprovar</Btn>
                    <Btn color={BLUE} onClick={() => { setContatoMsg(`Contato solicitado com cliente — ${a.obra} (${a.arq})`); setTimeout(() => setContatoMsg(null), 5000); }}>Contato Cliente</Btn>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const extraTabs: ExtraTab[] = [
  { id: "versoes", label: "Versoes & BOM", icon: GitBranch, render: () => <VersosBOMTab /> },
  { id: "aprovacoes", label: "Fila Aprovacoes", icon: FileCheck, render: () => <AprovacoesFila /> },
  { id: "equipe", label: "Equipe & Demandas", icon: Users, render: () => <EquipeDemandasTab /> },
  { id: "sla", label: "SLA & Prazos", icon: Target, render: () => <SlaTemplatesTab /> },
  { id: "calendario", label: "Calendario", icon: Calendar, render: () => <CalendarioProjetosTab /> },
  { id: "timeline", label: "Timeline", icon: BarChart2, render: () => <TimelineProjetosTab /> },
  { id: "solicitar-compras", label: "Solicitar Compras", icon: ShoppingCart, render: () => <SolicitacaoComprasTab /> },
];

const team: TeamMember[] = [];

const quickActions: QuickAction[] = [
  { label: "Nova Versao", icon: GitBranch, color: BLUE },
  { label: "Gerar BOM", icon: Layers, color: PURPLE, badge: "2" },
  { label: "Aprovacoes", icon: FileCheck, color: YELLOW, badge: "5" },
  { label: "Workspace", icon: Eye, color: GREEN },
];

const activity: ActivityItem[] = [
  { id: "1", text: "PKT-053: Projeto executivo aprovado pela Arq. — Gate Freeze liberado", time: "Hoje 10:15", type: "completed" },
  { id: "2", text: "PKT-047: 12 dias sem resposta do cliente — Gate Freeze BLOQUEADO", time: "Hoje 08:00", type: "alert" },
  { id: "3", text: "PKT-048: Versao v1 em desenvolvimento — paginacao + alcapoes", time: "Hoje 09:30", type: "update" },
  { id: "4", text: "PKT-058: Briefing recebido do Comercial — iniciar pre-projeto", time: "Ontem 16:00", type: "action" },
  { id: "5", text: "PKT-045: BOM v2 finalizado — 42 itens conferidos — enviando para Ronaldo", time: "Ontem 14:00", type: "completed" },
  { id: "6", text: "PKT-051: Compatibilizacao com eng. civil pendente ha 8 dias", time: "Ontem 09:00", type: "alert" },
];

export function DeptProjetosPage() {
  const tabRef = React.useRef<((tabId: string) => void) | null>(null);
  const qa: QuickAction[] = [
    { label: "Nova Versao", icon: GitBranch, color: BLUE, onClick: () => tabRef.current?.("versoes") },
    { label: "Aprovacoes", icon: FileCheck, color: YELLOW, badge: "5", onClick: () => tabRef.current?.("aprovacoes") },
    { label: "Equipe", icon: Users, color: PURPLE, onClick: () => tabRef.current?.("equipe") },
    { label: "SLA", icon: Target, color: ORANGE, onClick: () => tabRef.current?.("sla") },
    { label: "Calendario", icon: Calendar, color: TEAL, onClick: () => tabRef.current?.("calendario") },
    { label: "Solicitar Compras", icon: ShoppingCart, color: "#10B981", onClick: () => document.dispatchEvent(new CustomEvent("open-solicitar-compras")) },
  ];
  return <DeptPage deptId="projetos" extraTabs={extraTabs} team={team} quickActions={qa} activity={activity} tabSwitcherRef={tabRef} />;
}
