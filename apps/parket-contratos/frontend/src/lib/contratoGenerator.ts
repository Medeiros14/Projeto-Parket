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
  corpoContrato?: string;                 // corpo HTML com placeholders {{CLIENTE}}, {{CPF}}, {{ENDERECO}} — sobrepõe o hardcoded do renderer
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
    // Rótulo custom da linha LOGÍSTICA (ex: "FRETE TRANSPORTE DOS MATERIAIS").
    // Vem de sim.meta.frete_desc; vazio = texto padrão do renderer.
    frete_desc:     sim?.meta?.frete_desc || "",
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

/** Escapa caracteres HTML pra uso em atributos/texto dentro de blob de string. */
function escapeHtml(s: string): string {
  return (s || "").replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string
  ));
}

/** Substitui o `<div class="contract-body">…</div>` do HTML pelo `corpoContrato`,
 *  com os placeholders {{CLIENTE}}, {{CPF}}, {{ENDERECO}} resolvidos.
 *  Se o HTML não tem o marcador ou corpoContrato é vazio, retorna o HTML original. */
function aplicarCorpoContratoCustom(html: string, corpoContrato: string, sim: PropostaSimulacao): string {
  if (!corpoContrato) return html;
  const body = corpoContrato
    .replace(/\{\{CLIENTE\}\}/g, escapeHtml(sim.cliente || ""))
    .replace(/\{\{CPF\}\}/g, escapeHtml(sim.cnpj_cpf || ""))
    .replace(/\{\{ENDERECO\}\}/g, escapeHtml(sim.endereco || ""));
  // Renderer emite exatamente `<div class="contract-body">…</div>` numa linha só.
  const re = /<div class="contract-body">[\s\S]*?<\/div>/;
  if (!re.test(html)) return html;
  return html.replace(re, `<div class="contract-body">${body}</div>`);
}

/** Gera o HTML completo (com CSS Paged Media) — usar como srcdoc de iframe.
 *  Injeta `<base href>` no head pra que os assets relativos (proposta-cover.png)
 *  resolvam contra a origem do app pai. */
export function gerarHTMLContrato(input: ContratoInput): string {
  const { sim, itens } = buildProposta(input);
  let html = gerarSpaceHTML(sim, itens);
  if (input.corpoContrato) html = aplicarCorpoContratoCustom(html, input.corpoContrato, sim);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (!origin) return html;
  // Se já tem <base>, respeita; senão injeta logo depois do <head>.
  if (/<base\s/i.test(html)) return html;
  return html.replace(/<head>/i, `<head><base href="${origin}/">`);
}

/** Abre em nova aba com print automático (Ctrl/Cmd+P → Salvar como PDF).
 *  Quando input.corpoContrato está setado, aplica o corpo custom (do
 *  editor admin) — caso contrário delega pro abridor do Space (renderer
 *  padrão hardcoded). */
export async function abrirContratoParaImpressao(input: ContratoInput): Promise<void> {
  const { sim, itens } = buildProposta(input);
  if (!input.corpoContrato) return abrirSpaceImpressao(sim, itens);
  const html = gerarHTMLContrato(input);
  const w = window.open("", "_blank");
  if (!w) throw new Error("Popup bloqueado — libere pra abrir o contrato.");
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Print automático após pequena espera pra o motor carregar assets.
  setTimeout(() => { try { w.print(); } catch {} }, 800);
}
