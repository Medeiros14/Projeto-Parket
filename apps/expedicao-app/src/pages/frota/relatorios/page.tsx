import { useState, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu.tsx";
import {
  Truck, Route, Fuel, AlertTriangle, Users,
  Download, Share2, MessageCircle, Mail, Image, Printer,
  ChevronDown, Loader2, Calendar, FileText, BarChart2,
  CheckCircle2, Navigation, TrendingUp, Wrench
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import type { FleetReportData, VehicleDoc, UsageDoc, MaintenanceDoc } from "./_lib/fleet-pdf-generator.ts";
import {
  generateFrotaGeralPDF,
  generateUsoPorVeiculoPDF,
  generateHistoricoUsoPDF,
  generateAvariasPDF,
  generateMotoristaPDF,
  generateManutencaoPDF,
} from "./_lib/fleet-pdf-generator.ts";

type UsageWithVehicle = Doc<"vehicleUsage"> & { vehicle: Doc<"vehicles"> | null };

const PERIOD_OPTIONS = [
  { label: "Últimos 7 dias", value: "7" },
  { label: "Últimos 30 dias", value: "30" },
  { label: "Últimos 90 dias", value: "90" },
  { label: "Todo período", value: "all" },
];

function getDateFrom(period: string) {
  if (period === "all") return undefined;
  const days = parseInt(period, 10);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function getPeriodLabel(period: string) {
  return PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "Período selecionado";
}

// ─── Share helpers ─────────────────────────────────────────────────────────────

type ReportType = "geral" | "por-veiculo" | "historico" | "avarias" | "motoristas" | "manutencao";

const REPORT_CONFIG: Record<ReportType, {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  generate: (data: FleetReportData) => Promise<import("jspdf").default>;
  fileName: (period: string) => string;
}> = {
  geral: {
    label: "Relatório Geral",
    description: "Visão geral da frota com KPIs e lista de veículos",
    icon: BarChart2,
    color: "bg-indigo-500/15 text-indigo-400 dark:bg-indigo-900 dark:text-indigo-300",
    generate: generateFrotaGeralPDF,
    fileName: (p) => `relatorio-frota-geral-${p}d`,
  },
  "por-veiculo": {
    label: "Uso por Veículo",
    description: "KM, viagens e avarias agrupados por veículo",
    icon: Truck,
    color: "bg-blue-500/15 text-blue-400 dark:bg-blue-900 dark:text-blue-300",
    generate: generateUsoPorVeiculoPDF,
    fileName: (p) => `relatorio-uso-veiculo-${p}d`,
  },
  historico: {
    label: "Histórico de Uso",
    description: "Todos os registros de saída e chegada no período",
    icon: Route,
    color: "bg-green-500/15 text-green-400 dark:bg-green-900 dark:text-green-300",
    generate: generateHistoricoUsoPDF,
    fileName: (p) => `relatorio-historico-frota-${p}d`,
  },
  avarias: {
    label: "Avarias Registradas",
    description: "Todas as avarias e ocorrências registradas",
    icon: AlertTriangle,
    color: "bg-red-500/15 text-red-400 dark:bg-red-900 dark:text-red-300",
    generate: generateAvariasPDF,
    fileName: (p) => `relatorio-avarias-frota-${p}d`,
  },
  motoristas: {
    label: "Por Motorista",
    description: "KM e viagens agrupados por motorista",
    icon: Users,
    color: "bg-orange-500/15 text-orange-400 dark:bg-orange-900 dark:text-orange-300",
    generate: generateMotoristaPDF,
    fileName: (p) => `relatorio-motoristas-frota-${p}d`,
  },
  manutencao: {
    label: "Manutenção",
    description: "Todas as manutenções: custos, status e detalhes por veículo",
    icon: Wrench,
    color: "bg-purple-500/15 text-purple-400 dark:bg-purple-900 dark:text-purple-300",
    generate: generateManutencaoPDF,
    fileName: (p: string) => `relatorio-manutencao-frota-${p}d`,
  },
};

// ─── Share actions component ──────────────────────────────────────────────────

function ShareActions({
  reportType,
  buildData,
  period,
  summaryRef,
}: {
  reportType: ReportType;
  buildData: () => FleetReportData;
  period: string;
  summaryRef: React.RefObject<HTMLDivElement | null>;
}) {
  const config = REPORT_CONFIG[reportType];
  const [loading, setLoading] = useState<string | null>(null);

  const getFileName = () => config.fileName(period === "all" ? "todos" : period);

  const handlePDF = async () => {
    setLoading("pdf");
    try {
      const doc = await config.generate(buildData());
      doc.save(`${getFileName()}.pdf`);
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
      const doc = await config.generate(buildData());
      const dataUri = doc.output("datauristring");
      const w = window.open("", "_blank");
      if (!w) { toast.error("Permita pop-ups e tente novamente"); return; }
      w.document.write(`<!DOCTYPE html><html><head><title>${config.label}</title>
        <style>*{margin:0;padding:0}body{display:flex;justify-content:center}embed{width:100vw;height:100vh;border:none}</style>
        </head><body><embed src="${dataUri}" type="application/pdf"/><script>window.onload=()=>window.print()</script></body></html>`);
      w.document.close();
    } catch {
      toast.error("Erro ao preparar impressão");
    } finally {
      setLoading(null);
    }
  };

  const handlePhoto = async () => {
    if (!summaryRef.current) return;
    setLoading("photo");
    try {
      const dataUrl = await toPng(summaryRef.current, { backgroundColor: "white", pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${getFileName()}.png`;
      a.click();
      toast.success("Imagem baixada!");
    } catch {
      toast.error("Erro ao gerar imagem");
    } finally {
      setLoading(null);
    }
  };

  const handleWhatsApp = async () => {
    setLoading("whatsapp");
    try {
      const doc = await config.generate(buildData());
      doc.save(`${getFileName()}.pdf`);
      const text = encodeURIComponent(`Olá! Segue o ${config.label} da frota em anexo.`);
      setTimeout(() => window.open(`https://wa.me/?text=${text}`, "_blank"), 500);
      toast.success("PDF baixado — anexe no WhatsApp!");
    } catch {
      toast.error("Erro ao preparar WhatsApp");
    } finally {
      setLoading(null);
    }
  };

  const handleWhatsAppPhoto = async () => {
    if (!summaryRef.current) return;
    setLoading("whatsapp-photo");
    try {
      const dataUrl = await toPng(summaryRef.current, { backgroundColor: "white", pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${getFileName()}.png`;
      a.click();
      const text = encodeURIComponent(`Olá! Segue o ${config.label} da frota.`);
      setTimeout(() => window.open(`https://wa.me/?text=${text}`, "_blank"), 500);
      toast.success("Imagem baixada — anexe no WhatsApp!");
    } catch {
      toast.error("Erro ao gerar imagem");
    } finally {
      setLoading(null);
    }
  };

  const handleEmail = async () => {
    setLoading("email");
    try {
      const doc = await config.generate(buildData());
      doc.save(`${getFileName()}.pdf`);
      const subject = encodeURIComponent(`Relatório de Frota: ${config.label}`);
      const body = encodeURIComponent(`Olá,\n\nSegue em anexo o ${config.label}.\n\nGerado automaticamente por Expedição Parket.`);
      setTimeout(() => window.open(`mailto:?subject=${subject}&body=${body}`, "_blank"), 300);
      toast.success("PDF baixado — abra seu email e anexe o arquivo!");
    } catch {
      toast.error("Erro ao preparar email");
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Button size="sm" disabled={isLoading} onClick={handlePDF} className="cursor-pointer">
        {loading === "pdf" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
        <span className="hidden sm:inline">Baixar </span>PDF
      </Button>

      <Button size="sm" variant="secondary" disabled={isLoading} onClick={handlePrint} className="cursor-pointer">
        {loading === "print" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Printer className="w-4 h-4 mr-1.5" />}
        <span className="hidden sm:inline">Imprimir</span>
        <span className="sm:hidden">Print</span>
      </Button>

      <Button size="sm" variant="secondary" disabled={isLoading} onClick={handlePhoto} className="cursor-pointer">
        {loading === "photo" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Image className="w-4 h-4 mr-1.5" />}
        Foto
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary" disabled={isLoading} className="cursor-pointer">
            <Share2 className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Compartilhar</span>
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="cursor-pointer gap-2" onClick={handleWhatsApp}>
            {loading === "whatsapp"
              ? <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
              : <MessageCircle className="w-4 h-4 text-green-500" />}
            WhatsApp (PDF)
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer gap-2" onClick={handleWhatsAppPhoto}>
            {loading === "whatsapp-photo"
              ? <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
              : <MessageCircle className="w-4 h-4 text-green-500" />}
            WhatsApp (Foto)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer gap-2" onClick={handleEmail}>
            {loading === "email"
              ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              : <Mail className="w-4 h-4 text-blue-500" />}
            Email (PDF)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Summary card component (used for PNG export) ─────────────────────────────

function SummaryCard({
  vehicles,
  usages,
  period,
  summaryRef,
}: {
  vehicles: VehicleDoc[];
  usages: UsageDoc[];
  period: string;
  summaryRef: React.RefObject<HTMLDivElement | null>;
}) {
  const concluidos = usages.filter((u) => u.status === "concluido");
  const kmTotal = concluidos.reduce((s, u) => s + (u.kmDriven ?? 0), 0);
  const fuelTotal = concluidos.reduce((s, u) => s + (u.fuelCost ?? 0), 0);
  const avarias = usages.filter((u) => u.damages && u.damages.trim().length > 0).length;

  const kpis = [
    { icon: Truck, label: "Total Veículos", value: String(vehicles.length), color: "text-foreground" },
    { icon: CheckCircle2, label: "Disponíveis", value: String(vehicles.filter((v) => v.status === "disponivel").length), color: "text-green-400" },
    { icon: Navigation, label: "Em Uso", value: String(vehicles.filter((v) => v.status === "em_uso").length), color: "text-blue-400" },
    { icon: TrendingUp, label: "Viagens", value: String(concluidos.length), color: "text-indigo-400" },
    { icon: Route, label: "KM Total", value: `${kmTotal.toLocaleString("pt-BR")} km`, color: "text-purple-400" },
    { icon: Fuel, label: "Combustível", value: fuelTotal > 0 ? `R$ ${fuelTotal.toFixed(2)}` : "—", color: "text-orange-400" },
    { icon: AlertTriangle, label: "Avarias", value: String(avarias), color: avarias > 0 ? "text-red-400" : "text-muted-foreground" },
  ];

  return (
    <div ref={summaryRef} className="bg-background rounded-xl border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Relatório de Frota</h2>
          <p className="text-sm text-muted-foreground">{getPeriodLabel(period)}</p>
        </div>
        <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("pt-BR")}</p>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-muted/50 rounded-lg p-3">
            <k.icon className={cn("w-4 h-4 mb-1", k.color)} />
            <p className="text-lg font-bold">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

function FrotaRelatoriosInner() {
  const [period, setPeriod] = useState("30");

  const dateFrom = getDateFrom(period);
  const allVehicles = useQuery(api.fleet.listVehicles, {});
  const periodUsages = useQuery(api.fleet.listUsage, { dateFrom }) as UsageWithVehicle[] | undefined;
  const allMaintenances = useQuery(api.maintenance.listMaintenance, {});

  const summaryRef = useRef<HTMLDivElement | null>(null);

  const buildData = (): FleetReportData => ({
    vehicles: (allVehicles ?? []) as VehicleDoc[],
    usages: (periodUsages ?? []) as UsageDoc[],
    maintenances: (allMaintenances ?? []) as MaintenanceDoc[],
    period: getPeriodLabel(period),
    days: period === "all" ? "all" : parseInt(period, 10),
  });

  const isLoading = allVehicles === undefined || periodUsages === undefined || allMaintenances === undefined;

  const avariasCount = periodUsages?.filter((u) => u.damages && u.damages.trim().length > 0).length ?? 0;
  const kmTotal = periodUsages?.reduce((s, u) => s + (u.kmDriven ?? 0), 0) ?? 0;

  return (
    <div className="flex flex-col h-full overflow-auto pb-8">
      {/* Header */}
      <div className="px-6 py-5 border-b flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios de Frota</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gere e compartilhe relatórios da sua frota</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44">
            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Summary snapshot for PNG export */}
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <SummaryCard
            vehicles={(allVehicles ?? []) as VehicleDoc[]}
            usages={(periodUsages ?? []) as UsageDoc[]}
            period={period}
            summaryRef={summaryRef}
          />
        )}

        {/* Quick stats */}
        {!isLoading && (
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg">
              <Route className="w-3.5 h-3.5 text-primary" />
              <span className="font-semibold text-foreground">{kmTotal.toLocaleString("pt-BR")} km</span> no período
            </span>
            {avariasCount > 0 && (
              <span className="flex items-center gap-1.5 bg-red-500/10 dark:bg-red-950 px-3 py-1.5 rounded-lg text-red-400 dark:text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="font-semibold">{avariasCount}</span> avaria{avariasCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Report cards */}
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Tipos de Relatório
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.entries(REPORT_CONFIG) as [ReportType, typeof REPORT_CONFIG[ReportType]][]).map(([key, config]) => (
              <Card key={key} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", config.color)}>
                      <config.icon className="w-4 h-4" />
                    </div>
                    {config.label}
                    {key === "avarias" && avariasCount > 0 && (
                      <Badge className="bg-red-500/15 text-red-400 dark:bg-red-900 dark:text-red-300 ml-auto">
                        {avariasCount} avaria{avariasCount !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-full" />
                  ) : (
                    <ShareActions
                      reportType={key}
                      buildData={buildData}
                      period={period}
                      summaryRef={summaryRef}
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <Card className="bg-muted/30">
          <CardContent className="py-4 px-5 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Como compartilhar:</p>
            <p><span className="font-medium text-foreground">PDF:</span> Baixa o arquivo para o seu dispositivo.</p>
            <p><span className="font-medium text-foreground">Foto:</span> Salva o resumo como imagem PNG pronta para envio.</p>
            <p><span className="font-medium text-foreground">WhatsApp PDF:</span> Baixa o PDF e abre o WhatsApp para você anexar.</p>
            <p><span className="font-medium text-foreground">WhatsApp Foto:</span> Salva a imagem e abre o WhatsApp.</p>
            <p><span className="font-medium text-foreground">Email:</span> Baixa o PDF e abre seu app de email.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function FrotaRelatoriosPage() {
  return (
    <Authenticated>
      <FrotaRelatoriosInner />
    </Authenticated>
  );
}
