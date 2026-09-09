import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface ObrasEquipe {
  id: string; equipe: string; lider: string;
  obra_code: string; obra_nome: string; local: string;
  progresso: number; tipo: string; membros: number;
  status: "executando" | "pausado" | "concluido" | "deslocamento";
}

export interface ObrasDiario {
  id: string; equipe: string; obra_code: string;
  data: string; preenchido: boolean; m2?: number; obs?: string;
}

export interface ObrasCronograma {
  id: string; obra_code: string; etapa: string;
  inicio: string; fim_previsto: string; fim_real?: string;
  status: "pendente" | "em_andamento" | "concluido" | "atrasado";
  responsavel?: string;
}

export function useObrasExtra() {
  const [equipes, setEquipes] = useState<ObrasEquipe[]>([]);
  const [diarios, setDiarios] = useState<ObrasDiario[]>([]);
  const [cronograma, setCronograma] = useState<ObrasCronograma[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: e }, { data: d }, { data: c }] = await Promise.all([
      supabase.from("obras_equipes_campo").select("*").order("created_at", { ascending: false }),
      supabase.from("obras_diarios").select("*").order("data", { ascending: false }).limit(20),
      supabase.from("obras_cronograma").select("*").order("inicio"),
    ]);
    setEquipes(e ?? []);
    setDiarios(d ?? []);
    setCronograma(c ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("obras_extra_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "obras_equipes_campo" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "obras_diarios" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const marcarDiario = async (id: string, data: { m2?: number; obs?: string }) => {
    await supabase.from("obras_diarios").update({ preenchido: true, ...data }).eq("id", id);
    fetchAll();
  };

  const criarDiario = async (data: { equipe: string; obra_code: string; m2?: number; obs?: string }) => {
    await supabase.from("obras_diarios").insert({ ...data, data: new Date().toISOString().split("T")[0], preenchido: true });
    fetchAll();
  };

  const updateEquipeStatus = async (id: string, status: string) => {
    await supabase.from("obras_equipes_campo").update({ status }).eq("id", id);
    fetchAll();
  };

  const equipeExecutando = equipes.filter(e => e.status === "executando").length;
  const diariosPendentes = diarios.filter(d => !d.preenchido).length;
  const totalM2Hoje = diarios.filter(d => d.data === new Date().toISOString().split("T")[0])
    .reduce((s, d) => s + (d.m2 ?? 0), 0);

  return { equipes, diarios, cronograma, loading, refetch: fetchAll,
    equipeExecutando, diariosPendentes, totalM2Hoje, marcarDiario, criarDiario, updateEquipeStatus };
}
