import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Download, Printer, Share2, Mail, MessageCircle, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type jsPDF from "jspdf";

type PdfOption = {
  label: string;
  fileName: string;
  onGenerate: () => Promise<jsPDF>;
};

interface ReportActionsProps {
  reportName: string;
  fileName: string;
  onGenerate: () => Promise<jsPDF>;
  /** Optional: multiple PDF variants shown in a dropdown */
  pdfOptions?: PdfOption[];
}

export function ReportActions({ reportName, fileName, onGenerate, pdfOptions }: ReportActionsProps) {
  const [loading, setLoading] = useState<"pdf" | "print" | "email" | "whatsapp" | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // The active generator — defaults to the main one
  const [activeOption, setActiveOption] = useState<PdfOption | null>(null);

  const getGenerator = () => activeOption?.onGenerate ?? onGenerate;
  const getFileName = () => activeOption?.fileName ?? fileName;

  const handleDownload = async (gen?: () => Promise<jsPDF>, name?: string) => {
    setLoading("pdf");
    try {
      const doc = await (gen ?? getGenerator())();
      doc.save(`${name ?? getFileName()}.pdf`);
      toast.success("PDF baixado com sucesso!");
    } catch {
      toast.error("Erro ao gerar PDF");
    } finally {
      setLoading(null);
    }
  };

  const handlePrint = async () => {
    setLoading("print");
    try {
      const doc = await getGenerator()();
      const dataUri = doc.output("datauristring");
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("Pop-up bloqueado. Permita pop-ups para este site e tente novamente.");
        return;
      }
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${reportName}</title>
            <style>
              * { margin: 0; padding: 0; }
              body { display: flex; justify-content: center; background: #fff; }
              embed { width: 100vw; height: 100vh; border: none; }
            </style>
          </head>
          <body>
            <embed src="${dataUri}" type="application/pdf" />
            <script>
              window.onload = function() { window.print(); };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch {
      toast.error("Erro ao preparar impressão");
    } finally {
      setLoading(null);
    }
  };

  const handleEmail = async () => {
    setLoading("email");
    try {
      const doc = await getGenerator()();
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setShareUrl(url);
      setShareOpen(true);
    } catch {
      toast.error("Erro ao gerar PDF para email");
    } finally {
      setLoading(null);
    }
  };

  const openEmailClient = () => {
    const subject = encodeURIComponent(`Relatório: ${reportName}`);
    const body = encodeURIComponent(
      `Olá,\n\nSegue em anexo o ${reportName}.\n\nGerado automaticamente por Expedição Parket.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const openWhatsApp = async () => {
    setLoading("whatsapp");
    try {
      const doc = await getGenerator()();
      const blobUrl = URL.createObjectURL(doc.output("blob"));
      doc.save(`${getFileName()}.pdf`);
      const text = encodeURIComponent(`Olá! Segue o ${reportName} em anexo. 📊`);
      setTimeout(() => {
        window.open(`https://wa.me/?text=${text}`, "_blank");
        URL.revokeObjectURL(blobUrl);
      }, 500);
      toast.success("PDF baixado — anexe no WhatsApp!");
    } catch {
      toast.error("Erro ao preparar compartilhamento");
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  return (
    <>
      <div className="flex gap-2 items-center">
        {/* Download button — shows dropdown if multiple options */}
        {pdfOptions && pdfOptions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="cursor-pointer" disabled={isLoading}>
                {loading === "pdf" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Baixar PDF
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {pdfOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.fileName}
                  className="cursor-pointer gap-2"
                  onClick={() => {
                    setActiveOption(opt);
                    handleDownload(opt.onGenerate, opt.fileName);
                  }}
                >
                  <Download className="w-4 h-4" />
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button size="sm" className="cursor-pointer" disabled={isLoading} onClick={() => handleDownload()}>
            {loading === "pdf" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Baixar PDF
          </Button>
        )}

        <Button size="sm" variant="secondary" className="cursor-pointer" disabled={isLoading} onClick={handlePrint}>
          {loading === "print" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Printer className="w-4 h-4 mr-2" />
          )}
          Imprimir
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className="cursor-pointer" disabled={isLoading}>
              <Share2 className="w-4 h-4 mr-2" />
              Compartilhar
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => { handleEmail(); }}>
              <Mail className="w-4 h-4 text-blue-500" />
              Enviar por Email
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2" onClick={openWhatsApp}>
              <MessageCircle className="w-4 h-4 text-green-500" />
              Compartilhar no WhatsApp
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={shareOpen} onOpenChange={(o) => { setShareOpen(o); if (!o && shareUrl) URL.revokeObjectURL(shareUrl); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Compartilhar Relatório</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O PDF foi gerado. Escolha como deseja compartilhar:
          </p>
          <div className="flex flex-col gap-3 mt-2">
            <Button
              className="cursor-pointer justify-start gap-3"
              onClick={() => {
                if (shareUrl) {
                  const a = document.createElement("a");
                  a.href = shareUrl;
                  a.download = `${getFileName()}.pdf`;
                  a.click();
                }
                openEmailClient();
                setShareOpen(false);
              }}
            >
              <Mail className="w-4 h-4" />
              Baixar PDF + Abrir Email
            </Button>
            <Button
              variant="secondary"
              className="cursor-pointer justify-start gap-3"
              onClick={async () => {
                setShareOpen(false);
                await openWhatsApp();
              }}
            >
              <MessageCircle className="w-4 h-4 text-green-400" />
              Baixar PDF + Abrir WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

