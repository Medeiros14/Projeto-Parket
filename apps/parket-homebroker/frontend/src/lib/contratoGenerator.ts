/**
 * Gerador de contrato — usa o renderer OFICIAL da Parket (PGSTRUCT35) que
 * é o mesmo do `valor.parket.works` e `proposta.parket.works`. Garante paridade
 * visual 100% (capa branca + capa foto + página preta + tabela itens +
 * contrato jurídico em 2 colunas com âncoras DocuSign).
 *
 * Não gera PDF binário — gera o HTML pronto pra impressão via browser
 * (Cmd+P → Salvar como PDF). O layout usa CSS Paged Media (`@page`) que só
 * o motor de impressão do Chromium interpreta corretamente.
 */
import {
  gerarPropostaHTML as gerarSpaceHTML,
  abrirPropostaParaImpressao as abrirSpaceImpressao,
  type PropostaSimulacao,
  type PropostaItem,
} from "./propostaGeneratorSpace";

export type ContratoInput = {
  card: any;                        // kanban_cards row
  sim: any;                         // simulacao_projetos row
  itens: Array<{                    // simulacao_itens rows já no formato Space (3 linhas por produto)
    id: string;
    categoria: string;
    descritivo: string;
    valor: number;
    ordem: number;
  }>;
  contratoCliente?: Record<string, any>;  // simulacao_projetos.meta.contrato_cliente (form)
};

export function buildProposta(input: ContratoInput): { sim: PropostaSimulacao; itens: PropostaItem[] } {
  const { card, sim, itens, contratoCliente } = input;
  const cc = contratoCliente || {};
  const det = (card?.details as any) || {};

  const enderecoFinal = [cc.rua, cc.numero, cc.complemento, cc.bairro, cc.cidade, cc.uf, cc.cep]
    .filter(Boolean).join(", ") || sim?.endereco || det.endereco || det.endereco_obra || "";

  const propostaSim: PropostaSimulacao = {
    id: sim?.id,
    numero: String(sim?.numero || det.numero_proposta || ""),
    cliente: cc.nome || sim?.cliente || card?.title || "Cliente",
    cnpj_cpf: cc.cpf_cnpj || sim?.cnpj_cpf || "",
    endereco: enderecoFinal,
    obra_code: sim?.obra_code || "",
    obra_id:   sim?.obra_id,
    vendedor:  card?.responsavel || sim?.vendedor || det.vendedor || "",
    validade_dias: Number(sim?.validade_dias || 15) || 15,
    desconto_perc:  Number(sim?.desconto_perc  || 0),
    desconto_modo:  sim?.desconto_modo,
    desconto_valor: Number(sim?.desconto_valor || 0),
    frete_valor:    Number(sim?.frete_valor    || 0),
    created_at: sim?.created_at || new Date().toISOString(),
    arquiteto: cc.arquiteto_nome || sim?.arquiteto || det.arquitetura || "",
    forma_pagamento: sim?.forma_pagamento || det.forma_pagamento || "",
    contato_nome:     cc.nome     || sim?.contato_nome   || det.contato_principal,
    contato_telefone: cc.telefone || sim?.contato_telefone || det.celular || det.telefone,
    contato_email:    cc.email    || sim?.contato_email  || det.email    || det.email_comercial,
    vendedor_telefone: sim?.vendedor_telefone || det.telefone_comercial || "",
    vendedor_email:    sim?.vendedor_email    || "",
    pag_garantia:        sim?.pag_garantia        || det.pag_garantia,
    pag_prazo_entrega:   sim?.pag_prazo_entrega   || det.pag_prazo_entrega,
    pag_prazo_execucao:  sim?.pag_prazo_execucao  || det.pag_prazo_execucao,
    pag_dados_bancarios: sim?.pag_dados_bancarios || det.pag_dados_bancarios,
    pag_razao_social:    sim?.pag_razao_social    || det.pag_razao_social,
    composicao_faturamento: sim?.composicao_faturamento || "",
    consideracoes:          sim?.consideracoes || "",
    anexos: "",
    remetente_nome:     sim?.remetente_nome     || "",
    remetente_email:    sim?.remetente_email    || "",
    remetente_telefone: sim?.remetente_telefone || "",
  };

  // Os itens já vêm no formato Space (categoria || dimensao, descritivo, valor, ordem).
  // Só passa direto — o renderer sabe agrupar por categoria e mostrar totais.
  const propostaItens: PropostaItem[] = itens.map((r) => ({
    id: r.id,
    categoria: r.categoria || "OUTROS",
    descritivo: r.descritivo || "",
    valor: Number(r.valor || 0),
    ordem: Number(r.ordem || 0),
  }));

  return { sim: propostaSim, itens: propostaItens };
}

/** Gera o HTML completo (com CSS Paged Media) — usar como srcdoc de iframe.
 *  Injeta `<base href>` no head pra que os assets relativos (proposta-cover.png)
 *  resolvam contra a origem do app pai. */
export function gerarHTMLContrato(input: ContratoInput): string {
  const { sim, itens } = buildProposta(input);
  const html = gerarSpaceHTML(sim, itens);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (!origin) return html;
  // Se já tem <base>, respeita; senão injeta logo depois do <head>.
  if (/<base\s/i.test(html)) return html;
  return html.replace(/<head>/i, `<head><base href="${origin}/">`);
}

/** Abre em nova aba com print automático (Ctrl/Cmd+P → Salvar como PDF). */
export async function abrirContratoParaImpressao(input: ContratoInput): Promise<void> {
  const { sim, itens } = buildProposta(input);
  return abrirSpaceImpressao(sim, itens);
}
