import React, { useEffect, useMemo, useRef, useState } from "react";
import { fonts, useTokens } from "../theme";
import { api, type ChatObraTaskComment, type ChatUser, type PdcaFase, type TarefaAnaliseIa, type TarefaAnexo, type TarefaPdca } from "../api";
import { FormatBar, RichText } from "../components/RichText";

/** Tarefas — kanban geral de TODAS as tarefas aprovadas nas reuniões
 *  semanais (todas as obras). Etapas: ENTRADA → ANALISANDO → FAZENDO →
 *  FINALIZADO, com drag-and-drop entre etapas. As keys internas seguem
 *  plan/do/check/act (persistidas em meta.pdca no backend) — só os rótulos
 *  mudaram (Will 26/08), então nenhuma tarefa existente perde a fase.
 *  Estrutura no molde do Gestor de Crises (estilo Trello): card clicável
 *  abre modal detalhe com título editável, fase/responsável/prazo inline,
 *  timeline de comentários do chat da obra e marcar feita/reabrir.
 *  Card também mostra o resumo do bloco da reunião e botão pra ver a
 *  transcrição completa do áudio (busca no /bloco/{id}/review). */

const FASES: { id: PdcaFase; label: string; hint: string; cor: string }[] = [
  { id: "plan",  label: "ENTRADA",    hint: "Chegou da reunião, ainda não começou", cor: "#8CA9B8" },
  { id: "do",    label: "ANALISANDO", hint: "Em análise e planejamento",            cor: "#b08cc9" },
  { id: "check", label: "FAZENDO",    hint: "Em execução pelo responsável",         cor: "#c7a45b" },
  { id: "act",   label: "FINALIZADO", hint: "Concluída ou padronizada",             cor: "#3fa96b" },
];

/** Dias até o prazo (negativo = vencido). null sem prazo. */
function diasParaPrazo(tf: TarefaPdca): number | null {
  if (!tf.prazo_data) return null;
  const alvo = new Date(`${tf.prazo_data.slice(0, 10)}T23:59:59`).getTime();
  return Math.floor((alvo - Date.now()) / 86400000);
}

/** Tarefa está vencida (prazo passou e não foi feita no chat). */
function prazoVencido(tf: TarefaPdca): boolean {
  const d = diasParaPrazo(tf);
  return d !== null && d < 0 && tf.chat_done !== true;
}

/** Cor de destaque do card conforme prazo: vermelho vencido, amarelo se
 *  falta ≤2 dias, senão null (igual ao Gestor de Crises). */
function corPrazo(tf: TarefaPdca): string | null {
  if (tf.chat_done === true) return null;
  const d = diasParaPrazo(tf);
  if (d === null) return null;
  if (d < 0) return "#d05a3b";
  if (d <= 2) return "#c7a45b";
  return null;
}

/** Dias desde a aprovação da tarefa (idade no quadro). */
function diasAberta(tf: TarefaPdca): number {
  const ini = new Date(tf.decidido_em || tf.created_at).getTime();
  return Math.max(0, Math.floor((Date.now() - ini) / 86400000));
}

function fmtData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("pt-BR");
}

export default function TarefasPage() {
  const t = useTokens();
  const [tarefas, setTarefas] = useState<TarefaPdca[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [busca, setBusca] = useState("");
  const [obraSel, setObraSel] = useState("");
  const [detalhe, setDetalhe] = useState<TarefaPdca | null>(null);
  const [transcricaoDe, setTranscricaoDe] = useState<TarefaPdca | null>(null); // tarefa cujo áudio será exibido
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<PdcaFase | null>(null);

  useEffect(() => {
    setLoading(true);
    api.tarefasKanban()
      .then((r) => { setTarefas(r); setErro(null); })
      .catch((e) => setErro(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, [tick]);

  // Obras distintas pro filtro (nome do snapshot do bloco da reunião)
  const obras = useMemo(() => {
    const s = new Set<string>();
    for (const tf of tarefas) if (tf.projeto_nome) s.add(tf.projeto_nome);
    return [...s].sort();
  }, [tarefas]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tarefas.filter((tf) => {
      if (obraSel && tf.projeto_nome !== obraSel) return false;
      if (!q) return true;
      return [tf.titulo, tf.projeto_nome, tf.responsavel_nome_falado, tf.responsavel_email]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [tarefas, busca, obraSel]);

  const porFase = useMemo(() => {
    const m: Record<PdcaFase, TarefaPdca[]> = { plan: [], do: [], check: [], act: [] };
    for (const tf of visiveis) (m[tf.pdca] || m.plan).push(tf);
    return m;
  }, [visiveis]);

  const stats = useMemo(() => ({
    total: visiveis.length,
    vencidas: visiveis.filter((tf) => prazoVencido(tf) && tf.pdca !== "act").length,
    concluidas: visiveis.filter((tf) => tf.chat_done === true).length,
    obras: new Set(visiveis.map((tf) => tf.projeto_nome).filter(Boolean)).size,
  }), [visiveis]);

  /** Move fase com update otimista; erro recarrega do servidor. */
  async function mover(id: string, fase: PdcaFase) {
    const tf = tarefas.find((x) => x.id === id);
    if (!tf || tf.pdca === fase) return;
    setTarefas((prev) => prev.map((x) => (x.id === id ? { ...x, pdca: fase } : x)));
    try { await api.tarefaPdcaMover(id, fase); }
    catch (e) { alert(`Erro ao mover: ${e}`); setTick((x) => x + 1); }
  }

  /** Marca/desmarca feita no chat direto do card (botão rápido). */
  async function toggleFeita(tf: TarefaPdca) {
    if (!tf.chat_task_id) return;
    try {
      const r = await api.cardTarefaToggle(tf.chat_task_id);
      setTarefas((prev) => prev.map((x) => (x.id === tf.id ? { ...x, chat_done: !!r.done } : x)));
    } catch (e) { alert(`Erro ao marcar feita: ${e}`); }
  }

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "20px 32px 40px" }}>
      <header style={{ marginBottom: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.22em", color: t.textPrimary }}>
            OPERAÇÕES · TAREFAS DAS REUNIÕES
          </div>
          <div style={{ fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.06em", color: t.textTertiary, marginTop: 4 }}>
            Toda tarefa aprovada nas reuniões semanais, de todas as obras. Arraste entre as etapas. Clique no card pra abrir o detalhe.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar tarefa, obra ou responsável"
            style={{
              width: 240, boxSizing: "border-box", padding: "8px 10px",
              background: t.card2, border: `1px solid ${t.border1}`, color: t.textPrimary,
              outline: "none", fontFamily: fonts.inter, fontSize: 11,
            }}
          />
          <select
            value={obraSel} onChange={(e) => setObraSel(e.target.value)}
            style={{
              maxWidth: 220, padding: "8px 10px", background: t.card2,
              border: `1px solid ${t.border1}`, color: t.textPrimary,
              outline: "none", fontFamily: fonts.inter, fontSize: 11,
            }}
          >
            <option value="">Todas as obras</option>
            {obras.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
        <KPI t={t} label="Tarefas" v={stats.total} />
        <KPI t={t} label="Prazo vencido" v={stats.vencidas} cor={stats.vencidas > 0 ? "#d05a3b" : undefined} />
        <KPI t={t} label="Concluídas no chat" v={stats.concluidas} cor="#3fa96b" />
        <KPI t={t} label="Obras envolvidas" v={stats.obras} />
      </div>

      {loading && <div style={{ padding: 20, color: t.textTertiary, fontFamily: fonts.inter, fontSize: 11 }}>Carregando…</div>}
      {erro && <div style={{ padding: 20, color: "#d05a3b", fontFamily: fonts.inter, fontSize: 11 }}>Erro: {erro}</div>}

      {!loading && !erro && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(230px, 1fr))", gap: 12, alignItems: "start", overflowX: "auto" }}>
          {FASES.map((col) => (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
              onDragLeave={() => setDragOver((d) => (d === col.id ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = dragId.current || e.dataTransfer.getData("text/plain");
                if (id) mover(id, col.id);
                dragId.current = null;
              }}
              style={{
                background: t.card2,
                border: `1px solid ${dragOver === col.id ? col.cor : t.border1}`,
                minHeight: 220, display: "flex", flexDirection: "column",
              }}
            >
              <div style={{ padding: "10px 12px", borderBottom: `2px solid ${col.cor}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.2em", color: col.cor }}>
                    {col.label}
                  </span>
                  <span style={{ fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary }}>
                    {porFase[col.id].length}
                  </span>
                </div>
                <div style={{ fontFamily: fonts.inter, fontSize: 8.5, color: t.textTertiary, marginTop: 3 }}>
                  {col.hint}
                </div>
              </div>
              <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {porFase[col.id].length === 0 && (
                  <div style={{ padding: "14px 6px", fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary, textAlign: "center" }}>
                    Nenhuma tarefa nesta fase.
                  </div>
                )}
                {porFase[col.id].map((tf) => (
                  <TarefaCard
                    key={tf.id} tf={tf} t={t} cor={col.cor}
                    onDragStart={() => { dragId.current = tf.id; }}
                    onAbrir={() => setDetalhe(tf)}
                    onFeita={tf.chat_task_id && tf.chat_done !== true ? () => toggleFeita(tf) : undefined}
                    onTranscricao={() => setTranscricaoDe(tf)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {detalhe && (
        <TarefaDetalheModal
          tarefa={detalhe} t={t}
          onFechar={() => setDetalhe(null)}
          onMudou={() => setTick((x) => x + 1)}
        />
      )}

      {transcricaoDe && (
        <TranscricaoModal tf={transcricaoDe} t={t} onFechar={() => setTranscricaoDe(null)} />
      )}
    </div>
  );
}

function KPI({ t, label, v, cor }: { t: any; label: string; v: number; cor?: string }) {
  return (
    <div style={{ background: t.card2, border: `1px solid ${t.border1}`, padding: "12px 14px" }}>
      <div style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: t.textTertiary }}>
        {label}
      </div>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 22, color: cor || t.textPrimary, marginTop: 4 }}>{v}</div>
    </div>
  );
}

/* ═══ Card da tarefa (molde do CriseCard do Gestor de Crises) ═══════
   Header: nome da obra em cinzel + badge de status (FEITA/VENCIDA).
   Corpo: texto da tarefa + resumo do bloco da reunião (clampado).
   Meta: responsável, prazo, reunião, idade. Clique abre o modal detalhe;
   botões rápidos: marcar feita no chat e ver a transcrição do áudio. */
function TarefaCard({ tf, t, cor, onDragStart, onAbrir, onFeita, onTranscricao }: {
  tf: TarefaPdca; t: any; cor: string; onDragStart: () => void;
  onAbrir: () => void; onFeita?: () => void; onTranscricao: () => void;
}) {
  const vencido = prazoVencido(tf);
  const alertaPrazo = corPrazo(tf);
  const feita = tf.chat_done === true;
  const resp = tf.responsavel_nome_falado || tf.responsavel_email || null;
  const dias = diasAberta(tf);
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", tf.id); onDragStart(); }}
      onClick={onAbrir}
      style={{
        background: t.card1 || t.card2, border: `1px solid ${t.border2}`,
        borderLeft: `3px solid ${feita ? "#3fa96b" : cor}`,
        borderTop: alertaPrazo ? `3px solid ${alertaPrazo}` : `1px solid ${t.border2}`,
        padding: "10px 12px", cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.1em", color: t.textPrimary, flex: 1 }}>
          {(tf.projeto_nome || "SEM OBRA").toUpperCase()}
        </span>
        {feita && (
          <span style={{
            fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "2px 7px", border: "1px solid #3fa96b", color: "#3fa96b",
          }}>Feita</span>
        )}
        {!feita && vencido && (
          <span style={{
            fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "2px 7px", border: "1px solid #d05a3b", color: "#d05a3b",
          }}>Vencida</span>
        )}
      </div>
      <div style={{ fontFamily: fonts.inter, fontSize: 10.5, color: t.textSecondary, marginTop: 6, whiteSpace: "pre-wrap" }}>
        {tf.titulo}
      </div>
      {/* Resumo do bloco da reunião (bullets da IA), clampado em 3 linhas */}
      {tf.bloco_resumo && (
        <div style={{
          fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary, marginTop: 6,
          whiteSpace: "pre-wrap", overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as any,
          borderLeft: `2px solid ${t.border2}`, paddingLeft: 8,
        }}>
          {tf.bloco_resumo}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary }}>
        {resp && <span>Resp.: <b style={{ color: t.textSecondary }}>{resp}</b></span>}
        {tf.prazo_data && (
          <span style={{ color: vencido ? "#d05a3b" : undefined }}>
            Prazo {fmtData(tf.prazo_data)}{vencido ? " · VENCIDO" : ""}
          </span>
        )}
        {!tf.prazo_data && tf.prazo_texto && <span>Prazo: {tf.prazo_texto}</span>}
        <span>Reunião {fmtData(tf.reuniao_data)}</span>
        <span style={{ color: !feita && dias >= 7 ? "#d05a3b" : undefined }}>
          {feita ? `Concluída (${fmtData(tf.chat_done_at)})` : `${dias}d em aberto`}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {onFeita && (
          <button
            onClick={(e) => { e.stopPropagation(); onFeita(); }}
            style={{
              fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.12em",
              textTransform: "uppercase", padding: "5px 10px", cursor: "pointer",
              background: "transparent", color: "#3fa96b", border: "1px solid #3fa96b",
            }}
          >Feita</button>
        )}
        {/* Abre a transcrição completa do áudio do bloco da reunião */}
        <button
          onClick={(e) => { e.stopPropagation(); onTranscricao(); }}
          style={{
            fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.12em",
            textTransform: "uppercase", padding: "5px 10px", cursor: "pointer",
            background: "transparent", color: t.textSecondary, border: `1px solid ${t.border2}`,
          }}
        >Transcrição</button>
      </div>
    </div>
  );
}

/* ═══ Modal da transcrição do áudio do bloco da reunião ═════════════
   Busca o bloco no /bloco/{id}/review e mostra resumo + transcrição
   completa do Whisper. Abre por cima do kanban ou do modal detalhe. */
function TranscricaoModal({ tf, t, onFechar }: {
  tf: TarefaPdca; t: any; onFechar: () => void;
}) {
  const [resumo, setResumo] = useState<string | null>(tf.bloco_resumo);
  const [transcricao, setTranscricao] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Carrega o bloco (transcrição não vem no payload do kanban por ser pesada)
  useEffect(() => {
    api.reuniaoBlocoReview(tf.bloco_id)
      .then((b) => {
        setResumo(b.resumo || tf.bloco_resumo);
        setTranscricao(b.transcricao || null);
        setErro(null);
      })
      .catch((e) => setErro(String(e?.message || e)))
      .finally(() => setCarregando(false));
  }, [tf.bloco_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const label: React.CSSProperties = {
    fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.14em",
    textTransform: "uppercase", color: t.textTertiary, marginBottom: 6, display: "block",
  };

  return (
    <div
      onClick={onFechar}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        background: t.bg || t.card2, border: `1px solid ${t.border1}`,
        width: "min(720px, 96vw)", maxHeight: "88vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "14px 20px", borderBottom: `1px solid ${t.border1}`,
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.16em", color: t.textPrimary }}>
              {(tf.projeto_nome || "SEM OBRA").toUpperCase()}
            </div>
            <div style={{ fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary, marginTop: 2 }}>
              Áudio da reunião de {fmtData(tf.reuniao_data)}
            </div>
          </div>
          <button onClick={onFechar} style={{
            background: "transparent", border: "none", color: t.textTertiary,
            cursor: "pointer", fontSize: 18, padding: 4,
          }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: 20 }}>
          {resumo && (
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Resumo</label>
              <div style={{
                background: t.card1 || t.card2, border: `1px solid ${t.border1}`,
                padding: "10px 12px", whiteSpace: "pre-wrap",
                fontFamily: fonts.inter, fontSize: 11, color: t.textSecondary, lineHeight: 1.6,
              }}>{resumo}</div>
            </div>
          )}
          <label style={label}>Transcrição do áudio</label>
          {carregando && (
            <div style={{ fontFamily: fonts.inter, fontSize: 11, color: t.textTertiary }}>Carregando transcrição…</div>
          )}
          {erro && (
            <div style={{ fontFamily: fonts.inter, fontSize: 11, color: "#d05a3b" }}>Erro ao carregar: {erro}</div>
          )}
          {!carregando && !erro && !transcricao && (
            <div style={{ fontFamily: fonts.inter, fontSize: 11, color: t.textTertiary, fontStyle: "italic" }}>
              Este bloco não tem transcrição salva.
            </div>
          )}
          {transcricao && (
            <div style={{
              background: t.card1 || t.card2, border: `1px solid ${t.border1}`,
              padding: "10px 12px", whiteSpace: "pre-wrap",
              fontFamily: fonts.inter, fontSize: 11, color: t.textSecondary, lineHeight: 1.7,
            }}>{transcricao}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = (t: any): React.CSSProperties => ({
  width: "100%", boxSizing: "border-box", padding: "8px 10px",
  background: t.card2, border: `1px solid ${t.border1}`, color: t.textPrimary,
  outline: "none", fontFamily: fonts.inter, fontSize: 11,
});

/* ═══ Modal detalhe da tarefa (estilo Trello, molde do CriseDetalheModal) ═══
   Header: obra + badges fase/feita + link chat da obra.
   Esquerda: texto da tarefa editável + timeline de comentários do chat
   da tarefa (obra_tasks) com composer.
   Direita: fase PDCA / responsável / prazo editáveis inline + marcar
   feita/reabrir + ficha (tipo, reunião, aprovação). */
function TarefaDetalheModal({ tarefa, t, onFechar, onMudou }: {
  tarefa: TarefaPdca; t: any; onFechar: () => void; onMudou: () => void;
}) {
  const [tf, setTf] = useState<TarefaPdca>(tarefa);
  const [comentarios, setComentarios] = useState<ChatObraTaskComment[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [carregando, setCarregando] = useState(!!tarefa.chat_task_id);
  const [tituloDraft, setTituloDraft] = useState(tarefa.titulo);
  const [editTitulo, setEditTitulo] = useState(false);
  const [respDraft, setRespDraft] = useState(tarefa.responsavel_nome_falado || "");
  const [novoTexto, setNovoTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [verTranscricao, setVerTranscricao] = useState(false); // modal da transcrição do áudio
  const comRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Anexos (por tarefa) e análise IA vivem em meta — modelo do /crises.
  const [novosAnexos, setNovosAnexos] = useState<TarefaAnexo[]>([]);
  const [uploadando, setUploadando] = useState(false);
  const [analise, setAnalise] = useState<TarefaAnaliseIa | null>(tarefa.meta?.analise_ia || null);
  const [analisando, setAnalisando] = useState(false);
  const anexosDaTarefa: TarefaAnexo[] = tf.meta?.anexos || [];

  // Comentários da tarefa no chat + usuários (pra resolver sender_id → nome)
  async function reloadComentarios() {
    if (!tf.chat_task_id) return;
    setCarregando(true);
    try {
      const [r, us] = await Promise.all([
        api.cardTarefaComments(tf.chat_task_id),
        users.length ? Promise.resolve(users) : api.chatUsers().catch(() => [] as ChatUser[]),
      ]);
      setComentarios((r.comments || []).filter((c) => !c.deleted));
      if (!users.length) setUsers(us);
    } catch (e) {
      console.warn("[tarefa comments]", e);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { reloadComentarios(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nomeDe = (uid: string) => users.find((u) => u.id === uid)?.name || "usuário";

  /** PATCH no gestão (reuniao_tarefa_sugerida) + avisa o quadro. */
  async function patchGestao(p: any, otimista: Partial<TarefaPdca>) {
    setSalvando(true);
    try {
      await api.reuniaoTarefaPatch(tf.id, p);
      setTf((prev) => ({ ...prev, ...otimista }));
      onMudou();
    } catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(false); }
  }

  async function salvarTitulo() {
    const novo = tituloDraft.trim();
    if (!novo) { alert("O texto da tarefa não pode ficar vazio."); return; }
    await patchGestao({ titulo: novo }, { titulo: novo });
    // Mantém o espelho no chat da obra com o mesmo texto
    if (tf.chat_task_id) {
      try { await api.cardTarefaPatch(tf.chat_task_id, { title: novo }); }
      catch (e) { console.warn("[sync chat title]", e); }
    }
    setEditTitulo(false);
  }

  async function mudarFase(fase: PdcaFase) {
    setSalvando(true);
    try {
      await api.tarefaPdcaMover(tf.id, fase);
      setTf((prev) => ({ ...prev, pdca: fase }));
      onMudou();
    } catch (e: any) { alert(`Falha ao mover: ${e.message}`); }
    finally { setSalvando(false); }
  }

  async function salvarResp() {
    const nome = respDraft.trim();
    if (nome === (tf.responsavel_nome_falado || "")) return;
    await patchGestao({ responsavel_nome_falado: nome }, { responsavel_nome_falado: nome || null });
  }

  async function mudarPrazo(iso: string) {
    await patchGestao({ prazo_data: iso || "" }, { prazo_data: iso || null });
    // Prazo também vira due_date da tarefa no chat da obra
    if (tf.chat_task_id) {
      try { await api.cardTarefaPatch(tf.chat_task_id, { due_date: iso || null }); }
      catch (e) { console.warn("[sync chat due]", e); }
    }
  }

  async function toggleFeita() {
    if (!tf.chat_task_id) return;
    setSalvando(true);
    try {
      const r = await api.cardTarefaToggle(tf.chat_task_id);
      setTf((prev) => ({ ...prev, chat_done: !!r.done, chat_done_at: r.done ? new Date().toISOString() : null }));
      onMudou();
    } catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(false); }
  }

  async function comentar() {
    const txt = novoTexto.trim();
    if ((!txt && novosAnexos.length === 0) || !tf.chat_task_id) return;
    setSalvando(true);
    try {
      await api.cardTarefaComment(tf.chat_task_id, txt, novosAnexos);
      setNovoTexto("");
      setNovosAnexos([]);
      await reloadComentarios();
    } catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(false); }
  }

  /** Sobe arquivo(s) pro bucket e adiciona no batch do comentário. */
  async function anexar(files: FileList | null) {
    if (!files || !files.length) return;
    setUploadando(true);
    try {
      const salvos: TarefaAnexo[] = [];
      for (const f of Array.from(files)) {
        const a = await api.reuniaoTarefaAnexoUpload(tf.id, f);
        salvos.push(a);
      }
      setNovosAnexos((p) => [...p, ...salvos]);
      // Meta.anexos foi atualizado no backend — mantém local tb pra listar embaixo
      setTf((prev) => ({
        ...prev,
        meta: { ...(prev.meta || {}), anexos: [...(prev.meta?.anexos || []), ...salvos] },
      }));
    } catch (e: any) { alert(`Falha upload: ${e.message}`); }
    finally { setUploadando(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  /** Gera (ou regenera) a análise IA da tarefa. */
  async function analisar(force = false) {
    setAnalisando(true);
    try {
      const r = await api.reuniaoTarefaAnaliseIa(tf.id, force);
      setAnalise(r);
      setTf((prev) => ({ ...prev, meta: { ...(prev.meta || {}), analise_ia: r } }));
    } catch (e: any) { alert(`Falha análise IA: ${e.message}`); }
    finally { setAnalisando(false); }
  }

  const fase = FASES.find((f) => f.id === tf.pdca) || FASES[0];
  const feita = tf.chat_done === true;
  const vencido = prazoVencido(tf);

  const label: React.CSSProperties = {
    fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.14em",
    textTransform: "uppercase", color: t.textTertiary, marginBottom: 4, display: "block",
  };
  const box: React.CSSProperties = {
    background: t.card1 || t.card2, border: `1px solid ${t.border1}`,
    padding: "10px 12px",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div style={{
        background: t.bg || t.card2, border: `1px solid ${t.border1}`,
        width: "min(880px, 96vw)", maxHeight: "92vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 20px", borderBottom: `1px solid ${t.border1}`,
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <span style={{ width: 6, height: 24, background: feita ? "#3fa96b" : fase.cor, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.16em", color: t.textPrimary }}>
              {(tf.projeto_nome || "SEM OBRA").toUpperCase()}
            </div>
            <div style={{ fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary, marginTop: 2 }}>
              Reunião de {fmtData(tf.reuniao_data)}
              {" · "}{diasAberta(tf)}d no quadro
              {tf.decidido_por ? ` · aprovada por ${tf.decidido_por}` : ""}
            </div>
          </div>
          <span style={{
            fontFamily: fonts.inter, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "3px 10px", border: `1px solid ${fase.cor}`, color: fase.cor,
          }}>{fase.label}</span>
          {feita && (
            <span style={{
              fontFamily: fonts.inter, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase",
              padding: "3px 10px", border: "1px solid #3fa96b", color: "#3fa96b",
            }}>Feita</span>
          )}
          {!feita && vencido && (
            <span style={{
              fontFamily: fonts.inter, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase",
              padding: "3px 10px", border: "1px solid #d05a3b", color: "#d05a3b",
            }}>Vencida</span>
          )}
          {tf.card_id && (
            <a href={`https://chat.parket.works/obra/${tf.card_id}`}
               target="_blank" rel="noreferrer"
               title="Abrir a conversa da obra no chat"
               style={{
                 fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                 padding: "5px 10px", background: "transparent", color: t.textSecondary,
                 border: `1px solid ${t.border2}`, cursor: "pointer", textDecoration: "none",
               }}>Chat da obra ↗</a>
          )}
          <button onClick={onFechar} style={{
            background: "transparent", border: "none", color: t.textTertiary,
            cursor: "pointer", fontSize: 18, padding: 4, marginLeft: 4,
          }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {/* Lado esquerdo: texto da tarefa + timeline de comentários */}
          <div style={{ overflowY: "auto", padding: 20, borderRight: `1px solid ${t.border1}` }}>
            <label style={label}>Tarefa</label>
            {editTitulo ? (
              <div>
                <textarea value={tituloDraft} onChange={(e) => setTituloDraft(e.target.value)} rows={4}
                  style={{ ...inputStyle(t), resize: "vertical", marginBottom: 6 }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button disabled={salvando} onClick={salvarTitulo} style={{
                    fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                    padding: "6px 14px", background: fase.cor, color: "#050505", border: `1px solid ${fase.cor}`, cursor: "pointer",
                  }}>Salvar</button>
                  <button onClick={() => { setTituloDraft(tf.titulo); setEditTitulo(false); }} style={{
                    fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                    padding: "6px 14px", background: "transparent", color: t.textSecondary, border: `1px solid ${t.border2}`, cursor: "pointer",
                  }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div onClick={() => { setTituloDraft(tf.titulo); setEditTitulo(true); }}
                title="Clique pra editar"
                style={{ ...box, whiteSpace: "pre-wrap", cursor: "text", fontSize: 12, color: t.textPrimary, lineHeight: 1.5 }}>
                {tf.titulo}
              </div>
            )}

            {/* Resumo do bloco da reunião + acesso à transcrição completa */}
            {tf.bloco_resumo && (
              <div style={{ marginTop: 16 }}>
                <label style={label}>Resumo da reunião</label>
                <div style={{ ...box, whiteSpace: "pre-wrap", fontSize: 11, color: t.textSecondary, lineHeight: 1.6, fontFamily: fonts.inter }}>
                  {tf.bloco_resumo}
                </div>
              </div>
            )}
            <button onClick={() => setVerTranscricao(true)} style={{
              marginTop: 10, fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.12em",
              textTransform: "uppercase", padding: "6px 12px", cursor: "pointer",
              background: "transparent", color: t.textSecondary, border: `1px solid ${t.border2}`,
            }}>Ver transcrição do áudio</button>

            {/* Análise da IA — diagnóstico + próximos passos (modelo do /crises) */}
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={label}>Análise da IA</label>
              <button disabled={analisando} onClick={() => analisar(!!analise)} style={{
                fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.12em",
                textTransform: "uppercase", padding: "6px 12px",
                cursor: analisando ? "default" : "pointer", opacity: analisando ? 0.5 : 1,
                background: "transparent", color: t.textSecondary, border: `1px solid ${t.border2}`,
              }}>
                {analisando ? "Analisando…" : analise ? "Regenerar análise" : "Gerar análise IA"}
              </button>
            </div>
            {analise ? (
              <div style={{ ...box, marginTop: 6, whiteSpace: "pre-wrap", fontSize: 11, color: t.textSecondary, lineHeight: 1.6, fontFamily: fonts.inter }}>
                {analise.texto}
                <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 8, letterSpacing: "0.06em" }}>
                  {analise.gerada_em ? `gerada ${fmtData(analise.gerada_em)}` : ""}
                  {analise.conv_msgs != null && ` · ${analise.conv_msgs} comentário(s) do chat considerado(s)`}
                </div>
              </div>
            ) : (
              <div style={{ ...box, marginTop: 6, fontSize: 11, color: t.textTertiary, fontStyle: "italic", fontFamily: fonts.inter }}>
                Sem análise ainda. Clique acima para a IA olhar a tarefa, o resumo da reunião e os comentários no chat e sugerir 3 próximos passos.
              </div>
            )}

            {/* Anexos permanentes da tarefa */}
            {anexosDaTarefa.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <label style={label}>Anexos</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {anexosDaTarefa.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{
                      ...box, textDecoration: "none", color: t.textSecondary, fontSize: 11,
                      fontFamily: fonts.inter, display: "flex", justifyContent: "space-between", gap: 8,
                    }}>
                      <span>{a.name}</span>
                      <span style={{ color: t.textTertiary, fontSize: 10 }}>{(a.mime || "arquivo").split("/")[0]}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 20, marginBottom: 6 }}>
              <label style={label}>Registro do tratamento</label>
            </div>
            {!tf.chat_task_id && (
              <div style={{ ...box, fontSize: 11, color: t.textTertiary, fontStyle: "italic" }}>
                Tarefa sem espelho no chat da obra. Comentários e conclusão ficam indisponíveis.
              </div>
            )}
            {tf.chat_task_id && carregando && (
              <div style={{ fontSize: 11, color: t.textTertiary, fontFamily: fonts.inter }}>Carregando histórico…</div>
            )}
            {tf.chat_task_id && !carregando && comentarios.length === 0 && (
              <div style={{ fontSize: 11, color: t.textTertiary, fontStyle: "italic", fontFamily: fonts.inter }}>
                Nenhum registro ainda. Escreva abaixo pra documentar cada tratativa — vai pro thread da tarefa no chat.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {comentarios.map((cm) => (
                <div key={cm.id} style={{ ...box, borderLeft: `3px solid ${t.accent}` }}>
                  <div style={{ fontSize: 9, color: t.textTertiary, marginBottom: 4, letterSpacing: "0.06em", fontFamily: fonts.inter }}>
                    <b style={{ color: t.textSecondary }}>{nomeDe(cm.sender_id)}</b>
                    {" · "}{fmtData(cm.created_at)}
                    {cm.edited_at && " · editado"}
                  </div>
                  <RichText texto={cm.content} t={t} />
                </div>
              ))}
            </div>

            {tf.chat_task_id && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                <FormatBar textareaRef={comRef} value={novoTexto} onChange={setNovoTexto} t={t} />
                {/* preview dos anexos pendentes pro próximo comentário */}
                {novosAnexos.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {novosAnexos.map((a, i) => (
                      <span key={i} style={{
                        background: t.bg, border: `1px solid ${t.border2}`,
                        padding: "3px 8px", fontSize: 10, color: t.textSecondary, fontFamily: fonts.inter,
                        display: "inline-flex", alignItems: "center", gap: 6,
                      }}>
                        {a.name}
                        <button title="Remover" onClick={() => setNovosAnexos((p) => p.filter((_, j) => j !== i))}
                          style={{ background: "transparent", border: "none", color: t.textTertiary, cursor: "pointer", padding: 0, fontSize: 12 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <input ref={fileRef} type="file" multiple hidden onChange={(e) => anexar(e.target.files)} />
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea ref={comRef}
                    value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} rows={3}
                    placeholder="Escreva um comentário… vai pro thread da tarefa no chat da obra"
                    style={{ ...inputStyle(t), resize: "vertical", flex: 1, lineHeight: 1.5 }} />
                  <button disabled={uploadando} title="Anexar arquivo"
                    onClick={() => fileRef.current?.click()}
                    style={{
                      background: "transparent", color: t.textSecondary, border: `1px solid ${t.border2}`,
                      padding: "0 12px", height: 34, cursor: uploadando ? "default" : "pointer",
                      opacity: uploadando ? 0.5 : 1,
                      fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
                    }}>{uploadando ? "…" : "Anexar"}</button>
                  <button disabled={salvando || (!novoTexto.trim() && novosAnexos.length === 0)}
                    title="Enviar" onClick={comentar}
                    style={{
                      background: fase.cor, color: "#050505", border: `1px solid ${fase.cor}`,
                      padding: "0 14px", height: 34,
                      cursor: (novoTexto.trim() || novosAnexos.length) ? "pointer" : "default",
                      opacity: (novoTexto.trim() || novosAnexos.length) ? 1 : 0.4,
                      fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
                    }}>Enviar</button>
                </div>
              </div>
            )}
          </div>

          {/* Lado direito: campos editáveis inline */}
          <div style={{ overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={label}>Etapa</label>
              <select value={tf.pdca} disabled={salvando}
                onChange={(e) => mudarFase(e.target.value as PdcaFase)}
                style={inputStyle(t)}>
                {FASES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Responsável</label>
              <input value={respDraft} disabled={salvando}
                onChange={(e) => setRespDraft(e.target.value)}
                onBlur={salvarResp}
                placeholder="Nome do responsável"
                style={inputStyle(t)} />
              {tf.responsavel_email && (
                <div style={{ fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary, marginTop: 4 }}>
                  {tf.responsavel_email}
                </div>
              )}
            </div>
            <div>
              <label style={label}>Prazo</label>
              <input type="date" value={(tf.prazo_data || "").slice(0, 10)} disabled={salvando}
                onChange={(e) => mudarPrazo(e.target.value)}
                style={inputStyle(t)} />
              {!tf.prazo_data && tf.prazo_texto && (
                <div style={{ fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary, marginTop: 4 }}>
                  Falado na reunião: {tf.prazo_texto}
                </div>
              )}
            </div>
            {tf.chat_task_id && (
              <button disabled={salvando} onClick={toggleFeita} style={{
                fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                padding: "8px 14px", cursor: "pointer", opacity: salvando ? 0.5 : 1,
                background: feita ? "transparent" : "#3fa96b",
                color: feita ? "#d05a3b" : "#050505",
                border: `1px solid ${feita ? "#d05a3b" : "#3fa96b"}`,
              }}>{feita ? "Reabrir tarefa" : "Marcar feita"}</button>
            )}
            <div>
              <label style={label}>Ficha</label>
              <div style={{ ...box, display: "flex", flexDirection: "column", gap: 6, fontFamily: fonts.inter, fontSize: 10, color: t.textSecondary }}>
                {tf.tipo && <span>Tipo: <b style={{ color: t.textPrimary }}>{tf.tipo.toUpperCase()}</b></span>}
                <span>Reunião: <b style={{ color: t.textPrimary }}>{fmtData(tf.reuniao_data)}</b></span>
                {tf.decidido_por && <span>Aprovada por: <b style={{ color: t.textPrimary }}>{tf.decidido_por}</b></span>}
                {tf.decidido_em && <span>Aprovada em: <b style={{ color: t.textPrimary }}>{fmtData(tf.decidido_em)}</b></span>}
                {feita && tf.chat_done_at && <span>Concluída em: <b style={{ color: "#3fa96b" }}>{fmtData(tf.chat_done_at)}</b></span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {verTranscricao && (
        <TranscricaoModal tf={tf} t={t} onFechar={() => setVerTranscricao(false)} />
      )}
    </div>
  );
}
