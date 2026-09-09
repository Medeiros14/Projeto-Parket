import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface AtendimentoNPS { id: string; mes: string; nps: number; periodo: string; }
export interface AtendimentoTempo { id: string; dia: string; tempo: number; data: string; }
export interface AtendimentoGrupo {
  id: string; obra_code: string; cliente: string; tipo: string;
  membros: number; last_msg: string; saude: "verde"|"amarelo"|"vermelho"|"novo";
}
export interface AtendimentoScript { id: string; titulo: string; uso: number; tipo: string; conteudo?: string; ativo: boolean; }

export function useAtendimento() {
  const [nps, setNPS] = useState<AtendimentoNPS[]>([]);
  const [tempoResposta, setTempoResposta] = useState<AtendimentoTempo[]>([]);
  const [grupos, setGrupos] = useState<AtendimentoGrupo[]>([]);
  const [scripts, setScripts] = useState<AtendimentoScript[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: np }, { data: tr }, { data: gr }, { data: sc }] = await Promise.all([
      supabase.from("atendimento_nps").select("*").order("periodo"),
      supabase.from("atendimento_tempo_resposta").select("*").order("data").limit(7),
      supabase.from("atendimento_grupos").select("*").order("saude"),
      supabase.from("atendimento_scripts").select("*").eq("ativo", true).order("uso", { ascending: false }),
    ]);
    setNPS(np ?? []);
    setTempoResposta(tr ?? []);
    setGrupos(gr ?? []);
    setScripts(sc ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("atendimento_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimento_grupos" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimento_scripts" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const incrementarScript = async (id: string) => {
    const sc = scripts.find(s => s.id === id);
    if (!sc) return;
    await supabase.from("atendimento_scripts").update({ uso: sc.uso + 1 }).eq("id", id);
    fetchAll();
  };

  const updateGrupoSaude = async (id: string, saude: string) => {
    await supabase.from("atendimento_grupos").update({ saude }).eq("id", id);
    fetchAll();
  };

  const npsAtual = nps.length > 0 ? nps[nps.length - 1].nps : 0;
  const gruposVermelhos = grupos.filter(g => g.saude === "vermelho").length;

  return { nps, tempoResposta, grupos, scripts, loading, refetch: fetchAll, npsAtual, gruposVermelhos, incrementarScript, updateGrupoSaude };
}
