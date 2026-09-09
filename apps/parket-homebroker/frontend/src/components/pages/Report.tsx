/**
 * Report — Relatório de desempenho por vendedor.
 * ==========================================================================
 * Escopo (Will 2026-08-29): o Report existe para gerar o relatório de CADA
 * vendedor, só isso. Não tem número geral da operação e não tem nada de
 * campanha, investimento ou custo de mídia. Esses números vivem na página
 * Marketing e ficam lá.
 *
 * A base do relatório é o PIPELINE DE VENDAS: cards do quadro comercial que
 * entraram no pipeline dentro do período. Entrar no pipeline é uma de duas
 * coisas: o SDR moveu o card de uma coluna de pré-vendas para uma coluna do
 * funil de vendas, ou o card nasceu direto no quadro de vendas. Editar campo do
 * card e andar de uma etapa de vendas para outra NÃO são entrada.
 *
 * O filtro "Só leads de campanha" recorta os leads que o SDR qualificou, que é
 * a mesma definição de "Leads qualificados" da página Marketing. Somado, o
 * relatório fecha com aquele número.
 *
 * Cada vendedor rende um bloco: resumo, distribuição dele nas 8 etapas de
 * vendas e a lista dos leads com a etapa atual de cada um.
 *
 * São DUAS leituras diferentes e nenhuma substitui a outra (Will 2026-08-31):
 *   - SAFRA: os leads que entraram no período e onde eles estão hoje. Responde
 *     "o que chegou pro vendedor e o que ele fez com isso".
 *   - FECHAMENTOS DO PERÍODO: os cards que o vendedor levou para Ganho ou Perda
 *     dentro da janela, não importa quando o lead entrou. Responde "quanto ele
 *     fechou neste mês". Sem isso o Davi aparecia com 1 ganho quando fechou 3,
 *     porque 2 eram leads antigos que só decidiram agora.
 *
 * Sem dinheiro no relatório (Will 2026-08-31): pipeline estimado e ticket médio
 * saíram porque eram estimativa calculada aqui a partir de metragem e preço
 * médio. Quando o valor voltar, ele vem pronto do orçamento do projeto em
 * valor.parket.works, não de conta feita nesta tela.
 *
 * Exportar PDF: o arquivo é DESENHADO, não é print da tela (Will 2026-08-29).
 * Quem monta o documento é lib/reportPdf.ts, que recebe os agregados já prontos
 * e devolve um PDF vetorial. A tela só traduz `analise.vends` para o formato de
 * entrada do gerador. São dois arquivos possíveis: o completo, que leva a lista
 * de leads junto, e o de performance, que sai com todos os vendedores, um por
 * página, só com os números.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileBarChart, Loader2, Users, CheckCircle2, XCircle,
  Download, ChevronDown, ChevronRight, Target, DollarSign,
} from "lucide-react";
import { api, useFetch, DEPT_COMERCIAL, resolveSlug, type KanbanCard } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { fmtInt, fmtDate, fmtBRL } from "../../lib/format";
import {
  gerarReportPdf, nomeArquivoReport,
  type ReportPdfInput, type VendedorPdf,
} from "../../lib/reportPdf";
import type { AppUser } from "../../lib/auth";

type Card = KanbanCard & { details?: any };

// ─── Períodos ────────────────────────────────────────────────
/**
 * A janela é sempre CORRIDA: conta pra trás a partir de hoje. "1 mês" é hoje
 * menos um mês, não o dia 1º do mês corrente.
 * Isso é de propósito (Will 2026-08-31): o Davi fechou 3 e um deles, a Marcela
 * Arruda da ArchSenso, foi dado como ganho em 31/07. Recortar o mês no dia 1º
 * derrubava esse fechamento do relatório dele.
 */
const PERIODOS = [
  { key: "7d",  label: "7 dias",  dias: 7 },
  { key: "15d", label: "15 dias", dias: 15 },
  { key: "1m",  label: "1 mês",   meses: 1 },
  { key: "3m",  label: "3 meses", meses: 3 },
  { key: "6m",  label: "6 meses", meses: 6 },
] as { key: string; label: string; dias?: number; meses?: number }[];

/**
 * Início da janela: meia-noite de hoje menos o período. Voltar N meses num dia
 * que não existe no mês de destino (31/03 menos 1 mês) escorregaria pro mês
 * seguinte, então nesse caso puxamos pro último dia do mês certo.
 */
function inicioJanela(p: { dias?: number; meses?: number }): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p.dias) { d.setDate(d.getDate() - p.dias); return d; }
  const dia = d.getDate();
  d.setMonth(d.getMonth() - (p.meses || 1));
  if (d.getDate() !== dia) d.setDate(0);
  return d;
}

/**
 * Responsáveis que existem no quadro comercial mas NÃO são vendedores, então
 * ficam de fora do relatório (Will 2026-08-29). A comparação é feita com o
 * `responsavel` do card em minúsculas, que é como o Report agrupa.
 *  - "administrador": conta do Will, os cards são teste.
 *  - "vinicius arruda": é SDR, qualifica o lead e repassa, não fecha venda.
 */
const NAO_VENDEDORES = new Set(["administrador", "vinicius arruda"]);

/**
 * Funil de vendas, na ordem em que o lead caminha dentro do quadro comercial.
 * A chave é o slug real da coluna em produção.
 */
type Desfecho = "aberto" | "ganho" | "perda";
const FUNIL: { key: string; label: string; desfecho: Desfecho }[] = [
  { key: "novas-oportunidades",   label: "Novas Oportunidades",     desfecho: "aberto" },
  { key: "contato-inicial",       label: "Contato Inicial",         desfecho: "aberto" },
  { key: "criacao-orcamento",     label: "Criação de Orçamento",    desfecho: "aberto" },
  { key: "apresentacao-proposta", label: "Apresentação / Proposta", desfecho: "aberto" },
  { key: "em-negociacao",         label: "Em Negociação",           desfecho: "aberto" },
  { key: "lembretes",             label: "Lembretes",               desfecho: "aberto" },
  { key: "ganho",                 label: "Ganho",                   desfecho: "ganho" },
  { key: "perda",                 label: "Perda",                   desfecho: "perda" },
];
const FUNIL_MAP = new Map(FUNIL.map((f) => [f.key, f]));

/**
 * Colunas do quadro de PRÉ-VENDAS (comercial-entrada). Sair de uma delas e cair
 * numa coluna do funil de vendas é o momento em que o SDR entrega o lead ao
 * vendedor. É esse evento que define "entrou no pipeline no período".
 *
 * "contato-inicial" fica de fora de propósito: esse slug existe nos DOIS
 * quadros e card_movements grava só o slug, sem o dept. Aceitar ele faria
 * qualquer avanço normal dentro do funil de vendas (contato-inicial ->
 * apresentacao-proposta, por exemplo) ser lido como lead novo.
 */
const COLS_PREVENDAS = new Set([
  "leads-entrada", "triagem-ia", "em-qualificacao", "qualificado", "qualificado-ia",
  "nao-qualificado", "follow-up-1", "follow-up-2", "follow-up-3",
]);

// Colunas do funil de vendas (destino da entrega do SDR).
const COLS_VENDAS = new Set([
  "novas-oportunidades", "criacao-orcamento", "apresentacao-proposta",
  "em-negociacao", "ganho", "perda", "lembretes",
]);

export function ReportPage({ appUser }: { appUser: AppUser }) {
  const [periodoKey, setPeriodoKey] = useState<string>("1m");
  const [vendedorFiltro, setVendedorFiltro] = useState<string>("todos");
  // Recorte de origem do relatório: todos os leads ou só os que vieram de campanha.
  const [origemFiltro, setOrigemFiltro] = useState<"todos" | "campanha">("todos");
  // Guarda quem está RECOLHIDO: o relatório abre com todos os vendedores abertos.
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const periodo = PERIODOS.find((p) => p.key === periodoKey) || PERIODOS[2];

  const sinceISO = useMemo(() => inicioJanela(periodo).toISOString(), [periodo.key]);

  // Rótulo com as datas reais da janela ("Mês atual: 01/08/2026 a 31/08/2026").
  // Sem isso o vendedor não tem como conferir por que um fechamento entrou ou
  // ficou de fora da contagem.
  const periodoLabel = useMemo(() => {
    const de = new Date(sinceISO).toLocaleDateString("pt-BR");
    const ate = new Date().toLocaleDateString("pt-BR");
    return `${periodo.label}: ${de} a ${ate}`;
  }, [sinceISO, periodo.label]);

  // Só o quadro de vendas. Pré-vendas (comercial-entrada) não entra no Report.
  const cardsCom = useFetch(() => api.cardsWithDetails(DEPT_COMERCIAL), []);
  const cols = useFetch(() => api.columns(), []);

  // Movimentos do período. card_movements é um log de auditoria genérico: a
  // coluna `notes` diz o tipo do evento ("move", "create", "edit" ou
  // "details.<campo>"). Nas linhas de edição de campo, from_column/to_column
  // guardam lixo (timestamps, "true", texto livre), então só "move" e "create"
  // servem para dizer que o card andou.
  const movs = useFetch<{ card_id: string; from_column: string | null; to_column: string | null; moved_at: string; notes: string | null; moved_by: string | null }[]>(async () => {
    const r = await supabase.from("card_movements")
      .select("card_id,from_column,to_column,moved_at,notes,moved_by")
      .gte("moved_at", sinceISO)
      .eq("to_dept", DEPT_COMERCIAL)
      .limit(50000);
    if (r.error) throw r.error;
    return r.data || [];
  }, [sinceISO]);

  // Leads qualificados pelo SDR no período: card que passou pela coluna
  // "qualificado" (o SDR apertou o botão). É a MESMA definição usada na página
  // /marketing, para os dois relatórios fecharem no mesmo número.
  const qualifs = useFetch<{ card_id: string }[]>(async () => {
    const r = await supabase.from("card_movements")
      .select("card_id")
      .gte("moved_at", sinceISO)
      .eq("to_column", "qualificado")
      .limit(50000);
    if (r.error) throw r.error;
    return r.data || [];
  }, [sinceISO]);

  /**
   * Fechamentos da janela: card_id -> { data, quem } do momento em que o card
   * foi para Ganho ou Perda. Vale a movimentação MAIS RECENTE, porque card que
   * foi pra Perda e voltou pra Ganho fechou como ganho. Só evento "move" real
   * conta: nas linhas de edição de campo o to_column guarda lixo (já apareceu um
   * JSON de análise com a palavra "GANHO" dentro virando fechamento fantasma).
   * O log grava cada evento duas vezes, daí a deduplicação.
   *
   * O `por` é quem apertou o botão, e é ele que decide de quem é a venda. Ver o
   * comentário do bloco 4b.
   *
   * Isso mora fora do cálculo principal porque a busca do valor das propostas
   * precisa da lista de cards ganhos ANTES de o relatório ser montado.
   */
  const fechadoAt = useMemo(() => {
    const m = new Map<string, { at: string; por: string }>();
    const vistos = new Set<string>();
    for (const r of movs.data || []) {
      const chave = `${r.card_id}|${r.moved_at}|${r.from_column}|${r.to_column}|${r.notes}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      if (r.notes !== "move") continue;
      const para = (r.to_column || "").toLowerCase();
      if (para !== "ganho" && para !== "perda") continue;
      const atual = m.get(r.card_id);
      if (!atual || atual.at < r.moved_at) m.set(r.card_id, { at: r.moved_at, por: r.moved_by || "Sistema" });
    }
    return m;
  }, [movs.data]);

  // Cards que o vendedor levou para Ganho dentro da janela E que continuam em
  // Ganho hoje. É essa lista que vai buscar o valor no orçamento.
  const ganhoIds = useMemo(() => {
    const columns = cols.data || [];
    return (cardsCom.data || [])
      .filter((c: Card) => fechadoAt.has(c.id)
        && (resolveSlug(c.column_id, columns) || "").toLowerCase() === "ganho")
      .map((c: Card) => c.id);
  }, [cardsCom.data, cols.data, fechadoAt]);

  /**
   * Valor de cada ganho, vindo do orçamento do projeto (valor.parket.works).
   * Nada é calculado aqui: o número é o total da proposta ATIVA do card, que é
   * a mesma conta que o card mostra na aba Propostas (bruto dos itens, menos o
   * desconto no modo em que ele foi dado, mais o frete).
   *
   * Ganho sem proposta vinculada fica sem valor e aparece com traço. Inventar
   * valor por metragem foi justamente o que o Will mandou tirar do Report.
   */
  const propostas = useFetch<Record<string, { numero: string | null; valor: number }>>(async () => {
    if (!ganhoIds.length) return {};
    const sims = await supabase.from("simulacao_projetos")
      .select("id,numero,card_comercial_id,selected_at,created_at,desconto_perc,desconto_modo,desconto_valor,frete_valor,meta")
      .in("card_comercial_id", ganhoIds);
    if (sims.error) throw sims.error;
    const rows = (sims.data as any[]) || [];
    if (!rows.length) return {};

    // Soma dos itens de cada simulação: é o bruto da proposta.
    const bruto = new Map<string, number>();
    const itens = await supabase.from("simulacao_itens")
      .select("simulacao_id,valor")
      .in("simulacao_id", rows.map((r) => r.id));
    if (itens.error) throw itens.error;
    for (const i of ((itens.data as any[]) || [])) {
      bruto.set(i.simulacao_id, (bruto.get(i.simulacao_id) || 0) + Number(i.valor || 0));
    }

    // Escolhe UMA proposta por card: a que o vendedor marcou como ativa
    // (selected_at) e, entre elas, a mais recente. Sem nenhuma ativa, vale a
    // mais nova. As simulações de placeholder, criadas só para abrir a demanda
    // de orçamento, são descartadas quando existe proposta de verdade.
    const porCard = new Map<string, any[]>();
    for (const r of rows) {
      if (!r.card_comercial_id) continue;
      const lista = porCard.get(r.card_comercial_id) || [];
      lista.push(r);
      porCard.set(r.card_comercial_id, lista);
    }
    const out: Record<string, { numero: string | null; valor: number }> = {};
    for (const [cardId, lista] of porCard) {
      const reais = lista.filter((r) => r.meta?.criado_via !== "homebroker-solicitar-orcamento");
      const cand = (reais.length ? reais : lista).slice().sort((a, b) => {
        if (!!a.selected_at !== !!b.selected_at) return a.selected_at ? -1 : 1;
        return String(b.selected_at || b.created_at || "").localeCompare(String(a.selected_at || a.created_at || ""));
      })[0];
      if (!cand) continue;
      const b = bruto.get(cand.id) || 0;
      const desc = cand.desconto_modo === "valor"
        ? Number(cand.desconto_valor || 0)
        : b * (Number(cand.desconto_perc || 0) / 100);
      out[cardId] = {
        numero: cand.numero ? String(cand.numero) : null,
        valor: b - desc + Number(cand.frete_valor || 0),
      };
    }
    return out;
  }, [ganhoIds.join(",")]);

  const loading = cardsCom.loading || cols.loading || movs.loading || qualifs.loading || propostas.loading;
  const error = cardsCom.error || cols.error || movs.error || qualifs.error || propostas.error;

  // ─── Cálculo principal ────────────────────────────────────
  const analise = useMemo(() => {
    if (loading || error) return null;
    const allCards: Card[] = cardsCom.data || [];
    const columns = cols.data || [];
    const movsRows = movs.data || [];

    // 1) Última atividade do card: qualquer evento serve, inclusive edição de
    //    campo, porque mexer no card é atividade do vendedor.
    const ultimaAtiv = new Map<string, string>();
    for (const m of movsRows) {
      const cur = ultimaAtiv.get(m.card_id);
      if (!cur || cur < m.moved_at) ultimaAtiv.set(m.card_id, m.moved_at);
    }

    // 2) Entrega do SDR ao vendedor. Só evento "move" real conta, e a linha
    //    precisa sair de uma coluna de pré-vendas para uma coluna do funil de
    //    vendas. O log grava cada evento duas vezes (payloads diferentes de
    //    details), por isso a deduplicação.
    //    O fechamento do período (ida para Ganho/Perda) vem pronto do memo
    //    `fechadoAt`, que roda antes para a busca de valor saber quais cards
    //    ganhos precisam de proposta.
    const vistos = new Set<string>();
    const entregueAt = new Map<string, string>();
    for (const m of movsRows) {
      const chave = `${m.card_id}|${m.moved_at}|${m.from_column}|${m.to_column}|${m.notes}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      if (m.notes !== "move") continue;
      const de = (m.from_column || "").toLowerCase();
      const para = (m.to_column || "").toLowerCase();
      if (COLS_PREVENDAS.has(de) && COLS_VENDAS.has(para)) {
        const q = entregueAt.get(m.card_id);
        if (!q || q > m.moved_at) entregueAt.set(m.card_id, m.moved_at);
      }
    }

    // 3) Leads que entraram no pipeline de vendas no período: ou o SDR entregou
    //    dentro da janela, ou o card nasceu direto no quadro de vendas (cadastro
    //    feito pelo próprio vendedor) dentro da janela.
    const sinceDt = new Date(sinceISO);
    const noPeriodo = allCards.filter((c) => {
      if (entregueAt.has(c.id)) return true;
      return !!c.created_at && new Date(c.created_at) >= sinceDt;
    });

    // Leads qualificados pelo SDR no período (mesma conta da página /marketing).
    const qualificados = new Set((qualifs.data || []).map((q) => q.card_id));

    // 4) Monta a linha de cada lead
    type LeadRow = {
      card: Card; etapaKey: string; etapaLabel: string; desfecho: Desfecho;
      campanha: boolean;
      entregueAt: string | null; ultimaAt: string | null;
    };
    const todosLeads: LeadRow[] = noPeriodo.map((c) => {
      const slug = (resolveSlug(c.column_id, columns) || "").toLowerCase();
      const f = FUNIL_MAP.get(slug);
      return {
        card: c,
        etapaKey: f ? slug : "outros",
        etapaLabel: f?.label || slug || "Sem coluna",
        desfecho: f?.desfecho || "aberto",
        campanha: qualificados.has(c.id),
        entregueAt: entregueAt.get(c.id) || null,
        ultimaAt: ultimaAtiv.get(c.id) || c.updated_at || null,
      };
    });

    // 4b) Fechamentos do período. Aqui a base é o quadro comercial INTEIRO, não
    //     a safra: lead que entrou em junho e o vendedor fechou agora conta como
    //     fechamento deste mês. A coluna atual do card manda no desfecho, então
    //     ganho que o vendedor devolveu para negociação não fica contado.
    //     No ganho vem junto o VALOR: o total da proposta ativa do card, que é o
    //     que o cliente fechou. Ganho sem proposta vinculada fica com valor null
    //     e aparece com traço, nunca com zero (zero somaria como se a venda não
    //     valesse nada).
    //     A venda é de QUEM MOVEU o card, não de quem está como responsável
    //     (Will 2026-08-31). O card fica no funil de um vendedor mas quem arrasta
    //     pra Ganho pode ser outra pessoa: gestor fazendo acerto administrativo,
    //     ou colega registrando fechamento alheio. Foi o que inflou a Marina, que
    //     aparecia com 3 vendas tendo feito 1: as outras duas (Arq. Lídia e
    //     MARIANA E BRUNO/MYRÁ) quem moveu foi o Raphael Camargo.
    //     "Sistema" conta pro responsável: esse é o watcher de contrato assinado
    //     movendo o card sozinho, e o contrato é da venda daquele card.
    const valorPorCard = propostas.data || {};
    type FechRow = {
      card: Card; desfecho: Desfecho; at: string;
      proposta: string | null; valor: number | null;
      // Quem moveu, e se esse fechamento entra na conta do responsável do card.
      por: string; doResponsavel: boolean;
    };
    const todosFechamentos: FechRow[] = [];
    for (const c of allCards) {
      const f = fechadoAt.get(c.id);
      if (!f) continue;
      const slug = (resolveSlug(c.column_id, columns) || "").toLowerCase();
      if (slug !== "ganho" && slug !== "perda") continue;
      const p = slug === "ganho" ? valorPorCard[c.id] : undefined;
      const resp = (c.responsavel || "").trim().toLowerCase();
      const por = (f.por || "").trim();
      todosFechamentos.push({
        card: c, desfecho: slug, at: f.at,
        proposta: p?.numero ?? null,
        valor: p ? p.valor : null,
        por,
        doResponsavel: por.toLowerCase() === resp || por.toLowerCase() === "sistema",
      });
    }

    // 5) Recorte de campanha. Lead de campanha é o lead que o marketing gerou e
    //    o SDR qualificou antes de passar ao vendedor. Somando todos os
    //    vendedores, o total bate com "Leads qualificados" da página /marketing
    //    (a diferença que sobra são os qualificados que ainda não chegaram a um
    //    vendedor).
    const rows = origemFiltro === "campanha"
      ? todosLeads.filter((r) => r.campanha)
      : todosLeads;
    const fechRows = origemFiltro === "campanha"
      ? todosFechamentos.filter((f) => qualificados.has(f.card.id))
      : todosFechamentos;

    // 6) Agrupa por vendedor: o Report é isso. Os campos `fech*` são os
    //    fechamentos do período e vivem separados da safra de propósito, porque
    //    respondem perguntas diferentes e quase nunca batem entre si.
    type VendedorAgg = {
      key: string; nome: string; leads: LeadRow[];
      totalLeads: number;
      ganhos: number; perdas: number; abertos: number;
      porEtapa: Map<string, { qtd: number }>;
      fechados: FechRow[];
      fechGanhos: number; fechPerdas: number;
      // Fechamentos que caíram no funil deste vendedor mas quem moveu foi outra
      // pessoa. Ficam FORA da contagem e aparecem como nota embaixo dos KPIs,
      // pra ninguém achar que o card sumiu do relatório.
      fechDeOutros: FechRow[];
      // Soma do que o vendedor ganhou no período e quantos desses ganhos ainda
      // estão sem proposta vinculada (o total sai incompleto e a tela avisa).
      valorGanho: number; ganhosSemValor: number;
    };
    const porVendedor = new Map<string, VendedorAgg>();

    /**
     * Devolve o agregado do responsável do card, criando na hora se for a
     * primeira linha dele. Volta null quando o responsável não é vendedor
     * (admin/SDR), e aí a linha inteira é descartada: esse nome não vira bloco
     * na tela nem página no PDF.
     */
    const pegaAgg = (card: Card): VendedorAgg | null => {
      const respRaw = (card.responsavel || "").trim();
      const key = respRaw ? respRaw.toLowerCase() : "__sem_vendedor__";
      if (NAO_VENDEDORES.has(key)) return null;
      let agg = porVendedor.get(key);
      if (!agg) {
        agg = {
          key, nome: respRaw || "Sem vendedor atribuído", leads: [],
          totalLeads: 0,
          ganhos: 0, perdas: 0, abertos: 0,
          porEtapa: new Map(),
          fechados: [], fechGanhos: 0, fechPerdas: 0,
          fechDeOutros: [],
          valorGanho: 0, ganhosSemValor: 0,
        };
        porVendedor.set(key, agg);
      }
      return agg;
    };

    for (const r of rows) {
      const agg = pegaAgg(r.card);
      if (!agg) continue;
      agg.leads.push(r);
      agg.totalLeads++;
      if (r.desfecho === "ganho") agg.ganhos++;
      else if (r.desfecho === "perda") agg.perdas++;
      else agg.abertos++;
      const et = agg.porEtapa.get(r.etapaKey) || { qtd: 0 };
      et.qtd++;
      agg.porEtapa.set(r.etapaKey, et);
    }

    for (const f of fechRows) {
      const agg = pegaAgg(f.card);
      if (!agg) continue;
      // Fechamento movido por outro usuário não entra na contagem do vendedor:
      // vai pra lista de fora e é exibido como nota, não como venda dele.
      if (!f.doResponsavel) { agg.fechDeOutros.push(f); continue; }
      agg.fechados.push(f);
      if (f.desfecho === "ganho") {
        agg.fechGanhos++;
        if (f.valor == null) agg.ganhosSemValor++;
        else agg.valorGanho += f.valor;
      } else agg.fechPerdas++;
    }

    // Ordena por quem mais fechou no período, e leads no período desempata.
    const vends = [...porVendedor.values()]
      .sort((a, b) => (b.fechGanhos - a.fechGanhos) || (b.totalLeads - a.totalLeads));

    return { vends };
  }, [loading, error, cardsCom.data, cols.data, movs.data, qualifs.data, fechadoAt, propostas.data, sinceISO, origemFiltro]);

  const vendsFiltrados = useMemo(() => {
    if (!analise) return [];
    if (vendedorFiltro === "todos") return analise.vends;
    return analise.vends.filter((v) => v.key === vendedorFiltro.toLowerCase());
  }, [analise, vendedorFiltro]);

  const toggle = (key: string) => {
    setRecolhidos((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };
  const expandirTodos = () => setRecolhidos(new Set());
  const recolherTodos = () => { if (analise) setRecolhidos(new Set(analise.vends.map((v) => v.key))); };

  /**
   * Baixa o PDF. O arquivo é desenhado por lib/reportPdf.ts, não é captura de
   * tela: o que está recolhido, fora do scroll ou filtrado na tela não muda o
   * documento. `modo` decide se a lista de leads entra no arquivo e `todos`
   * ignora o filtro de vendedor para sair um vendedor por página.
   *
   * A tradução aqui é só de formato: os agregados que a tela já calculou viram
   * o VendedorPdf que o gerador espera. As etapas saem na ordem do FUNIL (não
   * na ordem em que o Map foi preenchido) e os leads na mesma ordem da tabela
   * da tela, atividade mais recente primeiro.
   */
  const gerarPDF = (modo: "completo" | "performance", todos: boolean) => {
    if (!analise) return;
    const alvo = todos ? analise.vends : vendsFiltrados;

    const vendedores: VendedorPdf[] = alvo.map((v) => ({
      nome: v.nome,
      totalLeads: v.totalLeads,
      abertos: v.abertos,
      ganhos: v.ganhos,
      perdas: v.perdas,
      fechGanhos: v.fechGanhos,
      fechPerdas: v.fechPerdas,
      // Valor vem formatado da tela pro PDF só desenhar. Ganho sem proposta
      // vinculada sai com traço, nunca com zero: zero somaria como se a venda
      // não valesse nada e o total do vendedor ficaria mentiroso.
      valorGanho: fmtBRL(v.valorGanho),
      ganhosSemValor: v.ganhosSemValor,
      fechados: v.fechados.slice()
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((f) => ({
          titulo: f.card.title || "Sem título",
          criadoEm: fmtDate(f.card.created_at),
          fechadoEm: fmtDate(f.at),
          desfecho: f.desfecho as "ganho" | "perda",
          proposta: f.proposta || "-",
          valor: f.valor != null ? fmtBRL(f.valor) : "-",
        })),
      etapas: FUNIL.flatMap((f) => {
        const d = v.porEtapa.get(f.key);
        return d ? [{ label: f.label, desfecho: f.desfecho, qtd: d.qtd }] : [];
      }),
      leads: v.leads.slice()
        .sort((a, b) => (b.ultimaAt || "").localeCompare(a.ultimaAt || ""))
        .map((l) => ({
          titulo: l.card.title || "Sem título",
          criadoEm: fmtDate(l.card.created_at),
          entregueEm: l.entregueAt ? fmtDate(l.entregueAt) : "-",
          ultimaAtiv: fmtDate(l.ultimaAt),
          etapa: l.etapaLabel,
        })),
    }));

    const input: ReportPdfInput = {
      modo,
      periodo: periodoLabel,
      recorte: origemFiltro === "campanha"
        ? "Só leads de campanha (qualificados pelo SDR)"
        : "Todos os leads",
      usuario: appUser.nome || appUser.email,
      vendedores,
    };
    gerarReportPdf(input).save(nomeArquivoReport(input));
  };

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center text-hb-textDim">
        <Loader2 size={16} className="animate-spin mr-2" /> Carregando report...
      </div>
    );
  }
  if (error) {
    return <div className="p-12 text-center text-hb-red text-sm">Erro carregando dados: {String(error)}</div>;
  }
  if (!analise) return null;

  return (
    <div className="p-4 md:p-6 space-y-4 bg-hb-bg text-hb-text min-h-full">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-display tracking-wide flex items-center gap-2">
            <FileBarChart size={18} className="text-hb-accent" />
            REPORT POR VENDEDOR
          </h1>
          <p className="text-[11px] text-hb-textDim mt-1">
            Leads que entraram no pipeline de vendas no período, por vendedor, com etapa atual de cada um,
            mais os ganhos e perdas que ele fechou dentro do período, inclusive de lead antigo.
            {origemFiltro === "campanha" && " Recorte ativo: só leads de campanha, ou seja, os que o SDR qualificou e entregou."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={periodoKey} onChange={(e) => setPeriodoKey(e.target.value)}
            className="text-[11px] bg-hb-panel border border-hb-border px-2 py-1.5 text-hb-text">
            {PERIODOS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select value={vendedorFiltro} onChange={(e) => setVendedorFiltro(e.target.value)}
            className="text-[11px] bg-hb-panel border border-hb-border px-2 py-1.5 text-hb-text">
            <option value="todos">Todos os vendedores</option>
            {analise.vends.map((v) => <option key={v.key} value={v.key}>{v.nome} ({v.totalLeads})</option>)}
          </select>
          {/* Recorte de origem: permite emitir o relatório só com os leads de campanha */}
          <select value={origemFiltro} onChange={(e) => setOrigemFiltro(e.target.value as "todos" | "campanha")}
            className="text-[11px] bg-hb-panel border border-hb-border px-2 py-1.5 text-hb-text">
            <option value="todos">Todos os leads</option>
            <option value="campanha">Só leads de campanha (qualificados)</option>
          </select>
          <button onClick={expandirTodos}
            className="text-[10px] uppercase tracking-widest px-2 py-1.5 border border-hb-border text-hb-textDim hover:text-hb-text hover:border-hb-accent">
            Expandir
          </button>
          <button onClick={recolherTodos}
            className="text-[10px] uppercase tracking-widest px-2 py-1.5 border border-hb-border text-hb-textDim hover:text-hb-text hover:border-hb-accent">
            Recolher
          </button>
          {/* PDF completo: respeita o filtro de vendedor e leva a lista de leads */}
          <button onClick={() => gerarPDF("completo", false)}
            className="text-[10px] uppercase tracking-widest px-3 py-1.5 border border-hb-border text-hb-textDim flex items-center gap-1.5 hover:text-hb-text hover:border-hb-accent">
            <Download size={12} /> PDF completo
          </button>
          {/* PDF de performance: todos os vendedores, um por página, só os números */}
          <button onClick={() => gerarPDF("performance", true)}
            className="text-[10px] uppercase tracking-widest px-3 py-1.5 bg-hb-accent text-hb-bg font-semibold flex items-center gap-1.5 hover:opacity-90">
            <Download size={12} /> PDF performance
          </button>
        </div>
      </div>

      {/* ─── Um bloco por vendedor ─────────────────────── */}
      {vendsFiltrados.length === 0 ? (
        <div className="bg-hb-panel border border-hb-border p-8 text-center text-hb-textDim text-sm">
          Nenhum lead entrou no pipeline de vendas no período selecionado.
        </div>
      ) : vendsFiltrados.map((v) => {
        const aberto = !recolhidos.has(v.key);
        // Maior etapa do próprio vendedor: a barra é relativa a ele, não à operação.
        const maxEtapa = Math.max(1, ...[...v.porEtapa.values()].map((e) => e.qtd));
        return (
          <div key={v.key} className="bg-hb-panel border border-hb-border">
            <button onClick={() => toggle(v.key)}
              className="w-full p-3 flex items-center gap-3 hover:bg-hb-panelLight text-left">
              {aberto ? <ChevronDown size={14} className="text-hb-textDim" /> : <ChevronRight size={14} className="text-hb-textDim" />}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[13px]">{v.nome}</div>
                <div className="text-[10px] text-hb-textDim mt-0.5">
                  {v.totalLeads} lead{v.totalLeads !== 1 ? "s" : ""} no período
                  {" · "}{v.fechGanhos} ganho{v.fechGanhos !== 1 ? "s" : ""} fechado{v.fechGanhos !== 1 ? "s" : ""}
                  {v.valorGanho > 0 && <>{" · "}{fmtBRL(v.valorGanho)} ganhos</>}
                </div>
              </div>
            </button>

            {aberto && (
              <div className="border-t border-hb-border p-3 space-y-4">
                {/* Resumo do vendedor, separado nos dois recortes que o relatório
                    usa. Ficavam os sete numa fileira só e davam impressão de
                    contradição: o Davi aparecia com 3 ganhos em cima e 1 na
                    distribuição, porque são contas de universos diferentes.
                    "Valor ganho" é a soma das propostas dos ganhos da janela e
                    avisa quando algum ganho ainda está sem proposta vinculada,
                    porque nesse caso o total sai por baixo. */}
                <div className="grid grid-cols-1 lg:grid-cols-[3fr_4fr] gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-hb-textDim mb-1.5">
                      Safra: leads que entraram no período
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <KPI icon={Users}  label="Leads no período" valor={fmtInt(v.totalLeads)} />
                      <KPI icon={Target} label="Em aberto"        valor={fmtInt(v.abertos)} />
                      <KPI icon={Target} label="Conversão da safra"
                        valor={v.totalLeads > 0 ? `${((v.ganhos / v.totalLeads) * 100).toFixed(0)}%` : "n/d"} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-hb-textDim mb-1.5">
                      Fechado no período, inclusive lead antigo
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <KPI icon={CheckCircle2} label="Ganhos no período" valor={fmtInt(v.fechGanhos)} positivo />
                      <KPI icon={XCircle}      label="Perdas no período" valor={fmtInt(v.fechPerdas)} negativo />
                      <KPI icon={Target}       label="Aproveitamento"
                        valor={v.fechGanhos + v.fechPerdas > 0
                          ? `${((v.fechGanhos / (v.fechGanhos + v.fechPerdas)) * 100).toFixed(0)}%`
                          : "n/d"} />
                      <KPI icon={DollarSign}
                        label={v.ganhosSemValor > 0
                          ? `Valor ganho (${v.ganhosSemValor} sem proposta)`
                          : "Valor ganho"}
                        valor={v.fechGanhos > 0 ? fmtBRL(v.valorGanho) : "n/d"} positivo />
                    </div>
                  </div>
                </div>

                {/* Nota dos fechamentos que estão no funil deste vendedor mas
                    quem arrastou pra Ganho/Perda foi outra pessoa. Não somam nos
                    KPIs acima, e ficam listados aqui pra ninguém procurar um card
                    que "sumiu" do relatório. */}
                {v.fechDeOutros.length > 0 && (
                  <div className="text-[11px] text-hb-textDim border border-hb-border rounded px-2.5 py-2 leading-relaxed">
                    <span className="uppercase tracking-widest text-[10px] text-hb-gold">
                      Fora da contagem
                    </span>
                    {": "}
                    {fmtInt(v.fechDeOutros.length)} card{v.fechDeOutros.length !== 1 ? "s" : ""} deste
                    funil {v.fechDeOutros.length !== 1 ? "foram fechados" : "foi fechado"} por outro
                    usuário, então {v.fechDeOutros.length !== 1 ? "contam" : "conta"} pra quem moveu:{" "}
                    {v.fechDeOutros
                      .slice()
                      .sort((a, b) => b.at.localeCompare(a.at))
                      .map((f, i) => (
                        <span key={f.card.id}>
                          {i > 0 && ", "}
                          <Link to={`/card/${f.card.id}`} className="text-hb-accent hover:underline">
                            {f.card.title || "Sem título"}
                          </Link>
                          {" ("}{f.desfecho === "ganho" ? "ganho" : "perda"} por {f.por || "desconhecido"}
                          {", "}{fmtDate(f.at)}{")"}
                        </span>
                      ))}
                  </div>
                )}

                {/* Fechamentos do período: o que o vendedor decidiu na janela,
                    incluindo lead antigo que só fechou agora. */}
                {v.fechados.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-hb-textDim mb-2">
                      Fechamentos no período ({fmtInt(v.fechados.length)})
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-hb-border text-hb-textDim text-[10px] uppercase tracking-widest">
                            <th className="text-left px-2 py-1.5">Cliente</th>
                            <th className="text-left px-2 py-1.5">Proposta</th>
                            <th className="text-left px-2 py-1.5">Entrou</th>
                            <th className="text-left px-2 py-1.5">Fechou em</th>
                            <th className="text-left px-2 py-1.5">Desfecho</th>
                            <th className="text-right px-2 py-1.5">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {v.fechados.slice().sort((a, b) => b.at.localeCompare(a.at)).map((f) => (
                            <tr key={f.card.id} className="border-b border-hb-border/50 hover:bg-hb-panelLight">
                              <td className="px-2 py-1.5">
                                <Link to={`/card/${f.card.id}`}
                                  className="text-hb-accent hover:underline truncate max-w-[200px] inline-block align-middle">
                                  {f.card.title || "Sem título"}
                                </Link>
                              </td>
                              {/* Número da proposta: é assim que o comercial
                                  identifica o negócio, porque o título do card
                                  costuma ser o nome do arquiteto ou um apelido. */}
                              <td className="px-2 py-1.5 tabular text-hb-textDim">{f.proposta || "-"}</td>
                              <td className="px-2 py-1.5 tabular">{fmtDate(f.card.created_at)}</td>
                              <td className="px-2 py-1.5 tabular">{fmtDate(f.at)}</td>
                              <td className="px-2 py-1.5">
                                <span className={`inline-block px-1.5 py-0.5 text-[9px] uppercase tracking-widest ${
                                  f.desfecho === "ganho" ? "bg-hb-green/20 text-hb-green" : "bg-hb-red/20 text-hb-red"
                                }`}>
                                  {f.desfecho === "ganho" ? "Ganho" : "Perda"}
                                </span>
                              </td>
                              {/* Valor do orçamento fechado. Perda não tem valor
                                  ganho, e ganho sem proposta vinculada sai com
                                  traço em vez de zero. */}
                              <td className="px-2 py-1.5 tabular text-right">
                                {f.valor != null
                                  ? <span className="text-hb-green">{fmtBRL(f.valor)}</span>
                                  : <span className="text-hb-textDim">-</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Distribuição do vendedor no funil de vendas. O universo aqui é
                    a SAFRA, então Ganho e Perda desta lista quase nunca batem com
                    os KPIs de fechamento: lead que entrou antes da janela e fechou
                    dentro dela conta no KPI e não aparece aqui. */}
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-hb-textDim mb-2">
                    Distribuição no funil, safra de {fmtInt(v.totalLeads)} lead{v.totalLeads !== 1 ? "s" : ""}
                  </div>
                  {v.ganhos !== v.fechGanhos && (
                    <div className="text-[10px] text-hb-textDim mb-2 leading-relaxed">
                      Onde estão hoje os leads que entraram no período. Ganho e Perda desta lista
                      contam só quem entrou dentro da janela, por isso aparece {fmtInt(v.ganhos)} em
                      Ganho: os {fmtInt(v.fechGanhos)} ganhos do resumo contam pela data do fechamento
                      e incluem lead que chegou antes.
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {FUNIL.map((f) => {
                      const d = v.porEtapa.get(f.key);
                      if (!d) return null;
                      const pct = v.totalLeads > 0 ? (d.qtd / v.totalLeads) * 100 : 0;
                      return (
                        <div key={f.key} className="flex items-center gap-2 text-[11px]">
                          <div className="w-44 truncate text-hb-textDim">{f.label}</div>
                          <div className="flex-1 bg-hb-panelLight h-4 relative overflow-hidden">
                            <div className={`h-full ${
                              f.desfecho === "ganho" ? "bg-hb-green" :
                              f.desfecho === "perda" ? "bg-hb-red" : "bg-hb-accent"
                            } opacity-60`} style={{ width: `${Math.max(2, (d.qtd / maxEtapa) * 100)}%` }} />
                            <div className="absolute inset-0 flex items-center px-2 text-[10px] font-medium tabular">
                              {d.qtd} lead{d.qtd !== 1 ? "s" : ""}
                            </div>
                          </div>
                          <div className="w-12 text-right text-hb-textDim tabular">{pct.toFixed(0)}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tabela de leads do vendedor. No PDF ela só entra no modo completo. */}
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-hb-textDim mb-2">Leads recebidos</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-hb-border text-hb-textDim text-[10px] uppercase tracking-widest">
                          <th className="text-left px-2 py-1.5">Cliente</th>
                          <th className="text-left px-2 py-1.5">Entrou</th>
                          <th className="text-left px-2 py-1.5">Entregue</th>
                          <th className="text-left px-2 py-1.5">Última atividade</th>
                          <th className="text-left px-2 py-1.5">Etapa atual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.leads.slice().sort((a, b) => (b.ultimaAt || "").localeCompare(a.ultimaAt || "")).map((l) => (
                          <tr key={l.card.id} className="border-b border-hb-border/50 hover:bg-hb-panelLight">
                            <td className="px-2 py-1.5">
                              <Link to={`/card/${l.card.id}`}
                                className="text-hb-accent hover:underline truncate max-w-[200px] inline-block align-middle">
                                {l.card.title || "Sem título"}
                              </Link>
                            </td>
                            <td className="px-2 py-1.5 tabular">{fmtDate(l.card.created_at)}</td>
                            <td className="px-2 py-1.5 tabular">{l.entregueAt ? fmtDate(l.entregueAt) : "-"}</td>
                            <td className="px-2 py-1.5 tabular">{fmtDate(l.ultimaAt)}</td>
                            <td className="px-2 py-1.5">
                              <span className={`inline-block px-1.5 py-0.5 text-[9px] uppercase tracking-widest ${
                                l.desfecho === "ganho" ? "bg-hb-green/20 text-hb-green" :
                                l.desfecho === "perda" ? "bg-hb-red/20 text-hb-red" :
                                "bg-hb-accent/20 text-hb-accent"
                              }`}>
                                {l.etapaLabel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="text-[9px] text-hb-textDim text-center pt-4">
        Gerado em {new Date().toLocaleString("pt-BR")} · Período: {periodoLabel}
        {" "}· Leads: {origemFiltro === "campanha" ? "só de campanha (qualificados pelo SDR)" : "todos"}
        {" "}· Usuário: {appUser.nome || appUser.email}
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, valor, hint, positivo, negativo }: {
  icon: any; label: string; valor: string; hint?: string; positivo?: boolean; negativo?: boolean;
}) {
  const cor = positivo ? "text-hb-green" : negativo ? "text-hb-red" : "text-hb-text";
  return (
    <div className="bg-hb-panel border border-hb-border p-3">
      <div className="flex items-center gap-1.5 text-hb-textDim text-[9px] uppercase tracking-widest">
        <Icon size={11} /> {label}
      </div>
      <div className={`text-lg font-semibold tabular mt-1 ${cor}`}>{valor}</div>
      {hint && <div className="text-[9px] text-hb-textDim mt-0.5">{hint}</div>}
    </div>
  );
}
