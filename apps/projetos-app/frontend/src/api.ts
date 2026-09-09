const BASE = "/api";

export class HttpError extends Error {
  constructor(public status: number, public detail: string) {
    super(`${status} ${detail}`);
  }
}

async function fetchApi(path: string, init: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    credentials: "same-origin",   // cookies de sessão
    ...init,
  });
  if (!r.ok) {
    let detail = "";
    try { const j = await r.json(); detail = j.detail || JSON.stringify(j); }
    catch { detail = await r.text().catch(() => ""); }
    throw new HttpError(r.status, detail || r.statusText);
  }
  return r;
}

export type Lista = { id: string; nome: string; pos: number };

export type Label = { id?: string; nome: string; cor: string };
export type Membro = { id?: string; nome: string; iniciais: string };
export type ChecklistItem = { id?: string; nome: string; done: boolean };
export type Checklist = { id?: string; nome: string; itens: ChecklistItem[] };

export type BoardMeta = {
  labels: { id: string; nome: string; cor: string }[];
  membros: { id: string; nome: string; iniciais: string }[];
  listas?: { id: string; nome: string; pos: number }[];
};

export type CardPatch = {
  nome?: string; descricao?: string; due?: string;
  due_complete?: boolean; lista_id?: string;
};

export type CardLeve = {
  id: string; lista_id: string; nome: string; descricao: string; pos: number;
  due: string | null; due_complete: boolean;
  labels: Label[]; membros: Membro[];
  short_link: string | null; space_card_id: string | null;
  date_last_activity: string | null;
  capa: string | null;                 // path relativo servido em /anexos/…
  n_anexos: number; n_comentarios: number;
  chk_total: number; chk_done: number;
  // Backcompat: representa o PRIMEIRO responsável (mais antigo). Um card
  // pode ter N — a lista completa está em `responsaveis[]`. Legado (CardModal,
  // views antigas) ainda lê esses campos como "responsável principal".
  projetista_id: string | null;
  tipos: string[] | null;
  tamanho: string | null;
  prioridade: string | null;
  prazo: string | null;
  etapa_projetista: string | null;
  etapa_projetista_em: string | null;
  // Multi-responsáveis (Will 26/08): cada pessoa com seu próprio tipo/tamanho/
  // prioridade/prazo/etapa. Se vazio, ninguém foi atribuído ainda.
  responsaveis: ResponsavelCard[];
  pendentes_projetos: number;          // itens não-liberados (chip vermelho no kanban)
  tem_aditivo: boolean;                // >=1 sim aditiva na Valor (tag ADITIVO)
  fiscal_novo: boolean;                // fiscal registrou algo depois da última vez que este user abriu a aba
  aditivo_novo: boolean;               // idem pra aditivo
  // gestao.projetos (LEFT JOIN por card_id) — pode ser null se card sem projeto
  cliente: string | null;
  endereco: string | null;
  cnpj_cpf: string | null;
  // Fiscais atribuídos pela gestora em kanban_cards.details.fiscais[] (Cloud) —
  // agrega todos os irmãos da obra (fiscal geralmente fica no card operacional).
  fiscais_nomes: string[];
  // Grupos de produto do card (Will 01/09): "REVESTIMENTO" e/ou "MARCENARIA",
  // classificados no backend a partir de gestao.itens. Vazio = card sem itens
  // (aparece só na visão "Todos" do seletor do kanban).
  grupos_produto: string[];
};

// Uma linha de card_projetistas — pessoa + campos por pessoa.
export type ResponsavelCard = {
  projetista_id: string;
  nome: string | null;
  avatar_color: string | null;
  tipos: string[];
  tamanho: string | null;
  prioridade: string;
  prazo: string | null;
  etapa_projetista: string;
  etapa_projetista_em: string | null;
};

export type CalendarTipo = "evento" | "chamada" | "tarefa";
export type CalendarRSVP = "sim" | "nao" | "talvez";

export type CalendarEvento = {
  id: number;
  user_id: string;
  autor_nome: string;
  autor_email: string | null;
  title: string;
  descr: string | null;
  dt_start: string;
  dt_end: string | null;
  all_day: boolean;
  cor: string;
  convidados: string[];
  card_id: string | null;
  local: string | null;
  tipo: CalendarTipo;
  link_chamada: string | null;
  lembretes: number[];
  rrule: string | null;
  rsvp: Record<string, CalendarRSVP>;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  recorrente?: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type CalendarEventoIn = {
  title: string;
  descr?: string;
  dt_start: string;
  dt_end?: string | null;
  all_day?: boolean;
  cor?: string;
  convidados?: string[];
  card_id?: string | null;
  local?: string;
  tipo?: CalendarTipo;
  link_chamada?: string | null;
  lembretes?: number[];
  rrule?: string | null;
  responsavel_id?: string | null;
};

export type AditivoSim = {
  id: string;
  numero: number | string | null;
  status: string | null;
  cliente: string | null;
  created_at: string | null;
  orcamentista: string | null;
  vendedor: string | null;
  pai_sim_id: string | null;
  meta: Record<string, any> | null;
};

/** Extrai UF (2 letras) e cidade do string livre do endereço.
 *  Padrões suportados: "... - UF" · "... CIDADE-UF" · "... CIDADE - UF".
 *  Retorna {} quando não achar. */
const UF_RE = /(?:^|[\s,-])([A-Z]{2})\s*$/;
export function parseEndereco(endereco?: string | null): { cidade: string; estado: string } {
  const s = (endereco || "").trim().toUpperCase();
  if (!s) return { cidade: "", estado: "" };
  const m = s.match(UF_RE);
  const estado = m ? m[1] : "";
  // Cidade = último token antes da UF (ou última parte se sem UF).
  let resto = estado ? s.slice(0, m!.index).replace(/[-,\s]+$/, "") : s;
  // Pega a última palavra antes do UF (comprida) — heurística boa pra "SAO PAULO-SP", "BRASILIA-DF".
  const tokens = resto.split(/[,\s-]+/).filter(Boolean);
  // Tenta pegar 2 últimos tokens se o penúltimo for pequeno (SAO PAULO, RIO DE JANEIRO)
  const cidade = tokens.slice(-3).join(" ").trim();
  return { cidade, estado };
}

export type AppUser = {
  id: string; email: string; nome: string;
  role: string; avatar_color: string; ativo: boolean;
  papel: "gestora" | "projetista" | "";
  is_gestora: boolean;
  especialidade: "marcenaria" | "instalacao" | "ambos";
  can_view: boolean;
  // JWT do parket-chat emitido pelo backend no login/me. O widget do chat
  // procura sozinho a sessão do Supabase, que o projetos não tem — sem esse
  // token ele não renderiza nada (nem o balão).
  chat_token?: string;
};

export type ProjetistaListItem = {
  id: string; email: string; nome: string;
  avatar_color: string; papel: "gestora" | "projetista";
  especialidade: "marcenaria" | "instalacao" | "ambos";
};

export type Anexo = {
  id: string; nome: string; mime: string | null; bytes: number | null;
  url_trello: string | null; path_local: string | null;
  is_imagem: boolean; is_upload: boolean; baixado: boolean; criado_em: string | null;
};

export type Comentario = { id: string; autor: string; texto: string; data: string | null };

// Comentário local (novo modelo desde 25/08 — nome real do login Space + edit/delete)
export type ComentarioLocal = {
  id: number;
  user_id: string | null;
  autor_nome: string;
  autor_email: string | null;
  texto: string;
  anexo_url: string | null;
  anexo_nome: string | null;
  anexo_mime: string | null;
  anexo_bytes: number | null;
  created_at: string | null;
  edited_at: string | null;
};

export type CardDetalhe = CardLeve & {
  descricao: string; checklists: Checklist[]; lista_nome: string;
  url: string | null; anexos: Anexo[]; comentarios: Comentario[];
  comentarios_locais: ComentarioLocal[];
  numero_proposta?: string | null;
  obra_code?: string | null;
};

export type Board = {
  listas: Lista[]; cards: CardLeve[];
};

export type ItemAnexo = {
  id: string; url: string; nome: string; tipo: string;
  origem: string;  // 'projetos' | 'fiscal' | 'instala' | 'upload' | …
  por: string | null; criado_em: string | null;
};

export type ItemProjeto = {
  id: string; ordem: number; categoria: string; categoria_raiz: string;
  descritivo: string; ambiente: string;
  quantidade: number; unidade: string; status: string;
  codigo: string; produto_header: string; pavimento: string;
  pode_producao: boolean;
  liberado_projetos: boolean;
  liberado_projetos_em: string | null; liberado_projetos_por: string | null;
  liberado_para_producao: boolean; liberado_para_producao_em: string | null;
  liberado_para_producao_por: string | null;
  // Nome de QUEM autorizou a liberação (digitado no modal; pode ser um chefe)
  liberado_para_producao_autor: string | null;
  qtd_liberada_producao: number | null;
  obs_producao: string;
  liberacoes_log: { em: string; por?: string; acao: string; qtd?: number; qtd_total?: number; obs?: string; autor?: string }[];
  capturas_campo: ItemAnexo[];   // fotos que fiscal/instala subiram
};

export type ItensDoCard = {
  projeto: { id: string; cliente: string } | null;
  itens: ItemProjeto[];
  medicao_fina: ItemAnexo[];     // docs da medição fina — nível card
};

// ─── Relatório (BI saúde do setor — só gestora) ───────────────────
export type RelatorioFunilFase = {
  fase: string; cards: number; due_vencido: number;
  dias_parado_med: number; dias_parado_max: number;
  com_resp: number; sem_resp: number;
};
export type RelatorioTimeLinha = {
  projetista: string; cards: number; atraso_real: number;
  prazo_sujo: number; em_aberto: number; entregues: number;
};
export type RelatorioAtraso = {
  card_id: string; nome: string; fase: string; projetista: string;
  prazo: string; dias_atraso: number; etapa_projetista: string | null;
};
export type RelatorioParado = {
  card_id: string; nome: string; fase: string; dias_parado: number;
};
export type RelatorioLiberacao = {
  card_id: string; nome: string; fase: string; itens_nao_liberados: number;
};
export type Relatorio = {
  kpis: {
    cards_abertos: number; sem_responsavel: number; fila_entrada: number;
    atrasos_reais: number; prazos_sujos: number; due_vencido: number;
    cards_liberacao_pendente: number; parados_30d: number;
  };
  funil: RelatorioFunilFase[];
  time: RelatorioTimeLinha[];
  atrasos_reais: RelatorioAtraso[];
  parados: RelatorioParado[];
  liberacao: RelatorioLiberacao[];
  mix: Record<string, { marcenaria: number; revestimento: number; sem_itens: number }>;
};
export type RelatorioInsight = { titulo: string; detalhe: string; prioridade: "alta" | "media" | "baixa" };
export type RelatorioInsights = {
  gerado_em: string; modelo: string | null; cache: boolean; insights: RelatorioInsight[];
};

async function get<T>(path: string): Promise<T> {
  const r = await fetchApi(path);
  return r.json();
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const r = await fetchApi(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

export const api = {
  // ─── auth ─────────────────────────────────────────
  authMe: () => get<AppUser>("/auth/me"),
  authLogin: (email: string, senha: string) =>
    send<{ ok: true; usuario: AppUser }>("/auth/login", "POST", { email, senha }),
  authLogout: () => send<{ ok: true }>("/auth/logout", "POST"),
  projetistas: () => get<{ projetistas: ProjetistaListItem[] }>("/projetistas"),
  // Formato legado (1 pessoa; substitui a lista inteira por essa única).
  // Mantido pra CardModal + integrações antigas que só sabem de 1 responsável.
  delegarCard: (cardId: string, projetista_id: string | null,
                extras?: { tipos?: string[]; tamanho?: string; prioridade?: string; prazo?: string }) =>
    send<{ ok: true; responsaveis: ResponsavelCard[]; projetista_id: string | null; tipos: string[] | null }>(
      `/cards/${cardId}/projetista`, "PATCH", { projetista_id, ...(extras || {}) }),
  // Formato novo (multi): substitui a lista inteira. [] = tira todos.
  delegarCardMulti: (cardId: string, responsaveis: Array<{
      projetista_id: string; tipos?: string[]; tamanho?: string | null;
      prioridade?: string; prazo?: string | null;
    }>) =>
    send<{ ok: true; responsaveis: ResponsavelCard[]; projetista_id: string | null; tipos: string[] | null }>(
      `/cards/${cardId}/projetista`, "PATCH", { responsaveis }),
  // Kanban interno do projetista: muda SÓ a fase interna (não move o
  // card do board Trello). Permitido: gestora ou o dono do card.
  // projetistaId: quando a gestora move a fase de UMA pessoa num card com
  // vários responsáveis. Sem ele o backend move a fase de todos.
  moverEtapaProjetista: (cardId: string, etapa: string, projetistaId?: string | null) =>
    send<{ ok: true; etapa: string }>(`/cards/${cardId}/etapa-projetista`, "PATCH",
      projetistaId ? { etapa, projetista_id: projetistaId } : { etapa }),

  // ─── relatório (BI, só gestora) ───────────────────
  relatorio: () => get<Relatorio>("/relatorio"),
  // force=true regenera na hora (botão "Atualizar análise"); senão serve o cache < 24h.
  relatorioInsights: (force = false) =>
    get<RelatorioInsights>(`/relatorio/insights${force ? "?force=1" : ""}`),

  // ─── board / cards ────────────────────────────────
  board: () => get<Board>("/board"),
  meta: () => get<BoardMeta>("/board/meta"),
  card: (id: string) => get<CardDetalhe>(`/cards/${id}`),
  aditivos: (cardId: string) => get<{ aditivos: AditivoSim[] }>(`/cards/${cardId}/aditivos`),
  fiscal: (cardId: string) => get<{
    laudos: any[]; vistorias: any[]; fotos: any[];
    acompanhamento: any | null; ocorrencias: any[];
  }>(`/cards/${cardId}/fiscal`),
  notifSeen: (cardId: string, tipo: "fiscal" | "aditivo") =>
    send<{ ok: true }>(`/cards/${cardId}/notif-seen/${tipo}`, "POST"),
  aditivoComentarios: (cardId: string) =>
    get<{ comentarios: Array<{
      id: number; autor_nome: string; autor_email: string | null;
      texto: string; created_at: string | null;
      anexo_url: string | null; anexo_nome: string | null;
      anexo_mime: string | null; anexo_bytes: number | null;
    }> }>(`/cards/${cardId}/aditivo-comentarios`),
  criarAditivoComentario: async (cardId: string, texto: string, arquivo?: File | null) => {
    const fd = new FormData();
    fd.append("texto", texto);
    if (arquivo) fd.append("arquivo", arquivo);
    const r = await fetchApi(`/cards/${cardId}/aditivo-comentarios`, { method: "POST", body: fd });
    return r.json() as Promise<{
      id: number; autor_nome: string; autor_email: string | null; texto: string;
      created_at: string | null; anexo_url: string | null; anexo_nome: string | null;
      anexo_mime: string | null; anexo_bytes: number | null;
    }>;
  },
  pushSubscribe: (body: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    send<{ ok: true }>("/push/subscribe", "POST", body),
  pushUnsubscribe: (body: { endpoint: string }) =>
    send<{ ok: true }>("/push/unsubscribe", "POST", body),
  pushTest: () => send<{ ok: true }>("/push/test", "POST"),
  cardDados: (cardId: string, p: { cliente?: string | null; endereco?: string | null; cnpj_cpf?: string | null }) =>
    send<{ ok: true; cliente: string | null; endereco: string | null; cnpj_cpf: string | null }>(
      `/cards/${cardId}/dados`, "PATCH", p),
  arquivarCard: (cardId: string) =>
    fetchApi(`/cards/${cardId}`, { method: "DELETE" }).then(r => r.json() as Promise<{ ok: true }>),
  duplicados: () => get<{ grupos: Array<{ nome: string; cards: Array<{
    id: string; nome: string; lista: string | null; space_card_id: string | null;
    projetista_id: string | null; date_last_activity: string | null;
  }> }> }>("/duplicados"),

  // ─── calendário ─────────────────────────────
  calendarList: (from?: string, to?: string, q?: string) => {
    const params = new URLSearchParams();
    if (from && to) { params.set("from_", from); params.set("to", to); }
    if (q) params.set("q", q);
    const qs = params.toString();
    return get<{ eventos: CalendarEvento[] }>(`/calendar/events${qs ? "?" + qs : ""}`);
  },
  calendarCreate: (body: CalendarEventoIn) =>
    send<CalendarEvento>("/calendar/events", "POST", body),
  calendarUpdate: (id: number, patch: Partial<CalendarEventoIn>) =>
    send<CalendarEvento>(`/calendar/events/${id}`, "PATCH", patch),
  calendarDelete: (id: number) =>
    send<{ ok: true }>(`/calendar/events/${id}`, "DELETE"),
  calendarRsvp: (id: number, status: CalendarRSVP) =>
    send<CalendarEvento>(`/calendar/events/${id}/rsvp`, "POST", { status }),
  patchCard: (id: string, p: CardPatch) => send(`/cards/${id}`, "PATCH", p),
  checkItem: (cardId: string, itemId: string, done: boolean) =>
    send(`/cards/${cardId}/checkitem/${itemId}`, "PUT", { done }),
  addCheckItem: (cardId: string, checklistId: string, nome: string) =>
    send(`/cards/${cardId}/checklists/${checklistId}/itens`, "POST", { nome }),
  delCheckItem: (cardId: string, checklistId: string, itemId: string) =>
    send(`/cards/${cardId}/checklists/${checklistId}/itens/${itemId}`, "DELETE"),
  addChecklist: (cardId: string, nome: string) =>
    send<{ ok: true; id: string; nome: string }>(`/cards/${cardId}/checklists`, "POST", { nome }),
  delChecklist: (cardId: string, checklistId: string) =>
    send(`/cards/${cardId}/checklists/${checklistId}`, "DELETE"),
  comentariosLocais: (cardId: string) =>
    get<{ comentarios: ComentarioLocal[] }>(`/cards/${cardId}/comentarios-locais`),
  criarComentarioLocal: async (cardId: string, texto: string, arquivo?: File | null) => {
    const fd = new FormData();
    fd.append("texto", texto);
    if (arquivo) fd.append("arquivo", arquivo);
    const r = await fetchApi(`/cards/${cardId}/comentarios-locais`, { method: "POST", body: fd });
    return r.json() as Promise<ComentarioLocal>;
  },
  editarComentarioLocal: (cardId: string, coment_id: number, texto: string) =>
    send<ComentarioLocal>(`/cards/${cardId}/comentarios-locais/${coment_id}`, "PATCH", { texto }),
  apagarComentarioLocal: (cardId: string, coment_id: number) =>
    send<{ ok: true }>(`/cards/${cardId}/comentarios-locais/${coment_id}`, "DELETE"),
  toggleLabel: (cardId: string, labelId: string, on: boolean) =>
    send(`/cards/${cardId}/labels/${labelId}`, on ? "POST" : "DELETE"),
  toggleMembro: (cardId: string, membroId: string, on: boolean) =>
    send(`/cards/${cardId}/membros/${membroId}`, on ? "POST" : "DELETE"),
  delAnexo: (cardId: string, anexoId: string) =>
    send(`/cards/${cardId}/anexos/${anexoId}`, "DELETE"),
  uploadAnexo: async (cardId: string, file: File) => {
    const fd = new FormData();
    fd.append("arquivo", file);
    const r = await fetch(`${BASE}/cards/${cardId}/anexos`, { method: "POST", body: fd });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r.json();
  },
  itensDoCard: (cardId: string) =>
    get<ItensDoCard>(`/cards/${cardId}/itens`),
  liberarItem: (itemId: string, para_producao: boolean, desfazer = false,
    extra?: { qtd_liberada?: number; obs_producao?: string; autor_liberacao?: string }) =>
    send<{ ok: true }>(`/itens/${itemId}/liberar`, "POST",
      { para_producao, desfazer, ...(extra || {}) }),
  editarAmbiente: (itemId: string, ambiente: string) =>
    send<{ ok: true; ambiente: string }>(`/itens/${itemId}/ambiente`, "PATCH", { ambiente }),
  uploadMedicao: async (cardId: string, file: File, legenda = "") => {
    const fd = new FormData();
    fd.append("arquivo", file);
    if (legenda) fd.append("legenda", legenda);
    const r = await fetch(`${BASE}/cards/${cardId}/medicao-anexo`,
      { method: "POST", body: fd });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r.json() as Promise<{ ok: true; id: string; url: string }>;
  },
  deleteMedicao: (cardId: string, fotoId: string) =>
    send<{ ok: true }>(`/cards/${cardId}/medicao-anexo/${fotoId}`, "DELETE"),
};

export const anexoUrl = (path: string) => `/anexos/${path.replace(/^anexos\//, "")}`;

export const fmtBr = (d?: string | null) =>
  d ? d.slice(0, 10).split("-").reverse().join("/") : "";

export const fmtBytes = (b?: number | null) => {
  if (!b) return "";
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

// Cores das labels do Trello → hex
export const LABEL_COR: Record<string, string> = {
  green: "#4BCE97", yellow: "#F5CD47", orange: "#FEA362", red: "#F87168",
  purple: "#9F8FEF", blue: "#579DFF", sky: "#6CC3E0", lime: "#94C748",
  pink: "#E774BB", black: "#8590A2",
  green_dark: "#1F845A", yellow_dark: "#946F00", orange_dark: "#B65C02",
  red_dark: "#C9372C", purple_dark: "#6E5DC6", blue_dark: "#0C66E4",
  sky_dark: "#227D9B", lime_dark: "#5B7F24", pink_dark: "#AE4787", black_dark: "#626F86",
  green_light: "#BAF3DB", yellow_light: "#F8E6A0", orange_light: "#FEDEC8",
  red_light: "#FFD5D2", purple_light: "#DFD8FD", blue_light: "#CCE0FF",
  sky_light: "#C6EDFB", lime_light: "#D3F1A7", pink_light: "#FDD0EC", black_light: "#DCDFE4",
};
export const labelCor = (cor: string) => LABEL_COR[cor] || "#8590A2";

// ─── Kanban interno do projetista ─────────────────────────────────
// 5 fases fixas, PARALELAS às listas do Trello (Will 25/08): arrastar
// aqui não move o card do board principal, só o estado interno do app.
export const ETAPAS_PROJETISTA: { id: string; nome: string; cor: string }[] = [
  { id: "a_iniciar",    nome: "A INICIAR",    cor: "#8590A2" },
  { id: "em_andamento", nome: "EM ANDAMENTO", cor: "#579DFF" },
  { id: "revisao",      nome: "REVISÃO",      cor: "#F5CD47" },
  { id: "enviado",      nome: "ENVIADO",      cor: "#9F8FEF" },
  { id: "aprovado",     nome: "APROVADO",     cor: "#4BCE97" },
];
export const etapaProjetistaInfo = (id?: string | null) =>
  ETAPAS_PROJETISTA.find(e => e.id === id) || null;

// Cor semântica da coluna por palavra-chave do nome da lista (padrão compras).
export function listaCor(nome: string): string {
  const n = nome.toUpperCase();
  if (n.includes("REPARO")) return "#EF4444";
  if (n.includes("FINALIZADO") || n.includes("FEITA")) return "#10B981";
  if (n.includes("AGUARDA") || n.includes("PENDÊNCIA") || n.includes("PENDENCIA") || n.includes("HOLD")) return "#F59E0B";
  if (n.includes("APROVADO")) return "#10B981";
  if (n.includes("PRODUÇÃO") || n.includes("PRODUCAO") || n.includes("ENTREGA") || n.includes("INSTALAÇÃO") || n.includes("INSTALACAO")) return "#14B8A6";
  if (n.includes("CONTRATO")) return "#8B5CF6";
  if (n.includes("REVISÃO") || n.includes("REVISAO")) return "#F97316";
  if (n.includes("EXECUTIVO") || n.includes("PROJETO") || n.includes("ESTUDO") || n.includes("COMPATIBILIDADE") || n.includes("MEDIÇÃO") || n.includes("MEDICAO")) return "#3B82F6";
  return "#6B7280";
}

// Bloco "O QUE FOI VENDIDO" mantido no desc pelo compras-contratos-watcher.
export const VENDIDO_RE = /<!--\s*vendido:[0-9a-f]+\s*-->([\s\S]*?)<!--\s*\/vendido\s*-->/;

export function extrairVendido(desc?: string | null): string[] {
  const m = desc ? desc.match(VENDIDO_RE) : null;
  if (!m) return [];
  return m[1].split("\n").map(l => l.trim())
    .filter(l => l && !/^\*\*O QUE FOI VENDIDO\*\*$/i.test(l));
}

export function limparDesc(desc?: string | null): string {
  return (desc || "")
    .replace(VENDIDO_RE, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(\n|^)\s*---\s*$/g, "")
    .trim();
}

// Template Trello — os cards nascem com o modelo do board da Thainara:
// **Vendedor Responsável:** X / **Arquiteto Responsável:** Y / **Projetista Responsável:** …
// A gente parseia pra mostrar cada campo estruturado na linha do kanban
// (labels padrão + qualquer outro **Campo:** valor que aparecer).
export type CampoTemplate = { label: string; valor: string };
export const CAMPOS_TEMPLATE_ORDEM = [
  "Vendedor Responsável",
  "Arquiteto Responsável",
  "Projetista Responsável",
  "Caminho na Rede",
  "E-mail para aprovações",
  "Fiscal",
];
export function extrairCamposTemplate(desc?: string | null): CampoTemplate[] {
  if (!desc) return [];
  const limpo = limparDesc(desc);
  const encontrados = new Map<string, string>();
  // Casa "**Label:**" no começo de linha e captura o valor até o próximo campo ou fim.
  const re = /^\s*\*\*([^*][^*]*?):\*\*\s*([^\n]*)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(limpo))) {
    const label = m[1].trim();
    const valor = m[2].trim();
    if (label) encontrados.set(label, valor);
  }
  // Ordena: primeiro os campos conhecidos na ordem certa, depois qualquer outro
  // que apareça no template (algum vendedor pode adicionar linha nova).
  const out: CampoTemplate[] = [];
  for (const nome of CAMPOS_TEMPLATE_ORDEM) {
    if (encontrados.has(nome)) {
      out.push({ label: nome, valor: encontrados.get(nome) || "" });
      encontrados.delete(nome);
    }
  }
  for (const [label, valor] of encontrados) out.push({ label, valor });
  return out;
}
