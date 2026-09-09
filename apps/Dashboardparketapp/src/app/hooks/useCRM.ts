import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface CRMPipeline {
  id: string; stage: string; value_k: number; deals: number; ordem: number;
}

export interface CRMFunil {
  id: string; name: string; value: number; cor: string; ordem: number;
}

export interface CRMCloser {
  id: string; nome: string; papel: "closer" | "bdr" | "sdr";
  propostas: number; fechados: number; valor_k: number;
  taxa_pct?: number; destaque: boolean;
}

export interface CRMAgenda {
  id: string; dia: string; data: string; hora: string;
  cliente: string; status: "confirmado" | "pendente" | "cancelado" | "realizado";
  closer?: string;
}

export interface CRMConversion {
  id: string; mes: string; taxa: number; leads: number; periodo: string;
}

export function useCRM() {
  const [pipeline, setPipeline] = useState<CRMPipeline[]>([]);
  const [funil, setFunil] = useState<CRMFunil[]>([]);
  const [closers, setClosers] = useState<CRMCloser[]>([]);
  const [agenda, setAgenda] = useState<CRMAgenda[]>([]);
  const [conversion, setConversion] = useState<CRMConversion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: f }, { data: c }, { data: a }, { data: cv }] = await Promise.all([
      supabase.from("crm_pipeline").select("*").order("ordem"),
      supabase.from("crm_funil").select("*").order("ordem"),
      supabase.from("crm_closer_ranking").select("*").order("fechados", { ascending: false }),
      supabase.from("crm_agenda_showroom").select("*").order("data").limit(10),
      supabase.from("crm_conversion_monthly").select("*").order("periodo"),
    ]);
    setPipeline(p ?? []);
    setFunil(f ?? []);
    setClosers(c ?? []);
    setAgenda(a ?? []);
    setConversion(cv ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("crm_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_pipeline" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_agenda_showroom" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const totalPipelineK = pipeline.reduce((s, p) => s + Number(p.value_k), 0);
  const totalDeals = pipeline.reduce((s, p) => s + p.deals, 0);
  const leadsAtivos = funil[0]?.value ?? 0;
  const taxaConversao = conversion.length > 0
    ? conversion[conversion.length - 1].taxa
    : 0;
  const agendaHoje = agenda.filter(a => a.data === new Date().toISOString().split("T")[0]).length;

  const updateAgendaStatus = useCallback(async (id: string, status: CRMAgenda["status"]) => {
    await supabase.from("crm_agenda_showroom").update({ status }).eq("id", id);
    fetchAll();
  }, [fetchAll]);

  return { pipeline, funil, closers, agenda, conversion, loading, refetch: fetchAll,
    totalPipelineK, totalDeals, leadsAtivos, taxaConversao, agendaHoje, updateAgendaStatus };
}
