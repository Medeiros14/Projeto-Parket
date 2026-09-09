import { useEffect, useRef, useState } from "react";
import {
  api, anexoUrl, extrairVendido, fmtBr, fmtBytes, labelCor, limparDesc,
  type AditivoSim, type AppUser, type BoardMeta, type CardDetalhe, type ComentarioLocal,
  type Lista, type ProjetistaListItem,
} from "../api";
import DocsUnificados from "./DocsUnificados";
import ProdutosTab from "./ProdutosTab";
import { midiaThumb } from "../lib/midia";

/* Modal de detalhe do card — layout com abas (padrão gestão):
     Visão · Produtos · Aditivo · Fiscal · Anexos · Comentários · Documentos
   Não fecha em click-fora (regra da casa). Desde 02/09 o board vive
   100% no banco local (vínculo com o Trello cortado). */

type Aba = "visao" | "produtos" | "aditivo" | "fiscal" | "anexos" | "comentarios" | "documentos";

export default function CardModal({ id, t, user, listas, onClose, onChanged, onAtribuir }: {
  id: string; t: any; user: AppUser; listas: Lista[];
  onClose: () => void; onChanged: () => void;
  // Abre o AtribuirModal (multi-responsável) já com esta obra selecionada.
  onAtribuir?: (cardId: string) => void;
}) {
  const [card, setCard] = useState<CardDetalhe | null>(null);
  const [erro, setErro] = useState("");
  const [imgAberta, setImgAberta] = useState<string | null>(null);
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<Aba>("visao");

  const [editNome, setEditNome] = useState(false);
  const [nomeDraft, setNomeDraft] = useState("");
  const [editDesc, setEditDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  // Rascunho do prazo de entrega. O <input type="date"> do Chrome dispara
  // onChange a CADA dígito do ano (0002 -> 0020 -> 0202 -> 2026); salvar em
  // cada um desabilitava o campo e re-renderizava o valor vindo do banco,
  // roubando o foco no meio da digitação ("trava ao digitar o ano").
  // Agora digita livre no rascunho e só grava no blur/Enter, com ano completo.
  const [dueDraft, setDueDraft] = useState<string | null>(null);
  const [pickerLabels, setPickerLabels] = useState(false);
  const [pickerMembros, setPickerMembros] = useState(false);
  const [novoComentario, setNovoComentario] = useState("");
  const [novoItem, setNovoItem] = useState<Record<string, string>>({});
  const [novaChecklist, setNovaChecklist] = useState("");
  const [anexosComentario, setAnexosComentario] = useState<File[]>([]);
  const descRef = useRef<HTMLTextAreaElement | null>(null);
  const comRef = useRef<HTMLTextAreaElement | null>(null);

  const reload = () => api.card(id).then(setCard).catch(e => setErro(String(e)));
  useEffect(() => { setDueDraft(null); reload(); }, [id]);
  useEffect(() => { api.meta().then(setMeta).catch(() => {}); }, []);

  // Toda vez que o usuário abre a aba "fiscal" ou "aditivo", marca como
  // visto no backend (o chip "◆ FISCAL NOVO"/"◆ NOVO ADITIVO" some no board).
  useEffect(() => {
    if (aba === "fiscal" || aba === "aditivo") {
      api.notifSeen(id, aba).then(onChanged).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, id]);

  // Dropdown de delegar (gestora) + nome do delegado na faixa de delegação
  // (pra não-gestora o endpoint devolve só dado leve não sensível).
  const [projetistas, setProjetistas] = useState<ProjetistaListItem[]>([]);
  useEffect(() => {
    api.projetistas().then(d => setProjetistas(d.projetistas)).catch(() => {});
  }, []);

  const salvar = async (fn: () => Promise<unknown>) => {
    setSalvando(true); setErro("");
    try { await fn(); await reload(); onChanged(); }
    catch (e) { setErro(String(e)); }
    finally { setSalvando(false); }
  };

  // Grava o prazo de entrega (chamado no blur/Enter, nunca a cada tecla).
  // Ano com menos de 4 dígitos = ainda digitando: mantém o rascunho e não grava.
  const commitPrazo = async () => {
    if (dueDraft === null) return;
    const v = dueDraft;
    if (v && Number(v.slice(0, 4)) < 1000) return;
    const atual = card?.due ? card.due.slice(0, 10) : "";
    setDueDraft(null);
    if (v === atual) return;
    await salvar(() => api.patchCard(id, { due: v ? `${v}T12:00:00.000Z` : "" }));
  };

  // Todos os responsáveis da obra, cada um com sua função/prazo/prioridade.
  // Os campos card.projetista_id/tipos/... são só o PRIMEIRO (legado).
  const resps = card?.responsaveis || [];

  const vendido = extrairVendido(card?.descricao);

  // Descrição com o fiscal do Cloud injetado: o template do Trello vem com a
  // linha "**Fiscal:**" em branco, então substituímos o valor dela (ou
  // acrescentamos a linha) com os nomes atribuídos pela gestão no kanban_cards.
  const nomesFiscal = (card?.fiscais_nomes || []).filter(Boolean).join(", ");
  let descLimpa = limparDesc(card?.descricao);
  if (nomesFiscal) {
    if (/\*\*Fiscal[^:*]*:\*\*/i.test(descLimpa)) {
      descLimpa = descLimpa.replace(/(\*\*Fiscal[^:*]*:\*\*)[^\n]*/i, `$1 ${nomesFiscal}`);
    } else {
      descLimpa = (descLimpa ? descLimpa + "\n\n" : "") + `**Fiscal:** ${nomesFiscal}`;
    }
  }

  const imagens = card?.anexos.filter(a => a.is_imagem && a.baixado && a.path_local) || [];
  const arquivos = card?.anexos.filter(a => !(a.is_imagem && a.baixado && a.path_local)) || [];
  const atrasado = card?.due && !card.due_complete && new Date(card.due) < new Date();

  const rotulo: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
    color: t.textTertiary, marginBottom: 4,
  };
  const inputBase: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border1}`, color: t.textPrimary,
    fontSize: 12, padding: "7px 10px", outline: "none",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: t.overlay, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        width: 1020, maxWidth: "96vw", maxHeight: "92vh", background: t.bg,
        border: `1px solid ${t.border2}`, display: "flex", flexDirection: "column",
        opacity: salvando ? 0.75 : 1, transition: "opacity 0.15s",
      }}>
        {/* ─── Header ─── */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 20px",
          borderBottom: `1px solid ${t.border1}`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editNome && card ? (
              <input autoFocus value={nomeDraft} onChange={e => setNomeDraft(e.target.value)}
                onBlur={() => {
                  setEditNome(false);
                  if (nomeDraft.trim() && nomeDraft !== card.nome)
                    salvar(() => api.patchCard(id, { nome: nomeDraft.trim() }));
                }}
                onKeyDown={e => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") { setNomeDraft(card.nome); setEditNome(false); }
                }}
                style={{ ...inputBase, width: "100%", fontSize: 15, fontWeight: 600 }} />
            ) : (
              <div title="Clique para editar o título"
                onClick={() => { if (card) { setNomeDraft(card.nome); setEditNome(true); } }}
                style={{ fontSize: 15, fontWeight: 600, color: t.textPrimary, lineHeight: 1.4, cursor: "text" }}>
                {card ? card.nome : erro ? "Erro" : "Carregando…"} {card && <span style={{ fontSize: 10, color: t.textTertiary }}>✎</span>}
              </div>
            )}
            <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 3 }}>
              {card?.date_last_activity && `atividade ${fmtBr(card.date_last_activity)}`}
            </div>
          </div>
          {card && (
            <select value={card.lista_id} disabled={salvando}
              onChange={e => salvar(() => api.patchCard(id, { lista_id: e.target.value }))}
              title="Mover de coluna"
              style={{ ...inputBase, maxWidth: 230 }}>
              {listas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          )}
          {/* Atribuição só pelo modal multi-responsável. O select antigo de UMA
              pessoa mandava o formato legado pro backend, que substitui a lista
              inteira: usar ele numa obra com dois responsáveis derrubava o
              segundo em silêncio. */}
          {card && user.is_gestora && onAtribuir && (
            <button onClick={() => onAtribuir(id)}
              title="Atribuir responsáveis (várias pessoas, cada uma com sua função)"
              style={{
                ...inputBase, cursor: "pointer", whiteSpace: "nowrap",
                borderColor: resps.length > 0 ? t.accent : t.border1,
              }}>
              {resps.length > 0 ? `Responsáveis (${resps.length})` : "Atribuir"}
            </button>
          )}
          {card && !user.is_gestora && resps.some(r => r.projetista_id === user.id) && (
            <span title="Delegado a você" style={{
              background: `${t.accent}1f`, border: `1px solid ${t.accent}55`, color: t.accent,
              padding: "6px 10px", fontSize: 10, fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              ★ Seu
            </span>
          )}
          {card && user.is_gestora && (
            <button
              onClick={async () => {
                const ok = window.confirm(
                  `Arquivar o card "${card.nome}"?\n\nEle some do kanban imediatamente. ` +
                  `Se precisar reabrir, peça pro setor de IA.`
                );
                if (!ok) return;
                setSalvando(true);
                try {
                  await api.arquivarCard(id);
                  onChanged();
                  onClose();
                } catch (e) {
                  setErro(String(e));
                } finally {
                  setSalvando(false);
                }
              }}
              title="Arquivar card (some do kanban, reversível pelo banco)"
              style={{
                background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)",
                color: "#EF4444", cursor: "pointer", padding: "7px 12px", fontSize: 12,
                fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
              }}>
              🗑 Arquivar
            </button>
          )}
          <button onClick={onClose} title="Fechar" style={{
            background: "transparent", border: "none", color: t.textTertiary,
            cursor: "pointer", padding: 6, fontSize: 15, lineHeight: 1,
          }}>
            ✕
          </button>
        </div>

        {/* ─── Responsáveis: UMA linha por pessoa ───
            A mesma obra pode ter Vinicius no Piso e Suelen na Marcenaria, cada
            um com seu tamanho/prioridade/prazo. Antes esse bloco lia os campos
            achatados do card (que só carregam o PRIMEIRO responsável) e o
            segundo simplesmente não aparecia. */}
        {card && resps.length > 0 && (() => {
          const chip = (fg: string, bg: string, bd: string): React.CSSProperties => ({
            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", padding: "3px 8px",
            color: fg, background: bg, border: `1px solid ${bd}`, textTransform: "uppercase",
          });
          const TAM: Record<string, string> = { pequeno: "Pequeno", medio: "Médio", grande: "Grande" };
          const PRIO: Record<string, string> = { urgente: "Urgente", baixa: "Baixa", normal: "Normal" };
          return (
            <div style={{
              display: "flex", flexDirection: "column", gap: 6,
              padding: "9px 20px", borderBottom: `1px solid ${t.border1}`, background: t.card1,
            }}>
              {resps.map(r => {
                const nome = r.nome || projetistas.find(p => p.id === r.projetista_id)?.nome || "Projetista";
                const prazoVencido = !!r.prazo && new Date(r.prazo + "T23:59:59") < new Date();
                return (
                  <div key={r.projetista_id}
                    style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ ...rotulo, marginBottom: 0, minWidth: 86 }}>Responsável</span>
                    <span title="Projetista responsável" style={chip("#111", t.accent, t.accent)}>
                      {nome}
                    </span>
                    {/* Funções desta pessoa nesta obra (Piso, Marcenaria, ...) */}
                    {(r.tipos || []).map(tp => (
                      <span key={tp} title="Função desta pessoa nesta obra"
                        style={chip(t.accent, `${t.accent}22`, t.accent)}>
                        {tp}
                      </span>
                    ))}
                    {r.tamanho && (
                      <span title="Tamanho do projeto" style={chip(t.textSecondary, "transparent", t.border2)}>
                        {TAM[r.tamanho] || r.tamanho}
                      </span>
                    )}
                    {r.prioridade && (
                      <span title="Prioridade" style={
                        r.prioridade === "urgente"
                          ? chip("#EF4444", "rgba(239,68,68,0.10)", "rgba(239,68,68,0.45)")
                          : chip(t.textSecondary, "transparent", t.border2)
                      }>
                        {PRIO[r.prioridade] || r.prioridade}
                      </span>
                    )}
                    {r.prazo && (
                      <span title="Prazo interno desta pessoa" style={
                        prazoVencido
                          ? chip("#EF4444", "rgba(239,68,68,0.10)", "rgba(239,68,68,0.45)")
                          : chip(t.textSecondary, "transparent", t.border2)
                      }>
                        Prazo {fmtBr(r.prazo)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {erro && <div style={{ color: "#EF4444", fontSize: 11, padding: "8px 20px" }}>{erro}</div>}
        {!card && !erro && (
          <div style={{ padding: 40, textAlign: "center", color: t.textTertiary, fontSize: 11 }}>
            Carregando…
          </div>
        )}

        {/* ─── Bloco Cliente (dados do gestao.projetos + override manual) ─── */}
        {card && (
          <BlocoDadosCliente card={card} t={t} souGestora={user.is_gestora}
            onSaved={p => { if (card) Object.assign(card, p); setCard({ ...card! }); }} />
        )}

        {card && (
          <>
            {/* ─── Barra de abas ─── */}
            <div style={{
              display: "flex", borderBottom: `1px solid ${t.border1}`, padding: "0 20px",
              gap: 4, flexShrink: 0, overflowX: "auto",
            }}>
              <TabBtn ativa={aba === "visao"} onClick={() => setAba("visao")} t={t}>
                Visão
              </TabBtn>
              <TabBtn ativa={aba === "produtos"} onClick={() => setAba("produtos")} t={t}
                badge={card.space_card_id ? "•" : undefined}>
                Produtos
              </TabBtn>
              <TabBtn ativa={aba === "aditivo"} onClick={() => setAba("aditivo")} t={t}
                badge={card.tem_aditivo ? "◆" : undefined}>
                Aditivo
              </TabBtn>
              <TabBtn ativa={aba === "fiscal"} onClick={() => setAba("fiscal")} t={t}>
                Fiscal
              </TabBtn>
              <TabBtn ativa={aba === "anexos"} onClick={() => setAba("anexos")} t={t}
                badge={card.anexos.length ? String(card.anexos.length) : undefined}>
                Anexos
              </TabBtn>
              <TabBtn ativa={aba === "comentarios"} onClick={() => setAba("comentarios")} t={t}
                badge={
                  (card.comentarios_locais?.length ?? 0) + (card.comentarios?.length ?? 0) > 0
                    ? String((card.comentarios_locais?.length ?? 0) + (card.comentarios?.length ?? 0))
                    : undefined
                }>
                Comentários
              </TabBtn>
              <TabBtn ativa={aba === "documentos"} onClick={() => setAba("documentos")} t={t}>
                Documentos
              </TabBtn>
            </div>

            {/* ─── Corpo (troca conforme aba) ─── */}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>

            {aba === "visao" && (
              <div style={{ padding: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
                  <div>
                    <div style={rotulo}>
                      👤 Responsáveis{" "}
                      <button onClick={() => setPickerMembros(v => !v)} title="Editar responsáveis"
                        style={{ background: "transparent", border: "none", color: t.accent, cursor: "pointer", fontSize: 10, padding: 0 }}>
                        {pickerMembros ? "fechar" : "✎"}
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: t.textPrimary }}>
                      {card.membros.length ? card.membros.map(m => m.nome).join(" · ") : "—"}
                    </div>
                    {pickerMembros && meta && (
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                        {meta.membros.map(m => {
                          const ativo = card.membros.some(x => x.id === m.id);
                          return (
                            <button key={m.id} disabled={salvando}
                              onClick={() => salvar(() => api.toggleMembro(id, m.id, !ativo))}
                              style={{
                                textAlign: "left", fontSize: 11, cursor: "pointer", padding: "4px 8px",
                                background: ativo ? `${t.accent}22` : "transparent",
                                border: `1px solid ${ativo ? t.accent : t.border1}`, color: t.textPrimary,
                              }}>
                              {ativo ? "✓ " : ""}{m.nome}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={rotulo}>
                      🏷 Etiquetas{" "}
                      <button onClick={() => setPickerLabels(v => !v)} title="Editar etiquetas"
                        style={{ background: "transparent", border: "none", color: t.accent, cursor: "pointer", fontSize: 10, padding: 0 }}>
                        {pickerLabels ? "fechar" : "✎"}
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {card.labels.length ? card.labels.map((lb, i) => (
                        <span key={i} style={{
                          fontSize: 9, padding: "3px 9px", color: "#111", fontWeight: 600,
                          background: labelCor(lb.cor), borderRadius: 2,
                        }}>
                          {lb.nome || "—"}
                        </span>
                      )) : <span style={{ fontSize: 12, color: t.textPrimary }}>—</span>}
                    </div>
                    {pickerLabels && meta && (
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2, maxHeight: 180, overflowY: "auto" }}>
                        {meta.labels.filter(l => l.nome || l.cor).map(l => {
                          const ativo = card.labels.some(x => x.id === l.id);
                          return (
                            <button key={l.id} disabled={salvando}
                              onClick={() => salvar(() => api.toggleLabel(id, l.id, !ativo))}
                              style={{
                                textAlign: "left", fontSize: 10, cursor: "pointer", padding: "4px 8px",
                                fontWeight: 600, color: "#111", background: labelCor(l.cor),
                                border: `2px solid ${ativo ? t.textPrimary : "transparent"}`,
                                opacity: ativo ? 1 : 0.65, borderRadius: 2,
                              }}>
                              {ativo ? "✓ " : ""}{l.nome || l.cor}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={rotulo}>⏱ Prazo de entrega</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {/* Sem disabled aqui: desabilitar no meio da digitação
                          tirava o foco do campo e travava o ano. */}
                      <input type="date"
                        value={dueDraft ?? (card.due ? card.due.slice(0, 10) : "")}
                        onChange={e => setDueDraft(e.target.value)}
                        onBlur={commitPrazo}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        style={{ ...inputBase, padding: "5px 8px", fontSize: 11, colorScheme: "dark" }} />
                      {card.due && (
                        <label style={{
                          display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer",
                          color: atrasado ? "#EF4444" : card.due_complete ? "#10B981" : t.textSecondary,
                        }}>
                          <input type="checkbox" checked={card.due_complete} disabled={salvando}
                            onChange={e => salvar(() => api.patchCard(id, { due_complete: e.target.checked }))} />
                          concluído{atrasado ? " (atrasado)" : ""}
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {vendido.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ ...rotulo, color: t.accent }}>◆ O que foi vendido</div>
                    <div style={{ border: `1px solid ${t.accent}`, background: t.card1, padding: "10px 14px" }}>
                      {vendido.map((l, i) => {
                        const cat = l.match(/^\*\*(.+)\*\*$/);
                        if (cat) return (
                          <div key={i} style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                            color: t.accent, marginTop: i ? 8 : 0,
                          }}>
                            {cat[1]}
                          </div>
                        );
                        return (
                          <div key={i} style={{ fontSize: 12, color: t.textPrimary, lineHeight: 1.6 }}>
                            {l.replace(/^-\s*/, "• ")}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 4 }}>
                      Detalhe item a item na aba <b>Produtos</b>.
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 18 }}>
                  <div style={rotulo}>
                    Descrição{" "}
                    {!editDesc && (
                      <button onClick={() => { setDescDraft(card.descricao); setEditDesc(true); }}
                        title="Editar descrição"
                        style={{ background: "transparent", border: "none", color: t.accent, cursor: "pointer", fontSize: 10, padding: 0 }}>
                        ✎
                      </button>
                    )}
                  </div>
                  {editDesc ? (
                    <>
                      <FormatBar textareaRef={descRef} value={descDraft} onChange={setDescDraft} t={t} />
                      <textarea autoFocus ref={descRef} value={descDraft} onChange={e => setDescDraft(e.target.value)}
                        rows={Math.min(14, Math.max(5, descDraft.split("\n").length + 1))}
                        style={{ ...inputBase, width: "100%", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }} />
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button disabled={salvando}
                          onClick={() => { setEditDesc(false); salvar(() => api.patchCard(id, { descricao: descDraft })); }}
                          style={{
                            background: t.accent, border: "none", color: "#fff", cursor: "pointer",
                            padding: "6px 14px", fontSize: 11, fontWeight: 600,
                          }}>
                          Salvar
                        </button>
                        <button onClick={() => setEditDesc(false)}
                          style={{
                            background: "transparent", border: `1px solid ${t.border2}`, color: t.textSecondary,
                            cursor: "pointer", padding: "6px 14px", fontSize: 11,
                          }}>
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : card.descricao ? (
                    <div onClick={() => { setDescDraft(card.descricao); setEditDesc(true); }}
                      title="Clique para editar"
                      style={{
                        fontFamily: "inherit", fontSize: 12, color: t.textPrimary,
                        lineHeight: 1.6, margin: 0, cursor: "text",
                        background: t.card1, border: `1px solid ${t.border1}`, padding: "10px 12px",
                      }}>
                      {descLimpa
                        ? <RichText texto={descLimpa} t={t} onZoom={u => setImgAberta(u)} />
                        : <span style={{ color: t.textTertiary }}>— (só marcas técnicas — clique para ver/editar)</span>}
                    </div>
                  ) : (
                    <div onClick={() => { setDescDraft(""); setEditDesc(true); }}
                      style={{
                        fontSize: 11, color: t.textTertiary, cursor: "text",
                        background: t.card1, border: `1px dashed ${t.border1}`, padding: "10px 12px",
                      }}>
                      Adicionar descrição…
                    </div>
                  )}
                </div>

                {card.checklists.map((ch, i) => {
                  const done = ch.itens.filter(x => x.done).length;
                  const pct = ch.itens.length ? (done / ch.itens.length) * 100 : 0;
                  return (
                    <div key={ch.id || i} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                        <div style={rotulo}>{ch.nome}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontSize: 10, color: t.textTertiary }}>{done}/{ch.itens.length}</div>
                          {ch.id && (
                            <button disabled={salvando} title="Remover lista inteira do card"
                              onClick={() => {
                                if (window.confirm(`Remover a lista "${ch.nome}" e todos os ${ch.itens.length} item(ns)?`))
                                  salvar(() => api.delChecklist(id, ch.id!));
                              }}
                              style={{
                                background: "transparent", border: "none", color: t.textTertiary,
                                cursor: "pointer", fontSize: 11, padding: "0 2px", lineHeight: 1,
                              }}>
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ height: 3, background: t.border1, marginBottom: 8 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: t.textPrimary, transition: "width 0.2s" }} />
                      </div>
                      {ch.itens.map((it, j) => (
                        <div key={it.id || j} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 2px" }}>
                          <input type="checkbox" checked={it.done} disabled={salvando || !it.id}
                            onChange={() => it.id && salvar(() => api.checkItem(id, it.id!, !it.done))}
                            style={{ marginTop: 2, cursor: it.id ? "pointer" : "default" }} />
                          <span onClick={() => it.id && !salvando && salvar(() => api.checkItem(id, it.id!, !it.done))}
                            style={{
                              flex: 1, fontSize: 12, color: it.done ? t.textTertiary : t.textPrimary,
                              textDecoration: it.done ? "line-through" : "none",
                              cursor: it.id ? "pointer" : "default",
                            }}>
                            {it.nome}
                          </span>
                          {ch.id && it.id && (
                            <button disabled={salvando} title="Remover item"
                              onClick={() => salvar(() => api.delCheckItem(id, ch.id!, it.id!))}
                              style={{
                                background: "transparent", border: "none", color: t.textTertiary,
                                cursor: "pointer", fontSize: 11, padding: "0 2px", lineHeight: 1.4,
                              }}>
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      {ch.id && (
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <input value={novoItem[ch.id] || ""} disabled={salvando}
                            onChange={e => setNovoItem(v => ({ ...v, [ch.id!]: e.target.value }))}
                            onKeyDown={e => {
                              const nome = (novoItem[ch.id!] || "").trim();
                              if (e.key === "Enter" && nome)
                                salvar(async () => {
                                  await api.addCheckItem(id, ch.id!, nome);
                                  setNovoItem(v => ({ ...v, [ch.id!]: "" }));
                                });
                            }}
                            placeholder="Adicionar item…"
                            style={{ ...inputBase, flex: 1, padding: "5px 8px", fontSize: 11 }} />
                          <button disabled={salvando || !(novoItem[ch.id] || "").trim()}
                            onClick={() => {
                              const nome = (novoItem[ch.id!] || "").trim();
                              if (nome) salvar(async () => {
                                await api.addCheckItem(id, ch.id!, nome);
                                setNovoItem(v => ({ ...v, [ch.id!]: "" }));
                              });
                            }}
                            style={{
                              background: `${t.accent}1f`, border: `1px solid ${t.accent}55`, color: t.accent,
                              cursor: "pointer", padding: "0 12px", fontSize: 12, fontWeight: 600,
                              opacity: (novoItem[ch.id] || "").trim() ? 1 : 0.4,
                            }}>
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div style={{ display: "flex", gap: 6 }}>
                  <input value={novaChecklist} disabled={salvando}
                    onChange={e => setNovaChecklist(e.target.value)}
                    onKeyDown={e => {
                      const nome = novaChecklist.trim();
                      if (e.key === "Enter" && nome)
                        salvar(async () => { await api.addChecklist(id, nome); setNovaChecklist(""); });
                    }}
                    placeholder="+ Nova lista de tarefas (ex.: PROJETO EXECUTIVO)"
                    style={{ ...inputBase, flex: 1, fontSize: 11, padding: "6px 10px" }} />
                  <button disabled={salvando || !novaChecklist.trim()}
                    onClick={() => {
                      const nome = novaChecklist.trim();
                      if (nome) salvar(async () => { await api.addChecklist(id, nome); setNovaChecklist(""); });
                    }}
                    title="Criar nova lista de tarefas no card"
                    style={{
                      fontFamily: "inherit", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                      background: `${t.accent}1f`, border: `1px solid ${t.accent}55`, color: t.accent,
                      cursor: novaChecklist.trim() ? "pointer" : "default",
                      padding: "0 14px", fontWeight: 700,
                      opacity: novaChecklist.trim() ? 1 : 0.4,
                    }}>
                    + Criar lista
                  </button>
                </div>
              </div>
            )}

            {aba === "produtos" && <ProdutosTab cardId={id} t={t} />}

            {aba === "aditivo" && <AditivoTab cardId={id} t={t} />}

            {aba === "fiscal" && <FiscalTab cardId={id} t={t} />}

            {aba === "anexos" && (
              <div style={{ padding: 20 }}>
                {imagens.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={rotulo}>Imagens ({imagens.length})</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                      {imagens.map(a => (
                        <div key={a.id} style={{ position: "relative" }}>
                          <img src={anexoUrl(a.path_local!)} loading="lazy" alt={a.nome}
                            title={a.nome} onClick={() => setImgAberta(anexoUrl(a.path_local!))}
                            style={{
                              width: "100%", height: 120, objectFit: "cover", cursor: "zoom-in",
                              border: `1px solid ${t.border1}`, display: "block",
                            }} />
                          <button disabled={salvando} title="Remover imagem do card"
                            onClick={() => {
                              if (window.confirm(`Remover "${a.nome}" do card?`))
                                salvar(() => api.delAnexo(id, a.id));
                            }}
                            style={{
                              position: "absolute", top: 4, right: 4, width: 20, height: 20,
                              background: "rgba(0,0,0,0.65)", border: "none", color: "#fff",
                              cursor: "pointer", fontSize: 10, lineHeight: 1, padding: 0,
                            }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ ...rotulo, display: "flex", alignItems: "center", gap: 10 }}>
                    <span>Arquivos ({arquivos.length})</span>
                    <label title="Enviar arquivos pro card" style={{
                      color: t.accent, cursor: salvando ? "default" : "pointer",
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                      opacity: salvando ? 0.5 : 1,
                    }}>
                      📎 {salvando ? "Enviando…" : "+ Adicionar arquivos"}
                      <input type="file" multiple hidden disabled={salvando}
                        onChange={e => {
                          const files = Array.from(e.target.files || []);
                          e.target.value = "";
                          if (files.length)
                            salvar(async () => { for (const f of files) await api.uploadAnexo(id, f); });
                        }} />
                    </label>
                  </div>
                  {arquivos.length === 0 && (
                    <div style={{ fontSize: 11, color: t.textTertiary, padding: "8px 0" }}>Nenhum arquivo.</div>
                  )}
                  {arquivos.map(a => (
                    <div key={a.id} style={{
                      display: "flex", gap: 8, alignItems: "center", fontSize: 12,
                      padding: "7px 0", borderBottom: `1px solid ${t.border1}`,
                    }}>
                      <span>📄</span>
                      {a.baixado && a.path_local ? (
                        <a href={anexoUrl(a.path_local)} target="_blank" rel="noreferrer"
                          style={{ color: t.accent, textDecoration: "none", wordBreak: "break-all" }}>
                          {a.nome}
                        </a>
                      ) : !a.is_upload && a.url_trello ? (
                        <a href={a.url_trello} target="_blank" rel="noreferrer"
                          style={{ color: t.accent, textDecoration: "none", wordBreak: "break-all" }}>
                          {a.nome || a.url_trello}
                        </a>
                      ) : (
                        <span style={{ color: t.textSecondary }}>{a.nome} (indisponível)</span>
                      )}
                      <span style={{ color: t.textTertiary, fontSize: 9, whiteSpace: "nowrap" }}>
                        {fmtBytes(a.bytes)}{a.criado_em ? ` · ${fmtBr(a.criado_em)}` : ""}
                      </span>
                      <button disabled={salvando} title="Remover anexo do card"
                        onClick={() => {
                          if (window.confirm(`Remover "${a.nome || "anexo"}" do card?`))
                            salvar(() => api.delAnexo(id, a.id));
                        }}
                        style={{
                          marginLeft: "auto", background: "transparent", border: "none",
                          color: t.textTertiary, cursor: "pointer", fontSize: 11, padding: "0 2px",
                        }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aba === "comentarios" && (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  {(card.comentarios_locais?.length ?? 0) === 0 && card.comentarios.length === 0 && (
                    <div style={{ color: t.textTertiary, fontSize: 11, textAlign: "center", padding: 20 }}>
                      Nenhum comentário ainda.
                    </div>
                  )}
                  {/* Comentários locais (novos) - com nome real + edit/delete */}
                  {(card.comentarios_locais || []).map(cm => (
                    <ComentarioLocalItem key={`l${cm.id}`} cm={cm} t={t} user={user}
                      cardId={id} onZoom={u => setImgAberta(u)} onChanged={reload} />
                  ))}
                  {/* Comentários históricos do Trello (feed antigo, autor sempre "Will"
                      porque era postado com token do setor). Marcados como "histórico"
                      pra deixar claro que não são comentários novos do time. */}
                  {card.comentarios.length > 0 && (card.comentarios_locais?.length ?? 0) > 0 && (
                    <div style={{
                      fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase",
                      color: t.textTertiary, marginTop: 6, marginBottom: 2,
                    }}>
                      Histórico (Trello)
                    </div>
                  )}
                  {card.comentarios.map(cm => (
                    <div key={cm.id} style={{
                      background: t.card1, border: `1px solid ${t.border1}`, padding: "8px 10px",
                      opacity: 0.75,
                    }}>
                      <div style={{ fontSize: 9.5, color: t.textTertiary, marginBottom: 3 }}>
                        <b style={{ color: t.textSecondary }}>{cm.autor}</b>
                        {cm.data ? ` · ${fmtBr(cm.data)}` : ""}
                        <span style={{ marginLeft: 6, fontSize: 8, color: t.textTertiary,
                          letterSpacing: "0.08em", textTransform: "uppercase" }}>histórico</span>
                      </div>
                      <ComentarioTexto texto={cm.texto} t={t} onZoom={u => setImgAberta(u)} />
                    </div>
                  ))}
                </div>
                <div style={{ padding: 12, borderTop: `1px solid ${t.border1}`, display: "flex", flexDirection: "column", gap: 8 }}>
                  {anexosComentario.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {anexosComentario.map((f, i) => {
                        const isImg = f.type.startsWith("image/");
                        const url = isImg ? URL.createObjectURL(f) : "";
                        return (
                          <div key={i} title={f.name} style={{
                            position: "relative", border: `1px solid ${t.border1}`, background: t.card1,
                            padding: isImg ? 0 : "5px 22px 5px 8px", display: "flex",
                            alignItems: "center", gap: 6, fontSize: 10, color: t.textSecondary,
                          }}>
                            {isImg
                              ? <img src={url} alt="" style={{ width: 60, height: 60, objectFit: "cover", display: "block" }} />
                              : <span>📎 {f.name.length > 22 ? f.name.slice(0, 20) + "…" : f.name}</span>}
                            <button disabled={salvando} title="Remover" onClick={() => {
                              setAnexosComentario(v => v.filter((_, j) => j !== i));
                              if (isImg) URL.revokeObjectURL(url);
                            }} style={{
                              position: "absolute", top: 1, right: 1, width: 18, height: 18,
                              background: "rgba(0,0,0,0.65)", border: "none", color: "#fff",
                              cursor: "pointer", fontSize: 10, lineHeight: 1, padding: 0,
                            }}>✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <FormatBar textareaRef={comRef} value={novoComentario} onChange={setNovoComentario} t={t} />
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <textarea ref={comRef} value={novoComentario} onChange={e => setNovoComentario(e.target.value)}
                      placeholder="Escreva um comentário… (Ctrl+V pra colar imagem, ou anexe abaixo)" rows={2}
                      onPaste={e => {
                        const files: File[] = [];
                        for (const it of Array.from(e.clipboardData?.items || [])) {
                          if (it.kind === "file") { const f = it.getAsFile(); if (f) files.push(f); }
                        }
                        if (files.length) { e.preventDefault(); setAnexosComentario(v => [...v, ...files]); }
                      }}
                      style={{ ...inputBase, flex: 1, resize: "none", lineHeight: 1.5 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label title="Anexar arquivos" style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        background: t.inputBg, border: `1px solid ${t.border1}`, color: t.textSecondary,
                        cursor: salvando ? "default" : "pointer", padding: "0 10px", height: 30,
                        fontSize: 14, opacity: salvando ? 0.5 : 1,
                      }}>
                        📎
                        <input type="file" multiple hidden disabled={salvando}
                          onChange={e => {
                            const files = Array.from(e.target.files || []);
                            e.target.value = "";
                            if (files.length) setAnexosComentario(v => [...v, ...files]);
                          }} />
                      </label>
                      <button disabled={salvando || (!novoComentario.trim() && anexosComentario.length === 0)} title="Enviar"
                        onClick={() => {
                          const texto = novoComentario.trim();
                          const arquivos = anexosComentario;
                          salvar(async () => {
                            // Endpoint local aceita 1 anexo por comentário; se vieram vários,
                            // envia N comentários (um por anexo) — o primeiro leva o texto.
                            if (arquivos.length <= 1) {
                              await api.criarComentarioLocal(id, texto, arquivos[0] || null);
                            } else {
                              for (let i = 0; i < arquivos.length; i++) {
                                const t2 = i === 0 ? texto : "";
                                await api.criarComentarioLocal(id, t2, arquivos[i]);
                              }
                            }
                            setNovoComentario(""); setAnexosComentario([]);
                          });
                        }}
                        style={{
                          background: t.accent, color: "#fff", border: "none", padding: "0 14px", height: 34,
                          cursor: (novoComentario.trim() || anexosComentario.length) ? "pointer" : "default",
                          opacity: (novoComentario.trim() || anexosComentario.length) ? 1 : 0.4, fontSize: 13,
                        }}>
                        ➤
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {aba === "documentos" && (
              <div style={{ padding: 20 }}>
                <DocsUnificados id={id} t={t} />
              </div>
            )}

            </div>
          </>
        )}
      </div>

      {imgAberta && (
        <div onClick={() => setImgAberta(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 110,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out",
        }}>
          <img src={imgAberta} alt="" style={{ maxWidth: "94vw", maxHeight: "94vh", objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}

/* Bloco cliente/endereço/CNPJ — leitura + edição inline (gestora só). */
function BlocoDadosCliente({ card, t, souGestora, onSaved }: {
  card: CardDetalhe; t: any; souGestora: boolean;
  onSaved: (p: { cliente: string | null; endereco: string | null; cnpj_cpf: string | null }) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [cliente, setCliente] = useState(card.cliente || "");
  const [endereco, setEndereco] = useState(card.endereco || "");
  const [cnpj, setCnpj] = useState(card.cnpj_cpf || "");
  const [salvando, setSalvando] = useState(false);

  const abrirEdicao = () => {
    setCliente(card.cliente || "");
    setEndereco(card.endereco || "");
    setCnpj(card.cnpj_cpf || "");
    setEditando(true);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await api.cardDados(card.id, { cliente, endereco, cnpj_cpf: cnpj });
      onSaved({ cliente: r.cliente, endereco: r.endereco, cnpj_cpf: r.cnpj_cpf });
      setEditando(false);
    } catch (e: any) {
      alert("Erro ao salvar: " + (e?.message || e));
    } finally { setSalvando(false); }
  };

  const temAlgumDado = card.cliente || card.endereco || card.cnpj_cpf ||
                       card.numero_proposta || card.obra_code;
  if (!souGestora && !temAlgumDado) return null;

  const inp: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border1}`, color: t.textPrimary,
    padding: "5px 8px", fontSize: 11, outline: "none", flex: 1, minWidth: 140,
  };

  return (
    <div style={{
      padding: "10px 20px", borderBottom: `1px solid ${t.border1}`,
      background: t.card2, fontSize: 11, color: t.textSecondary,
    }}>
      {editando ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={cliente} onChange={e => setCliente(e.target.value)}
              placeholder="Cliente" style={{ ...inp, flex: 2 }} />
            <input value={cnpj} onChange={e => setCnpj(e.target.value)}
              placeholder="CNPJ/CPF" style={inp} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={endereco} onChange={e => setEndereco(e.target.value)}
              placeholder="Endereço completo (rua, nº, bairro, cidade — UF)"
              style={{ ...inp, flex: 1 }} />
            <button onClick={salvar} disabled={salvando} style={{
              background: t.accent, border: `1px solid ${t.accent}`, color: "#0A0A0A",
              padding: "5px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
              cursor: salvando ? "wait" : "pointer",
            }}>SALVAR</button>
            <button onClick={() => setEditando(false)} disabled={salvando} style={{
              background: "none", border: `1px solid ${t.border1}`, color: t.textSecondary,
              padding: "5px 12px", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer",
            }}>CANCELAR</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
          <div>
            <span style={{ fontSize: 9, letterSpacing: "0.12em", color: t.textTertiary }}>CLIENTE </span>
            <span style={{ color: t.textPrimary, fontWeight: 600 }}>{card.cliente || "—"}</span>
          </div>
          <div title={card.endereco || ""}>
            <span style={{ fontSize: 9, letterSpacing: "0.12em", color: t.textTertiary }}>ENDEREÇO </span>
            {card.endereco ? (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.endereco)}`}
                target="_blank" rel="noreferrer"
                style={{ color: t.textPrimary, textDecoration: "none", borderBottom: `1px dotted ${t.border2}` }}>
                {card.endereco}
              </a>
            ) : <span style={{ color: t.textTertiary }}>—</span>}
          </div>
          <div>
            <span style={{ fontSize: 9, letterSpacing: "0.12em", color: t.textTertiary }}>CNPJ/CPF </span>
            <span style={{ color: card.cnpj_cpf ? t.textPrimary : t.textTertiary, fontFamily: "monospace" }}>
              {card.cnpj_cpf || "—"}
            </span>
          </div>
          {card.numero_proposta && (
            <div>
              <span style={{ fontSize: 9, letterSpacing: "0.12em", color: t.textTertiary }}>Nº PROPOSTA </span>
              <span style={{ color: t.textPrimary, fontFamily: "monospace" }}>{card.numero_proposta}</span>
            </div>
          )}
          {card.obra_code && (
            <div>
              <span style={{ fontSize: 9, letterSpacing: "0.12em", color: t.textTertiary }}>OBRA </span>
              <span style={{ color: t.textPrimary, fontFamily: "monospace" }}>{card.obra_code}</span>
            </div>
          )}
          {souGestora && (
            <button onClick={abrirEdicao} style={{
              marginLeft: "auto", background: "none", border: `1px solid ${t.border1}`,
              color: t.textSecondary, padding: "3px 10px", fontSize: 9,
              letterSpacing: "0.12em", cursor: "pointer",
            }}>EDITAR</button>
          )}
        </div>
      )}
    </div>
  );
}

/* Botão de aba — sublinhado no ativo, badge opcional (contagem/dot). */
function TabBtn({ ativa, onClick, t, children, badge }: {
  ativa: boolean; onClick: () => void; t: any;
  children: React.ReactNode; badge?: string;
}) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: "none",
      borderBottom: `2px solid ${ativa ? t.accent : "transparent"}`,
      color: ativa ? t.accent : t.textSecondary,
      padding: "10px 14px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer",
      letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      {children}
      {badge && (
        <span style={{
          fontSize: 8.5, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
          background: ativa ? t.accent : t.border1, color: ativa ? "#fff" : t.textTertiary,
          letterSpacing: 0,
        }}>{badge}</span>
      )}
    </button>
  );
}

/* Barra de formatação básica pra qualquer textarea (envolve a seleção).
   Markdown do Trello: **b**, _i_, ~~s~~, `code`, [txt](url), - lista. */
function FormatBar({ textareaRef, value, onChange, t }: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string; onChange: (v: string) => void; t: any;
}) {
  const wrap = (left: string, right: string = left, ph = "texto") => {
    const el = textareaRef.current; if (!el) return;
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    const sel = value.slice(s, e) || ph;
    const nv = value.slice(0, s) + left + sel + right + value.slice(e);
    onChange(nv);
    requestAnimationFrame(() => {
      el.focus();
      const start = s + left.length;
      el.setSelectionRange(start, start + sel.length);
    });
  };
  const linhaPrefixo = (pref: string) => {
    const el = textareaRef.current; if (!el) return;
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    const inicio = value.lastIndexOf("\n", s - 1) + 1;
    const fim = value.indexOf("\n", e); const end = fim === -1 ? value.length : fim;
    const bloco = value.slice(inicio, end);
    const nb = bloco.split("\n").map(l => (l.startsWith(pref) ? l : pref + l)).join("\n");
    const nv = value.slice(0, inicio) + nb + value.slice(end);
    onChange(nv);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(inicio, inicio + nb.length);
    });
  };
  const link = () => {
    const url = window.prompt("URL:"); if (!url) return;
    wrap("[", `](${url})`, "texto do link");
  };
  const bt = (label: string, title: string, fn: () => void, style?: React.CSSProperties) => (
    <button type="button" title={title} onMouseDown={e => e.preventDefault()} onClick={fn}
      style={{
        background: t.inputBg, border: `1px solid ${t.border1}`, color: t.textSecondary,
        cursor: "pointer", padding: "3px 8px", fontSize: 11, minWidth: 26, ...style,
      }}>
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 3, marginBottom: 5, flexWrap: "wrap" }}>
      {bt("B", "Negrito (**txt**)", () => wrap("**"), { fontWeight: 700 })}
      {bt("I", "Itálico (_txt_)", () => wrap("_"), { fontStyle: "italic" })}
      {bt("S", "Riscado (~~txt~~)", () => wrap("~~"), { textDecoration: "line-through" })}
      {bt("</>", "Código (`txt`)", () => wrap("`"), { fontFamily: "monospace", fontSize: 10 })}
      {bt("🔗", "Link", link)}
      {bt("• ", "Lista", () => linhaPrefixo("- "))}
      {bt("1.", "Numerada", () => linhaPrefixo("1. "))}
      {bt("H", "Título (##)", () => linhaPrefixo("## "), { fontWeight: 700 })}
    </div>
  );
}

/* Renderer markdown-lite: **b**, _i_, *i*, ~~s~~, `code`, [txt](url),
   ![alt](url), URLs soltas e imagens (/anexos/...) viram thumb clicável.
   Suporta listas simples (- item) e mantém quebras de linha. */
function RichText({ texto, t, onZoom }: { texto: string; t: any; onZoom?: (url: string) => void }) {
  const inline = (s: string): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    // ordem importa: imagem antes de link, code antes de bold pra proteger conteúdo
    const re = /!\[([^\]]*)\]\((\S+?)\)|\[([^\]]+)\]\((\S+?)\)|`([^`]+)`|\*\*([^*]+)\*\*|~~([^~]+)~~|(?:\b)_([^_]+)_(?:\b)|(?:^|\s)\*([^*\s][^*]*)\*(?=\s|$)|(https?:\/\/\S+|\/anexos\/\S+)/g;
    let last = 0, m: RegExpExecArray | null, k = 0;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push(s.slice(last, m.index));
      if (m[1] !== undefined && m[2]) {
        out.push(
          <img key={k++} src={m[2]} alt={m[1]} loading="lazy"
            onClick={() => onZoom && onZoom(m![2])}
            style={{
              maxWidth: "100%", maxHeight: 220, display: "block", margin: "6px 0",
              border: `1px solid ${t.border1}`, cursor: onZoom ? "zoom-in" : "default",
            }} />
        );
      } else if (m[3] && m[4]) {
        out.push(<a key={k++} href={m[4]} target="_blank" rel="noreferrer" style={{ color: t.accent }}>{m[3]}</a>);
      } else if (m[5]) {
        out.push(<code key={k++} style={{
          fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: "0.9em",
          background: t.border1, padding: "1px 5px", borderRadius: 2,
        }}>{m[5]}</code>);
      } else if (m[6]) {
        out.push(<b key={k++}>{m[6]}</b>);
      } else if (m[7]) {
        out.push(<span key={k++} style={{ textDecoration: "line-through" }}>{m[7]}</span>);
      } else if (m[8]) {
        out.push(<i key={k++}>{m[8]}</i>);
      } else if (m[9]) {
        out.push(<i key={k++}>{m[9]}</i>);
      } else if (m[10]) {
        const url = m[10];
        const isImg = /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|$)/i.test(url);
        if (isImg) {
          out.push(
            <img key={k++} src={url} alt="" loading="lazy"
              onClick={() => onZoom && onZoom(url)}
              style={{
                maxWidth: "100%", maxHeight: 220, display: "block", margin: "6px 0",
                border: `1px solid ${t.border1}`, cursor: onZoom ? "zoom-in" : "default",
              }} />
          );
        } else {
          out.push(<a key={k++} href={url} target="_blank" rel="noreferrer" style={{ color: t.accent }}>{url}</a>);
        }
      }
      last = re.lastIndex;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
  };
  const linhas = texto.split("\n");
  const blocos: React.ReactNode[] = [];
  let listaAtual: string[] | null = null;
  let ordAtual = false;
  const flushLista = () => {
    if (!listaAtual) return;
    const items = listaAtual;
    blocos.push(
      ordAtual
        ? <ol key={blocos.length} style={{ margin: "4px 0", paddingLeft: 22 }}>
            {items.map((li, j) => <li key={j}>{inline(li)}</li>)}
          </ol>
        : <ul key={blocos.length} style={{ margin: "4px 0", paddingLeft: 22 }}>
            {items.map((li, j) => <li key={j}>{inline(li)}</li>)}
          </ul>
    );
    listaAtual = null;
  };
  linhas.forEach((linha, i) => {
    const li = linha.match(/^\s*[-*]\s+(.+)$/);
    const ol = linha.match(/^\s*\d+\.\s+(.+)$/);
    const h = linha.match(/^(#{1,3})\s+(.+)$/);
    if (li) {
      if (listaAtual && ordAtual) flushLista();
      listaAtual = listaAtual || []; ordAtual = false;
      listaAtual.push(li[1]);
    } else if (ol) {
      if (listaAtual && !ordAtual) flushLista();
      listaAtual = listaAtual || []; ordAtual = true;
      listaAtual.push(ol[1]);
    } else {
      flushLista();
      if (h) {
        const Tag = (["h3", "h4", "h5"] as const)[h[1].length - 1];
        blocos.push(
          <Tag key={i} style={{
            margin: "8px 0 4px", fontSize: h[1].length === 1 ? 14 : h[1].length === 2 ? 13 : 12,
            fontWeight: 700, color: t.textPrimary,
          }}>
            {inline(h[2])}
          </Tag>
        );
      } else if (linha.trim() === "") {
        blocos.push(<div key={i} style={{ height: 4 }} />);
      } else {
        blocos.push(<div key={i} style={{ minHeight: "1em" }}>{inline(linha)}</div>);
      }
    }
  });
  flushLista();
  return <div style={{ fontSize: 12, color: t.textPrimary, lineHeight: 1.55, wordBreak: "break-word" }}>{blocos}</div>;
}

/* Renderiza o texto de um comentário — reaproveita RichText, que já cobre
   imagens inline (![](/anexos/...)) e links. */
function ComentarioTexto({ texto, t, onZoom }: { texto: string; t: any; onZoom?: (url: string) => void }) {
  return <RichText texto={texto} t={t} onZoom={onZoom} />;
}

/* Comentário local — autor edita o texto do próprio; autor ou gestora apagam.
   Tem anexo? Mostra thumbnail (img) ou link (outro tipo). Foi criado quando
   substituímos os comentários do Trello, pra parar de sair todos como "Will". */
function ComentarioLocalItem({ cm, t, user, cardId, onZoom, onChanged }: {
  cm: ComentarioLocal; t: any; user: AppUser; cardId: string;
  onZoom: (url: string) => void; onChanged: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(cm.texto);
  const [salvando, setSalvando] = useState(false);
  const [erroLocal, setErroLocal] = useState("");
  const meuComentario = cm.user_id === user.id;
  const podeApagar = meuComentario || user.is_gestora;
  const dataStr = cm.created_at
    ? new Date(cm.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "";
  const salvarEdit = async () => {
    const txt = rascunho.trim();
    if (!txt) { setErroLocal("texto vazio"); return; }
    setSalvando(true); setErroLocal("");
    try {
      await api.editarComentarioLocal(cardId, cm.id, txt);
      setEditando(false);
      onChanged();
    } catch (e) { setErroLocal(String(e)); }
    finally { setSalvando(false); }
  };
  const apagar = async () => {
    if (!window.confirm("Apagar este comentário?")) return;
    setSalvando(true); setErroLocal("");
    try {
      await api.apagarComentarioLocal(cardId, cm.id);
      onChanged();
    } catch (e) { setErroLocal(String(e)); setSalvando(false); }
  };
  return (
    <div style={{
      background: t.card1, border: `1px solid ${t.border1}`, padding: "8px 10px",
    }}>
      <div style={{
        fontSize: 9.5, color: t.textTertiary, marginBottom: 3,
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
      }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <b style={{ color: t.textSecondary }}>{cm.autor_nome}</b>
          {dataStr ? ` , ${dataStr}` : ""}
          {cm.edited_at && (
            <span title={`Editado em ${new Date(cm.edited_at).toLocaleString("pt-BR")}`}
              style={{ marginLeft: 6, fontStyle: "italic" }}>
              (editado)
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {meuComentario && !editando && (
            <button title="Editar" onClick={() => { setRascunho(cm.texto); setEditando(true); }}
              style={{
                background: "transparent", border: "none", color: t.accent,
                cursor: "pointer", fontSize: 10, padding: "0 3px",
              }}>Editar</button>
          )}
          {podeApagar && !editando && (
            <button title="Apagar" onClick={apagar} disabled={salvando}
              style={{
                background: "transparent", border: "none", color: "#EF4444",
                cursor: "pointer", fontSize: 10, padding: "0 3px",
              }}>Apagar</button>
          )}
        </div>
      </div>
      {editando ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea value={rascunho} onChange={e => setRascunho(e.target.value)}
            rows={Math.min(8, Math.max(2, rascunho.split("\n").length + 1))}
            autoFocus disabled={salvando}
            style={{
              background: t.inputBg, border: `1px solid ${t.border1}`, color: t.textPrimary,
              fontSize: 12, padding: "6px 8px", outline: "none", lineHeight: 1.5, resize: "vertical",
            }} />
          <div style={{ display: "flex", gap: 6 }}>
            <button disabled={salvando} onClick={salvarEdit}
              style={{
                background: t.accent, border: "none", color: "#fff", cursor: "pointer",
                padding: "5px 12px", fontSize: 11, fontWeight: 600,
              }}>Salvar</button>
            <button disabled={salvando} onClick={() => setEditando(false)}
              style={{
                background: "transparent", border: `1px solid ${t.border2}`,
                color: t.textSecondary, cursor: "pointer", padding: "5px 12px", fontSize: 11,
              }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <ComentarioTexto texto={cm.texto} t={t} onZoom={onZoom} />
      )}
      {cm.anexo_url && !editando && (
        <div style={{ marginTop: 6 }}>
          {cm.anexo_mime?.startsWith("image/") ? (
            <img src={cm.anexo_url} alt={cm.anexo_nome || ""} loading="lazy"
              onClick={() => onZoom(cm.anexo_url!)}
              style={{
                maxWidth: "100%", maxHeight: 220, display: "block",
                border: `1px solid ${t.border1}`, cursor: "zoom-in",
              }} />
          ) : (
            <a href={cm.anexo_url} target="_blank" rel="noreferrer"
              style={{ color: t.accent, fontSize: 11 }}>
              {cm.anexo_nome || "arquivo"}
            </a>
          )}
        </div>
      )}
      {erroLocal && (
        <div style={{ marginTop: 4, color: "#EF4444", fontSize: 10 }}>{erroLocal}</div>
      )}
    </div>
  );
}

/* ─── Aba Aditivo — orçamentos aditivos vindos da Valor + thread de comentários ─── */
type AditivoComent = {
  id: number; autor_nome: string; autor_email: string | null; texto: string; created_at: string | null;
  anexo_url: string | null; anexo_nome: string | null; anexo_mime: string | null; anexo_bytes: number | null;
};

function AditivoTab({ cardId, t }: { cardId: string; t: any }) {
  const [aditivos, setAditivos] = useState<AditivoSim[] | null>(null);
  const [erro, setErro] = useState("");
  const [coments, setComents] = useState<AditivoComent[]>([]);
  const [novo, setNovo] = useState("");
  const [arq, setArq] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const arqRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    api.aditivos(cardId)
      .then(d => setAditivos(d.aditivos))
      .catch(e => setErro(String(e)));
    api.aditivoComentarios(cardId)
      .then(d => setComents(d.comentarios))
      .catch(() => {});
  }, [cardId]);
  const enviar = async () => {
    const texto = novo.trim();
    if ((!texto && !arq) || enviando) return;
    setEnviando(true);
    try {
      const c = await api.criarAditivoComentario(cardId, texto, arq);
      setComents(prev => [c, ...prev]);
      setNovo("");
      setArq(null);
      if (arqRef.current) arqRef.current.value = "";
    } catch (e) {
      alert(String(e));
    } finally {
      setEnviando(false);
    }
  };
  if (erro) return <div style={{ padding: 20, color: "#EF4444", fontSize: 11 }}>{erro}</div>;
  if (aditivos === null) return <div style={{ padding: 20, color: t.textTertiary, fontSize: 11 }}>Carregando…</div>;
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 11, color: t.textTertiary, marginBottom: 14, lineHeight: 1.6 }}>
        Orçamentos <strong style={{ color: t.textSecondary }}>aditivos</strong> gerados no Valor pra este cliente.
        Toda vez que o comercial marcar "É aditivo" no Valor, aparece aqui automaticamente e o card ganha a tag ADITIVO.
      </div>
      {aditivos.length === 0 ? (
        <div style={{
          padding: 30, textAlign: "center", color: t.textTertiary, fontSize: 11,
          border: `1px dashed ${t.border1}`,
        }}>
          Nenhum aditivo aberto até agora.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {aditivos.map(a => {
            const url = `https://valor.parket.works/?card=${cardId}&sim=${a.id}`;
            const fechado = (a.status || "").toLowerCase() === "fechada"
                          || (a.status || "").toLowerCase() === "fechado";
            const corBase = fechado ? "#10B981" : "#8B5CF6";
            return (
              <a key={a.id} href={url} target="_blank" rel="noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                  background: fechado ? "#10B98108" : t.card2, border: `1px solid ${fechado ? "#10B98155" : t.border1}`,
                  borderLeft: `3px solid ${corBase}`, color: t.textPrimary, textDecoration: "none",
                }}>
                <span style={{
                  fontSize: 8.5, fontWeight: 700, letterSpacing: "0.08em",
                  color: corBase, padding: "2px 6px", border: `1px solid ${corBase}55`,
                }}>
                  ◆ {fechado ? "ADITIVO FECHADO" : "ADITIVO"}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 12 }}>#{a.numero ?? "—"}</span>
                <span style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.cliente || "—"}
                </span>
                <span style={{
                  fontSize: 8.5, letterSpacing: "0.08em",
                  color: fechado ? "#10B981" : t.textTertiary,
                  border: `1px solid ${fechado ? "#10B98155" : t.border2}`, padding: "2px 8px", textTransform: "uppercase",
                  fontWeight: fechado ? 700 : 400,
                }}>
                  {a.status || "rascunho"}
                </span>
                <span style={{ fontSize: 9.5, color: t.textTertiary }}>
                  {a.created_at ? fmtBr(a.created_at) : ""}
                </span>
                <span style={{ fontSize: 10, color: t.accent }}>abrir ↗</span>
              </a>
            );
          })}
        </div>
      )}

      {/* ─── Comentários ─── */}
      <div style={{
        marginTop: 24, paddingTop: 16, borderTop: `1px solid ${t.border1}`,
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
          color: t.textTertiary, marginBottom: 10,
        }}>
          COMENTÁRIOS <span style={{ color: t.textSecondary }}>({coments.length})</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          <textarea
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar();
            }}
            placeholder="Escrever comentário sobre o aditivo… (Ctrl+Enter envia)"
            rows={2}
            style={{
              background: t.inputBg, border: `1px solid ${t.border1}`,
              color: t.textPrimary, fontSize: 12, padding: "8px 10px",
              outline: "none", resize: "vertical", fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{
              padding: "6px 10px", cursor: "pointer",
              background: t.inputBg, border: `1px solid ${t.border1}`,
              color: t.textSecondary, fontSize: 10, letterSpacing: "0.08em",
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
              📎 ANEXAR
              <input ref={arqRef} type="file" style={{ display: "none" }}
                onChange={(e) => setArq(e.target.files?.[0] || null)} />
            </label>
            {arq && (
              <span style={{ fontSize: 10.5, color: t.textSecondary, display: "inline-flex", alignItems: "center", gap: 6 }}>
                {arq.name} <span style={{ color: t.textTertiary }}>({(arq.size / 1024).toFixed(0)} KB)</span>
                <button onClick={() => { setArq(null); if (arqRef.current) arqRef.current.value = ""; }}
                  title="Remover" style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={enviar} disabled={(!novo.trim() && !arq) || enviando}
              style={{
                padding: "8px 16px",
                background: (novo.trim() || arq) && !enviando ? "#8B5CF6" : t.inputBg,
                color: (novo.trim() || arq) && !enviando ? "white" : t.textTertiary,
                border: "none", cursor: (novo.trim() || arq) && !enviando ? "pointer" : "not-allowed",
                fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
              }}>
              {enviando ? "..." : "ENVIAR"}
            </button>
          </div>
        </div>
        {coments.length === 0 ? (
          <div style={{ fontSize: 11, color: t.textTertiary, fontStyle: "italic" }}>
            Nenhum comentário ainda.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {coments.map((c) => (
              <div key={c.id} style={{
                padding: "8px 12px", background: t.card2, border: `1px solid ${t.border1}`,
                borderLeft: `2px solid #8B5CF6`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: t.textPrimary }}>{c.autor_nome}</span>
                  <span style={{ fontSize: 9.5, color: t.textTertiary }}>
                    {c.created_at ? fmtBr(c.created_at) : ""}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: t.textPrimary, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {c.texto}
                </div>
                {c.anexo_url && (
                  <div style={{ marginTop: 6 }}>
                    {c.anexo_mime && c.anexo_mime.startsWith("image/") ? (
                      <a href={c.anexo_url} target="_blank" rel="noreferrer">
                        <img src={c.anexo_url} alt={c.anexo_nome || ""}
                          style={{ maxHeight: 160, maxWidth: "100%", border: `1px solid ${t.border1}` }} />
                      </a>
                    ) : (
                      <a href={c.anexo_url} target="_blank" rel="noreferrer"
                        style={{
                          fontSize: 11, color: "#8B5CF6", textDecoration: "none",
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "4px 10px", border: `1px solid #8B5CF655`, background: "#8B5CF608",
                        }}>
                        📎 {c.anexo_nome || "anexo"}
                        {c.anexo_bytes ? <span style={{ color: t.textTertiary }}>({(c.anexo_bytes / 1024).toFixed(0)} KB)</span> : null}
                        <span style={{ color: t.accent }}>↗</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Aba Fiscal — laudos, vistorias, fotos, acompanhamento e ocorrências.
       Mesma fonte do gestão: verifica.parket.works / instala.parket.works. ─── */
function FiscalTab({ cardId, t }: { cardId: string; t: any }) {
  const [data, setData] = useState<{
    laudos: any[]; vistorias: any[]; fotos: any[];
    acompanhamento: any | null; ocorrencias: any[];
  } | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    api.fiscal(cardId)
      .then(setData)
      .catch(e => setErro(String(e)));
  }, [cardId]);
  if (erro) return <div style={{ padding: 20, color: "#EF4444", fontSize: 11 }}>{erro}</div>;
  if (!data) return <div style={{ padding: 20, color: t.textTertiary, fontSize: 11 }}>Carregando…</div>;
  const total = data.laudos.length + data.vistorias.length + data.fotos.length
              + data.ocorrencias.length + (data.acompanhamento ? 1 : 0);
  // Fotos sem laudo_id ficam no grid geral; as com laudo_id sobem pra dentro
  // do bloco daquele laudo pra vistoria aparecer inteira, não só thumb solto.
  const fotosPorLaudo = new Map<string, any[]>();
  const fotosSoltas: any[] = [];
  for (const f of data.fotos || []) {
    if (f.laudo_id) {
      const lista = fotosPorLaudo.get(f.laudo_id) || [];
      lista.push(f);
      fotosPorLaudo.set(f.laudo_id, lista);
    } else {
      fotosSoltas.push(f);
    }
  }
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 11, color: t.textTertiary, marginBottom: 14, lineHeight: 1.6 }}>
        Tudo o que o <strong style={{ color: t.textSecondary }}>Fiscal da Obra</strong> registrou
        no app dele — mesma fonte do gestão (laudos, vistorias, acompanhamento e fotos aparecem nos dois lugares).
      </div>
      {total === 0 && (
        <div style={{
          padding: 30, textAlign: "center", color: t.textTertiary, fontSize: 11,
          border: `1px dashed ${t.border1}`,
        }}>
          O fiscal ainda não registrou nada pra esta obra.
        </div>
      )}
      {data.acompanhamento && <AcompanhamentoBloco a={data.acompanhamento} t={t} />}
      {data.laudos.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
            color: t.textTertiary, marginBottom: 8,
          }}>
            VISTORIAS <span style={{ color: t.textSecondary }}>({data.laudos.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.laudos.map(l => (
              <LaudoBloco key={l.id} laudo={l} fotos={fotosPorLaudo.get(l.id) || []} t={t} />
            ))}
          </div>
        </div>
      )}
      <FiscalSecao titulo="AGENDA (VISTORIAS AGENDADAS)" itens={data.vistorias} t={t} />
      <FiscalSecao titulo="OCORRÊNCIAS" itens={data.ocorrencias} t={t} />
      {fotosSoltas.length > 0 && (
        <FotosGrid fotos={fotosSoltas} t={t} titulo="OUTRAS FOTOS" />
      )}
    </div>
  );
}

/* Renderiza uma vistoria/laudo como ACCORDION: fechado mostra só o cabeçalho
   (tipo + status + fiscal + data + contagem de fotos); clicar expande o
   conteúdo completo (descrição, ocorrências, fotos agrupadas por ambiente e
   link pro verifica.parket.works). Fechado por padrão porque uma obra pode
   ter várias vistorias e a lista ficaria quilométrica. */
function LaudoBloco({ laudo, fotos, t }: { laudo: any; fotos: any[]; t: any }) {
  // Cada bloco controla o próprio aberto/fechado (independente dos irmãos).
  const [aberto, setAberto] = useState(false);
  const TIPO_LABEL: Record<string, string> = {
    "1vistoria": "1ª Vistoria",
    "2vistoria": "2ª Vistoria",
    "3vistoria": "3ª Vistoria",
    "final": "Vistoria Final",
    "adicional": "Vistoria Adicional",
    "acompanhamento": "Acompanhamento",
  };
  const CORES_STATUS: Record<string, { bg: string; fg: string }> = {
    concluido:   { bg: "#10B98122", fg: "#10B981" },
    concluida:   { bg: "#10B98122", fg: "#10B981" },
    pendente:    { bg: "#F59E0B22", fg: "#F59E0B" },
    agendada:    { bg: "#3B82F622", fg: "#3B82F6" },
    cancelado:   { bg: "#EF444422", fg: "#EF4444" },
    cancelada:   { bg: "#EF444422", fg: "#EF4444" },
  };
  const tipoLabel = TIPO_LABEL[laudo.tipo] || (laudo.tipo || "Vistoria").toString().toUpperCase();
  const st = (laudo.status || "").toLowerCase();
  const stCores = CORES_STATUS[st] || { bg: t.card2, fg: t.textSecondary };
  const dataVistoria = laudo.data_vistoria || laudo.data_agendamento || laudo.created_at;
  // Agrupa fotos do laudo por ambiente (piso/forro/painel/marcenaria/deck/…).
  const fotosPorAmb = new Map<string, any[]>();
  for (const f of fotos) {
    const key = (f.ambiente || "OUTROS").toString().toUpperCase();
    const l = fotosPorAmb.get(key) || [];
    l.push(f); fotosPorAmb.set(key, l);
  }
  return (
    <div style={{
      background: t.card2, border: `1px solid ${t.border1}`,
    }}>
      {/* Cabeçalho clicável (abre/fecha o accordion): seta + tipo + status +
          contagem de fotos + fiscal + data. Sempre visível mesmo fechado. */}
      <div
        onClick={() => setAberto(v => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10, flexWrap: "wrap", padding: "12px 14px", cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Seta indicadora: aponta pra direita fechado, pra baixo aberto. */}
          <span style={{
            fontSize: 10, color: t.textTertiary, display: "inline-block",
            transform: aberto ? "rotate(90deg)" : "none", transition: "transform 0.15s",
          }}>{">"}</span>
          <span style={{
            fontSize: 12, fontWeight: 700, color: t.textPrimary, letterSpacing: "0.04em",
          }}>{tipoLabel}</span>
          {laudo.status && (
            <span style={{
              fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
              padding: "2px 8px", background: stCores.bg, color: stCores.fg,
              border: `1px solid ${stCores.fg}55`,
            }}>{laudo.status}</span>
          )}
          {fotos.length > 0 && (
            <span style={{ fontSize: 9, color: t.textTertiary }}>
              {fotos.length} foto{fotos.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div style={{ fontSize: 9.5, color: t.textTertiary, textAlign: "right", lineHeight: 1.4 }}>
          {laudo.fiscal_nome && <div><b style={{ color: t.textSecondary }}>Fiscal:</b> {laudo.fiscal_nome.trim()}</div>}
          {dataVistoria && <div>{fmtBr(dataVistoria)}</div>}
        </div>
      </div>
      {/* Corpo: só renderiza quando o accordion está aberto. */}
      {aberto && (
      <div style={{ padding: "0 14px 12px" }}>
      {/* Descrição / observações: texto completo. */}
      {laudo.descricao && (
        <div style={{ fontSize: 11, color: t.textPrimary, whiteSpace: "pre-wrap", marginBottom: 8, lineHeight: 1.5 }}>
          {laudo.descricao}
        </div>
      )}
      {/* Ocorrências separadas em bloco vermelho. */}
      {laudo.ocorrencias && (typeof laudo.ocorrencias === "string" ? laudo.ocorrencias.trim() : true) && (
        <div style={{
          fontSize: 11, color: "#EF4444", background: "#EF444411", border: "1px solid #EF444455",
          padding: "8px 10px", whiteSpace: "pre-wrap", marginBottom: 8, lineHeight: 1.5,
        }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", marginBottom: 4 }}>OCORRÊNCIAS</div>
          {typeof laudo.ocorrencias === "string" ? laudo.ocorrencias : JSON.stringify(laudo.ocorrencias, null, 2)}
        </div>
      )}
      {/* Fotos daquele laudo, agrupadas por ambiente. */}
      {fotos.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {[...fotosPorAmb.entries()].map(([amb, lista]) => (
            <div key={amb} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: t.textTertiary, marginBottom: 4 }}>
                {amb} <span style={{ color: t.textSecondary }}>({lista.length})</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 5 }}>
                {lista.map((f: any) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
                    title={`${f.ambiente || ""} ${f.tipo || ""} ${f.servico || ""} ${f.descricao || ""}`.trim()}
                    style={{ display: "block", position: "relative", aspectRatio: "1 / 1",
                             overflow: "hidden", background: t.card1, border: `1px solid ${t.border1}` }}>
                    <img src={midiaThumb(f.url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {f.descricao && (
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        background: "rgba(0,0,0,0.72)", color: "white", fontSize: 9,
                        padding: "3px 5px", lineHeight: 1.3,
                        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>{f.descricao}</div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Link pra vistoria oficial em verifica.parket.works (mesma fonte, versão completa). */}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.border1}`, textAlign: "right" }}>
        <a href={`https://verifica.parket.works/laudo/${laudo.id}`} target="_blank" rel="noreferrer"
          style={{ fontSize: 10, color: t.accent, letterSpacing: "0.04em" }}>
          Abrir vistoria completa no Verifica
        </a>
      </div>
      </div>
      )}
    </div>
  );
}

/* Acompanhamento da obra em accordion (mesmo padrão do LaudoBloco):
   fechado mostra só o título clicável; abrir revela métricas + descrição + alertas. */
function AcompanhamentoBloco({ a, t }: { a: any; t: any }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        onClick={() => setAberto(v => !v)}
        style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
          color: t.textTertiary, marginBottom: 8, cursor: "pointer", userSelect: "none",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        {/* Seta indicadora: direita fechado, baixo aberto. */}
        <span style={{
          fontSize: 10, display: "inline-block",
          transform: aberto ? "rotate(90deg)" : "none", transition: "transform 0.15s",
        }}>{">"}</span>
        ACOMPANHAMENTO DA OBRA
        {a.alertas && <span style={{ color: "#EF4444" }}>(COM ALERTAS)</span>}
      </div>
      {aberto && (
      <div style={{
        padding: "12px 14px", background: t.card2, border: `1px solid ${t.border1}`,
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, fontSize: 11, color: t.textPrimary,
      }}>
        <Metric t={t} label="INÍCIO DA OBRA" value={a.inicio_obra ? fmtBr(a.inicio_obra) : "—"} />
        <Metric t={t} label="PREVISÃO DE ENTREGA" value={a.previsao_entrega_manual ? fmtBr(a.previsao_entrega_manual) : "—"} />
        <Metric t={t} label="ATUALIZADO EM" value={a.updated_at ? fmtBr(a.updated_at) : "—"} />
        {a.descricao_produto && (
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.12em", color: t.textTertiary, marginBottom: 3 }}>DESCRIÇÃO</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{a.descricao_produto}</div>
          </div>
        )}
        {a.alertas && (
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#EF4444", marginBottom: 3 }}>ALERTAS</div>
            <div style={{ whiteSpace: "pre-wrap", color: "#EF4444" }}>{a.alertas}</div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function Metric({ t, label, value }: { t: any; label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", color: t.textTertiary, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: t.textPrimary }}>{value}</div>
    </div>
  );
}

function FotosGrid({ fotos, t, titulo }: { fotos: any[]; t: any; titulo?: string }) {
  if (!fotos || !fotos.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
        color: t.textTertiary, marginBottom: 8,
      }}>
        {titulo || "REGISTRO FOTOGRÁFICO"} <span style={{ color: t.textSecondary }}>({fotos.length})</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
        {fotos.map(f => (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
            title={`${f.ambiente || ""} ${f.tipo || ""} ${f.descricao || ""}`.trim()}
            style={{ display: "block", position: "relative", aspectRatio: "1 / 1", overflow: "hidden",
                     background: t.card2, border: `1px solid ${t.border1}` }}>
            <img src={midiaThumb(f.url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {(f.ambiente || f.tipo) && (
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: "rgba(0,0,0,0.7)", color: "white",
                fontSize: 9, padding: "2px 5px", letterSpacing: "0.06em",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {[f.ambiente, f.tipo].filter(Boolean).join(" · ")}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

function FiscalSecao({ titulo, itens, t }: { titulo: string; itens: any[]; t: any }) {
  if (!itens || !itens.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
        color: t.textTertiary, marginBottom: 8,
      }}>
        {titulo} <span style={{ color: t.textSecondary }}>({itens.length})</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {itens.map((r, i) => (
          <div key={r.id ?? i} style={{
            padding: "10px 12px", background: t.card2, border: `1px solid ${t.border1}`,
            fontSize: 11, color: t.textPrimary,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
              <div style={{ fontWeight: 600 }}>
                {r.titulo || r.tipo || r.descricao?.slice(0, 60) || "—"}
              </div>
              <div style={{ fontSize: 9.5, color: t.textTertiary, whiteSpace: "nowrap" }}>
                {r.created_at ? fmtBr(r.created_at) : (r.data ? fmtBr(r.data) : "")}
              </div>
            </div>
            {r.autor_email && (
              <div style={{ fontSize: 9.5, color: t.textTertiary }}>por {r.autor_email}</div>
            )}
            {r.descricao && r.titulo && (
              <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 4, whiteSpace: "pre-wrap" }}>
                {r.descricao}
              </div>
            )}
            {r.url && (
              <a href={r.url} target="_blank" rel="noreferrer"
                style={{ fontSize: 10, color: t.accent, marginTop: 4, display: "inline-block" }}>
                📎 abrir arquivo ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
