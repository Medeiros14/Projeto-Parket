/**
 * reportPdf — gerador do PDF do Report (relatório por vendedor do HomeBroker).
 * ==========================================================================
 * Isto NÃO é print de tela. O documento é desenhado vetorialmente com jsPDF:
 * texto de verdade (selecionável e pesquisável), barras desenhadas em vetor e
 * paginação própria. Por isso o arquivo sai completo mesmo que a tela esteja
 * rolada, com scroll ou com vendedor filtrado.
 *
 * Identidade: paleta do Sistema Operacional Parket no tema escuro, a mesma do
 * app (Preto Navona de fundo, Bege Travertino no texto, Chai nos acentos,
 * Olive/Walnut nos desfechos). Cantos retos, tipografia com tracking largo.
 *
 * Estrutura do arquivo:
 *   1. Capa com a marca, o recorte do relatório e o índice dos vendedores.
 *   2. Uma página por vendedor: KPIs + distribuição dele no funil de vendas.
 *   3. No modo "completo", logo após a página do vendedor: os fechamentos que
 *      ele fez no período e depois a lista de leads dele. No modo
 *      "performance" essas duas partes não existem.
 *
 * Duas leituras convivem (Will 2026-08-31): a SAFRA (leads que entraram no
 * período) manda no funil e na composição da carteira; os FECHAMENTOS (ganho ou
 * perda decididos dentro da janela, inclusive de lead antigo) mandam nos KPIs
 * de ganho, perda e aproveitamento.
 *
 * Escopo (Will 2026-08-29): tudo aqui é POR VENDEDOR. O documento não soma a
 * operação, não fala de campanha, investimento nem custo de mídia.
 *
 * Dinheiro no documento (Will 2026-08-31): pipeline estimado e ticket médio
 * saíram porque eram estimativa. O único valor que aparece é o dos ganhos, e ele
 * não é calculado aqui: vem pronto do orçamento do projeto em valor.parket.works,
 * já somado na tela. Ganho sem proposta vinculada sai com traço, nunca com zero.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Contrato de dados ───────────────────────────────────────
export type DesfechoPdf = "aberto" | "ganho" | "perda";

export type EtapaPdf = {
  label: string;          // "Em Negociação"
  desfecho: DesfechoPdf;  // pinta a barra
  qtd: number;
};

export type LeadPdf = {
  titulo: string;
  criadoEm: string;    // já formatado pt-BR
  entregueEm: string;
  ultimaAtiv: string;
  etapa: string;
};

/** Card que o vendedor levou para Ganho ou Perda dentro do período. */
export type FechamentoPdf = {
  titulo: string;
  criadoEm: string;    // já formatado pt-BR
  fechadoEm: string;
  desfecho: "ganho" | "perda";
  // Número e valor da proposta do ganho, já formatados. Vêm em branco quando o
  // card ganho não tem proposta vinculada no orçamento.
  proposta: string;
  valor: string;
};

export type VendedorPdf = {
  nome: string;
  totalLeads: number;
  abertos: number;
  ganhos: number;      // da safra: leads do período que estão em Ganho hoje
  perdas: number;
  // Fechamentos do período, contados por data de decisão e não pela safra: lead
  // antigo que fechou agora entra aqui (Will 2026-08-31).
  fechGanhos: number;
  fechPerdas: number;
  fechados: FechamentoPdf[];
  // Soma das propostas dos ganhos do período, já formatada, e quantos ganhos
  // ficaram de fora dela por não ter proposta vinculada.
  valorGanho: string;
  ganhosSemValor: number;
  etapas: EtapaPdf[];  // já na ordem do funil, só as que ele tem
  leads: LeadPdf[];
};

export type ReportPdfInput = {
  modo: "completo" | "performance";
  periodo: string;     // "30 dias"
  recorte: string;     // "Todos os leads" | "Só leads de campanha (qualificados pelo SDR)"
  usuario: string;
  vendedores: VendedorPdf[];
};

// ─── Paleta (tema escuro do HomeBroker) ──────────────────────
// Tripletas RGB espelhando as CSS vars de src/index.css. Onde a tela usa alpha
// sobre o preto, aqui vai a cor já pré-misturada, porque PDF não compõe alpha
// de graça e tom chapado imprime igual em qualquer visualizador.
type RGB = [number, number, number];
const C = {
  bg:         [5, 5, 5] as RGB,          // Preto Navona
  panel:      [16, 16, 15] as RGB,       // card sobre o preto
  panelLight: [26, 25, 24] as RGB,       // trilho das barras
  border:     [48, 46, 43] as RGB,       // borda visível no papel
  text:       [216, 211, 199] as RGB,    // Bege Travertino
  textDim:    [138, 133, 124] as RGB,    // Cinza Pedra clareado pra leitura
  accent:     [150, 132, 115] as RGB,    // Chai
  accentSoft: [43, 39, 35] as RGB,       // Chai a 15% sobre o preto
  green:      [124, 116, 74] as RGB,     // Olive
  red:        [160, 126, 114] as RGB,    // Walnut clareado
};

const corDesfecho = (d: DesfechoPdf): RGB =>
  d === "ganho" ? C.green : d === "perda" ? C.red : C.accent;

// ─── Geometria da folha (A4 retrato, tudo em mm) ─────────────
const W = 210;
const H = 297;
const M = 16;             // margem lateral
const CONTENT = W - M * 2;

// ─── Helpers de formatação ───────────────────────────────────
const fmtInt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

const pct = (parte: number, todo: number) => (todo > 0 ? `${Math.round((parte / todo) * 100)}%` : "n/d");

/**
 * Escreve texto com tracking. jsPDF mede charSpace na unidade do documento, ou
 * seja em mm aqui, então os valores são pequenos de propósito.
 */
function txt(
  doc: jsPDF, s: string, x: number, y: number,
  o: { size?: number; bold?: boolean; cor?: RGB; track?: number; align?: "left" | "right" | "center" } = {},
) {
  doc.setFontSize(o.size ?? 9);
  doc.setFont("helvetica", o.bold ? "bold" : "normal");
  doc.setTextColor(...(o.cor ?? C.text));
  doc.text(s, x, y, { charSpace: o.track ?? 0, align: o.align ?? "left" });
}

/** Pinta a folha inteira de preto. Toda página começa por aqui. */
function fundo(doc: jsPDF) {
  doc.setFillColor(...C.bg);
  doc.rect(0, 0, W, H, "F");
}

/**
 * Marca PARKET / HOME BROKER, a mesma do topo do app: quadrado com borda Chai
 * e o nome em duas linhas com tracking largo.
 */
function marca(doc: jsPDF, x: number, y: number, escala = 1) {
  const lado = 9 * escala;
  doc.setFillColor(...C.accentSoft);
  doc.setDrawColor(...C.accent);
  doc.setLineWidth(0.2);
  doc.rect(x, y, lado, lado, "FD");
  // Seta de tendência dentro do quadrado (eco do ícone TrendingUp do app)
  doc.setDrawColor(...C.accent);
  doc.setLineWidth(0.45 * escala);
  const p = (fx: number, fy: number): [number, number] => [x + lado * fx, y + lado * fy];
  const pts: [number, number][] = [p(0.2, 0.66), p(0.42, 0.44), p(0.58, 0.6), p(0.82, 0.32)];
  for (let i = 0; i < pts.length - 1; i++) doc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  doc.line(...p(0.82, 0.32), ...p(0.62, 0.32));
  doc.line(...p(0.82, 0.32), ...p(0.82, 0.5));

  txt(doc, "PARKET", x + lado + 3.2, y + 4 * escala, { size: 10 * escala, bold: true, track: 0.55 * escala });
  txt(doc, "HOME BROKER", x + lado + 3.2, y + 7.8 * escala, { size: 5.6 * escala, cor: C.textDim, track: 0.5 * escala });
}

/** Régua fina Chai usada para separar blocos. */
function regua(doc: jsPDF, x: number, y: number, larg: number, cor: RGB = C.border) {
  doc.setDrawColor(...cor);
  doc.setLineWidth(0.25);
  doc.line(x, y, x + larg, y);
}

/**
 * Título de seção: rótulo pequeno com tracking + régua embaixo. Devolve o y
 * onde o conteúdo da seção começa, para o chamador seguir empilhando.
 */
function secao(doc: jsPDF, rotulo: string, y: number): number {
  txt(doc, rotulo, M, y, { size: 6.8, cor: C.textDim, track: 0.6 });
  regua(doc, M, y + 3, CONTENT);
  return y + 8;
}

// ─── Capa ────────────────────────────────────────────────────
function capa(doc: jsPDF, d: ReportPdfInput) {
  fundo(doc);
  marca(doc, M, 20, 1.15);

  txt(doc, new Date().toLocaleString("pt-BR"), W - M, 26, { size: 7.5, cor: C.textDim, track: 0.2, align: "right" });

  // Título
  regua(doc, M, 70, CONTENT, C.accent);
  txt(doc, "REPORT", M, 94, { size: 38, bold: true, track: 2.4 });
  txt(doc, d.modo === "performance" ? "PERFORMANCE POR VENDEDOR" : "RELATÓRIO POR VENDEDOR",
    M, 104, { size: 11, cor: C.accent, track: 1.5 });

  // Ficha do recorte
  let y = 124;
  const ficha: [string, string][] = [
    ["PERÍODO", d.periodo],
    ["RECORTE", d.recorte],
    ["VENDEDORES", `${d.vendedores.length}`],
    ["EMITIDO POR", d.usuario || "-"],
  ];
  ficha.forEach(([k, v]) => {
    txt(doc, k, M, y, { size: 6.6, cor: C.textDim, track: 0.5 });
    txt(doc, v, M + 34, y, { size: 9.5 });
    y += 7.5;
  });

  // Índice dos vendedores. É informação por vendedor, não total da operação:
  // cada linha traz os números do próprio vendedor.
  y += 12;
  y = secao(doc, "VENDEDORES NESTE RELATÓRIO", y);

  const maxLeads = Math.max(1, ...d.vendedores.map((v) => v.totalLeads));
  const xBar = M + 62;
  const larguraBar = 62;

  // Teto de 12 linhas: acima disso a capa estouraria a folha. O corte é só do
  // índice, todo vendedor continua tendo a página dele no documento.
  d.vendedores.slice(0, 12).forEach((v, i) => {
    txt(doc, `${String(i + 1).padStart(2, "0")}`, M, y, { size: 7, cor: C.accent, track: 0.3 });
    txt(doc, v.nome.length > 26 ? v.nome.slice(0, 25) + "…" : v.nome, M + 7, y, { size: 9 });

    // Barra proporcional aos leads do vendedor
    doc.setFillColor(...C.panelLight);
    doc.rect(xBar, y - 3, larguraBar, 4, "F");
    doc.setFillColor(...C.accent);
    doc.rect(xBar, y - 3, Math.max(1, (v.totalLeads / maxLeads) * larguraBar), 4, "F");

    txt(doc, `${fmtInt(v.totalLeads)} leads`, xBar + larguraBar + 5, y, { size: 8, cor: C.textDim });
    // Ganho aqui é o que ele FECHOU no período, não o desfecho da safra: lead
    // antigo que decidiu agora conta pro vendedor (Will 2026-08-31).
    txt(doc, `${fmtInt(v.fechGanhos)} ganho${v.fechGanhos !== 1 ? "s" : ""}`, W - M - 26, y, { size: 8, cor: C.green, align: "right" });
    txt(doc, pct(v.fechGanhos, v.fechGanhos + v.fechPerdas), W - M, y, { size: 8, bold: true, align: "right" });
    y += 9;
  });

  txt(doc, "homebroker.parket.works/report", M, H - 14, { size: 6.6, cor: C.textDim, track: 0.4 });
}

// ─── Cabeçalho e rodapé das páginas internas ────────────────
function cabecalho(doc: jsPDF, d: ReportPdfInput) {
  marca(doc, M, 14, 0.72);
  txt(doc, "REPORT POR VENDEDOR", W - M, 18, { size: 6.6, cor: C.textDim, track: 0.55, align: "right" });
  txt(doc, `${d.periodo} · ${d.recorte}`, W - M, 22, { size: 6.6, cor: C.textDim, track: 0.2, align: "right" });
  regua(doc, M, 27, CONTENT, C.accent);
}

/** Numera as páginas no fim, quando o total já é conhecido. */
function rodapes(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    regua(doc, M, H - 16, CONTENT);
    txt(doc, "Parket Home Broker", M, H - 11, { size: 6.6, cor: C.textDim, track: 0.4 });
    txt(doc, `${p} / ${total}`, W - M, H - 11, { size: 6.6, cor: C.textDim, align: "right" });
  }
}

// ─── Página do vendedor ──────────────────────────────────────
function paginaVendedor(doc: jsPDF, d: ReportPdfInput, v: VendedorPdf) {
  doc.addPage();
  fundo(doc);
  cabecalho(doc, d);

  // Nome do vendedor
  let y = 44;
  txt(doc, v.nome.toUpperCase(), M, y, { size: 19, bold: true, track: 0.9 });
  y += 6;
  txt(doc, `${fmtInt(v.totalLeads)} lead${v.totalLeads !== 1 ? "s" : ""} no pipeline de vendas no período`,
    M, y, { size: 8, cor: C.textDim });
  y += 4.6;
  txt(doc, "Ganhos e perdas contados pela data em que o vendedor fechou, inclusive de lead antigo.",
    M, y, { size: 7, cor: C.textDim });
  y += 10;

  // ─── KPIs ──────────────────────────────────────────────────
  // Leads e Em aberto olham a safra do período. Ganhos, Perdas e Aproveitamento
  // olham o que ele fechou dentro do período, que é outra conta.
  const fechTotal = v.fechGanhos + v.fechPerdas;
  const kpis: { label: string; valor: string; cor?: RGB }[] = [
    { label: "LEADS", valor: fmtInt(v.totalLeads) },
    { label: "EM ABERTO", valor: fmtInt(v.abertos) },
    { label: "GANHOS NO PERÍODO", valor: fmtInt(v.fechGanhos), cor: C.green },
    { label: "PERDAS NO PERÍODO", valor: fmtInt(v.fechPerdas), cor: C.red },
    { label: "APROVEITAMENTO", valor: pct(v.fechGanhos, fechTotal), cor: C.accent },
    { label: "VALOR GANHO", valor: v.fechGanhos > 0 ? v.valorGanho : "n/d", cor: C.green },
  ];
  // Grade de 3 colunas por linha, 2 linhas. Os 6 numa linha só davam cartão de
  // 27mm de largura, e rótulo comprido ("GANHOS NO PERÍODO" mede uns 26mm com o
  // tracking) vazava a caixa. Com 3 por linha o cartão fica com 57mm e sobra.
  const gap = 3;
  const colunas = 3;
  const cw = (CONTENT - gap * (colunas - 1)) / colunas;
  const ch = 21;
  const yKpis = y;
  kpis.forEach((k, i) => {
    const x = M + (i % colunas) * (cw + gap);
    const yc = yKpis + Math.floor(i / colunas) * (ch + gap);
    doc.setFillColor(...C.panel);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.rect(x, yc, cw, ch, "FD");
    txt(doc, k.label, x + 3, yc + 6, { size: 6, cor: C.textDim, track: 0.45 });
    // O corpo do KPI encolhe até caber no cartão. Contagem cabe folgada em 15,
    // mas valor em reais ("R$ 135.252,36") não cabe, e aqui vale mais o número
    // exato do que o tamanho uniforme: o Will confere o total contra o orçamento.
    let size = 15;
    doc.setFont("helvetica", "bold");
    while (size > 7) {
      doc.setFontSize(size);
      if (doc.getTextWidth(k.valor) <= cw - 6) break;
      size -= 0.5;
    }
    txt(doc, k.valor, x + 3, yc + 16, { size, bold: true, cor: k.cor ?? C.text });
  });
  y = yKpis + Math.ceil(kpis.length / colunas) * (ch + gap) + 9;

  // ─── Distribuição no funil ─────────────────────────────────
  // Layout em colunas fixas: rótulo | qtd | barra | %. A barra é só gráfico,
  // nenhum texto entra dentro dela, então etapa pequena não vira texto
  // derramado por cima do trilho.
  // O título diz "safra" porque este bloco conta só os leads que entraram no
  // período, então Ganho e Perda daqui não batem com os KPIs de fechamento.
  y = secao(doc, "DISTRIBUIÇÃO NO FUNIL DE VENDAS, SAFRA DO PERÍODO", y);

  const xQtd = M + 56;          // fim da coluna de quantidade (alinhada à direita)
  const xBar = M + 60;
  const xPct = W - M;           // fim da coluna de percentual
  const barW = xPct - 14 - xBar;

  if (v.etapas.length === 0) {
    txt(doc, "Sem lead nas etapas do funil neste período.", M, y + 4, { size: 8, cor: C.textDim });
    y += 12;
  } else {
    const maxQtd = Math.max(1, ...v.etapas.map((e) => e.qtd));
    v.etapas.forEach((e) => {
      txt(doc, e.label, M, y + 4, { size: 8.2 });
      txt(doc, fmtInt(e.qtd), xQtd, y + 4, { size: 8.2, bold: true, cor: corDesfecho(e.desfecho), align: "right" });
      // trilho
      doc.setFillColor(...C.panelLight);
      doc.rect(xBar, y + 0.6, barW, 5, "F");
      // preenchimento proporcional à maior etapa DO PRÓPRIO vendedor
      doc.setFillColor(...corDesfecho(e.desfecho));
      doc.rect(xBar, y + 0.6, Math.max(0.8, (e.qtd / maxQtd) * barW), 5, "F");
      txt(doc, pct(e.qtd, v.totalLeads), xPct, y + 4, { size: 8, bold: true, align: "right" });
      y += 9.4;
    });
  }

  // ─── Composição da carteira ────────────────────────────────
  // Barra 100% empilhada: onde estão os leads dele hoje (aberto, ganho,
  // perdido).
  y += 10;
  y = secao(doc, "COMPOSIÇÃO DA CARTEIRA", y);

  const fatias: { rotulo: string; qtd: number; cor: RGB }[] = [
    { rotulo: "EM ABERTO", qtd: v.abertos, cor: C.accent },
    { rotulo: "GANHOS", qtd: v.ganhos, cor: C.green },
    { rotulo: "PERDAS", qtd: v.perdas, cor: C.red },
  ];
  const totalFatias = Math.max(1, fatias.reduce((a, f) => a + f.qtd, 0));

  // Trilho cheio primeiro, depois cada fatia por cima na proporção da carteira
  y += 2;
  doc.setFillColor(...C.panelLight);
  doc.rect(M, y, CONTENT, 8, "F");
  let xFatia = M;
  fatias.forEach((f) => {
    const larg = (f.qtd / totalFatias) * CONTENT;
    if (larg <= 0) return;
    doc.setFillColor(...f.cor);
    doc.rect(xFatia, y, larg, 8, "F");
    xFatia += larg;
  });
  y += 17;

  // Legenda em três colunas, uma por fatia
  const colL = CONTENT / 3;
  fatias.forEach((f, i) => {
    const x = M + i * colL;
    doc.setFillColor(...f.cor);
    doc.rect(x, y - 2.4, 2.4, 2.4, "F");
    txt(doc, f.rotulo, x + 4.6, y, { size: 6.4, cor: C.textDim, track: 0.45 });
    txt(doc, `${fmtInt(f.qtd)} lead${f.qtd !== 1 ? "s" : ""}`, x, y + 8, { size: 12, bold: true });
    txt(doc, `${pct(f.qtd, totalFatias)} da carteira`, x, y + 13.5, { size: 6.8, cor: C.textDim });
  });
}

// ─── Fechamentos do período (só no modo completo) ────────────
/**
 * Lista nominal do que o vendedor levou para Ganho ou Perda dentro da janela.
 * É a prova do número de ganhos: sem esta tabela o vendedor não consegue
 * conferir quais negócios entraram na conta, já que muitos são de lead antigo
 * e por isso não aparecem na lista de leads recebidos.
 */
function tabelaFechamentos(doc: jsPDF, d: ReportPdfInput, v: VendedorPdf) {
  if (v.fechados.length === 0) return;
  doc.addPage();

  let primeiraFolha = true;

  autoTable(doc, {
    startY: 55,
    // O número da proposta vem logo depois do cliente porque é assim que o
    // comercial identifica o negócio: o título do card costuma ser o nome do
    // arquiteto ou um apelido, então só ele não fecha a conferência.
    head: [["Cliente", "Proposta", "Entrou", "Fechou em", "Desfecho", "Valor"]],
    body: v.fechados.map((f) => [
      f.titulo, f.proposta, f.criadoEm, f.fechadoEm,
      f.desfecho === "ganho" ? "Ganho" : "Perda", f.valor,
    ]),
    theme: "plain",
    styles: {
      font: "helvetica", fontSize: 7.5, cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 },
      textColor: C.text, lineColor: C.border, lineWidth: { bottom: 0.1 },
    },
    headStyles: {
      fillColor: C.accentSoft, textColor: C.accent, fontStyle: "bold",
      fontSize: 6.4, cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 },
    },
    alternateRowStyles: { fillColor: C.panel },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 18 },
      4: { cellWidth: 20 },
      5: { cellWidth: 30, halign: "right" },
    },
    margin: { left: M, right: M, top: 55, bottom: 22 },
    // Desfecho sai colorido (Olive pra ganho, Walnut pra perda) pra leitura
    // rápida da coluna sem precisar ler palavra por palavra. O valor do ganho
    // segue a mesma cor; perda não tem valor e fica apagada.
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const ganho = v.fechados[data.row.index]?.desfecho === "ganho";
      if (data.column.index === 4) {
        data.cell.styles.textColor = ganho ? C.green : C.red;
        data.cell.styles.fontStyle = "bold";
      } else if (data.column.index === 5) {
        data.cell.styles.textColor = ganho ? C.green : C.textDim;
      }
    },
    willDrawPage: () => {
      fundo(doc);
      cabecalho(doc, d);
      txt(doc, v.nome.toUpperCase(), M, 44, { size: 13, bold: true, track: 0.7 });
      txt(doc, primeiraFolha
        ? `FECHAMENTOS NO PERÍODO (${fmtInt(v.fechados.length)})`
        : "FECHAMENTOS NO PERÍODO, CONTINUAÇÃO",
        M, 50, { size: 6.6, cor: C.textDim, track: 0.55 });
      primeiraFolha = false;
    },
  });
}

// ─── Lista de leads (só no modo completo) ────────────────────
function tabelaLeads(doc: jsPDF, d: ReportPdfInput, v: VendedorPdf) {
  if (v.leads.length === 0) return;
  doc.addPage();

  // Quando a lista passa de uma folha a própria autoTable cria a página
  // seguinte, então o topo é desenhado aqui dentro e não antes da tabela.
  let primeiraFolha = true;

  autoTable(doc, {
    startY: 55,
    head: [["Cliente", "Entrou", "Entregue", "Última ativ.", "Etapa atual"]],
    body: v.leads.map((l) => [l.titulo, l.criadoEm, l.entregueEm, l.ultimaAtiv, l.etapa]),
    theme: "plain",
    styles: {
      font: "helvetica", fontSize: 7.5, cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 },
      textColor: C.text, lineColor: C.border, lineWidth: { bottom: 0.1 },
    },
    headStyles: {
      fillColor: C.accentSoft, textColor: C.accent, fontStyle: "bold",
      fontSize: 6.4, cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 },
    },
    alternateRowStyles: { fillColor: C.panel },
    columnStyles: {
      0: { cellWidth: 58 },
    },
    margin: { left: M, right: M, top: 55, bottom: 22 },
    // Pinta o fundo preto e o topo ANTES da tabela: sem isso as páginas que a
    // própria autoTable cria sairiam brancas e sem identificação do vendedor.
    willDrawPage: () => {
      fundo(doc);
      cabecalho(doc, d);
      txt(doc, v.nome.toUpperCase(), M, 44, { size: 13, bold: true, track: 0.7 });
      txt(doc, primeiraFolha ? `LEADS RECEBIDOS (${fmtInt(v.leads.length)})` : "LEADS RECEBIDOS, CONTINUAÇÃO",
        M, 50, { size: 6.6, cor: C.textDim, track: 0.55 });
      primeiraFolha = false;
    },
  });
}

// ─── API pública ─────────────────────────────────────────────
/**
 * Monta o documento inteiro e devolve o jsPDF. O modo "performance" leva todos
 * os vendedores, um por página, só com os números. O "completo" acrescenta a
 * lista de leads de cada um.
 */
export function gerarReportPdf(d: ReportPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setProperties({
    title: `Report ${d.modo === "performance" ? "Performance" : "Completo"} (${d.periodo})`,
    subject: "Relatório de desempenho por vendedor",
    author: "Parket Home Broker",
    creator: "homebroker.parket.works",
  });

  capa(doc, d);
  d.vendedores.forEach((v) => {
    paginaVendedor(doc, d, v);
    if (d.modo === "completo") {
      tabelaFechamentos(doc, d, v);
      tabelaLeads(doc, d, v);
    }
  });
  rodapes(doc);
  return doc;
}

/** Nome de arquivo estável e legível, com o recorte embutido. */
export function nomeArquivoReport(d: ReportPdfInput): string {
  const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const hoje = new Date().toISOString().slice(0, 10);
  return `report-${d.modo}-${slug(d.periodo)}-${hoje}.pdf`;
}
