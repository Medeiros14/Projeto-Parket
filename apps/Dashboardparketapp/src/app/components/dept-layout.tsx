/* ═══════════════════════════════════════════════════════════════
   DEPT LAYOUT — Componente compartilhado para todas as 13 visoes departamentais
   Inclui: Sidebar, Topbar, Kanban, KPIs, Sparklines, Alertas, Handoffs,
           Centro de Handoffs Global, Alertas IA, Modal 360°, Activity Feed, Team
   ═══════════════════════════════════════════════════════════════ */
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";
import {
  allProfiles, getProfile, type DeptProfile, type KanbanCard, type KanbanColumn,
  type KPI, type Alert, type Handoff,
  BG, CARD_BG, BORDER, GREEN, RED, YELLOW, BLUE, ACCENT, GOLD, PURPLE, ORANGE, PINK, TEAL,
  TIPO_PROJETO_COLORS,
} from "./sistema-ops-data";
import {
  ArrowLeft, Bell, ChevronRight, AlertTriangle, CheckCircle2, Clock, X, Menu,
  LayoutDashboard, Kanban, BarChart3, FolderOpen, ArrowRightLeft, Shield,
  Search, TrendingUp, TrendingDown, Minus, Eye, ChevronDown, LogOut,
  MessageSquare, DollarSign, Users, ClipboardCheck, GitBranch, Zap,
  Filter, ArrowRight, CircleDot, Activity, Target, Send, Layers,
  Building2, AlertCircle, ChevronUp, Calendar, FileText, UserCircle2,
  Briefcase, Home, Plus, GitMerge, Bot, Loader2, Upload, Trash2,
} from "lucide-react";
import { useKanbanCards, useKanbanColumns, type DbColumn, createHandoffCard, moveCardToDept, acceptHandoff, returnHandoff, isDbCardId } from "../hooks/useKanbanCards";
import { useAlertas } from "../hooks/useAlertas";
import { AlertaCard } from "./alerta-card";
import { useHandoffs } from "../hooks/useHandoffs";
import { useKpis } from "../hooks/useKpis";
import { useAtividades } from "../hooks/useAtividades";
import { getPrimaryRule, getSecondaryRules } from "../lib/kanban-handoffs";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, PieChart, Pie, LineChart, Line,
} from "recharts";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "./ui/command";
import {
  BlocoDeNotas, TimerDeTarefas, ChecklistDiario, CalculadoraDeObra,
  AgendaDoDia, GeradorRelatorio, TOOLKIT_ICONS, TOOLKIT_LABELS,
} from "./dept-toolkit";
import { useNotificacoes } from "../hooks/useNotificacoes";

/* ─── Tokens ─── */
export const CARD_HOVER = "#161616";
export const TEXT_DIM = "rgba(255,255,255,0.4)";
export const TEXT_MED = "rgba(255,255,255,0.6)";

/* ─── Types ─── */
export interface ExtraTab {
  id: string;
  label: string;
  icon: React.ElementType;
  render: () => React.ReactNode;
}

export interface TeamMember {
  name: string;
  role: string;
  status: "online" | "busy" | "offline";
  avatar: string;
}

export interface QuickAction {
  label: string;
  icon: React.ElementType;
  color: string;
  badge?: string;
  onClick?: () => void;
}

export interface ActivityItem {
  id: string;
  text: string;
  time: string;
  type: "action" | "update" | "alert" | "completed";
}

export interface DeptPageConfig {
  deptId: string;
  baseRoute?: string;
  extraTabs?: ExtraTab[];
  dashboardExtra?: React.ReactNode;
  team?: TeamMember[];
  quickActions?: QuickAction[];
  activity?: ActivityItem[];
  tabSwitcherRef?: React.MutableRefObject<((tabId: string) => void) | null>;
  kanbanHeaderExtra?: React.ReactNode;
  cardFilter?: (card: any) => boolean;
}

/* ─── Sparkline Data Generator ─── */
export function genSparkline(base: number, variance: number, trend: "up" | "down" | "flat" = "flat", len = 7): number[] {
  const arr: number[] = [];
  let val = base - (trend === "up" ? variance * 2 : trend === "down" ? -variance * 2 : 0);
  for (let i = 0; i < len; i++) {
    val += (Math.random() - (trend === "down" ? 0.6 : trend === "up" ? 0.3 : 0.5)) * variance;
    arr.push(Math.max(0, Math.round(val * 10) / 10));
  }
  return arr;
}

/* ─── WhatsApp "Sem Resposta" — analisa mensagens_ia do card ─── */
interface InboxState {
  lastMessageAt: number;
  isUnread: boolean;
  secondsWaiting: number;
}

function extractInbox(details: Record<string, unknown> | undefined): InboxState {
  const msgs = (details?.mensagens_ia as Array<{ de: string; ts: string }>) ?? [];
  if (msgs.length === 0) return { lastMessageAt: 0, isUnread: false, secondsWaiting: 0 };
  const last = msgs[msgs.length - 1];
  const lastMessageAt = last?.ts ? new Date(last.ts).getTime() : 0;
  // Varre de trás pra frente: "teka" é transparente (auto-reply).
  // Se encontra "cliente" → isUnread. Break em qualquer outro (vendedor humano).
  let clientTs = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const de = msgs[i].de;
    if (de === "cliente" || de === "teka") {
      if (de === "cliente") clientTs = new Date(msgs[i].ts).getTime();
    } else break;
  }
  const isUnread = clientTs > 0;
  const secondsWaiting = isUnread ? Math.max(0, Math.floor((Date.now() - clientTs) / 1000)) : 0;
  return { lastMessageAt, isUnread, secondsWaiting };
}

function formatWaitTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return `${hours}h ${remMins}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

/* ─── Helpers ─── */
export function SlaChip({ status }: { status: "ok" | "warning" | "expired" }) {
  const c = status === "ok" ? GREEN : status === "warning" ? YELLOW : RED;
  const bg = status === "ok" ? "rgba(16,185,129,0.12)" : status === "warning" ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)";
  const label = status === "ok" ? "No prazo" : status === "warning" ? "Atencao" : "Vencido";
  return <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: bg, color: c }}>{label}</span>;
}

export function TrendBadge({ trend, value }: { trend?: string; value?: string }) {
  if (!trend || !value) return null;
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const color = trend === "up" ? GREEN : trend === "down" ? RED : TEXT_DIM;
  return (
    <span className="flex items-center gap-0.5" style={{ fontSize: "0.55rem", color }}>
      <Icon size={10} /> {value}
    </span>
  );
}

function AlertIcon({ type }: { type: string }) {
  if (type === "critical") return <AlertTriangle size={12} style={{ color: RED }} />;
  if (type === "warning") return <Clock size={12} style={{ color: YELLOW }} />;
  return <CheckCircle2 size={12} style={{ color: BLUE }} />;
}

/* ─── Sparkline ─── */
export function Sparkline({ data, color, height = 28 }: { data: number[]; color: string; height?: number }) {
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Area key="area" type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── CTip ─── */
export function CTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg p-2 border" style={{ background: "#1a1a1a", borderColor: BORDER }}>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ fontSize: "0.6rem", color: p.color || "white" }}>{p.name}: {typeof p.value === "number" ? p.value.toFixed?.(1) ?? p.value : p.value}</p>
      ))}
    </div>
  );
}

/* ═══ GATE TIMELINE ═══ */
interface GateStep { gate: number; label: string; status: "done" | "current" | "pending" | "blocked"; date?: string; responsible?: string; }
const GATE_TEMPLATES: GateStep[] = [
  { gate: 0, label: "Briefing & Qualificacao", status: "pending" },
  { gate: 1, label: "Projeto Aprovado (Gate Freeze)", status: "pending" },
  { gate: 2, label: "Compras & Producao Liberados", status: "pending" },
  { gate: 3, label: "Mobilizacao Obra", status: "pending" },
  { gate: 4, label: "Vistoria Final & Aceite", status: "pending" },
  { gate: 5, label: "Entrega Formal & Pos-Obra", status: "pending" },
];

function getGatesForCard(card: KanbanCard): GateStep[] {
  const currentGate = card.gate ?? 2;
  return GATE_TEMPLATES.map(g => ({
    ...g,
    status: g.gate < currentGate ? "done" : g.gate === currentGate ? "current" : "pending",
    date: g.gate < currentGate ? `${5 + g.gate * 8} dias atras` : g.gate === currentGate ? "Agora" : undefined,
    responsible: g.gate === 0 ? "Comercial" : g.gate === 1 ? "Thainara" : g.gate === 2 ? "Ronaldo / Germano" : g.gate === 3 ? "Dany" : g.gate === 4 ? "Felipe" : "Talita",
  }));
}

/* ═══ RACI ═══ */
interface RACIEntry { atividade: string; r: string; a: string; c: string; i: string; }
const RACI_DATA: RACIEntry[] = [
  { atividade: "Briefing inicial", r: "Comercial", a: "Co-CEO", c: "Projetos", i: "Atendimento" },
  { atividade: "Projeto executivo", r: "Thainara", a: "Co-CEO", c: "Fiscal", i: "Compras" },
  { atividade: "Compra materiais", r: "Ronaldo", a: "Karla", c: "Producao", i: "PMO" },
  { atividade: "Producao fabrica", r: "Germano", a: "Co-CEO", c: "Compras", i: "Logistica" },
  { atividade: "Logistica & entrega", r: "Ailton", a: "Germano", c: "Obras", i: "Atendimento" },
  { atividade: "Instalacao em obra", r: "Dany", a: "Co-CEO", c: "Fiscal", i: "Atendimento" },
  { atividade: "Vistoria & aceite", r: "Felipe", a: "Co-CEO", c: "Dany", i: "Talita" },
  { atividade: "Pos-obra & NPS", r: "Talita", a: "Co-CEO", c: "PMO", i: "Marketing" },
];

/* ═══ SMART ALERTS ═══ */
export interface SmartAlert {
  id: string; severity: "critical" | "warning" | "info"; rule: string;
  message: string; dept: string; obra?: string; autoGenerated: boolean; timestamp: string;
}
export const SMART_ALERTS: SmartAlert[] = [
  { id: "sa1", severity: "critical", rule: "obra_parada_5d", message: "PKT-050 sem movimentacao no Kanban ha 6 dias — equipe parada por falta de insumo", dept: "Obras", obra: "PKT-050", autoGenerated: true, timestamp: "Hoje 08:00" },
  { id: "sa2", severity: "critical", rule: "margem_below_25", message: "PKT-050 com margem real de 28.9% e tendencia de queda — risco de ficar abaixo de 25%", dept: "Financeiro", obra: "PKT-050", autoGenerated: true, timestamp: "Hoje 08:00" },
  { id: "sa3", severity: "critical", rule: "parcela_atrasada", message: "PKT-045: Parcela 2 vencida ha 8 dias (R$ 28k) — iniciar cobranca formal", dept: "Financeiro", obra: "PKT-045", autoGenerated: true, timestamp: "Hoje 08:00" },
  { id: "sa4", severity: "critical", rule: "gate_bloqueado", message: "PKT-047: Gate Freeze bloqueado ha 12 dias — cliente nao responde aprovacao", dept: "Projetos", obra: "PKT-047", autoGenerated: true, timestamp: "Ontem 14:00" },
  { id: "sa5", severity: "warning", rule: "handoff_vencido", message: "3 handoffs vencidos entre Compras→Producao — SLA medio estourado em 4h", dept: "Compras", autoGenerated: true, timestamp: "Hoje 09:30" },
  { id: "sa6", severity: "warning", rule: "capacidade_alta", message: "Producao a 82% da capacidade — PKT-055 pode nao entrar na fila esta semana", dept: "Producao", obra: "PKT-055", autoGenerated: true, timestamp: "Hoje 07:00" },
  { id: "sa7", severity: "warning", rule: "nc_aberta_3d", message: "PKT-050: 2 NCs abertas ha 3+ dias sem resolucao", dept: "Producao", obra: "PKT-050", autoGenerated: true, timestamp: "Ontem 16:00" },
  { id: "sa8", severity: "warning", rule: "diario_faltando", message: "2 equipes nao preencheram diario de obra ontem (Equipe Gamma, Equipe Delta)", dept: "PMO", autoGenerated: true, timestamp: "Hoje 08:00" },
  { id: "sa9", severity: "info", rule: "produtividade_destaque", message: "PKT-042: Equipe Alpha com 22 m2/dia — 28% acima da media. Candidata a bonus.", dept: "PMO", obra: "PKT-042", autoGenerated: true, timestamp: "Hoje 10:00" },
  { id: "sa10", severity: "info", rule: "meta_atingida", message: "Comercial: taxa de fechamento 34% vs meta 30% — meta batida este mes", dept: "Comercial", autoGenerated: true, timestamp: "Hoje 06:00" },
  { id: "sa11", severity: "warning", rule: "lead_sem_contato", message: "5 leads sem proximo passo definido no CRM ha 3+ dias", dept: "Comercial", autoGenerated: true, timestamp: "Hoje 09:00" },
  { id: "sa12", severity: "critical", rule: "vistoria_urgente", message: "PKT-053: Obra inicia em 5 dias e vistoria de umidade ainda nao foi feita", dept: "Fiscal", obra: "PKT-053", autoGenerated: true, timestamp: "Hoje 07:30" },
];

/* ═══ GLOBAL HANDOFFS ═══ */
function getAllHandoffs(): (Handoff & { deptFrom: string; deptTo: string; color: string })[] {
  const all: (Handoff & { deptFrom: string; deptTo: string; color: string })[] = [];
  const deptColors: Record<string, string> = {
    Comercial: BLUE, Projetos: "#60A5FA", Compras: GREEN, Producao: ORANGE,
    Logistica: TEAL, Obras: RED, Financeiro: GREEN, Atendimento: PINK,
    Fiscal: PURPLE, PMO: TEAL, Marketing: PINK, RH: "#818CF8", Orcamento: YELLOW,
  };
  for (const p of allProfiles) {
    for (const h of p.handoffs) {
      all.push({ ...h, deptFrom: p.nome, deptTo: h.to.split("(")[0].trim(), color: deptColors[p.nome] || ACCENT });
    }
  }
  return all;
}

/* ═══ ADD CARD MODAL ═══ */
function AddCardModal({
  columns, deptId, onClose, onAdd,
}: {
  columns: KanbanColumn[];
  deptId: string;
  onClose: () => void;
  onAdd: (card: { title: string; subtitle: string; obra: string; responsavel: string; priority: "alta" | "media" | "baixa"; value: string; tags: string[]; columnId: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [obra, setObra] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [priority, setPriority] = useState<"alta" | "media" | "baixa">("media");
  const [value, setValue] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [columnId, setColumnId] = useState(columns[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !responsavel.trim()) { setError("Título e responsável são obrigatórios."); return; }
    setSaving(true);
    setError(null);
    try {
      await onAdd({
        title: title.trim(), subtitle: subtitle.trim(), obra: obra.trim(),
        responsavel: responsavel.trim(), priority, value: value.trim(),
        tags: tagsRaw.split(",").map(t => t.trim()).filter(Boolean),
        columnId,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar card.");
      setSaving(false);
    }
  }

  const inputCss: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 8, color: "white", fontSize: "0.78rem", padding: "8px 10px", outline: "none", boxSizing: "border-box" };
  const labelCss: React.CSSProperties = { display: "block", fontSize: "0.55rem", color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 5 };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h3 style={{ color: "white", fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>Novo Card</h3>
            <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>Adicionar projeto ao Kanban</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelCss}>TÍTULO DO PROJETO *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Casa Florais — Cuiabá" required style={inputCss} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelCss}>CÓDIGO DA OBRA</label>
              <input value={obra} onChange={e => setObra(e.target.value)} placeholder="PKT-XXX" style={inputCss} />
            </div>
            <div>
              <label style={labelCss}>VALOR DO CONTRATO</label>
              <input value={value} onChange={e => setValue(e.target.value)} placeholder="R$ 185k" style={inputCss} />
            </div>
          </div>
          <div>
            <label style={labelCss}>RESPONSÁVEL *</label>
            <input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome do responsável" required style={inputCss} />
          </div>
          <div>
            <label style={labelCss}>OBSERVAÇÃO / CLIENTE</label>
            <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Ex: 3 dormitórios · 180m²" style={inputCss} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelCss}>PRIORIDADE</label>
              <div style={{ display: "flex", gap: 4 }}>
                {(["alta", "media", "baixa"] as const).map(p => (
                  <button key={p} type="button" onClick={() => setPriority(p)} style={{ flex: 1, padding: "6px 2px", borderRadius: 6, fontSize: "0.58rem", fontWeight: priority === p ? 700 : 400, background: priority === p ? (p === "alta" ? "rgba(239,68,68,0.2)" : p === "media" ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)") : "rgba(255,255,255,0.03)", border: `1px solid ${priority === p ? (p === "alta" ? RED : p === "media" ? YELLOW : GREEN) + "60" : BORDER}`, color: priority === p ? (p === "alta" ? RED : p === "media" ? YELLOW : GREEN) : "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                    {p === "alta" ? "Alta" : p === "media" ? "Média" : "Baixa"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelCss}>COLUNA INICIAL</label>
              <select value={columnId} onChange={e => setColumnId(e.target.value)} style={{ ...inputCss, padding: "7px 10px" }}>
                {columns.map(col => <option key={col.id} value={col.id}>{col.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelCss}>TAGS (separadas por vírgula)</label>
            <input value={tagsRaw} onChange={e => setTagsRaw(e.target.value)} placeholder="reforma, urgente, VIP" style={inputCss} />
          </div>
          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px" }}>
              <p style={{ fontSize: "0.65rem", color: RED, margin: 0 }}>{error}</p>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, color: "rgba(255,255,255,0.6)", fontSize: "0.72rem", cursor: "pointer" }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ flex: 2, padding: "9px", background: saving ? "rgba(212,168,83,0.2)" : ACCENT, border: "none", borderRadius: 8, color: saving ? "rgba(255,255,255,0.4)" : "#0A0A0A", fontSize: "0.72rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Criando…" : "Criar Card"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ═══ HANDOFF TOAST ═══ */
function ActionToast({ action, onClose }: { action: string; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 101, background: "#111", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 12, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", minWidth: 280, maxWidth: "90vw" }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <CheckCircle2 size={14} style={{ color: GREEN }} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ color: "white", fontSize: "0.72rem", fontWeight: 600, margin: 0 }}>Acao registrada</p>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6rem", margin: "2px 0 0" }}><strong style={{ color: GREEN }}>{action}</strong></p>
      </div>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 0 }}><X size={14} /></button>
    </div>
  );
}

function HandoffToast({ depts, onClose }: { depts: string; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 100, background: "#111", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 12, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", minWidth: 320, maxWidth: "90vw" }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <GitMerge size={14} style={{ color: GREEN }} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ color: "white", fontSize: "0.72rem", fontWeight: 600, margin: 0 }}>Passagem de bastão enviada</p>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6rem", margin: "2px 0 0" }}>Card criado em: <strong style={{ color: GREEN }}>{depts}</strong></p>
      </div>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 0 }}><X size={14} /></button>
    </div>
  );
}

/* ═══ AI AGENT CHAT ═══ */
const AI_SQUAD_URL = "https://agente.parket.works/api/kanban-bridge";

interface ChatMsg { role: "user" | "assistant"; text: string; }

function AiAgentChat({ deptId, deptName, onClose }: { deptId: string; deptName: string; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", text: `Olá! Sou o assistente IA da Parket. Posso te ajudar com informações sobre o departamento **${deptName}** ou qualquer outro setor. O que você precisa?` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await fetch(`${AI_SQUAD_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, dept_id: deptId, agent_name: "Assistente Parket" }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", text: data.answer ?? "Não obtive resposta." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Erro ao conectar com o agente IA. Verifique se o serviço está online." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", bottom: 80, right: 24, zIndex: 200, width: 360, maxWidth: "calc(100vw - 32px)", background: "#0f0f0f", border: "1px solid rgba(212,168,83,0.3)", borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(212,168,83,0.06)" }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(212,168,83,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bot size={16} style={{ color: GOLD }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: "white", fontSize: "0.75rem", fontWeight: 600, margin: 0 }}>Agente IA — {deptName}</p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem", margin: 0 }}>Conectado · agente.parket.works</p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 4 }}><X size={14} /></button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, minHeight: 200 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%", padding: "8px 12px", borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              background: msg.role === "user" ? "rgba(212,168,83,0.2)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${msg.role === "user" ? "rgba(212,168,83,0.3)" : "rgba(255,255,255,0.08)"}`,
              fontSize: "0.68rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.5, whiteSpace: "pre-wrap",
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "8px 12px", borderRadius: "12px 12px 12px 4px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Loader2 size={12} style={{ color: GOLD, animation: "spin 1s linear infinite" }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Pergunte sobre o departamento…"
          disabled={loading}
          style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", color: "white", fontSize: "0.68rem", outline: "none" }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() && !loading ? "rgba(212,168,83,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${input.trim() && !loading ? "rgba(212,168,83,0.4)" : "rgba(255,255,255,0.08)"}`, cursor: input.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <Send size={12} style={{ color: input.trim() && !loading ? GOLD : "rgba(255,255,255,0.3)" }} />
        </button>
      </div>
    </div>
  );
}

/* ─── Utilitários de dias úteis ─── */
function addBusinessDays(startDateStr: string, days: number): Date {
  const d = new Date(startDateStr + "T12:00:00");
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

function businessDaysUntil(target: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  if (t <= today) return 0;
  let count = 0;
  const d = new Date(today);
  while (d < t) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ─── PrazoChip — chip editável de prazo em dias úteis ─── */
function PrazoChip({ card }: { card: KanbanCard }) {
  const [editing, setEditing] = useState(false);
  const [duVal, setDuVal] = useState(card.prazo_dias_uteis != null ? String(card.prazo_dias_uteis) : "");
  const [iniciVal, setIniciVal] = useState(card.previsao_inicio ?? "");
  const [saving, setSaving] = useState(false);

  const hasPrazo = card.prazo_dias_uteis != null;
  const hasInicio = !!card.previsao_inicio;

  const entrega = hasPrazo && hasInicio
    ? addBusinessDays(card.previsao_inicio!, card.prazo_dias_uteis!)
    : null;
  const restantes = entrega ? businessDaysUntil(entrega) : null;
  const atrasado  = entrega ? restantes === 0 && entrega < new Date() : false;
  const urgente   = !atrasado && restantes != null && restantes <= 3;
  const chipColor = atrasado ? RED : urgente ? YELLOW : GREEN;

  const save = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDbCardId(card.id)) return;
    setSaving(true);
    try {
      const { supabase } = await import("../lib/supabase");
      const { data: existing } = await supabase.from("kanban_cards").select("details").eq("id", card.id).single();
      const details = { ...((existing?.details as Record<string, unknown>) ?? {}) };
      if (duVal)    details.prazo_dias_uteis = Number(duVal);
      if (iniciVal) details.previsao_inicio  = iniciVal;
      await supabase.from("kanban_cards").update({ details }).eq("id", card.id);
      // Update local card state (best-effort)
      (card as any).prazo_dias_uteis = Number(duVal);
      (card as any).previsao_inicio  = iniciVal;
    } catch (_) {}
    setSaving(false);
    setEditing(false);
  };

  if (!hasPrazo && !hasInicio) {
    // Só mostra se há prazo ou início definido; senão retorna null
    return null;
  }

  if (editing) {
    return (
      <div className="mb-2 p-2 rounded-lg space-y-1.5" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }} onClick={e => e.stopPropagation()}>
        <p style={{ fontSize: "0.45rem", color: TEXT_DIM, fontWeight: 600 }}>PRAZO EM DIAS ÚTEIS</p>
        <div className="flex gap-1.5">
          <input
            type="date"
            value={iniciVal}
            onChange={e => setIniciVal(e.target.value)}
            className="flex-1 rounded px-1.5 py-1 outline-none"
            style={{ fontSize: "0.5rem", background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, color: "white" }}
            placeholder="Início"
          />
          <input
            type="number"
            value={duVal}
            onChange={e => setDuVal(e.target.value)}
            className="rounded px-1.5 py-1 outline-none"
            style={{ fontSize: "0.5rem", background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, color: "white", width: 48 }}
            placeholder="d.u."
          />
        </div>
        <div className="flex gap-1">
          <button onClick={save} disabled={saving} className="flex-1 rounded py-1 flex items-center justify-center gap-1" style={{ fontSize: "0.45rem", fontWeight: 600, background: saving ? "rgba(16,185,129,0.1)" : "rgba(16,185,129,0.15)", color: GREEN, border: "1px solid rgba(16,185,129,0.3)", cursor: saving ? "default" : "pointer" }}>
            {saving ? <Loader2 size={8} className="animate-spin" /> : <Check size={8} />} Salvar
          </button>
          <button onClick={e => { e.stopPropagation(); setEditing(false); }} className="rounded px-2 py-1" style={{ fontSize: "0.45rem", background: "rgba(255,255,255,0.04)", color: TEXT_DIM, border: `1px solid ${BORDER}`, cursor: "pointer" }}>
            <X size={8} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg cursor-pointer"
      style={{ background: `${chipColor}10`, border: `1px solid ${chipColor}30` }}
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      title="Clique para editar prazo"
    >
      <Calendar size={9} style={{ color: chipColor, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: "0.48rem", color: chipColor, fontWeight: 600 }}>
          {entrega
            ? (atrasado ? "⚠ Prazo vencido" : `Entrega: ${fmtDate(entrega)}`)
            : `${card.prazo_dias_uteis} d.u. (sem início)`}
        </p>
        <p style={{ fontSize: "0.44rem", color: TEXT_DIM }}>
          {hasInicio && `Início: ${new Date(card.previsao_inicio! + "T12:00:00").toLocaleDateString("pt-BR")} · `}
          {hasPrazo && `${card.prazo_dias_uteis} d.u.`}
          {entrega && !atrasado && ` · ${restantes} d.u. restantes`}
          {" · "}✏ editar
        </p>
      </div>
    </div>
  );
}

/* ═══ COMPRAS — Card & Modal personalizados ═══ */

const TIPO_COMPRAS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  obra:          { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "Obra"          },
  fabrica:       { bg: "rgba(249,115,22,0.12)",   color: "#F97316", label: "Fábrica"       },
  marcenaria:    { bg: "rgba(139,92,246,0.12)",   color: "#8B5CF6", label: "Marcenaria"    },
  cliente:       { bg: "rgba(59,130,246,0.12)",   color: "#3B82F6", label: "Cliente"       },
  amostra:       { bg: "rgba(236,72,153,0.12)",   color: "#EC4899", label: "Amostra"       },
  administrativo:{ bg: "rgba(245,158,11,0.12)",   color: "#F59E0B", label: "Adm"           },
};

function getTipoCompras(det: Record<string, unknown> | undefined): { bg: string; color: string; label: string } {
  const raw = ((det?.tipo_requisicao as string) || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const key of Object.keys(TIPO_COMPRAS_COLORS)) {
    if (raw.includes(key)) return TIPO_COMPRAS_COLORS[key];
  }
  // Try labels
  const labels = (det?.labels_trello as string[]) ?? [];
  for (const l of labels) {
    const lk = l.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const key of Object.keys(TIPO_COMPRAS_COLORS)) {
      if (lk.includes(key)) return TIPO_COMPRAS_COLORS[key];
    }
  }
  return TIPO_COMPRAS_COLORS["obra"];
}

function ComprasCardContent({ card }: { card: KanbanCard }) {
  const nav = useNavigate();
  const det = card.details;
  const tipo = getTipoCompras(det);
  const itens = (det?.itens as string[]) ?? [];
  const solicitante = (det?.solicitante as string) || card.subtitle || "";
  const attachments = (det?.attachments_count as number) || 0;
  const dataLimite = (det?.data_limite_entrega as string) || "";
  const labels = (det?.labels_trello as string[]) ?? card.tags ?? [];
  const parentId = card.parent_card_id;
  const statusSolic = (det?.status_solicitacao as string) || "";

  // Format date
  const fmtDate = (d: string) => {
    if (!d) return "";
    try { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); } catch { return d; }
  };

  return (
    <div className="p-3">
      {/* Tipo badge + priority dot */}
      <div className="flex items-center justify-between mb-2">
        <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 700, background: tipo.bg, color: tipo.color, border: `1px solid ${tipo.color}30` }}>
          {tipo.label}
        </span>
        <div className="flex items-center gap-1">
          {card.priority === "alta" && <span className="w-2 h-2 rounded-full" style={{ background: RED }} />}
          {attachments > 0 && (
            <span className="flex items-center gap-0.5" style={{ fontSize: "0.45rem", color: TEXT_DIM }}>
              <FileText size={9} />{attachments}
            </span>
          )}
        </div>
      </div>

      {/* Status da solicitação */}
      {statusSolic === "pendente" && (
        <div className="flex items-center gap-1 mb-1.5">
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: YELLOW, flexShrink: 0 }} />
          <span style={{ fontSize: "0.45rem", color: YELLOW, fontWeight: 600 }}>Aguardando resposta de Compras</span>
        </div>
      )}
      {statusSolic === "aceito" && (
        <div className="flex items-center gap-1 mb-1.5">
          <CheckCircle2 size={9} style={{ color: GREEN }} />
          <span style={{ fontSize: "0.45rem", color: GREEN, fontWeight: 600 }}>Aceito — em cotação</span>
        </div>
      )}
      {statusSolic === "rejeitado" && (
        <div className="flex items-center gap-1 mb-1.5">
          <AlertCircle size={9} style={{ color: RED }} />
          <span style={{ fontSize: "0.45rem", color: RED, fontWeight: 600 }}>Rejeitado</span>
        </div>
      )}

      {/* Title */}
      <p className="text-white mb-1" style={{ fontSize: "0.72rem", fontWeight: 600, lineHeight: 1.3 }}>{card.title}</p>

      {/* Solicitante */}
      {solicitante && (
        <p className="mb-1.5 truncate" style={{ fontSize: "0.55rem", color: TEXT_DIM }}>
          <span style={{ color: ACCENT }}>Por:</span> {solicitante}
        </p>
      )}

      {/* Items preview */}
      {itens.length > 0 && (
        <div className="mb-2 space-y-0.5">
          {itens.slice(0, 3).map((item, i) => (
            <p key={i} className="truncate" style={{ fontSize: "0.55rem", color: TEXT_MED }}>· {item}</p>
          ))}
          {itens.length > 3 && <p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>+{itens.length - 3} itens...</p>}
        </div>
      )}

      {/* Labels */}
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {labels.slice(0, 3).map((t, i) => (
            <span key={i} className="rounded px-1.5 py-0.5" style={{ fontSize: "0.42rem", fontWeight: 500, background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>{t}</span>
          ))}
        </div>
      )}

      {/* Checklist progress */}
      {card.checklist && card.checklist.total > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-0.5">
            <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>Checklist</span>
            <span style={{ fontSize: "0.5rem", color: card.checklist.done === card.checklist.total ? GREEN : TEXT_DIM }}>
              {card.checklist.done}/{card.checklist.total}
            </span>
          </div>
          <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round((card.checklist.done / card.checklist.total) * 100)}%`, background: card.checklist.done === card.checklist.total ? GREEN : ACCENT }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-1.5 pt-1.5" style={{ borderTop: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-1">
          {dataLimite && (
            <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>
              <Calendar size={9} style={{ display: "inline", marginRight: 2 }} />
              {fmtDate(dataLimite)}
            </span>
          )}
        </div>
        <SlaChip status={card.slaStatus} />
      </div>

      {/* Projeto vinculado */}
      {parentId && (
        <button
          onClick={e => { e.stopPropagation(); nav(`/obra/${parentId}`); }}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 mt-1.5"
          style={{ fontSize: "0.52rem", fontWeight: 600, color: GREEN, background: "rgba(16,185,129,0.06)", border: `1px solid rgba(16,185,129,0.18)`, cursor: "pointer" }}
        >
          <Eye size={9} /> Abrir Projeto Vinculado
        </button>
      )}
    </div>
  );
}

interface ObraOption { id: string; title: string; obra: string; }

/* ─── Material item ─── */
interface MaterialItem { tipo: string; justificativa: string; quantidade: string; }

/* ═══ MODAL DE SOLICITAÇÃO DE COMPRAS ═══ */
function SolicitacaoComprasModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const { user } = useAuth();
  const solicitante = (user as any)?.name || (user as any)?.email || "Usuário";

  const [materiais, setMateriais] = useState<MaterialItem[]>([{ tipo: "", justificativa: "", quantidade: "" }]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [linkedProject, setLinkedProject] = useState<ObraOption | null>(null);
  const [obraOptions, setObraOptions] = useState<ObraOption[]>([]);
  const [loadingObras, setLoadingObras] = useState(false);
  const [prazo, setPrazo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!showProjectPicker || obraOptions.length > 0) return;
    setLoadingObras(true);
    supabase.from("kanban_cards").select("id,title,obra").in("dept_id", ["obras", "projetos"]).not("obra", "is", null).order("obra").limit(1000)
      .then(({ data }) => { setObraOptions((data ?? []) as ObraOption[]); setLoadingObras(false); });
  }, [showProjectPicker]);

  const filteredObras = obraOptions.filter(o => {
    const q = projectSearch.toLowerCase();
    return !q || o.title.toLowerCase().includes(q) || (o.obra ?? "").toLowerCase().includes(q);
  });

  const addMaterial = () => setMateriais(prev => [...prev, { tipo: "", justificativa: "", quantidade: "" }]);
  const removeMaterial = (i: number) => setMateriais(prev => prev.filter((_, idx) => idx !== i));
  const updateMaterial = (i: number, field: keyof MaterialItem, value: string) =>
    setMateriais(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));

  const handleSubmit = async () => {
    const valid = materiais.filter(m => m.tipo.trim());
    if (valid.length === 0) { setError("Informe ao menos um material."); return; }
    if (!projectId) { setError("Selecione um projeto vinculado."); return; }
    if (!prazo) { setError("Informe o prazo estimado de entrega."); return; }
    setSaving(true); setError(null);
    const now = new Date().toISOString();
    const dataCurta = new Date().toLocaleDateString("pt-BR");
    const { data: created, error: insertErr } = await supabase.from("kanban_cards").insert({
      dept_id: "compras", column_id: "entrada",
      title: `Solicitação — ${solicitante} — ${dataCurta}`,
      responsavel: solicitante, sla: "7d", sla_status: "ok", priority: "media",
      parent_card_id: projectId,
      details: {
        solicitante, data_solicitacao: now, data_limite_entrega: prazo,
        materiais: valid, status_solicitacao: "pendente", tipo_requisicao: "obra",
        itens: valid.map(m => `${m.quantidade ? m.quantidade + " — " : ""}${m.tipo}`),
      },
    }).select().single();
    if (insertErr || !created) { setError("Erro ao criar solicitação. Tente novamente."); setSaving(false); return; }
    // Vincula ao projeto
    const { data: proj } = await supabase.from("kanban_cards").select("details").eq("id", projectId).single();
    if (proj) {
      const pd = (proj.details as Record<string, unknown>) ?? {};
      const existing = ((pd.solicitacoes_compras as unknown[]) ?? []);
      await supabase.from("kanban_cards").update({
        details: { ...pd, solicitacoes_compras: [...existing, { id: (created as any).id, solicitante, data: now, prazo, materiais: valid, status: "pendente" }] },
      }).eq("id", projectId);
    }
    setSaving(false); setSuccess(true); onSuccess?.();
    setTimeout(() => onClose(), 1800);
  };

  const iStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 7, color: "white", fontSize: "0.72rem", padding: "7px 10px", outline: "none", boxSizing: "border-box" };
  const lStyle: React.CSSProperties = { display: "block", fontSize: "0.45rem", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 4 };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.87)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "#111", border: `1px solid ${BORDER}`, borderRadius: 18, width: "100%", maxWidth: 580, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 style={{ color: "white", fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>Nova Solicitação de Compras</h2>
              <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 2 }}>
                Solicitante: <span style={{ color: ACCENT }}>{solicitante}</span> · {new Date().toLocaleDateString("pt-BR")}
              </p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM }}><X size={18} /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {success ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <CheckCircle2 size={40} style={{ color: GREEN, margin: "0 auto 12px" }} />
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "white" }}>Solicitação enviada!</p>
              <p style={{ fontSize: "0.65rem", color: TEXT_DIM, marginTop: 4 }}>Card criado no kanban de Compras e vinculado ao projeto.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Projeto */}
              <div>
                <label style={lStyle}>Projeto / Obra *</label>
                {linkedProject ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
                      <Briefcase size={12} style={{ color: GREEN }} />
                      <span style={{ fontSize: "0.68rem", color: GREEN, fontWeight: 600 }}>{linkedProject.obra ? `${linkedProject.obra} — ` : ""}{linkedProject.title}</span>
                    </div>
                    <button onClick={() => { setProjectId(null); setLinkedProject(null); }} style={{ fontSize: "0.55rem", color: TEXT_DIM, background: "none", border: "none", cursor: "pointer" }}>Trocar</button>
                  </div>
                ) : (
                  <button onClick={() => setShowProjectPicker(v => !v)} style={{ ...iStyle, textAlign: "left", cursor: "pointer", color: TEXT_DIM }}>Selecionar projeto...</button>
                )}
                {showProjectPicker && (
                  <div style={{ marginTop: 6, background: "#161616", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", maxHeight: 200 }}>
                    <div style={{ padding: "8px 10px", borderBottom: `1px solid ${BORDER}` }}>
                      <input autoFocus value={projectSearch} onChange={e => setProjectSearch(e.target.value)} placeholder="Buscar obra ou cliente..." style={{ ...iStyle, fontSize: "0.65rem" }} />
                    </div>
                    <div style={{ overflowY: "auto", maxHeight: 155 }}>
                      {loadingObras && <p style={{ padding: 12, fontSize: "0.6rem", color: TEXT_DIM, textAlign: "center" }}>Carregando...</p>}
                      {!loadingObras && filteredObras.length === 0 && <p style={{ padding: 12, fontSize: "0.6rem", color: TEXT_DIM, textAlign: "center" }}>Nenhuma obra encontrada.</p>}
                      {filteredObras.map(o => (
                        <button key={o.id} onClick={() => { setProjectId(o.id); setLinkedProject(o); setShowProjectPicker(false); setProjectSearch(""); }} className="w-full text-left flex items-center gap-2 px-3 py-2" style={{ background: "transparent", border: "none", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}>
                          {o.obra && <span style={{ fontSize: "0.55rem", fontWeight: 600, color: ACCENT, flexShrink: 0 }}>{o.obra}</span>}
                          <span className="truncate" style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.8)" }}>{o.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Prazo */}
              <div>
                <label style={lStyle}>Prazo Estimado de Entrega *</label>
                <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} style={iStyle} />
              </div>

              {/* Materiais */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ ...lStyle, marginBottom: 0 }}>Materiais *</label>
                  <button onClick={addMaterial} className="flex items-center gap-1" style={{ fontSize: "0.6rem", color: ACCENT, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    <Plus size={11} /> Adicionar material
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {materiais.map((m, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: "0.55rem", color: TEXT_DIM, fontWeight: 600 }}>Material {i + 1}</span>
                        {materiais.length > 1 && (
                          <button onClick={() => removeMaterial(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.5)", padding: 2 }}><X size={12} /></button>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 8 }}>
                        <div>
                          <label style={lStyle}>Tipo / Descrição *</label>
                          <input value={m.tipo} onChange={e => updateMaterial(i, "tipo", e.target.value)} placeholder="Ex: Piso carvalho, Cola Sika..." style={iStyle} />
                        </div>
                        <div>
                          <label style={lStyle}>Quantidade</label>
                          <input value={m.quantidade} onChange={e => updateMaterial(i, "quantidade", e.target.value)} placeholder="Ex: 50m², 10 cx" style={iStyle} />
                        </div>
                      </div>
                      <div>
                        <label style={lStyle}>Justificativa</label>
                        <textarea value={m.justificativa} onChange={e => updateMaterial(i, "justificativa", e.target.value)} rows={2} placeholder="Por que este material é necessário?" style={{ ...iStyle, resize: "vertical" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px" }}>
                  <p style={{ fontSize: "0.65rem", color: RED, margin: 0 }}>{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, flexShrink: 0, display: "flex", gap: 8 }}>
            <button onClick={handleSubmit} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "rgba(212,168,83,0.2)" : ACCENT, border: "none", borderRadius: 9, color: saving ? TEXT_DIM : "#0A0A0A", fontSize: "0.75rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Enviando..." : "Enviar Solicitação"}
            </button>
            <button onClick={onClose} style={{ flex: 1, padding: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT_DIM, fontSize: "0.72rem", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ ABA INLINE — SOLICITAR COMPRAS (para extraTabs dos setores) ═══ */
export function SolicitacaoComprasTab() {
  const { user } = useAuth();
  const solicitanteDefault = (user as any)?.name || (user as any)?.email || "";

  const [materiais, setMateriais] = useState<MaterialItem[]>([{ tipo: "", justificativa: "", quantidade: "" }]);
  const [solicitante, setSolicitante] = useState(solicitanteDefault);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [linkedProject, setLinkedProject] = useState<ObraOption | null>(null);
  const [obraOptions, setObraOptions] = useState<ObraOption[]>([]);
  const [loadingObras, setLoadingObras] = useState(false);
  const [prazo, setPrazo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!showProjectPicker || obraOptions.length > 0) return;
    setLoadingObras(true);
    supabase.from("kanban_cards").select("id,title,obra").in("dept_id", ["obras", "projetos"]).not("obra", "is", null).order("obra").limit(1000)
      .then(({ data }) => { setObraOptions((data ?? []) as ObraOption[]); setLoadingObras(false); });
  }, [showProjectPicker]);

  const filteredObras = obraOptions.filter(o => {
    const q = projectSearch.toLowerCase();
    return !q || o.title.toLowerCase().includes(q) || (o.obra ?? "").toLowerCase().includes(q);
  });

  const addMaterial = () => setMateriais(prev => [...prev, { tipo: "", justificativa: "", quantidade: "" }]);
  const removeMaterial = (i: number) => setMateriais(prev => prev.filter((_, idx) => idx !== i));
  const updateMaterial = (i: number, field: keyof MaterialItem, value: string) =>
    setMateriais(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));

  const handleSubmit = async () => {
    const valid = materiais.filter(m => m.tipo.trim());
    if (!solicitante.trim()) { setError("Informe o solicitante."); return; }
    if (valid.length === 0) { setError("Informe ao menos um material."); return; }
    if (!prazo) { setError("Informe o prazo estimado de entrega."); return; }
    setSaving(true); setError(null);
    const now = new Date().toISOString();
    const dataCurta = new Date().toLocaleDateString("pt-BR");
    const { data: created, error: insertErr } = await supabase.from("kanban_cards").insert({
      dept_id: "compras", column_id: "entrada",
      title: `Solicitação — ${solicitante} — ${dataCurta}`,
      responsavel: solicitante, sla: "7d", sla_status: "ok", priority: "media",
      parent_card_id: projectId ?? undefined,
      details: {
        solicitante, data_solicitacao: now, data_limite_entrega: prazo,
        materiais: valid, obs_solicitacao: observacoes, status_solicitacao: "pendente", tipo_requisicao: "obra",
        itens: valid.map(m => `${m.quantidade ? m.quantidade + " — " : ""}${m.tipo}`),
      },
    }).select().single();
    if (insertErr || !created) { setError("Erro ao criar solicitação."); setSaving(false); return; }
    if (projectId) {
      const { data: proj } = await supabase.from("kanban_cards").select("details").eq("id", projectId).single();
      if (proj) {
        const pd = (proj.details as Record<string, unknown>) ?? {};
        const existing = ((pd.solicitacoes_compras as unknown[]) ?? []);
        await supabase.from("kanban_cards").update({
          details: { ...pd, solicitacoes_compras: [...existing, { id: (created as any).id, solicitante, data: now, prazo, materiais: valid, status: "pendente" }] },
        }).eq("id", projectId);
      }
    }
    setSaving(false); setSuccess(true);
  };

  const reset = () => {
    setSuccess(false); setMateriais([{ tipo: "", justificativa: "", quantidade: "" }]);
    setProjectId(null); setLinkedProject(null); setPrazo(""); setObservacoes(""); setError(null);
  };

  const iStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, color: "white", fontSize: "0.75rem", padding: "9px 12px", outline: "none", boxSizing: "border-box" };
  const lStyle: React.CSSProperties = { display: "block", fontSize: "0.45rem", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, marginBottom: 5 };

  if (success) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", textAlign: "center" }}>
        <CheckCircle2 size={48} style={{ color: GREEN, marginBottom: 16 }} />
        <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "white", marginBottom: 6 }}>Solicitação enviada!</p>
        <p style={{ fontSize: "0.68rem", color: TEXT_DIM, marginBottom: 24 }}>Card criado no kanban de Compras{linkedProject ? ` e vinculado ao projeto ${linkedProject.obra || linkedProject.title}` : ""}</p>
        <button onClick={reset} style={{ padding: "9px 22px", background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`, borderRadius: 9, color: ACCENT, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>
          Nova Solicitação
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: "white", fontSize: "1rem", fontWeight: 700, margin: "0 0 4px" }}>Solicitar Compras</h2>
        <p style={{ fontSize: "0.62rem", color: TEXT_DIM, margin: 0 }}>Preencha os dados abaixo para criar uma solicitação no setor de Compras.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Solicitante */}
        <div>
          <label style={lStyle}>Solicitante *</label>
          <input value={solicitante} onChange={e => setSolicitante(e.target.value)} placeholder="Seu nome" style={iStyle} />
        </div>

        {/* Projeto */}
        <div>
          <label style={lStyle}>Projeto / Obra (opcional)</label>
          {linkedProject ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <Briefcase size={12} style={{ color: GREEN }} />
                <span style={{ fontSize: "0.68rem", color: GREEN, fontWeight: 600 }}>{linkedProject.obra ? `${linkedProject.obra} — ` : ""}{linkedProject.title}</span>
              </div>
              <button onClick={() => { setProjectId(null); setLinkedProject(null); }} style={{ fontSize: "0.55rem", color: TEXT_DIM, background: "none", border: "none", cursor: "pointer" }}>Trocar</button>
            </div>
          ) : (
            <button onClick={() => setShowProjectPicker(v => !v)} style={{ ...iStyle, textAlign: "left", cursor: "pointer", color: TEXT_DIM }}>Selecionar projeto...</button>
          )}
          {showProjectPicker && (
            <div style={{ marginTop: 6, background: "#161616", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", maxHeight: 200 }}>
              <div style={{ padding: "8px 10px", borderBottom: `1px solid ${BORDER}` }}>
                <input autoFocus value={projectSearch} onChange={e => setProjectSearch(e.target.value)} placeholder="Buscar obra ou cliente..." style={{ ...iStyle, fontSize: "0.68rem" }} />
              </div>
              <div style={{ overflowY: "auto", maxHeight: 155 }}>
                {loadingObras && <p style={{ padding: 12, fontSize: "0.62rem", color: TEXT_DIM, textAlign: "center" }}>Carregando...</p>}
                {!loadingObras && filteredObras.length === 0 && <p style={{ padding: 12, fontSize: "0.62rem", color: TEXT_DIM, textAlign: "center" }}>Nenhuma obra encontrada.</p>}
                {filteredObras.map(o => (
                  <button key={o.id} onClick={() => { setProjectId(o.id); setLinkedProject(o); setShowProjectPicker(false); setProjectSearch(""); }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2"
                    style={{ background: "transparent", border: "none", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}>
                    {o.obra && <span style={{ fontSize: "0.55rem", fontWeight: 600, color: ACCENT, flexShrink: 0 }}>{o.obra}</span>}
                    <span className="truncate" style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.8)" }}>{o.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Prazo */}
        <div>
          <label style={lStyle}>Prazo Estimado de Entrega *</label>
          <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} style={iStyle} />
        </div>

        {/* Materiais */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ ...lStyle, marginBottom: 0 }}>Materiais Solicitados *</label>
            <button onClick={addMaterial} className="flex items-center gap-1" style={{ fontSize: "0.6rem", color: ACCENT, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              <Plus size={11} /> Adicionar material
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {materiais.map((m, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: "0.52rem", color: TEXT_DIM, fontWeight: 600 }}>Material {i + 1}</span>
                  {materiais.length > 1 && <button onClick={() => removeMaterial(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.5)", padding: 2 }}><X size={12} /></button>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={lStyle}>Tipo / Descrição *</label>
                    <input value={m.tipo} onChange={e => updateMaterial(i, "tipo", e.target.value)} placeholder="Ex: Piso carvalho, Cola Sika..." style={iStyle} />
                  </div>
                  <div>
                    <label style={lStyle}>Quantidade</label>
                    <input value={m.quantidade} onChange={e => updateMaterial(i, "quantidade", e.target.value)} placeholder="Ex: 50m², 10 cx" style={iStyle} />
                  </div>
                </div>
                <div>
                  <label style={lStyle}>Justificativa</label>
                  <textarea value={m.justificativa} onChange={e => updateMaterial(i, "justificativa", e.target.value)} rows={2} placeholder="Por que este material é necessário?" style={{ ...iStyle, resize: "vertical" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Observações */}
        <div>
          <label style={lStyle}>Observações Gerais (opcional)</label>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} placeholder="Endereço de entrega, urgência, outras informações..." style={{ ...iStyle, resize: "vertical" }} />
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px" }}>
            <p style={{ fontSize: "0.65rem", color: RED, margin: 0 }}>{error}</p>
          </div>
        )}

        <button onClick={handleSubmit} disabled={saving} style={{ width: "100%", padding: "11px", background: saving ? "rgba(212,168,83,0.2)" : ACCENT, border: "none", borderRadius: 9, color: saving ? TEXT_DIM : "#0A0A0A", fontSize: "0.78rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Enviando..." : "Enviar Solicitação de Compras"}
        </button>
      </div>
    </div>
  );
}

function ComprasModal({ card, onClose, onReload }: { card: KanbanCard; onClose: () => void; onReload?: () => void }) {
  const nav = useNavigate();
  const det = card.details;

  /* ── Estado de leitura ── */
  const [tab, setTab] = useState<"overview" | "checklist" | "attachments" | "raw">("overview");

  /* ── Aceitar / Rejeitar solicitação ── */
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);
  const statusSolicitacao = (det?.status_solicitacao as string) || "";

  const handleAceitarSolicitacao = async () => {
    if (!isDbCardId(card.id) || acting) return;
    setActing(true);
    await supabase.from("kanban_cards").update({
      column_id: "cotacao",
      details: { ...(det ?? {}), status_solicitacao: "aceito", aceito_em: new Date().toISOString() },
    }).eq("id", card.id);
    if (card.parent_card_id) {
      const { data: proj } = await supabase.from("kanban_cards").select("details").eq("id", card.parent_card_id).single();
      if (proj) {
        const pd = (proj.details as Record<string, unknown>) ?? {};
        const solicits = ((pd.solicitacoes_compras as Array<Record<string, unknown>>) ?? []).map(s => s.id === card.id ? { ...s, status: "aceito" } : s);
        await supabase.from("kanban_cards").update({ details: { ...pd, solicitacoes_compras: solicits } }).eq("id", card.parent_card_id);
      }
    }
    setActing(false); onReload?.(); onClose();
  };

  const handleRejeitarSolicitacao = async () => {
    if (!rejectReason.trim() || !isDbCardId(card.id) || acting) return;
    setActing(true);
    await supabase.from("kanban_cards").update({
      details: { ...(det ?? {}), status_solicitacao: "rejeitado", motivo_rejeicao: rejectReason, rejeitado_em: new Date().toISOString() },
    }).eq("id", card.id);
    if (card.parent_card_id) {
      const { data: proj } = await supabase.from("kanban_cards").select("details").eq("id", card.parent_card_id).single();
      if (proj) {
        const pd = (proj.details as Record<string, unknown>) ?? {};
        const solicits = ((pd.solicitacoes_compras as Array<Record<string, unknown>>) ?? []).map(s => s.id === card.id ? { ...s, status: "rejeitado", motivo: rejectReason } : s);
        await supabase.from("kanban_cards").update({ details: { ...pd, solicitacoes_compras: solicits } }).eq("id", card.parent_card_id);
      }
    }
    setActing(false); setRejecting(false); onReload?.(); onClose();
  };

  /* ── Estado de edição ── */
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: card.title,
    priority: card.priority ?? "media" as "alta" | "media" | "baixa",
    solicitante: (det?.solicitante as string) ?? "",
    tipo_requisicao: (det?.tipo_requisicao as string) ?? "",
    data_limite_entrega: (det?.data_limite_entrega as string) ?? "",
    endereco: (det?.endereco as string) ?? "",
    justificativa: (det?.justificativa as string) ?? "",
    itens_raw: ((det?.itens as string[]) ?? []).join("\n"),
  });

  /* ── Vínculo com projeto ── */
  const [parentCardId, setParentCardId] = useState<string | null>(card.parent_card_id ?? null);
  const [linkedProject, setLinkedProject] = useState<ObraOption | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [obraOptions, setObraOptions] = useState<ObraOption[]>([]);
  const [loadingObras, setLoadingObras] = useState(false);

  // Carrega info do projeto vinculado
  useEffect(() => {
    if (!parentCardId) { setLinkedProject(null); return; }
    supabase.from("kanban_cards").select("id,title,obra").eq("id", parentCardId).single()
      .then(({ data }) => { if (data) setLinkedProject(data as ObraOption); });
  }, [parentCardId]);

  // Carrega lista de obras quando abre o picker
  useEffect(() => {
    if (!showProjectPicker || obraOptions.length > 0) return;
    setLoadingObras(true);
    supabase.from("kanban_cards")
      .select("id,title,obra")
      .in("dept_id", ["obras", "projetos"])
      .not("obra", "is", null)
      .order("obra")
      .limit(1000)
      .then(({ data }) => {
        setObraOptions((data ?? []) as ObraOption[]);
        setLoadingObras(false);
      });
  }, [showProjectPicker]);

  /* ── Dados do card ── */
  const solicitante = editing ? form.solicitante : ((det?.solicitante as string) || "");
  const justificativa = editing ? form.justificativa : ((det?.justificativa as string) || "");
  const endereco = editing ? form.endereco : ((det?.endereco as string) || "");
  const dataLimite = editing ? form.data_limite_entrega : ((det?.data_limite_entrega as string) || "");
  const itens: string[] = editing
    ? form.itens_raw.split("\n").map(l => l.trim()).filter(Boolean)
    : ((det?.itens as string[]) ?? []);
  const labels = (det?.labels_trello as string[]) ?? card.tags ?? [];
  const [localChecklists, setLocalChecklists] = useState(
    (det?.checklists as Array<{ name: string; items: Array<{ name: string; done: boolean }> }>) ?? []
  );
  const [localAttachments, setLocalAttachments] = useState<Array<{ name: string; url?: string; mimeType?: string }>>(
    (det?.attachments as Array<{ name: string; url?: string; mimeType?: string }>) ?? []
  );
  const [uploading, setUploading] = useState(false);
  const attachments = localAttachments;
  const trelloUrl = (det?.trello_url as string) || "";
  const descricao = (det?.descricao_completa as string) || "";
  const tipo = getTipoCompras(editing ? { ...det, tipo_requisicao: form.tipo_requisicao } : det);

  const totalItems = localChecklists.reduce((s, cl) => s + cl.items.length, 0);
  const doneItems = localChecklists.reduce((s, cl) => s + cl.items.filter(i => i.done).length, 0);

  const toggleItem = async (ci: number, ii: number) => {
    if (!isDbCardId(card.id)) return;
    const updated = localChecklists.map((cl, cIdx) =>
      cIdx !== ci ? cl : { ...cl, items: cl.items.map((item, iIdx) => iIdx !== ii ? item : { ...item, done: !item.done }) }
    );
    setLocalChecklists(updated);
    await supabase.from("kanban_cards").update({ details: { ...(det ?? {}), checklists: updated } }).eq("id", card.id);
    onReload?.();
  };

  const fmtDate = (d: string) => {
    if (!d) return "A definir";
    try { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return d; }
  };

  /* ── Salvar edição ── */
  const handleSave = async () => {
    if (!isDbCardId(card.id)) return;
    setSaving(true);
    const newDetails = {
      ...(det ?? {}),
      solicitante: form.solicitante,
      tipo_requisicao: form.tipo_requisicao,
      data_limite_entrega: form.data_limite_entrega,
      endereco: form.endereco,
      justificativa: form.justificativa,
      itens: form.itens_raw.split("\n").map(l => l.trim()).filter(Boolean),
    };
    await supabase.from("kanban_cards").update({
      title: form.title,
      priority: form.priority,
      details: newDetails,
      parent_card_id: parentCardId ?? null,
    }).eq("id", card.id);
    setSaving(false);
    setEditing(false);
    onReload?.();
  };

  /* ── Vincular projeto ── */
  const handleSelectProject = async (obra: ObraOption) => {
    setParentCardId(obra.id);
    setLinkedProject(obra);
    setShowProjectPicker(false);
    setProjectSearch("");
    if (isDbCardId(card.id)) {
      await supabase.from("kanban_cards").update({ parent_card_id: obra.id }).eq("id", card.id);
      onReload?.();
    }
  };

  const handleUnlink = async () => {
    setParentCardId(null);
    setLinkedProject(null);
    if (isDbCardId(card.id)) {
      await supabase.from("kanban_cards").update({ parent_card_id: null }).eq("id", card.id);
      onReload?.();
    }
  };

  const filteredObras = obraOptions.filter(o => {
    const q = projectSearch.toLowerCase();
    return !q || o.title.toLowerCase().includes(q) || (o.obra ?? "").toLowerCase().includes(q);
  });

  const iStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 7, color: "white", fontSize: "0.72rem", padding: "7px 10px", outline: "none", boxSizing: "border-box" };
  const lStyle: React.CSSProperties = { display: "block", fontSize: "0.45rem", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 4 };
  const sectionStyle: React.CSSProperties = { background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px", marginBottom: 10 };
  const labelStyle: React.CSSProperties = { fontSize: "0.45rem", fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 4, display: "block" };
  const valueStyle: React.CSSProperties = { fontSize: "0.7rem", color: "rgba(255,255,255,0.85)" };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
    >
      <div style={{ background: "#111", border: `1px solid ${BORDER}`, borderRadius: 18, width: "100%", maxWidth: 600, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── Header ── */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="rounded px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 700, background: tipo.bg, color: tipo.color }}>{tipo.label}</span>
                {(editing ? form.priority : card.priority) === "alta" && (
                  <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 700, background: "rgba(239,68,68,0.12)", color: RED }}>Alta Prioridade</span>
                )}
                <SlaChip status={card.slaStatus} />
              </div>
              {editing ? (
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ ...iStyle, fontSize: "0.9rem", fontWeight: 700, marginBottom: 4 }} />
              ) : (
                <h2 style={{ color: "white", fontSize: "0.95rem", fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{card.title}</h2>
              )}
              {!editing && solicitante && (
                <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 4 }}>Solicitado por: <span style={{ color: ACCENT }}>{solicitante}</span></p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!editing && (
                <button onClick={() => setEditing(true)} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "5px 10px", fontSize: "0.55rem", color: TEXT_MED, cursor: "pointer" }}>
                  Editar
                </button>
              )}
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM }}><X size={18} /></button>
            </div>
          </div>

          {/* Labels */}
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {labels.map((l, i) => (
                <span key={i} className="rounded px-2 py-0.5" style={{ fontSize: "0.45rem", background: "rgba(255,255,255,0.06)", color: TEXT_MED }}>{l}</span>
              ))}
            </div>
          )}

          {/* Projeto vinculado */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {linkedProject ? (
              <>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(16,185,129,0.06)", border: `1px solid rgba(16,185,129,0.2)` }}>
                  <Briefcase size={11} style={{ color: GREEN }} />
                  <span style={{ fontSize: "0.58rem", color: GREEN, fontWeight: 600 }}>
                    {linkedProject.obra ? `${linkedProject.obra} — ` : ""}{linkedProject.title}
                  </span>
                </div>
                <button
                  onClick={() => nav(`/obra/${linkedProject.id}`)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
                  style={{ fontSize: "0.55rem", fontWeight: 600, background: "rgba(16,185,129,0.1)", color: GREEN, border: `1px solid rgba(16,185,129,0.25)`, cursor: "pointer" }}
                >
                  <Eye size={10} /> Abrir Projeto
                </button>
                <button onClick={handleUnlink} style={{ fontSize: "0.5rem", color: TEXT_DIM, background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>Desvincular</button>
              </>
            ) : (
              <button
                onClick={() => setShowProjectPicker(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                style={{ fontSize: "0.55rem", fontWeight: 600, color: TEXT_DIM, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, cursor: "pointer" }}
              >
                <Plus size={10} /> Vincular Projeto
              </button>
            )}
          </div>

          {/* Project picker dropdown */}
          {showProjectPicker && (
            <div style={{ marginTop: 8, background: "#161616", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", maxHeight: 220 }}>
              <div style={{ padding: "8px 10px", borderBottom: `1px solid ${BORDER}` }}>
                <input
                  autoFocus
                  value={projectSearch}
                  onChange={e => setProjectSearch(e.target.value)}
                  placeholder="Buscar por obra ou cliente..."
                  style={{ ...iStyle, fontSize: "0.65rem" }}
                />
              </div>
              <div style={{ overflowY: "auto", maxHeight: 165 }}>
                {loadingObras && <p style={{ padding: "12px", fontSize: "0.6rem", color: TEXT_DIM, textAlign: "center" }}>Carregando obras...</p>}
                {!loadingObras && filteredObras.length === 0 && <p style={{ padding: "12px", fontSize: "0.6rem", color: TEXT_DIM, textAlign: "center" }}>Nenhuma obra encontrada.</p>}
                {filteredObras.map(o => (
                  <button
                    key={o.id}
                    onClick={() => handleSelectProject(o)}
                    className="w-full text-left flex items-center gap-2 px-3 py-2"
                    style={{ background: "transparent", border: "none", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}
                  >
                    {o.obra && <span style={{ fontSize: "0.55rem", fontWeight: 600, color: ACCENT, flexShrink: 0 }}>{o.obra}</span>}
                    <span className="truncate" style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.8)" }}>{o.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          {!editing && (
            <div className="flex gap-1 mt-3 flex-wrap">
              {(["overview", "checklist", "attachments", "raw"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "5px 10px", borderRadius: 6, fontSize: "0.55rem", fontWeight: 600, cursor: "pointer",
                  background: tab === t ? ACCENT + "20" : "transparent",
                  color: tab === t ? ACCENT : TEXT_DIM,
                  border: `1px solid ${tab === t ? ACCENT + "40" : "transparent"}`,
                }}>
                  {t === "overview" ? "Visão Geral" : t === "checklist" ? `Checklist${totalItems > 0 ? ` ${doneItems}/${totalItems}` : ""}` : t === "attachments" ? `Anexos${attachments.length > 0 ? ` (${attachments.length})` : ""}` : "Original"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {/* ═══ EDIT MODE ═══ */}
          {editing && (
            <div className="space-y-3">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lStyle}>Tipo de Requisição</label>
                  <select value={form.tipo_requisicao} onChange={e => setForm(f => ({ ...f, tipo_requisicao: e.target.value }))} style={{ ...iStyle }}>
                    <option value="">Selecionar...</option>
                    {Object.entries(TIPO_COMPRAS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle}>Prioridade</label>
                  <div className="flex gap-1.5 mt-1">
                    {(["alta", "media", "baixa"] as const).map(p => (
                      <button key={p} type="button" onClick={() => setForm(f => ({ ...f, priority: p }))} style={{
                        flex: 1, padding: "6px 2px", borderRadius: 6, fontSize: "0.58rem", fontWeight: form.priority === p ? 700 : 400, cursor: "pointer",
                        background: form.priority === p ? (p === "alta" ? "rgba(239,68,68,0.2)" : p === "media" ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)") : "rgba(255,255,255,0.03)",
                        border: `1px solid ${form.priority === p ? (p === "alta" ? RED : p === "media" ? YELLOW : GREEN) + "60" : BORDER}`,
                        color: form.priority === p ? (p === "alta" ? RED : p === "media" ? YELLOW : GREEN) : TEXT_DIM,
                      }}>
                        {p === "alta" ? "Alta" : p === "media" ? "Média" : "Baixa"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lStyle}>Solicitante</label>
                  <input value={form.solicitante} onChange={e => setForm(f => ({ ...f, solicitante: e.target.value }))} placeholder="Nome do solicitante" style={iStyle} />
                </div>
                <div>
                  <label style={lStyle}>Data Limite de Entrega</label>
                  <input type="date" value={form.data_limite_entrega} onChange={e => setForm(f => ({ ...f, data_limite_entrega: e.target.value }))} style={iStyle} />
                </div>
              </div>

              <div>
                <label style={lStyle}>Endereço / Local de Entrega</label>
                <input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, cidade..." style={iStyle} />
              </div>

              <div>
                <label style={lStyle}>Justificativa</label>
                <textarea value={form.justificativa} onChange={e => setForm(f => ({ ...f, justificativa: e.target.value }))} rows={2} placeholder="Por que esta compra é necessária?" style={{ ...iStyle, resize: "vertical" }} />
              </div>

              <div>
                <label style={lStyle}>Itens (um por linha)</label>
                <textarea value={form.itens_raw} onChange={e => setForm(f => ({ ...f, itens_raw: e.target.value }))} rows={5} placeholder={"1 unidade de...\n2 metros de..."} style={{ ...iStyle, resize: "vertical", fontFamily: "monospace", lineHeight: 1.6 }} />
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "9px", background: saving ? "rgba(212,168,83,0.2)" : ACCENT, border: "none", borderRadius: 8, color: saving ? TEXT_DIM : "#0A0A0A", fontSize: "0.72rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </button>
                <button onClick={() => setEditing(false)} style={{ flex: 1, padding: "9px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_DIM, fontSize: "0.72rem", cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* ═══ VIEW MODE ═══ */}
          {!editing && (
            <>
              {/* ── Banner aceitar/rejeitar solicitação ── */}
              {statusSolicitacao === "pendente" && (
                <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: YELLOW, flexShrink: 0, animation: "pulse 1.5s infinite" }} />
                    <p style={{ fontSize: "0.72rem", fontWeight: 600, color: YELLOW, margin: 0 }}>Solicitação aguardando resposta do setor de Compras</p>
                  </div>
                  {!rejecting ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleAceitarSolicitacao} disabled={acting} style={{ flex: 1, padding: "8px 12px", background: acting ? "rgba(16,185,129,0.1)" : "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 8, color: acting ? TEXT_DIM : GREEN, fontSize: "0.68rem", fontWeight: 700, cursor: acting ? "not-allowed" : "pointer" }}>
                        {acting ? "Processando..." : "✓ Aceitar Solicitação"}
                      </button>
                      <button onClick={() => setRejecting(true)} disabled={acting} style={{ flex: 1, padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: RED, fontSize: "0.68rem", fontWeight: 700, cursor: acting ? "not-allowed" : "pointer" }}>
                        ✕ Rejeitar
                      </button>
                    </div>
                  ) : (
                    <div>
                      <textarea
                        value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                        placeholder="Motivo da rejeição (obrigatório)..."
                        style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 7, color: "white", fontSize: "0.68rem", padding: "7px 10px", outline: "none", boxSizing: "border-box", resize: "none", marginBottom: 8 }}
                        autoFocus
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={handleRejeitarSolicitacao} disabled={acting || !rejectReason.trim()} style={{ flex: 1, padding: "7px 12px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: RED, fontSize: "0.65rem", fontWeight: 700, cursor: (!rejectReason.trim() || acting) ? "not-allowed" : "pointer", opacity: (!rejectReason.trim() || acting) ? 0.5 : 1 }}>
                          {acting ? "Processando..." : "Confirmar Rejeição"}
                        </button>
                        <button onClick={() => { setRejecting(false); setRejectReason(""); }} style={{ padding: "7px 12px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_DIM, fontSize: "0.65rem", cursor: "pointer" }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {statusSolicitacao === "aceito" && (
                <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={14} style={{ color: GREEN, flexShrink: 0 }} />
                  <p style={{ fontSize: "0.65rem", color: GREEN, fontWeight: 600, margin: 0 }}>Solicitação aceita — em cotação</p>
                </div>
              )}
              {statusSolicitacao === "rejeitado" && (
                <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
                  <p style={{ fontSize: "0.65rem", color: RED, fontWeight: 600, margin: 0 }}>Solicitação rejeitada</p>
                  {(det?.motivo_rejeicao as string) && <p style={{ fontSize: "0.6rem", color: TEXT_DIM, margin: "4px 0 0" }}>Motivo: {det?.motivo_rejeicao as string}</p>}
                </div>
              )}

              {/* ── Materiais da solicitação (novo formato) ── */}
              {Array.isArray(det?.materiais) && (det.materiais as MaterialItem[]).length > 0 && tab === "overview" && (
                <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                  <span style={{ fontSize: "0.45rem", fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 10, display: "block" }}>
                    Materiais Solicitados ({(det.materiais as MaterialItem[]).length})
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(det.materiais as MaterialItem[]).map((m, i) => (
                      <div key={i} style={{ borderLeft: `2px solid ${ACCENT}40`, paddingLeft: 10 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontSize: "0.68rem", color: "white", fontWeight: 600 }}>{m.tipo}</span>
                          {m.quantidade && <span style={{ fontSize: "0.58rem", color: ACCENT }}>{m.quantidade}</span>}
                        </div>
                        {m.justificativa && <p style={{ fontSize: "0.6rem", color: TEXT_MED, margin: "3px 0 0", lineHeight: 1.5 }}>{m.justificativa}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Overview Tab ── */}
              {tab === "overview" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    {solicitante && (
                      <div style={sectionStyle}>
                        <span style={labelStyle}>Solicitante</span>
                        <p style={valueStyle}>{solicitante}</p>
                      </div>
                    )}
                    {dataLimite && (
                      <div style={sectionStyle}>
                        <span style={labelStyle}>Data Limite</span>
                        <p style={{ ...valueStyle, color: YELLOW }}>{fmtDate(dataLimite)}</p>
                      </div>
                    )}
                    {endereco && (
                      <div style={{ ...sectionStyle, gridColumn: "1 / -1" }}>
                        <span style={labelStyle}>Endereço / Local de Entrega</span>
                        <p style={valueStyle}>{endereco}</p>
                      </div>
                    )}
                  </div>

                  {justificativa && (
                    <div style={sectionStyle}>
                      <span style={labelStyle}>Justificativa</span>
                      <p style={{ ...valueStyle, fontSize: "0.65rem", lineHeight: 1.6 }}>{justificativa}</p>
                    </div>
                  )}

                  {itens.length > 0 && (
                    <div style={sectionStyle}>
                      <span style={labelStyle}>Itens da Solicitação ({itens.length})</span>
                      <div className="space-y-1 mt-1">
                        {itens.map((item, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span style={{ color: ACCENT, fontSize: "0.65rem", flexShrink: 0 }}>{i + 1}.</span>
                            <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Observações (COMPRASFIX1 port: lê obs_solicitacao OU observacoes pra cards antigos) */}
                  {(((det?.obs_solicitacao as string) || (det?.observacoes as string) || "").trim()) && (
                    <div style={sectionStyle}>
                      <span style={labelStyle}>Observações</span>
                      <p style={{ ...valueStyle, fontSize: "0.65rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {((det?.obs_solicitacao as string) || (det?.observacoes as string) || "").trim()}
                      </p>
                    </div>
                  )}

                  {totalItems > 0 && (
                    <div style={sectionStyle}>
                      <div className="flex items-center justify-between mb-2">
                        <span style={labelStyle}>Progresso Checklist</span>
                        <span style={{ fontSize: "0.55rem", color: doneItems === totalItems ? GREEN : TEXT_DIM }}>{doneItems}/{totalItems}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full" style={{ width: `${totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0}%`, background: doneItems === totalItems ? GREEN : ACCENT }} />
                      </div>
                    </div>
                  )}

                  {trelloUrl && (
                    <div style={{ marginTop: 8 }}>
                      <a href={trelloUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.55rem", color: BLUE, textDecoration: "none" }}>
                        🔗 Ver card original no Trello
                      </a>
                    </div>
                  )}
                </>
              )}

              {/* ── Checklist Tab ── */}
              {tab === "checklist" && (
                <>
                  {checklists.length === 0 ? (
                    <p style={{ fontSize: "0.65rem", color: TEXT_DIM, textAlign: "center", padding: "40px 0" }}>Nenhum checklist neste card.</p>
                  ) : (
                    localChecklists.map((cl, ci) => (
                      <div key={ci} style={{ ...sectionStyle, marginBottom: 12 }}>
                        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 8 }}>{cl.name}</p>
                        <div className="space-y-1.5">
                          {cl.items.map((item, ii) => (
                            <div key={ii} className="flex items-start gap-2" onClick={() => toggleItem(ci, ii)} style={{ cursor: "pointer" }}>
                              <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 1, background: item.done ? GREEN : "transparent", border: `1px solid ${item.done ? GREEN : "rgba(255,255,255,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {item.done && <CheckCircle2 size={9} style={{ color: "white" }} />}
                              </div>
                              <p style={{ fontSize: "0.62rem", color: item.done ? TEXT_DIM : "rgba(255,255,255,0.75)", textDecoration: item.done ? "line-through" : "none", lineHeight: 1.5 }}>{item.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* ── Attachments Tab ── */}
              {tab === "attachments" && (
                <>
                  {/* Upload button */}
                  {isDbCardId(card.id) && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
                        padding: "12px", borderRadius: 8, cursor: uploading ? "not-allowed" : "pointer",
                        background: "rgba(59,130,246,0.08)", border: "1px dashed rgba(59,130,246,0.3)",
                        color: BLUE, fontSize: "0.65rem", fontWeight: 600,
                      }}>
                        {uploading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={14} />}
                        {uploading ? "Enviando..." : "Anexar Arquivo"}
                        <input type="file" multiple hidden disabled={uploading} onChange={async (ev) => {
                          const fileList = ev.target.files;
                          if (!fileList || fileList.length === 0 || !isDbCardId(card.id)) return;
                          setUploading(true);
                          try {
                            // Fetch fresh details
                            const { data: freshCard } = await supabase.from("kanban_cards").select("details").eq("id", card.id).single();
                            const freshDet = (freshCard?.details as Record<string, unknown>) ?? {};
                            const existingAtts = (freshDet.attachments as Array<{ name: string; url?: string; mimeType?: string }>) ?? [];
                            const newAtts = [...existingAtts];

                            for (let fi = 0; fi < fileList.length; fi++) {
                              const file = fileList[fi];
                              const ts = Date.now();
                              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                              const storagePath = card.id + "/" + ts + "_" + safeName;
                              const { error: upErr } = await supabase.storage.from("card-attachments").upload(storagePath, file);
                              if (upErr) { console.error("Upload error:", upErr.message); continue; }
                              const { data: urlData } = supabase.storage.from("card-attachments").getPublicUrl(storagePath);
                              newAtts.push({ name: file.name, url: urlData.publicUrl, mimeType: file.type || undefined });
                            }

                            // Persist
                            await supabase.from("kanban_cards").update({
                              details: { ...freshDet, attachments: newAtts, attachments_count: newAtts.length },
                            }).eq("id", card.id);
                            setLocalAttachments(newAtts);
                            onReload?.();
                          } catch (err) { console.error("Attachment upload failed:", err); }
                          setUploading(false);
                          ev.target.value = "";
                        }} />
                      </label>
                    </div>
                  )}

                  {attachments.length === 0 ? (
                    <p style={{ fontSize: "0.65rem", color: TEXT_DIM, textAlign: "center", padding: "30px 0" }}>Nenhum anexo neste card.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {attachments.map((att, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid " + BORDER }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <FileText size={14} style={{ color: BLUE }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: "0.65rem", color: "white", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{att.name}</p>
                            {att.mimeType && <p style={{ fontSize: "0.5rem", color: TEXT_DIM, margin: 0 }}>{att.mimeType}</p>}
                          </div>
                          {att.url && (
                            <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.55rem", color: BLUE, textDecoration: "none", flexShrink: 0, padding: "4px 8px" }}>Ver</a>
                          )}
                          {isDbCardId(card.id) && (
                            <button type="button" onClick={async () => {
                              try {
                                if (att.url) {
                                  const m = att.url.match(/card-attachments\/(.+)$/);
                                  if (m) await supabase.storage.from("card-attachments").remove([decodeURIComponent(m[1])]);
                                }
                                const { data: freshCard } = await supabase.from("kanban_cards").select("details").eq("id", card.id).single();
                                const freshDet = (freshCard?.details as Record<string, unknown>) ?? {};
                                const existingAtts = (freshDet.attachments as Array<{ name: string; url?: string; mimeType?: string }>) ?? [];
                                const updated = existingAtts.filter((_, j) => j !== idx);
                                await supabase.from("kanban_cards").update({
                                  details: { ...freshDet, attachments: updated, attachments_count: updated.length },
                                }).eq("id", card.id);
                                setLocalAttachments(updated);
                                onReload?.();
                              } catch (err) { console.error("Delete attachment failed:", err); }
                            }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.5)", padding: 4, flexShrink: 0 }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── Raw Tab ── */}
              {tab === "raw" && (
                <div style={sectionStyle}>
                  <span style={labelStyle}>Descrição Original (Trello)</span>
                  {descricao ? (
                    <pre style={{ fontSize: "0.58rem", color: TEXT_MED, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6, margin: 0 }}>{descricao}</pre>
                  ) : (
                    <p style={{ fontSize: "0.62rem", color: TEXT_DIM }}>Sem descrição original.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ KANBAN CARD ═══ */
const CARD_DRAG_TYPE = "KANBAN_CARD";

function KCard({ card, color, columnId, deptId, onClick, onAccepted }: { card: KanbanCard; color: string; columnId: string; deptId?: string; onClick?: () => void; onAccepted?: () => void }) {
  const nav = useNavigate();
  const [returning, setReturning] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [acting, setActing] = useState(false);
  const [{ isDragging }, dragRef] = useDrag({
    type: CARD_DRAG_TYPE,
    item: { cardId: card.id, fromColumnId: columnId },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDbCardId(card.id) || acting) return;
    setActing(true);
    await acceptHandoff(card.id, "Usuário");
    onAccepted?.();
    // PMO: dispara cálculo automático ao aceitar projeto (card estava em "entrada")
    if (deptId === "produtividade" && columnId === "entrada") {
      fetch("https://agente.parket.works/api/pmo/auto-calcular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: card.id, dept_id: "produtividade" }),
      }).catch(() => {});
    }
    setActing(false);
  };

  const handleReturn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!returnReason.trim() || !isDbCardId(card.id) || acting) return;
    setActing(true);
    await returnHandoff(card.id, returnReason.trim(), "Usuário");
    onAccepted?.();
    setActing(false);
    setReturning(false);
    setReturnReason("");
  };

  const isPending = card.handoff_pending;
  const tipoColor = card.tipo_projeto ? TIPO_PROJETO_COLORS[card.tipo_projeto] : null;

  // ── WhatsApp "Sem Resposta" chip ──
  const inbox = extractInbox(card.details);
  const [, tickInbox] = useState(0);
  useEffect(() => {
    if (!inbox.isUnread) return;
    const iv = setInterval(() => tickInbox(v => v + 1), 30000);
    return () => clearInterval(iv);
  }, [inbox.isUnread]);

  // ── Compras: render customized card ──
  if (["compras", "compras-taiara", "compras-marco"].includes(deptId)) {
    const tipoCompras = getTipoCompras(card.details);
    return (
      <div
        ref={dragRef as unknown as React.Ref<HTMLDivElement>}
        className="rounded-lg mb-2 transition-transform duration-150 hover:translate-y-[-1px] cursor-grab active:cursor-grabbing overflow-hidden"
        style={{
          background: CARD_BG,
          border: `1px solid ${tipoCompras.color}30`,
          borderTop: `2px solid ${tipoCompras.color}`,
          opacity: isDragging ? 0.4 : 1,
          transform: isDragging ? "translate3d(0,0,0) rotate(2deg) scale(1.02)" : "translate3d(0,0,0)",
          willChange: "transform",
        }}
        onClick={onClick}
      >
        <ComprasCardContent card={card} />
      </div>
    );
  }

  return (
    <div
      ref={dragRef as unknown as React.Ref<HTMLDivElement>}
      className="rounded-lg mb-2 transition-transform duration-150 hover:translate-y-[-1px] cursor-grab active:cursor-grabbing overflow-hidden"
      style={{
        background: isPending ? "rgba(245,158,11,0.04)" : CARD_BG,
        border: `1px solid ${isPending ? "rgba(245,158,11,0.25)" : tipoColor ? tipoColor.color + "35" : BORDER}`,
        opacity: isDragging ? 0.4 : 1,
        transform: isDragging ? "translate3d(0,0,0) rotate(2deg) scale(1.02)" : "translate3d(0,0,0)",
        willChange: "transform",
      }}
      onClick={onClick}
    >
      {/* Barra de cor do tipo de projeto */}
      {tipoColor && (
        <div className="h-0.5 w-full" style={{ background: tipoColor.color }} />
      )}
      <div style={{ padding: "10px 12px", position: "relative" }}>
      {/* Chip WhatsApp "Sem Resposta" */}
      {inbox.isUnread && (
        <div
          style={{
            position: "absolute", top: 6, right: 6,
            display: "flex", alignItems: "center", gap: 4,
            background: "rgba(239,68,68,0.92)", color: "white",
            padding: "3px 7px", borderRadius: 999,
            fontSize: "0.5rem", fontWeight: 800, letterSpacing: "0.04em",
            boxShadow: "0 0 0 2px rgba(239,68,68,0.18)",
            animation: "pulse 2s infinite",
          }}
          title={`Sem resposta há ${formatWaitTime(inbox.secondsWaiting)}`}
        >
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "white" }} />
          {formatWaitTime(inbox.secondsWaiting)}
        </div>
      )}
      {/* Banner de aceite pendente */}
      {isPending && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)" }}>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: YELLOW }} />
          <span style={{ fontSize: "0.5rem", fontWeight: 600, color: YELLOW }}>
            Aguardando aceite{card.handoff_from_dept ? ` — enviado por ${card.handoff_from_dept}` : ""}
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <p className="text-white truncate" style={{ fontSize: "0.72rem", fontWeight: 500, lineHeight: 1.3 }}>{card.title}</p>
        <div className="flex items-center gap-1 shrink-0">
          {tipoColor && (
            <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.4rem", fontWeight: 700, background: tipoColor.color + "20", color: tipoColor.color, border: `1px solid ${tipoColor.color}35` }}>
              {tipoColor.label}
            </span>
          )}
          {card.priority === "alta" && <span className="w-2 h-2 rounded-full" style={{ background: RED, marginTop: 1 }} />}
        </div>
      </div>
      {card.subtitle && <p className="mb-2 truncate" style={{ fontSize: "0.6rem", color: TEXT_MED, lineHeight: 1.4 }}>{card.subtitle}</p>}
      {card.tags && card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.tags.map(t => (
            <span key={t} className="rounded px-1.5 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 500, background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>{t}</span>
          ))}
        </div>
      )}
      {/* Chip de prazo em dias úteis — editável */}
      <PrazoChip card={card} />
      {card.progress !== undefined && (
        <div className="mb-2">
          <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${card.progress}%`, background: card.progress > 75 ? GREEN : card.progress > 40 ? YELLOW : color }} />
          </div>
          <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{card.progress}%</span>
        </div>
      )}
      {card.checklist && (
        <div className="flex items-center gap-1 mb-2">
          <CheckCircle2 size={10} style={{ color: card.checklist.done === card.checklist.total ? GREEN : TEXT_DIM }} />
          <span style={{ fontSize: "0.55rem", color: card.checklist.done === card.checklist.total ? GREEN : TEXT_MED }}>
            {card.checklist.done}/{card.checklist.total}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between mt-1.5 pt-1.5" style={{ borderTop: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: `${color}22`, fontSize: "0.4rem", fontWeight: 600, color }}>
            {card.responsavel.charAt(0)}
          </div>
          <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{card.responsavel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {card.value && <span style={{ fontSize: "0.55rem", color: ACCENT, fontWeight: 500 }}>{card.value}</span>}
          <SlaChip status={card.slaStatus} />
        </div>
      </div>
      {card.gate !== undefined && (
        <div className="mt-1.5">
          <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: "rgba(212,168,83,0.12)", color: GOLD }}>
            Gate {card.gate}
          </span>
        </div>
      )}
      {/* Seção de ações do card */}
      <div className="mt-2 pt-2 space-y-1.5" style={{ borderTop: `1px solid ${isPending ? "rgba(245,158,11,0.15)" : BORDER}` }} onClick={e => e.stopPropagation()}>

        {/* Botão Abrir Projeto — sempre visível para cards do banco.
            Se o card for filho (secondary handoff), abre o card pai (ficha original). */}
        {isDbCardId(card.id) && (
          <button
            onClick={e => { e.stopPropagation(); nav(`/obra/${card.parent_card_id ?? card.id}`); }}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all"
            style={{
              fontSize: "0.6rem", fontWeight: 600,
              color: isPending ? ACCENT : "rgba(255,255,255,0.7)",
              background: isPending ? "rgba(212,168,83,0.12)" : "rgba(255,255,255,0.04)",
              border: isPending ? `1px solid rgba(212,168,83,0.3)` : `1px solid ${BORDER}`,
              cursor: "pointer",
            }}
          >
            <Eye size={11} />
            {isPending ? "Abrir Projeto Completo" : "Abrir Projeto"}
          </button>
        )}

        {/* Aceitar / Devolver — apenas para cards pendentes */}
        {isPending && (
          <>
            {!returning ? (
              <div className="flex gap-1.5">
                <button
                  onClick={handleAccept}
                  disabled={acting || !isDbCardId(card.id)}
                  className="flex-1 rounded-lg py-1.5 flex items-center justify-center gap-1 transition-all"
                  style={{ fontSize: "0.55rem", fontWeight: 600, background: "rgba(16,185,129,0.12)", color: GREEN, border: "1px solid rgba(16,185,129,0.2)", cursor: acting ? "default" : "pointer" }}
                >
                  {acting ? <Loader2 size={9} className="animate-spin" /> : <CheckCircle2 size={9} />}
                  Aceitar Projeto
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setReturning(true); }}
                  className="rounded-lg px-2.5 py-1.5 flex items-center justify-center gap-1 transition-all"
                  style={{ fontSize: "0.55rem", fontWeight: 600, background: "rgba(239,68,68,0.08)", color: RED, border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}
                >
                  <AlertTriangle size={9} />Devolver
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <textarea
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  placeholder="Motivo da devolução..."
                  rows={2}
                  className="w-full rounded-lg px-2 py-1.5 outline-none resize-none"
                  style={{ fontSize: "0.55rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(239,68,68,0.2)", color: "white" }}
                  onClick={e => e.stopPropagation()}
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleReturn}
                    disabled={!returnReason.trim() || acting}
                    className="flex-1 rounded-lg py-1 flex items-center justify-center gap-1"
                    style={{ fontSize: "0.5rem", fontWeight: 600, background: returnReason.trim() ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.03)", color: returnReason.trim() ? RED : TEXT_DIM, border: "1px solid rgba(239,68,68,0.2)", cursor: returnReason.trim() ? "pointer" : "default" }}
                  >
                    {acting ? <Loader2 size={9} className="animate-spin" /> : null}
                    Confirmar devolução
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setReturning(false); setReturnReason(""); }}
                    className="rounded-lg px-2 py-1"
                    style={{ fontSize: "0.5rem", background: "rgba(255,255,255,0.04)", color: TEXT_DIM, border: `1px solid ${BORDER}`, cursor: "pointer" }}
                  >
                    <X size={9} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </div>{/* end p-3 */}
    </div>
  );
}

/* ═══ KANBAN COLUMN (drop target) ═══ */
function KanbanColumn({
  col, color, deptId, onCardClick, onMoveCard, onAddCard, canEdit, onCardAccepted,
}: {
  col: KanbanColumn;
  color: string;
  deptId?: string;
  onCardClick?: (card: KanbanCard) => void;
  onMoveCard: (cardId: string, fromColId: string, toColId: string) => void;
  onAddCard?: (columnId: string) => void;
  canEdit?: boolean;
  onCardAccepted?: () => void;
}) {
  const [{ isOver, canDrop }, dropRef] = useDrop({
    accept: CARD_DRAG_TYPE,
    drop: (item: { cardId: string; fromColumnId: string }) => {
      if (item.fromColumnId !== col.id) {
        onMoveCard(item.cardId, item.fromColumnId, col.id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const isActive = isOver && canDrop;

  return (
    <div
      ref={dropRef as unknown as React.Ref<HTMLDivElement>}
      className="shrink-0 rounded-xl p-2.5 transition-all duration-200 flex flex-col"
      style={{
        width: 260,
        background: isActive ? `${col.color}10` : "rgba(255,255,255,0.015)",
        border: `1px solid ${isActive ? col.color + "50" : BORDER}`,
        boxShadow: isActive ? `0 0 0 2px ${col.color}20` : undefined,
      }}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
            <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{col.title}</span>
          </div>
          {col.slaLabel && (
            <div className="flex items-center gap-1.5 pl-4">
              <span style={{ fontSize: "0.45rem", color: TEXT_DIM, letterSpacing: "0.05em" }}>{col.slaLabel}</span>
              {col.slaHours != null && (
                <span className="rounded-sm px-1 py-px" style={{ fontSize: "0.42rem", fontWeight: 700, background: `${col.color}20`, color: col.color }}>
                  SLA {col.slaHours}h
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full w-5 h-5 flex items-center justify-center" style={{ fontSize: "0.5rem", fontWeight: 600, background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>
            {col.cards.length}
          </span>
          {canEdit && (
            <button
              onClick={() => onAddCard?.(col.id)}
              className="rounded-full w-5 h-5 flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, color: TEXT_DIM, cursor: "pointer" }}
              title="Novo card"
            >
              <Plus size={10} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 40 }}>
        {col.cards.map(card => (
          <KCard key={card.id} card={card} color={color} columnId={col.id} deptId={deptId} onClick={() => onCardClick?.(card)} onAccepted={onCardAccepted} />
        ))}
        {col.cards.length === 0 && (
          <div className="rounded-lg p-4 text-center transition-all" style={{ border: `1px dashed ${isActive ? col.color + "60" : "rgba(255,255,255,0.06)"}` }}>
            <p style={{ fontSize: "0.55rem", color: isActive ? col.color : TEXT_DIM }}>{isActive ? "Soltar aqui" : "Vazio"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ KANBAN BOARD ═══ */
function KanbanBoard({
  columns, color, deptId, onCardClick, onMoveCard, onAddCard, canEdit, onCardAccepted,
}: {
  columns: KanbanColumn[];
  color: string;
  deptId?: string;
  onCardClick?: (card: KanbanCard) => void;
  onMoveCard: (cardId: string, fromColId: string, toColId: string) => void;
  onAddCard?: (columnId: string) => void;
  canEdit?: boolean;
  onCardAccepted?: () => void;
}) {
  const isTouchDevice = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
  const dndBackend = isTouchDevice ? TouchBackend : HTML5Backend;
  const dndOptions = isTouchDevice ? { enableMouseEvents: true, delayTouchStart: 150 } : undefined;

  return (
    <DndProvider backend={dndBackend} options={dndOptions}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2" style={{ height: "calc(100vh - 210px)", minHeight: 400, alignItems: "stretch" }}>
        {columns.map(col => (
          <KanbanColumn
            key={col.id}
            col={col}
            color={color}
            deptId={deptId}
            onCardClick={onCardClick}
            onMoveCard={onMoveCard}
            onAddCard={onAddCard}
            canEdit={canEdit}
            onCardAccepted={onCardAccepted}
          />
        ))}
      </div>
    </DndProvider>
  );
}

/* ═══ 360° MODAL ═══ */
type Modal360Tab = "timeline" | "raci" | "checklist" | "handoffs" | "chat" | "financeiro" | "ia";

function Obra360Modal({ card, color, onClose }: { card: KanbanCard; color: string; onClose: () => void }) {
  const [tab, setTab] = useState<Modal360Tab>("timeline");
  const [iaQ, setIaQ] = useState("");
  const [iaA, setIaA] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatMessages, setChatMessages] = useState(
    card.chat_messages && card.chat_messages.length > 0
      ? card.chat_messages
      : [
          { id: 1, user: "Dany", msg: "Equipe Alpha ja esta no local. Iniciando preparacao do contrapiso.", time: "09:30", avatar: "D" },
          { id: 2, user: "Felipe", msg: "Vistoria de umidade OK. Liberado para inicio.", time: "10:15", avatar: "F" },
          { id: 3, user: "Talita", msg: "Cliente confirmou presenca na vistoria parcial de sexta.", time: "11:00", avatar: "T" },
          { id: 4, user: "Thainara", msg: "Projeto atualizado com nota sobre rodape. Versao v2.1 no drive.", time: "14:20", avatar: "Th" },
        ]
  );

  // Seções ricas: usa dados do banco se existirem, senão cai nos estáticos
  const gates = (card.gates_data && card.gates_data.length > 0)
    ? card.gates_data
    : getGatesForCard(card);

  const checklistItems = (card.checklist_items && card.checklist_items.length > 0)
    ? card.checklist_items
    : [
        { item: "Contrapiso nivelado", done: true },
        { item: "Umidade <= 3%", done: true },
        { item: "Material conferido na obra", done: true },
        { item: "Planta de paginacao impressa", done: true },
        { item: "EPI equipe verificado", done: true },
        { item: "Ferramentas calibradas", done: card.progress ? card.progress > 60 : false },
        { item: "Foto antes (registro)", done: card.progress ? card.progress > 30 : false },
        { item: "Aceite parcial cliente", done: false },
        { item: "Limpeza final", done: false },
        { item: "Foto depois (registro)", done: false },
      ];

  const obraHandoffs = (card.handoffs_data && card.handoffs_data.length > 0)
    ? card.handoffs_data
    : [
        { from: "Comercial", to: "Projetos", item: "Contrato + briefing", status: "done", date: "15/02" },
        { from: "Projetos", to: "Fiscal", item: "Pre-projeto + checklist", status: "done", date: "20/02" },
        { from: "Fiscal", to: "Compras", item: "Liberacao tecnica", status: "done", date: "22/02" },
        { from: "Compras", to: "Producao", item: "Material + NF", status: card.progress && card.progress > 50 ? "done" : "current", date: "01/03" },
        { from: "Producao", to: "Logistica", item: "Pecas QC + embaladas", status: card.progress && card.progress > 70 ? "done" : "pending", date: "-" },
        { from: "Logistica", to: "Obras", item: "Entrega em obra", status: "pending", date: "-" },
        { from: "Obras", to: "Atendimento", item: "Checklist entrega + fotos", status: "pending", date: "-" },
      ];

  const fd = card.financeiro_data;
  const financeiro = {
    valorContrato: fd?.valorContrato || card.value || "—",
    orcado: fd?.orcado || "—",
    realizado: fd?.realizado || "—",
    margemOrc: fd?.margemOrc || "—",
    margemReal: fd?.margemReal || "—",
    parcelas: fd?.parcelas || [
      { num: 1, valor: "R$ 62k", status: "pago", venc: "15/02" },
      { num: 2, valor: "R$ 62k", status: "pago", venc: "15/03" },
      { num: 3, valor: "R$ 61k", status: "pendente", venc: "15/04" },
    ],
    custos: fd?.custos || [
      { cat: "Material", valor: "R$ 52k", perc: 58 },
      { cat: "Mao de obra", valor: "R$ 28k", perc: 31 },
      { cat: "Frete", valor: "R$ 5k", perc: 6 },
      { cat: "Outros", valor: "R$ 4k", perc: 5 },
    ],
  };

  const raciData = (card.raci_data && card.raci_data.length > 0)
    ? card.raci_data
    : RACI_DATA;

  // ── Edit/Save state ──
  const canEdit = isDbCardId(card.id);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [editGates, setEditGates] = useState(gates);
  const [editChecklist, setEditChecklist] = useState(checklistItems);
  const [editHandoffs, setEditHandoffs] = useState(obraHandoffs);
  const [editFin, setEditFin] = useState(financeiro);
  const [editRaci, setEditRaci] = useState(raciData);
  const [editingTab, setEditingTab] = useState<Modal360Tab | null>(null);

  async function saveField(field: string, value: unknown) {
    if (!canEdit) return;
    setSaving(true);
    setSaveMsg("");
    const { error } = await supabase.from("kanban_cards").update({ [field]: value }).eq("id", card.id);
    setSaving(false);
    setSaveMsg(error ? "Erro ao salvar." : "Salvo!");
    setTimeout(() => setSaveMsg(""), 2000);
  }

  const inputStyle: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, borderRadius: 8, color: "white", fontSize: "0.72rem", padding: "6px 10px", outline: "none" };
  const smallBtnStyle: React.CSSProperties = { fontSize: "0.6rem", padding: "4px 10px", borderRadius: 6, cursor: "pointer", border: "none" };

  const tabs: { id: Modal360Tab; label: string; icon: React.ElementType }[] = [
    { id: "timeline", label: "Timeline Gates", icon: GitBranch },
    { id: "raci", label: "RACI", icon: Users },
    { id: "checklist", label: "Checklist", icon: ClipboardCheck },
    { id: "handoffs", label: "Handoffs", icon: ArrowRightLeft },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "financeiro", label: "Financeiro", icon: DollarSign },
    { id: "ia", label: "Consultar IA", icon: Bot },
  ];

  async function askIA() {
    if (!iaQ.trim()) return;
    setIaLoading(true);
    const cardCtx = [
      `Card: ${card.title}`,
      card.subtitle ? `Observação: ${card.subtitle}` : "",
      card.obra ? `Obra/Código: ${card.obra}` : "",
      `Responsável: ${card.responsavel}`,
      `SLA: ${card.sla} (${card.slaStatus})`,
      card.priority ? `Prioridade: ${card.priority}` : "",
      card.gate !== undefined ? `Gate atual: ${card.gate}` : "",
      card.progress !== undefined ? `Progresso: ${card.progress}%` : "",
      card.checklist ? `Checklist: ${card.checklist.done}/${card.checklist.total} concluídos` : "",
      card.value ? `Valor: ${card.value}` : "",
      "",
      "Gates do projeto:",
      ...gates.map(g => `  Gate ${g.gate} — ${g.label}: ${g.status} (${g.responsible})${g.date ? ` | ${g.date}` : ""}`),
      "",
      "Handoffs:",
      ...obraHandoffs.map(h => `  ${h.from} → ${h.to}: ${h.item} [${h.status}] ${h.date}`),
      "",
      "Financeiro:",
      `  Contrato: ${financeiro.valorContrato} | Orçado: ${financeiro.orcado} | Realizado: ${financeiro.realizado}`,
      `  Margem orçada: ${financeiro.margemOrc} | Margem real: ${financeiro.margemReal}`,
      ...financeiro.parcelas.map(p => `  Parcela ${p.num}: ${p.valor} — ${p.status} (venc: ${p.venc})`),
    ].filter(Boolean).join("\n");
    try {
      const res = await fetch("https://agente.parket.works/api/kanban-bridge/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: iaQ,
          agent_name: "Assistente Parket",
          _context_override: `DADOS COMPLETOS DO CARD:\n${cardCtx}`,
        }),
      });
      const d = await res.json();
      setIaA(d.answer ?? "Sem resposta.");
    } catch { setIaA("Erro ao conectar com o agente."); }
    setIaLoading(false);
  }

  const handleSend = () => {
    if (!chatMsg.trim()) return;
    const newMsg = { id: chatMessages.length + 1, user: "Voce", msg: chatMsg, time: "Agora", avatar: "V" };
    const newMessages = [...chatMessages, newMsg];
    setChatMessages(newMessages);
    setChatMsg("");
    if (canEdit) saveField("chat_messages", newMessages);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col" style={{ background: "#0d0d0d", border: `1px solid ${BORDER}` }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
              <Building2 size={18} style={{ color }} />
            </div>
            <div>
              <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 600 }}>{card.title}</h2>
              <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{card.subtitle} · {card.responsavel} · SLA: {card.sla}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {card.gate !== undefined && (
              <span className="rounded-lg px-2.5 py-1" style={{ fontSize: "0.6rem", fontWeight: 600, background: "rgba(212,168,83,0.15)", color: GOLD }}>Gate {card.gate}</span>
            )}
            <SlaChip status={card.slaStatus} />
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center ml-2" style={{ background: "rgba(255,255,255,0.05)" }}>
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>
        <div className="px-6 py-2 flex gap-1 overflow-x-auto shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-all"
                style={{ fontSize: "0.65rem", fontWeight: active ? 600 : 400, background: active ? `${color}15` : "transparent", color: active ? "white" : TEXT_DIM, border: active ? `1px solid ${color}30` : "1px solid transparent" }}>
                <Icon size={12} /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "timeline" && (
            <div className="space-y-1">
              <p className="tracking-[0.2em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Timeline de Gates — Fluxo Parket</p>
              {canEdit && (
                <div className="flex justify-end mb-3">
                  {editingTab === "timeline" ? (
                    <div className="flex items-center gap-2">
                      {saveMsg && <span style={{ fontSize: "0.6rem", color: saveMsg.startsWith("Erro") ? RED : GREEN }}>{saveMsg}</span>}
                      <button onClick={() => { saveField("gates_data", editGates); setEditingTab(null); }} disabled={saving}
                        style={{ ...smallBtnStyle, background: `${color}20`, color }}>
                        {saving ? "Salvando…" : "💾 Salvar"}
                      </button>
                      <button onClick={() => setEditingTab(null)} style={{ ...smallBtnStyle, background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingTab("timeline")} style={{ ...smallBtnStyle, background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>✏️ Editar</button>
                  )}
                </div>
              )}
              {editingTab === "timeline" && (
                <div className="space-y-2">
                  {editGates.map((g, i) => (
                    <div key={i} className="rounded-lg p-3 flex flex-wrap gap-2 items-center" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
                      <input type="number" value={g.gate} onChange={e => setEditGates(prev => prev.map((x, j) => j === i ? { ...x, gate: Number(e.target.value) } : x))}
                        style={{ ...inputStyle, width: 48 }} />
                      <input value={g.label} onChange={e => setEditGates(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                        placeholder="Label" style={{ ...inputStyle, flex: 1, minWidth: 100 }} />
                      <select value={g.status} onChange={e => setEditGates(prev => prev.map((x, j) => j === i ? { ...x, status: e.target.value } : x))}
                        style={{ ...inputStyle }}>
                        {["done", "current", "pending", "blocked"].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input value={g.responsible} onChange={e => setEditGates(prev => prev.map((x, j) => j === i ? { ...x, responsible: e.target.value } : x))}
                        placeholder="Responsável" style={{ ...inputStyle, minWidth: 90 }} />
                      <input value={g.date || ""} onChange={e => setEditGates(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                        placeholder="Data" style={{ ...inputStyle, width: 70 }} />
                      <button onClick={() => setEditGates(prev => prev.filter((_, j) => j !== i))}
                        style={{ ...smallBtnStyle, background: "rgba(239,68,68,0.15)", color: RED }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => setEditGates(prev => [...prev, { gate: prev.length, label: "Novo Gate", status: "pending", date: "", responsible: "" }])}
                    style={{ ...smallBtnStyle, background: `${color}15`, color, marginTop: 4 }}>＋ Adicionar Gate</button>
                </div>
              )}
              {editingTab !== "timeline" && gates.map((g, i) => {
                const statusColor = g.status === "done" ? GREEN : g.status === "current" ? GOLD : g.status === "blocked" ? RED : "rgba(255,255,255,0.15)";
                const statusBg = g.status === "done" ? "rgba(16,185,129,0.12)" : g.status === "current" ? "rgba(212,168,83,0.12)" : g.status === "blocked" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.03)";
                return (
                  <div key={g.gate} className="flex items-start gap-4">
                    <div className="flex flex-col items-center" style={{ width: 24 }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: statusBg, border: `2px solid ${statusColor}` }}>
                        {g.status === "done" && <CheckCircle2 size={10} style={{ color: GREEN }} />}
                        {g.status === "current" && <CircleDot size={10} style={{ color: GOLD }} />}
                      </div>
                      {i < gates.length - 1 && <div className="w-0.5 flex-1 min-h-[32px]" style={{ background: g.status === "done" ? GREEN : "rgba(255,255,255,0.08)" }} />}
                    </div>
                    <div className="pb-4 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white" style={{ fontSize: "0.78rem", fontWeight: g.status === "current" ? 600 : 400 }}>Gate {g.gate} — {g.label}</span>
                        {g.status === "current" && <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 700, background: "rgba(212,168,83,0.2)", color: GOLD }}>ATUAL</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{g.responsible}</span>
                        {g.date && <span style={{ fontSize: "0.55rem", color: statusColor }}>{g.date}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {tab === "raci" && (
            <div>
              <p className="tracking-[0.2em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Matriz RACI — Responsabilidades por Etapa</p>
              {canEdit && (
                <div className="flex justify-end mb-3">
                  {editingTab === "raci" ? (
                    <div className="flex items-center gap-2">
                      {saveMsg && <span style={{ fontSize: "0.6rem", color: saveMsg.startsWith("Erro") ? RED : GREEN }}>{saveMsg}</span>}
                      <button onClick={() => { saveField("raci_data", editRaci); setEditingTab(null); }} disabled={saving}
                        style={{ ...smallBtnStyle, background: `${color}20`, color }}>
                        {saving ? "Salvando…" : "💾 Salvar"}
                      </button>
                      <button onClick={() => setEditingTab(null)} style={{ ...smallBtnStyle, background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingTab("raci")} style={{ ...smallBtnStyle, background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>✏️ Editar</button>
                  )}
                </div>
              )}
              {editingTab === "raci" && (
                <div className="space-y-2 mb-3">
                  {editRaci.map((row, i) => (
                    <div key={i} className="rounded-lg p-2 flex flex-wrap gap-2 items-center" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
                      <input value={row.atividade} onChange={e => setEditRaci(prev => prev.map((x, j) => j === i ? { ...x, atividade: e.target.value } : x))}
                        placeholder="Atividade" style={{ ...inputStyle, flex: 2, minWidth: 100 }} />
                      {(["r", "a", "c", "i"] as const).map(k => (
                        <input key={k} value={row[k]} onChange={e => setEditRaci(prev => prev.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x))}
                          placeholder={k.toUpperCase()} style={{ ...inputStyle, width: 60 }} />
                      ))}
                      <button onClick={() => setEditRaci(prev => prev.filter((_, j) => j !== i))}
                        style={{ ...smallBtnStyle, background: "rgba(239,68,68,0.15)", color: RED }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => setEditRaci(prev => [...prev, { atividade: "Nova Etapa", r: "", a: "", c: "", i: "" }])}
                    style={{ ...smallBtnStyle, background: `${color}15`, color }}>＋ Adicionar Etapa</button>
                </div>
              )}
              {editingTab !== "raci" && (
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ fontSize: "0.65rem" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <th className="text-left py-2 pr-4" style={{ color: TEXT_MED, fontWeight: 600 }}>Atividade</th>
                        {["R (Responsavel)", "A (Aprovador)", "C (Consultado)", "I (Informado)"].map(h => (
                          <th key={h} className="text-center py-2 px-2" style={{ color: TEXT_DIM, fontWeight: 500, fontSize: "0.55rem" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {raciData.map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                          <td className="py-2.5 pr-4" style={{ color: "white", fontWeight: 500 }}>{row.atividade}</td>
                          <td className="text-center py-2.5"><span className="rounded px-2 py-0.5" style={{ background: "rgba(16,185,129,0.12)", color: GREEN, fontWeight: 600 }}>{row.r}</span></td>
                          <td className="text-center py-2.5"><span className="rounded px-2 py-0.5" style={{ background: "rgba(212,168,83,0.12)", color: GOLD, fontWeight: 500 }}>{row.a}</span></td>
                          <td className="text-center py-2.5"><span style={{ color: TEXT_MED }}>{row.c}</span></td>
                          <td className="text-center py-2.5"><span style={{ color: TEXT_DIM }}>{row.i}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {tab === "checklist" && (
            <div>
              <p className="tracking-[0.2em] uppercase mb-2" style={{ fontSize: "0.5rem", color: ACCENT }}>Checklist de Obra</p>
              <p className="mb-4" style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{editChecklist.filter(c => c.done).length}/{editChecklist.length} concluidos</p>
              <div className="w-full h-2 rounded-full mb-5" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: `${editChecklist.length > 0 ? (editChecklist.filter(c => c.done).length / editChecklist.length) * 100 : 0}%`, background: GREEN }} />
              </div>
              {canEdit && (
                <div className="flex justify-end mb-3">
                  {editingTab === "checklist" ? (
                    <div className="flex items-center gap-2">
                      {saveMsg && <span style={{ fontSize: "0.6rem", color: saveMsg.startsWith("Erro") ? RED : GREEN }}>{saveMsg}</span>}
                      <button onClick={() => {
                        saveField("checklist_items", editChecklist);
                        saveField("checklist_done", editChecklist.filter(c => c.done).length);
                        saveField("checklist_total", editChecklist.length);
                        setEditingTab(null);
                      }} disabled={saving}
                        style={{ ...smallBtnStyle, background: `${color}20`, color }}>
                        {saving ? "Salvando…" : "💾 Salvar"}
                      </button>
                      <button onClick={() => setEditingTab(null)} style={{ ...smallBtnStyle, background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingTab("checklist")} style={{ ...smallBtnStyle, background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>✏️ Editar</button>
                  )}
                </div>
              )}
              {editingTab === "checklist" && (
                <div className="space-y-2 mb-3">
                  {editChecklist.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
                      <input value={c.item} onChange={e => setEditChecklist(prev => prev.map((x, j) => j === i ? { ...x, item: e.target.value } : x))}
                        placeholder="Item" style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={() => setEditChecklist(prev => prev.filter((_, j) => j !== i))}
                        style={{ ...smallBtnStyle, background: "rgba(239,68,68,0.15)", color: RED }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => setEditChecklist(prev => [...prev, { item: "Novo Item", done: false }])}
                    style={{ ...smallBtnStyle, background: `${color}15`, color }}>＋ Adicionar Item</button>
                </div>
              )}
              {editingTab !== "checklist" && (
                <div className="space-y-2">
                  {editChecklist.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer" onClick={() => {
                      if (!canEdit) return;
                      const updated = editChecklist.map((x, j) => j === i ? { ...x, done: !x.done } : x);
                      setEditChecklist(updated);
                      saveField("checklist_items", updated);
                      saveField("checklist_done", updated.filter(x => x.done).length);
                      saveField("checklist_total", updated.length);
                    }}
                      style={{ background: c.done ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${c.done ? "rgba(16,185,129,0.1)" : BORDER}` }}>
                      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: c.done ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)" }}>
                        {c.done && <CheckCircle2 size={12} style={{ color: GREEN }} />}
                      </div>
                      <span style={{ fontSize: "0.72rem", color: c.done ? GREEN : TEXT_MED, textDecoration: c.done ? "line-through" : "none" }}>{c.item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === "handoffs" && (
            <div>
              <p className="tracking-[0.2em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Historico de Handoffs — Esta Obra</p>
              {canEdit && (
                <div className="flex justify-end mb-3">
                  {editingTab === "handoffs" ? (
                    <div className="flex items-center gap-2">
                      {saveMsg && <span style={{ fontSize: "0.6rem", color: saveMsg.startsWith("Erro") ? RED : GREEN }}>{saveMsg}</span>}
                      <button onClick={() => { saveField("handoffs_data", editHandoffs); setEditingTab(null); }} disabled={saving}
                        style={{ ...smallBtnStyle, background: `${color}20`, color }}>
                        {saving ? "Salvando…" : "💾 Salvar"}
                      </button>
                      <button onClick={() => setEditingTab(null)} style={{ ...smallBtnStyle, background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingTab("handoffs")} style={{ ...smallBtnStyle, background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>✏️ Editar</button>
                  )}
                </div>
              )}
              {editingTab === "handoffs" && (
                <div className="space-y-2 mb-3">
                  {editHandoffs.map((h, i) => (
                    <div key={i} className="rounded-lg p-2 flex flex-wrap gap-2 items-center" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
                      <input value={h.from} onChange={e => setEditHandoffs(prev => prev.map((x, j) => j === i ? { ...x, from: e.target.value } : x))}
                        placeholder="De" style={{ ...inputStyle, width: 80 }} />
                      <input value={h.to} onChange={e => setEditHandoffs(prev => prev.map((x, j) => j === i ? { ...x, to: e.target.value } : x))}
                        placeholder="Para" style={{ ...inputStyle, width: 80 }} />
                      <input value={h.item} onChange={e => setEditHandoffs(prev => prev.map((x, j) => j === i ? { ...x, item: e.target.value } : x))}
                        placeholder="Item" style={{ ...inputStyle, flex: 1, minWidth: 100 }} />
                      <select value={h.status} onChange={e => setEditHandoffs(prev => prev.map((x, j) => j === i ? { ...x, status: e.target.value } : x))}
                        style={{ ...inputStyle }}>
                        {["done", "current", "pending"].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input value={h.date} onChange={e => setEditHandoffs(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                        placeholder="Data" style={{ ...inputStyle, width: 60 }} />
                      <button onClick={() => setEditHandoffs(prev => prev.filter((_, j) => j !== i))}
                        style={{ ...smallBtnStyle, background: "rgba(239,68,68,0.15)", color: RED }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => setEditHandoffs(prev => [...prev, { from: "", to: "", item: "", status: "pending", date: "" }])}
                    style={{ ...smallBtnStyle, background: `${color}15`, color }}>＋ Adicionar Handoff</button>
                </div>
              )}
              {editingTab !== "handoffs" && (
                <div className="space-y-1">
                  {obraHandoffs.map((h, i) => {
                    const sc = h.status === "done" ? GREEN : h.status === "current" ? GOLD : "rgba(255,255,255,0.15)";
                    return (
                      <div key={i} className="flex items-start gap-4">
                        <div className="flex flex-col items-center" style={{ width: 24 }}>
                          <div className="w-4 h-4 rounded-full shrink-0" style={{ background: h.status === "done" ? GREEN : h.status === "current" ? GOLD : "rgba(255,255,255,0.1)", border: `2px solid ${sc}` }} />
                          {i < obraHandoffs.length - 1 && <div className="w-0.5 flex-1 min-h-[24px]" style={{ background: h.status === "done" ? GREEN : "rgba(255,255,255,0.06)" }} />}
                        </div>
                        <div className="pb-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: "0.7rem", color: TEXT_MED }}>{h.from}</span>
                            <ArrowRight size={10} style={{ color: sc }} />
                            <span className="text-white" style={{ fontSize: "0.7rem", fontWeight: 500 }}>{h.to}</span>
                            <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{h.date}</span>
                          </div>
                          <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 2 }}>{h.item}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {tab === "chat" && (
            <div className="flex flex-col" style={{ minHeight: 350 }}>
              <p className="tracking-[0.2em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Chat da Obra</p>
              <div className="flex-1 space-y-3 mb-4">
                {chatMessages.map(m => (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}20`, fontSize: "0.5rem", fontWeight: 700, color }}>{m.avatar}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white" style={{ fontSize: "0.7rem", fontWeight: 600 }}>{m.user}</span>
                        <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{m.time}</span>
                      </div>
                      <p style={{ fontSize: "0.7rem", color: TEXT_MED, lineHeight: 1.5, marginTop: 2 }}>{m.msg}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} placeholder="Mensagem..."
                  className="flex-1 rounded-lg px-3 py-2 text-white outline-none" style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }} />
                <button onClick={handleSend} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
                  <Send size={14} style={{ color }} />
                </button>
              </div>
            </div>
          )}
          {tab === "ia" && (
            <div className="flex flex-col gap-3">
              <p className="tracking-[0.2em] uppercase mb-2" style={{ fontSize: "0.5rem", color: ACCENT }}>Consultar Agente IA</p>
              <div className="rounded-xl p-3" style={{ background: "rgba(212,168,83,0.06)", border: "1px solid rgba(212,168,83,0.15)" }}>
                <p style={{ fontSize: "0.68rem", color: TEXT_MED, margin: 0 }}>
                  O agente tem acesso completo aos dados deste card: timeline, handoffs, checklist, RACI e financeiro.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  value={iaQ}
                  onChange={e => setIaQ(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && askIA()}
                  placeholder="Ex: Quais são os riscos de prazo? Qual o próximo passo?"
                  className="flex-1 rounded-lg px-3 py-2 text-white outline-none"
                  style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}
                />
                <button
                  onClick={askIA}
                  disabled={iaLoading || !iaQ.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: "0.65rem", fontWeight: 600, background: iaQ.trim() && !iaLoading ? `${color}20` : "rgba(255,255,255,0.04)", border: `1px solid ${iaQ.trim() && !iaLoading ? color + "40" : BORDER}`, color: iaQ.trim() && !iaLoading ? color : TEXT_DIM, cursor: "pointer" }}
                >
                  {iaLoading ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Bot size={11} />}
                  {iaLoading ? "…" : "Perguntar"}
                </button>
              </div>
              {iaA && (
                <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                  <p style={{ fontSize: "0.73rem", color: TEXT_MED, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{iaA}</p>
                </div>
              )}
            </div>
          )}
          {tab === "financeiro" && (
            <div className="space-y-5">
              <p className="tracking-[0.2em] uppercase mb-2" style={{ fontSize: "0.5rem", color: ACCENT }}>Painel Financeiro da Obra</p>
              {canEdit && (
                <div className="flex justify-end mb-3">
                  {editingTab === "financeiro" ? (
                    <div className="flex items-center gap-2">
                      {saveMsg && <span style={{ fontSize: "0.6rem", color: saveMsg.startsWith("Erro") ? RED : GREEN }}>{saveMsg}</span>}
                      <button onClick={() => { saveField("financeiro_data", editFin); setEditingTab(null); }} disabled={saving}
                        style={{ ...smallBtnStyle, background: `${color}20`, color }}>
                        {saving ? "Salvando…" : "💾 Salvar"}
                      </button>
                      <button onClick={() => setEditingTab(null)} style={{ ...smallBtnStyle, background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingTab("financeiro")} style={{ ...smallBtnStyle, background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>✏️ Editar</button>
                  )}
                </div>
              )}
              {editingTab === "financeiro" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {([
                      ["valorContrato", "Valor Contrato"],
                      ["orcado", "Custo Orçado"],
                      ["realizado", "Custo Real"],
                      ["margemOrc", "Margem Orçada"],
                      ["margemReal", "Margem Real"],
                    ] as [keyof typeof editFin, string][]).map(([k, label]) => (
                      <div key={k}>
                        <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginBottom: 3 }}>{label}</p>
                        <input value={String(editFin[k] ?? "")} onChange={e => setEditFin(prev => ({ ...prev, [k]: e.target.value }))}
                          style={{ ...inputStyle, width: "100%" }} />
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "white", marginBottom: 8 }}>Parcelas</p>
                    <div className="space-y-2">
                      {editFin.parcelas.map((p, i) => (
                        <div key={i} className="flex flex-wrap gap-2 items-center">
                          <input value={p.valor} onChange={e => setEditFin(prev => ({ ...prev, parcelas: prev.parcelas.map((x, j) => j === i ? { ...x, valor: e.target.value } : x) }))}
                            placeholder="Valor" style={{ ...inputStyle, width: 80 }} />
                          <select value={p.status} onChange={e => setEditFin(prev => ({ ...prev, parcelas: prev.parcelas.map((x, j) => j === i ? { ...x, status: e.target.value } : x) }))}
                            style={{ ...inputStyle }}>
                            {["pago", "pendente", "atrasado"].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <input value={p.venc} onChange={e => setEditFin(prev => ({ ...prev, parcelas: prev.parcelas.map((x, j) => j === i ? { ...x, venc: e.target.value } : x) }))}
                            placeholder="Venc" style={{ ...inputStyle, width: 70 }} />
                          <button onClick={() => setEditFin(prev => ({ ...prev, parcelas: prev.parcelas.filter((_, j) => j !== i) }))}
                            style={{ ...smallBtnStyle, background: "rgba(239,68,68,0.15)", color: RED }}>×</button>
                        </div>
                      ))}
                      <button onClick={() => setEditFin(prev => ({ ...prev, parcelas: [...prev.parcelas, { num: prev.parcelas.length + 1, valor: "", status: "pendente", venc: "" }] }))}
                        style={{ ...smallBtnStyle, background: `${color}15`, color }}>＋ Parcela</button>
                    </div>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "white", marginBottom: 8 }}>Custos</p>
                    <div className="space-y-2">
                      {editFin.custos.map((c, i) => (
                        <div key={i} className="flex flex-wrap gap-2 items-center">
                          <input value={c.cat} onChange={e => setEditFin(prev => ({ ...prev, custos: prev.custos.map((x, j) => j === i ? { ...x, cat: e.target.value } : x) }))}
                            placeholder="Categoria" style={{ ...inputStyle, flex: 1, minWidth: 80 }} />
                          <input value={c.valor} onChange={e => setEditFin(prev => ({ ...prev, custos: prev.custos.map((x, j) => j === i ? { ...x, valor: e.target.value } : x) }))}
                            placeholder="Valor" style={{ ...inputStyle, width: 80 }} />
                          <input type="number" value={c.perc} onChange={e => setEditFin(prev => ({ ...prev, custos: prev.custos.map((x, j) => j === i ? { ...x, perc: Number(e.target.value) } : x) }))}
                            placeholder="%" style={{ ...inputStyle, width: 50 }} />
                          <button onClick={() => setEditFin(prev => ({ ...prev, custos: prev.custos.filter((_, j) => j !== i) }))}
                            style={{ ...smallBtnStyle, background: "rgba(239,68,68,0.15)", color: RED }}>×</button>
                        </div>
                      ))}
                      <button onClick={() => setEditFin(prev => ({ ...prev, custos: [...prev.custos, { cat: "", valor: "", perc: 0 }] }))}
                        style={{ ...smallBtnStyle, background: `${color}15`, color }}>＋ Custo</button>
                    </div>
                  </div>
                </div>
              )}
              {editingTab !== "financeiro" && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { l: "Valor Contrato", v: financeiro.valorContrato, c: ACCENT },
                      { l: "Custo Orcado", v: financeiro.orcado, c: BLUE },
                      { l: "Custo Real", v: financeiro.realizado, c: ORANGE },
                      { l: "Margem Real", v: financeiro.margemReal, c: GREEN },
                    ].map(x => (
                      <div key={x.l} className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                        <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 4 }}>{x.l}</p>
                        <span style={{ fontSize: "1.1rem", fontWeight: 600, color: x.c }}>{x.v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Composicao de Custos</p>
                    {financeiro.custos.map(c => (
                      <div key={c.cat} className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ fontSize: "0.65rem", color: TEXT_MED }}>{c.cat}</span>
                          <span style={{ fontSize: "0.6rem", color: "white", fontWeight: 500 }}>{c.valor} ({c.perc}%)</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full" style={{ width: `${c.perc}%`, background: color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Parcelas</p>
                    <div className="space-y-2">
                      {financeiro.parcelas.map(p => {
                        const pc = p.status === "pago" ? GREEN : p.status === "pendente" ? YELLOW : RED;
                        return (
                          <div key={p.num} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                            <span style={{ fontSize: "0.65rem", color: "white" }}>Parcela {p.num}</span>
                            <span style={{ fontSize: "0.65rem", color: ACCENT }}>{p.valor}</span>
                            <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Venc: {p.venc}</span>
                            <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: `${pc}15`, color: pc }}>{p.status}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ RULES DESC ═══ */
const RULES_DESC: Record<string, string> = {
  obra_parada_5d: "Obra sem movimentacao no Kanban por 5+ dias",
  margem_below_25: "Margem real abaixo de 25% ou em tendencia de queda",
  parcela_atrasada: "Parcela com mais de 5 dias de atraso",
  gate_bloqueado: "Gate travado por mais de 7 dias",
  handoff_vencido: "Handoff com SLA estourado",
  capacidade_alta: "Producao acima de 80% da capacidade",
  nc_aberta_3d: "NC aberta por mais de 3 dias",
  diario_faltando: "Diario de obra nao preenchido",
  produtividade_destaque: "Equipe com produtividade 20%+ acima da media",
  meta_atingida: "Meta departamental atingida",
  lead_sem_contato: "Lead sem proximo passo por 3+ dias",
  vistoria_urgente: "Vistoria nao agendada com obra proxima de iniciar",
};

const MENU_ITEM_TO_TAB: Record<string, string> = {
  "Funil": "funil", "Leads": "funil", "Propostas": "propostas", "Metas": "kpis", "Showroom": "showroom",
  "Versoes": "versoes", "Aprovacoes": "aprovacoes", "Workspace": "versoes",
  "Cronograma": "prod", "Cronogramas": "prod",
  "Cotacoes": "estoque", "Fornecedores": "fornecedores", "Estoque": "estoque", "Lead Times": "estoque",
  "Ordens": "ordens", "QC": "ordens", "Capacidade": "capacidade",
  "Entregas Hoje": "entregas", "Frota": "frota", "Rastreio": "frota", "Conferencia": "entregas",
  "Equipes": "equipes", "Diario": "pilares", "Checklist": "checklist", "Mapa": "equipes",
  "Fluxo Caixa": "fluxo", "DRE": "fluxo", "Medicoes": "margens", "Cobranca": "margens",
  "Grupos": "grupos", "Timeline": "grupos", "NPS": "grupos", "Onboarding": "grupos", "Scripts": "scripts",
  "Vistorias": "agenda", "Relatorios": "checklist", "Por Fiscal": "agenda",
  "Produtividade": "prod", "Retencoes": "retencoes", "Ranking": "retencoes", "Report": "prod",
  "Calendario": "calendario", "Campanhas": "analytics", "Cases": "calendario", "Analytics": "analytics",
  "Headcount": "headcount", "Vagas": "headcount", "Beneficios": "headcount",
  "Templates": "templates", "Tabela Precos": "propostas", "Historico": "propostas",
};

/* ─── Busca de projetos na topbar ─── */
function TopbarSearch({ navigate }: { navigate: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; title: string; dept_id: string; column_id: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("kanban_cards")
        .select("id,title,dept_id,column_id")
        .ilike("title", `%${query}%`)
        .limit(8);
      setResults((data ?? []) as { id: string; title: string; dept_id: string; column_id: string }[]);
      setOpen(true);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const DEPT_LABELS: Record<string, string> = {
    comercial: "Comercial", projetos: "Projetos", compras: "Compras", producao: "Produção",
    logistica: "Logística", obras: "Obras", financeiro: "Financeiro", atendimento: "Atendimento",
    fiscal: "Fiscal", produtividade: "PMO", marketing: "Marketing", rh: "RH", orcamento: "Orçamento",
    ia: "IA", layout: "Layout",
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, minWidth: 200 }}>
        <Search size={12} style={{ color: TEXT_DIM, flexShrink: 0 }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar projeto..."
          style={{ background: "transparent", border: "none", outline: "none", fontSize: "0.65rem", color: "white", width: "100%" }}
        />
        {loading && <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: TEXT_DIM, borderTopColor: "transparent", flexShrink: 0 }} />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute left-0 top-9 z-50 rounded-xl overflow-hidden shadow-2xl" style={{ width: 280, background: "#111", border: `1px solid ${BORDER}` }}>
          {results.map(r => (
            <button key={r.id} onClick={() => { navigate(`/obra/${r.id}`); setOpen(false); setQuery(""); }}
              className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-all hover:bg-white/5">
              <FolderOpen size={12} style={{ color: ACCENT, marginTop: 2, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: "0.68rem", color: "white", fontWeight: 500 }} className="truncate">{r.title}</p>
                <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{DEPT_LABELS[r.dept_id] ?? r.dept_id} · {r.column_id}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute left-0 top-9 z-50 rounded-xl px-4 py-3" style={{ width: 280, background: "#111", border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Nenhum projeto encontrado.</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DEPT PAGE COMPONENT — Layout principal compartilhado
   ═══════════════════════════════════════════════════════════════════ */
export function DeptPage({ deptId, baseRoute, extraTabs = [], dashboardExtra, team = [], quickActions = [], activity = [], tabSwitcherRef, kanbanHeaderExtra, cardFilter }: DeptPageConfig) {
  const navigate = useNavigate();
  const routeBase = baseRoute ?? deptId;
  type ViewTab = "kanban" | "kpis" | "alertas" | "handoffs" | "handoffs-global" | "alertas-ia" | "equipe" | "atividade" | string;

  // Derive viewTab from URL path (e.g. /dept/compras/handoffs → "handoffs")
  const location = useLocation();
  const _urlSegment = location.pathname.split("/").pop() ?? "";
  const viewTab: ViewTab = (!_urlSegment || _urlSegment === routeBase || _urlSegment === deptId) ? "kanban" : _urlSegment;

  const setViewTab = useCallback((tab: ViewTab) => {
    navigate(tab === "kanban" ? `/${routeBase}` : `/${routeBase}/${tab}`);
  }, [navigate, routeBase]);

  useEffect(() => {
    if (tabSwitcherRef) tabSwitcherRef.current = setViewTab;
    return () => { if (tabSwitcherRef) tabSwitcherRef.current = null; };
  }, [tabSwitcherRef, setViewTab]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { canEdit: canEditDept, user, isAdmin } = useAuth();
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas } = useNotificacoes(user?.id);
  const [notifOpen, setNotifOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [hgFilter, setHgFilter] = useState<"all" | "pendente" | "aceito" | "vencido">("all");
  const [hgDeptFilter, setHgDeptFilter] = useState<string>("all");
  const [aiFilter, setAiFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [addCardColumn, setAddCardColumn] = useState<string | null>(null);
  const [showSolicitacao, setShowSolicitacao] = useState(false);

  // Abre o modal de solicitação via evento global (usado pelos setores)
  useEffect(() => {
    const handler = () => setShowSolicitacao(true);
    document.addEventListener("open-solicitar-compras", handler);
    return () => document.removeEventListener("open-solicitar-compras", handler);
  }, []);
  const [handoffToast, setHandoffToast] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [handledAlerts, setHandledAlerts] = useState<Set<string>>(new Set());
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const movedCardRef = useRef<KanbanCard | undefined>();
  const [pendingReturnCard, setPendingReturnCard] = useState<string | null>(null);
  const [pendingReturnReason, setPendingReturnReason] = useState("");
  const [pendingActing, setPendingActing] = useState(false);
  // Mapa título → UUID para busca cross-dept (handoffs legados sem obra_id)
  const [obraCardIds, setObraCardIds] = useState<Record<string, string>>({});

  const profile = getProfile(deptId);
  const canEdit = canEditDept(deptId);

  /* ── Alertas do Supabase ── */
  const { smartAlerts: dbSmartAlerts, alertas: dbAlertas, getAlertasByDept, resolveAlerta, updateAlerta, addComment } = useAlertas();

  /* ── Handoffs do Supabase ── */
  const {
    handoffs: dbHandoffs,
    legacyHandoffs,
    flow: handoffFlow,
    counts: handoffCounts,
    aceitarHandoff,
    updateStatus: updateHandoffStatus,
    createHandoff,
  } = useHandoffs(profile?.nome);

  /* ── KPIs do Supabase ── */
  const { getByDept: getKpisByDept } = useKpis(deptId);
  const liveKpis = getKpisByDept(deptId);

  /* ── Activity Feed do Supabase ── */
  const { activityItems: dbActivityItems } = useAtividades(deptId);

  /* ── Kanban DB cards ── */
  const { dbCards, addCard: addDbCard, moveDbCard, deleteDbCard, mergeIntoColumns, reload } = useKanbanCards(deptId);
  const { dbColumns, loading: colsLoading, addColumn, updateColumn, deleteColumn, reorderColumns, toKanbanColumns } = useKanbanColumns(deptId);
  const [showColManager, setShowColManager] = useState(false);

  // Estado local das colunas para suportar drag-and-drop
  const [columns, setColumns] = useState<KanbanColumn[]>(() => profile?.columns ?? []);

  // Sincroniza estáticos + DB quando dept, dbCards ou dbColumns mudar
  useEffect(() => {
    if (profile) {
      const baseColumns = dbColumns.length > 0 ? toKanbanColumns(profile.columns) : profile.columns;
      const merged = mergeIntoColumns(baseColumns);
      // Sort: cards com isUnread (cliente esperando) no topo, mais recente primeiro
      const sorted = merged.map(col => ({
        ...col,
        cards: [...col.cards].sort((a, b) => {
          const ia = extractInbox((a as any).details);
          const ib = extractInbox((b as any).details);
          if (ia.isUnread !== ib.isUnread) return ia.isUnread ? -1 : 1;
          if (ia.isUnread && ib.isUnread) return ia.secondsWaiting - ib.secondsWaiting;
          return ib.lastMessageAt - ia.lastMessageAt;
        }),
      }));
      setColumns(sorted);
    }
  }, [deptId, dbCards.length, dbCards.map(c => `${c.id}:${c.column_id}:${c.title}:${((c.details as any)?.mensagens_ia ?? []).length}`).join(","), dbColumns.length]);

  // Busca card IDs cross-dept pelos títulos dos handoffs legados
  useEffect(() => {
    const obras = dbHandoffs.map(h => h.obra).filter(Boolean) as string[];
    if (obras.length === 0) return;
    supabase
      .from("kanban_cards")
      .select("id, title")
      .in("title", obras)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        for (const c of data) if (c.title && c.id) map[c.title] = c.id;
        setObraCardIds(map);
      });
  }, [dbHandoffs.length]);

  /* ── Mover card (DnD + DB + Handoff) ── */
  const handleMoveCard = useCallback(async (cardId: string, fromColId: string, toColId: string) => {
    if (fromColId === toColId) return;

    // 1. Atualização otimista local
    setColumns(prev => {
      const card = prev.find(c => c.id === fromColId)?.cards.find(c => c.id === cardId);
      movedCardRef.current = card;
      if (!card) return prev;
      return prev.map(col => {
        if (col.id === fromColId) return { ...col, cards: col.cards.filter(c => c.id !== cardId) };
        if (col.id === toColId)   return { ...col, cards: [...col.cards, card] };
        return col;
      });
    });

    const src = movedCardRef.current;
    const primaryRule    = getPrimaryRule(deptId, toColId);
    const secondaryRules = getSecondaryRules(deptId, toColId);
    const hasHandoff     = primaryRule !== null || secondaryRules.length > 0;

    if (hasHandoff && src) {
      // Cards de projeto (têm obra + UUID) usam single-card flow
      const isProjectCard = Boolean(src.obra) && isDbCardId(cardId);

      if (isProjectCard && primaryRule) {
        // HANDOFF PRIMÁRIO: move o card real para o próximo dept (sem duplicata)
        // O card some deste dept (já removido otimisticamente acima).
        const movedBy = (user as any)?.full_name ?? (user as any)?.email ?? "Sistema";
        await moveCardToDept(cardId, primaryRule.toDept, primaryRule.toColumn, primaryRule.gate, movedBy);

        // HANDOFFS SECUNDÁRIOS: cria cards leves em depts paralelos (fiscal, pmo...)
        if (secondaryRules.length > 0) {
          await Promise.all(secondaryRules.map(r => createHandoffCard({
            dept_id: r.toDept,
            column_id: r.toColumn,
            title: src.title,
            subtitle: `Handoff de ${profile?.nome ?? deptId} → ${r.toColumnLabel}`,
            obra: src.obra,
            responsavel: src.responsavel,
            sla: "7d",
            sla_status: "ok",
            tags: src.tags,
            value: src.value,
            gate: r.gate,
            priority: src.priority ?? "media",
            parent_card_id: cardId,
          })));
        }

        const deptNames = [primaryRule.toDeptLabel, ...secondaryRules.map(r => r.toDeptLabel)].join(" + ");
        setHandoffToast(deptNames);
        setTimeout(() => setHandoffToast(null), 5000);
      } else {
        // Card sem obra ou sem regra primária → comportamento legado (cria cópias)
        if (isDbCardId(cardId)) await moveDbCard(cardId, toColId);
        const allRules = primaryRule ? [primaryRule, ...secondaryRules] : secondaryRules;
        const createdCards = await Promise.all(allRules.map(r => createHandoffCard({
          dept_id: r.toDept,
          column_id: r.toColumn,
          title: src.title,
          subtitle: `Handoff de ${profile?.nome ?? deptId} → ${r.toColumnLabel}`,
          obra: src.obra,
          responsavel: src.responsavel,
          sla: "7d",
          sla_status: "ok",
          tags: src.tags,
          value: src.value,
          gate: src.gate,
          priority: src.priority ?? "media",
          parent_card_id: isDbCardId(cardId) ? cardId : undefined,
        })));

        // Projetos → Aprovado: triggers especiais para cada dept destino
        if (deptId === "projetos" && toColId === "aprovado") {
          allRules.forEach((r, idx) => {
            const created = createdCards[idx];
            // PMO: dispara agente calculador de prazo
            if (r.toDept === "produtividade" && r.toColumn === "entrada" && created) {
              fetch("https://agente.parket.works/api/pmo/auto-calcular", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ card_id: created.id, dept_id: "produtividade" }),
              }).catch(() => {});
            }
          });
          // WhatsApp: notifica todos os depts do handoff simultâneo
          if (isDbCardId(cardId)) {
            fetch("https://agente.parket.works/api/handoffs/notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                handoff_id: cardId,
                obra: src.obra,
                title: src.title,
                responsavel_from: profile?.nome ?? "Projetos",
                depts_destino: allRules.map(r => r.toDeptLabel),
                evento: "projeto_aprovado",
              }),
            }).catch(() => {});
          }
        }

        const deptNames = allRules.map(r => r.toDeptLabel).join(" + ");
        setHandoffToast(deptNames);
        setTimeout(() => setHandoffToast(null), 5000);
      }
    } else {
      // Movimento normal dentro do mesmo dept
      if (isDbCardId(cardId)) await moveDbCard(cardId, toColId);

      // Fiscal → Passagem de Bastão → Obras: notifica Obras + PMO via WhatsApp
      if (deptId === "fiscal" && toColId === "handoff-pmo" && isDbCardId(cardId) && src) {
        try {
          await fetch("https://agente.parket.works/api/handoffs/fiscal-libera", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              handoff_id: cardId,
              obra: src.obra,
              title: src.title,
              responsavel_from: (profile as any)?.nome ?? "Felipe",
            }),
          });
        } catch (_) { /* notificação não-crítica */ }
      }

      // PMO: quando card chega na coluna "entrada" do setor Produtividade, dispara agente calculador
      if (deptId === "produtividade" && toColId === "entrada" && isDbCardId(cardId)) {
        fetch("https://agente.parket.works/api/pmo/auto-calcular", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card_id: cardId, dept_id: "produtividade" }),
        }).catch(() => {});
      }
    }
  }, [deptId, profile, moveDbCard, user]);

  /* ── Adicionar card ── */
  const handleAddCard = useCallback(async (card: {
    title: string; subtitle: string; obra: string; responsavel: string;
    priority: "alta" | "media" | "baixa"; value: string; tags: string[]; columnId: string;
  }) => {
    const newCard = await addDbCard({
      dept_id: deptId,
      column_id: card.columnId,
      title: card.title,
      subtitle: card.subtitle || undefined,
      obra: card.obra || undefined,
      responsavel: card.responsavel,
      sla: "7d",
      sla_status: "ok",
      tags: card.tags.length ? card.tags : undefined,
      value: card.value || undefined,
      priority: card.priority,
      progress: 0,
    });
    if (newCard) {
      // Adiciona ao estado local imediatamente
      setColumns(prev => prev.map(col =>
        col.id === card.columnId
          ? { ...col, cards: [...col.cards, { id: newCard.id, title: newCard.title, subtitle: newCard.subtitle, obra: newCard.obra, responsavel: newCard.responsavel, sla: newCard.sla, slaStatus: newCard.sla_status, tags: newCard.tags, value: newCard.value, priority: newCard.priority, progress: 0 }] }
          : col
      ));
    }
  }, [deptId, addDbCard]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setSidebarOpen(false);
  }, [viewTab]);

  const sparklineData = useMemo(() => {
    if (!profile) return {};
    const map: Record<string, number[]> = {};
    profile.kpis.forEach((kpi, i) => {
      const base = typeof kpi.value === "number" ? kpi.value : parseFloat(String(kpi.value).replace(/[^0-9.]/g, "")) || 50;
      map[i] = genSparkline(base, base * 0.15, kpi.trend || "flat");
    });
    return map;
  }, [profile?.id]);

  if (!profile) return <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}><p className="text-white">Departamento nao encontrado</p></div>;

  const criticalAlerts = profile.alerts.filter(a => a.type === "critical").length;
  const pendingHandoffs = handoffCounts.pendente;
  const totalCards = columns.reduce((acc, col) => acc + col.cards.length, 0);
  const expiredCards = columns.reduce((acc, col) => acc + col.cards.filter(c => c.slaStatus === "expired").length, 0);
  const myAlerts = getAlertasByDept(profile.nome).map(a => ({
    id: a.id, type: a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "info",
    message: a.message,
  }));
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";

  /* ═══ SIDEBAR ═══ */
  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: profile.colorDim, fontSize: "0.75rem", fontWeight: 700, color: profile.color }}>
            {profile.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white truncate" style={{ fontSize: "0.78rem", fontWeight: 600 }}>{profile.lider}</p>
            <p className="truncate" style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{profile.cargo}</p>
          </div>
          <div className="relative">
            <button onClick={() => setNotifOpen(o => !o)} className="relative p-1 rounded-lg transition-all" style={{ background: notifOpen ? "rgba(255,255,255,0.06)" : "transparent" }}>
              <Bell size={16} style={{ color: naoLidas > 0 ? ACCENT : TEXT_DIM }} />
              {naoLidas > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: RED, fontSize: "0.4rem", fontWeight: 700, color: "white" }}>
                  {naoLidas > 9 ? "9+" : naoLidas}
                </span>
              )}
            </button>
            {/* Painel de notificações */}
            {notifOpen && (
              <div className="absolute left-0 top-8 z-50 rounded-xl shadow-2xl overflow-hidden" style={{ width: 320, background: "#111", border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "white" }}>Notificações</span>
                  <div className="flex items-center gap-2">
                    {naoLidas > 0 && (
                      <button onClick={() => marcarTodasLidas()} style={{ fontSize: "0.55rem", color: ACCENT, cursor: "pointer" }}>Marcar todas como lidas</button>
                    )}
                    <button onClick={() => setNotifOpen(false)} style={{ color: TEXT_DIM }}><X size={12} /></button>
                  </div>
                </div>
                <div style={{ maxHeight: 380, overflowY: "auto" }}>
                  {notificacoes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <Bell size={24} style={{ color: TEXT_DIM, marginBottom: 8 }} />
                      <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Nenhuma notificação</p>
                    </div>
                  ) : (
                    notificacoes.slice(0, 20).map(n => {
                      const iconMap: Record<string, React.ReactNode> = {
                        alerta: <AlertTriangle size={12} style={{ color: RED }} />,
                        handoff: <ArrowRightLeft size={12} style={{ color: BLUE }} />,
                        mencao: <MessageSquare size={12} style={{ color: ACCENT }} />,
                        comentario: <MessageSquare size={12} style={{ color: TEAL }} />,
                      };
                      const icon = iconMap[n.tipo] ?? <Bell size={12} style={{ color: TEXT_DIM }} />;
                      const dt = new Date(n.created_at);
                      const timeStr = dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={n.id} onClick={() => marcarLida(n.id)} className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-all" style={{ background: n.lida ? "transparent" : "rgba(212,168,83,0.04)", borderBottom: `1px solid ${BORDER}`, opacity: n.lida ? 0.6 : 1 }}>
                          <div className="mt-0.5 flex-shrink-0">{icon}</div>
                          <div className="flex-1 min-w-0">
                            <p style={{ fontSize: "0.68rem", fontWeight: n.lida ? 400 : 600, color: "white" }}>{n.titulo}</p>
                            <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 2 }}>{n.mensagem}</p>
                            <p style={{ fontSize: "0.52rem", color: TEXT_DIM, marginTop: 4 }}>{timeStr}</p>
                          </div>
                          {!n.lida && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: ACCENT }} />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Status indicator */}
        <div className="flex items-center gap-1.5 ml-13 mt-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: GREEN }} />
          <span style={{ fontSize: "0.5rem", color: GREEN }}>Online</span>
          <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>· {greeting}, {profile.lider.split(" ")[0]}</span>
        </div>
      </div>

      <div className="h-px mx-4" style={{ background: BORDER }} />

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <div className="px-3 py-3">
          <p className="px-2 mb-2 tracking-[0.2em] uppercase" style={{ fontSize: "0.4rem", color: profile.color }}>Acoes Rapidas</p>
          <div className="grid grid-cols-2 gap-1.5">
            {quickActions.slice(0, 6).map((qa, i) => {
              const Icon = qa.icon;
              return (
                <button key={i} className="flex items-center gap-1.5 rounded-lg px-2 py-2 transition-all hover:scale-[1.02]"
                  onClick={qa.onClick}
                  style={{ background: `${qa.color}10`, border: `1px solid ${qa.color}20`, fontSize: "0.55rem", color: qa.color, cursor: qa.onClick ? "pointer" : "default" }}>
                  <Icon size={11} />
                  <span className="truncate">{qa.label}</span>
                  {qa.badge && <span className="rounded-full px-1 py-0.5 ml-auto" style={{ fontSize: "0.4rem", background: `${qa.color}25`, fontWeight: 700 }}>{qa.badge}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {quickActions.length > 0 && <div className="h-px mx-4" style={{ background: BORDER }} />}

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <p className="px-3 mb-2 tracking-[0.2em] uppercase" style={{ fontSize: "0.4rem", color: TEXT_DIM }}>Meu Departamento</p>
        {([
          { id: "kanban", icon: Kanban, label: "Meu Kanban", badge: totalCards > 0 ? String(totalCards) : undefined },
          { id: "kpis", icon: BarChart3, label: "Dashboard & KPIs" },
          { id: "alertas", icon: AlertTriangle, label: `Alertas`, badge: criticalAlerts > 0 ? String(criticalAlerts) : undefined },
          { id: "handoffs", icon: ArrowRightLeft, label: `Handoffs`, badge: pendingHandoffs > 0 ? String(pendingHandoffs) : undefined },
        ] as { id: ViewTab; icon: React.ElementType; label: string; badge?: string }[]).map(item => {
          const isActive = viewTab === item.id;
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => setViewTab(item.id)} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 mb-0.5 transition-all"
              style={{ background: isActive ? `${profile.color}15` : "transparent", border: isActive ? `1px solid ${profile.color}30` : "1px solid transparent", color: isActive ? "white" : TEXT_MED, fontSize: "0.72rem", fontWeight: isActive ? 600 : 400 }}>
              <Icon size={14} style={{ color: isActive ? profile.color : TEXT_DIM }} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 700, background: `${RED}20`, color: RED }}>{item.badge}</span>}
            </button>
          );
        })}

        {/* Extra tabs from department */}
        {extraTabs.length > 0 && (
          <>
            <div className="h-px mx-2 my-2" style={{ background: BORDER }} />
            <p className="px-3 mb-2 tracking-[0.2em] uppercase" style={{ fontSize: "0.4rem", color: profile.color }}>Especifico</p>
            {extraTabs.map(et => {
              const isActive = viewTab === et.id;
              const Icon = et.icon;
              return (
                <button key={et.id} onClick={() => setViewTab(et.id)} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 mb-0.5 transition-all"
                  style={{ background: isActive ? `${profile.color}15` : "transparent", border: isActive ? `1px solid ${profile.color}30` : "1px solid transparent", color: isActive ? "white" : TEXT_MED, fontSize: "0.72rem", fontWeight: isActive ? 600 : 400 }}>
                  <Icon size={14} style={{ color: isActive ? profile.color : TEXT_DIM }} />
                  {et.label}
                </button>
              );
            })}
          </>
        )}

        {/* Team & Activity */}
        {(team.length > 0 || activity.length > 0 || dbActivityItems.length > 0) && (
          <>
            <div className="h-px mx-2 my-2" style={{ background: BORDER }} />
            <p className="px-3 mb-2 tracking-[0.2em] uppercase" style={{ fontSize: "0.4rem", color: TEXT_DIM }}>Equipe & Atividade</p>
            {team.length > 0 && (
              <button onClick={() => setViewTab("equipe")} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 mb-0.5 transition-all"
                style={{ background: viewTab === "equipe" ? `${profile.color}15` : "transparent", border: viewTab === "equipe" ? `1px solid ${profile.color}30` : "1px solid transparent", color: viewTab === "equipe" ? "white" : TEXT_MED, fontSize: "0.72rem", fontWeight: viewTab === "equipe" ? 600 : 400 }}>
                <Users size={14} style={{ color: viewTab === "equipe" ? profile.color : TEXT_DIM }} />
                Minha Equipe ({team.length})
              </button>
            )}
            {activity.length > 0 && (
              <button onClick={() => setViewTab("atividade")} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 mb-0.5 transition-all"
                style={{ background: viewTab === "atividade" ? `${profile.color}15` : "transparent", border: viewTab === "atividade" ? `1px solid ${profile.color}30` : "1px solid transparent", color: viewTab === "atividade" ? "white" : TEXT_MED, fontSize: "0.72rem", fontWeight: viewTab === "atividade" ? 600 : 400 }}>
                <Activity size={14} style={{ color: viewTab === "atividade" ? profile.color : TEXT_DIM }} />
                Feed de Atividade
              </button>
            )}
          </>
        )}

        <div className="h-px mx-2 my-3" style={{ background: BORDER }} />
        <p className="px-3 mb-2 tracking-[0.2em] uppercase" style={{ fontSize: "0.4rem", color: ACCENT }}>Ferramentas</p>
        {(["notas", "timer", "checklist", "calculadora", "agenda", "relatorio"] as const).map(toolId => {
          const isActive = viewTab === `tool-${toolId}`;
          const Icon = TOOLKIT_ICONS[toolId];
          return (
            <button key={`tool-${toolId}`} onClick={() => setViewTab(`tool-${toolId}`)} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 mb-0.5 transition-all"
              style={{ background: isActive ? `${profile.color}15` : "transparent", border: isActive ? `1px solid ${profile.color}30` : "1px solid transparent", color: isActive ? "white" : TEXT_MED, fontSize: "0.68rem", fontWeight: isActive ? 600 : 400 }}>
              <Icon size={13} style={{ color: isActive ? profile.color : TEXT_DIM }} />
              {TOOLKIT_LABELS[toolId]}
            </button>
          );
        })}

        <div className="h-px mx-2 my-3" style={{ background: BORDER }} />
        <p className="px-3 mb-2 tracking-[0.2em] uppercase" style={{ fontSize: "0.4rem", color: GOLD }}>Visao Global</p>
        <button onClick={() => navigate("/geral/handoffs-global")} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 mb-0.5 transition-all"
          style={{ background: "transparent", border: "1px solid transparent", color: TEXT_MED, fontSize: "0.72rem" }}>
          <Layers size={14} style={{ color: TEXT_DIM }} />
          Centro de Handoffs
        </button>
        <button onClick={() => navigate("/geral/alertas-ia")} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 mb-0.5 transition-all"
          style={{ background: "transparent", border: "1px solid transparent", color: TEXT_MED, fontSize: "0.72rem" }}>
          <Zap size={14} style={{ color: TEXT_DIM }} />
          <span className="flex-1 text-left">Alertas IA</span>
          {dbSmartAlerts.filter(a => a.severity === "critical").length > 0 && (
            <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 700, background: "rgba(239,68,68,0.2)", color: RED }}>{dbSmartAlerts.filter(a => a.severity === "critical").length}</span>
          )}
        </button>

        <div className="h-px mx-2 my-3" style={{ background: BORDER }} />
        <p className="px-3 mb-2 tracking-[0.2em] uppercase" style={{ fontSize: "0.4rem", color: TEXT_DIM }}>Acesso Rapido</p>
        {profile.menuItems.slice(1).map(item => {
          const targetTab = MENU_ITEM_TO_TAB[item];
          return (
            <button key={item} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 mb-0.5 transition-all hover:text-white"
              onClick={() => targetTab ? setViewTab(targetTab) : setViewTab("kpis")}
              style={{ color: viewTab === targetTab ? "white" : TEXT_DIM, fontSize: "0.65rem", background: viewTab === targetTab ? "rgba(255,255,255,0.04)" : "transparent" }}>
              <FolderOpen size={12} /> {item}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
        <button onClick={() => navigate("/ceo-dashboard")} className="w-full flex items-center gap-2 py-2 rounded-lg mb-1" style={{ color: GOLD, fontSize: "0.65rem" }}>
          <Eye size={12} /> CEO Dashboard
        </button>
        <button onClick={() => navigate("/")} className="w-full flex items-center gap-2 py-2 rounded-lg" style={{ color: TEXT_DIM, fontSize: "0.65rem" }}>
          <LogOut size={12} /> Trocar Perfil
        </button>
      </div>
    </div>
  );

  /* ═══ CONTENT RENDERERS ═══ */

  const renderWelcomeBanner = () => (
    <div className="rounded-xl p-5 mb-5" style={{ background: `linear-gradient(135deg, ${profile.color}12 0%, ${profile.color}04 100%)`, border: `1px solid ${profile.color}20` }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1.1rem", fontWeight: 600 }}>{greeting}, {profile.lider}!</h2>
          <p style={{ fontSize: "0.72rem", color: TEXT_MED, lineHeight: 1.6 }}>
            <strong style={{ color: "white" }}>{totalCards} cards</strong> no Kanban ·
            <strong style={{ color: expiredCards > 0 ? RED : GREEN }}> {expiredCards} vencidos</strong> ·
            <strong style={{ color: pendingHandoffs > 0 ? YELLOW : GREEN }}> {pendingHandoffs} handoffs</strong> pendentes
            {criticalAlerts > 0 && <> · <strong style={{ color: RED }}>{criticalAlerts} alertas criticos</strong></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {myAlerts.filter(a => a.severity === "critical").length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangle size={12} style={{ color: RED }} />
              <span style={{ fontSize: "0.6rem", color: RED, fontWeight: 600 }}>{myAlerts.filter(a => a.severity === "critical").length} IA criticos</span>
            </div>
          )}
          <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>08 Mar 2026 · {now.getHours().toString().padStart(2, "0")}:{now.getMinutes().toString().padStart(2, "0")}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderKanban = () => {
    const pendingAcceiteCnt = columns.flatMap(c => c.cards).filter(c => c.handoff_pending).length;
    return (
    <div>
      {renderWelcomeBanner()}

      {/* Banner de aceites pendentes */}
      {pendingAcceiteCnt > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: YELLOW, flexShrink: 0 }} />
          <div className="flex-1">
            <p style={{ fontSize: "0.72rem", fontWeight: 600, color: YELLOW }}>
              {pendingAcceiteCnt} projeto{pendingAcceiteCnt > 1 ? "s" : ""} aguardando validação de recebimento
            </p>
            <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 2 }}>
              Revisar se as informações recebidas estão adequadas e aceitar ou devolver ao setor anterior.
            </p>
          </div>
          <AlertTriangle size={16} style={{ color: YELLOW, flexShrink: 0 }} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {[
          { label: "Cards Ativos", value: totalCards, color: profile.color },
          { label: "Vencidos", value: expiredCards, color: expiredCards > 0 ? RED : GREEN },
          { label: "Handoffs Pendentes", value: pendingHandoffs, color: pendingHandoffs > 0 ? YELLOW : GREEN },
          { label: "Alertas", value: profile.alerts.length, color: criticalAlerts > 0 ? RED : YELLOW },
        ].map(s => (
          <div key={s.label} className="rounded-lg px-3 py-2" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: s.color }}>{s.value}</span>
            <span className="ml-2" style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{s.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setShowSolicitacao(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 transition-all hover:scale-[1.02]"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", color: GREEN, fontSize: "0.7rem", fontWeight: 600, cursor: "pointer" }}
          >
            <ClipboardCheck size={13} style={{ color: GREEN }} /> Nova Solicitação
          </button>
          {canEdit && (
            <>
              <button
                onClick={() => setAddCardColumn(columns[0]?.id ?? null)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 transition-all hover:scale-[1.02]"
                style={{ background: `${profile.color}15`, border: `1px solid ${profile.color}30`, color: "white", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer" }}
              >
                <Plus size={13} style={{ color: profile.color }} /> Novo Card
              </button>
              <button
                onClick={() => setShowColManager(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'rgba(212,175,55,0.12)', color: '#D4A853', border: '1px solid rgba(212,175,55,0.25)' }}
                title="Gerenciar colunas do Kanban"
              >
                ⚙ Colunas
              </button>
            </>
          )}
        </div>
      </div>
      {kanbanHeaderExtra}
      <KanbanBoard
        columns={cardFilter ? columns.map(col => ({ ...col, cards: col.cards.filter(cardFilter) })) : columns}
        color={profile.color}
        deptId={deptId}
        onCardClick={setSelectedCard}
        onMoveCard={handleMoveCard}
        onAddCard={canEdit ? (colId) => setAddCardColumn(colId) : undefined}
        canEdit={canEdit}
        onCardAccepted={() => reload()}
      />
      {/* Modal de adicionar card */}
      {addCardColumn !== null && (
        <AddCardModal
          columns={columns}
          deptId={deptId}
          onClose={() => setAddCardColumn(null)}
          onAdd={handleAddCard}
        />
      )}
      {/* Toast de handoff */}
      {handoffToast && (
        <HandoffToast depts={handoffToast} onClose={() => setHandoffToast(null)} />
      )}
      {/* Toast de acao de alerta */}
      {actionToast && (
        <ActionToast action={actionToast} onClose={() => setActionToast(null)} />
      )}
      {/* ── Column Manager Modal ── */}
      {showColManager && (
        <ColumnManagerModal
          deptId={deptId}
          columns={dbColumns.length > 0 ? dbColumns : (profile?.columns ?? []).map((c, i) => ({ id: crypto.randomUUID(), dept_id: deptId, slug: c.id, title: c.title, color: c.color, position: i, is_handoff: false }))}
          onAdd={addColumn}
          onUpdate={updateColumn}
          onDelete={deleteColumn}
          onReorder={reorderColumns}
          onClose={() => setShowColManager(false)}
        />
      )}
    </div>
    );
  };

  const renderKPIs = () => (
    <div className="space-y-5">
      {renderWelcomeBanner()}

      {/* ── Métricas ao Vivo (Supabase) ── */}
      {liveKpis && (
        <div>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Métricas ao vivo · Kanban
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 2 }}>Cards Ativos</p>
              <span style={{ fontSize: "1.3rem", fontWeight: 700, color: BLUE }}>{liveKpis.total_cards}</span>
            </div>
            <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${liveKpis.expired_cards > 0 ? "rgba(239,68,68,0.3)" : BORDER}` }}>
              <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 2 }}>SLA Vencidos</p>
              <span style={{ fontSize: "1.3rem", fontWeight: 700, color: liveKpis.expired_cards > 0 ? RED : GREEN }}>{liveKpis.expired_cards}</span>
            </div>
            <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 2 }}>SLA OK</p>
              <span style={{ fontSize: "1.3rem", fontWeight: 700, color: liveKpis.sla_ok_pct >= 80 ? GREEN : liveKpis.sla_ok_pct >= 60 ? YELLOW : RED }}>{liveKpis.sla_ok_pct}%</span>
            </div>
            <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${liveKpis.blocked_cards > 0 ? "rgba(239,68,68,0.3)" : BORDER}` }}>
              <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 2 }}>Bloqueados</p>
              <span style={{ fontSize: "1.3rem", fontWeight: 700, color: liveKpis.blocked_cards > 0 ? RED : GREEN }}>{liveKpis.blocked_cards}</span>
            </div>
            {liveKpis.high_priority > 0 && (
              <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid rgba(245,158,11,0.3)` }}>
                <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 2 }}>Alta Prioridade</p>
                <span style={{ fontSize: "1.3rem", fontWeight: 700, color: YELLOW }}>{liveKpis.high_priority}</span>
              </div>
            )}
            {liveKpis.avg_progress !== null && (
              <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 2 }}>Progresso Médio</p>
                <span style={{ fontSize: "1.3rem", fontWeight: 700, color: ACCENT }}>{liveKpis.avg_progress}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── KPIs estáticos do departamento ── */}
      <div>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          KPIs do departamento
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {profile.kpis.map((kpi, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: 4 }}>{kpi.label}</p>
              <div className="flex items-end gap-2 mb-1">
                <span style={{ fontSize: "1.3rem", fontWeight: 700, color: kpi.color, lineHeight: 1 }}>{kpi.value}</span>
                <TrendBadge trend={kpi.trend} value={kpi.trendValue} />
              </div>
              {kpi.sub && <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 6 }}>{kpi.sub}</p>}
              {sparklineData[i] && <Sparkline data={sparklineData[i]} color={kpi.color} />}
            </div>
          ))}
        </div>
      </div>

      {/* Department-specific extra dashboard content */}
      {dashboardExtra}
    </div>
  );

  const ALERT_ACTION_TO_DEPT: Record<string, string> = {
    "Devolver ao comercial": "Comercial",
    "Cobrar comercial": "Comercial",
    "Formalizar contrato": "Comercial",
    "Definir com cliente": "Comercial",
    "Definir termos": "Comercial",
    "Reagendar medicao": "Fiscal",
    "Fechar fornecedor": "Compras",
    "Resolver documentacao": "Logistica",
    "Redirecionar equipe": "Obras",
    "Aprovar POs": "Financeiro",
    "Ligar e alinhar": "Atendimento",
    "Cobrar diarios": "Obras",
    "Contratar 2o fiscal BSB": "RH",
  };

  const renderAlertas = () => {
    const deptAlertas = dbAlertas.filter(a => a.dept === profile.nome || a.dept === deptId);
    const currentUserName = (user as any)?.full_name ?? (user as any)?.email ?? "Usuário";

    return (
      <div className="space-y-3">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Alertas — {profile.nome}</h2>
            <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>
              {deptAlertas.length > 0
                ? `${deptAlertas.filter(a => a.status !== "finalizado").length} ativos · ${deptAlertas.filter(a => a.status === "em-analise").length} em análise`
                : "Sem alertas pendentes"}
            </p>
          </div>
        </div>

        {deptAlertas.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <CheckCircle2 size={24} style={{ color: GREEN, margin: "0 auto 8px" }} />
            <p style={{ fontSize: "0.8rem", color: GREEN }}>Sem alertas pendentes</p>
          </div>
        ) : (
          deptAlertas.map(alerta => (
            <AlertaCard
              key={alerta.id}
              alerta={alerta}
              currentUser={currentUserName}
              onUpdateStatus={async (id, status) => { await updateAlerta(id, { status }); }}
              onUpdateDescription={async (id, description) => { await updateAlerta(id, { description }); }}
              onAddComment={async (id, u, msg) => { await addComment(id, u, msg); }}
              onResolve={async (id) => { await resolveAlerta(id, currentUserName); }}
            />
          ))
        )}
      </div>
    );
  };

  const renderHandoffs = () => {
    const pendingCards = dbCards.filter(c => {
      const det = c.details as Record<string, unknown> | undefined;
      return det?.handoff_status === "pending_acceptance";
    });

    return (
      <div className="space-y-4">
        <div className="mb-2">
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Handoffs — {profile.nome}</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Projetos recebidos e entregas entre departamentos</p>
        </div>

        {/* Projetos aguardando aceite */}
        {pendingCards.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5" style={{ fontSize: "0.6rem", fontWeight: 600, color: YELLOW, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: YELLOW }} />
              {pendingCards.length} projeto{pendingCards.length > 1 ? "s" : ""} aguardando validação
            </p>
            {pendingCards.map(c => {
              const det = c.details as Record<string, unknown> | undefined;
              const fromDept = det?.handoff_from_dept as string | undefined;
              const isReturning = pendingReturnCard === c.id;
              return (
                <div key={c.id} className="rounded-xl p-4 mb-3" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "white" }}>{c.title}</p>
                      {c.subtitle && <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{c.subtitle}</p>}
                      <p style={{ fontSize: "0.52rem", color: TEXT_DIM, fontFamily: "monospace", marginTop: 2 }}>ID: {c.id.slice(0, 8)}…</p>
                      {fromDept && (
                        <p className="mt-1 flex items-center gap-1" style={{ fontSize: "0.6rem", color: YELLOW }}>
                          <ChevronRight size={10} /> Enviado por: <strong>{fromDept}</strong>
                        </p>
                      )}
                    </div>
                    <span className="rounded-full px-2 py-0.5 whitespace-nowrap" style={{ fontSize: "0.5rem", fontWeight: 600, background: "rgba(245,158,11,0.15)", color: YELLOW }}>Pendente</span>
                  </div>

                  {/* Botão abrir projeto — vai para o card pai se for filho */}
                  <button
                    onClick={() => navigate(`/obra/${c.parent_card_id ?? c.id}`)}
                    className="w-full rounded-lg py-1.5 mb-2 transition-all"
                    style={{ fontSize: "0.62rem", fontWeight: 500, background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30`, cursor: "pointer" }}>
                    🔍 Abrir Projeto Completo
                  </button>

                  {/* Form de devolução */}
                  {isReturning && (
                    <div className="mb-2">
                      <textarea
                        value={pendingReturnReason}
                        onChange={e => setPendingReturnReason(e.target.value)}
                        placeholder="Motivo da devolução..."
                        rows={2}
                        className="w-full rounded-lg px-3 py-2 resize-none"
                        style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.04)", color: "white", border: `1px solid ${BORDER}`, outline: "none" }}
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      disabled={pendingActing}
                      onClick={async () => {
                        setPendingActing(true);
                        await acceptHandoff(c.id, user?.email ?? "Usuário");
                        await reload();
                        setActionToast(`✅ Projeto aceito — ${c.title}`);
                        setTimeout(() => setActionToast(null), 5000);
                        setPendingActing(false);
                      }}
                      className="flex-1 rounded-lg py-1.5 transition-all"
                      style={{ fontSize: "0.6rem", fontWeight: 500, background: "rgba(16,185,129,0.12)", color: GREEN, border: "1px solid rgba(16,185,129,0.2)", cursor: pendingActing ? "not-allowed" : "pointer" }}>
                      {pendingActing ? "..." : "✓ Aceitar"}
                    </button>
                    {!isReturning ? (
                      <button
                        disabled={pendingActing}
                        onClick={() => { setPendingReturnCard(c.id); setPendingReturnReason(""); }}
                        className="rounded-lg px-3 py-1.5 transition-all"
                        style={{ fontSize: "0.6rem", fontWeight: 500, background: "rgba(239,68,68,0.08)", color: RED, border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
                        ✕ Devolver
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={pendingActing || !pendingReturnReason.trim()}
                          onClick={async () => {
                            if (!pendingReturnReason.trim()) return;
                            setPendingActing(true);
                            await returnHandoff(c.id, pendingReturnReason.trim(), user?.email ?? "Usuário");
                            await reload();
                            setActionToast(`🔙 Projeto devolvido — ${c.title}`);
                            setTimeout(() => setActionToast(null), 5000);
                            setPendingActing(false);
                            setPendingReturnCard(null);
                            setPendingReturnReason("");
                          }}
                          className="flex-1 rounded-lg py-1.5 transition-all"
                          style={{ fontSize: "0.6rem", fontWeight: 500, background: "rgba(239,68,68,0.12)", color: RED, border: "1px solid rgba(239,68,68,0.2)", cursor: !pendingReturnReason.trim() ? "not-allowed" : "pointer" }}>
                          Confirmar Devolução
                        </button>
                        <button
                          onClick={() => { setPendingReturnCard(null); setPendingReturnReason(""); }}
                          className="rounded-lg px-3 py-1.5"
                          style={{ fontSize: "0.6rem", color: TEXT_DIM, border: `1px solid ${BORDER}`, cursor: "pointer" }}>
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Handoffs legados */}
        <div>
          {pendingCards.length > 0 && (
            <p className="mb-2" style={{ fontSize: "0.6rem", fontWeight: 600, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.1em" }}>Handoffs de documentos</p>
          )}
          {legacyHandoffs.length === 0 ? (
            pendingCards.length === 0 && (
              <div className="rounded-xl p-8 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <ArrowRightLeft size={24} style={{ color: GREEN, margin: "0 auto 8px" }} />
                <p style={{ fontSize: "0.8rem", color: GREEN }}>Sem handoffs pendentes</p>
              </div>
            )
          ) : (
            legacyHandoffs.map(h => {
              const statusColor = h.status === "aceito" ? GREEN : h.status === "pendente" ? YELLOW : RED;
              const statusBg = h.status === "aceito" ? "rgba(16,185,129,0.12)" : h.status === "pendente" ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)";
              // Tenta encontrar o card no banco pelo obra_id, lookup cross-dept ou título local
              const linkedCardId = (h as any).obra_id
                ?? obraCardIds[h.obra]
                ?? dbCards.find(c => c.title === h.obra)?.id;
              const canOpenProject = linkedCardId && isDbCardId(linkedCardId);
              return (
                <div key={h.id} className="rounded-xl p-4 mb-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ fontSize: "0.7rem", color: TEXT_MED }}>{h.from}</span>
                    <ChevronRight size={12} style={{ color: ACCENT }} />
                    <span style={{ fontSize: "0.7rem", color: "white", fontWeight: 600 }}>{h.to}</span>
                    <span className="ml-auto rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: statusBg, color: statusColor }}>{h.status}</span>
                  </div>
                  <p style={{ fontSize: "0.72rem", color: TEXT_MED, lineHeight: 1.5 }}>{h.item}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span style={{ fontSize: "0.55rem", color: ACCENT }}>{h.obra}</span>
                    <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>SLA: {h.slaHours}h</span>
                  </div>
                  {linkedCardId && isDbCardId(linkedCardId) && (
                    <p style={{ fontSize: "0.52rem", color: TEXT_DIM, fontFamily: "monospace", marginTop: 4 }}>ID: {linkedCardId.slice(0, 8)}…</p>
                  )}
                  {/* Botão abrir projeto */}
                  {canOpenProject && (
                    <button
                      onClick={() => navigate(`/obra/${linkedCardId}`)}
                      className="w-full rounded-lg py-1.5 mt-2 transition-all"
                      style={{ fontSize: "0.6rem", fontWeight: 500, background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30`, cursor: "pointer" }}>
                      🔍 Abrir Projeto Completo
                    </button>
                  )}
                  {h.status === "pendente" && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={async () => {
                          await aceitarHandoff(h.id, profile?.nome);
                          setActionToast(`Handoff aceito ✓ — ${h.obra}`);
                          setTimeout(() => setActionToast(null), 5000);
                        }}
                        className="flex-1 rounded-lg py-1.5 text-center transition-all"
                        style={{ fontSize: "0.6rem", fontWeight: 500, background: "rgba(16,185,129,0.12)", color: GREEN, border: "1px solid rgba(16,185,129,0.2)", cursor: "pointer" }}>
                        Aceitar
                      </button>
                      <button
                        onClick={async () => {
                          await updateHandoffStatus(h.id, "cancelado");
                          setActionToast(`Handoff rejeitado — ${h.item?.substring(0, 40)}`);
                          setTimeout(() => setActionToast(null), 5000);
                        }}
                        className="rounded-lg px-3 py-1.5 transition-all"
                        style={{ fontSize: "0.6rem", fontWeight: 500, background: "rgba(255,255,255,0.03)", color: TEXT_DIM, border: `1px solid ${BORDER}`, cursor: "pointer" }}>
                        Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderHandoffsGlobal = () => {
    const allH = dbHandoffs;
    const filtered = allH.filter(h => {
      if (hgFilter !== "all" && h.status !== hgFilter) return false;
      if (hgDeptFilter !== "all" && h.dept_from !== hgDeptFilter && h.dept_to !== hgDeptFilter) return false;
      return true;
    });
    const deptNames = [...new Set(allH.flatMap(h => [h.dept_from, h.dept_to]))].sort();
    const statusCounts = handoffCounts;
    const uniqueFlows = handoffFlow.map(f => ({
      from: f.dept_from, to: f.dept_to, count: f.total, hasVencido: f.tem_vencido,
    }));

    return (
      <div className="space-y-5">
        <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Centro de Handoffs Global</h2><p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Visao consolidada de todos os handoffs entre departamentos da Parket</p></div>
        <div className="grid grid-cols-4 gap-3">
          {[{ label: "Total", value: statusCounts.total, color: ACCENT }, { label: "Pendentes", value: statusCounts.pendente, color: YELLOW }, { label: "Aceitos", value: statusCounts.aceito, color: GREEN }, { label: "Vencidos", value: statusCounts.vencido, color: RED }].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: "1.4rem", fontWeight: 700, color: s.color }}>{s.value}</span>
              <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p className="tracking-[0.2em] uppercase mb-4" style={{ fontSize: "0.5rem", color: ACCENT }}>Fluxo entre Departamentos</p>
          <div className="flex flex-wrap gap-2">
            {uniqueFlows.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-lg px-3 py-2" style={{ background: f.hasVencido ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${f.hasVencido ? "rgba(239,68,68,0.15)" : BORDER}` }}>
                <span style={{ fontSize: "0.6rem", color: TEXT_MED, fontWeight: 500 }}>{f.from}</span>
                <ArrowRight size={10} style={{ color: f.hasVencido ? RED : ACCENT }} />
                <span style={{ fontSize: "0.6rem", color: "white", fontWeight: 600 }}>{f.to}</span>
                <span className="rounded-full w-5 h-5 flex items-center justify-center ml-1" style={{ fontSize: "0.5rem", fontWeight: 700, background: f.hasVencido ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)", color: f.hasVencido ? RED : TEXT_MED }}>{f.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "pendente", "aceito", "vencido"] as const).map(f => (
            <button key={f} onClick={() => setHgFilter(f)} className="rounded-lg px-3 py-1.5 transition-all" style={{ fontSize: "0.6rem", fontWeight: hgFilter === f ? 600 : 400, background: hgFilter === f ? "rgba(212,168,83,0.15)" : "rgba(255,255,255,0.03)", color: hgFilter === f ? GOLD : TEXT_DIM, border: `1px solid ${hgFilter === f ? "rgba(212,168,83,0.3)" : "transparent"}` }}>
              {f === "all" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <select value={hgDeptFilter} onChange={e => setHgDeptFilter(e.target.value)} className="rounded-lg px-3 py-1.5 outline-none" style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.03)", color: TEXT_MED, border: `1px solid ${BORDER}` }}>
            <option value="all">Todos os Depts</option>
            {deptNames.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-xl p-6 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}><p style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Nenhum handoff encontrado</p></div>
          ) : filtered.map(h => {
            const sc = h.status === "aceito" ? GREEN : h.status === "pendente" ? YELLOW : RED;
            const sbg = h.status === "aceito" ? "rgba(16,185,129,0.1)" : h.status === "pendente" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";
            return (
              <div key={h.id} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: `${ACCENT}20` }}><ArrowRightLeft size={10} style={{ color: ACCENT }} /></div>
                  <span style={{ fontSize: "0.7rem", color: TEXT_MED }}>{h.dept_from}</span>
                  <ArrowRight size={10} style={{ color: ACCENT }} />
                  <span style={{ fontSize: "0.7rem", color: "white", fontWeight: 600 }}>{h.dept_to}</span>
                  <span className="ml-auto rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: sbg, color: sc }}>{h.status}</span>
                </div>
                <p style={{ fontSize: "0.68rem", color: TEXT_MED }}>{h.item}</p>
                <div className="flex items-center justify-between mt-2">
                  <span style={{ fontSize: "0.55rem", color: ACCENT }}>{h.obra}</span>
                  <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>SLA: {h.sla_hours}h</span>
                </div>
                {h.status === "pendente" && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={async () => {
                        await aceitarHandoff(h.id, profile?.nome);
                        setActionToast(`Handoff aceito ✓ — ${h.dept_from} → ${h.dept_to}`);
                        setTimeout(() => setActionToast(null), 5000);
                      }}
                      className="flex-1 rounded-lg py-1.5 text-center transition-all"
                      style={{ fontSize: "0.6rem", fontWeight: 500, background: "rgba(16,185,129,0.12)", color: GREEN, border: "1px solid rgba(16,185,129,0.2)", cursor: "pointer" }}>
                      Aceitar
                    </button>
                    <button
                      onClick={async () => {
                        await updateHandoffStatus(h.id, "cancelado");
                        setActionToast(`Handoff rejeitado — ${h.item.substring(0, 40)}`);
                        setTimeout(() => setActionToast(null), 5000);
                      }}
                      className="rounded-lg px-3 py-1.5 transition-all"
                      style={{ fontSize: "0.6rem", fontWeight: 500, background: "rgba(255,255,255,0.03)", color: TEXT_DIM, border: `1px solid ${BORDER}`, cursor: "pointer" }}>
                      Rejeitar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAlertasIA = () => {
    const filtered = dbSmartAlerts.filter(a => aiFilter === "all" || a.severity === aiFilter);
    const critCount = dbSmartAlerts.filter(a => a.severity === "critical").length;
    const warnCount = dbSmartAlerts.filter(a => a.severity === "warning").length;
    const infoCount = dbSmartAlerts.filter(a => a.severity === "info").length;
    return (
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1"><Zap size={18} style={{ color: GOLD }} /><h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 600 }}>Alertas Inteligentes</h2></div>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Regras automaticas monitorando obras, margens, prazos e performance em tempo real</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
            <div className="flex items-center gap-2 mb-1"><AlertTriangle size={14} style={{ color: RED }} /><span style={{ fontSize: "0.6rem", color: RED, fontWeight: 600 }}>Criticos</span></div>
            <span style={{ fontSize: "1.4rem", fontWeight: 700, color: RED }}>{critCount}</span>
            <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginTop: 2 }}>Acao imediata</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.12)" }}>
            <div className="flex items-center gap-2 mb-1"><Clock size={14} style={{ color: YELLOW }} /><span style={{ fontSize: "0.6rem", color: YELLOW, fontWeight: 600 }}>Atencao</span></div>
            <span style={{ fontSize: "1.4rem", fontWeight: 700, color: YELLOW }}>{warnCount}</span>
            <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginTop: 2 }}>Monitorar hoje</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.12)" }}>
            <div className="flex items-center gap-2 mb-1"><Activity size={14} style={{ color: BLUE }} /><span style={{ fontSize: "0.6rem", color: BLUE, fontWeight: 600 }}>Insights</span></div>
            <span style={{ fontSize: "1.4rem", fontWeight: 700, color: BLUE }}>{infoCount}</span>
            <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginTop: 2 }}>Oportunidades</p>
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: "rgba(212,168,83,0.04)", border: "1px solid rgba(212,168,83,0.12)" }}>
          <div className="flex items-center gap-2 mb-3"><Shield size={14} style={{ color: GOLD }} /><span style={{ fontSize: "0.7rem", fontWeight: 600, color: GOLD }}>Regras Ativas do Motor de Alertas</span></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(RULES_DESC).map(([key, desc]) => (
              <div key={key} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <CircleDot size={8} style={{ color: GOLD, marginTop: 3, flexShrink: 0 }} />
                <span style={{ fontSize: "0.55rem", color: TEXT_MED, lineHeight: 1.4 }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {(["all", "critical", "warning", "info"] as const).map(f => {
            const labels: Record<string, string> = { all: "Todos", critical: "Criticos", warning: "Atencao", info: "Insights" };
            const colors: Record<string, string> = { all: GOLD, critical: RED, warning: YELLOW, info: BLUE };
            return (
              <button key={f} onClick={() => setAiFilter(f)} className="rounded-lg px-3 py-1.5 transition-all" style={{ fontSize: "0.6rem", fontWeight: aiFilter === f ? 600 : 400, background: aiFilter === f ? `${colors[f]}15` : "rgba(255,255,255,0.03)", color: aiFilter === f ? colors[f] : TEXT_DIM, border: `1px solid ${aiFilter === f ? `${colors[f]}30` : "transparent"}` }}>
                {labels[f]}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {filtered.map(a => {
            const ac = a.severity === "critical" ? RED : a.severity === "warning" ? YELLOW : BLUE;
            const bg = a.severity === "critical" ? "rgba(239,68,68,0.04)" : a.severity === "warning" ? "rgba(245,158,11,0.04)" : "rgba(59,130,246,0.04)";
            return (
              <div key={a.id} className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${ac}20` }}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {a.severity === "critical" && <AlertTriangle size={14} style={{ color: RED }} />}
                    {a.severity === "warning" && <Clock size={14} style={{ color: YELLOW }} />}
                    {a.severity === "info" && <Activity size={14} style={{ color: BLUE }} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-white" style={{ fontSize: "0.78rem", lineHeight: 1.5 }}>{a.message}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: `${ac}15`, color: ac }}>{a.dept}</span>
                      {a.obra && <span style={{ fontSize: "0.55rem", color: ACCENT }}>{a.obra}</span>}
                      <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{a.timestamp}</span>
                      {a.autoGenerated && <span className="flex items-center gap-1 rounded px-1.5 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 500, background: "rgba(212,168,83,0.1)", color: GOLD }}><Zap size={8} /> Auto</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderEquipe = () => (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Equipe — {profile.nomeCompleto}</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{team.length} membros</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {team.map((m, i) => {
          const statusColor = m.status === "online" ? GREEN : m.status === "busy" ? ORANGE : TEXT_DIM;
          const statusLabel = m.status === "online" ? "Online" : m.status === "busy" ? "Ocupado" : "Offline";
          return (
            <div key={i} className="rounded-xl p-4 flex items-center gap-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center relative" style={{ background: profile.colorDim }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: profile.color }}>{m.avatar}</span>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111]" style={{ background: statusColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white truncate" style={{ fontSize: "0.78rem", fontWeight: 500 }}>{m.name}</p>
                <p className="truncate" style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{m.role}</p>
              </div>
              <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${statusColor}15`, color: statusColor }}>{statusLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderAtividade = () => (
    <div className="space-y-3">
      <div className="mb-4">
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Feed de Atividade</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Ultimas acoes e atualizacoes do departamento</p>
      </div>
      {(dbActivityItems.length > 0 ? dbActivityItems : activity).map(a => {
        const typeColors: Record<string, string> = { action: BLUE, update: ACCENT, alert: YELLOW, completed: GREEN };
        const tc = typeColors[a.type] || TEXT_DIM;
        return (
          <div key={a.id} className="flex items-start gap-3 rounded-xl p-3.5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: tc }} />
            <div className="flex-1">
              <p style={{ fontSize: "0.72rem", color: TEXT_MED, lineHeight: 1.5 }}>{a.text}</p>
              <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginTop: 2 }}>{a.time}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  /* Find extra tab render */
  const findExtraTab = extraTabs.find(et => et.id === viewTab);

  /* ═══ MAIN RENDER ═══ */
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: BG, fontFamily: "'Inter',sans-serif" }}>
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(10,10,10,0.9)", border: `1px solid ${BORDER}` }}>
        {sidebarOpen ? <X size={18} className="text-white" /> : <Menu size={18} className="text-white" />}
      </button>
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`} style={{ background: "rgba(10,10,10,0.98)", borderRight: `1px solid ${BORDER}`, backdropFilter: "blur(12px)" }}>
        {sidebar}
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-30 lg:hidden" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setSidebarOpen(false)} />}
      <main ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 px-4 sm:px-6 py-3 flex items-center justify-between" style={{ background: "rgba(10,10,10,0.95)", borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(8px)" }}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: profile.colorDim }}>
              <span style={{ fontSize: "0.85rem" }}>{profile.icon}</span>
            </div>
            <div>
              <h1 className="text-white" style={{ fontSize: "0.85rem", fontWeight: 600 }}>{profile.nomeCompleto}</h1>
              <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{profile.lider} · {profile.cargo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Busca de projetos */}
            <TopbarSearch navigate={navigate} />
            {/* Botão Início */}
            <button onClick={() => navigate("/")} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, fontSize: "0.65rem", color: TEXT_MED, whiteSpace: "nowrap" }}>
              <Home size={12} />
              Início
            </button>
          </div>
        </div>
        <div className="px-4 sm:px-6 py-6">
          {viewTab === "kanban" && renderKanban()}
          {viewTab === "kpis" && renderKPIs()}
          {viewTab === "alertas" && renderAlertas()}
          {viewTab === "handoffs" && renderHandoffs()}
          {viewTab === "handoffs-global" && renderHandoffsGlobal()}
          {viewTab === "alertas-ia" && renderAlertasIA()}
          {viewTab === "equipe" && renderEquipe()}
          {viewTab === "atividade" && renderAtividade()}
          {viewTab === "tool-notas" && <BlocoDeNotas deptId={deptId} />}
          {viewTab === "tool-timer" && <TimerDeTarefas deptId={deptId} />}
          {viewTab === "tool-checklist" && <ChecklistDiario deptId={deptId} />}
          {viewTab === "tool-calculadora" && <CalculadoraDeObra />}
          {viewTab === "tool-agenda" && <AgendaDoDia deptId={deptId} />}
          {viewTab === "tool-relatorio" && <GeradorRelatorio deptId={deptId} deptName={profile.nomeCompleto} kpiData={profile.kpis.map(k => ({ label: k.label, value: String(k.value) }))} />}
          {findExtraTab && findExtraTab.render()}
        </div>
      </main>
      {showSolicitacao && (
        <SolicitacaoComprasModal onClose={() => setShowSolicitacao(false)} onSuccess={reload} />
      )}
      {selectedCard && ["compras", "compras-taiara", "compras-marco"].includes(deptId) && (
        <ComprasModal card={selectedCard} onClose={() => setSelectedCard(null)} onReload={reload}
          onDelete={isAdmin ? async () => { await deleteDbCard(selectedCard.id); setSelectedCard(null); setColumns(prev => prev.map(col => ({ ...col, cards: col.cards.filter(c => c.id !== selectedCard.id) }))); } : undefined} />
      )}
      {selectedCard && !["compras", "compras-taiara", "compras-marco"].includes(deptId) && (
        <Obra360Modal card={selectedCard} color={profile.color} onClose={() => setSelectedCard(null)} onReload={reload}
          onDelete={isAdmin ? async () => { await deleteDbCard(selectedCard.id); setSelectedCard(null); setColumns(prev => prev.map(col => ({ ...col, cards: col.cards.filter(c => c.id !== selectedCard.id) }))); } : undefined} />
      )}

      {/* ═══ AI AGENT FAB + CHAT ═══ */}
      {aiChatOpen && profile && (
        <AiAgentChat deptId={deptId} deptName={profile.nome} onClose={() => setAiChatOpen(false)} />
      )}
      <button
        onClick={() => setAiChatOpen(v => !v)}
        title="Perguntar ao Agente IA"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 190,
          width: 48, height: 48, borderRadius: 14,
          background: aiChatOpen ? "rgba(212,168,83,0.25)" : "rgba(212,168,83,0.12)",
          border: `1px solid ${aiChatOpen ? "rgba(212,168,83,0.6)" : "rgba(212,168,83,0.25)"}`,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          transition: "all 0.2s",
        }}
      >
        <Bot size={20} style={{ color: GOLD }} />
      </button>

      {/* ═══ COMMAND PALETTE (CMD+K) ═══ */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Digite o nome da obra, cliente, playbook ou comando..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Navegação Global">
            <CommandItem onSelect={() => { navigate("/"); setCmdOpen(false); }}>
              <Home className="mr-2 h-4 w-4" /> Home / Hub Central
            </CommandItem>
            <CommandItem onSelect={() => { navigate("/dashboard"); setCmdOpen(false); }}>
              <LayoutDashboard className="mr-2 h-4 w-4" /> CEO Dashboard (Command Center)
            </CommandItem>
            <CommandItem onSelect={() => { navigate("/sistema-nervoso"); setCmdOpen(false); }}>
              <Activity className="mr-2 h-4 w-4" /> Sistema Nervoso Central
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Ações Rápidas">
            <CommandItem onSelect={() => setCmdOpen(false)}>
              <Search className="mr-2 h-4 w-4" /> Buscar Obra...
            </CommandItem>
            <CommandItem onSelect={() => setCmdOpen(false)}>
              <UserCircle2 className="mr-2 h-4 w-4" /> Buscar Colaborador...
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

/* Re-export commonly needed items for department pages */
export {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, PieChart, Pie, LineChart, Line,
  BORDER, GREEN, RED, YELLOW, BLUE, ACCENT, GOLD, PURPLE, ORANGE, PINK, TEAL, BG, CARD_BG,
  type DeptProfile, type KanbanCard, type KanbanColumn, type KPI, type Alert, type Handoff,
  AlertTriangle, CheckCircle2, Clock, Target, Calendar, FileText, Users, DollarSign,
  BarChart3, Briefcase, Kanban, ArrowRightLeft, Building2, Activity,
};

/* ─── Column Manager Modal ─── */
const COLUMN_COLORS = [
  { id: 'gray',   hex: '#6B7280', label: 'Cinza'    },
  { id: 'blue',   hex: '#3B82F6', label: 'Azul'     },
  { id: 'green',  hex: '#10B981', label: 'Verde'    },
  { id: 'yellow', hex: '#F59E0B', label: 'Amarelo'  },
  { id: 'orange', hex: '#F97316', label: 'Laranja'  },
  { id: 'red',    hex: '#EF4444', label: 'Vermelho' },
  { id: 'purple', hex: '#8B5CF6', label: 'Roxo'     },
  { id: 'pink',   hex: '#EC4899', label: 'Rosa'     },
  { id: 'teal',   hex: '#14B8A6', label: 'Teal'     },
];

function ColumnManagerModal({
  deptId, columns, onAdd, onUpdate, onDelete, onReorder, onClose,
}: {
  deptId: string;
  columns: DbColumn[];
  onAdd: (title: string, color: string) => Promise<DbColumn | null>;
  onUpdate: (id: string, fields: Partial<DbColumn>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onReorder: (ordered: DbColumn[]) => Promise<void>;
  onClose: () => void;
}) {
  const [cols, setCols] = useState<DbColumn[]>([...columns]);
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('gray');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const colorHex = (c: string) => COLUMN_COLORS.find(x => x.id === c)?.hex ?? '#6B7280';

  async function handleAdd() {
    if (!newTitle.trim()) return;
    setSaving(true);
    const added = await onAdd(newTitle.trim(), newColor);
    if (added) setCols(prev => [...prev, added]);
    setNewTitle('');
    setNewColor('gray');
    setSaving(false);
  }

  async function handleRename(id: string) {
    if (!editTitle.trim()) { setEditingId(null); return; }
    setSaving(true);
    await onUpdate(id, { title: editTitle.trim() });
    setCols(prev => prev.map(c => c.id === id ? { ...c, title: editTitle.trim() } : c));
    setEditingId(null);
    setSaving(false);
  }

  async function handleColorChange(id: string, color: string) {
    await onUpdate(id, { color });
    setCols(prev => prev.map(c => c.id === id ? { ...c, color } : c));
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta coluna? Os cards dela não serão apagados.')) return;
    await onDelete(id);
    setCols(prev => prev.filter(c => c.id !== id));
  }

  // Simple drag-reorder
  function handleDragStart(id: string) { setDragging(id); }
  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!dragging || dragging === overId) return;
    const from = cols.findIndex(c => c.id === dragging);
    const to = cols.findIndex(c => c.id === overId);
    if (from === -1 || to === -1) return;
    const next = [...cols];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setCols(next);
  }
  async function handleDrop() {
    setDragging(null);
    await onReorder(cols);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 12, width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2A2A2A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F5F5' }}>⚙ Gerenciar Colunas</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>Arraste para reordenar · Clique no nome para editar</div>
          </div>
          <button onClick={onClose} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* Column list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {cols.map(col => (
            <div
              key={col.id}
              draggable
              onDragStart={() => handleDragStart(col.id)}
              onDragOver={e => handleDragOver(e, col.id)}
              onDrop={handleDrop}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                marginBottom: 6, borderRadius: 8, cursor: 'grab',
                background: dragging === col.id ? '#252525' : '#141414',
                border: '1px solid #2A2A2A',
              }}
            >
              {/* Drag handle */}
              <span style={{ color: '#444', fontSize: 14, cursor: 'grab' }}>⠿</span>

              {/* Color dot + picker */}
              <div style={{ position: 'relative' }}>
                <div
                  style={{ width: 14, height: 14, borderRadius: '50%', background: colorHex(col.color), cursor: 'pointer', border: '2px solid #333' }}
                  title="Clique para mudar cor"
                  onClick={() => {
                    const next = COLUMN_COLORS[(COLUMN_COLORS.findIndex(c => c.id === col.color) + 1) % COLUMN_COLORS.length];
                    handleColorChange(col.id, next.id);
                  }}
                />
              </div>

              {/* Title (editable on click) */}
              {editingId === col.id ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={() => handleRename(col.id)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(col.id); if (e.key === 'Escape') setEditingId(null); }}
                  style={{ flex: 1, background: '#0D0D0D', border: '1px solid #D4A853', borderRadius: 6, padding: '4px 8px', color: '#F5F5F5', fontSize: 12 }}
                />
              ) : (
                <span
                  onClick={() => { setEditingId(col.id); setEditTitle(col.title); }}
                  style={{ flex: 1, fontSize: 12, color: '#F5F5F5', cursor: 'text' }}
                  title="Clique para renomear"
                >
                  {col.title}
                  {col.is_handoff && <span style={{ marginLeft: 6, fontSize: 10, color: '#14B8A6' }}>handoff</span>}
                </span>
              )}

              {/* Delete */}
              <button
                onClick={() => handleDelete(col.id)}
                style={{ color: '#444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#444')}
                title="Remover coluna"
              >✕</button>
            </div>
          ))}
        </div>

        {/* Add new column */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #2A2A2A' }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>NOVA COLUNA</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Nome da coluna..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              style={{ flex: 1, background: '#0D0D0D', border: '1px solid #2A2A2A', borderRadius: 8, padding: '8px 12px', color: '#F5F5F5', fontSize: 12 }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              {COLUMN_COLORS.map(c => (
                <div
                  key={c.id}
                  onClick={() => setNewColor(c.id)}
                  title={c.label}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                    background: c.hex,
                    border: newColor === c.id ? '2px solid #F5F5F5' : '2px solid transparent',
                  }}
                />
              ))}
            </div>
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || saving}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: newTitle.trim() ? '#D4A853' : '#2A2A2A',
                color: newTitle.trim() ? '#0D0D0D' : '#444',
                border: 'none',
              }}
            >
              + Adicionar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
