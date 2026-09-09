import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";

const ORDER_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  confirmado: "Confirmado",
  em_separacao: "Em Separação",
  em_rota: "Em Rota",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const TRANSPORT_STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_rota: "Em Rota",
  entregue: "Concluído",
  cancelado: "Cancelado",
};

function buildOrderWhatsApp(params: {
  orderNumber: string;
  clientName: string;
  newStatus: string;
  items?: string;
  city?: string;
}) {
  const statusLabel = ORDER_STATUS_LABELS[params.newStatus] ?? params.newStatus;
  let msg = `🏭 *Expedição Parket*\n\n`;
  msg += `Olá, *${params.clientName}*!\n\n`;
  msg += `Seu pedido *${params.orderNumber}* teve uma atualização de status:\n`;
  msg += `📦 Novo status: *${statusLabel}*\n`;
  if (params.city) msg += `📍 Cidade: ${params.city}\n`;
  if (params.items) msg += `\n*Itens:* ${params.items}`;
  msg += `\n\nObrigado pela confiança! 🙏`;
  return msg;
}

function buildTransportWhatsApp(params: {
  transportNumber: string;
  clientName: string;
  newStatus: string;
  direction: string;
  tools?: string;
  city?: string;
}) {
  const statusLabel = TRANSPORT_STATUS_LABELS[params.newStatus] ?? params.newStatus;
  const dirLabel = params.direction === "retirar" ? "Retirada" : "Entrega";
  let msg = `🏭 *Expedição Parket*\n\n`;
  msg += `Olá, *${params.clientName}*!\n\n`;
  msg += `Seu transporte de ferramentas *${params.transportNumber}* (${dirLabel}) foi atualizado:\n`;
  msg += `🔧 Novo status: *${statusLabel}*\n`;
  if (params.city) msg += `📍 Cidade: ${params.city}\n`;
  if (params.tools) msg += `\n*Ferramentas:* ${params.tools}`;
  msg += `\n\nObrigado pela confiança! 🙏`;
  return msg;
}

export type OrderNotifyParams = {
  orderId: Id<"orders">;
  orderNumber: string;
  clientName: string;
  clientPhone?: string;
  clientCity?: string;
  newStatus: string;
  items?: string;
};

export type TransportNotifyParams = {
  transportId: Id<"toolTransports">;
  transportNumber: string;
  clientName: string;
  clientPhone?: string;
  clientCity?: string;
  direction: string;
  newStatus: string;
  tools?: string;
};

export function useNotifyStatus() {
  const createNotification = useMutation(api.notifications.createNotification);

  const notifyOrderStatus = async (params: OrderNotifyParams) => {
    const statusLabel = ORDER_STATUS_LABELS[params.newStatus] ?? params.newStatus;
    const whatsappMessage = buildOrderWhatsApp({
      orderNumber: params.orderNumber,
      clientName: params.clientName,
      newStatus: params.newStatus,
      items: params.items,
      city: params.clientCity,
    });

    await createNotification({
      type: "order_status",
      title: `Pedido ${params.orderNumber} — ${statusLabel}`,
      message: `Cliente: ${params.clientName}${params.clientCity ? ` · ${params.clientCity}` : ""}`,
      relatedId: params.orderId,
      relatedNumber: params.orderNumber,
      newStatus: params.newStatus,
      clientPhone: params.clientPhone,
      whatsappMessage: params.clientPhone ? whatsappMessage : undefined,
    });
  };

  const notifyTransportStatus = async (params: TransportNotifyParams) => {
    const statusLabel = TRANSPORT_STATUS_LABELS[params.newStatus] ?? params.newStatus;
    const dirLabel = params.direction === "retirar" ? "Retirada" : "Entrega";
    const whatsappMessage = buildTransportWhatsApp({
      transportNumber: params.transportNumber,
      clientName: params.clientName,
      newStatus: params.newStatus,
      direction: params.direction,
      tools: params.tools,
      city: params.clientCity,
    });

    await createNotification({
      type: "transport_status",
      title: `Transporte ${params.transportNumber} (${dirLabel}) — ${statusLabel}`,
      message: `Cliente: ${params.clientName}${params.clientCity ? ` · ${params.clientCity}` : ""}`,
      relatedId: params.transportId,
      relatedNumber: params.transportNumber,
      newStatus: params.newStatus,
      clientPhone: params.clientPhone,
      whatsappMessage: params.clientPhone ? whatsappMessage : undefined,
    });
  };

  return { notifyOrderStatus, notifyTransportStatus };
}
