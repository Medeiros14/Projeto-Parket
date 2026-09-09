import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Trash2, Plus, Users } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "whatsapp_recipients";

export type WhatsAppRecipient = {
  id: string;
  name: string;
  phone: string;
};

export function loadRecipients(): WhatsAppRecipient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WhatsAppRecipient[]) : [];
  } catch {
    return [];
  }
}

function saveRecipients(list: WhatsAppRecipient[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function sendWhatsApp(phone: string, message: string) {
  const clean = phone.replace(/\D/g, "");
  const url = `https://wa.me/55${clean}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

export function sendToAllRecipients(
  clientPhone: string | undefined,
  message: string,
  extraRecipients: WhatsAppRecipient[],
) {
  const all: string[] = [];
  if (clientPhone) all.push(clientPhone);
  extraRecipients.forEach((r) => all.push(r.phone));

  if (all.length === 0) {
    toast.error("Nenhum número disponível para envio");
    return 0;
  }

  // Open each in sequence with a small delay so browser doesn't block
  all.forEach((phone, i) => {
    setTimeout(() => sendWhatsApp(phone, message), i * 300);
  });

  return all.length;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function ManageRecipientsDialog({ open, onOpenChange }: Props) {
  const [recipients, setRecipients] = useState<WhatsAppRecipient[]>([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    if (open) setRecipients(loadRecipients());
  }, [open]);

  const handleAdd = () => {
    const name = newName.trim();
    const phone = newPhone.trim().replace(/\D/g, "");
    if (!name) { toast.error("Informe o nome"); return; }
    if (phone.length < 10) { toast.error("Informe um número válido (DDD + número)"); return; }

    const updated = [
      ...recipients,
      { id: crypto.randomUUID(), name, phone },
    ];
    setRecipients(updated);
    saveRecipients(updated);
    setNewName("");
    setNewPhone("");
    toast.success(`${name} adicionado`);
  };

  const handleDelete = (id: string) => {
    const updated = recipients.filter((r) => r.id !== id);
    setRecipients(updated);
    saveRecipients(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Destinatários WhatsApp
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Esses números receberão a mesma mensagem do WhatsApp junto com o cliente ao atualizar um status.
        </p>

        {/* Current recipients */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum destinatário adicional cadastrado
            </p>
          ) : (
            recipients.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted">
                <div>
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.phone}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-destructive cursor-pointer"
                  onClick={() => handleDelete(r.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Add new */}
        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium">Adicionar destinatário</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="Ex: Gerente"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">WhatsApp (com DDD)</Label>
              <Input
                placeholder="11999999999"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <Button size="sm" className="w-full cursor-pointer gap-1" onClick={handleAdd}>
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
