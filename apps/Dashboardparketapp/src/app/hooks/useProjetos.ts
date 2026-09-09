import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface ProjetosLeadTime { id: string; mes: string; tempo: number; periodo: string; }
export interface ProjetosVersao { id: string; obra_code: string; versoes: number; status: "em andamento"|"bloqueado"|"aprovado"|"bom pronto"; dias: number; cliente: string; }
export interface ProjetosBOM { id: string; obra_code: string; itens: number; conferidos: number; status: "pendente"|"parcial"|"completo"; valor: string; }
export interface ProjetosAprovacao { id: string; obra_code: string; tipo: string; versao: string; dias_pendente: number; urgencia: "critico"|"normal"|"novo"; arquiteto: string; }

export function useProjetos() {
  const [leadTime, setLeadTime] = useState<ProjetosLeadTime[]>([]);
  const [versoes, setVersoes] = useState<ProjetosVersao[]>([]);
  const [bom, setBOM] = useState<ProjetosBOM[]>([]);
  const [aprovacoes, setAprovacoes] = useState<ProjetosAprovacao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: lt }, { data: vs }, { data: bm }, { data: ap }] = await Promise.all([
      supabase.from("projetos_lead_time").select("*").order("periodo"),
      supabase.from("projetos_versoes").select("*").order("dias", { ascending: false }),
      supabase.from("projetos_bom").select("*").order("obra_code"),
      supabase.from("projetos_aprovacoes").select("*").order("dias_pendente", { ascending: false }),
    ]);
    setLeadTime(lt ?? []);
    setVersoes(vs ?? []);
    setBOM(bm ?? []);
    setAprovacoes(ap ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("projetos_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "projetos_versoes" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "projetos_aprovacoes" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const aprovarAprovacao = async (id: string) => {
    await supabase.from("projetos_aprovacoes").delete().eq("id", id);
    fetchAll();
  };

  const escalarAprovacao = async (id: string) => {
    await supabase.from("projetos_aprovacoes").update({ urgencia: "critico" }).eq("id", id);
    fetchAll();
  };

  const updateVersaoStatus = async (id: string, status: string) => {
    await supabase.from("projetos_versoes").update({ status }).eq("id", id);
    fetchAll();
  };

  const bloqueados = versoes.filter(v => v.status === "bloqueado").length;
  const aprovacoesCriticas = aprovacoes.filter(a => a.urgencia === "critico").length;
  const leadTimeAtual = leadTime.length > 0 ? leadTime[leadTime.length - 1].tempo : 0;

  return { leadTime, versoes, bom, aprovacoes, loading, refetch: fetchAll, bloqueados, aprovacoesCriticas, leadTimeAtual, aprovarAprovacao, escalarAprovacao, updateVersaoStatus };
}
