import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface PMOProdutividade { id: string; equipe: string; m2dia: number; meta: number; obra_code: string; tipo: string; data: string; }
export interface PMOM2Semanal { id: string; semana: string; piso: number; forro: number; deck: number; periodo: string; }
export interface PMORetencao { id: string; obra_code: string; valor: string; status: "retido"|"liberar"|"liberado"; vencimento: string; }
export interface PMORanking { id: string; equipe: string; lider: string; m2_total: number; m2_media: number; obras: number; bonus: boolean; }

export function usePMO() {
  const [produtividade, setProdutividade] = useState<PMOProdutividade[]>([]);
  const [m2Semanal, setM2Semanal] = useState<PMOM2Semanal[]>([]);
  const [retencoes, setRetencoes] = useState<PMORetencao[]>([]);
  const [ranking, setRanking] = useState<PMORanking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: pd }, { data: m2 }, { data: rt }, { data: rk }] = await Promise.all([
      supabase.from("pmo_produtividade").select("*").order("m2dia", { ascending: false }),
      supabase.from("pmo_m2_semanal").select("*").order("periodo"),
      supabase.from("pmo_retencoes").select("*").order("created_at"),
      supabase.from("pmo_ranking_equipes").select("*").order("m2_total", { ascending: false }),
    ]);
    setProdutividade(pd ?? []);
    setM2Semanal(m2 ?? []);
    setRetencoes(rt ?? []);
    setRanking(rk ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("pmo_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pmo_produtividade" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "pmo_retencoes" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const updateRetencaoStatus = async (id: string, status: string) => {
    await supabase.from("pmo_retencoes").update({ status }).eq("id", id);
    fetchAll();
  };

  const retencoesLiberar = retencoes.filter(r => r.status === "liberar").length;
  const totalRetencaoK = retencoes
    .filter(r => r.status !== "liberado")
    .reduce((s, r) => s + parseFloat(r.valor.replace(/[^0-9.]/g, "")), 0);

  return { produtividade, m2Semanal, retencoes, ranking, loading, refetch: fetchAll, retencoesLiberar, totalRetencaoK, updateRetencaoStatus };
}
