import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const LOGO_URL = "/logo-parket-pdf.png";
const BRAND_COLOR: [number, number, number] = [20, 20, 20]; // preto
const ACCENT_COLOR: [number, number, number] = [120, 120, 120]; // cinza médio
const LIGHT_GRAY: [number, number, number] = [245, 245, 245];
const TEXT_MUTED: [number, number, number] = [107, 114, 128];

function formatDate(d: Date = new Date()) {
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type ImageData = { base64: string; width: number; height: number };

async function loadImageAsBase64(url: string): Promise<ImageData | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 100, height: 40 });
      img.src = base64;
    });
    return { base64, width, height };
  } catch {
    return null;
  }
}

async function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageW = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageW, 36, "F");

  // Logo — proporcional, sem fundo, direto sobre o header preto
  const logoData = await loadImageAsBase64(LOGO_URL);
  if (logoData) {
    const targetH = 14; // altura menor para look limpo
    const ratio = logoData.width / logoData.height;
    const targetW = targetH * ratio;
    const logoX = 10;
    const logoY = (36 - targetH) / 2;
    doc.addImage(logoData.base64, "PNG", logoX, logoY, targetW, targetH);
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Expedição Parket", 10, 22);
  }

  // Title block on right
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW - 10, 16, { align: "right" });

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 200, 200);
    doc.text(subtitle, pageW - 10, 24, { align: "right" });
  }

  // Generated date
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`Gerado em ${formatDate()}`, pageW - 10, 32, { align: "right" });

  // Accent line
  doc.setFillColor(...ACCENT_COLOR);
  doc.rect(0, 36, pageW, 2, "F");

  return 46; // starting Y after header
}

function addFooter(doc: jsPDF) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...LIGHT_GRAY);
    doc.rect(0, pageH - 14, pageW, 14, "F");
    doc.setTextColor(...TEXT_MUTED);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Expedição Parket — Relatório Confidencial", 10, pageH - 5);
    doc.text(`Página ${i} de ${totalPages}`, pageW - 10, pageH - 5, { align: "right" });
  }
}

function addSectionTitle(doc: jsPDF, text: string, y: number) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(10, y - 5, pageW - 20, 10, "F");
  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(text.toUpperCase(), 14, y + 1);
  return y + 10;
}

function addKpiRow(
  doc: jsPDF,
  kpis: { label: string; value: string; color?: [number, number, number] }[],
  y: number
) {
  const pageW = doc.internal.pageSize.getWidth();
  const boxW = (pageW - 20) / kpis.length;

  kpis.forEach((kpi, i) => {
    const x = 10 + i * boxW;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(x + 1, y, boxW - 2, 18, 2, 2, "FD");

    const color = kpi.color ?? BRAND_COLOR;
    doc.setFillColor(...color);
    doc.rect(x + 1, y, 3, 18, "F");

    doc.setTextColor(...TEXT_MUTED);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label, x + 8, y + 6);

    doc.setTextColor(...BRAND_COLOR);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.value, x + 8, y + 14);
  });

  return y + 24;
}

// ─── Individual report generators ─────────────────────────────────────────────

export type OrderFull = {
  _id: string;
  orderNumber: string;
  status: string;
  freightType: string;
  freightValue?: number;
  notes?: string;
  deliveryAddress?: string;
  scheduledDate?: string;
  deliveredAt?: string;
  _creationTime: number;
  client: { name: string; phone?: string; city?: string; state?: string; address?: string };
  items: { productName: string; productCode: string; quantity: number; unit: string; unitPrice?: number }[];
  totalItems: number;
  totalValue: number;
};

export type InventoryFull = {
  _id: string;
  name: string;
  status: string;
  notes?: string;
  finishedAt?: string;
  _creationTime: number;
  items: {
    productName: string; productCode: string; unit: string;
    expectedQuantity: number; countedQuantity?: number; difference?: number; notes?: string;
  }[];
  totalItems: number;
  countedItems: number;
  divergentItems: number;
};

export type SaidaMaterialRow = {
  productId: string;
  productName: string;
  productCode: string;
  unit: string;
  totalQty: number;
  movCount: number;
  lastDate: number;
  exits: { date: number; qty: number; reason: string | undefined; orderNumber: string | undefined }[];
};

export type ReportData = {
  summary: { totalProducts: number; lowStock: number; zeroStock: number; totalClients: number } | undefined;
  byType: Record<string, number> | undefined;
  byStatus: Record<string, number> | undefined;
  topProducts: {
    productId: string; productName: string; productCode: string;
    productUnit: string; entries: number; exits: number; currentStock: number;
  }[] | undefined;
  products: {
    _id: string; name: string; code: string; unit: string;
    currentStock: number; minStock?: number; active: boolean;
  }[] | null | undefined;
  freightByClient: { clientName: string; clientCity?: string; total: number; count: number }[] | undefined;
  transportsSummary: {
    total: number;
    byStatus: Record<string, number>;
    freightByClient: { clientName: string; clientCity?: string; total: number; count: number }[];
  } | undefined;
  ordersFullReport?: OrderFull[];
  inventoryReport?: InventoryFull[];
  saidaMaterial?: { rows: SaidaMaterialRow[]; totalExits: number; totalQty: number; days: number } | null;
  days: number;
};

const orderStatusLabels: Record<string, string> = {
  rascunho: "Rascunho", confirmado: "Confirmado", em_separacao: "Em Separação",
  em_rota: "Em Rota", entregue: "Entregue", cancelado: "Cancelado",
};

const movTypeLabels: Record<string, string> = {
  entrada: "Entradas", saida: "Saídas", ajuste: "Ajustes",
  inventario: "Inventário", transferencia: "Transferência",
};

const transportStatusLabels: Record<string, string> = {
  pendente: "Pendente", em_rota: "Em Rota", entregue: "Entregue", cancelado: "Cancelado",
};

// Relatório Geral
export async function generateGeralPDF(data: ReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await addHeader(doc, "Relatório Geral", `Período: últimos ${data.days} dias`);

  // KPIs
  y = addSectionTitle(doc, "Resumo Executivo", y);
  y = addKpiRow(doc, [
    { label: "Total Produtos", value: String(data.summary?.totalProducts ?? 0), color: BRAND_COLOR },
    { label: "Estoque Baixo", value: String(data.summary?.lowStock ?? 0), color: [245, 158, 11] },
    { label: "Sem Estoque", value: String(data.summary?.zeroStock ?? 0), color: [239, 68, 68] },
    { label: "Total Clientes", value: String(data.summary?.totalClients ?? 0), color: ACCENT_COLOR },
  ], y);

  // Transportes de ferramentas KPIs
  if (data.transportsSummary) {
    const ts = data.transportsSummary;
    const ttFreight = ts.freightByClient.reduce((s, c) => s + c.total, 0);
    y = addSectionTitle(doc, "Transporte de Ferramentas", y + 4);
    y = addKpiRow(doc, [
      { label: "Total Transportes", value: String(ts.total), color: BRAND_COLOR },
      { label: "Em Rota", value: String(ts.byStatus.em_rota ?? 0), color: [245, 158, 11] },
      { label: "Concluídos", value: String(ts.byStatus.entregue ?? 0), color: ACCENT_COLOR },
      { label: "Frete Total", value: formatBRL(ttFreight), color: [120, 120, 120] },
    ], y);
  }

  // Pedidos por status
  if (data.byStatus && Object.keys(data.byStatus).length > 0) {
    y = addSectionTitle(doc, "Pedidos por Status", y + 4);
    autoTable(doc, {
      startY: y,
      head: [["Status", "Quantidade"]],
      body: Object.entries(data.byStatus).map(([s, c]) => [orderStatusLabels[s] ?? s, c]),
      theme: "striped",
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: 10, right: 10 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Movimentações
  if (data.byType && Object.keys(data.byType).length > 0) {
    y = addSectionTitle(doc, `Movimentações por Tipo (${data.days} dias)`, y + 4);
    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Quantidade"]],
      body: Object.entries(data.byType).map(([t, c]) => [movTypeLabels[t] ?? t, c]),
      theme: "striped",
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: 10, right: 10 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Frete
  if (data.freightByClient && data.freightByClient.length > 0) {
    y = addSectionTitle(doc, "Frete por Cliente (Pedidos)", y + 4);
    const totalFrete = data.freightByClient.reduce((s, c) => s + c.total, 0);
    autoTable(doc, {
      startY: y,
      head: [["Cliente", "Cidade", "Qtd", "Total Frete"]],
      body: data.freightByClient.map((c) => [
        c.clientName, c.clientCity ?? "—", c.count, formatBRL(c.total),
      ]),
      foot: [["Total Geral", "", data.freightByClient.reduce((s, c) => s + c.count, 0), formatBRL(totalFrete)]],
      theme: "striped",
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 9 },
      footStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: 10, right: 10 },
    });
  }

  addFooter(doc);
  return doc;
}

// Relatório de Produtos
export async function generateProdutosPDF(data: ReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await addHeader(doc, "Relatório de Produtos", `Emitido em ${formatDate()}`);

  const products = data.products ?? [];
  const active = products.filter((p) => p.active);
  const lowStock = active.filter((p) => p.minStock != null && p.currentStock <= p.minStock);
  const zero = active.filter((p) => p.currentStock === 0);

  y = addSectionTitle(doc, "Resumo do Estoque", y);
  y = addKpiRow(doc, [
    { label: "Produtos Ativos", value: String(active.length), color: BRAND_COLOR },
    { label: "Estoque Baixo", value: String(lowStock.length), color: [245, 158, 11] },
    { label: "Sem Estoque", value: String(zero.length), color: [239, 68, 68] },
  ], y);

  // Full products table
  y = addSectionTitle(doc, "Lista de Produtos", y + 4);
  autoTable(doc, {
    startY: y,
    head: [["Código", "Produto", "Unidade", "Estoque Atual", "Mínimo", "Status"]],
    body: active.map((p) => {
      const status = p.currentStock === 0 ? "Sem Estoque"
        : (p.minStock != null && p.currentStock <= p.minStock) ? "Estoque Baixo"
        : "OK";
      return [p.code, p.name, p.unit, p.currentStock.toFixed(2), p.minStock?.toFixed(2) ?? "—", status];
    }),
    theme: "striped",
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "center" },
    },
    didDrawCell: (hookData) => {
      if (hookData.column.index === 5 && hookData.section === "body") {
        const val = hookData.cell.text.join("");
        if (val === "Sem Estoque") {
          hookData.doc.setTextColor(239, 68, 68);
        } else if (val === "Estoque Baixo") {
          hookData.doc.setTextColor(245, 158, 11);
        } else {
          hookData.doc.setTextColor(120, 120, 120);
        }
      }
    },
    margin: { left: 10, right: 10 },
  });

  // Top moved
  if (data.topProducts && data.topProducts.length > 0) {
    const docTyped = doc as jsPDF & { lastAutoTable: { finalY: number } };
    let topY = docTyped.lastAutoTable.finalY + 8;
    topY = addSectionTitle(doc, `Produtos Mais Movimentados (${data.days} dias)`, topY + 4);
    autoTable(doc, {
      startY: topY,
      head: [["Código", "Produto", "Entradas", "Saídas", "Estoque Atual"]],
      body: data.topProducts.map((p) => [
        p.productCode, p.productName,
        `+${p.entries.toFixed(1)} ${p.productUnit}`,
        `-${p.exits.toFixed(1)} ${p.productUnit}`,
        p.currentStock.toFixed(2),
      ]),
      theme: "striped",
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: 10, right: 10 },
    });
  }

  addFooter(doc);
  return doc;
}

// Relatório de Fretes
export async function generateFretesPDF(data: ReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await addHeader(doc, "Relatório de Fretes", `Emitido em ${formatDate()}`);

  const freight = data.freightByClient ?? [];
  const totalFrete = freight.reduce((s, c) => s + c.total, 0);
  const totalPedidos = freight.reduce((s, c) => s + c.count, 0);

  y = addSectionTitle(doc, "Resumo de Fretes — Pedidos", y);
  y = addKpiRow(doc, [
    { label: "Clientes c/ Frete", value: String(freight.length), color: BRAND_COLOR },
    { label: "Pedidos c/ Frete", value: String(totalPedidos), color: [120, 120, 120] },
    { label: "Total Frete", value: formatBRL(totalFrete), color: ACCENT_COLOR },
  ], y);

  if (freight.length > 0) {
    y = addSectionTitle(doc, "Frete por Cliente (Pedidos)", y + 4);
    autoTable(doc, {
      startY: y,
      head: [["Cliente", "Cidade", "Qtd Pedidos", "Total Frete", "Média/Pedido"]],
      body: freight.map((c) => [
        c.clientName, c.clientCity ?? "—", c.count,
        formatBRL(c.total), formatBRL(c.total / c.count),
      ]),
      foot: [["TOTAL", "", totalPedidos, formatBRL(totalFrete), formatBRL(totalFrete / (totalPedidos || 1))]],
      theme: "striped",
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 9 },
      footStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: 10, right: 10 },
    });
  }

  // Tool transports freight
  const ttFreight = data.transportsSummary?.freightByClient ?? [];
  if (ttFreight.length > 0) {
    const docTyped = doc as jsPDF & { lastAutoTable: { finalY: number } };
    let ttY = (freight.length > 0 ? docTyped.lastAutoTable.finalY : y) + 10;
    const ttTotal = ttFreight.reduce((s, c) => s + c.total, 0);
    const ttCount = ttFreight.reduce((s, c) => s + c.count, 0);

    ttY = addSectionTitle(doc, "Frete por Cliente (Transporte de Ferramentas)", ttY + 4);
    autoTable(doc, {
      startY: ttY,
      head: [["Cliente", "Cidade", "Qtd Transportes", "Total Frete"]],
      body: ttFreight.map((c) => [c.clientName, c.clientCity ?? "—", c.count, formatBRL(c.total)]),
      foot: [["TOTAL", "", ttCount, formatBRL(ttTotal)]],
      theme: "striped",
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 9 },
      footStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: 10, right: 10 },
    });
  }

  addFooter(doc);
  return doc;
}

// Relatório de Pedidos
export async function generatePedidosPDF(data: ReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await addHeader(doc, "Relatório de Pedidos", `Emitido em ${formatDate()}`);

  const byStatus = data.byStatus ?? {};
  const total = Object.values(byStatus).reduce((s, v) => s + v, 0);

  y = addSectionTitle(doc, "Status dos Pedidos", y);
  y = addKpiRow(doc, [
    { label: "Total Pedidos", value: String(total), color: BRAND_COLOR },
    { label: "Entregues", value: String(byStatus.entregue ?? 0), color: ACCENT_COLOR },
    { label: "Em Rota", value: String(byStatus.em_rota ?? 0), color: [120, 120, 120] },
    { label: "Cancelados", value: String(byStatus.cancelado ?? 0), color: [239, 68, 68] },
  ], y);

  y = addSectionTitle(doc, "Distribuição por Status", y + 4);
  autoTable(doc, {
    startY: y,
    head: [["Status", "Quantidade", "% do Total"]],
    body: Object.entries(orderStatusLabels).map(([key, label]) => {
      const count = byStatus[key] ?? 0;
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0%";
      return [label, count, pct];
    }),
    foot: [["TOTAL", total, "100%"]],
    theme: "striped",
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 9 },
    footStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
    margin: { left: 10, right: 10 },
  });

  addFooter(doc);
  return doc;
}

// Relatório de Movimentações
export async function generateMovimentacoesPDF(data: ReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await addHeader(doc, "Relatório de Movimentações", `Período: últimos ${data.days} dias`);

  const byType = data.byType ?? {};
  const total = Object.values(byType).reduce((s, v) => s + v, 0);

  y = addSectionTitle(doc, "Resumo de Movimentações", y);
  y = addKpiRow(doc, [
    { label: "Total Movimentações", value: String(total), color: BRAND_COLOR },
    { label: "Entradas", value: String(byType.entrada ?? 0), color: ACCENT_COLOR },
    { label: "Saídas", value: String(byType.saida ?? 0), color: [239, 68, 68] },
    { label: "Ajustes", value: String(byType.ajuste ?? 0), color: [245, 158, 11] },
  ], y);

  y = addSectionTitle(doc, "Detalhamento por Tipo", y + 4);
  autoTable(doc, {
    startY: y,
    head: [["Tipo de Movimentação", "Quantidade", "% do Total"]],
    body: Object.entries(movTypeLabels).map(([key, label]) => {
      const count = byType[key] ?? 0;
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0%";
      return [label, count, pct];
    }),
    foot: [["TOTAL", total, "100%"]],
    theme: "striped",
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 9 },
    footStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
    margin: { left: 10, right: 10 },
  });

  // Top products
  if (data.topProducts && data.topProducts.length > 0) {
    const docTyped = doc as jsPDF & { lastAutoTable: { finalY: number } };
    let topY = docTyped.lastAutoTable.finalY + 8;
    topY = addSectionTitle(doc, "Produtos Mais Movimentados", topY + 4);
    autoTable(doc, {
      startY: topY,
      head: [["Produto", "Código", "Entradas", "Saídas", "Total"]],
      body: data.topProducts.map((p, i) => [
        `${i + 1}. ${p.productName}`, p.productCode,
        `+${p.entries.toFixed(1)} ${p.productUnit}`,
        `-${p.exits.toFixed(1)} ${p.productUnit}`,
        (p.entries + p.exits).toFixed(1),
      ]),
      theme: "striped",
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      margin: { left: 10, right: 10 },
    });
  }

  addFooter(doc);
  return doc;
}

// Relatório de Transporte de Ferramentas
export async function generateTransportesPDF(data: ReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await addHeader(doc, "Transporte de Ferramentas", `Emitido em ${formatDate()}`);

  const ts = data.transportsSummary;
  if (!ts) {
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Sem dados disponíveis.", 14, y + 10);
    addFooter(doc);
    return doc;
  }

  const totalT = ts.total;
  y = addSectionTitle(doc, "Status dos Transportes", y);
  y = addKpiRow(doc, [
    { label: "Total Transportes", value: String(totalT), color: BRAND_COLOR },
    { label: "Pendentes", value: String(ts.byStatus.pendente ?? 0), color: [245, 158, 11] },
    { label: "Em Rota", value: String(ts.byStatus.em_rota ?? 0), color: [120, 120, 120] },
    { label: "Concluídos", value: String(ts.byStatus.entregue ?? 0), color: ACCENT_COLOR },
  ], y);

  y = addSectionTitle(doc, "Detalhamento por Status", y + 4);
  autoTable(doc, {
    startY: y,
    head: [["Status", "Quantidade", "% do Total"]],
    body: Object.entries(transportStatusLabels).map(([key, label]) => {
      const count = ts.byStatus[key] ?? 0;
      const pct = totalT > 0 ? ((count / totalT) * 100).toFixed(1) + "%" : "0%";
      return [label, count, pct];
    }),
    foot: [["TOTAL", totalT, "100%"]],
    theme: "striped",
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 9 },
    footStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
    margin: { left: 10, right: 10 },
  });

  if (ts.freightByClient.length > 0) {
    const docTyped = doc as jsPDF & { lastAutoTable: { finalY: number } };
    let fY = docTyped.lastAutoTable.finalY + 8;
    const totalF = ts.freightByClient.reduce((s, c) => s + c.total, 0);
    fY = addSectionTitle(doc, "Frete por Cliente", fY + 4);
    autoTable(doc, {
      startY: fY,
      head: [["Cliente", "Cidade", "Transportes", "Total Frete"]],
      body: ts.freightByClient.map((c) => [c.clientName, c.clientCity ?? "—", c.count, formatBRL(c.total)]),
      foot: [["TOTAL", "", ts.freightByClient.reduce((s, c) => s + c.count, 0), formatBRL(totalF)]],
      theme: "striped",
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 9 },
      footStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: 10, right: 10 },
    });
  }

  addFooter(doc);
  return doc;
}

// Relatório de Estoque Crítico
export async function generateEstoqueCriticoPDF(data: ReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await addHeader(doc, "Estoque Crítico", `Emitido em ${formatDate()}`);

  const products = data.products ?? [];
  const active = products.filter((p) => p.active);
  const zero = active.filter((p) => p.currentStock === 0);
  const low = active.filter((p) => p.minStock != null && p.currentStock > 0 && p.currentStock <= p.minStock);

  y = addSectionTitle(doc, "Resumo", y);
  y = addKpiRow(doc, [
    { label: "Sem Estoque", value: String(zero.length), color: [239, 68, 68] },
    { label: "Abaixo do Mínimo", value: String(low.length), color: [245, 158, 11] },
    { label: "Total Críticos", value: String(zero.length + low.length), color: BRAND_COLOR },
  ], y);

  if (zero.length > 0) {
    y = addSectionTitle(doc, "Produtos Sem Estoque", y + 4);
    autoTable(doc, {
      startY: y,
      head: [["Código", "Produto", "Unidade", "Estoque Atual", "Estoque Mínimo"]],
      body: zero.map((p) => [p.code, p.name, p.unit, "0", p.minStock?.toFixed(2) ?? "—"]),
      theme: "striped",
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [239, 68, 68] },
      alternateRowStyles: { fillColor: [255, 245, 245] },
      margin: { left: 10, right: 10 },
    });
  }

  if (low.length > 0) {
    const docTyped = doc as jsPDF & { lastAutoTable: { finalY: number } };
    const lowY = zero.length > 0 ? docTyped.lastAutoTable.finalY + 8 : y;
    addSectionTitle(doc, "Produtos com Estoque Abaixo do Mínimo", lowY + 4);
    const startY2 = lowY + 14;
    autoTable(doc, {
      startY: startY2,
      head: [["Código", "Produto", "Unidade", "Estoque Atual", "Mínimo", "Diferença"]],
      body: low.map((p) => {
        const diff = p.currentStock - (p.minStock ?? 0);
        return [p.code, p.name, p.unit, p.currentStock.toFixed(2), p.minStock?.toFixed(2) ?? "—", diff.toFixed(2)];
      }),
      theme: "striped",
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right", textColor: [239, 68, 68] } },
      alternateRowStyles: { fillColor: [255, 250, 235] },
      margin: { left: 10, right: 10 },
    });
  }

  addFooter(doc);
  return doc;
}

const freightLabels: Record<string, string> = { interno: "Interno", terceiro: "Terceiro", retirada: "Retirada" };
const statusLabelMap: Record<string, string> = {
  rascunho: "Rascunho", confirmado: "Confirmado", em_separacao: "Em Separação",
  em_rota: "Em Rota", entregue: "Entregue", cancelado: "Cancelado",
};

// Relatório de Pedidos Completo (com detalhes por pedido)
export async function generatePedidosDetalhadosPDF(data: ReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await addHeader(doc, "Relatório Detalhado de Pedidos", `Emitido em ${formatDate()}`);

  const orders = data.ordersFullReport ?? [];
  const byStatus = data.byStatus ?? {};
  const total = Object.values(byStatus).reduce((s, v) => s + v, 0);

  y = addSectionTitle(doc, "Resumo por Status", y);
  y = addKpiRow(doc, [
    { label: "Total Pedidos", value: String(total), color: BRAND_COLOR },
    { label: "Entregues", value: String(byStatus.entregue ?? 0), color: [120, 120, 120] },
    { label: "Em Rota", value: String(byStatus.em_rota ?? 0), color: [245, 158, 11] },
    { label: "Cancelados", value: String(byStatus.cancelado ?? 0), color: [239, 68, 68] },
  ], y);

  y = addSectionTitle(doc, "Distribuição por Status", y + 4);
  autoTable(doc, {
    startY: y,
    head: [["Status", "Quantidade"]],
    body: Object.entries(statusLabelMap).map(([key, label]) => [label, byStatus[key] ?? 0]),
    foot: [["TOTAL", total]],
    theme: "striped",
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 9 },
    footStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
    margin: { left: 10, right: 10 },
  });

  if (orders.length > 0) {
    const docTyped = doc as jsPDF & { lastAutoTable: { finalY: number } };
    let detY = docTyped.lastAutoTable.finalY + 8;
    detY = addSectionTitle(doc, "Lista Detalhada de Pedidos", detY + 4);
    autoTable(doc, {
      startY: detY,
      head: [["Pedido", "Cliente", "Cidade", "Tel", "Status", "Frete", "Vl. Frete", "Data"]],
      body: orders.map((o) => [
        o.orderNumber,
        o.client.name,
        o.client.city ?? "—",
        o.client.phone ?? "—",
        statusLabelMap[o.status] ?? o.status,
        freightLabels[o.freightType] ?? o.freightType,
        o.freightValue ? formatBRL(o.freightValue) : "—",
        new Date(o._creationTime).toLocaleDateString("pt-BR"),
      ]),
      theme: "striped",
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: { 6: { halign: "right" }, 7: { halign: "center" } },
      margin: { left: 10, right: 10 },
    });

    const docTyped2 = doc as jsPDF & { lastAutoTable: { finalY: number } };
    let itemY = docTyped2.lastAutoTable.finalY + 10;
    itemY = addSectionTitle(doc, "Itens por Pedido", itemY + 4);

    for (const o of orders) {
      if (o.items.length === 0) continue;
      const pageH = doc.internal.pageSize.getHeight();
      if (itemY > pageH - 50) {
        doc.addPage();
        itemY = 20;
      }
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND_COLOR);
      doc.text(
        `Pedido ${o.orderNumber} — ${o.client.name}${o.client.city ? ` (${o.client.city})` : ""} | Tel: ${o.client.phone ?? "—"}`,
        10,
        itemY
      );
      itemY += 2;
      autoTable(doc, {
        startY: itemY,
        head: [["Código", "Produto", "Qtd", "Un", "Preço Unit.", "Subtotal"]],
        body: o.items.map((i) => [
          i.productCode, i.productName, i.quantity.toFixed(2), i.unit,
          i.unitPrice ? formatBRL(i.unitPrice) : "—",
          i.unitPrice ? formatBRL(i.unitPrice * i.quantity) : "—",
        ]),
        foot: o.totalValue > 0 ? [["", "TOTAL", "", "", "", formatBRL(o.totalValue)]] : undefined,
        theme: "striped",
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 7 },
        footStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: LIGHT_GRAY },
        columnStyles: { 2: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
        margin: { left: 10, right: 10 },
      });
      const docTyped3 = doc as jsPDF & { lastAutoTable: { finalY: number } };
      itemY = docTyped3.lastAutoTable.finalY + 6;
    }
  }

  addFooter(doc);
  return doc;
}

// ─── Pedidos por Cliente ──────────────────────────────────────────────────────

export type ClientOrderReport = {
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  clientCity?: string;
  clientState?: string;
  clientAddress?: string;
  clientDocument?: string;
  totalOrders: number;
  totalValue: number;
  totalFreight: number;
  orders: {
    _id: string;
    orderNumber: string;
    status: string;
    freightType: string;
    freightValue?: number;
    notes?: string;
    deliveryAddress?: string;
    scheduledDate?: string;
    deliveredAt?: string;
    _creationTime: number;
    items: { productName: string; productCode: string; quantity: number; unit: string; unitPrice?: number; subtotal: number }[];
    totalItems: number;
    totalValue: number;
  }[];
};

const orderStatusLabelsPDF: Record<string, string> = {
  rascunho: "Rascunho", confirmado: "Confirmado", em_separacao: "Em Separação",
  em_rota: "Em Rota", entregue: "Entregue", cancelado: "Cancelado"
};

const freightTypeLabelsPDF: Record<string, string> = {
  gratis: "Grátis", fixo: "Fixo", retirada: "Retirada", terceiro: "Terceiro"
};

export async function generatePedidosPorClientePDF(
  clients: ClientOrderReport[],
  filteredClientName?: string
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const subtitle = filteredClientName
    ? `Cliente: ${filteredClientName}`
    : `${clients.length} cliente(s)`;

  let y = await addHeader(doc, "Relatório de Pedidos por Cliente", subtitle);

  // Grand totals KPI
  const grandOrders = clients.reduce((s, c) => s + c.totalOrders, 0);
  const grandValue = clients.reduce((s, c) => s + c.totalValue, 0);
  const grandFreight = clients.reduce((s, c) => s + c.totalFreight, 0);

  y = addKpiRow(doc, [
    { label: "Total Clientes", value: String(clients.length), color: BRAND_COLOR },
    { label: "Total Pedidos", value: String(grandOrders), color: ACCENT_COLOR },
    { label: "Valor Total", value: formatBRL(grandValue), color: BRAND_COLOR },
    { label: "Frete Total", value: formatBRL(grandFreight), color: ACCENT_COLOR },
  ], y);

  // Summary table of clients
  y = addSectionTitle(doc, "Resumo por Cliente", y + 4);
  autoTable(doc, {
    startY: y,
    head: [["Cliente", "Cidade/UF", "Pedidos", "Valor Total", "Frete Total"]],
    body: clients.map((c) => [
      c.clientName,
      [c.clientCity, c.clientState].filter(Boolean).join("/") || "—",
      String(c.totalOrders),
      formatBRL(c.totalValue),
      formatBRL(c.totalFreight),
    ]),
    foot: [["TOTAL", "", String(grandOrders), formatBRL(grandValue), formatBRL(grandFreight)]],
    theme: "striped",
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 8 },
    footStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    margin: { left: 10, right: 10 },
  });

  // Detail per client
  for (const client of clients) {
    doc.addPage();
    let cy = await addHeader(doc, `Pedidos — ${client.clientName}`, subtitle);

    // Client info box
    doc.setFillColor(248, 248, 248);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(10, cy, doc.internal.pageSize.getWidth() - 20, 28, 2, 2, "FD");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_COLOR);
    doc.text("DADOS DO CLIENTE", 14, cy + 6);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    const col1 = [
      client.clientPhone ? `Tel: ${client.clientPhone}` : null,
      client.clientEmail ? `E-mail: ${client.clientEmail}` : null,
    ].filter(Boolean) as string[];
    const col2 = [
      [client.clientCity, client.clientState].filter(Boolean).join(" — ") || null,
      client.clientAddress ?? null,
    ].filter(Boolean) as string[];

    col1.forEach((line, i) => doc.text(line, 14, cy + 12 + i * 5));
    col2.forEach((line, i) => doc.text(line, 100, cy + 12 + i * 5));

    cy += 32;

    // Client KPIs
    cy = addKpiRow(doc, [
      { label: "Total Pedidos", value: String(client.totalOrders), color: BRAND_COLOR },
      { label: "Valor Total", value: formatBRL(client.totalValue), color: ACCENT_COLOR },
      { label: "Frete Total", value: formatBRL(client.totalFreight), color: ACCENT_COLOR },
    ], cy);

    // Each order
    for (const order of client.orders) {
      const needsNewPage = cy > doc.internal.pageSize.getHeight() - 60;
      if (needsNewPage) {
        doc.addPage();
        cy = await addHeader(doc, `Pedidos — ${client.clientName}`, `continuação`);
      }

      cy = addSectionTitle(doc, `Pedido #${order.orderNumber} — ${orderStatusLabelsPDF[order.status] ?? order.status}`, cy + 2);

      // Order meta
      const meta: string[] = [];
      meta.push(`Data: ${format(new Date(order._creationTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}`);
      meta.push(`Frete: ${freightTypeLabelsPDF[order.freightType] ?? order.freightType}${order.freightValue ? ` — ${formatBRL(order.freightValue)}` : ""}`);
      if (order.scheduledDate) meta.push(`Agendado: ${order.scheduledDate}`);
      if (order.deliveryAddress) meta.push(`Endereço: ${order.deliveryAddress}`);
      if (order.notes) meta.push(`Obs: ${order.notes}`);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_MUTED);
      const pageW = doc.internal.pageSize.getWidth();
      meta.forEach((line, i) => {
        const col = i % 2 === 0 ? 14 : pageW / 2 + 5;
        const row = Math.floor(i / 2);
        doc.text(line, col, cy + row * 5);
      });
      cy += Math.ceil(meta.length / 2) * 5 + 4;

      // Items table
      autoTable(doc, {
        startY: cy,
        head: [["Código", "Produto", "Un.", "Qtd.", "Preço Unit.", "Subtotal"]],
        body: order.items.map((item) => [
          item.productCode,
          item.productName,
          item.unit,
          item.quantity.toLocaleString("pt-BR"),
          item.unitPrice != null ? formatBRL(item.unitPrice) : "—",
          formatBRL(item.subtotal),
        ]),
        foot: [[
          "", "TOTAL DO PEDIDO", "", String(order.totalItems) + " itens",
          "",
          formatBRL(order.totalValue + (order.freightValue ?? 0)),
        ]],
        theme: "striped",
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 7 },
        footStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold", fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: LIGHT_GRAY },
        columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
        margin: { left: 10, right: 10 },
      });

      const docTyped = doc as jsPDF & { lastAutoTable: { finalY: number } };
      cy = docTyped.lastAutoTable.finalY + 8;
    }
  }

  addFooter(doc);
  return doc;
}

// Relatório de Inventário
export async function generateInventarioPDF(data: ReportData, inventoryId?: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const inventories = data.inventoryReport ?? [];
  const inv = inventoryId ? inventories.find((i) => i._id === inventoryId) : inventories[0];

  if (!inv) {
    let y = await addHeader(doc, "Relatório de Inventário", `Emitido em ${formatDate()}`);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Nenhum inventário disponível.", 14, y + 10);
    addFooter(doc);
    return doc;
  }

  const inventoryStatusLabels: Record<string, string> = { aberto: "Aberto", em_andamento: "Em Andamento", finalizado: "Finalizado" };
  let y = await addHeader(doc, "Relatório de Inventário", `${inv.name} — ${inventoryStatusLabels[inv.status] ?? inv.status}`);

  y = addSectionTitle(doc, "Resumo do Inventário", y);
  y = addKpiRow(doc, [
    { label: "Total Itens", value: String(inv.totalItems), color: BRAND_COLOR },
    { label: "Contados", value: String(inv.countedItems), color: [120, 120, 120] },
    { label: "Divergências", value: String(inv.divergentItems), color: inv.divergentItems > 0 ? ([239, 68, 68] as [number,number,number]) : ([120, 120, 120] as [number,number,number]) },
    { label: "Pendentes", value: String(inv.totalItems - inv.countedItems), color: [245, 158, 11] },
  ], y);

  y = addSectionTitle(doc, "Lista de Produtos para Contagem", y + 4);
  autoTable(doc, {
    startY: y,
    head: [["Código", "Produto", "Un.", "Qtd. Esperada", "Qtd. Contada", "Diferença", "Observações"]],
    body: inv.items.map((i) => [
      i.productCode, i.productName, i.unit,
      i.expectedQuantity.toFixed(2),
      i.countedQuantity != null ? i.countedQuantity.toFixed(2) : "—",
      i.difference != null ? (i.difference > 0 ? `+${i.difference.toFixed(2)}` : i.difference.toFixed(2)) : "—",
      i.notes ?? "",
    ]),
    theme: "striped",
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    didDrawCell: (hookData) => {
      if (hookData.column.index === 5 && hookData.section === "body") {
        const val = hookData.cell.text.join("");
        if (val.startsWith("+")) hookData.doc.setTextColor(120, 120, 120);
        else if (val.startsWith("-")) hookData.doc.setTextColor(239, 68, 68);
      }
    },
    margin: { left: 10, right: 10 },
  });

  addFooter(doc);
  return doc;
}

// Lista de contagem para impressão (em branco para preencher à mão)
export async function generateListaContagemPDF(data: ReportData, inventoryId?: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const inventories = data.inventoryReport ?? [];
  const inv = inventoryId ? inventories.find((i) => i._id === inventoryId) : inventories[0];

  if (!inv) {
    let y = await addHeader(doc, "Lista de Contagem", `Emitido em ${formatDate()}`);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Nenhum inventário disponível.", 14, y + 10);
    addFooter(doc);
    return doc;
  }

  let y = await addHeader(doc, "Lista de Contagem", `${inv.name} — ${formatDate()}`);

  y = addSectionTitle(doc, "Instruções", y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Preencha a coluna 'Qtd. Contada' durante o inventário físico. Anote observações se necessário.", 14, y + 2);
  y += 12;

  y = addSectionTitle(doc, `Lista de Produtos — ${inv.totalItems} itens`, y);
  autoTable(doc, {
    startY: y,
    head: [["#", "Código", "Produto", "Un.", "Qtd. Esperada", "Qtd. Contada", "Obs."]],
    body: inv.items.map((item, i) => [
      String(i + 1),
      item.productCode,
      item.productName,
      item.unit,
      item.expectedQuantity.toFixed(2),
      "",
      "",
    ]),
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8, minCellHeight: 10 },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 22 },
      4: { halign: "right", cellWidth: 28 },
      5: { cellWidth: 30 },
      6: { cellWidth: 30 },
    },
    margin: { left: 10, right: 10 },
  });

  addFooter(doc);
  return doc;
}

// Relatório de Saída de Material
export async function generateSaidaMaterialPDF(data: ReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const saida = data.saidaMaterial;

  let y = await addHeader(
    doc,
    "Saída de Material",
    `Período: últimos ${data.days} dias — Emitido em ${formatDate()}`
  );

  if (!saida || saida.rows.length === 0) {
    doc.setTextColor(...TEXT_MUTED);
    doc.setFontSize(10);
    doc.text("Nenhuma saída registrada no período.", 14, y + 10);
    addFooter(doc);
    doc.save(`relatorio-saida-material.pdf`);
    return doc;
  }

  // KPI row
  y = addKpiRow(doc, [
    { label: "Produtos com Saída", value: String(saida.rows.length), color: BRAND_COLOR },
    { label: "Total de Saídas", value: String(saida.totalExits), color: [239, 68, 68] as [number, number, number] },
    { label: "Qtd. Total Saída", value: saida.totalQty.toFixed(2), color: ACCENT_COLOR },
    { label: "Período", value: `${saida.days} dias`, color: ACCENT_COLOR },
  ], y);

  y = addSectionTitle(doc, "Resumo por Produto", y + 4);

  const unitLabels: Record<string, string> = { m2: "m²", cx: "cx", ml: "ml", un: "un" };

  autoTable(doc, {
    startY: y,
    head: [["#", "Código", "Produto", "Un.", "Qtd. Total", "Nº Saídas", "Última Saída"]],
    body: saida.rows.map((r, i) => [
      String(i + 1),
      r.productCode,
      r.productName,
      unitLabels[r.unit] ?? r.unit,
      r.totalQty.toFixed(2),
      String(r.movCount),
      new Date(r.lastDate).toLocaleDateString("pt-BR"),
    ]),
    foot: [["", "", "TOTAL", "", saida.totalQty.toFixed(2), String(saida.totalExits), ""]],
    theme: "striped",
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    footStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 22 },
      3: { halign: "center", cellWidth: 12 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "center", cellWidth: 18 },
      6: { halign: "center", cellWidth: 24 },
    },
    margin: { left: 10, right: 10 },
  });

  // Detail section — page 2+
  doc.addPage();
  let dy = await addHeader(doc, "Saída de Material — Detalhes por Produto", `Período: últimos ${data.days} dias`);

  for (const row of saida.rows) {
    const unit = unitLabels[row.unit] ?? row.unit;
    const exits = [...row.exits].sort((a, b) => b.date - a.date);

    dy = addSectionTitle(doc, `${row.productName} (${row.productCode}) — Total: ${row.totalQty.toFixed(2)} ${unit}`, dy);

    autoTable(doc, {
      startY: dy,
      head: [["Data", "Quantidade", "Pedido", "Motivo"]],
      body: exits.map((e) => [
        new Date(e.date).toLocaleDateString("pt-BR"),
        `-${e.qty.toFixed(2)} ${unit}`,
        e.orderNumber ?? "—",
        e.reason ?? "—",
      ]),
      theme: "plain",
      headStyles: { fillColor: LIGHT_GRAY, textColor: [...BRAND_COLOR] as [number, number, number], fontSize: 7, fontStyle: "bold" },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 28, halign: "right" },
        2: { cellWidth: 30 },
      },
      margin: { left: 10, right: 10 },
    });

    dy = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    if (dy > doc.internal.pageSize.getHeight() - 25) {
      doc.addPage();
      dy = await addHeader(doc, "Saída de Material — Detalhes (cont.)", "");
    }
  }

  // Seção de Pedidos que geraram saída
  const ordersWithExits = (data.ordersFullReport ?? []).filter((o) =>
    saida.rows.some((r) => r.exits.some((e) => e.orderNumber === o.orderNumber))
  );

  if (ordersWithExits.length > 0) {
    doc.addPage();
    let oy = await addHeader(doc, "Saída de Material — Pedidos", `Período: últimos ${data.days} dias`);

    oy = addSectionTitle(doc, "Pedidos que Geraram Saída de Material", oy);

    for (const order of ordersWithExits) {
      // Cabeçalho do pedido
      doc.setFillColor(...LIGHT_GRAY);
      doc.rect(10, oy, doc.internal.pageSize.getWidth() - 20, 8, "F");
      doc.setTextColor(...BRAND_COLOR);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`Pedido #${order.orderNumber} — ${order.client.name}`, 13, oy + 5.5);
      const statusLabel = orderStatusLabels[order.status] ?? order.status;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...ACCENT_COLOR);
      doc.text(statusLabel, doc.internal.pageSize.getWidth() - 13, oy + 5.5, { align: "right" });
      oy += 10;

      // Info do pedido
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXT_MUTED);
      doc.setFont("helvetica", "normal");
      const infoDate = order.scheduledDate
        ? `Entrega: ${new Date(order.scheduledDate).toLocaleDateString("pt-BR")}`
        : `Criado: ${new Date(order._creationTime).toLocaleDateString("pt-BR")}`;
      doc.text(infoDate, 13, oy);
      if (order.client.city) {
        doc.text(`Cidade: ${order.client.city}${order.client.state ? `/${order.client.state}` : ""}`, 80, oy);
      }
      oy += 5;

      // Itens do pedido
      autoTable(doc, {
        startY: oy,
        head: [["Produto", "Código", "Un.", "Qtd."]],
        body: order.items.map((it) => [
          it.productName,
          it.productCode,
          it.unit,
          it.quantity.toFixed(2),
        ]),
        theme: "plain",
        headStyles: { fillColor: [230, 230, 230], textColor: [...BRAND_COLOR] as [number, number, number], fontSize: 7, fontStyle: "bold" },
        bodyStyles: { fontSize: 7.5 },
        columnStyles: {
          1: { cellWidth: 24 },
          2: { cellWidth: 12, halign: "center" },
          3: { cellWidth: 18, halign: "right" },
        },
        margin: { left: 10, right: 10 },
      });

      oy = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      if (oy > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        oy = await addHeader(doc, "Saída de Material — Pedidos (cont.)", "");
      }
    }
  }

  addFooter(doc);
  doc.save(`relatorio-saida-material-${data.days}d.pdf`);
  return doc;
}
