import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface MarketingLeadCanal { id: string; canal: string; leads: number; cpl: string; conversao: string; gasto: string; }
export interface MarketingLeadMensal { id: string; mes: string; leads: number; periodo: string; }
export interface MarketingConteudo { id: string; tipo: string; titulo: string; status: string; data_label: string; plataforma: string; data: string; }
export interface MarketingCampanha { id: string; nome: string; canal: string; orcamento: string; gasto: string; leads: number; cpl: string; status: "ativo"|"pausado"|"encerrado"; }

export function useMarketing() {
  const [leadsCanal, setLeadsCanal] = useState<MarketingLeadCanal[]>([]);
  const [leadsMensal, setLeadsMensal] = useState<MarketingLeadMensal[]>([]);
  const [conteudo, setConteudo] = useState<MarketingConteudo[]>([]);
  const [campanhas, setCampanhas] = useState<MarketingCampanha[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: lc }, { data: lm }, { data: ct }, { data: cp }] = await Promise.all([
      supabase.from("marketing_leads_canal").select("*").order("leads", { ascending: false }),
      supabase.from("marketing_leads_mensal").select("*").order("periodo"),
      supabase.from("marketing_conteudo").select("*").order("data"),
      supabase.from("marketing_campanhas").select("*").order("created_at", { ascending: false }),
    ]);
    setLeadsCanal(lc ?? []);
    setLeadsMensal(lm ?? []);
    setConteudo(ct ?? []);
    setCampanhas(cp ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("marketing_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_campanhas" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_conteudo" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const updateConteudoStatus = async (id: string, status: string) => {
    await supabase.from("marketing_conteudo").update({ status }).eq("id", id);
    fetchAll();
  };

  const updateCampanhaStatus = async (id: string, status: string) => {
    await supabase.from("marketing_campanhas").update({ status }).eq("id", id);
    fetchAll();
  };

  const criarConteudo = async (data: { tipo: string; titulo: string; plataforma: string; data_label: string; data: string }) => {
    await supabase.from("marketing_conteudo").insert({ ...data, status: "criacao" });
    fetchAll();
  };

  const totalLeadsMes = leadsCanal.reduce((s, l) => s + l.leads, 0);
  const campanhasAtivas = campanhas.filter(c => c.status === "ativo").length;

  return { leadsCanal, leadsMensal, conteudo, campanhas, loading, refetch: fetchAll, totalLeadsMes, campanhasAtivas, updateConteudoStatus, updateCampanhaStatus, criarConteudo };
}
