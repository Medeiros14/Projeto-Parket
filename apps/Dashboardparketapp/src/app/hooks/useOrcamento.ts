import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface OrcamentoDesvio { id: string; mes: string; desvio: number; periodo: string; }
export interface OrcamentoProposta {
  id: string; obra_id: string; cliente: string; tipo: string; valor: string;
  versao: string; status: "enviada"|"incompleta"|"em calculo"|"em analise"|"aprovada"|"perdida";
  dias_pendente: number; completo: boolean;
}
export interface OrcamentoComposicao { id: string; item: string; perc: number; cor: string; ordem: number; }
export interface OrcamentoTemplate { id: string; nome: string; m2_range?: string; tipo?: string; margem_ref: string; usos: number; ativo: boolean; }

export interface SimulacaoProjeto {
  id: string;
  numero: string;
  cliente: string;
  cnpj_cpf: string;
  endereco: string;
  obra_code: string;
  vendedor: string;
  validade_dias: number;
  desconto_perc: number;
  status: "rascunho" | "enviada" | "aprovada" | "perdida" | "revisao" | "ganhado";
  created_at: string;
  obra_id?: string;
  arquiteto?: string;
  forma_pagamento?: string;
}

export interface SimulacaoItem {
  id: string;
  simulacao_id: string;
  categoria: string;
  descritivo: string;
  valor: number;
  ordem: number;
}

export function useOrcamento() {
  const [desvio, setDesvio] = useState<OrcamentoDesvio[]>([]);
  const [propostas, setPropostas] = useState<OrcamentoProposta[]>([]);
  const [composicao, setComposicao] = useState<OrcamentoComposicao[]>([]);
  const [templates, setTemplates] = useState<OrcamentoTemplate[]>([]);
  const [simulacoes, setSimulacoes] = useState<SimulacaoProjeto[]>([]);
  const [simulacaoItens, setSimulacaoItens] = useState<SimulacaoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: dv }, { data: pr }, { data: co }, { data: tp }, { data: sm }, { data: si }] = await Promise.all([
      supabase.from("orcamento_desvio").select("*").order("periodo"),
      supabase.from("orcamento_propostas").select("*").order("created_at", { ascending: false }),
      supabase.from("orcamento_composicao").select("*").order("ordem"),
      supabase.from("orcamento_templates").select("*").eq("ativo", true).order("usos", { ascending: false }),
      supabase.from("simulacao_projetos").select("*").order("created_at", { ascending: false }),
      supabase.from("simulacao_itens").select("*").order("ordem"),
    ]);
    setDesvio(dv ?? []);
    setPropostas(pr ?? []);
    setComposicao(co ?? []);
    setTemplates(tp ?? []);
    setSimulacoes(sm ?? []);
    setSimulacaoItens(si ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("orcamento_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orcamento_propostas" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "orcamento_templates" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "simulacao_projetos" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "simulacao_itens" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const incrementarTemplate = async (id: string) => {
    const tmpl = templates.find(t => t.id === id);
    if (!tmpl) return;
    await supabase.from("orcamento_templates").update({ usos: tmpl.usos + 1 }).eq("id", id);
    fetchAll();
  };

  const updatePropostaStatus = async (id: string, status: string) => {
    await supabase.from("orcamento_propostas").update({ status }).eq("id", id);
    fetchAll();
  };

  const criarProposta = async (data: { obra_id: string; cliente: string; tipo: string; valor: string }) => {
    await supabase.from("orcamento_propostas").insert({ ...data, versao: "v1", status: "em calculo", dias_pendente: 0, completo: false });
    fetchAll();
  };

  // ── Simulação functions ──

  const criarSimulacao = async (data: {
    numero: string; cliente: string; cnpj_cpf: string; endereco: string;
    obra_code: string; vendedor: string; validade_dias: number; obra_id?: string;
    arquiteto?: string; forma_pagamento?: string;
  }) => {
    const { data: novo } = await supabase
      .from("simulacao_projetos")
      .insert({ ...data, desconto_perc: 0, status: "rascunho" })
      .select()
      .single();
    fetchAll();
    return novo as SimulacaoProjeto | null;
  };

  const updateSimulacaoDesconto = async (id: string, desconto_perc: number) => {
    await supabase.from("simulacao_projetos").update({ desconto_perc }).eq("id", id);
    fetchAll();
  };

  const updateSimulacaoPagamento = async (id: string, forma_pagamento: string) => {
    await supabase.from("simulacao_projetos").update({ forma_pagamento }).eq("id", id);
    fetchAll();
  };

  // Internal: save a record in card_movements for the kanban card (obra_id IS the kanban_cards.id UUID)
  const registrarHistoricoNoKanban = async (
    obra_id: string | undefined,
    from_col: string,
    to_col: string,
    notes: string,
  ) => {
    if (!obra_id) return;
    await supabase.from("card_movements").insert({
      card_id: obra_id,
      gate: 0,
      from_dept: "Orçamento",
      from_column: from_col,
      to_dept: "Orçamento",
      to_column: to_col,
      moved_by: "Orçamento",
      notes,
    });
  };

  const updateSimulacaoStatus = async (id: string, status: string) => {
    const sim = simulacoes.find(s => s.id === id);
    await supabase.from("simulacao_projetos").update({ status }).eq("id", id);
    if (sim?.obra_id) {
      await registrarHistoricoNoKanban(
        sim.obra_id,
        sim.status,
        status,
        `Proposta${sim.numero ? " #" + sim.numero : ""} — status atualizado de "${sim.status}" para "${status}" | Cliente: ${sim.cliente}`,
      );
    }
    fetchAll();
  };

  const deletarSimulacao = async (id: string) => {
    await supabase.from("simulacao_projetos").delete().eq("id", id);
    fetchAll();
  };

  const adicionarItem = async (data: {
    simulacao_id: string; categoria: string; descritivo: string; valor: number;
  }) => {
    const itensDoGrupo = simulacaoItens.filter(i => i.simulacao_id === data.simulacao_id);
    const ordem = itensDoGrupo.length + 1;
    await supabase.from("simulacao_itens").insert({ ...data, ordem });
    fetchAll();
  };

  const removerItem = async (id: string) => {
    await supabase.from("simulacao_itens").delete().eq("id", id);
    fetchAll();
  };

  const itensDaSimulacao = (simulacao_id: string): SimulacaoItem[] =>
    simulacaoItens.filter(i => i.simulacao_id === simulacao_id);

  const totalSimulacao = (simulacao_id: string): number =>
    itensDaSimulacao(simulacao_id).reduce((sum, i) => sum + i.valor, 0);

  const totalComDesconto = (simulacao_id: string, desconto_perc: number): number => {
    const total = totalSimulacao(simulacao_id);
    return total - total * (desconto_perc / 100);
  };

  // Call when PDF is generated — saves a record in the project's kanban histórico
  const registrarPropostaGerada = async (simulacao_id: string) => {
    const sim = simulacoes.find(s => s.id === simulacao_id);
    if (!sim?.obra_id) return;
    const total = totalSimulacao(simulacao_id);
    const totalFinal = total - total * (sim.desconto_perc / 100);
    await registrarHistoricoNoKanban(
      sim.obra_id,
      sim.status,
      "proposta_gerada",
      `Proposta${sim.numero ? " #" + sim.numero : ""} gerada — Cliente: ${sim.cliente} | Total: ${totalFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${sim.desconto_perc > 0 ? ` (${sim.desconto_perc}% de desconto)` : ""}`,
    );
  };

  const desvioAtual = desvio.length > 0 ? desvio[desvio.length - 1].desvio : 0;
  const propostasIncompletas = propostas.filter(p => !p.completo).length;

  return {
    desvio, propostas, composicao, templates, loading, refetch: fetchAll,
    desvioAtual, propostasIncompletas,
    incrementarTemplate, updatePropostaStatus, criarProposta,
    // Simulação
    simulacoes, simulacaoItens,
    criarSimulacao, updateSimulacaoDesconto, updateSimulacaoPagamento, updateSimulacaoStatus, deletarSimulacao,
    adicionarItem, removerItem, itensDaSimulacao, totalSimulacao, totalComDesconto,
    registrarPropostaGerada,
  };
}
