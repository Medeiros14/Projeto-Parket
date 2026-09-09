/**
 * Modal "Ativar Teca IA" — abre pelo card do projeto no cronograma.
 * Grava áudio (até 10min), Whisper transcreve, Claude extrai resumo+tarefas,
 * Pamela revisa, aprovadas viram obra_tasks no chat da obra.
 *
 * Bootstrap automático: cria/reusa reunião do dia + cria bloco pro projeto ativo.
 * Sem UX de "escolher projeto" — o projeto vem do card.
 *
 * Monitor ao vivo: separa "committed" (final) de "interim" (sendo dito agora,
 * itálico faded), sem colchetes/pipeline caótico.
 */
import { useEffect, useRef, useState } from "react";
import { fonts, useTokens } from "../theme";
import { api, type ReuniaoBlocoReview, type ReuniaoTarefa } from "../api";
import { useAuth } from "../lib/auth";

type State = "init" | "idle" | "gravando" | "enviando" | "processando" | "review" | "encerrado" | "erro";
const MAX_DUR_SEG = 10 * 60;

export default function TecaAtivarModal({
  projetoId, projetoNome, cardId, onClose,
}: {
  projetoId: string;
  projetoNome: string;
  cardId: string | null;
  onClose: () => void;
}) {
  const t = useTokens();
  const { appUser } = useAuth();
  const [state, setState] = useState<State>("init");
  const [err, setErr] = useState("");
  const [bloco, setBloco] = useState<ReuniaoBlocoReview | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [committed, setCommitted] = useState("");
  const [interim, setInterim] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const recogRef = useRef<any>(null);
  const abortMonitorRef = useRef(false);

  // Bootstrap: reunião do dia + bloco pro projeto
  useEffect(() => {
    (async () => {
      try {
        let r: any = await api.reuniaoHoje();
        if (!r || !r.id) r = await api.reuniaoNova({ conduzido_por: appUser?.email });
        const b = await api.reuniaoBlocoNovo(r.id, {
          projeto_id: projetoId,
          projeto_nome: projetoNome,
          card_id: cardId || undefined,
        });
        setBloco({ ...b, tarefas: [], transcricao: null, resumo: null } as any);
        setState("idle");
      } catch (e: any) {
        setErr(`Falha ao iniciar: ${e.message || e}`);
        setState("erro");
      }
    })();
    return () => cleanup();
  }, []); // eslint-disable-line

  function cleanup() {
    abortMonitorRef.current = true;
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (recogRef.current) { try { recogRef.current.stop(); } catch {} recogRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
  }

  async function iniciar() {
    if (!bloco) return;
    setErr("");
    setCommitted("");
    setInterim("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      }});
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: pickMime() });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(1000);
      setState("gravando");
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_DUR_SEG) { finalizar(); }
          return s + 1;
        });
      }, 1000);
      startMonitor();
    } catch (e: any) {
      setErr(`Sem microfone: ${e.message || e}`);
      setState("erro");
    }
  }

  function startMonitor() {
    abortMonitorRef.current = false;
    const W: any = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "pt-BR"; r.continuous = true; r.interimResults = true;
    r.onresult = (ev: any) => {
      let f = "";
      let i = "";
      for (let idx = ev.resultIndex; idx < ev.results.length; idx++) {
        const txt = ev.results[idx][0].transcript;
        if (ev.results[idx].isFinal) f += txt + " ";
        else i += txt;
      }
      if (f) setCommitted((prev) => (prev + f).slice(-1000));
      setInterim(i.trim());
    };
    r.onerror = () => {}; // ignora — só monitor
    r.onend = () => {
      if (!abortMonitorRef.current) { try { r.start(); } catch {} }
    };
    try { r.start(); recogRef.current = r; } catch {}
  }

  async function finalizar() {
    if (state !== "gravando" || !bloco) return;
    setState("enviando");
    abortMonitorRef.current = true;
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (recogRef.current) { try { recogRef.current.stop(); } catch {} }

    const mr = mediaRecorderRef.current;
    if (!mr) { setState("erro"); setErr("Sem gravador"); return; }
    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      try { mr.stop(); } catch { resolve(); }
    });
    const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
    chunksRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }

    setState("processando");
    try {
      const ext = (blob.type.includes("mp4") ? ".m4a" : blob.type.includes("ogg") ? ".ogg" : ".webm");
      const review = await api.reuniaoBlocoAudio(bloco.id, blob, seconds, `bloco${ext}`);
      setBloco(review);
      setState("review");
    } catch (e: any) {
      setErr(`Falha ao processar: ${e.message || e}`);
      setState("erro");
    }
  }

  async function reloadReview() {
    if (!bloco) return;
    try { setBloco(await api.reuniaoBlocoReview(bloco.id)); } catch {}
  }

  async function aprovar(tk: ReuniaoTarefa) {
    setSalvando(tk.id);
    try { await api.reuniaoTarefaAprovar(tk.id, appUser?.email || undefined); await reloadReview(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(null); }
  }
  async function descartar(tk: ReuniaoTarefa) {
    setSalvando(tk.id);
    try { await api.reuniaoTarefaDescartar(tk.id); await reloadReview(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(null); }
  }
  async function editar(tk: ReuniaoTarefa) {
    const novo = prompt("Editar tarefa:", tk.titulo);
    if (!novo || novo.trim() === tk.titulo) return;
    setSalvando(tk.id);
    try { await api.reuniaoTarefaPatch(tk.id, { titulo: novo.trim() }); await reloadReview(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(null); }
  }
  async function editarPrazo(tk: ReuniaoTarefa) {
    const novo = prompt("Prazo (YYYY-MM-DD ou vazio):", tk.prazo_data || "");
    if (novo === null) return;
    setSalvando(tk.id);
    try { await api.reuniaoTarefaPatch(tk.id, { prazo_data: novo.trim() || null }); await reloadReview(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(null); }
  }
  async function adicionar() {
    if (!bloco) return;
    const titulo = prompt("Nova tarefa (título):");
    if (!titulo || !titulo.trim()) return;
    try { await api.reuniaoBlocoAddTarefa(bloco.id, { titulo: titulo.trim() }); await reloadReview(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
  }
  async function concluirBloco() {
    if (!bloco) return;
    try {
      await api.reuniaoBlocoEncerrar(bloco.id);
      setState("encerrado");
      setTimeout(onClose, 800);
    } catch (e: any) { alert(`Falha: ${e.message}`); }
  }

  const pending = (bloco?.tarefas || []).filter((x) => x.status === "pending" || x.status === "edited");
  const aprovadas = (bloco?.tarefas || []).filter((x) => x.status === "approved");

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      padding: 16,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: t.bg, color: t.textPrimary, fontFamily: fonts.inter,
        width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
        border: `1px solid ${t.border2}`, borderRadius: 6,
        boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
      }}>
        <Header t={t} nome={projetoNome} onClose={onClose} state={state} />

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {state === "init" && <Loading t={t} label="Iniciando…" />}

          {(state === "idle" || state === "gravando" || state === "enviando" || state === "processando") && (
            <RecordUI
              t={t} state={state} seconds={seconds}
              committed={committed} interim={interim}
              onStart={iniciar} onStop={finalizar}
            />
          )}

          {state === "review" && bloco && (
            <ReviewUI
              t={t} bloco={bloco} salvando={salvando}
              onAprovar={aprovar} onDescartar={descartar} onEditar={editar}
              onEditarPrazo={editarPrazo} onAdicionar={adicionar} onConcluir={concluirBloco}
              pending={pending} aprovadas={aprovadas}
            />
          )}

          {state === "encerrado" && (
            <div style={{ padding: 24, textAlign: "center", color: t.textSecondary, fontSize: 12 }}>
              Bloco encerrado. Tarefas aprovadas viraram cards no chat da obra.
            </div>
          )}

          {state === "erro" && (
            <div style={{
              padding: 14, background: "#fee", color: "#c00",
              borderRadius: 4, fontSize: 12, marginTop: 8,
            }}>{err}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
function Header({ t, nome, state, onClose }: {
  t: any; nome: string; state: State; onClose: () => void;
}) {
  return (
    <div style={{
      padding: "14px 18px", borderBottom: `1px solid ${t.border1}`,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      background: t.card1,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.22em", color: t.accent }}>
          ATIVAR TECA IA
        </div>
        <div style={{ fontSize: 13, color: t.textPrimary, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {nome}
        </div>
      </div>
      <button
        onClick={onClose}
        disabled={state === "gravando" || state === "enviando" || state === "processando"}
        style={{
          background: "transparent", border: `1px solid ${t.border1}`,
          color: t.textSecondary, padding: "6px 10px", cursor: state === "gravando" ? "not-allowed" : "pointer",
          fontSize: 14, borderRadius: 3, opacity: state === "gravando" ? 0.4 : 1,
        }}
        title="Fechar"
      >✕</button>
    </div>
  );
}

function Loading({ t, label }: { t: any; label: string }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: t.textTertiary, fontSize: 12 }}>
      {label}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
function RecordUI({ t, state, seconds, committed, interim, onStart, onStop }: {
  t: any; state: State; seconds: number; committed: string; interim: string;
  onStart: () => void; onStop: () => void;
}) {
  const disabled = state === "enviando" || state === "processando";
  const isRec = state === "gravando";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ position: "relative", marginTop: 8 }}>
        <button
          disabled={disabled}
          onClick={isRec ? onStop : onStart}
          style={{
            width: 130, height: 130, borderRadius: "50%",
            background: isRec ? "#dc2626" : t.accent,
            color: "#fff", border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            fontFamily: fonts.cinzel, letterSpacing: "0.12em", fontSize: 12,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 4,
            boxShadow: isRec ? "0 0 0 6px rgba(220,38,38,0.15)" : "0 4px 12px rgba(0,0,0,0.15)",
            transition: "background 0.2s, box-shadow 0.2s",
          }}
        >
          <span style={{ fontSize: 26 }}>{isRec ? "■" : "●"}</span>
          <span>{isRec ? "PARAR" : "ATIVAR"}</span>
        </button>
      </div>

      <div style={{ fontSize: 22, fontFamily: "monospace", color: t.textPrimary }}>
        {formatSec(seconds)}
        <span style={{ fontSize: 11, color: t.textTertiary, marginLeft: 6 }}>/ 10:00</span>
      </div>

      {state === "processando" && (
        <div style={{ textAlign: "center", padding: 8, color: t.textSecondary, fontSize: 11 }}>
          Transcrevendo áudio e extraindo tarefas — 30 a 90 segundos…
        </div>
      )}
      {state === "enviando" && (
        <div style={{ textAlign: "center", padding: 8, color: t.textSecondary, fontSize: 11 }}>
          Enviando áudio…
        </div>
      )}

      {(committed || interim) && (
        <div style={{
          width: "100%", padding: 12, background: t.card1, border: `1px solid ${t.border1}`,
          borderRadius: 4, fontSize: 12, color: t.textSecondary,
          maxHeight: 220, overflowY: "auto", lineHeight: 1.5,
        }}>
          <div style={{ fontSize: 9, letterSpacing: "0.16em", color: t.textTertiary, marginBottom: 6 }}>
            {isRec ? "CAPTANDO AO VIVO" : "PRÉVIA DA CAPTAÇÃO"}
          </div>
          <span>{committed}</span>
          {interim && (
            <span style={{ color: t.textTertiary, fontStyle: "italic" }}> {interim}</span>
          )}
        </div>
      )}

      {!isRec && state === "idle" && (
        <div style={{ fontSize: 11, color: t.textTertiary, textAlign: "center", maxWidth: 420 }}>
          Toque em <b>ATIVAR</b> pra começar a captar. Até 10 min por projeto.
          A Teca IA transcreve e sugere as tarefas ao final.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
function ReviewUI({
  t, bloco, salvando, pending, aprovadas,
  onAprovar, onDescartar, onEditar, onEditarPrazo, onAdicionar, onConcluir,
}: {
  t: any; bloco: ReuniaoBlocoReview; salvando: string | null;
  pending: ReuniaoTarefa[]; aprovadas: ReuniaoTarefa[];
  onAprovar: (x: ReuniaoTarefa) => void; onDescartar: (x: ReuniaoTarefa) => void;
  onEditar: (x: ReuniaoTarefa) => void; onEditarPrazo: (x: ReuniaoTarefa) => void;
  onAdicionar: () => void; onConcluir: () => void;
}) {
  const canConcluir = pending.length === 0;
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [bulking, setBulking] = useState(false);

  function toggleSel(id: string) {
    setSelecionadas((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }
  function toggleTodas() {
    if (selecionadas.size === pending.length) setSelecionadas(new Set());
    else setSelecionadas(new Set(pending.map((x) => x.id)));
  }
  async function bulkAprovar() {
    setBulking(true);
    try { for (const id of Array.from(selecionadas)) { const tk = pending.find((x) => x.id === id); if (tk) await onAprovar(tk); } }
    finally { setSelecionadas(new Set()); setBulking(false); }
  }
  async function bulkDescartar() {
    setBulking(true);
    try { for (const id of Array.from(selecionadas)) { const tk = pending.find((x) => x.id === id); if (tk) await onDescartar(tk); } }
    finally { setSelecionadas(new Set()); setBulking(false); }
  }

  const nSel = selecionadas.size;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {bloco.resumo && (
        <div style={{ padding: 12, background: t.card1, border: `1px solid ${t.border1}`, borderRadius: 4 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.16em", color: t.textTertiary, marginBottom: 6 }}>RESUMO</div>
          <div style={{ fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{bloco.resumo}</div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.18em", color: t.textTertiary }}>
          TAREFAS PENDENTES ({pending.length})
        </div>
        {pending.length > 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <label style={{ fontSize: 10, color: t.textTertiary, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <input type="checkbox" checked={selecionadas.size === pending.length && pending.length > 0}
                onChange={toggleTodas}
                style={{ width: 13, height: 13, cursor: "pointer" }} />
              todas
            </label>
            {nSel > 0 && (
              <>
                <button disabled={bulking} onClick={bulkAprovar} style={btnMini(t, "#059669", "#fff")}>
                  ✓ Aprovar {nSel}
                </button>
                <button disabled={bulking} onClick={bulkDescartar} style={btnMini(t)}>
                  ✕ Descartar {nSel}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {pending.length === 0 && (
        <div style={{ fontSize: 11, color: t.textTertiary, padding: 8 }}>
          Nenhuma tarefa aguardando decisão.
        </div>
      )}
      {pending.map((tk) => (
        <TarefaCard key={tk.id} t={t} tarefa={tk} loading={salvando === tk.id}
          selected={selecionadas.has(tk.id)}
          onToggleSel={() => toggleSel(tk.id)}
          onAprovar={() => onAprovar(tk)} onDescartar={() => onDescartar(tk)}
          onEditar={() => onEditar(tk)} onEditarPrazo={() => onEditarPrazo(tk)}
        />
      ))}

      <button onClick={onAdicionar} style={btnGhost(t)}>+ Adicionar tarefa manual</button>

      {aprovadas.length > 0 && (
        <>
          <div style={{ fontSize: 9, letterSpacing: "0.18em", color: t.textTertiary, marginTop: 8 }}>
            APROVADAS ({aprovadas.length})
          </div>
          {aprovadas.map((tk) => (
            <div key={tk.id} style={{
              padding: 8, background: t.card1, border: `1px solid ${t.border1}`, borderRadius: 4,
              fontSize: 12, color: t.textSecondary,
              display: "flex", justifyContent: "space-between", gap: 6,
            }}>
              <span>✓ {tk.titulo}</span>
              {tk.chat_task_id && <span style={{ fontSize: 9, color: t.textTertiary }}>chat #{tk.chat_task_id}</span>}
            </div>
          ))}
        </>
      )}

      {bloco.transcricao && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 9, letterSpacing: "0.16em", color: t.textTertiary, padding: "6px 0" }}>
            TRANSCRIÇÃO COMPLETA
          </summary>
          <div style={{ fontSize: 11, color: t.textSecondary, whiteSpace: "pre-wrap", lineHeight: 1.5, padding: 10, background: t.card1, borderRadius: 4 }}>
            {bloco.transcricao}
          </div>
        </details>
      )}

      <div style={{
        position: "sticky", bottom: 0, background: t.bg, padding: "10px 0 4px",
        borderTop: `1px solid ${t.border1}`, marginTop: 8,
      }}>
        <button
          onClick={onConcluir}
          disabled={!canConcluir}
          style={{
            width: "100%", padding: "12px 20px",
            background: canConcluir ? t.accent : t.border1,
            color: canConcluir ? "#fff" : t.textTertiary,
            border: "none", cursor: canConcluir ? "pointer" : "not-allowed",
            fontFamily: fonts.cinzel, letterSpacing: "0.14em", fontSize: 11,
            textTransform: "uppercase", borderRadius: 3,
          }}
        >
          {canConcluir ? "Concluir bloco" : `Decida as ${pending.length} tarefas antes`}
        </button>
      </div>
    </div>
  );
}

function TarefaCard({ t, tarefa, loading, selected, onToggleSel, onAprovar, onDescartar, onEditar, onEditarPrazo }: {
  t: any; tarefa: ReuniaoTarefa; loading: boolean;
  selected?: boolean; onToggleSel?: () => void;
  onAprovar: () => void; onDescartar: () => void;
  onEditar: () => void; onEditarPrazo: () => void;
}) {
  return (
    <div style={{
      padding: 12, background: selected ? t.card2 : t.card1,
      border: `1px solid ${selected ? t.accent : t.border1}`, borderRadius: 4,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        {onToggleSel && (
          <input type="checkbox" checked={!!selected} onChange={onToggleSel}
            style={{ marginTop: 3, width: 14, height: 14, cursor: "pointer", flexShrink: 0 }} />
        )}
        <div style={{ fontSize: 13, lineHeight: 1.4, flex: 1 }}>{tarefa.titulo}</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 10, color: t.textTertiary }}>
        {tarefa.responsavel_nome_falado && <span>👤 {tarefa.responsavel_nome_falado}</span>}
        <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={onEditarPrazo}>
          📅 {tarefa.prazo_data || tarefa.prazo_texto || "sem prazo"}
        </span>
        {tarefa.tipo && <span>🔖 {tarefa.tipo}</span>}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button disabled={loading} onClick={onAprovar} style={btnMini(t, "#059669", "#fff")}>Aprovar</button>
        <button disabled={loading} onClick={onEditar} style={btnMini(t)}>Editar</button>
        <button disabled={loading} onClick={onDescartar} style={btnMini(t)}>Descartar</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
function pickMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const c of candidates) {
    // @ts-ignore
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

function formatSec(s: number): string {
  const m = Math.floor(s / 60); const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function btnGhost(t: any) {
  return {
    background: "transparent", color: t.textSecondary,
    border: `1px solid ${t.border1}`, padding: "8px 14px", cursor: "pointer",
    fontFamily: fonts.inter, fontSize: 11, borderRadius: 3,
  };
}
function btnMini(t: any, bg?: string, fg?: string) {
  return {
    background: bg || t.bg, color: fg || t.textPrimary,
    border: `1px solid ${bg || t.border1}`, padding: "6px 10px", cursor: "pointer",
    fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase" as const,
    borderRadius: 3, fontFamily: fonts.inter,
  };
}
