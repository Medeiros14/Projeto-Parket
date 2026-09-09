import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { fonts, useTokens } from "../theme";
import { api, type PublicoObra, type Item } from "../api";
import { gerarCronogramaPdf } from "../lib/cronograma-pdf";
import { midiaThumb } from "../lib/midia";
import { montarPdfInput, diasUteisDe, statusPdfDe, itemServicoLabel, fmtNum } from "./ObraAcompanhamento";

/* ═══════════════════════════════════════════════════════════════════
   PÁGINA PÚBLICA — /obra/:token
   Relatório read-only do acompanhamento (sem valores financeiros),
   acessível pelo link compartilhado com o cliente. Sem chrome interno.
   ═══════════════════════════════════════════════════════════════════ */

const STATUS_PUB: Record<string, [string, string]> = {
  pendente:     ["PENDENTE", "#8A8578"],
  em_andamento: ["EM ANDAMENTO", "#8CA9B8"],
  concluido:    ["CONCLUÍDO", "#7BA394"],
  atrasado:     ["ATRASADO", "#B85B4C"],
};

const ALERTA_LABEL: Record<string, string> = {
  pendencia_obra: "Pendência de Obra (Cliente)",
  atraso_parket: "Atraso da Parket",
  outros: "Outros",
};

function fmtBRp(d?: string | null): string {
  if (!d) return "—";
  try { return new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}

export default function ObraPublica() {
  const t = useTokens();
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicoObra | null>(null);
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.publicoObra(token).then(setData).catch(() => setErro("Link inválido ou expirado."));
  }, [token]);

  const itens = useMemo(() => (data?.itens || []).filter(i => i.status !== "cancelado"), [data]);
  const kpis = useMemo(() => {
    let dias = 0, qtdTotal = 0, instTotal = 0;
    for (const it of itens) {
      const o = (it.meta as any)?.obra || {};
      dias += diasUteisDe(Number(it.quantidade) || 0, {
        rendimento: o.rendimento ?? null, dias_uteis: o.dias_uteis ?? null,
      });
      qtdTotal += Number(it.quantidade) || 0;
      instTotal += o.qtd_instalada ?? 0;
    }
    return { dias, pct: qtdTotal > 0 ? Math.round((instTotal / qtdTotal) * 100) : 0 };
  }, [itens]);

  const baixarPdf = async () => {
    if (!data) return;
    setGerando(true);
    try {
      await gerarCronogramaPdf(montarPdfInput({
        projeto: data.projeto,
        acomp: data.acompanhamento,
        itens: data.itens as Item[],
        fotos: data.fotos,
        prestadores: data.prestadores,
      }));
    } finally {
      setGerando(false);
    }
  };

  const wrap: React.CSSProperties = {
    minHeight: "calc(100vh / var(--pkz, 1))", background: t.bg, color: t.textPrimary,
    fontFamily: fonts.inter, overflow: "auto",
  };

  if (erro) {
    return (
      <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 18, letterSpacing: "0.3em" }}>PARKET</div>
          <div style={{ marginTop: 16, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: t.textSecondary }}>
            {erro}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.28em", color: t.textTertiary }}>
          CARREGANDO…
        </div>
      </div>
    );
  }

  const p = data.projeto;
  const a = data.acompanhamento;
  const alertas = a?.alertas || [];
  const hasDelay = alertas.length > 0 || itens.some(i => statusPdfDe(i) === "atrasado");

  const secTitle: React.CSSProperties = {
    fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.26em",
    textTransform: "uppercase", color: t.textSecondary, margin: "26px 0 10px",
  };
  const th: React.CSSProperties = {
    fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em", textTransform: "uppercase",
    color: t.textTertiary, padding: "8px 8px", textAlign: "left", borderBottom: `1px solid ${t.border1}`,
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "8px 8px", borderBottom: `1px solid ${t.border1}`, fontSize: 11, color: t.textPrimary,
  };

  return (
    <div style={wrap}>
      {/* Header */}
      <header style={{
        background: "#050505", color: "#F4F1EA", padding: "34px 24px 30px",
        borderBottom: "1px solid #2a2a2a",
      }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: fonts.cinzel, fontSize: 26, letterSpacing: "0.34em" }}>PARKET</div>
            <div style={{ fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: "#B4AA9A", marginTop: 8 }}>
              Acompanhamento de Obras
            </div>
            <div style={{ fontSize: 13, marginTop: 14, letterSpacing: "0.06em" }}>
              {p.obra_code ? `${p.obra_code} — ` : ""}{p.cliente}
            </div>
            {p.endereco && (
              <div style={{ fontSize: 10, color: "#8A8578", marginTop: 4 }}>{p.endereco}</div>
            )}
            {hasDelay && (
              <div style={{ marginTop: 10, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#EF4444" }}>
                Projeto com alerta de atraso
              </div>
            )}
          </div>
          <button onClick={baixarPdf} disabled={gerando}
            style={{
              background: "transparent", color: "#C7A45B", border: "1px solid #C7A45B",
              padding: "10px 18px", fontFamily: fonts.cinzel, fontSize: 9,
              letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer",
            }}>
            {gerando ? "Gerando…" : "Baixar PDF"}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "10px 24px 60px" }}>
        {/* Resumo */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10,
          marginTop: 22,
        }}>
          <PubStat t={t} label="Início da obra" v={fmtBRp(a?.inicio_obra)} />
          <PubStat t={t} label="Previsão de entrega" v={fmtBRp(a?.previsao_entrega_manual)} />
          <PubStat t={t} label="Dias úteis totais" v={`${kpis.dias} dias`} />
          <PubStat t={t} label="Instalado" v={`${kpis.pct}%`} cor="#7BA394" />
          <PubStat t={t} label="Situação" v={hasDelay ? "Atrasado" : "No prazo"} cor={hasDelay ? "#B85B4C" : "#7BA394"} />
        </div>

        {/* Descrição do produto */}
        {a?.descricao_produto && (
          <>
            <div style={secTitle}>Descrição do produto</div>
            <div style={{
              background: t.card1, border: `1px solid ${t.border1}`, padding: "12px 16px",
              fontSize: 12, lineHeight: 1.7, color: t.textPrimary,
            }}>
              {a.descricao_produto}
            </div>
          </>
        )}

        {/* Cronograma */}
        <div style={secTitle}>Cronograma de serviços</div>
        <div style={{ background: t.card1, border: `1px solid ${t.border1}`, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={th}>Descrição do serviço</th>
                <th style={{ ...th, textAlign: "right" }}>Contratado</th>
                <th style={{ ...th, textAlign: "right" }}>Instalado</th>
                <th style={{ ...th, textAlign: "right" }}>Pendente</th>
                <th style={{ ...th, textAlign: "right" }}>Dias úteis</th>
                <th style={{ ...th, textAlign: "center" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, idx) => {
                const o = (it.meta as any)?.obra || {};
                const qtd = Number(it.quantidade) || 0;
                const inst = o.qtd_instalada ?? 0;
                const pend = Math.max(qtd - inst, 0);
                const dias = diasUteisDe(qtd, {
                  rendimento: o.rendimento ?? null, dias_uteis: o.dias_uteis ?? null,
                });
                const [stLabel, stCor] = STATUS_PUB[statusPdfDe(it)] || STATUS_PUB.pendente;
                return (
                  <tr key={it.id}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {String(idx + 1).padStart(2, "0")} — {itemServicoLabel(it)}
                    </td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{fmtNum(qtd)} {it.unidade}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{fmtNum(inst)} {it.unidade}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: pend > 0 ? "#C7A45B" : "#7BA394" }}>
                      {fmtNum(pend)} {it.unidade}
                    </td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{dias} dias</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <span style={{
                        fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.18em",
                        color: stCor, whiteSpace: "nowrap",
                      }}>{stLabel}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Alertas */}
        {alertas.length > 0 && (
          <>
            <div style={{ ...secTitle, color: "#B85B4C" }}>Alertas de atraso ({alertas.length})</div>
            <div style={{ display: "grid", gap: 6 }}>
              {alertas.map((al, i) => (
                <div key={i} style={{
                  display: "flex", gap: 12, alignItems: "center", padding: "10px 14px",
                  background: t.card1, border: `1px solid ${t.border1}`, borderLeft: "3px solid #B85B4C",
                }}>
                  <span style={{ fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "#B85B4C", whiteSpace: "nowrap" }}>
                    {ALERTA_LABEL[al.tipo] || al.tipo}
                  </span>
                  <span style={{ fontSize: 10, color: t.textTertiary, whiteSpace: "nowrap" }}>{fmtBRp(al.data)}</span>
                  <span style={{ fontSize: 11, color: t.textPrimary }}>{al.motivo}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Fotos */}
        {data.fotos.length > 0 && (
          <>
            <div style={secTitle}>Registro fotográfico ({data.fotos.length})</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
              {data.fotos.map(f => {
                const isVideo = f.tipo === "video" || /\.(mp4|mov|webm)$/i.test(f.url);
                const itemDo = f.item_id ? itens.find(i => i.id === f.item_id) : null;
                return (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
                    style={{
                      display: "block", position: "relative", aspectRatio: "4/3",
                      background: t.card2, border: `1px solid ${t.border1}`, overflow: "hidden",
                      textDecoration: "none",
                    }}>
                    {isVideo ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em", color: t.textSecondary }}>
                        [VÍDEO]
                      </div>
                    ) : (
                      <img src={midiaThumb(f.url)} alt={f.legenda || ""} loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    )}
                    {(f.legenda || f.ambiente || itemDo) && (
                      <div style={{
                        position: "absolute", left: 0, right: 0, bottom: 0,
                        padding: "5px 8px", background: "rgba(0,0,0,0.6)",
                        fontSize: 9, color: "#F4F1EA",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {f.legenda || f.ambiente || (itemDo ? itemDo.descritivo : "")}
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          </>
        )}

        {/* Disclaimer */}
        <div style={{
          marginTop: 40, paddingTop: 18, borderTop: `1px solid ${t.border1}`,
          fontSize: 10, lineHeight: 1.8, color: t.textTertiary,
        }}>
          Os prazos apresentados no cronograma são equivalentes aos prazos contratuais.
          Este documento possui caráter informativo, com o objetivo de proporcionar uma visão
          geral dos períodos estimados de instalação da Parket.
        </div>
      </main>
    </div>
  );
}

function PubStat({ t, label, v, cor }: { t: any; label: string; v: string; cor?: string }) {
  return (
    <div style={{ background: t.card1, border: `1px solid ${t.border1}`, padding: "12px 14px" }}>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em", textTransform: "uppercase", color: t.textTertiary }}>
        {label}
      </div>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 15, marginTop: 7, color: cor || t.textPrimary, letterSpacing: "0.06em" }}>
        {v}
      </div>
    </div>
  );
}
