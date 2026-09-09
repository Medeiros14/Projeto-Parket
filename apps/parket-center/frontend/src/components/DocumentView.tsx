/** Documentos — lista documentos reais (gestao.documentos) e laudos
 *  técnicos (fiscal_laudos) da etapa, com abrir/baixar/assinar. */
import { useState } from "react";
import { Download, PenLine, FileText, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import type { CenterData, Documento, ItemObra, Laudo, LaudoConteudo, LaudoFoto, MapaPrint } from "../api";
import { fmtData, fmtDataHora, fmtNum } from "../api";
import { type ColorScheme, getStatusStyle, serif } from "../theme";
import { buildStages, docsDaEtapa, laudoPorTipo, LAUDO_TIPO_LABEL } from "../derive";
import { midiaThumb } from "../midia";
import { ItensContratados, codigoItem } from "./ItensContratados";
import { ChecklistObras } from "./ChecklistObras";
import { DefinicoesView } from "./DefinicoesView";

// termo (Responsabilidade) fica na etapa 4 — é a assinatura que libera a obra
const LAUDO_ETAPA: Record<string, number> = {
  "1vistoria": 2, "2vistoria": 4, acompanhamento: 8,
  entrega: 9, termo: 4, reparo: 8, fotografico: 2,
};

function laudosDaEtapa(d: CenterData, numero: number): Laudo[] {
  return d.laudos.filter(l => (LAUDO_ETAPA[l.tipo] ?? 0) === numero);
}

function BotaoLinha({ c, children, onClick, destaque }: {
  c: ColorScheme; children: React.ReactNode; onClick: () => void; destaque?: boolean;
}) {
  return (
    <button onClick={onClick} style={{
      background: destaque ? c.accent : "none",
      border: destaque ? "none" : `1px solid ${c.border2}`,
      color: destaque ? "#0B0B0B" : c.textSecondary,
      cursor: "pointer", padding: "8px 14px", display: "inline-flex",
      alignItems: "center", gap: 7, fontSize: 10, letterSpacing: "0.1em",
      textTransform: "uppercase",
    }}>{children}</button>
  );
}

function SecaoLabel({ c, children }: { c: ColorScheme; children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
      color: c.textTertiary, margin: "18px 0 8px",
    }}>{children}</div>
  );
}

const CHECKLIST_LABEL: Record<string, string> = {
  piso: "Piso", deck: "Deck", forro: "Forro", painel: "Painel",
  liberacao: "Liberação", equipe: "Equipe", produtividade: "Produtividade",
  reparo: "Reparo", entrega: "Entrega", extra: "Extra",
  escada: "Escada", porta: "Porta", bancos: "Bancos",
};
const CHECK_VALOR: Record<string, string> = { sim: "Sim", nao: "Não", na: "N/A" };

// Blocos de texto do laudo do fiscal, na ordem de exibição
const TEXTOS_LAUDO: [keyof LaudoConteudo, string][] = [
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

function ConteudoLaudo({ ct, fotos, itens, c }: {
  ct: LaudoConteudo; fotos: LaudoFoto[]; itens?: ItemObra[]; c: ColorScheme;
}) {
  const th: React.CSSProperties = {
    fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
    color: c.textTertiary, textAlign: "left", padding: "8px 10px",
    borderBottom: `1px solid ${c.border2}`, fontWeight: 400,
  };
  const td: React.CSSProperties = {
    fontSize: 12, color: c.textSecondary, padding: "9px 10px",
    borderBottom: `1px solid ${c.border1}`, verticalAlign: "top", lineHeight: 1.5,
  };
  // Cabeçalho completo do documento (Relatório Técnico 9.1): campos fixos
  // sempre visíveis, mesmo em branco — como no PDF do gestão.
  const infos = [
    ["Cliente", ct.cliente || "—"],
    ["Vendedor", ct.vendedor || "—"],
    ["Responsável", ct.responsavel || "—"],
    ["Endereço", ct.endereco || "—"],
    ct.obra && ct.obra !== ct.cliente ? ["Obra", ct.obra] : null,
    ct.relatorio_numero ? ["Relatório", `Nº ${ct.relatorio_numero}${ct.relatorio_data ? ` · ${fmtData(ct.relatorio_data)}` : ""}`] : null,
    ct.setor ? ["Setor", ct.setor] : null,
    ct.sistema_instalacao ? ["Sistema de instalação", ct.sistema_instalacao] : null,
    ct.tipo_laje ? ["Tipo de laje", ct.tipo_laje] : null,
  ].filter(Boolean) as [string, string][];
  const imagens = fotos.filter(f => (f.tipo || "").toLowerCase() !== "video");
  const textos = TEXTOS_LAUDO
    .map(([k, label]) => [label, ct[k]] as [string, unknown])
    .filter(([, v]) => typeof v === "string" && v.trim()) as [string, string][];
  const checklists = Object.entries(ct.checklists || {});

  return (
    <div style={{ marginTop: 16, paddingTop: 4, borderTop: `1px solid ${c.border1}` }}>
      {infos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 40px", marginTop: 14 }}>
          {infos.map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 12, color: c.textPrimary }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {!!ct.servicos_inclusos?.length && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {ct.servicos_inclusos.map(s => (
            <span key={s} style={{
              fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
              color: c.textSecondary, border: `1px solid ${c.border2}`, padding: "4px 10px",
            }}>{s}</span>
          ))}
        </div>
      )}

      <SecaoLabel c={c}>Descrição do produto</SecaoLabel>
      <div style={{
        fontSize: 12, color: ct.descricao_produto ? c.textSecondary : c.textTertiary,
        lineHeight: 1.65, whiteSpace: "pre-wrap", padding: "12px 14px",
        borderLeft: `2px solid ${c.border2}`, background: c.card2,
      }}>{ct.descricao_produto || "—"}</div>

      {!!ct.servico_contratado?.length && (
        <>
          <SecaoLabel c={c}>Descrição do serviço contratado</SecaoLabel>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>Descrição</th><th style={{ ...th, width: 100 }}>Quantidade</th>
              <th style={{ ...th, width: 120 }}>Previsão de início</th><th style={{ ...th, width: 100 }}>Liberação</th>
            </tr></thead>
            <tbody>{ct.servico_contratado.map((s, i) => (
              <tr key={i}>
                <td style={td}>{s.descricao || "—"}</td><td style={td}>{s.quantidade || "—"}</td>
                <td style={td}>{s.previsao_inicio || "—"}</td><td style={td}>{s.liberacao || "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </>
      )}

      {itens?.length ? (
        <>
          <SecaoLabel c={c}>Medição em obra · por item do contrato</SecaoLabel>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...th, width: 56 }}>Item</th>
              <th style={{ ...th, width: "26%" }}>Ambiente</th>
              <th style={th}>Descrição do item contratado</th>
              <th style={{ ...th, width: 110 }}>Qtd contratada</th>
              <th style={{ ...th, width: 130 }}>Medição do fiscal</th>
            </tr></thead>
            <tbody>
              {(() => {
                const porCodigo = new Map(
                  (ct.medicao_itens || []).map(m => [String(m.item || "").trim(), m]),
                );
                const rows = itens.map(it => {
                  const cod = codigoItem(it);
                  const m = porCodigo.get(cod);
                  if (m) porCodigo.delete(cod);
                  return { key: it.id, cod, ambiente: it.ambiente || "—",
                    desc: (it.descritivo || "").replace(/^\d+(\.\d+)?\s*·\s*/, "") || it.categoria || "—",
                    qtd: `${fmtNum(it.quantidade)} ${it.unidade}`, medido: m?.qtd || "" };
                });
                // Medições do fiscal sem item correspondente no contrato
                for (const m of porCodigo.values()) {
                  rows.push({ key: `fiscal-${m.item}`, cod: m.item || "—", ambiente: "—",
                    desc: m.descricao || "—", qtd: "—", medido: m.qtd || "" });
                }
                return rows.map(r => (
                  <tr key={r.key}>
                    <td style={td}>{r.cod}</td>
                    <td style={{ ...td, color: c.textPrimary }}>{r.ambiente}</td>
                    <td style={td}>{r.desc}</td>
                    <td style={td}>{r.qtd}</td>
                    <td style={{ ...td, color: r.medido ? c.textPrimary : c.textTertiary }}>
                      {r.medido || "Aguardando vistoria"}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </>
      ) : !!ct.medicao_itens?.length && (
        <>
          <SecaoLabel c={c}>Medição em obra</SecaoLabel>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...th, width: 60 }}>Item</th><th style={th}>Descrição do item contratado</th>
              <th style={{ ...th, width: 100 }}>Qtd / m²</th>
            </tr></thead>
            <tbody>{ct.medicao_itens.map((m, i) => (
              <tr key={i}>
                <td style={td}>{m.item || "—"}</td><td style={td}>{m.descricao || "—"}</td>
                <td style={td}>{m.qtd || "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </>
      )}

      {checklists.map(([grupo, cItens]) => (
        <div key={grupo}>
          <SecaoLabel c={c}>Checklist · {CHECKLIST_LABEL[grupo] || grupo}</SecaoLabel>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>Item</th><th style={{ ...th, width: 90 }}>Conforme</th>
              <th style={{ ...th, width: "40%" }}>Observação</th>
            </tr></thead>
            <tbody>{Object.entries(cItens).map(([label, v]) => (
              <tr key={label}>
                <td style={td}>{label}</td>
                <td style={{ ...td, color: v?.valor === "nao" ? "#C07A4A" : td.color }}>
                  {CHECK_VALOR[v?.valor || ""] || v?.valor || "—"}
                </td>
                <td style={td}>{v?.obs || ""}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ))}

      {textos.map(([label, texto]) => (
        <div key={label}>
          <SecaoLabel c={c}>{label}</SecaoLabel>
          <div style={{
            fontSize: 12, color: c.textSecondary, lineHeight: 1.65,
            whiteSpace: "pre-wrap", padding: "12px 14px",
            borderLeft: `2px solid ${c.border2}`, background: c.card2,
          }}>{texto}</div>
        </div>
      ))}

      {!!ct.entradas?.length && (
        <>
          <SecaoLabel c={c}>Diário de acompanhamento</SecaoLabel>
          {ct.entradas.map((e, i) => (
            <div key={i} style={{
              padding: "12px 14px", marginBottom: 8,
              borderLeft: `2px solid ${c.border2}`, background: c.card2,
            }}>
              <div style={{ fontSize: 10, color: c.textTertiary, marginBottom: 5 }}>
                {[e.data ? fmtDataHora(e.data) : null, e.autor].filter(Boolean).join(" · ")}
              </div>
              <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                {e.texto}
              </div>
            </div>
          ))}
        </>
      )}

      <SecaoLabel c={c}>Observações</SecaoLabel>
      <div style={{
        fontSize: 12, color: ct.observacoes ? c.textSecondary : c.textTertiary,
        lineHeight: 1.65, whiteSpace: "pre-wrap", padding: "12px 14px",
        borderLeft: `2px solid ${c.border2}`, background: c.card2,
      }}>{ct.observacoes || "Sem observações registradas."}</div>

      {imagens.length > 0 && (
        <>
          <SecaoLabel c={c}>Acompanhamento de obras · {imagens.length} foto{imagens.length > 1 ? "s" : ""}</SecaoLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            {imagens.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noreferrer" style={{
                border: `1px solid ${c.border1}`, background: c.card2,
                textDecoration: "none", display: "block",
              }}>
                <img src={midiaThumb(f.url)} alt="" loading="lazy" style={{
                  width: "100%", height: 140, objectFit: "cover", display: "block",
                }} />
                {(f.servico || f.ambiente || f.descricao) && (
                  <div style={{ padding: "6px 8px", fontSize: 10, color: c.textTertiary, lineHeight: 1.4 }}>
                    {(f.servico || f.ambiente || f.descricao || "").replace(/^\[.*?\]\s*/g, "").slice(0, 60)}
                  </div>
                )}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const STATUS_LAUDO_LABEL: Record<string, string> = {
  concluido: "Concluído", em_andamento: "Em andamento",
  rascunho: "Em elaboração", pendente: "Pendente",
};

function LaudoRow({ laudo, itens, c, isDark }: {
  laudo: Laudo; itens?: ItemObra[]; c: ColorScheme; isDark: boolean;
}) {
  const temConteudo = !!laudo.conteudo && Object.keys(laudo.conteudo).length > 0;
  // Campos do relatório já abertos — o PDF é só anexo
  const [aberto, setAberto] = useState(temConteudo);
  const statusLabel = laudo.assinado ? "Assinado"
    : laudo.assinar_url ? "Aguardando assinatura"
    : STATUS_LAUDO_LABEL[laudo.status] || (laudo.status || "").replace("_", " ");
  const { bg, color } = getStatusStyle(statusLabel, isDark);
  return (
    <div style={{ border: `1px solid ${c.border1}`, background: c.card1, marginBottom: 10, padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontFamily: serif, fontSize: 19, color: c.textPrimary, marginBottom: 4 }}>
            {LAUDO_TIPO_LABEL[laudo.tipo] || laudo.tipo}
          </div>
          <div style={{ fontSize: 11, color: c.textTertiary }}>
            {[laudo.data_vistoria ? fmtData(laudo.data_vistoria) : null,
              laudo.fiscal_nome ? `Técnico: ${laudo.fiscal_nome}` : null]
              .filter(Boolean).join(" · ") || fmtDataHora(laudo.created_at)}
          </div>
        </div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px",
          background: bg, border: `1px solid ${color}44`, fontSize: 9,
          letterSpacing: "0.12em", textTransform: "uppercase", color, flexShrink: 0,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: color }} />
          {statusLabel}
        </span>
      </div>

      {laudo.condicao && (
        <div style={{
          margin: "14px 0 0", padding: "12px 14px",
          borderLeft: `2px solid ${c.accent}`, background: c.card2,
          fontSize: 12, color: c.textSecondary, lineHeight: 1.6, whiteSpace: "pre-wrap",
        }}>{laudo.condicao}</div>
      )}

      {laudo.assinado && laudo.assinado_por && (
        <div style={{ marginTop: 12, fontSize: 11, color: c.textTertiary }}>
          Assinado por {laudo.assinado_por}{laudo.assinado_em ? ` em ${fmtDataHora(laudo.assinado_em)}` : ""}.
        </div>
      )}

      {temConteudo && aberto && (
        <ConteudoLaudo ct={laudo.conteudo!} fotos={laudo.fotos || []} itens={itens} c={c} />
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        {temConteudo ? (
          <BotaoLinha c={c} onClick={() => setAberto(a => !a)}>
            {aberto
              ? <><ChevronUp size={11} strokeWidth={1.5} /> Fechar relatório</>
              : <><ChevronDown size={11} strokeWidth={1.5} /> Ver relatório</>}
          </BotaoLinha>
        ) : (
          <BotaoLinha c={c} onClick={() => window.open(laudo.pdf_url, "_blank")}>
            <FileText size={11} strokeWidth={1.5} /> Ver documento
          </BotaoLinha>
        )}
        {laudo.assinar_url && !laudo.assinado && (
          <BotaoLinha c={c} destaque onClick={() => window.open(laudo.assinar_url!, "_blank")}>
            <PenLine size={11} strokeWidth={1.5} /> Assinar digitalmente
          </BotaoLinha>
        )}
        {temConteudo && (
          <BotaoLinha c={c} onClick={() => window.open(laudo.pdf_url, "_blank")}>
            <Download size={11} strokeWidth={1.5} /> Arquivo PDF
          </BotaoLinha>
        )}
      </div>
    </div>
  );
}

/** Mapeamento publicado pelo Status — páginas do PDF do quadro, na ordem. */
function MapaPublicado({ mapa, c }: { mapa: MapaPrint; c: ColorScheme }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap", marginBottom: 14,
      }}>
        <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: c.textTertiary }}>
          Mapeamento da obra{mapa.revisao ? ` · Revisão ${mapa.revisao}` : ""}
          {mapa.gerado_em ? ` · ${fmtData(mapa.gerado_em)}` : ""}
        </div>
        <BotaoLinha c={c} onClick={() => window.open(mapa.pdf_url, "_blank")}>
          <Download size={11} strokeWidth={1.5} /> Arquivo PDF
        </BotaoLinha>
      </div>
      <div style={{ display: "grid", gap: 20 }}>
        {mapa.paginas.map(p => (
          <figure key={p.n} style={{ margin: 0 }}>
            <a href={p.url} target="_blank" rel="noreferrer" title="Abrir em tamanho real">
              <img src={p.url} alt={p.label || `Página ${p.n} do mapeamento`}
                   loading="lazy"
                   style={{
                     width: "100%", display: "block",
                     border: `1px solid ${c.border1}`, background: "#FFFFFF",
                   }} />
            </a>
            <figcaption style={{
              fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
              color: c.textTertiary, marginTop: 6,
            }}>
              {p.label ? `${p.label} · ` : ""}Página {String(p.n).padStart(2, "0")} de {String(mapa.paginas.length).padStart(2, "0")}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

/** Documento publicado no gestão (etapa 7): mostra cada PDF como imagem
 *  (páginas raster geradas server-side) igual ao Mapeamento, com download do PDF. */
function DocumentoRaster({ doc, c }: { doc: Documento; c: ColorScheme }) {
  const nome = (doc.titulo || doc.nome_arquivo || "Arquivo").replace(/\.pdf$/i, "");
  const paginas = doc.paginas || [];
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap", marginBottom: 14,
      }}>
        <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: c.textTertiary }}>
          {nome}
          {doc.created_at ? ` · ${fmtData(doc.created_at)}` : ""}
        </div>
        <BotaoLinha c={c} onClick={() => window.open(doc.arquivo_url, "_blank")}>
          <Download size={11} strokeWidth={1.5} /> Arquivo PDF
        </BotaoLinha>
      </div>
      {paginas.length > 0 ? (
        <div style={{ display: "grid", gap: 20 }}>
          {paginas.map(p => (
            <figure key={p.n} style={{ margin: 0 }}>
              <a href={p.url} target="_blank" rel="noreferrer" title="Abrir em tamanho real">
                <img src={p.url} alt={p.label || `${nome} · Página ${p.n}`}
                     loading="lazy"
                     style={{
                       width: "100%", display: "block",
                       border: `1px solid ${c.border1}`, background: "#FFFFFF",
                     }} />
              </a>
              <figcaption style={{
                fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
                color: c.textTertiary, marginTop: 6,
              }}>
                {p.label ? `${p.label} · ` : ""}Página {String(p.n).padStart(2, "0")} de {String(paginas.length).padStart(2, "0")}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div style={{
          padding: "24px", border: `1px dashed ${c.border2}`,
          textAlign: "center", color: c.textTertiary, fontSize: 12,
        }}>
          Pré-visualização em preparo. Use o botão acima pra baixar o PDF.
        </div>
      )}
    </div>
  );
}

/** Destaque do Reconhecimento da Obra — fiscal, quem acompanhou e dia/horário. */
function VistoriaInfo({ data, c }: { data: CenterData; c: ColorScheme }) {
  const v = laudoPorTipo(data, "1vistoria");
  if (!v) return null;
  const quando = v.data_vistoria || v.created_at;
  const dt = quando ? new Date(quando) : null;
  const infos = [
    { label: "FISCAL", value: v.fiscal_nome || "Equipe Parket", sub: "responsável técnico Parket" },
    {
      label: "ACOMPANHADO POR",
      value: v.conteudo?.responsavel || "—",
      sub: "engenheiro, arquiteto ou gestor da obra",
    },
    {
      label: "REALIZADO EM",
      value: dt ? dt.toLocaleDateString("pt-BR") : "—",
      sub: dt ? `às ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "aguardando vistoria",
    },
  ];
  return (
    <div className="pkt-grid3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: `1px solid ${c.border1}`, marginBottom: 30 }}>
      {infos.map((s, i) => (
        <div key={s.label} style={{ padding: "18px 20px", borderRight: i < 2 ? `1px solid ${c.border1}` : "none" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 8 }}>
            {s.label}
          </div>
          <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 400, color: c.textPrimary, lineHeight: 1.1, marginBottom: 4 }}>
            {s.value}
          </div>
          <div style={{ fontSize: 10, color: c.textTertiary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

// Mesmos grupos de abas do card do dashboard — aqui trocam a página inteira.
const DOC_TAB_GROUPS: { label: string; n: number }[][] = [
  [{ label: "Checklist de Início", n: 3 }, { label: "Reconhecimento da Obra", n: 2 }, { label: "Liberação de Obra", n: 4 }],
  [{ label: "Mapeamento", n: 5 }, { label: "Definições", n: 12 }, { label: "Anteprojeto", n: 11 }, { label: "Projeto Executivo", n: 7 }],
];

export function DocumentView({ data, c, isDark, etapa, token, onVoltar, onOpenDoc }: {
  data: CenterData; c: ColorScheme; isDark: boolean;
  etapa: number; token: string; onVoltar: () => void; onOpenDoc: (etapa: number) => void;
}) {
  const stages = buildStages(data);
  const stage = stages.find(s => s.etapa.numero === etapa) || stages[0];
  const laudos = laudosDaEtapa(data, stage.etapa.numero);
  // Documentos publicados nesta etapa (Anteprojeto=11, Projeto Executivo=7, etc).
  // Vale pra qualquer etapa: o que o gestao subir na etapa aparece aqui.
  const docs = docsDaEtapa(data, stage.etapa.numero);

  const grupo = DOC_TAB_GROUPS.find(g => g.some(t => t.n === stage.etapa.numero));
  const tabs = (grupo || [])
    .map(t => ({ ...t, stage: stages.find(s => s.etapa.numero === t.n) }))
    .filter(t => t.stage);

  return (
    <div style={{ minHeight: "calc(100vh - 88px)" }}>
      <div style={{ padding: "32px var(--pkt-pad-x) 60px", minWidth: 0 }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ marginBottom: 14 }}>
            <button onClick={onVoltar} style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              display: "flex", alignItems: "center", gap: 6, fontSize: 10,
              letterSpacing: "0.18em", textTransform: "uppercase", color: c.accent,
            }}>
              <ArrowLeft size={12} strokeWidth={1.5} /> Voltar à central
            </button>
          </div>
          {tabs.length > 1 && (
            <div className="stage-tabs" style={{ marginBottom: 18, gap: 8 }}>
              {tabs.map(t => {
                const active = t.n === stage.etapa.numero;
                return (
                  <button key={t.label} onClick={() => !active && onOpenDoc(t.n)} style={{
                    background: "none", cursor: "pointer", padding: "11px 20px",
                    border: `1px solid ${active ? c.accent : c.border1}`,
                    color: active ? c.accent : c.textTertiary,
                    fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                    display: "flex", alignItems: "center", gap: 7,
                    whiteSpace: "nowrap", flexShrink: 0,
                  }}>
                    {t.label}
                    {t.stage!.hasPendency && (
                      <span style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: isDark ? "#C8922A" : "#8A6010", flexShrink: 0,
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <h1 style={{ fontFamily: serif, fontSize: "clamp(28px, 7vw, 40px)", fontWeight: 300, color: c.textPrimary, margin: "0 0 10px", lineHeight: 1.05 }}>
            {stage.etapa.titulo}
          </h1>
          <p style={{ fontSize: 14, color: c.textSecondary, lineHeight: 1.6, maxWidth: 620 }}>
            {stage.etapa.descricao}
          </p>
          {stage.etapa.numero === 1 && (
            <p style={{ fontSize: 12, color: c.textTertiary, lineHeight: 1.5, marginTop: 6, letterSpacing: "0.02em" }}>
              (área real)
            </p>
          )}
        </div>

        {stage.etapa.numero === 2 && <VistoriaInfo data={data} c={c} />}
        {stage.etapa.numero === 1 && <ItensContratados data={data} c={c} isDark={isDark} />}
        {stage.etapa.numero === 3 && <ChecklistObras data={data} c={c} isDark={isDark} token={token} />}
        {stage.etapa.numero === 5 && data.mapa && data.mapa.paginas?.length > 0 && (
          <MapaPublicado mapa={data.mapa} c={c} />
        )}
        {docs.length > 0 && (
          <div>
            {docs.slice().reverse()  // FORRO antes de PISO (created_at DESC no backend)
              .map(d => <DocumentoRaster key={d.id} doc={d} c={c} />)}
          </div>
        )}
        {stage.etapa.numero === 12 && (
          <DefinicoesView data={data} c={c} isDark={isDark} token={token} />
        )}

        {laudos.map(l => (
          <LaudoRow key={l.id} laudo={l} c={c} isDark={isDark}
            itens={["1vistoria", "2vistoria"].includes(l.tipo)
              ? data.itens.filter(i => i.status !== "cancelado") : undefined} />
        ))}

        {laudos.length === 0 && docs.length === 0 && ![1, 3, 12].includes(stage.etapa.numero)
          && !(stage.etapa.numero === 5 && data.mapa && data.mapa.paginas?.length > 0) && (
          <div style={{
            padding: "40px 24px", border: `1px dashed ${c.border2}`,
            textAlign: "center", color: c.textTertiary, fontSize: 12, lineHeight: 1.7,
          }}>
            Os documentos desta etapa serão publicados aqui assim que forem
            emitidos pela equipe Parket.
          </div>
        )}

      </div>
    </div>
  );
}

