/** Camada de dados do PCP Produção — tabelas producao_* no Supabase Cloud Parket. */
import { sb } from "./supabase";

export type InsumoFab = {
  nome: string;
  unidade: string;
  qtd: number | string | null;
  tipo?: string | null;        // FERRAGEM | MATERIA_PRIMA | INSUMO_OBRA (modelo Excel de portas)
  conferido?: boolean;         // conferência do kit na etapa 2. PRENSA E SEPARAÇÃO
  /** Insumo digitado aqui no PCP, sem par no Valor. O watcher preserva
   *  (sync_insumos_valoria) — sem essa marca a re-sincronização apagaria. */
  manual?: boolean;
};

export type ItemFabricacao = {
  numero?: string | null;      // numeração da proposta (1.1, 1.2…)
  // Categoria da proposta: porta | marcenaria | painel | forro. Texto livre
  // porque o watcher copia direto do Valor — nunca reduzir a um par fixo.
  categoria: string;
  subtipo: string | null;
  especie: string | null;
  cor: string | null;
  dimensao: string | null;
  ambiente: string | null;
  /** Nome do produto EXATAMENTE como foi vendido na proposta (hoje só porta:
   *  "CORRER EXTERNA CARVALHO EUROPEU NEVADO"). Escrito pelo watcher com a
   *  mesma regra do encodeCategoria da Valoria, pra fábrica e cliente lerem o
   *  mesmo nome. Ausente = item antigo, cai nos campos crus. */
  titulo?: string | null;
  metragem: number;
  qtd?: number | null;         // qtd de portas (conjuntos) do orçamento
  descritivo: string | null;
  status_producao?: string | null;  // status do ITEM dentro da produção
  /* Flags de liberação sincronizadas pelo compras-contratos-watcher a partir
     de gestao.itens.meta.* (Projetos-app libera item por item, opcionalmente
     parcial + com obs pro PCP). Nunca editar aqui — origem é o Projetos. */
  liberado_projetos?: boolean;
  liberado_projetos_em?: string | null;
  liberado_projetos_por?: string | null;
  liberado_para_producao?: boolean;
  liberado_para_producao_em?: string | null;
  liberado_para_producao_por?: string | null;
  // Nome de QUEM autorizou a liberação (digitado no modal do Projetos,
  // pode ser um chefe, distinto do login em _por). Will 25/08.
  liberado_para_producao_autor?: string | null;
  qtd_liberada_producao?: number | null;
  obs_producao?: string | null;
  /* Rastro da rodada de compra: o PCP escolhe QUAIS itens entram no pedido do
     Ronaldo (ex.: manda as portas agora e segura a marcenaria). Item sem essas
     marcas = lista dele ainda NÃO foi pra compras, e o card avisa. O detalhe
     material a material continua em estoque_conferencia. Will 04/09. */
  compras_enviado_em?: string | null;
  compras_envio_id?: string | null;
  insumos?: InsumoFab[];
  /** Materiais da INSTALAÇÃO em obra (BOM de instalação da proposta). Separado
   *  do kit de fabricação de propósito: não entra na conferência do KIT nem no
   *  resumo que vai pro pedido de compra da fábrica. Painel e forro em geral só
   *  têm essa lista — sem ela o item chegava no PCP com o kit vazio. */
  insumos_instalacao?: InsumoFab[];
  porta?: {
    codigo: string | null;
    tipo: string | null;
    qtd_folhas: number | null;
    largura_cm: number | null;
    altura_cm: number | null;
    obs: string | null;
  };
};

export const STATUS_ITEM_PRODUCAO = ["CONSTRUÇÃO", "ACABAMENTO", "CONTROLE DE QUALIDADE", "EMBALAGEM"];

export const TIPOS_INSUMO: { id: string; label: string }[] = [
  { id: "MATERIA_PRIMA", label: "MATÉRIA PRIMA" },
  { id: "FERRAGEM", label: "FERRAGENS" },
  { id: "EMBALAGEM", label: "MATERIAL DE EMBALAGEM" },
];

// "Insumos" na fabricação são matéria prima (INSUMO é termo da instalação em obra).
export const tipoFab = (tipo?: string | null) =>
  tipo === "FERRAGEM" ? "FERRAGEM" : tipo === "EMBALAGEM" ? "EMBALAGEM" : "MATERIA_PRIMA";

export const kitCompleto = (it: ItemFabricacao) =>
  !!it.insumos?.length && it.insumos.every((i) => i.conferido);

/** Identidade estável do item dentro da OP, pra guardar escopo de compra sem
 *  depender do índice (o watcher reordena a lista pela numeração da proposta). */
export const chaveItemFab = (it: ItemFabricacao) =>
  [it.numero || "", it.categoria || "", it.ambiente || ""].join("|").toUpperCase();

/** Item que tem material pra comprar. Painel/forro costumam vir só com insumos
 *  de instalação, e esses não entram no pedido da fábrica. */
export const temKitFabricacao = (it: ItemFabricacao) => !!(it.insumos || []).length;

/** Soma total de todos os materiais da obra, agregando por (nome, unidade). */
export function resumoMateriais(itens: ItemFabricacao[] | null | undefined) {
  const acc = new Map<string, { tipo: string; nome: string; unidade: string; qtd: number }>();
  for (const it of itens || []) {
    for (const ins of it.insumos || []) {
      const nome = String(ins.nome || "").trim();
      if (!nome) continue;
      const un = (ins.unidade || "un").trim();
      const k = `${nome.toUpperCase()}|${un.toUpperCase()}`;
      const prev = acc.get(k);
      const q = Number(ins.qtd) || 0;
      if (prev) prev.qtd += q;
      else acc.set(k, { tipo: tipoFab(ins.tipo), nome, unidade: un, qtd: q });
    }
  }
  return [...acc.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome));
}

export type ConfItem = {
  nome: string;
  unidade: string;
  tipo: string;
  qtd_necessaria: number;
  saldo: number;           // saldo disponível no depósito (0 se não encontrado)
  abatida: number;         // min(necessária, saldo) — sai do pedido de compra
  falta: number;           // o que vai pro card do Ronaldo (se enviado)
  encontrado: boolean;
  estoque_descricao?: string | null;
  estoque_unidade?: string | null;
  /** Envio em rodadas: quando o item já foi mandado pro Ronaldo, guardamos
   *  quando/qual card foi criado — evita re-enviar. */
  enviado_at?: string | null;
  envio_id?: string | null;
  compras_card_id?: string | null;
  /** Observação livre por item — ex.: "urgente", "combinado com fornecedor X". */
  obs?: string | null;
};
export type ConferenciaEstoque = {
  at: string; por: string; deposito: string; itens: ConfItem[];
  /** Chaves (chaveItemFab) dos itens da OP que entraram nesta conferência.
   *  Ausente = conferência antiga, feita com a OP inteira. */
  escopo?: string[] | null;
};

const normNome = (s: string) =>
  String(s || "").toUpperCase().replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();

/** Bate o resumo de materiais da OP com o saldo do Almoxarifado (depósito marcenaria-curitiba).
 *  Match por descrição normalizada (sem [obs]/(dims)). Só compara — a baixa física continua
 *  sendo a Saída de Material do Almoxarifado. `anterior` preserva enviado_at/obs de conferências
 *  passadas quando refazendo — evita perder rastreio de rodada. */
export async function conferirEstoque(
  itens: ItemFabricacao[], anterior?: ConfItem[]
): Promise<ConfItem[]> {
  const { data, error } = await sb
    .from("compras_estoque_mov")
    .select("descricao,tipo,quantidade,unidade")
    .eq("deposito", "marcenaria-curitiba")
    .limit(20000);
  if (error) throw error;
  const saldo = new Map<string, { saldo: number; descricao: string; unidade: string | null }>();
  for (const m of (data as any[]) || []) {
    const k = normNome(m.descricao);
    if (!k) continue;
    const cur = saldo.get(k) || { saldo: 0, descricao: m.descricao, unidade: m.unidade };
    cur.saldo += (m.tipo === "Entrada" ? 1 : -1) * (Number(m.quantidade) || 0);
    saldo.set(k, cur);
  }
  const prevByKey = new Map<string, ConfItem>();
  (anterior || []).forEach((a) => {
    prevByKey.set(normNome(a.nome) + "|" + (a.unidade || "").toUpperCase(), a);
  });
  const usados = new Set<string>();
  const linhas = resumoMateriais(itens).map((r) => {
    usados.add(normNome(r.nome) + "|" + (r.unidade || "").toUpperCase());
    return r;
  }).map((r) => {
    const hit = saldo.get(normNome(r.nome));
    const disp = Math.max(0, hit?.saldo ?? 0);
    const abatida = Math.min(r.qtd, disp);
    const prev = prevByKey.get(normNome(r.nome) + "|" + (r.unidade || "").toUpperCase());
    return {
      nome: r.nome, unidade: r.unidade, tipo: r.tipo,
      qtd_necessaria: r.qtd, saldo: disp, abatida, falta: r.qtd - abatida,
      encontrado: !!hit,
      estoque_descricao: hit?.descricao ?? null,
      estoque_unidade: hit?.unidade ?? null,
      // Preserva o rastro de envios anteriores (não deixa perder ao re-conferir)
      enviado_at: prev?.enviado_at ?? null,
      envio_id: prev?.envio_id ?? null,
      compras_card_id: prev?.compras_card_id ?? null,
      obs: prev?.obs ?? null,
    };
  });
  // Material que já foi pro Ronaldo mas caiu fora do escopo desta rodada (o PCP
  // tirou a marcenaria, por exemplo) continua na lista como histórico. Sem isso
  // o "Já enviados" sumia e o mesmo material podia ser pedido duas vezes.
  const fora = (anterior || []).filter(
    (a) => a.enviado_at && !usados.has(normNome(a.nome) + "|" + (a.unidade || "").toUpperCase())
  );
  return [...linhas, ...fora];
}

/** Persiste a conferência na OP — o watcher abate essas qtds do card de compras no OK da lista.
 *  `itens` é opcional e só vem no envio pro Ronaldo, que carimba nos itens da OP
 *  quais entraram na rodada de compra (as duas colunas JSONB no mesmo update). */
export async function salvarConferencia(id: string, conf: ConferenciaEstoque, itens?: ItemFabricacao[] | null) {
  const patch: any = { estoque_conferencia: conf, updated_at: new Date().toISOString() };
  if (itens) patch.itens = itens;
  const { error } = await sb.from("producao_ordens").update(patch).eq("id", id);
  if (error) throw error;
}

/** Envia uma rodada de compra pro Ronaldo: cria card em dept=compras com os
 *  materiais escolhidos e marca os itens como enviados na conferência.
 *  Pode ser chamado várias vezes (uma por rodada). */
export async function enviarParaCompras(
  ordem: Ordem, indices: number[], usuario: string | null, conferencia?: ConferenciaEstoque | null,
  // Itens da OP que entraram nesta rodada (escopo escolhido no modal). Recebe a
  // lista salva inteira + as chaves escolhidas pra carimbar só esses e devolver
  // a lista completa pro banco.
  escopo?: { itens: ItemFabricacao[]; chaves: string[] } | null
): Promise<{ card_id: string; envio_id: string; qtd_itens: number }> {
  // A conferência recém-feita vive no estado do modal; o prop `ordem` só recebe
  // estoque_conferencia no próximo refetch. Sem esse parâmetro, conferir e enviar
  // na mesma sessão falhava com "Conferência não encontrada".
  const conf = conferencia || ordem.estoque_conferencia;
  if (!conf) throw new Error("Conferência de estoque não encontrada — clique em Conferir primeiro.");
  const enviar = indices.filter((i) => {
    const it = conf.itens[i];
    return it && !it.enviado_at && it.falta > 0;
  });
  if (!enviar.length) throw new Error("Nenhum item pra enviar (marque pelo menos 1 com falta > 0 e ainda não enviado).");

  const [cliente, numero] = String(ordem.cliente_projeto || "").split(" · ").map((s) => s.trim());
  // Material no formato que o Compras lê (details.materiais do form /solicitar):
  // tipo = descrição, quantidade = texto "qtd un". Sem isso a linha chega vazia
  // no card do Ronaldo (ComprasItensPanel casa por m.tipo || m.material).
  const materiais = enviar.map((i) => {
    const it = conf.itens[i];
    return {
      tipo: it.nome,
      quantidade: `${it.falta} ${it.unidade || "un"}`.trim(),
      justificativa: `OP ${ordem.id} · ${it.tipo === "FERRAGEM" ? "FERRAGEM" : "MATÉRIA PRIMA"}`,
      unidade: it.unidade,
      qtd: it.falta,
    };
  });
  const envio_id = `env-${Date.now()}`;
  const hoje = new Date().toLocaleDateString("pt-BR");

  // Projeto vinculado é obrigatório na solicitação de compras (Will 02/09):
  // casa pelo número da proposta (= core.obras.codigo) e, em último caso, pelo
  // nome do cliente. O Core usa isso pra jogar o custo na obra certa.
  let obraCore: { id: string; nome: string; codigo: string | null } | null = null;
  if (numero) {
    const { data } = await sb.schema("core").from("obras")
      .select("id,nome,codigo").eq("codigo", numero).limit(1);
    obraCore = ((data as any[]) || [])[0] || null;
  }
  if (!obraCore && cliente) {
    const { data } = await sb.schema("core").from("obras")
      .select("id,nome,codigo").ilike("nome", cliente).limit(1);
    obraCore = ((data as any[]) || [])[0] || null;
  }

  const row: any = {
    dept_id: "compras", column_id: "entrada",
    title: `Fabricação — ${cliente || ordem.cliente_projeto}${numero ? " · " + numero : ""}`,
    subtitle: `Envio ${hoje} · OP ${ordem.id}`,
    obra: obraCore?.codigo || ordem.projeto || null,
    responsavel: "Ronaldo",
    tags: ["pcp-envio"],
    checklist_done: 0, checklist_total: 0,
    details: {
      solicitante: `PCP · ${usuario || "Produção"}`,
      setor: "Produção",
      pedido_por: usuario || "Produção",
      departamento_compras: "marcenaria-ronaldo",
      responsavel_compras: "Ronaldo",
      projeto_nome: obraCore?.nome || cliente || ordem.projeto || null,
      obra_codigo: obraCore?.codigo || undefined,
      core_obra_id: obraCore?.id || undefined,
      tipo_requisicao: "obra",
      status_solicitacao: "pendente",
      data_solicitacao: new Date().toISOString(),
      data_solicitacao_fmt: hoje,
      materiais,
      itens: materiais.map((m) => `${m.quantidade} — ${m.tipo}`),
      obs: `Envio ${envio_id} da OP ${ordem.id}. Itens abatidos do Almoxarifado Curitiba não incluídos — só o que falta comprar.`,
      obs_solicitacao: `Envio ${envio_id} da OP ${ordem.id}.`,
      contrato_id: ordem.contrato_id || null,
      valoria_simulacao_id: ordem.valoria_simulacao_id || null,
      op_id: ordem.id,
      envio_id,
      origem: "pcp-envio-manual",
    },
  };
  const { data: novo, error } = await sb.from("kanban_cards").insert(row).select().single();
  if (error) throw error;
  const cardId = (novo as any).id as string;

  const agora = new Date().toISOString();
  const novaConf: ConferenciaEstoque = {
    ...conf,
    itens: conf.itens.map((it, i) =>
      enviar.includes(i) ? { ...it, enviado_at: agora, envio_id, compras_card_id: cardId } : it
    ),
  };
  // Carimba nos itens da OP quais entraram nesta rodada. É esse carimbo que faz a
  // lista de fabricação mostrar "NÃO ENVIADO PRA COMPRAS" no que ficou de fora
  // (ex.: mandou as portas agora e segurou a marcenaria). Só item com kit de
  // fabricação recebe marca: painel/forro que só tem insumo de instalação nunca
  // vai pro Ronaldo e apareceria como pendente pra sempre.
  let itensCarimbados: ItemFabricacao[] | null = null;
  if (escopo?.itens?.length) {
    const dentro = new Set(escopo.chaves || []);
    itensCarimbados = escopo.itens.map((it) =>
      dentro.has(chaveItemFab(it)) && temKitFabricacao(it)
        ? { ...it, compras_enviado_em: agora, compras_envio_id: envio_id }
        : it
    );
  }
  await salvarConferencia(ordem.id, novaConf, itensCarimbados);

  return { card_id: cardId, envio_id, qtd_itens: enviar.length };
}

/** Contagem de itens pendentes de compra (falta>0 e não enviados) — usado
 *  pelo Kanban pra piscar um badge quando a OP entra em Prensa e Separação. */
export function itensPendentes(o: Ordem): number {
  const conf = o.estoque_conferencia;
  if (!conf) return 0;
  return conf.itens.filter((c) => c.falta > 0 && !c.enviado_at).length;
}

export type AnexoOP = { name: string; url: string; mimeType?: string | null };

export type EdicaoLista = {
  at: string;
  por: string;
  justificativa: string;
  mudancas: string[];
};

export type MovimentacaoRisco = {
  at: string;
  por: string | null;
  de: string;
  para: string;
  pendencias: string[];  // ex.: ["3 itens aguardando projetos", "projeto executivo ainda não subiu"]
  observacao?: string;
};

export type Ordem = {
  id: string;
  cliente_projeto: string;
  solicitante: string;
  setor: string;
  etapa: string;
  prioridade: string;
  valor: number;
  data: string;
  pedido_por: string;
  projeto: string;
  prazo_entrega: string;
  observacoes: string;
  itens?: ItemFabricacao[] | null;
  anexos?: AnexoOP[] | null;
  edicoes?: EdicaoLista[] | null;
  movimentacoes?: MovimentacaoRisco[] | null;
  estoque_conferencia?: ConferenciaEstoque | null;
  origem?: string | null;
  lista_aprovada_at?: string | null;
  lista_aprovada_por?: string | null;
  contrato_id?: string | null;
  valoria_simulacao_id?: string | null;
  valoria_card_id?: string | null;
  /* Fase atual do card no board de Projetos (Trello). Sincronizada a cada
     ciclo pelo compras-contratos-watcher — read-only aqui. Serve pro PCP
     saber em que etapa Projetos está sem sair do card. */
  projetos_fase?: string | null;
  projetos_card_id?: string | null;
  created_at?: string;
};

/* Etapas 1 (VALIDAÇÃO) e 2 (PRENSA E SEPARAÇÃO) não exigem OK do Projetos —
   a fabricação só começa na etapa 3 (PRODUÇÃO). Will 24/08: nunca bloquear,
   só avisar e registrar quem confirmou. */
const ETAPAS_EXIGEM_LIBERACAO = new Set(["3. PRODUÇÃO",
  "4. CONTROLE DE QUALIDADE E EMBALAGEM", "5. LOGÍSTICA E TRANSPORTE"]);

export function exigeLiberacao(etapa: string): boolean {
  return ETAPAS_EXIGEM_LIBERACAO.has(etapa);
}

export type ResumoLiberacao = {
  total: number;
  liberados: number;
  aguardando: number;
  parciais: number;      // liberados com qtd MENOR que a do contrato
  conferidos: number;    // Projetos conferiu (✓ Liberar) mas não mandou produzir
  executivo_ok: boolean;
  pendencias: string[];
};

export type EstadoLiberacaoItem = {
  /* aguardando = Projetos não tocou no item
     conferido  = "✓ Liberar" no Projetos (segue pro próximo setor, NÃO é ordem de produzir)
     parcial    = liberado pra produção, mas só parte da qtd do contrato
     total      = liberado pra produção por inteiro */
  estado: "aguardando" | "conferido" | "parcial" | "total";
  base: number | null;       // qtd do contrato (portas = conjuntos, resto = m²)
  liberada: number | null;   // qtd que o Projetos autorizou produzir
  unidade: string;
  quem: string;
};

/* Estado de liberação de UM item. Vale pra qualquer categoria: a base é a qtd
   de portas quando é porta e a metragem no resto (marcenaria, forro laminado,
   painel ripado…). Antes o parcial só era detectado em porta, então marcenaria
   liberada pela metade aparecia no PCP como liberação cheia (Will 03/09). */
export function estadoLiberacaoItem(it: ItemFabricacao): EstadoLiberacaoItem {
  const porta = it.categoria === "porta";
  const base = porta ? (it.qtd || null) : (it.metragem || null);
  const liberada = it.qtd_liberada_producao ?? null;
  const quem = it.liberado_para_producao_autor
    || (it.liberado_para_producao_por || it.liberado_projetos_por || "").split("@")[0]
    || "";
  const unidade = porta ? "un" : "m²";
  if (!it.liberado_para_producao)
    return { estado: it.liberado_projetos ? "conferido" : "aguardando", base, liberada, unidade, quem };
  // Tolerância de 1 centésimo: metragem vem de float e 4.8 vs 4.80 não é parcial.
  const parcial = liberada != null && base != null && base > 0 && liberada < base - 0.01;
  return { estado: parcial ? "parcial" : "total", base, liberada, unidade, quem };
}

/* Resume o estado de liberação de projetos pra 1 OP. Usado pelo Kanban
   (chips + gate de aviso ao mover pro estágio 3) e pelo OrdemModal. */
export function liberacaoResumo(o: Ordem): ResumoLiberacao {
  const its = o.itens || [];
  const total = its.length;
  const estados = its.map(estadoLiberacaoItem);
  const liberados = estados.filter((e) => e.estado === "parcial" || e.estado === "total").length;
  const parciais = estados.filter((e) => e.estado === "parcial").length;
  const conferidos = estados.filter((e) => e.estado === "conferido").length;
  const aguardando = total - liberados;
  const executivo_ok = (o.anexos || []).some((a) =>
    /projeto\s*executivo/i.test(String(a?.name || ""))) || (o.anexos || []).length > 0;
  const pendencias: string[] = [];
  if (aguardando > 0)
    pendencias.push(`${aguardando} item(ns) sem liberação de Projetos`);
  /* Parcial não bloqueia nada, mas TEM que aparecer: o PCP só pode fabricar a
     qtd autorizada, o resto volta quando Projetos usar "Ajustar produção". */
  if (parciais > 0)
    pendencias.push(`${parciais} item(ns) com liberação parcial (produzir só a qtd autorizada)`);
  /* Will 26/08: o OK do Projetos vale SEM projeto executivo anexado —
     a liberação é a autorização em si. Falta de executivo só vira
     pendência (e dispara o aviso de risco no drag) quando ainda tem
     item aguardando liberação; com tudo liberado, segue sem aviso. */
  if (!executivo_ok && aguardando > 0)
    pendencias.push("Projeto executivo ainda não subiu");
  return { total, liberados, aguardando, parciais, conferidos, executivo_ok, pendencias };
}

/* Registra a confirmação do risco e move a OP na mesma chamada. A entrada
   fica em producao_ordens.movimentacoes[] pra auditoria (Will 24/08). */
export async function moverComRisco(
  id: string, de: string, para: string, ordem: Ordem,
  usuario: string | null, observacao: string,
): Promise<void> {
  const resumo = liberacaoResumo(ordem);
  const entry: MovimentacaoRisco = {
    at: new Date().toISOString(),
    por: usuario,
    de, para,
    pendencias: resumo.pendencias,
    observacao: observacao.trim() || undefined,
  };
  const historico = [...(ordem.movimentacoes || []), entry];
  const { error } = await sb.from("producao_ordens")
    .update({ etapa: para, movimentacoes: historico, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export type RegistroPrensa = {
  id: string;
  inicio: string;
  entrega: string;
  cliente: string;
  uf: string;
  item: string;
  lamina_natural: string;
  status: string;
  observacao: string;
  ordem: number;
};

export type RegistroMarcenaria = {
  id: string;
  prioridade: string;
  inicio: string;
  entrega: string;
  cliente: string;
  uf: string;
  item: string;
  acabamento: string;
  equipe: string;
  status: string;
  observacao: string;
  ordem: number;
};

export const ETAPAS = [
  { nome: "1. VALIDAÇÃO", wip: "Max: 5" },
  { nome: "2. PRENSA E SEPARAÇÃO", wip: "Max: 4" },
  { nome: "3. PRODUÇÃO", wip: "" },
  { nome: "4. CONTROLE DE QUALIDADE E EMBALAGEM", wip: "" },
  { nome: "5. LOGÍSTICA E TRANSPORTE", wip: "" },
  { nome: "6. EM OBRA", wip: "" },
  { nome: "7. FINALIZADO", wip: "Concluídos" },
  { nome: "8. MANUTENÇÃO E REPAROS", wip: "" },
];

/** Rótulo da categoria do item como ela sai na proposta. PAINEL e FORRO nunca
    podem aparecer como "MARCENARIA" no PCP (Will 04/09). */
export function nomeCategoriaFab(it: ItemFabricacao): string {
  const cat = String(it.categoria || "").trim().toUpperCase();
  if (cat === "PORTA") return `PORTA${it.porta?.tipo ? " " + it.porta.tipo.toUpperCase() : ""}`;
  return cat || "MARCENARIA";
}

/** Contagem por categoria pros chips do card, na ordem em que aparecem na OP.
    Porta soma conjuntos (qtd do orçamento); as demais contam linhas.
    Soma também a metragem vendida: o chão de fábrica dimensiona a produção pelo
    m², não pela quantidade de linhas (Will 04/09), então o card mostra os dois. */
export function contagemPorCategoria(itens: ItemFabricacao[] | null | undefined) {
  const acc = new Map<string, { n: number; m2: number }>();
  for (const it of itens || []) {
    const cat = String(it.categoria || "marcenaria").trim().toUpperCase();
    const n = cat === "PORTA" ? (Number(it.qtd) || 1) : 1;
    const cur = acc.get(cat) || { n: 0, m2: 0 };
    acc.set(cat, { n: cur.n + n, m2: cur.m2 + (Number(it.metragem) || 0) });
  }
  return [...acc].map(([cat, v]) => ({
    cat, n: v.n, m2: v.m2,
    label: `${v.n} ${cat === "PORTA" && v.n > 1 ? "PORTAS" : cat}`
      + (v.m2 ? ` · ${v.m2.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²` : ""),
  }));
}

/** Nome do produto como foi vendido, do jeito que tem que sair no card da
    produção (Will 04/09): categoria certa na frente (PORTA é PORTA, MARCENARIA
    é MARCENARIA) e, na sequência, o produto.

    O produto vem do descritivo da proposta porque é lá que ele está inteiro:
    marcenaria é móvel sob medida e só tem descritivo ("01 ROUPEIRO COM 02
    PORTAS DE CORRER…"), e forro/painel trazem a espécie ali ("FORRO - RIPADO
    TAUARI PREMIUM") enquanto os campos do catálogo guardam só "ripado". Sem
    descritivo, cai pros campos. PORTA fica de fora: o descritivo dela é o texto
    longo de medidas/folhas, que já sai em campo próprio logo abaixo. */
export function nomeProdutoFab(it: ItemFabricacao): string {
  const cat = nomeCategoriaFab(it);
  const campos = [it.subtipo, it.especie, it.cor].filter(Boolean).join(" · ");
  if (String(it.categoria || "").trim().toUpperCase() === "PORTA")
    // Nome vendido manda: "PORTA CORRER EXTERNA CARVALHO EUROPEU NEVADO" no
    // lugar de "PORTA CORRER · regua · Carvalho Europeu · Nevado" (Will 04/09).
    return it.titulo ? `PORTA ${it.titulo}` : [cat, campos].filter(Boolean).join(" · ");
  let desc = String(it.descritivo || "").split("\n")[0].trim();
  // Descritivo costuma repetir a categoria na frente; sem tirar sairia
  // "FORRO · FORRO - RIPADO TAUARI PREMIUM".
  if (desc.toUpperCase().startsWith(cat))
    desc = desc.slice(cat.length).replace(/^[\s\-–—:]+/, "").trim();
  if (desc.length > 90) desc = desc.slice(0, 90).trimEnd() + "…";
  return [cat, desc || campos].filter(Boolean).join(" · ");
}

export function labelItemFab(it: ItemFabricacao): string {
  const nome = nomeProdutoFab(it) + (it.ambiente ? ` — ${it.ambiente}` : "");
  return (it.numero ? `${it.numero} ` : "") + nome;
}

const fmtIns = (ins: { nome: string; unidade?: string | null; qtd?: number | string | null }) =>
  `${ins.qtd != null && ins.qtd !== "" ? ins.qtd + " " : ""}${(ins.unidade || "un")} ${ins.nome}`.trim();

/** Diff humano da lista de fabricação (insumos por item), casando insumo por nome. */
export function diffListaFabricacao(
  antes: ItemFabricacao[] | null | undefined,
  depois: ItemFabricacao[] | null | undefined
): string[] {
  const a = antes || [], d = depois || [];
  const out: string[] = [];
  const n = Math.max(a.length, d.length);
  for (let i = 0; i < n; i++) {
    const itA = a[i], itD = d[i];
    const label = labelItemFab(itD || itA);
    const insA = (itA?.insumos || []).filter((x) => String(x.nome || "").trim());
    const insD = (itD?.insumos || []).filter((x) => String(x.nome || "").trim());
    const usados = new Set<number>();
    for (const vA of insA) {
      const j = insD.findIndex((vD, idx) =>
        !usados.has(idx) && vD.nome.trim().toUpperCase() === vA.nome.trim().toUpperCase());
      if (j < 0) { out.push(`${label}: removido ${fmtIns(vA)}`); continue; }
      usados.add(j);
      const vD = insD[j];
      if (String(vA.qtd ?? "") !== String(vD.qtd ?? "") || (vA.unidade || "un") !== (vD.unidade || "un"))
        out.push(`${label}: ${vA.nome} alterado de ${fmtIns(vA)} para ${fmtIns(vD)}`);
    }
    insD.forEach((vD, idx) => {
      if (!usados.has(idx)) out.push(`${label}: adicionado ${fmtIns(vD)}`);
    });
  }
  return out;
}

/** Relatório da lista de fabricação + histórico de edições — imprime (usuário salva como PDF).
 *  Formato Will 25/08: um BLOCO por item a produzir, com ficha do item (medidas,
 *  ambiente, liberação) + tabela completa de insumos agrupada por tipo, com
 *  coluna vazia de conferência pra riscar na fábrica. */
export function imprimirRelatorioOP(o: Ordem) {
  let area = document.getElementById("print-area");
  if (!area) {
    area = document.createElement("div");
    area.id = "print-area";
    document.body.appendChild(area);
  }
  const esc = (s: unknown) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const agora = new Date().toLocaleString("pt-BR");
  const itens = o.itens || [];
  const edicoes = o.edicoes || [];
  const fmtQtd = (q: number | string | null | undefined) => {
    const n = Number(q);
    return q == null || q === "" || Number.isNaN(n) ? String(q ?? "") : n.toLocaleString("pt-BR");
  };
  // Bloco de um item: cabeçalho escuro (numeração + nome), ficha em linha e
  // tabela de insumos com grupos MATÉRIA PRIMA / FERRAGENS / EMBALAGEM.
  const blocoItem = (it: ItemFabricacao) => {
    const qtdP = it.categoria === "porta"
      ? `${it.qtd || 1} PORTA${(it.qtd || 1) > 1 ? "S" : ""}${it.porta?.qtd_folhas ? ` (${it.porta.qtd_folhas} folha${it.porta.qtd_folhas > 1 ? "s" : ""})` : ""}`
      : "";
    const medidas = it.categoria === "porta" && it.porta?.largura_cm && it.porta?.altura_cm
      ? `${it.porta.largura_cm} × ${it.porta.altura_cm} cm`
      : (it.dimensao && it.dimensao !== "—" ? it.dimensao : "");
    // Ficha do item: só campos preenchidos viram par rótulo/valor.
    const ficha: [string, string][] = [];
    if (it.ambiente) ficha.push(["Ambiente", it.ambiente]);
    if (qtdP) ficha.push(["Quantidade", qtdP]);
    if (medidas) ficha.push(["Medidas", medidas]);
    if (it.metragem) ficha.push(["Metragem", `${it.metragem.toLocaleString("pt-BR")} m²`]);
    if (it.cor) ficha.push(["Cor/Acabamento", it.cor]);
    if (it.porta?.codigo) ficha.push(["Código", it.porta.codigo]);
    if (it.status_producao) ficha.push(["Status produção", it.status_producao]);
    if (it.liberado_para_producao)
      ficha.push(["Liberação Projetos", `OK${it.liberado_para_producao_em ? ` em ${fmtData(it.liberado_para_producao_em)}` : ""}${(it.liberado_para_producao_autor || it.liberado_para_producao_por) ? ` por ${it.liberado_para_producao_autor || it.liberado_para_producao_por}` : ""}`]);
    const fichaHtml = ficha.length
      ? `<div style="font-size:10.5px;margin:5px 0 2px;line-height:1.55">${ficha.map(([k, v]) => `<span style="white-space:nowrap"><strong>${esc(k)}:</strong> ${esc(v)}</span>`).join(" &nbsp;·&nbsp; ")}</div>`
      : "";
    const descr = it.descritivo
      ? `<div style="font-size:10px;color:#333;margin:2px 0"><strong>Descritivo:</strong> ${esc(it.descritivo)}</div>` : "";
    const obs = it.obs_producao
      ? `<div style="font-size:10px;margin:3px 0;padding:4px 7px;border:1px dashed #888;background:#f6f6f6"><strong>OBS do Projetos:</strong> ${esc(it.obs_producao)}</div>` : "";
    const insumos = (it.insumos || []).filter((x) => String(x.nome || "").trim());
    // Tabela de insumos: linha-grupo por tipo + numeração corrida + coluna de
    // conferência vazia (a fábrica marca no papel item a item).
    let n = 0;
    const linhas = TIPOS_INSUMO.map(({ id, label }) => {
      const doTipo = insumos.filter((x) => tipoFab(x.tipo) === id);
      if (!doTipo.length) return "";
      return `<tr><td colspan="5" style="background:#e8e8e8;font-weight:700;font-size:9px;letter-spacing:0.08em">${esc(label)}</td></tr>` +
        doTipo.map((m) => {
          n += 1;
          return `<tr>
            <td style="text-align:center;width:26px;color:#777">${n}</td>
            <td>${esc(m.nome)}</td>
            <td style="text-align:right;white-space:nowrap;width:70px">${esc(fmtQtd(m.qtd))}</td>
            <td style="width:52px">${esc(m.unidade || "un")}</td>
            <td style="text-align:center;width:60px"><span style="display:inline-block;width:11px;height:11px;border:1.2px solid #444"></span></td>
          </tr>`;
        }).join("");
    }).filter(Boolean).join("");
    const tabela = linhas
      ? `<table style="margin-top:4px">
          <thead><tr><th style="text-align:center">#</th><th>Material</th><th style="text-align:right">Qtd</th><th>Un</th><th style="text-align:center">Conferido</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>`
      : `<div style="font-size:10.5px;color:#777;font-style:italic;margin-top:4px">Sem lista de materiais cadastrada pra este item.</div>`;
    return `
      <div style="border:1px solid #444;margin:10px 0;page-break-inside:avoid">
        <div style="background:#1c1c1c;color:#fff;padding:5px 9px;font-size:11.5px;font-weight:700;letter-spacing:0.04em">
          ${esc(labelItemFab(it))}
        </div>
        <div style="padding:4px 9px 8px">
          ${fichaHtml}${descr}${obs}${tabela}
        </div>
      </div>`;
  };
  const blocoEdicao = (e: EdicaoLista) => `
    <div style="border:1px solid #999;padding:8px 10px;margin:6px 0;page-break-inside:avoid">
      <div style="font-size:11px"><strong>${esc(new Date(e.at).toLocaleString("pt-BR"))}</strong> — ${esc(e.por)}</div>
      <div style="font-size:11px;margin-top:3px"><strong>OBS / Justificativa:</strong> ${esc(e.justificativa)}</div>
      <ul style="margin:4px 0 0;padding-left:18px;font-size:11px">
        ${e.mudancas.map((m) => `<li>${esc(m)}</li>`).join("")}
      </ul>
    </div>`;
  area.innerHTML = `
    <div class="doc-formal">
      <div class="doc-topo">
        <div><strong>MARCENARIA ARVO</strong><br/><span>Controle e Planejamento da Produção (PCP)</span></div>
        <div class="doc-tit">RELATÓRIO — LISTA DE FABRICAÇÃO · ${esc(o.id)}<br/><small>Emitido em ${esc(agora)}</small></div>
      </div>
      <div style="font-size:11px;margin:8px 0 10px">
        <strong>Cliente/Projeto:</strong> ${esc(o.cliente_projeto)} &nbsp;·&nbsp;
        <strong>Etapa:</strong> ${esc(o.etapa)} &nbsp;·&nbsp;
        <strong>Data:</strong> ${esc(fmtData(o.data))}
        ${o.prazo_entrega ? ` &nbsp;·&nbsp; <strong>Prazo entrega:</strong> ${esc(fmtData(o.prazo_entrega))}` : ""}
        ${o.lista_aprovada_at ? ` &nbsp;·&nbsp; <strong>Enviada pra Compras por:</strong> ${esc(o.lista_aprovada_por || "Produção")} em ${esc(fmtData(o.lista_aprovada_at))}` : ""}
        &nbsp;·&nbsp; <strong>Itens a produzir:</strong> ${itens.length}
      </div>
      ${itens.map(blocoItem).join("")}
      ${(() => {
        const resumo = resumoMateriais(itens);
        if (!resumo.length) return "";
        const linhas = TIPOS_INSUMO.map(({ id, label }) => {
          const doTipo = resumo.filter((r) => tipoFab(r.tipo) === id);
          if (!doTipo.length) return "";
          return `<tr><td colspan="2" style="font-weight:700;font-size:9px;letter-spacing:0.06em">${esc(label)}</td></tr>` +
            doTipo.map((r) => `<tr><td>${esc(r.nome)}</td><td style="text-align:right;white-space:nowrap">${esc(r.qtd.toLocaleString("pt-BR"))} ${esc(r.unidade)}</td></tr>`).join("");
        }).join("");
        return `
      <div style="font-size:12px;font-weight:700;margin:14px 0 4px;text-transform:uppercase;letter-spacing:0.06em">
        Resumo de materiais da obra — total pra fabricar
      </div>
      <table>
        <thead><tr><th>Material</th><th style="text-align:right">Qtd total</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>`;
      })()}
      <div style="font-size:12px;font-weight:700;margin:14px 0 4px;text-transform:uppercase;letter-spacing:0.06em">
        Histórico de edições da lista
      </div>
      ${edicoes.length
        ? edicoes.map(blocoEdicao).join("")
        : `<div style="font-size:11px;color:#555">Sem edições — lista original gerada na assinatura do contrato.</div>`}
    </div>`;
  document.body.classList.add("modo-impressao");
  const done = () => document.body.classList.remove("modo-impressao");
  window.addEventListener("afterprint", done, { once: true });
  window.print();
}

export const fmtData = (v: string | null | undefined) => {
  if (!v) return "—";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [a, m, d] = s.slice(0, 10).split("-");
    return `${d}/${m}/${a}`;
  }
  return s;
};

export const isISO = (v: string | null | undefined) => /^\d{4}-\d{2}-\d{2}/.test(String(v || ""));

/** Filtro De/Até/texto compartilhado pelas tabelas de setor. */
export function passaFiltro(
  campos: { datas: string[]; texto: string[] },
  de: string,
  ate: string,
  busca: string
): boolean {
  if (de || ate) {
    const dataRef = campos.datas.find(isISO);
    if (!dataRef) return false;
    const d = dataRef.slice(0, 10);
    if (de && d < de) return false;
    if (ate && d > ate) return false;
  }
  if (busca.trim()) {
    const q = busca.trim().toUpperCase();
    if (!campos.texto.some((tx) => String(tx || "").toUpperCase().includes(q))) return false;
  }
  return true;
}

export async function fetchOrdens(): Promise<Ordem[]> {
  const { data, error } = await sb.from("producao_ordens").select("*").order("id");
  if (error) throw error;
  return (data as unknown as Ordem[]) || [];
}

export function proximoIdOP(ordens: Ordem[]): string {
  const max = ordens.reduce((m, o) => {
    const n = parseInt(String(o.id).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return "OP-" + String(max + 1).padStart(4, "0");
}

export async function salvarOrdem(o: Partial<Ordem> & { id: string }, nova: boolean) {
  const dados = { ...o, updated_at: new Date().toISOString() };
  if (nova) {
    const { error } = await sb.from("producao_ordens").insert(o);
    if (error) throw error;
  } else {
    const { error } = await sb.from("producao_ordens").update(dados).eq("id", o.id);
    if (error) throw error;
  }
}

/** Persistência rápida da lista (status do item / conferência de kit) — sem passar pelo fluxo de justificativa. */
export async function salvarItens(id: string, itens: ItemFabricacao[]) {
  const { error } = await sb
    .from("producao_ordens")
    .update({ itens, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** OK da Produção na lista de fabricação — libera a compra pro Ronaldo (watcher cria o card). */
export async function aprovarLista(id: string, quem: string) {
  const { error } = await sb
    .from("producao_ordens")
    .update({ lista_aprovada_at: new Date().toISOString(), lista_aprovada_por: quem, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function atualizarEtapa(id: string, etapa: string) {
  const { error } = await sb
    .from("producao_ordens")
    .update({ etapa, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchPrensa(): Promise<RegistroPrensa[]> {
  const { data, error } = await sb.from("producao_prensa").select("*").order("ordem").order("id");
  if (error) throw error;
  return (data as unknown as RegistroPrensa[]) || [];
}

export async function fetchMarcenaria(): Promise<RegistroMarcenaria[]> {
  const { data, error } = await sb.from("producao_marcenaria").select("*").order("ordem").order("id");
  if (error) throw error;
  return (data as unknown as RegistroMarcenaria[]) || [];
}

export async function salvarRegistro(
  tabela: "producao_prensa" | "producao_marcenaria",
  reg: Record<string, unknown>,
  id: string | null
) {
  if (id) {
    const { error } = await sb.from(tabela).update({ ...reg, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await sb.from(tabela).insert(reg);
    if (error) throw error;
  }
}

export async function excluirRegistro(tabela: "producao_prensa" | "producao_marcenaria", id: string) {
  const { error } = await sb.from(tabela).delete().eq("id", id);
  if (error) throw error;
}

/** Exclui a OP + limpa registros ad-hoc de Prensa/Marcenaria do mesmo cliente
 *  (Will 10/08: "se exclui o card as funções dele vão junto"). Match por cliente
 *  contendo os tokens do cliente_projeto (ignora sufixo " - obra"). */
export async function excluirOrdem(id: string) {
  const { data: o } = await sb.from("producao_ordens").select("cliente_projeto").eq("id", id).single();
  const { error } = await sb.from("producao_ordens").delete().eq("id", id);
  if (error) throw error;
  const cliente = String((o as any)?.cliente_projeto || "").split(" - ")[0].trim();
  if (cliente.length >= 3) {
    // Cliente pode aparecer como "CASA FLORAIS" na prensa e "CASA FLORAIS - REINALDO MORAIS" na OP — ilike cobre os 2 sentidos.
    await sb.from("producao_prensa").delete().ilike("cliente", `%${cliente}%`);
    await sb.from("producao_marcenaria").delete().ilike("cliente", `%${cliente}%`);
  }
}

/** Impressão formal (modelo legado PCP Arvo): área oculta + window.print(). */
export function imprimirDoc(titulo: string, thead: string[], linhas: string[][]) {
  let area = document.getElementById("print-area");
  if (!area) {
    area = document.createElement("div");
    area.id = "print-area";
    document.body.appendChild(area);
  }
  const hoje = new Date().toLocaleDateString("pt-BR");
  const esc = (s: string) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  area.innerHTML = `
    <div class="doc-formal">
      <div class="doc-topo">
        <div><strong>MARCENARIA ARVO</strong><br/><span>Controle e Planejamento da Produção (PCP)</span></div>
        <div class="doc-tit">${esc(titulo)}<br/><small>Emitido em ${hoje}</small></div>
      </div>
      <table>
        <thead><tr>${thead.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
        <tbody>${linhas
          .map((r) => `<tr>${r.map((c) => `<td>${esc(c) || "-"}</td>`).join("")}</tr>`)
          .join("")}</tbody>
      </table>
    </div>`;
  document.body.classList.add("modo-impressao");
  const done = () => document.body.classList.remove("modo-impressao");
  window.addEventListener("afterprint", done, { once: true });
  window.print();
}
