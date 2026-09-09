/**
 * Valor da proposta por card comercial do Home Broker.
 *
 * Fonte UNICA da conta que aparece em tres lugares: o card do Pipeline
 * (/book/vendas), o bloco "Propostas" dentro do card e o seletor do modal
 * Enviar Contrato. Antes o card do Pipeline mostrava o "valor na mesa"
 * (metragem x media de preco do catalogo), que e uma estimativa e por isso
 * nunca batia com a proposta real.
 *
 * Formula (identica a do modal Enviar Contrato):
 *   bruto = soma dos itens da simulacao
 *           Cloud   -> simulacao_itens.valor
 *           Valoria -> valor_material + valor_insumos + valor_instalacao
 *   desc  = desconto_modo "valor" ? desconto_valor : bruto * desconto_perc/100
 *   total = bruto - desc + frete_valor
 *
 * Tres fontes MESCLADAS de simulacao (mesma mescla do modal, bug Locasso 25/08):
 *   a) Cloud simulacao_projetos por card_comercial_id (caminho normal);
 *   b) Cloud com card_comercial_id NULL mas meta.valoria_card_id apontando pro
 *      card de orcamento deste comercial (espelhos orfaos);
 *   c) Sims da Valoria em handoff-com sem espelho no Cloud (sync parado).
 *
 * Only entram propostas JA ENVIADAS AO COMERCIAL: card de orcamento em
 * handoff-com (ou proposta-aceita, que fica depois) na Valoria, sim com
 * selected_at no Cloud, ou — sim antiga sem link de orcamento — comercial com
 * algum orcamento-filho ja enviado.
 */
import { supabase, supabaseValoria } from "./supabase";

export type PropostaValor = {
  sim_id: string;
  numero: string | number | null;
  valor_total: number;
  selected_at: string | null;
  created_at: string | null;
};

/** Quebra a lista de ids em lotes pra nao estourar o tamanho da URL do PostgREST. */
function lotes<T>(arr: T[], n = 120): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Dispara todos os lotes de um passo EM PARALELO e devolve as rows juntas.
 * Antes cada lote esperava o anterior: com ~800 cards eram ~45 round-trips
 * sequenciais e a cadeia levava >60s em conexao lenta, sendo cancelada pelo
 * reload do Book antes de terminar (Pipeline ficava sem valores, 02/09).
 * Em paralelo o passo custa 1 round-trip independente do numero de lotes.
 */
async function emLotesParalelos(ids: string[], consulta: (lote: string[]) => Promise<any>, passo: string): Promise<any[]> {
  const rows: any[] = [];
  const res = await Promise.all(lotes(ids).map((lote) => consulta(lote)));
  for (const r of res) {
    if (r.error) { console.warn(`[propostaValor] ${passo}:`, r.error.message); continue; }
    rows.push(...((r.data as any[]) || []));
  }
  return rows;
}

/** bruto - desconto + frete, com o desconto no modo certo (percentual ou valor). */
export function totalDaSim(bruto: number, sim: any): number {
  const desc = sim?.desconto_modo === "valor"
    ? Number(sim?.desconto_valor || 0)
    : bruto * (Number(sim?.desconto_perc || 0) / 100);
  return bruto - desc + Number(sim?.frete_valor || 0);
}

/**
 * Carrega as propostas enviadas ao comercial de varios cards de uma vez.
 * Retorna cardComercialId -> propostas (maior valor primeiro).
 */
export async function carregarPropostasPorCard(
  cardComercialIds: string[],
): Promise<Map<string, PropostaValor[]>> {
  const out = new Map<string, PropostaValor[]>();
  const ids = Array.from(new Set(cardComercialIds.filter(Boolean)));
  if (ids.length === 0) return out;

  const SEL = "id,numero,card_comercial_id,selected_at,created_at,desconto_perc,desconto_modo,desconto_valor,frete_valor,meta";

  // 1) Cards de orcamento espelhados deste comercial: orcId -> comercialId.
  const orcParaComercial = new Map<string, string>();
  const kcRows = await emLotesParalelos(ids, (lote) =>
    (supabase as any).from("kanban_cards")
      .select("id, details")
      .eq("dept_id", "orcamento")
      .filter("details->>parent_card_id", "in", `(${lote.join(",")})`), "espelhos orcamento");
  for (const k of kcRows) {
    const pai = k?.details?.parent_card_id;
    if (pai) orcParaComercial.set(k.id, pai);
  }
  const orcIds = Array.from(orcParaComercial.keys());

  // 2) Quais desses cards de orcamento ja foram enviados ao comercial.
  //    handoff-com = coluna de envio; proposta-aceita fica DEPOIS dela no kanban
  //    da Valoria (cliente ja aceitou), entao tambem conta como enviada.
  const emHandoff = new Set<string>();
  const csRows = await emLotesParalelos(orcIds, (lote) =>
    (supabaseValoria as any).from("cards_solicitacao")
      .select("id").in("id", lote).in("column_id", ["handoff-com", "proposta-aceita"]), "handoff valoria");
  for (const c of csRows) emHandoff.add(c.id);
  // Comerciais com ALGUM orcamento-filho ja enviado: fallback do gate pra sims
  // antigas que nao carregam meta.valoria_card_id (52 cards na auditoria 02/09).
  const comercialEnviado = new Set<string>();
  for (const orcId of emHandoff) {
    const com = orcParaComercial.get(orcId);
    if (com) comercialEnviado.add(com);
  }

  // 3) Sims do Cloud: fonte (a) por card_comercial_id + fonte (b) espelho orfao.
  //    simId -> { sim, comercialId, fonte }
  const simsCloud = new Map<string, { sim: any; comercial: string }>();
  // Fontes (a) e (b) sao independentes entre si: disparam juntas.
  const [spRows, orfRows] = await Promise.all([
    emLotesParalelos(ids, (lote) =>
      (supabase as any).from("simulacao_projetos")
        .select(SEL).in("card_comercial_id", lote), "sims cloud"),
    emLotesParalelos(orcIds, (lote) =>
      (supabase as any).from("simulacao_projetos")
        .select(SEL).is("card_comercial_id", null).in("meta->>valoria_card_id", lote), "espelhos orfaos"),
  ]);
  for (const r of spRows) {
    simsCloud.set(r.id, { sim: r, comercial: r.card_comercial_id });
  }
  for (const r of orfRows) {
    if (simsCloud.has(r.id)) continue;
    const comercial = orcParaComercial.get(r?.meta?.valoria_card_id);
    if (comercial) simsCloud.set(r.id, { sim: r, comercial });
  }

  // 4) Fonte (c): sims da Valoria em handoff-com que nao tem espelho no Cloud.
  //    Espelho tem itens conferidos, entao sempre ganha do original.
  const simsValoria = new Map<string, { sim: any; comercial: string }>();
  const numerosNoCloud = new Set(Array.from(simsCloud.values()).map((x) => Number(x.sim.numero)));
  const idsEspelhados = new Set(Array.from(simsCloud.values()).map((x) => x.sim?.meta?.valoria_simulacao_id).filter(Boolean));
  const handoffIds = Array.from(emHandoff);
  const simsVRows = await emLotesParalelos(handoffIds, (lote) =>
    (supabaseValoria as any).from("simulacoes")
      .select("id,numero,card_id,desconto_perc,desconto_valor,frete_valor,created_at,updated_at")
      .in("card_id", lote), "sims valoria");
  for (const s of simsVRows) {
    if (numerosNoCloud.has(Number(s.numero)) || idsEspelhados.has(s.id)) continue;
    const comercial = orcParaComercial.get(s.card_id);
    if (!comercial) continue;
    // Sim da Valoria nao tem desconto_modo: o campo perc e o que vale.
    simsValoria.set(s.id, {
      sim: { ...s, desconto_modo: "perc", selected_at: s.updated_at },
      comercial,
    });
  }

  // 5) Gate "enviada ao comercial": sim com selected_at, OU o orcamento DELA em
  //    handoff/aceita, OU (sim sem link de orcamento) qualquer orcamento-filho
  //    do comercial ja enviado — sem o fallback a sim antiga sem
  //    meta.valoria_card_id ficava barrada mesmo com a proposta na mesa.
  for (const [simId, x] of Array.from(simsCloud)) {
    const orcDaSim = x.sim?.meta?.valoria_card_id;
    const enviada = !!x.sim.selected_at ||
      (orcDaSim ? emHandoff.has(orcDaSim) : comercialEnviado.has(x.comercial));
    if (!enviada) simsCloud.delete(simId);
  }

  // 5.5) Duplicatas e fatias de split por cluster (comercial, numero):
  //      a) espelhos duplicados (cron insert-only, incidente 31/08): a mesma
  //         proposta foi espelhada N vezes com totais de epocas diferentes;
  //      b) split Revestimento × Marcenaria (02/09): fatias com
  //         meta.proposta_grupo gravadas AO LADO do espelho completo da mesma
  //         sim/numero.
  //      Regra: o espelho COMPLETO (sem proposta_grupo) mais recente representa
  //      a proposta; fatia NUNCA entra sozinha — o dedup antigo por "mais
  //      recente" ficava so com a fatia marcenaria e o Pipeline mostrava
  //      R$ 754k em vez de R$ 780k (NOVITA 11119, 02/09). Cluster SO de fatias
  //      (completo apagado): fica a mais recente de cada grupo e o passo 7 soma
  //      todas como proposta unica (frete/desconto ja vem rateados por fatia).
  const grupoDe = (simId: string) => (simsCloud.get(simId)?.sim?.meta?.proposta_grupo || null);
  const createdDe = (simId: string) => simsCloud.get(simId)?.sim?.created_at || "";
  const clusters = new Map<string, string[]>();
  for (const [simId, x] of simsCloud) {
    if (x.sim.numero == null) continue;
    const chave = `${x.comercial}|${x.sim.numero}`;
    const arr = clusters.get(chave) || [];
    arr.push(simId);
    clusters.set(chave, arr);
  }
  // chave -> simIds das fatias que somam juntas no passo 7 (cluster sem completo)
  const fatiasSomadas = new Map<string, string[]>();
  for (const [chave, simIds] of clusters) {
    const completos = simIds.filter((id) => !grupoDe(id));
    if (completos.length > 0) {
      const vencedor = completos.reduce((a, b) => (createdDe(b) > createdDe(a) ? b : a));
      for (const id of simIds) if (id !== vencedor) simsCloud.delete(id);
    } else {
      const porGrupo = new Map<string, string>();
      for (const id of simIds) {
        const g = String(grupoDe(id));
        const atual = porGrupo.get(g);
        if (!atual || createdDe(id) > createdDe(atual)) porGrupo.set(g, id);
      }
      const ficam = new Set(porGrupo.values());
      for (const id of simIds) if (!ficam.has(id)) simsCloud.delete(id);
      if (ficam.size > 1) fatiasSomadas.set(chave, Array.from(ficam));
    }
  }

  if (simsCloud.size === 0 && simsValoria.size === 0) return out;

  // 6) Soma dos itens de cada lado (Cloud e Valoria em paralelo).
  const [itCloudRows, itValRows] = await Promise.all([
    emLotesParalelos(Array.from(simsCloud.keys()), (lote) =>
      (supabase as any).from("simulacao_itens")
        .select("simulacao_id,valor").in("simulacao_id", lote), "itens cloud"),
    emLotesParalelos(Array.from(simsValoria.keys()), (lote) =>
      (supabaseValoria as any).from("simulacao_itens")
        .select("simulacao_id,valor_material,valor_insumos,valor_instalacao").in("simulacao_id", lote), "itens valoria"),
  ]);
  const brutoCloud = new Map<string, number>();
  for (const r of itCloudRows) {
    brutoCloud.set(r.simulacao_id, (brutoCloud.get(r.simulacao_id) || 0) + Number(r.valor || 0));
  }
  const brutoValoria = new Map<string, number>();
  for (const r of itValRows) {
    const t = Number(r.valor_material || 0) + Number(r.valor_insumos || 0) + Number(r.valor_instalacao || 0);
    brutoValoria.set(r.simulacao_id, (brutoValoria.get(r.simulacao_id) || 0) + t);
  }

  // 7) Monta o resultado por card comercial, maior valor primeiro.
  const push = (comercial: string, p: PropostaValor) => {
    if (p.valor_total <= 0) return; // sim sem itens nao vira numero na tela
    const lista = out.get(comercial) || [];
    lista.push(p);
    out.set(comercial, lista);
  };
  // Fatias de split sem espelho completo (registradas no passo 5.5) somam como
  // UMA proposta: cada fatia ja carrega frete/desconto rateado, entao o total
  // certo e a soma dos totais liquidos das fatias, nunca uma fatia isolada.
  const fatiaIds = new Set(Array.from(fatiasSomadas.values()).flat());
  for (const [simId, x] of simsCloud) {
    if (fatiaIds.has(simId)) continue; // entra somada no loop de clusters abaixo
    push(x.comercial, {
      sim_id: simId, numero: x.sim.numero,
      valor_total: totalDaSim(brutoCloud.get(simId) || 0, x.sim),
      selected_at: x.sim.selected_at || null, created_at: x.sim.created_at || null,
    });
  }
  for (const ids of fatiasSomadas.values()) {
    // identidade (sim_id/numero/datas) vem da fatia mais recente do cluster
    const rep = ids.reduce((a, b) => {
      const ca = simsCloud.get(a)?.sim?.created_at || "";
      const cb = simsCloud.get(b)?.sim?.created_at || "";
      return cb > ca ? b : a;
    });
    const x = simsCloud.get(rep);
    if (!x) continue;
    const total = ids.reduce((soma, id) => {
      const f = simsCloud.get(id);
      return f ? soma + totalDaSim(brutoCloud.get(id) || 0, f.sim) : soma;
    }, 0);
    push(x.comercial, {
      sim_id: rep, numero: x.sim.numero, valor_total: total,
      selected_at: x.sim.selected_at || null, created_at: x.sim.created_at || null,
    });
  }
  for (const [simId, x] of simsValoria) {
    push(x.comercial, {
      sim_id: simId, numero: x.sim.numero,
      valor_total: totalDaSim(brutoValoria.get(simId) || 0, x.sim),
      selected_at: x.sim.selected_at || null, created_at: x.sim.created_at || null,
    });
  }
  for (const lista of out.values()) lista.sort((a, b) => b.valor_total - a.valor_total);
  return out;
}

/** Maior valor entre as propostas do card (0 quando nao ha proposta enviada). */
export function maiorValor(props: PropostaValor[] | undefined): number {
  if (!props || props.length === 0) return 0;
  return props.reduce((m, p) => Math.max(m, p.valor_total), 0);
}
