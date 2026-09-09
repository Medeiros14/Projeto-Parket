import { supabase, fromRow, check, type Row } from "./helpers";

const TP = "expedicao_produtos";
const TC = "expedicao_clientes";
const TO = "expedicao_pedidos";
const TI = "expedicao_pedido_itens";
const TM = "expedicao_movimentacoes";

const ct = (r: Row) => (r.created_at ? Date.parse(r.created_at as string) : 0);

async function productMap(ids: string[]): Promise<Map<string, Row>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const { data, error } = await supabase.from(TP).select("id,name,code,unit,current_stock").in("id", uniq);
  check(data, error);
  return new Map((data ?? []).map((p: Row) => [p.id as string, p]));
}

async function clientMap(ids: string[]): Promise<Map<string, Row>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const { data, error } = await supabase.from(TC).select("*").in("id", uniq);
  check(data, error);
  return new Map((data ?? []).map((c: Row) => [c.id as string, c]));
}

async function movementsSince(days: number, type?: string): Promise<Row[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let q = supabase.from(TM).select("*").gte("created_at", since).order("created_at", { ascending: false });
  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  check(data, error);
  return data ?? [];
}

export const stockSummary = async () => {
  const [prodsRes, clientsRes] = await Promise.all([
    supabase.from(TP).select("current_stock,min_stock").eq("active", true),
    supabase.from(TC).select("id", { count: "exact", head: true }),
  ]);
  const products = check(prodsRes.data, prodsRes.error) ?? [];
  check(null, clientsRes.error);

  const totalProducts = products.length;
  const lowStock = products.filter(
    (p: Row) => p.min_stock != null && Number(p.current_stock) <= Number(p.min_stock)
  ).length;
  const zeroStock = products.filter((p: Row) => Number(p.current_stock) === 0).length;

  return { totalProducts, lowStock, zeroStock, totalClients: clientsRes.count ?? 0 };
};

export const movementsByType = async (args: { days?: number } = {}) => {
  const recent = await movementsSince(args.days ?? 30);
  const byType: Record<string, number> = {};
  for (const m of recent) {
    const t = m.type as string;
    byType[t] = (byType[t] ?? 0) + 1;
  }
  return byType;
};

export const ordersByStatus = async () => {
  const { data, error } = await supabase.from(TO).select("status");
  check(data, error);
  const byStatus: Record<string, number> = {};
  for (const o of data ?? []) {
    byStatus[o.status as string] = (byStatus[o.status as string] ?? 0) + 1;
  }
  return byStatus;
};

export const ordersByStatusAndClient = async (args: { status: string }) => {
  const { data, error } = await supabase
    .from(TO)
    .select("*")
    .eq("status", args.status)
    .order("created_at", { ascending: false });
  check(data, error);
  const orders = data ?? [];
  const cm = await clientMap(orders.map((o: Row) => o.client_id as string));

  const map: Record<string, { clientName: string; clientCity?: string; orders: Row[] }> = {};
  for (const o of orders) {
    const key = o.client_id as string;
    if (!map[key]) {
      const c = cm.get(key);
      map[key] = { clientName: (c?.name as string) ?? "—", clientCity: (c?.city as string) ?? undefined, orders: [] };
    }
    map[key].orders.push({ orderNumber: o.order_number, _id: o.id, _creationTime: ct(o) });
  }
  return Object.values(map).sort((a, b) => b.orders.length - a.orders.length);
};

export const topMovedProducts = async (args: { days?: number } = {}) => {
  const recent = await movementsSince(args.days ?? 30);

  const map: Record<string, { entries: number; exits: number; productId: string }> = {};
  for (const m of recent) {
    const id = m.product_id as string;
    if (!map[id]) map[id] = { entries: 0, exits: 0, productId: id };
    const qty = Number(m.quantity);
    if (qty > 0) map[id].entries += qty;
    else map[id].exits += Math.abs(qty);
  }

  const sorted = Object.values(map)
    .sort((a, b) => b.entries + b.exits - (a.entries + a.exits))
    .slice(0, 10);

  const pm = await productMap(sorted.map((i) => i.productId));
  return sorted.map((item) => {
    const p = pm.get(item.productId);
    return {
      ...item,
      productName: (p?.name as string) ?? "—",
      productCode: (p?.code as string) ?? "—",
      productUnit: (p?.unit as string) ?? "un",
      currentStock: p ? Number(p.current_stock) : 0,
    };
  });
};

export const freightByClient = async () => {
  const { data, error } = await supabase.from(TO).select("client_id,status,freight_type,freight_value");
  check(data, error);
  const orders = (data ?? []).filter(
    (o: Row) => o.status !== "cancelado" && o.freight_type !== "retirada" && Number(o.freight_value ?? 0) > 0
  );
  const cm = await clientMap(orders.map((o: Row) => o.client_id as string));

  const map: Record<string, { clientName: string; clientCity?: string; total: number; count: number }> = {};
  for (const o of orders) {
    const key = o.client_id as string;
    if (!map[key]) {
      const c = cm.get(key);
      map[key] = {
        clientName: (c?.name as string) ?? "—",
        clientCity: (c?.city as string) ?? undefined,
        total: 0,
        count: 0,
      };
    }
    map[key].total += Number(o.freight_value ?? 0);
    map[key].count += 1;
  }
  return Object.values(map)
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);
};

export const recentMovementsList = async (args: { days?: number } = {}) => {
  const recent = (await movementsSince(args.days ?? 7)).slice(0, 50);
  const pm = await productMap(recent.map((m: Row) => m.product_id as string));
  return recent.map((m: Row) => {
    const p = pm.get(m.product_id as string);
    return {
      ...fromRow(m),
      productName: (p?.name as string) ?? "—",
      productUnit: (p?.unit as string) ?? "un",
    };
  });
};

async function orderItemsMap(orderIds: string[]): Promise<Map<string, Row[]>> {
  if (orderIds.length === 0) return new Map();
  const { data, error } = await supabase.from(TI).select("*").in("order_id", orderIds);
  check(data, error);
  const map = new Map<string, Row[]>();
  for (const it of data ?? []) {
    const k = it.order_id as string;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return map;
}

// Pedidos completos (cliente + itens) para o PDF detalhado
export const ordersFullReport = async (args: { status?: string } = {}) => {
  let q = supabase.from(TO).select("*").order("created_at", { ascending: false });
  if (args.status) q = q.eq("status", args.status);
  const { data, error } = await q;
  check(data, error);
  const orders = data ?? [];

  const [cm, im] = await Promise.all([
    clientMap(orders.map((o: Row) => o.client_id as string)),
    orderItemsMap(orders.map((o: Row) => o.id as string)),
  ]);
  const allItems = [...im.values()].flat();
  const pm = await productMap(allItems.map((i: Row) => i.product_id as string));

  return orders.map((o: Row) => {
    const client = cm.get(o.client_id as string);
    const items = (im.get(o.id as string) ?? []).map((item: Row) => {
      const p = pm.get(item.product_id as string);
      return {
        productName: (p?.name as string) ?? "—",
        productCode: (p?.code as string) ?? "—",
        quantity: Number(item.quantity),
        unit: (p?.unit as string) ?? "un",
        unitPrice: item.unit_price != null ? Number(item.unit_price) : undefined,
      };
    });
    const totalValue = items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity, 0);
    return {
      _id: o.id,
      orderNumber: o.order_number,
      status: o.status,
      freightType: o.freight_type,
      freightValue: o.freight_value != null ? Number(o.freight_value) : undefined,
      notes: o.notes ?? undefined,
      deliveryAddress: o.delivery_address ?? undefined,
      scheduledDate: o.scheduled_date ?? undefined,
      deliveredAt: o.delivered_at ?? undefined,
      _creationTime: ct(o),
      client: {
        name: (client?.name as string) ?? "—",
        phone: (client?.phone as string) ?? undefined,
        city: (client?.city as string) ?? undefined,
        state: (client?.state as string) ?? undefined,
        address: (client?.address as string) ?? undefined,
      },
      items,
      totalItems: items.length,
      totalValue,
    };
  });
};

export const inventoryReport = async () => {
  const { data, error } = await supabase
    .from("expedicao_inventarios")
    .select("*")
    .order("created_at", { ascending: false });
  check(data, error);
  const inventories = data ?? [];

  const invIds = inventories.map((i: Row) => i.id as string);
  const { data: rawItems, error: ie } = invIds.length
    ? await supabase.from("expedicao_inventario_itens").select("*").in("inventory_id", invIds)
    : { data: [] as Row[], error: null };
  check(rawItems, ie);
  const itemsByInv = new Map<string, Row[]>();
  for (const it of rawItems ?? []) {
    const k = it.inventory_id as string;
    if (!itemsByInv.has(k)) itemsByInv.set(k, []);
    itemsByInv.get(k)!.push(it);
  }
  const pm = await productMap((rawItems ?? []).map((i: Row) => i.product_id as string));

  return inventories.map((inv: Row) => {
    const items = (itemsByInv.get(inv.id as string) ?? []).map((item: Row) => {
      const p = pm.get(item.product_id as string);
      return {
        productName: (p?.name as string) ?? "—",
        productCode: (p?.code as string) ?? "—",
        unit: (p?.unit as string) ?? "un",
        expectedQuantity: Number(item.expected_quantity),
        countedQuantity: item.counted_quantity != null ? Number(item.counted_quantity) : undefined,
        difference: item.difference != null ? Number(item.difference) : undefined,
        notes: item.notes ?? undefined,
      };
    });
    return {
      _id: inv.id,
      name: inv.name,
      status: inv.status,
      notes: inv.notes ?? undefined,
      finishedAt: inv.finished_at ?? undefined,
      _creationTime: ct(inv),
      items,
      totalItems: items.length,
      countedItems: items.filter((i) => i.countedQuantity != null).length,
      divergentItems: items.filter((i) => i.difference != null && i.difference !== 0).length,
    };
  });
};

// Pedidos agrupados por cliente com detalhes completos
export const ordersByClient = async (args: { clientId?: string; status?: string } = {}) => {
  let q = supabase.from(TO).select("*").order("created_at", { ascending: false });
  if (args.clientId) q = q.eq("client_id", args.clientId);
  if (args.status) q = q.eq("status", args.status);
  const { data, error } = await q;
  check(data, error);
  const orders = data ?? [];

  const [cm, im] = await Promise.all([
    clientMap(orders.map((o: Row) => o.client_id as string)),
    orderItemsMap(orders.map((o: Row) => o.id as string)),
  ]);
  const allItems = [...im.values()].flat();
  const pm = await productMap(allItems.map((i: Row) => i.product_id as string));

  const map: Record<string, Row & { totalOrders: number; totalValue: number; totalFreight: number; orders: Row[] }> = {};
  for (const o of orders) {
    const key = o.client_id as string;
    if (!map[key]) {
      const client = cm.get(key);
      map[key] = {
        clientId: key,
        clientName: (client?.name as string) ?? "—",
        clientPhone: (client?.phone as string) ?? undefined,
        clientEmail: (client?.email as string) ?? undefined,
        clientCity: (client?.city as string) ?? undefined,
        clientState: (client?.state as string) ?? undefined,
        clientAddress: (client?.address as string) ?? undefined,
        clientDocument: (client?.document as string) ?? undefined,
        totalOrders: 0,
        totalValue: 0,
        totalFreight: 0,
        orders: [],
      };
    }
    const items = (im.get(o.id as string) ?? []).map((item: Row) => {
      const p = pm.get(item.product_id as string);
      const unitPrice = item.unit_price != null ? Number(item.unit_price) : undefined;
      const quantity = Number(item.quantity);
      return {
        productName: (p?.name as string) ?? "—",
        productCode: (p?.code as string) ?? "—",
        quantity,
        unit: (p?.unit as string) ?? "un",
        unitPrice,
        subtotal: (unitPrice ?? 0) * quantity,
      };
    });
    const orderValue = items.reduce((s, i) => s + i.subtotal, 0);
    map[key].totalOrders += 1;
    map[key].totalValue += orderValue;
    map[key].totalFreight += Number(o.freight_value ?? 0);
    map[key].orders.push({
      _id: o.id,
      orderNumber: o.order_number,
      status: o.status,
      freightType: o.freight_type,
      freightValue: o.freight_value != null ? Number(o.freight_value) : undefined,
      notes: o.notes ?? undefined,
      deliveryAddress: o.delivery_address ?? undefined,
      scheduledDate: o.scheduled_date ?? undefined,
      deliveredAt: o.delivered_at ?? undefined,
      _creationTime: ct(o),
      items,
      totalItems: items.length,
      totalValue: orderValue,
    });
  }

  return Object.values(map).sort((a, b) => b.totalOrders - a.totalOrders);
};

// Saídas de estoque agrupadas por produto no período
export const saidaMaterialReport = async (args: { days?: number } = {}) => {
  const days = args.days ?? 30;
  const recent = await movementsSince(days, "saida");

  const orderIds = [...new Set(recent.map((m: Row) => m.order_id as string).filter(Boolean))];
  const { data: ordersData, error: oe } = orderIds.length
    ? await supabase.from(TO).select("id,order_number").in("id", orderIds)
    : { data: [] as Row[], error: null };
  check(ordersData, oe);
  const orderNumbers = new Map<string, string>(
    (ordersData ?? []).map((o: Row) => [o.id as string, o.order_number as string])
  );
  const pm = await productMap(recent.map((m: Row) => m.product_id as string));

  const map: Record<
    string,
    {
      productId: string;
      productName: string;
      productCode: string;
      unit: string;
      totalQty: number;
      movCount: number;
      lastDate: number;
      exits: { date: number; qty: number; reason: string | undefined; orderNumber: string | undefined }[];
    }
  > = {};

  for (const m of recent) {
    const key = m.product_id as string;
    if (!map[key]) {
      const p = pm.get(key);
      map[key] = {
        productId: key,
        productName: (p?.name as string) ?? "—",
        productCode: (p?.code as string) ?? "—",
        unit: (p?.unit as string) ?? "un",
        totalQty: 0,
        movCount: 0,
        lastDate: 0,
        exits: [],
      };
    }
    const qty = Math.abs(Number(m.quantity));
    const when = ct(m);
    map[key].totalQty += qty;
    map[key].movCount += 1;
    if (when > map[key].lastDate) map[key].lastDate = when;
    map[key].exits.push({
      date: when,
      qty,
      reason: (m.reason as string) ?? undefined,
      orderNumber: m.order_id ? orderNumbers.get(m.order_id as string) : undefined,
    });
  }

  const rows = Object.values(map).sort((a, b) => b.totalQty - a.totalQty);
  const totalExits = rows.reduce((s, r) => s + r.movCount, 0);
  const totalQty = rows.reduce((s, r) => s + r.totalQty, 0);

  return { rows, totalExits, totalQty, days };
};

export const toolTransportsSummary = async () => {
  const { data, error } = await supabase
    .from("expedicao_transportes")
    .select("client_id,status,freight_value");
  check(data, error);
  const transports = data ?? [];

  const byStatus: Record<string, number> = {};
  for (const t of transports) {
    byStatus[t.status as string] = (byStatus[t.status as string] ?? 0) + 1;
  }

  const withFreight = transports.filter((t: Row) => t.status !== "cancelado" && Number(t.freight_value ?? 0) > 0);
  const cm = await clientMap(withFreight.map((t: Row) => t.client_id as string));

  const map: Record<string, { clientName: string; clientCity?: string; total: number; count: number }> = {};
  for (const t of withFreight) {
    const key = t.client_id as string;
    if (!map[key]) {
      const c = cm.get(key);
      map[key] = {
        clientName: (c?.name as string) ?? "—",
        clientCity: (c?.city as string) ?? undefined,
        total: 0,
        count: 0,
      };
    }
    map[key].total += Number(t.freight_value ?? 0);
    map[key].count += 1;
  }

  const freight = Object.values(map)
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  return {
    total: transports.length,
    byStatus,
    freightByClient: freight,
  };
};
