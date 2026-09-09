/**
 * Helper PDF — gera relatórios padrão Parket com jsPDF + autotable.
 * Identidade visual: bege/marrom Parket, header com "PARKET — Relatórios Financeiros".
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtBRL } from "./format";

const PARKET = {
  accent: [184, 170, 154] as [number, number, number], // #B8AA9A
  text: [40, 40, 40] as [number, number, number],
  muted: [120, 120, 120] as [number, number, number],
  border: [220, 218, 215] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
};

export type KPI = { label: string; value: string; sub?: string; color?: "green" | "red" | "amber" | "neutral" };
export type TableSpec = {
  title?: string;
  head: string[];
  rows: (string | number)[][];
  alignNum?: number[]; // colunas que alinham à direita
  totals?: (string | number)[]; // linha de total opcional
};

type PdfOptions = {
  titulo: string;
  subtitulo?: string;
  periodo?: string;
  empresa?: string;
  kpis?: KPI[];
  insights?: string[]; // bullets analíticos abaixo dos KPIs
  tables?: TableSpec[];
  filename?: string; // sem .pdf
};

export function gerarPDF(opts: PdfOptions): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 12;

  // ─── Cabeçalho fixo ─────────────────────────────────────
  doc.setFillColor(...PARKET.accent);
  doc.rect(0, 0, W, 18, "F");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("PARKET", margin, 11);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Relatórios Financeiros", margin, 16);
  doc.setFontSize(8);
  doc.text(new Date().toLocaleString("pt-BR"), W - margin, 11, { align: "right" });
  if (opts.empresa) doc.text(opts.empresa, W - margin, 16, { align: "right" });

  let y = 26;

  // ─── Título ─────────────────────────────────────────────
  doc.setTextColor(...PARKET.text);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(opts.titulo, margin, y);
  y += 5;
  if (opts.subtitulo) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PARKET.muted);
    doc.text(opts.subtitulo, margin, y);
    y += 5;
  }
  if (opts.periodo) {
    doc.setFontSize(9);
    doc.setTextColor(...PARKET.muted);
    doc.text(`Período: ${opts.periodo}`, margin, y);
    y += 6;
  } else y += 2;

  // ─── KPIs (grid 4 colunas) ──────────────────────────────
  if (opts.kpis && opts.kpis.length > 0) {
    const cols = Math.min(4, opts.kpis.length);
    const gap = 3;
    const cellW = (W - margin * 2 - gap * (cols - 1)) / cols;
    const cellH = 22;
    opts.kpis.forEach((k, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = margin + col * (cellW + gap);
      const yy = y + row * (cellH + gap);
      // borda
      doc.setDrawColor(...PARKET.border);
      doc.setFillColor(252, 251, 249);
      doc.roundedRect(x, yy, cellW, cellH, 1.5, 1.5, "FD");
      // label
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PARKET.muted);
      doc.text(k.label.toUpperCase(), x + 3, yy + 5);
      // value
      const colorMap = { green: PARKET.green, red: PARKET.red, amber: PARKET.amber, neutral: PARKET.text };
      doc.setTextColor(...(colorMap[k.color || "neutral"]));
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(k.value, x + 3, yy + 13);
      if (k.sub) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...PARKET.muted);
        doc.text(k.sub, x + 3, yy + 18);
      }
    });
    const rows = Math.ceil(opts.kpis.length / cols);
    y += rows * (cellH + gap) + 4;
  }

  // ─── Insights (bullets) ─────────────────────────────────
  if (opts.insights && opts.insights.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PARKET.text);
    doc.text("Análise", margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PARKET.text);
    opts.insights.forEach((ins) => {
      const lines = doc.splitTextToSize(`• ${ins}`, W - margin * 2);
      lines.forEach((line: string) => {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += 4.5;
      });
    });
    y += 4;
  }

  // ─── Tabelas ────────────────────────────────────────────
  (opts.tables || []).forEach((t) => {
    if (y > 250) { doc.addPage(); y = 20; }
    if (t.title) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PARKET.text);
      doc.text(t.title, margin, y);
      y += 4;
    }
    const body = t.totals ? [...t.rows, t.totals] : t.rows;
    autoTable(doc, {
      startY: y,
      head: [t.head],
      body: body.map((r) => r.map((c) => String(c))),
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 1.5,
        textColor: PARKET.text,
        lineColor: PARKET.border,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: PARKET.accent,
        textColor: 255,
        fontStyle: "bold",
      },
      didParseCell: (data) => {
        // alinha à direita as colunas numéricas
        if (t.alignNum?.includes(data.column.index)) {
          data.cell.styles.halign = "right";
        }
        // realça linha de total
        if (t.totals && data.row.index === body.length - 1) {
          data.cell.styles.fillColor = [245, 243, 240];
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  });

  // ─── Rodapé em cada página ──────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...PARKET.muted);
    doc.text(`${p} / ${totalPages}`, W - margin, 290, { align: "right" });
    doc.text("Gerado por Parket Core Financeiro · core.parket.works", margin, 290);
  }

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(`${filename}.pdf`);
}

// helpers de formatação consistentes
export const pctFmt = (n: number, decs = 1) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: decs, maximumFractionDigits: decs }) + "%";
export const intFmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
export const moneyFmt = (n: number) => fmtBRL(n) || "—";
