import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ─── Tipos ─── */
export interface FluxoCaixa {
  id: string;
  periodo: string;
  periodo_dt: string;
  entradas: number;
  saidas: number;
  saldo: number;
  obs?: string;
}

export interface DREItem {
  id: string;
  periodo: string;
  periodo_dt: string;
  item: string;
  valor_num: number;
  perc: number;
  cor: string;
  posicao: number;
}

export interface MargensObra {
  id: string;
  obra_code: string;
  obra_id?: string;
  cliente: string;
  contrato_num: number;
  custo_orcado?: number;
  custo_real?: number;
  margem_orc?: number;
  margem_real?: number;
  status: "saudavel" | "atencao" | "risco";
  fase?: string;
  progresso?: number;
  responsavel?: string;
  nc_abertas: number;
  retrabalhos: number;
}

export interface Recebivel {
  id: string;
  obra_code: string;
  obra_id?: string;
  contato: string;
  valor_num: number;
  vencimento: string;
  dias_atraso: number;
  status: "atrasado" | "vencendo" | "a vencer" | "futuro" | "recebido";
  parcela?: number;
  total_parcelas?: number;
  obs?: string;
}

export interface FinanceiroResumo {
  receita_bruta_mes: number;
  ebitda_mes: number;
  recebiveis_criticos: number;
  valor_recebiveis_criticos: number;
  obras_em_risco: number;
  obras_saudaveis: number;
  margem_media_real: number;
}

/* ─── Hook ─── */
export function useFinanceiro() {
  const [fluxo, setFluxo] = useState<FluxoCaixa[]>([]);
  const [dre, setDre] = useState<DREItem[]>([]);
  const [margens, setMargens] = useState<MargensObra[]>([]);
  const [recebiveis, setRecebiveis] = useState<Recebivel[]>([]);
  const [resumo, setResumo] = useState<FinanceiroResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [
      { data: fluxoData, error: fluxoErr },
      { data: dreData, error: dreErr },
      { data: margensData, error: margensErr },
      { data: recebiveisData, error: recebiveisErr },
      { data: resumoData, error: resumoErr },
    ] = await Promise.all([
      supabase.from("financeiro_fluxo_caixa").select("*").order("periodo_dt"),
      supabase.from("financeiro_dre").select("*").order("periodo_dt", { ascending: false }).order("posicao"),
      supabase.from("financeiro_margens").select("*").order("contrato_num", { ascending: false }),
      supabase.from("financeiro_recebiveis").select("*").order("vencimento"),
      supabase.from("financeiro_resumo").select("*").single(),
    ]);

    const err = fluxoErr || dreErr || margensErr || recebiveisErr;
    if (err) setError(err.message);

    if (!fluxoErr) setFluxo(fluxoData ?? []);
    if (!dreErr) setDre(dreData ?? []);
    if (!margensErr) setMargens(margensData ?? []);
    if (!recebiveisErr) setRecebiveis(recebiveisData ?? []);
    if (!resumoErr) setResumo(resumoData ?? null);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();

    const tables = ["financeiro_fluxo_caixa", "financeiro_dre", "financeiro_margens", "financeiro_recebiveis"];
    const channels = tables.map(table =>
      supabase
        .channel(`fin_${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => fetchAll())
        .subscribe()
    );

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [fetchAll]);

  /* ─── Helpers ─── */
  const dreDoMes = useCallback((periodo: string) =>
    dre.filter(d => d.periodo === periodo).sort((a, b) => a.posicao - b.posicao),
  [dre]);

  const latestDre = dre.length > 0
    ? dre.filter(d => d.periodo_dt === dre[0].periodo_dt).sort((a, b) => a.posicao - b.posicao)
    : [];

  const recebiveisCriticos = recebiveis.filter(r => r.status === "atrasado" || r.status === "vencendo");
  const totalRecebiveisCriticos = recebiveisCriticos.reduce((s, r) => s + r.valor_num, 0);

  const margensEmRisco = margens.filter(m => m.status === "risco");

  /* ─── Formato compatível com gráfico (R$ mil) ─── */
  const fluxoChart = fluxo.map(f => ({
    sem: f.periodo,
    entradas: Math.round(f.entradas),
    saidas: Math.round(f.saidas),
    saldo: Math.round(f.saldo),
  }));

  /* ─── Mutations ─── */
  const updateRecebivel = useCallback(async (id: string, patch: Partial<Recebivel>) => {
    const { error: err } = await supabase
      .from("financeiro_recebiveis")
      .update(patch)
      .eq("id", id);
    if (err) throw new Error(err.message);
  }, []);

  const updateMargem = useCallback(async (id: string, patch: Partial<MargensObra>) => {
    const { error: err } = await supabase
      .from("financeiro_margens")
      .update(patch)
      .eq("id", id);
    if (err) throw new Error(err.message);
  }, []);

  return {
    fluxo,
    fluxoChart,
    dre,
    latestDre,
    dreDoMes,
    margens,
    margensEmRisco,
    recebiveis,
    recebiveisCriticos,
    totalRecebiveisCriticos,
    resumo,
    loading,
    error,
    refetch: fetchAll,
    updateRecebivel,
    updateMargem,
  };
}
