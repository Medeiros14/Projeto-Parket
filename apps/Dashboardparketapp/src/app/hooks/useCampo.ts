import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ─── Tipos ─── */
export interface CampoCheckin {
  id: string; user_id: string; obra_id: string; obra_nome: string;
  hora_entrada: string; hora_saida?: string; dentro_do_raio: boolean;
  obs?: string; data: string; created_at: string;
}

export interface CampoPost {
  id: string; user_id: string; user_name: string; user_avatar: string;
  obra_id: string; obra_nome: string; etapa: string; descricao: string;
  foto?: string; status: "pendente" | "aprovado" | "rejeitado";
  nota_qualidade?: number; comentario_fiscal?: string; likes: number; created_at: string;
}

export interface CampoTarefa {
  id: string; titulo: string; obra_id: string; obra_nome: string;
  user_id: string; prioridade: "alta" | "media" | "baixa";
  status: "pendente" | "andamento" | "concluida" | "atrasada";
  prazo?: string; etapa: string; created_at: string;
}

export interface CampoOrdem {
  id: string; codigo: string; obra_destino: string; obra_nome: string;
  item: string; material: string;
  status: "fila" | "cortando" | "montando" | "acabamento" | "pronto" | "entregue";
  responsavel?: string; prazo?: string; conclusao: number;
}

export interface CampoRanking {
  id: string; user_id: string; nome: string; avatar: string;
  pontos: number; badges: string[]; setor: string;
}

export interface CampoNotif {
  id: string; user_id: string;
  tipo: "tarefa" | "aprovado" | "rejeitado" | "lembrete" | "aviso";
  texto: string; lida: boolean; created_at: string;
}

/* ─── Hook ─── */
export function useCampo(userId?: string) {
  const [checkins, setCheckins] = useState<CampoCheckin[]>([]);
  const [posts, setPosts] = useState<CampoPost[]>([]);
  const [tarefas, setTarefas] = useState<CampoTarefa[]>([]);
  const [ordens, setOrdens] = useState<CampoOrdem[]>([]);
  const [ranking, setRanking] = useState<CampoRanking[]>([]);
  const [notificacoes, setNotificacoes] = useState<CampoNotif[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const today = new Date().toISOString().split("T")[0];

    let checkinsQ = supabase.from("campo_checkins").select("*").order("created_at", { ascending: false }).limit(20);
    if (userId) checkinsQ = checkinsQ.eq("user_id", userId);

    let tarefasQ = supabase.from("campo_tarefas").select("*").order("created_at", { ascending: false });
    if (userId) tarefasQ = tarefasQ.eq("user_id", userId);

    let notifsQ = supabase.from("campo_notificacoes").select("*").order("created_at", { ascending: false }).limit(10);
    if (userId) notifsQ = notifsQ.eq("user_id", userId);

    const [
      { data: checkinsData },
      { data: postsData },
      { data: tarefasData },
      { data: ordensData },
      { data: rankingData },
      { data: notifsData },
    ] = await Promise.all([
      checkinsQ,
      supabase.from("campo_posts").select("*").order("created_at", { ascending: false }).limit(20),
      tarefasQ,
      supabase.from("campo_ordens_producao").select("*").order("created_at", { ascending: false }),
      supabase.from("campo_ranking").select("*").order("pontos", { ascending: false }),
      notifsQ,
    ]);

    setCheckins(checkinsData ?? []);
    setPosts(postsData ?? []);
    setTarefas(tarefasData ?? []);
    setOrdens(ordensData ?? []);
    setRanking(rankingData ?? []);
    setNotificacoes(notifsData ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchAll();

    const tables = ["campo_posts", "campo_tarefas", "campo_checkins", "campo_notificacoes"];
    const channels = tables.map(t =>
      supabase.channel(`campo_${t}`)
        .on("postgres_changes", { event: "*", schema: "public", table: t }, fetchAll)
        .subscribe()
    );

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [fetchAll]);

  /* ─── Mutations ─── */
  const checkin = useCallback(async (userId: string, obraId: string, obraNome: string, obs?: string) => {
    const { data, error } = await supabase.from("campo_checkins").insert({
      user_id: userId, obra_id: obraId, obra_nome: obraNome,
      hora_entrada: new Date().toTimeString().slice(0, 5),
      obs: obs ?? null, dentro_do_raio: true,
    }).select().single();
    if (error) throw new Error(error.message);
    return data as CampoCheckin;
  }, []);

  const checkout = useCallback(async (checkinId: string) => {
    const { error } = await supabase.from("campo_checkins")
      .update({ hora_saida: new Date().toTimeString().slice(0, 5) })
      .eq("id", checkinId);
    if (error) throw new Error(error.message);
  }, []);

  const createPost = useCallback(async (post: Omit<CampoPost, "id" | "likes" | "created_at">) => {
    const { data, error } = await supabase.from("campo_posts").insert(post).select().single();
    if (error) throw new Error(error.message);
    return data as CampoPost;
  }, []);

  const approvePost = useCallback(async (id: string, nota: number, comentario?: string) => {
    const { error } = await supabase.from("campo_posts")
      .update({ status: "aprovado", nota_qualidade: nota, comentario_fiscal: comentario ?? null })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }, []);

  const updateTarefa = useCallback(async (id: string, status: CampoTarefa["status"]) => {
    const { error } = await supabase.from("campo_tarefas").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
  }, []);

  const updateOrdem = useCallback(async (id: string, patch: Partial<CampoOrdem>) => {
    const { error } = await supabase.from("campo_ordens_producao").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  }, []);

  const markNotifRead = useCallback(async (id: string) => {
    await supabase.from("campo_notificacoes").update({ lida: true }).eq("id", id);
  }, []);

  /* ─── Computed ─── */
  const unreadNotifs = notificacoes.filter(n => !n.lida).length;
  const tarefasPendentes = tarefas.filter(t => t.status !== "concluida").length;
  const postsPendentes = posts.filter(p => p.status === "pendente").length;

  return {
    checkins, posts, tarefas, ordens, ranking, notificacoes,
    loading, refetch: fetchAll,
    unreadNotifs, tarefasPendentes, postsPendentes,
    checkin, checkout, createPost, approvePost, updateTarefa, updateOrdem, markNotifRead,
  };
}
