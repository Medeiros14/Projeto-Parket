import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ─── Tipos ─── */
export interface Notificacao {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  referencia_id: string | null;
  referencia_tipo: string | null;
  lida: boolean;
  created_at: string;
}

/* ─── Função standalone para criar notificação ─── */
export async function criarNotificacao(
  userId: string,
  tipo: string,
  titulo: string,
  mensagem: string,
  referenciaId?: string,
  referenciaTipo?: string,
): Promise<void> {
  const { error } = await supabase.from("notificacoes").insert({
    user_id: userId,
    tipo,
    titulo,
    mensagem,
    referencia_id: referenciaId ?? null,
    referencia_tipo: referenciaTipo ?? null,
    lida: false,
  });
  if (error) throw new Error(error.message);
}

/* ─── Hook principal ─── */
export function useNotificacoes(userId: string | undefined) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotificacoes = useCallback(async () => {
    if (!userId) {
      setNotificacoes([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        // Gracefully handle missing table or other errors
        console.warn("[useNotificacoes] erro ao buscar notificações:", error.message);
        setNotificacoes([]);
      } else {
        setNotificacoes((data ?? []) as Notificacao[]);
      }
    } catch (err) {
      console.warn("[useNotificacoes] exceção inesperada:", err);
      setNotificacoes([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /* ─── Fetch inicial + realtime ─── */
  useEffect(() => {
    setLoading(true);
    fetchNotificacoes();

    if (!userId) return;

    const channel = supabase
      .channel(`notificacoes_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${userId}` },
        () => fetchNotificacoes(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotificacoes, userId]);

  /* ─── Marcar uma notificação como lida ─── */
  const marcarLida = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true })
        .eq("id", id);

      if (error) {
        console.warn("[useNotificacoes] erro ao marcar como lida:", error.message);
        return;
      }

      setNotificacoes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true } : n)),
      );
    } catch (err) {
      console.warn("[useNotificacoes] exceção ao marcar como lida:", err);
    }
  }, []);

  /* ─── Marcar todas as notificações como lidas ─── */
  const marcarTodasLidas = useCallback(async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true })
        .eq("user_id", userId)
        .eq("lida", false);

      if (error) {
        console.warn("[useNotificacoes] erro ao marcar todas como lidas:", error.message);
        return;
      }

      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    } catch (err) {
      console.warn("[useNotificacoes] exceção ao marcar todas como lidas:", err);
    }
  }, [userId]);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  return {
    notificacoes,
    naoLidas,
    loading,
    marcarLida,
    marcarTodasLidas,
  };
}
