import { useEffect, useRef, useState } from "react";
import { api, fmtBr, type ItemAnexo, type ItemProjeto, type ItensDoCard } from "../api";

/* Aba Produtos do CardModal — lista os itens vendidos do projeto
   vinculado ao card. Setor de Projetos usa daqui pra:
     • anexar a medição fina do PROJETO no topo (1+ docs, nível card)
     • ver item por item + editar ambiente inline (dado do orçamento
       às vezes vem sem ambiente)
     • liberar cada item (ok pro próximo setor)
     • liberar item de MARCENARIA/PORTA pra Produção (chip pro PCP)
     • ver automaticamente o que fiscal/instala subiu do item */

type Props = { cardId: string; t: any };

const CAT_ORDEM = [
  "PISO", "DECK", "ESCADA", "FORRO", "PAINEL", "REVESTIMENTO",
  "MARCENARIA", "PORTA", "SAUNA", "ADEGA", "BANCO",
];

const catRank = (r: string) => {
  const i = CAT_ORDEM.indexOf(r);
  return i === -1 ? 99 : i;
};

const fmtNum = (n: number, casas = 2) =>
  Number.isFinite(n) ? n.toLocaleString("pt-BR", {
    minimumFractionDigits: casas, maximumFractionDigits: casas,
  }) : "—";

export default function ProdutosTab({ cardId, t }: Props) {
  const [data, setData] = useState<ItensDoCard | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "pendentes" | "liberados">("todos");

  const reload = () => api.itensDoCard(cardId).then(setData).catch(e => setErro(String(e)));
  useEffect(() => { reload(); }, [cardId]);

  if (erro) return (
    <div style={{ padding: 24, color: "#EF4444", fontSize: 12 }}>{erro}</div>
  );
  if (!data) return (
    <div style={{ padding: 24, color: t.textTertiary, fontSize: 11 }}>Carregando…</div>
  );
  if (!data.projeto) return (
    <div style={{ padding: 30, textAlign: "center", color: t.textTertiary, fontSize: 12 }}>
      <div style={{ marginBottom: 6 }}>Este card ainda não tem projeto vinculado no Gestão.</div>
      <div style={{ fontSize: 10 }}>
        O vínculo é feito pelo compras-contratos-watcher quando o contrato é assinado.
      </div>
    </div>
  );

  const filtrados = data.itens.filter(i => {
    if (filtro === "pendentes") return !i.liberado_projetos;
    if (filtro === "liberados") return i.liberado_projetos;
    return true;
  });

  const grupos = new Map<string, ItemProjeto[]>();
  for (const it of filtrados) {
    const k = it.categoria_raiz || "OUTROS";
    (grupos.get(k) || grupos.set(k, []).get(k)!).push(it);
  }
  const gruposOrdenados = [...grupos.entries()].sort(
    ([a], [b]) => catRank(a) - catRank(b) || a.localeCompare(b));

  const totalLiberados = data.itens.filter(i => i.liberado_projetos).length;
  const totalProducao  = data.itens.filter(i => i.liberado_para_producao).length;

  const acaoAsync = async (id: string, fn: () => Promise<unknown>) => {
    setSalvando(id);
    try { await fn(); await reload(); }
    catch (e) { setErro(String(e)); }
    finally { setSalvando(null); }
  };

  return (
    <div style={{ padding: 16 }}>
      {/* ─── Medição fina do PROJETO (nível card, 1+ docs) ─── */}
      <MedicaoFinaCard cardId={cardId} docs={data.medicao_fina} t={t}
        salvando={salvando === "__medicao__"}
        onUpload={file => acaoAsync("__medicao__", () => api.uploadMedicao(cardId, file))}
        onDel={id => acaoAsync("__medicao__", () => api.deleteMedicao(cardId, id))} />

      {/* ─── Header itens + filtros ─── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
        paddingBottom: 10, borderBottom: `1px solid ${t.border1}`,
      }}>
        <div style={{ fontSize: 11, color: t.textSecondary }}>
          <b style={{ color: t.textPrimary }}>{data.itens.length}</b> itens ·{" "}
          <span style={{ color: "#10B981" }}>{totalLiberados} liberados</span> ·{" "}
          <span style={{ color: "#14B8A6" }}>{totalProducao} pra produção</span>
        </div>
        <div style={{ flex: 1 }} />
        {(["todos", "pendentes", "liberados"] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{
              background: filtro === f ? t.accent : "transparent",
              border: `1px solid ${filtro === f ? t.accent : t.border1}`,
              color: filtro === f ? "#fff" : t.textSecondary,
              padding: "4px 10px", fontSize: 10, cursor: "pointer",
              textTransform: "capitalize", letterSpacing: "0.04em",
            }}>
            {f}
          </button>
        ))}
      </div>

      {gruposOrdenados.length === 0 && (
        <div style={{ padding: 30, textAlign: "center", color: t.textTertiary, fontSize: 11 }}>
          Nada por aqui com o filtro atual.
        </div>
      )}

      {gruposOrdenados.map(([raiz, itens]) => (
        <div key={raiz} style={{ marginBottom: 22 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", color: t.textTertiary, marginBottom: 6,
            paddingBottom: 4, borderBottom: `1px solid ${t.border1}`,
          }}>
            {raiz} · {itens.length}
          </div>
          {itens.map(it => (
            <ItemRow key={it.id} item={it} t={t}
              salvando={salvando === it.id}
              onLiberar={(para_producao, desfazer, extra) => acaoAsync(it.id, () =>
                api.liberarItem(it.id, para_producao, desfazer, extra))}
              onSalvarAmbiente={(novo) => acaoAsync(it.id, () =>
                api.editarAmbiente(it.id, novo))} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* Bloco de medição fina do PROJETO — 1+ docs, upload sempre acrescenta
   (Will 19/08: pode ter 1 ou mais docs). Fica sempre no topo, antes
   dos itens, porque cobre a marcenaria da obra inteira. */
function MedicaoFinaCard({ docs, t, salvando, onUpload, onDel }: {
  cardId: string; docs: ItemAnexo[]; t: any; salvando: boolean;
  onUpload: (file: File) => void; onDel: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <div style={{
      background: `${t.accent}0a`, border: `1px solid ${t.accent}44`,
      padding: 12, marginBottom: 16, opacity: salvando ? 0.6 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: docs.length ? 10 : 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: t.accent,
          }}>
            📐 Medição fina do projeto
          </div>
          <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 2 }}>
            Projeto executivo com as medidas conferidas em obra pra marcenaria.
            {docs.length === 0 && " Ainda sem doc — anexe o(s) arquivo(s)."}
          </div>
        </div>
        <button disabled={salvando}
          onClick={() => fileRef.current?.click()}
          title={docs.length ? "Adicionar mais um documento" : "Anexar o primeiro documento"}
          style={{
            background: t.accent, border: "none", color: "#fff",
            padding: "6px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer",
            letterSpacing: "0.04em", whiteSpace: "nowrap",
          }}>
          📎 {docs.length ? "+ Anexar outro" : "Anexar medição"}
        </button>
        <input ref={fileRef} type="file" hidden
          onChange={e => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onUpload(f);
          }} />
      </div>
      {docs.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 6,
        }}>
          {docs.map(d => (
            <DocMedicao key={d.id} doc={d} t={t} salvando={salvando}
              onDel={() => { if (window.confirm(`Remover "${d.nome}"?`)) onDel(d.id); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocMedicao({ doc, t, salvando, onDel }: {
  doc: ItemAnexo; t: any; salvando: boolean; onDel: () => void;
}) {
  const isImg = doc.tipo === "foto"
    || /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|$)/i.test(doc.url);
  return (
    <div style={{
      position: "relative", background: t.card1, border: `1px solid ${t.border1}`,
      display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
    }}>
      {isImg ? (
        <a href={doc.url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
          <img src={doc.url} alt={doc.nome} loading="lazy" style={{
            width: 36, height: 36, objectFit: "cover", display: "block",
          }} />
        </a>
      ) : (
        <div style={{
          width: 36, height: 36, flexShrink: 0, display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>
          {doc.tipo === "projeto_pdf" ? "📄"
            : doc.tipo === "projeto_cad" ? "📐" : "📎"}
        </div>
      )}
      <a href={doc.url} target="_blank" rel="noreferrer" style={{
        flex: 1, minWidth: 0, fontSize: 10, color: t.textPrimary,
        textDecoration: "none", overflow: "hidden",
      }} title={doc.nome}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {doc.nome}
        </div>
        {doc.criado_em && (
          <div style={{ fontSize: 8.5, color: t.textTertiary }}>
            {fmtBr(doc.criado_em)}{doc.por ? ` · ${doc.por.split("@")[0]}` : ""}
          </div>
        )}
      </a>
      <button disabled={salvando} title="Remover" onClick={onDel} style={{
        background: "transparent", border: "none", color: t.textTertiary,
        cursor: "pointer", fontSize: 12, padding: "0 4px", flexShrink: 0,
      }}>
        ✕
      </button>
    </div>
  );
}

/* Linha do item — descrição, ambiente editável, ações, capturas fiscal/instala. */
function ItemRow({ item, t, salvando, onLiberar, onSalvarAmbiente }: {
  item: ItemProjeto; t: any; salvando: boolean;
  onLiberar: (para_producao: boolean, desfazer: boolean,
    extra?: { qtd_liberada?: number; obs_producao?: string; autor_liberacao?: string }) => void;
  onSalvarAmbiente: (novo: string) => void;
}) {
  const [modalProducao, setModalProducao] = useState(false);
  const chipBase: React.CSSProperties = {
    fontSize: 8.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    padding: "2px 7px", borderRadius: 2, whiteSpace: "nowrap",
  };
  // codigo já vem canônico do backend (1.1, 6.3…); dash só se realmente vazio
  const codigo = item.codigo || "—";
  const header = item.produto_header || item.descritivo.split("\n")[0].slice(0, 90);

  return (
    <div style={{
      background: t.card1, border: `1px solid ${item.liberado_projetos ? "#10B98155" : t.border1}`,
      borderLeft: `3px solid ${
        item.liberado_para_producao ? "#14B8A6"
        : item.liberado_projetos ? "#10B981"
        : t.border2}`,
      padding: "10px 12px", marginBottom: 6, opacity: salvando ? 0.5 : 1,
      transition: "opacity 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: t.textTertiary, letterSpacing: "0.05em" }}>
              {codigo}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: t.textPrimary }}>{header}</span>
            {item.liberado_projetos && (
              <span style={{ ...chipBase, background: "#10B98122", color: "#10B981" }}>
                ✓ liberado
              </span>
            )}
            {item.liberado_para_producao && (
              <span style={{ ...chipBase, background: "#14B8A622", color: "#14B8A6" }}>
                🏭 produção{item.qtd_liberada_producao != null
                  && item.quantidade > 0
                  && item.qtd_liberada_producao < item.quantidade
                  ? ` ${fmtNum(item.qtd_liberada_producao, 0)}/${fmtNum(item.quantidade, 0)}`
                  : ""}
              </span>
            )}
            {item.capturas_campo.length > 0 && (
              <span style={{ ...chipBase, background: "#F59E0B22", color: "#F59E0B" }}>
                📷 {item.capturas_campo.length} campo
              </span>
            )}
          </div>

          <AmbienteInline valor={item.ambiente} t={t}
            onSalvar={onSalvarAmbiente} salvando={salvando} />

          <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 3 }}>
            {fmtNum(item.quantidade, item.unidade === "un" ? 0 : 2)} {item.unidade}
          </div>

          {item.descritivo && item.descritivo !== header && (
            <div style={{
              fontSize: 10, color: t.textTertiary, whiteSpace: "pre-wrap",
              lineHeight: 1.5, marginTop: 4,
            }}>
              {item.descritivo}
            </div>
          )}
          {item.liberado_projetos_em && (
            <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 5 }}>
              liberado em {fmtBr(item.liberado_projetos_em)}
              {item.liberado_projetos_por && ` por ${item.liberado_projetos_por}`}
            </div>
          )}
          {item.liberado_para_producao && item.liberado_para_producao_em && (
            <div style={{ fontSize: 9, color: "#14B8A6", marginTop: 3 }}>
              produção: {item.qtd_liberada_producao != null && item.quantidade > 0
                ? `${fmtNum(item.qtd_liberada_producao, item.unidade === "un" ? 0 : 2)} de ${fmtNum(item.quantidade, item.unidade === "un" ? 0 : 2)} ${item.unidade} `
                : ""}
              liberado em {fmtBr(item.liberado_para_producao_em)}
              {/* Autor = QUEM autorizou (digitado no modal, pode ser chefe);
                  _por = login que clicou. Autor é o que vale pro PCP. */}
              {item.liberado_para_producao_autor && ` autorizado por ${item.liberado_para_producao_autor}`}
              {item.liberado_para_producao_por && ` (via ${item.liberado_para_producao_por})`}
            </div>
          )}
          {item.liberado_para_producao && item.obs_producao && (
            <div style={{
              fontSize: 10, color: t.textSecondary, marginTop: 4,
              background: "#14B8A60d", border: "1px dashed #14B8A644",
              padding: "4px 7px", whiteSpace: "pre-wrap", lineHeight: 1.4,
            }}>
              <b style={{ color: "#14B8A6", fontSize: 9 }}>OBS PRA PRODUÇÃO: </b>
              {item.obs_producao}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          {!item.liberado_projetos ? (
            <>
              {/* Dois botões com efeitos DIFERENTES (Will 03/09): "Conferir" só
                  marca o item como visto e NÃO chega no PCP; quem manda a fábrica
                  produzir é "Liberar pra Produção", que grava qtd + autor + obs. */}
              <button disabled={salvando}
                onClick={() => onLiberar(false, false)}
                title="Só marca o item como conferido pelo Projetos. NÃO manda a fábrica produzir."
                style={btn(t, "#10B981")}>
                Conferir item
              </button>
              {item.pode_producao && (
                <button disabled={salvando}
                  onClick={() => setModalProducao(true)}
                  title="Manda o PCP produzir: escolhe a qtd (pode ser parcial), quem autorizou e a obs"
                  style={btn(t, "#14B8A6")}>
                  Liberar pra Produção
                </button>
              )}
            </>
          ) : (
            <>
              {item.pode_producao && (
                <button disabled={salvando}
                  onClick={() => setModalProducao(true)}
                  title={item.liberado_para_producao
                    ? "Ajustar qtd liberada ou a obs pro PCP"
                    : "Sinalizar pro PCP produzir (escolhe qtd e obs)"}
                  style={btn(t, "#14B8A6")}>
                  {item.liberado_para_producao ? "Ajustar produção" : "Liberar pra Produção"}
                </button>
              )}
              <button disabled={salvando}
                onClick={() => onLiberar(false, true)}
                title="Reabrir item (desfaz liberação)"
                style={{
                  ...btn(t, t.textTertiary), background: "transparent",
                  color: t.textTertiary, border: `1px solid ${t.border1}`,
                }}>
                ↩ Reabrir
              </button>
            </>
          )}
        </div>
      </div>

      {modalProducao && (
        <ModalLiberarProducao item={item} t={t} salvando={salvando}
          onFechar={() => setModalProducao(false)}
          onConfirmar={(qtd, obs, autor) => {
            setModalProducao(false);
            onLiberar(true, false, { qtd_liberada: qtd, obs_producao: obs, autor_liberacao: autor });
          }} />
      )}

      {item.capturas_campo.length > 0 && (
        <CapturasCampo anexos={item.capturas_campo} t={t} />
      )}
    </div>
  );
}

/* Ambiente sempre visível — clica pra editar quando faltar/errado.
   Muitos orçamentos importados vêm sem ambiente por item; projetos
   preenche em obra. */
function AmbienteInline({ valor, t, onSalvar, salvando }: {
  valor: string; t: any; salvando: boolean;
  onSalvar: (novo: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState(valor);
  useEffect(() => { setDraft(valor); }, [valor]);
  const limpo = (valor || "").replace(/^\d+°?\s*Pavimento\s*—\s*/i, "");

  const salvar = () => {
    setEditando(false);
    if (draft.trim() !== (valor || "").trim()) onSalvar(draft.trim());
  };

  if (editando) return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 3 }}>
      <span style={{ fontSize: 11, color: t.textSecondary }}>📍</span>
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={salvar}
        onKeyDown={e => {
          if (e.key === "Enter") salvar();
          if (e.key === "Escape") { setDraft(valor); setEditando(false); }
        }}
        placeholder="Ex.: 1º PAV. - BANHO MASTER"
        style={{
          flex: 1, background: t.inputBg, border: `1px solid ${t.accent}`,
          color: t.textPrimary, fontSize: 11, padding: "3px 6px", outline: "none",
        }} />
    </div>
  );

  return (
    <div onClick={() => !salvando && setEditando(true)}
      title="Clique para editar o ambiente"
      style={{
        display: "flex", gap: 4, alignItems: "center", marginTop: 3,
        cursor: salvando ? "default" : "text",
      }}>
      <span style={{ fontSize: 11, color: t.textSecondary }}>📍</span>
      {limpo ? (
        <span style={{ fontSize: 11, color: t.textPrimary }}>{limpo}</span>
      ) : (
        <span style={{
          fontSize: 10, color: "#F59E0B", fontStyle: "italic",
          textDecoration: "underline dotted",
        }}>
          sem ambiente — clique para preencher
        </span>
      )}
      <span style={{ fontSize: 9, color: t.textTertiary }}>✎</span>
    </div>
  );
}

/* Mini-modal de liberação pra produção: qtd (parcial ou total) + QUEM
   autoriza (obrigatório, Will 25/08 - pode ser um chefe mandando começar
   antes do projeto) + obs. Ex.: 20 portas vendidas, 18 aprovadas ->
   libera 18; as outras 2 saem depois pelo "Ajustar produção". Autor e
   obs viajam pro card da OP no PCP. */
function ModalLiberarProducao({ item, t, salvando, onFechar, onConfirmar }: {
  item: ItemProjeto; t: any; salvando: boolean;
  onFechar: () => void;
  onConfirmar: (qtd: number, obs: string, autor: string) => void;
}) {
  const total = item.quantidade || 0;
  const inteiro = item.unidade === "un";
  const [qtd, setQtd] = useState(
    String(item.qtd_liberada_producao ?? total).replace(".", ","));
  const [obs, setObs] = useState(item.obs_producao || "");
  // Quem esta autorizando a liberacao (nome livre; pre-preenche no Ajustar)
  const [autor, setAutor] = useState(item.liberado_para_producao_autor || "");

  const qtdNum = Number(String(qtd).trim().replace(",", "."));
  const autorOk = autor.trim().length > 0;
  const valida = Number.isFinite(qtdNum) && qtdNum > 0
    && (total <= 0 || qtdNum <= total);
  const parcial = valida && total > 0 && qtdNum < total;
  const fmt = (n: number) => fmtNum(n, inteiro ? 0 : 2);

  const lbl: React.CSSProperties = {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em",
    textTransform: "uppercase", color: t.textTertiary,
    display: "block", marginBottom: 4,
  };

  return (
    <div onClick={onFechar} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.card1, border: `1px solid ${t.border1}`,
        width: "100%", maxWidth: 380, padding: 16,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "#14B8A6", marginBottom: 4,
        }}>
          Liberar pra Produção
        </div>
        <div style={{ fontSize: 11, color: t.textPrimary, marginBottom: 12 }}>
          {item.codigo ? `${item.codigo} ` : ""}
          {item.produto_header || item.descritivo.split("\n")[0].slice(0, 60)}
        </div>

        <label style={lbl}>
          Quantidade liberada{total > 0 ? ` (de ${fmt(total)} ${item.unidade})` : ""}
        </label>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input value={qtd} inputMode="decimal"
            onChange={e => setQtd(e.target.value)}
            style={{
              flex: 1, background: t.inputBg, color: t.textPrimary,
              border: `1px solid ${valida ? t.border1 : "#EF4444"}`,
              fontSize: 13, padding: "6px 8px", outline: "none",
            }} />
          {total > 0 && (
            <button onClick={() => setQtd(fmt(total))}
              style={{
                ...btn(t, t.textTertiary), background: "transparent",
                border: `1px solid ${t.border1}`, color: t.textSecondary,
              }}>
              Tudo
            </button>
          )}
        </div>
        {!valida && (
          <div style={{ fontSize: 9.5, color: "#EF4444", marginTop: -6, marginBottom: 10 }}>
            Informe uma quantidade entre 0 e {fmt(total)}.
          </div>
        )}
        {parcial && (
          <div style={{
            fontSize: 10, color: "#F59E0B", marginTop: -4, marginBottom: 10,
            background: "#F59E0B11", border: "1px dashed #F59E0B55", padding: "5px 8px",
          }}>
            Liberação parcial: {fmt(qtdNum)} de {fmt(total)} {item.unidade}.
            O restante pode ser liberado depois pelo botão Ajustar produção.
          </div>
        )}

        {/* QUEM autoriza a liberacao: obrigatorio e visivel no item da OP
            no PCP. Pode ser diferente do login (chefe mandou comecar). */}
        <label style={lbl}>Liberado por (quem está autorizando)</label>
        <input value={autor}
          onChange={e => setAutor(e.target.value)}
          placeholder="Ex.: Thainara / Douglas / Will"
          style={{
            width: "100%", boxSizing: "border-box",
            background: t.inputBg, color: t.textPrimary,
            border: `1px solid ${autorOk ? t.border1 : "#EF4444"}`,
            fontSize: 12, padding: "6px 8px", outline: "none", marginBottom: 4,
          }} />
        <div style={{
          fontSize: 9, color: autorOk ? t.textTertiary : "#EF4444",
          marginBottom: 10,
        }}>
          {autorOk
            ? "Esse nome sai no item da OP no PCP como responsável pela liberação."
            : "Obrigatório: informe quem está autorizando essa liberação."}
        </div>

        <label style={lbl}>Obs pro setor de produção (opcional)</label>
        <textarea value={obs} rows={3}
          onChange={e => setObs(e.target.value)}
          placeholder="Ex.: as 2 portas do banho master ainda estão em revisão de medida"
          style={{
            width: "100%", boxSizing: "border-box", resize: "vertical",
            background: t.inputBg, color: t.textPrimary,
            border: `1px solid ${t.border1}`, fontSize: 11.5,
            padding: "6px 8px", outline: "none", lineHeight: 1.4,
          }} />
        <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 3, marginBottom: 12 }}>
          A obs aparece no item dentro do card da OP no PCP.
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onFechar} disabled={salvando}
            style={{
              ...btn(t, t.textTertiary), background: "transparent",
              border: `1px solid ${t.border1}`, color: t.textSecondary,
            }}>
            Cancelar
          </button>
          <button disabled={salvando || !valida || !autorOk}
            onClick={() => onConfirmar(qtdNum, obs.trim(), autor.trim())}
            style={{
              ...btn(t, "#14B8A6"), background: "#14B8A6", color: "#fff",
              opacity: valida && autorOk ? 1 : 0.5,
            }}>
            Confirmar liberação
          </button>
        </div>
      </div>
    </div>
  );
}

function btn(t: any, cor: string): React.CSSProperties {
  return {
    background: `${cor}22`, border: `1px solid ${cor}55`, color: cor,
    padding: "4px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer",
    letterSpacing: "0.04em", whiteSpace: "nowrap",
  };
}

/* Capturas do fiscal / instala pelo app deles — read-only aqui.
   Mesmo item_id em gestao.fotos casa automaticamente. */
function CapturasCampo({ anexos, t }: { anexos: ItemAnexo[]; t: any }) {
  const ORIG_LABEL: Record<string, { emoji: string; cor: string; nome: string }> = {
    fiscal:  { emoji: "🔍", cor: "#F59E0B", nome: "fiscal" },
    instala: { emoji: "🔨", cor: "#3B82F6", nome: "instala" },
  };
  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${t.border1}` }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
        textTransform: "uppercase", color: t.textTertiary, marginBottom: 5,
      }}>
        Capturas em obra
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 6,
      }}>
        {anexos.map(a => {
          const lbl = ORIG_LABEL[a.origem] || { emoji: "📎", cor: t.textTertiary, nome: a.origem };
          const isImg = a.tipo === "foto"
            || /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|$)/i.test(a.url);
          return (
            <div key={a.id} style={{
              border: `1px solid ${t.border1}`, background: t.statBg,
              display: "flex", flexDirection: "column",
            }}>
              {isImg ? (
                <a href={a.url} target="_blank" rel="noreferrer">
                  <img src={a.url} alt={a.nome} loading="lazy" style={{
                    width: "100%", height: 82, objectFit: "cover", display: "block",
                  }} />
                </a>
              ) : (
                <a href={a.url} target="_blank" rel="noreferrer" style={{
                  height: 82, display: "flex", alignItems: "center", justifyContent: "center",
                  textDecoration: "none", color: t.textPrimary, fontSize: 22,
                }}>
                  📎
                </a>
              )}
              <div style={{
                padding: "3px 6px", fontSize: 9, lineHeight: 1.3, background: t.card1,
                borderTop: `1px solid ${t.border1}`,
              }}>
                <div style={{ color: lbl.cor, fontWeight: 700 }}>
                  {lbl.emoji} {lbl.nome}
                </div>
                {a.criado_em && (
                  <div style={{ color: t.textTertiary, fontSize: 8.5 }}>
                    {fmtBr(a.criado_em)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
