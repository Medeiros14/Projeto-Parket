/** Deriva a jornada do cliente 100% dos dados do gestão:
 *  kanban → timeline; etapas_catalogo/projeto_etapas + laudos + documentos
 *  + itens → cards de etapa, pendências, próxima ação. */
import type { CenterData, Etapa, Laudo, Documento } from "./api";
import { fmtNum, fmtData } from "./api";

export const LAUDO_TIPO_LABEL: Record<string, string> = {
  "1vistoria": "1ª Vistoria Técnica",
  "2vistoria": "2ª Vistoria Técnica",
  acompanhamento: "Acompanhamento de Obras",
  entrega: "Termo de Entrega",
  reparo: "Laudo de Reparo",
  termo: "Termo de Responsabilidade",
  fotografico: "Relatório Fotográfico",
};

// Colunas internas que o cliente não precisa ver (a não ser que seja a atual)
const KANBAN_OCULTAS = new Set(["travado", "reparos", "reparos-concluidos"]);

export type JourneyStep = { id: string; label: string; status: "done" | "current" | "pending" };

// Macro-etapas da jornada do cliente: agrupam as colunas do kanban do gestão.
const MACRO_ETAPAS: { id: string; label: string; colunas: string[] }[] = [
  { id: "vistoria-tecnica", label: "Vistoria Técnica", colunas: ["entrada", "primeira-vistoria"] },
  { id: "projeto", label: "Projeto", colunas: ["projeto", "pendente", "pre-cronograma"] },
  { id: "entrega-material", label: "Entrega de Material", colunas: ["segunda-vistoria", "entrega-material", "obras-liberadas", "cronograma-final"] },
  { id: "acompanhamento", label: "Acompanhamento de Obras", colunas: ["acompanhamento", "travado", "reparos", "reparos-concluidos"] },
  { id: "conclusao", label: "Conclusão", colunas: ["obras-finalizadas"] },
];

export function journeyFromKanban(d: CenterData): JourneyStep[] {
  const atualIdx = MACRO_ETAPAS.findIndex(m => m.colunas.includes(d.kanban.atual));
  return MACRO_ETAPAS.map((m, i) => ({
    id: m.id,
    label: m.label,
    status: atualIdx < 0 ? "pending" : i < atualIdx ? "done" : i === atualIdx ? "current" : "pending",
  }));
}

export function laudoPorTipo(d: CenterData, ...tipos: string[]): Laudo | undefined {
  return d.laudos.find(l => tipos.includes(l.tipo));
}

export function docsDaEtapa(d: CenterData, numero: number): Documento[] {
  return d.documentos.filter(doc => doc.etapa_numero === numero);
}

export function areaTotalM2(d: CenterData): number {
  return d.itens
    .filter(i => (i.unidade || "").toLowerCase() === "m²" || (i.unidade || "").toLowerCase() === "m2")
    .reduce((s, i) => s + (Number(i.quantidade) || 0), 0);
}

const PRODUTO_NOME: Record<string, string> = {
  PISO: "Piso", FORRO: "Forro", PAINEL: "Painel", DECK: "Deck",
  PORTA: "Porta", ESCADA: "Escada", MARCENARIA: "Marcenaria",
  RODAPE: "Rodapé", BRISE: "Brise", PERGOLADO: "Pergolado",
};

/** Tipos de produto da obra ("Piso · Forro · Deck"), sem espécie/acabamento. */
export function produtosDaObra(d: CenterData): string {
  const vistos = new Set<string>();
  const nomes: string[] = [];
  for (const it of d.itens) {
    if (it.status === "cancelado") continue;
    const cat = (it.meta?.categoria_raiz || it.categoria || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
    if (!cat || vistos.has(cat)) continue;
    vistos.add(cat);
    nomes.push(PRODUTO_NOME[cat] || (cat.charAt(0) + cat.slice(1).toLowerCase()));
  }
  return nomes.length > 0 ? nomes.join(" · ") : "—";
}

export function acompanhamentoResumo(d: CenterData) {
  let contratado = 0, instalado = 0;
  for (const it of d.itens) {
    if (it.status === "cancelado") continue;
    const q = Number(it.quantidade) || 0;
    contratado += q;
    instalado += Number(it.meta?.obra?.qtd_instalada) || 0;
  }
  return { contratado, instalado, pendente: Math.max(contratado - instalado, 0) };
}

/** Extrai o "código pai" de um item (parte antes do primeiro ponto).
 *  Ex.: "01" → "01", "01.2" → "01". */
export function codigoRaiz(it: import("./api").ItemObra): string {
  const c = (it.meta?.codigo || (it.descritivo || "").match(/^(\d+(?:\.\d+)?)/)?.[1] || String(it.ordem));
  return String(c).split(".")[0];
}

/** Agrupa itens da obra por código-raiz (serviço). Preserva ordem contratual. */
export type ServicoGrupo = {
  chave: string;
  codigo: string;
  descricao: string;
  unidade: string;
  contratado: number;
  instalado: number;
  pendente: number;
  inicio: string | null;
  fim: string | null;
  status: string;
  observacoes: string[];
  itens: import("./api").ItemObra[];
};

const STATUS_ITEM_LABEL: Record<string, string> = {
  pendente: "Pendente", preparando: "Preparando", em_execucao: "Em execução",
  instalado: "Instalado", entregue: "Entregue", com_ressalva: "Com ressalva",
};

export function agruparPorServico(d: CenterData): ServicoGrupo[] {
  const map = new Map<string, ServicoGrupo>();
  const ord: string[] = [];
  const stripCodigo = (s: string) => (s || "").replace(/^\d+(\.\d+)?\s*[·\-]\s*/, "").trim();

  for (const it of d.itens) {
    if (it.status === "cancelado") continue;
    const chave = codigoRaiz(it);
    if (!map.has(chave)) {
      ord.push(chave);
      map.set(chave, {
        chave, codigo: chave,
        descricao: stripCodigo(it.descritivo || ""),
        unidade: it.unidade || "",
        contratado: 0, instalado: 0, pendente: 0,
        inicio: null, fim: null,
        status: "pendente", observacoes: [],
        itens: [],
      });
    }
    const g = map.get(chave)!;
    g.itens.push(it);
    g.contratado += Number(it.quantidade) || 0;
    g.instalado += Number(it.meta?.obra?.qtd_instalada) || 0;
    if (!g.unidade && it.unidade) g.unidade = it.unidade;
    if (it.previsao_inicio && (!g.inicio || it.previsao_inicio < g.inicio)) g.inicio = it.previsao_inicio;
    if (it.previsao_fim && (!g.fim || it.previsao_fim > g.fim)) g.fim = it.previsao_fim;
    const obs = it.meta?.obra?.observacao;
    if (obs && !g.observacoes.includes(obs)) g.observacoes.push(obs);
  }
  for (const g of map.values()) {
    g.pendente = Math.max(g.contratado - g.instalado, 0);
    const done = g.contratado > 0 && g.instalado >= g.contratado;
    const anyEmExec = g.itens.some(i => i.status === "em_execucao");
    const anyRessalva = g.itens.some(i => i.status === "com_ressalva");
    g.status = done ? "Concluído"
      : anyRessalva ? "Com ressalva"
      : anyEmExec ? "Em andamento"
      : g.instalado > 0 ? "Em andamento"
      : g.inicio ? "Programado"
      : "A programar";
    // Se todo mundo do grupo tem status conhecido, prefere rótulo do gestão
    if (g.itens.every(i => STATUS_ITEM_LABEL[i.status]) && g.itens.length === 1) {
      g.status = STATUS_ITEM_LABEL[g.itens[0].status];
    }
  }
  return ord.map(k => map.get(k)!);
}

/** Lista de categorias únicas da obra (Piso, Forro, Painel…), mesma
 *  nomenclatura usada no card do dashboard (produtosDaObra). */
export function produtosLista(d: CenterData): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const it of d.itens) {
    if (it.status === "cancelado") continue;
    const cat = (it.meta?.categoria_raiz || it.categoria || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
    if (!cat || vistos.has(cat)) continue;
    vistos.add(cat);
    out.push(PRODUTO_NOME[cat] || (cat.charAt(0) + cat.slice(1).toLowerCase()));
  }
  return out;
}

/** Responsável da obra: procura no laudo (conteudo.responsavel) o primeiro não-vazio. */
export function responsavelObra(d: CenterData): string {
  for (const l of d.laudos) {
    const r = (l.conteudo?.responsavel || "").trim();
    if (r) return r;
  }
  return "—";
}

/** Fiscal responsável: primeiro laudo com fiscal_nome preenchido. */
export function fiscalResponsavel(d: CenterData): string {
  for (const l of d.laudos) {
    const f = (l.fiscal_nome || "").trim();
    if (f) return f;
  }
  return "—";
}

export type StageInfo = {
  etapa: Etapa;
  numero: string;
  status: string;          // rótulo pro cliente
  micros: string[];
  action: string;
  target:
    | { kind: "document"; etapa: number }
    | { kind: "cronograma" }
    | { kind: "acompanhamento" }
    | { kind: "avaliacao" }
    | { kind: "financeiro" }
    | { kind: "link"; url: string }
    | { kind: "none" };
  hasPendency?: boolean;
};

const STATUS_ETAPA_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  concluido: "Concluído",
  com_ressalva: "Com ressalvas",
};

function labelEtapa(status: string): string {
  return STATUS_ETAPA_LABEL[status] || status;
}

// Card passou (ou está além) da coluna 'obras-liberadas' do kanban?
function obraLiberada(d: CenterData): boolean {
  const lib = d.kanban.colunas.find(c => c.id === "obras-liberadas");
  const atual = d.kanban.colunas.find(c => c.id === d.kanban.atual);
  return !!lib && !!atual && atual.ordem >= lib.ordem;
}

// Obra concluída = card em 'obras-finalizadas' (ou entrega carimbada no projeto).
function obraConcluida(d: CenterData): boolean {
  const fim = d.kanban.colunas.find(c => c.id === "obras-finalizadas");
  const atual = d.kanban.colunas.find(c => c.id === d.kanban.atual);
  return (!!fim && !!atual && atual.ordem >= fim.ordem) || !!d.projeto.entregue_em;
}

export function buildStages(d: CenterData): StageInfo[] {
  const acomp = acompanhamentoResumo(d);
  // Etapa 10 (Avaliação) foi unificada no card 9 "Entrega & Avaliação" (Will 13/07).
  return d.etapas.filter(e => e.numero !== 10).map((e): StageInfo => {
    const numero = String(e.numero).padStart(2, "0");
    const docs = docsDaEtapa(d, e.numero);
    let status = labelEtapa(e.status);
    let micros: string[] = [];
    let action = "Ver documentos";
    let target: StageInfo["target"] = docs.length
      ? { kind: "document", etapa: e.numero }
      : { kind: "none" };
    let hasPendency = false;

    if (e.numero === 1) {
      status = d.itens.length ? "Contratado" : "Pendente";
      micros = [`${d.itens.length} itens`, `${fmtNum(areaTotalM2(d))} m² total`];
      action = "Ver itens contratados";
      target = { kind: "document", etapa: 1 };
    } else if (e.numero === 2) {
      const laudo = laudoPorTipo(d, "1vistoria");
      if (laudo) {
        status = laudo.assinado ? "Concluída" : "Disponível";
        micros = [
          laudo.fiscal_nome ? `Técnico: ${laudo.fiscal_nome}` : "",
          laudo.data_vistoria ? fmtData(laudo.data_vistoria) : "",
          laudo.condicao ? "Com condições registradas" : "",
        ].filter(Boolean);
        action = "Ver relatório técnico";
        target = { kind: "document", etapa: e.numero };
        if (laudo.assinar_url && !laudo.assinado) hasPendency = true;
      }
    } else if (e.numero === 3) {
      const ck = e.meta?.checklist && Object.keys(e.meta.checklist).length
        ? e.meta.checklist
        : laudoPorTipo(d, "1vistoria")?.conteudo?.checklists;
      if (ck && Object.keys(ck).length) status = "Verificado";
      action = "Ver checklist";
      target = { kind: "document", etapa: 3 };
    } else if (e.numero === 4) {
      const laudo = laudoPorTipo(d, "2vistoria");
      if (obraLiberada(d)) status = "Liberada";
      else if (laudo) status = laudo.assinado ? "Validada" : "Em validação";
      if (laudo) {
        micros = [
          laudo.fiscal_nome ? `Técnico: ${laudo.fiscal_nome}` : "",
          laudo.data_vistoria ? fmtData(laudo.data_vistoria) : "",
          laudo.condicao ? "Com condições registradas" : "",
        ].filter(Boolean);
        action = "Ver relatório técnico";
        target = { kind: "document", etapa: e.numero };
        if (laudo.assinar_url && !laudo.assinado) hasPendency = true;
      }
      // Termo de Responsabilidade mora aqui — assinatura do cliente libera a obra
      const termoResp = laudoPorTipo(d, "termo");
      if (termoResp && !termoResp.assinado && termoResp.assinar_url) {
        status = "Aguardando assinatura";
        hasPendency = true;
        action = "Assinar termo de responsabilidade";
        target = { kind: "document", etapa: e.numero };
      }
    } else if (e.numero === 5) {
      const nPags = d.mapa?.paginas?.length ?? 0;
      const temMapa = docs.length > 0 || nPags > 0;
      if (temMapa) {
        status = "Disponível";
        micros = [`${fmtNum(areaTotalM2(d))} m² total`, `${docs.length || nPags} prancha(s)`];
        action = "Abrir mapeamento";
        target = { kind: "document", etapa: 5 };
      }
    } else if (e.numero === 6) {
      e = { ...e, titulo: "Cronograma" };
      const comData = d.itens.filter(i => i.previsao_inicio).length;
      if (comData > 0 || docs.length) status = "Ativo";
      micros = comData > 0
        ? [`${comData} de ${d.itens.length} itens com data`]
        : [`${d.itens.length} itens contratados`];
      action = "Ver cronograma";
      target = { kind: "cronograma" };
    } else if (e.numero === 7) {
      if (docs.length) {
        status = "Disponível";
        micros = [`${docs.length} arquivo(s)`, `${fmtNum(areaTotalM2(d))} m² total`];
        action = "Abrir projeto executivo";
        target = { kind: "document", etapa: 7 };
      }
    } else if (e.numero === 8) {
      status = acomp.instalado > 0 ? "Em andamento" : "A iniciar";
      const pct = acomp.contratado > 0 ? Math.round((acomp.instalado / acomp.contratado) * 100) : 0;
      micros = [
        `Contratado: ${fmtNum(acomp.contratado)}`,
        `Instalado: ${fmtNum(acomp.instalado)} (${pct}%)`,
        `Pendente: ${fmtNum(acomp.pendente)}`,
      ];
      action = "Ver evolução";
      target = { kind: "acompanhamento" };
    } else if (e.numero === 12) {
      // Definições: sempre clicável — cliente responde os campos direto no /documentos/12
      action = "Responder definições";
      target = { kind: "document", etapa: 12 };
    } else if (e.numero === 9) {
      e = {
        ...e,
        titulo: "Entrega & Avaliação",
        subtitulo: "Encerramento formal e avaliação da experiência",
        descricao: "Validação da entrega, assinatura digital do termo e avaliação da sua experiência com a Parket.",
      };
      const termo = laudoPorTipo(d, "entrega");
      const termoOk = !!termo?.assinado;
      const avalOk = !!d.avaliacao;
      if (!obraConcluida(d)) {
        // Ainda não liberado, mas cliente pode abrir a página pra ver o passo-a-passo
        status = "Pendente";
        micros = ["Liberado na conclusão da obra"];
        action = "Ver entrega";
        target = { kind: "avaliacao" };
      } else {
        micros = [termoOk ? "Termo assinado" : "Termo pendente", avalOk ? "Avaliação enviada" : "Avaliação pendente"];
        if (termo?.assinar_url && !termoOk) {
          status = "Aguardando assinatura";
          hasPendency = true;
          action = "Assinar termo";
          target = { kind: "link", url: termo.assinar_url };
        } else if (!avalOk) {
          status = termoOk ? "Avaliação pendente" : "Em andamento";
          hasPendency = termoOk;
          action = "Avaliar obra";
          target = { kind: "avaliacao" };
        } else {
          status = "Concluída";
          action = "Ver avaliação";
          target = { kind: "avaliacao" };
        }
      }
    }

    return { etapa: e, numero, status, micros, action, target, hasPendency };
  });
}

export function pendenciasCliente(d: CenterData): string[] {
  const out: string[] = [];
  for (const l of d.laudos) {
    if (l.assinar_url && !l.assinado) {
      out.push(`Assinar ${LAUDO_TIPO_LABEL[l.tipo] || l.tipo}.`);
    }
    if (l.condicao && !l.assinado) {
      for (const linha of l.condicao.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 4)) {
        out.push(linha.endsWith(".") ? linha : `${linha}.`);
      }
    }
  }
  if (!d.avaliacao && d.projeto.entregue_em) out.push("Avaliar a experiência da obra.");
  return out.slice(0, 8);
}

export function proximaAcao(d: CenterData): string {
  const pend = d.laudos.find(l => l.assinar_url && !l.assinado);
  if (pend) return `Assinar ${LAUDO_TIPO_LABEL[pend.tipo] || pend.tipo}`;
  const col = d.kanban.colunas.find(c => c.id === d.kanban.atual);
  const idx = d.kanban.colunas.findIndex(c => c.id === d.kanban.atual);
  const prox = d.kanban.colunas
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .find(c => c.ordem > (col?.ordem ?? -1) && !KANBAN_OCULTAS.has(c.id));
  void idx;
  return prox ? prox.titulo : "Acompanhar a evolução da obra";
}

export function statusAtualLabel(d: CenterData): string {
  const col = d.kanban.colunas.find(c => c.id === d.kanban.atual);
  return col ? col.titulo : d.projeto.status;
}
