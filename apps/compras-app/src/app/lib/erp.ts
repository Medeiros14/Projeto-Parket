/** Helpers compartilhados do módulo ERP (estoque / financeiro / relatórios). */
import { sb } from "./supabase";

export const fmtBRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtQtd = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export const fmtData = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const hojeISO = () => new Date().toISOString().slice(0, 10);

export type Movimento = {
  id: string;
  data: string;
  produto_codigo: string | null;
  descricao: string;
  tipo: "Entrada" | "Saída";
  quantidade: number;
  unidade: string | null;
  valor_unitario: number;
  valor_total: number;
  documento: string | null;
  fornecedor: string | null;
  projeto: string | null;
  deposito: "marcenaria" | "instalacao" | "marcenaria-curitiba";
  created_at: string;
};

export type Produto = { id: string; codigo: string; descricao: string; unidade: string | null; ativo: boolean; categoria?: "MATERIA_PRIMA" | "FERRAGEM" | "EMBALAGEM" | null; apelidos?: string[] | null };

/** Acha produto pelo nome popular OU por qualquer apelido (nome que vem na NF). */
export function findProdutoPorNome(nome: string, cache: Produto[]): Produto | undefined {
  const n = nome.trim().toUpperCase();
  if (!n) return undefined;
  return cache.find((p) =>
    p.descricao.trim().toUpperCase() === n ||
    (p.apelidos || []).some((a) => a.trim().toUpperCase() === n));
}

/** Mesma regra do compras-contratos-watcher (tipo_insumo): fallback por palavra-chave. */
const KW_FERRAGEM = ["PIVÔ", "PIVO", "FECHADURA", "PUXADOR", "IMÃ", "IMA ", "TRANQUETA",
  "ADAPTADOR", "DOBRADIÇA", "DOBRADICA", "ROLDANA", "KIT ",
  "PARAFUSO", "PORCA", "ARRUELA", "BUCHA", "PREGO", "REBITE", "CANTONEIRA",
  "CORREDIÇA", "CORREDICA", "TRILHO", "RODÍZIO", "RODIZIO", "FECHO", "CREMONA",
  "AMORTECEDOR", "PISTÃO", "PISTAO", "SUPORTE", "GANCHO", "MOLA ", "DIVISÓRIA MET"];
const KW_EMBALAGEM = ["CAIXA", "CAIXAS", "PAPELÃO", "PAPELAO", "SACO ", "SACOS", "SACOLA",
  "PLÁSTICO BOLHA", "PLASTICO BOLHA", "BOLHA", "FILME STRETCH", "STRETCH", "FILM ",
  "FITA ADESIVA", "FITA CREPE", "FITA EMBAL", "ETIQUETA", "LACRE", "PALLET",
  "PALETE", "STRAP", "STROP", "TIRA PLASTICA", "EMBALAGEM"];
export function categoriaInsumo(descricao: string): "MATERIA_PRIMA" | "FERRAGEM" | "EMBALAGEM" {
  const up = (descricao || "").trim().toUpperCase();
  if (KW_EMBALAGEM.some((k) => up.includes(k))) return "EMBALAGEM";
  if (KW_FERRAGEM.some((k) => up.includes(k))) return "FERRAGEM";
  return "MATERIA_PRIMA";
}

/** Classificação fiscal pelo NCM do item da NF-e (mais confiável que palavra-chave).
 *  Cap. 73/82/83 (metais, ferramentas, fechaduras/guarnições) = FERRAGEM;
 *  Cap. 48 (papel/papelão em geral — muitas caixas) — só marcamos EMBALAGEM quando cai também no filtro por palavra-chave;
 *  Cap. 44/32/34/35/39/40/48/68 (madeira, vernizes, ceras, colas, plásticos, borracha, papel, abrasivos) = MATÉRIA PRIMA. */
export function categoriaPorNcm(ncm: string): "MATERIA_PRIMA" | "FERRAGEM" | "EMBALAGEM" | null {
  const n = (ncm || "").replace(/\D/g, "");
  if (n.length < 2) return null;
  const cap = n.slice(0, 2);
  if (["73", "82", "83"].includes(cap)) return "FERRAGEM";
  if (["44", "32", "34", "35", "39", "40", "48", "68"].includes(cap)) return "MATERIA_PRIMA";
  return null;
}

export async function fetchProdutos(): Promise<Produto[]> {
  const { data } = await sb.from("compras_produtos").select("*").eq("ativo", true).order("descricao");
  return (data as unknown as Produto[]) || [];
}

/** Garante produto cadastrado (match por descrição exata, case-insensitive) e retorna o código PRD-xxxx.
 *  `categoriaOverride` sobrescreve a classificação automática (usar quando o usuário escolheu na UI). */
export async function ensureProduto(
  descricao: string, unidade: string, cache: Produto[],
  categoriaOverride?: "MATERIA_PRIMA" | "FERRAGEM" | "EMBALAGEM" | null
): Promise<string> {
  const desc = descricao.trim().toUpperCase();
  const hit = findProdutoPorNome(desc, cache);
  if (hit) return hit.codigo;

  const { data: max } = await sb
    .from("compras_produtos").select("codigo")
    .like("codigo", "PRD-%").order("codigo", { ascending: false }).limit(1);
  const ultimo = (max as any[])?.[0]?.codigo ? parseInt(String((max as any[])[0].codigo).replace("PRD-", ""), 10) || 0 : 0;
  const codigo = `PRD-${String(ultimo + 1).padStart(4, "0")}`;

  const { data: novo, error } = await sb
    .from("compras_produtos")
    .insert({ codigo, descricao: desc, unidade: unidade || "UN", ativo: true,
              categoria: categoriaOverride || categoriaInsumo(desc) })
    .select().single();
  if (error) {
    // corrida: outro usuário criou o mesmo código — tenta achar por descrição
    const { data: retry } = await sb.from("compras_produtos").select("*").ilike("descricao", desc).limit(1);
    if (retry?.[0]) { cache.push(retry[0] as unknown as Produto); return (retry[0] as any).codigo; }
    throw new Error("Falha ao cadastrar produto: " + error.message);
  }
  cache.push(novo as unknown as Produto);
  return codigo;
}

/** Lista de projetos pra datalist: banco de obras + distintos dos movimentos + cards de compras. */
export async function fetchProjetos(): Promise<string[]> {
  const set = new Set<string>();
  const { data: obras } = await sb.from("obras").select("cliente").not("cliente", "is", null).limit(2000);
  (obras || []).forEach((r: any) => r.cliente && set.add(r.cliente));
  const { data: movs } = await sb.from("compras_estoque_mov").select("projeto").not("projeto", "is", null).limit(1000);
  (movs || []).forEach((r: any) => r.projeto && set.add(r.projeto));
  const { data: cards } = await sb
    .from("kanban_cards").select("details")
    .in("dept_id", ["compras", "compras-taiara", "compras-marco"]).limit(500);
  (cards || []).forEach((r: any) => {
    const p = r?.details?.projeto_nome;
    if (p && typeof p === "string") set.add(p);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Próximo protocolo de saída: SAI-000123 (sequencial global). */
export async function proximoProtocolo(): Promise<string> {
  const { data } = await sb
    .from("compras_saidas").select("protocolo")
    .like("protocolo", "SAI-%").order("protocolo", { ascending: false }).limit(1);
  const ultimo = (data as any[])?.[0]?.protocolo ? parseInt(String((data as any[])[0].protocolo).replace("SAI-", ""), 10) || 0 : 0;
  return `SAI-${String(ultimo + 1).padStart(6, "0")}`;
}

/** Próximo protocolo de entrada manual: ENT-000123 (sequencial global).
 *  compras_notas não tem coluna de protocolo, então a sequência é lida do próprio
 *  campo `documento` dos movimentos de entrada. */
export async function proximoProtocoloEntrada(): Promise<string> {
  const { data } = await sb
    .from("compras_estoque_mov").select("documento")
    .like("documento", "ENT-%").order("documento", { ascending: false }).limit(1);
  const ultimo = (data as any[])?.[0]?.documento ? parseInt(String((data as any[])[0].documento).replace("ENT-", ""), 10) || 0 : 0;
  return `ENT-${String(ultimo + 1).padStart(6, "0")}`;
}

/* ─── Folha de impressão Parket (protocolos e relatórios) ────────────────── */

const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Data + hora de um timestamp ISO: 24/02/2026 13:50 */
const fmtDataHora = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return fmtData(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** CSS único dos documentos impressos. Protocolo e relatórios usam a mesma
 *  identidade do sistema (src/styles/index.css, SO Parket): Preto Navona,
 *  Chai, Bege Travertino, Off White Mineral, Cinza Pedra + Cinzel/Inter. */
const FOLHA_CSS = `
  * { box-sizing: border-box; }
  @page { size: A4; margin: 14mm 15mm; }
  html, body { margin: 0; padding: 0; }
  /* Inter é a fonte de corpo do sistema; Cinzel só nos títulos e rótulos. */
  body { font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
         color: #2e2b27; font-size: 12px; }
  @media screen { body { padding: 14mm 15mm; background: #f3f0e8; } }
  .folha { display: flex; flex-direction: column; min-height: 268mm; background: #fff; }
  .corpo { flex: 1; }

  .topo { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2px solid #050505; padding-bottom: 12px; }
  /* Marca em Cinzel com tracking largo, igual ao cabeçalho do app. */
  .marca { font-family: 'Cinzel', Georgia, serif; font-size: 28px; font-weight: 600;
           letter-spacing: .16em; color: #050505; line-height: 1; }
  .slogan { font-size: 7.5px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase;
            color: #968473; margin-top: 7px; }
  .topo-dir { text-align: right; max-width: 58%; }
  .doc-titulo { font-family: 'Cinzel', Georgia, serif; font-size: 15px; font-weight: 600;
                letter-spacing: .08em; color: #050505; line-height: 1.25; }
  .doc-sub { font-size: 9px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase;
             color: #968473; margin-top: 5px; }
  .doc-num { font-size: 11px; font-weight: 600; color: #60544d; margin-top: 4px; letter-spacing: .1em; }

  .rot { font-size: 7.5px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #77736a; }
  .forte { font-size: 12px; font-weight: 600; color: #050505; margin-top: 3px; }
  .txt { font-size: 11px; color: #4a4640; margin-top: 2px; }

  .caixa { display: flex; border: 1px solid #c3beb4; margin-top: 16px; }
  .cx-emit { flex: 0 0 44%; padding: 11px 14px; }
  .cx-grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px;
             padding: 11px 14px; border-left: 1px solid #c3beb4; }

  .destino { background: #f3f0e8; border-left: 3px solid #050505; padding: 10px 14px; margin-top: 12px; }
  .destino .forte { font-size: 13px; }
  .destino .end { color: #77736a; }
  .natureza { font-size: 11px; color: #4a4640; margin: 14px 0 4px; }

  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  thead { display: table-header-group; }
  th { font-family: 'Cinzel', Georgia, serif; font-size: 8.5px; font-weight: 600; letter-spacing: .14em;
       text-transform: uppercase; color: #050505; text-align: left; padding: 7px 8px;
       border-bottom: 1.5px solid #050505; }
  td { font-size: 11px; padding: 8px; border-bottom: 1px solid #e4e0d7; vertical-align: top; }
  td.c, th.c { text-align: center; }
  td.r, th.r { text-align: right; }
  tr.total td, tr.tot td, td.tot { font-weight: 700; color: #050505; background: #f3f0e8; border-bottom: none; }
  td.vazio { color: #77736a; padding: 16px 8px; text-align: center; }

  h2 { font-family: 'Cinzel', Georgia, serif; font-size: 10px; font-weight: 600; letter-spacing: .14em;
       text-transform: uppercase; color: #050505; margin: 20px 0 4px; }
  p.meta, .meta { font-size: 10.5px; color: #77736a; margin: 14px 0 0; }
  .meta b { color: #4a4640; }

  .obs { background: #f3f0e8; border-left: 3px solid #968473; padding: 10px 14px; margin-top: 16px; }
  .obs .rot { color: #968473; }

  .fim { margin-top: auto; padding-top: 24px; }
  .assinaturas { display: flex; gap: 70px; page-break-inside: avoid; }
  .ass { flex: 1; text-align: center; }
  .ass .linha { border-top: 1px solid #77736a; margin: 0 22px 6px; }
  .ass-nome { font-size: 10.5px; font-weight: 600; letter-spacing: .06em; color: #050505; }
  .ass-nome.g { color: #968473; }
  .ass-campo { font-size: 9.5px; color: #77736a; margin-top: 5px; }
  .rodape { margin-top: 22px; border-top: 1px solid #e4e0d7; padding-top: 8px;
            font-size: 9px; letter-spacing: .06em; color: #77736a; text-align: center; }
`;

type Folha = {
  janelaTitulo: string;
  topoTitulo: string;
  topoSub?: string;
  topoNumero?: string;
  corpo: string;
  /** Bloco fixo no pé da última página (assinaturas do protocolo). */
  fim?: string;
  rodape: string;
};

/** Abre a janela de impressão já montada na folha padrão Parket. */
function abrirFolha(f: Folha) {
  const w = window.open("", "_blank", "width=940,height=780");
  if (!w) { alert("Popup bloqueado, libere popups para imprimir."); return; }
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>${esc(f.janelaTitulo)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${FOLHA_CSS}</style></head><body>
  <div class="folha">
    <div class="corpo">
      <div class="topo">
        <div>
          <div class="marca">PARKET</div>
          <div class="slogan">Excelência em pisos e acabamentos</div>
        </div>
        <div class="topo-dir">
          <div class="doc-titulo">${esc(f.topoTitulo)}</div>
          ${f.topoSub ? `<div class="doc-sub">${esc(f.topoSub)}</div>` : ""}
          ${f.topoNumero ? `<div class="doc-num">${esc(f.topoNumero)}</div>` : ""}
        </div>
      </div>
      ${f.corpo}
    </div>
    <div class="fim">
      ${f.fim || ""}
      <div class="rodape">${esc(f.rodape)}</div>
    </div>
  </div>
  <script>window.onload = () => {
    /* Espera as fontes do sistema (Cinzel/Inter) para não imprimir no fallback. */
    const go = () => window.print();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go).catch(go); else go();
  };<\/script>
  </body></html>`);
  w.document.close();
}

/* ─── Protocolo de movimentação de material (modelo oficial Parket) ──────── */

export type ProtocoloItem = { descricao: string; unidade: string; quantidade: number };

export type ProtocoloDoc = {
  tipo: "entrada" | "saida";
  /** Número do documento: SAI-000123, ENT-000045 ou NF 265873. */
  numero: string;
  /** Linha dourada abaixo do título: "Saída por Digitação", "Entrada por NF-e"… */
  subtitulo: string;
  dataEmissao: string;                 // ISO (yyyy-mm-dd)
  dataEstoque?: string | null;         // ISO/timestamp do lançamento no estoque
  deposito: string;                    // almoxarifado de origem/destino
  centroCusto: string;                 // projeto / obra / setor
  destinoLabel: string;                // "Cliente destino" ou "Fornecedor / origem"
  destinoNome: string;
  destinoEndereco?: string | null;
  natureza: string;                    // "Saída de material" / "Entrada de material"
  observacoes?: string | null;
  itens: ProtocoloItem[];
  /** Rótulos das duas assinaturas do rodapé. */
  assinaturas?: [string, string];
};

/** Corpo do protocolo: caixa de emitente/datas, destino, natureza, itens e observações. */
function protocoloCorpo(d: ProtocoloDoc): string {
  const totalGeral = d.itens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0);

  const linhas = d.itens.map((i, ix) => `
    <tr>
      <td class="c">${ix + 1}</td>
      <td>${esc(i.descricao)}</td>
      <td class="c">${esc(i.unidade || "UN")}</td>
      <td class="r">${fmtQtd(i.quantidade)}</td>
    </tr>`).join("");

  return `
  <div class="caixa">
    <div class="cx-emit">
      <div class="rot">Unidade / Emitente</div>
      <div class="forte">PARKET</div>
      <div class="txt">Rua Lopes Chaves, 62 - Barra Funda</div>
      <div class="txt">São Paulo - SP</div>
    </div>
    <div class="cx-grid">
      <div><div class="rot">Data emissão</div><div class="txt">${fmtData(d.dataEmissao)}</div></div>
      <div><div class="rot">Data estoque</div><div class="txt">${d.dataEstoque ? fmtDataHora(d.dataEstoque) : fmtData(d.dataEmissao)}</div></div>
      <div><div class="rot">Depósito</div><div class="txt">${esc(d.deposito)}</div></div>
      <div><div class="rot">Centro de custo</div><div class="txt">${esc(d.centroCusto)}</div></div>
    </div>
  </div>

  <div class="destino">
    <div class="rot">${esc(d.destinoLabel)}</div>
    <div class="forte">${esc(d.destinoNome)}</div>
    ${d.destinoEndereco ? `<div class="txt end">${esc(d.destinoEndereco)}</div>` : ""}
  </div>

  <div class="natureza"><b>Natureza de Operação:</b> ${esc(d.natureza)}</div>

  <table>
    <thead><tr>
      <th class="c" style="width:44px">Item</th>
      <th>Produto / Descrição</th>
      <th class="c" style="width:64px">Und</th>
      <th class="r" style="width:104px">Quantidade</th>
    </tr></thead>
    <tbody>
      ${linhas || `<tr><td colspan="4" class="vazio">Nenhum item neste documento.</td></tr>`}
      <tr class="total"><td colspan="3" class="r">TOTAL GERAL DE ITENS:</td><td class="r">${fmtQtd(totalGeral)}</td></tr>
    </tbody>
  </table>

  ${d.observacoes ? `<div class="obs"><div class="rot">Observações</div><div class="txt">${esc(d.observacoes)}</div></div>` : ""}`;
}

/** As duas assinaturas, ancoradas no pé da última página. */
function protocoloAssinaturas(d: ProtocoloDoc): string {
  const [assA, assB] = d.assinaturas
    || (d.tipo === "entrada" ? ["Assinatura Conferente", "Autorizado / Almoxarifado"] : ["Assinatura Recebedor", "Autorizado / Expedição"]);
  const campo = `<div class="ass-campo">Data: ____/____/________&nbsp;&nbsp;&nbsp;&nbsp;Hora: ____:____</div>`;
  return `
  <div class="assinaturas">
    <div class="ass"><div class="linha"></div><div class="ass-nome">${esc(assA)}</div>${campo}</div>
    <div class="ass"><div class="linha"></div><div class="ass-nome g">${esc(assB)}</div>${campo}</div>
  </div>`;
}

/** Abre a janela de impressão do protocolo no modelo oficial. */
export function printProtocolo(d: ProtocoloDoc) {
  const titulo = d.tipo === "entrada" ? "PROTOCOLO DE ENTRADA" : "PROTOCOLO DE SAÍDA";
  const nomeDoc = d.tipo === "entrada" ? "Protocolo de Entrada de Material" : "Protocolo de Saída de Material";
  abrirFolha({
    janelaTitulo: d.numero,
    topoTitulo: titulo,
    topoSub: d.subtitulo,
    topoNumero: d.numero,
    corpo: protocoloCorpo(d),
    fim: protocoloAssinaturas(d),
    rodape: `PARKET · ${nomeDoc} gerado em ${fmtData(d.dataEmissao)}. Documento confere com o estoque.`,
  });
}

/** Relatórios internos: mesma folha do protocolo, sem bloco de assinatura.
 *  Título com " · " vira título + subtítulo dourado (ex.: "Relatório de Saídas · Almoxarifados"). */
export function printHtml(titulo: string, corpoHtml: string) {
  const [principal, ...resto] = titulo.split(" · ");
  abrirFolha({
    janelaTitulo: titulo,
    topoTitulo: principal.toUpperCase(),
    topoSub: resto.join(" · ") || "Relatório interno",
    corpo: corpoHtml,
    rodape: `PARKET · ${principal} gerado em ${fmtDataHora(new Date().toISOString())}.`,
  });
}
