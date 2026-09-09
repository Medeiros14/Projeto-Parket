import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import {
  Truck, Car, Navigation, Wrench, AlertTriangle,
  CheckCircle2, Route, Fuel, LogOut, LogIn, TrendingUp,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { DamagePhotos } from "../_components/damage-photos.tsx";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

const STATUS_COLORS: Record<string, string> = {
  disponivel: "bg-green-500/15 text-green-300 dark:bg-green-900 dark:text-green-200",
  em_uso: "bg-blue-500/15 text-blue-300 dark:bg-blue-900 dark:text-blue-200",
  manutencao: "bg-yellow-500/15 text-yellow-300 dark:bg-yellow-900 dark:text-yellow-200",
};
const STATUS_LABELS: Record<string, string> = {
  disponivel: "Disponível", em_uso: "Em Uso", manutencao: "Manutenção",
};
const TYPE_LABELS: Record<string, string> = {
  carro: "Carro", caminhao: "Caminhão", van: "Van", moto: "Moto",
};

// Period options in days
const PERIOD_OPTIONS = [
  { label: "Últimos 7 dias", value: "7" },
  { label: "Últimos 30 dias", value: "30" },
  { label: "Últimos 90 dias", value: "90" },
  { label: "Todo período", value: "all" },
];

function getDateFrom(period: string): string | undefined {
  if (period === "all") return undefined;
  const days = parseInt(period, 10);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function VehicleIcon({ type, className }: { type: string; className?: string }) {
  if (type === "caminhao" || type === "van") return <Truck className={cn("w-5 h-5", className)} />;
  return <Car className={cn("w-5 h-5", className)} />;
}

// KPI card component
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  iconClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconClass?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", iconClass ?? "bg-muted")}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

type UsageWithVehicle = Doc<"vehicleUsage"> & { vehicle: Doc<"vehicles"> | null };

function DashboardInner() {
  const [period, setPeriod] = useState("30");

  const dateFrom = getDateFrom(period);

  const allVehicles = useQuery(api.fleet.listVehicles, {});
  const periodUsages = useQuery(api.fleet.listUsage, {
    dateFrom,
  }) as UsageWithVehicle[] | undefined;
  const allUsages = useQuery(api.fleet.listUsage, {}) as UsageWithVehicle[] | undefined;

  // ─── KPIs ───────────────────────────────────────────────────────────────
  const totalVehicles = allVehicles?.length ?? 0;
  const disponivel = allVehicles?.filter((v) => v.status === "disponivel").length ?? 0;
  const emUso = allVehicles?.filter((v) => v.status === "em_uso").length ?? 0;
  const manutencao = allVehicles?.filter((v) => v.status === "manutencao").length ?? 0;

  const kmTotal = periodUsages?.reduce((s, u) => s + (u.kmDriven ?? 0), 0) ?? 0;
  const fuelTotal = periodUsages?.reduce((s, u) => s + (u.fuelCost ?? 0), 0) ?? 0;
  const tripCount = periodUsages?.filter((u) => u.status === "concluido").length ?? 0;

  // Damages (all time pending)
  const pendingDamages = allUsages?.filter(
    (u) => u.damages && u.damages.trim().length > 0
  ) ?? [];

  // ─── Per-vehicle KM chart data ───────────────────────────────────────────
  const vehicleKmMap: Record<string, { label: string; km: number; trips: number }> = {};
  for (const u of periodUsages ?? []) {
    if (!u.vehicle) continue;
    const key = u.vehicleId as string;
    if (!vehicleKmMap[key]) {
      vehicleKmMap[key] = { label: `${u.vehicle.plate}`, km: 0, trips: 0 };
    }
    vehicleKmMap[key].km += u.kmDriven ?? 0;
    vehicleKmMap[key].trips += u.status === "concluido" ? 1 : 0;
  }
  const chartData = Object.values(vehicleKmMap)
    .sort((a, b) => b.km - a.km)
    .slice(0, 10);

  // ─── Vehicle usage history ────────────────────────────────────────────────
  // Sort by most recent departure
  const recentUsages = [...(periodUsages ?? [])]
    .sort((a, b) => b.departureDate.localeCompare(a.departureDate))
    .slice(0, 20);

  const isLoading = allVehicles === undefined || periodUsages === undefined;

  return (
    <div className="flex flex-col h-full overflow-auto pb-8">
      {/* Header */}
      <div className="px-6 py-5 border-b flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Frota</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Visão geral da frota e histórico de uso</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44">
            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* KPI grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={Truck} label="Total Veículos" value={totalVehicles} iconClass="bg-muted text-foreground" />
              <KpiCard icon={CheckCircle2} label="Disponíveis" value={disponivel} iconClass="bg-green-500/15 text-green-400 dark:bg-green-900 dark:text-green-300" />
              <KpiCard icon={Navigation} label="Em Uso" value={emUso} iconClass="bg-blue-500/15 text-blue-400 dark:bg-blue-900 dark:text-blue-300" />
              <KpiCard icon={Wrench} label="Manutenção" value={manutencao} iconClass="bg-yellow-500/15 text-yellow-400 dark:bg-yellow-900 dark:text-yellow-300" />
              <KpiCard icon={Route} label="KM no Período" value={`${kmTotal.toLocaleString("pt-BR")} km`} iconClass="bg-purple-500/15 text-purple-400 dark:bg-purple-900 dark:text-purple-300" />
              <KpiCard icon={TrendingUp} label="Viagens Concluídas" value={tripCount} iconClass="bg-indigo-500/15 text-indigo-400 dark:bg-indigo-900 dark:text-indigo-300" />
              <KpiCard icon={Fuel} label="Custo de Combustível" value={fuelTotal > 0 ? `R$ ${fuelTotal.toFixed(2)}` : "—"} iconClass="bg-orange-500/15 text-orange-400 dark:bg-orange-900 dark:text-orange-300" />
              <KpiCard icon={AlertTriangle} label="Avarias Registradas" value={pendingDamages.length} iconClass={pendingDamages.length > 0 ? "bg-red-500/15 text-red-400 dark:bg-red-900 dark:text-red-300" : "bg-muted text-muted-foreground"} />
            </div>

            {/* ─── KM por Veículo ─── */}
            {chartData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">KM por Veículo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${v.toLocaleString("pt-BR")}`} />
                      <Tooltip
                        formatter={(value: number) => [`${value.toLocaleString("pt-BR")} km`, "KM"]}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar dataKey="km" radius={[4, 4, 0, 0]}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} fillOpacity={i === 0 ? 1 : 0.5} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* ─── Avarias Pendentes ─── */}
            {pendingDamages.length > 0 && (
              <div>
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-red-400 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" /> Avarias Registradas
                </h2>
                <div className="space-y-2">
                  {pendingDamages.map((u) => (
                    <Card key={u._id} className="border-red-500/30 dark:border-red-900">
                      <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-start justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">
                              {u.vehicle?.plate ?? "—"} — {u.vehicle?.brand} {u.vehicle?.model}
                            </p>
                            <Badge className="bg-red-500/15 text-red-300 dark:bg-red-900 dark:text-red-200 text-xs">Avaria</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Motorista: <span className="text-foreground font-medium">{u.driverName}</span>
                            {" · "}{u.departureDate.split("-").reverse().join("/")}
                          </p>
                          <p className="text-sm text-red-400 dark:text-red-400 mt-1">⚠ {u.damages}</p>
                          {(u.damagePhotoIds?.length ?? 0) > 0 && (
                            <DamagePhotos storageIds={u.damagePhotoIds!} />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Veículos ─── */}
            <div>
              <h2 className="text-base font-semibold mb-3">Veículos da Frota</h2>
              {(allVehicles?.length ?? 0) === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Truck /></EmptyMedia>
                    <EmptyTitle>Nenhum veículo cadastrado</EmptyTitle>
                    <EmptyDescription>Vá para Controle de Frota para cadastrar veículos.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allVehicles?.map((vehicle) => {
                    const vehicleUsages = (periodUsages ?? []).filter((u) => u.vehicleId === vehicle._id);
                    const vehicleKm = vehicleUsages.reduce((s, u) => s + (u.kmDriven ?? 0), 0);
                    const vehicleTrips = vehicleUsages.filter((u) => u.status === "concluido").length;
                    const hasAvaria = (allUsages ?? []).some(
                      (u) => u.vehicleId === vehicle._id && u.damages && u.damages.trim().length > 0
                    );

                    return (
                      <Card key={vehicle._id} className={cn("transition-shadow hover:shadow-md", hasAvaria && "border-red-500/30 dark:border-red-900")}>
                        <CardContent className="py-4 px-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                <VehicleIcon type={vehicle.type} />
                              </div>
                              <div>
                                <p className="font-bold">{vehicle.plate}</p>
                                <p className="text-xs text-muted-foreground">{TYPE_LABELS[vehicle.type]}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge className={STATUS_COLORS[vehicle.status]}>
                                {STATUS_LABELS[vehicle.status]}
                              </Badge>
                              {hasAvaria && (
                                <Badge className="bg-red-500/15 text-red-300 dark:bg-red-900 dark:text-red-200 text-xs">
                                  <AlertTriangle className="w-2.5 h-2.5 mr-1" />Avaria
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm font-medium">{vehicle.brand} {vehicle.model}{vehicle.year ? ` (${vehicle.year})` : ""}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {vehicle.currentKm !== undefined && (
                              <span className="flex items-center gap-1">
                                <Navigation className="w-3 h-3" /> {vehicle.currentKm.toLocaleString("pt-BR")} km odômetro
                              </span>
                            )}
                          </div>
                          {/* Period stats */}
                          <div className="flex gap-4 pt-1 border-t mt-1 text-xs">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Route className="w-3.5 h-3.5" />
                              <span className="font-medium text-foreground">{vehicleKm.toLocaleString("pt-BR")} km</span>
                              &nbsp;no período
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span className="font-medium text-foreground">{vehicleTrips}</span>
                              &nbsp;viagens
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── Histórico de Uso ─── */}
            <div>
              <h2 className="text-base font-semibold mb-3">Histórico de Uso no Período</h2>
              {recentUsages.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Route /></EmptyMedia>
                    <EmptyTitle>Nenhum registro no período</EmptyTitle>
                    <EmptyDescription>Selecione um período maior ou registre saídas de veículos.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-2">
                  {recentUsages.map((usage) => {
                    const hasAvaria = usage.damages && usage.damages.trim().length > 0;
                    return (
                      <Card key={usage._id} className={cn("border", hasAvaria && "border-red-500/30 dark:border-red-900")}>
                        <CardContent className="py-3 px-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-sm">
                                  {usage.vehicle?.plate ?? "—"} — {usage.vehicle?.brand} {usage.vehicle?.model}
                                </p>
                                {usage.status === "aberto"
                                  ? <Badge className="bg-blue-500/15 text-blue-300 dark:bg-blue-900 dark:text-blue-200 text-xs">Em Aberto</Badge>
                                  : <Badge variant="secondary" className="text-xs">Concluído</Badge>}
                                {hasAvaria && (
                                  <Badge className="bg-red-500/15 text-red-300 dark:bg-red-900 dark:text-red-200 text-xs">
                                    <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />Avaria
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Motorista: <span className="text-foreground font-medium">{usage.driverName}</span>
                                {usage.destination && <> · {usage.destination}</>}
                              </p>
                              <div className="flex flex-wrap gap-x-4 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <LogOut className="w-3 h-3" />
                                  {usage.departureDate.split("-").reverse().join("/")} {usage.departureTime}
                                </span>
                                {usage.arrivalDate && (
                                  <span className="flex items-center gap-1">
                                    <LogIn className="w-3 h-3" />
                                    {usage.arrivalDate.split("-").reverse().join("/")} {usage.arrivalTime}
                                  </span>
                                )}
                                {usage.kmDriven !== undefined && (
                                  <span className="flex items-center gap-1 text-green-400 dark:text-green-400 font-semibold">
                                    <Route className="w-3 h-3" />
                                    {usage.kmDriven.toLocaleString("pt-BR")} km
                                  </span>
                                )}
                                {usage.fuelCost !== undefined && (
                                  <span className="flex items-center gap-1">
                                    <Fuel className="w-3 h-3" />
                                    R$ {usage.fuelCost.toFixed(2)}
                                  </span>
                                )}
                              </div>
                              {hasAvaria && (
                                <p className="text-xs text-red-400 dark:text-red-400 mt-1">⚠ {usage.damages}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function FrotaDashboardPage() {
  return (
    <Authenticated>
      <DashboardInner />
    </Authenticated>
  );
}
