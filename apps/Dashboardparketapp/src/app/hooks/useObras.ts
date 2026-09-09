import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ─── Tipos ─── */
export interface ObraEquipe {
  nome: string;
  tipo: "marcenaria" | "instalacao";
  servico: string;
}

export interface Obra {
  id: string;
  cliente: string;
  localizacao: string;
  regiao: "SP" | "RJ" | "BSB" | "MG" | "BA" | "MT" | "GO" | "RS" | "PR" | "PY" | "OTHER";
  servicos: string[];
  equipes: ObraEquipe[];
  fiscais: string[];
  status: "em_execucao" | "mobilizacao" | "acabamento" | "travado" | "aguardando" | "finalizado";
  data_finalizacao?: string;
  valor_estimado: string;
  valor_num: number;
  progresso: number;
  gate: number;
  prioridade: "alta" | "media" | "baixa";
  obs?: string;
  created_at: string;
  updated_at: string;
}

/* ─── Hook ─── */
export function useObras() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchObras = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("obras")
      .select("*")
      .order("id", { ascending: true });

    if (err) {
      setError(err.message);
    } else {
      setObras(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchObras();

    // Realtime: qualquer alteração na tabela reflete automaticamente
    const channel = supabase
      .channel("obras_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "obras" }, () => {
        fetchObras();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchObras]);

  /* ─── Helpers de agregação (espelham obras-reais-data.ts) ─── */
  const getStatusSummary = useCallback(() => ({
    em_execucao: obras.filter(o => o.status === "em_execucao").length,
    mobilizacao: obras.filter(o => o.status === "mobilizacao").length,
    acabamento: obras.filter(o => o.status === "acabamento").length,
    travado: obras.filter(o => o.status === "travado").length,
    aguardando: obras.filter(o => o.status === "aguardando").length,
    finalizado: obras.filter(o => o.status === "finalizado").length,
  }), [obras]);

  const getRegiaoSummary = useCallback(() => {
    const map: Record<string, number> = {};
    obras.forEach(o => { map[o.regiao] = (map[o.regiao] || 0) + 1; });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([regiao, count]) => ({ regiao, count }));
  }, [obras]);

  const getTotalEquipes = useCallback(() => {
    const unique = new Set<string>();
    obras.forEach(o => o.equipes?.forEach(e => unique.add(e.nome)));
    return unique.size;
  }, [obras]);

  const getProgressoMedio = useCallback(() => {
    const active = obras.filter(o => o.status !== "finalizado" && o.status !== "aguardando");
    if (active.length === 0) return 0;
    return Math.round(active.reduce((acc, o) => acc + o.progresso, 0) / active.length);
  }, [obras]);

  const getTotalValorEstimado = useCallback(() => {
    return obras.reduce((acc, o) => acc + (o.valor_num ?? 0), 0);
  }, [obras]);

  /* ─── Mutações ─── */
  const updateObra = useCallback(async (id: string, updates: Partial<Omit<Obra, "id" | "created_at" | "updated_at" | "valor_num">>) => {
    const { error: err } = await supabase
      .from("obras")
      .update(updates)
      .eq("id", id);
    if (err) throw new Error(err.message);
  }, []);

  const createObra = useCallback(async (obra: Omit<Obra, "valor_num" | "created_at" | "updated_at">) => {
    const { data, error: err } = await supabase
      .from("obras")
      .insert(obra)
      .select()
      .single();
    if (err) throw new Error(err.message);
    return data as Obra;
  }, []);

  const deleteObra = useCallback(async (id: string) => {
    const { error: err } = await supabase.from("obras").delete().eq("id", id);
    if (err) throw new Error(err.message);
  }, []);

  return {
    obras,
    loading,
    error,
    refetch: fetchObras,
    getStatusSummary,
    getRegiaoSummary,
    getTotalEquipes,
    getProgressoMedio,
    getTotalValorEstimado,
    updateObra,
    createObra,
    deleteObra,
  };
}
