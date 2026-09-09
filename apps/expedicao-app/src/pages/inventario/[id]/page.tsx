import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  ArrowLeft, CheckCircle2, Clock, CircleDot, AlertTriangle,
  CheckCheck, Search, TrendingDown, TrendingUp, Minus, Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const unitLabels: Record<string, string> = { m2: "m²", cx: "cx", ml: "ml", un: "un" };

const statusConfig = {
  aberto: { label: "Aberto", icon: CircleDot, color: "bg-blue-500/15 text-blue-400" },
  em_andamento: { label: "Em Andamento", icon: Clock, color: "bg-amber-500/15 text-amber-400" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-400" },
};

function CountItemDialog({
  item,
  onClose,
}: {
  item: {
    _id: Id<"inventoryItems">;
    productName: string;
    productUnit: string;
    m2PerBox?: number | null;
    expectedQuantity: number;
    countedQuantity?: number;
    notes?: string;
  };
  onClose: () => void;
}) {
  const countItem = useMutation(api.inventory.countInventoryItem);
  const [qty, setQty] = useState(item.countedQuantity?.toString() ?? item.expectedQuantity.toString());
  const [notes, setNotes] = useState(item.notes ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(qty);
    if (isNaN(q) || q < 0) { toast.error("Quantidade inválida"); return; }
    try {
      await countItem({ id: item._id, countedQuantity: q, notes: notes || undefined });
      toast.success("Contagem salva!");
      onClose();
    } catch {
      toast.error("Erro ao salvar contagem");
    }
  };

  const diff = parseFloat(qty || "0") - item.expectedQuantity;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-lg bg-muted/50 space-y-1">
        <p className="font-semibold">{item.productName}</p>
        <p className="text-sm text-muted-foreground">
          Esperado: <strong>{item.expectedQuantity} {unitLabels[item.productUnit] ?? item.productUnit}</strong>
          {item.productUnit === "cx" && item.m2PerBox
            ? ` (${(item.expectedQuantity * item.m2PerBox).toFixed(2)} m²)`
            : ""}
        </p>
      </div>

      <div className="space-y-1">
        <Label>Quantidade Contada *</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          autoFocus
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        {qty && (
          <p className={`text-sm font-medium ${diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-emerald-400" : "text-destructive"}`}>
            Diferença: {diff > 0 ? "+" : ""}{diff.toFixed(2)} {unitLabels[item.productUnit] ?? item.productUnit}
            {diff === 0 ? " (sem diferença)" : ""}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label>Observação</Label>
        <Textarea placeholder="Ex: Caixas avariadas..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Salvar Contagem</Button>
      </div>
    </form>
  );
}

export default function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inventory = useQuery(api.inventory.getInventory, { id: id as Id<"inventories"> });
  const updateStatus = useMutation(api.inventory.updateInventoryStatus);
  const finalizeInventory = useMutation(api.inventory.finalizeInventory);

  const [search, setSearch] = useState("");
  const [countingItem, setCountingItem] = useState<(typeof inventory extends null | undefined ? never : NonNullable<typeof inventory>["items"][0]) | null>(null);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);

  if (inventory === undefined) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!inventory) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Inventário não encontrado.</p>
        <Button className="mt-4 cursor-pointer" onClick={() => navigate("/inventario")}>Voltar</Button>
      </div>
    );
  }

  const cfg = statusConfig[inventory.status];
  const StatusIcon = cfg.icon;
  const isDone = inventory.status === "finalizado";

  const filteredItems = inventory.items.filter(
    (i) =>
      i.productName.toLowerCase().includes(search.toLowerCase()) ||
      i.productCode.toLowerCase().includes(search.toLowerCase())
  );

  const countedItems = inventory.items.filter((i) => i.countedQuantity != null);
  const diffItems = countedItems.filter((i) => (i.difference ?? 0) !== 0);
  const progress = inventory.items.length > 0 ? Math.round((countedItems.length / inventory.items.length) * 100) : 0;

  const handleStartCount = async () => {
    try {
      await updateStatus({ id: inventory._id, status: "em_andamento" });
    } catch {
      toast.error("Erro ao iniciar contagem");
    }
  };

  const handleFinalize = async (applyAll: boolean) => {
    try {
      await finalizeInventory({ id: inventory._id, applyAll });
      toast.success(applyAll ? "Inventário finalizado e estoque atualizado!" : "Inventário finalizado!");
      setShowFinalizeDialog(false);
    } catch {
      toast.error("Erro ao finalizar inventário");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="cursor-pointer shrink-0" onClick={() => navigate("/inventario")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{inventory.name}</h1>
            <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
              <StatusIcon className="w-3 h-3" />
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Criado em {format(new Date(inventory._creationTime), "dd/MM/yyyy", { locale: ptBR })}
            {inventory.finishedAt && ` · Finalizado em ${format(new Date(inventory.finishedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}`}
          </p>
        </div>
      </div>

      {/* Progress */}
      {inventory.items.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{countedItems.length} de {inventory.items.length} itens contados</span>
              <span className="font-bold">{progress}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isDone ? "bg-emerald-500" : "bg-primary"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground pt-1">
              <span className="text-emerald-400 font-medium">{countedItems.filter((i) => (i.difference ?? 0) === 0).length} sem diferença</span>
              <span className="text-amber-400 font-medium">{diffItems.length} com diferença</span>
              <span>{inventory.items.length - countedItems.length} pendentes</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      {!isDone && (
        <div className="flex gap-2 flex-wrap">
          {inventory.status === "aberto" && (
            <Button className="cursor-pointer" onClick={handleStartCount}>
              <Clock className="w-4 h-4 mr-2" />
              Iniciar Contagem
            </Button>
          )}
          {inventory.status === "em_andamento" && countedItems.length > 0 && (
            <Button className="cursor-pointer" onClick={() => setShowFinalizeDialog(true)}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Finalizar Inventário
            </Button>
          )}
          <Button
            variant="secondary"
            className="cursor-pointer"
            onClick={() => {
              const url = `${window.location.origin}/inventario/contar/${inventory._id}`;
              navigator.clipboard.writeText(url).then(() => toast.success("Link copiado! Compartilhe com seu funcionário."));
            }}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Compartilhar Link de Contagem
          </Button>
        </div>
      )}

      {/* Search */}
      {inventory.items.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {/* Items list */}
      <div className="space-y-2">
        {inventory.items.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">Nenhum item adicionado a este inventário.</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">Nenhum produto encontrado.</p>
        ) : (
          filteredItems.map((item) => {
            const counted = item.countedQuantity != null;
            const diff = item.difference ?? 0;
            const DiffIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
            const diffColor = diff > 0 ? "text-emerald-400" : diff < 0 ? "text-destructive" : "text-muted-foreground";

            return (
              <Card key={item._id} className={`transition-shadow ${counted ? "border-emerald-500/30" : ""}`}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${counted ? "bg-emerald-500/15" : "bg-muted"}`}>
                        {counted ? (
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.productCode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right text-xs">
                        <p className="text-muted-foreground">Esperado</p>
                        <p className="font-medium">{item.expectedQuantity} {unitLabels[item.productUnit] ?? item.productUnit}</p>
                      </div>
                      {counted && (
                        <>
                          <div className="text-right text-xs">
                            <p className="text-muted-foreground">Contado</p>
                            <p className="font-bold">{item.countedQuantity} {unitLabels[item.productUnit] ?? item.productUnit}</p>
                          </div>
                          <div className={`flex items-center gap-0.5 text-xs font-bold ${diffColor}`}>
                            <DiffIcon className="w-3 h-3" />
                            {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                          </div>
                        </>
                      )}
                      {!isDone && (
                        <Button
                          size="sm"
                          variant={counted ? "secondary" : "default"}
                          className="cursor-pointer h-8 text-xs"
                          onClick={() => setCountingItem(item)}
                        >
                          {counted ? "Rever" : "Contar"}
                        </Button>
                      )}
                    </div>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-muted-foreground mt-1 pl-9 italic">{item.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Count dialog */}
      {countingItem && (
        <Dialog open={!!countingItem} onOpenChange={(v) => { if (!v) setCountingItem(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Contagem</DialogTitle>
            </DialogHeader>
            <CountItemDialog item={countingItem} onClose={() => setCountingItem(null)} />
          </DialogContent>
        </Dialog>
      )}

      {/* Finalize dialog */}
      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Inventário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {diffItems.length > 0 && (
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                <p className="text-sm font-medium text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {diffItems.length} produto(s) com divergência encontrados
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Deseja atualizar automaticamente o estoque com as quantidades contadas?
            </p>
            <div className="flex flex-col gap-2">
              <Button className="cursor-pointer" onClick={() => handleFinalize(true)}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Finalizar e Atualizar Estoque
              </Button>
              <Button variant="secondary" className="cursor-pointer" onClick={() => handleFinalize(false)}>
                Finalizar sem Atualizar
              </Button>
              <Button variant="ghost" className="cursor-pointer" onClick={() => setShowFinalizeDialog(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
