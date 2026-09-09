import { supabase, fromRow, fromRows, toRow, check, fail, currentUserId, nextNumber, paginate, type Row, type PaginationOpts } from "./helpers";
import { createMovementRaw } from "./stockMovements";

const T = "expedicao_pedidos";
const TI = "expedicao_pedido_itens";
const TF = "expedicao_pedido_fotos";
const TA = "expedicao_assinaturas";

export const getNextOrderNumber = async () => nextNumber(T, "order_number", "PED");

interface ProductRow { id: string; name: string; code: string; unit: string; m2_per_box: number | null }

async function productMap(ids: string[]): Promise<Map<string, ProductRow>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from("expedicao_produtos").select("id,name,code,unit,m2_per_box").in("id", [...new Set(ids)]);
  check(data, error);
  return new Map((data ?? []).map((p) => [p.id, p as ProductRow]));
}

function enrichItem(item: Row, p?: ProductRow): Row {
  return {
    ...fromRow(item),
    productName: p?.name ?? "—",
    productCode: p?.code ?? "—",
    productUnit: p?.unit ?? "un",
    m2PerBox: p?.m2_per_box ?? undefined,
  };
}

async function enrichOrders(rows: Row[]): Promise<Row[]> {
  const ids = rows.map((o) => o.id as string);
  const clientIds = rows.map((o) => o.client_id as string).filter(Boolean);
  const [clientsRes, itemsRes] = await Promise.all([
    clientIds.length
      ? supabase.from("expedicao_clientes").select("id,name,phone,city").in("id", [...new Set(clientIds)])
      : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from(TI).select("id,order_id").in("order_id", ids) : Promise.resolve({ data: [], error: null }),
  ]);
  const clients = new Map((check(clientsRes.data, clientsRes.error) ?? []).map((c: Row) => [c.id, c]));
  const counts = new Map<string, number>();
  for (const it of check(itemsRes.data, itemsRes.error) ?? []) {
    const k = (it as Row).order_id as string;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return rows.map((o) => {
    const c = clients.get(o.client_id) as Row | undefined;
    return {
      ...fromRow(o),
      clientName: c?.name ?? "—",
      clientPhone: c?.phone ?? undefined,
      clientCity: c?.city ?? undefined,
      itemCount: counts.get(o.id as string) ?? 0,
    };
  });
}

export const listOrders = async (args: { paginationOpts: PaginationOpts; status?: string }) => {
  const n = args.paginationOpts.numItems;
  let q = supabase.from(T).select("*", { count: "exact" }).order("created_at", { ascending: false }).range(0, n - 1);
  if (args.status) q = q.eq("status", args.status);
  const { data, error, count } = await q;
  check(data, error);
  const page = await enrichOrders(data ?? []);
  return paginate(page, count, n);
};

export const getOrder = async (args: { id: string }) => {
  const { data: order, error } = await supabase.from(T).select("*").eq("id", args.id).maybeSingle();
  check(order, error);
  if (!order) return null;
  const [clientRes, itemsRes, photosRes] = await Promise.all([
    supabase.from("expedicao_clientes").select("*").eq("id", order.client_id).maybeSingle(),
    supabase.from(TI).select("*").eq("order_id", args.id).order("created_at"),
    supabase.from(TF).select("*").eq("order_id", args.id).order("created_at"),
  ]);
  const items = check(itemsRes.data, itemsRes.error) ?? [];
  const pm = await productMap(items.map((i: Row) => i.product_id as string));
  return {
    ...fromRow(order),
    client: clientRes.data ? fromRow(clientRes.data) : null,
    items: items.map((i: Row) => enrichItem(i, pm.get(i.product_id as string))),
    photos: fromRows(check(photosRes.data, photosRes.error)),
  };
};

export const createOrder = async (args: {
  clientId: string;
  orderNumber: string;
  freightType: string;
  freightValue?: number;
  notes?: string;
  deliveryAddress?: string;
  scheduledDate?: string;
  items: Array<{ productId: string; quantity: number; unitPrice?: number; notes?: string }>;
}) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { items, ...orderData } = args;
  const { data: order, error } = await supabase
    .from(T)
    .insert({ ...toRow(orderData), status: "confirmado", created_by: uid })
    .select("id")
    .single();
  check(order, error);
  const orderId = order!.id as string;

  for (const item of items) {
    const { error: ie } = await supabase.from(TI).insert({ order_id: orderId, ...toRow(item as unknown as Row) });
    check(null, ie);
    await createMovementRaw({
      productId: item.productId,
      type: "saida",
      delta: -Math.abs(item.quantity),
      reason: `Pedido ${args.orderNumber}`,
      orderId,
      allowNegative: true,
    });
  }
  return orderId;
};

export const updateOrderStatus = async (args: { id: string; status: string }) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { data: order, error } = await supabase.from(T).select("*").eq("id", args.id).maybeSingle();
  check(order, error);
  if (!order) fail("Pedido não encontrado");

  const patch: Row = { status: args.status, updated_by: uid, updated_at: new Date().toISOString() };
  if (args.status === "entregue") patch.delivered_at = new Date().toISOString();
  const { error: ue } = await supabase.from(T).update(patch).eq("id", args.id);
  check(null, ue);

  // Cancelamento devolve estoque (se o pedido já tinha descontado — status anterior ≠ rascunho)
  if (args.status === "cancelado" && order!.status !== "cancelado" && order!.status !== "rascunho") {
    const { data: items, error: ie } = await supabase.from(TI).select("*").eq("order_id", args.id);
    check(items, ie);
    for (const item of items ?? []) {
      await createMovementRaw({
        productId: item.product_id as string,
        type: "entrada",
        delta: Math.abs(item.quantity as number),
        reason: `Cancelamento do Pedido ${order!.order_number}`,
        orderId: args.id,
        allowNegative: true,
      });
    }
  }
};

export const updateOrder = async (args: Row) => {
  const { id, ...rest } = args as { id: string } & Row;
  const { error } = await supabase
    .from(T)
    .update({ ...toRow(rest), updated_at: new Date().toISOString() })
    .eq("id", id);
  check(null, error);
};

export const addOrderItem = async (args: Row) => {
  const { data, error } = await supabase.from(TI).insert(toRow(args)).select("id").single();
  return check(data, error)?.id;
};

export const removeOrderItem = async (args: { id: string }) => {
  const { error } = await supabase.from(TI).delete().eq("id", args.id);
  check(null, error);
};

export const getOrderPublic = async (args: { id: string }) => {
  const { data: order, error } = await supabase.from(T).select("*").eq("id", args.id).maybeSingle();
  check(order, error);
  if (!order) return null;
  const [clientRes, itemsRes, photosRes, sigRes] = await Promise.all([
    supabase.from("expedicao_clientes").select("name,city,phone").eq("id", order.client_id).maybeSingle(),
    supabase.from(TI).select("*").eq("order_id", args.id).order("created_at"),
    supabase.from(TF).select("*").eq("order_id", args.id).order("created_at"),
    supabase.from(TA).select("*").eq("order_id", args.id).limit(1),
  ]);
  const items = check(itemsRes.data, itemsRes.error) ?? [];
  const pm = await productMap(items.map((i: Row) => i.product_id as string));
  const sig = (check(sigRes.data, sigRes.error) ?? [])[0] as Row | undefined;
  return {
    orderNumber: order.order_number,
    status: order.status,
    freightType: order.freight_type,
    freightValue: order.freight_value ?? undefined,
    notes: order.notes ?? undefined,
    deliveryAddress: order.delivery_address ?? undefined,
    scheduledDate: order.scheduled_date ?? undefined,
    deliveredAt: order.delivered_at ?? undefined,
    creationTime: Date.parse(order.created_at),
    clientName: (clientRes.data?.name as string) ?? "—",
    clientCity: clientRes.data?.city ?? undefined,
    clientPhone: clientRes.data?.phone ?? undefined,
    items: items.map((i: Row) => enrichItem(i, pm.get(i.product_id as string))),
    photos: fromRows(check(photosRes.data, photosRes.error)),
    signature: sig
      ? { signerName: sig.signer_name, signatureData: sig.signature_data, signedAt: sig.signed_at }
      : null,
  };
};

export const searchOrders = async (args: { search: string }) => {
  const q = args.search.toLowerCase().trim();
  if (!q) return [];
  const esc = q.replace(/[%_,()]/g, " ").trim();
  const { data: clients } = await supabase.from("expedicao_clientes").select("id").ilike("name", `%${esc}%`);
  const clientIds = (clients ?? []).map((c) => c.id as string);
  const ors = [`order_number.ilike.%${esc}%`];
  if (clientIds.length) ors.push(`client_id.in.(${clientIds.join(",")})`);
  const { data, error } = await supabase.from(T).select("*").or(ors.join(",")).order("created_at", { ascending: false });
  check(data, error);
  return enrichOrders(data ?? []);
};

export const listOrdersPublic = async (args: { search?: string } = {}) => {
  const { data, error } = await supabase.from(T).select("*").order("created_at", { ascending: false });
  check(data, error);
  const enriched = await enrichOrders(data ?? []);
  const mapped = enriched.map((o) => ({
    _id: o._id,
    orderNumber: o.orderNumber,
    status: o.status,
    freightType: o.freightType,
    creationTime: o._creationTime,
    scheduledDate: o.scheduledDate,
    clientName: o.clientName,
    clientCity: o.clientCity,
    itemCount: o.itemCount,
  }));
  if (!args.search) return mapped;
  const q = args.search.toLowerCase();
  return mapped.filter(
    (o) =>
      (o.orderNumber as string).toLowerCase().includes(q) ||
      (o.clientName as string).toLowerCase().includes(q)
  );
};
