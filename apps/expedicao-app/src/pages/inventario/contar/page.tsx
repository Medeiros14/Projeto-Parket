import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  CheckCheck, Search, TrendingDown, TrendingUp, Minus,
  Clock, CheckCircle2, CircleDot, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const unitLabels: Record<string, string> = { m2: "m²", cx: "cx", ml: "ml", un: "un" };

const statusConfig = {
  aberto: { label: "Aberto", icon: CircleDot, color: "bg-blue-500/15 text-blue-400" },
  em_andamento: { label: "Em Andamento", icon: Clock, color: "bg-amber-500/15 text-amber-400" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-400" },
};

type InventoryItem = {
  _id: Id<"inventoryItems">;
  productName: string;
  productCode: string;
  productUnit: string;
  m2PerBox?: number | null;
  expectedQuantity: number;
  countedQuantity?: number | null;
  notes?: string;
  difference?: number | null;
};

function CountItemDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
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
        <p className="text-xs text-muted-foreground font-mono">{item.productCode}</p>
        <p className="text-sm text-muted-foreground">
          Esperado: <strong>{item.expectedQuantity} {unitLabels[item.productUnit] ?? item.productUnit}</strong>
          {item.productUnit === "cx" && item.m2PerBox
            ? ` (${(item.expectedQuantity * item.m2PerBox).toFixed(2)} m²)` : ""}
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
          className="text-lg h-12"
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

function ContarInventarioInner() {
  const { id } = useParams<{ id: string }>();
  const inventory = useQuery(api.inventory.getInventory, { id: id as Id<"inventories"> });
  const updateStatus = useMutation(api.inventory.updateInventoryStatus);

  const [search, setSearch] = useState("");
  const [countingItem, setCountingItem] = useState<InventoryItem | null>(null);

  if (inventory === undefined) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!inventory) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Inventário não encontrado.
      </div>
    );
  }

  const isDone = inventory.status === "finalizado";
  const cfg = statusConfig[inventory.status];
  const StatusIcon = cfg.icon;

  const countedItems = inventory.items.filter((i) => i.countedQuantity != null);
  const progress = inventory.items.length > 0
    ? Math.round((countedItems.length / inventory.items.length) * 100)
    : 0;

  const filteredItems = inventory.items.filter(
    (i) =>
      i.productName.toLowerCase().includes(search.toLowerCase()) ||
      i.productCode.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartCount = async () => {
    try {
      await updateStatus({ id: inventory._id, status: "em_andamento" });
    } catch {
      toast.error("Erro ao iniciar contagem");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 shadow-sm">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-base font-bold truncate">{inventory.name}</h1>
            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>
              <StatusIcon className="w-3 h-3" />
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground pl-7">
            Criado em {format(new Date(inventory._creationTime), "dd/MM/yyyy", { locale: ptBR })}
          </p>
          {/* Progress bar */}
          {inventory.items.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{countedItems.length} de {inventory.items.length} itens contados</span>
                <span className="font-bold text-foreground">{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isDone ? "bg-emerald-500" : "bg-primary"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-3">
        {/* Start button */}
        {inventory.status === "aberto" && (
          <Button className="w-full cursor-pointer" onClick={handleStartCount}>
            <Clock className="w-4 h-4 mr-2" />
            Iniciar Contagem
          </Button>
        )}

        {isDone && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center text-sm text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4 inline mr-1" />
            Este inventário foi finalizado.
          </div>
        )}

        {/* Search */}
        {inventory.items.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}

        {/* Items */}
        {filteredItems.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-6">Nenhum produto encontrado.</p>
        ) : (
          filteredItems.map((item) => {
            const counted = item.countedQuantity != null;
            const diff = item.difference ?? 0;
            const DiffIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
            const diffColor = diff > 0 ? "text-emerald-400" : diff < 0 ? "text-destructive" : "text-muted-foreground";

            return (
              <Card key={item._id} className={counted ? "border-emerald-500/30" : ""}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${counted ? "bg-emerald-500/15" : "bg-muted"}`}>
                        {counted
                          ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                          : <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.productCode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
}

export default function ContarInventarioPage() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="w-48 h-8" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center"
          style={{ background: "linear-gradient(135deg, oklch(0.20 0 0) 0%, oklch(0.32 0 0) 100%)" }}>
          <img src="/logo-parket.png" alt="Parket" className="h-16 mx-auto" />
          <div className="space-y-1">
            <p className="text-white/90 font-semibold text-lg">Contagem de Inventário</p>
            <p className="text-white/60 text-sm">Faça login para continuar</p>
          </div>
          <SignInButton className="text-base px-8 py-3 h-auto text-white bg-zinc-900" />
        </div>
      </Unauthenticated>
      <Authenticated>
        <ContarInventarioInner />
      </Authenticated>
    </>
  );
}
