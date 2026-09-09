import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const LOGO_URL = "/logo-parket-pdf.png";
const BRAND_COLOR: [number, number, number] = [20, 20, 20];
const ACCENT_COLOR: [number, number, number] = [120, 120, 120];
const LIGHT_GRAY: [number, number, number] = [245, 245, 245];
const TEXT_MUTED: [number, number, number] = [107, 114, 128];
const GREEN: [number, number, number] = [16, 185, 129];
const YELLOW: [number, number, number] = [245, 158, 11];
const RED: [number, number, number] = [239, 68, 68];
const BLUE: [number, number, number] = [59, 130, 246];

function formatDate(d: Date = new Date()) {
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function formatDateShort(iso: string) {
  return iso.split("-").reverse().join("/");
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
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageW, 36, "F");

  const logoData = await loadImageAsBase64(LOGO_URL);
  if (logoData) {
    const targetH = 14;
    const ratio = logoData.width / logoData.height;
    const targetW = targetH * ratio;
    doc.addImage(logoData.base64, "PNG", 10, (36 - targetH) / 2, targetW, targetH);
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Expedição Parket", 10, 22);
  }

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

  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`Gerado em ${formatDate()}`, pageW - 10, 32, { align: "right" });

  doc.setFillColor(...ACCENT_COLOR);
  doc.rect(0, 36, pageW, 2, "F");

  return 46;
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
    doc.text("Expedição Parket — Relatório de Frota", 10, pageH - 5);
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type VehicleDoc = {
  _id: string;
  plate: string;
  brand: string;
  model: string;
  year?: number;
  type: string;
  color?: string;
  status: string;
  currentKm?: number;
  notes?: string;
};

export type UsageDoc = {
  _id: string;
  vehicleId: string;
  driverName: string;
  destination?: string;
  purpose?: string;
  departureDate: string;
  departureTime: string;
  arrivalDate?: string;
  arrivalTime?: string;
  kmDeparture: number;
  kmArrival?: number;
  kmDriven?: number;
  fuelCost?: number;
  damages?: string;
  damagePhotoIds?: string[];
  notes?: string;
  status: string;
  vehicle: VehicleDoc | null;
};

export type MaintenanceDoc = {
  _id: string;
  vehicleId: string;
  type: string;
  description: string;
  workshop?: string;
  cost?: number;
  date: string;
  resolvedAt?: string;
  status: string;
  notes?: string;
  vehicle: VehicleDoc | null;
  linkedUsage?: { damages?: string; departureDate?: string; driverName?: string } | null;
};

export type FleetReportData = {
  vehicles: VehicleDoc[];
  usages: UsageDoc[];
  maintenances?: MaintenanceDoc[];
  period: string;
  days: number | "all";
};

const STATUS_LABELS: Record<string, string> = {
  disponivel: "Disponível", em_uso: "Em Uso", manutencao: "Manutenção",
};
const TYPE_LABELS: Record<string, string> = {
  carro: "Carro", caminhao: "Caminhão", van: "Van", moto: "Moto",
};

// ─── Report 1: Relatório Geral da Frota ──────────────────────────────────────

export async function generateFrotaGeralPDF(data: FleetReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await addHeader(doc, "Relatório Geral de Frota", `Período: ${data.period}`);

  const concluidos = data.usages.filter((u) => u.status === "concluido");
  const kmTotal = concluidos.reduce((s, u) => s + (u.kmDriven ?? 0), 0);
  const fuelTotal = concluidos.reduce((s, u) => s + (u.fuelCost ?? 0), 0);
  const avarias = data.usages.filter((u) => u.damages && u.damages.trim().length > 0);

  y = addSectionTitle(doc, "Resumo da Frota", y);
  y = addKpiRow(doc, [
    { label: "Total Veículos", value: String(data.vehicles.length), color: BRAND_COLOR },
    { label: "Disponíveis", value: String(data.vehicles.filter((v) => v.status === "disponivel").length), color: GREEN },
    { label: "Em Uso", value: String(data.vehicles.filter((v) => v.status === "em_uso").length), color: BLUE },
    { label: "Manutenção", value: String(data.vehicles.filter((v) => v.status === "manutencao").length), color: YELLOW },
  ], y);

  y = addKpiRow(doc, [
    { label: "Viagens no Período", value: String(concluidos.length), color: BRAND_COLOR },
    { label: "KM Total", value: `${kmTotal.toLocaleString("pt-BR")} km`, color: ACCENT_COLOR },
    { label: "Custo Combustível", value: fuelTotal > 0 ? `R$ ${fuelTotal.toFixed(2)}` : "—", color: ACCENT_COLOR },
    { label: "Avarias Registradas", value: String(avarias.length), color: avarias.length > 0 ? RED : ACCENT_COLOR },
  ], y);

  // Vehicles table
  y = addSectionTitle(doc, "Veículos Cadastrados", y + 4);
  autoTable(doc, {
    startY: y,
    head: [["Placa", "Marca/Modelo", "Tipo", "Ano", "Status", "KM Atual"]],
    body: data.vehicles.map((v) => [
      v.plate,
      `${v.brand} ${v.model}`,
      TYPE_LABELS[v.type] ?? v.type,
      v.year ? String(v.year) : "—",
      STATUS_LABELS[v.status] ?? v.status,
      v.currentKm !== undefined ? `${v.currentKm.toLocaleString("pt-BR")} km` : "—",
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: BRAND_COLOR, textColor: 255 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 10, right: 10 },
  });

  addFooter(doc);
  return doc;
}

// ─── Report 2: Uso por Veículo ────────────────────────────────────────────────

export async function generateUsoPorVeiculoPDF(data: FleetReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await addHeader(doc, "Uso por Veículo", `Período: ${data.period}`);

  // Group by vehicle
  const byVehicle: Record<string, { vehicle: VehicleDoc; usages: UsageDoc[] }> = {};
  for (const u of data.usages) {
    if (!u.vehicle) continue;
    const key = u.vehicleId;
    if (!byVehicle[key]) byVehicle[key] = { vehicle: u.vehicle, usages: [] };
    byVehicle[key].usages.push(u);
  }

  const vehicleSummary = Object.values(byVehicle).map((g) => {
    const done = g.usages.filter((u) => u.status === "concluido");
    const km = done.reduce((s, u) => s + (u.kmDriven ?? 0), 0);
    const fuel = done.reduce((s, u) => s + (u.fuelCost ?? 0), 0);
    const avarias = g.usages.filter((u) => u.damages && u.damages.trim().length > 0).length;
    return { vehicle: g.vehicle, trips: done.length, km, fuel, avarias };
  }).sort((a, b) => b.km - a.km);

  y = addSectionTitle(doc, "Resumo por Veículo", y);
  autoTable(doc, {
    startY: y,
    head: [["Veículo", "Tipo", "Status", "Viagens", "KM Percorridos", "Combustível (R$)", "Avarias"]],
    body: vehicleSummary.map((g) => [
      `${g.vehicle.plate} — ${g.vehicle.brand} ${g.vehicle.model}`,
      TYPE_LABELS[g.vehicle.type] ?? g.vehicle.type,
      STATUS_LABELS[g.vehicle.status] ?? g.vehicle.status,
      String(g.trips),
      `${g.km.toLocaleString("pt-BR")} km`,
      g.fuel > 0 ? `R$ ${g.fuel.toFixed(2)}` : "—",
      g.avarias > 0 ? String(g.avarias) : "—",
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: BRAND_COLOR, textColor: 255 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 10, right: 10 },
    didParseCell: (hookData) => {
      // Highlight avaria column in red
      if (hookData.section === "body" && hookData.column.index === 6) {
        const val = String(hookData.cell.raw ?? "");
        if (val !== "—" && val !== "0") {
          hookData.cell.styles.textColor = [239, 68, 68];
          hookData.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  addFooter(doc);
  return doc;
}

// ─── Report 3: Histórico de Uso ────────────────────────────────────────────────

export async function generateHistoricoUsoPDF(data: FleetReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  let y = await addHeader(doc, "Histórico de Uso", `Período: ${data.period}`);

  const sorted = [...data.usages].sort((a, b) => b.departureDate.localeCompare(a.departureDate));

  autoTable(doc, {
    startY: y,
    head: [["Veículo", "Motorista", "Saída", "Chegada", "Destino", "KM Percorridos", "Combustível", "Status", "Avaria"]],
    body: sorted.map((u) => [
      u.vehicle ? `${u.vehicle.plate} ${u.vehicle.brand} ${u.vehicle.model}` : "—",
      u.driverName,
      `${formatDateShort(u.departureDate)} ${u.departureTime}`,
      u.arrivalDate ? `${formatDateShort(u.arrivalDate)} ${u.arrivalTime ?? ""}` : "—",
      u.destination ?? "—",
      u.kmDriven !== undefined ? `${u.kmDriven.toLocaleString("pt-BR")} km` : "—",
      u.fuelCost !== undefined ? `R$ ${u.fuelCost.toFixed(2)}` : "—",
      u.status === "aberto" ? "Em Aberto" : "Concluído",
      u.damages && u.damages.trim().length > 0 ? "⚠ Sim" : "—",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: BRAND_COLOR, textColor: 255 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 10, right: 10 },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 8) {
        const val = String(hookData.cell.raw ?? "");
        if (val.includes("Sim")) {
          hookData.cell.styles.textColor = [239, 68, 68];
          hookData.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  addFooter(doc);
  return doc;
}

// ─── Report 4: Relatório de Avarias ──────────────────────────────────────────

export async function generateAvariasPDF(data: FleetReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await addHeader(doc, "Relatório de Avarias", `Período: ${data.period}`);

  const avarias = data.usages.filter((u) => u.damages && u.damages.trim().length > 0);

  y = addSectionTitle(doc, `Avarias Registradas (${avarias.length})`, y);

  if (avarias.length === 0) {
    doc.setTextColor(...TEXT_MUTED);
    doc.setFontSize(10);
    doc.text("Nenhuma avaria registrada no período.", 14, y + 6);
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Data", "Veículo", "Motorista", "Destino", "Descrição da Avaria", "KM"]],
      body: avarias.map((u) => [
        formatDateShort(u.departureDate),
        u.vehicle ? `${u.vehicle.plate} — ${u.vehicle.brand} ${u.vehicle.model}` : "—",
        u.driverName,
        u.destination ?? "—",
        u.damages ?? "—",
        u.kmDriven !== undefined ? `${u.kmDriven.toLocaleString("pt-BR")} km` : "—",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: RED, textColor: 255 },
      alternateRowStyles: { fillColor: [255, 245, 245] },
      margin: { left: 10, right: 10 },
      columnStyles: {
        4: { cellWidth: 60 },
      },
    });
  }

  addFooter(doc);
  return doc;
}

const MAINT_TYPE_LABELS: Record<string, string> = {
  preventiva: "Preventiva", corretiva: "Corretiva", revisao: "Revisão",
  pneu: "Pneu", outros: "Outros",
};

// ─── Report 6: Manutenção ─────────────────────────────────────────────────────

export async function generateManutencaoPDF(data: FleetReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const maintenances = data.maintenances ?? [];
  let y = await addHeader(doc, "Relatório de Manutenção", `Período: ${data.period}`);

  const pending = maintenances.filter((m) => m.status === "pendente").length;
  const inProgress = maintenances.filter((m) => m.status === "em_andamento").length;
  const done = maintenances.filter((m) => m.status === "concluida").length;
  const totalCost = maintenances.reduce((s, m) => s + (m.cost ?? 0), 0);

  y = addSectionTitle(doc, "Resumo de Manutenções", y);
  y = addKpiRow(doc, [
    { label: "Total Registros", value: String(maintenances.length), color: BRAND_COLOR },
    { label: "Pendentes", value: String(pending), color: YELLOW },
    { label: "Em Andamento", value: String(inProgress), color: BLUE },
    { label: "Concluídas", value: String(done), color: GREEN },
  ], y);

  y = addKpiRow(doc, [
    { label: "Custo Total", value: `R$ ${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: BRAND_COLOR },
    { label: "Custo Médio", value: maintenances.length > 0 ? `R$ ${(totalCost / maintenances.length).toFixed(2)}` : "—", color: ACCENT_COLOR },
    { label: "Com Avaria Vinculada", value: String(maintenances.filter((m) => m.linkedUsage).length), color: ACCENT_COLOR },
    { label: "Veículos Envolvidos", value: String(new Set(maintenances.map((m) => m.vehicleId)).size), color: ACCENT_COLOR },
  ], y);

  if (maintenances.length === 0) {
    doc.setTextColor(...TEXT_MUTED);
    doc.setFontSize(10);
    doc.text("Nenhuma manutenção registrada no período.", 14, y + 10);
    addFooter(doc);
    return doc;
  }

  // By status sections
  const sections: { status: string; label: string; color: [number, number, number] }[] = [
    { status: "pendente", label: "Manutenções Pendentes", color: YELLOW },
    { status: "em_andamento", label: "Em Andamento", color: BLUE },
    { status: "concluida", label: "Concluídas", color: GREEN },
  ];

  for (const section of sections) {
    const rows = maintenances.filter((m) => m.status === section.status);
    if (rows.length === 0) continue;

    // Check if we need a new page
    const currentY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
    y = currentY ? currentY + 8 : y + 8;
    if (y > 250) { doc.addPage(); y = 20; }

    y = addSectionTitle(doc, `${section.label} (${rows.length})`, y);

    autoTable(doc, {
      startY: y,
      head: [["Data", "Veículo", "Tipo", "Descrição", "Oficina", "Custo (R$)", "Avaria?"]],
      body: rows.map((m) => [
        formatDateShort(m.date),
        m.vehicle ? `${m.vehicle.plate} — ${m.vehicle.brand} ${m.vehicle.model}` : "—",
        MAINT_TYPE_LABELS[m.type] ?? m.type,
        m.description,
        m.workshop ?? "—",
        m.cost != null ? `R$ ${m.cost.toFixed(2)}` : "—",
        m.linkedUsage ? "⚠ Sim" : "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: section.color, textColor: 255 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: 10, right: 10 },
      columnStyles: { 3: { cellWidth: 55 } },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 6) {
          if (String(hookData.cell.raw ?? "").includes("Sim")) {
            hookData.cell.styles.textColor = [239, 68, 68];
            hookData.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
  }

  // Per-vehicle breakdown
  const byVehicle: Record<string, { vehicle: VehicleDoc | null; records: MaintenanceDoc[] }> = {};
  for (const m of maintenances) {
    const key = m.vehicleId;
    if (!byVehicle[key]) byVehicle[key] = { vehicle: m.vehicle, records: [] };
    byVehicle[key].records.push(m);
  }

  const vehicleRows = Object.values(byVehicle).map((g) => ({
    vehicle: g.vehicle,
    total: g.records.length,
    cost: g.records.reduce((s, r) => s + (r.cost ?? 0), 0),
    pending: g.records.filter((r) => r.status === "pendente").length,
    done: g.records.filter((r) => r.status === "concluida").length,
  }));

  const lastY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
  const summaryY = lastY ? lastY + 10 : y + 10;
  const checkY = summaryY > 250 ? (doc.addPage(), 20) : summaryY;

  addSectionTitle(doc, "Custo por Veículo", checkY);
  autoTable(doc, {
    startY: checkY + 2,
    head: [["Veículo", "Total Manutenções", "Pendentes", "Concluídas", "Custo Total (R$)"]],
    body: vehicleRows.sort((a, b) => b.cost - a.cost).map((r) => [
      r.vehicle ? `${r.vehicle.plate} — ${r.vehicle.brand} ${r.vehicle.model}` : "—",
      String(r.total),
      String(r.pending),
      String(r.done),
      `R$ ${r.cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: BRAND_COLOR, textColor: 255 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 10, right: 10 },
  });

  addFooter(doc);
  return doc;
}

export async function generateMotoristaPDF(data: FleetReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await addHeader(doc, "Relatório por Motorista", `Período: ${data.period}`);

  const byDriver: Record<string, UsageDoc[]> = {};
  for (const u of data.usages) {
    if (!byDriver[u.driverName]) byDriver[u.driverName] = [];
    byDriver[u.driverName].push(u);
  }

  const driverSummary = Object.entries(byDriver).map(([name, usages]) => {
    const done = usages.filter((u) => u.status === "concluido");
    const km = done.reduce((s, u) => s + (u.kmDriven ?? 0), 0);
    const fuel = done.reduce((s, u) => s + (u.fuelCost ?? 0), 0);
    const avarias = usages.filter((u) => u.damages && u.damages.trim().length > 0).length;
    return { name, trips: done.length, km, fuel, avarias };
  }).sort((a, b) => b.km - a.km);

  y = addSectionTitle(doc, "Resumo por Motorista", y);
  autoTable(doc, {
    startY: y,
    head: [["Motorista", "Viagens", "KM Total", "Combustível (R$)", "Avarias"]],
    body: driverSummary.map((d) => [
      d.name,
      String(d.trips),
      `${d.km.toLocaleString("pt-BR")} km`,
      d.fuel > 0 ? `R$ ${d.fuel.toFixed(2)}` : "—",
      d.avarias > 0 ? String(d.avarias) : "—",
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: BRAND_COLOR, textColor: 255 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 10, right: 10 },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 4) {
        const val = String(hookData.cell.raw ?? "");
        if (val !== "—") {
          hookData.cell.styles.textColor = [239, 68, 68];
          hookData.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  addFooter(doc);
  return doc;
}
