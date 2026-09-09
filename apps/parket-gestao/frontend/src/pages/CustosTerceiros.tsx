/**
 * Custos de Terceiros — tela de lançamento (etapa 4).
 *
 * Quem usa: o secretário de obra, no celular, em pé na obra. Por isso tudo
 * aqui é coluna única, alvo de toque grande e foto direto da câmera. Se a
 * tela for chata, o processo volta pro WhatsApp.
 *
 * REGRA DO MÓDULO: todo cálculo mora no backend. Esta tela só manda os campos
 * crus (km rodado, litros, check-in/check-out) e exibe o valor_total_cent que
 * voltar. Nunca multiplica nada pra mostrar na frente do usuário.
 *
 * Dinheiro é sempre inteiro em centavos. reaisParaCent/centParaReais fazem a
 * ponte com o que o usuário digita, e só nas bordas da tela.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { fonts, useTokens } from "../theme";
import {
  api,
  type CustoDespesa,
  type CustoDetalhe,
  type CustoLancamentoLinha,
  type CustoMemoria,
  type CustoPrestador,
  type CustoRelatorio,
  type CustoStatus,
  type Projeto,
} from "../api";

// ═══════════════════════════════════════════════════════════════════
// Catálogo de subcategorias
//
// Espelha SUBCAT_CATEGORIA do backend. Cada entrada declara QUAIS campos a
// tela pede; o backend é quem decide o que fazer com eles.
//   qtd    = pede quantidade (o backend multiplica por valor unitário)
//   valor  = pede valor unitário em reais
//   campos = campos específicos que vão no jsonb `campos`
// combustivel_km e reembolso_km não pedem valor unitário: o primeiro usa o
// preço do litro (que é campo próprio) e o segundo usa o valor por km da
// política vigente, ignorando qualquer valor digitado.
// ═══════════════════════════════════════════════════════════════════

type CampoDef = {
  k: string;
  label: string;
  tipo: "numero" | "texto" | "data" | "dinheiro" | "opcoes";
  opcoes?: { v: string; label: string }[];
  dica?: string;
};

type SubcatDef = {
  k: string;
  label: string;
  qtd?: string;      // label da quantidade quando pedida
  valor?: string;    // label do valor unitário quando pedido
  campos?: CampoDef[];
  ajuda?: string;
};

const GRUPOS: { grupo: string; itens: SubcatDef[] }[] = [
  {
    grupo: "Deslocamento",
    itens: [
      {
        k: "combustivel_km",
        label: "Combustível por km",
        ajuda: "O sistema calcula os litros: (ida + volta) dividido pelo consumo, vezes o preço do litro.",
        campos: [
          { k: "km_ida", label: "Km de ida", tipo: "numero" },
          { k: "km_volta", label: "Km de volta", tipo: "numero" },
          { k: "consumo_km_l", label: "Consumo do carro (km/l)", tipo: "numero" },
          { k: "preco_litro_cent", label: "Preço do litro", tipo: "dinheiro" },
        ],
      },
      {
        k: "reembolso_km",
        label: "Reembolso por km",
        ajuda: "O valor por km vem da política de reembolso vigente, não é digitado aqui.",
        campos: [
          { k: "km_ida", label: "Km de ida", tipo: "numero" },
          { k: "km_volta", label: "Km de volta", tipo: "numero" },
        ],
      },
      { k: "abastecimento", label: "Abastecimento", valor: "Valor" },
      { k: "pedagio", label: "Pedágio", qtd: "Quantas praças", valor: "Valor de cada" },
      {
        k: "passagem", label: "Passagem", valor: "Valor",
        campos: [{ k: "trecho", label: "Trecho", tipo: "texto", dica: "Ex: Curitiba para Florianópolis" }],
      },
      { k: "aluguel_carro", label: "Aluguel de carro", qtd: "Diárias", valor: "Valor da diária" },
      { k: "uber", label: "Uber", valor: "Valor" },
      { k: "taxi", label: "Táxi", valor: "Valor" },
      { k: "estacionamento", label: "Estacionamento", valor: "Valor" },
    ],
  },
  {
    grupo: "Diária e estadia",
    itens: [
      {
        k: "hospedagem", label: "Hospedagem", valor: "Valor da diária",
        ajuda: "As noites saem da diferença entre check-in e check-out.",
        campos: [
          { k: "check_in", label: "Check-in", tipo: "data" },
          { k: "check_out", label: "Check-out", tipo: "data" },
        ],
      },
      {
        k: "alimentacao", label: "Alimentação", valor: "Valor",
        campos: [{
          k: "refeicao", label: "Refeição", tipo: "opcoes",
          opcoes: [{ v: "cafe", label: "Café" }, { v: "almoco", label: "Almoço" }, { v: "jantar", label: "Jantar" }],
        }],
      },
      {
        k: "diaria_fechada", label: "Diária fechada", qtd: "Dias", valor: "Valor do dia",
        ajuda: "Diária fechada já cobre a alimentação. Não pode conviver com alimentação avulsa no mesmo lançamento.",
      },
    ],
  },
  {
    grupo: "Documentação e repasse",
    itens: [
      {
        k: "nf", label: "Nota fiscal", valor: "Valor",
        campos: [
          { k: "numero", label: "Número do documento", tipo: "texto" },
          { k: "emissao", label: "Emissão", tipo: "data" },
        ],
      },
      {
        k: "rpa", label: "RPA", valor: "Valor",
        campos: [
          { k: "numero", label: "Número do documento", tipo: "texto" },
          { k: "emissao", label: "Emissão", tipo: "data" },
        ],
      },
    ],
  },
];

const SUBCAT: Record<string, SubcatDef> = {};
GRUPOS.forEach(g => g.itens.forEach(i => { SUBCAT[i.k] = i; }));

const STATUS_LABEL: Record<CustoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  devolvido: "Devolvido",
  pago: "Pago",
};

/** Rótulo do botão de cada transição, na voz de quem aperta. */
const ACAO_LABEL: Record<CustoStatus, string> = {
  rascunho: "Voltar para rascunho",
  enviado: "Enviar para o financeiro",
  em_analise: "Iniciar análise",
  aprovado: "Aprovar",
  devolvido: "Devolver para correção",
  pago: "Marcar como pago",
};

const CATEGORIA_LABEL: Record<string, string> = {
  deslocamento: "Deslocamento",
  estadia: "Diária e estadia",
  documentacao: "Documentação e repasse",
};

// ═══════════════════════════════════════════════════════════════════
// Dinheiro
// ═══════════════════════════════════════════════════════════════════

function centParaReais(c: number | null | undefined): string {
  return ((c || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1.234,56" e "1234.56" viram 123456. Aceita o que o usuário digitar. */
function reaisParaCent(txt: string): number {
  const limpo = (txt || "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function num(txt: string): number {
  const n = parseFloat((txt || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function dataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : String(iso);
}

/**
 * Comprime a foto ANTES do upload. Câmera de celular manda 4 a 8 MB por foto;
 * numa obra com 4G ruim isso é o que faz o secretário desistir e mandar no
 * WhatsApp. 1600px de lado maior em JPEG 72% segura um comprovante legível
 * em torno de 200 KB. Se algo falhar, sobe o arquivo original.
 */
async function comprimirImagem(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * escala);
    cv.height = Math.round(bmp.height * escala);
    const ctx = cv.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob: Blob | null = await new Promise(res => cv.toBlob(res, "image/jpeg", 0.72));
    bmp.close();
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Raiz
// ═══════════════════════════════════════════════════════════════════

export default function CustosTerceiros() {
  const [aberto, setAberto] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState(false);
  if (aberto) return <Detalhe lid={aberto} onVoltar={() => setAberto(null)} />;
  if (relatorio) return <Relatorio onVoltar={() => setRelatorio(false)} />;
  return <Lista onAbrir={setAberto} onRelatorio={() => setRelatorio(true)} />;
}

// ═══════════════════════════════════════════════════════════════════
// Lista de lançamentos
// ═══════════════════════════════════════════════════════════════════

function Lista({ onAbrir, onRelatorio }: { onAbrir: (lid: string) => void; onRelatorio: () => void }) {
  const t = useTokens();
  const [items, setItems] = useState<CustoLancamentoLinha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("");
  const [novo, setNovo] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const r = await api.custosLancamentos(filtro ? { status: filtro } : undefined);
      setItems(r.items);
      setErro("");
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [filtro]);

  return (
    // Coluna cheia: conteúdo rolante em cima, rodapé fixo embaixo DENTRO do
    // main. position:fixed aqui quebrava no desktop: atravessava a sidebar e
    // centralizava pelo viewport (desalinhado do conteúdo), além do bug
    // conhecido de fixed dentro de body{zoom}.
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: t.bg }}>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "18px 14px 24px" }}>
        <Cabecalho titulo="Custos de Terceiros"
          sub="Gasto do prestador que se desloca até a obra" t={t} />

        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "4px 0 14px" }}>
          <Chip ativo={filtro === ""} onClick={() => setFiltro("")} t={t}>Todos</Chip>
          <Chip ativo={filtro === "rascunho,devolvido"} onClick={() => setFiltro("rascunho,devolvido")} t={t}>Em aberto</Chip>
          <Chip ativo={filtro === "enviado,em_analise"} onClick={() => setFiltro("enviado,em_analise")} t={t}>No financeiro</Chip>
          <Chip ativo={filtro === "aprovado"} onClick={() => setFiltro("aprovado")} t={t}>Aprovados</Chip>
          <Chip ativo={filtro === "pago"} onClick={() => setFiltro("pago")} t={t}>Pagos</Chip>
          {/* Não é filtro: abre a visão consolidada (etapa 6b). O backend já
              recorta pelo perfil: quem não é financeiro vê só o que é dele. */}
          <Chip ativo={false} onClick={onRelatorio} t={t}>Relatório</Chip>
        </div>

        {erro && <Aviso tom="erro" t={t}>{erro}</Aviso>}
        {carregando && <Vazio t={t}>Carregando…</Vazio>}
        {!carregando && !items.length && (
          <Vazio t={t}>Nenhum lançamento aqui. Toque em Novo lançamento para abrir o primeiro.</Vazio>
        )}

        {items.map(l => (
          <button key={l.id} onClick={() => onAbrir(l.id)} style={{
            width: "100%", textAlign: "left", cursor: "pointer",
            background: t.card1, border: `1px solid ${t.border1}`,
            padding: "13px 14px", marginBottom: 8, color: t.textPrimary,
            display: "block",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.14em" }}>{l.numero}</span>
              <Selo status={l.status} t={t} />
            </div>
            <div style={{ fontSize: 13, marginTop: 7, fontWeight: 500 }}>{l.cliente}</div>
            <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>
              {l.prestador_nome || "terceiro sem nome"}
              {l.data_ida ? ` · ${dataBR(l.data_ida)}` : ""}
              {l.data_volta ? ` a ${dataBR(l.data_volta)}` : ""}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 9, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>R$ {centParaReais(l.total_lancado_cent)}</span>
              <span style={{ fontSize: 10, color: t.textTertiary, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {l.n_despesas} {l.n_despesas === 1 ? "despesa" : "despesas"}
              </span>
              {l.n_alertas > 0 && (
                <span style={{ fontSize: 10, color: "#C9A227", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {l.n_alertas} com alerta
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      </div>

      {/* Rodapé no fluxo: no celular a lista rola e o Novo fica sempre ao
          alcance do polegar; no desktop alinha com a coluna de conteúdo. */}
      <div style={{
        flexShrink: 0, padding: "10px 14px",
        background: t.headerBg, borderTop: `1px solid ${t.border1}`,
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex" }}>
          <Botao primario t={t} onClick={() => setNovo(true)}>Novo lançamento</Botao>
        </div>
      </div>

      {novo && (
        <NovoLancamento t={t} onFechar={() => setNovo(false)}
          onCriado={(lid) => { setNovo(false); onAbrir(lid); }} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Relatório (etapa 6b)
//
// Visão consolidada por obra, terceiro, categoria e mês + export CSV.
// Todos os números vêm prontos do GET /api/custos/relatorio: glosada
// aparece na contagem de linhas mas fica FORA dos totais (regra do
// backend, não recalcular aqui). XLSX ficou de fora de propósito:
// dependência nova só com aprovação do Will.
// ═══════════════════════════════════════════════════════════════════

const EIXO_TITULO: Record<string, string> = {
  obra: "Por obra", terceiro: "Por terceiro",
  categoria: "Por categoria", mes: "Por mês",
};

function Relatorio({ onVoltar }: { onVoltar: () => void }) {
  const t = useTokens();
  // Período default: primeiro dia do mês corrente até hoje.
  const [de, setDe] = useState(hoje().slice(0, 8) + "01");
  const [ate, setAte] = useState(hoje());
  // "aprovado,pago" = o que é custo de fato; "" = tudo (inclui rascunho).
  const [status, setStatus] = useState("aprovado,pago");
  const [dados, setDados] = useState<CustoRelatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState("");

  const params = () => ({
    de: de || undefined, ate: ate || undefined,
    status: status || "rascunho,enviado,em_analise,aprovado,devolvido,pago",
  });

  async function carregar() {
    setCarregando(true);
    try {
      setDados(await api.custosRelatorio(params()));
      setErro("");
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [de, ate, status]);

  // Export: baixa o blob (o endpoint exige X-User-Email, link direto não
  // manda header) e dispara o download com o nome que o backend sugere.
  async function exportarCsv() {
    setBaixando(true);
    try {
      const blob = await api.custosRelatorioCsv(params());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `custos-terceiros-${hoje().replace(/-/g, "")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) { setErro(String(e?.message || e)); }
    finally { setBaixando(false); }
  }

  // Cada eixo ordenado do maior gasto pro menor: é o que o financeiro quer ver.
  const eixos = useMemo(() => {
    if (!dados?.resumo) return [];
    return (["obra", "terceiro", "categoria", "mes"] as const)
      .filter(e => dados.resumo[e] && Object.keys(dados.resumo[e]).length > 0)
      .map(e => ({
        eixo: e,
        linhas: Object.entries(dados.resumo[e]).sort((a, b) => b[1] - a[1]),
      }));
  }, [dados]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: t.bg }}>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "18px 14px 24px" }}>
          <Voltar t={t} onClick={onVoltar} />
          <Cabecalho titulo="Relatório de Custos"
            sub="Consolidado por obra, terceiro, categoria e mês" t={t} />

          {/* Filtros: período + recorte de status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <Rotulo t={t}>De</Rotulo>
              <Campo t={t} tipo="date" valor={de} onChange={setDe} />
            </div>
            <div>
              <Rotulo t={t}>Até</Rotulo>
              <Campo t={t} tipo="date" valor={ate} onChange={setAte} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "2px 0 14px" }}>
            <Chip ativo={status === "aprovado,pago"} onClick={() => setStatus("aprovado,pago")} t={t}>Aprovados e pagos</Chip>
            <Chip ativo={status === "pago"} onClick={() => setStatus("pago")} t={t}>Só pagos</Chip>
            <Chip ativo={status === ""} onClick={() => setStatus("")} t={t}>Tudo (inclui rascunho)</Chip>
          </div>

          {erro && <Aviso tom="erro" t={t}>{erro}</Aviso>}
          {carregando && <Vazio t={t}>Carregando…</Vazio>}

          {!carregando && dados && (
            <>
              {/* Totais do período */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <Numero t={t} rotulo="Total no período" valor={dados.total_cent} destaque />
                <Numero t={t} rotulo="Glosado (fora do total)" valor={dados.glosado_cent} />
              </div>

              {dados.items.length === 0 && (
                <Vazio t={t}>Nenhuma despesa no período com esse recorte.</Vazio>
              )}

              {/* Consolidado por eixo */}
              {eixos.map(({ eixo, linhas }) => (
                <div key={eixo} style={{ marginBottom: 16 }}>
                  <Rotulo t={t}>{EIXO_TITULO[eixo]}</Rotulo>
                  <div style={{ border: `1px solid ${t.border1}`, background: t.card1 }}>
                    {linhas.map(([chave, cent]) => (
                      <div key={chave} style={{
                        display: "flex", justifyContent: "space-between", gap: 10,
                        padding: "10px 12px", borderBottom: `1px solid ${t.border1}`,
                      }}>
                        <span style={{ fontSize: 12, color: t.textPrimary, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {eixo === "categoria" ? (CATEGORIA_LABEL[chave] || chave) : chave}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: t.textPrimary, whiteSpace: "nowrap" }}>
                          R$ {centParaReais(cent)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Linha a linha (o detalhe completo vai no CSV) */}
              {dados.items.length > 0 && (
                <>
                  <Rotulo t={t}>Despesas ({dados.items.length})</Rotulo>
                  <div style={{ border: `1px solid ${t.border1}`, background: t.card1 }}>
                    {dados.items.map((l, i) => (
                      <div key={i} style={{ padding: "10px 12px", borderBottom: `1px solid ${t.border1}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <span style={{ fontSize: 12, color: t.textPrimary, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {l.obra} · {SUBCAT[l.subcategoria]?.label || l.subcategoria}
                          </span>
                          <span style={{
                            fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                            color: l.status_despesa === "glosado" ? t.textTertiary : t.textPrimary,
                            textDecoration: l.status_despesa === "glosado" ? "line-through" : "none",
                          }}>
                            R$ {centParaReais(l.valor_total_cent)}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 3 }}>
                          {l.numero} · {l.terceiro || "terceiro sem nome"}
                          {l.data ? ` · ${dataBR(l.data)}` : ""}
                          {l.status_despesa === "glosado" ? " · GLOSADA" : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Rodapé no fluxo (mesmo padrão da Lista: nada de position fixed) */}
      <div style={{
        flexShrink: 0, padding: "10px 14px",
        background: t.headerBg, borderTop: `1px solid ${t.border1}`,
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex" }}>
          <Botao primario t={t} onClick={exportarCsv} desabilitado={baixando || carregando}>
            {baixando ? "Gerando CSV…" : "Exportar CSV"}
          </Botao>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Novo lançamento: obra + terceiro + período + despesas em lote +
// dados de pagamento da ficha
// ═══════════════════════════════════════════════════════════════════

// Linha de despesa preenchida direto no modal (pedágio, alimentação,
// gasolina... tudo de uma vez, sem precisar entrar no detalhe depois)
type LinhaDespesa = {
  sub: string;
  data: string;
  qtd: string;
  valor: string;
  descricao: string;
  campos: Record<string, string>;
};

// Converte a linha digitada no payload da API. Mesma regra do FormDespesa:
// campo _cent vira centavos, numero vira number, o resto vai cru; quem
// calcula o total é o backend.
function montarBodyDespesa(ln: LinhaDespesa) {
  const def = SUBCAT[ln.sub];
  const payloadCampos: Record<string, any> = {};
  (def?.campos || []).forEach(c => {
    const v = ln.campos[c.k];
    if (v === undefined || v === "") return;
    payloadCampos[c.k] = c.tipo === "dinheiro" ? reaisParaCent(v)
      : c.tipo === "numero" ? num(v)
      : v;
  });
  return {
    subcategoria: ln.sub,
    data: ln.data || null,
    descricao: ln.descricao || null,
    quantidade: def?.qtd ? num(ln.qtd) : 1,
    valor_unitario_cent: def?.valor ? reaisParaCent(ln.valor) : 0,
    campos: payloadCampos,
  };
}

// Memória de lançamento: transforma a sugestão do backend (o que já foi
// lançado antes: km da obra, consumo do carro, diária do hotel, preço do
// litro) nos campos de tela em string. Valores _cent viram reais, mesma
// convenção dos inputs; o que a memória não tem sai vazio pro usuário digitar.
function aplicarMemoria(sub: string, mem: CustoMemoria | null): {
  qtd: string; valor: string; descricao: string; campos: Record<string, string>;
} {
  const s = mem?.sugestoes?.[sub];
  const campos: Record<string, string> = {};
  Object.entries(s?.campos || {}).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") return;
    campos[k] = k.endsWith("_cent") ? centParaReais(Number(v)) : String(v);
  });
  return {
    qtd: s?.quantidade ? String(s.quantidade) : "1",
    valor: s?.valor_unitario_cent ? centParaReais(s.valor_unitario_cent) : "",
    descricao: s?.descricao || "",
    campos,
  };
}

// Estimativa DE TELA do total de uma linha, pro secretário conferir antes de
// salvar. O número oficial continua sendo o do backend (mesmas fórmulas);
// null = ainda não dá pra estimar (faltam campos).
function estimarTotalLinha(ln: LinhaDespesa, kmValorCent: number): number | null {
  const def = SUBCAT[ln.sub];
  if (!def) return null;
  const c = ln.campos;
  if (ln.sub === "combustivel_km") {
    // litros = (ida + volta) / consumo; total = litros x preço do litro
    const km = num(c.km_ida || "") + num(c.km_volta || "");
    const consumo = num(c.consumo_km_l || "");
    const litro = reaisParaCent(c.preco_litro_cent || "");
    if (!km || !consumo || !litro) return null;
    return Math.round((km / consumo) * litro);
  }
  if (ln.sub === "reembolso_km") {
    // valor por km vem da política vigente, não é digitado
    const km = num(c.km_ida || "") + num(c.km_volta || "");
    if (!km || !kmValorCent) return null;
    return Math.round(km * kmValorCent);
  }
  const unit = reaisParaCent(ln.valor);
  if (!unit) return null;
  if (ln.sub === "hospedagem") {
    // noites = diferença entre check-out e check-in; sem datas mostra 1 noite
    const noites = c.check_in && c.check_out
      ? Math.round((Date.parse(c.check_out) - Date.parse(c.check_in)) / 86400000)
      : 1;
    return noites > 0 ? noites * unit : null;
  }
  return Math.round((def.qtd ? num(ln.qtd) : 1) * unit);
}

function NovoLancamento({ t, onFechar, onCriado }: {
  t: any; onFechar: () => void; onCriado: (lid: string) => void;
}) {
  const [obras, setObras] = useState<Projeto[]>([]);
  const [terceiros, setTerceiros] = useState<CustoPrestador[]>([]);
  const [buscaObra, setBuscaObra] = useState("");
  const [buscaTerceiro, setBuscaTerceiro] = useState("");
  const [obra, setObra] = useState<Projeto | null>(null);
  const [terceiro, setTerceiro] = useState<CustoPrestador | null>(null);
  const [ida, setIda] = useState(hoje());
  const [volta, setVolta] = useState(hoje());
  const [motivo, setMotivo] = useState("");
  const [adiantamento, setAdiantamento] = useState("");
  // Despesas em lote: já saem criadas junto com o lançamento
  const [linhas, setLinhas] = useState<LinhaDespesa[]>([]);
  // Dados de pagamento editáveis, pré-carregados da ficha do terceiro
  const [pg, setPg] = useState<Record<string, string>>({});
  const [pgAberto, setPgAberto] = useState(false);
  // Valor por km da política vigente: usado só na estimativa do reembolso_km
  const [kmValorCent, setKmValorCent] = useState(0);
  // Memória de lançamento: sugestões aprendidas dos lançamentos anteriores
  // desta obra/terceiro (km, hotel, consumo, litro), pra pré-preencher despesas
  const [memoria, setMemoria] = useState<CustoMemoria | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Fiscal e funcionario CLT: o reembolso sai pela folha, entao a secao de
  // Dados de pagamento (PF/PJ/MEI, CPF, pix, banco) nao se aplica a ele.
  const ehFiscal = (p: CustoPrestador | null) =>
    (p?.categoria || "").trim().toLowerCase() === "fiscal";

  // Escolher o terceiro pré-carrega a ficha de pagamento nos campos
  function escolherTerceiro(p: CustoPrestador) {
    setTerceiro(p);
    setPg({
      tipo_pessoa: p.tipo_pessoa || "",
      documento: p.cpf || p.cnpj || "",
      pix_chave: p.pix_chave || "",
      banco: p.banco || "",
      agencia: p.agencia || "",
      conta: p.conta || "",
      titular: p.titular || "",
    });
    // Ficha incompleta abre a seção direto; completa fica atrás do Editar.
    // Fiscal nunca abre: CLT não tem ficha de pagamento pra preencher.
    setPgAberto(!ehFiscal(p) && (p.pendencias || []).length > 0);
  }

  useEffect(() => { api.projetos().then(setObras).catch(() => {}); }, []);
  useEffect(() => { api.custosPrestadores().then(r => setTerceiros(r.items)).catch(() => {}); }, []);
  useEffect(() => { api.custosPolitica().then(p => setKmValorCent(p.km_valor_cent || 0)).catch(() => {}); }, []);

  // Com obra e terceiro escolhidos, busca a memória. O escopo de cada campo
  // (por obra, por terceiro ou geral) é decidido no backend; falha vira só
  // "sem sugestão", nunca erro na tela.
  useEffect(() => {
    if (!obra || !terceiro) { setMemoria(null); return; }
    api.custosMemoria(obra.id, terceiro.id).then(setMemoria).catch(() => setMemoria(null));
  }, [obra?.id, terceiro?.id]);

  const obrasFiltradas = useMemo(() => {
    const q = buscaObra.trim().toLowerCase();
    return (q ? obras.filter(o => (o.cliente || "").toLowerCase().includes(q)) : obras).slice(0, 40);
  }, [obras, buscaObra]);

  const terceirosFiltrados = useMemo(() => {
    const q = buscaTerceiro.trim().toLowerCase();
    return (q ? terceiros.filter(p => (p.nome || "").toLowerCase().includes(q)) : terceiros).slice(0, 40);
  }, [terceiros, buscaTerceiro]);

  async function salvar() {
    if (!obra || !terceiro) { setErro("Escolha a obra e o terceiro."); return; }
    setSalvando(true);
    setErro("");
    try {
      // 1) Ficha de pagamento: só PATCH do que mudou em relação ao cadastro.
      //    Vai antes do lançamento: se falhar, nada foi criado ainda.
      //    Fiscal (CLT) não tem ficha: pula direto pro lançamento.
      if (!ehFiscal(terceiro)) {
        const patch: Record<string, string> = {};
        const doc = (pg.documento || "").trim();
        // CNPJ tem 14 dígitos, CPF 11: decide o campo pelo tamanho
        if (doc && doc !== (terceiro.cpf || "") && doc !== (terceiro.cnpj || "")) {
          patch[doc.replace(/\D/g, "").length > 11 ? "cnpj" : "cpf"] = doc;
        }
        (["tipo_pessoa", "pix_chave", "banco", "agencia", "conta", "titular"] as const).forEach(k => {
          const v = (pg[k] || "").trim();
          if (v && v !== ((terceiro as any)[k] || "")) patch[k] = v;
        });
        if (Object.keys(patch).length) await api.custosPrestadorPatch(terceiro.id, patch);
      }

      // 2) O lançamento em si
      const d = await api.custosLancamentoNovo({
        projeto_id: obra.id, prestador_id: terceiro.id,
        data_ida: ida || null, data_volta: volta || null,
        motivo: motivo || null, adiantamento_cent: reaisParaCent(adiantamento),
      });
      const lid = d.lancamento.id;

      // 3) Despesas em lote. Falha em uma não derruba o resto: o lançamento
      //    já existe e o que faltar dá pra adicionar dentro do detalhe.
      let falhas = 0;
      for (const ln of linhas) {
        if (!ln.sub) continue;
        try { await api.custosDespesaNova(lid, montarBodyDespesa(ln)); }
        catch { falhas++; }
      }
      if (falhas) window.alert(`${falhas} despesa(s) não entraram. Adicione de novo dentro do lançamento.`);
      onCriado(lid);
    } catch (e: any) {
      setErro(String(e?.message || e));
      setSalvando(false);
    }
  }

  return (
    <Folha titulo="Novo lançamento" t={t} onFechar={onFechar}>
      {erro && <Aviso tom="erro" t={t}>{erro}</Aviso>}

      <Rotulo t={t}>Obra</Rotulo>
      {obra ? (
        <Escolhido t={t} texto={obra.cliente} onTrocar={() => setObra(null)} />
      ) : (
        <>
          <Campo t={t} valor={buscaObra} onChange={setBuscaObra} placeholder="Buscar obra pelo cliente" />
          <Opcoes t={t}>
            {obrasFiltradas.map(o => (
              <OpcaoLinha key={o.id} t={t} onClick={() => setObra(o)}
                titulo={o.cliente} sub={o.endereco || o.numero_proposta || ""} />
            ))}
          </Opcoes>
        </>
      )}

      <Rotulo t={t}>Terceiro</Rotulo>
      {terceiro ? (
        <>
          <Escolhido t={t} texto={terceiro.nome} onTrocar={() => setTerceiro(null)} />
          {/* Ficha incompleta não impede lançar: vira pendência visível, que o
              financeiro resolve antes de pagar. Fiscal (CLT) não tem ficha. */}
          {!ehFiscal(terceiro) && terceiro.pendencias?.length > 0 && (
            <Aviso tom="atencao" t={t}>
              Falta na ficha do terceiro: {terceiro.pendencias.join("; ")}. Preencha em
              Dados de pagamento aqui embaixo para o financeiro conseguir pagar.
            </Aviso>
          )}
        </>
      ) : (
        <>
          <Campo t={t} valor={buscaTerceiro} onChange={setBuscaTerceiro} placeholder="Buscar terceiro pelo nome" />
          <Opcoes t={t}>
            {terceirosFiltrados.map(p => (
              <OpcaoLinha key={p.id} t={t} onClick={() => escolherTerceiro(p)}
                titulo={p.nome} sub={[p.categoria, p.telefone].filter(Boolean).join(" · ")}
                marca={p.pendencias?.length ? "ficha incompleta" : ""} />
            ))}
          </Opcoes>
        </>
      )}

      {/* Dados de pagamento: gravam na ficha do terceiro (cadastro no Cloud),
          então valem pra este e pros próximos lançamentos dele. Fiscal é CLT:
          o reembolso sai pela folha, então a seção inteira some pra ele. */}
      {terceiro && ehFiscal(terceiro) && (
        <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>
          Fiscal da equipe (CLT): o reembolso sai pela folha, sem dados de pagamento pra preencher.
        </div>
      )}
      {terceiro && !ehFiscal(terceiro) && (
        <>
          <Rotulo t={t}>Dados de pagamento</Rotulo>
          {!pgAberto ? (
            <Escolhido t={t} acao="Editar" onTrocar={() => setPgAberto(true)}
              texto={terceiro.pix_chave ? `PIX: ${terceiro.pix_chave}`
                : terceiro.banco ? [terceiro.banco, terceiro.agencia, terceiro.conta].filter(Boolean).join(" · ")
                : "Sem dados de pagamento"} />
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {["PF", "PJ", "MEI"].map(v => (
                  <Chip key={v} t={t} ativo={pg.tipo_pessoa === v}
                    onClick={() => setPg({ ...pg, tipo_pessoa: v })}>{v}</Chip>
                ))}
              </div>
              <Rotulo t={t}>{pg.tipo_pessoa === "PF" ? "CPF" : pg.tipo_pessoa ? "CNPJ" : "CPF ou CNPJ"}</Rotulo>
              <Campo t={t} valor={pg.documento || ""} onChange={v => setPg({ ...pg, documento: v })}
                placeholder="Só números" />
              <Rotulo t={t}>Chave PIX</Rotulo>
              <Campo t={t} valor={pg.pix_chave || ""} onChange={v => setPg({ ...pg, pix_chave: v })}
                placeholder="CPF, telefone, e-mail ou chave aleatória" />
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
                <div>
                  <Rotulo t={t}>Banco</Rotulo>
                  <Campo t={t} valor={pg.banco || ""} onChange={v => setPg({ ...pg, banco: v })} />
                </div>
                <div>
                  <Rotulo t={t}>Agência</Rotulo>
                  <Campo t={t} valor={pg.agencia || ""} onChange={v => setPg({ ...pg, agencia: v })} />
                </div>
                <div>
                  <Rotulo t={t}>Conta</Rotulo>
                  <Campo t={t} valor={pg.conta || ""} onChange={v => setPg({ ...pg, conta: v })} />
                </div>
              </div>
              <Rotulo t={t}>Titular da conta</Rotulo>
              <Campo t={t} valor={pg.titular || ""} onChange={v => setPg({ ...pg, titular: v })}
                placeholder="Se for diferente do nome do terceiro" />
              <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 4, lineHeight: 1.5 }}>
                O que preencher aqui atualiza o cadastro do terceiro e já vale pros próximos lançamentos.
              </div>
            </>
          )}
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <Rotulo t={t}>Ida</Rotulo>
          <Campo t={t} tipo="date" valor={ida} onChange={setIda} />
        </div>
        <div>
          <Rotulo t={t}>Volta</Rotulo>
          <Campo t={t} tipo="date" valor={volta} onChange={setVolta} />
        </div>
      </div>

      <Rotulo t={t}>Motivo</Rotulo>
      <Campo t={t} valor={motivo} onChange={setMotivo} placeholder="Ex: instalação do piso do térreo" />

      {/* Despesas em lote: pedágio, alimentação, gasolina... tudo aqui de uma
          vez. São criadas junto com o lançamento; comprovante (foto) entra
          depois, item a item, dentro do detalhe. */}
      <Rotulo t={t}>Despesas</Rotulo>
      {linhas.map((ln, i) => (
        <LinhaDespesaEdit key={i} t={t} ln={ln} kmValorCent={kmValorCent} memoria={memoria}
          onChange={nv => setLinhas(linhas.map((x, j) => (j === i ? nv : x)))}
          onRemover={() => setLinhas(linhas.filter((_, j) => j !== i))} />
      ))}
      <button
        onClick={() => setLinhas([...linhas, { sub: "", data: ida || hoje(), qtd: "1", valor: "", descricao: "", campos: {} }])}
        style={{
          width: "100%", background: "transparent", border: `1px dashed ${t.border2}`,
          color: t.textSecondary, padding: "12px", fontSize: 12, cursor: "pointer",
          fontFamily: fonts.inter, marginBottom: 12,
        }}>
        + Adicionar despesa
      </button>

      {/* Soma das estimativas de cada linha; o total oficial é gravado pelo
          backend quando as despesas entram. */}
      {linhas.some(l => (estimarTotalLinha(l, kmValorCent) || 0) > 0) && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          border: `1px solid ${t.border1}`, padding: "10px 12px", marginBottom: 12,
        }}>
          <span style={{ fontSize: 12, color: t.textSecondary }}>Total das despesas</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: t.textPrimary }}>
            R$ {centParaReais(linhas.reduce((s, l) => s + (estimarTotalLinha(l, kmValorCent) || 0), 0))}
          </span>
        </div>
      )}

      <Rotulo t={t}>Adiantamento já entregue</Rotulo>
      <Campo t={t} valor={adiantamento} onChange={setAdiantamento} placeholder="0,00" modo="decimal" prefixo="R$" />

      <div style={{ height: 14 }} />
      <Botao primario t={t} onClick={salvar} desabilitado={salvando}>
        {salvando ? "Abrindo…"
          : linhas.filter(l => l.sub).length
            ? `Abrir lançamento com ${linhas.filter(l => l.sub).length} despesa(s)`
            : "Abrir lançamento"}
      </Botao>
    </Folha>
  );
}

// Uma linha de despesa dentro do modal de novo lançamento. Versão compacta
// do FormDespesa: mesmos campos por subcategoria, sem foto de comprovante.
function LinhaDespesaEdit({ t, ln, kmValorCent, memoria, onChange, onRemover }: {
  t: any; ln: LinhaDespesa; kmValorCent: number; memoria: CustoMemoria | null;
  onChange: (nv: LinhaDespesa) => void; onRemover: () => void;
}) {
  const def = ln.sub ? SUBCAT[ln.sub] : null;
  // Total estimado do item, atualizado conforme digita
  const total = estimarTotalLinha(ln, kmValorCent);
  // A memória tem sugestão pro tipo escolhido? Mostra aviso pro usuário
  // saber que os campos vieram pré-preenchidos do último lançamento.
  const temMemoria = !!(ln.sub && memoria?.sugestoes?.[ln.sub]);
  return (
    <div style={{ border: `1px solid ${t.border1}`, padding: "10px 12px", marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {/* Trocar o tipo aplica a memória do novo tipo (km da obra, hotel,
            consumo...) no lugar de zerar; sem memória sai tudo vazio mesmo */}
        <select value={ln.sub}
          onChange={e => {
            const m = aplicarMemoria(e.target.value, memoria);
            onChange({ ...ln, sub: e.target.value, ...m, descricao: ln.descricao || m.descricao });
          }}
          style={{
            flex: 1, background: t.inputBg, border: `1px solid ${t.border1}`,
            color: ln.sub ? t.textPrimary : t.textSecondary, padding: "10px",
            fontSize: 13, fontFamily: fonts.inter,
          }}>
          <option value="">Tipo da despesa…</option>
          {GRUPOS.map(g => (
            <optgroup key={g.grupo} label={g.grupo}>
              {g.itens.map(i => <option key={i.k} value={i.k}>{i.label}</option>)}
            </optgroup>
          ))}
        </select>
        <button style={acaoMini(t)} onClick={onRemover}>Remover</button>
      </div>

      {def && (
        <>
          {def.ajuda && (
            <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 8, lineHeight: 1.5 }}>{def.ajuda}</div>
          )}

          {temMemoria && (
            <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 8, lineHeight: 1.5 }}>
              Pré-preenchido com o último lançamento. Confira e ajuste se mudou.
            </div>
          )}

          <Rotulo t={t}>Data</Rotulo>
          <Campo t={t} tipo="date" valor={ln.data} onChange={v => onChange({ ...ln, data: v })} />

          {(def.campos || []).map(c => (
            <div key={c.k}>
              <Rotulo t={t}>{c.label}</Rotulo>
              {c.tipo === "opcoes" ? (
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {c.opcoes!.map(o => (
                    <Chip key={o.v} ativo={ln.campos[c.k] === o.v} t={t}
                      onClick={() => onChange({ ...ln, campos: { ...ln.campos, [c.k]: o.v } })}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              ) : (
                <Campo t={t}
                  tipo={c.tipo === "data" ? "date" : "text"}
                  modo={c.tipo === "numero" || c.tipo === "dinheiro" ? "decimal" : undefined}
                  prefixo={c.tipo === "dinheiro" ? "R$" : undefined}
                  placeholder={c.dica}
                  valor={ln.campos[c.k] || ""}
                  onChange={v => onChange({ ...ln, campos: { ...ln.campos, [c.k]: v } })} />
              )}
            </div>
          ))}

          {(def.qtd || def.valor) && (
            <div style={{ display: "grid", gridTemplateColumns: def.qtd && def.valor ? "1fr 1fr" : "1fr", gap: 10 }}>
              {def.qtd && (
                <div>
                  <Rotulo t={t}>{def.qtd}</Rotulo>
                  <Campo t={t} valor={ln.qtd} onChange={v => onChange({ ...ln, qtd: v })} modo="decimal" />
                </div>
              )}
              {def.valor && (
                <div>
                  <Rotulo t={t}>{def.valor}</Rotulo>
                  <Campo t={t} valor={ln.valor} onChange={v => onChange({ ...ln, valor: v })}
                    modo="decimal" prefixo="R$" placeholder="0,00" />
                </div>
              )}
            </div>
          )}

          <Rotulo t={t}>Observação</Rotulo>
          <Campo t={t} valor={ln.descricao} onChange={v => onChange({ ...ln, descricao: v })} placeholder="Opcional" />

          {/* Valor do item calculado na hora (combustível e reembolso por km
              saem da fórmula; o resto é quantidade x valor) */}
          {total !== null && total > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontSize: 11, color: t.textSecondary }}>Valor do item</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>R$ {centParaReais(total)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Detalhe do lançamento
// ═══════════════════════════════════════════════════════════════════

function Detalhe({ lid, onVoltar }: { lid: string; onVoltar: () => void }) {
  const t = useTokens();
  const [d, setD] = useState<CustoDetalhe | null>(null);
  const [erro, setErro] = useState("");
  const [addAberto, setAddAberto] = useState(false);
  const [editando, setEditando] = useState<CustoDespesa | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Memória de lançamento pro FormDespesa pré-preencher despesa nova
  const [memoria, setMemoria] = useState<CustoMemoria | null>(null);

  async function carregar() {
    try { setD(await api.custosLancamento(lid)); setErro(""); }
    catch (e: any) { setErro(String(e?.message || e)); }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [lid]);

  // Obra e terceiro vêm do próprio lançamento; falha vira só "sem sugestão"
  useEffect(() => {
    if (!d) return;
    api.custosMemoria(d.lancamento.projeto_id, d.lancamento.prestador_id)
      .then(setMemoria).catch(() => setMemoria(null));
    // eslint-disable-next-line
  }, [d?.lancamento?.id]);

  async function mudarStatus(para: CustoStatus) {
    // Devolver sem motivo o backend recusa com 400: o secretário precisa saber
    // o que corrigir. Pede aqui em vez de deixar estourar erro na cara.
    let obs: string | null = null;
    if (para === "devolvido") {
      obs = window.prompt("O que precisa ser corrigido?") || "";
      if (!obs.trim()) return;
    }
    setOcupado(true);
    try { setD(await api.custosStatus(lid, para, obs || undefined)); setErro(""); }
    catch (e: any) { setErro(String(e?.message || e)); }
    finally { setOcupado(false); }
  }

  async function apagarDespesa(did: string) {
    if (!window.confirm("Apagar esta despesa?")) return;
    setOcupado(true);
    try { await api.custosDespesaApagar(did); await carregar(); }
    catch (e: any) { setErro(String(e?.message || e)); }
    finally { setOcupado(false); }
  }

  // Ordem de pagamento em PDF. Baixa via fetch (o endpoint exige o
  // X-User-Email, um <a href> direto não manda header) e abre numa aba.
  async function abrirPdf() {
    setOcupado(true);
    try {
      const blob = await api.custosOpPdf(lid);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // Revoga depois que a aba já carregou o blob.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) { setErro(String(e?.message || e)); }
    finally { setOcupado(false); }
  }

  if (!d) {
    return (
      <div style={{ height: "100%", overflowY: "auto", background: t.bg }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "18px 14px" }}>
          <Voltar t={t} onClick={onVoltar} />
          {erro ? <Aviso tom="erro" t={t}>{erro}</Aviso> : <Vazio t={t}>Carregando…</Vazio>}
        </div>
      </div>
    );
  }

  const L = d.lancamento;
  const porCategoria = ["deslocamento", "estadia", "documentacao"]
    .map(c => ({ cat: c, itens: d.despesas.filter(x => x.categoria === c) }))
    .filter(g => g.itens.length > 0);

  return (
    // Mesma coluna cheia da Lista: rolante + rodapé de ações no fluxo.
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: t.bg }}>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "14px 14px 24px" }}>
        <Voltar t={t} onClick={onVoltar} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 6 }}>
          <span style={{ fontFamily: fonts.cinzel, fontSize: 14, letterSpacing: "0.16em", color: t.textPrimary }}>
            {L.numero}
          </span>
          <Selo status={L.status} t={t} />
        </div>
        <div style={{ fontSize: 15, marginTop: 8, color: t.textPrimary, fontWeight: 500 }}>{L.cliente}</div>
        <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 3 }}>
          {L.prestador_nome}
          {L.data_ida ? ` · ${dataBR(L.data_ida)}` : ""}{L.data_volta ? ` a ${dataBR(L.data_volta)}` : ""}
        </div>
        {L.motivo && <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 5 }}>{L.motivo}</div>}
        <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 5, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Centro de custo: {L.centro_custo_nome || "não encontrado"}
        </div>

        {erro && <Aviso tom="erro" t={t}>{erro}</Aviso>}

        {d.pendencias.length > 0 && (
          <Aviso tom="atencao" t={t}>
            Pendências para o pagamento: {d.pendencias.join("; ")}.
          </Aviso>
        )}

        {/* Totais. Lançado é a visão do secretário; aprovado e saldo são o que
            o financeiro efetivamente paga. */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1,
          background: t.border1, border: `1px solid ${t.border1}`, margin: "14px 0",
        }}>
          <Numero t={t} rotulo="Lançado" valor={L.total_lancado_cent} />
          <Numero t={t} rotulo="Aprovado" valor={L.total_aprovado_cent} />
          <Numero t={t} rotulo="Adiantamento" valor={L.adiantamento_cent} />
          <Numero t={t} rotulo="Saldo a pagar" valor={L.saldo_cent} destaque />
        </div>

        {!d.despesas.length && (
          <Vazio t={t}>Nenhuma despesa ainda. Toque em Adicionar despesa.</Vazio>
        )}

        {porCategoria.map(g => (
          <div key={g.cat} style={{ marginBottom: 16 }}>
            <div style={{
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
              color: t.textTertiary, textTransform: "uppercase", padding: "8px 0",
            }}>
              {CATEGORIA_LABEL[g.cat]}
            </div>
            {g.itens.map(x => (
              <LinhaDespesa key={x.id} d={x} t={t}
                podeEditar={d.pode_editar}
                podeDecidir={d.pode_decidir}
                onEditar={() => setEditando(x)}
                onApagar={() => apagarDespesa(x.id)}
                onAnexo={carregar}
                onDecisao={carregar} />
            ))}
          </div>
        ))}

        {d.historico.length > 0 && (
          <details style={{ marginTop: 18 }}>
            <summary style={{
              cursor: "pointer", fontFamily: fonts.cinzel, fontSize: 9,
              letterSpacing: "0.22em", color: t.textTertiary, textTransform: "uppercase",
            }}>
              Histórico
            </summary>
            <div style={{ marginTop: 8 }}>
              {d.historico.map((h, i) => (
                <div key={i} style={{ fontSize: 11, color: t.textSecondary, padding: "5px 0", borderBottom: `1px solid ${t.border1}` }}>
                  {h.de ? `${STATUS_LABEL[h.de as CustoStatus] || h.de} para ` : "Aberto como "}
                  <strong style={{ color: t.textPrimary }}>{STATUS_LABEL[h.para as CustoStatus] || h.para}</strong>
                  {" · "}{h.usuario_nome || h.usuario_email || "sistema"}
                  {h.observacao ? ` · ${h.observacao}` : ""}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
      </div>

      <div style={{
        flexShrink: 0, padding: "10px 14px",
        background: t.headerBg, borderTop: `1px solid ${t.border1}`,
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {d.pode_editar && (
            <Botao primario t={t} onClick={() => setAddAberto(true)}>Adicionar despesa</Botao>
          )}
          {/* Os botões saem de proximos_status: o backend já filtrou o que este
              usuário pode fazer neste status. A tela não decide permissão. */}
          {d.proximos_status.map(s => (
            <Botao key={s} t={t} onClick={() => mudarStatus(s)} desabilitado={ocupado}>
              {ACAO_LABEL[s] || s}
            </Botao>
          ))}
          {/* A OP em PDF só faz sentido depois que o financeiro aprovou:
              antes disso os totais ainda mudam. */}
          {(L.status === "aprovado" || L.status === "pago") && (
            <Botao t={t} onClick={abrirPdf} desabilitado={ocupado}>
              Ordem de pagamento (PDF)
            </Botao>
          )}
        </div>
      </div>

      {(addAberto || editando) && (
        <FormDespesa
          t={t}
          lid={lid}
          despesa={editando}
          memoria={memoria}
          onFechar={() => { setAddAberto(false); setEditando(null); }}
          onSalvo={async () => { setAddAberto(false); setEditando(null); await carregar(); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Linha de despesa
// ═══════════════════════════════════════════════════════════════════

function LinhaDespesa({ d, t, podeEditar, podeDecidir, onEditar, onApagar, onAnexo, onDecisao }: {
  d: CustoDespesa; t: any; podeEditar: boolean; podeDecidir: boolean;
  onEditar: () => void; onApagar: () => void; onAnexo: () => void; onDecisao: () => void;
}) {
  const [subindo, setSubindo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function anexar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setSubindo(true);
    try { await api.custosDespesaAnexo(d.id, await comprimirImagem(f)); onAnexo(); }
    catch (err: any) { window.alert(String(err?.message || err)); }
    finally { setSubindo(false); }
  }

  async function decidir(dec: "aprovado" | "glosado") {
    let motivo = "";
    if (dec === "glosado") {
      motivo = window.prompt("Motivo da glosa") || "";
      if (!motivo.trim()) return;
    }
    try { await api.custosDespesaDecisao(d.id, dec, motivo || undefined); onDecisao(); }
    catch (err: any) { window.alert(String(err?.message || err)); }
  }

  const def = SUBCAT[d.subcategoria];
  const glosada = d.status === "glosado";

  return (
    <div style={{
      background: t.card1, border: `1px solid ${t.border1}`, padding: "11px 12px", marginBottom: 6,
      opacity: glosada ? 0.6 : 1,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontSize: 13, color: t.textPrimary }}>{def?.label || d.subcategoria}</div>
        <div style={{
          fontSize: 14, fontWeight: 600, color: t.textPrimary, whiteSpace: "nowrap",
          textDecoration: glosada ? "line-through" : "none",
        }}>
          R$ {centParaReais(d.valor_total_cent)}
        </div>
      </div>

      <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 3 }}>
        {dataBR(d.data)}
        {/* Quantidade e unitário vêm calculados do backend; aqui é só leitura. */}
        {d.quantidade && Number(d.quantidade) !== 1
          ? ` · ${Number(d.quantidade).toLocaleString("pt-BR")} x R$ ${centParaReais(d.valor_unitario_cent)}`
          : ""}
        {d.descricao ? ` · ${d.descricao}` : ""}
      </div>

      {d.alertas?.map((a, i) => (
        <div key={i} style={{ fontSize: 11, color: "#C9A227", marginTop: 5 }}>{a.mensagem}</div>
      ))}
      {glosada && d.glosa_motivo && (
        <div style={{ fontSize: 11, color: "#B4552F", marginTop: 5 }}>Glosado: {d.glosa_motivo}</div>
      )}
      {d.status === "aprovado" && (
        <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 5, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Aprovado
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
        {d.anexo_url && (
          <a href={d.anexo_url} target="_blank" rel="noreferrer" style={acaoMini(t)}>Ver comprovante</a>
        )}
        {podeEditar && (
          <>
            <button style={acaoMini(t)} onClick={() => fileRef.current?.click()} disabled={subindo}>
              {subindo ? "Enviando…" : d.anexo_url ? "Trocar foto" : "Foto do comprovante"}
            </button>
            {/* capture=environment abre a câmera traseira direto no celular */}
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              onChange={anexar} style={{ display: "none" }} />
            <button style={acaoMini(t)} onClick={onEditar}>Editar</button>
            <button style={acaoMini(t)} onClick={onApagar}>Apagar</button>
          </>
        )}
        {podeDecidir && (
          <>
            <button style={acaoMini(t)} onClick={() => decidir("aprovado")}>Aprovar</button>
            <button style={acaoMini(t)} onClick={() => decidir("glosado")}>Glosar</button>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Formulário da despesa
// ═══════════════════════════════════════════════════════════════════

function FormDespesa({ t, lid, despesa, memoria, onFechar, onSalvo }: {
  t: any; lid: string; despesa: CustoDespesa | null; memoria: CustoMemoria | null;
  onFechar: () => void; onSalvo: () => void;
}) {
  const [sub, setSub] = useState(despesa?.subcategoria || "");
  const [data, setData] = useState(despesa?.data || hoje());
  const [qtd, setQtd] = useState(despesa ? String(despesa.quantidade) : "1");
  const [valor, setValor] = useState(despesa ? centParaReais(despesa.valor_unitario_cent) : "");
  const [descricao, setDescricao] = useState(despesa?.descricao || "");
  const [campos, setCampos] = useState<Record<string, string>>(() => {
    const c: Record<string, string> = {};
    Object.entries(despesa?.campos || {}).forEach(([k, v]) => {
      c[k] = k.endsWith("_cent") ? centParaReais(Number(v)) : String(v ?? "");
    });
    return c;
  });
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const def = sub ? SUBCAT[sub] : null;

  // Escolher o tipo numa despesa NOVA aplica a memória (km da obra, hotel,
  // consumo do carro, preço do litro). Edição nunca: os campos são os da
  // despesa que já existe.
  function escolherSub(k: string) {
    setSub(k);
    if (despesa) return;
    const m = aplicarMemoria(k, memoria);
    setQtd(m.qtd);
    setValor(m.valor);
    setCampos(m.campos);
    if (m.descricao && !descricao) setDescricao(m.descricao);
  }

  // Aviso de que os campos vieram pré-preenchidos do último lançamento
  const temMemoria = !!(!despesa && sub && memoria?.sugestoes?.[sub]);

  async function salvar() {
    if (!def) { setErro("Escolha o tipo da despesa."); return; }
    setSalvando(true);
    setErro("");
    try {
      // Campos com sufixo _cent saem em centavos; o resto vai como número ou
      // texto cru. Quem interpreta é o backend.
      const payloadCampos: Record<string, any> = {};
      (def.campos || []).forEach(c => {
        const v = campos[c.k];
        if (v === undefined || v === "") return;
        payloadCampos[c.k] = c.tipo === "dinheiro" ? reaisParaCent(v)
          : c.tipo === "numero" ? num(v)
          : v;
      });
      const body = {
        subcategoria: sub,
        data: data || null,
        descricao: descricao || null,
        quantidade: def.qtd ? num(qtd) : 1,
        valor_unitario_cent: def.valor ? reaisParaCent(valor) : 0,
        campos: payloadCampos,
      };
      const salva = despesa
        ? await api.custosDespesaPatch(despesa.id, body)
        : await api.custosDespesaNova(lid, body);
      if (foto) await api.custosDespesaAnexo(salva.id, await comprimirImagem(foto));
      onSalvo();
    } catch (e: any) {
      setErro(String(e?.message || e));
      setSalvando(false);
    }
  }

  return (
    <Folha titulo={despesa ? "Editar despesa" : "Nova despesa"} t={t} onFechar={onFechar}>
      {erro && <Aviso tom="erro" t={t}>{erro}</Aviso>}

      {!sub && GRUPOS.map(g => (
        <div key={g.grupo} style={{ marginBottom: 14 }}>
          <Rotulo t={t}>{g.grupo}</Rotulo>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {g.itens.map(i => (
              <button key={i.k} onClick={() => escolherSub(i.k)} style={{
                background: t.card1, border: `1px solid ${t.border1}`, color: t.textPrimary,
                padding: "13px 10px", fontSize: 12, cursor: "pointer", textAlign: "left",
                fontFamily: fonts.inter, minHeight: 46,
              }}>
                {i.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {def && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 14, color: t.textPrimary }}>{def.label}</span>
            {!despesa && (
              <button style={acaoMini(t)} onClick={() => setSub("")}>Trocar tipo</button>
            )}
          </div>
          {def.ajuda && (
            <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>{def.ajuda}</div>
          )}

          {temMemoria && (
            <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>
              Pré-preenchido com o último lançamento. Confira e ajuste se mudou.
            </div>
          )}

          <Rotulo t={t}>Data</Rotulo>
          <Campo t={t} tipo="date" valor={data} onChange={setData} />

          {(def.campos || []).map(c => (
            <div key={c.k}>
              <Rotulo t={t}>{c.label}</Rotulo>
              {c.tipo === "opcoes" ? (
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {c.opcoes!.map(o => (
                    <Chip key={o.v} ativo={campos[c.k] === o.v} t={t}
                      onClick={() => setCampos({ ...campos, [c.k]: o.v })}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              ) : (
                <Campo t={t}
                  tipo={c.tipo === "data" ? "date" : "text"}
                  modo={c.tipo === "numero" || c.tipo === "dinheiro" ? "decimal" : undefined}
                  prefixo={c.tipo === "dinheiro" ? "R$" : undefined}
                  placeholder={c.dica}
                  valor={campos[c.k] || ""}
                  onChange={v => setCampos({ ...campos, [c.k]: v })} />
              )}
            </div>
          ))}

          {def.qtd && (
            <>
              <Rotulo t={t}>{def.qtd}</Rotulo>
              <Campo t={t} valor={qtd} onChange={setQtd} modo="decimal" />
            </>
          )}

          {def.valor && (
            <>
              <Rotulo t={t}>{def.valor}</Rotulo>
              <Campo t={t} valor={valor} onChange={setValor} modo="decimal" prefixo="R$" placeholder="0,00" />
            </>
          )}

          <Rotulo t={t}>Observação</Rotulo>
          <Campo t={t} valor={descricao} onChange={setDescricao} placeholder="Opcional" />

          {!despesa && (
            <>
              <Rotulo t={t}>Comprovante</Rotulo>
              <button style={{
                width: "100%", background: t.inputBg, border: `1px solid ${t.border1}`,
                color: foto ? t.textPrimary : t.textSecondary, padding: "13px 12px",
                fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: fonts.inter,
                marginBottom: 12, minHeight: 46,
              }} onClick={() => fileRef.current?.click()}>
                {foto ? foto.name : "Tirar foto do comprovante"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment"
                onChange={e => { setFoto(e.target.files?.[0] || null); e.target.value = ""; }}
                style={{ display: "none" }} />
            </>
          )}

          <div style={{ height: 8 }} />
          <Botao primario t={t} onClick={salvar} desabilitado={salvando}>
            {salvando ? "Salvando…" : "Salvar despesa"}
          </Botao>
        </>
      )}
    </Folha>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Peças de interface
// ═══════════════════════════════════════════════════════════════════

function Cabecalho({ titulo, sub, t }: { titulo: string; sub: string; t: any }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 15, letterSpacing: "0.18em", color: t.textPrimary, textTransform: "uppercase" }}>
        {titulo}
      </div>
      <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function Voltar({ t, onClick }: { t: any; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: "none", color: t.textSecondary,
      fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
      cursor: "pointer", padding: "6px 0", fontFamily: fonts.inter,
    }}>
      Voltar
    </button>
  );
}

function Selo({ status, t }: { status: CustoStatus; t: any }) {
  const cor = status === "pago" ? "#5E8A5E"
    : status === "aprovado" ? "#6E8FA8"
    : status === "devolvido" ? "#B4552F"
    : status === "rascunho" ? t.textTertiary
    : t.accent;
  return (
    <span style={{
      fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
      color: cor, border: `1px solid ${cor}`, padding: "3px 7px", whiteSpace: "nowrap",
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function Numero({ t, rotulo, valor, destaque }: { t: any; rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div style={{ background: t.statBg, padding: "11px 12px" }}>
      <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: t.textTertiary }}>{rotulo}</div>
      <div style={{ fontSize: destaque ? 17 : 15, fontWeight: 600, marginTop: 4, color: destaque ? t.accent : t.textPrimary }}>
        R$ {centParaReais(valor)}
      </div>
    </div>
  );
}

function Chip({ ativo, onClick, children, t }: { ativo: boolean; onClick: () => void; children: any; t: any }) {
  return (
    <button onClick={onClick} style={{
      background: ativo ? t.card2 : "transparent",
      border: `1px solid ${ativo ? t.accent : t.border1}`,
      color: ativo ? t.textPrimary : t.textSecondary,
      padding: "8px 12px", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
      cursor: "pointer", whiteSpace: "nowrap", fontFamily: fonts.inter,
    }}>
      {children}
    </button>
  );
}

function Botao({ t, children, onClick, primario, desabilitado }: {
  t: any; children: any; onClick: () => void; primario?: boolean; desabilitado?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={desabilitado} style={{
      flex: 1, minWidth: 150, minHeight: 46,
      background: primario ? t.accent : "transparent",
      border: `1px solid ${primario ? t.accent : t.border2}`,
      color: primario ? "#0B0B0B" : t.textPrimary,
      fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
      cursor: desabilitado ? "default" : "pointer", opacity: desabilitado ? 0.5 : 1,
      padding: "12px 14px", fontFamily: fonts.inter,
    }}>
      {children}
    </button>
  );
}

function Rotulo({ t, children }: { t: any; children: any }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
      color: t.textTertiary, margin: "12px 0 6px",
    }}>
      {children}
    </div>
  );
}

function Campo({ t, valor, onChange, placeholder, tipo, modo, prefixo }: {
  t: any; valor: string; onChange: (v: string) => void;
  placeholder?: string; tipo?: string; modo?: "decimal"; prefixo?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: `1px solid ${t.border1}`, background: t.inputBg, marginBottom: 12 }}>
      {prefixo && (
        <span style={{ padding: "0 0 0 12px", fontSize: 12, color: t.textTertiary }}>{prefixo}</span>
      )}
      <input
        type={tipo || "text"}
        inputMode={modo}
        value={valor}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          flex: 1, background: "transparent", border: "none", outline: "none",
          color: t.textPrimary, fontSize: 14, padding: "13px 12px",
          fontFamily: fonts.inter, minHeight: 20, width: "100%",
        }}
      />
    </div>
  );
}

function Opcoes({ t, children }: { t: any; children: any }) {
  return (
    <div style={{ border: `1px solid ${t.border1}`, maxHeight: 240, overflowY: "auto", marginBottom: 12 }}>
      {children}
    </div>
  );
}

function OpcaoLinha({ t, titulo, sub, marca, onClick }: {
  t: any; titulo: string; sub?: string; marca?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left", cursor: "pointer",
      background: "transparent", border: "none", borderBottom: `1px solid ${t.border1}`,
      padding: "12px", color: t.textPrimary, fontFamily: fonts.inter,
    }}>
      <div style={{ fontSize: 13 }}>{titulo}</div>
      {sub && <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>{sub}</div>}
      {marca && <div style={{ fontSize: 10, color: "#C9A227", marginTop: 3 }}>{marca}</div>}
    </button>
  );
}

function Escolhido({ t, texto, onTrocar, acao }: { t: any; texto: string; onTrocar: () => void; acao?: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
      border: `1px solid ${t.border2}`, background: t.card1, padding: "12px", marginBottom: 12,
    }}>
      <span style={{ fontSize: 13, color: t.textPrimary }}>{texto}</span>
      <button style={acaoMini(t)} onClick={onTrocar}>{acao || "Trocar"}</button>
    </div>
  );
}

function Aviso({ t, tom, children }: { t: any; tom: "erro" | "atencao"; children: any }) {
  const cor = tom === "erro" ? "#B4552F" : "#C9A227";
  return (
    <div style={{
      border: `1px solid ${cor}`, color: cor, padding: "10px 12px",
      fontSize: 12, lineHeight: 1.5, margin: "10px 0",
    }}>
      {children}
    </div>
  );
}

function Vazio({ t, children }: { t: any; children: any }) {
  return (
    <div style={{ padding: "30px 10px", textAlign: "center", color: t.textTertiary, fontSize: 12, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

/** Painel que sobe da base no celular e vira caixa centrada no desktop. */
function Folha({ t, titulo, onFechar, children }: {
  t: any; titulo: string; onFechar: () => void; children: any;
}) {
  // No celular sobe da base (bottom sheet); em tela larga centraliza de fato.
  const desktop = window.matchMedia("(min-width: 640px)").matches;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60, background: t.overlay,
      display: "flex", alignItems: desktop ? "center" : "flex-end", justifyContent: "center",
      padding: desktop ? 20 : 0,
    }} onClick={onFechar}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.modalBg, border: `1px solid ${t.border1}`,
        width: "100%", maxWidth: 560, maxHeight: "92%", overflowY: "auto",
        padding: "16px 14px 24px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.18em", color: t.textPrimary, textTransform: "uppercase" }}>
            {titulo}
          </span>
          <button onClick={onFechar} style={acaoMini(t)}>Fechar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function acaoMini(t: any): React.CSSProperties {
  return {
    background: "transparent", border: `1px solid ${t.border1}`, color: t.textSecondary,
    padding: "7px 10px", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
    cursor: "pointer", textDecoration: "none", fontFamily: fonts.inter, display: "inline-block",
  };
}
