/**
 * laudo-pdf.ts — Relatórios do Fiscal (PDF paisagem A4, modelo Parket)
 *
 * Port fiel dos modelos da pasta de obra (Fase 4 — Fiscal e Contratual):
 *  - 9.1  Relatório Técnico / 1ª Vistoria  → gerarLaudoPdf (tipo != acompanhamento)
 *  - 9.2  Termo de Ciência e Responsabilidade → gerarTermoPdf
 *  - 9.3  Relatório Fotográfico → seção "ACOMPANHAMENTO DE OBRAS" (grid 2 col)
 *  - 9.4  Relatório de Acompanhamento → gerarLaudoPdf (tipo acompanhamento)
 */
import jsPDF from "jspdf";
import type { LaudoDetalhado, Foto, RelatorioDados } from "../api";

const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

const DARK: [number, number, number] = [77, 77, 77];   // headers cinza escuro do modelo
const BORDER: [number, number, number] = [120, 120, 120];
const ACCENT: [number, number, number] = [199, 164, 91]; // ocre Parket — realces (resumo cliente)

export interface LaudoPdfInput {
  laudo: LaudoDetalhado;
  fotos?: Foto[];
}

/* ═══════════════ helpers ═══════════════ */

function fmtDataBR(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
    return d.toLocaleDateString("pt-BR");
  } catch { return iso; }
}

function fmtDataHora(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " +
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

const DIAS_SEMANA = ["Domingo", "Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado"];

function relatorioNumeroLabel(d: RelatorioDados): string {
  if (!d.relatorio_numero && !d.relatorio_data) return "";
  const num = d.relatorio_numero != null ? String(d.relatorio_numero) : "—";
  if (!d.relatorio_data) return num;
  try {
    const dt = new Date(d.relatorio_data + "T12:00:00");
    return `${num} - ${dt.toLocaleDateString("pt-BR")} (${DIAS_SEMANA[dt.getDay()]})`;
  } catch { return `${num} - ${d.relatorio_data}`; }
}

/** Imagem (url http ou data:) → data-URI JPEG, max 800×600. */
async function toDataUri(url: string): Promise<string | null> {
  if (url.startsWith("data:image/")) return url;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    const scale = Math.min(800 / bmp.width, 600 / bmp.height, 1);
    canvas.width = bmp.width * scale;
    canvas.height = bmp.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch { return null; }
}

/** Capa preta PARKET (modelo). */
function capa(doc: jsPDF, subtitulo: string) {
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(52);
  doc.text("PARKET", 30, PAGE_H * 0.42);
  doc.setFontSize(13);
  doc.setTextColor(230, 230, 230);
  doc.text(subtitulo.toUpperCase(), 30.5, PAGE_H * 0.42 + 10);
}

/** Barra de seção cinza escuro com título branco centralizado (modelo). */
function barra(doc: jsPDF, y: number, titulo: string): number {
  doc.setFillColor(...DARK);
  doc.rect(MARGIN, y, CONTENT_W, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(titulo, PAGE_W / 2, y + 5.5, { align: "center" });
  return y + 11;
}

function quebra(doc: jsPDF, y: number, alturaMin: number): number {
  if (y + alturaMin > PAGE_H - 12) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

/* ═══════════════ RELATÓRIO (9.1 / 9.4) ═══════════════ */

export async function gerarLaudoPdf({ laudo, fotos }: LaudoPdfInput): Promise<void> {
  const d: RelatorioDados = laudo.relatorio_dados || {};
  const isAcomp = laudo.tipo === "acompanhamento";

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  capa(doc, isAcomp ? "ACOMPANHAMENTO DE OBRAS"
    : laudo.tipo === "fotografico" ? "RELATÓRIO FOTOGRÁFICO" : "RELATÓRIO TÉCNICO");

  /* ─── página de dados ─── */
  doc.addPage();
  let y = MARGIN;

  if (isAcomp) {
    // 9.4: tabela com borda, 1ª linha escura
    const rows: [string, string][] = [
      ["CLIENTE", (laudo.cliente || "").toUpperCase()],
      ["OBRA:", laudo.obra || ""],
      ["RESPONSAVEL:", d.responsavel || laudo.fiscal_nome || ""],
      ["ENDEREÇO", laudo.endereco || ""],
      ["RELATÓRIO N°:", relatorioNumeroLabel(d)],
    ];
    const labelW = 55;
    const rowH = 8;
    rows.forEach(([label, value], i) => {
      if (i === 0) {
        doc.setFillColor(...DARK);
        doc.rect(MARGIN, y, CONTENT_W, rowH, "F");
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setTextColor(30, 30, 30);
      }
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(0.3);
      doc.rect(MARGIN, y, labelW, rowH, "S");
      doc.rect(MARGIN + labelW, y, CONTENT_W - labelW, rowH, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(label, MARGIN + 2.5, y + 5.3);
      doc.setFont("helvetica", "normal");
      doc.text(value, MARGIN + labelW + 2.5, y + 5.3);
      y += rowH;
    });
    y += 8;
  } else {
    // 9.1: linhas com separador sutil
    const rows: [string, string][] = [
      ["CLIENTE", (laudo.cliente || "").toUpperCase()],
      ["VENDEDOR", (d.vendedor || "").toUpperCase()],
      ["RESPONSÁVEL", d.responsavel || laudo.fiscal_nome || "_______________________"],
      ["ENDEREÇO", (laudo.endereco || "").toUpperCase()],
    ];
    const labelW = 75;
    const rowH = 9;
    for (const [label, value] of rows) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text(label, MARGIN + 1, y + 5.5);
      doc.setFont("helvetica", "normal");
      doc.text(value, MARGIN + labelW, y + 5.5);
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH);
      y += rowH;
    }
    y += 8;
  }

  /* ─── DESCRIÇÃO DO PRODUTO ─── */
  y = barra(doc, y, "DESCRIÇÃO DO PRODUTO");
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const descProduto = d.descricao_produto || "";
  if (descProduto) {
    const lines = doc.splitTextToSize(descProduto, CONTENT_W - 2);
    doc.text(lines, MARGIN + 1, y + 3);
    y += lines.length * 4.5 + 7;
  } else {
    y += 8; // caixa em branco, como no modelo
  }

  /* ─── DESCRIÇÃO DO SERVIÇO CONTRATADO ─── */
  const servicos = d.servico_contratado || [];
  if (servicos.length > 0) {
    y = quebra(doc, y, 30);
    const cols = [CONTENT_W - 135, 45, 45, 45];
    const headers = ["DESCRIÇÃO DO SERVIÇO CONTRATADO", "QUANTIDADE", "PREVISÃO DE INÍCIO", "LIBERAÇÃO"];
    doc.setFillColor(...DARK);
    doc.rect(MARGIN, y, CONTENT_W, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let cx = MARGIN;
    headers.forEach((h, i) => {
      doc.text(h, cx + cols[i] / 2, y + 5.3, { align: "center" });
      cx += cols[i];
    });
    y += 8;
    doc.setTextColor(30, 30, 30);
    for (const s of servicos) {
      const descLines = doc.splitTextToSize(s.descricao || "", cols[0] - 5);
      const rh = Math.max(10, descLines.length * 4 + 5);
      y = quebra(doc, y, rh);
      let bx = MARGIN;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      for (const w of cols) { doc.rect(bx, y, w, rh, "S"); bx += w; }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(descLines, MARGIN + 2.5, y + 5);
      doc.text(s.quantidade || "", MARGIN + cols[0] + cols[1] / 2, y + rh / 2 + 1.3, { align: "center" });
      doc.text(s.previsao_inicio || "", MARGIN + cols[0] + cols[1] + cols[2] / 2, y + rh / 2 + 1.3, { align: "center" });
      doc.text(s.liberacao || "", MARGIN + cols[0] + cols[1] + cols[2] + cols[3] / 2, y + rh / 2 + 1.3, { align: "center" });
      y += rh;
    }
    y += 8;
  }

  /* ─── MEDIÇÃO EM OBRA ─── */
  const medicao = d.medicao_itens || [];
  if (medicao.length > 0) {
    y = quebra(doc, y, 30);
    y = barra(doc, y, "MEDIÇÃO EM OBRA (a preencher pelo fiscal)") - 3;
    const cols = [22, CONTENT_W - 22 - 42, 42];
    const headers = ["ITEM", "DESCRIÇÃO DO ITEM CONTRATADO", "QTD / M²"];
    doc.setFillColor(...DARK);
    doc.rect(MARGIN, y, CONTENT_W, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let cx = MARGIN;
    headers.forEach((h, i) => {
      doc.text(h, cx + cols[i] / 2, y + 4.8, { align: "center" });
      cx += cols[i];
    });
    y += 7;
    doc.setTextColor(30, 30, 30);
    for (const m of medicao) {
      const rh = 7.5;
      y = quebra(doc, y, rh);
      let bx = MARGIN;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      for (const w of cols) { doc.rect(bx, y, w, rh, "S"); bx += w; }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(m.item || "", MARGIN + cols[0] / 2, y + 5, { align: "center" });
      doc.text((m.descricao || "").slice(0, 130), MARGIN + cols[0] + 2.5, y + 5);
      doc.text(m.qtd || "", MARGIN + cols[0] + cols[1] + cols[2] / 2, y + 5, { align: "center" });
      y += rh;
    }
    y += 8;
  }

  /* ─── RELATÓRIO (entradas timestampadas — 9.4) ─── */
  const entradas = d.entradas || [];
  if (entradas.length > 0) {
    y = quebra(doc, y, 30);
    y = barra(doc, y, "RELATÓRIO");
    for (const e of entradas) {
      y = quebra(doc, y, 14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      const autor = e.autor || "—";
      doc.text(autor, MARGIN + 1, y + 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text(fmtDataHora(e.data), MARGIN + 3 + doc.getTextWidth(autor) + 2, y + 3);
      y += 8;
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(e.texto || "", CONTENT_W - 4);
      for (const line of lines) {
        y = quebra(doc, y, 5);
        doc.text(line, MARGIN + 2, y);
        y += 4.3;
      }
      y += 5;
    }
  }

  /* ─── OBSERVAÇÕES ─── */
  y = quebra(doc, y, 36);
  y = barra(doc, y, "OBSERVAÇÕES") - 3;
  const obsLines = laudo.observacoes
    ? doc.splitTextToSize(laudo.observacoes, CONTENT_W - 6) : [];
  const obsH = Math.max(24, obsLines.length * 4.5 + 8);
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CONTENT_W, obsH, "S");
  if (obsLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(obsLines, MARGIN + 3, y + 6);
  }
  y += obsH + 10;

  /* ─── RESUMO TÉCNICO PARA O CLIENTE (texto lapidado pela IA) ───
     É o que o cliente lê antes de assinar o aceite. Fica na cor accent
     pra destacar do resto do relatório. Se o resumo estiver vazio, imprime
     uma caixa com pauta pra o técnico preencher à mão. */
  const resumoCliente = (d.lapidado?.resumo || "").trim();
  const temResumo = resumoCliente.length > 0;
  const resumoLines = temResumo
    ? doc.splitTextToSize(resumoCliente, CONTENT_W - 10)
    : [];
  // Se não tem resumo, caixa maior com pauta (~6 linhas em branco)
  const resumoH = temResumo ? resumoLines.length * 4.8 + 14 : 44;
  y = quebra(doc, y, resumoH + 24);
  y = barra(doc, y, "RESUMO TÉCNICO PARA O CLIENTE") - 3;
  // Caixa em tom accent claro (fundo bege sutil)
  doc.setFillColor(250, 245, 232);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, y, CONTENT_W, resumoH, "FD");
  if (temResumo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);
    doc.text(resumoLines, MARGIN + 5, y + 8);
  } else {
    // Pauta cinza clara pra escrita à mão
    doc.setDrawColor(190, 180, 155);
    doc.setLineWidth(0.15);
    for (let ly = y + 10; ly <= y + resumoH - 4; ly += 7) {
      doc.line(MARGIN + 5, ly, MARGIN + CONTENT_W - 5, ly);
    }
  }
  y += resumoH + 6;

  // Frase de aceite (o cliente assina reconhecendo o resumo)
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  const aceiteTxt = "Declaro que li e concordo com o resumo técnico acima, autorizando o prosseguimento da obra nos termos apresentados.";
  const aceiteLines = doc.splitTextToSize(aceiteTxt, CONTENT_W - 6);
  doc.text(aceiteLines, MARGIN + 3, y + 4);
  y += aceiteLines.length * 4 + 8;

  /* ─── FOTOS — ACOMPANHAMENTO DE OBRAS (9.3/9.4: grid 2 colunas) ─── */
  const midias = (fotos || []).filter(f => f.url && (f.tipo || "").toLowerCase() !== "video");
  if (midias.length > 0) {
    doc.addPage();
    y = barra(doc, MARGIN, "ACOMPANHAMENTO DE OBRAS");
    const thumbW = 62;
    const thumbH = 78;
    const colX = [PAGE_W / 2 - thumbW - 25, PAGE_W / 2 + 25];
    let slot = 0;
    for (const f of midias) {
      const uri = await toDataUri(f.url);
      const col = slot % 2;
      if (col === 0 && slot > 0) y += thumbH + 6;
      if (y + thumbH > PAGE_H - 10) {
        doc.addPage();
        y = MARGIN;
        slot = 0;
      }
      const px = colX[col];
      if (uri) {
        try { doc.addImage(uri, "JPEG", px, y, thumbW, thumbH); }
        catch { /* pula thumb inválida */ }
      } else {
        doc.setFillColor(235, 235, 235);
        doc.rect(px, y, thumbW, thumbH, "F");
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("FOTO", px + thumbW / 2, y + thumbH / 2, { align: "center" });
      }
      if (f.ambiente || f.descricao) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(90, 90, 90);
        doc.text((f.ambiente || f.descricao || "").slice(0, 60), px, y + thumbH + 3.5);
      }
      slot++;
    }
    y += thumbH + 14;
  }

  /* ─── assinaturas (9.4) ─── */
  if (isAcomp) {
    y = quebra(doc, y, 30);
    y = Math.max(y, PAGE_H - 40);
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.3);
    const w = 95;
    const x1 = MARGIN + 20;
    const x2 = PAGE_W - MARGIN - 20 - w;
    doc.line(x1, y, x1 + w, y);
    doc.line(x2, y, x2 + w, y);
    const ass = d.termo || {};
    if (ass.resp_ass) {
      try { doc.addImage(ass.resp_ass, "PNG", x1 + (w - 46) / 2, y - 15.5, 46, 14); } catch { /* segue sem carimbo */ }
    }
    if (ass.tecnico_ass) {
      try { doc.addImage(ass.tecnico_ass, "PNG", x2 + (w - 46) / 2, y - 15.5, 46, 14); } catch { /* segue sem carimbo */ }
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    // Labels mais explícitos: 1ª = cliente (aceite do resumo), 2ª = técnico Parket
    doc.text("CLIENTE (ACEITE)", x1 + w / 2, y + 5, { align: "center" });
    doc.text("TÉCNICO PARKET", x2 + w / 2, y + 5, { align: "center" });
    // Nomes/CPF/Data abaixo (se existirem no termo)
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    const respLabel = ass.resp_obra
      ? `${ass.resp_obra}${ass.resp_data ? ` · ${ass.resp_data}` : ""}`
      : "";
    const tecLabel = (ass.tecnico || laudo.fiscal_nome)
      ? `${ass.tecnico || laudo.fiscal_nome}${ass.tecnico_data ? ` · ${ass.tecnico_data}` : ""}`
      : "";
    if (respLabel) doc.text(respLabel, x1 + w / 2, y + 9.5, { align: "center" });
    if (tecLabel)  doc.text(tecLabel,  x2 + w / 2, y + 9.5, { align: "center" });
  }

  const tipoNome = isAcomp ? "ACOMPANHAMENTO"
    : laudo.tipo === "fotografico" ? "RELATORIO FOTOGRAFICO" : "RELATORIO TECNICO";
  const filename = `${tipoNome} - ${laudo.cliente || laudo.obra || "OBRA"}`
    .replace(/[^a-zA-Z0-9À-ÿ\s\-]/g, "").trim();
  doc.save(`${filename}.pdf`);
}

/* ═══════════════ TERMO (9.2) ═══════════════ */

export const TERMO_INTRO =
  "Pelo presente Termo de Ciência, a CONTRATANTE declara estar ciente de que, durante a vistoria técnica " +
  "realizada no local da obra, foi constatada a seguinte condição:";

export const TERMO_CORPO =
  "A CONTRATANTE declara estar plenamente ciente da condição acima descrita, reconhecendo que a eventual " +
  "correção exigiria intervenções que não fazem parte do escopo contratado, e autoriza a continuidade dos " +
  "serviços nas condições atuais da obra, não podendo tal condição ser caracterizada como defeito de material, " +
  "falha de execução ou inconformidade dos serviços prestados pela CONTRATADA. Fica a CONTRATADA isenta de " +
  "responsabilidades relativas a reclamações, ajustes ou retrabalhos relacionados à condição previamente " +
  "identificada, comunicada e aceita pela CONTRATANTE.";

/* ═══════════════ TERMO DE ENTREGA E RECEBIMENTO DE OBRA ═══════════════ */

export const ENTREGA_TERMO_PARAGRAFOS = [
  "É com satisfação que a Parket formaliza a entrega da obra, executada conforme as especificações " +
  "acordadas e nos termos contratuais firmados entre as partes.",
  "A CONTRATANTE declara receber a obra pronta e acabada, incluindo os serviços de instalações " +
  "executados, manifestando sua concordância com o resultado entregue.",
  "Permanecem asseguradas as garantias legais e contratuais aplicáveis aos serviços executados.",
];

export function gerarTermoPdf({ laudo }: LaudoPdfInput): void {
  const d: RelatorioDados = laudo.relatorio_dados || {};
  const termo = d.termo || {};

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  capa(doc, "TERMO DE CIÊNCIA E RESPONSABILIDADE");

  doc.addPage();
  let y = MARGIN;

  /* header: OBRA | DATA / ENDEREÇO | RESP. OBRA */
  const labelW = 32;
  const rightLabelW = 32;
  const leftValW = CONTENT_W * 0.62 - labelW;
  const rightValW = CONTENT_W - labelW - leftValW - rightLabelW;

  const headerRows: [string, string, string, string][] = [
    ["OBRA", (laudo.cliente || laudo.obra || "").toUpperCase(), "DATA", fmtDataBR(laudo.data_vistoria) || ""],
    ["ENDEREÇO", (laudo.endereco || "").toUpperCase(), "RESP. OBRA", termo.resp_obra || ""],
  ];
  for (const [l1, v1, l2, v2] of headerRows) {
    const v1Lines = doc.splitTextToSize(v1, leftValW - 5);
    const rh = Math.max(10, v1Lines.length * 4 + 5);
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.3);
    doc.setFillColor(240, 240, 240);
    doc.rect(MARGIN, y, labelW, rh, "FD");
    doc.rect(MARGIN + labelW, y, leftValW, rh, "S");
    doc.setFillColor(240, 240, 240);
    doc.rect(MARGIN + labelW + leftValW, y, rightLabelW, rh, "FD");
    doc.rect(MARGIN + labelW + leftValW + rightLabelW, y, rightValW, rh, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    doc.text(l1, MARGIN + labelW / 2, y + rh / 2 + 1.3, { align: "center" });
    doc.text(l2, MARGIN + labelW + leftValW + rightLabelW / 2, y + rh / 2 + 1.3, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(v1Lines, MARGIN + labelW + 2.5, y + rh / 2 + 1.3 - (v1Lines.length - 1) * 2);
    doc.text(v2, MARGIN + labelW + leftValW + rightLabelW + 2.5, y + rh / 2 + 1.3);
    y += rh;
  }
  y += 10;

  /* intro */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  const introLines = doc.splitTextToSize(TERMO_INTRO, CONTENT_W);
  doc.text(introLines, MARGIN, y);
  y += introLines.length * 4.5 + 6;

  /* caixa da condição constatada — recebe o RESUMO TÉCNICO lapidado pela IA
     como fonte primária (é o texto que descreve a condição da obra vista
     na vistoria). Se não houver lapidado, cai no `termo.condicao` manual. */
  const condTexto = (d.lapidado?.resumo || "").trim() || (termo.condicao || "").trim();
  const condLines = condTexto ? doc.splitTextToSize(condTexto, CONTENT_W - 8) : [];
  const condH = Math.max(28, condLines.length * 4.5 + 10);
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CONTENT_W, condH, "S");
  if (condLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(condLines, MARGIN + 4, y + 7);
  }
  y += condH + 8;

  /* corpo jurídico */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  const corpoLines = doc.splitTextToSize(TERMO_CORPO, CONTENT_W);
  doc.text(corpoLines, MARGIN, y);
  y += corpoLines.length * 4.5 + 14;

  /* assinaturas (digitais quando desenhadas na tela) */
  doc.setFontSize(9);
  const temAss = !!(termo.resp_ass || termo.tecnico_ass);
  const linha = (label: string, nome: string, cpf: string, data: string, ass: string | undefined, yy: number) => {
    const nomeSlot = nome || "____________________________";
    const cpfSlot = cpf || "_______________";
    const dataSlot = data || "__________";
    if (ass) {
      try {
        const lw = doc.getTextWidth(`${label} `);
        doc.addImage(ass, "PNG", MARGIN + lw, yy - 15.5, 46, 14);
      } catch { /* assinatura corrompida — segue só com a linha */ }
    }
    doc.text(`${label} ${nomeSlot}   CPF: ${cpfSlot}   Data: ${dataSlot}`, MARGIN, yy);
  };
  if (temAss) y += 14;
  linha("Responsável pela obra:", termo.resp_obra || "", termo.resp_cpf || "", termo.resp_data || "", termo.resp_ass, y);
  y += temAss ? 20 : 12;
  linha("Técnico responsável (PARKET):", termo.tecnico || "", termo.tecnico_cpf || "", termo.tecnico_data || "", termo.tecnico_ass, y);

  const filename = `TERMO DE RESPONSABILIDADE - ${laudo.cliente || laudo.obra || "OBRA"}`
    .replace(/[^a-zA-Z0-9À-ÿ\s\-]/g, "").trim();
  doc.save(`${filename}.pdf`);
}
