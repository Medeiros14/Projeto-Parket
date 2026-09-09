import { supabase, fromRow, toRow, check, fail, currentUserId, nextNumber, paginate, type Row, type PaginationOpts } from "./helpers";

const T = "expedicao_transportes";

export const getNextTransportNumber = async () => nextNumber(T, "transport_number", "TRF");

async function clientMap(ids: string[]): Promise<Map<string, Row>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const { data, error } = await supabase
    .from("expedicao_clientes")
    .select("id,name,phone,city,document")
    .in("id", uniq);
  check(data, error);
  return new Map((data ?? []).map((c: Row) => [c.id as string, c]));
}

export const listTransports = async (args: { paginationOpts: PaginationOpts; status?: string }) => {
  const n = args.paginationOpts.numItems;
  let q = supabase.from(T).select("*", { count: "exact" }).order("created_at", { ascending: false }).range(0, n - 1);
  if (args.status) q = q.eq("status", args.status);
  const { data, error, count } = await q;
  check(data, error);
  const rows = data ?? [];
  const cm = await clientMap([
    ...rows.map((t: Row) => t.client_id as string),
    ...rows.map((t: Row) => t.destination_client_id as string),
  ]);
  const page = rows.map((t: Row) => {
    const client = cm.get(t.client_id as string);
    const dest = t.destination_client_id ? cm.get(t.destination_client_id as string) : undefined;
    return {
      ...fromRow(t),
      clientName: client?.name ?? "—",
      clientPhone: client?.phone ?? undefined,
      clientCity: client?.city ?? undefined,
      clientDocument: client?.document ?? undefined,
      destinationClientName: dest?.name ?? undefined,
      destinationClientCity: dest?.city ?? undefined,
    };
  });
  return paginate(page, count, n);
};

export const getTransport = async (args: { id: string }) => {
  const { data: t, error } = await supabase.from(T).select("*").eq("id", args.id).maybeSingle();
  check(t, error);
  if (!t) return null;
  const { data: client, error: ce } = await supabase
    .from("expedicao_clientes")
    .select("*")
    .eq("id", t.client_id)
    .maybeSingle();
  check(client, ce);
  return { ...fromRow(t), client: client ? fromRow(client) : null };
};

export const createTransport = async (args: {
  transportNumber: string;
  clientId: string;
  direction: string;
  destinationClientId?: string;
  freightType: string;
  freightValue?: number;
  pickupAddress?: string;
  deliveryAddress?: string;
  scheduledDate?: string;
  notes?: string;
  tools: Array<{ name: string; quantity: number; notes?: string }>;
}) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { tools, ...rest } = args;
  const { data, error } = await supabase
    .from(T)
    .insert({ ...toRow(rest as unknown as Row), tools, status: "pendente", created_by: uid })
    .select("id")
    .single();
  return check(data, error)?.id;
};

export const updateTransportStatus = async (args: { id: string; status: string }) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const patch: Row = { status: args.status, updated_by: uid, updated_at: new Date().toISOString() };
  if (args.status === "entregue") patch.delivered_at = new Date().toISOString();
  const { error } = await supabase.from(T).update(patch).eq("id", args.id);
  check(null, error);
};

export const deleteTransport = async (args: { id: string }) => {
  const { error } = await supabase.from(T).delete().eq("id", args.id);
  check(null, error);
};
