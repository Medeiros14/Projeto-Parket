/* ═══════════════════════════════════════════════════════════════
   DEPT TOOLKIT — Ferramentas práticas do dia a dia
   Bloco de Notas · Timer · Checklist · Calculadora · Agenda · Relatório
   ═══════════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StickyNote, Timer, ListChecks, Calculator, CalendarClock, FileBarChart,
  Plus, Trash2, Play, Pause, RotateCcw, X, ChevronDown, ChevronUp,
  Save, Download, Copy, Check, Clock, AlertTriangle, TrendingUp,
  Pencil, GripVertical, Square, CheckSquare,
} from "lucide-react";

/* ─── Tokens (matching dept-layout) ─── */
const CARD_BG = "#111111";
const BORDER = "rgba(255,255,255,0.06)";
const ACCENT = "#B8AA9A";
const GREEN = "#10B981";
const RED = "#EF4444";
const YELLOW = "#F59E0B";
const BLUE = "#3B82F6";
const GOLD = "#D4A853";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MED = "rgba(255,255,255,0.6)";

/* ─── localStorage helpers ─── */
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ═══════════════════════════════════════
   1. BLOCO DE NOTAS RÁPIDAS
   ═══════════════════════════════════════ */
interface Note { id: string; text: string; createdAt: string; color: string; pinned: boolean; }
const NOTE_COLORS = [ACCENT, BLUE, GREEN, YELLOW, "#EC4899", "#8B5CF6"];

export function BlocoDeNotas({ deptId }: { deptId: string }) {
  const storageKey = `parket-notes-${deptId}`;
  const [notes, setNotes] = useState<Note[]>(() => load(storageKey, []));
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [selectedColor, setSelectedColor] = useState(ACCENT);

  useEffect(() => { save(storageKey, notes); }, [notes, storageKey]);

  const addNote = () => {
    if (!draft.trim()) return;
    const note: Note = {
      id: `n-${Date.now()}`,
      text: draft.trim(),
      createdAt: new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      color: selectedColor,
      pinned: false,
    };
    setNotes(prev => [note, ...prev]);
    setDraft("");
  };

  const deleteNote = (id: string) => setNotes(prev => prev.filter(n => n.id !== id));
  const togglePin = (id: string) => setNotes(prev => {
    const updated = prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n);
    return [...updated.filter(n => n.pinned), ...updated.filter(n => !n.pinned)];
  });
  const startEdit = (note: Note) => { setEditingId(note.id); setEditText(note.text); };
  const saveEdit = () => {
    if (editingId && editText.trim()) {
      setNotes(prev => prev.map(n => n.id === editingId ? { ...n, text: editText.trim() } : n));
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Bloco de Notas</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Anote lembretes rápidos, ideias e observações</p>
      </div>

      {/* New note input */}
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
          placeholder="Escreva sua nota... (Ctrl+Enter para salvar)"
          className="w-full rounded-lg px-3 py-2.5 text-white outline-none resize-none"
          style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, minHeight: 80 }}
        />
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>Cor:</span>
            {NOTE_COLORS.map(c => (
              <button key={c} onClick={() => setSelectedColor(c)}
                className="w-4 h-4 rounded-full transition-transform"
                style={{ background: c, border: selectedColor === c ? "2px solid white" : "2px solid transparent", transform: selectedColor === c ? "scale(1.2)" : "scale(1)" }}
              />
            ))}
          </div>
          <button onClick={addNote} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all hover:scale-[1.02]"
            style={{ fontSize: "0.65rem", fontWeight: 600, background: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
            <Plus size={12} /> Adicionar Nota
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <StickyNote size={20} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
          <p style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Nenhuma nota ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {notes.map(note => (
            <div key={note.id} className="rounded-xl p-3.5 group" style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${note.color}` }}>
              {editingId === note.id ? (
                <div>
                  <textarea value={editText} onChange={e => setEditText(e.target.value)}
                    className="w-full rounded-lg px-2 py-2 text-white outline-none resize-none mb-2"
                    style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, minHeight: 60 }} autoFocus />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="flex items-center gap-1 rounded px-2 py-1" style={{ fontSize: "0.55rem", background: `${GREEN}20`, color: GREEN }}><Check size={10} /> Salvar</button>
                    <button onClick={() => setEditingId(null)} className="flex items-center gap-1 rounded px-2 py-1" style={{ fontSize: "0.55rem", background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}><X size={10} /> Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-white mb-2" style={{ fontSize: "0.72rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{note.text}</p>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{note.createdAt}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => togglePin(note.id)} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: note.pinned ? `${GOLD}20` : "rgba(255,255,255,0.05)" }}>
                        <span style={{ fontSize: "0.55rem", color: note.pinned ? GOLD : TEXT_DIM }}>📌</span>
                      </button>
                      <button onClick={() => startEdit(note)} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <Pencil size={10} style={{ color: TEXT_DIM }} />
                      </button>
                      <button onClick={() => { navigator.clipboard.writeText(note.text); }} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <Copy size={10} style={{ color: TEXT_DIM }} />
                      </button>
                      <button onClick={() => deleteNote(note.id)} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)" }}>
                        <Trash2 size={10} style={{ color: RED }} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: "0.5rem", color: TEXT_DIM, textAlign: "center" }}>{notes.length} nota{notes.length !== 1 ? "s" : ""} · Salvo automaticamente no navegador</p>
    </div>
  );
}

/* ═══════════════════════════════════════
   2. TIMER DE TAREFAS
   ═══════════════════════════════════════ */
interface TimerEntry { id: string; label: string; seconds: number; createdAt: string; }

export function TimerDeTarefas({ deptId }: { deptId: string }) {
  const storageKey = `parket-timers-${deptId}`;
  const [label, setLabel] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<TimerEntry[]>(() => load(storageKey, []));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { save(storageKey, history); }, [history, storageKey]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const saveTimer = () => {
    if (seconds < 1) return;
    const entry: TimerEntry = {
      id: `t-${Date.now()}`,
      label: label.trim() || "Tarefa sem nome",
      seconds,
      createdAt: new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    };
    setHistory(prev => [entry, ...prev]);
    setSeconds(0);
    setRunning(false);
    setLabel("");
  };

  const totalToday = history.reduce((acc, h) => acc + h.seconds, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Timer de Tarefas</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Cronometre quanto tempo cada atividade leva</p>
      </div>

      {/* Timer display */}
      <div className="rounded-xl p-6 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Nome da tarefa..."
          className="w-full text-center rounded-lg px-3 py-2 text-white outline-none mb-4"
          style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }} />
        <div className="mb-6">
          <span className="font-mono" style={{ fontSize: "3rem", fontWeight: 200, color: running ? GREEN : "white", letterSpacing: "0.05em" }}>
            {fmt(seconds)}
          </span>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setRunning(!running)}
            className="flex items-center gap-2 rounded-xl px-6 py-3 transition-all hover:scale-[1.02]"
            style={{ background: running ? `${RED}20` : `${GREEN}20`, color: running ? RED : GREEN, border: `1px solid ${running ? `${RED}30` : `${GREEN}30`}`, fontSize: "0.75rem", fontWeight: 600 }}>
            {running ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> {seconds > 0 ? "Continuar" : "Iniciar"}</>}
          </button>
          {seconds > 0 && (
            <>
              <button onClick={saveTimer} className="flex items-center gap-2 rounded-xl px-4 py-3 transition-all"
                style={{ background: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}30`, fontSize: "0.75rem", fontWeight: 500 }}>
                <Save size={14} /> Salvar
              </button>
              <button onClick={() => { setSeconds(0); setRunning(false); }} className="flex items-center gap-2 rounded-xl px-4 py-3 transition-all"
                style={{ background: "rgba(255,255,255,0.03)", color: TEXT_DIM, border: `1px solid ${BORDER}`, fontSize: "0.75rem" }}>
                <RotateCcw size={14} /> Zerar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      {history.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}15` }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: "0.65rem", color: TEXT_MED }}>Total registrado:</span>
            <span className="font-mono" style={{ fontSize: "0.85rem", fontWeight: 600, color: ACCENT }}>{fmt(totalToday)}</span>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Histórico</p>
          <div className="space-y-2">
            {history.slice(0, 10).map(entry => (
              <div key={entry.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Clock size={11} style={{ color: TEXT_DIM }} />
                  <span className="truncate" style={{ fontSize: "0.68rem", color: "white" }}>{entry.label}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono" style={{ fontSize: "0.65rem", color: GREEN, fontWeight: 500 }}>{fmt(entry.seconds)}</span>
                  <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{entry.createdAt}</span>
                  <button onClick={() => setHistory(prev => prev.filter(h => h.id !== entry.id))} className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)" }}>
                    <X size={8} style={{ color: RED }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   3. CHECKLIST DIÁRIO
   ═══════════════════════════════════════ */
interface CheckItem { id: string; text: string; done: boolean; priority: "alta" | "media" | "baixa"; }

export function ChecklistDiario({ deptId }: { deptId: string }) {
  const today = new Date().toISOString().split("T")[0];
  const storageKey = `parket-checklist-${deptId}-${today}`;
  const [items, setItems] = useState<CheckItem[]>(() => load(storageKey, []));
  const [newText, setNewText] = useState("");
  const [newPriority, setNewPriority] = useState<"alta" | "media" | "baixa">("media");
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  useEffect(() => { save(storageKey, items); }, [items, storageKey]);

  const addItem = () => {
    if (!newText.trim()) return;
    setItems(prev => [...prev, { id: `ci-${Date.now()}`, text: newText.trim(), done: false, priority: newPriority }]);
    setNewText("");
  };

  const toggleItem = (id: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const deleteItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const clearDone = () => setItems(prev => prev.filter(i => !i.done));

  const filtered = items.filter(i => filter === "all" ? true : filter === "pending" ? !i.done : i.done);
  const doneCount = items.filter(i => i.done).length;
  const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  const priorityColor = (p: string) => p === "alta" ? RED : p === "media" ? YELLOW : GREEN;
  const prioritySort = { alta: 0, media: 1, baixa: 2 };
  const sorted = [...filtered].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return prioritySort[a.priority] - prioritySort[b.priority];
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Checklist Diário</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Hoje · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        {doneCount > 0 && (
          <button onClick={clearDone} style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Limpar concluídos</button>
        )}
      </div>

      {/* Progress */}
      {items.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: progress === 100 ? `${GREEN}08` : CARD_BG, border: `1px solid ${progress === 100 ? `${GREEN}20` : BORDER}` }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: "0.65rem", color: TEXT_MED }}>{doneCount}/{items.length} concluídas</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: progress === 100 ? GREEN : ACCENT }}>{progress}%</span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: progress === 100 ? GREEN : ACCENT }} />
          </div>
        </div>
      )}

      {/* Add new item */}
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex gap-2">
          <input value={newText} onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
            placeholder="Nova tarefa..."
            className="flex-1 rounded-lg px-3 py-2 text-white outline-none"
            style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }} />
          <select value={newPriority} onChange={e => setNewPriority(e.target.value as "alta" | "media" | "baixa")}
            className="rounded-lg px-2 py-2 outline-none"
            style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.03)", color: priorityColor(newPriority), border: `1px solid ${BORDER}` }}>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
          <button onClick={addItem} className="rounded-lg px-3 py-2 transition-all hover:scale-[1.02]"
            style={{ background: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Filter */}
      {items.length > 0 && (
        <div className="flex gap-2">
          {(["all", "pending", "done"] as const).map(f => {
            const labels = { all: "Todas", pending: "Pendentes", done: "Concluídas" };
            return (
              <button key={f} onClick={() => setFilter(f)} className="rounded-lg px-3 py-1.5"
                style={{ fontSize: "0.6rem", fontWeight: filter === f ? 600 : 400, background: filter === f ? `${ACCENT}15` : "rgba(255,255,255,0.03)", color: filter === f ? ACCENT : TEXT_DIM, border: `1px solid ${filter === f ? `${ACCENT}30` : "transparent"}` }}>
                {labels[f]}
              </button>
            );
          })}
        </div>
      )}

      {/* Items */}
      <div className="space-y-2">
        {sorted.map(item => (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg group transition-all"
            style={{ background: item.done ? "rgba(16,185,129,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${item.done ? `${GREEN}10` : BORDER}` }}>
            <button onClick={() => toggleItem(item.id)} className="shrink-0">
              {item.done ? <CheckSquare size={16} style={{ color: GREEN }} /> : <Square size={16} style={{ color: TEXT_DIM }} />}
            </button>
            <span className="flex-1" style={{ fontSize: "0.72rem", color: item.done ? TEXT_DIM : "white", textDecoration: item.done ? "line-through" : "none" }}>
              {item.text}
            </span>
            <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${priorityColor(item.priority)}15`, color: priorityColor(item.priority) }}>
              {item.priority}
            </span>
            <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <X size={12} style={{ color: TEXT_DIM }} />
            </button>
          </div>
        ))}
        {sorted.length === 0 && items.length > 0 && (
          <div className="rounded-xl p-4 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <p style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Nenhum item neste filtro</p>
          </div>
        )}
        {items.length === 0 && (
          <div className="rounded-xl p-6 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <ListChecks size={20} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
            <p style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Nenhuma tarefa para hoje</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   4. CALCULADORA DE OBRA
   ═══════════════════════════════════════ */
export function CalculadoraDeObra() {
  const [mode, setMode] = useState<"m2" | "margem" | "parcelas">("m2");

  // m² calculator
  const [largura, setLargura] = useState("");
  const [comprimento, setComprimento] = useState("");
  const [precoPorM2, setPrecoPorM2] = useState("");
  const [perda, setPerda] = useState("10");

  // Margem calculator
  const [valorContrato, setValorContrato] = useState("");
  const [custoTotal, setCustoTotal] = useState("");

  // Parcelas calculator
  const [valorTotal, setValorTotal] = useState("");
  const [numParcelas, setNumParcelas] = useState("3");
  const [entrada, setEntrada] = useState("30");

  const areaUtil = parseFloat(largura) * parseFloat(comprimento) || 0;
  const areaComPerda = areaUtil * (1 + (parseFloat(perda) || 0) / 100);
  const custoM2 = areaComPerda * (parseFloat(precoPorM2) || 0);

  const margem = parseFloat(valorContrato) && parseFloat(custoTotal)
    ? ((parseFloat(valorContrato) - parseFloat(custoTotal)) / parseFloat(valorContrato) * 100)
    : 0;
  const lucro = (parseFloat(valorContrato) || 0) - (parseFloat(custoTotal) || 0);

  const vt = parseFloat(valorTotal) || 0;
  const np = parseInt(numParcelas) || 1;
  const entradaPerc = parseFloat(entrada) || 0;
  const entradaValor = vt * (entradaPerc / 100);
  const valorParcela = np > 0 ? (vt - entradaValor) / np : 0;

  const modes = [
    { id: "m2" as const, label: "Área & Custo m²" },
    { id: "margem" as const, label: "Margem de Obra" },
    { id: "parcelas" as const, label: "Parcelamento" },
  ];

  const inputStyle = "w-full rounded-lg px-3 py-2 text-white outline-none";
  const inputBase = { fontSize: "0.75rem" as const, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Calculadora de Obra</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Calcule rapidamente área, custos e margens</p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        {modes.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} className="rounded-lg px-3 py-2 transition-all"
            style={{ fontSize: "0.65rem", fontWeight: mode === m.id ? 600 : 400, background: mode === m.id ? `${ACCENT}15` : "rgba(255,255,255,0.03)", color: mode === m.id ? ACCENT : TEXT_DIM, border: `1px solid ${mode === m.id ? `${ACCENT}30` : "transparent"}` }}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === "m2" && (
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Largura (m)</label>
              <input type="number" value={largura} onChange={e => setLargura(e.target.value)} placeholder="0.00" className={inputStyle} style={inputBase} />
            </div>
            <div>
              <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Comprimento (m)</label>
              <input type="number" value={comprimento} onChange={e => setComprimento(e.target.value)} placeholder="0.00" className={inputStyle} style={inputBase} />
            </div>
            <div>
              <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Preço / m² (R$)</label>
              <input type="number" value={precoPorM2} onChange={e => setPrecoPorM2(e.target.value)} placeholder="0.00" className={inputStyle} style={inputBase} />
            </div>
            <div>
              <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Perda (%)</label>
              <input type="number" value={perda} onChange={e => setPerda(e.target.value)} placeholder="10" className={inputStyle} style={inputBase} />
            </div>
          </div>
          {areaUtil > 0 && (
            <div className="grid grid-cols-3 gap-3 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginBottom: 4 }}>Área Útil</p>
                <span style={{ fontSize: "1.1rem", fontWeight: 600, color: BLUE }}>{areaUtil.toFixed(2)} m²</span>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginBottom: 4 }}>Com Perda</p>
                <span style={{ fontSize: "1.1rem", fontWeight: 600, color: YELLOW }}>{areaComPerda.toFixed(2)} m²</span>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginBottom: 4 }}>Custo Total</p>
                <span style={{ fontSize: "1.1rem", fontWeight: 600, color: GREEN }}>R$ {custoM2.toFixed(0)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "margem" && (
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Valor do Contrato (R$)</label>
              <input type="number" value={valorContrato} onChange={e => setValorContrato(e.target.value)} placeholder="0" className={inputStyle} style={inputBase} />
            </div>
            <div>
              <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Custo Total (R$)</label>
              <input type="number" value={custoTotal} onChange={e => setCustoTotal(e.target.value)} placeholder="0" className={inputStyle} style={inputBase} />
            </div>
          </div>
          {(parseFloat(valorContrato) > 0 || parseFloat(custoTotal) > 0) && (
            <div className="grid grid-cols-3 gap-3 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginBottom: 4 }}>Margem</p>
                <span style={{ fontSize: "1.3rem", fontWeight: 700, color: margem >= 30 ? GREEN : margem >= 25 ? YELLOW : RED }}>{margem.toFixed(1)}%</span>
                <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginTop: 4 }}>{margem >= 30 ? "Saudável" : margem >= 25 ? "Atenção" : "Risco"}</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginBottom: 4 }}>Lucro Bruto</p>
                <span style={{ fontSize: "1.1rem", fontWeight: 600, color: lucro >= 0 ? GREEN : RED }}>R$ {(lucro / 1000).toFixed(1)}k</span>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginBottom: 4 }}>Custo / Receita</p>
                <span style={{ fontSize: "1.1rem", fontWeight: 600, color: ACCENT }}>{parseFloat(valorContrato) > 0 ? ((parseFloat(custoTotal) / parseFloat(valorContrato)) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>
          )}
          {/* Reference bar */}
          <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <p className="tracking-[0.2em] uppercase mb-2" style={{ fontSize: "0.45rem", color: TEXT_DIM }}>Referência Parket</p>
            <div className="flex items-center gap-2">
              {[{ label: "< 25%", color: RED, desc: "Risco" }, { label: "25-30%", color: YELLOW, desc: "Atenção" }, { label: "> 30%", color: GREEN, desc: "Meta" }].map(r => (
                <div key={r.label} className="flex items-center gap-1.5 rounded px-2 py-1" style={{ background: `${r.color}10` }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                  <span style={{ fontSize: "0.5rem", color: r.color }}>{r.label} ({r.desc})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === "parcelas" && (
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Valor Total (R$)</label>
              <input type="number" value={valorTotal} onChange={e => setValorTotal(e.target.value)} placeholder="0" className={inputStyle} style={inputBase} />
            </div>
            <div>
              <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Nº Parcelas</label>
              <input type="number" value={numParcelas} onChange={e => setNumParcelas(e.target.value)} placeholder="3" className={inputStyle} style={inputBase} />
            </div>
            <div>
              <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Entrada (%)</label>
              <input type="number" value={entrada} onChange={e => setEntrada(e.target.value)} placeholder="30" className={inputStyle} style={inputBase} />
            </div>
          </div>
          {vt > 0 && (
            <div className="pt-4 space-y-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}15` }}>
                <span style={{ fontSize: "0.68rem", color: TEXT_MED }}>Entrada ({entradaPerc}%)</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: ACCENT }}>R$ {entradaValor.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
              </div>
              {Array.from({ length: np }).map((_, i) => (
                <div key={`parc-${i}`} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: "0.68rem", color: TEXT_MED }}>Parcela {i + 1}</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "white" }}>R$ {valorParcela.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: `${GREEN}08`, border: `1px solid ${GREEN}15` }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "white" }}>Total</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: GREEN }}>R$ {vt.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   5. AGENDA DO DIA
   ═══════════════════════════════════════ */
interface Compromisso { id: string; hora: string; titulo: string; tipo: "reuniao" | "tarefa" | "lembrete" | "visita"; descricao?: string; }

export function AgendaDoDia({ deptId }: { deptId: string }) {
  const today = new Date().toISOString().split("T")[0];
  const storageKey = `parket-agenda-${deptId}-${today}`;
  const [compromissos, setCompromissos] = useState<Compromisso[]>(() => load(storageKey, []));
  const [showForm, setShowForm] = useState(false);
  const [newHora, setNewHora] = useState("09:00");
  const [newTitulo, setNewTitulo] = useState("");
  const [newTipo, setNewTipo] = useState<Compromisso["tipo"]>("reuniao");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => { save(storageKey, compromissos); }, [compromissos, storageKey]);

  const addCompromisso = () => {
    if (!newTitulo.trim()) return;
    const item: Compromisso = { id: `ag-${Date.now()}`, hora: newHora, titulo: newTitulo.trim(), tipo: newTipo, descricao: newDesc.trim() || undefined };
    setCompromissos(prev => [...prev, item].sort((a, b) => a.hora.localeCompare(b.hora)));
    setNewTitulo("");
    setNewDesc("");
    setShowForm(false);
  };

  const removeCompromisso = (id: string) => setCompromissos(prev => prev.filter(c => c.id !== id));

  const tipoConfig: Record<Compromisso["tipo"], { color: string; label: string; emoji: string }> = {
    reuniao: { color: BLUE, label: "Reunião", emoji: "👥" },
    tarefa: { color: GREEN, label: "Tarefa", emoji: "✅" },
    lembrete: { color: YELLOW, label: "Lembrete", emoji: "🔔" },
    visita: { color: "#EC4899", label: "Visita Obra", emoji: "🏗️" },
  };

  const currentHour = new Date().getHours().toString().padStart(2, "0") + ":" + new Date().getMinutes().toString().padStart(2, "0");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Agenda do Dia</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all"
          style={{ fontSize: "0.65rem", fontWeight: 500, background: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
          {showForm ? <><X size={12} /> Fechar</> : <><Plus size={12} /> Novo</>}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${ACCENT}20` }}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Horário</label>
              <input type="time" value={newHora} onChange={e => setNewHora(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-white outline-none"
                style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }} />
            </div>
            <div>
              <label style={{ fontSize: "0.55rem", color: TEXT_DIM, display: "block", marginBottom: 4 }}>Tipo</label>
              <select value={newTipo} onChange={e => setNewTipo(e.target.value as Compromisso["tipo"])}
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.03)", color: tipoConfig[newTipo].color, border: `1px solid ${BORDER}` }}>
                {Object.entries(tipoConfig).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
            </div>
          </div>
          <input value={newTitulo} onChange={e => setNewTitulo(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCompromisso()}
            placeholder="Título do compromisso..."
            className="w-full rounded-lg px-3 py-2 text-white outline-none mb-2"
            style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }} />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
            placeholder="Descrição (opcional)..."
            className="w-full rounded-lg px-3 py-2 text-white outline-none mb-3"
            style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }} />
          <button onClick={addCompromisso} className="w-full rounded-lg py-2 transition-all"
            style={{ fontSize: "0.7rem", fontWeight: 600, background: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
            Adicionar
          </button>
        </div>
      )}

      {/* Timeline */}
      {compromissos.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <CalendarClock size={20} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
          <p style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Nenhum compromisso para hoje</p>
        </div>
      ) : (
        <div className="space-y-1">
          {compromissos.map((c, i) => {
            const conf = tipoConfig[c.tipo];
            const isPast = c.hora < currentHour;
            const isCurrent = c.hora.slice(0, 2) === currentHour.slice(0, 2);
            return (
              <div key={c.id} className="flex items-start gap-3 group">
                <div className="flex flex-col items-center" style={{ width: 50, paddingTop: 4 }}>
                  <span className="font-mono" style={{ fontSize: "0.72rem", fontWeight: isCurrent ? 700 : 400, color: isCurrent ? conf.color : isPast ? TEXT_DIM : "white" }}>{c.hora}</span>
                  {i < compromissos.length - 1 && <div className="w-0.5 flex-1 min-h-[20px] mt-1" style={{ background: isPast ? `${GREEN}30` : "rgba(255,255,255,0.06)" }} />}
                </div>
                <div className="flex-1 pb-3 rounded-xl p-3 mb-1 transition-all"
                  style={{ background: isCurrent ? `${conf.color}08` : "rgba(255,255,255,0.02)", border: `1px solid ${isCurrent ? `${conf.color}20` : BORDER}`, opacity: isPast ? 0.6 : 1 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontSize: "0.7rem" }}>{conf.emoji}</span>
                    <span className="flex-1" style={{ fontSize: "0.75rem", fontWeight: 500, color: isPast ? TEXT_MED : "white" }}>{c.titulo}</span>
                    <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: "0.4rem", fontWeight: 600, background: `${conf.color}15`, color: conf.color }}>{conf.label}</span>
                    <button onClick={() => removeCompromisso(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={12} style={{ color: TEXT_DIM }} />
                    </button>
                  </div>
                  {c.descricao && <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginLeft: 22 }}>{c.descricao}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   6. GERADOR DE RELATÓRIO RÁPIDO
   ═══════════════════════════════════════ */
export function GeradorRelatorio({ deptId, deptName, kpiData }: { deptId: string; deptName: string; kpiData?: { label: string; value: string | number }[] }) {
  const [tipo, setTipo] = useState<"diario" | "semanal">("diario");
  const [observacoes, setObservacoes] = useState("");
  const [destaques, setDestaques] = useState("");
  const [bloqueios, setBloqueios] = useState("");
  const [copied, setCopied] = useState(false);

  const generateReport = () => {
    const date = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const header = tipo === "diario" ? `📊 RELATÓRIO DIÁRIO — ${deptName}` : `📊 RELATÓRIO SEMANAL — ${deptName}`;
    let report = `${header}\n📅 ${date}\n${"─".repeat(40)}\n\n`;

    if (kpiData && kpiData.length > 0) {
      report += `📈 KPIs PRINCIPAIS:\n`;
      kpiData.forEach(k => { report += `  • ${k.label}: ${k.value}\n`; });
      report += "\n";
    }

    if (destaques.trim()) {
      report += `✅ DESTAQUES:\n${destaques.trim().split("\n").map(l => `  • ${l}`).join("\n")}\n\n`;
    }
    if (bloqueios.trim()) {
      report += `🚨 BLOQUEIOS / RISCOS:\n${bloqueios.trim().split("\n").map(l => `  • ${l}`).join("\n")}\n\n`;
    }
    if (observacoes.trim()) {
      report += `📝 OBSERVAÇÕES:\n${observacoes.trim()}\n\n`;
    }

    report += `${"─".repeat(40)}\n🏷️ Parket Pisos · Sistema Operacional\n⏰ Gerado em: ${new Date().toLocaleString("pt-BR")}`;
    return report;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Gerador de Relatório</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Monte um relatório rápido e copie para WhatsApp ou email</p>
      </div>

      {/* Type selector */}
      <div className="flex gap-2">
        {(["diario", "semanal"] as const).map(t => (
          <button key={t} onClick={() => setTipo(t)} className="rounded-lg px-4 py-2"
            style={{ fontSize: "0.65rem", fontWeight: tipo === t ? 600 : 400, background: tipo === t ? `${ACCENT}15` : "rgba(255,255,255,0.03)", color: tipo === t ? ACCENT : TEXT_DIM, border: `1px solid ${tipo === t ? `${ACCENT}30` : "transparent"}` }}>
            {t === "diario" ? "📊 Diário" : "📈 Semanal"}
          </button>
        ))}
      </div>

      {/* KPIs snapshot */}
      {kpiData && kpiData.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: `${ACCENT}06`, border: `1px solid ${ACCENT}12` }}>
          <p className="tracking-[0.2em] uppercase mb-3" style={{ fontSize: "0.45rem", color: ACCENT }}>KPIs incluídos automaticamente</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {kpiData.slice(0, 6).map((k, i) => (
              <div key={`kpi-${i}`} className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{k.label}</p>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "white" }}>{k.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input fields */}
      <div className="space-y-3">
        <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <label className="flex items-center gap-1.5 mb-2" style={{ fontSize: "0.65rem", color: GREEN, fontWeight: 500 }}>
            <Check size={12} /> Destaques / Conquistas
          </label>
          <textarea value={destaques} onChange={e => setDestaques(e.target.value)}
            placeholder="Uma conquista por linha..."
            className="w-full rounded-lg px-3 py-2 text-white outline-none resize-none"
            style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, minHeight: 60 }} />
        </div>

        <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <label className="flex items-center gap-1.5 mb-2" style={{ fontSize: "0.65rem", color: RED, fontWeight: 500 }}>
            <AlertTriangle size={12} /> Bloqueios / Riscos
          </label>
          <textarea value={bloqueios} onChange={e => setBloqueios(e.target.value)}
            placeholder="Um bloqueio por linha..."
            className="w-full rounded-lg px-3 py-2 text-white outline-none resize-none"
            style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, minHeight: 60 }} />
        </div>

        <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <label className="flex items-center gap-1.5 mb-2" style={{ fontSize: "0.65rem", color: TEXT_MED, fontWeight: 500 }}>
            <FileBarChart size={12} /> Observações Gerais
          </label>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
            placeholder="Notas adicionais..."
            className="w-full rounded-lg px-3 py-2 text-white outline-none resize-none"
            style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, minHeight: 60 }} />
        </div>
      </div>

      {/* Preview & Copy */}
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>Pré-visualização</p>
          <button onClick={copyToClipboard} className="flex items-center gap-1.5 rounded-lg px-4 py-2 transition-all hover:scale-[1.02]"
            style={{ fontSize: "0.65rem", fontWeight: 600, background: copied ? `${GREEN}20` : `${ACCENT}20`, color: copied ? GREEN : ACCENT, border: `1px solid ${copied ? `${GREEN}30` : `${ACCENT}30`}` }}>
            {copied ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Copiar Relatório</>}
          </button>
        </div>
        <pre className="rounded-lg p-3 overflow-x-auto"
          style={{ fontSize: "0.6rem", color: TEXT_MED, background: "rgba(0,0,0,0.3)", border: `1px solid ${BORDER}`, whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 300 }}>
          {generateReport()}
        </pre>
      </div>
    </div>
  );
}

/* ═══ EXPORT TOOL DEFINITIONS ═══ */
export const TOOLKIT_ICONS = {
  notas: StickyNote,
  timer: Timer,
  checklist: ListChecks,
  calculadora: Calculator,
  agenda: CalendarClock,
  relatorio: FileBarChart,
};

export const TOOLKIT_LABELS = {
  notas: "Bloco de Notas",
  timer: "Timer de Tarefas",
  checklist: "Checklist Diário",
  calculadora: "Calculadora",
  agenda: "Agenda do Dia",
  relatorio: "Relatório Rápido",
};
