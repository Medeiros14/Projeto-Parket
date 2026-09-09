/**
 * Exibe as tarefas do grupo do chat (obra_tasks) vinculado ao projeto.
 * Fonte: parket-chat via proxy /api/reuniao/card/:card_id/tarefas.
 * Sem espelho local — sempre lê ao vivo do chat.
 * Toggle done → POST /api/reuniao/tarefa-chat/:id/toggle.
 *
 * Usado no card do projeto do gestão (Projeto.tsx).
 */
import { useEffect, useState } from "react";
import { fonts, useTokens } from "../theme";
import { api, type ChatObraTask } from "../api";

export default function TarefasReuniaoCard({ cardId }: { cardId: string | null | undefined }) {
  const t = useTokens();
  const [tasks, setTasks] = useState<ChatObraTask[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    if (!cardId) { setCarregando(false); return; }
    reload();
  }, [cardId]);

  async function reload() {
    if (!cardId) return;
    setCarregando(true);
    try {
      const r = await api.cardTarefas(cardId);
      setTasks(r.tasks || []);
      setOpenCount(r.open_count || 0);
      setThreadId(r.obra_thread_id);
    } catch {
      // silencioso — se o chat estiver fora, apenas não mostra
    } finally {
      setCarregando(false);
    }
  }

  async function toggle(t2: ChatObraTask) {
    try {
      await api.cardTarefaToggle(t2.id);
      await reload();
    } catch (e: any) {
      alert(`Falha: ${e.message}`);
    }
  }

  if (!cardId) return null;
  if (carregando) {
    return (
      <div style={{ padding: 12, color: t.textTertiary, fontSize: 11 }}>
        carregando tarefas do chat…
      </div>
    );
  }
  if (tasks.length === 0) return null;

  const abertas = tasks.filter((x) => !x.done);
  const feitas = tasks.filter((x) => !!x.done);

  return (
    <div style={{
      border: `1px solid ${t.border1}`, borderRadius: 4, padding: 12, background: t.card1,
      marginTop: 12, marginBottom: 12,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${t.border1}`,
      }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.20em",
          color: t.textPrimary,
        }}>
          TAREFAS DA OBRA <span style={{ color: t.accent }}>· {openCount} aberta{openCount !== 1 ? "s" : ""}</span>
        </div>
        <span style={{ fontSize: 9, color: t.textTertiary }}>chat.parket.works</span>
      </div>

      {abertas.map((tk) => (
        <TaskRow key={tk.id} tk={tk} t={t} onToggle={() => toggle(tk)} />
      ))}

      {feitas.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setShowDone((v) => !v)}
            style={{
              background: "transparent", border: "none", color: t.textTertiary,
              cursor: "pointer", fontSize: 10, letterSpacing: "0.10em", padding: 0,
            }}
          >
            {showDone ? "− ocultar" : `+ ver ${feitas.length} concluída${feitas.length !== 1 ? "s" : ""}`}
          </button>
          {showDone && feitas.map((tk) => (
            <TaskRow key={tk.id} tk={tk} t={t} onToggle={() => toggle(tk)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ tk, t, onToggle }: { tk: ChatObraTask; t: any; onToggle: () => void }) {
  const done = !!tk.done;
  const prazoLabel = tk.due_date ? `${tk.due_date.slice(8,10)}/${tk.due_date.slice(5,7)}` : null;
  const overdue = tk.due_date && !done && new Date(tk.due_date) < new Date();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
      opacity: done ? 0.5 : 1,
    }}>
      <input type="checkbox" checked={done} onChange={onToggle}
        style={{ cursor: "pointer", width: 14, height: 14 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, color: t.textPrimary, lineHeight: 1.4,
          textDecoration: done ? "line-through" : "none",
        }}>{tk.title}</div>
        {prazoLabel && (
          <div style={{ fontSize: 9, color: overdue ? "#dc2626" : t.textTertiary, marginTop: 2 }}>
            prazo {prazoLabel}{overdue ? " (atrasada)" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
