import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu.tsx";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  CalendarDays,
  Check,
  X,
  Share2,
  MessageCircle,
  Mail,
  Image,
  FileText } from
"lucide-react";
import * as XLSX from "xlsx";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ────────────────────────────────────────────────────────────────────
type ParsedRow = {clientCode: string;clientName: string;os: string;};
type WeeklyRow = {
  _id: Id<"weeklyClients">;
  clientCode: string;
  clientName: string;
  os: string;
  material?: string;
};

// ─── Week helpers ─────────────────────────────────────────────────────────────

/** Returns "YYYY-Wnn" for the current week (Mon-based) */
function currentWeekLabel(): string {
  const now = new Date();
  return dateToWeekLabel(now);
}

function dateToWeekLabel(date: Date): string {
  // ISO week: Monday-based
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Returns { monday, friday } Date objects for the ISO week label */
function weekDates(label: string): {monday: Date;friday: Date;} {
  const [yearStr, wStr] = label.split("-W");
  const year = parseInt(yearStr);
  const week = parseInt(wStr);
  // Jan 4 is always in week 1 (ISO)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  return { monday, friday };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  });
}

/** "Clientes da Semana de 11/05/2026 até 15/05/2026" */
function weekTitle(label: string): string {
  const { monday, friday } = weekDates(label);
  return `Clientes da Semana de ${formatDate(monday)} até ${formatDate(friday)}`;
}

function formatWeekLabel(label: string): string {
  const { monday, friday } = weekDates(label);
  return `${formatDate(monday)} – ${formatDate(friday)}`;
}

// ─── Excel parser ─────────────────────────────────────────────────────────────
function parseExcel(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        if (raw.length === 0) {resolve([]);return;}

        const normalize = (s: string) =>
        s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

        const headers = Object.keys(raw[0]);
        const findCol = (...candidates: string[]): string | undefined => {
          for (const c of candidates) {
            const cn = normalize(c);
            const found = headers.find((h) => normalize(h).includes(cn));
            if (found) return found;
          }
          return undefined;
        };

        const codigoCol = findCol("codigo", "cod", "codcliente", "codigocliente");
        const nomeCol = findCol("fantasia", "nomefantasia", "nome", "razao", "cliente");
        const osCol = findCol("os", "ordemservico", "ordemdeservico", "o.s", "numero");

        if (!codigoCol || !nomeCol) {
          reject(new Error("Colunas não encontradas. O arquivo precisa ter colunas de Código, Nome/Fantasia e O.S."));
          return;
        }

        const rows: ParsedRow[] = raw.
        map((r) => ({
          clientCode: String(r[codigoCol] ?? "").trim(),
          clientName: String(r[nomeCol!] ?? "").trim(),
          os: osCol ? String(r[osCol] ?? "").trim() : ""
        })).
        filter((r) => r.clientCode || r.clientName);

        resolve(rows);
      } catch (err) {reject(err);}
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Share helpers ────────────────────────────────────────────────────────────
function buildShareText(label: string, rows: WeeklyRow[]): string {
  const title = weekTitle(label);
  const lines = rows.map(
    (r, i) =>
    `${i + 1}. *${r.clientName}* | Cód: ${r.clientCode} | O.S.: ${r.os || "—"}${r.material ? `\n   📦 ${r.material}` : ""}`
  );
  return `${title}\n\n${lines.join("\n\n")}`;
}

async function shareAsImage(el: HTMLElement, label: string): Promise<void> {
  const dataUrl = await toPng(el, { cacheBust: true, backgroundColor: "#ffffff" });
  const link = document.createElement("a");
  link.download = `clientes-semana-${label}.png`;
  link.href = dataUrl;
  link.click();
}

async function logoToBase64(): Promise<string | null> {
  try {
    const res = await fetch("/logo-parket-pdf.png");
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function buildPdfTable(doc: jsPDF, startY: number, rows: WeeklyRow[], label: string) {
  autoTable(doc, {
    startY,
    head: [["#", "Código", "Nome do Cliente", "O.S.", "Material"]],
    body: rows.map((r, i) => [
    String(i + 1),
    r.clientCode,
    r.clientName,
    r.os || "—",
    r.material || ""]
    ),
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 22 },
      2: { cellWidth: 80 },
      3: { cellWidth: 22 },
      4: { cellWidth: "auto" as unknown as number }
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    styles: { overflow: "linebreak" }
  });
  doc.save(`clientes-semana-${label}.pdf`);
}

async function shareAsPdf(label: string, rows: WeeklyRow[]): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape" });
  const title = weekTitle(label);
  const today = new Date().toLocaleDateString("pt-BR");

  const logoB64 = await logoToBase64();

  if (logoB64) {
    // Detect format from data URL prefix
    const fmt = logoB64.startsWith("data:image/png") ? "PNG" : "JPEG";
    // Draw logo proportionally up to 14mm tall
    const tmpImg = new window.Image();
    tmpImg.src = logoB64;
    await new Promise<void>((res) => {tmpImg.onload = () => res();tmpImg.onerror = () => res();});
    const logoH = 14;
    const logoW = tmpImg.width > 0 ? tmpImg.width / tmpImg.height * logoH : 40;
    doc.addImage(logoB64, fmt, 14, 6, logoW, logoH);

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, 28);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Gerado em ${today}`, 14, 34);
    doc.setTextColor(0);
    buildPdfTable(doc, 39, rows, label);
  } else {
    // Fallback: no logo
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, 16);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Gerado em ${today}`, 14, 22);
    doc.setTextColor(0);
    buildPdfTable(doc, 28, rows, label);
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ClienteSemanaPage() {
  const [weekLabel, setWeekLabel] = useState<string>(currentWeekLabel());
  const [importing, setImporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const rows = useQuery(api.weeklyClients.listByWeek, { weekLabel });
  const weeks = useQuery(api.weeklyClients.listWeeks, {});
  const bulkImport = useMutation(api.weeklyClients.bulkImport);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const parsed = await parseExcel(file);
      if (parsed.length === 0) {toast.error("Nenhuma linha encontrada na planilha.");return;}
      const count = await bulkImport({ weekLabel, rows: parsed });
      toast.success(`${count} clientes importados!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar a planilha.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const typedRows = (rows ?? []) as WeeklyRow[];

  const handleWhatsApp = () => {
    const text = buildShareText(weekLabel, typedRows);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(weekTitle(weekLabel));
    const body = encodeURIComponent(buildShareText(weekLabel, typedRows).replace(/\*/g, ""));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleImage = async () => {
    if (!tableRef.current) return;
    setSharing(true);
    try {
      await shareAsImage(tableRef.current, weekLabel);
      toast.success("Imagem salva!");
    } catch {
      toast.error("Erro ao gerar imagem.");
    } finally {
      setSharing(false);
    }
  };

  const handlePdf = async () => {
    setSharing(true);
    try {
      await shareAsPdf(weekLabel, typedRows);
      toast.success("PDF gerado!");
    } catch {
      toast.error("Erro ao gerar PDF.");
    } finally {
      setSharing(false);
    }
  };

  const weekOptions = weeks ?
  [...new Set([currentWeekLabel(), ...weeks])].sort().reverse() :
  [currentWeekLabel()];

  const hasRows = typedRows.length > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Cliente da Semana
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Importe a planilha Excel, preencha os materiais e compartilhe.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Week selector */}
          <Select value={weekLabel} onValueChange={setWeekLabel}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weekOptions.map((w) =>
              <SelectItem key={w} value={w}>
                  {formatWeekLabel(w)}
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {/* Import */}
          <Button onClick={() => fileRef.current?.click()} disabled={importing} className="gap-2">
            <Upload className="w-4 h-4" />
            {importing ? "Importando..." : "Importar Excel"}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />

          {/* Share dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={!hasRows || sharing} className="gap-2">
                <Share2 className="w-4 h-4" />
                Compartilhar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleWhatsApp} className="gap-2 cursor-pointer">
                <MessageCircle className="w-4 h-4 text-green-400" />
                WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEmail} className="gap-2 cursor-pointer">
                <Mail className="w-4 h-4 text-blue-500" />
                E-mail
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImage} className="gap-2 cursor-pointer">
                <Image className="w-4 h-4 text-purple-500" />
                Foto (PNG)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePdf} className="gap-2 cursor-pointer">
                <FileText className="w-4 h-4 text-red-500" />
                PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table card — this div is also captured for image/PDF */}
      <Card>
        <div ref={tableRef} className="bg-background rounded-xl">
          {/* Logo header — visible in image/PDF capture */}
          <div className="flex items-center gap-3 px-6 pt-5 pb-2 border-b">
            




            
          </div>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex flex-col sm:flex-row sm:items-center gap-2">
              <span>{weekTitle(weekLabel)}</span>
              {rows !== undefined &&
              <Badge variant="secondary">{rows.length} clientes</Badge>
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {rows === undefined ?
            <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) =>
              <Skeleton key={i} className="h-12 w-full" />
              )}
              </div> :
            rows.length === 0 ?
            <div className="text-center py-16 text-muted-foreground">
                <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum cliente para esta semana.</p>
                <p className="text-sm mt-1">Clique em "Importar Excel" para começar.</p>
              </div> :

            <div className="overflow-x-auto">
                {/* Header row */}
                <div className="grid grid-cols-[110px_1fr_110px_1fr_44px] border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <div className="px-4 py-3">Código</div>
                  <div className="px-4 py-3">Nome do Cliente</div>
                  <div className="px-4 py-3">O.S.</div>
                  <div className="px-4 py-3">Material</div>
                  <div className="px-4 py-3" />
                </div>
                {typedRows.map((row) =>
              <TableRow key={row._id} row={row} />
              )}
              </div>
            }
          </CardContent>
        </div>
      </Card>
    </div>);

}

// ─── Table Row ────────────────────────────────────────────────────────────────
function TableRow({ row }: {row: WeeklyRow;}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.material ?? "");
  const updateMaterial = useMutation(api.weeklyClients.updateMaterial);
  const deleteRow = useMutation(api.weeklyClients.deleteRow);

  const handleSave = async () => {
    await updateMaterial({ id: row._id, material: draft.trim() || undefined });
    setEditing(false);
    toast.success("Material salvo.");
  };

  const handleCancel = () => {
    setDraft(row.material ?? "");
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm("Remover este cliente da semana?")) return;
    await deleteRow({ id: row._id });
  };

  return (
    <div className="grid grid-cols-[110px_1fr_110px_1fr_44px] border-b hover:bg-muted/20 items-start">
      <div className="px-4 py-3 text-sm font-mono">{row.clientCode}</div>
      <div className="px-4 py-3 text-sm font-medium">{row.clientName}</div>
      <div className="px-4 py-3 text-sm">{row.os || "—"}</div>

      {/* Material cell */}
      <div className="px-4 py-2">
        {editing ?
        <div className="flex gap-2 items-start">
            <Textarea
            autoFocus
            className="text-sm min-h-[60px] resize-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Descreva o material..." />
          
            <div className="flex flex-col gap-1 pt-1">
              <button onClick={handleSave} className="text-green-400 hover:text-green-400 cursor-pointer">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div> :

        <div
          onClick={() => setEditing(true)}
          className="min-h-[36px] text-sm cursor-pointer rounded px-2 py-1 hover:bg-muted/50 transition-colors">
          
            {row.material ?
          <span className="whitespace-pre-wrap">{row.material}</span> :

          <span className="text-muted-foreground italic">Clique para preencher...</span>
          }
          </div>
        }
      </div>

      {/* Delete */}
      <div className="px-2 py-3 flex items-center justify-center">
        <button onClick={handleDelete} className="text-destructive/40 hover:text-destructive cursor-pointer">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>);

}