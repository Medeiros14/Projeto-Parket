/**
 * Reunião Semanal do Cronograma — Pamela (ou quem conduzir) grava um
 * áudio por projeto (até 10min), IA transcreve, gera resumo + tarefas.
 * Ao aprovar, tarefa vai pro chat da obra (parket-chat obra_tasks).
 *
 * Mobile-first: 3 views (lista/projeto/review) trocadas via state.
 * Monitor ao vivo: SpeechRecognition mostra o que tá sendo captado.
 */
import { useEffect, useRef, useState } from "react";
import { fonts, useTokens } from "../theme";
import { api, type Reuniao, type ReuniaoAlerta, type ReuniaoBlocoReview, type ReuniaoProjetoOpt, type ReuniaoTarefa } from "../api";
import { useAuth } from "../lib/auth";

type View = "lista" | "gravando" | "review";

// Processamento em segundo plano: cada áudio enviado vira uma entrada aqui.
// Permite gravar a próxima obra enquanto a IA analisa a anterior (30-90s).
type BgProc = {
  blocoId: string;
  projetoId: string;
  nome: string;                       // nome do cliente pro banner
  status: "processando" | "pronto" | "erro";
  erro?: string;
};

const MAX_DUR_SEG = 10 * 60; // 10min por projeto

export default function ReuniaoPage() {
  const t = useTokens();
  const { appUser } = useAuth();
  const [view, setView] = useState<View>("lista");
  const [reuniao, setReuniao] = useState<Reuniao | null>(null);
  const [projetos, setProjetos] = useState<ReuniaoProjetoOpt[]>([]);
  const [ativo, setAtivo] = useState<ReuniaoProjetoOpt | null>(null);
  const [blocoReview, setBlocoReview] = useState<ReuniaoBlocoReview | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [bgProcs, setBgProcs] = useState<BgProc[]>([]);   // uploads/IA rodando em segundo plano
  const [listaTick, setListaTick] = useState(0);          // força refetch da lista quando um bg termina

  useEffect(() => {
    (async () => {
      try {
        const [projs, hoje] = await Promise.all([
          api.reuniaoProjetosCronograma(),
          api.reuniaoHoje(),
        ]);
        setProjetos(projs);
        if (hoje && hoje.id) setReuniao(hoje as Reuniao);
      } catch (e) {
        console.warn("[reuniao] init", e);
      }
    })();
  }, []);

  async function iniciarReuniao() {
    setCarregando(true);
    setMsg("");
    try {
      const r = await api.reuniaoNova({ conduzido_por: appUser?.email });
      setReuniao(r);
    } catch (e: any) {
      setMsg(`Falha ao criar reunião: ${e.message}`);
    } finally {
      setCarregando(false);
    }
  }

  async function abrirProjeto(p: ReuniaoProjetoOpt) {
    if (!reuniao) return;
    setCarregando(true);
    setMsg("");
    try {
      // Cria o bloco vazio (status=gravando) — front vai gravar e depois faz upload
      const bloco = await api.reuniaoBlocoNovo(reuniao.id, {
        projeto_id: p.id,
        projeto_nome: p.cliente,
        card_id: p.card_id || undefined,
      });
      setAtivo(p);
      setBlocoReview({ ...bloco, tarefas: [], transcricao: null, resumo: null } as any);
      setView("gravando");
    } catch (e: any) {
      setMsg(`Falha ao abrir projeto: ${e.message}`);
    } finally {
      setCarregando(false);
    }
  }

  // Dispara upload + transcrição + IA SEM travar a tela: a request roda em
  // segundo plano e a lista libera na hora pra gravar a próxima obra.
  // Quando termina, o banner avisa e o pill do projeto vira REVISAR.
  function enviarAudioBg(blocoId: string, projetoId: string, nome: string, blob: Blob, seconds: number, fname: string) {
    setBgProcs((prev) => [
      ...prev.filter((x) => x.blocoId !== blocoId),
      { blocoId, projetoId, nome, status: "processando" },
    ]);
    api.reuniaoBlocoAudio(blocoId, blob, seconds, fname)
      .then(() => {
        setBgProcs((prev) => prev.map((x) => (x.blocoId === blocoId ? { ...x, status: "pronto" } : x)));
        setListaTick((n) => n + 1);   // lista refetch → pill REVISAR
      })
      .catch((e: any) => {
        setBgProcs((prev) => prev.map((x) => (x.blocoId === blocoId ? { ...x, status: "erro", erro: String(e?.message || e) } : x)));
        setListaTick((n) => n + 1);
      });
  }

  // Chamado pelo GravarProjeto ao PARAR: manda o áudio pro bg e volta pra lista
  function onAudioGravado(blob: Blob, seconds: number, fname: string) {
    if (!blocoReview || !ativo) return;
    enviarAudioBg(blocoReview.id, ativo.id, ativo.cliente, blob, seconds, fname);
    setView("lista");
    setAtivo(null);
    setBlocoReview(null);
  }

  // Abre o review de um bloco que terminou no bg (clique no banner verde)
  async function abrirReviewBg(p: BgProc) {
    try {
      const b = await api.reuniaoBlocoReview(p.blocoId);
      setBlocoReview(b);
      setView("review");
      setBgProcs((prev) => prev.filter((x) => x.blocoId !== p.blocoId));
    } catch (e: any) {
      setMsg(`Falha ao abrir review: ${e.message}`);
    }
  }

  async function encerrarReuniao() {
    if (!reuniao) return;
    if (!confirm("Encerrar a reunião? Você não conseguirá adicionar novos projetos depois.")) return;
    try {
      await api.reuniaoEncerrar(reuniao.id);
      setReuniao(null);
      setAtivo(null);
      setBlocoReview(null);
      setView("lista");
      setMsg("Reunião encerrada.");
    } catch (e: any) {
      setMsg(`Falha ao encerrar: ${e.message}`);
    }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: t.bg, color: t.textPrimary, fontFamily: fonts.inter,
    }}>
      <TopBar
        t={t} view={view} reuniao={reuniao}
        onVoltar={() => { setView("lista"); setAtivo(null); setBlocoReview(null); }}
        onEncerrar={encerrarReuniao}
      />

      {msg && (
        <div style={{
          padding: "8px 14px", background: t.card1, borderBottom: `1px solid ${t.border1}`,
          fontSize: 11, color: t.textSecondary,
        }}>{msg}</div>
      )}

      {/* Banner de processamentos em segundo plano: amarelo = IA analisando,
          verde = pronto pra revisar (clique abre), vermelho = erro */}
      {bgProcs.length > 0 && (
        <div style={{ borderBottom: `1px solid ${t.border1}` }}>
          {bgProcs.map((p) => (
            <div key={p.blocoId}
              onClick={() => { if (p.status === "pronto") abrirReviewBg(p); }}
              style={{
                padding: "8px 14px", fontSize: 11,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                cursor: p.status === "pronto" ? "pointer" : "default",
                background: p.status === "processando" ? "rgba(245,158,11,0.12)"
                  : p.status === "pronto" ? "rgba(5,150,105,0.12)"
                  : "rgba(220,38,38,0.10)",
                color: p.status === "processando" ? "#b45309"
                  : p.status === "pronto" ? "#047857" : "#b91c1c",
              }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.status === "processando" && <>Teca analisando <b>{p.nome}</b> (30 a 90s). Pode gravar a próxima obra.</>}
                {p.status === "pronto" && <>Tarefas de <b>{p.nome}</b> prontas. Toque pra revisar.</>}
                {p.status === "erro" && <>Falha ao processar <b>{p.nome}</b>: {p.erro}</>}
              </span>
              {p.status === "erro" && (
                <button
                  onClick={(e) => { e.stopPropagation(); setBgProcs((prev) => prev.filter((x) => x.blocoId !== p.blocoId)); }}
                  style={{ background: "transparent", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: 11 }}>
                  dispensar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {view === "lista" && (
          <ListaProjetos
            t={t}
            reuniao={reuniao}
            projetos={projetos}
            carregando={carregando}
            tick={listaTick}
            bgProcs={bgProcs}
            onIniciar={iniciarReuniao}
            onProjeto={abrirProjeto}
            onOpenReview={async (blocoId) => {
              const b = await api.reuniaoBlocoReview(blocoId);
              setBlocoReview(b);
              setView("review");
            }}
          />
        )}
        {view === "gravando" && ativo && blocoReview && (
          <GravarProjeto
            t={t}
            projeto={ativo}
            onEnviar={onAudioGravado}
            onCancelar={() => { setView("lista"); setAtivo(null); }}
          />
        )}
        {view === "review" && blocoReview && (
          <ReviewBloco
            t={t}
            bloco={blocoReview}
            appEmail={appUser?.email || null}
            onAtualizar={setBlocoReview}
            onEncerrar={async () => {
              try {
                await api.reuniaoBlocoEncerrar(blocoReview.id);
                setView("lista");
                setBlocoReview(null);
                setAtivo(null);
              } catch (e: any) {
                alert(`Falha: ${e.message}`);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
function TopBar({ t, view, reuniao, onVoltar, onEncerrar }: {
  t: any; view: View; reuniao: Reuniao | null; onVoltar: () => void; onEncerrar: () => void;
}) {
  return (
    <div style={{
      padding: "12px 16px", borderBottom: `1px solid ${t.border1}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 10, background: t.card1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {view !== "lista" && (
          <button onClick={onVoltar} style={btnBack(t)} title="Voltar à lista">‹</button>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.20em" }}>
            REUNIÃO SEMANAL
          </div>
          <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {reuniao ? (reuniao.titulo || new Date(reuniao.data).toLocaleDateString("pt-BR")) : "Nenhuma em andamento"}
          </div>
        </div>
      </div>
      {view === "lista" && reuniao && (
        <button onClick={onEncerrar} style={btnGhost(t)}>Encerrar reunião</button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
function ListaProjetos({ t, reuniao, projetos, carregando, tick, bgProcs, onIniciar, onProjeto, onOpenReview }: {
  t: any; reuniao: Reuniao | null; projetos: ReuniaoProjetoOpt[]; carregando: boolean;
  tick: number; bgProcs: BgProc[];
  onIniciar: () => void; onProjeto: (p: ReuniaoProjetoOpt) => void; onOpenReview: (blocoId: string) => void;
}) {
  const [detalhe, setDetalhe] = useState<any | null>(null);
  const [busca, setBusca] = useState("");

  // tick muda quando um processamento em bg termina → refetch atualiza os pills
  useEffect(() => {
    if (!reuniao) { setDetalhe(null); return; }
    api.reuniaoDetalhe(reuniao.id).then(setDetalhe).catch(() => {});
  }, [reuniao?.id, tick]);

  const filtrados = projetos.filter((p) =>
    !busca || (p.cliente || "").toLowerCase().includes(busca.toLowerCase())
  );

  if (!reuniao) {
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 14, letterSpacing: "0.18em", color: t.textSecondary }}>
          COMEÇAR REUNIÃO DE HOJE
        </div>
        <div style={{ fontSize: 12, color: t.textTertiary, textAlign: "center", maxWidth: 340 }}>
          A cada projeto discutido, você grava um áudio (até 10min).
          A IA transcreve, gera resumo + tarefas, você revisa e as tarefas
          caem no chat da obra automaticamente.
        </div>
        <button onClick={onIniciar} disabled={carregando} style={btnPrimary(t, { pad: "14px 28px", size: 12 })}>
          {carregando ? "Criando…" : "Nova reunião"}
        </button>
      </div>
    );
  }

  const blocosPorProjeto: Record<string, any> = {};
  (detalhe?.blocos || []).forEach((b: any) => { if (b.projeto_id) blocosPorProjeto[b.projeto_id] = b; });

  return (
    <div style={{ padding: 12 }}>
      <div style={{
        padding: 10, marginBottom: 10, borderRadius: 4, background: t.card1,
        border: `1px solid ${t.border1}`, fontSize: 11, color: t.textSecondary,
      }}>
        Toque no projeto que vai ser discutido. Ao parar a gravação a IA analisa em segundo plano e você já pode gravar a próxima obra.
        {detalhe && (
          <div style={{ marginTop: 6, fontSize: 10, color: t.textTertiary }}>
            Blocos: {detalhe.n_blocos} · Aprovados: {detalhe.n_aprovados} · Review pendente: {detalhe.n_review}
          </div>
        )}
      </div>

      <input
        placeholder="Buscar projeto…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        style={{
          width: "100%", padding: "10px 12px", marginBottom: 10,
          background: t.bg, color: t.textPrimary,
          border: `1px solid ${t.border1}`, borderRadius: 4,
          fontFamily: fonts.inter, fontSize: 12, boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtrados.map((p) => {
          const bloco = blocosPorProjeto[p.id];
          // Processamento em bg deste projeto: pill vira PROCESSANDO e clique espera
          const bg = bgProcs.find((x) => x.projetoId === p.id && x.status === "processando");
          return (
            <div key={p.id}
              onClick={() => {
                if (bg) return;   // IA ainda analisando — aguarde o banner ficar verde
                if (bloco && bloco.status === "review") { onOpenReview(bloco.id); return; }
                if (bloco && bloco.status === "aprovado") { onOpenReview(bloco.id); return; }
                onProjeto(p);
              }}
              style={{
                padding: "12px 14px", borderRadius: 4, cursor: "pointer",
                background: t.card1, border: `1px solid ${t.border1}`,
                display: "flex", flexDirection: "column", gap: 4,
              }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary, minWidth: 0,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.cliente}
                </div>
                {bg ? <StatusPill status="processando" t={t} /> : bloco && <StatusPill status={bloco.status} t={t} />}
              </div>
              <div style={{ fontSize: 10, color: t.textTertiary, display: "flex", gap: 10 }}>
                {p.numero_proposta && <span>#{p.numero_proposta}</span>}
                {p.coluna_titulo && <span>· {p.coluna_titulo}</span>}
                <span>· {Math.round(p.pct_completo)}% concluído</span>
              </div>
              {bloco && bloco.n_tarefas > 0 && (
                <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 2 }}>
                  {bloco.n_tarefas_aprovadas}/{bloco.n_tarefas} tarefas · toque pra revisar
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ status, t }: { status: string; t: any }) {
  const cfg: Record<string, { label: string; bg: string; fg: string }> = {
    gravando:    { label: "GRAVANDO",    bg: "#dc2626", fg: "#fff" },
    processando: { label: "PROCESSANDO", bg: "#f59e0b", fg: "#fff" },
    review:      { label: "REVISAR",     bg: "#0284c7", fg: "#fff" },
    aprovado:    { label: "APROVADO",    bg: "#059669", fg: "#fff" },
    descartado:  { label: "DESCARTADO",  bg: t.border1, fg: t.textTertiary },
    erro:        { label: "ERRO",        bg: "#dc2626", fg: "#fff" },
  };
  const c = cfg[status] || { label: status.toUpperCase(), bg: t.border1, fg: t.textTertiary };
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 10, fontSize: 9,
      letterSpacing: "0.10em", background: c.bg, color: c.fg,
      whiteSpace: "nowrap",
    }}>{c.label}</span>
  );
}

// ═══════════════════════════════════════════════════════════════════
function GravarProjeto({ t, projeto, onEnviar, onCancelar }: {
  t: any; projeto: ReuniaoProjetoOpt;
  // Entrega o áudio pro pai processar em segundo plano (não espera a IA aqui)
  onEnviar: (blob: Blob, seconds: number, fname: string) => void;
  onCancelar: () => void;
}) {
  const [state, setState] = useState<"idle" | "gravando" | "enviando" | "erro">("idle");
  const [seconds, setSeconds] = useState(0);
  const [monitorText, setMonitorText] = useState("");
  const [err, setErr] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const recogRef = useRef<any>(null);

  useEffect(() => () => cleanup(), []); // eslint-disable-line

  function cleanup() {
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
    setErr("");
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
      // Monitor Web Speech (não é a fonte da verdade — só feedback ao vivo)
      startMonitor();
    } catch (e: any) {
      setErr(`Sem microfone: ${e.message || e}`);
      setState("erro");
    }
  }

  function startMonitor() {
    const W: any = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "pt-BR"; r.continuous = true; r.interimResults = true;
    r.onresult = (ev: any) => {
      let final = "";
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const txt = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += txt + " "; else interim += txt;
      }
      setMonitorText((prev) => (prev + (final ? final : "") + (interim ? " [" + interim + "]" : "")).slice(-1200));
    };
    r.onerror = () => {}; // silencioso — só monitor
    r.onend = () => { if (state === "gravando") { try { r.start(); } catch {} } };
    try { r.start(); recogRef.current = r; } catch {}
  }

  async function finalizar() {
    if (state !== "gravando") return;
    setState("enviando");
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

    // Entrega o áudio pro pai: upload + IA rodam em segundo plano e a lista
    // libera na hora pra gravar a próxima obra
    const ext = (blob.type.includes("mp4") ? ".m4a" : blob.type.includes("ogg") ? ".ogg" : ".webm");
    onEnviar(blob, seconds, `bloco${ext}`);
  }

  const disabled = state === "enviando";

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{projeto.cliente}</div>
      {projeto.numero_proposta && (
        <div style={{ fontSize: 11, color: t.textTertiary, marginTop: -8 }}>#{projeto.numero_proposta}</div>
      )}

      <div style={{
        margin: "20px auto 8px", position: "relative",
      }}>
        <button
          disabled={disabled}
          onClick={state === "gravando" ? finalizar : iniciar}
          style={{
            width: 140, height: 140, borderRadius: "50%",
            background: state === "gravando" ? "#dc2626" : t.accent,
            color: "#fff", border: "none", cursor: disabled ? "not-allowed" : "pointer",
            fontFamily: fonts.cinzel, letterSpacing: "0.14em", fontSize: 14,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 6,
            boxShadow: state === "gravando" ? "0 0 0 6px rgba(220,38,38,0.15)" : "0 4px 12px rgba(0,0,0,0.15)",
            transition: "background 0.2s, box-shadow 0.2s",
          }}>
          <span style={{ fontSize: 22 }}>{state === "gravando" ? "■" : "●"}</span>
          <span>{state === "gravando" ? "PARAR" : "GRAVAR"}</span>
        </button>
      </div>

      <div style={{ textAlign: "center", fontSize: 24, fontFamily: "monospace", color: t.textPrimary }}>
        {formatSec(seconds)} <span style={{ fontSize: 12, color: t.textTertiary }}>/ 10:00</span>
      </div>

      {state === "enviando" && (
        <div style={{ textAlign: "center", padding: 12, color: t.textSecondary, fontSize: 12 }}>
          Fechando gravação…
        </div>
      )}
      {err && (
        <div style={{ padding: 12, background: "#fee", color: "#c00", borderRadius: 4, fontSize: 12 }}>
          {err}
        </div>
      )}

      {monitorText && (
        <div style={{
          padding: 12, background: t.card1, border: `1px solid ${t.border1}`, borderRadius: 4,
          fontSize: 11, color: t.textSecondary, maxHeight: 180, overflowY: "auto",
        }}>
          <div style={{ fontSize: 9, letterSpacing: "0.15em", color: t.textTertiary, marginBottom: 4 }}>
            MONITOR AO VIVO
          </div>
          {monitorText}
        </div>
      )}

      {state === "idle" && (
        <button onClick={onCancelar} style={btnGhost(t)}>Voltar sem gravar</button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
function ReviewBloco({ t, bloco, appEmail, onAtualizar, onEncerrar }: {
  t: any; bloco: ReuniaoBlocoReview; appEmail: string | null;
  onAtualizar: (b: ReuniaoBlocoReview) => void; onEncerrar: () => void;
}) {
  const [salvando, setSalvando] = useState<string | null>(null);

  async function reload() {
    try { onAtualizar(await api.reuniaoBlocoReview(bloco.id)); } catch {}
  }

  async function aprovar(t2: ReuniaoTarefa) {
    setSalvando(t2.id);
    try { await api.reuniaoTarefaAprovar(t2.id, appEmail || undefined); await reload(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(null); }
  }
  async function descartar(t2: ReuniaoTarefa) {
    setSalvando(t2.id);
    try { await api.reuniaoTarefaDescartar(t2.id); await reload(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(null); }
  }
  async function editar(t2: ReuniaoTarefa) {
    const novo = prompt("Editar tarefa:", t2.titulo);
    if (!novo || novo.trim() === t2.titulo) return;
    setSalvando(t2.id);
    try { await api.reuniaoTarefaPatch(t2.id, { titulo: novo.trim() }); await reload(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(null); }
  }
  async function adicionar() {
    const titulo = prompt("Nova tarefa (título):");
    if (!titulo || !titulo.trim()) return;
    try { await api.reuniaoBlocoAddTarefa(bloco.id, { titulo: titulo.trim() }); await reload(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
  }
  async function editarPrazo(t2: ReuniaoTarefa) {
    const atual = t2.prazo_data || "";
    const novo = prompt("Prazo (YYYY-MM-DD ou vazio):", atual);
    if (novo === null) return;
    setSalvando(t2.id);
    try { await api.reuniaoTarefaPatch(t2.id, { prazo_data: novo.trim() || null }); await reload(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(null); }
  }

  async function aprovarAlerta(a: ReuniaoAlerta) {
    setSalvando(a.id);
    try { await api.reuniaoAlertaAprovar(a.id); await reload(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(null); }
  }
  async function descartarAlerta(a: ReuniaoAlerta) {
    setSalvando(a.id);
    try { await api.reuniaoAlertaDescartar(a.id); await reload(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(null); }
  }
  async function editarAlerta(a: ReuniaoAlerta) {
    const novo = prompt("Editar descrição do alerta:", a.descricao);
    if (!novo || novo.trim() === a.descricao) return;
    setSalvando(a.id);
    try { await api.reuniaoAlertaPatch(a.id, { descricao: novo.trim() }); await reload(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(null); }
  }
  async function trocarGravidade(a: ReuniaoAlerta) {
    const g = prompt("Gravidade (leve|media|grave):", a.gravidade);
    if (!g || g.trim() === a.gravidade) return;
    const gg = g.trim().toLowerCase();
    if (!["leve", "media", "grave"].includes(gg)) { alert("gravidade inválida"); return; }
    setSalvando(a.id);
    try { await api.reuniaoAlertaPatch(a.id, { gravidade: gg }); await reload(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(null); }
  }
  async function adicionarAlerta() {
    const descricao = prompt("Novo alerta (descreva o problema):");
    if (!descricao || !descricao.trim()) return;
    const g = prompt("Gravidade (leve|media|grave):", "media");
    const gg = (g || "media").trim().toLowerCase();
    if (!["leve", "media", "grave"].includes(gg)) { alert("gravidade inválida"); return; }
    try { await api.reuniaoBlocoAddAlerta(bloco.id, { descricao: descricao.trim(), gravidade: gg }); await reload(); }
    catch (e: any) { alert(`Falha: ${e.message}`); }
  }

  const alertasPending = (bloco.alertas || []).filter((x) => x.status === "pending" || x.status === "edited");
  const alertasAprovados = (bloco.alertas || []).filter((x) => x.status === "approved");
  const alertasDescartados = (bloco.alertas || []).filter((x) => x.status === "discarded");

  const pending = bloco.tarefas.filter((x) => x.status === "pending" || x.status === "edited");
  const aprovadas = bloco.tarefas.filter((x) => x.status === "approved");
  const descartadas = bloco.tarefas.filter((x) => x.status === "discarded");

  const canEncerrar = pending.length === 0 && alertasPending.length === 0;

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{bloco.projeto_nome_snapshot}</div>
        <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2 }}>
          {bloco.duracao_seg ? `${Math.round(bloco.duracao_seg)}s de áudio` : ""}
          {bloco.status === "erro" && bloco.erro_msg && (
            <span style={{ color: "#dc2626", marginLeft: 8 }}>· erro: {bloco.erro_msg}</span>
          )}
        </div>
      </div>

      {bloco.resumo && (
        <div style={{ padding: 12, background: t.card1, border: `1px solid ${t.border1}`, borderRadius: 4 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.15em", color: t.textTertiary, marginBottom: 6 }}>RESUMO</div>
          <div style={{ fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{bloco.resumo}</div>
        </div>
      )}

      <SectionHeader t={t} titulo={`ALERTAS DE RISCO (${alertasPending.length})`} />
      {alertasPending.length === 0 && alertasAprovados.length === 0 && alertasDescartados.length === 0 && (
        <div style={{ fontSize: 11, color: t.textTertiary, padding: 12 }}>
          Nenhum risco detectado nesta reunião. Se sentiu algo grave, adicione manual.
        </div>
      )}
      {alertasPending.map((a) => (
        <AlertaCard
          key={a.id} t={t} alerta={a} loading={salvando === a.id}
          onAprovar={() => aprovarAlerta(a)} onDescartar={() => descartarAlerta(a)}
          onEditar={() => editarAlerta(a)} onTrocarGravidade={() => trocarGravidade(a)}
        />
      ))}
      <button onClick={adicionarAlerta} style={btnGhost(t)}>+ Adicionar alerta manual</button>
      {alertasAprovados.length > 0 && (
        <>
          <SectionHeader t={t} titulo={`ALERTAS VIRARAM CRISE (${alertasAprovados.length})`} />
          {alertasAprovados.map((a) => (
            <div key={a.id} style={{
              padding: 10, background: t.card1, border: `1px solid ${t.border1}`, borderRadius: 4,
              fontSize: 12, color: t.textSecondary,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}>
              <span>[{a.gravidade.toUpperCase()}] {a.descricao}</span>
              {a.crise_id && <span style={{ fontSize: 9, color: t.textTertiary }}>crise {a.crise_id.slice(0, 8)}</span>}
            </div>
          ))}
        </>
      )}
      {alertasDescartados.length > 0 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: "pointer", fontSize: 10, color: t.textTertiary, padding: "6px 0" }}>
            Alertas descartados ({alertasDescartados.length})
          </summary>
          {alertasDescartados.map((a) => (
            <div key={a.id} style={{ padding: 8, fontSize: 11, color: t.textTertiary, textDecoration: "line-through" }}>
              [{a.gravidade}] {a.descricao}
            </div>
          ))}
        </details>
      )}

      <SectionHeader t={t} titulo={`TAREFAS PENDENTES (${pending.length})`} />
      {pending.length === 0 && (
        <div style={{ fontSize: 11, color: t.textTertiary, padding: 12 }}>
          Nenhuma tarefa aguardando decisão.
        </div>
      )}
      {pending.map((tk) => (
        <TarefaCard
          key={tk.id} t={t} tarefa={tk} loading={salvando === tk.id}
          onAprovar={() => aprovar(tk)} onDescartar={() => descartar(tk)}
          onEditar={() => editar(tk)} onEditarPrazo={() => editarPrazo(tk)}
        />
      ))}

      <button onClick={adicionar} style={btnGhost(t)}>+ Adicionar tarefa manual</button>

      {aprovadas.length > 0 && (
        <>
          <SectionHeader t={t} titulo={`APROVADAS (${aprovadas.length})`} />
          {aprovadas.map((tk) => (
            <div key={tk.id} style={{
              padding: 10, background: t.card1, border: `1px solid ${t.border1}`, borderRadius: 4,
              fontSize: 12, color: t.textSecondary,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}>
              <span>✓ {tk.titulo}</span>
              {tk.chat_task_id && (
                <span style={{ fontSize: 9, color: t.textTertiary }}>chat #{tk.chat_task_id}</span>
              )}
            </div>
          ))}
        </>
      )}

      {descartadas.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: 10, color: t.textTertiary, padding: "6px 0" }}>
            Descartadas ({descartadas.length})
          </summary>
          {descartadas.map((tk) => (
            <div key={tk.id} style={{ padding: 8, fontSize: 11, color: t.textTertiary, textDecoration: "line-through" }}>
              {tk.titulo}
            </div>
          ))}
        </details>
      )}

      {bloco.transcricao && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 10, letterSpacing: "0.15em", color: t.textTertiary, padding: "6px 0" }}>
            TRANSCRIÇÃO COMPLETA
          </summary>
          <div style={{ fontSize: 11, color: t.textSecondary, whiteSpace: "pre-wrap", lineHeight: 1.5, padding: 10, background: t.card1, borderRadius: 4 }}>
            {bloco.transcricao}
          </div>
        </details>
      )}

      <div style={{ position: "sticky", bottom: 0, background: t.bg, padding: "10px 0", borderTop: `1px solid ${t.border1}`, marginTop: 12 }}>
        <button
          onClick={onEncerrar}
          disabled={!canEncerrar || bloco.status === "aprovado"}
          style={{
            ...btnPrimary(t),
            width: "100%",
            opacity: canEncerrar && bloco.status !== "aprovado" ? 1 : 0.5,
          }}>
          {bloco.status === "aprovado"
            ? "Bloco já aprovado"
            : canEncerrar
            ? "Encerrar review"
            : `Decida ${pending.length} tarefa(s) e ${alertasPending.length} alerta(s) antes`}
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ t, titulo }: { t: any; titulo: string }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: "0.18em", color: t.textTertiary,
      padding: "4px 0", marginTop: 6,
    }}>{titulo}</div>
  );
}

function AlertaCard({ t, alerta, loading, onAprovar, onDescartar, onEditar, onTrocarGravidade }: {
  t: any; alerta: ReuniaoAlerta; loading: boolean;
  onAprovar: () => void; onDescartar: () => void;
  onEditar: () => void; onTrocarGravidade: () => void;
}) {
  const cor = alerta.gravidade === "grave" ? "#B85B4C"
    : alerta.gravidade === "media" ? "#C7A45B"
    : "#8CA9B8";
  return (
    <div style={{
      padding: 12, background: t.card1, border: `1px solid ${t.border1}`, borderRadius: 4,
      borderLeft: `3px solid ${cor}`,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ fontSize: 13, lineHeight: 1.4 }}>{alerta.descricao}</div>
      {alerta.evidencia && (
        <div style={{
          fontSize: 11, color: t.textSecondary, fontStyle: "italic",
          padding: "6px 8px", borderLeft: `2px solid ${t.border2}`, background: t.card2,
        }}>
          "{alerta.evidencia}"
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 10, color: t.textTertiary }}>
        <span onClick={onTrocarGravidade} style={{
          cursor: "pointer", padding: "2px 8px", background: cor, color: "#fff",
          borderRadius: 2, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
        }}>
          {alerta.gravidade}
        </span>
        <span>Aprovar cria crise no /crises com essa obra</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button disabled={loading} onClick={onAprovar} style={btnMini(t, cor, "#fff")}>
          Aprovar (virar crise)
        </button>
        <button disabled={loading} onClick={onEditar} style={btnMini(t)}>Editar</button>
        <button disabled={loading} onClick={onDescartar} style={btnMini(t)}>Descartar</button>
      </div>
    </div>
  );
}

function TarefaCard({ t, tarefa, loading, onAprovar, onDescartar, onEditar, onEditarPrazo }: {
  t: any; tarefa: ReuniaoTarefa; loading: boolean;
  onAprovar: () => void; onDescartar: () => void; onEditar: () => void; onEditarPrazo: () => void;
}) {
  return (
    <div style={{
      padding: 12, background: t.card1, border: `1px solid ${t.border1}`, borderRadius: 4,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ fontSize: 13, lineHeight: 1.4 }}>{tarefa.titulo}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 10, color: t.textTertiary }}>
        {tarefa.responsavel_nome_falado && (
          <span>👤 {tarefa.responsavel_nome_falado}</span>
        )}
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

function btnPrimary(t: any, opts: { pad?: string; size?: number } = {}) {
  return {
    background: t.accent, color: "#fff", border: "none",
    padding: opts.pad || "12px 20px", cursor: "pointer",
    fontFamily: fonts.cinzel, letterSpacing: "0.14em", fontSize: opts.size || 11,
    textTransform: "uppercase" as const, borderRadius: 3,
  };
}
function btnGhost(t: any) {
  return {
    background: "transparent", color: t.textSecondary,
    border: `1px solid ${t.border1}`, padding: "8px 14px", cursor: "pointer",
    fontFamily: fonts.inter, fontSize: 11, borderRadius: 3,
  };
}
function btnBack(t: any) {
  return {
    background: "transparent", color: t.textPrimary,
    border: `1px solid ${t.border1}`,
    width: 30, height: 30, cursor: "pointer",
    fontSize: 20, borderRadius: 4,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    lineHeight: 1,
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
