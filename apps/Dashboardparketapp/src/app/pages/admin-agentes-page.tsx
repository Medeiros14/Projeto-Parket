/* ═══════════════════════════════════════════════════════════════════
   ADMIN — Parket Squad Skills · Gestão de Agentes IA + Cron Jobs
   Rota: /admin/agentes  (superadmin + admin)
   ═══════════════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  ChevronLeft, Bot, Clock, ScrollText, Plus, Trash2, Edit2, X, Check,
  RefreshCw, Play, Pause, Zap, CheckCircle2, AlertTriangle, Radio,
  ToggleLeft, ToggleRight, Activity, Calendar, Terminal, Cpu, Wifi,
  WifiOff, Save, ChevronDown, ChevronUp, Info, BarChart2,
} from "lucide-react";
import { supabase, createAdminClient } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

/* ─── Theme ─── */
const BG       = "#0A0A0A";
const CARD_BG  = "#111111";
const CARD2    = "#161616";
const BORDER   = "rgba(255,255,255,0.06)";
const ACCENT   = "#D4A853";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MED = "rgba(255,255,255,0.6)";
const RED      = "#EF4444";
const GREEN    = "#10B981";
const YELLOW   = "#F59E0B";
const BLUE     = "#3B82F6";
const PURPLE   = "#8B5CF6";

/* ─── Types ─── */
interface AiSquad {
  id: string;
  name: string;
  description: string;
  dept_id: string | null;
  agent_type: "control_tower" | "area_agent" | "specialist" | "webhook";
  status: "active" | "inactive" | "error" | "running" | "paused";
  webhook_url: string | null;
  capabilities: string[];
  config: Record<string, unknown>;
  last_ping_at: string | null;
  last_task_at: string | null;
  tasks_completed: number;
  tasks_failed: number;
  created_at: string;
}

interface CronJobConfig {
  id: string;
  name: string;
  description: string;
  schedule: string;
  command: string;
  category: "system" | "ai" | "alerts" | "reports" | "custom";
  dept_id: string | null;
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  run_count: number;
  created_at: string;
}

interface TaskLog {
  id: string;
  job_name: string;
  squad_name: string | null;
  triggered_by: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: "running" | "success" | "error" | "timeout" | "skipped";
  records_affected: number;
  output: Record<string, unknown> | null;
  error_message: string | null;
}

/* ─── Presets de schedule ─── */
const SCHEDULE_PRESETS = [
  { label: "A cada 30 min",    value: "*/30 * * * *" },
  { label: "A cada hora",      value: "0 * * * *" },
  { label: "A cada 4 horas",   value: "0 */4 * * *" },
  { label: "A cada 6 horas",   value: "0 */6 * * *" },
  { label: "Todo dia — 00h",   value: "0 0 * * *" },
  { label: "Todo dia — 07h",   value: "0 7 * * *" },
  { label: "Todo dia — 08h",   value: "0 8 * * *" },
  { label: "Segunda — 08h",    value: "0 8 * * 1" },
  { label: "Domingo — 23h",    value: "0 23 * * 0" },
  { label: "Custom",           value: "__custom__" },
];

const CATEGORY_COLORS: Record<string, string> = {
  system:  BLUE,
  ai:      PURPLE,
  alerts:  RED,
  reports: YELLOW,
  custom:  TEXT_MED,
};

const CATEGORY_LABELS: Record<string, string> = {
  system: "Sistema", ai: "IA", alerts: "Alertas", reports: "Relatórios", custom: "Custom",
};

const STATUS_COLOR: Record<string, string> = {
  active:   GREEN,
  running:  YELLOW,
  inactive: TEXT_DIM,
  error:    RED,
  paused:   YELLOW,
  success:  GREEN,
  timeout:  RED,
  skipped:  TEXT_DIM,
};

const AGENT_TYPE_LABEL: Record<string, string> = {
  control_tower: "Control Tower",
  area_agent:    "Agente de Área",
  specialist:    "Especialista",
  webhook:       "Webhook",
};

const DEPT_LABEL: Record<string, string> = {
  comercial: "Comercial", projetos: "Projetos", compras: "Compras",
  producao: "Produção", logistica: "Logística", obras: "Obras",
  financeiro: "Financeiro", atendimento: "Atendimento", fiscal: "Fiscal",
  produtividade: "PMO", marketing: "Marketing", rh: "RH", orcamento: "Orçamento",
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtMs(ms: number | null) {
  if (!ms) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Squad Card ─── */
function SquadCard({
  squad, isAdmin,
  onToggle, onEdit, onDelete,
}: {
  squad: AiSquad;
  isAdmin: boolean;
  onToggle: (s: AiSquad) => void;
  onEdit: (s: AiSquad) => void;
  onDelete: (s: AiSquad) => void;
}) {
  const statusColor = STATUS_COLOR[squad.status] ?? TEXT_DIM;
  const isOnline = squad.status === "active" || squad.status === "running";

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "16px 18px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${statusColor}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {squad.agent_type === "control_tower" ? <Cpu size={18} style={{ color: statusColor }} /> : <Bot size={18} style={{ color: statusColor }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "#fff" }}>{squad.name}</span>
            {/* Online dot */}
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, display: "inline-block", boxShadow: isOnline ? `0 0 6px ${statusColor}` : "none" }} />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.55rem", padding: "1px 6px", borderRadius: 20, background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30` }}>
              {squad.status.toUpperCase()}
            </span>
            <span style={{ fontSize: "0.55rem", padding: "1px 6px", borderRadius: 20, background: "rgba(255,255,255,0.04)", color: TEXT_DIM }}>
              {AGENT_TYPE_LABEL[squad.agent_type]}
            </span>
            {squad.dept_id && (
              <span style={{ fontSize: "0.55rem", padding: "1px 6px", borderRadius: 20, background: `${BLUE}18`, color: BLUE }}>
                {DEPT_LABEL[squad.dept_id] ?? squad.dept_id}
              </span>
            )}
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => onToggle(squad)} title={squad.status === "active" ? "Pausar" : "Ativar"}
              style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = ACCENT)} onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}>
              {squad.status === "active" ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={() => onEdit(squad)} title="Editar"
              style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = ACCENT)} onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}>
              <Edit2 size={14} />
            </button>
            <button onClick={() => onDelete(squad)} title="Remover"
              style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = RED)} onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}>
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      <p style={{ fontSize: "0.65rem", color: TEXT_DIM, lineHeight: 1.5, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
        {squad.description}
      </p>

      {/* Capabilities */}
      {squad.capabilities?.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
          {squad.capabilities.slice(0, 4).map(c => (
            <span key={c} style={{ fontSize: "0.5rem", padding: "1px 6px", borderRadius: 20, background: "rgba(255,255,255,0.03)", color: TEXT_DIM, border: `1px solid ${BORDER}` }}>
              {c.replace(/_/g, " ")}
            </span>
          ))}
          {squad.capabilities.length > 4 && (
            <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>+{squad.capabilities.length - 4}</span>
          )}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
        <div>
          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: GREEN }}>{squad.tasks_completed}</span>
          <span style={{ fontSize: "0.5rem", color: TEXT_DIM, marginLeft: 3 }}>concluídas</span>
        </div>
        <div>
          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: squad.tasks_failed > 0 ? RED : TEXT_DIM }}>{squad.tasks_failed}</span>
          <span style={{ fontSize: "0.5rem", color: TEXT_DIM, marginLeft: 3 }}>falhas</span>
        </div>
        <div style={{ marginLeft: "auto" }}>
          {squad.status === "active" ? <Wifi size={12} style={{ color: GREEN }} /> : <WifiOff size={12} style={{ color: TEXT_DIM }} />}
        </div>
      </div>
      {squad.last_ping_at && (
        <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginTop: 4 }}>Último ping: {fmtDate(squad.last_ping_at)}</p>
      )}
    </div>
  );
}

/* ─── Cron Job Row ─── */
function CronJobRow({
  job, isAdmin,
  onToggle, onEdit, onDelete, onRun,
}: {
  job: CronJobConfig;
  isAdmin: boolean;
  onToggle: (j: CronJobConfig) => void;
  onEdit: (j: CronJobConfig) => void;
  onDelete: (j: CronJobConfig) => void;
  onRun: (j: CronJobConfig) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLORS[job.category] ?? TEXT_DIM;
  const statusColor = job.last_status === "success" ? GREEN : job.last_status === "error" ? RED : TEXT_DIM;

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 6, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        {/* Category badge */}
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${catColor}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {job.category === "ai" ? <Bot size={12} style={{ color: catColor }} /> :
           job.category === "alerts" ? <AlertTriangle size={12} style={{ color: catColor }} /> :
           job.category === "reports" ? <ScrollText size={12} style={{ color: catColor }} /> :
           <Clock size={12} style={{ color: catColor }} />}
        </div>

        {/* Name + schedule */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "0.78rem", color: job.enabled ? "#fff" : TEXT_DIM }}>{job.name}</span>
            <code style={{ fontSize: "0.5rem", padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: TEXT_MED, fontFamily: "monospace" }}>
              {job.schedule}
            </code>
            <span style={{ fontSize: "0.5rem", padding: "1px 6px", borderRadius: 20, background: `${catColor}18`, color: catColor }}>
              {CATEGORY_LABELS[job.category]}
            </span>
            {!job.enabled && (
              <span style={{ fontSize: "0.5rem", padding: "1px 6px", borderRadius: 20, background: "rgba(255,255,255,0.04)", color: TEXT_DIM }}>PAUSADO</span>
            )}
          </div>
          {job.description && (
            <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 2 }}>{job.description}</p>
          )}
        </div>

        {/* Last run */}
        <div style={{ textAlign: "right", minWidth: 90 }}>
          {job.last_run_at ? (
            <>
              <span style={{ fontSize: "0.55rem", color: statusColor, display: "block", fontWeight: 600 }}>
                {job.last_status?.toUpperCase()}
              </span>
              <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{fmtDate(job.last_run_at)}</span>
            </>
          ) : (
            <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Nunca executado</span>
          )}
          <span style={{ fontSize: "0.5rem", color: TEXT_DIM, display: "block" }}>{job.run_count}× executado</span>
        </div>

        {/* Actions */}
        {isAdmin && (
          <div style={{ display: "flex", gap: 3 }}>
            <button onClick={() => onRun(job)} title="Executar agora"
              style={{ background: "rgba(16,185,129,0.1)", border: `1px solid ${GREEN}30`, borderRadius: 6, cursor: "pointer", color: GREEN, padding: "4px 7px", display: "flex", alignItems: "center", gap: 3, fontSize: "0.55rem" }}>
              <Zap size={11} /> Rodar
            </button>
            <button onClick={() => onToggle(job)} title={job.enabled ? "Desativar" : "Ativar"}
              style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = ACCENT)} onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}>
              {job.enabled ? <ToggleRight size={16} style={{ color: GREEN }} /> : <ToggleLeft size={16} style={{ color: TEXT_DIM }} />}
            </button>
            <button onClick={() => onEdit(job)} title="Editar"
              style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = ACCENT)} onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}>
              <Edit2 size={14} />
            </button>
            <button onClick={() => onDelete(job)} title="Remover"
              style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = RED)} onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}>
              <Trash2 size={14} />
            </button>
          </div>
        )}

        <button onClick={() => setExpanded(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 2 }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expanded: command */}
      {expanded && (
        <div style={{ padding: "8px 14px 12px", borderTop: `1px solid ${BORDER}`, background: "rgba(0,0,0,0.3)" }}>
          <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 4 }}>Comando SQL:</p>
          <code style={{ fontSize: "0.6rem", color: ACCENT, fontFamily: "monospace", display: "block", padding: "6px 10px", background: "rgba(0,0,0,0.4)", borderRadius: 6, border: `1px solid ${BORDER}` }}>
            {job.command}
          </code>
          {job.dept_id && (
            <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 6 }}>Departamento: <span style={{ color: BLUE }}>{DEPT_LABEL[job.dept_id] ?? job.dept_id}</span></p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Cron Job Form ─── */
function CronJobForm({
  initial, onSave, onCancel, loading,
}: {
  initial?: Partial<CronJobConfig>;
  onSave: (data: Partial<CronJobConfig>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name,        setName]     = useState(initial?.name ?? "");
  const [description, setDesc]     = useState(initial?.description ?? "");
  const [schedule,    setSchedule] = useState(initial?.schedule ?? "0 7 * * *");
  const [customSched, setCustom]   = useState("");
  const [command,     setCommand]  = useState(initial?.command ?? "SELECT ");
  const [category,    setCategory] = useState<string>(initial?.category ?? "custom");
  const [deptId,      setDeptId]   = useState(initial?.dept_id ?? "");
  const [enabled,     setEnabled]  = useState(initial?.enabled ?? true);

  const presetVal = SCHEDULE_PRESETS.find(p => p.value === schedule)?.value ?? "__custom__";
  const effectiveSchedule = presetVal === "__custom__" ? customSched : schedule;

  return (
    <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <p style={{ fontWeight: 600, fontSize: "0.8rem", color: "#fff", marginBottom: 14 }}>
        {initial?.id ? "Editar Cron Job" : "Novo Cron Job"}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ gridColumn: "1/-1" }}>
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Nome *</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: risk_scoring_diario"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: "0.72rem", outline: "none", boxSizing: "border-box" }} />
        </label>

        <label style={{ gridColumn: "1/-1" }}>
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Descrição</span>
          <input value={description} onChange={e => setDesc(e.target.value)} placeholder="O que esse job faz?"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: "0.72rem", outline: "none", boxSizing: "border-box" }} />
        </label>

        <label>
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Frequência *</span>
          <select value={presetVal}
            onChange={e => { if (e.target.value !== "__custom__") setSchedule(e.target.value); else setSchedule("__custom__"); }}
            style={{ width: "100%", background: "#1a1a1a", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: "0.72rem", outline: "none" }}>
            {SCHEDULE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label} {p.value !== "__custom__" ? `(${p.value})` : ""}</option>)}
          </select>
        </label>

        {presetVal === "__custom__" && (
          <label>
            <span style={{ fontSize: "0.6rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Expressão cron custom *</span>
            <input value={customSched} onChange={e => setCustom(e.target.value)} placeholder="ex: 0 */2 * * *"
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: ACCENT, fontSize: "0.72rem", outline: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
          </label>
        )}

        <label>
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Categoria</span>
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ width: "100%", background: "#1a1a1a", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: "0.72rem", outline: "none" }}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        <label>
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Departamento (opcional)</span>
          <select value={deptId} onChange={e => setDeptId(e.target.value)}
            style={{ width: "100%", background: "#1a1a1a", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: "0.72rem", outline: "none" }}>
            <option value="">— Global —</option>
            {Object.entries(DEPT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        <label style={{ gridColumn: "1/-1" }}>
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Comando SQL *</span>
          <textarea value={command} onChange={e => setCommand(e.target.value)} rows={2}
            placeholder="SELECT run_risk_scoring()"
            style={{ width: "100%", background: "rgba(0,0,0,0.4)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: ACCENT, fontSize: "0.7rem", outline: "none", fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }} />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
            style={{ accentColor: ACCENT, width: 14, height: 14 }} />
          <span style={{ fontSize: "0.65rem", color: TEXT_MED }}>Ativar imediatamente</span>
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={() => onSave({ name, description, schedule: effectiveSchedule, command, category: category as CronJobConfig["category"], dept_id: deptId || null, enabled })}
          disabled={loading || !name || !effectiveSchedule || !command}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: `${ACCENT}15`, border: `1px solid ${ACCENT}40`, borderRadius: 8, color: ACCENT, fontSize: "0.65rem", cursor: "pointer", fontWeight: 600, opacity: loading ? 0.5 : 1 }}>
          <Save size={13} /> {loading ? "Salvando…" : "Salvar"}
        </button>
        <button onClick={onCancel} style={{ padding: "8px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_DIM, fontSize: "0.65rem", cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* ─── Squad Form ─── */
function SquadForm({
  initial, onSave, onCancel, loading,
}: {
  initial?: Partial<AiSquad>;
  onSave: (data: Partial<AiSquad>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name,        setName]     = useState(initial?.name ?? "");
  const [description, setDesc]     = useState(initial?.description ?? "");
  const [deptId,      setDeptId]   = useState(initial?.dept_id ?? "");
  const [agentType,   setType]     = useState<string>(initial?.agent_type ?? "area_agent");
  const [webhookUrl,  setWebhook]  = useState(initial?.webhook_url ?? "");
  const [caps,        setCaps]     = useState((initial?.capabilities ?? []).join(", "));

  return (
    <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <p style={{ fontWeight: 600, fontSize: "0.8rem", color: "#fff", marginBottom: 14 }}>
        {initial?.id ? "Editar Squad" : "Novo Squad IA"}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label>
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Nome *</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Agente Obras"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: "0.72rem", outline: "none", boxSizing: "border-box" }} />
        </label>

        <label>
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Tipo</span>
          <select value={agentType} onChange={e => setType(e.target.value)}
            style={{ width: "100%", background: "#1a1a1a", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: "0.72rem", outline: "none" }}>
            {Object.entries(AGENT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        <label style={{ gridColumn: "1/-1" }}>
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Descrição</span>
          <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: "0.72rem", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
        </label>

        <label>
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Departamento</span>
          <select value={deptId} onChange={e => setDeptId(e.target.value)}
            style={{ width: "100%", background: "#1a1a1a", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: "0.72rem", outline: "none" }}>
            <option value="">— Transversal —</option>
            {Object.entries(DEPT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        <label>
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Webhook URL</span>
          <input value={webhookUrl} onChange={e => setWebhook(e.target.value)} placeholder="https://…"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: "0.72rem", outline: "none", boxSizing: "border-box" }} />
        </label>

        <label style={{ gridColumn: "1/-1" }}>
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Capacidades (separadas por vírgula)</span>
          <input value={caps} onChange={e => setCaps(e.target.value)} placeholder="risk_scoring, alert_dispatch, report_gen"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: "0.72rem", outline: "none", boxSizing: "border-box" }} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={() => onSave({
          name, description,
          dept_id: deptId || null,
          agent_type: agentType as AiSquad["agent_type"],
          webhook_url: webhookUrl || null,
          capabilities: caps.split(",").map(c => c.trim()).filter(Boolean),
        })}
          disabled={loading || !name}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: `${ACCENT}15`, border: `1px solid ${ACCENT}40`, borderRadius: 8, color: ACCENT, fontSize: "0.65rem", cursor: "pointer", fontWeight: 600, opacity: loading ? 0.5 : 1 }}>
          <Save size={13} /> {loading ? "Salvando…" : "Salvar"}
        </button>
        <button onClick={onCancel} style={{ padding: "8px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_DIM, fontSize: "0.65rem", cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export function AdminAgentesPage() {
  const navigate = useNavigate();
  const { user, isSuperAdmin, isAdmin } = useAuth();

  type Tab = "squads" | "cron" | "logs";
  const [tab, setTab] = useState<Tab>("squads");

  /* Data */
  const [squads, setSquads]   = useState<AiSquad[]>([]);
  const [jobs,   setJobs]     = useState<CronJobConfig[]>([]);
  const [logs,   setLogs]     = useState<TaskLog[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  /* Forms */
  const [showSquadForm, setShowSquadForm]   = useState(false);
  const [editSquad,     setEditSquad]       = useState<AiSquad | null>(null);
  const [showCronForm,  setShowCronForm]    = useState(false);
  const [editCron,      setEditCron]        = useState<CronJobConfig | null>(null);
  const [savingId,      setSavingId]        = useState<string | null>(null);

  /* Toast */
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── Fetch data ── */
  const loadSquads = useCallback(async () => {
    const { data, error: e } = await supabase.from("ai_squads").select("*").order("agent_type").order("name");
    if (e) { setError(e.message); return; }
    setSquads(data ?? []);
  }, []);

  const loadJobs = useCallback(async () => {
    const { data, error: e } = await supabase.from("cron_job_configs").select("*").order("category").order("name");
    if (e) { setError(e.message); return; }
    setJobs(data ?? []);
  }, []);

  const loadLogs = useCallback(async () => {
    const { data, error: e } = await supabase
      .from("ai_task_logs_view")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(100);
    if (e) {
      // fallback to base table
      const { data: d2 } = await supabase.from("ai_task_logs").select("*").order("started_at", { ascending: false }).limit(100);
      setLogs((d2 ?? []) as TaskLog[]);
      return;
    }
    setLogs((data ?? []) as TaskLog[]);
  }, []);

  useEffect(() => {
    Promise.all([loadSquads(), loadJobs(), loadLogs()]).finally(() => setLoadingData(false));
  }, [loadSquads, loadJobs, loadLogs]);

  /* ── Squad CRUD ── */
  async function saveSquad(data: Partial<AiSquad>) {
    setSavingId("squad");
    const adminClient = createAdminClient();
    if (editSquad?.id) {
      const { error: e } = await adminClient.from("ai_squads").update({ ...data, updated_at: new Date().toISOString() }).eq("id", editSquad.id);
      if (e) { showToast(e.message, "err"); }
      else   { showToast("Squad atualizado!"); setEditSquad(null); await loadSquads(); }
    } else {
      const { error: e } = await adminClient.from("ai_squads").insert({ ...data, status: "inactive" });
      if (e) { showToast(e.message, "err"); }
      else   { showToast("Squad criado!"); setShowSquadForm(false); await loadSquads(); }
    }
    setSavingId(null);
  }

  async function toggleSquad(s: AiSquad) {
    const newStatus = s.status === "active" ? "paused" : "active";
    const adminClient = createAdminClient();
    const { error: e } = await adminClient.from("ai_squads").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", s.id);
    if (e) showToast(e.message, "err");
    else { showToast(`Squad ${newStatus === "active" ? "ativado" : "pausado"}`); await loadSquads(); }
  }

  async function deleteSquad(s: AiSquad) {
    if (!confirm(`Remover squad "${s.name}"?`)) return;
    const adminClient = createAdminClient();
    const { error: e } = await adminClient.from("ai_squads").delete().eq("id", s.id);
    if (e) showToast(e.message, "err");
    else { showToast("Squad removido"); await loadSquads(); }
  }

  /* ── Cron CRUD ── */
  async function saveCronJob(data: Partial<CronJobConfig>) {
    setSavingId("cron");
    const adminClient = createAdminClient();
    try {
      if (editCron?.id) {
        const { error: e } = await adminClient.from("cron_job_configs").update({ ...data, updated_at: new Date().toISOString() }).eq("id", editCron.id);
        if (e) throw e;
        // Update pg_cron schedule
        await supabase.rpc("manage_cron_job", {
          p_action: data.enabled ? "schedule" : "unschedule",
          p_job_name: data.name ?? editCron.name,
          p_schedule: data.schedule,
          p_command: data.command,
        });
        showToast("Job atualizado e agendado!");
        setEditCron(null);
      } else {
        const { error: e } = await adminClient.from("cron_job_configs").insert(data);
        if (e) throw e;
        if (data.enabled) {
          await supabase.rpc("manage_cron_job", {
            p_action: "schedule",
            p_job_name: data.name,
            p_schedule: data.schedule,
            p_command: data.command,
          });
        }
        showToast("Job criado e agendado!");
        setShowCronForm(false);
      }
      await loadJobs();
    } catch (e: unknown) {
      showToast((e as { message?: string })?.message ?? "Erro ao salvar", "err");
    }
    setSavingId(null);
  }

  async function toggleCronJob(j: CronJobConfig) {
    setSavingId(j.id);
    const adminClient = createAdminClient();
    const newEnabled = !j.enabled;
    const { error: e } = await adminClient.from("cron_job_configs").update({ enabled: newEnabled, updated_at: new Date().toISOString() }).eq("id", j.id);
    if (!e) {
      await supabase.rpc("manage_cron_job", {
        p_action: newEnabled ? "schedule" : "unschedule",
        p_job_name: j.name,
        p_schedule: j.schedule,
        p_command: j.command,
      });
      showToast(newEnabled ? "Job ativado" : "Job pausado");
      await loadJobs();
    } else {
      showToast(e.message, "err");
    }
    setSavingId(null);
  }

  async function deleteCronJob(j: CronJobConfig) {
    if (!confirm(`Remover job "${j.name}" e cancelar agendamento?`)) return;
    const adminClient = createAdminClient();
    await supabase.rpc("manage_cron_job", { p_action: "unschedule", p_job_name: j.name });
    const { error: e } = await adminClient.from("cron_job_configs").delete().eq("id", j.id);
    if (e) showToast(e.message, "err");
    else { showToast("Job removido"); await loadJobs(); }
  }

  async function runCronJobNow(j: CronJobConfig) {
    setSavingId(j.id);
    // Insert a manual log entry then execute command via rpc
    const { error: e } = await supabase.rpc("manage_cron_job", {
      p_action:    "schedule",
      p_job_name:  `__manual_${j.name}_${Date.now()}`,
      p_schedule:  "* * * * *",  // every minute — will run once then we unschedule
      p_command:   j.command,
    }).then(async (res) => {
      // Immediately unschedule after a brief moment
      await new Promise(r => setTimeout(r, 3000));
      await supabase.rpc("manage_cron_job", { p_action: "unschedule", p_job_name: `__manual_${j.name}_${Date.now()}` });
      return res;
    });
    // Alternative: just insert into ai_task_logs to trigger something
    await supabase.from("ai_task_logs").insert({ job_name: j.name, triggered_by: "manual", status: "running" });
    showToast("Job disparado manualmente");
    setSavingId(null);
    setTimeout(loadLogs, 2000);
  }

  /* ── Stats ── */
  const activeSquads   = squads.filter(s => s.status === "active").length;
  const activeJobs     = jobs.filter(j => j.enabled).length;
  const recentSuccess  = logs.filter(l => l.status === "success").length;
  const recentErrors   = logs.filter(l => l.status === "error").length;

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "squads", label: "Squads IA",   icon: Bot },
    { id: "cron",   label: "Cron Jobs",   icon: Clock },
    { id: "logs",   label: "Logs",        icon: ScrollText },
  ];

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter',sans-serif" }}>
      {/* Top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 10, borderBottom: `1px solid ${BORDER}`, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(8px)", padding: "10px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, display: "flex", alignItems: "center", gap: 5, fontSize: "0.65rem" }}>
          <ChevronLeft size={14} /> Voltar
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `${PURPLE}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bot size={14} style={{ color: PURPLE }} />
          </div>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#fff" }}>Parket Squad Skills</span>
          <span style={{ fontSize: "0.55rem", color: TEXT_DIM, marginLeft: 2 }}>— Gestão de Agentes IA & Cron</span>
        </div>
        {user && (
          <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{user.full_name}</span>
        )}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 20px 40px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Squads Ativos",    value: activeSquads,  color: GREEN,  icon: Radio },
            { label: "Jobs Agendados",   value: activeJobs,    color: BLUE,   icon: Clock },
            { label: "Execuções OK",     value: recentSuccess, color: GREEN,  icon: CheckCircle2 },
            { label: "Execuções com Erro", value: recentErrors, color: recentErrors > 0 ? RED : TEXT_DIM, icon: AlertTriangle },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                <Icon size={14} style={{ color: s.color, margin: "0 auto 6px" }} />
                <span style={{ fontSize: "1.4rem", fontWeight: 700, color: s.color, display: "block" }}>{s.value}</span>
                <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 2 }}>{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 4, width: "fit-content" }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, background: active ? CARD_BG : "transparent", border: active ? `1px solid ${BORDER}` : "1px solid transparent", color: active ? "#fff" : TEXT_DIM, fontSize: "0.7rem", cursor: "pointer", fontWeight: active ? 600 : 400, transition: "all 0.15s" }}>
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: `${RED}12`, border: `1px solid ${RED}30`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: "0.65rem", color: RED }}>
            {error}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 100, background: toast.type === "ok" ? `${GREEN}20` : `${RED}20`, border: `1px solid ${toast.type === "ok" ? GREEN : RED}40`, borderRadius: 10, padding: "10px 18px", color: toast.type === "ok" ? GREEN : RED, fontSize: "0.7rem", display: "flex", alignItems: "center", gap: 8 }}>
            {toast.type === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {toast.msg}
          </div>
        )}

        {/* ══════ TAB: SQUADS ══════ */}
        {tab === "squads" && (
          <div>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <h2 style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 600, margin: 0, flex: 1 }}>
                Squads IA Registrados
              </h2>
              {isAdmin && (
                <button onClick={() => { setShowSquadForm(true); setEditSquad(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: `${PURPLE}15`, border: `1px solid ${PURPLE}30`, borderRadius: 9, color: PURPLE, fontSize: "0.65rem", cursor: "pointer", fontWeight: 500 }}>
                  <Plus size={13} /> Novo Squad
                </button>
              )}
              <button onClick={() => { setLoadingData(true); loadSquads().finally(() => setLoadingData(false)); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 6 }}>
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Squad Form */}
            {(showSquadForm || editSquad) && (
              <SquadForm
                initial={editSquad ?? undefined}
                onSave={saveSquad}
                onCancel={() => { setShowSquadForm(false); setEditSquad(null); }}
                loading={savingId === "squad"}
              />
            )}

            {/* Grid */}
            {loadingData ? (
              <div style={{ textAlign: "center", padding: 40, color: TEXT_DIM, fontSize: "0.7rem" }}>Carregando…</div>
            ) : squads.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: TEXT_DIM, fontSize: "0.7rem" }}>Nenhum squad registrado.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {squads.map(s => (
                  <SquadCard key={s.id} squad={s} isAdmin={isAdmin}
                    onToggle={toggleSquad}
                    onEdit={(sq) => { setEditSquad(sq); setShowSquadForm(false); }}
                    onDelete={deleteSquad}
                  />
                ))}
              </div>
            )}

            {/* Info Box */}
            <div style={{ marginTop: 20, background: `${BLUE}08`, border: `1px solid ${BLUE}20`, borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <Info size={14} style={{ color: BLUE, flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: "0.68rem", fontWeight: 600, color: BLUE, marginBottom: 4 }}>Integração Parket Squad Skills</p>
                  <p style={{ fontSize: "0.62rem", color: TEXT_MED, lineHeight: 1.6 }}>
                    Os squads registrados aqui são os agentes da plataforma Parket Squad Skills que operam dentro do dashboard.
                    Cada agente pode receber webhooks do sistema (alertas, gates, handoffs) e enviar resultados de volta via API REST do Supabase.
                    Configure o <strong style={{ color: "#fff" }}>Webhook URL</strong> de cada squad para habilitar comunicação bidirecional.
                    Os cron jobs associados disparam automaticamente as tarefas agendadas para cada agente.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════ TAB: CRON JOBS ══════ */}
        {tab === "cron" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <h2 style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 600, margin: 0, flex: 1 }}>
                Cron Jobs Agendados
              </h2>
              {isAdmin && (
                <button onClick={() => { setShowCronForm(true); setEditCron(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`, borderRadius: 9, color: ACCENT, fontSize: "0.65rem", cursor: "pointer", fontWeight: 500 }}>
                  <Plus size={13} /> Novo Job
                </button>
              )}
              <button onClick={() => { setLoadingData(true); loadJobs().finally(() => setLoadingData(false)); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 6 }}>
                <RefreshCw size={14} />
              </button>
            </div>

            {(showCronForm || editCron) && (
              <CronJobForm
                initial={editCron ?? undefined}
                onSave={saveCronJob}
                onCancel={() => { setShowCronForm(false); setEditCron(null); }}
                loading={savingId === "cron"}
              />
            )}

            {/* Category filter */}
            {!loadingData && jobs.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => {
                  const count = jobs.filter(j => j.category === k).length;
                  if (!count) return null;
                  return (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, background: `${CATEGORY_COLORS[k]}12`, border: `1px solid ${CATEGORY_COLORS[k]}30`, fontSize: "0.55rem", color: CATEGORY_COLORS[k] }}>
                      {v} <span style={{ opacity: 0.7 }}>({count})</span>
                    </div>
                  );
                })}
              </div>
            )}

            {loadingData ? (
              <div style={{ textAlign: "center", padding: 40, color: TEXT_DIM, fontSize: "0.7rem" }}>Carregando…</div>
            ) : jobs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: TEXT_DIM, fontSize: "0.7rem" }}>Nenhum job configurado.</div>
            ) : (
              <div>
                {Object.entries(CATEGORY_LABELS).map(([cat, catLabel]) => {
                  const catJobs = jobs.filter(j => j.category === cat);
                  if (!catJobs.length) return null;
                  return (
                    <div key={cat} style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: CATEGORY_COLORS[cat] }} />
                        <span style={{ fontSize: "0.6rem", fontWeight: 600, color: CATEGORY_COLORS[cat], textTransform: "uppercase", letterSpacing: "0.1em" }}>{catLabel}</span>
                        <div style={{ flex: 1, height: 1, background: BORDER }} />
                      </div>
                      {catJobs.map(j => (
                        <CronJobRow key={j.id} job={j} isAdmin={isAdmin}
                          onToggle={toggleCronJob}
                          onEdit={(jb) => { setEditCron(jb); setShowCronForm(false); }}
                          onDelete={deleteCronJob}
                          onRun={runCronJobNow}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════ TAB: LOGS ══════ */}
        {tab === "logs" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <h2 style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 600, margin: 0, flex: 1 }}>
                Log de Execuções
              </h2>
              <button onClick={() => { setLoadingData(true); loadLogs().finally(() => setLoadingData(false)); }}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, cursor: "pointer", color: TEXT_DIM, padding: "6px 10px", fontSize: "0.6rem" }}>
                <RefreshCw size={12} /> Atualizar
              </button>
            </div>

            {loadingData ? (
              <div style={{ textAlign: "center", padding: 40, color: TEXT_DIM, fontSize: "0.7rem" }}>Carregando…</div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: TEXT_DIM, fontSize: "0.7rem" }}>Nenhum log encontrado.</div>
            ) : (
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
                {/* Table header */}
                <div style={{ display: "grid", gridTemplateColumns: "160px 120px 100px 80px 80px 1fr", gap: 0, padding: "10px 16px", borderBottom: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.02)" }}>
                  {["Início", "Job", "Disparo", "Duração", "Status", "Resultado"].map(h => (
                    <span key={h} style={{ fontSize: "0.5rem", color: TEXT_DIM, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
                  ))}
                </div>
                <div style={{ maxHeight: 520, overflowY: "auto" }}>
                  {logs.map(l => {
                    const sc = STATUS_COLOR[l.status] ?? TEXT_DIM;
                    return (
                      <div key={l.id} style={{ display: "grid", gridTemplateColumns: "160px 120px 100px 80px 80px 1fr", gap: 0, padding: "9px 16px", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
                        <span style={{ fontSize: "0.58rem", color: TEXT_MED }}>{fmtDate(l.started_at)}</span>
                        <span style={{ fontSize: "0.6rem", color: "#fff", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.job_name}</span>
                        <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{l.triggered_by}</span>
                        <span style={{ fontSize: "0.58rem", color: TEXT_MED }}>{fmtMs(l.duration_ms)}</span>
                        <span style={{ fontSize: "0.55rem", fontWeight: 600, color: sc }}>{l.status.toUpperCase()}</span>
                        <div>
                          {l.error_message ? (
                            <span style={{ fontSize: "0.55rem", color: RED }}>{l.error_message}</span>
                          ) : l.output ? (
                            <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>
                              {Object.entries(l.output).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{l.records_affected > 0 ? `${l.records_affected} registros` : "—"}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
