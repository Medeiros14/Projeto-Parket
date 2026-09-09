import { supabase, fromRow, check, fail, currentUserId, paginate, type Row, type PaginationOpts } from "./helpers";
import { currentUserName } from "../auth-store";

const T = "expedicao_movimentacoes";

// Núcleo compartilhado (pedidos/inventário/movimentação manual)
export async function createMovementRaw(args: {
  productId: string;
  type: string;
  delta: number;
  reason?: string;
  notes?: string;
  orderId?: string;
  clientId?: string;
  allowNegative?: boolean;
}) {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { data: product, error } = await supabase
    .from("expedicao_produtos")
    .select("current_stock")
    .eq("id", args.productId)
    .maybeSingle();
  check(product, error);
  if (!product) fail("Produto não encontrado");

  const quantityBefore = Number(product.current_stock);
  const quantityAfter = quantityBefore + args.delta;
  if (quantityAfter < 0 && !args.allowNegative) fail("Estoque insuficiente para esta saída");

  const { error: pe } = await supabase
    .from("expedicao_produtos")
    .update({ current_stock: quantityAfter, updated_at: new Date().toISOString() })
    .eq("id", args.productId);
  check(null, pe);

  const { data: mov, error: me } = await supabase
    .from(T)
    .insert({
      product_id: args.productId,
      type: args.type,
      quantity: args.delta,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      order_id: args.orderId ?? null,
      client_id: args.clientId ?? null,
      reason: args.reason ?? null,
      notes: args.notes ?? null,
      created_by: uid,
      created_by_name: await currentUserName(),
    })
    .select("id")
    .single();
  return check(mov, me)?.id;
}

async function enrichMovements(rows: Row[]): Promise<Row[]> {
  const prodIds = [...new Set(rows.map((m) => m.product_id as string))];
  const clientIds = [...new Set(rows.map((m) => m.client_id as string).filter(Boolean))];
  const [prodsRes, clientsRes] = await Promise.all([
    prodIds.length
      ? supabase.from("expedicao_produtos").select("id,name,code,unit").in("id", prodIds)
      : Promise.resolve({ data: [], error: null }),
    clientIds.length
      ? supabase.from("expedicao_clientes").select("id,name").in("id", clientIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const prods = new Map((check(prodsRes.data, prodsRes.error) ?? []).map((p: Row) => [p.id, p]));
  const clients = new Map((check(clientsRes.data, clientsRes.error) ?? []).map((c: Row) => [c.id, c]));
  return rows.map((m) => {
    const p = prods.get(m.product_id) as Row | undefined;
    const c = m.client_id ? (clients.get(m.client_id) as Row | undefined) : undefined;
    return {
      ...fromRow(m),
      productName: p?.name ?? "—",
      productCode: p?.code ?? "—",
      productUnit: p?.unit ?? "un",
      userName: (m.created_by_name as string) ?? "—",
      clientName: c?.name ?? null,
    };
  });
}

export const listMovements = async (args: { paginationOpts: PaginationOpts; productId?: string; type?: string }) => {
  const n = args.paginationOpts.numItems;
  let q = supabase.from(T).select("*", { count: "exact" }).order("created_at", { ascending: false }).range(0, n - 1);
  if (args.productId) q = q.eq("product_id", args.productId);
  else if (args.type) q = q.eq("type", args.type);
  const { data, error, count } = await q;
  check(data, error);
  return paginate(await enrichMovements(data ?? []), count, n);
};

export const listMovementsByDate = async (args: { dateStart: number; dateEnd: number; type?: string }) => {
  let q = supabase
    .from(T)
    .select("*")
    .gte("created_at", new Date(args.dateStart).toISOString())
    .lte("created_at", new Date(args.dateEnd).toISOString())
    .order("created_at", { ascending: false });
  if (args.type) q = q.eq("type", args.type);
  const { data, error } = await q;
  check(data, error);
  return enrichMovements(data ?? []);
};

export const createMovement = async (args: {
  productId: string;
  type: "entrada" | "saida" | "ajuste" | "inventario" | "transferencia";
  quantity: number;
  reason?: string;
  notes?: string;
  orderId?: string;
  clientId?: string;
}) => {
  const { data: product, error } = await supabase
    .from("expedicao_produtos")
    .select("current_stock")
    .eq("id", args.productId)
    .maybeSingle();
  check(product, error);
  if (!product) fail("Produto não encontrado");
  const before = Number(product.current_stock);

  let delta: number;
  if (args.type === "saida") delta = -Math.abs(args.quantity);
  else if (args.type === "entrada" || args.type === "transferencia") delta = Math.abs(args.quantity);
  else delta = args.quantity - before; // ajuste/inventario: quantity é o valor absoluto novo

  return createMovementRaw({
    productId: args.productId,
    type: args.type,
    delta,
    reason: args.reason,
    notes: args.notes,
    orderId: args.orderId,
    clientId: args.clientId,
  });
};
