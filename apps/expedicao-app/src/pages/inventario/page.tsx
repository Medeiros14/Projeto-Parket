import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  ClipboardList, Plus, ChevronRight, CheckCircle2, Clock, CircleDot,
  AlertTriangle, CheckCheck, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const statusConfig = {
  aberto: { label: "Aberto", icon: CircleDot, color: "bg-blue-500/15 text-blue-400" },
  em_andamento: { label: "Em Andamento", icon: Clock, color: "bg-amber-500/15 text-amber-400" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-400" },
};

function NewInventoryForm({ onClose }: { onClose: () => void }) {
  const createInventory = useMutation(api.inventory.createInventory);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [includeAll, setIncludeAll] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Informe um nome para o inventário"); return; }
    try {
      await createInventory({ name: name.trim(), notes: notes || undefined, includeAllProducts: includeAll });
      toast.success("Inventário criado!");
      onClose();
    } catch {
      toast.error("Erro ao criar inventário");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label>Nome do Inventário *</Label>
        <Input placeholder="Ex: Inventário Geral - Abril 2025" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Observações</Label>
        <Textarea placeholder="Informações adicionais..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${includeAll ? "border-primary bg-primary/5" : "border-border"}`}
        onClick={() => setIncludeAll(!includeAll)}
      >
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${includeAll ? "bg-primary border-primary" : "border-border"}`}>
          {includeAll && <CheckCheck className="w-3 h-3 text-white" />}
        </div>
        <div>
          <p className="text-sm font-medium">Incluir todos os produtos ativos</p>
          <p className="text-xs text-muted-foreground">Preenche automaticamente com estoque atual</p>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Criar Inventário</Button>
      </div>
    </form>
  );
}

export default function InventoryPage() {
  const inventories = useQuery(api.inventory.listInventories, {});
  const deleteInventory = useMutation(api.inventory.deleteInventory);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<Id<"inventories"> | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteInventory({ id: deleteId });
      toast.success("Inventário excluído!");
    } catch {
      toast.error("Erro ao excluir inventário");
    } finally {
      setDeleteId(null);
      setDeleteName("");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Inventários</h1>
          <p className="text-sm text-muted-foreground">Contagem e ajuste de estoque</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="cursor-pointer"><Plus className="w-4 h-4 mr-2" />Novo Inventário</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Novo Inventário</DialogTitle></DialogHeader>
            <NewInventoryForm onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {inventories === undefined ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : inventories.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
            <EmptyTitle>Nenhum inventário criado</EmptyTitle>
            <EmptyDescription>Crie um inventário para contar e ajustar o estoque</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setOpen(true)} className="cursor-pointer"><Plus className="w-4 h-4 mr-2" />Novo Inventário</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-3">
          {inventories.map((inv) => {
            const cfg = statusConfig[inv.status];
            const Icon = cfg.icon;
            const progress = inv.totalItems > 0 ? Math.round((inv.countedItems / inv.totalItems) * 100) : 0;
            return (
              <Card
                key={inv._id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/inventario/${inv._id}`)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg ${cfg.color} shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm truncate">{inv.name}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Por {inv.createdByName} · {format(new Date(inv._creationTime), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                        {inv.totalItems > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{inv.countedItems} de {inv.totalItems} contados</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${inv.status === "finalizado" ? "bg-emerald-500" : "bg-primary"}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(inv._id);
                          setDeleteName(inv.name);
                        }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        title="Excluir inventário"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) { setDeleteId(null); setDeleteName(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir inventário?</AlertDialogTitle>
            <AlertDialogDescription>
              O inventário <strong>"{deleteName}"</strong> e todos os seus itens de contagem serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
