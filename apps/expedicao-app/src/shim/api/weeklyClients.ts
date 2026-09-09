import { supabase, fromRows, check, fail, currentUserId } from "./helpers";

const T = "expedicao_cliente_semana";

export const listByWeek = async (args: { weekLabel: string }) => {
  const { data, error } = await supabase
    .from(T)
    .select("*")
    .eq("week_label", args.weekLabel)
    .order("created_at", { ascending: true });
  check(data, error);
  return fromRows(data ?? []);
};

// Labels distintas, mais recente primeiro (dedupe client-side)
export const listWeeks = async () => {
  const { data, error } = await supabase.from(T).select("week_label");
  check(data, error);
  return [...new Set((data ?? []).map((r) => r.week_label as string))].sort().reverse();
};

// Substitui a semana inteira (delete + insert)
export const bulkImport = async (args: {
  weekLabel: string;
  rows: Array<{ clientCode: string; clientName: string; os: string }>;
}) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");

  const { error: de } = await supabase.from(T).delete().eq("week_label", args.weekLabel);
  check(null, de);

  if (args.rows.length > 0) {
    // Chaves uniformes em todas as rows (bulk insert PostgREST)
    const rows = args.rows.map((r) => ({
      week_label: args.weekLabel,
      client_code: r.clientCode,
      client_name: r.clientName,
      os: r.os,
      material: null,
      created_by: uid,
    }));
    const { error: ie } = await supabase.from(T).insert(rows);
    check(null, ie);
  }
  return args.rows.length;
};

export const updateMaterial = async (args: { id: string; material?: string }) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { error } = await supabase.from(T).update({ material: args.material ?? null }).eq("id", args.id);
  check(null, error);
};

export const deleteRow = async (args: { id: string }) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { error } = await supabase.from(T).delete().eq("id", args.id);
  check(null, error);
};
