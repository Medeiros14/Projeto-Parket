import { supabase, fromRows, toRow, check, fail, currentUserId, type Row } from "./helpers";

const T = "expedicao_notificacoes";

export const listNotifications = async (args: { limit?: number } = {}) => {
  const uid = await currentUserId();
  if (!uid) return [];
  const limit = args.limit ?? 50;
  const { data, error } = await supabase
    .from(T)
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  check(data, error);
  return fromRows(data ?? []);
};

export const countUnread = async () => {
  const uid = await currentUserId();
  if (!uid) return 0;
  const { count, error } = await supabase
    .from(T)
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("read", false);
  check(null, error);
  return count ?? 0;
};

export const markAsRead = async (args: { id: string }) => {
  const { error } = await supabase.from(T).update({ read: true }).eq("id", args.id);
  check(null, error);
};

export const markAllAsRead = async () => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { error } = await supabase.from(T).update({ read: true }).eq("user_id", uid).eq("read", false);
  check(null, error);
};

export const deleteNotification = async (args: { id: string }) => {
  const { error } = await supabase.from(T).delete().eq("id", args.id);
  check(null, error);
};

export const createNotification = async (args: {
  type: string;
  title: string;
  message: string;
  relatedId: string;
  relatedNumber: string;
  newStatus: string;
  clientPhone?: string;
  whatsappMessage?: string;
}) => {
  const uid = await currentUserId();
  if (!uid) fail("Não autenticado");
  const { error } = await supabase
    .from(T)
    .insert({ user_id: uid, ...toRow(args as unknown as Row), read: false });
  check(null, error);
};
