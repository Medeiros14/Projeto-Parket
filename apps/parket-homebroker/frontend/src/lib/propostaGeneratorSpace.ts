/**
 * Wrapper TS sobre o renderer OFICIAL do Space (PGSTRUCT35 copiado verbatim).
 *
 * O JS abaixo é cópia byte-a-byte do `propostaGenerator-PGSTRUCT35.js` em
 * produção em proposta.parket.works — garante paridade visual 100% com o Space.
 * Não modificar este wrapper sem sincronizar a fonte.
 *
 * O port-em-TS anterior (com drift de versão) foi removido em jun/2026 — usar
 * SEMPRE o JS espelhado pra evitar divergência.
 */

// @ts-expect-error — arquivo JS minificado do Space, sem types
import { gerarPropostaHTML as _gerarHTML, abrirProposta as _abrir } from "./propostaRendererSpace35.js";

export interface PropostaSimulacao {
  id?: string;
  numero: string;
  cliente: string;
  cnpj_cpf: string;
  endereco: string;
  obra_code: string;
  obra_id?: string;
  vendedor: string;
  validade_dias: number;
  desconto_perc: number;
  desconto_modo?: "perc" | "valor" | string;
  desconto_valor?: number;
  frete_valor?: number;
  created_at: string;
  arquiteto?: string;
  forma_pagamento?: string;
  orcamentista?: string;
  contato_nome?: string;
  contato_telefone?: string;
  contato_email?: string;
  vendedor_telefone?: string;
  vendedor_email?: string;
  pag_garantia?: string;
  pag_prazo_entrega?: string;
  pag_prazo_execucao?: string;
  pag_dados_bancarios?: string;
  pag_razao_social?: string;
  composicao_faturamento?: string;
  consideracoes?: string;
  anexos?: string;
  remetente_nome?: string;
  remetente_email?: string;
  remetente_telefone?: string;
}

export interface PropostaItem {
  id: string;
  categoria: string;
  descritivo: string;
  valor: number;
  ordem: number;
}

export function gerarPropostaHTML(sim: PropostaSimulacao, itens: PropostaItem[]): string {
  return _gerarHTML(sim as any, itens as any);
}

export async function abrirPropostaParaImpressao(sim: PropostaSimulacao, itens: PropostaItem[]): Promise<void> {
  return _abrir(sim as any, itens as any);
}
