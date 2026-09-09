import { useState, useRef } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { Plus, ArrowDownCircle, ArrowUpCircle, RefreshCw, Search, Package, Users, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { PdfExportButton } from "./_components/pdf-export.tsx";

const typeConfig = {
  entrada: { label: "Entrada", icon: ArrowDownCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", badge: "bg-emerald-500/15 text-emerald-400" },
  saida: { label: "Saída", icon: ArrowUpCircle, color: "text-red-400", bg: "bg-red-500/10", badge: "bg-red-500/15 text-red-400" },
  ajuste: { label: "Ajuste", icon: RefreshCw, color: "text-amber-400", bg: "bg-amber-500/10", badge: "bg-amber-500/15 text-amber-400" },
  inventario: { label: "Inventário", icon: RefreshCw, color: "text-blue-400", bg: "bg-blue-500/10", badge: "bg-blue-500/15 text-blue-400" },
  transferencia: { label: "Transferência", icon: ArrowDownCircle, color: "text-purple-400", bg: "bg-purple-500/10", badge: "bg-purple-500/15 text-purple-400" },
};

const unitLabels: Record<string, string> = { m2: "m²", cx: "cx", ml: "ml", un: "un" };

function MovementForm({ onClose }: { onClose: () => void }) {
  const products = useQuery(api.products.listProducts, {});
  const clients = useQuery(api.clients.listClients, {});
  const createMovement = useMutation(api.stockMovements.createMovement);

  const [form, setForm] = useState({
    productId: "",
    type: "entrada",
    quantity: "",
    clientId: "",
    reason: "",
    notes: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Product search combobox state
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = products?.filter((p) => {
    const q = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  }) ?? [];

  const selectedProduct = products?.find((p) => p._id === form.productId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId || !form.type || !form.quantity) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const qty = parseFloat(form.quantity);
    if (isNaN(qty) || qty <= 0) { toast.error("Quantidade inválida"); return; }

    try {
      await createMovement({
        productId: form.productId as Id<"products">,
        type: form.type as "entrada" | "saida" | "ajuste" | "inventario" | "transferencia",
        quantity: qty,
        clientId: form.clientId ? form.clientId as Id<"clients"> : undefined,
        reason: form.reason || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Movimentação registrada!");
      onClose();
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error("Erro ao registrar movimentação");
    }
  };

  const isAdjust = form.type === "ajuste" || form.type === "inventario";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label>Produto *</Label>
        <div className="relative">
          <div className="relative flex items-center">
            <Input
              ref={productInputRef}
              placeholder="Digite para buscar produto..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setProductDropdownOpen(true);
                if (!e.target.value) set("productId", "");
              }}
              onFocus={() => setProductDropdownOpen(true)}
              onBlur={() => setTimeout(() => setProductDropdownOpen(false), 150)}
              className="pr-8"
            />
            {form.productId ? (
              <button
                type="button"
                className="absolute right-2 text-muted-foreground hover:text-foreground"
                onClick={() => { set("productId", ""); setProductSearch(""); productInputRef.current?.focus(); }}
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <ChevronDown className="absolute right-2 w-4 h-4 text-muted-foreground pointer-events-none" />
            )}
          </div>
          {productDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md border bg-popover shadow-md">
              {filteredProducts.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum produto encontrado</div>
              ) : (
                filteredProducts.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={() => {
                      set("productId", p._id);
                      setProductSearch(`${p.name} — ${p.code}`);
                      setProductDropdownOpen(false);
                    }}
                  >
                    {p.name} — {p.code} ({p.currentStock} {unitLabels[p.unit] ?? p.unit})
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {selectedProduct && (
          <p className="text-xs text-muted-foreground mt-1">
            Estoque atual: <strong>{selectedProduct.currentStock} {unitLabels[selectedProduct.unit] ?? selectedProduct.unit}</strong>
            {selectedProduct.unit === "cx" && selectedProduct.m2PerBox
              ? ` = ${(selectedProduct.currentStock * selectedProduct.m2PerBox).toFixed(2)} m²`
              : ""}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Tipo *</Label>
          <Select value={form.type} onValueChange={(v) => set("type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
              <SelectItem value="ajuste">Ajuste de Saldo</SelectItem>
              <SelectItem value="inventario">Inventário</SelectItem>
              <SelectItem value="transferencia">Transferência</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{isAdjust ? "Novo Saldo *" : "Quantidade *"}</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder={isAdjust ? "Saldo real contado" : "0"}
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
          />
          {isAdjust && selectedProduct && form.quantity && (
            <p className="text-xs text-muted-foreground">
              Diferença: {(parseFloat(form.quantity || "0") - selectedProduct.currentStock) >= 0 ? "+" : ""}
              {(parseFloat(form.quantity || "0") - selectedProduct.currentStock).toFixed(2)} {unitLabels[selectedProduct.unit] ?? selectedProduct.unit}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Cliente <span className="text-muted-foreground font-normal">(opcional)</span></Label>
        <Select value={form.clientId || "none"} onValueChange={(v) => set("clientId", v === "none" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Vincular a um cliente..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem cliente</SelectItem>
            {clients?.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name}{c.city ? ` — ${c.city}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Motivo / Razão</Label>
        <Input placeholder="Ex: Compra de fornecedor, Venda, Quebra..." value={form.reason} onChange={(e) => set("reason", e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Observações</Label>
        <Textarea placeholder="Informações adicionais..." value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Registrar</Button>
      </div>
    </form>
  );
}

export default function MovementsPage() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("todos");

  const { results, status, loadMore } = usePaginatedQuery(
    api.stockMovements.listMovements,
    filterType !== "todos"
      ? { type: filterType as "entrada" | "saida" | "ajuste" | "inventario" | "transferencia" }
      : {},
    { initialNumItems: 30 }
  );

  const filtered = results.filter(
    (m) =>
      m.productName.toLowerCase().includes(search.toLowerCase()) ||
      m.productCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Movimentações</h1>
          <p className="text-sm text-muted-foreground">Histórico de entradas e saídas de estoque</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <PdfExportButton />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="cursor-pointer">
                <Plus className="w-4 h-4 mr-2" />
                Nova Movimentação
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Movimentação</DialogTitle>
            </DialogHeader>
            <MovementForm onClose={() => setOpen(false)} />
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary cards */}
      <MovementSummary />

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="entrada">Entradas</SelectItem>
            <SelectItem value="saida">Saídas</SelectItem>
            <SelectItem value="ajuste">Ajustes</SelectItem>
            <SelectItem value="inventario">Inventário</SelectItem>
            <SelectItem value="transferencia">Transferência</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {status === "LoadingFirstPage" ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Package /></EmptyMedia>
            <EmptyTitle>Nenhuma movimentação encontrada</EmptyTitle>
            <EmptyDescription>Registre entradas e saídas de estoque</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const cfg = typeConfig[m.type];
            const Icon = cfg.icon;
            const isPositive = m.quantity >= 0;
            return (
              <Card key={m._id} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex items-start gap-3 py-3 px-4">
                  <div className={`p-2 rounded-lg ${cfg.bg} shrink-0 mt-0.5`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm truncate">{m.productName}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          {m.reason && <span className="text-xs text-muted-foreground truncate max-w-[150px]">{m.reason}</span>}
                          {m.clientName && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {m.clientName}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(m._creationTime), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-bold text-sm ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                          {isPositive ? "+" : ""}{m.quantity.toFixed(2)} {unitLabels[m.productUnit] ?? m.productUnit}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.quantityBefore.toFixed(1)} → {m.quantityAfter.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {status === "CanLoadMore" && (
            <Button variant="secondary" className="w-full cursor-pointer" onClick={() => loadMore(30)}>
              Carregar mais
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function MovementSummary() {
  const products = useQuery(api.products.listProducts, {});
  if (!products) return null;

  const totalProducts = products.length;
  const lowStock = products.filter((p) => p.minStock != null && p.currentStock <= p.minStock).length;
  const zeroStock = products.filter((p) => p.currentStock === 0).length;

  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: "Total Produtos", value: totalProducts, color: "text-primary" },
        { label: "Estoque Baixo", value: lowStock, color: "text-amber-400" },
        { label: "Sem Estoque", value: zeroStock, color: "text-destructive" },
      ].map((s) => (
        <Card key={s.label}>
          <CardContent className="py-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
