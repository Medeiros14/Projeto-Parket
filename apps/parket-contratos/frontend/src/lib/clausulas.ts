/**
 * Acesso à tabela `contrato_clausulas` (versão ativa + histórico).
 * Corpo em HTML com placeholders `{{CLIENTE}}`, `{{CPF}}`, `{{ENDERECO}}` que
 * são substituídos em `contratoGenerator.aplicarCorpoContratoCustom`.
 *
 * Fluxo de save: cria nova linha com versao = max+1 + ativa=true; a linha
 * anterior é marcada ativa=false na mesma transação lógica (unique index
 * parcial em `ativa` garante só 1 ativa por vez).
 */
import { supabase } from "./supabase";

export type Clausula = {
  id: string;
  corpo_html: string;
  versao: number;
  ativa: boolean;
  updated_at: string;
  updated_by: string | null;
};

export async function carregarClausulaAtiva(): Promise<Clausula | null> {
  const { data, error } = await supabase
    .from("contrato_clausulas")
    .select("id,corpo_html,versao,ativa,updated_at,updated_by")
    .eq("ativa", true)
    .maybeSingle();
  if (error) { console.warn("[clausulas] carregarAtiva:", error.message); return null; }
  return (data as any) || null;
}

export async function listarClausulas(): Promise<Clausula[]> {
  const { data, error } = await supabase
    .from("contrato_clausulas")
    .select("id,corpo_html,versao,ativa,updated_at,updated_by")
    .order("versao", { ascending: false })
    .limit(50);
  if (error) { console.warn("[clausulas] listar:", error.message); return []; }
  return (data as any) || [];
}

export async function salvarNovaVersao(corpoHtml: string, updatedBy: string): Promise<Clausula> {
  const { data: max } = await supabase
    .from("contrato_clausulas")
    .select("versao")
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  const proximaVersao = (max?.versao || 0) + 1;

  const { error: eDeactivate } = await supabase
    .from("contrato_clausulas")
    .update({ ativa: false })
    .eq("ativa", true);
  if (eDeactivate) throw new Error("Falha ao desativar versão anterior: " + eDeactivate.message);

  const { data, error } = await supabase
    .from("contrato_clausulas")
    .insert({ corpo_html: corpoHtml, versao: proximaVersao, ativa: true, updated_by: updatedBy })
    .select("id,corpo_html,versao,ativa,updated_at,updated_by")
    .single();
  if (error) throw new Error("Falha ao salvar nova versão: " + error.message);
  return data as any;
}

export async function ativarVersao(id: string): Promise<void> {
  const { error: eDeactivate } = await supabase
    .from("contrato_clausulas")
    .update({ ativa: false })
    .eq("ativa", true);
  if (eDeactivate) throw new Error("Falha ao desativar: " + eDeactivate.message);
  const { error } = await supabase
    .from("contrato_clausulas")
    .update({ ativa: true })
    .eq("id", id);
  if (error) throw new Error("Falha ao ativar versão: " + error.message);
}
