import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ChevronLeft, ChevronUp, ChevronDown, ArrowRight, ArrowRightLeft, Layers, Zap, AlertTriangle, Info, CheckCircle2, Send } from "lucide-react";
import { useHandoffs, Handoff } from "../hooks/useHandoffs";
import { useAlertas } from "../hooks/useAlertas";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

const BG = "#0A0A0A";
const CARD_BG = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.06)";
const ACCENT = "#D4A853";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MED = "rgba(255,255,255,0.6)";
const GREEN = "#10B981";
const YELLOW = "#F59E0B";
const RED = "#EF4444";
const GOLD = "#D4A853";

/* ─── Notas / Observações helpers ─── */
interface Note {
  id: string;
  author: string;
  text: string;
  ts: string;
  system?: boolean;
}

function parseNotes(obs: string | undefined | null): Note[] {
  if (!obs) return [];
  try {
    const parsed = JSON.parse(obs);
    if (Array.isArray(parsed)) return parsed;
    if (parsed?.notes && Array.isArray(parsed.notes)) return parsed.notes;
  } catch { /* ignore */ }
  return [{ id: "legacy", author: "Sistema", text: obs, ts: new Date().toISOString(), system: true }];
}

async function saveNotes(handoffId: string, notes: Note[]) {
  await supabase.from("handoffs").update({ observacao: JSON.stringify(notes) }).eq("id", handoffId);
}

/* ─── HandoffCard (expandable) ─── */
function HandoffCard({ h, refetch, aceitarHandoff, updateStatus }: {
  h: Handoff;
  refetch: () => void;
  aceitarHandoff: (id: string, por?: string) => Promise<void>;
  updateStatus: (id: string, status: Handoff["status"], obs?: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const userName = user?.full_name ?? user?.email ?? "Usuário";
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState<Note[]>(() => parseNotes(h.observacao));
  const [noteText, setNoteText] = useState("");
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const statusColor = h.status === "aceito" ? GREEN : h.status === "vencido" ? RED : h.status === "cancelado" ? TEXT_DIM : YELLOW;
  const statusLabel = h.status === "aceito" ? "Aceito" : h.status === "vencido" ? "Vencido" : h.status === "cancelado" ? "Cancelado" : "Pendente";

  async function addNote(text: string, system = false) {
    const note: Note = {
      id: crypto.randomUUID(),
      author: system ? "Sistema" : userName,
      text,
      ts: new Date().toISOString(),
      system,
    };
    const updated = [...notes, note];
    setNotes(updated);
    await saveNotes(h.id, updated);
  }

  async function handleSendNote() {
    if (!noteText.trim()) return;
    setSending(true);
    await addNote(noteText.trim());
    setNoteText("");
    setSending(false);
  }

  async function handleAccept() {
    setActionLoading("accept");
    try {
      await aceitarHandoff(h.id, userName);
      await addNote(`\u2705 Recebimento confirmado por ${userName}`, true);
      refetch();
    } catch (err) {
      console.error("handleAccept error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDevolver() {
    setActionLoading("devolver");
    try {
      await updateStatus(h.id, "cancelado");
      await addNote(`\u21A9\uFE0F Devolvido por ${userName}`, true);
      refetch();
    } catch (err) {
      console.error("handleDevolver error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleConcluir() {
    setActionLoading("concluir");
    try {
      await aceitarHandoff(h.id, userName);
      await addNote(`\u2713 Conclu\u00eddo por ${userName}`, true);
      refetch();
    } catch (err) {
      console.error("handleConcluir error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
      {/* Header row (clickable) */}
      <div onClick={() => setExpanded(v => !v)} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 9, height: 9, borderRadius: "50%", background: statusColor, marginTop: 4, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: "0.58rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: `${statusColor}18`, color: statusColor }}>{statusLabel}</span>
            <span style={{ fontSize: "0.68rem", color: TEXT_MED }}>{h.dept_from}</span>
            <ArrowRight size={11} style={{ color: ACCENT }} />
            <span style={{ fontSize: "0.68rem", color: "white", fontWeight: 600 }}>{h.dept_to}</span>
            {notes.length > 0 && <span style={{ fontSize: "0.52rem", color: ACCENT }}>{"\uD83D\uDCAC"} {notes.length}</span>}
            <span style={{ marginLeft: "auto", fontSize: "0.55rem", color: TEXT_DIM }}>{h.obra}</span>
          </div>
          <p style={{ fontSize: "0.7rem", color: TEXT_MED, margin: 0 }}>{h.item}</p>
          <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            {h.responsavel_from && <span style={{ fontSize: "0.52rem", color: TEXT_DIM }}>Enviado: {h.responsavel_from}</span>}
            {h.responsavel_to && <span style={{ fontSize: "0.52rem", color: TEXT_DIM }}>Para: {h.responsavel_to}</span>}
            {h.created_at && <span style={{ fontSize: "0.52rem", color: TEXT_DIM }}>{new Date(h.created_at).toLocaleDateString("pt-BR")}</span>}
            <span style={{ fontSize: "0.52rem", color: TEXT_DIM }}>SLA: {h.sla_hours}h</span>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} style={{ color: TEXT_DIM, flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: TEXT_DIM, flexShrink: 0 }} />}
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Action buttons (only for pendente) */}
          {h.status === "pendente" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={handleAccept} disabled={actionLoading === "accept"}
                style={{ fontSize: "0.62rem", fontWeight: 700, padding: "6px 14px", borderRadius: 7, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: GREEN, cursor: "pointer" }}>
                {actionLoading === "accept" ? "\u2026" : "\u2713 Confirmar Recebimento"}
              </button>
              <button onClick={handleDevolver} disabled={actionLoading === "devolver"}
                style={{ fontSize: "0.62rem", fontWeight: 700, padding: "6px 14px", borderRadius: 7, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: RED, cursor: "pointer" }}>
                {actionLoading === "devolver" ? "\u2026" : "\u21A9 Devolver"}
              </button>
              <button onClick={handleConcluir} disabled={actionLoading === "concluir"}
                style={{ fontSize: "0.62rem", fontWeight: 700, padding: "6px 14px", borderRadius: 7, background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.25)", color: GOLD, cursor: "pointer" }}>
                {actionLoading === "concluir" ? "\u2026" : "\u2713 Marcar Conclu\u00eddo"}
              </button>
            </div>
          )}

          {/* Aceito info */}
          {h.aceito_em && (
            <p style={{ fontSize: "0.62rem", color: GREEN, margin: 0 }}>
              {"\u2713"} Aceito por {h.aceito_por ?? "\u2014"} em {new Date(h.aceito_em).toLocaleString("pt-BR")}
            </p>
          )}

          {/* Conversation / Notes */}
          <div>
            <p style={{ fontSize: "0.48rem", fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
              Conversa & Hist\u00f3rico
            </p>
            {notes.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, maxHeight: 240, overflowY: "auto" }}>
                {notes.map(n => (
                  <div key={n.id} style={{ background: n.system ? "rgba(212,168,83,0.06)" : "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px", borderLeft: n.system ? `2px solid ${GOLD}40` : "2px solid transparent" }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 3, alignItems: "center" }}>
                      <span style={{ fontSize: "0.55rem", fontWeight: 700, color: n.system ? GOLD : ACCENT }}>{n.author}</span>
                      <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{new Date(n.ts).toLocaleString("pt-BR")}</span>
                    </div>
                    <p style={{ fontSize: "0.65rem", color: n.system ? TEXT_MED : "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.5 }}>{n.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.62rem", color: TEXT_DIM, marginBottom: 10 }}>Nenhuma nota ainda.</p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendNote(); } }}
                placeholder="Escreva uma nota ou atualiza\u00e7\u00e3o\u2026 (Enter para enviar)"
                style={{ flex: 1, fontSize: "0.65rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 12px", color: "white", outline: "none" }}
              />
              <button onClick={handleSendNote} disabled={sending || !noteText.trim()}
                style={{ padding: "7px 14px", borderRadius: 8, background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.25)", color: ACCENT, cursor: "pointer", display: "flex", alignItems: "center" }}>
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HandoffsGlobalView() {
  const { handoffs, counts, flow, refetch, aceitarHandoff, updateStatus } = useHandoffs();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const deptNames = [...new Set(handoffs.flatMap(h => [h.dept_from, h.dept_to]))].sort();
  const filtered = handoffs.filter(h => {
    if (statusFilter !== "all" && h.status !== statusFilter) return false;
    if (deptFilter !== "all" && h.dept_from !== deptFilter && h.dept_to !== deptFilter) return false;
    if (search && !h.item?.toLowerCase().includes(search.toLowerCase())
      && !h.obra?.toLowerCase().includes(search.toLowerCase())
      && !h.dept_from?.toLowerCase().includes(search.toLowerCase())
      && !h.dept_to?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pendentes = filtered.filter(h => h.status === "pendente");
  const historico = filtered.filter(h => h.status === "aceito" || h.status === "cancelado" || h.status === "vencido");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "white", margin: 0 }}>Centro de Handoffs Global</h2>
        <p style={{ fontSize: "0.7rem", color: TEXT_DIM, marginTop: 4 }}>Gest\u00e3o completa de todos os handoffs entre departamentos</p>
      </div>

      {/* Stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total", value: counts.total, color: ACCENT },
          { label: "Pendentes", value: counts.pendente, color: YELLOW },
          { label: "Aceitos", value: counts.aceito, color: GREEN },
          { label: "Vencidos", value: counts.vencido, color: RED },
        ].map(s => (
          <div key={s.label} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px", textAlign: "center" }}>
            <span style={{ fontSize: "1.8rem", fontWeight: 700, color: s.color }}>{s.value}</span>
            <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Flow between departments */}
      {flow.length > 0 && (
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px" }}>
          <p style={{ fontSize: "0.5rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: ACCENT, marginBottom: 12 }}>
            Fluxo entre Departamentos
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {flow.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 8, padding: "6px 12px", background: f.tem_vencido ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${f.tem_vencido ? "rgba(239,68,68,0.15)" : BORDER}` }}>
                <span style={{ fontSize: "0.65rem", color: TEXT_MED }}>{f.dept_from}</span>
                <ArrowRight size={10} style={{ color: f.tem_vencido ? RED : ACCENT }} />
                <span style={{ fontSize: "0.65rem", color: "white", fontWeight: 600 }}>{f.dept_to}</span>
                <span style={{ fontSize: "0.52rem", fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: "rgba(255,255,255,0.08)", color: TEXT_MED }}>{f.total}</span>
                {f.pendentes > 0 && <span style={{ fontSize: "0.5rem", color: YELLOW }}>{"\u26A0"} {f.pendentes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por item, obra, departamento\u2026"
          style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 12px", color: "white", outline: "none", minWidth: 220 }}
        />
        {(["all", "pendente", "aceito", "cancelado", "vencido"] as const).map(f => {
          const fc = f === "pendente" ? YELLOW : f === "aceito" ? GREEN : f === "cancelado" ? TEXT_DIM : f === "vencido" ? RED : ACCENT;
          const active = statusFilter === f;
          return (
            <button key={f} onClick={() => setStatusFilter(f)}
              style={{ fontSize: "0.62rem", fontWeight: active ? 700 : 400, padding: "6px 12px", borderRadius: 8, background: active ? `${fc}18` : "rgba(255,255,255,0.03)", color: active ? fc : TEXT_DIM, border: `1px solid ${active ? fc + "40" : "transparent"}`, cursor: "pointer" }}>
              {f === "all" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          );
        })}
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.04)", color: TEXT_MED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", outline: "none" }}>
          <option value="all">Todos os Depts</option>
          {deptNames.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Pendentes section */}
      {pendentes.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <p style={{ fontSize: "0.52rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: YELLOW, margin: 0 }}>Pendentes</p>
            <span style={{ fontSize: "0.52rem", fontWeight: 700, padding: "1px 8px", borderRadius: 10, background: "rgba(245,158,11,0.15)", color: YELLOW }}>{pendentes.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendentes.map(h => (
              <HandoffCard key={h.id} h={h} refetch={refetch} aceitarHandoff={aceitarHandoff} updateStatus={updateStatus} />
            ))}
          </div>
        </div>
      )}

      {/* Historico section */}
      {historico.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <p style={{ fontSize: "0.52rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: GREEN, margin: 0 }}>Conclu\u00eddos / Hist\u00f3rico</p>
            <span style={{ fontSize: "0.52rem", fontWeight: 700, padding: "1px 8px", borderRadius: 10, background: "rgba(16,185,129,0.15)", color: GREEN }}>{historico.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {historico.map(h => (
              <HandoffCard key={h.id} h={h} refetch={refetch} aceitarHandoff={aceitarHandoff} updateStatus={updateStatus} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "48px", textAlign: "center" }}>
          <ArrowRightLeft size={28} style={{ color: TEXT_DIM, margin: "0 auto 12px" }} />
          <p style={{ fontSize: "0.8rem", color: TEXT_DIM }}>Nenhum handoff encontrado</p>
        </div>
      )}
    </div>
  );
}

function AlertasIAView() {
  const { smartAlerts, resolveAlerta, criticalCount, warningCount, infoCount } = useAlertas();
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const filtered = filter === "all" ? smartAlerts : smartAlerts.filter(a => a.severity === filter);
  const sc = (s: string) => s === "critical" ? RED : s === "warning" ? YELLOW : ACCENT;
  const sbg = (s: string) => s === "critical" ? "rgba(239,68,68,0.1)" : s === "warning" ? "rgba(245,158,11,0.1)" : "rgba(212,168,83,0.1)";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1.1rem", fontWeight: 700 }}>Alertas IA — Visão Global</h2>
        <p style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Alertas inteligentes em todos os departamentos</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[{ label: "Críticos", value: criticalCount, color: RED }, { label: "Avisos", value: warningCount, color: YELLOW }, { label: "Informações", value: infoCount, color: ACCENT }].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: "1.6rem", fontWeight: 700, color: s.color }}>{s.value}</span>
            <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {(["all", "critical", "warning", "info"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className="rounded-lg px-3 py-1.5"
            style={{ fontSize: "0.65rem", fontWeight: filter === f ? 600 : 400, background: filter === f ? `${sc(f === "all" ? "info" : f)}20` : "rgba(255,255,255,0.03)", color: filter === f ? sc(f === "all" ? "info" : f) : TEXT_DIM, border: `1px solid ${filter === f ? `${sc(f === "all" ? "info" : f)}40` : "transparent"}`, cursor: "pointer" }}>
            {f === "all" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <CheckCircle2 size={24} style={{ color: GREEN, margin: "0 auto 8px" }} />
            <p style={{ fontSize: "0.8rem", color: GREEN }}>Sem alertas pendentes</p>
          </div>
        ) : filtered.map(a => {
          const Icon = a.severity === "info" ? Info : AlertTriangle;
          return (
            <div key={a.id} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${sc(a.severity)}25` }}>
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-1.5 shrink-0" style={{ background: sbg(a.severity) }}>
                  <Icon size={14} style={{ color: sc(a.severity) }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: sbg(a.severity), color: sc(a.severity) }}>{a.severity}</span>
                    <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{a.dept}</span>
                    <span className="ml-auto" style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{a.timestamp}</span>
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "white", lineHeight: 1.5 }}>{a.message}</p>
                  <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 2 }}>{a.rule}</p>
                </div>
                <button onClick={() => resolveAlerta(a.id)} className="rounded-lg px-2 py-1 shrink-0"
                  style={{ fontSize: "0.55rem", color: GREEN, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", cursor: "pointer" }}>
                  Resolver
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GeralPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const segment = location.pathname.split("/").pop() ?? "";
  const active = segment === "alertas-ia" ? "alertas-ia" : "handoffs-global";

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <div className="sticky top-0 z-10 flex items-center gap-4 px-6 py-3" style={{ background: "rgba(10,10,10,0.95)", borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(12px)" }}>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:text-white transition-colors"
          style={{ color: TEXT_DIM, fontSize: "0.65rem", cursor: "pointer" }}>
          <ChevronLeft size={14} />Voltar
        </button>
        <div className="w-px h-4" style={{ background: BORDER }} />
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "white" }}>Visão Global</span>
        <div className="ml-auto flex gap-1">
          <button onClick={() => navigate("/geral/handoffs-global")}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all"
            style={{ fontSize: "0.65rem", fontWeight: active === "handoffs-global" ? 600 : 400, background: active === "handoffs-global" ? "rgba(212,168,83,0.15)" : "transparent", color: active === "handoffs-global" ? GOLD : TEXT_DIM, border: `1px solid ${active === "handoffs-global" ? "rgba(212,168,83,0.3)" : "transparent"}`, cursor: "pointer" }}>
            <Layers size={12} />Centro de Handoffs
          </button>
          <button onClick={() => navigate("/geral/alertas-ia")}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all"
            style={{ fontSize: "0.65rem", fontWeight: active === "alertas-ia" ? 600 : 400, background: active === "alertas-ia" ? "rgba(239,68,68,0.12)" : "transparent", color: active === "alertas-ia" ? RED : TEXT_DIM, border: `1px solid ${active === "alertas-ia" ? "rgba(239,68,68,0.25)" : "transparent"}`, cursor: "pointer" }}>
            <Zap size={12} />Alertas IA
          </button>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-6">
        {active === "handoffs-global" && <HandoffsGlobalView />}
        {active === "alertas-ia" && <AlertasIAView />}
      </div>
    </div>
  );
}
