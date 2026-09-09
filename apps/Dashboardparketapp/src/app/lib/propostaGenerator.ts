/* ═══ Gerador de Proposta — replica fiel ao layout Brascomm x Parket ═══ */

export interface PropostaSimulacao {
  id?: string;
  numero: string;
  cliente: string;
  cnpj_cpf: string;
  endereco: string;
  obra_code: string;
  obra_id?: string;
  vendedor: string;
  validade_dias: number;
  desconto_perc: number;
  created_at: string;
  arquiteto?: string;
  forma_pagamento?: string;
  orcamentista?: string;
  contato_nome?: string;
  contato_telefone?: string;
  contato_email?: string;
  vendedor_telefone?: string;
  vendedor_email?: string;
  pag_garantia?: string;
  pag_prazo_entrega?: string;
  pag_prazo_execucao?: string;
  pag_dados_bancarios?: string;
  pag_razao_social?: string;
  composicao_faturamento?: string;
  consideracoes?: string;
  anexos?: string;
  remetente_nome?: string;
  remetente_email?: string;
  remetente_telefone?: string;
}

export interface PropostaItem {
  id: string;
  categoria: string;
  descritivo: string;
  valor: number;
  ordem: number;
}

function fmt(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataFormatada(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  }
}

/** Detect if a line contains the · separator used in category-encoded descriptions */
function hasDotSeparator(line: string): boolean {
  return /\s·\s/.test(line) || /·/.test(line);
}

/** Extract the second segment after · (the product/species label) */
function extractDotLabel(line: string): string {
  const parts = line.split("·").map(s => s.trim()).filter(Boolean);
  return parts.length >= 2
    ? parts[1].toUpperCase()
    : (parts[0]?.toUpperCase() || "");
}

/** Dedupe consecutive duplicate words (case-insensitive) */
function dedupeWords(s: string): string {
  return s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
    .filter((v, i, a) => i === 0 || v.toUpperCase() !== a[i - 1].toUpperCase())
    .join(" ");
}

/**
 * Limpa o label de produto pra exibição na proposta (port do PGSTRUCT11).
 * Fix Williams Soares: NÃO remove prefixo RIPADO/MUXARABI/etc se categoria for FORRO
 * (esses são tipos válidos de forro). Em outras categorias, são qualificadores
 * que poluem o label e devem ser removidos.
 *
 * Regras:
 *  - PORTA: remove códigos (DN150, RO82TOP, CIR, GERIS, ITALY LINE, 3D) e
 *    qualifiers (ASSOALHO|LACA|LAMINA|MOLDURA VIDRO|MUXARABI|RIPADO|TOBLERONE)
 *    SÓ quando seguidos de mais texto.
 *  - MARCENARIA: split em `|`, uppercase cada parte, join com ` / `.
 *  - FORRO: mantém o label como está (depois de _ → espaço).
 *  - Demais: strip prefixos (ASSOALHO|LÂMINA|MACIÇO|RIPADO|TOBLERONE|
 *    MUXARABI|MOLDURA VIDRO|LACA|RÉGUAS?).
 */
function cleanProductLabel(name: string, category: string): string {
  const cat = (category || "").toUpperCase();
  let t = (name || "").replace(/_/g, " ");

  if (cat === "PORTA") {
    return dedupeWords(
      t
        .replace(/\b(?:DN150|RO82TOP|CIR|GERIS|ITALY\s+LINE|3D)\b/gi, " ")
        .replace(/\b(ASSOALHO|LACA|LAMINA|MOLDURA[_ ]VIDRO|MUXARABI|RIPADO|TOBLERONE)\b\s+(?=\S)/gi, " ")
    ).replace(/_/g, " ");
  }

  if (cat !== "FORRO") {
    t = t.replace(/^\s*(ASSOALHO|L[AÂ]MINA|MACI[ÇC]O|RIPADO|TOBLERONE|MUXARABI|MOLDURA[_ ]VIDRO|LACA|R[ÉE]GUAS?)\s+/i, "");
  }

  if (cat === "MARCENARIA") {
    return t.split(/\s*\|\s*/).map(s => s.trim().toUpperCase()).filter(Boolean).join(" / ");
  }

  return dedupeWords(t);
}

/** Sort priority: insumos first (1), instalação second (2), everything else (0) */
function installSortKey(descritivo: string): number {
  const upper = (descritivo || "").toUpperCase();
  if (upper.startsWith("INSUMOS DE") || upper.includes("\nINSUMOS DE") || /^INSUMOS\b/.test(upper)) return 1;
  if (upper.startsWith("INSTALAÇÃO") || upper.includes("INSTALAÇÃO E GEST")) return 2;
  return 0;
}

export function gerarPropostaHTML(sim: PropostaSimulacao, itens: PropostaItem[]): string {
  // Group items by categoria
  const gruposBrutos = itens.reduce<Record<string, PropostaItem[]>>((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = [];
    acc[item.categoria].push(item);
    return acc;
  }, {});

  const hoje = dataFormatada(sim.created_at || new Date().toISOString());
  const numero = (sim.numero && String(sim.numero).trim()) || String(Date.now()).slice(-4);
  const cliente = sim.cliente || "—";
  const cnpj = sim.cnpj_cpf || "—";
  const endereco = sim.endereco || "—";
  const vendedor = sim.vendedor || "—";
  const orcamentista = sim.orcamentista || "";
  const contatoNome = sim.contato_nome || "";
  const contatoTelefone = sim.contato_telefone || "";
  const contatoEmail = sim.contato_email || "";
  const arquiteto = sim.arquiteto || "";
  const formaPagamento = sim.forma_pagamento || "A combinar";
  const contratante = arquiteto ? `${cliente} | ${arquiteto}` : cliente;
  const vendedorTelefone = sim.vendedor_telefone || "011 98675-0031";
  const vendedorEmail = sim.vendedor_email || "douglas@parket.com.br";

  // Multi-line address support
  const enderecoLinhas = endereco.split("\n").filter(Boolean);

  // Separate logistics, observations, and regular item categories
  let logisticaTotal = 0;
  let obsTexto = "";
  const grupos: Record<string, PropostaItem[]> = {};

  for (const cat of Object.keys(gruposBrutos)) {
    const upper = cat.toUpperCase();
    if (upper.includes("LOG") || upper === "TRANSPORTE") {
      logisticaTotal = gruposBrutos[cat].reduce((s, i) => s + i.valor, 0);
    } else if (upper.includes("OBS")) {
      obsTexto = gruposBrutos[cat].map(i => i.descritivo).join("; ");
    } else {
      grupos[cat] = gruposBrutos[cat];
    }
  }

  // Calculate totals (items only, without logistics in subtotal base)
  const totalItens = Object.values(grupos).flat().reduce((s, i) => s + i.valor, 0);
  const descontoValor = totalItens * (sim.desconto_perc / 100);
  const totalFinal = totalItens + logisticaTotal - descontoValor;

  // Auto-generate observation text if none provided
  if (!obsTexto) {
    const partes: string[] = ["Fornecimento e instalação"];
    for (const cat of Object.keys(grupos)) {
      const [catName, catSpec, catExtra] = cat.split("||");
      const catItens = grupos[cat];
      let areaTotal = 0;
      for (const item of catItens) {
        const upper = (item.descritivo || "").toUpperCase();
        if (upper.includes("INSUMOS") || upper.includes("INSTALAÇÃO")) continue;
        const match = (item.descritivo || "").match(/Metragem real ([0-9]+[.,]?[0-9]*)m²/i);
        if (match) areaTotal += parseFloat(match[1].replace(",", "."));
      }
      const specSuffix = catSpec ? (catExtra ? ` ${catSpec} ${catExtra}` : ` ${catSpec}`) : "";
      if (areaTotal > 0) {
        partes.push(`${areaTotal.toFixed(2)}m² - ${catName.toUpperCase()}${specSuffix}`);
      } else {
        partes.push(`${catName.toUpperCase()}${specSuffix}`);
      }
    }
    obsTexto = partes.join("\n");
  }

  // Build table rows
  let itemsRows = "";
  let catIndex = 1;

  for (const cat of Object.keys(grupos)) {
    // Sort: insumos -> instalação -> rest, then by ordem
    const catItens = [...grupos[cat]].sort((a, b) => {
      const ka = installSortKey(a.descritivo);
      const kb = installSortKey(b.descritivo);
      if (ka !== kb) return ka - kb;
      return a.ordem - b.ordem;
    });

    const subtotal = catItens.reduce((s, i) => s + i.valor, 0);
    const [catName, catSpec] = cat.split("||");
    const displayName = catName;

    // If no spec from ||, try to extract from item descriptions using · separator
    let displaySpec = catSpec || "";
    if (!displaySpec) {
      for (const item of catItens) {
        const line = (item.descritivo || "").split("\n").find(hasDotSeparator);
        if (line) {
          displaySpec = extractDotLabel(line);
          break;
        }
      }
    }

    // Category header row (PGSTRUCT11 port: cleanProductLabel preserva RIPADO/MUXARABI em FORRO)
    itemsRows += `<tr>
      <td class="cat-c">${displayName.toUpperCase()}</td>
      <td class="cat-l">${cleanProductLabel(displaySpec, displayName)}</td>
      <td class="cat-v"></td>
    </tr>`;

    // Item rows
    catItens.forEach((item, idx) => {
      // Filter out · separator lines and __RECDATA__ markers, replace underscores
      const lines = (item.descritivo || "").split("\n")
        .map(l => l.trim())
        .filter(Boolean)
        .filter(l => !hasDotSeparator(l) && !/^__RECDATA__:/.test(l))
        .map(l => l.replace(/[a-záéíóúç]+_[a-záéíóúç_]+/gi, w => w.replace(/_/g, " ")));

      let descHtml = "";
      if (lines.length > 1) {
        descHtml += `<p class="desc-title">${lines[0]}</p>`;
        descHtml += `<p class="desc-body">${lines.slice(1).join('</p><p class="desc-body">')}</p>`;
      } else if (lines.length === 1) {
        descHtml += `<p class="desc-title">${lines[0]}</p>`;
      } else {
        descHtml += `<p class="desc-title">${item.descritivo}</p>`;
      }

      itemsRows += `<tr>
        <td class="item-c">${catIndex}.${idx + 1}</td>
        <td class="item-l">${descHtml}</td>
        <td class="item-v">${fmt(item.valor)}</td>
      </tr>`;
    });

    // Subtotal row
    itemsRows += `<tr>
      <td class="sub-c"></td>
      <td class="sub-l">Valor parcial - ${displayName.toLowerCase()} </td>
      <td class="sub-v">${fmt(subtotal)}</td>
    </tr>`;

    catIndex++;
  }

  // Logistics row
  if (logisticaTotal > 0) {
    itemsRows += `<tr>
      <td class="log-c">LOGÍSTICA</td>
      <td class="log-l">TRANSPORTE, DESLOCAMENTO, HOSPEDAGEM, E ALIMENTAÇÃO DA EQUIPE</td>
      <td class="sub-v">${fmt(logisticaTotal)}</td>
    </tr>`;
  }

  // Observation row
  itemsRows += `<tr>
    <td class="obs-c">OBSERVAÇÃO</td>
    <td class="obs-l">${obsTexto.replace(/\n/g, "<br>")}</td>
    <td class="obs-v"></td>
  </tr>`;

  // Summary total row
  itemsRows += `<tr>
    <td class="total-c"></td>
    <td class="total-l">RESUMO TOTAL DOS PRODUTOS ORÇADOS</td>
    <td class="total-v">${fmt(totalItens)}</td>
  </tr>`;

  // Discount row
  if (sim.desconto_perc > 0) {
    itemsRows += `<tr>
      <td class="disc-c"></td>
      <td class="disc-l">&nbsp;DESCONTO CONCEDIDO (${sim.desconto_perc.toFixed(1)}%)</td>
      <td class="disc-v">-${fmt(descontoValor)}</td>
    </tr>`;
  }

  // Final total row
  itemsRows += `<tr class="ftotal-row">
    <td class="ftotal-c">TOTAL</td>
    <td class="ftotal-l"></td>
    <td class="ftotal-v">${fmt(totalFinal)}</td>
  </tr>`;

  // Configurable conditions
  const garantia = sim.pag_garantia || "10 anos";
  const prazoEntrega = sim.pag_prazo_entrega || "120 dias após a contratação";
  const prazoExecucao = sim.pag_prazo_execucao || "120 dias após a entrega do material";
  const dadosBancarios = sim.pag_dados_bancarios || "Banco Itaú | Agencia 3720 CC 30.288-8 | PIX: pamella@parket.com.br";
  const razaoSocial = sim.pag_razao_social || "Mundial Export Assess. Com. e Ext. Imp e Exp Eireli | CNPJ 29.872.616/0001-34";

  // Conditions row
  itemsRows += `<tr>
    <td class="cond-c">CONDIÇÕES</td>
    <td class="cond-l">
      <p><b>Condições de pagamento: </b>${formaPagamento}</p>
      <p><b>Garantia: </b>${garantia}</p>
      <p><b>Prazo de entrega: </b>${prazoEntrega}</p>
      <p><b>Prazo de execução: </b>${prazoExecucao}</p>
      <p><b>Dados bancários: </b>${dadosBancarios}</p>
      <p>${razaoSocial}</p>
    </td>
    <td class="cond-v"></td>
  </tr>`;

  // Extra page (composicao_faturamento, consideracoes, anexos, remetente)
  let extraPage = "";
  if (sim.composicao_faturamento || sim.consideracoes) {
    extraPage += `
  <div class="pagemargins" style="page-break-before:always;">
  <div class="page-content">
    <div class="page-header-right">${contratante}, ID: ${numero}</div>`;

    if (sim.composicao_faturamento) {
      extraPage += `
    <div class="extra-section">
      <p class="extra-title">Composição de Faturamento:</p>
      <div class="extra-body">${sim.composicao_faturamento.replace(/\n/g, "<br>")}</div>
    </div>`;
    }

    if (sim.consideracoes) {
      extraPage += `
    <div class="extra-section">
      <p class="extra-title"><b>CONSIDERAÇÕES:</b></p>
      <div class="extra-body">${sim.consideracoes.replace(/\n/g, "<br>")}</div>
    </div>`;
    }

    if (sim.anexos) {
      extraPage += `
    <div class="extra-section">
      <p class="extra-title"><b>ANEXOS:</b></p>
      <div class="extra-body">${sim.anexos.replace(/\n/g, "<br>")}</div>
    </div>`;
    }

    const rNome = sim.remetente_nome || "";
    const rEmail = sim.remetente_email || "";
    const rTelefone = sim.remetente_telefone || "";
    if (rNome) {
      extraPage += `
    <div class="extra-closing">
      <p>Atenciosamente,</p>
      <p>${rNome}${rEmail ? " | " + rEmail : ""}${rTelefone ? " | " + rTelefone : ""}</p>
    </div>`;
    }

    extraPage += `
    <div class="page-footer-center">CURITIBA – SAO PAULO – RIO DE JANEIRO</div>
    <div class="page-footer">PARKET</div>
  </div>
  </div><!-- end extra page -->`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Proposta ${numero} - ${cliente}</title>
<style>
/* ─── Reset & Base ─── */
* { margin:0; padding:0; box-sizing:border-box; }
html, body { background:#ededed; font-family:'Segoe UI', system-ui, -apple-system, sans-serif; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
@page { size: A4; margin: 0; }
@page tablePage {
  size: A4;
  margin: 30pt 0 60pt 0;
  @top-left { content: ""; background: #ededed; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @top-center { content: ""; background: #ededed; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @top-right { content: ""; background: #ededed; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @bottom-left { content: ""; background: #ededed; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @bottom-center { content: ""; background: #ededed; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @bottom-right {
    content: "PARKET";
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-weight: 600; font-size: 16pt; letter-spacing: 1.5pt;
    color: #000000; padding: 0 28pt 18pt 0; vertical-align: bottom;
    background: #ededed; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
}
@page contractPage {
  size: A4;
  margin: 30pt 0 60pt 0;
  @top-left { content: ""; background: #ededed; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @top-center { content: ""; background: #ededed; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @top-right { content: ""; background: #ededed; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @bottom-left { content: ""; background: #ededed; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @bottom-center { content: ""; background: #ededed; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @bottom-right {
    content: "PARKET";
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-weight: 600; font-size: 16pt; letter-spacing: 1.5pt;
    color: #000000; padding: 0 28pt 18pt 0; vertical-align: bottom;
    background: #ededed; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
}
.table-page { page: tablePage; }
.contract-page { page: contractPage; }
@media print {
  html, body { width:210mm; height:297mm; }
  body { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; color-adjust:exact !important; }
  .info-page, .info-page::before { background-color:#000000 !important; }
  .cover-white { background-color:#ffffff !important; }
  .table-page, .contract-page, .page-content { background-color:#ededed !important; }
  .hdr-itens, .hdr-desc, .hdr-valor { background-color:#000000 !important; color:#ffffff !important; }
  .ptable tbody td { border-bottom-color:#ffffff !important; border-right-color:#ffffff !important; }
}
.pagemargins { padding:0; border:0; }

/* ─── Page containers ─── */
.page-fixed {
  width:595pt; height:842pt;
  position:relative; overflow:hidden;
}
.page-content {
  width:595pt; min-height:842pt;
  position:relative;
  padding:0 0 60pt 0;
  background:#ededed;
  -webkit-print-color-adjust:exact !important;
  print-color-adjust:exact !important;
}

/* ─── Page 1: White cover ─── */
.cover-white { background:#ffffff; }
.cover-logo {
  position:absolute; left:60pt; top:440pt;
  font:300 34pt 'Segoe UI', system-ui, sans-serif;
  color:#000; letter-spacing:1pt;
}

/* ─── Page 2: Photo cover ─── */
.cover-photo { background:#000; }
.cover-photo img {
  width:100%; height:100%;
  object-fit:cover; display:block;
}
.cover-photo-watermark {
  position:absolute; right:24pt; bottom:24pt;
  font:300 14pt 'Segoe UI', system-ui, sans-serif;
  color:#fff; letter-spacing:1pt;
}

/* ─── Page 3: Black info page ─── */
.info-page {
  background-color:#000000 !important;
  -webkit-print-color-adjust:exact !important;
  print-color-adjust:exact !important;
}
.info-page::before {
  content:''; position:absolute; inset:0;
  background:#000000 !important;
  z-index:0;
}
.info-logo {
  position:absolute; left:59pt; top:398pt; z-index:1;
  font-family:'Segoe UI', system-ui, -apple-system, sans-serif;
  font-weight:300; font-size:34pt;
  color:#e9e9e9; letter-spacing:0.5pt;
  line-height:1;
}
.info-block {
  position:absolute; left:59pt; top:488pt; z-index:1;
  font-family:'Segoe UI', system-ui, -apple-system, sans-serif;
  font-weight:300; font-size:11.5pt;
  color:#e9e9e9; line-height:1.5;
}
.info-block .info-line {
  white-space:nowrap;
  margin:0; padding:0;
}
.info-block .info-gap { height:10pt; }

/* ─── Page 4+: Table page ─── */
.table-page {
  width:595pt;
  position:relative;
  padding:0;
  background:#ededed;
  -webkit-print-color-adjust:exact !important;
  print-color-adjust:exact !important;
}
.page-header-right {
  font:11pt 'Segoe UI', system-ui, sans-serif;
  text-align:right; padding:16pt 28pt 0 0;
  color:#1a1a1a;
}
.page-label {
  font:11pt 'Segoe UI', system-ui, sans-serif;
  text-align:left; padding:2pt 0 6pt 28pt;
  color:#1a1a1a;
}
.page-footer {
  font:26pt 'Segoe UI', system-ui, sans-serif;
  font-weight:400; letter-spacing:2pt;
  text-align:right; padding:0 28pt 22pt 0;
  color:#1a1a1a;
  position:absolute; bottom:0; right:0;
}
.page-footer-center {
  font:9pt 'Segoe UI', system-ui, sans-serif;
  text-align:center; padding:40pt 0 20pt 0;
  color:#333; letter-spacing:0.5pt;
}

/* ─── Items table ─── 3 columns FIXED: 15% / 65% / 20% */
.ptable {
  width:calc(100% - 56pt); margin:0 28pt;
  border-collapse:collapse;
  table-layout:fixed;
  font:8pt 'Segoe UI', system-ui, sans-serif;
}
.ptable td, .ptable th { margin:0; word-wrap:break-word; overflow-wrap:break-word; }
.ptable tbody td {
  border-bottom:2px solid #ffffff;
  border-right:2px solid #ffffff;
}
.ptable tbody td:last-child { border-right:none; }
.ptable tbody tr:last-child td { border-bottom:none; }
.ptable col.c1 { width:15%; }
.ptable col.c2 { width:65%; }
.ptable col.c3 { width:20%; }

/* Table repeating header/footer */
.ptable thead td.t-cliente {
  border:none !important;
  padding:14pt 6pt 2pt 0;
  text-align:right;
  font:9pt 'Segoe UI', system-ui, sans-serif;
  color:#1a1a1a;
  background:transparent !important;
}
.ptable thead td.t-label {
  border:none !important;
  padding:2pt 0 4pt 0;
  text-align:left;
  font:9pt 'Segoe UI', system-ui, sans-serif;
  color:#1a1a1a;
  background:transparent !important;
}
.ptable tfoot td.t-footer {
  border:none !important;
  padding:28pt 28pt 22pt 0;
  text-align:right;
  font:26pt 'Segoe UI', system-ui, sans-serif;
  font-weight:400; letter-spacing:2pt;
  color:#1a1a1a;
  background:transparent !important;
}
.ptable { page-break-inside:auto; }
.ptable tr { page-break-inside:avoid; page-break-after:auto; }
.ptable thead { display:table-header-group; }
.ptable tfoot { display:table-footer-group; }

/* Table header */
.hdr-itens, .hdr-desc, .hdr-valor {
  background:#000000 !important; color:#ffffff;
  font:bold 9pt 'Segoe UI', system-ui, sans-serif;
  text-align:center; vertical-align:middle;
  height:22pt; padding:4pt 8pt;
  -webkit-print-color-adjust:exact !important;
  print-color-adjust:exact !important;
}
.hdr-itens { border-right:1px solid #444; }
.hdr-desc  { border-left:1px solid #444; border-right:1px solid #444; }
.hdr-valor { border-left:1px solid #444; }

/* Categoria */
.cat-c {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:center; vertical-align:middle; padding:7pt 8pt;
}
.cat-l {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:left; vertical-align:middle; padding:7pt 8pt;
}
.cat-v {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:right; vertical-align:middle; padding:7pt 8pt;
}

/* Subitem */
.item-c {
  font:8pt 'Segoe UI', system-ui, sans-serif;
  text-align:center; vertical-align:middle; padding:8pt 8pt;
}
.item-l {
  font:8pt 'Segoe UI', system-ui, sans-serif;
  text-align:left; vertical-align:top; padding:8pt 8pt;
}
.item-l .desc-title {
  margin:0 0 3pt 0; font-weight:bold;
  font-size:8pt; line-height:1.35;
}
.item-l .desc-body {
  margin:0; font-size:8pt; line-height:1.35;
  font-weight:normal;
}
.item-v {
  font:8pt 'Segoe UI', system-ui, sans-serif;
  text-align:right; vertical-align:middle;
  padding:8pt 12pt 8pt 6pt;
}

/* Valor parcial */
.sub-c, .sub-l, .sub-v {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  vertical-align:middle;
}
.sub-c { text-align:center; padding:7pt 8pt; }
.sub-l { text-align:left; padding:7pt 8pt; }
.sub-v { text-align:right; padding:7pt 12pt 7pt 6pt; }

/* LOGÍSTICA */
.log-c {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:center; vertical-align:middle; padding:7pt 8pt;
}
.log-l {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:left; vertical-align:middle; padding:7pt 8pt;
}

/* OBSERVAÇÃO */
.obs-c {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:center; vertical-align:middle; padding:7pt 8pt;
}
.obs-l {
  font:8pt 'Segoe UI', system-ui, sans-serif;
  text-align:left; vertical-align:middle; padding:7pt 8pt;
  font-weight:normal;
}
.obs-v {
  font:8pt 'Segoe UI', system-ui, sans-serif;
  text-align:right; vertical-align:middle; padding:7pt 8pt;
}

/* RESUMO TOTAL */
.total-c {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:center; vertical-align:middle; padding:7pt 8pt;
}
.total-l {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:left; vertical-align:middle; padding:7pt 8pt;
}
.total-v {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:right; vertical-align:middle; padding:7pt 12pt 7pt 6pt;
}

/* DESCONTO */
.disc-c {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:center; vertical-align:middle; padding:7pt 8pt;
}
.disc-l {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:left; vertical-align:middle; padding:7pt 8pt;
}
.disc-v {
  color:#c00; font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:right; vertical-align:middle; padding:7pt 12pt 7pt 6pt;
}

/* Pre-total / final total borders */
.ptable tbody tr.pre-total-row td {
  border-bottom:1px solid #000000 !important;
}
.ptable tbody tr.ftotal-row td {
  border-top:1px solid #000000 !important;
  border-bottom:1px solid #000000 !important;
  border-right:none !important;
}
.ftotal-c {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:center; vertical-align:middle; padding:8pt 8pt;
}
.ftotal-l {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:left; vertical-align:middle; padding:8pt 8pt;
}
.ftotal-v {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:right; vertical-align:middle; padding:8pt 12pt 8pt 6pt;
}

/* CONDIÇÕES */
.cond-c {
  font:bold 8pt 'Segoe UI', system-ui, sans-serif;
  text-align:center; vertical-align:top; padding:7pt 8pt;
}
.cond-l {
  font:7.5pt 'Segoe UI', system-ui, sans-serif;
  text-align:left; vertical-align:top; padding:7pt 8pt;
  line-height:1.45;
}
.cond-l p { margin:0; }
.cond-v {
  font:8pt 'Segoe UI', system-ui, sans-serif;
  text-align:right; vertical-align:middle; padding:7pt 8pt;
}

/* ─── Signature area ─── */
.aceite-block {
  padding:18pt 28pt 0 28pt;
  font:9pt 'Segoe UI', system-ui, sans-serif;
  color:#1a1a1a;
}
.aceite-line {
  margin:10pt 0 0 0; width:320pt;
  border-top:1px solid #000;
}
.aceite-text {
  font:6.5pt Arial, sans-serif; padding-top:3pt; color:#333;
}
.aceite-date {
  font:9pt 'Segoe UI', system-ui, sans-serif;
  text-align:right; margin-top:-16pt; margin-right:80pt;
  color:#1a1a1a;
}

/* ─── Contract page ─── */
.contract-page {
  width:595pt;
  position:relative;
  padding:0;
  background:#ededed;
  -webkit-print-color-adjust:exact !important;
  print-color-adjust:exact !important;
}
.contract-header {
  padding:20pt 26pt 0 0;
  font:11pt 'Segoe UI', system-ui, sans-serif;
  text-align:right;
}
.contract-body {
  column-count:2;
  column-gap:18pt;
  column-fill:balance;
  padding:12pt 26pt 0 26pt;
  font:6.5pt 'Segoe UI', system-ui, sans-serif;
  text-align:justify;
  line-height:1.5;
  word-wrap:break-word;
  orphans:3; widows:3;
}
.contract-body p { margin:0 0 4pt 0; break-inside:avoid; }
.contract-sigs-flow {
  padding:18pt 26pt 0 0;
  width:48%;
  margin-left:auto;
  font:7pt Verdana, sans-serif;
}
.contract-sigs-flow .sig-block {
  border-top:1px solid #000;
  margin:14pt 0 6pt 0; padding-top:4pt;
  break-inside:avoid;
}
.contract-sigs-flow .sig-label {
  font:6pt Verdana, sans-serif;
  text-align:center;
}
.contract-sigs-flow .sig-field {
  font:6pt Verdana, sans-serif;
  margin-top:4pt;
}
.contract-signatures {
  padding:28pt 26pt 0 26pt;
  font:7pt Verdana, sans-serif;
}
.contract-signatures .sig-block {
  border-top:1px solid #000;
  margin:20pt 0 6pt 0; padding-top:4pt;
  width:260pt;
}
.contract-signatures .sig-block.right {
  margin-left:auto;
}
.contract-signatures .sig-label {
  font:6pt Verdana, sans-serif;
  text-align:center;
}
.contract-signatures .sig-field {
  font:6pt Verdana, sans-serif;
  margin-top:4pt;
}
.contract-footer {
  font:26pt 'Segoe UI', system-ui, sans-serif;
  font-weight:400; letter-spacing:2pt;
  text-align:right; padding:30pt 28pt 22pt 0;
  color:#1a1a1a;
}

/* ─── Extra pages ─── */
.extra-section {
  padding:20pt 56pt 0 56pt;
  font:11pt 'Segoe UI', system-ui, sans-serif;
  line-height:1.8;
}
.extra-title {
  font:bold 12pt 'Segoe UI', system-ui, sans-serif;
  margin-bottom:12pt;
}
.extra-body {
  font:11pt 'Segoe UI', system-ui, sans-serif;
  line-height:1.8; text-align:justify;
}
.extra-closing {
  padding:30pt 56pt 0 56pt;
  font:11pt 'Segoe UI', system-ui, sans-serif;
  line-height:2;
}
</style>
</head>
<body>

  <!-- ═══ PAGE 1: White cover ═══ -->
  <div class="pagemargins">
  <div class="page-fixed cover-white">
    <div class="cover-logo">PARKET</div>
  </div>
  </div>

  <!-- ═══ PAGE 2: Photo cover ═══ -->
  <div class="pagemargins" style="page-break-before:always;">
  <div class="page-fixed cover-photo">
    <img src="/proposta-cover.png" alt="Parket" />
  </div>
  </div>

  <!-- ═══ PAGE 3: Black info page ═══ -->
  <div class="pagemargins" style="page-break-before:always;">
  <div class="page-fixed info-page">
    <div class="info-logo">PARKET</div>
    <div class="info-block">
      <div class="info-line">São Paulo, ${hoje}</div>

      <div class="info-gap"></div>
      <div class="info-line">Proposta comercial - ${numero}</div>

      <div class="info-gap"></div>
      <div class="info-line">Contratante: ${contratante}</div>
${enderecoLinhas.map(l => `      <div class="info-line">${l}</div>`).join("\n")}${contatoNome ? `
      <div class="info-line">Contato: ${contatoNome}</div>` : ""}${contatoTelefone ? `
      <div class="info-line">${contatoTelefone}${contatoEmail ? ` | ${contatoEmail}` : ""}</div>` : contatoEmail ? `
      <div class="info-line">${contatoEmail}</div>` : ""}

      <div class="info-gap"></div>
      <div class="info-line">Contratado: Parket</div>
      <div class="info-line">Vendedor: ${vendedor}</div>${orcamentista ? `
      <div class="info-line">Orçamentista: ${orcamentista}</div>` : ""}
      <div class="info-line">${vendedorTelefone} | ${vendedorEmail}</div>

      <div class="info-gap"></div>
      <div class="info-line">Validade da proposta: ${sim.validade_dias} dias</div>
    </div>
  </div>
  </div>

  <!-- ═══ PAGE 4: Items table ═══ -->
  <div class="pagemargins" style="page-break-before:always;">
  <div class="table-page">

    <table class="ptable">
      <colgroup><col class="c1"><col class="c2"><col class="c3"></colgroup>
      <thead>
        <tr><td class="t-cliente" colspan="3">${contratante}, ID: ${numero}</td></tr>
        <tr><td class="t-label" colspan="3">Itens orçados:</td></tr>
        <tr>
          <th class="hdr-itens">ITENS</th>
          <th class="hdr-desc">DESCRITIVO</th>
          <th class="hdr-valor">VALOR</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Aceite -->
    <div class="aceite-block">
      <div>Para confirmar este pedido</div>
      <div class="aceite-line"></div>
      <div class="aceite-text">Com a assinatura deste documento, aceita as condições gerais que estão em anexo</div>
      <div class="aceite-date">de &nbsp;&nbsp;&nbsp;&nbsp;/ &nbsp;&nbsp;&nbsp;&nbsp;/</div>
    </div>

  </div>
  </div>

  <!-- ═══ PAGE 5+: Contract terms ═══ -->
  <div class="pagemargins" style="page-break-before:always;">
  <div class="contract-page">
    <div class="contract-header">${contratante}, ID: ${numero}</div>

    <div class="contract-body">CONTRATANTE:<br>${contratante} CPF/CNPJ ${cnpj} residente ao ${endereco}<br><br>CONTRATADA:<br>MUNDIAL EXPORT ASSESSORIA COMERCIO EXTERIOR IMPORTACAO E EXPORTACAO LTDA. Pessoa Jurídica de direito privado, inscrita no CNPJ nº 29.872.616/0001-34, com sede na Avenida Francisco Ferreira da Cruz, nº 6030, , Galpao 93, Eucalipto, Fazendo Rio Grande/PR CEP 83820-293, por seu representante legal CLODOALDO DONIZETE OLIVEIRA, brasileiro, inscrito no CPF/MF sob o nº 641.221.159-49<br><br>Por este instrumento particular e na melhor forma de direito, as partes acima qualificadas resolvem celebrar o presente CONTRATO DE FORNECIMENTO DE MATERIAIS E DE PRESTAÇÃO DE SERVIÇOS, que se regerá pelas cláusulas e condições abaixo estipuladas que, mútua e consensualmente, aceitam entre elas:<br><br>CLÁUSULA PRIMEIRA – PREÇOS E CONDIÇÕES DE PAGAMENTO<br>1.1. Pelo objeto contratado, a CONTRATANTE pagará a CONTRATADA a quantia líquida, certa e exigível descrita à fl. 1 do presente Instrumento.<br>1.2. O preço descrito à fl. 1 do presente Instrumento engloba os produtos/materiais, os serviços de instalação, insumos, transporte vertical e horizontal necessários ao local de instalação os quais não poderão ser vendidos separadamente, diante da alta qualidade dos produtos/materiais, e especializada mão de obra. A CONTRATADA teve conhecimento antecipadamente do local da obra, suas peculiaridades de horário escasso, bem como dos projetos arquitetônicos, técnicos e complementares necessários à compatibilização do seu escopo de trabalho com a tipologia construtiva de projeto.<br>1.3. Faz parte deste escopo de trabalho, a CONTRATADA fornecer os acabamentos dos materiais/serviços aqui descritos com os demais materiais que faceiam a atividade do escopo, conforme FOTOS e PADRÕES fornecidos pela CONTRATADA ao CONTRANTE (que fazem parte do contrato).<br>1.4. Em caso de inadimplemento por parte da CONTRATANTE quanto ao pagamento do objeto deste contrato, deverá incidir sobre o valor inadimplido juros de 1% ao mês e correção monetária conforme a variação positiva do IGP-M/FGV, ou eventual índice que venha a substituí-lo, ambos até a data do efetivo pagamento, além de multa moratória de 10% sobre o valor do débito.<br>1.5. O atraso no pagamento de qualquer valor devido, nos prazos e nas condições avençadas, constituirá a CONTRATANTE Notificação judicial ou extrajudicial prévia e/ou quaisquer outras formalidades.<br>1.6. No caso de não pagamento de qualquer dos valores devidos, a CONTRATADA poderá suspender a entrega dos produtos e execução dos serviços até o adimplemento da obrigação pendente, independentemente do percentual do preço de venda já quitado pela CONTRANTANTE, e sem prejuízo de qualquer das demais penalidades previstas neste Contrato. Clausula não aceita na íntegra.<br>1.7. Qualquer atividade adicional não prevista nestes termos, deverão ser aprovados pelo CONTRATANTE com 10 dias de antecedência à execução. Não serão aceitos pleitos adicionais sem a prévia anuência formalizada do CONTRATANTE.<br>1.8. A limpeza constante dos locais em trabalho e a retirada de entulhos provenientes deste escopo e trabalho é de responsabilidade única e exclusiva da CONTRATADA.<br>1.9. É de responsabilidade da CONTRATADA a entrega e disponibilização de EPIs à seus funcionários e terceiros, bem como responsabilizar-se sobre a saúde e segurança das equipes, conforme Normas Brasileiras de Saúde e Segurança do Trabalhador. A CONTRATADA se responsabiliza pelo pagamento de todo e qualquer imposto, taxa, INSS, FGTS, encargos trabalhistas da equipe associada à este contrato.<br><br>CLÁUSULA SEGUNDA – PRAZO DE ENTREGA<br>2.1. O prazo para a entrega dos materiais e execução da instalação está previsto na fl. 1 deste Contrato.<br>2.2. Qualquer alteração das datas de entrega e/ou instalações pela CONTRATANTE deverá ser informada com no mínimo 20 dias úteis de antecedência, ao e-mail técnico@parket.com.br. Na hipótese de tal aviso ocorrer em prazo menor ou igual a 7 dias úteis de antecedência, será cobrado da CONTRATANTE uma multa contratual de 2% (um por cento) do valor total do presente contrato. Caso, entretanto, a entrega seja cancelada no dia previsto ou não tenha nenhum responsável para receber os produtos e/ou possibilitar a instalação, acarretará multa correspondente a 10% (dez por cento) do valor total deste Contrato. Serão realizadas 2 vistorias técnicas de avaliação do estágio de obra e definição de prazo entrega acordada entre as partes.<br>2.3. O agendamento da entrega poderá ser realizado pela CONTRATANTE, desde que comunicado com no mínimo 30 dias úteis de antecedência, ao e-mail técnico@parket.com.br.<br>2.4. Desde logo, caso a CONTRATADA tenha qualquer problema para entrega dos materiais e/ou início/conclusão da instalação, mas desde que previamente informado, a CONTRATANTE confere à CONTRATADA a possibilidade de atraso em relação as datas previstas na fl. 1 deste Contrato, sem a imposição de qualquer penalidade e/ou possibilidade de rescisão do contrato.<br>2.5. Em caso de atraso na entrega do material ou execução do serviço superior a 30 (trinta) dias uteis por parte da CONTRATADA, deverá pagar à CONTRATANTE multa de 1% (um por cento) calculada sobre o valor total do contrato.<br>2.6. A data prevista para entrega dos materiais, quando não disponível em estoque, poderá sofrer alterações, em especial, para os produtos importados durante o processo de liberação, motivo pelo qual, desde logo, em tais situações, mas desde que previamente informado, a CONTRATANTE confere à CONTRATADA a possibilidade de um atraso em relação às datas previstas na fl. 1, sem a imposição de qualquer penalidade e/ou possibilidade de rescisão do contrato.<br>2.7 O pedido relacionado a este instrumento é baseado no último projeto apresentado pela CONTRATANTE e/ou arquitetura responsável, até a data da assinatura do presente instrumento. Após o fechamento, o projeto não poderá sofrer qualquer alteração sem consulta prévia e aprovação de ambas as partes. Em caso de custos e/ou prazos adicionais, será elaborado um aditivo contratual.<br><br>CLÁUSULA TERCEIRA – CONDIÇÕES DO PEDIDO EM RELAÇÃO AO MATERIAL<br>3.1. A CONTRATANTE ou o responsável indicado deverá conferir o estado, quantidades e especificações dos materiais durante a entrega, de acordo com o pedido. Aceito o pedido sem qualquer ressalva, não poderá a CONTRATANTE contestar o material entregue, bem como arcará com os todos os custos necessários para eventual troca do material.<br>3.2. Após entrega do material A CONTRATANTE ou o responsável indicado deverá alocar todo material em local seguro, limpo, protegido e abrigado do sol e umidade.<br>3.3. A CONTRATANTE tem ciência que a madeira é um produto natural, de características únicas e uniformes em suas tonalidades. Em exposição à luz solar, a madeira poderá sofrer uma pequena alteração em sua coloração, decorrente de suas características. Por tal motivo, não existem duas peças perfeitamente idênticas entre si ou em relação às amostras apresentadas. Em condições orgânicas, também estará sujeita a expansão e contração, decorrentes do ambiente externo (umidade, pressão e temperatura), essas dimensões podem chegar naturalmente em até 2% (dois por cento). Considerando essas variações, é de responsabilidade da CONTRADADA o ônus e responsabilizar-se pela adaptação, qualidade e acabamento dos serviços prestados à edificação existente, assim como acabamentos complementares necessários à qualificação arquitetônica pretendida.<br>3.4. Ciente das características descritas na Cláusula 3.3 a CONTRATANTE não poderá opor qualquer objeção ao produto e, em caso de objeção e/ou requerimento de troca a CONTRATANTE arcará com os todos os custos necessários para tanto, bem como com todos os prejuízos em decorrência de atrasos para cumprimento do cronograma.<br><br>CLÁUSULA QUARTA – INSTRUÇÕES TÉCNICAS E RESPONSABILIDADES<br>4.1. Para garantia da adequação da instalação, a equipe técnica da CONTRATADA fará visita in loco, antes do envio do material para instalação, com a intenção de vistoria dos itens abaixo descritos:<br>4.1.1 ANTES E DURANTE A INSTALAÇÃO:<br>A) CONTRAPISO:<br>- O contrapiso deverá estar devidamente seco, nivelado, liso, resistente e limpo, com argamassa de cimento, areia média lavada e peneirado no traço de 3:1, seco por pelo menos 21 dias (vinte uns dias). O nivelamento deverá estar plano, sem ondulações ou buracos;<br>- O espaço deixado entre o contrapiso e batentes, deve ser exatamente a espessura da madeira + insumos;<br>- A CONTRATADA irá conferir a umidade do mesmo, para evitar qualquer risco, podendo recusar a instalação e requerer a realização de providências pela CONTRATANTE;<br>- Para áreas térreas o contrapiso deverá ser impermeabilizado, antes da instalação;<br>- Em caso de reformas, o contrapiso deverá ser refeito;<br>- Em casos de áreas externas, para instalação de decks, por exemplo, atentar-se para o escoamento da água;<br>- A limpeza é essencial, devendo remover qualquer vestígio de massas, gessos e quaisquer sujeiras;<br>- O serviço de instalação não inclui alvenaria ou quaisquer adaptações necessárias.<br>B) LIBERAÇÕES:<br>- O local que receberá o revestimento, deverá estar completamente nivelado, plano e executado para receber a espessura indicada no material + insumos;<br>- Os locais devem estar livres de umidade;<br>- Itens como elétrica e hidráulica, devem estar concluídos. A CONTRATADA não se responsabilizará por danos causados em tubulações, durante a fixação dos materiais;<br>- Janelas, portas, soleiras, guarnições e batentes deverá estar devidamente instaladas;<br>- As áreas devem estar limpas e desobstruídas de objetos e pessoas;<br>- A CONTRATANTE deverá disponibilizar caçambas para descarte dos entulhos;<br>- A CONTRATANTE deverá disponibilizar andaimes e plataformas para instalação;<br>- Para recortes simples de tomadas, luminárias entre outros, é cobrado o valor de R$50,00 por unidade. Para recortes específicos, consultar seu vendedor;<br>- Para fabricação de alçapões o valor por unidade deverá ser consultado com seu vendedor;<br>- A entrega dos produtos não abrangerá serviços de içamento e/ou serviços adicionais e ocorrerá em horário comercial. Caso seja necessário, um horário específico, fazer a cotação do custo adicional com seu vendedor;<br>4.2. Enquanto perdurar a obra, o material instalado deverá ser totalmente vedado, a fim de garantir, um bom acabamento final.<br>4.2.1. Instalações internas: Aconselhável a aspiração ou varrição com vassoura de pelo macio. Diluir em água, um pouco de detergente neutro ou produtos de limpeza próprios para madeira, como os da linha Bona. Umedecer levemente um pano limpo e passar nos locais desejáveis.<br>4.2.2. Instalações externas: Aconselhável varrição com vassoura e utilização de água + detergente neutro para limpeza. É indicado fazer a manutenção preventiva 2 vezes ao ano, por estar exposto às ações do tempo.<br>4.2.3 Caso caia sob a madeira, substâncias como vinho, molhos, óleos e água, que podem vir a manchar, indica-se que seja seco e limpo, o mais breve possível;<br>4.2.4 Conferir o Manual de Conservação e Limpeza disponibilizado pela CONTRATADA.<br><br>CLÁUSULA QUINTA – GARANTIA<br>5.1. A CONTRATADA concede, neste ato, garantia contratual de 05 (cinco) anos para os produtos, a qual abrange o prazo mínimo de garantia legal e será contada a partir da data de instalação.<br>5.2. Fica desde já acordado entre as partes que a CONTRATADA somente se responsabilizará pela manutenção ou troca de qualquer dos produtos, durante o prazo de vigência da garantia, em caso de defeito de fabricação devidamente comprovado, ressalvadas as demais disposições deste contrato.<br>5.3. A garantia concedida pela CONTRATADA estará automaticamente revogada em caso de descumprimento de qualquer das condições estipuladas neste instrumento, por danos causados por contato com produtos químicos, mau uso, infiltrações e contatos com materiais de construção (cimento, areia, solventes, tinta, etc).<br>5.4. As partes acordam que a responsabilidade da CONTRATADA será sempre limitada aos produtos que deixarem de atender à qualidade e às especificações previstas no anverso deste contrato. Portanto, a responsabilidade da CONTRATADA estará limitada ao reparo e/ou substituição dos produtos comprovadamente desconformes, sendo que, na hipótese do reparo e/ou substituição não ser possível por questões técnicas, a responsabilidade da CONTRATADA estará sempre limitada ao valor dos produtos que comprovadamente não atenderem aos requisitos de qualidade e às especificações técnicas, não respondendo a CONTRATADA por qualquer outro dano, prejuízo, indenização, ressarcimento, penalidade, reembolso, custo, despesa e/ ou valor não previsto neste contrato, inclusive a título de dano moral e/ou lucro cessante, incorridos, seja a que título for.<br>5.5. A CONTRADA é responsável pela quantificação do material a ser instalado, sendo que, por sua expertise é de sua responsabilidade a quantificação de perdas de materiais devido à cortes e recortes, inerentes à arquitetura do projeto. Não serão aceitos pleitos de custos adicionais neste sentido de quantificação técnica.<br>5.6. Entende-se que o CONTRATANTE está adquirindo os serviços e materiais em formato empreitada global tipo Turn-key, para uso da edificação, conforme detalhamento e imagens disponibilizadas pela arquitetura.<br><br>CLÁUSULA SEXTA – RESCISÃO<br>6.1. O presente Contrato poderá ser rescindido pela CONTRATADA, mediante simples aviso escrito à CONTRATANTE na ocorrência de descumprimento por parte da CONTRATANTE das boas práticas de mercado, boa-fé e de inadimplemento contratual.<br>6.1.2. No caso de rescisão contratual, eventual desconto concedido na compra do produto/material, instalação e insumos, será automaticamente anulado, sendo devido o preço global do contrato, incluindo-se, portanto, como valor devido o montante a título de desconto.<br>6.2. O presente contrato poderá ser rescindido por qualquer das partes mediante simples aviso escrito à outra parte: i. na ocorrência de caso fortuito ou força maior, conforme definido em lei, que impeça uma das partes de cumprir suas obrigações, se o impedimento perdurar por pelo menos 10 (dez) dias; ii. na hipótese de decretação de falência, insolvência, deferimento do processamento de recuperação judicial ou extrajudicial, liquidação ou dissolução da outra parte; iii. em caso de inadimplemento das disposições contratuais.<br>6.3. Rescindindo-se o Contrato conforme esta cláusula far-se-á um levantamento em conjunto dos serviços executados e dos materiais entregues até o momento da suspensão dos trabalhos ou da rescisão do presente Contrato, para apuração do saldo devido a uma ou a outra parte e acerto financeiro, aplicando-se o disposto no item 6.1.2, quanto a anulação de eventual desconto.<br>6.4. Se a CONTRATANTE der causa à rescisão deste contrato, com exceção da hipótese de caso fortuito ou de força maior, responderá pela multa de 10% (dez por cento) sobre o valor do presente contrato, nele incluindo suas eventuais majorações por aditivos contratuais devidamente atualizados conforme a variação positiva do IGP-M/FGV, ou eventual índice que venha a substituí-lo, calculado desde a data da rescisão até o efetivo pagamento.<br><br>CLÁUSULA SÉTIMA – CONDIÇÕES GERAIS<br>7.1. O presente instrumento obriga as partes e seus eventuais sucessores, devendo suas obrigações serem cumpridas de forma incondicional em todos os seus termos.<br>7.2. Qualquer renúncia, modificação, adição ou transação em relação a este instrumento, ou a qualquer de suas cláusulas, e todas as notificações e avisos, feitos em decorrência dele, somente vinculará as partes se tiverem sido feitos por escrito, e assinados por seus representantes, devidamente qualificados e/ou autorizados pelas partes.<br>7.3. A CONTRATANTE declara, para os devidos fins de direito que está ciente das condições dos produtos, das peculiaridades e características que os revestem, bem como dos cuidados necessários para a sua correta conservação, manutenção e uso.<br>7.4. A CONTRATANTE reconhece ainda, que está adquirindo produtos e serviços de acordo com as condições e especificações descritas no pedido vinculado a este instrumento. Portanto, se houver necessidade de refazer ou alterá-las por razões de medidas, atualizações ou informações errôneas, o custo extra será adicionado em apartado pela CONTRATADA.<br>7.5. Na hipótese de a CONTRATADA ser compelida a ingressar em juízo para demandar o cumprimento de qualquer obrigação assumida pela CONTRATANTE, a execução judicial deste Contrato abrangerá a cobrança de multa, juros, correção monetária, custas judiciais e honorários advocatícios, estes últimos desde já estipulados em 20% (vinte por cento) do valor devido.<br>7.6. A CONTRATANTE, neste ato, confere ao presente Contrato, caráter de título líquido, certo e plenamente exigível, revestindo-o de todos os requisitos de título executivo extrajudicial, para os devidos fins de direito, nos termos do artigo 784, III do Código de Processo Civil.<br>7.7. O presente Contrato é celebrado em caráter irrevogável e irretratável, sem direito a arrependimento por qualquer das partes, obrigando-as ao integral cumprimento, assim como aos seus herdeiros e sucessores, a qualquer título.<br>7.8. Em razão do caráter de irrevogabilidade e irretratabilidade deste instrumento, caso a CONTRATANTE desista de comprar ou recuse-se a receber qualquer lote dos produtos e/ou serviço de instalação, por qualquer motivo, inclusive nas hipóteses de caso fortuito, força maior, falência, recuperação judicial ou extrajudicial ou insolvência civil, conforme o caso, a CONTRATADA reterá a parcela do preço paga pela CONTRATANTE como sinal e princípio de pagamento, a título de indenização pelo desfazimento unilateral do negócio, independentemente de quaisquer formalidades prévias em esfera judicial ou extrajudicial, devendo a CONTRATANTE, ainda, indenizar a CONTRATADA por todas as perdas e danos incorridos, bem como reembolsar todos os custos e as despesas por ela incorridos até o evento de desistência ou recusa.<br>A CONTRATADA se responsabiliza por substituir toda e qualquer parte ou peça que apresente qualquer tipo de dano ou avaria e que não se enquadre dentro do padrão de qualidade.<br>7.9. A CONTRANTE, sob nenhuma hipótese ou pretexto poderá ceder e/ou transferir os direitos e obrigações decorrentes deste Contrato, sem a prévia e expressa anuência da CONTRATADA.<br>7.10. Se qualquer cláusula ou dispositivo deste Contrato for declarado nulo ou sem efeito, no todo ou em parte, por decisão judicial transitada em julgado, as demais deverão permanecer válidas e serão interpretadas de forma a preservar a sua validade.<br>7.11. Este Contrato foi redigido dentro dos princípios de probidade e boa-fé, sem vícios de consentimento. As Partes declaram, para todos os efeitos legais, que: (i) as obrigações ora assumidas são compatíveis com suas condições econômicas e financeiras; (ii) estão habituadas a este tipo de operação; (iii) este Contrato espelha fielmente tudo que foi ajustado; e (iv) tiveram conhecimento prévio do conteúdo deste Contrato e entenderam perfeitamente todas as obrigações nele contidas.<br><br>CLÁUSULA OITAVA – FORO<br>8.1. As Partes elegem o Foro Central da Comarca de Curitiba - Paraná, como o único e competente para apreciar e dirimir as dúvidas e controvérsias decorrentes deste CONTRATO, com renúncia de qualquer outro, por mais privilegiado que seja.<br>Estando as partes envolvidas de pleno acordo das cláusulas que regem este instrumento, firmam o presente em duas sucessores até a rescisão do mesmo.<br><br>O pedido relacionado a este instrumento é baseado no último projeto apresentado pela CONTRATANTE e/ou arquitetura responsável, até a data da assinatura do presente instrumento. Após o fechamento, o projeto não poderá sofrer qualquer alteração sem consulta prévia e aprovação de ambas as partes. Em caso de custos e/ou prazos adicionais, será elaborado um aditivo contratual.<br>Na primeira medição técnica em obra o fiscal da contratada irá medir a área real dos itens contratados in loco, caso haja alguma diferença, derivada de qualquer meio, haverá um acerto comercial entre as partes. O fornecimento de andaime, caçamba para descarte de resíduos e transporte vertical do material (içamento, elevador ou cremalheira) é de total responsabilidade da contratante.</div>

    <!-- Signatures -->
    <div class="contract-sigs-flow">
      <div class="sig-block">
        <div class="sig-label">MUNDIAL EXPORT ASSESSORIA COMERCIO EXTERIOR<br>IMPORTACAO E EXPORTACAO LTDA</div>
        <div class="sig-field">CNPJ: 29.872.616/0001-34</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">${contratante}</div>
        <div class="sig-field">CNPJ/CPF: ${cnpj}</div>
      </div>
      <div style="margin-top:14pt;font:6pt Verdana, sans-serif;">Testemunhas:</div>
      <div class="sig-block">
        <div class="sig-field">RG:</div>
        <div class="sig-field">CPF:</div>
      </div>
      <div class="sig-block">
        <div class="sig-field">RG:</div>
        <div class="sig-field">CPF:</div>
      </div>
    </div>

  </div>
  </div>

  ${extraPage}

</body>
</html>`;
}

export async function abrirPropostaParaImpressao(sim: PropostaSimulacao, itens: PropostaItem[]): Promise<void> {
  // Enrich sim from kanban_cards if obra_id is available
  if (sim.obra_id) {
    try {
      const { supabase } = await import("./supabase");
      const { data } = await supabase
        .from("kanban_cards")
        .select("details")
        .eq("id", sim.obra_id)
        .single();
      const details = data?.details ?? {};
      sim = {
        ...sim,
        cnpj_cpf: sim.cnpj_cpf || details.cnpj_cpf || "",
        endereco: sim.endereco || details.fax || details.endereco_obra || "",
        vendedor: details.vendedor || sim.vendedor || "",
        orcamentista: details.orcamentista || sim.orcamentista || "",
        vendedor_email: details.outro_email || sim.vendedor_email || "",
        vendedor_telefone: details.vendedor_telefone || details.celular || details.telefone_comercial || sim.vendedor_telefone || "",
        contato_nome: details.contato_principal || "",
        contato_telefone: details.celular || details.telefone_comercial || details.tel_direto_comercial || "",
        contato_email: details.email_comercial || details.email_pessoal || "",
        forma_pagamento: details.forma_pagamento || sim.forma_pagamento || "A combinar",
        pag_garantia: details.pag_garantia || "",
        pag_prazo_entrega: details.pag_prazo_entrega || "",
        pag_prazo_execucao: details.pag_prazo_execucao || "",
        pag_dados_bancarios: details.pag_dados_bancarios || "",
        pag_razao_social: details.pag_razao_social || "",
      };
    } catch (err) {
      console.warn("Falha ao puxar dados do card:", err);
    }
  }

  // Auto-generate proposal number if missing
  if (!sim.numero || !String(sim.numero).trim()) {
    try {
      const { supabase } = await import("./supabase");
      const { data } = await supabase.from("simulacao_projetos").select("numero");
      const maxNum = (data ?? [])
        .map((r: { numero?: string }) => parseInt(String(r.numero ?? "").replace(/\D/g, ""), 10))
        .filter((n: number) => !isNaN(n))
        .reduce((a: number, b: number) => Math.max(a, b), 1499);
      const nextNum = String(maxNum + 1);
      sim = { ...sim, numero: nextNum };
      const simId = sim.id;
      if (simId) {
        await supabase.from("simulacao_projetos").update({ numero: nextNum }).eq("id", simId);
      }
    } catch (err) {
      console.warn("Falha ao auto-gerar número da proposta:", err);
      sim = { ...sim, numero: String(Date.now()).slice(-4) };
    }
  }

  // Enrich items with ferragens/insumos from orcamento_tabela_precos
  try {
    const { supabase } = await import("./supabase");
    const { data } = await supabase
      .from("orcamento_tabela_precos")
      .select("especie_nome, dimensao_obs, tipo_porta, categoria")
      .eq("ativo", true)
      .not("dimensao_obs", "is", null);
    if (data && data.length > 0) {
      itens = itens.map((item) => {
        const descLower = (item.descritivo || "").toLowerCase();
        const match = data.find(
          (r: { dimensao_obs?: string; especie_nome?: string }) =>
            r.dimensao_obs &&
            r.dimensao_obs.trim().length > 10 &&
            descLower.includes((r.especie_nome || "").toLowerCase())
        );
        if (match?.dimensao_obs) {
          const ferragens = match.dimensao_obs
            .split(/,\s*/)
            .map((s: string) => s.trim())
            .filter(Boolean)
            .map((s: string) => `\u2022 ${s}`)
            .join("\n");
          return { ...item, descritivo: `${item.descritivo}\n\nFerragens e Insumos:\n${ferragens}` };
        }
        return item;
      });
    }
  } catch (err) {
    console.warn("Falha ao buscar ferragens pra enriquecer PDF:", err);
  }

  // Generate HTML and open in new window
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const baseHref = origin + "/";
  let html = gerarPropostaHTML(sim, itens).replace(
    "<head>",
    `<head>\n<base href="${baseHref}">`
  );
  html = html.replace(
    /src="\/proposta-cover\.png"/g,
    `src="${origin}/proposta-cover.png"`
  );

  // Injeta script de auto-print INSIDE o popup — assim o polling roda no
  // próprio window do popup, sem segurar o event loop da aba pai.
  // Bug anterior: setTimeout(tryPrint) corria na aba pai, indefinidamente,
  // mesmo se o popup fosse fechado manualmente ou se imagens travassem
  // — congelava a aba pai e exigia reload.
  const autoPrintScript = `
    <script>
      (function () {
        var triggered = false;
        var attempts = 0;
        var MAX_ATTEMPTS = 50; // 50 * 200ms = 10s timeout duro
        function doPrint() {
          if (triggered) return;
          triggered = true;
          try { window.focus(); window.print(); } catch (e) { console.warn('print falhou', e); }
        }
        function ready() {
          attempts++;
          var imgs = Array.prototype.slice.call(document.images);
          var allLoaded = imgs.length === 0 ||
            imgs.every(function (img) { return img.complete && img.naturalWidth > 0; });
          if (allLoaded || attempts >= MAX_ATTEMPTS) {
            doPrint();
          } else {
            setTimeout(ready, 200);
          }
        }
        if (document.readyState === 'complete') {
          setTimeout(ready, 100);
        } else {
          window.addEventListener('load', function () { setTimeout(ready, 100); });
        }
      })();
    </script>
  `;
  html = html.replace("</body>", `${autoPrintScript}</body>`);

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Permita pop-ups para gerar a proposta.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  // O script injetado no HTML cuida do print() — não fazemos polling aqui.
}
