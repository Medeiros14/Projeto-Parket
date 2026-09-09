/* ═══════════════════════════════════════════════════════════════
   SLA RULES PANEL — Painel de Regras de SLA por Departamento
   Admins podem editar regras inline; viewers só visualizam.
   ═══════════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  ShieldCheck, AlertTriangle, Info, Clock, RefreshCw,
  ChevronDown, ChevronUp, Filter, Zap, Activity,
  Edit3, Save, X, ToggleLeft, ToggleRight, Plus, Trash2,
} from "lucide-react";

/* ─── Tokens ─── */
const CARD_BG  = "rgba(255,255,255,0.02)";
const BORDER   = "rgba(255,255,255,0.06)";
const GREEN    = "#10B981";
const RED      = "#EF4444";
const YELLOW   = "#F59E0B";
const BLUE     = "#3B82F6";
const ACCENT   = "#D4A853";
const TEXT_DIM = "rgba(255,255,255,0.35)";
const TEXT_MED = "rgba(255,255,255,0.6)";

/* ─── Types ─── */
export interface SlaRule {
  id: string;
  dept_id: string;
  rule_key: string;
  name: string;
  description: string;
  severity: "critical" | "warning" | "info";
  threshold_value: number;
  threshold_unit: "hours" | "days";
  category: "tempo" | "progresso" | "handoff" | "financeiro" | "processo" | "qualidade";
  active: boolean;
  current_violations: number;
  total_violations_ever: number;
}

type EditDraft = Pick<SlaRule, "name" | "description" | "severity" | "threshold_value" | "threshold_unit" | "category" | "active">;

/* ─── Constants ─── */
const DEPT_LABELS: Record<string, string> = {
  global: "Global", obras: "Obras", produtividade: "Produtividade / PMO",
  comercial: "Comercial", projetos: "Projetos", compras: "Compras",
  producao: "Produção", logistica: "Logística", financeiro: "Financeiro",
  atendimento: "Atendimento", fiscal: "Fiscal", marketing: "Marketing",
  rh: "RH", orcamento: "Orçamento",
};

const DEPT_ORDER = ["global","obras","produtividade","comercial","projetos","compras",
  "producao","logistica","financeiro","atendimento","fiscal","marketing","rh","orcamento"];

const CAT_LABELS: Record<string, string> = {
  tempo:"Tempo", progresso:"Progresso", handoff:"Handoff",
  financeiro:"Financeiro", processo:"Processo", qualidade:"Qualidade",
};

const CAT_COLORS: Record<string, string> = {
  tempo:BLUE, progresso:YELLOW, handoff:"#8B5CF6",
  financeiro:GREEN, processo:ACCENT, qualidade:"#14B8A6",
};

const SEV_OPTIONS  = ["critical","warning","info"] as const;
const UNIT_OPTIONS = ["hours","days"] as const;
const CAT_OPTIONS  = ["tempo","progresso","handoff","financeiro","processo","qualidade"] as const;

/* ─── Small helpers ─── */
function SevIcon({ sev }: { sev: string }) {
  if (sev === "critical") return <AlertTriangle size={12} style={{ color: RED }} />;
  if (sev === "warning")  return <AlertTriangle size={12} style={{ color: YELLOW }} />;
  return <Info size={12} style={{ color: BLUE }} />;
}

function SevBadge({ sev }: { sev: string }) {
  const [color, bg, label] =
    sev === "critical" ? [RED,    "rgba(239,68,68,0.12)",   "Crítico"] :
    sev === "warning"  ? [YELLOW, "rgba(245,158,11,0.12)",  "Atenção"] :
                         [BLUE,   "rgba(59,130,246,0.12)",  "Info"];
  return (
    <span className="rounded-full px-2 py-0.5"
      style={{ fontSize: "0.45rem", fontWeight: 700, color, background: bg }}>
      {label}
    </span>
  );
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    fontSize: "0.65rem", background: "rgba(255,255,255,0.04)",
    border: `1px solid ${BORDER}`, borderRadius: 6, color: "white",
    padding: "4px 8px", outline: "none", width: "100%", ...extra,
  };
}

/* ═══════════════════════════════════════════════════════════════
   RULE ROW — com edição inline para admins
   ═══════════════════════════════════════════════════════════════ */
function RuleRow({
  rule, isAdmin, onSave, onDelete,
}: {
  rule: SlaRule;
  isAdmin: boolean;
  onSave: (id: string, draft: EditDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [draft,   setDraft]   = useState<EditDraft>({
    name: rule.name, description: rule.description,
    severity: rule.severity, threshold_value: rule.threshold_value,
    threshold_unit: rule.threshold_unit, category: rule.category,
    active: rule.active,
  });

  const hasViolation   = rule.current_violations > 0;
  const thresholdLabel = rule.threshold_unit === "hours"
    ? `${rule.threshold_value}h`
    : rule.threshold_value === 0 ? "Imediato" : `${rule.threshold_value}d`;

  function patch<K extends keyof EditDraft>(key: K, val: EditDraft[K]) {
    setDraft(d => ({ ...d, [key]: val }));
  }

  async function save() {
    setSaving(true);
    await onSave(rule.id, draft);
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setDraft({
      name: rule.name, description: rule.description,
      severity: rule.severity, threshold_value: rule.threshold_value,
      threshold_unit: rule.threshold_unit, category: rule.category,
      active: rule.active,
    });
    setEditing(false);
  }

  /* ── View mode ── */
  if (!editing) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group"
        style={{
          background: !rule.active ? "rgba(255,255,255,0.01)" :
            hasViolation
              ? rule.severity === "critical" ? "rgba(239,68,68,0.05)" : "rgba(245,158,11,0.04)"
              : CARD_BG,
          border: !rule.active ? `1px dashed ${BORDER}` :
            hasViolation
              ? rule.severity === "critical" ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(245,158,11,0.15)"
              : `1px solid ${BORDER}`,
          opacity: rule.active ? 1 : 0.45,
        }}
      >
        <SevIcon sev={rule.severity} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: "0.7rem", color: "white", fontWeight: hasViolation ? 600 : 400 }}>
              {rule.name}
            </span>
            <SevBadge sev={rule.severity} />
            <span className="rounded px-1.5 py-0.5"
              style={{ fontSize: "0.42rem", color: CAT_COLORS[rule.category], background: `${CAT_COLORS[rule.category]}15` }}>
              {CAT_LABELS[rule.category]}
            </span>
            {!rule.active && (
              <span className="rounded px-1.5 py-0.5"
                style={{ fontSize: "0.42rem", color: TEXT_DIM, background: "rgba(255,255,255,0.05)" }}>
                Inativa
              </span>
            )}
          </div>
          <p style={{ fontSize: "0.58rem", color: TEXT_DIM, marginTop: 2, lineHeight: 1.4 }}>
            {rule.description}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1" title="Threshold SLA">
            <Clock size={10} style={{ color: TEXT_DIM }} />
            <span style={{ fontSize: "0.55rem", color: TEXT_MED }}>{thresholdLabel}</span>
          </div>

          {hasViolation ? (
            <div className="flex items-center gap-1 rounded-lg px-2 py-1"
              style={{
                background: rule.severity === "critical" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.12)",
                border: `1px solid ${rule.severity === "critical" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.2)"}`,
              }}>
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: rule.severity === "critical" ? RED : YELLOW }}>
                {rule.current_violations}
              </span>
              <span style={{ fontSize: "0.45rem", color: TEXT_DIM }}>violações</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-lg px-2 py-1"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <ShieldCheck size={10} style={{ color: GREEN }} />
              <span style={{ fontSize: "0.45rem", color: GREEN }}>OK</span>
            </div>
          )}

          {/* Admin actions */}
          {isAdmin && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditing(true)} title="Editar regra"
                style={{ background: "none", border: "none", cursor: "pointer", color: ACCENT, display: "flex", padding: 4 }}>
                <Edit3 size={12} />
              </button>
              <button
                onClick={() => onSave(rule.id, { ...draft, active: !rule.active })}
                title={rule.active ? "Desativar regra" : "Ativar regra"}
                style={{ background: "none", border: "none", cursor: "pointer", color: rule.active ? TEXT_DIM : GREEN, display: "flex", padding: 4 }}>
                {rule.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Edit mode ── */
  return (
    <div className="rounded-xl p-4 space-y-3"
      style={{ background: "rgba(212,168,83,0.04)", border: "1px solid rgba(212,168,83,0.2)" }}>

      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: "0.55rem", color: ACCENT, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Editando: {rule.rule_key}
        </span>
        <button onClick={cancel} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM }}>
          <X size={14} />
        </button>
      </div>

      {/* Row 1: name + description */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>NOME DA REGRA</label>
          <input value={draft.name} onChange={e => patch("name", e.target.value)} style={inputStyle()} />
        </div>
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>DESCRIÇÃO</label>
          <input value={draft.description} onChange={e => patch("description", e.target.value)} style={inputStyle()} />
        </div>
      </div>

      {/* Row 2: severity + category + threshold */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>SEVERIDADE</label>
          <select value={draft.severity} onChange={e => patch("severity", e.target.value as any)}
            style={inputStyle()}>
            {SEV_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>CATEGORIA</label>
          <select value={draft.category} onChange={e => patch("category", e.target.value as any)}
            style={inputStyle()}>
            {CAT_OPTIONS.map(o => <option key={o} value={o}>{CAT_LABELS[o]}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>LIMITE</label>
          <input type="number" min={0} value={draft.threshold_value}
            onChange={e => patch("threshold_value", parseInt(e.target.value) || 0)}
            style={inputStyle()} />
        </div>
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>UNIDADE</label>
          <select value={draft.threshold_unit} onChange={e => patch("threshold_unit", e.target.value as any)}
            style={inputStyle()}>
            {UNIT_OPTIONS.map(o => <option key={o} value={o}>{o === "hours" ? "Horas" : "Dias"}</option>)}
          </select>
        </div>
      </div>

      {/* Row 3: active toggle + actions */}
      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <button onClick={() => patch("active", !draft.active)}
            style={{ background: "none", border: "none", cursor: "pointer", color: draft.active ? GREEN : TEXT_DIM, display: "flex" }}>
            {draft.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          </button>
          <span style={{ fontSize: "0.6rem", color: draft.active ? GREEN : TEXT_DIM }}>
            {draft.active ? "Regra ativa" : "Regra inativa"}
          </span>
        </label>

        <div className="flex items-center gap-2">
          <button onClick={() => onDelete(rule.id)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
            style={{ fontSize: "0.6rem", background: "rgba(239,68,68,0.1)", color: RED, border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
            <Trash2 size={11} /> Excluir
          </button>
          <button onClick={cancel}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
            style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.04)", color: TEXT_DIM, border: `1px solid ${BORDER}`, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
            style={{ fontSize: "0.6rem", background: "rgba(212,168,83,0.15)", color: ACCENT, border: "1px solid rgba(212,168,83,0.3)", cursor: saving ? "wait" : "pointer" }}>
            {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DEPT GROUP
   ═══════════════════════════════════════════════════════════════ */
function DeptGroup({
  dept, rules, defaultOpen, isAdmin, onSave, onDelete,
}: {
  dept: string; rules: SlaRule[]; defaultOpen?: boolean;
  isAdmin: boolean;
  onSave: (id: string, draft: EditDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const active     = rules.filter(r => r.active);
  const violations = active.reduce((s, r) => s + r.current_violations, 0);
  const criticals  = active.filter(r => r.severity === "critical" && r.current_violations > 0).length;
  const compliance = active.length > 0
    ? Math.round((active.filter(r => r.current_violations === 0).length / active.length) * 100)
    : 100;
  const complianceColor = compliance >= 90 ? GREEN : compliance >= 70 ? YELLOW : RED;

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${violations > 0 ? "rgba(255,255,255,0.1)" : BORDER}` }}>

      <button className="w-full flex items-center gap-3 px-4 py-3 transition-all hover:bg-white/5"
        style={{ background: open ? "rgba(255,255,255,0.03)" : CARD_BG }}
        onClick={() => setOpen(v => !v)}>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "white" }}>
            {DEPT_LABELS[dept] ?? dept}
          </span>
          <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{rules.length} regras</span>
          {criticals > 0 && (
            <span className="rounded-full px-2 py-0.5"
              style={{ fontSize: "0.45rem", fontWeight: 700, color: RED, background: "rgba(239,68,68,0.15)" }}>
              {criticals} crítico{criticals > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${compliance}%`, background: complianceColor }} />
          </div>
          <span style={{ fontSize: "0.55rem", fontWeight: 600, color: complianceColor, width: 32 }}>
            {compliance}%
          </span>
        </div>

        {violations > 0 && (
          <span className="rounded-lg px-2 py-0.5"
            style={{ fontSize: "0.55rem", fontWeight: 700, color: RED, background: "rgba(239,68,68,0.12)" }}>
            {violations}
          </span>
        )}
        {open ? <ChevronUp size={14} style={{ color: TEXT_DIM }} /> : <ChevronDown size={14} style={{ color: TEXT_DIM }} />}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-1.5"
          style={{ background: "rgba(255,255,255,0.01)" }}>
          {rules.map(r => (
            <RuleRow key={r.id} rule={r} isAdmin={isAdmin} onSave={onSave} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NEW RULE FORM — somente admins
   ═══════════════════════════════════════════════════════════════ */
function NewRuleForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    dept_id: "global", rule_key: "", name: "", description: "",
    severity: "warning" as const, threshold_value: 7, threshold_unit: "days" as const,
    category: "tempo" as const, active: true,
  });

  function patch<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function create() {
    if (!form.rule_key || !form.name) return;
    setSaving(true);
    await supabase.from("sla_rules").insert({ ...form });
    setSaving(false);
    onCreated();
  }

  return (
    <div className="rounded-xl p-4 space-y-3 mt-2"
      style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.2)" }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "0.55rem", color: GREEN, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Nova Regra de SLA
        </span>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM }}>
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>DEPARTAMENTO</label>
          <select value={form.dept_id} onChange={e => patch("dept_id", e.target.value)} style={inputStyle()}>
            {DEPT_ORDER.map(d => <option key={d} value={d}>{DEPT_LABELS[d] ?? d}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>CHAVE ÚNICA (rule_key)</label>
          <input value={form.rule_key} onChange={e => patch("rule_key", e.target.value.toLowerCase().replace(/\s+/g,"_"))}
            placeholder="ex: proposta_sem_resposta" style={inputStyle()} />
        </div>
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>NOME</label>
          <input value={form.name} onChange={e => patch("name", e.target.value)} placeholder="Nome da regra" style={inputStyle()} />
        </div>
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>DESCRIÇÃO</label>
          <input value={form.description} onChange={e => patch("description", e.target.value)} placeholder="Condição que dispara o alerta" style={inputStyle()} />
        </div>
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>SEVERIDADE</label>
          <select value={form.severity} onChange={e => patch("severity", e.target.value as any)} style={inputStyle()}>
            {SEV_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>CATEGORIA</label>
          <select value={form.category} onChange={e => patch("category", e.target.value as any)} style={inputStyle()}>
            {CAT_OPTIONS.map(o => <option key={o} value={o}>{CAT_LABELS[o]}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>LIMITE</label>
          <input type="number" min={0} value={form.threshold_value}
            onChange={e => patch("threshold_value", parseInt(e.target.value) || 0)} style={inputStyle()} />
        </div>
        <div>
          <label style={{ fontSize: "0.48rem", color: TEXT_DIM, display: "block", marginBottom: 3 }}>UNIDADE</label>
          <select value={form.threshold_unit} onChange={e => patch("threshold_unit", e.target.value as any)} style={inputStyle()}>
            <option value="hours">Horas</option>
            <option value="days">Dias</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel}
          className="rounded-lg px-3 py-1.5"
          style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.04)", color: TEXT_DIM, border: `1px solid ${BORDER}`, cursor: "pointer" }}>
          Cancelar
        </button>
        <button onClick={create} disabled={saving || !form.rule_key || !form.name}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ fontSize: "0.6rem", background: "rgba(16,185,129,0.15)", color: GREEN, border: "1px solid rgba(16,185,129,0.3)", cursor: "pointer", opacity: (!form.rule_key || !form.name) ? 0.5 : 1 }}>
          {saving ? <RefreshCw size={11} className="animate-spin" /> : <Plus size={11} />}
          {saving ? "Criando…" : "Criar Regra"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
interface SlaPanelProps {
  deptFilter?: string;
  compact?: boolean;
}

export function SlaRulesPanel({ deptFilter, compact = false }: SlaPanelProps) {
  const { isAdmin } = useAuth();
  const [rules, setRules]       = useState<SlaRule[]>([]);
  const [loading, setLoading]   = useState(true);
  const [catFilter, setCatFilter] = useState<string>("all");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showNewForm, setShowNewForm] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sla_violations_summary")
      .select("*")
      .order("current_violations", { ascending: false });
    if (!error && data) {
      setRules(data as SlaRule[]);
      setLastRefresh(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  /* Save edited rule */
  const handleSave = useCallback(async (id: string, draft: EditDraft) => {
    const { error } = await supabase
      .from("sla_rules")
      .update({
        name: draft.name, description: draft.description,
        severity: draft.severity, threshold_value: draft.threshold_value,
        threshold_unit: draft.threshold_unit, category: draft.category,
        active: draft.active,
      })
      .eq("id", id);
    if (!error) {
      setRules(prev => prev.map(r =>
        r.id === id ? { ...r, ...draft } : r
      ));
    }
  }, []);

  /* Delete rule */
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Excluir esta regra de SLA permanentemente?")) return;
    const { error } = await supabase.from("sla_rules").delete().eq("id", id);
    if (!error) setRules(prev => prev.filter(r => r.id !== id));
  }, []);

  /* Filter */
  const filtered = rules.filter(r => {
    const deptOk = !deptFilter || r.dept_id === deptFilter || r.dept_id === "global";
    const catOk  = catFilter === "all" || r.category === catFilter;
    return deptOk && catOk;
  });

  const deptOrder = deptFilter ? [deptFilter, "global"] : DEPT_ORDER;

  const byDept: Record<string, SlaRule[]> = {};
  for (const r of filtered) (byDept[r.dept_id] ??= []).push(r);

  /* Stats */
  const activeRules     = filtered.filter(r => r.active);
  const totalViolations = activeRules.reduce((s, r) => s + r.current_violations, 0);
  const criticalViol    = activeRules.filter(r => r.severity === "critical" && r.current_violations > 0).length;
  const warningViol     = activeRules.filter(r => r.severity === "warning"  && r.current_violations > 0).length;
  const compliance      = activeRules.length > 0
    ? Math.round((activeRules.filter(r => r.current_violations === 0).length / activeRules.length) * 100)
    : 100;
  const complianceColor = compliance >= 90 ? GREEN : compliance >= 70 ? YELLOW : RED;
  const categories      = ["all", ...Array.from(new Set(filtered.map(r => r.category)))];

  return (
    <div className="space-y-4">

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Conformidade SLA", value: `${compliance}%`, color: complianceColor, icon: ShieldCheck, sub: `${activeRules.length} regras ativas` },
          { label: "Violações Ativas",  value: totalViolations,  color: totalViolations > 0 ? RED : GREEN,    icon: AlertTriangle, sub: totalViolations === 0 ? "Tudo no prazo" : "Requerem atenção" },
          { label: "Críticos",          value: criticalViol,     color: criticalViol > 0 ? RED : GREEN,        icon: Zap,           sub: "Regras críticas violadas" },
          { label: "Avisos",            value: warningViol,      color: warningViol > 0 ? YELLOW : GREEN,      icon: Activity,      sub: "Regras de atenção" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl p-3.5 text-center"
              style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <Icon size={14} style={{ color: s.color, margin: "0 auto 6px" }} />
              <span style={{ fontSize: "1.3rem", fontWeight: 700, color: s.color, display: "block" }}>{s.value}</span>
              <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginTop: 1 }}>{s.label}</p>
              <p style={{ fontSize: "0.45rem", color: TEXT_DIM, opacity: 0.7 }}>{s.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ── Compliance bar + refresh + admin badge ── */}
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "0.55rem", color: TEXT_DIM, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Conformidade Global
            </span>
            {isAdmin && (
              <span className="rounded-full px-2 py-0.5"
                style={{ fontSize: "0.42rem", fontWeight: 700, color: ACCENT, background: "rgba(212,168,83,0.12)", border: "1px solid rgba(212,168,83,0.2)" }}>
                Modo Edição Ativo
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>
              {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <button onClick={loadRules} disabled={loading}
              style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, display: "flex" }}>
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        <div className="w-full h-3 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${compliance}%`, background: `linear-gradient(90deg, ${complianceColor}, ${complianceColor}aa)` }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>0%</span>
          <span style={{ fontSize: "0.6rem", fontWeight: 700, color: complianceColor }}>{compliance}%</span>
          <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>100%</span>
        </div>
      </div>

      {/* ── Toolbar: filter + new rule ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={12} style={{ color: TEXT_DIM }} />
          {categories.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              className="rounded-full px-2.5 py-1 transition-all"
              style={{
                fontSize: "0.5rem", fontWeight: 600,
                background: catFilter === cat ? `${CAT_COLORS[cat] ?? ACCENT}20` : "rgba(255,255,255,0.03)",
                color:      catFilter === cat ? (CAT_COLORS[cat] ?? ACCENT) : TEXT_DIM,
                border:     catFilter === cat ? `1px solid ${CAT_COLORS[cat] ?? ACCENT}40` : `1px solid ${BORDER}`,
              }}>
              {cat === "all" ? "Todas" : CAT_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>

        {isAdmin && !showNewForm && (
          <button onClick={() => setShowNewForm(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
            style={{ fontSize: "0.6rem", background: "rgba(16,185,129,0.1)", color: GREEN, border: "1px solid rgba(16,185,129,0.25)", cursor: "pointer" }}>
            <Plus size={11} /> Nova Regra
          </button>
        )}
      </div>

      {/* ── New rule form ── */}
      {showNewForm && (
        <NewRuleForm onCreated={() => { setShowNewForm(false); loadRules(); }} onCancel={() => setShowNewForm(false)} />
      )}

      {/* ── Rules by dept ── */}
      {loading ? (
        <div className="text-center py-8">
          <RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: ACCENT }} />
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Carregando regras...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deptOrder
            .filter(d => byDept[d]?.length)
            .map(dept => (
              <DeptGroup key={dept} dept={dept} rules={byDept[dept]}
                defaultOpen={compact ? dept === deptFilter : (byDept[dept]?.some(r => r.current_violations > 0) ?? false)}
                isAdmin={isAdmin} onSave={handleSave} onDelete={handleDelete} />
            ))}
          {Object.keys(byDept).length === 0 && (
            <div className="text-center py-10 rounded-xl" style={{ border: `1px dashed ${BORDER}` }}>
              <ShieldCheck size={24} style={{ color: GREEN, margin: "0 auto 8px" }} />
              <p style={{ fontSize: "0.75rem", color: GREEN, fontWeight: 600 }}>Todos os SLAs em conformidade</p>
              <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 4 }}>Nenhuma violação detectada</p>
            </div>
          )}
        </div>
      )}

      {!compact && (
        <p style={{ fontSize: "0.5rem", color: TEXT_DIM, textAlign: "center" }}>
          <Clock size={9} style={{ display: "inline", marginRight: 4 }} />
          Alertas gerados via pg_cron — a cada 4h e diariamente às 07h UTC
          {isAdmin && " · Admins podem editar, ativar/desativar e criar novas regras"}
        </p>
      )}
    </div>
  );
}
