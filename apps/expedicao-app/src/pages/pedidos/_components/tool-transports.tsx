import { useState } from "react";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Plus,
  Wrench,
  MapPin,
  Truck,
  Trash2,
  Navigation,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Building2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { TransportPhotos } from "./transport-photos.tsx";
import { useNotifyStatus } from "@/hooks/use-notify-status.ts";

const statusConfig = {
  pendente: {
    label: "Pendente",
    icon: Clock,
    color: "bg-amber-500/15 text-amber-400",
  },
  em_rota: {
    label: "Em Rota",
    icon: Navigation,
    color: "bg-purple-500/15 text-purple-400",
  },
  entregue: {
    label: "Entregue",
    icon: CheckCircle2,
    color: "bg-emerald-500/15 text-emerald-400",
  },
  cancelado: {
    label: "Cancelado",
    icon: XCircle,
    color: "bg-red-500/15 text-red-400",
  },
};

const freightLabels: Record<string, string> = {
  interno: "Frete Interno",
  terceiro: "Frete Terceiro",
};

const directionConfig = {
  retirar: {
    label: "Retirar no Cliente",
    short: "Retirar",
    icon: ArrowUpFromLine,
    color: "bg-blue-500/15 text-blue-400",
  },
  entregar: {
    label: "Entregar ao Cliente",
    short: "Entregar",
    icon: ArrowDownToLine,
    color: "bg-emerald-500/15 text-emerald-400",
  },
};

type StatusKey = keyof typeof statusConfig;
type Direction = keyof typeof directionConfig;

function NewTransportForm({ onClose }: { onClose: () => void }) {
  const clients = useQuery(api.clients.listClients, {});
  const nextNumber = useQuery(api.toolTransports.getNextTransportNumber, {});
  const createTransport = useMutation(api.toolTransports.createTransport);

  const [form, setForm] = useState({
    clientId: "",
    destinationClientId: "",
    direction: "entregar" as Direction,
    freightType: "interno" as "interno" | "terceiro",
    freightValue: "",
    pickupAddress: "",
    deliveryAddress: "",
    scheduledDate: "",
    notes: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [tools, setTools] = useState<
    { name: string; quantity: string; notes: string }[]
  >([{ name: "", quantity: "1", notes: "" }]);

  const setTool = (i: number, k: string, v: string) =>
    setTools((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));

  const handleClientChange = (val: string) => {
    const client = clients?.find((c) => c._id === val);
    const clientAddress = client
      ? [client.address, client.addressNumber, client.neighborhood, client.city, client.state]
          .filter(Boolean)
          .join(", ")
      : "";
    setForm((f) => ({
      ...f,
      clientId: val,
      freightType:
        client?.freightType === "interno" || client?.freightType === "terceiro"
          ? client.freightType
          : f.freightType,
      freightValue: client?.freightValue?.toString() ?? f.freightValue,
      // Auto-fill the address of the selected client
      pickupAddress: f.direction === "retirar" ? clientAddress : f.pickupAddress,
      deliveryAddress: f.direction === "entregar" ? clientAddress : f.deliveryAddress,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) {
      toast.error("Selecione um cliente");
      return;
    }
    const validTools = tools
      .filter((t) => t.name.trim() && t.quantity)
      .map((t) => ({
        name: t.name.trim(),
        quantity: parseFloat(t.quantity),
        notes: t.notes.trim() || undefined,
      }));
    if (validTools.length === 0) {
      toast.error("Adicione pelo menos uma ferramenta");
      return;
    }

    try {
      await createTransport({
        transportNumber: nextNumber ?? "TRF-0001",
        clientId: form.clientId as Id<"clients">,
        destinationClientId:
          form.direction === "retirar" && form.destinationClientId
            ? (form.destinationClientId as Id<"clients">)
            : undefined,
        direction: form.direction,
        freightType: form.freightType,
        freightValue: form.freightValue ? parseFloat(form.freightValue) : undefined,
        pickupAddress: form.pickupAddress || undefined,
        deliveryAddress: form.deliveryAddress || undefined,
        scheduledDate: form.scheduledDate || undefined,
        notes: form.notes || undefined,
        tools: validTools,
      });
      toast.success("Transporte de ferramentas criado!");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar transporte");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          Número: <span className="text-foreground">{nextNumber ?? "—"}</span>
        </p>
      </div>

      <div className="space-y-1">
        <Label>Tipo de Operação *</Label>
        <Select value={form.direction} onValueChange={(v) => set("direction", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="retirar">Retirar no Cliente</SelectItem>
            <SelectItem value="entregar">Entregar ao Cliente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>
          {form.direction === "retirar"
            ? "Cliente onde retirar *"
            : "Cliente que irá receber *"}
        </Label>
        <Select
          value={form.clientId || "none"}
          onValueChange={(v) => {
            if (v !== "none") handleClientChange(v);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o cliente..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" disabled>
              Selecione o cliente...
            </SelectItem>
            {clients?.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {form.direction === "retirar" && (
        <div className="space-y-1">
          <Label>Cliente de Destino</Label>
          <Select
            value={form.destinationClientId || "none"}
            onValueChange={(v) =>
              set("destinationClientId", v === "none" ? "" : v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione (opcional)..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Retornar para empresa</SelectItem>
              {clients
                ?.filter((c) => c._id !== form.clientId)
                .map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Para qual cliente as ferramentas serão levadas após a retirada
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Tipo de Frete *</Label>
          <Select
            value={form.freightType}
            onValueChange={(v) => set("freightType", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="interno">Frete Interno</SelectItem>
              <SelectItem value="terceiro">Frete Terceiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Valor Frete (R$)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0,00"
            value={form.freightValue}
            onChange={(e) => set("freightValue", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Endereço de Retirada</Label>
        <Input
          placeholder="Rua, número, cidade..."
          value={form.pickupAddress}
          onChange={(e) => set("pickupAddress", e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label>Endereço de Entrega</Label>
        <Input
          placeholder="Rua, número, cidade..."
          value={form.deliveryAddress}
          onChange={(e) => set("deliveryAddress", e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label>Data Prevista</Label>
        <Input
          type="date"
          value={form.scheduledDate}
          onChange={(e) => set("scheduledDate", e.target.value)}
        />
      </div>

      {/* Tools */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Ferramentas *</Label>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="cursor-pointer"
            onClick={() =>
              setTools((prev) => [...prev, { name: "", quantity: "1", notes: "" }])
            }
          >
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>
        {tools.map((tool, i) => (
          <div key={i} className="border rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                className="flex-1 text-sm"
                placeholder="Nome da ferramenta"
                value={tool.name}
                onChange={(e) => setTool(i, "name", e.target.value)}
              />
              <Input
                className="w-24 text-sm"
                type="number"
                step="1"
                placeholder="Qtd"
                value={tool.quantity}
                onChange={(e) => setTool(i, "quantity", e.target.value)}
              />
              {tools.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="cursor-pointer shrink-0"
                  onClick={() =>
                    setTools((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
            <Input
              className="text-xs"
              placeholder="Observações (opcional)"
              value={tool.notes}
              onChange={(e) => setTool(i, "notes", e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label>Observações Gerais</Label>
        <Textarea
          placeholder="Informações adicionais..."
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">Criar Transporte</Button>
      </div>
    </form>
  );
}

const nextStatusMap: Record<string, StatusKey> = {
  pendente: "em_rota",
  em_rota: "entregue",
};

const nextStatusLabel: Record<string, string> = {
  pendente: "Enviar p/ Rota",
  em_rota: "Marcar Concluído",
};

export function ToolTransportsTab() {
  const [open, setOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [expandedPhotos, setExpandedPhotos] = useState<Record<string, boolean>>({});
  const updateStatus = useMutation(api.toolTransports.updateTransportStatus);
  const deleteTransport = useMutation(api.toolTransports.deleteTransport);
  const { notifyTransportStatus } = useNotifyStatus();

  const togglePhotos = (id: string) =>
    setExpandedPhotos((prev) => ({ ...prev, [id]: !prev[id] }));

  const { results, status, loadMore } = usePaginatedQuery(
    api.toolTransports.listTransports,
    filterStatus !== "todos"
      ? { status: filterStatus as StatusKey }
      : {},
    { initialNumItems: 30 },
  );

  const statusCounts = Object.fromEntries(
    Object.keys(statusConfig).map((s) => [s, results.filter((t) => t.status === s).length]),
  );

  const handleAdvance = async (id: Id<"toolTransports">, current: string) => {
    const next = nextStatusMap[current];
    if (!next) return;
    try {
      await updateStatus({ id, status: next });
      const t = results.find((r) => r._id === id);
      if (t) {
        const toolsSummary = t.tools.map((tool) => `${tool.name} ×${tool.quantity}`).join(", ");
        await notifyTransportStatus({
          transportId: id,
          transportNumber: t.transportNumber,
          clientName: t.clientName,
          clientPhone: t.clientPhone,
          clientCity: t.clientCity,
          direction: t.direction,
          newStatus: next,
          tools: toolsSummary,
        });
      }
      toast.success(`Status atualizado: ${statusConfig[next].label}`);
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleDelete = async (id: Id<"toolTransports">) => {
    if (!window.confirm("Remover este transporte?")) return;
    try {
      await deleteTransport({ id });
      toast.success("Transporte removido");
    } catch {
      toast.error("Erro ao remover");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">
            {results.length} transporte(s) carregado(s)
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              Novo Transporte
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Novo Transporte de Ferramentas</DialogTitle>
            </DialogHeader>
            <NewTransportForm onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "todos", label: "Todos" },
          ...Object.entries(statusConfig).map(([k, v]) => ({ key: k, label: v.label })),
        ].map((s) => (
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

      {status === "LoadingFirstPage" ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Wrench />
            </EmptyMedia>
            <EmptyTitle>Nenhum transporte cadastrado</EmptyTitle>
            <EmptyDescription>
              Cadastre um transporte de ferramentas para um cliente
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setOpen(true)} className="cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              Novo Transporte
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-3">
          {results.map((t) => {
            const cfg = statusConfig[t.status];
            const Icon = cfg.icon;
            const dirCfg = directionConfig[t.direction];
            const DirIcon = dirCfg.icon;
            const canAdvance = t.status in nextStatusMap;
            const totalTools = t.tools.reduce((sum, tool) => sum + tool.quantity, 0);
            return (
              <Card key={t._id}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-lg ${cfg.color} shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm">{t.transportNumber}</p>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${dirCfg.color}`}
                          >
                            <DirIcon className="w-3 h-3" />
                            {dirCfg.short}
                          </span>
                        </div>
                        <p className="text-sm font-semibold truncate">
                          {t.clientName}
                        </p>
                        {t.direction === "retirar" && (
                          <p className="text-xs text-muted-foreground truncate">
                            <span className="font-medium">Destino:</span>{" "}
                            {t.destinationClientName ?? "Empresa"}
                            {t.destinationClientCity && ` • ${t.destinationClientCity}`}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                          {t.clientCity && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {t.clientCity}
                            </span>
                          )}
                          {t.clientPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {t.clientPhone}
                            </span>
                          )}
                          {t.clientDocument && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {t.clientDocument}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            {freightLabels[t.freightType]}
                          </span>
                          {t.freightValue != null && (
                            <span>R$ {t.freightValue.toFixed(2)}</span>
                          )}
                          <span>
                            {format(new Date(t._creationTime), "dd/MM/yy", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                        {(t.pickupAddress || t.deliveryAddress) && (
                          <div className="mt-1.5 space-y-0.5">
                            {t.pickupAddress && (
                              <p className="text-xs text-muted-foreground flex items-start gap-1">
                                <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                                <span><span className="font-medium">Retirada:</span> {t.pickupAddress}</span>
                              </p>
                            )}
                            {t.deliveryAddress && (
                              <p className="text-xs text-muted-foreground flex items-start gap-1">
                                <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                                <span><span className="font-medium">Entrega:</span> {t.deliveryAddress}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canAdvance && (
                        <Button
                          size="sm"
                          className="cursor-pointer text-xs h-8"
                          onClick={() => handleAdvance(t._id, t.status)}
                        >
                          {nextStatusLabel[t.status]}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="cursor-pointer h-8 text-xs gap-1"
                        onClick={() => togglePhotos(t._id)}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Fotos
                        {expandedPhotos[t._id] ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="cursor-pointer h-8 w-8"
                        onClick={() => handleDelete(t._id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Tools list */}
                  <div className="border-t pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      Ferramentas ({totalTools})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {t.tools.map((tool, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md text-xs"
                        >
                          <Wrench className="w-3 h-3" />
                          <span className="font-medium">{tool.name}</span>
                          <span className="text-muted-foreground">
                            × {tool.quantity}
                          </span>
                          {tool.notes && (
                            <span className="text-muted-foreground italic">
                              ({tool.notes})
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {(t.deliveryAddress || t.scheduledDate || t.notes) && (
                    <div className="border-t pt-3 space-y-1 text-xs text-muted-foreground">
                      {t.deliveryAddress && (
                        <p className="flex items-start gap-1.5">
                          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>
                            <span className="font-medium">
                              {t.direction === "retirar" ? "Retirada: " : "Entrega: "}
                            </span>
                            {t.deliveryAddress}
                          </span>
                        </p>
                      )}
                      {t.scheduledDate && (
                        <p>
                          <span className="font-medium">Previsão:</span>{" "}
                          {format(new Date(t.scheduledDate), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </p>
                      )}
                      {t.notes && <p className="italic">{t.notes}</p>}
                    </div>
                  )}

                  {/* Expandable photos section */}
                  {expandedPhotos[t._id] && (
                    <div className="border-t pt-3">
                      <TransportPhotos
                        transportId={t._id}
                        direction={t.direction}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {status === "CanLoadMore" && (
            <Button
              variant="secondary"
              className="w-full cursor-pointer"
              onClick={() => loadMore(30)}
            >
              Carregar mais
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
