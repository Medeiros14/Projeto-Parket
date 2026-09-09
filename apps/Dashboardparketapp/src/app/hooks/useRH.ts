import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface RHVaga {
  id: string; titulo: string; dept: string; solicitante: string;
  dias_aberta: number; candidatos: number;
  urgencia: "alta" | "media" | "baixa";
  etapa: "triagem" | "entrevista" | "proposta" | "finalizado";
  status: "aberta" | "fechada" | "pausada";
}

export interface RHTreinamento {
  id: string; titulo: string; obrigatorio: boolean;
  participantes: number; concluidos: number;
  vencimento?: string; status: "em_andamento" | "concluido" | "atrasado";
}

export interface RHContrato {
  id: string; nome: string; cargo: string; dept: string;
  vencimento: string; dias_restantes: number;
  tipo: "clt" | "pj" | "estagio";
}

export interface RHHeadcount {
  id: string; dept: string; ativos: number; afastados: number; ferias: number;
}

export function useRH() {
  const [vagas, setVagas] = useState<RHVaga[]>([]);
  const [treinamentos, setTreinamentos] = useState<RHTreinamento[]>([]);
  const [contratos, setContratos] = useState<RHContrato[]>([]);
  const [headcount, setHeadcount] = useState<RHHeadcount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [
      { data: v }, { data: t }, { data: c }, { data: h }
    ] = await Promise.all([
      supabase.from("rh_vagas").select("*").eq("status", "aberta").order("dias_aberta", { ascending: false }),
      supabase.from("rh_treinamentos").select("*").order("created_at", { ascending: false }),
      supabase.from("rh_contratos_vencendo").select("*").order("dias_restantes"),
      supabase.from("rh_headcount").select("*"),
    ]);
    setVagas(v ?? []);
    setTreinamentos(t ?? []);
    setContratos(c ?? []);
    setHeadcount(h ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("rh_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_vagas" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_treinamentos" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const updateVagaEtapa = async (id: string, etapa: string) => {
    await supabase.from("rh_vagas").update({ etapa }).eq("id", id);
    fetchAll();
  };

  const updateVagaStatus = async (id: string, status: string) => {
    await supabase.from("rh_vagas").update({ status }).eq("id", id);
    fetchAll();
  };

  const criarVaga = async (data: { titulo: string; dept: string; solicitante: string; urgencia: string }) => {
    await supabase.from("rh_vagas").insert({ ...data, dias_aberta: 0, candidatos: 0, etapa: "triagem", status: "aberta" });
    fetchAll();
  };

  const totalAtivos = headcount.reduce((s, h) => s + h.ativos, 0);
  const vagasAbertas = vagas.filter(v => v.urgencia === "alta").length;
  const treinamentosPendentes = treinamentos.filter(t => t.status === "em_andamento").length;

  return { vagas, treinamentos, contratos, headcount, loading, refetch: fetchAll,
    totalAtivos, vagasAbertas, treinamentosPendentes, updateVagaEtapa, updateVagaStatus, criarVaga };
}
