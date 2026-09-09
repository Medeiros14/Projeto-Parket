import { supabase, fromRow, toRow, check, fail, currentUserId, generateUploadUrl as genUrl, type Row } from "./helpers";
import { usageOut, vehicleMap } from "./fleet";

const T = "expedicao_veiculo_manutencoes";
const TV = "expedicao_veiculos";
const TU = "expedicao_veiculo_usos";

// photo_urls/budget_photo_url (URLs) expostos também como photoIds/budgetPhotoId (compat Convex)
function maintenanceOut(r: Row): Row {
  return {
    ...fromRow(r),
    photoIds: (r.photo_urls as string[] | null) ?? undefined,
    budgetPhotoId: (r.budget_photo_url as string | null) ?? undefined,
    budgetPhotoUrl: (r.budget_photo_url as string | null) ?? null,
  };
}

async function restoreVehicleIfNoOpen(vehicleId: string, excludeId: string) {
  const { data, error } = await supabase
    .from(T)
    .select("id")
    .eq("vehicle_id", vehicleId)
    .in("status", ["pendente", "em_andamento"])
    .neq("id", excludeId);
  check(data, error);
  if ((data ?? []).length === 0) {
    const { error: ve } = await supabase.from(TV).update({ status: "disponivel" }).eq("id", vehicleId);
    check(null, ve);
  }
}

export const listMaintenance = async (args: { vehicleId?: string; status?: string } = {}) => {
  let q = supabase.from(T).select("*").order("created_at", { ascending: false });
  if (args.vehicleId) q = q.eq("vehicle_id", args.vehicleId);
  if (args.status) q = q.eq("status", args.status);
  const { data, error } = await q;
  check(data, error);
  const rows = data ?? [];
  const usageIds = [...new Set(rows.map((r: Row) => r.usage_id as string).filter(Boolean))];
  const [vm, usagesRes] = await Promise.all([
    vehicleMap(rows.map((r: Row) => r.vehicle_id as string)),
    usageIds.length
      ? supabase.from(TU).select("*").in("id", usageIds)
      : Promise.resolve({ data: [] as Row[], error: null }),
  ]);
  const usages = new Map<string, Row>(
    (check(usagesRes.data, usagesRes.error) ?? []).map((u: Row) => [u.id as string, u])
  );
  return rows.map((r: Row) => {
    const v = vm.get(r.vehicle_id as string);
    const u = r.usage_id ? usages.get(r.usage_id as string) : undefined;
    return {
      ...maintenanceOut(r),
      vehicle: v ? fromRow(v) : null,
      linkedUsage: u ? usageOut(u) : null,
    };
  });
};

export const getMaintenance = async (args: { id: string }) => {
  const { data: record, error } = await supabase.from(T).select("*").eq("id", args.id).maybeSingle();
  check(record, error);
  if (!record) return null;
  const [vehicleRes, usageRes] = await Promise.all([
    supabase.from(TV).select("*").eq("id", record.vehicle_id).maybeSingle(),
    record.usage_id
      ? supabase.from(TU).select("*").eq("id", record.usage_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const vehicle = check(vehicleRes.data, vehicleRes.error);
  const usage = check(usageRes.data, usageRes.error);
  return {
    ...maintenanceOut(record),
    vehicle: vehicle ? fromRow(vehicle) : null,
    linkedUsage: usage ? usageOut(usage) : null,
  };
};

export const listUsageWithDamages = async (args: { vehicleId?: string } = {}) => {
  let q = supabase.from(TU).select("*");
  if (args.vehicleId) q = q.eq("vehicle_id", args.vehicleId);
  const { data, error } = await q;
  check(data, error);
  const rows = (data ?? []).filter((r: Row) => r.damages && (r.damages as string).trim().length > 0);
  const vm = await vehicleMap(rows.map((r: Row) => r.vehicle_id as string));
  const enriched = rows.map((r: Row) => {
    const v = vm.get(r.vehicle_id as string);
    return { ...usageOut(r), vehicle: v ? fromRow(v) : null };
  });
  return enriched.sort((a, b) => (b.departureDate as string).localeCompare(a.departureDate as string));
};

export const createMaintenance = async (args: {
  vehicleId: string;
  type: string;
  description: string;
  workshop?: string;
  cost?: number;
  date: string;
  status: string;
  usageId?: string;
  notes?: string;
  photoIds?: string[];
  budgetPhotoId?: string;
  budgetValue?: number;
}) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { photoIds, budgetPhotoId, ...rest } = args;
  const row: Row = { ...toRow(rest as unknown as Row), created_by: uid };
  if (photoIds !== undefined) row.photo_urls = photoIds;
  if (budgetPhotoId !== undefined) row.budget_photo_url = budgetPhotoId;
  const { data, error } = await supabase.from(T).insert(row).select("id").single();
  check(data, error);
  if (args.status !== "concluida") {
    const { error: ve } = await supabase.from(TV).update({ status: "manutencao" }).eq("id", args.vehicleId);
    check(null, ve);
  }
  return data!.id;
};

export const updateMaintenance = async (args: Row) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { id, photoIds, budgetPhotoId, ...fields } = args as {
    id: string;
    photoIds?: string[];
    budgetPhotoId?: string;
  } & Row;
  const { data: record, error } = await supabase.from(T).select("*").eq("id", id).maybeSingle();
  check(record, error);
  if (!record) fail("Registro não encontrado");

  const updates = toRow(fields);
  if (photoIds !== undefined) updates.photo_urls = photoIds;
  if (budgetPhotoId !== undefined) updates.budget_photo_url = budgetPhotoId;

  if (fields.status === "concluida") {
    if (!fields.resolvedAt) updates.resolved_at = new Date().toISOString().split("T")[0];
    await restoreVehicleIfNoOpen(record!.vehicle_id as string, id);
  }

  const { error: ue } = await supabase.from(T).update(updates).eq("id", id);
  check(null, ue);
};

export const deleteMaintenance = async (args: { id: string }) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { error } = await supabase.from(T).delete().eq("id", args.id);
  check(null, error);
};

export const concludeMaintenance = async (args: { id: string }) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { data: record, error } = await supabase.from(T).select("*").eq("id", args.id).maybeSingle();
  check(record, error);
  if (!record) fail("Registro não encontrado");

  const { error: ue } = await supabase
    .from(T)
    .update({ status: "concluida", resolved_at: new Date().toISOString().split("T")[0] })
    .eq("id", args.id);
  check(null, ue);

  await restoreVehicleIfNoOpen(record!.vehicle_id as string, args.id);
};

export const generateUploadUrl = genUrl;
