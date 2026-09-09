import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Wrench, Car, AlertTriangle, CheckCircle2, Clock,
  Trash2, Pencil, ImagePlus, X, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

type MaintenanceType = "preventiva" | "corretiva" | "revisao" | "pneu" | "outros";
type MaintenanceStatus = "pendente" | "em_andamento" | "concluida";

const TYPE_LABELS: Record<MaintenanceType, string> = {
  preventiva: "Preventiva",
  corretiva: "Corretiva",
  revisao: "Revisão",
  pneu: "Pneu",
  outros: "Outros",
};

const STATUS_CONFIG: Record<MaintenanceStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", color: "bg-yellow-500/15 text-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400", icon: <Clock className="w-3 h-3" /> },
  em_andamento: { label: "Em Andamento", color: "bg-blue-500/15 text-blue-300 dark:bg-blue-900/30 dark:text-blue-400", icon: <Wrench className="w-3 h-3" /> },
  concluida: { label: "Concluída", color: "bg-green-500/15 text-green-300 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle2 className="w-3 h-3" /> },
};

function StatusBadge({ status }: { status: MaintenanceStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

interface MaintenanceFormData {
  vehicleId: string;
  type: MaintenanceType;
  description: string;
  workshop: string;
  cost: string;
  budgetValue: string;
  date: string;
  status: MaintenanceStatus;
  usageId: string;
  notes: string;
}

const DEFAULT_FORM: MaintenanceFormData = {
  vehicleId: "",
  type: "preventiva",
  description: "",
  workshop: "",
  cost: "",
  budgetValue: "",
  date: new Date().toISOString().split("T")[0],
  status: "pendente",
  usageId: "",
  notes: "",
};

export default function ManutencaoPage() {
  const [filterVehicle, setFilterVehicle] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<Id<"vehicleMaintenance"> | null>(null);
  const [form, setForm] = useState<MaintenanceFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [budgetPreview, setBudgetPreview] = useState<string | null>(null);
  const [uploadingBudget, setUploadingBudget] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const vehicles = useQuery(api.fleet.listVehicles, {});
  const maintenanceList = useQuery(api.maintenance.listMaintenance, {
    vehicleId: filterVehicle !== "all" ? (filterVehicle as Id<"vehicles">) : undefined,
    status: filterStatus !== "all" ? (filterStatus as MaintenanceStatus) : undefined,
  });
  const usageWithDamages = useQuery(api.maintenance.listUsageWithDamages, {
    vehicleId: form.vehicleId ? (form.vehicleId as Id<"vehicles">) : undefined,
  });

  const createMaintenance = useMutation(api.maintenance.createMaintenance);
  const updateMaintenance = useMutation(api.maintenance.updateMaintenance);
  const deleteMaintenance = useMutation(api.maintenance.deleteMaintenance);
  const concludeMaintenance = useMutation(api.maintenance.concludeMaintenance);
  const generateUploadUrl = useMutation(api.maintenance.generateUploadUrl);

  const openNew = () => {
    setEditId(null);
    setForm(DEFAULT_FORM);
    setBudgetFile(null);
    setBudgetPreview(null);
    setDialogOpen(true);
  };

  const openEdit = (record: NonNullable<typeof maintenanceList>[0]) => {
    setEditId(record._id);
    setForm({
      vehicleId: record.vehicleId,
      type: record.type,
      description: record.description,
      workshop: record.workshop ?? "",
      cost: record.cost != null ? String(record.cost) : "",
      budgetValue: record.budgetValue != null ? String(record.budgetValue) : "",
      date: record.date,
      status: record.status,
      usageId: record.usageId ?? "",
      notes: record.notes ?? "",
    });
    setBudgetFile(null);
    setBudgetPreview(record.budgetPhotoUrl ?? null);
    setDialogOpen(true);
  };

  const handleBudgetFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBudgetFile(file);
    setBudgetPreview(URL.createObjectURL(file));
  };

  const uploadBudgetPhoto = async (): Promise<string | undefined> => {
    if (!budgetFile) return undefined;
    setUploadingBudget(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": budgetFile.type },
        body: budgetFile,
      });
      const { storageId } = await result.json() as { storageId: string };
      return storageId;
    } finally {
      setUploadingBudget(false);
    }
  };

  const handleSave = async () => {
    if (!form.vehicleId || !form.description || !form.date) {
      toast.error("Preencha veículo, descrição e data");
      return;
    }
    setSaving(true);
    try {
      let budgetPhotoId: string | undefined = undefined;
      if (budgetFile) {
        budgetPhotoId = await uploadBudgetPhoto();
      }

      const payload = {
        vehicleId: form.vehicleId as Id<"vehicles">,
        type: form.type,
        description: form.description,
        workshop: form.workshop || undefined,
        cost: form.cost ? Number(form.cost) : undefined,
        budgetValue: form.budgetValue ? Number(form.budgetValue) : undefined,
        budgetPhotoId: budgetPhotoId,
        date: form.date,
        status: form.status,
        usageId: form.usageId ? (form.usageId as Id<"vehicleUsage">) : undefined,
        notes: form.notes || undefined,
      };
      if (editId) {
        await updateMaintenance({ id: editId, ...payload });
        toast.success("Manutenção atualizada!");
      } else {
        await createMaintenance(payload);
        toast.success("Manutenção registrada!");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar manutenção");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: Id<"vehicleMaintenance">) => {
    if (!confirm("Excluir este registro de manutenção?")) return;
    try {
      await deleteMaintenance({ id });
      toast.success("Registro excluído");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const handleConclude = async (id: Id<"vehicleMaintenance">) => {
    try {
      await concludeMaintenance({ id });
      toast.success("Manutenção concluída! Veículo disponível.");
    } catch {
      toast.error("Erro ao concluir manutenção");
    }
  };

  // KPIs
  const pending = maintenanceList?.filter((r) => r.status === "pendente").length ?? 0;
  const inProgress = maintenanceList?.filter((r) => r.status === "em_andamento").length ?? 0;
  const done = maintenanceList?.filter((r) => r.status === "concluida").length ?? 0;
  const totalCost = maintenanceList?.reduce((s, r) => s + (r.cost ?? 0), 0) ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Manutenção de Frota</h1>
          <p className="text-muted-foreground text-sm">Gerencie manutenções e avarias dos veículos</p>
        </div>
        <Button onClick={openNew} className="gap-2 cursor-pointer">
          <Plus className="w-4 h-4" /> Nova Manutenção
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pendentes", value: pending, color: "text-yellow-400", icon: <Clock className="w-4 h-4" /> },
          { label: "Em Andamento", value: inProgress, color: "text-blue-400", icon: <Wrench className="w-4 h-4" /> },
          { label: "Concluídas", value: done, color: "text-green-400", icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: "Custo Total", value: `R$ ${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "text-foreground", icon: <AlertTriangle className="w-4 h-4" /> },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                {kpi.icon}
                <span className="text-xs">{kpi.label}</span>
              </div>
              <p className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterVehicle} onValueChange={setFilterVehicle}>
          <SelectTrigger className="w-48 cursor-pointer">
            <SelectValue placeholder="Todos os veículos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os veículos</SelectItem>
            {vehicles?.map((v) => (
              <SelectItem key={v._id} value={v._id}>
                {v.plate} — {v.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 cursor-pointer">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {maintenanceList === undefined ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : maintenanceList.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhuma manutenção registrada</p>
            </CardContent>
          </Card>
        ) : (
          maintenanceList.map((record) => (
            <Card key={record._id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-muted shrink-0">
                      <Wrench className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{record.vehicle?.plate} — {record.vehicle?.model}</span>
                        <Badge variant="outline" className="text-xs">{TYPE_LABELS[record.type]}</Badge>
                        <StatusBadge status={record.status} />
                      </div>
                      <p className="text-sm text-foreground">{record.description}</p>
                      {record.workshop && (
                        <p className="text-xs text-muted-foreground mt-0.5">Oficina: {record.workshop}</p>
                      )}
                      {record.linkedUsage && (
                        <p className="text-xs text-orange-400 mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Avaria: {record.linkedUsage.damages} ({record.linkedUsage.departureDate})
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                        <span>📅 {format(new Date(record.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                        {record.budgetValue != null && (
                          <span className="text-amber-400 font-medium flex items-center gap-1">
                            <Receipt className="w-3 h-3" />
                            Orçamento: R$ {record.budgetValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        )}
                        {record.cost != null && (
                          <span className="text-green-400 font-medium">
                            💰 Custo: R$ {record.cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        )}
                        {record.resolvedAt && (
                          <span>✅ Concluída em {format(new Date(record.resolvedAt), "dd/MM/yyyy", { locale: ptBR })}</span>
                        )}
                      </div>
                      {/* Budget photo thumbnail */}
                      {record.budgetPhotoUrl && (
                        <button
                          onClick={() => setPreviewPhoto(record.budgetPhotoUrl!)}
                          className="mt-2 cursor-pointer"
                        >
                          <img
                            src={record.budgetPhotoUrl}
                            alt="Foto do orçamento"
                            className="h-16 w-24 object-cover rounded border hover:opacity-80 transition-opacity"
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">Ver orçamento</p>
                        </button>
                      )}
                      {record.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{record.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    {/* Concluir button for non-concluded */}
                    {record.status !== "concluida" && (
                      <Button
                        size="sm"
                        className="cursor-pointer gap-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleConclude(record._id)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Concluir
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(record)} className="cursor-pointer">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(record._id)} className="cursor-pointer text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Budget photo fullscreen preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 text-white cursor-pointer"
            onClick={() => setPreviewPhoto(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={previewPhoto}
            alt="Orçamento"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Manutenção" : "Nova Manutenção"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Veículo *</Label>
              <Select value={form.vehicleId} onValueChange={(v) => setForm({ ...form, vehicleId: v, usageId: "" })}>
                <SelectTrigger className="cursor-pointer mt-1">
                  <Car className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles?.map((v) => (
                    <SelectItem key={v._id} value={v._id}>
                      {v.plate} — {v.model} ({v.brand})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as MaintenanceType })}>
                  <SelectTrigger className="cursor-pointer mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status *</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as MaintenanceStatus })}>
                  <SelectTrigger className="cursor-pointer mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Descrição *</Label>
              <Textarea
                className="mt-1"
                placeholder="Descreva a manutenção..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Custo Real (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1"
                  placeholder="0,00"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Oficina</Label>
              <Input
                className="mt-1"
                placeholder="Nome da oficina"
                value={form.workshop}
                onChange={(e) => setForm({ ...form, workshop: e.target.value })}
              />
            </div>

            {/* Budget section */}
            <div className="border rounded-lg p-3 space-y-3 bg-amber-500/10/50 dark:bg-amber-950/10">
              <p className="text-sm font-medium flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-400" />
                Orçamento
              </p>
              <div>
                <Label>Valor do Orçamento (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1"
                  placeholder="0,00"
                  value={form.budgetValue}
                  onChange={(e) => setForm({ ...form, budgetValue: e.target.value })}
                />
              </div>
              <div>
                <Label>Foto do Orçamento</Label>
                <div className="mt-1">
                  {budgetPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={budgetPreview}
                        alt="Orçamento"
                        className="h-28 w-40 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => { setBudgetFile(null); setBudgetPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors cursor-pointer w-full justify-center"
                    >
                      <ImagePlus className="w-4 h-4" />
                      Tirar foto ou importar imagem
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleBudgetFileChange}
                  />
                </div>
              </div>
            </div>

            {/* Link to damage */}
            {form.vehicleId && usageWithDamages && usageWithDamages.length > 0 && (
              <div>
                <Label>Vincular a Avaria (opcional)</Label>
                <Select value={form.usageId || "none"} onValueChange={(v) => setForm({ ...form, usageId: v === "none" ? "" : v })}>
                  <SelectTrigger className="cursor-pointer mt-1">
                    <SelectValue placeholder="Selecione uma avaria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {usageWithDamages.map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.departureDate} — {u.driverName}: {u.damages?.slice(0, 50)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Observações</Label>
              <Textarea
                className="mt-1"
                placeholder="Notas adicionais..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="cursor-pointer">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || uploadingBudget} className="cursor-pointer">
              {saving || uploadingBudget ? "Salvando..." : editId ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
