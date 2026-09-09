import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const typeLabels: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  inventario: "Inventário",
  transferencia: "Transferência",
};

const unitLabels: Record<string, string> = { m2: "m²", cx: "cx", ml: "ml", un: "un" };

type MovType = "entrada" | "saida" | "ajuste" | "inventario" | "transferencia";

export function PdfExportButton() {
  const [open, setOpen] = useState(false);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [filterType, setFilterType] = useState<"todos" | MovType>("todos");
  const [generating, setGenerating] = useState(false);

  const dateStart = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : 0;
  const dateEnd = dateTo ? new Date(dateTo + "T23:59:59.999").getTime() : 0;

  const movements = useQuery(
    api.stockMovements.listMovementsByDate,
    open && dateFrom && dateTo
      ? { dateStart, dateEnd, ...(filterType !== "todos" ? { type: filterType } : {}) }
      : "skip"
  );

  const handleGenerate = async () => {
    if (!movements) return;
    if (movements.length === 0) {
      toast.error("Nenhuma movimentação encontrada no período selecionado");
      return;
    }
    setGenerating(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();

      // Carregar logo e remover fundo branco via canvas
      let logoDataUrl: string | null = null;
      try {
        const resp = await fetch("/logo-parket-dark.png");
        const blob = await resp.blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx2d = canvas.getContext("2d")!;
        ctx2d.drawImage(bitmap, 0, 0);
        // Remover fundo escuro do logo (manter letras brancas)
        const imgData = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          // Remover tudo que não for claro (letras são brancas/claras)
          if (r < 180 || g < 180 || b < 180) d[i + 3] = 0;
        }
        ctx2d.putImageData(imgData, 0, 0);
        logoDataUrl = canvas.toDataURL("image/png");
      } catch {
        // Logo falhou, continuar sem ela
      }

      // Header
      doc.setFillColor(30, 30, 30);
      doc.rect(0, 0, pageW, 26, "F");
      if (logoDataUrl) {
        // Logo à esquerda, menor para não vazar
        doc.addImage(logoDataUrl, "PNG", 10, 6, 38, 14);
        // Texto centralizado na metade direita da página
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Relatório de Movimentações de Estoque", pageW / 2 + 10, 15, { align: "center" });
      } else {
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Expedição Parket", 14, 11);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Relatório de Movimentações de Estoque", 14, 19);
      }

      // Period info
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(9);
      const fromLabel = format(new Date(dateFrom + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
      const toLabel = format(new Date(dateTo + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
      const periodText = fromLabel === toLabel ? `Data: ${fromLabel}` : `Período: ${fromLabel} – ${toLabel}`;
      doc.text(periodText, 14, 34);
      doc.text(`Tipo: ${filterType === "todos" ? "Todos" : typeLabels[filterType]}`, 14, 40);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 46);
      doc.text(`Total de movimentações: ${movements.length}`, 14, 52);

      // Summary by type
      const summary: Record<string, { count: number; qty: number }> = {};
      for (const m of movements) {
        if (!summary[m.type]) summary[m.type] = { count: 0, qty: 0 };
        summary[m.type].count++;
        summary[m.type].qty += Math.abs(m.quantity);
      }
      const summaryRows = Object.entries(summary).map(([type, s]) => [
        typeLabels[type] ?? type,
        s.count.toString(),
        s.qty.toFixed(2),
      ]);

      autoTable(doc, {
        startY: 58,
        head: [["Tipo", "Qtd. Registros", "Volume Total"]],
        body: summaryRows,
        theme: "grid",
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: "center" }, 2: { halign: "right" } },
        margin: { left: 14, right: 14 },
      });

      // Main table
      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text("Detalhamento das Movimentações", 14, finalY);

      const rows = movements.map((m) => [
        format(new Date(m._creationTime), "dd/MM/yy HH:mm", { locale: ptBR }),
        typeLabels[m.type] ?? m.type,
        m.productCode,
        m.productName,
        (m.quantity >= 0 ? "+" : "") + m.quantity.toFixed(2) + " " + (unitLabels[m.productUnit] ?? m.productUnit),
        m.quantityBefore.toFixed(2),
        m.quantityAfter.toFixed(2),
        m.reason ?? "—",
      ]);

      autoTable(doc, {
        startY: finalY + 4,
        head: [["Data/Hora", "Tipo", "Código", "Produto", "Qtd.", "Antes", "Depois", "Motivo"]],
        body: rows,
        theme: "striped",
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 7, fontStyle: "bold" },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 18 },
          2: { cellWidth: 18 },
          3: { cellWidth: 60 },
          4: { cellWidth: 18, halign: "right" },
          5: { cellWidth: 13, halign: "right" },
          6: { cellWidth: 13, halign: "right" },
          7: { cellWidth: "auto" as unknown as number },
        },
        margin: { left: 14, right: 14 },
      });

      // Footer on each page
      const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Expedição Parket – Página ${i} de ${pageCount}`, pageW / 2, doc.internal.pageSize.getHeight() - 6, { align: "center" });
      }

      const typeSlug = filterType === "todos" ? "todos" : filterType;
      const fileName = `movimentacoes_${typeSlug}_${dateFrom === dateTo ? dateFrom : `${dateFrom}_${dateTo}`}.pdf`;
      doc.save(fileName);
      toast.success("PDF gerado com sucesso!");
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="cursor-pointer">
          <FileDown className="w-4 h-4 mr-2" />
          Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Gerar PDF de Movimentações</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>De</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Até</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Tipo de Movimentação</Label>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as "todos" | MovType)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="ajuste">Ajuste</SelectItem>
                <SelectItem value="inventario">Inventário</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {movements !== undefined && (
            <p className="text-sm text-muted-foreground text-center">
              {movements.length === 0
                ? "Nenhuma movimentação no período"
                : `${movements.length} movimentação(ões) encontrada(s)`}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" className="cursor-pointer" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="cursor-pointer"
              disabled={generating || !movements || movements.length === 0}
              onClick={handleGenerate}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 mr-2" />
                  Baixar PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
