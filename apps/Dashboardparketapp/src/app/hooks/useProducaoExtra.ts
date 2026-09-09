import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface ProducaoNC {
  id: string; codigo: string; obra_code: string; descricao: string;
  data: string; status: "aberta" | "em_tratamento" | "resolvida";
  severidade: "alta" | "media" | "baixa"; responsavel?: string;
}

export interface ProducaoCapacidade {
  id: string; dia: string; capacidade: number; uso: number; data: string;
}

export interface ProducaoEquipe {
  id: string; nome: string; lider: string; bancada: string;
  ordem?: string; operacao?: string; carga: number;
  status: "ativo" | "bloqueado" | "manutencao" | "disponivel";
}

export function useProducaoExtra() {
  const [ncs, setNcs] = useState<ProducaoNC[]>([]);
  const [capacidade, setCapacidade] = useState<ProducaoCapacidade[]>([]);
  const [equipes, setEquipes] = useState<ProducaoEquipe[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: n }, { data: cap }, { data: eq }] = await Promise.all([
      supabase.from("producao_nc").select("*").order("data", { ascending: false }),
      supabase.from("producao_capacidade").select("*").order("data"),
      supabase.from("producao_equipes").select("*").order("created_at"),
    ]);
    setNcs(n ?? []);
    setCapacidade(cap ?? []);
    setEquipes(eq ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("producao_extra_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "producao_nc" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "producao_equipes" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const updateNCStatus = async (id: string, status: string) => {
    await supabase.from("producao_nc").update({ status }).eq("id", id);
    fetchAll();
  };

  const criarNC = async (data: { descricao: string; obra_code: string; severidade: string }) => {
    await supabase.from("producao_nc").insert({
      ...data,
      codigo: `NC-${Date.now().toString().slice(-4)}`,
      data: new Date().toISOString().split("T")[0],
      status: "aberta",
    });
    fetchAll();
  };

  const ncsAbertas = ncs.filter(n => n.status === "aberta").length;
  const ncsCriticas = ncs.filter(n => n.status === "aberta" && n.severidade === "alta").length;
  const equipesBloqueadas = equipes.filter(e => e.status === "bloqueado").length;
  const capacidadeMedia = capacidade.length > 0
    ? Math.round(capacidade.reduce((s, c) => s + c.uso, 0) / capacidade.length)
    : 0;

  return { ncs, capacidade, equipes, loading, refetch: fetchAll,
    ncsAbertas, ncsCriticas, equipesBloqueadas, capacidadeMedia, updateNCStatus, criarNC };
}
