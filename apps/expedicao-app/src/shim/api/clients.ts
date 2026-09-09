import { supabase, fromRow, fromRows, toRow, check, fail, currentUserId, type Row } from "./helpers";

const T = "expedicao_clientes";

export const listClients = async (args: { includeInactive?: boolean } = {}) => {
  let q = supabase.from(T).select("*").order("name");
  if (!args.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  return fromRows(check(data, error));
};

export const getClient = async (args: { id: string }) => {
  const { data, error } = await supabase.from(T).select("*").eq("id", args.id).maybeSingle();
  check(data, error);
  return data ? fromRow(data) : null;
};

export const createClient = async (args: Row) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { data, error } = await supabase
    .from(T)
    .insert({ ...toRow(args), active: true, created_by: uid })
    .select("id")
    .single();
  return check(data, error)?.id;
};

export const updateClient = async (args: Row) => {
  const { id, ...rest } = args as { id: string } & Row;
  const { error } = await supabase
    .from(T)
    .update({ ...toRow(rest), updated_at: new Date().toISOString() })
    .eq("id", id);
  check(null, error);
};
