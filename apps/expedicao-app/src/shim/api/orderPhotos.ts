import { supabase, fromRow, check, fail, currentUserId, generateUploadUrl as genUrl, type Row } from "./helpers";

const T = "expedicao_pedido_fotos";

export const generateUploadUrl = genUrl;
export const generateUploadUrlPublic = genUrl;

// storageId no shim JÁ é a URL pública — salvo direto na coluna url
export const addOrderPhoto = async (args: { orderId: string; storageId: string; type: string; caption?: string }) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { data, error } = await supabase
    .from(T)
    .insert({
      order_id: args.orderId,
      url: args.storageId,
      type: args.type,
      caption: args.caption,
      created_by: uid,
    })
    .select("id")
    .single();
  return check(data, error)?.id;
};

// Público — foto de entrega enviada pelo cliente, só quando o pedido está "entregue"
export const addOrderPhotoPublic = async (args: { orderId: string; storageId: string; type: string; caption?: string }) => {
  const { data: order, error } = await supabase
    .from("expedicao_pedidos")
    .select("id,status")
    .eq("id", args.orderId)
    .maybeSingle();
  check(order, error);
  if (!order) fail("Pedido não encontrado");
  if (order!.status !== "entregue") fail("Fotos de entrega só podem ser adicionadas após a entrega");

  const uid = await currentUserId();
  const { data, error: ie } = await supabase
    .from(T)
    .insert({
      order_id: args.orderId,
      url: args.storageId,
      type: "entrega",
      caption: args.caption,
      created_by: uid ?? null,
    })
    .select("id")
    .single();
  return check(data, ie)?.id;
};

export const deleteOrderPhoto = async (args: { id: string }) => {
  const { data: photo, error } = await supabase.from(T).select("id").eq("id", args.id).maybeSingle();
  check(photo, error);
  if (!photo) fail("Foto não encontrada");
  const { error: de } = await supabase.from(T).delete().eq("id", args.id);
  check(null, de);
};

export const getOrderPhotos = async (args: { orderId: string }) => {
  const { data, error } = await supabase
    .from(T)
    .select("*")
    .eq("order_id", args.orderId)
    .order("created_at", { ascending: false });
  check(data, error);
  return (data ?? []).map((photo: Row) => ({
    ...fromRow(photo),
    url: photo.url,
    userName: "—",
  }));
};
