import { supabase, fromRow, fromRows, toRow, check, fail, currentUserId, generateUploadUrl as genUrl, type Row } from "./helpers";
import { closeUsage, usageOut } from "./fleet";

const TV = "expedicao_veiculos";
const TU = "expedicao_veiculo_usos";

// Versões sem auth — portal do motorista

export const listVehiclesPublic = async () => {
  const { data, error } = await supabase
    .from(TV)
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true });
  check(data, error);
  return fromRows(data ?? []);
};

export const getOpenUsageForVehicle = async (args: { vehicleId: string }) => {
  const { data, error } = await supabase
    .from(TU)
    .select("*")
    .eq("vehicle_id", args.vehicleId)
    .eq("status", "aberto")
    .order("created_at", { ascending: false })
    .limit(1);
  check(data, error);
  const usage = (data ?? [])[0] as Row | undefined;
  if (!usage) return null;
  const { data: vehicle, error: ve } = await supabase.from(TV).select("*").eq("id", usage.vehicle_id).maybeSingle();
  check(vehicle, ve);
  return { ...usageOut(usage), vehicle: vehicle ? fromRow(vehicle) : null };
};

export const generateUploadUrlPublic = genUrl;

export const createUsagePublic = async (args: {
  vehicleId: string;
  driverName: string;
  destination?: string;
  purpose?: string;
  departureDate: string;
  departureTime: string;
  kmDeparture: number;
  notes?: string;
}) => {
  const { data: vehicle, error } = await supabase.from(TV).select("*").eq("id", args.vehicleId).maybeSingle();
  check(vehicle, error);
  if (!vehicle) fail("Veículo não encontrado");
  if (vehicle!.status === "em_uso") fail("Veículo já está em uso");

  const uid = await currentUserId();
  const { error: ve } = await supabase.from(TV).update({ status: "em_uso" }).eq("id", args.vehicleId);
  check(null, ve);
  const { data, error: ie } = await supabase
    .from(TU)
    .insert({ ...toRow(args as unknown as Row), status: "aberto", created_by: uid ?? null })
    .select("id")
    .single();
  return check(data, ie)?.id;
};

// Mesma lógica do closeUsage (no original também não exigia auth)
export const closeUsagePublic = closeUsage;
