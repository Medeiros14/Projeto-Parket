import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  ArrowLeft, Truck, MapPin, Calendar, User, Package, FileText,
  PackageCheck, PackageSearch, Navigation, CheckCircle2, XCircle, Camera, Share2, Tag,
} from "lucide-react";
import { OrderPhotos } from "../_components/order-photos.tsx";
import OrderSignature from "../_components/order-signature.tsx";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useNotifyStatus } from "@/hooks/use-notify-status.ts";
import { loadRecipients, sendToAllRecipients } from "@/components/notifications/manage-recipients.tsx";

const statusConfig = {
  rascunho: { label: "Rascunho", icon: FileText, color: "bg-muted text-muted-foreground" },
  confirmado: { label: "Confirmado", icon: PackageSearch, color: "bg-blue-500/15 text-blue-400" },
  em_separacao: { label: "Em Separação", icon: PackageCheck, color: "bg-amber-500/15 text-amber-400" },
  em_rota: { label: "Em Rota", icon: Navigation, color: "bg-purple-500/15 text-purple-400" },
  entregue: { label: "Entregue", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-400" },
  cancelado: { label: "Cancelado", icon: XCircle, color: "bg-red-500/15 text-red-400" },
};

const unitLabels: Record<string, string> = { m2: "m²", cx: "cx", ml: "ml", un: "un" };

const freightLabels: Record<string, string> = {
  interno: "Frete Interno",
  terceiro: "Frete Terceiro",
  retirada: "Retirada",
};

const statusFlow = ["confirmado", "em_separacao", "em_rota", "entregue"];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const order = useQuery(api.orders.getOrder, { id: id as Id<"orders"> });
  const updateStatus = useMutation(api.orders.updateOrderStatus);
  const { notifyOrderStatus } = useNotifyStatus();

  if (order === undefined) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Pedido não encontrado.</p>
        <Button className="mt-4 cursor-pointer" onClick={() => navigate("/pedidos")}>Voltar</Button>
      </div>
    );
  }

  const cfg = statusConfig[order.status];
  const StatusIcon = cfg.icon;
  const currentStepIndex = statusFlow.indexOf(order.status);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateStatus({
        id: order._id,
        status: newStatus as "rascunho" | "confirmado" | "em_separacao" | "em_rota" | "entregue" | "cancelado",
      });
      await notifyOrderStatus({
        orderId: order._id,
        orderNumber: order.orderNumber,
        clientName: order.client?.name ?? "—",
        clientPhone: order.client?.phone,
        clientCity: order.client?.city,
        newStatus,
      });

      // Dispara WhatsApp automaticamente ao mudar status
      const statusLabel = statusConfig[newStatus as keyof typeof statusConfig]?.label ?? newStatus;
      let msg = `🏭 *Parket*\n\n`;
      msg += `Olá, *${order.client?.name ?? "—"}*!\n\n`;
      msg += `Seu pedido *${order.orderNumber}* teve uma atualização de status:\n`;
      msg += `📦 Novo status: *${statusLabel}*\n`;
      if (order.client?.city) msg += `📍 Cidade: ${order.client.city}\n`;
      msg += `\n\nObrigado pela confiança! 🙏`;

      const extras = loadRecipients();
      const count = sendToAllRecipients(order.client?.phone, msg, extras);
      if (count > 0) {
        toast.success(`Status: ${statusLabel} · WhatsApp enviado para ${count} contato(s)`);
      } else {
        toast.success(`Status: ${statusLabel}`);
      }
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="icon" className="cursor-pointer shrink-0 mt-0.5" onClick={() => navigate("/pedidos")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{order.orderNumber}</h1>
                <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {cfg.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Criado em {format(new Date(order._creationTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="cursor-pointer shrink-0"
              onClick={() => navigate(`/pedidos/${order._id}/etiqueta`)}
            >
              <Tag className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Etiqueta</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="cursor-pointer shrink-0"
              onClick={() => {
                const url = `${window.location.origin}/pedido/${encodeURIComponent(order._id)}`;
                void navigator.clipboard.writeText(url);
                toast.success("Link copiado! Compartilhe com o cliente.");
              }}
            >
              <Share2 className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Compartilhar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Status flow tracker */}
      {order.status !== "cancelado" && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 right-0 top-4 h-0.5 bg-border mx-8" />
              {statusFlow.map((s, idx) => {
                const sCfg = statusConfig[s as keyof typeof statusConfig];
                const SIcon = sCfg.icon;
                const done = idx < currentStepIndex;
                const active = idx === currentStepIndex;
                return (
                  <div key={s} className="flex flex-col items-center gap-1 z-10 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                        done
                          ? "bg-emerald-500 border-emerald-500"
                          : active
                          ? "bg-primary border-primary"
                          : "bg-background border-border"
                      }`}
                    >
                      <SIcon className={`w-3.5 h-3.5 ${done || active ? "text-white" : "text-muted-foreground"}`} />
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight ${active ? "text-primary" : "text-muted-foreground"}`}>
                      {sCfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status change */}
      {order.status !== "entregue" && order.status !== "cancelado" && (
        <div className="flex gap-2 flex-wrap">
          {statusFlow.filter((s) => statusFlow.indexOf(s) > currentStepIndex).map((s) => {
            const sCfg = statusConfig[s as keyof typeof statusConfig];
            return (
              <Button
                key={s}
                size="sm"
                className="cursor-pointer flex-1 sm:flex-none"
                onClick={() => handleStatusChange(s)}
              >
                <sCfg.icon className="w-4 h-4 mr-1.5" />
                {sCfg.label}
              </Button>
            );
          })}
          <Button
            size="sm"
            variant="secondary"
            className="cursor-pointer text-destructive flex-1 sm:flex-none"
            onClick={() => handleStatusChange("cancelado")}
          >
            <XCircle className="w-4 h-4 mr-1.5" />
            Cancelar
          </Button>
        </div>
      )}

      {/* Client info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <p className="font-semibold">{order.client?.name ?? "—"}</p>
          {order.client?.phone && <p className="text-muted-foreground">{order.client.phone}</p>}
          {order.deliveryAddress && (
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{order.deliveryAddress}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Truck className="w-3.5 h-3.5" />
            <span>{freightLabels[order.freightType]}</span>
            {order.freightValue && order.freightValue > 0 && (
              <span className="font-medium text-foreground ml-1">
                R$ {order.freightValue.toFixed(2)}
              </span>
            )}
          </div>
          {order.scheduledDate && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>Previsto: {format(new Date(order.scheduledDate + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          )}
          {order.deliveredAt && (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Entregue em {format(new Date(order.deliveredAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" /> Produtos do Pedido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {order.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum item adicionado</p>
          ) : (
            order.items.map((item) => (
              <div key={item._id} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{item.productCode}</p>
                  {item.notes && <p className="text-xs text-muted-foreground italic">{item.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">
                    {item.quantity} {unitLabels[item.productUnit] ?? item.productUnit}
                  </p>
                  {item.productUnit === "cx" && item.m2PerBox && (
                    <p className="text-xs text-muted-foreground">
                      = {(item.quantity * item.m2PerBox).toFixed(2)} m²
                    </p>
                  )}
                  {item.unitPrice && (
                    <p className="text-xs text-muted-foreground">R$ {(item.quantity * item.unitPrice).toFixed(2)}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Observações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" /> Fotos do Pedido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrderPhotos orderId={order._id} orderStatus={order.status} />
        </CardContent>
      </Card>

      {/* Digital Signature */}
      <Card>
        <CardContent className="pt-4">
          <OrderSignature orderId={order._id} orderStatus={order.status} />
        </CardContent>
      </Card>
    </div>
  );
}
