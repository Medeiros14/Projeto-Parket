import { supabase, fromRow, fromRows, toRow, check, fail, currentUserId, generateUploadUrl as genUrl, type Row } from "./helpers";

const TV = "expedicao_veiculos";
const TU = "expedicao_veiculo_usos";

// ─── Vehicles ──────────────────────────────────────────────────────────────

export const listVehicles = async (args: { status?: string; type?: string } = {}) => {
  let q = supabase.from(TV).select("*").eq("active", true).order("created_at", { ascending: true });
  if (args.status) q = q.eq("status", args.status);
  if (args.type) q = q.eq("type", args.type);
  const { data, error } = await q;
  check(data, error);
  return fromRows(data ?? []);
};

export const getVehicle = async (args: { id: string }) => {
  const { data, error } = await supabase.from(TV).select("*").eq("id", args.id).maybeSingle();
  check(data, error);
  return data ? fromRow(data) : null;
};

export const createVehicle = async (args: {
  plate: string;
  model: string;
  brand: string;
  year?: number;
  type: string;
  color?: string;
  currentKm?: number;
  notes?: string;
}) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const plate = args.plate.toUpperCase();
  const { data: existing, error: ee } = await supabase
    .from(TV)
    .select("id")
    .eq("plate", plate)
    .eq("active", true)
    .limit(1);
  check(existing, ee);
  if ((existing ?? []).length > 0) fail("Placa já cadastrada");
  const { data, error } = await supabase
    .from(TV)
    .insert({ ...toRow(args as unknown as Row), plate, status: "disponivel", active: true, created_by: uid })
    .select("id")
    .single();
  return check(data, error)?.id;
};

export const updateVehicle = async (args: Row) => {
  const { id, ...fields } = args as { id: string } & Row;
  const patch = toRow(fields);
  if (patch.plate) patch.plate = (patch.plate as string).toUpperCase();
  const { error } = await supabase.from(TV).update(patch).eq("id", id);
  check(null, error);
};

export const deleteVehicle = async (args: { id: string }) => {
  const { error } = await supabase.from(TV).update({ active: false }).eq("id", args.id);
  check(null, error);
};

// ─── Vehicle Usage ──────────────────────────────────────────────────────────

// damage_photo_urls (jsonb de URLs) exposto como damagePhotoIds — no shim storageId JÁ é a URL
export function usageOut(r: Row): Row {
  return { ...fromRow(r), damagePhotoIds: (r.damage_photo_urls as string[] | null) ?? undefined };
}

export async function vehicleMap(ids: string[]): Promise<Map<string, Row>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const { data, error } = await supabase.from(TV).select("*").in("id", uniq);
  check(data, error);
  return new Map((data ?? []).map((v: Row) => [v.id as string, v]));
}

export const listUsage = async (
  args: { vehicleId?: string; status?: string; driverName?: string; dateFrom?: string; dateTo?: string } = {}
) => {
  let q = supabase.from(TU).select("*").order("created_at", { ascending: false });
  if (args.vehicleId) q = q.eq("vehicle_id", args.vehicleId);
  if (args.status) q = q.eq("status", args.status);
  if (args.driverName) q = q.ilike("driver_name", `%${args.driverName}%`);
  if (args.dateFrom) q = q.gte("departure_date", args.dateFrom);
  if (args.dateTo) q = q.lte("departure_date", args.dateTo);
  const { data, error } = await q;
  check(data, error);
  const rows = data ?? [];
  const vm = await vehicleMap(rows.map((r: Row) => r.vehicle_id as string));
  return rows.map((r: Row) => {
    const v = vm.get(r.vehicle_id as string);
    return { ...usageOut(r), vehicle: v ? fromRow(v) : null };
  });
};

export const getUsage = async (args: { id: string }) => {
  const { data: usage, error } = await supabase.from(TU).select("*").eq("id", args.id).maybeSingle();
  check(usage, error);
  if (!usage) return null;
  const { data: vehicle, error: ve } = await supabase.from(TV).select("*").eq("id", usage.vehicle_id).maybeSingle();
  check(vehicle, ve);
  return { ...usageOut(usage), vehicle: vehicle ? fromRow(vehicle) : null };
};

export const createUsage = async (args: {
  vehicleId: string;
  driverName: string;
  destination?: string;
  purpose?: string;
  departureDate: string;
  departureTime: string;
  kmDeparture: number;
  notes?: string;
}) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { error: ve } = await supabase.from(TV).update({ status: "em_uso" }).eq("id", args.vehicleId);
  check(null, ve);
  const { data, error } = await supabase
    .from(TU)
    .insert({ ...toRow(args as unknown as Row), status: "aberto", created_by: uid })
    .select("id")
    .single();
  return check(data, error)?.id;
};

export const generateUploadUrl = genUrl;

// storageIds no shim já são as URLs públicas finais
export const getUsagePhotoUrls = async (args: { storageIds: string[] }) => {
  return args.storageIds.filter((u): u is string => !!u);
};

export const closeUsage = async (args: {
  id: string;
  arrivalDate: string;
  arrivalTime: string;
  kmArrival: number;
  fuelCost?: number;
  damages?: string;
  damagePhotoIds?: string[];
  notes?: string;
}) => {
  const { data: usage, error } = await supabase.from(TU).select("*").eq("id", args.id).maybeSingle();
  check(usage, error);
  if (!usage) fail("Registro não encontrado");
  const kmDriven = args.kmArrival - Number(usage!.km_departure);
  const patch: Row = {
    arrival_date: args.arrivalDate,
    arrival_time: args.arrivalTime,
    km_arrival: args.kmArrival,
    km_driven: kmDriven,
    status: "concluido",
  };
  if (args.fuelCost !== undefined) patch.fuel_cost = args.fuelCost;
  if (args.damages !== undefined) patch.damages = args.damages;
  if (args.damagePhotoIds !== undefined) patch.damage_photo_urls = args.damagePhotoIds;
  if (args.notes !== undefined) patch.notes = args.notes;
  const { error: ue } = await supabase.from(TU).update(patch).eq("id", args.id);
  check(null, ue);
  const { error: ve } = await supabase
    .from(TV)
    .update({ current_km: args.kmArrival, status: "disponivel" })
    .eq("id", usage!.vehicle_id);
  check(null, ve);
};

export const updateUsage = async (args: Row) => {
  const { id, ...fields } = args as { id: string } & Row;
  const { error } = await supabase.from(TU).update(toRow(fields)).eq("id", id);
  check(null, error);
};

export const deleteUsage = async (args: { id: string }) => {
  const { error } = await supabase.from(TU).delete().eq("id", args.id);
  check(null, error);
};
