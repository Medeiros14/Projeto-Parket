import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Bell, Check, CheckCheck, Trash2, ShoppingCart, Wrench,
  SendHorizonal, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { cn } from "@/lib/utils.ts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import type { Doc } from "@/convex/_generated/dataModel.js";
import { toast } from "sonner";
import {
  ManageRecipientsDialog,
  loadRecipients,
  sendToAllRecipients,
} from "./manage-recipients.tsx";

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  confirmado: "Confirmado",
  em_separacao: "Em Separação",
  em_rota: "Em Rota",
  entregue: "Entregue",
  cancelado: "Cancelado",
  pendente: "Pendente",
};

const STATUS_COLORS: Record<string, string> = {
  confirmado: "text-blue-400",
  em_separacao: "text-yellow-400",
  em_rota: "text-purple-400",
  entregue: "text-green-400",
  cancelado: "text-red-400",
  pendente: "text-muted-foreground",
};

type Notification = Doc<"notifications">;

function NotificationItem({
  notification,
  onRead,
  onDelete,
}: {
  notification: Notification;
  onRead: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    onRead();
    if (notification.type === "order_status") {
      navigate(`/pedidos/${notification.relatedId}`);
    } else {
      navigate("/pedidos");
    }
  };

  const handleSendWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.whatsappMessage) {
      toast.error("Mensagem WhatsApp não disponível");
      return;
    }
    const extras = loadRecipients();
    const count = sendToAllRecipients(
      notification.clientPhone,
      notification.whatsappMessage,
      extras,
    );
    if (count > 0) {
      toast.success(
        `Abrindo WhatsApp para ${count} destinatário(s)...`,
      );
    }
  };

  const hasWhatsApp = !!notification.whatsappMessage;

  return (
    <div
      className={cn(
        "flex gap-3 p-3 rounded-lg cursor-pointer transition-colors",
        notification.read
          ? "bg-transparent hover:bg-muted/50"
          : "bg-blue-500/10 dark:bg-blue-950/20 hover:bg-blue-500/15 dark:hover:bg-blue-950/30",
      )}
      onClick={handleClick}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          notification.type === "order_status"
            ? "bg-blue-500/15 dark:bg-blue-900"
            : "bg-orange-500/15 dark:bg-orange-900",
        )}
      >
        {notification.type === "order_status" ? (
          <ShoppingCart className="w-4 h-4 text-blue-400 dark:text-blue-400" />
        ) : (
          <Wrench className="w-4 h-4 text-orange-400 dark:text-orange-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{notification.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              "text-xs font-semibold",
              STATUS_COLORS[notification.newStatus] ?? "text-foreground",
            )}
          >
            {STATUS_LABELS[notification.newStatus] ?? notification.newStatus}
          </span>
          <span className="text-xs text-muted-foreground">
            ·{" "}
            {formatDistanceToNow(new Date(notification._creationTime), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex flex-col gap-1">
        {!notification.read && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onRead();
            }}
            title="Marcar como lida"
          >
            <Check className="w-3 h-3" />
          </Button>
        )}
        {hasWhatsApp && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-green-400 hover:text-green-400 cursor-pointer"
            onClick={handleSendWhatsApp}
            title="Enviar WhatsApp (cliente + destinatários)"
          >
            <SendHorizonal className="w-3 h-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 text-muted-foreground hover:text-destructive cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Excluir"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const notifications = useQuery(api.notifications.listNotifications, {
    limit: 30,
  });
  const unreadCount = useQuery(api.notifications.countUnread, {});
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const deleteNotification = useMutation(api.notifications.deleteNotification);

  const count = unreadCount ?? 0;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative cursor-pointer"
            aria-label="Notificações"
          >
            <Bell className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-96 p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">Notificações</h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 cursor-pointer text-muted-foreground"
                title="Gerenciar destinatários WhatsApp"
                onClick={() => {
                  setOpen(false);
                  setManageOpen(true);
                }}
              >
                <Users className="w-4 h-4" />
              </Button>
              {count > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 gap-1 cursor-pointer"
                  onClick={() => markAllAsRead()}
                >
                  <CheckCheck className="w-3 h-3" />
                  Marcar lidas
                </Button>
              )}
            </div>
          </div>

          {/* Recipients hint */}
          <div
            className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b cursor-pointer hover:bg-muted transition-colors"
            onClick={() => {
              setOpen(false);
              setManageOpen(true);
            }}
          >
            <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Adicionar números que recebem notificações WhatsApp
            </p>
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto p-2 space-y-0.5">
            {!notifications || notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n._id}
                  notification={n}
                  onRead={() => markAsRead({ id: n._id })}
                  onDelete={() => deleteNotification({ id: n._id })}
                />
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <ManageRecipientsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
      />
    </>
  );
}
