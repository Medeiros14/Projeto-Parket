import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from
"recharts";
import {
  Package, TrendingUp, TrendingDown, AlertTriangle, ShoppingCart,
  Users, ArrowDownCircle, ArrowUpCircle, ChevronRight, X, MapPin, Wrench, Truck,
  LayoutDashboard, FileText, ClipboardList, UserSearch } from
"lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useNavigate } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ReportActions } from "./_components/report-actions.tsx";
import type { ReportData } from "./_lib/pdf-generator.ts";
import {
  generateGeralPDF,
  generateProdutosPDF,
  generateFretesPDF,
  generatePedidosPDF,
  generatePedidosDetalhadosPDF,
  generateMovimentacoesPDF,
  generateTransportesPDF,
  generateEstoqueCriticoPDF,
  generateInventarioPDF,
  generateListaContagemPDF,
  generatePedidosPorClientePDF,
  generateSaidaMaterialPDF,
  type ClientOrderReport } from
"./_lib/pdf-generator.ts";

type OrderStatus = "rascunho" | "confirmado" | "em_separacao" | "em_rota" | "entregue" | "cancelado";

const unitLabels: Record<string, string> = { m2: "m²", cx: "cx", ml: "ml", un: "un" };

const movTypeLabels: Record<string, string> = {
  entrada: "Entradas", saida: "Saídas", ajuste: "Ajustes",
  inventario: "Inventário", transferencia: "Transferência"
};

const movTypeColors: Record<string, string> = {
  entrada: "#10b981", saida: "#ef4444", ajuste: "#f59e0b",
  inventario: "#3b82f6", transferencia: "#8b5cf6"
};

const orderStatusLabels: Record<string, string> = {
  rascunho: "Rascunho", confirmado: "Confirmado", em_separacao: "Em Separação",
  em_rota: "Em Rota", entregue: "Entregue", cancelado: "Cancelado"
};

const orderStatusColors: Record<string, string> = {
  rascunho: "#9ca3af", confirmado: "#3b82f6", em_separacao: "#f59e0b",
  em_rota: "#8b5cf6", entregue: "#10b981", cancelado: "#ef4444"
};

const transportStatusLabels: Record<string, string> = {
  pendente: "Pendente", em_rota: "Em Rota", entregue: "Entregue", cancelado: "Cancelado"
};

const transportStatusColors: Record<string, string> = {
  pendente: "#f59e0b", em_rota: "#8b5cf6", entregue: "#10b981", cancelado: "#ef4444"
};

const DAYS_OPTIONS = [7, 15, 30, 60, 90];

function StatCard({
  icon: Icon, label, value, sub, color
}: {icon: React.ElementType;label: string;value: string | number;sub?: string;color: string;}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className={`p-3 rounded-xl ${color} shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>);

}

type TabKey = "geral" | "produtos" | "pedidos" | "movimentacoes" | "fretes" | "transportes" | "estoque_critico" | "inventario" | "pedidos_cliente" | "saida_material";

const TABS: {key: TabKey;label: string;icon: React.ElementType;}[] = [
{ key: "geral", label: "Geral", icon: LayoutDashboard },
{ key: "produtos", label: "Produtos", icon: Package },
{ key: "pedidos", label: "Pedidos", icon: ShoppingCart },
{ key: "pedidos_cliente", label: "Por Cliente", icon: UserSearch },
{ key: "saida_material", label: "Saída de Material", icon: ArrowUpCircle },
{ key: "movimentacoes", label: "Movimentações", icon: TrendingUp },
{ key: "fretes", label: "Fretes", icon: Truck },
{ key: "transportes", label: "Ferramentas", icon: Wrench },
{ key: "estoque_critico", label: "Estoque Crítico", icon: AlertTriangle },
{ key: "inventario", label: "Inventário", icon: ClipboardList }];


function ClientOrderCard({ client }: { client: ClientOrderReport }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {client.clientName}
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
              {client.clientCity && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{client.clientCity}{client.clientState ? `/${client.clientState}` : ""}</span>}
              {client.clientPhone && <span>{client.clientPhone}</span>}
              {client.clientEmail && <span>{client.clientEmail}</span>}
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0 flex-wrap">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Pedidos</p>
              <p className="text-lg font-bold">{client.totalOrders}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-sm font-bold">R$ {client.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Frete</p>
              <p className="text-sm font-medium">R$ {client.totalFreight.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <Button size="sm" variant="secondary" className="cursor-pointer h-7 text-xs" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Fechar" : "Ver Pedidos"}
              <ChevronRight className={`w-3 h-3 ml-1 transition-transform ${expanded ? "rotate-90" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded &&
      <CardContent>
          <div className="space-y-4 pt-2">
            {client.orders.map((order) =>
          <div key={order._id} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/40 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">#{order.orderNumber}</span>
                    <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: orderStatusColors[order.status] + "22",
                    color: orderStatusColors[order.status]
                  }}>
                      {orderStatusLabels[order.status] ?? order.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>{new Date(order._creationTime).toLocaleDateString("pt-BR")}</span>
                    {order.scheduledDate && <span>Agenda: {order.scheduledDate}</span>}
                    {order.freightValue ? <span className="flex items-center gap-1"><Truck className="w-3 h-3" />R$ {order.freightValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span> : null}
                    <span className="font-semibold text-foreground">R$ {(order.totalValue + (order.freightValue ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                {order.deliveryAddress &&
            <div className="px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-1 border-b">
                    <MapPin className="w-3 h-3 shrink-0" />{order.deliveryAddress}
                  </div>
            }
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left px-3 py-1.5 font-medium">Produto</th>
                        <th className="text-left px-3 py-1.5 font-medium hidden md:table-cell">Código</th>
                        <th className="text-right px-3 py-1.5 font-medium">Qtd.</th>
                        <th className="text-right px-3 py-1.5 font-medium hidden md:table-cell">Preço Unit.</th>
                        <th className="text-right px-3 py-1.5 font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, idx) =>
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-1.5">{item.productName}</td>
                          <td className="px-3 py-1.5 text-muted-foreground hidden md:table-cell">{item.productCode}</td>
                          <td className="px-3 py-1.5 text-right">{item.quantity.toLocaleString("pt-BR")} {item.unit}</td>
                          <td className="px-3 py-1.5 text-right text-muted-foreground hidden md:table-cell">{item.unitPrice != null ? `R$ ${item.unitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</td>
                          <td className="px-3 py-1.5 text-right font-medium">R$ {item.subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        </tr>
                  )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30">
                        <td colSpan={2} className="px-3 py-1.5 font-semibold">{order.totalItems} produto(s)</td>
                        <td colSpan={3} className="px-3 py-1.5 text-right font-bold">Total: R$ {(order.totalValue + (order.freightValue ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {order.notes &&
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-t">
                    Obs: {order.notes}
                  </div>
            }
              </div>
          )}
          </div>
        </CardContent>
      }
    </Card>
  );
}

function SaidaRow({
  row, index, barPct, unitLabels,
}: {
  row: { productName: string; productCode: string; unit: string; totalQty: number; movCount: number; lastDate: number; exits: { date: number; qty: number; reason: string | undefined; orderNumber: string | undefined }[] };
  index: number;
  barPct: number;
  unitLabels: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const unit = unitLabels[row.unit] ?? row.unit;
  return (
    <>
      <tr
        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="py-2 text-xs text-muted-foreground font-bold w-6">{index + 1}</td>
        <td className="py-2">
          <div className="space-y-1">
            <p className="font-medium">{row.productName}</p>
            <div className="h-1 bg-muted rounded-full w-28 overflow-hidden">
              <div className="h-full bg-destructive rounded-full" style={{ width: `${barPct}%` }} />
            </div>
          </div>
        </td>
        <td className="py-2 text-muted-foreground hidden md:table-cell">{row.productCode}</td>
        <td className="py-2 text-right font-bold text-destructive">{row.totalQty.toFixed(2)} {unit}</td>
        <td className="py-2 text-right hidden md:table-cell">{row.movCount}</td>
        <td className="py-2 text-right text-xs text-muted-foreground hidden md:table-cell">
          {new Date(row.lastDate).toLocaleDateString("pt-BR")}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b bg-muted/20">
          <td colSpan={6} className="px-4 pb-3 pt-1">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Detalhes das saídas:</p>
            <div className="space-y-1">
              {row.exits
                .sort((a, b) => b.date - a.date)
                .map((exit, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-foreground/80">
                    <span className="text-muted-foreground w-16 shrink-0">{new Date(exit.date).toLocaleDateString("pt-BR")}</span>
                    <span className="font-bold text-destructive">-{exit.qty.toFixed(2)} {unit}</span>
                    {exit.orderNumber && <span className="text-primary font-medium">{exit.orderNumber}</span>}
                    {exit.reason && <span className="text-muted-foreground truncate">{exit.reason}</span>}
                  </div>
                ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState<TabKey>("geral");
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | undefined>(undefined);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const [clientStatusFilter, setClientStatusFilter] = useState<OrderStatus | "todos">("todos");

  const summary = useQuery(api.reports.stockSummary, {});
  const byType = useQuery(api.reports.movementsByType, { days });
  const saidaMaterial = useQuery(api.reports.saidaMaterialReport, { days });
  const byStatus = useQuery(api.reports.ordersByStatus, {});
  const topProducts = useQuery(api.reports.topMovedProducts, { days });
  const products = useQuery(api.products.listProducts, {});
  const freightByClient = useQuery(api.reports.freightByClient, {});
  const toolTransportsSummary = useQuery(api.reports.toolTransportsSummary, {});
  const ordersFullReport = useQuery(api.reports.ordersFullReport, {});
  const inventoryReport = useQuery(api.reports.inventoryReport, {});
  const clients = useQuery(api.clients.listClients, {});
  const ordersByClient = useQuery(
    api.reports.ordersByClient,
    {
      clientId: selectedClientId as Id<"clients"> | undefined,
      status: clientStatusFilter !== "todos" ? clientStatusFilter : undefined,
    }
  );
  const clientsByStatus = useQuery(
    api.reports.ordersByStatusAndClient,
    selectedStatus ? { status: selectedStatus } : "skip"
  );

  const reportData: ReportData = {
    summary,
    byType,
    byStatus,
    topProducts,
    products,
    freightByClient,
    transportsSummary: toolTransportsSummary,
    ordersFullReport,
    inventoryReport,
    saidaMaterial,
    days
  };

  const movChartData = Object.entries(byType ?? {}).map(([type, count]) => ({
    name: movTypeLabels[type] ?? type,
    count,
    fill: movTypeColors[type] ?? "#6b7280"
  }));

  const orderChartData = Object.entries(byStatus ?? {}).map(([status, count]) => ({
    name: orderStatusLabels[status] ?? status,
    status,
    value: count,
    fill: orderStatusColors[status] ?? "#6b7280"
  }));

  const lowStockProducts = products?.filter((p) => p.minStock != null && p.currentStock <= p.minStock) ?? [];
  const zeroStockProducts = products?.filter((p) => p.currentStock === 0) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Visão analítica do estoque e pedidos</p>
        </div>
        



        
      </div>

      {/* Report tabs */}
      <div className="flex gap-1.5 overflow-x-auto border-b pb-2 -mx-4 md:mx-0 px-4 md:px-0 scrollbar-none flex-nowrap md:flex-wrap">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition-colors cursor-pointer shrink-0 ${
              activeTab === tab.key ?
              "bg-primary text-primary-foreground" :
              "text-muted-foreground hover:text-foreground hover:bg-muted"}`
              }>
              <Icon className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>);

        })}
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-medium text-muted-foreground">Período:</p>
        {DAYS_OPTIONS.map((d) =>
        <Button
          key={d}
          size="sm"
          variant={days === d ? "default" : "secondary"}
          className="cursor-pointer h-7 text-xs"
          onClick={() => setDays(d)}>
          
            {d} dias
          </Button>
        )}
      </div>

      {/* ── GERAL ── */}
      {activeTab === "geral" &&
      <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Relatório Geral</h2>
            <ReportActions
            reportName="Relatório Geral"
            fileName="relatorio-geral"
            onGenerate={() => generateGeralPDF(reportData)} />
          
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Package} label="Total Produtos" value={summary?.totalProducts ?? "—"} color="bg-primary" />
            <StatCard icon={AlertTriangle} label="Estoque Baixo" value={summary?.lowStock ?? "—"} color="bg-amber-500" />
            <StatCard icon={TrendingDown} label="Sem Estoque" value={summary?.zeroStock ?? "—"} color="bg-destructive" />
            <StatCard icon={Users} label="Total Clientes" value={summary?.totalClients ?? "—"} color="bg-[oklch(0.55_0.16_160)]" />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Movimentações por Tipo ({days}d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {movChartData.length === 0 ?
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p> :

              <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={movChartData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} formatter={(v: number) => [v, "Qtd"]} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {movChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              }
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                  Pedidos por Status
                  <span className="text-xs text-muted-foreground font-normal ml-1">— clique para ver clientes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orderChartData.length === 0 ?
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido registrado</p> :

              <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={orderChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false}
                    onClick={(entry) => setSelectedStatus(entry.status as OrderStatus)} className="cursor-pointer">
                      
                          {orderChartData.map((entry, i) =>
                      <Cell key={i} fill={entry.fill} opacity={selectedStatus && selectedStatus !== entry.status ? 0.35 : 1}
                      stroke={selectedStatus === entry.status ? "white" : "none"} strokeWidth={2} />
                      )}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    {selectedStatus &&
                <div className="mt-4 border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: orderStatusColors[selectedStatus] }} />
                            <span className="text-sm font-semibold">{orderStatusLabels[selectedStatus]}</span>
                          </div>
                          <button className="cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setSelectedStatus(null)}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {clientsByStatus === undefined ?
                  <div className="p-4 text-sm text-muted-foreground text-center">Carregando...</div> :
                  clientsByStatus.length === 0 ?
                  <div className="p-4 text-sm text-muted-foreground text-center">Nenhum cliente encontrado</div> :

                  <div className="divide-y max-h-64 overflow-y-auto">
                            {clientsByStatus.map((c, i) =>
                    <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-muted/30">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{c.clientName}</p>
                                  {c.clientCity && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{c.clientCity}</p>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                  <div className="text-right">
                                    <p className="text-xs font-bold">{c.orders.length} pedido{c.orders.length > 1 ? "s" : ""}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {c.orders.map((o) =>
                            <button key={o._id} className="hover:underline cursor-pointer text-primary mr-1"
                            onClick={() => navigate(`/pedidos/${o._id}`)}>{o.orderNumber}</button>
                            )}
                                    </p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </div>
                              </div>
                    )}
                          </div>
                  }
                      </div>
                }
                  </>
              }
              </CardContent>
            </Card>
          </div>
        </div>
      }

      {/* ── PRODUTOS ── */}
      {activeTab === "produtos" &&
      <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Relatório de Produtos</h2>
            <ReportActions
            reportName="Relatório de Produtos"
            fileName="relatorio-produtos"
            onGenerate={() => generateProdutosPDF(reportData)} />
          
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Package} label="Produtos Ativos" value={products?.filter((p) => p.active).length ?? "—"} color="bg-primary" />
            <StatCard icon={AlertTriangle} label="Estoque Baixo" value={summary?.lowStock ?? "—"} color="bg-amber-500" />
            <StatCard icon={TrendingDown} label="Sem Estoque" value={summary?.zeroStock ?? "—"} color="bg-destructive" />
            <StatCard icon={TrendingUp} label="Movimentados ({days}d)" value={topProducts?.length ?? "—"} color="bg-[oklch(0.55_0.16_160)]" />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Produtos Mais Movimentados ({days} dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!topProducts || topProducts.length === 0 ?
            <p className="text-sm text-muted-foreground text-center py-4">Sem movimentações no período</p> :

            <div className="space-y-2">
                  {topProducts.map((p, i) => {
                const total = p.entries + p.exits;
                const entryPct = total > 0 ? p.entries / total * 100 : 0;
                return (
                  <div key={p.productId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                            <span className="font-medium truncate">{p.productName}</span>
                            <span className="text-xs text-muted-foreground hidden md:block">{p.productCode}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-xs">
                            <span className="flex items-center gap-1 text-emerald-400"><ArrowDownCircle className="w-3 h-3" />+{p.entries.toFixed(1)} {unitLabels[p.productUnit] ?? p.productUnit}</span>
                            <span className="flex items-center gap-1 text-red-500"><ArrowUpCircle className="w-3 h-3" />-{p.exits.toFixed(1)} {unitLabels[p.productUnit] ?? p.productUnit}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${entryPct}%` }} />
                        </div>
                      </div>);

              })}
                </div>
            }
            </CardContent>
          </Card>
        </div>
      }

      {/* ── PEDIDOS ── */}
      {activeTab === "pedidos" &&
      <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Relatório de Pedidos</h2>
            <ReportActions
            reportName="Relatório de Pedidos"
            fileName="relatorio-pedidos"
            onGenerate={() => generatePedidosPDF(reportData)}
            pdfOptions={[
              { label: "Resumo de Pedidos", fileName: "relatorio-pedidos", onGenerate: () => generatePedidosPDF(reportData) },
              { label: "Pedidos Detalhados", fileName: "relatorio-pedidos-detalhado", onGenerate: () => generatePedidosDetalhadosPDF(reportData) },
            ]} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={ShoppingCart} label="Total Pedidos" value={Object.values(byStatus ?? {}).reduce((s, v) => s + v, 0)} color="bg-primary" />
            <StatCard icon={TrendingUp} label="Entregues" value={byStatus?.entregue ?? 0} color="bg-emerald-500" />
            <StatCard icon={TrendingDown} label="Cancelados" value={byStatus?.cancelado ?? 0} color="bg-destructive" />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary" />
                Distribuição por Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orderChartData.length === 0 ?
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido registrado</p> :

            <div className="grid md:grid-cols-2 gap-6 items-center">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={orderChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                        {orderChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {orderChartData.map((d) =>
                <div key={d.status} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.fill }} />
                          <span>{d.name}</span>
                        </div>
                        <span className="font-bold">{d.value}</span>
                      </div>
                )}
                  </div>
                </div>
            }
            </CardContent>
          </Card>

          {/* Full orders table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Todos os Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!ordersFullReport ?
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p> :
            ordersFullReport.length === 0 ?
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido registrado</p> :

            <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2 font-medium">Pedido</th>
                        <th className="text-left py-2 font-medium">Cliente</th>
                        <th className="text-left py-2 font-medium hidden md:table-cell">Cidade</th>
                        <th className="text-left py-2 font-medium hidden md:table-cell">Tel</th>
                        <th className="text-center py-2 font-medium">Status</th>
                        <th className="text-right py-2 font-medium hidden md:table-cell">Frete</th>
                        <th className="text-right py-2 font-medium hidden md:table-cell">Vl. Frete</th>
                        <th className="text-center py-2 font-medium hidden md:table-cell">Data</th>
                        <th className="text-right py-2 font-medium hidden lg:table-cell">Itens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersFullReport.map((o) =>
                  <tr key={o._id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2">
                            <button className="font-mono text-xs font-bold text-primary hover:underline cursor-pointer" onClick={() => navigate(`/pedidos/${o._id}`)}>{o.orderNumber}</button>
                          </td>
                          <td className="py-2 font-medium">{o.client.name}</td>
                          <td className="py-2 text-muted-foreground hidden md:table-cell">{o.client.city ?? "—"}</td>
                          <td className="py-2 text-muted-foreground hidden md:table-cell">{o.client.phone ?? "—"}</td>
                          <td className="py-2 text-center">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: orderStatusColors[o.status] + "22", color: orderStatusColors[o.status] }}>
                              {orderStatusLabels[o.status] ?? o.status}
                            </span>
                          </td>
                          <td className="py-2 text-right text-muted-foreground text-xs hidden md:table-cell">{{ interno: "Interno", terceiro: "Terceiro", retirada: "Retirada" }[o.freightType]}</td>
                          <td className="py-2 text-right hidden md:table-cell">{o.freightValue ? `R$ ${o.freightValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</td>
                          <td className="py-2 text-center text-xs text-muted-foreground hidden md:table-cell">{new Date(o._creationTime).toLocaleDateString("pt-BR")}</td>
                          <td className="py-2 text-right text-xs text-muted-foreground hidden lg:table-cell">{o.totalItems}</td>
                        </tr>
                  )}
                    </tbody>
                  </table>
                </div>
            }
            </CardContent>
          </Card>
        </div>
      }

      {/* ── SAÍDA DE MATERIAL ── */}
      {activeTab === "saida_material" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Relatório de Saída de Material</h2>
            <ReportActions
              reportName="Saída de Material"
              fileName="relatorio-saida-material"
              onGenerate={() => generateSaidaMaterialPDF(reportData)} />
          </div>

          {!saidaMaterial ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard icon={ArrowUpCircle} label="Produtos com Saída" value={saidaMaterial.rows.length} color="bg-destructive" />
                <StatCard icon={TrendingDown} label="Total de Saídas" value={saidaMaterial.totalExits} color="bg-amber-500" />
                <StatCard icon={Package} label="Período" value={`${saidaMaterial.days} dias`} color="bg-primary" />
              </div>

              {saidaMaterial.rows.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <ArrowUpCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="font-semibold">Nenhuma saída no período</p>
                    <p className="text-sm text-muted-foreground">Não há movimentações de saída nos últimos {days} dias.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ArrowUpCircle className="w-4 h-4 text-destructive" />
                        Saída por Produto — Top 10 ({days} dias)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={saidaMaterial.rows.slice(0, 10).map((r) => ({
                            name: r.productCode,
                            fullName: r.productName,
                            qty: r.totalQty,
                            unit: r.unit,
                          }))}
                          margin={{ top: 4, right: 8, bottom: 4, left: -10 }}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }}
                            formatter={(v: number, _: string, props: { payload?: { unit?: string; fullName?: string } }) => [
                              `${v.toFixed(2)} ${props.payload?.unit ?? ""}`,
                              props.payload?.fullName ?? "Qtd",
                            ]}
                          />
                          <Bar dataKey="qty" fill="#ef4444" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Detail table */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        Detalhamento por Produto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-muted-foreground text-xs">
                              <th className="text-left py-2 font-medium">#</th>
                              <th className="text-left py-2 font-medium">Produto</th>
                              <th className="text-left py-2 font-medium hidden md:table-cell">Código</th>
                              <th className="text-right py-2 font-medium">Qtd. Total</th>
                              <th className="text-right py-2 font-medium hidden md:table-cell">Nº Saídas</th>
                              <th className="text-right py-2 font-medium hidden md:table-cell">Última Saída</th>
                            </tr>
                          </thead>
                          <tbody>
                            {saidaMaterial.rows.map((row, i) => {
                              const maxQty = saidaMaterial.rows[0].totalQty;
                              const barPct = maxQty > 0 ? (row.totalQty / maxQty) * 100 : 0;
                              return (
                                <SaidaRow key={row.productId} row={row} index={i} barPct={barPct} unitLabels={unitLabels} />
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t">
                              <td colSpan={3} className="pt-2 font-semibold text-sm">Total</td>
                              <td className="pt-2 text-right font-bold text-destructive">{saidaMaterial.totalQty.toFixed(2)}</td>
                              <td className="pt-2 text-right font-bold hidden md:table-cell">{saidaMaterial.totalExits}</td>
                              <td className="pt-2 hidden md:table-cell" />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── MOVIMENTAÇÕES ── */}
      {activeTab === "movimentacoes" &&
      <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Relatório de Movimentações</h2>
            <ReportActions
            reportName="Relatório de Movimentações"
            fileName="relatorio-movimentacoes"
            onGenerate={() => generateMovimentacoesPDF(reportData)} />
          
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Movimentações por Tipo ({days} dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movChartData.length === 0 ?
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p> :

            <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={movChartData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} formatter={(v: number) => [v, "Qtd"]} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {movChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
            }
            </CardContent>
          </Card>
        </div>
      }

      {/* ── FRETES ── */}
      {activeTab === "fretes" &&
      <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Relatório de Fretes</h2>
            <ReportActions
            reportName="Relatório de Fretes"
            fileName="relatorio-fretes"
            onGenerate={() => generateFretesPDF(reportData)} />
          
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary" />
                Valor de Frete por Cliente — Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!freightByClient || freightByClient.length === 0 ?
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum frete registrado</p> :

            <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2 font-medium">Cliente</th>
                        <th className="text-left py-2 font-medium hidden md:table-cell">Cidade</th>
                        <th className="text-right py-2 font-medium">Pedidos c/ Frete</th>
                        <th className="text-right py-2 font-medium">Total Frete</th>
                        <th className="text-right py-2 font-medium hidden md:table-cell">Média/Pedido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {freightByClient.map((c, i) => {
                    const maxTotal = freightByClient[0].total;
                    const barPct = maxTotal > 0 ? c.total / maxTotal * 100 : 0;
                    return (
                      <tr key={i} className="border-b last:border-0">
                            <td className="py-2">
                              <div className="space-y-1">
                                <p className="font-medium">{c.clientName}</p>
                                <div className="h-1 bg-muted rounded-full w-32 overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${barPct}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="py-2 text-muted-foreground hidden md:table-cell">{c.clientCity ?? "—"}</td>
                            <td className="py-2 text-right">{c.count}</td>
                            <td className="py-2 text-right font-bold">R$ {c.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                            <td className="py-2 text-right text-muted-foreground hidden md:table-cell">R$ {(c.total / c.count).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                          </tr>);

                  })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t">
                        <td className="pt-2 font-semibold text-sm" colSpan={2}>Total Geral</td>
                        <td className="pt-2 text-right font-semibold">{freightByClient.reduce((s, c) => s + c.count, 0)}</td>
                        <td className="pt-2 text-right font-bold text-primary">R$ {freightByClient.reduce((s, c) => s + c.total, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td className="pt-2 hidden md:table-cell" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
            }
            </CardContent>
          </Card>

          {toolTransportsSummary && toolTransportsSummary.freightByClient.length > 0 &&
        <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-primary" />
                  Frete por Cliente — Transporte de Ferramentas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2 font-medium">Cliente</th>
                        <th className="text-left py-2 font-medium hidden md:table-cell">Cidade</th>
                        <th className="text-right py-2 font-medium">Transportes</th>
                        <th className="text-right py-2 font-medium">Total Frete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toolTransportsSummary.freightByClient.map((c, i) =>
                  <tr key={i} className="border-b last:border-0">
                          <td className="py-2 font-medium">{c.clientName}</td>
                          <td className="py-2 text-muted-foreground hidden md:table-cell">{c.clientCity ?? "—"}</td>
                          <td className="py-2 text-right">{c.count}</td>
                          <td className="py-2 text-right font-bold">R$ {c.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        </tr>
                  )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t">
                        <td className="pt-2 font-semibold text-sm" colSpan={2}>Total Geral</td>
                        <td className="pt-2 text-right font-semibold">{toolTransportsSummary.freightByClient.reduce((s, c) => s + c.count, 0)}</td>
                        <td className="pt-2 text-right font-bold text-primary">R$ {toolTransportsSummary.freightByClient.reduce((s, c) => s + c.total, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
        }
        </div>
      }

      {/* ── TRANSPORTES ── */}
      {activeTab === "transportes" &&
      <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Transporte de Ferramentas</h2>
            <ReportActions
            reportName="Relatório de Transporte de Ferramentas"
            fileName="relatorio-transportes"
            onGenerate={() => generateTransportesPDF(reportData)} />
          
          </div>

          {!toolTransportsSummary ?
        <p className="text-sm text-muted-foreground">Carregando...</p> :

        <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(transportStatusLabels).map(([key, label]) => {
              const count = toolTransportsSummary.byStatus[key] ?? 0;
              return (
                <div key={key} className="border rounded-lg p-3 flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: transportStatusColors[key] }} />
                      <div>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-xl font-bold">{count}</p>
                      </div>
                    </div>);

            })}
              </div>

              {toolTransportsSummary.freightByClient.length > 0 &&
          <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-primary" />
                      Frete por Cliente
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground text-xs">
                            <th className="text-left py-2 font-medium">Cliente</th>
                            <th className="text-left py-2 font-medium hidden md:table-cell">Cidade</th>
                            <th className="text-right py-2 font-medium">Transportes</th>
                            <th className="text-right py-2 font-medium">Total Frete</th>
                          </tr>
                        </thead>
                        <tbody>
                          {toolTransportsSummary.freightByClient.map((c, i) =>
                    <tr key={i} className="border-b last:border-0">
                              <td className="py-2 font-medium">{c.clientName}</td>
                              <td className="py-2 text-muted-foreground hidden md:table-cell">{c.clientCity ?? "—"}</td>
                              <td className="py-2 text-right">{c.count}</td>
                              <td className="py-2 text-right font-bold">R$ {c.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                            </tr>
                    )}
                        </tbody>
                        <tfoot>
                          <tr className="border-t">
                            <td className="pt-2 font-semibold text-sm" colSpan={2}>Total Geral</td>
                            <td className="pt-2 text-right font-semibold">{toolTransportsSummary.freightByClient.reduce((s, c) => s + c.count, 0)}</td>
                            <td className="pt-2 text-right font-bold text-primary">R$ {toolTransportsSummary.freightByClient.reduce((s, c) => s + c.total, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
          }
            </>
        }
        </div>
      }

      {/* ── ESTOQUE CRÍTICO ── */}
      {activeTab === "estoque_critico" &&
      <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Estoque Crítico</h2>
            <ReportActions
            reportName="Relatório de Estoque Crítico"
            fileName="relatorio-estoque-critico"
            onGenerate={() => generateEstoqueCriticoPDF(reportData)} />
          
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={TrendingDown} label="Sem Estoque" value={zeroStockProducts.length} color="bg-destructive" />
            <StatCard icon={AlertTriangle} label="Abaixo do Mínimo" value={lowStockProducts.length - zeroStockProducts.length} color="bg-amber-500" />
            <StatCard icon={Package} label="Total Críticos" value={lowStockProducts.length} color="bg-primary" />
          </div>

          {zeroStockProducts.length > 0 &&
        <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <TrendingDown className="w-4 h-4" />
                  Produtos Sem Estoque
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2 font-medium">Produto</th>
                        <th className="text-left py-2 font-medium">Código</th>
                        <th className="text-right py-2 font-medium">Estoque Mínimo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zeroStockProducts.map((p) =>
                  <tr key={p._id} className="border-b last:border-0">
                          <td className="py-2 font-medium text-destructive">{p.name}</td>
                          <td className="py-2 text-muted-foreground">{p.code}</td>
                          <td className="py-2 text-right">{p.minStock ?? "—"} {unitLabels[p.unit] ?? p.unit}</td>
                        </tr>
                  )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
        }

          {lowStockProducts.length > 0 &&
        <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  Produtos com Estoque Abaixo do Mínimo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2 font-medium">Produto</th>
                        <th className="text-left py-2 font-medium">Código</th>
                        <th className="text-right py-2 font-medium">Atual</th>
                        <th className="text-right py-2 font-medium">Mínimo</th>
                        <th className="text-right py-2 font-medium">Diferença</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockProducts.map((p) => {
                    const diff = p.currentStock - (p.minStock ?? 0);
                    return (
                      <tr key={p._id} className="border-b last:border-0">
                            <td className="py-2 font-medium">{p.name}</td>
                            <td className="py-2 text-muted-foreground">{p.code}</td>
                            <td className="py-2 text-right font-bold text-destructive">{p.currentStock} {unitLabels[p.unit] ?? p.unit}</td>
                            <td className="py-2 text-right text-muted-foreground">{p.minStock} {unitLabels[p.unit] ?? p.unit}</td>
                            <td className="py-2 text-right text-destructive font-bold">{diff.toFixed(2)}</td>
                          </tr>);

                  })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
        }

          {lowStockProducts.length === 0 && zeroStockProducts.length === 0 &&
        <Card>
              <CardContent className="py-12 text-center">
                <Package className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                <p className="font-semibold text-emerald-400">Estoque em ordem!</p>
                <p className="text-sm text-muted-foreground">Nenhum produto com estoque crítico.</p>
              </CardContent>
            </Card>
        }
        </div>
      }

      {/* ── INVENTÁRIO ── */}
      {activeTab === "inventario" &&
      <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Relatório de Inventário</h2>
            <ReportActions
            reportName="Relatório de Inventário"
            fileName="relatorio-inventario"
            onGenerate={() => generateInventarioPDF(reportData, selectedInventoryId)}
            pdfOptions={[
              { label: "Relatório de Inventário", fileName: "relatorio-inventario", onGenerate: () => generateInventarioPDF(reportData, selectedInventoryId) },
              { label: "Lista de Contagem", fileName: "lista-contagem", onGenerate: () => generateListaContagemPDF(reportData, selectedInventoryId) },
            ]} />
          </div>

          {!inventoryReport ?
          <p className="text-sm text-muted-foreground">Carregando...</p> :
          inventoryReport.length === 0 ?
          <Card><CardContent className="py-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold">Nenhum inventário registrado</p>
            <p className="text-sm text-muted-foreground">Crie inventários na seção de Estoque.</p>
          </CardContent></Card> :

          <>
            {/* Inventory selector */}
            {inventoryReport.length > 1 &&
            <div className="flex gap-2 flex-wrap">
                <p className="text-sm font-medium text-muted-foreground self-center">Inventário:</p>
                {inventoryReport.map((inv) =>
              <Button key={inv._id} size="sm" variant={selectedInventoryId === inv._id || (!selectedInventoryId && inv === inventoryReport[0]) ? "default" : "secondary"}
                className="cursor-pointer h-7 text-xs" onClick={() => setSelectedInventoryId(inv._id)}>
                    {inv.name}
                  </Button>
              )}
              </div>
            }

            {(() => {
              const inv = selectedInventoryId
                ? inventoryReport.find((i) => i._id === selectedInventoryId) ?? inventoryReport[0]
                : inventoryReport[0];
              if (!inv) return null;
              const inventoryStatusLabels: Record<string, string> = { aberto: "Aberto", em_andamento: "Em Andamento", finalizado: "Finalizado" };
              const inventoryStatusColors: Record<string, string> = { aberto: "#3b82f6", em_andamento: "#f59e0b", finalizado: "#10b981" };

              return (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{inv.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: (inventoryStatusColors[inv.status] ?? "#6b7280") + "22", color: inventoryStatusColors[inv.status] ?? "#6b7280" }}>
                      {inventoryStatusLabels[inv.status] ?? inv.status}
                    </span>
                    {inv.finishedAt && <span className="text-xs text-muted-foreground">Finalizado em {new Date(inv.finishedAt).toLocaleDateString("pt-BR")}</span>}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard icon={ClipboardList} label="Total Itens" value={inv.totalItems} color="bg-primary" />
                    <StatCard icon={TrendingUp} label="Contados" value={inv.countedItems} color="bg-[oklch(0.55_0.16_160)]" />
                    <StatCard icon={AlertTriangle} label="Divergências" value={inv.divergentItems} color={inv.divergentItems > 0 ? "bg-destructive" : "bg-muted-foreground"} />
                    <StatCard icon={Package} label="Pendentes" value={inv.totalItems - inv.countedItems} color="bg-amber-500" />
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-primary" />
                        Lista de Produtos ({inv.totalItems} itens)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-muted-foreground text-xs">
                              <th className="text-left py-2 font-medium">Código</th>
                              <th className="text-left py-2 font-medium">Produto</th>
                              <th className="text-center py-2 font-medium">Un.</th>
                              <th className="text-right py-2 font-medium">Qtd. Esperada</th>
                              <th className="text-right py-2 font-medium">Qtd. Contada</th>
                              <th className="text-right py-2 font-medium">Diferença</th>
                              <th className="text-left py-2 font-medium hidden md:table-cell">Obs.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inv.items.map((item, idx) => {
                              const hasDiff = item.difference != null && item.difference !== 0;
                              return (
                                <tr key={idx} className={`border-b last:border-0 ${hasDiff ? "bg-red-500/10/50 dark:bg-red-950/10" : ""}`}>
                                  <td className="py-2 font-mono text-xs text-muted-foreground">{item.productCode}</td>
                                  <td className="py-2 font-medium">{item.productName}</td>
                                  <td className="py-2 text-center text-xs text-muted-foreground">{item.unit}</td>
                                  <td className="py-2 text-right">{item.expectedQuantity.toFixed(2)}</td>
                                  <td className="py-2 text-right">{item.countedQuantity != null ? item.countedQuantity.toFixed(2) : <span className="text-muted-foreground">—</span>}</td>
                                  <td className="py-2 text-right font-bold">
                                    {item.difference != null
                                      ? <span className={item.difference > 0 ? "text-muted-foreground" : item.difference < 0 ? "text-destructive" : "text-muted-foreground"}>
                                          {item.difference > 0 ? `+${item.difference.toFixed(2)}` : item.difference.toFixed(2)}
                                        </span>
                                      : <span className="text-muted-foreground">—</span>
                                    }
                                  </td>
                                  <td className="py-2 text-xs text-muted-foreground hidden md:table-cell">{item.notes ?? ""}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </>
        }
        </div>
      }

      {/* ── PEDIDOS POR CLIENTE ── */}
      {activeTab === "pedidos_cliente" &&
      <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Pedidos por Cliente</h2>
            <ReportActions
            reportName="Relatório de Pedidos por Cliente"
            fileName="relatorio-pedidos-por-cliente"
            onGenerate={() => {
              const data = ordersByClient as ClientOrderReport[] ?? [];
              const clientName = selectedClientId
                ? clients?.find((c) => c._id === selectedClientId)?.name
                : undefined;
              return generatePedidosPorClientePDF(data, clientName);
            }} />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-muted-foreground">Cliente:</p>
              <Select
                value={selectedClientId ?? "todos"}
                onValueChange={(v) => setSelectedClientId(v === "todos" ? undefined : v as Id<"clients">)}
              >
                <SelectTrigger className="w-64 h-9 cursor-pointer">
                  <SelectValue placeholder="Selecionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os clientes</SelectItem>
                  {clients?.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}{c.city ? ` — ${c.city}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClientId && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 px-2 cursor-pointer text-muted-foreground"
                  onClick={() => setSelectedClientId(undefined)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-muted-foreground">Status:</p>
            {([["todos", "Todos"], ["rascunho", "Rascunho"], ["confirmado", "Confirmado"], ["em_separacao", "Em Separação"], ["em_rota", "Em Rota"], ["entregue", "Entregue"], ["cancelado", "Cancelado"]] as [string, string][]).map(([val, label]) =>
            <Button
              key={val}
              size="sm"
              variant={clientStatusFilter === val ? "default" : "secondary"}
              className="cursor-pointer h-7 text-xs"
              onClick={() => setClientStatusFilter(val as OrderStatus | "todos")}>
              {label}
            </Button>
            )}
          </div>

          {!ordersByClient ?
          <p className="text-sm text-muted-foreground">Carregando...</p> :
          ordersByClient.length === 0 ?
          <Card><CardContent className="py-12 text-center">
            <UserSearch className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold">Nenhum pedido encontrado</p>
            <p className="text-sm text-muted-foreground">Ajuste os filtros para ver resultados.</p>
          </CardContent></Card> :

          <div className="space-y-6">
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Clientes" value={ordersByClient.length} color="bg-primary" />
              <StatCard icon={ShoppingCart} label="Total Pedidos" value={ordersByClient.reduce((s, c) => s + c.totalOrders, 0)} color="bg-[oklch(0.55_0.16_160)]" />
              <StatCard icon={TrendingUp} label="Valor Total" value={`R$ ${ordersByClient.reduce((s, c) => s + c.totalValue, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} color="bg-primary" />
              <StatCard icon={Truck} label="Frete Total" value={`R$ ${ordersByClient.reduce((s, c) => s + c.totalFreight, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} color="bg-amber-500" />
            </div>

            {ordersByClient.map((client) =>
            <ClientOrderCard key={client.clientId} client={client} />
            )}
          </div>
          }
        </div>
      }
    </div>);

}