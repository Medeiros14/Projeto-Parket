/**
 * Aba TAREFAS — hub robusto da Teca IA por obra.
 *
 * Header: filtros (todas/minhas/atrasadas/sem prazo) + botões "+ Nova" e "Ativar Teca IA".
 * Lista: drag-and-drop reorder, checkbox done, edit inline (título/responsável/prazo),
 *        menu com Comentários / Ver no chat / Deletar.
 * Comentários: thread inline (replies do source_msg_id no parket-chat).
 * Real-time: polling 5s enquanto tab ativa.
 * Histórico: últimos blocos de reunião desse projeto.
 */
import { useEffect, useRef, useState } from "react";
import { fonts } from "../theme";
import {
  api, type ChatObraTask, type ChatObraTaskComment, type ChatUser, type ReuniaoBlocoReview,
} from "../api";
import { useAuth } from "../lib/auth";
import TecaAtivarModal from "./TecaAtivarModal";

type Filtro = "todas" | "minhas" | "atrasadas" | "sem_prazo";
const CHAT_ORIGIN = "https://chat.parket.works";

export default function TarefasTab({
  projetoId, projetoNome, cardId, t,
}: {
  projetoId: string; projetoNome: string; cardId: string | null; t: any;
}) {
  const { appUser } = useAuth();
  const [tecaOpen, setTecaOpen] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  const [tasks, setTasks] = useState<ChatObraTask[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [showDone, setShowDone] = useState(false);
  const [historico, setHistorico] = useState<ReuniaoBlocoReview[]>([]);
  const [carregandoHist, setCarregandoHist] = useState(true);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [meuUserId, setMeuUserId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const pollRef = useRef<number | null>(null);

  // Carrega tarefas + users iniciais
  useEffect(() => {
    reload();
    reloadHistorico();
    api.chatUsers().then((us) => {
      setUsers(us);
      // Resolve meu user_id via email do login
      const me = us.find((u) => u.email && appUser?.email && u.email.toLowerCase() === appUser.email.toLowerCase());
      setMeuUserId(me?.id || null);
    }).catch(() => {});
  }, [cardId, projetoId]);

  // Polling 5s enquanto tab ativa (real-time)
  useEffect(() => {
    if (!cardId) return;
    pollRef.current = window.setInterval(() => { reload(false); }, 5000);
    return () => { if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; } };
  }, [cardId]);

  // Recarrega ao fechar modais (novas tarefas)
  useEffect(() => {
    if (!tecaOpen && !novaOpen) { reload(); reloadHistorico(); }
  }, [tecaOpen, novaOpen]);

  async function reload(showLoading = true) {
    if (!cardId) { setCarregando(false); return; }
    if (showLoading) setCarregando(true);
    try {
      const r = await api.cardTarefas(cardId);
      setTasks(r.tasks || []);
    } catch {} finally { if (showLoading) setCarregando(false); }
  }

  async function reloadHistorico() {
    setCarregandoHist(true);
    try {
      const reunioes = await api.reuniaoLista();
      const blocosProm: Promise<ReuniaoBlocoReview | null>[] = [];
      for (const r of reunioes.slice(0, 8)) {
        const det = await api.reuniaoDetalhe(r.id).catch(() => null);
        if (!det?.blocos) continue;
        for (const b of det.blocos) {
          if (b.projeto_id === projetoId) {
            blocosProm.push(api.reuniaoBlocoReview(b.id).catch(() => null));
          }
        }
      }
      const revs = (await Promise.all(blocosProm)).filter(Boolean) as ReuniaoBlocoReview[];
      revs.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      setHistorico(revs.slice(0, 8));
    } catch {} finally { setCarregandoHist(false); }
  }

  async function toggle(tk: ChatObraTask) {
    try { await api.cardTarefaToggle(tk.id); await reload(false); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
  }

  async function deletar(tk: ChatObraTask) {
    if (!confirm(`Deletar a tarefa "${tk.title}"?`)) return;
    try { await api.cardTarefaDelete(tk.id); await reload(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
  }

  async function patch(tk: ChatObraTask, p: { title?: string; assignee_id?: string | null; due_date?: string | null }) {
    try { await api.cardTarefaPatch(tk.id, p); await reload(false); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
  }

  function verNoChat(_tk: ChatObraTask) {
    if (!cardId) return;
    window.open(`${CHAT_ORIGIN}/obra/${cardId}`, "_blank");
  }

  // Drag-and-drop reorder
  function onDragStart(id: number) { setDragId(id); }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  async function onDrop(overId: number) {
    if (dragId == null || dragId === overId) { setDragId(null); return; }
    const abertas = tasks.filter((x) => !x.done);
    const idxFrom = abertas.findIndex((x) => x.id === dragId);
    const idxTo = abertas.findIndex((x) => x.id === overId);
    if (idxFrom < 0 || idxTo < 0) { setDragId(null); return; }
    const novo = [...abertas];
    const [item] = novo.splice(idxFrom, 1);
    novo.splice(idxTo, 0, item);
    // Optimistic update
    const feitas = tasks.filter((x) => x.done);
    setTasks([...novo, ...feitas]);
    setDragId(null);
    try {
      await api.cardTarefasReorder([...novo.map((x) => x.id), ...feitas.map((x) => x.id)]);
    } catch { reload(); }
  }

  // Aplicar filtro
  const hoje = new Date().toISOString().slice(0, 10);
  function filtroPass(tk: ChatObraTask): boolean {
    if (filtro === "minhas") return meuUserId ? tk.assignee_id === meuUserId : false;
    if (filtro === "atrasadas") return !tk.done && !!tk.due_date && tk.due_date < hoje;
    if (filtro === "sem_prazo") return !tk.done && !tk.due_date;
    return true;
  }
  const filtradas = tasks.filter(filtroPass);
  const abertas = filtradas.filter((x) => !x.done);
  const feitas = filtradas.filter((x) => !!x.done);
  const openCountGlobal = tasks.filter((x) => !x.done).length;

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "20px 32px" }}>
      {/* HEADER */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, marginBottom: 12, flexWrap: "wrap",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.22em",
            color: t.textPrimary,
          }}>TAREFAS DA OBRA</div>
          <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 4 }}>
            Sincronizado com o grupo do chat da obra.
            {openCountGlobal > 0 && <> · <b style={{ color: t.textSecondary }}>{openCountGlobal} aberta{openCountGlobal !== 1 ? "s" : ""}</b></>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setNovaOpen(true)} style={btnSecondary(t)}>+ Nova tarefa</button>
          <button onClick={() => setTecaOpen(true)} style={btnPrimary(t)}>🎙 Ativar Teca IA</button>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {([
          ["todas",     "Todas",     tasks.length],
          ["minhas",    "Minhas",    tasks.filter((x) => meuUserId && x.assignee_id === meuUserId).length],
          ["atrasadas", "Atrasadas", tasks.filter((x) => !x.done && x.due_date && x.due_date < hoje).length],
          ["sem_prazo", "Sem prazo", tasks.filter((x) => !x.done && !x.due_date).length],
        ] as [Filtro, string, number][]).map(([id, label, n]) => (
          <button
            key={id} onClick={() => setFiltro(id)}
            style={{
              padding: "6px 12px", fontSize: 10, letterSpacing: "0.14em",
              fontFamily: fonts.inter, textTransform: "uppercase" as const,
              border: `1px solid ${filtro === id ? t.accent : t.border1}`,
              background: filtro === id ? t.accent : "transparent",
              color: filtro === id ? "#fff" : t.textSecondary,
              cursor: "pointer", borderRadius: 3,
            }}
          >{label}{n > 0 && ` (${n})`}</button>
        ))}
      </div>

      {/* EMPTY / LOADING */}
      {carregando && (
        <div style={{ padding: 16, color: t.textTertiary, fontSize: 11 }}>
          carregando tarefas do chat…
        </div>
      )}
      {!carregando && tasks.length === 0 && (
        <div style={{
          padding: 32, textAlign: "center", background: t.card1,
          border: `1px dashed ${t.border1}`, borderRadius: 4,
          color: t.textTertiary, fontSize: 12,
        }}>
          Nenhuma tarefa ainda.<br/>
          <span style={{ fontSize: 11 }}>
            Ative a Teca IA na reunião ou clique em "+ Nova tarefa".
          </span>
        </div>
      )}
      {!carregando && tasks.length > 0 && filtradas.length === 0 && (
        <div style={{ padding: 16, color: t.textTertiary, fontSize: 11 }}>
          Nenhuma tarefa passa nesse filtro.
        </div>
      )}

      {/* ABERTAS (com drag) */}
      {abertas.length > 0 && (
        <div style={{
          border: `1px solid ${t.border1}`, borderRadius: 4, padding: 4,
          background: t.card1, marginBottom: 16,
        }}>
          {abertas.map((tk) => (
            <TaskRow
              key={tk.id} tk={tk} t={t} users={users}
              onToggle={() => toggle(tk)} onDelete={() => deletar(tk)}
              onPatch={(p) => patch(tk, p)} onVerChat={() => verNoChat(tk)}
              draggable
              dragging={dragId === tk.id}
              onDragStart={() => onDragStart(tk.id)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(tk.id)}
            />
          ))}
        </div>
      )}

      {/* FEITAS (colapsável) */}
      {feitas.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setShowDone((v) => !v)}
            style={{
              background: "transparent", border: "none", color: t.textTertiary,
              cursor: "pointer", fontSize: 10, letterSpacing: "0.14em", padding: "4px 0",
              textTransform: "uppercase" as const, fontFamily: fonts.inter,
            }}
          >
            {showDone ? "− ocultar concluídas" : `+ ver ${feitas.length} concluída${feitas.length !== 1 ? "s" : ""}`}
          </button>
          {showDone && (
            <div style={{
              border: `1px solid ${t.border1}`, borderRadius: 4, padding: 4,
              background: t.card1, marginTop: 6,
            }}>
              {feitas.map((tk) => (
                <TaskRow key={tk.id} tk={tk} t={t} users={users}
                  onToggle={() => toggle(tk)} onDelete={() => deletar(tk)}
                  onPatch={(p) => patch(tk, p)} onVerChat={() => verNoChat(tk)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* HISTÓRICO */}
      <div style={{ marginTop: 8 }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.20em",
          color: t.textTertiary, marginBottom: 10, textTransform: "uppercase",
        }}>Histórico de Reuniões</div>
        {carregandoHist && <div style={{ fontSize: 11, color: t.textTertiary }}>carregando…</div>}
        {!carregandoHist && historico.length === 0 && (
          <div style={{ fontSize: 11, color: t.textTertiary }}>
            Nenhuma reunião gravada pra este projeto ainda.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {historico.map((b) => <BlocoHistoricoRow key={b.id} bloco={b} t={t} />)}
        </div>
      </div>

      {/* MODAIS */}
      {tecaOpen && (
        <TecaAtivarModal
          projetoId={projetoId} projetoNome={projetoNome} cardId={cardId}
          onClose={() => setTecaOpen(false)}
        />
      )}
      {novaOpen && cardId && (
        <NovaTarefaModal
          cardId={cardId} t={t} users={users}
          onClose={() => setNovaOpen(false)} onCriada={() => { setNovaOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
function TaskRow({
  tk, t, users, onToggle, onDelete, onPatch, onVerChat,
  draggable = false, dragging = false, onDragStart, onDragOver, onDrop,
}: {
  tk: ChatObraTask; t: any; users: ChatUser[];
  onToggle: () => void; onDelete: () => void;
  onPatch: (p: { title?: string; assignee_id?: string | null; due_date?: string | null }) => void;
  onVerChat: () => void;
  draggable?: boolean; dragging?: boolean;
  onDragStart?: () => void; onDragOver?: (e: React.DragEvent) => void; onDrop?: () => void;
}) {
  const [editing, setEditing] = useState<"title" | "assignee" | "due" | null>(null);
  const [titleDraft, setTitleDraft] = useState(tk.title);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setTitleDraft(tk.title); }, [tk.title]);

  const done = !!tk.done;
  const prazoLabel = tk.due_date ? `${tk.due_date.slice(8, 10)}/${tk.due_date.slice(5, 7)}` : null;
  const overdue = tk.due_date && !done && new Date(tk.due_date) < new Date();
  const assignee = users.find((u) => u.id === tk.assignee_id);

  function saveTitle() {
    const clean = titleDraft.trim();
    if (!clean || clean === tk.title) { setEditing(null); setTitleDraft(tk.title); return; }
    onPatch({ title: clean });
    setEditing(null);
  }

  return (
    <div
      draggable={draggable && !editing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        borderBottom: `1px solid ${t.border1}`,
        opacity: dragging ? 0.4 : done ? 0.55 : 1,
        background: dragging ? t.card2 : "transparent",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        {draggable && (
          <span style={{
            cursor: "grab", color: t.textTertiary, fontSize: 12, userSelect: "none",
            padding: "0 2px",
          }} title="arraste pra reordenar">⋮⋮</span>
        )}
        <input type="checkbox" checked={done} onChange={onToggle}
          style={{ cursor: "pointer", width: 15, height: 15, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {editing === "title" ? (
            <input
              autoFocus value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
                if (e.key === "Escape") { setEditing(null); setTitleDraft(tk.title); }
              }}
              style={{
                width: "100%", padding: "4px 6px", border: `1px solid ${t.accent}`,
                background: t.bg, color: t.textPrimary, fontSize: 13, borderRadius: 3,
                fontFamily: fonts.inter,
              }}
            />
          ) : (
            <div
              onClick={() => !done && setEditing("title")}
              style={{
                fontSize: 13, color: t.textPrimary, lineHeight: 1.4,
                textDecoration: done ? "line-through" : "none",
                cursor: done ? "default" : "text",
              }}
              title={done ? "" : "clique pra editar"}
            >{tk.title}</div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
            <AssigneeChip
              t={t} users={users} assignee={assignee || null}
              editing={editing === "assignee"} onStart={() => setEditing("assignee")}
              onPick={(userId) => { onPatch({ assignee_id: userId }); setEditing(null); }}
              onCancel={() => setEditing(null)}
            />

            <PrazoChip
              t={t} prazoLabel={prazoLabel} overdue={!!overdue}
              editing={editing === "due"} currentDue={tk.due_date}
              onStart={() => setEditing("due")}
              onSet={(due) => { onPatch({ due_date: due }); setEditing(null); }}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button onClick={() => setExpanded((v) => !v)}
            title="comentários" style={iconBtn(t)}>💬</button>
          <button onClick={onVerChat} title="ver no chat" style={iconBtn(t)}>↗</button>
          <button onClick={onDelete} title="deletar" style={iconBtn(t, "#dc2626")}>✕</button>
        </div>
      </div>

      {expanded && <CommentsPanel taskId={tk.id} t={t} users={users} />}
    </div>
  );
}

// ─────────── Chip: responsável (autocomplete) ───────────
function AssigneeChip({ t, users, assignee, editing, onStart, onPick, onCancel }: {
  t: any; users: ChatUser[]; assignee: ChatUser | null;
  editing: boolean; onStart: () => void;
  onPick: (userId: string | null) => void; onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = q ? users.filter((u) => (u.name || "").toLowerCase().includes(q.toLowerCase())).slice(0, 6) : users.slice(0, 8);

  if (!editing) {
    return (
      <span onClick={onStart} style={{
        fontSize: 10, color: t.textTertiary, cursor: "pointer",
        padding: "2px 6px", border: `1px dashed ${t.border1}`, borderRadius: 10,
      }} title="clique pra atribuir">
        👤 {assignee ? assignee.name : "atribuir"}
      </span>
    );
  }
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <input
        autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="buscar…"
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        style={{
          padding: "3px 6px", fontSize: 11, border: `1px solid ${t.accent}`,
          background: t.bg, color: t.textPrimary, borderRadius: 3, width: 150,
        }}
      />
      <div style={{
        position: "absolute", top: "100%", left: 0, marginTop: 2,
        background: t.card1, border: `1px solid ${t.border2}`, borderRadius: 3,
        maxHeight: 240, overflowY: "auto", minWidth: 180, zIndex: 10,
        boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
      }}>
        {assignee && (
          <div onClick={() => onPick(null)} style={dropdownItem(t, "#dc2626")}>
            ✕ remover atribuição
          </div>
        )}
        {filtered.map((u) => (
          <div key={u.id} onClick={() => onPick(u.id)} style={dropdownItem(t)}>
            {u.name} <span style={{ color: t.textTertiary, fontSize: 9 }}>· {u.email}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 8, fontSize: 10, color: t.textTertiary }}>ninguém encontrado</div>
        )}
      </div>
    </div>
  );
}

// ─────────── Chip: prazo (date input) ───────────
function PrazoChip({ t, prazoLabel, overdue, editing, currentDue, onStart, onSet, onCancel }: {
  t: any; prazoLabel: string | null; overdue: boolean; editing: boolean;
  currentDue: string | null; onStart: () => void;
  onSet: (due: string | null) => void; onCancel: () => void;
}) {
  const [val, setVal] = useState(currentDue || "");
  useEffect(() => { setVal(currentDue || ""); }, [currentDue, editing]);
  if (!editing) {
    return (
      <span onClick={onStart} style={{
        fontSize: 10, cursor: "pointer",
        color: overdue ? "#dc2626" : t.textTertiary,
        padding: "2px 6px", border: `1px dashed ${t.border1}`, borderRadius: 10,
      }} title="clique pra editar prazo">
        📅 {prazoLabel || "sem prazo"}{overdue ? " (atrasada)" : ""}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input
        type="date" autoFocus value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        style={{
          padding: "3px 6px", fontSize: 11, border: `1px solid ${t.accent}`,
          background: t.bg, color: t.textPrimary, borderRadius: 3,
        }}
      />
      <button onClick={() => onSet(val || null)} style={miniBtn(t, t.accent, "#fff")}>OK</button>
      {currentDue && <button onClick={() => onSet(null)} style={miniBtn(t)}>Limpar</button>}
    </span>
  );
}

// ─────────── Painel de comentários ───────────
function CommentsPanel({ taskId, t, users }: { taskId: number; t: any; users: ChatUser[] }) {
  const [comments, setComments] = useState<ChatObraTaskComment[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { reload(); }, [taskId]);
  async function reload() {
    setCarregando(true);
    try { const r = await api.cardTarefaComments(taskId); setComments(r.comments || []); }
    catch {} finally { setCarregando(false); }
  }
  async function enviar() {
    const c = novo.trim(); if (!c) return;
    setEnviando(true);
    try { await api.cardTarefaComment(taskId, c); setNovo(""); await reload(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setEnviando(false); }
  }
  function nomeDe(id: string): string {
    const u = users.find((x) => x.id === id);
    if (u) return u.name;
    if (id === "00000000-0000-0000-0000-000000aa0001") return "Teca IA";
    return id.slice(0, 8);
  }
  return (
    <div style={{
      padding: "8px 14px 12px 40px", background: t.card2, borderTop: `1px solid ${t.border1}`,
    }}>
      {carregando && <div style={{ fontSize: 10, color: t.textTertiary }}>carregando…</div>}
      {!carregando && comments.length === 0 && (
        <div style={{ fontSize: 10, color: t.textTertiary, marginBottom: 6 }}>
          Sem comentários. Escreva o primeiro:
        </div>
      )}
      {comments.map((c) => (
        <div key={c.id} style={{ padding: "4px 0", fontSize: 11, color: t.textSecondary }}>
          <b style={{ color: t.textPrimary }}>{nomeDe(c.sender_id)}</b>
          <span style={{ color: t.textTertiary, fontSize: 9, marginLeft: 6 }}>
            {new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
            {c.deleted ? <i style={{ color: t.textTertiary }}>(mensagem deletada)</i> : c.content}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input
          value={novo} onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder="escreva um comentário e Enter…"
          disabled={enviando}
          style={{
            flex: 1, padding: "6px 8px", fontSize: 11, borderRadius: 3,
            border: `1px solid ${t.border1}`, background: t.bg, color: t.textPrimary,
          }}
        />
        <button onClick={enviar} disabled={enviando || !novo.trim()} style={miniBtn(t, t.accent, "#fff")}>
          {enviando ? "…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
function NovaTarefaModal({
  cardId, t, users, onClose, onCriada,
}: {
  cardId: string; t: any; users: ChatUser[];
  onClose: () => void; onCriada: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [due, setDue] = useState<string>("");
  const [assigneeQ, setAssigneeQ] = useState("");
  const [salvando, setSalvando] = useState(false);
  const filtered = assigneeQ
    ? users.filter((u) => u.name.toLowerCase().includes(assigneeQ.toLowerCase())).slice(0, 8)
    : users.slice(0, 12);
  const assigneeUser = users.find((u) => u.id === assignee);

  async function criar() {
    if (!titulo.trim()) return;
    setSalvando(true);
    try {
      await api.cardTarefaManualAdd(cardId, {
        title: titulo.trim(),
        assignee_id: assignee || null,
        due_date: due || null,
      });
      onCriada();
    } catch (e: any) { alert(`Falha: ${e.message}`); setSalvando(false); }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: t.bg, color: t.textPrimary, fontFamily: fonts.inter,
        width: "100%", maxWidth: 440, padding: 20, borderRadius: 6,
        border: `1px solid ${t.border2}`, boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
      }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.22em",
          color: t.accent, marginBottom: 14,
        }}>NOVA TAREFA</div>

        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={inputLabel(t)}>Título</span>
          <input
            autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) criar(); }}
            placeholder="Ex: Confirmar entrega do piso com fornecedor"
            style={fieldStyle(t)}
          />
        </label>

        <label style={{ display: "block", marginBottom: 12, position: "relative" }}>
          <span style={inputLabel(t)}>Responsável (opcional)</span>
          <input
            value={assigneeUser ? assigneeUser.name : assigneeQ}
            onChange={(e) => { setAssignee(""); setAssigneeQ(e.target.value); }}
            placeholder="buscar por nome…"
            style={fieldStyle(t)}
          />
          {!assigneeUser && assigneeQ && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0,
              background: t.card1, border: `1px solid ${t.border2}`, borderRadius: 3,
              maxHeight: 200, overflowY: "auto", zIndex: 5,
            }}>
              {filtered.map((u) => (
                <div key={u.id} onClick={() => { setAssignee(u.id); setAssigneeQ(""); }} style={dropdownItem(t)}>
                  {u.name} <span style={{ color: t.textTertiary, fontSize: 9 }}>· {u.email}</span>
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: 8, fontSize: 10, color: t.textTertiary }}>ninguém encontrado</div>
              )}
            </div>
          )}
          {assigneeUser && (
            <button onClick={() => { setAssignee(""); setAssigneeQ(""); }} style={{
              position: "absolute", right: 6, top: 32,
              background: "transparent", border: "none", color: t.textTertiary, cursor: "pointer", fontSize: 12,
            }}>✕</button>
          )}
        </label>

        <label style={{ display: "block", marginBottom: 18 }}>
          <span style={inputLabel(t)}>Prazo (opcional)</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={fieldStyle(t)} />
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnSecondary(t)}>Cancelar</button>
          <button onClick={criar} disabled={!titulo.trim() || salvando} style={btnPrimary(t)}>
            {salvando ? "Criando…" : "Criar tarefa"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
function BlocoHistoricoRow({ bloco, t }: { bloco: ReuniaoBlocoReview; t: any }) {
  const [aberto, setAberto] = useState(false);
  const dt = bloco.created_at ? new Date(bloco.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
  const nTarefas = (bloco.tarefas || []).length;
  const nAprovadas = (bloco.tarefas || []).filter((x) => x.status === "approved").length;
  const durMin = bloco.duracao_seg ? Math.round(bloco.duracao_seg / 60) : 0;
  return (
    <div style={{ border: `1px solid ${t.border1}`, borderRadius: 4, background: t.card1 }}>
      <div onClick={() => setAberto((v) => !v)}
        style={{ padding: "10px 14px", cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{
            fontSize: 9, letterSpacing: "0.14em", color: t.textTertiary,
            background: t.bg, padding: "3px 8px", borderRadius: 3,
            border: `1px solid ${t.border1}`, whiteSpace: "nowrap",
          }}>{dt}</span>
          <span style={{ fontSize: 12, color: t.textPrimary, whiteSpace: "nowrap" }}>
            {nAprovadas}/{nTarefas} tarefas · {durMin}min
          </span>
          <span style={{ fontSize: 10, color: t.textTertiary, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {(bloco.resumo || "").split("\n")[0].slice(0, 100)}
          </span>
        </div>
        <span style={{ fontSize: 10, color: t.textTertiary }}>{aberto ? "▾" : "▸"}</span>
      </div>
      {aberto && (
        <div style={{ padding: "10px 14px 14px", borderTop: `1px solid ${t.border1}` }}>
          {bloco.resumo && (
            <div style={{ fontSize: 11, color: t.textSecondary, whiteSpace: "pre-wrap", lineHeight: 1.5, marginBottom: 10, padding: 10, background: t.bg, borderRadius: 3 }}>
              {bloco.resumo}
            </div>
          )}
          {(bloco.tarefas || []).map((tk) => (
            <div key={tk.id} style={{
              fontSize: 11, color: tk.status === "approved" ? t.textPrimary : t.textTertiary,
              padding: "3px 0",
              textDecoration: tk.status === "discarded" ? "line-through" : "none",
            }}>
              {tk.status === "approved" ? "✓" : tk.status === "discarded" ? "✗" : "•"} {tk.titulo}
            </div>
          ))}
          {bloco.transcricao && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 9, letterSpacing: "0.14em", color: t.textTertiary, padding: "4px 0" }}>
                TRANSCRIÇÃO COMPLETA
              </summary>
              <div style={{ fontSize: 11, color: t.textSecondary, whiteSpace: "pre-wrap", lineHeight: 1.5, padding: 10, background: t.bg, borderRadius: 3, marginTop: 4 }}>
                {bloco.transcricao}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
function btnPrimary(t: any) {
  return {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "10px 16px", background: t.accent, color: "#fff",
    border: "none", borderRadius: 3, cursor: "pointer",
    fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
  };
}
function btnSecondary(t: any) {
  return {
    padding: "10px 16px", background: "transparent", color: t.textSecondary,
    border: `1px solid ${t.border1}`, borderRadius: 3, cursor: "pointer",
    fontFamily: fonts.inter, fontSize: 11,
  };
}
function iconBtn(t: any, color?: string) {
  return {
    background: "transparent", border: "none", cursor: "pointer",
    color: color || t.textTertiary, fontSize: 14, padding: "4px 6px",
    borderRadius: 3,
  };
}
function miniBtn(t: any, bg?: string, fg?: string) {
  return {
    background: bg || "transparent", color: fg || t.textSecondary,
    border: `1px solid ${bg || t.border1}`, padding: "3px 8px",
    fontSize: 10, borderRadius: 3, cursor: "pointer",
  };
}
function dropdownItem(t: any, color?: string) {
  return {
    padding: "6px 10px", fontSize: 11, cursor: "pointer",
    color: color || t.textPrimary, borderBottom: `1px solid ${t.border1}`,
  };
}
function inputLabel(t: any) {
  return {
    display: "block", marginBottom: 4,
    fontSize: 9, letterSpacing: "0.18em", color: t.textTertiary,
    textTransform: "uppercase" as const, fontFamily: fonts.inter,
  };
}
function fieldStyle(t: any) {
  return {
    width: "100%", padding: "8px 10px", fontSize: 12,
    background: t.card1, color: t.textPrimary,
    border: `1px solid ${t.border1}`, borderRadius: 3,
    fontFamily: fonts.inter, boxSizing: "border-box" as const,
  };
}
