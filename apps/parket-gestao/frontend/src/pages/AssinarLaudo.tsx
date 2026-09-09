import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fonts, useTokens } from "../theme";
import { api, type LaudoConteudoPublico } from "../api";
import { AssinaturaPad } from "../components/LaudoDetalheModal";
import { TERMO_INTRO, TERMO_CORPO, ENTREGA_TERMO_PARAGRAFOS } from "../lib/laudo-pdf";
import { midiaThumb } from "../lib/midia";

/* ═══════════════════════════════════════════════════════════════════
   PÁGINA PÚBLICA — /assinar/:token
   Assinatura remota do cliente (responsável pela obra) sobre um
   laudo/termo. Sem chrome interno, acessível pelo link compartilhado.
   ═══════════════════════════════════════════════════════════════════ */

const TIPO_LABEL: Record<string, string> = {
  "1vistoria":      "Relatório Técnico · 1ª Vistoria",
  "2vistoria":      "Relatório Técnico · 2ª Vistoria",
  "acompanhamento": "Acompanhamento de Obras",
  "entrega":        "Termo de Entrega e Recebimento de Obra",
  "reparo":         "Laudo de Reparo",
  "termo":          "Termo de Responsabilidade",
  "fotografico":    "Relatório Fotográfico",
};

// Espelha o spec-fiscal (Laudos & Vistorias) e o painel do cliente
const CHECKLIST_LABEL: Record<string, string> = {
  piso: "Piso", deck: "Deck", forro: "Forro", painel: "Painel",
  liberacao: "Liberação", equipe: "Equipe", produtividade: "Produtividade",
  reparo: "Reparo", entrega: "Entrega", extra: "Extra",
  escada: "Escada", porta: "Porta", bancos: "Bancos",
};
const CHECK_VALOR: Record<string, string> = { sim: "Sim", nao: "Não", na: "N/A" };

// Mesmos critérios/ids da Central do Cliente (AvaliacaoView) — a nota grava
// em gestao.projeto_etapas (etapa 10) e aparece nos dois lugares.
const EVAL_CRITERIA = [
  { id: "docs", label: "Organização dos documentos" },
  { id: "comm", label: "Clareza da comunicação" },
  { id: "punct", label: "Pontualidade" },
  { id: "quality", label: "Qualidade da instalação" },
  { id: "team", label: "Postura da equipe" },
  { id: "overall", label: "Experiência geral" },
];

// Blocos de texto do laudo do fiscal, na ordem de exibição do PDF
const TEXTOS_LAUDO: [keyof LaudoConteudoPublico, string][] = [
  ["descritivo_sistema", "Descritivo do sistema"],
  ["descritivo_material", "Descritivo do material"],
  ["medicao_obra", "Medição de obra"],
  ["metragem_areas", "Metragem das áreas"],
  ["ocorrencias", "Ocorrências"],
  ["materiais_falta", "Materiais em falta"],
  ["insumos_falta", "Insumos em falta"],
  ["materiais_necessarios", "Materiais necessários"],
  ["insumos_necessarios", "Insumos necessários"],
  ["reforco_necessario", "Reforço necessário"],
  ["obs_andaime", "Andaime"],
  ["resultado", "Resultado"],
];

type Info = {
  tipo: string; cliente: string | null; obra: string | null; endereco: string | null;
  data_vistoria: string | null; fiscal_nome: string | null; condicao: string;
  resumo_engenharia?: string;
  fotos?: { url: string; descricao?: string | null; ambiente?: string | null; servico?: string | null; tipo?: string | null }[];
  assinado: boolean; resp_obra: string; assinado_em: string | null;
  avaliacao?: { notas: Record<string, number>; comentario: string; nome: string; enviada_em: string } | null;
  relatorio?: {
    vendedor: string; responsavel: string; relatorio_numero: number | null;
    relatorio_data: string | null; descricao_produto: string;
    servico_contratado: { descricao: string; quantidade: string; previsao_inicio?: string; liberacao?: string }[];
    medicao_itens: { item: string; descricao: string; qtd: string }[];
    entradas: { autor: string; data: string; texto: string }[];
    observacoes: string;
  };
  conteudo?: LaudoConteudoPublico;
};

function fmtD(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return iso; }
}

export default function AssinarLaudo() {
  const t = useTokens();
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [erro, setErro] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [ass, setAss] = useState<string | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [avalComentario, setAvalComentario] = useState("");
  const [avalNome, setAvalNome] = useState("");
  const [avalEnviando, setAvalEnviando] = useState(false);
  const [avalFeito, setAvalFeito] = useState(false);
  const [avalErro, setAvalErro] = useState("");

  useEffect(() => {
    if (!token) return;
    api.publicoLaudoAssinatura(token)
      .then(d => { setInfo(d); if (d.cliente) { setNome(d.cliente); setAvalNome(d.cliente); } })
      .catch(() => setErro("Link inválido ou expirado."));
  }, [token]);

  const enviar = async () => {
    if (!token || !nome.trim() || !ass) return;
    setEnviando(true); setErroEnvio("");
    try {
      await api.publicoLaudoAssinar(token, { nome: nome.trim(), cpf: cpf.trim() || undefined, assinatura: ass });
      setFeito(true);
    } catch {
      setErroEnvio("Não foi possível registrar a assinatura. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const assinadoOk = !!info && (info.assinado || feito);
  const jaAvaliado = !!info?.avaliacao || avalFeito;
  const avalCompleta = EVAL_CRITERIA.every(cr => (ratings[cr.id] || 0) > 0);

  const enviarAvaliacao = async () => {
    if (!token || !avalCompleta) return;
    setAvalEnviando(true); setAvalErro("");
    try {
      await api.publicoLaudoAvaliar(token, { notas: ratings, comentario: avalComentario, nome: avalNome.trim() });
      setAvalFeito(true);
    } catch {
      setAvalErro("Não foi possível enviar a avaliação. Tente novamente.");
    } finally {
      setAvalEnviando(false);
    }
  };

  const lbl: React.CSSProperties = {
    fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
    textTransform: "uppercase", color: t.textTertiary, marginBottom: 4,
  };
  const inp: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", background: t.bg,
    border: `1px solid ${t.border1}`, borderRadius: 4, color: t.textPrimary,
    fontFamily: fonts.inter, fontSize: 13, padding: "9px 12px", outline: "none",
  };
  const card: React.CSSProperties = {
    background: t.card1, border: `1px solid ${t.border1}`,
    borderRadius: 8, padding: 24, marginBottom: 16,
  };
  const thS: React.CSSProperties = {
    ...lbl, background: "#4D4D4D", color: "#F4F1EA",
    padding: "5px 8px", textAlign: "left", marginBottom: 0,
  };
  const tdS: React.CSSProperties = {
    fontSize: 11, padding: "5px 8px", borderBottom: `1px solid ${t.border1}`, verticalAlign: "top",
  };

  // Conteúdo próprio do laudo do fiscal (spec-fiscal / PDF 1ª Vistoria)
  const ct: LaudoConteudoPublico = info?.conteudo || {};
  const textosLaudo = TEXTOS_LAUDO
    .map(([k, label]) => [label, ct[k]] as [string, unknown])
    .filter(([, v]) => typeof v === "string" && (v as string).trim()) as [string, string][];
  const checklists = Object.entries(ct.checklists || {});

  return (
    <div style={{ minHeight: "calc(100vh / var(--pkz, 1))", background: t.bg, color: t.textPrimary, fontFamily: fonts.inter }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 64px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 22, letterSpacing: "0.35em", color: t.accent }}>PARKET</div>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: t.textTertiary, marginTop: 6 }}>
            Assinatura Digital · Área Fiscal
          </div>
        </div>

        {erro && <div style={{ ...card, textAlign: "center", color: t.textSecondary }}>{erro}</div>}
        {!erro && !info && <div style={{ ...card, textAlign: "center", color: t.textTertiary }}>Carregando…</div>}

        {info && (
          <>
            <div style={card}>
              <div style={{ fontFamily: fonts.cinzel, fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>
                {TIPO_LABEL[info.tipo] || info.tipo}
              </div>
              {/* Cabeçalho — mesmos campos do PDF 9.1 (1ª Vistoria do Fiscal) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><div style={lbl}>Cliente</div><div style={{ fontSize: 13 }}>{info.cliente || "—"}</div></div>
                {info.obra && info.obra !== info.cliente && (
                  <div><div style={lbl}>Obra</div><div style={{ fontSize: 13 }}>{info.obra}</div></div>
                )}
                <div><div style={lbl}>Vendedor</div><div style={{ fontSize: 13 }}>{info.relatorio?.vendedor || "—"}</div></div>
                <div><div style={lbl}>Responsável</div><div style={{ fontSize: 13 }}>{info.relatorio?.responsavel || info.fiscal_nome || "—"}</div></div>
                <div><div style={lbl}>Endereço</div><div style={{ fontSize: 13 }}>{info.endereco || "—"}</div></div>
                <div><div style={lbl}>Data</div><div style={{ fontSize: 13 }}>{fmtD(info.relatorio?.relatorio_data || info.data_vistoria)}</div></div>
                {info.relatorio?.relatorio_numero != null && (
                  <div><div style={lbl}>Relatório Nº</div><div style={{ fontSize: 13 }}>{info.relatorio.relatorio_numero}</div></div>
                )}
                {ct.setor && (
                  <div><div style={lbl}>Setor</div><div style={{ fontSize: 13 }}>{ct.setor}</div></div>
                )}
                {ct.sistema_instalacao && (
                  <div><div style={lbl}>Sistema de instalação</div><div style={{ fontSize: 13 }}>{ct.sistema_instalacao}</div></div>
                )}
                {ct.tipo_laje && (
                  <div><div style={lbl}>Tipo de laje</div><div style={{ fontSize: 13 }}>{ct.tipo_laje}</div></div>
                )}
              </div>
              {!!ct.servicos_inclusos?.length && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                  {ct.servicos_inclusos.map(s => (
                    <span key={s} style={{
                      ...lbl, marginBottom: 0, border: `1px solid ${t.border1}`,
                      padding: "4px 10px", color: t.textSecondary,
                    }}>{s}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Resumo técnico lapidado (IA · persona engenheiro) — destaque no topo */}
            {info.resumo_engenharia && (
              <div style={{ ...card, borderColor: t.accent }}>
                <div style={{ ...lbl, fontSize: 10, marginBottom: 10, color: t.accent }}>
                  Resumo técnico · Engenharia Parket
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                  {info.resumo_engenharia}
                </div>
                {info.fiscal_nome && (
                  <div style={{ ...lbl, marginTop: 14, marginBottom: 0 }}>
                    Acompanhamento técnico · {info.fiscal_nome}
                  </div>
                )}
              </div>
            )}

            {/* Relatório preenchido no gerador — mesmas seções do PDF 9.1 */}
            {info.relatorio && (info.relatorio.descricao_produto ||
              info.relatorio.servico_contratado.length > 0 ||
              info.relatorio.medicao_itens.length > 0 ||
              info.relatorio.entradas.length > 0 || info.relatorio.observacoes ||
              textosLaudo.length > 0 || checklists.length > 0) && (
              <div style={card}>
                {info.relatorio.descricao_produto && (
                  <>
                    <div style={{ ...lbl, fontSize: 10, marginBottom: 10 }}>Descrição do produto</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-wrap", padding: "12px 14px", background: t.bg, border: `1px solid ${t.border1}`, marginBottom: 18 }}>
                      {info.relatorio.descricao_produto}
                    </div>
                  </>
                )}

                {info.relatorio.servico_contratado.length > 0 && (
                  <>
                    <div style={{ ...lbl, fontSize: 10, marginBottom: 10 }}>Descrição do serviço contratado</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 18 }}>
                      <thead>
                        <tr>
                          <th style={{ ...lbl, background: "#4D4D4D", color: "#F4F1EA", padding: "5px 8px", textAlign: "left", marginBottom: 0 }}>Descrição</th>
                          <th style={{ ...lbl, background: "#4D4D4D", color: "#F4F1EA", padding: "5px 8px", textAlign: "left", width: 90, marginBottom: 0 }}>Quantidade</th>
                          <th style={{ ...lbl, background: "#4D4D4D", color: "#F4F1EA", padding: "5px 8px", textAlign: "left", width: 110, marginBottom: 0 }}>Previsão de início</th>
                          <th style={{ ...lbl, background: "#4D4D4D", color: "#F4F1EA", padding: "5px 8px", textAlign: "left", width: 90, marginBottom: 0 }}>Liberação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {info.relatorio.servico_contratado.map((s, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: 11, padding: "5px 8px", borderBottom: `1px solid ${t.border1}`, verticalAlign: "top" }}>{s.descricao || "—"}</td>
                            <td style={{ fontSize: 11, padding: "5px 8px", borderBottom: `1px solid ${t.border1}`, verticalAlign: "top" }}>{s.quantidade || "—"}</td>
                            <td style={{ fontSize: 11, padding: "5px 8px", borderBottom: `1px solid ${t.border1}`, verticalAlign: "top" }}>{s.previsao_inicio || "—"}</td>
                            <td style={{ fontSize: 11, padding: "5px 8px", borderBottom: `1px solid ${t.border1}`, verticalAlign: "top" }}>{s.liberacao || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {info.relatorio.medicao_itens.length > 0 && (
                  <>
                    <div style={{ ...lbl, fontSize: 10, marginBottom: 10 }}>Medição em obra</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: info.relatorio.entradas.length ? 18 : 0 }}>
                      <thead>
                        <tr>
                          <th style={{ ...lbl, background: "#4D4D4D", color: "#F4F1EA", padding: "5px 8px", textAlign: "left", width: 56, marginBottom: 0 }}>Item</th>
                          <th style={{ ...lbl, background: "#4D4D4D", color: "#F4F1EA", padding: "5px 8px", textAlign: "left", marginBottom: 0 }}>Descrição</th>
                          <th style={{ ...lbl, background: "#4D4D4D", color: "#F4F1EA", padding: "5px 8px", textAlign: "left", width: 90, marginBottom: 0 }}>Qtd / m²</th>
                        </tr>
                      </thead>
                      <tbody>
                        {info.relatorio.medicao_itens.map((m, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: 11, padding: "5px 8px", borderBottom: `1px solid ${t.border1}`, whiteSpace: "nowrap", verticalAlign: "top" }}>{m.item}</td>
                            <td style={{ fontSize: 11, padding: "5px 8px", borderBottom: `1px solid ${t.border1}`, verticalAlign: "top" }}>{m.descricao}</td>
                            <td style={{ fontSize: 11, padding: "5px 8px", borderBottom: `1px solid ${t.border1}`, whiteSpace: "nowrap", verticalAlign: "top" }}>{m.qtd}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* Checklists por serviço — mesma estrutura do spec-fiscal */}
                {checklists.map(([grupo, cItens]) => (
                  <div key={grupo}>
                    <div style={{ ...lbl, fontSize: 10, margin: "18px 0 10px" }}>
                      Checklist · {CHECKLIST_LABEL[grupo] || grupo}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 18 }}>
                      <thead>
                        <tr>
                          <th style={thS}>Item</th>
                          <th style={{ ...thS, width: 80 }}>Conforme</th>
                          <th style={{ ...thS, width: "38%" }}>Observação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(cItens).map(([label, v]) => (
                          <tr key={label}>
                            <td style={tdS}>{label}</td>
                            <td style={{ ...tdS, color: v?.valor === "nao" ? "#B85B4C" : undefined, whiteSpace: "nowrap" }}>
                              {CHECK_VALOR[v?.valor || ""] || v?.valor || "—"}
                            </td>
                            <td style={tdS}>{v?.obs || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {/* Blocos de texto do laudo (descritivos, metragem, ocorrências, resultado…) */}
                {textosLaudo.map(([label, texto]) => (
                  <div key={label}>
                    <div style={{ ...lbl, fontSize: 10, margin: "18px 0 10px" }}>{label}</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-wrap", padding: "12px 14px", background: t.bg, border: `1px solid ${t.border1}` }}>
                      {texto}
                    </div>
                  </div>
                ))}

                {info.relatorio.entradas.length > 0 && (
                  <>
                    <div style={{ ...lbl, fontSize: 10, margin: "18px 0 10px" }}>Relatório</div>
                    {info.relatorio.entradas.map((e, i) => (
                      <div key={i} style={{ padding: "10px 12px", background: t.bg, border: `1px solid ${t.border1}`, marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                          {e.autor}{" "}
                          <span style={{ fontWeight: 400, color: t.textTertiary, fontSize: 10 }}>
                            {e.data ? new Date(e.data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{e.texto}</div>
                      </div>
                    ))}
                  </>
                )}

                {info.relatorio.observacoes && (
                  <>
                    <div style={{ ...lbl, fontSize: 10, margin: "18px 0 10px" }}>Observações</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-wrap", padding: "12px 14px", background: t.bg, border: `1px solid ${t.border1}` }}>
                      {info.relatorio.observacoes}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Registro fotográfico da vistoria — mesmas fotos do laudo do fiscal */}
            {!!info.fotos?.length && (
              <div style={card}>
                <div style={{ ...lbl, fontSize: 10, marginBottom: 12 }}>
                  Registro fotográfico · {info.fotos.length}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                  {info.fotos.map((f, i) => {
                    const isVideo = (f.tipo || "").startsWith("video") || /\.(mp4|mov|webm)(\?|$)/i.test(f.url) || f.url.startsWith("data:video");
                    const legenda = [f.ambiente, f.servico, f.descricao].filter(Boolean).join(" · ");
                    return (
                      <div key={i}>
                        {isVideo ? (
                          <video src={f.url} controls playsInline style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", background: t.bg, border: `1px solid ${t.border1}`, display: "block" }} />
                        ) : (
                          <img src={midiaThumb(f.url)} alt={legenda || `Foto ${i + 1}`} loading="lazy"
                            onClick={f.url.startsWith("data:") ? undefined : () => window.open(f.url, "_blank")}
                            style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", background: t.bg, border: `1px solid ${t.border1}`, display: "block", cursor: f.url.startsWith("data:") ? "default" : "zoom-in" }} />
                        )}
                        {legenda && (
                          <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 4, lineHeight: 1.4 }}>{legenda}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No termo de entrega a confirmação só aparece depois da pesquisa respondida */}
            {assinadoOk && info.tipo === "entrega" && !jaAvaliado ? (
              <div style={{ ...card, textAlign: "center", color: t.textSecondary, fontSize: 13 }}>
                Assinatura registrada — para concluir, responda a pesquisa de satisfação abaixo.
              </div>
            ) : assinadoOk ? (
              <div style={{ ...card, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 10, color: t.accent }}>✓</div>
                <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 8 }}>
                  Documento assinado
                </div>
                <div style={{ fontSize: 13, color: t.textSecondary }}>
                  {feito
                    ? "Sua assinatura foi registrada com sucesso. Você já pode fechar esta página."
                    : `Este documento já foi assinado${info.resp_obra ? ` por ${info.resp_obra}` : ""}${info.assinado_em ? ` em ${fmtD(info.assinado_em)}` : ""}.`}
                </div>
              </div>
            ) : (
              <>
                {/* Texto do termo de ciência — só no Termo de Responsabilidade (9.2).
                    Relatórios técnicos mostram a condição destacada, sem boilerplate. */}
                {info.tipo === "termo" ? (
                  <div style={card}>
                    <div style={{ fontSize: 12.5, lineHeight: 1.7, color: t.textSecondary, whiteSpace: "pre-wrap" }}>
                      {TERMO_INTRO}
                    </div>
                    {info.condicao && (
                      <div style={{
                        margin: "14px 0", padding: "12px 14px", borderLeft: `2px solid ${t.accent}`,
                        background: t.card2, fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-wrap",
                      }}>
                        {info.condicao}
                      </div>
                    )}
                    <div style={{ fontSize: 12.5, lineHeight: 1.7, color: t.textSecondary, whiteSpace: "pre-wrap", marginTop: 12 }}>
                      {TERMO_CORPO}
                    </div>
                  </div>
                ) : info.tipo === "entrega" ? (
                  <div style={card}>
                    {ENTREGA_TERMO_PARAGRAFOS.map((p, i) => (
                      <div key={i} style={{ fontSize: 12.5, lineHeight: 1.7, color: t.textSecondary, whiteSpace: "pre-wrap", marginTop: i ? 12 : 0 }}>
                        {p}
                      </div>
                    ))}
                    {info.condicao && (
                      <div style={{
                        margin: "14px 0 0", padding: "12px 14px", borderLeft: `2px solid ${t.accent}`,
                        background: t.card2, fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-wrap",
                      }}>
                        {info.condicao}
                      </div>
                    )}
                  </div>
                ) : info.condicao ? (
                  <div style={card}>
                    <div style={{ ...lbl, fontSize: 10, marginBottom: 10 }}>Condição constatada</div>
                    <div style={{
                      padding: "12px 14px", borderLeft: `2px solid ${t.accent}`,
                      background: t.card2, fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-wrap",
                    }}>
                      {info.condicao}
                    </div>
                  </div>
                ) : null}

                {/* Form de assinatura */}
                <div style={card}>
                  <div style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
                    Assinatura do responsável pela obra
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={lbl}>Nome completo *</div>
                      <input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" />
                    </div>
                    <div>
                      <div style={lbl}>CPF</div>
                      <input style={inp} value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" />
                    </div>
                  </div>
                  <AssinaturaPad t={t} label="Assine no quadro abaixo (dedo ou mouse)" value={ass} onChange={setAss} />
                  {erroEnvio && <div style={{ color: "#B85B4C", fontSize: 12, marginTop: 8 }}>{erroEnvio}</div>}
                  <button
                    onClick={enviar}
                    disabled={enviando || !nome.trim() || !ass}
                    style={{
                      marginTop: 16, width: "100%", background: t.accent, color: t.bg, border: "none",
                      padding: "13px 18px", fontFamily: fonts.cinzel, fontSize: 11,
                      letterSpacing: "0.25em", textTransform: "uppercase", borderRadius: 4,
                      cursor: enviando ? "wait" : (!nome.trim() || !ass) ? "not-allowed" : "pointer",
                      opacity: enviando || !nome.trim() || !ass ? 0.55 : 1,
                    }}>
                    {enviando ? "Registrando…" : "Assinar documento"}
                  </button>
                </div>
              </>
            )}

            {/* Pesquisa de satisfação — só no termo de entrega, esmaecida até assinar */}
            {info.tipo === "entrega" && (
              <div style={{
                ...card,
                opacity: assinadoOk || jaAvaliado ? 1 : 0.4,
                pointerEvents: assinadoOk || jaAvaliado ? "auto" : "none",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase" }}>
                    Pesquisa de Satisfação
                  </span>
                  {!assinadoOk && !jaAvaliado && (
                    <span style={{ ...lbl, marginBottom: 0 }}>Próximo passo</span>
                  )}
                </div>

                {jaAvaliado ? (
                  <div>
                    <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.65 }}>
                      {avalFeito
                        ? "Avaliação enviada — obrigado por avaliar a sua experiência com a Parket."
                        : "Avaliação registrada — obrigado por avaliar a sua experiência com a Parket."}
                    </div>
                    {info.avaliacao?.notas && (
                      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                        {EVAL_CRITERIA.filter(cr => info.avaliacao!.notas[cr.id]).map(cr => (
                          <div key={cr.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <span style={{ color: t.textSecondary }}>{cr.label}</span>
                            <span style={{ color: t.accent }}>{"★".repeat(info.avaliacao!.notas[cr.id])}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
                      {EVAL_CRITERIA.map(crit => {
                        const rating = ratings[crit.id] || 0;
                        return (
                          <div key={crit.id}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 12.5, color: t.textSecondary }}>{crit.label}</span>
                              <span style={{ fontSize: 10, color: t.textTertiary }}>
                                {rating > 0 ? `${rating} / 5` : "—"}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              {[1, 2, 3, 4, 5].map(n => {
                                const active = rating >= n;
                                return (
                                  <button key={n}
                                    onClick={() => setRatings(r => ({ ...r, [crit.id]: n }))}
                                    style={{
                                      width: 36, height: 32, cursor: "pointer",
                                      background: active ? t.card2 : "transparent",
                                      border: `1px solid ${active ? t.accent : t.border1}`,
                                      color: active ? t.accent : t.textTertiary,
                                      fontSize: 14, borderRadius: 4,
                                    }}>★</button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 12, marginBottom: 14 }}>
                      <div>
                        <div style={lbl}>Comentários (opcional)</div>
                        <input style={inp} value={avalComentario} onChange={e => setAvalComentario(e.target.value)}
                          placeholder="Conte como foi a sua experiência…" />
                      </div>
                      <div>
                        <div style={lbl}>Seu nome</div>
                        <input style={inp} value={avalNome} onChange={e => setAvalNome(e.target.value)} placeholder="Seu nome" />
                      </div>
                    </div>
                    {avalErro && <div style={{ color: "#B85B4C", fontSize: 12, marginBottom: 8 }}>{avalErro}</div>}
                    <button
                      onClick={enviarAvaliacao}
                      disabled={avalEnviando || !avalCompleta}
                      style={{
                        width: "100%", background: avalCompleta ? t.accent : "transparent",
                        color: avalCompleta ? t.bg : t.textTertiary,
                        border: avalCompleta ? "none" : `1px solid ${t.border1}`,
                        padding: "13px 18px", fontFamily: fonts.cinzel, fontSize: 11,
                        letterSpacing: "0.25em", textTransform: "uppercase", borderRadius: 4,
                        cursor: avalEnviando ? "wait" : avalCompleta ? "pointer" : "not-allowed",
                        opacity: avalEnviando ? 0.55 : 1,
                      }}>
                      {avalEnviando ? "Enviando…" : avalCompleta ? "Enviar avaliação" : "Avalie todos os critérios"}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}

        <div style={{ textAlign: "center", fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.25em", textTransform: "uppercase", color: t.textTertiary, marginTop: 24 }}>
          Parket · gestao.parket.works
        </div>
      </div>
    </div>
  );
}
