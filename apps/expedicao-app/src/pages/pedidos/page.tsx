import { useState } from "react";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import {
  Plus, ShoppingCart, MapPin, Truck, ChevronRight, Trash2, PackageCheck,
  PackageSearch, Navigation, CheckCircle2, XCircle, FileText, Wrench, Search, X, Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ToolTransportsTab } from "./_components/tool-transports.tsx";
import { useNotifyStatus } from "@/hooks/use-notify-status.ts";

const statusConfig = {
  rascunho: { label: "Rascunho", icon: FileText, color: "bg-muted text-muted-foreground", dot: "bg-gray-400" },
  confirmado: { label: "Confirmado", icon: PackageSearch, color: "bg-blue-500/15 text-blue-400", dot: "bg-blue-500" },
  em_separacao: { label: "Em Separação", icon: PackageCheck, color: "bg-amber-500/15 text-amber-400", dot: "bg-amber-500" },
  em_rota: { label: "Em Rota", icon: Navigation, color: "bg-purple-500/15 text-purple-400", dot: "bg-purple-500" },
  entregue: { label: "Entregue", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-500" },
  cancelado: { label: "Cancelado", icon: XCircle, color: "bg-red-500/15 text-red-400", dot: "bg-red-500" },
};

const freightLabels: Record<string, string> = {
  interno: "Frete Interno",
  terceiro: "Frete Terceiro",
  retirada: "Retirada",
};

const unitLabels: Record<string, string> = { m2: "m²", cx: "cx", ml: "ml", un: "un" };

function NewOrderForm({ onClose }: { onClose: () => void }) {
  const clients = useQuery(api.clients.listClients, {});
  const products = useQuery(api.products.listProducts, {});
  const nextOrderNumber = useQuery(api.orders.getNextOrderNumber, {});
  const createOrder = useMutation(api.orders.createOrder);

  const [form, setForm] = useState({
    clientId: "",
    freightType: "interno",
    freightValue: "",
    notes: "",
    deliveryAddress: "",
    scheduledDate: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [items, setItems] = useState<{ productId: string; quantity: string; unitPrice: string; notes: string }[]>([
    { productId: "", quantity: "", unitPrice: "", notes: "" },
  ]);

  const setItem = (i: number, k: string, v: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));

  // Pre-fill freight from client defaults
  const handleClientChange = (val: string) => {
    const client = clients?.find((c) => c._id === val);
    setForm((f) => ({
      ...f,
      clientId: val,
      freightType: client?.freightType ?? f.freightType,
      freightValue: client?.freightValue?.toString() ?? f.freightValue,
      deliveryAddress: client
        ? [client.address, client.addressNumber, client.neighborhood, client.city, client.state]
            .filter(Boolean)
            .join(", ")
        : f.deliveryAddress,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { toast.error("Selecione um cliente"); return; }
    const validItems = items.filter((it) => it.productId && it.quantity);
    if (validItems.length === 0) { toast.error("Adicione pelo menos um produto"); return; }

    try {
      await createOrder({
        clientId: form.clientId as Id<"clients">,
        orderNumber: nextOrderNumber ?? "PED-0001",
        freightType: form.freightType as "interno" | "terceiro" | "retirada",
        freightValue: form.freightValue ? parseFloat(form.freightValue) : undefined,
        notes: form.notes || undefined,
        deliveryAddress: form.deliveryAddress || undefined,
        scheduledDate: form.scheduledDate || undefined,
        items: validItems.map((it) => ({
          productId: it.productId as Id<"products">,
          quantity: parseFloat(it.quantity),
          unitPrice: it.unitPrice ? parseFloat(it.unitPrice) : undefined,
          notes: it.notes || undefined,
        })),
      });
      toast.success("Pedido criado!");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar pedido");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">Número: <span className="text-foreground">{nextOrderNumber ?? "—"}</span></p>
      </div>

      <ClientSearch
        clients={clients}
        value={form.clientId}
        onChange={handleClientChange}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Tipo de Frete</Label>
          <Select value={form.freightType} onValueChange={(v) => set("freightType", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="interno">Frete Interno</SelectItem>
              <SelectItem value="terceiro">Frete Terceiro</SelectItem>
              <SelectItem value="retirada">Retirada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Valor Frete (R$)</Label>
          <Input type="number" step="0.01" placeholder="0,00" value={form.freightValue} onChange={(e) => set("freightValue", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Endereço de Entrega</Label>
        <Input placeholder="Rua, número, cidade..." value={form.deliveryAddress} onChange={(e) => set("deliveryAddress", e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label>Data Prevista</Label>
        <Input type="date" value={form.scheduledDate} onChange={(e) => set("scheduledDate", e.target.value)} />
      </div>

      {/* Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Produtos *</Label>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="cursor-pointer"
            onClick={() => setItems((prev) => [...prev, { productId: "", quantity: "", unitPrice: "", notes: "" }])}
          >
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>
        {items.map((item, i) => {
          const prod = products?.find((p) => p._id === item.productId);
          return (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              {/* Produto — linha completa */}
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <ProductSearch
                    products={products}
                    value={item.productId}
                    onChange={(v) => setItem(i, "productId", v)}
                    unitLabels={unitLabels}
                  />
                </div>
                {items.length > 1 && (
                  <Button type="button" size="icon" variant="ghost" className="cursor-pointer shrink-0" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
              {/* Quantidade e preço — linha separada */}
              <div className="flex gap-2">
                <Input
                  className="flex-1 text-sm"
                  type="number"
                  step="0.01"
                  placeholder={`Qtd ${prod ? `(${unitLabels[prod.unit] ?? prod.unit})` : ""}`}
                  value={item.quantity}
                  onChange={(e) => setItem(i, "quantity", e.target.value)}
                />
              </div>
              {prod?.unit === "cx" && prod.m2PerBox && item.quantity && (
                <p className="text-xs text-muted-foreground px-1">
                  = {(parseFloat(item.quantity) * prod.m2PerBox).toFixed(2)} m²
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-1">
        <Label>Observações</Label>
        <Textarea placeholder="Informações adicionais..." value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Criar Pedido</Button>
      </div>
    </form>
  );
}

function ClientSearch({ clients, value, onChange }: {
  clients: { _id: string; name: string }[] | undefined;
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = clients?.find((c) => c._id === value);
  const filtered = clients?.filter((c) =>
    !query || c.name.toLowerCase().includes(query.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-1">
      <Label>Cliente *</Label>
      <div className="relative">
        <Input
          placeholder="Buscar cliente..."
          value={open || !selected ? query : selected.name}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setQuery(e.target.value); onChange(""); }}
          className="w-full"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c._id}
                type="button"
                onMouseDown={() => { onChange(c._id); setOpen(false); setQuery(""); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        {open && filtered.length === 0 && query && (
          <div className="absolute z-50 mt-1 w-full bg-popover border rounded-lg shadow-lg px-3 py-2 text-sm text-muted-foreground">
            Nenhum cliente encontrado
          </div>
        )}
      </div>
    </div>
  );
}

function ProductSearch({ products, value, onChange, unitLabels }: {
  products: { _id: string; name: string; currentStock: number; unit: string; m2PerBox?: number }[] | undefined;
  value: string;
  onChange: (id: string) => void;
  unitLabels: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = products?.find((p) => p._id === value);
  const filtered = products?.filter((p) =>
    !query || p.name.toLowerCase().includes(query.toLowerCase())
  ) ?? [];

  return (
    <div className="relative">
      <Input
        className="text-sm w-full"
        placeholder="Buscar produto..."
        value={open || !selected ? query : `${selected.name} (${selected.currentStock} ${unitLabels[selected.unit] ?? selected.unit})`}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQuery(e.target.value); onChange(""); }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-popover border rounded-lg shadow-lg max-h-56 overflow-y-auto" style={{ minWidth: "280px" }}>
          {filtered.map((p) => (
            <button
              key={p._id}
              type="button"
              onMouseDown={() => { onChange(p._id); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground ml-2">({p.currentStock} {unitLabels[p.unit] ?? p.unit})</span>
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-popover border rounded-lg shadow-lg px-3 py-2 text-sm text-muted-foreground" style={{ minWidth: "280px" }}>
          Nenhum produto encontrado
        </div>
      )}
    </div>
  );
}

function OrdersTab() {
  const [open, setOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const updateStatus = useMutation(api.orders.updateOrderStatus);
  const { notifyOrderStatus } = useNotifyStatus();

  const { results, status, loadMore } = usePaginatedQuery(
    api.orders.listOrders,
    filterStatus !== "todos"
      ? { status: filterStatus as "rascunho" | "confirmado" | "em_separacao" | "em_rota" | "entregue" | "cancelado" }
      : {},
    { initialNumItems: 30 }
  );

  const searchResults = useQuery(
    api.orders.searchOrders,
    search.trim() ? { search: search.trim() } : "skip"
  );

  const statusCounts = Object.fromEntries(
    Object.keys(statusConfig).map((s) => [s, results.filter((o) => o.status === s).length])
  );

  // When searching, use backend search results; otherwise use paginated results
  const filtered = search.trim()
    ? (searchResults ?? []).filter(
        (o) => filterStatus === "todos" || o.status === filterStatus
      )
    : results;

  const nextStatus: Record<string, string> = {
    confirmado: "em_separacao",
    em_separacao: "em_rota",
    em_rota: "entregue",
  };

  const nextStatusLabel: Record<string, string> = {
    confirmado: "Iniciar Separação",
    em_separacao: "Enviar p/ Rota",
    em_rota: "Marcar Entregue",
  };

  const handleAdvanceStatus = async (
    e: React.MouseEvent,
    orderId: Id<"orders">,
    currentStatus: string
  ) => {
    e.stopPropagation();
    const next = nextStatus[currentStatus];
    if (!next) return;
    try {
      await updateStatus({ id: orderId, status: next as "em_separacao" | "em_rota" | "entregue" });
      // Find the order in results to get client info
      const order = results.find((o) => o._id === orderId);
      if (order) {
        await notifyOrderStatus({
          orderId,
          orderNumber: order.orderNumber,
          clientName: order.clientName,
          clientPhone: order.clientPhone,
          clientCity: order.clientCity,
          newStatus: next,
        });
      }
      toast.success(`Status atualizado para: ${statusConfig[next as keyof typeof statusConfig]?.label}`);
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">{results.length} pedido(s) carregado(s)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="cursor-pointer"><Plus className="w-4 h-4 mr-2" />Novo Pedido</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Novo Pedido</DialogTitle></DialogHeader>
            <NewOrderForm onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[{ key: "todos", label: "Todos" }, ...Object.entries(statusConfig).map(([k, v]) => ({ key: k, label: v.label }))].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(s.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              filterStatus === s.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-secondary"
            }`}
          >
            {s.label}
            {s.key !== "todos" && statusCounts[s.key] > 0 && (
              <span className="ml-1.5 text-xs opacity-70">({statusCounts[s.key]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 pr-9"
          placeholder="Buscar por número ou cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {(status === "LoadingFirstPage" || (search.trim() && searchResults === undefined)) ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ShoppingCart /></EmptyMedia>
            <EmptyTitle>{search ? "Nenhum pedido encontrado" : "Nenhum pedido encontrado"}</EmptyTitle>
            <EmptyDescription>{search ? `Nenhum resultado para "${search}"` : `Crie o primeiro pedido clicando em "Novo Pedido"`}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {!search && <Button onClick={() => setOpen(true)} className="cursor-pointer"><Plus className="w-4 h-4 mr-2" />Novo Pedido</Button>}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const cfg = statusConfig[order.status];
            const Icon = cfg.icon;
            const canAdvance = order.status in nextStatus;
            return (
              <Card
                key={order._id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/pedidos/${order._id}`)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${cfg.color} shrink-0 mt-0.5`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm">{order.orderNumber}</p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{order.clientName}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {order.clientCity && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />{order.clientCity}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Truck className="w-3 h-3" />{freightLabels[order.freightType]}
                        </span>
                        <span className="text-xs text-muted-foreground">{order.itemCount} item(s)</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(order._creationTime), "dd/MM/yy", { locale: ptBR })}
                        </span>
                      </div>
                      {canAdvance && (
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            className="cursor-pointer text-xs h-7 w-full sm:w-auto"
                            onClick={(e) => handleAdvanceStatus(e, order._id, order.status)}
                          >
                            {nextStatusLabel[order.status]}
                          </Button>
                        </div>
                      )}
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

export default function OrdersPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-widest uppercase">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Gerencie pedidos e transporte de ferramentas</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="cursor-pointer gap-2 shrink-0"
          onClick={() => {
            const url = `${window.location.origin}/acompanhamento`;
            navigator.clipboard.writeText(url).then(
              () => toast.success("Link copiado! Compartilhe com seus clientes."),
              () => toast.info(`Link: ${url}`)
            );
          }}
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Compartilhar</span>
        </Button>
      </div>

      <Tabs defaultValue="pedidos" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pedidos" className="cursor-pointer flex-1 sm:flex-none">
            <ShoppingCart className="w-4 h-4" /> Pedidos
          </TabsTrigger>
          <TabsTrigger value="ferramentas" className="cursor-pointer flex-1 sm:flex-none">
            <Wrench className="w-4 h-4" /> <span className="hidden sm:inline">Transporte de </span>Ferramentas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos">
          <OrdersTab />
        </TabsContent>

        <TabsContent value="ferramentas">
          <ToolTransportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
