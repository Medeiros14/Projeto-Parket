import { useState } from "react";
import { AlertTriangle, Info, Zap, ChevronDown, ChevronUp, MessageSquare, Send, Clock, CheckCircle2, Search, X } from "lucide-react";
import type { Alerta, AlertaComment } from "../hooks/useAlertas";

const CARD_BG = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.06)";
const ACCENT = "#D4A853";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MED = "rgba(255,255,255,0.6)";
const GREEN = "#10B981";
const YELLOW = "#F59E0B";
const RED = "#EF4444";
const BLUE = "#3B82F6";

const SEVERITY_COLOR: Record<string, string> = { critical: RED, warning: YELLOW, info: BLUE };
const SEVERITY_BG: Record<string, string> = { critical: "rgba(239,68,68,0.08)", warning: "rgba(245,158,11,0.08)", info: "rgba(59,130,246,0.08)" };
const SEVERITY_BORDER: Record<string, string> = { critical: "rgba(239,68,68,0.2)", warning: "rgba(245,158,11,0.2)", info: "rgba(59,130,246,0.2)" };

const STATUS_CONFIG = {
  pendente:    { label: "Pendente",    color: YELLOW, bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.25)" },
  "em-analise":{ label: "Em Análise", color: BLUE,   bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.25)" },
  finalizado:  { label: "Finalizado", color: GREEN,  bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)" },
};

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") return <AlertTriangle size={13} style={{ color: RED }} />;
  if (severity === "warning")  return <AlertTriangle size={13} style={{ color: YELLOW }} />;
  return <Info size={13} style={{ color: BLUE }} />;
}

interface Props {
  alerta: Alerta;
  onUpdateStatus: (id: string, status: Alerta["status"]) => Promise<void>;
  onUpdateDescription: (id: string, desc: string) => Promise<void>;
  onAddComment: (id: string, user: string, msg: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
  currentUser?: string;
}

export function AlertaCard({ alerta, onUpdateStatus, onUpdateDescription, onAddComment, onResolve, currentUser = "Usuário" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(alerta.description ?? "");
  const [savingDesc, setSavingDesc] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const sc = SEVERITY_COLOR[alerta.severity] ?? ACCENT;
  const sbg = SEVERITY_BG[alerta.severity] ?? "rgba(255,255,255,0.04)";
  const sborder = SEVERITY_BORDER[alerta.severity] ?? BORDER;
  const statusCfg = STATUS_CONFIG[alerta.status] ?? STATUS_CONFIG.pendente;
  const comments: AlertaComment[] = alerta.comments ?? [];

  const handleSaveDesc = async () => {
    setSavingDesc(true);
    await onUpdateDescription(alerta.id, descDraft);
    setSavingDesc(false);
    setEditingDesc(false);
  };

  const handleSendMsg = async () => {
    if (!chatMsg.trim()) return;
    setSendingMsg(true);
    await onAddComment(alerta.id, currentUser, chatMsg.trim());
    setChatMsg("");
    setSendingMsg(false);
  };

  const handleStatusChange = async (newStatus: Alerta["status"]) => {
    if (newStatus === alerta.status) return;
    setUpdatingStatus(true);
    await onUpdateStatus(alerta.id, newStatus);
    setUpdatingStatus(false);
  };

  return (
    <div className="rounded-xl overflow-hidden transition-all" style={{ background: sbg, border: `1px solid ${sborder}` }}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="mt-0.5 shrink-0"><SeverityIcon severity={alerta.severity} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-white" style={{ fontSize: "0.78rem", fontWeight: 500, lineHeight: 1.5 }}>{alerta.message}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {alerta.obra_id && <span style={{ fontSize: "0.55rem", color: ACCENT }}>{alerta.obra_id}</span>}
            <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{new Date(alerta.created_at).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}</span>
            {alerta.auto_generated && <span style={{ fontSize: "0.45rem", background: "rgba(212,168,83,0.15)", color: ACCENT, padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>IA Auto</span>}
            {comments.length > 0 && <span className="flex items-center gap-0.5" style={{ fontSize: "0.5rem", color: TEXT_DIM }}><MessageSquare size={9} />{comments.length}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Status badge */}
          <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}>
            {statusCfg.label}
          </span>
          {expanded ? <ChevronUp size={13} style={{ color: TEXT_DIM }} /> : <ChevronDown size={13} style={{ color: TEXT_DIM }} />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t" style={{ borderColor: sborder }}>
          {/* Status buttons */}
          <div className="px-4 py-3" style={{ background: "rgba(0,0,0,0.2)" }}>
            <p style={{ fontSize: "0.5rem", color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Status do Alerta</p>
            <div className="flex gap-2 flex-wrap">
              {(["pendente", "em-analise", "finalizado"] as const).map(s => {
                const cfg = STATUS_CONFIG[s];
                const isActive = alerta.status === s;
                return (
                  <button
                    key={s}
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange(s)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all"
                    style={{ fontSize: "0.6rem", fontWeight: isActive ? 700 : 400, background: isActive ? cfg.bg : "rgba(255,255,255,0.03)", color: isActive ? cfg.color : TEXT_DIM, border: `1px solid ${isActive ? cfg.border : BORDER}`, cursor: updatingStatus ? "default" : "pointer" }}>
                    {s === "pendente" && <Clock size={10} />}
                    {s === "em-analise" && <Search size={10} />}
                    {s === "finalizado" && <CheckCircle2 size={10} />}
                    {cfg.label}
                  </button>
                );
              })}
              <button
                onClick={() => onResolve(alerta.id)}
                className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all"
                style={{ fontSize: "0.6rem", fontWeight: 500, background: "rgba(239,68,68,0.08)", color: RED, border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
                <X size={10} />Encerrar Alerta
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="px-4 py-3" style={{ borderTop: `1px solid ${sborder}` }}>
            <div className="flex items-center justify-between mb-2">
              <p style={{ fontSize: "0.5rem", color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.1em" }}>Descrição</p>
              {!editingDesc && (
                <button onClick={() => { setEditingDesc(true); setDescDraft(alerta.description ?? ""); }}
                  style={{ fontSize: "0.55rem", color: ACCENT, cursor: "pointer", background: "none", border: "none" }}>
                  {alerta.description ? "Editar" : "+ Adicionar"}
                </button>
              )}
            </div>
            {editingDesc ? (
              <div className="space-y-2">
                <textarea
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  rows={3}
                  placeholder="Descreva o alerta em detalhe..."
                  className="w-full rounded-lg px-3 py-2 outline-none resize-none"
                  style={{ fontSize: "0.7rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white", lineHeight: 1.6 }}
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveDesc} disabled={savingDesc}
                    className="rounded-lg px-3 py-1.5"
                    style={{ fontSize: "0.6rem", fontWeight: 600, background: "rgba(16,185,129,0.12)", color: GREEN, border: "1px solid rgba(16,185,129,0.2)", cursor: "pointer" }}>
                    {savingDesc ? "Salvando..." : "Salvar"}
                  </button>
                  <button onClick={() => setEditingDesc(false)}
                    style={{ fontSize: "0.6rem", color: TEXT_DIM, background: "none", border: "none", cursor: "pointer" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: "0.7rem", color: alerta.description ? TEXT_MED : TEXT_DIM, lineHeight: 1.6, fontStyle: alerta.description ? "normal" : "italic" }}>
                {alerta.description || "Sem descrição. Clique em + Adicionar para detalhar este alerta."}
              </p>
            )}
          </div>

          {/* Chat / Conversa interna */}
          <div className="px-4 py-3" style={{ borderTop: `1px solid ${sborder}` }}>
            <p style={{ fontSize: "0.5rem", color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
              Conversa Interna {comments.length > 0 && `(${comments.length})`}
            </p>

            {/* Messages */}
            {comments.length > 0 && (
              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-1">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${sc}20`, fontSize: "0.5rem", fontWeight: 700, color: sc }}>
                      {c.user.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span style={{ fontSize: "0.55rem", fontWeight: 600, color: "white" }}>{c.user}</span>
                        <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{new Date(c.timestamp).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}</span>
                      </div>
                      <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
                        <p style={{ fontSize: "0.68rem", color: TEXT_MED, lineHeight: 1.5 }}>{c.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2">
              <input
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMsg(); } }}
                placeholder="Escreva uma mensagem interna..."
                className="flex-1 rounded-lg px-3 py-2 outline-none"
                style={{ fontSize: "0.68rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white" }}
              />
              <button
                onClick={handleSendMsg}
                disabled={!chatMsg.trim() || sendingMsg}
                className="rounded-lg px-3 py-2 flex items-center gap-1.5 transition-all"
                style={{ fontSize: "0.6rem", fontWeight: 600, background: chatMsg.trim() ? `${sc}15` : "rgba(255,255,255,0.03)", color: chatMsg.trim() ? sc : TEXT_DIM, border: `1px solid ${chatMsg.trim() ? `${sc}30` : BORDER}`, cursor: chatMsg.trim() ? "pointer" : "default" }}>
                <Send size={10} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
