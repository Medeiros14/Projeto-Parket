import { supabase, fromRow, check, fail, currentUserId } from "./helpers";

const T = "expedicao_assinaturas";

export const getOrderSignature = async (args: { orderId: string }) => {
  const { data, error } = await supabase
    .from(T)
    .select("*")
    .eq("order_id", args.orderId)
    .order("created_at", { ascending: true })
    .limit(1);
  check(data, error);
  const sig = (data ?? [])[0];
  return sig ? fromRow(sig) : null;
};

// Staff autenticado
export const saveOrderSignature = async (args: { orderId: string; signerName: string; signatureData: string }) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");

  const { error: de } = await supabase.from(T).delete().eq("order_id", args.orderId);
  check(null, de);

  const { data, error } = await supabase
    .from(T)
    .insert({
      order_id: args.orderId,
      signer_name: args.signerName.trim(),
      signature_data: args.signatureData,
      signed_at: new Date().toISOString(),
      created_by: uid,
    })
    .select("id")
    .single();
  return check(data, error)?.id;
};

// Cliente na página pública — substitui assinatura existente
export const saveOrderSignaturePublic = async (args: { orderId: string; signerName: string; signatureData: string }) => {
  const { data: order, error } = await supabase
    .from("expedicao_pedidos")
    .select("id,status")
    .eq("id", args.orderId)
    .maybeSingle();
  check(order, error);
  if (!order) fail("Pedido não encontrado");
  if (order!.status === "cancelado") fail("Pedido cancelado não pode ser assinado");

  const { error: de } = await supabase.from(T).delete().eq("order_id", args.orderId);
  check(null, de);

  const { data, error: ie } = await supabase
    .from(T)
    .insert({
      order_id: args.orderId,
      signer_name: args.signerName.trim(),
      signature_data: args.signatureData,
      signed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  return check(data, ie)?.id;
};

export const deleteOrderSignature = async (args: { orderId: string }) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { error } = await supabase.from(T).delete().eq("order_id", args.orderId);
  check(null, error);
};
