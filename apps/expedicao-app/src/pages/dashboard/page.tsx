import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Package, Users, ShoppingCart, AlertTriangle, TrendingUp, ArrowLeftRight,
  ArrowDownCircle, ArrowUpCircle, PackageCheck, PackageSearch, Navigation,
  CheckCircle2, FileText, XCircle, Wrench, Clock, ArrowDownToLine, ArrowUpFromLine } from
"lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const unitLabels: Record<string, string> = { m2: "m²", cx: "cx", ml: "ml", un: "un" };

const statusConfig = {
  rascunho: { label: "Rascunho", icon: FileText, color: "text-muted-foreground" },
  confirmado: { label: "Confirmado", icon: PackageSearch, color: "text-blue-400" },
  em_separacao: { label: "Em Separação", icon: PackageCheck, color: "text-amber-400" },
  em_rota: { label: "Em Rota", icon: Navigation, color: "text-purple-400" },
  entregue: { label: "Entregue", icon: CheckCircle2, color: "text-emerald-400" },
  cancelado: { label: "Cancelado", icon: XCircle, color: "text-red-500" }
};

const transportStatusConfig: Record<string, {label: string;color: string;}> = {
  pendente: { label: "Pendente", color: "text-amber-400" },
  em_rota: { label: "Em Rota", color: "text-purple-400" },
  entregue: { label: "Concluído", color: "text-emerald-400" },
  cancelado: { label: "Cancelado", color: "text-red-500" }
};

function StatCard({ icon: Icon, label, value, color }: {icon: React.ElementType;label: string;value: number | string;color: string;}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>);

}

export default function Dashboard() {
  const navigate = useNavigate();
  const products = useQuery(api.products.listProducts, {});
  const clients = useQuery(api.clients.listClients, {});
  const recentMovements = useQuery(api.stockMovements.listMovements, {
    paginationOpts: { numItems: 5, cursor: null }
  });
  const recentOrders = useQuery(api.orders.listOrders, {
    paginationOpts: { numItems: 5, cursor: null }
  });
  const recentTransports = useQuery(api.toolTransports.listTransports, {
    paginationOpts: { numItems: 5, cursor: null }
  });

  const lowStock = products?.filter((p) => p.minStock != null && p.currentStock <= p.minStock) ?? [];
  const activeOrders = recentOrders?.page.filter(
    (o) => o.status !== "entregue" && o.status !== "cancelado"
  ) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-bold tracking-widest uppercase text-2xl">dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral do estoque</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Package} label="Produtos" value={products?.length ?? "—"} color="bg-primary" />
        <StatCard icon={Users} label="Clientes" value={clients?.length ?? "—"} color="bg-[oklch(0.55_0.16_160)]" />
        <StatCard icon={AlertTriangle} label="Estoque Baixo" value={lowStock.length} color="bg-destructive" />
        <StatCard icon={ShoppingCart} label="Pedidos Ativos" value={activeOrders.length} color="bg-accent" />
      </div>

      {lowStock.length > 0 &&
      <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Produtos com Estoque Baixo ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStock.slice(0, 5).map((p) =>
          <div key={p._id} className="flex justify-between items-center py-1 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.code}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-destructive">{p.currentStock} {unitLabels[p.unit] ?? p.unit}</p>
                  <p className="text-xs text-muted-foreground">Mín: {p.minStock} {p.unit}</p>
                </div>
              </div>
          )}
            {lowStock.length > 5 &&
          <p
            className="text-xs text-center text-muted-foreground pt-1 cursor-pointer hover:underline"
            onClick={() => navigate("/produtos")}>
            
                +{lowStock.length - 5} produto(s) com estoque baixo — ver todos em Produtos
              </p>
          }
          </CardContent>
        </Card>
      }

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Últimas Movimentações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!recentMovements || recentMovements.page.length === 0 ?
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação recente</p> :

            recentMovements.page.map((m) => {
              const isPositive = m.quantity >= 0;
              const Icon = isPositive ? ArrowDownCircle : ArrowUpCircle;
              return (
                <div key={m._id} className="flex items-center justify-between gap-2 py-1 border-b last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isPositive ? "text-emerald-400" : "text-red-400"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(m._creationTime), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                      {isPositive ? "+" : ""}{m.quantity.toFixed(2)} {unitLabels[m.productUnit] ?? m.productUnit}
                    </span>
                  </div>);

            })
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" /> Pedidos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!recentOrders || recentOrders.page.length === 0 ?
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido recente</p> :

            recentOrders.page.map((o) => {
              const sCfg = statusConfig[o.status];
              const SIcon = sCfg.icon;
              return (
                <div
                  key={o._id}
                  className="flex items-center justify-between gap-2 py-1 border-b last:border-0 cursor-pointer hover:opacity-80"
                  onClick={() => navigate(`/pedidos/${o._id}`)}>
                  
                    <div className="flex items-center gap-2 min-w-0">
                      <SIcon className={`w-4 h-4 shrink-0 ${sCfg.color}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{o.orderNumber} — {o.clientName}</p>
                        <p className="text-xs text-muted-foreground">{sCfg.label}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(o._creationTime), "dd/MM", { locale: ptBR })}
                    </span>
                  </div>);

            })
            }
          </CardContent>
        </Card>
      </div>

      {/* Transportes de Ferramentas Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" /> Transportes de Ferramentas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!recentTransports || recentTransports.page.length === 0 ?
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum transporte recente</p> :

          <div className="space-y-2">
              {recentTransports.page.map((t) => {
              const sCfg = transportStatusConfig[t.status] ?? { label: t.status, color: "text-muted-foreground" };
              const DirIcon = t.direction === "retirar" ? ArrowUpFromLine : ArrowDownToLine;
              const dirLabel = t.direction === "retirar" ? "Retirada" : "Entrega";
              const dirColor = t.direction === "retirar" ? "text-orange-500" : "text-blue-500";
              const totalTools = t.tools.reduce((s, tool) => s + tool.quantity, 0);
              return (
                <div
                  key={t._id}
                  className="flex items-center justify-between gap-3 py-2 border-b last:border-0 cursor-pointer hover:opacity-80"
                  onClick={() => navigate("/pedidos")}>
                  
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 p-1.5 rounded-lg bg-muted">
                        <DirIcon className={`w-4 h-4 ${dirColor}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{t.transportNumber}</p>
                          <span className={`text-xs font-medium ${sCfg.color}`}>{sCfg.label}</span>
                          <span className={`text-xs ${dirColor}`}>{dirLabel}</span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{t.clientName}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Wrench className="w-3 h-3" />{totalTools} ferramenta(s)
                          </span>
                          {t.clientCity && <span>{t.clientCity}</span>}
                          {t.direction === "retirar" && t.destinationClientName &&
                        <span>{"→"} {t.destinationClientName}</span>
                        }
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(t._creationTime), "dd/MM", { locale: ptBR })}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(t._creationTime), "HH:mm")}
                      </span>
                    </div>
                  </div>);

            })}
            </div>
          }
        </CardContent>
      </Card>
    </div>);

}