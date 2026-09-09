import { supabase, fromRow, check, fail, currentUserId, generateUploadUrl as genUrl, type Row } from "./helpers";

const T = "expedicao_transporte_fotos";

export const generateUploadUrl = genUrl;

// storageId no shim JÁ é a URL pública — salvo direto na coluna url
export const addPhoto = async (args: { transportId: string; storageId: string; type: string; caption?: string }) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { data, error } = await supabase
    .from(T)
    .insert({
      transport_id: args.transportId,
      url: args.storageId,
      type: args.type,
      caption: args.caption,
      created_by: uid,
    })
    .select("id")
    .single();
  return check(data, error)?.id;
};

export const deletePhoto = async (args: { id: string }) => {
  const { data: photo, error } = await supabase.from(T).select("id").eq("id", args.id).maybeSingle();
  check(photo, error);
  if (!photo) fail("Foto não encontrada");
  const { error: de } = await supabase.from(T).delete().eq("id", args.id);
  check(null, de);
};

export const getPhotos = async (args: { transportId: string }) => {
  const { data, error } = await supabase
    .from(T)
    .select("*")
    .eq("transport_id", args.transportId)
    .order("created_at", { ascending: false });
  check(data, error);
  return (data ?? []).map((photo: Row) => ({
    ...fromRow(photo),
    url: photo.url,
    userName: "—",
  }));
};
