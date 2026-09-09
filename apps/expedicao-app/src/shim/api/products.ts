import { supabase, fromRow, fromRows, toRow, check, fail, currentUserId, generateUploadUrl as genUrl, type Row } from "./helpers";

const T = "expedicao_produtos";
const TCAT = "expedicao_categorias";

export const listCategories = async () => {
  const { data, error } = await supabase.from(TCAT).select("*").order("name");
  return fromRows(check(data, error));
};

export const createCategory = async (args: Row) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { data, error } = await supabase.from(TCAT).insert({ ...toRow(args), created_by: uid }).select("id").single();
  return check(data, error)?.id;
};

export const listProducts = async (args: { includeInactive?: boolean } = {}) => {
  let q = supabase.from(T).select("*").order("name");
  if (!args.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  return fromRows(check(data, error));
};

export const getProduct = async (args: { id: string }) => {
  const { data, error } = await supabase.from(T).select("*").eq("id", args.id).maybeSingle();
  check(data, error);
  return data ? fromRow(data) : null;
};

export const createProduct = async (args: Row) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { imageStorageId, ...rest } = args as { imageStorageId?: string } & Row;
  const { data: dup } = await supabase.from(T).select("id").eq("code", rest.code as string).eq("active", true).limit(1);
  if (dup && dup.length > 0) fail("Código já cadastrado");
  const { data, error } = await supabase
    .from(T)
    .insert({ ...toRow(rest), image_url: imageStorageId, current_stock: 0, active: true, created_by: uid })
    .select("id")
    .single();
  return check(data, error)?.id;
};

export const updateProduct = async (args: Row) => {
  const { id, imageStorageId, ...rest } = args as { id: string; imageStorageId?: string } & Row;
  const patch = toRow(rest);
  if (imageStorageId !== undefined) patch.image_url = imageStorageId;
  patch.updated_at = new Date().toISOString();
  const { error } = await supabase.from(T).update(patch).eq("id", id);
  check(null, error);
};

export const deleteProduct = async (args: { id: string }) => {
  const { error } = await supabase.from(T).update({ active: false, updated_at: new Date().toISOString() }).eq("id", args.id);
  check(null, error);
};

export const generateUploadUrl = genUrl;

export const getImageUrl = async (args: { storageId: string }) => args.storageId;
