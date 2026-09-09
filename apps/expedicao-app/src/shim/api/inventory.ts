import { supabase, fromRow, check, fail, currentUserId, type Row } from "./helpers";
import { currentUserName } from "../auth-store";
import { createMovementRaw } from "./stockMovements";

const T = "expedicao_inventarios";
const TI = "expedicao_inventario_itens";

export const listInventories = async () => {
  const { data, error } = await supabase.from(T).select("*").order("created_at", { ascending: false });
  check(data, error);
  const invs = data ?? [];
  const ids = invs.map((i) => i.id as string);
  const { data: items, error: ie } = ids.length
    ? await supabase.from(TI).select("inventory_id,counted_quantity").in("inventory_id", ids)
    : { data: [], error: null };
  check(items, ie);
  const totals = new Map<string, { total: number; counted: number }>();
  for (const it of items ?? []) {
    const k = (it as Row).inventory_id as string;
    const t = totals.get(k) ?? { total: 0, counted: 0 };
    t.total++;
    if ((it as Row).counted_quantity != null) t.counted++;
    totals.set(k, t);
  }
  return invs.map((inv) => {
    const t = totals.get(inv.id as string) ?? { total: 0, counted: 0 };
    return {
      ...fromRow(inv),
      totalItems: t.total,
      countedItems: t.counted,
      createdByName: (inv.created_by_name as string) ?? "—",
    };
  });
};

export const getInventory = async (args: { id: string }) => {
  const { data: inv, error } = await supabase.from(T).select("*").eq("id", args.id).maybeSingle();
  check(inv, error);
  if (!inv) return null;
  const { data: items, error: ie } = await supabase.from(TI).select("*").eq("inventory_id", args.id).order("created_at");
  check(items, ie);
  const prodIds = [...new Set((items ?? []).map((i) => i.product_id as string))];
  const { data: prods } = prodIds.length
    ? await supabase.from("expedicao_produtos").select("id,name,code,unit,m2_per_box").in("id", prodIds)
    : { data: [] };
  const pm = new Map((prods ?? []).map((p: Row) => [p.id, p]));
  return {
    ...fromRow(inv),
    items: (items ?? []).map((item) => {
      const p = pm.get(item.product_id) as Row | undefined;
      return {
        ...fromRow(item),
        productName: p?.name ?? "—",
        productCode: p?.code ?? "—",
        productUnit: p?.unit ?? "un",
        m2PerBox: p?.m2_per_box ?? undefined,
        counterName: (item.counted_by_name as string) ?? null,
      };
    }),
  };
};

export const createInventory = async (args: { name: string; notes?: string; includeAllProducts?: boolean }) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { data: inv, error } = await supabase
    .from(T)
    .insert({ name: args.name, status: "aberto", notes: args.notes ?? null, created_by: uid, created_by_name: await currentUserName() })
    .select("id")
    .single();
  check(inv, error);
  const invId = inv!.id as string;

  if (args.includeAllProducts) {
    const { data: products, error: pe } = await supabase
      .from("expedicao_produtos")
      .select("id,current_stock")
      .eq("active", true);
    check(products, pe);
    if (products && products.length) {
      const rows = products.map((p) => ({
        inventory_id: invId,
        product_id: p.id,
        expected_quantity: p.current_stock,
      }));
      const { error: ie } = await supabase.from(TI).insert(rows);
      check(null, ie);
    }
  }
  return invId;
};

export const updateInventoryStatus = async (args: { id: string; status: string }) => {
  const patch: Row = { status: args.status };
  if (args.status === "finalizado") patch.finished_at = new Date().toISOString();
  const { error } = await supabase.from(T).update(patch).eq("id", args.id);
  check(null, error);
};

export const countInventoryItem = async (args: {
  id: string;
  countedQuantity: number;
  notes?: string;
  applyToStock?: boolean;
}) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { data: item, error } = await supabase.from(TI).select("*").eq("id", args.id).maybeSingle();
  check(item, error);
  if (!item) fail("Item não encontrado");

  const difference = args.countedQuantity - Number(item!.expected_quantity);
  const { error: ue } = await supabase
    .from(TI)
    .update({
      counted_quantity: args.countedQuantity,
      difference,
      notes: args.notes ?? null,
      counted_by: uid,
      counted_by_name: await currentUserName(),
    })
    .eq("id", args.id);
  check(null, ue);

  if (args.applyToStock) {
    const { data: product } = await supabase
      .from("expedicao_produtos")
      .select("current_stock")
      .eq("id", item!.product_id)
      .maybeSingle();
    if (product) {
      const delta = args.countedQuantity - Number(product.current_stock);
      await createMovementRaw({
        productId: item!.product_id as string,
        type: "inventario",
        delta,
        reason: "Ajuste de inventário",
        allowNegative: true,
      });
    }
  }
};

export const finalizeInventory = async (args: { id: string; applyAll: boolean }) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  if (args.applyAll) {
    const { data: items, error } = await supabase.from(TI).select("*").eq("inventory_id", args.id);
    check(items, error);
    for (const item of items ?? []) {
      if (item.counted_quantity == null) continue;
      const { data: product } = await supabase
        .from("expedicao_produtos")
        .select("current_stock")
        .eq("id", item.product_id)
        .maybeSingle();
      if (!product) continue;
      const delta = Number(item.counted_quantity) - Number(product.current_stock);
      if (delta === 0) continue;
      await createMovementRaw({
        productId: item.product_id as string,
        type: "inventario",
        delta,
        reason: "Finalização de inventário",
        allowNegative: true,
      });
    }
  }
  const { error: ue } = await supabase
    .from(T)
    .update({ status: "finalizado", finished_at: new Date().toISOString() })
    .eq("id", args.id);
  check(null, ue);
};

export const deleteInventory = async (args: { id: string }) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { error } = await supabase.from(T).delete().eq("id", args.id);
  check(null, error);
};
