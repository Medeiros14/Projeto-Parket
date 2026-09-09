import { supabase, fromRows, check, fail, toRow, currentUserId, nextNumber, type Row } from "./helpers";

const FRETES = "expedicao_fretes";
const MOTORISTAS = "expedicao_motoristas";

async function requireUser() {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
}

// ── Fretes ───────────────────────────────────────────────────────────────────
export const list = async () => {
  const { data, error } = await supabase
    .from(FRETES)
    .select("*")
    .order("created_at", { ascending: false });
  check(data, error);
  return fromRows(data ?? []);
};

export const create = async (args: Row) => {
  await requireUser();
  const numero = await nextNumber(FRETES, "numero", "FR");
  const { data, error } = await supabase
    .from(FRETES)
    .insert({ ...toRow(args), numero })
    .select("id, numero")
    .single();
  check(data, error);
  return data;
};

export const update = async ({ id, ...rest }: Row & { id: string }) => {
  await requireUser();
  const { error } = await supabase.from(FRETES).update(toRow(rest)).eq("id", id);
  check(null, error);
};

export const remove = async (args: { id: string }) => {
  await requireUser();
  const { error } = await supabase.from(FRETES).delete().eq("id", args.id);
  check(null, error);
};

// ── Motoristas ───────────────────────────────────────────────────────────────
export const listMotoristas = async () => {
  const { data, error } = await supabase
    .from(MOTORISTAS)
    .select("*")
    .order("nome", { ascending: true });
  check(data, error);
  return fromRows(data ?? []);
};

export const createMotorista = async (args: Row) => {
  await requireUser();
  const { error } = await supabase.from(MOTORISTAS).insert(toRow(args));
  check(null, error);
};

export const updateMotorista = async ({ id, ...rest }: Row & { id: string }) => {
  await requireUser();
  const { error } = await supabase.from(MOTORISTAS).update(toRow(rest)).eq("id", id);
  check(null, error);
};

export const removeMotorista = async (args: { id: string }) => {
  await requireUser();
  const { error } = await supabase.from(MOTORISTAS).delete().eq("id", args.id);
  check(null, error);
};
