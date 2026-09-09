import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog.tsx";
import { VehicleForm } from "./_components/vehicle-form.tsx";
import { UsageForm } from "./_components/usage-form.tsx";
import { DamagePhotos } from "./_components/damage-photos.tsx";
import {
  Truck, Car, Plus, Pencil, Trash2, LogOut, LogIn,
  AlertTriangle, CheckCircle2, Wrench, MapPin, Fuel,
  Navigation, Search, X, Route, Share2
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function statusBadge(status: string) {
  if (status === "disponivel") return <Badge className="bg-green-500/15 text-green-300 dark:bg-green-900 dark:text-green-200 text-xs px-2 py-0.5">Disponível</Badge>;
  if (status === "em_uso") return <Badge className="bg-blue-500/15 text-blue-300 dark:bg-blue-900 dark:text-blue-200 text-xs px-2 py-0.5">Em Uso</Badge>;
  return <Badge className="bg-yellow-500/15 text-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 text-xs px-2 py-0.5">Manutenção</Badge>;
}

function VehicleIcon({ type, className }: { type: string; className?: string }) {
  if (type === "caminhao" || type === "van") return <Truck className={cn("w-5 h-5", className)} />;
  return <Car className={cn("w-5 h-5", className)} />;
}

const TYPE_LABELS: Record<string, string> = { carro: "Carro", caminhao: "Caminhão", van: "Van", moto: "Moto" };

function FrotaInner() {
  const [tab, setTab] = useState("veiculos");

  // Vehicle filters
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterType, setFilterType] = useState("todos");

  // Usage filters
  const [filterVehicleId, setFilterVehicleId] = useState("todos");
  const [filterUsageStatus, setFilterUsageStatus] = useState("todos");
  const [filterDriver, setFilterDriver] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [debouncedDriver] = useDebounce(filterDriver, 400);

  // Dialogs
  const [vehicleDialog, setVehicleDialog] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Doc<"vehicles"> | null>(null);
  const [departureDialog, setDepartureDialog] = useState(false);
  const [arrivalDialog, setArrivalDialog] = useState(false);
  const [selectedUsage, setSelectedUsage] = useState<(Doc<"vehicleUsage"> & { vehicle?: Doc<"vehicles"> | null }) | null>(null);

  const deleteVehicle = useMutation(api.fleet.deleteVehicle);
  const deleteUsage = useMutation(api.fleet.deleteUsage);

  const vehicles = useQuery(api.fleet.listVehicles, {
    status: filterStatus !== "todos" ? filterStatus as "disponivel" | "em_uso" | "manutencao" : undefined,
    type: filterType !== "todos" ? filterType as "carro" | "caminhao" | "van" | "moto" : undefined,
  });

  const allVehicles = useQuery(api.fleet.listVehicles, {});

  const usages = useQuery(api.fleet.listUsage, {
    vehicleId: filterVehicleId !== "todos" ? filterVehicleId as Id<"vehicles"> : undefined,
    status: filterUsageStatus !== "todos" ? filterUsageStatus as "aberto" | "concluido" : undefined,
    driverName: debouncedDriver || undefined,
    dateFrom: filterDateFrom || undefined,
    dateTo: filterDateTo || undefined,
  });

  const allUsages = useQuery(api.fleet.listUsage, {});

  // KPIs
  const disponivel = allVehicles?.filter((v) => v.status === "disponivel").length ?? 0;
  const emUso = allVehicles?.filter((v) => v.status === "em_uso").length ?? 0;
  const manutencao = allVehicles?.filter((v) => v.status === "manutencao").length ?? 0;
  const kmTotal = allUsages?.reduce((s, u) => s + (u.kmDriven ?? 0), 0) ?? 0;
  const avarias = allUsages?.filter((u) => u.damages && u.damages.trim().length > 0).length ?? 0;

  const hasUsageFilters = filterVehicleId !== "todos" || filterUsageStatus !== "todos" || filterDriver || filterDateFrom || filterDateTo;

  function clearUsageFilters() {
    setFilterVehicleId("todos");
    setFilterUsageStatus("todos");
    setFilterDriver("");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Controle de Frota</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5">Gestão de veículos e registros de uso</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="cursor-pointer"
            onClick={() => {
              const url = `${window.location.origin}/motorista`;
              navigator.clipboard.writeText(url).then(
                () => toast.success("Link copiado! Compartilhe com os motoristas."),
                () => toast.info(`Link: ${url}`)
              );
            }}
          >
            <Share2 className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Portal Motorista</span>
          </Button>
          <Button size="sm" onClick={() => setDepartureDialog(true)}>
            <LogOut className="w-4 h-4 mr-1.5" /> Registrar Saída
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setEditVehicle(null); setVehicleDialog(true); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo Veículo
          </Button>
        </div>
      </div>

      {/* KPIs — compact row on mobile, cards on desktop */}
      <div className="px-4 md:px-6 py-3 md:py-4">
        {/* Mobile: single compact row */}
        <div className="flex md:hidden gap-2 overflow-x-auto pb-1">
          {[
            { label: "Total", value: allVehicles?.length ?? 0, icon: Truck, bg: "bg-muted", color: "text-foreground" },
            { label: "Disponível", value: disponivel, icon: CheckCircle2, bg: "bg-green-500/15 dark:bg-green-900", color: "text-green-400 dark:text-green-300" },
            { label: "Em Uso", value: emUso, icon: Navigation, bg: "bg-blue-500/15 dark:bg-blue-900", color: "text-blue-400 dark:text-blue-300" },
            { label: "Manut.", value: manutencao, icon: Wrench, bg: "bg-yellow-500/15 dark:bg-yellow-900", color: "text-yellow-400 dark:text-yellow-300" },
            { label: "Avarias", value: avarias, icon: AlertTriangle, bg: "bg-red-500/15 dark:bg-red-900", color: "text-red-400 dark:text-red-300" },
          ].map((kpi) => (
            <div key={kpi.label} className={cn("flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-2", kpi.bg)}>
              <kpi.icon className={cn("w-3.5 h-3.5 shrink-0", kpi.color)} />
              <span className={cn("text-base font-bold", kpi.color)}>{kpi.value}</span>
              <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
            </div>
          ))}
        </div>
        {/* Desktop: card grid */}
        <div className="hidden md:grid grid-cols-5 gap-3">
          {[
            { label: "Total Veículos", value: allVehicles?.length ?? 0, icon: Truck, color: "text-foreground" },
            { label: "Disponíveis", value: disponivel, icon: CheckCircle2, color: "text-green-400" },
            { label: "Em Uso", value: emUso, icon: Navigation, color: "text-blue-400" },
            { label: "Manutenção", value: manutencao, icon: Wrench, color: "text-yellow-400" },
            { label: "Avarias", value: avarias, icon: AlertTriangle, color: "text-red-400" },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="flex items-center gap-3 py-4">
                <kpi.icon className={cn("w-7 h-7 shrink-0", kpi.color)} />
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* KM total badge */}
      {kmTotal > 0 && (
        <div className="px-4 md:px-6 pb-2">
          <div className="inline-flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm">
            <Route className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground hidden sm:inline">KM total registrado:</span>
            <span className="font-semibold">{kmTotal.toLocaleString("pt-BR")} km</span>
          </div>
        </div>
      )}

      <div className="px-4 md:px-6 flex-1 overflow-auto pb-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 w-full md:w-auto">
            <TabsTrigger value="veiculos" className="flex-1 md:flex-none text-sm font-semibold">Veículos</TabsTrigger>
            <TabsTrigger value="registros" className="flex-1 md:flex-none text-sm font-semibold">
              Registros de Uso
              {(allUsages?.filter(u => u.status === "aberto").length ?? 0) > 0 && (
                <Badge className="ml-1.5 bg-blue-500 text-white text-[10px] px-1.5 py-0">
                  {allUsages?.filter(u => u.status === "aberto").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Veículos ── */}
          <TabsContent value="veiculos">
            <div className="flex gap-2 mb-4 flex-wrap">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="em_uso">Em Uso</SelectItem>
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos tipos</SelectItem>
                  <SelectItem value="carro">Carro</SelectItem>
                  <SelectItem value="caminhao">Caminhão</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {vehicles === undefined ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
              </div>
            ) : vehicles.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Truck /></EmptyMedia>
                  <EmptyTitle>Nenhum veículo cadastrado</EmptyTitle>
                  <EmptyDescription>Cadastre os veículos da sua frota para começar</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button size="sm" onClick={() => { setEditVehicle(null); setVehicleDialog(true); }}>
                    <Plus className="w-4 h-4 mr-1" /> Novo Veículo
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {vehicles.map((vehicle) => (
                  <Card key={vehicle._id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-3 px-4 space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <VehicleIcon type={vehicle.type} />
                          </div>
                          <div>
                            <p className="font-bold text-base leading-tight">{vehicle.plate}</p>
                            <p className="text-xs text-muted-foreground">{TYPE_LABELS[vehicle.type]}</p>
                          </div>
                        </div>
                        {/* Status badge — larger on mobile */}
                        <div className="flex flex-col items-end gap-1">
                          {statusBadge(vehicle.status)}
                        </div>
                      </div>

                      <div>
                        <p className="font-medium text-sm">{vehicle.brand} {vehicle.model}{vehicle.year ? ` (${vehicle.year})` : ""}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {vehicle.color && <p className="text-xs text-muted-foreground">Cor: {vehicle.color}</p>}
                          {vehicle.currentKm !== undefined && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Navigation className="w-3 h-3" /> {vehicle.currentKm.toLocaleString("pt-BR")} km
                            </p>
                          )}
                        </div>
                        {vehicle.notes && <p className="text-xs text-muted-foreground italic mt-1">{vehicle.notes}</p>}
                      </div>

                      <div className="flex gap-2 pt-0.5">
                        <Button size="sm" variant="secondary" className="flex-1 cursor-pointer" onClick={() => { setEditVehicle(vehicle); setVehicleDialog(true); }}>
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir veículo?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={async () => {
                                await deleteVehicle({ id: vehicle._id });
                                toast.success("Veículo excluído");
                              }}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Registros de Uso ── */}
          <TabsContent value="registros">
            {/* Filters */}
            <div className="bg-muted/50 rounded-xl p-4 mb-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                {/* Busca motorista */}
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={filterDriver}
                    onChange={(e) => setFilterDriver(e.target.value)}
                    placeholder="Buscar motorista..."
                    className="pl-8"
                  />
                </div>
                {/* Veículo */}
                <Select value={filterVehicleId} onValueChange={setFilterVehicleId}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Veículo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos veículos</SelectItem>
                    {allVehicles?.map((v) => (
                      <SelectItem key={v._id} value={v._id}>{v.plate} — {v.brand} {v.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Status */}
                <Select value={filterUsageStatus} onValueChange={setFilterUsageStatus}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="aberto">Em Aberto</SelectItem>
                    <SelectItem value="concluido">Concluídos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">De:</Label>
                  <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-36 h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Até:</Label>
                  <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-36 h-8 text-sm" />
                </div>
                {hasUsageFilters && (
                  <Button size="sm" variant="ghost" onClick={clearUsageFilters} className="text-muted-foreground cursor-pointer">
                    <X className="w-3.5 h-3.5 mr-1" /> Limpar filtros
                  </Button>
                )}
              </div>
            </div>

            {/* Results summary */}
            {usages !== undefined && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                  {usages.length} registro{usages.length !== 1 ? "s" : ""}
                  {usages.length > 0 && (
                    <span className="ml-2 text-foreground font-medium">
                      · {usages.reduce((s, u) => s + (u.kmDriven ?? 0), 0).toLocaleString("pt-BR")} km percorridos
                    </span>
                  )}
                </p>
              </div>
            )}

            {usages === undefined ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
              </div>
            ) : usages.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><MapPin /></EmptyMedia>
                  <EmptyTitle>Nenhum registro encontrado</EmptyTitle>
                  <EmptyDescription>
                    {hasUsageFilters ? "Tente ajustar os filtros." : "Registre a saída de um veículo para começar."}
                  </EmptyDescription>
                </EmptyHeader>
                {!hasUsageFilters && (
                  <EmptyContent>
                    <Button size="sm" onClick={() => setDepartureDialog(true)}>
                      <LogOut className="w-4 h-4 mr-1" /> Registrar Saída
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            ) : (
              <div className="space-y-3">
                {usages.map((usage) => {
                  const hasAvaria = usage.damages && usage.damages.trim().length > 0;
                  return (
                    <Card key={usage._id} className={cn("border", hasAvaria && "border-red-500/30 dark:border-red-900")}>
                      <CardContent className="py-4 px-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Status icon */}
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                              usage.status === "aberto"
                                ? "bg-blue-500/15 text-blue-400 dark:bg-blue-900 dark:text-blue-200"
                                : "bg-muted text-muted-foreground")}>
                              {usage.status === "aberto" ? <Navigation className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                            </div>

                            <div className="min-w-0">
                              {/* Title row */}
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold">
                                  {usage.vehicle?.plate ?? "—"} — {usage.vehicle?.brand} {usage.vehicle?.model}
                                </p>
                                {usage.status === "aberto"
                                  ? <Badge className="bg-blue-500/15 text-blue-300 dark:bg-blue-900 dark:text-blue-200">Em Aberto</Badge>
                                  : <Badge variant="secondary">Concluído</Badge>}
                                {hasAvaria && (
                                  <Badge className="bg-red-500/15 text-red-300 dark:bg-red-900 dark:text-red-200">
                                    <AlertTriangle className="w-3 h-3 mr-1" />Avaria
                                  </Badge>
                                )}
                              </div>

                              {/* Motorista + destino */}
                              <p className="text-sm text-muted-foreground mt-0.5">
                                Motorista: <span className="font-medium text-foreground">{usage.driverName}</span>
                                {usage.destination && (
                                  <> · <MapPin className="w-3 h-3 inline mx-0.5" />{usage.destination}</>
                                )}
                                {usage.purpose && <> · {usage.purpose}</>}
                              </p>

                              {/* KM + datas */}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <LogOut className="w-3.5 h-3.5" />
                                  <span>{usage.departureDate.split("-").reverse().join("/")} {usage.departureTime}</span>
                                  <span className="font-medium text-foreground ml-1">{usage.kmDeparture.toLocaleString("pt-BR")} km</span>
                                </div>
                                {usage.arrivalDate && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <LogIn className="w-3.5 h-3.5" />
                                    <span>{usage.arrivalDate.split("-").reverse().join("/")} {usage.arrivalTime}</span>
                                    <span className="font-medium text-foreground ml-1">{usage.kmArrival?.toLocaleString("pt-BR")} km</span>
                                  </div>
                                )}
                                {usage.kmDriven !== undefined && (
                                  <div className="flex items-center gap-1 text-green-400 dark:text-green-400 font-semibold">
                                    <Route className="w-3.5 h-3.5" />
                                    {usage.kmDriven.toLocaleString("pt-BR")} km percorridos
                                  </div>
                                )}
                                {usage.fuelCost !== undefined && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Fuel className="w-3.5 h-3.5" />
                                    R$ {usage.fuelCost.toFixed(2)}
                                  </div>
                                )}
                              </div>

                              {/* Avaria */}
                              {hasAvaria && (
                                <p className="text-sm text-red-400 dark:text-red-400 mt-1.5 font-medium">
                                  ⚠ {usage.damages}
                                </p>
                              )}
                              {/* Damage photos */}
                              {hasAvaria && (usage.damagePhotoIds?.length ?? 0) > 0 && (
                                <DamagePhotos storageIds={usage.damagePhotoIds!} />
                              )}

                              {/* Notes */}
                              {usage.notes && !hasAvaria && (
                                <p className="text-xs text-muted-foreground italic mt-1">{usage.notes}</p>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 shrink-0">
                            {usage.status === "aberto" && (
                              <Button size="sm" className="cursor-pointer" onClick={() => { setSelectedUsage(usage); setArrivalDialog(true); }}>
                                <LogIn className="w-3.5 h-3.5 mr-1" /> Chegada
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive cursor-pointer">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
                                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={async () => {
                                    await deleteUsage({ id: usage._id });
                                    toast.success("Registro excluído");
                                  }}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <Dialog open={vehicleDialog} onOpenChange={setVehicleDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editVehicle ? "Editar Veículo" : "Novo Veículo"}</DialogTitle>
          </DialogHeader>
          <VehicleForm vehicle={editVehicle ?? undefined} onSuccess={() => setVehicleDialog(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={departureDialog} onOpenChange={setDepartureDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Saída</DialogTitle>
          </DialogHeader>
          <UsageForm mode="departure" onSuccess={() => setDepartureDialog(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={arrivalDialog} onOpenChange={(o) => { setArrivalDialog(o); if (!o) setSelectedUsage(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Chegada</DialogTitle>
          </DialogHeader>
          {selectedUsage && (
            <UsageForm
              mode="arrival"
              usage={selectedUsage}
              onSuccess={() => { setArrivalDialog(false); setSelectedUsage(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FrotaPage() {
  return (
    <Authenticated>
      <FrotaInner />
    </Authenticated>
  );
}
