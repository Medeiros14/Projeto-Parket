import React, { useEffect, useMemo, useRef, useState } from "react";
import { fonts, useTokens } from "../theme";
import { api, CRISE_SETORES, type Crise, type CriseAnexo, type CriseColuna, type CriseComentario, type CriseGravidade, type CriseSetor, type Projeto } from "../api";
import { FormatBar, RichText } from "../components/RichText";

/** Gestor de Crises — todo projeto que vira problema entra aqui.
 *  Kanban fixo ENTRADA → ANALISANDO → RESOLVENDO → RESOLVIDO (drag-and-drop).
 *  Abertura via "Alertar Problema" (aqui, no Relacionamento ou no card do
 *  projeto): gravidade, responsável, pessoas extras notificadas, anotação do
 *  problema e prazo. Aviso vai pro chat da obra com @menções. Histórico
 *  permanente — resolvido guarda "como foi resolvido" e nunca apaga. */

export const COLUNAS: { id: CriseColuna; label: string; cor: string }[] = [
  { id: "entrada", label: "ENTRADA", cor: "#d05a3b" },
  { id: "analisando", label: "ANALISANDO", cor: "#c7a45b" },
  { id: "resolvendo", label: "RESOLVENDO", cor: "#8CA9B8" },
  { id: "resolvido", label: "RESOLVIDO", cor: "#3fa96b" },
];

export const GRAV_INFO: Record<CriseGravidade, { label: string; cor: string }> = {
  leve: { label: "Leve", cor: "#8CA9B8" },
  media: { label: "Média", cor: "#c7a45b" },
  grave: { label: "Grave", cor: "#d05a3b" },
};

function diasAberto(c: Crise): number {
  const fim = c.resolvido_em ? new Date(c.resolvido_em).getTime() : Date.now();
  return Math.max(0, Math.floor((fim - new Date(c.created_at).getTime()) / 86400000));
}

function prazoVencido(c: Crise): boolean {
  if (!c.prazo || c.coluna === "resolvido") return false;
  return new Date(`${c.prazo}T23:59:59`) < new Date();
}

/** Dias restantes até o prazo (negativo = vencido). null se sem prazo. */
function diasParaPrazo(c: Crise): number | null {
  if (!c.prazo || c.coluna === "resolvido") return null;
  const alvo = new Date(`${c.prazo}T23:59:59`).getTime();
  return Math.floor((alvo - Date.now()) / 86400000);
}

/** Cor de destaque do card conforme prazo: vermelho vencido, amarelo se
 *  falta ≤2 dias, senão null. */
function corPrazo(c: Crise): string | null {
  const d = diasParaPrazo(c);
  if (d === null) return null;
  if (d < 0) return "#d05a3b";
  if (d <= 2) return "#c7a45b";
  return null;
}

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("pt-BR");
}

export default function CrisesPage() {
  const t = useTokens();
  const [crises, setCrises] = useState<Crise[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [abrir, setAbrir] = useState(false);
  const [resolver, setResolver] = useState<Crise | null>(null);
  const [detalhe, setDetalhe] = useState<Crise | null>(null);
  const [tick, setTick] = useState(0);
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<CriseColuna | null>(null);

  useEffect(() => {
    setLoading(true);
    api.crises()
      .then((r) => { setCrises(r); setErro(null); })
      .catch((e) => setErro(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, [tick]);

  const porColuna = useMemo(() => {
    const m: Record<CriseColuna, Crise[]> = { entrada: [], analisando: [], resolvendo: [], resolvido: [] };
    for (const c of crises) (m[c.coluna] || m.entrada).push(c);
    return m;
  }, [crises]);

  const stats = useMemo(() => {
    const abertas = crises.filter((c) => c.coluna !== "resolvido");
    return {
      abertas: abertas.length,
      graves: abertas.filter((c) => c.gravidade === "grave").length,
      vencidas: abertas.filter(prazoVencido).length,
      resolvidas: crises.filter((c) => c.coluna === "resolvido").length,
    };
  }, [crises]);

  async function mover(id: string, coluna: CriseColuna) {
    const c = crises.find((x) => x.id === id);
    if (!c || c.coluna === coluna) return;
    if (coluna === "resolvido") { setResolver(c); return; }
    setCrises((prev) => prev.map((x) => (x.id === id ? { ...x, coluna } : x)));
    try { await api.crisePatch(id, { coluna }); }
    catch (e) { alert(`Erro ao mover: ${e}`); setTick((x) => x + 1); }
  }

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "20px 32px 40px" }}>
      <header style={{ marginBottom: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.22em", color: t.textPrimary }}>
            OPERAÇÕES · GESTOR DE CRISES
          </div>
          <div style={{ fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.06em", color: t.textTertiary, marginTop: 4 }}>
            Projeto que vira problema entra aqui. Aviso vai pro chat da obra. Resolvido fica no histórico — nunca apaga.
          </div>
        </div>
        <button
          onClick={() => setAbrir(true)}
          style={{
            fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
            padding: "10px 18px", cursor: "pointer", background: "#d05a3b", color: "#fff",
            border: "1px solid #d05a3b",
          }}
        >Alertar Problema</button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
        <KPI t={t} label="Abertas" v={stats.abertas} />
        <KPI t={t} label="Graves" v={stats.graves} cor={stats.graves > 0 ? "#d05a3b" : undefined} />
        <KPI t={t} label="Prazo vencido" v={stats.vencidas} cor={stats.vencidas > 0 ? "#d05a3b" : undefined} />
        <KPI t={t} label="Resolvidas" v={stats.resolvidas} cor="#3fa96b" />
      </div>

      {loading && <div style={{ padding: 20, color: t.textTertiary, fontFamily: fonts.inter, fontSize: 11 }}>Carregando…</div>}
      {erro && <div style={{ padding: 20, color: "#d05a3b", fontFamily: fonts.inter, fontSize: 11 }}>Erro: {erro}</div>}

      {!loading && !erro && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(230px, 1fr))", gap: 12, alignItems: "start", overflowX: "auto" }}>
          {COLUNAS.map((col) => (
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
              <div style={{
                padding: "10px 12px", borderBottom: `2px solid ${col.cor}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.2em", color: col.cor }}>
                  {col.label}
                </span>
                <span style={{ fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary }}>
                  {porColuna[col.id].length}
                </span>
              </div>
              <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {porColuna[col.id].length === 0 && (
                  <div style={{ padding: "14px 6px", fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary, textAlign: "center" }}>
                    {col.id === "resolvido" ? "Nada resolvido ainda." : "Sem crises aqui."}
                  </div>
                )}
                {porColuna[col.id].map((c) => (
                  <CriseCard
                    key={c.id} c={c} t={t}
                    onDragStart={() => { dragId.current = c.id; }}
                    onAbrir={() => setDetalhe(c)}
                    onResolver={col.id !== "resolvido" ? () => setResolver(c) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {abrir && (
        <AlertarProblemaModal
          origem="manual"
          onFechar={() => setAbrir(false)}
          onOk={() => { setAbrir(false); setTick((x) => x + 1); }}
        />
      )}
      {resolver && (
        <ResolverModal
          crise={resolver} t={t}
          onFechar={() => setResolver(null)}
          onOk={() => { setResolver(null); setTick((x) => x + 1); }}
        />
      )}
      {detalhe && (
        <CriseDetalheModal
          crise={detalhe} t={t}
          onFechar={() => setDetalhe(null)}
          onMudou={() => setTick((x) => x + 1)}
        />
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

function CriseCard({ c, t, onDragStart, onResolver, onAbrir }: {
  c: Crise; t: any; onDragStart: () => void;
  onResolver?: () => void; onAbrir?: () => void;
}) {
  const g = GRAV_INFO[c.gravidade] || GRAV_INFO.media;
  const vencido = prazoVencido(c);
  const dias = diasAberto(c);
  const resolvido = c.coluna === "resolvido";
  const alertaPrazo = corPrazo(c);
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); onDragStart(); }}
      onClick={onAbrir}
      style={{
        background: t.card1 || t.card2, border: `1px solid ${t.border2}`,
        borderLeft: `3px solid ${g.cor}`,
        borderTop: alertaPrazo ? `3px solid ${alertaPrazo}` : `1px solid ${t.border2}`,
        padding: "10px 12px", cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.1em", color: t.textPrimary, flex: 1 }}>
          {(c.cliente || c.projeto_nome || "SEM OBRA").toUpperCase()}
        </span>
        <span style={{
          fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
          padding: "2px 7px", border: `1px solid ${g.cor}`, color: g.cor,
        }}>{g.label}</span>
      </div>
      <div style={{ fontFamily: fonts.inter, fontSize: 10.5, color: t.textSecondary, marginTop: 6, whiteSpace: "pre-wrap" }}>
        {c.descricao}
      </div>
      {resolvido && c.resolucao && (
        <div style={{ fontFamily: fonts.inter, fontSize: 10, color: "#3fa96b", marginTop: 6, whiteSpace: "pre-wrap" }}>
          ✓ {c.resolucao}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary }}>
        {c.setor_responsavel && (
          <span>Setor: <b style={{ color: t.textSecondary }}>
            {(CRISE_SETORES.find((s) => s.id === c.setor_responsavel)?.label || c.setor_responsavel).toUpperCase()}
          </b></span>
        )}
        {!c.setor_responsavel && c.responsavel_nome && (
          <span>Resp.: <b style={{ color: t.textSecondary }}>{c.responsavel_nome}</b></span>
        )}
        {c.prazo && (
          <span style={{ color: vencido ? "#d05a3b" : undefined }}>
            Prazo {fmtData(c.prazo)}{vencido ? " · VENCIDO" : ""}
          </span>
        )}
        <span style={{ color: !resolvido && dias >= 7 ? "#d05a3b" : undefined }}>
          {resolvido ? `Resolvida em ${dias}d (${fmtData(c.resolvido_em)})` : `${dias}d em aberto`}
        </span>
        <span>via {c.origem === "relacionamento" ? "Relacionamento" : c.origem === "projeto" ? "card do projeto" : "kanban"}</span>
      </div>
      {onResolver && (
        <button
          onClick={(e) => { e.stopPropagation(); onResolver(); }}
          style={{
            marginTop: 8, fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.12em",
            textTransform: "uppercase", padding: "5px 10px", cursor: "pointer",
            background: "transparent", color: "#3fa96b", border: "1px solid #3fa96b",
          }}
        >Resolver</button>
      )}
    </div>
  );
}

const inputStyle = (t: any): React.CSSProperties => ({
  width: "100%", boxSizing: "border-box", padding: "8px 10px",
  background: t.card2, border: `1px solid ${t.border1}`, color: t.textPrimary,
  outline: "none", fontFamily: fonts.inter, fontSize: 11,
});

const labelStyle = (t: any): React.CSSProperties => ({
  fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.14em",
  textTransform: "uppercase", color: t.textTertiary, marginBottom: 4, display: "block",
});

function ModalShell({ t, titulo, children, onFechar }: {
  t: any; titulo: string; children: React.ReactNode; onFechar: () => void;
}) {
  return (
    <div
      onClick={onFechar}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.bg || t.card2, border: `1px solid ${t.border1}`,
          width: "min(520px, 96vw)", maxHeight: "92vh", overflow: "auto", padding: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.2em", color: t.textPrimary }}>
            {titulo}
          </div>
          <button onClick={onFechar} style={{ background: "transparent", border: "none", color: t.textTertiary, cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Modal compartilhado: usado no kanban de crises, no Relacionamento
 *  (prefill da conversa) e no card do projeto (prefill do projeto). */
export function AlertarProblemaModal({ origem, prefill, onFechar, onOk }: {
  origem: "relacionamento" | "projeto" | "manual";
  prefill?: { card_id?: string | null; projeto_id?: string | null; cliente?: string | null };
  onFechar: () => void;
  onOk: () => void;
}) {
  const t = useTokens();
  const [descricao, setDescricao] = useState("");
  const [gravidade, setGravidade] = useState<CriseGravidade>("media");
  const [prazo, setPrazo] = useState("");
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [projetoSel, setProjetoSel] = useState("");
  const [setorResp, setSetorResp] = useState<CriseSetor | "">("");
  const [setoresCc, setSetoresCc] = useState<Set<CriseSetor>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const temPrefill = !!(prefill?.card_id || prefill?.projeto_id);

  useEffect(() => {
    if (!temPrefill) api.projetos().then(setProjetos).catch(() => setProjetos([]));
  }, [temPrefill]);

  async function salvar() {
    if (!descricao.trim()) { alert("Anote o problema percebido."); return; }
    if (!setorResp) { alert("Escolha o setor responsável."); return; }
    const proj = projetos.find((p) => p.id === projetoSel);
    setSalvando(true);
    try {
      await api.criseCriar({
        descricao: descricao.trim(),
        gravidade,
        origem,
        card_id: prefill?.card_id || proj?.card_id || null,
        projeto_id: prefill?.projeto_id || proj?.id || null,
        cliente: prefill?.cliente || proj?.cliente || null,
        setor_responsavel: setorResp,
        setores_notificar: [...setoresCc].filter((s) => s !== setorResp),
        prazo: prazo || null,
      });
      onOk();
    } catch (e) {
      alert(`Erro ao alertar problema: ${e}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalShell t={t} titulo="ALERTAR PROBLEMA" onFechar={onFechar}>
      {temPrefill ? (
        <div style={{ fontFamily: fonts.inter, fontSize: 11, color: t.textSecondary, marginBottom: 12 }}>
          Obra: <b style={{ color: t.textPrimary }}>{prefill?.cliente || prefill?.card_id}</b>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle(t)}>Obra / projeto</label>
          <select value={projetoSel} onChange={(e) => setProjetoSel(e.target.value)} style={inputStyle(t)}>
            <option value="">— sem obra vinculada —</option>
            {projetos.map((p) => <option key={p.id} value={p.id}>{p.cliente}</option>)}
          </select>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle(t)}>Problema percebido</label>
        <textarea
          value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4}
          placeholder="Descreva o que aconteceu…"
          style={{ ...inputStyle(t), resize: "vertical" }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle(t)}>Nível do problema</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(Object.keys(GRAV_INFO) as CriseGravidade[]).map((g) => {
            const ativo = gravidade === g;
            const info = GRAV_INFO[g];
            return (
              <button
                key={g} onClick={() => setGravidade(g)}
                style={{
                  flex: 1, fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.12em",
                  textTransform: "uppercase", padding: "8px 0", cursor: "pointer",
                  background: ativo ? info.cor : "transparent",
                  color: ativo ? "#050505" : t.textSecondary,
                  border: `1px solid ${ativo ? info.cor : t.border2}`,
                }}
              >{info.label}</button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle(t)}>Setor responsável</label>
        <select value={setorResp} onChange={(e) => setSetorResp((e.target.value || "") as CriseSetor | "")} style={inputStyle(t)}>
          <option value="">— escolha o setor —</option>
          {CRISE_SETORES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle(t)}>Setores adicionais a notificar</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {CRISE_SETORES.filter((s) => s.id !== setorResp).map((s) => {
            const on = setoresCc.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => setSetoresCc((prev) => {
                  const set = new Set(prev);
                  if (set.has(s.id)) set.delete(s.id); else set.add(s.id);
                  return set;
                })}
                style={{
                  fontFamily: fonts.inter, fontSize: 9.5, padding: "4px 10px", cursor: "pointer",
                  background: on ? t.accent : "transparent",
                  color: on ? "#050505" : t.textSecondary,
                  border: `1px solid ${on ? t.accent : t.border2}`,
                }}
              >{s.label}</button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle(t)}>Prazo pra conclusão</label>
        <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={inputStyle(t)} />
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onFechar}
          style={{
            fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "9px 16px", cursor: "pointer", background: "transparent",
            color: t.textSecondary, border: `1px solid ${t.border2}`,
          }}
        >Cancelar</button>
        <button
          onClick={salvar} disabled={salvando}
          style={{
            fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
            padding: "9px 18px", cursor: "pointer", background: "#d05a3b", color: "#fff",
            border: "1px solid #d05a3b", opacity: salvando ? 0.6 : 1,
          }}
        >{salvando ? "Enviando…" : "Alertar"}</button>
      </div>
    </ModalShell>
  );
}

function ResolverModal({ crise, t, onFechar, onOk }: {
  crise: Crise; t: any; onFechar: () => void; onOk: () => void;
}) {
  const [resolucao, setResolucao] = useState(crise.resolucao || "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!resolucao.trim()) { alert("Conte como o problema foi resolvido."); return; }
    setSalvando(true);
    try {
      await api.crisePatch(crise.id, { coluna: "resolvido", resolucao: resolucao.trim() });
      onOk();
    } catch (e) {
      alert(`Erro ao resolver: ${e}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalShell t={t} titulo="RESOLVER CRISE" onFechar={onFechar}>
      <div style={{ fontFamily: fonts.inter, fontSize: 11, color: t.textSecondary, marginBottom: 10 }}>
        <b style={{ color: t.textPrimary }}>{crise.cliente || crise.projeto_nome || "Sem obra"}</b>
        {" — "}{crise.descricao}
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle(t)}>Como foi resolvido</label>
        <textarea
          value={resolucao} onChange={(e) => setResolucao(e.target.value)} rows={4}
          placeholder="O que foi feito pra resolver…"
          style={{ ...inputStyle(t), resize: "vertical" }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onFechar}
          style={{
            fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "9px 16px", cursor: "pointer", background: "transparent",
            color: t.textSecondary, border: `1px solid ${t.border2}`,
          }}
        >Cancelar</button>
        <button
          onClick={salvar} disabled={salvando}
          style={{
            fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
            padding: "9px 18px", cursor: "pointer", background: "#3fa96b", color: "#050505",
            border: "1px solid #3fa96b", opacity: salvando ? 0.6 : 1,
          }}
        >{salvando ? "Salvando…" : "Marcar resolvido"}</button>
      </div>
    </ModalShell>
  );
}

/* ═══ Modal detalhe da crise (estilo Trello) ═══════════════
   Header: cliente + gravidade + coluna. Descrição editável.
   Grid lateral: setor / gravidade / prazo / coluna (todos inline).
   Análise IA: botão gera resumo + 3 sugestões usando contexto do
   projeto + últimas mensagens do chat da obra. Fica registrada
   como comentário do tipo 'analise_ia'.
   Timeline: comentários + mudanças automáticas de coluna/gravidade.
   Composer no rodapé pra adicionar novo registro. */
function CriseDetalheModal({ crise, t, onFechar, onMudou }: {
  crise: Crise; t: any; onFechar: () => void; onMudou: () => void;
}) {
  const [c, setC] = useState<Crise>(crise);
  const [comentarios, setComentarios] = useState<CriseComentario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [descDraft, setDescDraft] = useState(crise.descricao);
  const [editDesc, setEditDesc] = useState(false);
  const [novoTexto, setNovoTexto] = useState("");
  const [novosAnexos, setNovosAnexos] = useState<CriseAnexo[]>([]);
  const [publicarChat, setPublicarChat] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoArq, setEnviandoArq] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function reload() {
    setCarregando(true);
    try {
      const [novo, coments] = await Promise.all([
        api.crises({ card_id: c.card_id || undefined }).then((all) => all.find((x) => x.id === c.id) || c),
        api.criseComentarios(c.id),
      ]);
      setC(novo);
      setComentarios(coments);
    } catch (e) {
      console.warn("[crise reload]", e);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(p: any) {
    setSalvando(true);
    try {
      await api.crisePatch(c.id, p);
      await reload();
      onMudou();
    } catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(false); }
  }

  const comRef = useRef<HTMLTextAreaElement | null>(null);

  /** Faz upload e insere markdown no cursor. Imagens viram ![nome](url),
   *  outros formatos viram [nome](url) — o RichText renderiza inline. */
  async function subirArquivos(files: File[]) {
    if (!files.length) return;
    setEnviandoArq(true);
    try {
      const marcadores: string[] = [];
      const salvos: CriseAnexo[] = [];
      for (const f of files) {
        if (f.size > 50 * 1024 * 1024) { alert(`${f.name}: acima de 50MB — não enviado.`); continue; }
        const a = await api.criseAnexoUpload(c.id, f);
        const isImg = (a.mime || f.type || "").startsWith("image/");
        marcadores.push(isImg ? `![${a.name}](${a.url})` : `[${a.name}](${a.url})`);
        salvos.push(a);
      }
      if (!marcadores.length) return;
      const bloco = marcadores.join("\n") + "\n";
      const el = comRef.current;
      setNovoTexto((prev) => {
        if (!el) return prev + (prev && !prev.endsWith("\n") ? "\n" : "") + bloco;
        const s = el.selectionStart ?? prev.length;
        const e = el.selectionEnd ?? prev.length;
        return prev.slice(0, s) + bloco + prev.slice(e);
      });
      // Mantém no jsonb pra pesquisa/estrutura, mas o render lê do texto.
      setNovosAnexos((prev) => [...prev, ...salvos]);
    } catch (e: any) { alert(`Falha upload: ${e.message}`); }
    finally { setEnviandoArq(false); }
  }

  async function comentar() {
    const txt = novoTexto.trim();
    if (!txt && novosAnexos.length === 0) return;
    setSalvando(true);
    try {
      await api.criseComentar(c.id, { texto: txt, anexos: novosAnexos, publicar_chat: publicarChat });
      setNovoTexto("");
      setNovosAnexos([]);
      await reload();
    } catch (e: any) { alert(`Falha: ${e.message}`); }
    finally { setSalvando(false); }
  }

  async function analisar(force = false) {
    setAnalisando(true);
    try { await api.criseAnaliseIA(c.id, force); await reload(); }
    catch (e: any) { alert(`Falha na análise IA: ${e.message}`); }
    finally { setAnalisando(false); }
  }

  async function reabrir() {
    if (!confirm("Reabrir esta crise? Ela volta pra ANALISANDO e o chat da obra é avisado.")) return;
    setReabrindo(true);
    try { await api.criseReabrir(c.id); await reload(); onMudou(); }
    catch (e: any) { alert(`Falha ao reabrir: ${e.message}`); }
    finally { setReabrindo(false); }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData?.items || []);
    const files: File[] = [];
    for (const it of items) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) { e.preventDefault(); subirArquivos(files); }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) subirArquivos(files);
  }

  const grav = GRAV_INFO[c.gravidade] || GRAV_INFO.media;
  const col = COLUNAS.find((x) => x.id === c.coluna);
  const analiseAtual = [...comentarios].reverse().find((x) => x.tipo === "analise_ia");

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
          <span style={{ width: 6, height: 24, background: grav.cor, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.16em", color: t.textPrimary }}>
              {(c.cliente || c.projeto_nome || "SEM OBRA").toUpperCase()}
            </div>
            <div style={{ fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary, marginTop: 2 }}>
              Aberta há {diasAberto(c)}d
              {" · "}via {c.origem}
              {c.criado_por ? ` · por ${c.criado_por}` : ""}
            </div>
          </div>
          <span style={{
            fontFamily: fonts.inter, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "3px 10px", border: `1px solid ${col?.cor || t.border2}`, color: col?.cor || t.textSecondary,
          }}>{col?.label || c.coluna}</span>
          <span style={{
            fontFamily: fonts.inter, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "3px 10px", border: `1px solid ${grav.cor}`, color: grav.cor,
          }}>{grav.label}</span>
          {c.card_id && (
            <a href={`https://chat.parket.works/obra/${c.card_id}`}
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
          {/* Lado esquerdo: descrição + análise IA + timeline */}
          <div style={{ overflowY: "auto", padding: 20, borderRight: `1px solid ${t.border1}` }}>
            <label style={label}>Problema percebido</label>
            {editDesc ? (
              <div>
                <textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={5}
                  style={{ ...inputStyle(t), resize: "vertical", marginBottom: 6 }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button disabled={salvando} onClick={async () => {
                    if (!descDraft.trim()) { alert("descrição não pode ficar vazia"); return; }
                    await patch({ descricao: descDraft.trim() });
                    setEditDesc(false);
                  }} style={{
                    fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                    padding: "6px 14px", background: grav.cor, color: "#050505", border: `1px solid ${grav.cor}`, cursor: "pointer",
                  }}>Salvar</button>
                  <button onClick={() => { setDescDraft(c.descricao); setEditDesc(false); }} style={{
                    fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                    padding: "6px 14px", background: "transparent", color: t.textSecondary, border: `1px solid ${t.border2}`, cursor: "pointer",
                  }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div onClick={() => { setDescDraft(c.descricao); setEditDesc(true); }}
                title="Clique pra editar"
                style={{ ...box, whiteSpace: "pre-wrap", cursor: "text", fontSize: 12, color: t.textPrimary, lineHeight: 1.5 }}>
                {c.descricao}
              </div>
            )}

            <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ ...label, marginBottom: 0 }}>Análise da IA</label>
              <button disabled={analisando} onClick={() => analisar(!!analiseAtual)} style={{
                fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                padding: "5px 12px", background: "transparent", color: t.textSecondary,
                border: `1px solid ${t.border2}`, cursor: "pointer", opacity: analisando ? 0.5 : 1,
              }}>
                {analisando ? "Analisando…" : analiseAtual ? "Regenerar análise" : "Gerar análise IA"}
              </button>
            </div>
            {analiseAtual ? (
              <div style={{ ...box, borderLeft: `3px solid ${t.accent}`, whiteSpace: "pre-wrap", fontSize: 11.5, color: t.textPrimary, lineHeight: 1.55 }}>
                {analiseAtual.texto}
                <div style={{ marginTop: 8, fontSize: 9, color: t.textTertiary }}>
                  gerada {fmtData(analiseAtual.created_at)}
                  {analiseAtual.meta?.conv_msgs != null && ` · ${analiseAtual.meta.conv_msgs} mensagens do chat consideradas`}
                </div>
              </div>
            ) : (
              <div style={{ ...box, fontSize: 11, color: t.textTertiary, fontStyle: "italic" }}>
                Sem análise ainda. Clique acima para a IA revisar o projeto e o chat da obra e sugerir 3 caminhos de resolução.
              </div>
            )}

            <div style={{ marginTop: 20, marginBottom: 6 }}>
              <label style={label}>Registro do tratamento</label>
            </div>
            {carregando && <div style={{ fontSize: 11, color: t.textTertiary }}>Carregando histórico…</div>}
            {!carregando && comentarios.filter((x) => x.tipo !== "analise_ia").length === 0 && (
              <div style={{ fontSize: 11, color: t.textTertiary, fontStyle: "italic" }}>
                Nenhum registro ainda. Escreva abaixo pra documentar cada tratativa.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {comentarios.filter((x) => x.tipo !== "analise_ia").map((cm) => {
                const isSys = cm.tipo !== "comentario";
                // Anexos legados (guardados em coluna jsonb) ficam concatenados
                // ao texto como markdown pro RichText renderar inline igual novos.
                const anexosLegado = (cm.anexos || []).map((a) => {
                  const isImg = (a.mime || "").startsWith("image/") ||
                    /\.(png|jpe?g|webp|gif|svg|heic)$/i.test(a.name || "");
                  return isImg ? `![${a.name}](${a.url})` : `[${a.name}](${a.url})`;
                }).join("\n");
                const textoRender = [cm.texto || "", anexosLegado].filter(Boolean).join("\n\n");
                return (
                  <div key={cm.id} style={{
                    ...box,
                    borderLeft: `3px solid ${isSys ? t.border2 : t.accent}`,
                    background: isSys ? "transparent" : (t.card1 || t.card2),
                  }}>
                    <div style={{ fontSize: 9, color: t.textTertiary, marginBottom: 4, letterSpacing: "0.06em" }}>
                      <b style={{ color: t.textSecondary }}>{cm.autor_email || cm.autor_nome || "sistema"}</b>
                      {" · "}{fmtData(cm.created_at)}
                      {isSys && ` · ${cm.tipo}`}
                    </div>
                    {textoRender && <RichText texto={textoRender} t={t} />}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}
                 onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
              <FormatBar textareaRef={comRef} value={novoTexto} onChange={setNovoTexto} t={t} />
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea ref={comRef}
                  value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} rows={3}
                  onPaste={onPaste}
                  placeholder="Escreva um comentário… (Ctrl+V pra colar imagem, ou anexe abaixo)"
                  style={{ ...inputStyle(t), resize: "vertical", flex: 1, lineHeight: 1.5 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <input ref={fileInputRef} type="file" multiple style={{ display: "none" }}
                    onChange={(e) => {
                      const fs = Array.from(e.target.files || []);
                      if (fs.length) subirArquivos(fs);
                      e.target.value = "";
                    }} />
                  <button type="button" disabled={enviandoArq}
                    title="Anexar arquivos" onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: t.card2, border: `1px solid ${t.border1}`, color: t.textSecondary,
                      cursor: enviandoArq ? "default" : "pointer",
                      padding: "0 10px", height: 30, opacity: enviandoArq ? 0.5 : 1,
                    }}>{enviandoArq ? "…" : "Anexar"}</button>
                  <button disabled={salvando || (!novoTexto.trim() && novosAnexos.length === 0)}
                    title="Enviar" onClick={comentar}
                    style={{
                      background: grav.cor, color: "#050505", border: `1px solid ${grav.cor}`,
                      padding: "0 14px", height: 34,
                      cursor: (novoTexto.trim() || novosAnexos.length) ? "pointer" : "default",
                      opacity: (novoTexto.trim() || novosAnexos.length) ? 1 : 0.4,
                      fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
                    }}>Enviar</button>
                </div>
              </div>
              {c.card_id && (
                <label style={{
                  fontFamily: fonts.inter, fontSize: 10, color: t.textSecondary,
                  display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
                }}>
                  <input type="checkbox" checked={publicarChat}
                    onChange={(e) => setPublicarChat(e.target.checked)} />
                  Avisar no chat da obra ao enviar
                </label>
              )}
            </div>
          </div>

          {/* Lado direito: campos editáveis inline */}
          <div style={{ overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={label}>Coluna</label>
              <select value={c.coluna} disabled={salvando}
                onChange={(e) => patch({ coluna: e.target.value })}
                style={inputStyle(t)}>
                {COLUNAS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Gravidade</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(Object.keys(GRAV_INFO) as CriseGravidade[]).map((g) => {
                  const ativo = c.gravidade === g;
                  const info = GRAV_INFO[g];
                  return (
                    <button key={g} disabled={salvando}
                      onClick={() => patch({ gravidade: g })}
                      style={{
                        flex: 1, fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.12em",
                        textTransform: "uppercase", padding: "7px 0", cursor: "pointer",
                        background: ativo ? info.cor : "transparent",
                        color: ativo ? "#050505" : t.textSecondary,
                        border: `1px solid ${ativo ? info.cor : t.border2}`,
                      }}>{info.label}</button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={label}>Setor responsável</label>
              <select value={c.setor_responsavel || ""} disabled={salvando}
                onChange={(e) => patch({ setor_responsavel: (e.target.value || null) as CriseSetor | null })}
                style={inputStyle(t)}>
                <option value="">— sem setor —</option>
                {CRISE_SETORES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Setores adicionais a notificar</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {CRISE_SETORES.filter((s) => s.id !== c.setor_responsavel).map((s) => {
                  const on = (c.setores_notificar || []).includes(s.id);
                  return (
                    <button key={s.id} disabled={salvando}
                      onClick={() => {
                        const atuais = new Set(c.setores_notificar || []);
                        if (atuais.has(s.id)) atuais.delete(s.id); else atuais.add(s.id);
                        patch({ setores_notificar: [...atuais] as CriseSetor[] });
                      }}
                      style={{
                        fontFamily: fonts.inter, fontSize: 9, padding: "3px 8px", cursor: "pointer",
                        background: on ? t.accent : "transparent",
                        color: on ? "#050505" : t.textSecondary,
                        border: `1px solid ${on ? t.accent : t.border2}`,
                      }}>{s.label}</button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={label}>Prazo</label>
              <input type="date" value={c.prazo || ""} disabled={salvando}
                onChange={(e) => patch({ prazo: e.target.value || null })}
                style={inputStyle(t)} />
            </div>
            {c.coluna === "resolvido" && c.resolucao && (
              <div>
                <label style={label}>Como foi resolvido</label>
                <div style={{ ...box, borderLeft: `3px solid #3fa96b`, fontSize: 11, whiteSpace: "pre-wrap" }}>
                  {c.resolucao}
                </div>
              </div>
            )}
            {c.coluna === "resolvido" && (
              <button disabled={reabrindo} onClick={reabrir} style={{
                fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                padding: "8px 14px", background: "transparent", color: "#d05a3b",
                border: "1px solid #d05a3b", cursor: "pointer", opacity: reabrindo ? 0.5 : 1,
              }}>{reabrindo ? "Reabrindo…" : "Reabrir crise"}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

