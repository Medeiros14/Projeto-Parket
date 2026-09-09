import { supabase, fromRows, check, fail, toRow, currentUserId, type Row } from "./helpers";

const DIA = "expedicao_agenda_dia";
const SEMANA = "expedicao_agenda_semana";
const PEND = "expedicao_agenda_pendentes";

async function requireUser() {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
}

// ── Entregas do dia ──────────────────────────────────────────────────────────
export const listByDate = async (args: { data: string }) => {
  const { data, error } = await supabase
    .from(DIA)
    .select("*")
    .eq("data", args.data)
    .order("created_at", { ascending: true });
  check(data, error);
  return fromRows(data ?? []);
};

export const createDia = async (args: Row) => {
  await requireUser();
  const { error } = await supabase.from(DIA).insert(toRow(args));
  check(null, error);
};

export const updateDia = async ({ id, ...rest }: Row & { id: string }) => {
  await requireUser();
  const { error } = await supabase.from(DIA).update(toRow(rest)).eq("id", id);
  check(null, error);
};

export const removeDia = async (args: { id: string }) => {
  await requireUser();
  const { error } = await supabase.from(DIA).delete().eq("id", args.id);
  check(null, error);
};

// ── Agenda semanal ───────────────────────────────────────────────────────────
export const listByWeek = async (args: { startDate: string; endDate: string }) => {
  const { data, error } = await supabase
    .from(SEMANA)
    .select("*")
    .gte("data", args.startDate)
    .lte("data", args.endDate)
    .order("data", { ascending: true })
    .order("created_at", { ascending: true });
  check(data, error);
  return fromRows(data ?? []);
};

export const createSemana = async (args: Row) => {
  await requireUser();
  const { error } = await supabase.from(SEMANA).insert(toRow(args));
  check(null, error);
};

export const updateSemana = async ({ id, ...rest }: Row & { id: string }) => {
  await requireUser();
  const { error } = await supabase.from(SEMANA).update(toRow(rest)).eq("id", id);
  check(null, error);
};

export const removeSemana = async (args: { id: string }) => {
  await requireUser();
  const { error } = await supabase.from(SEMANA).delete().eq("id", args.id);
  check(null, error);
};

// ── Tentativas de entrega pendentes (por origem) ─────────────────────────────
export const listPendentes = async () => {
  const { data, error } = await supabase
    .from(PEND)
    .select("*")
    .order("created_at", { ascending: true });
  check(data, error);
  return fromRows(data ?? []);
};

export const createPendente = async (args: Row) => {
  await requireUser();
  const { error } = await supabase.from(PEND).insert(toRow(args));
  check(null, error);
};

export const updatePendente = async ({ id, ...rest }: Row & { id: string }) => {
  await requireUser();
  const { error } = await supabase.from(PEND).update(toRow(rest)).eq("id", id);
  check(null, error);
};

export const removePendente = async (args: { id: string }) => {
  await requireUser();
  const { error } = await supabase.from(PEND).delete().eq("id", args.id);
  check(null, error);
};
