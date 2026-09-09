async function j<T>(url: string, init?: RequestInit): Promise<T> {
  // Identidade do login Space (lib/auth.ts grava no localStorage) — vai em toda
  // chamada; chamadas que já setam X-User-Email explicitamente têm prioridade.
  let me = "";
  try { me = localStorage.getItem("gestao_user_email") || ""; } catch {}
  if (me) {
    const h = new Headers(init?.headers);
    if (!h.has("X-User-Email")) h.set("X-User-Email", me);
    init = { ...init, headers: h };
  }
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export type Projeto = {
  id: string;
  simulacao_id?: string | null;    // public.simulacao_projetos.id do Space (vínculo principal do mapa)
  card_id?: string | null;         // kanban_cards.id do Space (fallback pro embed do Mapa da Obra)
  numero_proposta: string | null;
  cliente: string;
  cnpj_cpf?: string | null;
  endereco?: string | null;
  obra_code?: string | null;
  vendedor?: string | null;
  arquiteto?: string | null;
  orcamentista?: string | null;
  gestor_email?: string | null;
  meta?: any;
  valor_total?: number;
  status: string;
  column_id: string;
  ordem_coluna: number;
  etapa_atual: number;
  assinado_em?: string | null;
  created_at: string;
  updated_at: string;
  n_itens: number;
  n_entregues: number;
  pct_completo: number;
};

export type Coluna = { id: string; titulo: string; cor: string; ordem: number };

export type DriveInfo = {
  folder_id: string | null;
  folder_url: string | null;
  fonte: "card" | "meta" | null;
};

export type EtapaCatalogo = {
  numero: number; slug: string; categoria: string; titulo: string;
};

export type EntregaCatalogo = {
  id: number; fase: number; fase_titulo: string; codigo: string;
  titulo: string; etapa_numero: number | null; obrigatorio: boolean; ordem: number;
};

export type JornadaOverview = {
  catalogo: EtapaCatalogo[];
  status: Record<string, Record<string, string>>;
  entregas: EntregaCatalogo[];
  preenchidos: Record<string, number[]>;
};

export type MapaPrint = {
  mapa_id?: string;
  revisao?: string;
  pdf_url: string;
  paginas: { n: number; url: string; label?: string }[];
  gerado_em?: string;
};

export type Etapa = {
  numero: number; slug: string; categoria: string;
  titulo: string; subtitulo: string | null; descricao: string | null;
  status: string; responsavel: string | null;
  iniciada_em?: string | null; concluida_em?: string | null; observacoes?: string | null;
  meta?: any;
};

export type Item = {
  id: string; projeto_id: string; ordem: number;
  categoria: string; descritivo: string; ambiente: string | null;
  quantidade: number; unidade: string;
  valor_unit: number; valor_total: number;
  status: string; responsavel: string | null;
  previsao_inicio?: string | null; previsao_fim?: string | null;
  executado_em?: string | null;
  observacoes?: string | null; meta?: any;
};

export type Evento = {
  id: string; tipo: string; titulo: string; descricao?: string | null;
  autor_email?: string | null; etapa_numero?: number | null;
  item_id?: string | null; payload?: any; created_at: string;
};

export const api = {
  colunas:     () => j<Coluna[]>("/api/colunas"),
  projetos:    (params?: { status?: string; q?: string; column_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status)   qs.set("status", params.status);
    if (params?.q)        qs.set("q", params.q);
    if (params?.column_id)qs.set("column_id", params.column_id);
    const s = qs.toString();
    return j<Projeto[]>(`/api/projetos${s ? `?${s}` : ""}`);
  },
  mover:       (pid: string, column_id: string) => j<Projeto>(`/api/projetos/${pid}/mover`, {
                 method: "POST", headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ column_id }),
               }),
  projeto:     (id: string) => j<{ projeto: Projeto; etapas: Etapa[] }>(`/api/projetos/${id}`),
  jornada:     () => j<JornadaOverview>(`/api/jornada`),
  mapaPrint:   (cardId: string) => j<{ print: MapaPrint | null }>(`/api/mapa-print/${cardId}`),
  centerLink:  (pid: string) =>
    j<{ token: string; url: string; usuario: string; senha: string }>(
      `/api/gestao/projetos/${pid}/center-link`, { method: "POST" }),
  itens:       (pid: string, params?: { ambiente?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.ambiente) qs.set("ambiente", params.ambiente);
    if (params?.status)   qs.set("status", params.status);
    const s = qs.toString();
    return j<Item[]>(`/api/projetos/${pid}/itens${s ? `?${s}` : ""}`);
  },
  itemPatch:   (id: string, patch: Partial<Item>) => j<Item>(`/api/itens/${id}`, {
                 method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
               }),
  etapaPatch:  (pid: string, numero: number, patch: any) => j<any>(`/api/projetos/${pid}/etapas/${numero}`, {
                 method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
               }),
  eventos:     (pid: string) => j<Evento[]>(`/api/projetos/${pid}/eventos`),
  projetoDelete:(pid: string) => j<{ ok: boolean; cliente: string }>(`/api/projetos/${pid}`, {
                    method: "DELETE",
                  }),
  projetoPatch:(pid: string, patch: Partial<Projeto>) => j<Projeto>(`/api/projetos/${pid}`, {
                 method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
               }),

  projetoDrive: (pid: string) => j<DriveInfo>(`/api/projetos/${pid}/drive`),
  projetoDriveCriar: (pid: string, email?: string | null) => j<DriveInfo>(`/api/projetos/${pid}/drive`, {
                 method: "POST", headers: email ? { "X-User-Email": email } : undefined,
               }),

  fonteProstas: (q?: string) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    return j<any[]>(`/api/fonte/propostas${qs.toString() ? `?${qs}` : ""}`);
  },
  syncProposta: (simulacao_id: string, contrato_id?: string) => j<{ projeto_id: string }>("/api/sync/from-proposta", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ simulacao_id, contrato_id }),
                }),
  // projetoCriar (POST /api/projetos) removido 02/09: projeto novo nasce SÓ no
  // Home Broker; entrada aqui é só via syncProposta (espelho de proposta).

  // ─── FISCAL · Equipe ───────────────────────────────
  fiscalList:   (params?: { q?: string; ativo?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.ativo !== undefined) qs.set("ativo", String(params.ativo));
    const s = qs.toString();
    return j<Fiscal[]>(`/api/fiscal/equipe${s ? `?${s}` : ""}`);
  },
  fiscalCreate: (payload: FiscalInput) => j<Fiscal>("/api/fiscal/equipe", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                }),
  fiscalPatch:  (id: string, patch: Partial<FiscalInput>) => j<Fiscal>(`/api/fiscal/equipe/${id}`, {
                  method: "PATCH", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(patch),
                }),
  fiscalDelete: (id: string) => j<{ ok: boolean; nome: string }>(`/api/fiscal/equipe/${id}`, {
                  method: "DELETE",
                }),

  // ─── FISCAL · Projetos vinculados ─────────────────
  fiscalProjetos:   (fid: string) => j<ProjetoResumo[]>(`/api/fiscal/equipe/${fid}/projetos`),
  fiscalProjetoAdd: (fid: string, projeto_id: string) =>
                       j<{ ok: boolean; fiscais: any[]; already_linked?: boolean }>(
                         `/api/fiscal/equipe/${fid}/projetos`, {
                           method: "POST", headers: { "Content-Type": "application/json" },
                           body: JSON.stringify({ projeto_id }),
                         }),
  fiscalProjetoDel: (fid: string, projeto_id: string) =>
                       j<{ ok: boolean }>(`/api/fiscal/equipe/${fid}/projetos/${projeto_id}`, {
                         method: "DELETE",
                       }),

  // ─── RELACIONAMENTO (Painel CS) — chat WhatsApp do projeto ────
  relacionamento: (pid: string, limit?: number) => {
    const qs = limit ? `?limit=${limit}` : "";
    return j<RelacionamentoResp>(`/api/projetos/${pid}/relacionamento${qs}`);
  },
  relacionamentoSend: (pid: string, text: string) =>
    j<{ ok: boolean; grupo_jid: string; instance: string; evolution_msg_id: string | null }>(
      `/api/projetos/${pid}/relacionamento/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }),
  relacionamentoGrupos: (q?: string) => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return j<WhatsappGrupo[]>(`/api/relacionamento/grupos${qs}`);
  },
  relacionamentoVincular: (pid: string, grupo_jid: string, instance_name: string) =>
    j<{ ok: boolean; grupo_jid: string; instance_name: string }>(
      `/api/projetos/${pid}/relacionamento/vincular`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo_jid, instance_name }),
      }),
  relacionamentoCopiloto: (pid: string) =>
    j<CopilotoResp>(`/api/projetos/${pid}/relacionamento/copiloto`),
  relacionamentoConversas: (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : "";
    return j<ConversaResumo[]>(`/api/relacionamento/conversas${qs}`);
  },
  relacionamentoChat: (jid: string, card_id?: string | null, limit?: number) => {
    const qs = new URLSearchParams({ jid });
    if (card_id) qs.set("card_id", card_id);
    if (limit) qs.set("limit", String(limit));
    return j<{ jid: string; mensagens: WhatsappMessage[] }>(`/api/relacionamento/chat?${qs}`);
  },
  relacionamentoChatSend: (jid: string, text: string, instance?: string | null, card_id?: string | null, email?: string | null) =>
    j<{ ok: boolean; jid: string; instance: string; evolution_msg_id: string | null }>(
      `/api/relacionamento/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(email ? { "X-User-Email": email } : {}) },
        body: JSON.stringify({ jid, text, instance, card_id }),
      }),

  // ─── FISCAL · Agenda / Kanban Semanal ───────────────
  agendaList: (params?: { from?: string; to?: string; fiscal_id?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.fiscal_id) qs.set("fiscal_id", params.fiscal_id);
    if (params?.status) qs.set("status", params.status);
    const s = qs.toString();
    return j<Agenda[]>(`/api/fiscal/agenda${s ? `?${s}` : ""}`);
  },
  agendaCreate: (payload: AgendaInput) => j<Agenda>("/api/fiscal/agenda", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                }),
  agendaPatch:  (id: string, patch: Partial<AgendaInput>) => j<Agenda>(`/api/fiscal/agenda/${id}`, {
                  method: "PATCH", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(patch),
                }),
  agendaDelete: (id: string) => j<{ ok: boolean }>(`/api/fiscal/agenda/${id}`, { method: "DELETE" }),
  // Upload de 1 anexo do agendamento; devolve o metadado que vai na lista attachments.
  // FormData: NÃO setar Content-Type (o browser gera o boundary sozinho).
  agendaAnexoUpload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return j<AgendaAnexo>("/api/fiscal/agenda-anexo", { method: "POST", body: fd });
  },

  // ─── PROJETO · Laudos & Vistorias vinculados ao card ────────────
  projetoVistorias: (pid: string) => j<Agenda[]>(`/api/projetos/${pid}/vistorias`),
  projetoLaudos:    (pid: string) => j<Laudo[]>(`/api/projetos/${pid}/laudos`),
  projetoFotos:     (pid: string, laudo_id?: string) => {
    const qs = laudo_id ? `?laudo_id=${encodeURIComponent(laudo_id)}` : "";
    return j<Foto[]>(`/api/projetos/${pid}/fotos${qs}`);
  },

  // ─── PROJETO · Instalador (dados de instala.parket.works) ───────
  projetoInstalaOcorrencias: (pid: string) => j<any[]>(`/api/projetos/${pid}/instala-ocorrencias`),
  projetoInstalaCheckins:    (pid: string) => j<any[]>(`/api/projetos/${pid}/instala-checkins`),
  projetoInstalaConferencias:(pid: string) => j<any[]>(`/api/projetos/${pid}/instala-conferencias`),

  // ─── FISCAL · Support ───────────────────────────────
  projetosLista: (q?: string) => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return j<ProjetoResumo[]>(`/api/fiscal/projetos-lista${qs}`);
  },
  laudosAll: (params?: { q?: string; fiscal_id?: string; tipo?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.fiscal_id) qs.set("fiscal_id", params.fiscal_id);
    if (params?.tipo) qs.set("tipo", params.tipo);
    if (params?.status) qs.set("status", params.status);
    const s = qs.toString();
    return j<LaudoAll[]>(`/api/fiscal/laudos${s ? `?${s}` : ""}`);
  },
  laudoDetalhe: (lid: string) => j<{
    laudo: LaudoDetalhado; fotos: Foto[]; projeto_id: string | null;
    projeto: LaudoProjetoInfo | null; itens: LaudoItemProjeto[];
  }>(`/api/fiscal/laudos/${lid}`),
  laudoLinkAssinatura: (lid: string) =>
    j<{ token: string; url: string }>(`/api/fiscal/laudos/${lid}/link-assinatura`, { method: "POST" }),
  laudoLapidar: (lid: string) =>
    j<{ ok: boolean; lapidado: { resumo: string; em: string; por: string | null; modelo: string } }>(
      `/api/fiscal/laudos/${lid}/lapidar`, { method: "POST" }),
  laudoResumoGestor: (lid: string, force = false) =>
    j<{
      ok: boolean;
      cached: boolean;
      resumo_gestor: { resumo: string; pendencias: string[]; em: string; por: string | null; modelo: string };
    }>(`/api/fiscal/laudos/${lid}/resumo-gestor${force ? "?force=true" : ""}`, { method: "POST" }),
  publicoLaudoAssinatura: (token: string) =>
    j<{
      tipo: string; cliente: string | null; obra: string | null; endereco: string | null;
      data_vistoria: string | null; fiscal_nome: string | null; condicao: string;
      resumo_engenharia?: string;
      assinado: boolean; resp_obra: string; assinado_em: string | null;
      relatorio?: {
        vendedor: string; responsavel: string; relatorio_numero: number | null;
        relatorio_data: string | null; descricao_produto: string;
        servico_contratado: RelatorioServico[];
        medicao_itens: RelatorioMedicaoItem[];
        entradas: RelatorioEntrada[]; observacoes: string;
      };
      conteudo?: LaudoConteudoPublico;
      avaliacao?: { notas: Record<string, number>; comentario: string; nome: string; enviada_em: string } | null;
    }>(`/api/publico/laudo-assinatura/${token}`),
  publicoLaudoAssinar: (token: string, body: { nome: string; cpf?: string; assinatura: string }) =>
    j<{ ok: boolean }>(`/api/publico/laudo-assinatura/${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
  publicoLaudoAvaliar: (token: string, body: { notas: Record<string, number>; comentario?: string; nome?: string }) =>
    j<{ ok: boolean }>(`/api/publico/laudo-assinatura/${token}/avaliacao`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
  laudoCriar: (body: { projeto_id: string; tipo: string; fiscal_id?: string; fiscal_nome?: string; servicos_inclusos?: string[] }) =>
    j<LaudoDetalhado>("/api/fiscal/laudos", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
  laudoPatch: (lid: string, body: {
    relatorio_dados?: RelatorioDados; observacoes?: string; status?: string;
    fiscal_id?: string; fiscal_nome?: string; data_vistoria?: string;
  }) => j<LaudoDetalhado>(`/api/fiscal/laudos/${lid}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }),

  // ─── OBRAS · Equipes (prestadores) ─────────────────
  equipesList:   (params?: { q?: string; ativo?: boolean; categoria?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.ativo !== undefined) qs.set("ativo", String(params.ativo));
    if (params?.categoria) qs.set("categoria", params.categoria);
    const s = qs.toString();
    return j<EquipeParket[]>(`/api/obras/equipes${s ? `?${s}` : ""}`);
  },
  equipeCreate:  (payload: EquipeInput) => j<EquipeParket>("/api/obras/equipes", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  }),
  equipePatch:   (id: string, patch: Partial<EquipeInput>) =>
                    j<EquipeParket>(`/api/obras/equipes/${id}`, {
                      method: "PATCH", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(patch),
                    }),
  equipeDelete:  (id: string) => j<{ ok: boolean; nome: string }>(`/api/obras/equipes/${id}`, {
                    method: "DELETE",
                  }),

  operacoesEquipes: () => j<OperacoesEquipesResp>("/api/operacoes/equipes"),

  // Visão por obra (tela Obras x Prestadores). Lê a união do vínculo do
  // gestão (kanban_cards.details.prestadores) com o do instala (prestador_card).
  obrasPrestadores: () => j<ObrasPrestadoresResp>("/api/operacoes/obras-prestadores"),
  // Vincular/desvincular pelo card da obra: funciona também para obra do
  // kanban que ainda não tem linha em gestao.projetos. termo = anexo do
  // contrato geral auto-criado quando o card tem projeto (null = sem projeto).
  obraPrestadorAdd: (cardId: string, equipe_id: string) =>
    j<{ ok: boolean; already_linked: boolean; prestador_id: string | null;
        termo: { id: string; status: string; projeto_id: string; itens: number } | null }>(
      `/api/obras/${cardId}/prestadores`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipe_id }),
      }),
  obraPrestadorDel: (cardId: string, equipeId: string) =>
    j<{ ok: boolean }>(`/api/obras/${cardId}/prestadores/${equipeId}`, { method: "DELETE" }),
  // Iguala os vínculos dos dois lados (gestão <-> instala) nos dois sentidos
  prestadoresReconciliar: () =>
    j<{ ok: boolean; criados_instala: number; criados_gestao: number; nao_resolvidos: number }>(
      "/api/operacoes/prestadores/reconciliar", { method: "POST" }),

  equipeFicha: (id: string) =>
    j<{ avaliacoes: PrestadorAvaliacao[]; eventos: PrestadorEvento[] }>(`/api/obras/equipes/${id}/ficha`),
  equipeAvaliar: (id: string, payload: {
    nota_qualidade: number; nota_prazo: number; nota_postura: number; nota_retrabalho: number;
    papel: "fiscal" | "gestao"; card_id?: string | null; obra?: string | null;
    comentario?: string | null; avaliador_nome?: string | null;
  }) => j<PrestadorAvaliacao>(`/api/obras/equipes/${id}/avaliacoes`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),
  equipeEvento: (id: string, payload: {
    tipo: "mancada" | "elogio"; gravidade?: "leve" | "media" | "grave";
    descricao: string; card_id?: string | null; obra?: string | null;
  }) => j<PrestadorEvento>(`/api/obras/equipes/${id}/eventos`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),
  equipeBloquear: (id: string, motivo: string) =>
    j<EquipeParket>(`/api/obras/equipes/${id}/bloquear`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo }),
    }),
  equipeReativar: (id: string) =>
    j<EquipeParket>(`/api/obras/equipes/${id}/reativar`, { method: "POST" }),

  // Acessos do instala.parket.works: login e senha por prestador.
  // O backend gateia por superadmin ou allowlist (produtividade@).
  prestadorAcessos: (q?: string) =>
    j<PrestadorAcesso[]>(`/api/prestadores/acessos${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  prestadorAcessoSet: (prestadorId: string, body?: { login?: string; senha?: string }) =>
    j<{ prestador_id: string; nome: string; login: string; senha: string }>(
      `/api/prestadores/${prestadorId}/acesso`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      }),

  crises: (params?: { card_id?: string; abertas?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.card_id) qs.set("card_id", params.card_id);
    if (params?.abertas) qs.set("abertas", "true");
    const s = qs.toString();
    return j<Crise[]>(`/api/crises${s ? `?${s}` : ""}`);
  },
  criseCriar: (payload: {
    descricao: string; gravidade: CriseGravidade; origem: "relacionamento" | "projeto" | "manual";
    card_id?: string | null; projeto_id?: string | null; cliente?: string | null;
    setor_responsavel?: CriseSetor | null;
    setores_notificar?: CriseSetor[];
    responsavel_email?: string | null; responsavel_nome?: string | null;
    notificar?: { nome: string; email: string }[]; prazo?: string | null;
  }) => j<Crise>("/api/crises", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),
  crisePatch: (id: string, patch: {
    coluna?: CriseColuna; gravidade?: CriseGravidade; descricao?: string;
    setor_responsavel?: CriseSetor | null;
    setores_notificar?: CriseSetor[];
    responsavel_email?: string | null; responsavel_nome?: string | null;
    notificar?: { nome: string; email: string }[]; prazo?: string | null; resolucao?: string;
  }) => j<Crise>(`/api/crises/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
  }),
  criseComentarios: (id: string) =>
    j<CriseComentario[]>(`/api/crises/${id}/comentarios`),
  criseComentar: (id: string, payload: { texto: string; anexos?: CriseAnexo[]; publicar_chat?: boolean }) =>
    j<CriseComentario>(`/api/crises/${id}/comentarios`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texto: payload.texto,
        anexos: payload.anexos || [],
        publicar_chat: payload.publicar_chat !== false,
      }),
    }),
  criseAnexoUpload: async (id: string, file: File): Promise<CriseAnexo> => {
    const fd = new FormData();
    fd.append("file", file);
    let me = "";
    try { me = localStorage.getItem("gestao_user_email") || ""; } catch {}
    const r = await fetch(`/api/crises/${id}/anexo`, {
      method: "POST", body: fd, headers: me ? { "X-User-Email": me } : {},
    });
    if (!r.ok) throw new Error(`upload falhou (${r.status}): ${(await r.text()).slice(0, 200)}`);
    return r.json();
  },
  criseAnaliseIA: (id: string, force = false) =>
    j<CriseComentario>(`/api/crises/${id}/analise-ia${force ? "?force=true" : ""}`, {
      method: "POST",
    }),
  criseReabrir: (id: string) =>
    j<Crise>(`/api/crises/${id}/reabrir`, { method: "POST" }),

  // Criacao de termo saiu da UI /equipes: o fluxo canonico (#1932) e o vinculo
  // de prestador na pagina do Projeto, que auto-cria o termo com todos os itens.
  termosList: (params?: { equipe_id?: string; card_id?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.equipe_id) qs.set("equipe_id", params.equipe_id);
    if (params?.card_id) qs.set("card_id", params.card_id);
    if (params?.status) qs.set("status", params.status);
    const s = qs.toString();
    return j<TermoResumo[]>(`/api/operacoes/termos${s ? `?${s}` : ""}`);
  },
  // Status do contrato geral por equipe (batch, 1 chamada pra tela /equipes)
  contratoGeral: () => j<ContratoGeralResp>("/api/operacoes/contrato-geral"),

  // ─── Cronograma v2 · agregado de gestao.itens ──────
  cronogramaItens: () => j<CronogramaItemGrupo[]>("/api/cronograma-itens"),
  projetoCategoriaPatch: (pid: string, categoria: string, patch: {
    responsavel?: string | null; previsao_inicio?: string | null; previsao_fim?: string | null;
    status?: string | null; executado_em?: string | null;
  }) => j<{ ok: boolean; n: number }>(
    `/api/projetos/${pid}/itens/categoria/${encodeURIComponent(categoria)}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }
  ),

  // ─── OBRAS · Cronograma ────────────────────────────
  cronogramaList: (params?: { q?: string; tipo?: string; categoria?: string; card_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.tipo) qs.set("tipo", params.tipo);
    if (params?.categoria) qs.set("categoria", params.categoria);
    if (params?.card_id) qs.set("card_id", params.card_id);
    const s = qs.toString();
    return j<CronogramaRow[]>(`/api/obras/cronograma${s ? `?${s}` : ""}`);
  },
  cronogramaCreate: (payload: CronogramaInput) => j<CronogramaRow>("/api/obras/cronograma", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    }),
  cronogramaPatch: (id: string, patch: Partial<CronogramaInput>) =>
                      j<CronogramaRow>(`/api/obras/cronograma/${id}`, {
                        method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(patch),
                      }),
  cronogramaDelete: (id: string) => j<{ ok: boolean }>(`/api/obras/cronograma/${id}`, {
                      method: "DELETE",
                    }),

  // ─── PROJETO · Fiscais vinculados (reverso do fiscalProjetoAdd) ────
  projetoFiscais: (pid: string) => j<FiscalVinculado[]>(`/api/projetos/${pid}/fiscais`),

  // ─── PROJETO · Prestadores + Cronograma vinculados ────
  projetoCronograma:  (pid: string) => j<CronogramaRow[]>(`/api/projetos/${pid}/cronograma`),
  projetoPrestadores: (pid: string) => j<PrestadorVinculado[]>(`/api/projetos/${pid}/prestadores`),
  projetoPrestadorAdd: (pid: string, equipe_id: string) =>
                          j<{ ok: boolean; prestadores: any[]; already_linked?: boolean }>(
                            `/api/projetos/${pid}/prestadores`, {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ equipe_id }),
                            }),
  projetoPrestadorDel: (pid: string, equipe_id: string) =>
                          j<{ ok: boolean; prestadores: any[] }>(
                            `/api/projetos/${pid}/prestadores/${equipe_id}`, { method: "DELETE" }),
  projetoPrestadorEscopo: (pid: string, equipe_id: string, itens_ids: string[]) =>
                          j<{ ok: boolean; escopo_itens_ids: string[] }>(
                            `/api/projetos/${pid}/prestadores/${equipe_id}/escopo`, {
                              method: "PUT", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ itens_ids }),
                            }),

  // ─── OBRA · Acompanhamento (item-centric) ────────────
  acompanhamento:     (pid: string) => j<ObraAcompanhamento>(`/api/projetos/${pid}/acompanhamento`),
  acompanhamentoPut:  (pid: string, patch: Partial<ObraAcompanhamento>) =>
                        j<ObraAcompanhamento>(`/api/projetos/${pid}/acompanhamento`, {
                          method: "PUT", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(patch),
                        }),
  acompanhamentoShare: (pid: string) =>
                        j<{ token: string; url: string }>(`/api/projetos/${pid}/acompanhamento/share`, {
                          method: "POST",
                        }),
  acompanhamentoShareRevoke: (pid: string) =>
                        j<{ ok: boolean }>(`/api/projetos/${pid}/acompanhamento/share`, { method: "DELETE" }),
  fotosObra:          (pid: string, item_id?: string) => {
                        const qs = item_id ? `?item_id=${encodeURIComponent(item_id)}` : "";
                        return j<FotoObra[]>(`/api/projetos/${pid}/fotos-obra${qs}`);
                      },
  fotoObraUpload:     (pid: string, file: File, extra?: {
                        item_id?: string; legenda?: string; ambiente?: string; categoria?: string;
                      }) => {
                        const fd = new FormData();
                        fd.append("file", file);
                        if (extra?.item_id)   fd.append("item_id", extra.item_id);
                        if (extra?.legenda)   fd.append("legenda", extra.legenda);
                        if (extra?.ambiente)  fd.append("ambiente", extra.ambiente);
                        if (extra?.categoria) fd.append("categoria", extra.categoria);
                        return j<FotoObra>(`/api/projetos/${pid}/fotos-obra`, { method: "POST", body: fd });
                      },
  fotoObraAdotar:     (pid: string, payload: {
                        fonte_id: string; url: string; item_id?: string | null;
                        legenda?: string | null; ambiente?: string | null; tipo?: string | null;
                      }) => j<FotoObra>(`/api/projetos/${pid}/fotos-obra/adotar`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      }),
  fotoObraPatch:      (fid: string, patch: Partial<FotoObra>) =>
                        j<FotoObra>(`/api/fotos-obra/${fid}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(patch),
                        }),
  fotoObraDelete:     (fid: string) => j<{ ok: boolean }>(`/api/fotos-obra/${fid}`, { method: "DELETE" }),
  publicoObra:        (token: string) => j<PublicoObra>(`/api/publico/obra/${encodeURIComponent(token)}`),

  // ─── Documentos do projeto (árvore canônica por fase) ──
  documentosCatalogo: () => j<DocCatalogo[]>(`/api/documentos-catalogo`),
  documentos:         (pid: string) => j<Documento[]>(`/api/projetos/${pid}/documentos`),
  documentoUpload:    (pid: string, file: File, catalogo_codigo?: string, titulo?: string,
                       userEmail?: string | null) => {
                        const fd = new FormData();
                        fd.append("file", file);
                        if (catalogo_codigo) fd.append("catalogo_codigo", catalogo_codigo);
                        if (titulo) fd.append("titulo", titulo);
                        return j<Documento>(`/api/projetos/${pid}/documentos`, {
                          method: "POST", body: fd,
                          headers: userEmail ? { "X-User-Email": userEmail } : undefined,
                        });
                      },
  documentoDelete:    (did: string) => j<{ ok: boolean }>(`/api/documentos/${did}`, { method: "DELETE" }),

  // ─── Anteprojeto (prancha A1 gerada no Draw + publicação no Center) ──
  anteprojetoPranchas: (pid: string) =>
    j<{ card_id: string | null; items: AnteprojetoPrancha[] }>(`/api/projetos/${pid}/anteprojeto/pranchas`),
  anteprojetoGerar: (pid: string) =>
    j<any>(`/api/projetos/${pid}/anteprojeto/gerar`, { method: "POST" }),
  anteprojetoExcluir: (pid: string, prancha_id: string) =>
    j<{ ok: boolean }>(`/api/projetos/${pid}/anteprojeto/pranchas/${prancha_id}`, { method: "DELETE" }),
  anteprojetoPublicar: (pid: string, prancha_id: string) =>
    j<Documento>(`/api/projetos/${pid}/anteprojeto/publicar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prancha_id }),
    }),

  // ─── Solicitação de Compras (card no kanban de compras.parket.works) ──
  solicitacoesCompras:      (pid: string) => j<SolicitacaoCompra[]>(`/api/projetos/${pid}/solicitacoes-compras`),
  solicitacoesComprasAll:   () => j<SolicitacaoCompra[]>(`/api/solicitacoes-compras`),
  solicitacaoComprasCreate: (pid: string, payload: {
                              departamento: string;
                              materiais: { tipo: string; quantidade: string; justificativa: string }[];
                              prazo: string; solicitante: string; pedido_por?: string;
                              setor?: string; obs?: string;
                            }, userEmail?: string | null) =>
                              j<SolicitacaoCompra>(`/api/projetos/${pid}/solicitacoes-compras`, {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  ...(userEmail ? { "X-User-Email": userEmail } : {}),
                                },
                                body: JSON.stringify(payload),
                              }),

  // ─── InstaParket (curadoria + feed) ──
  instaAcompanhamento: (params?: { projeto_id?: string; origem?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.projeto_id) qs.set("projeto_id", params.projeto_id);
    if (params?.origem)     qs.set("origem", params.origem);
    if (params?.limit)      qs.set("limit", String(params.limit));
    const s = qs.toString();
    return j<InstaQueueItem[]>(`/api/insta/acompanhamento${s ? `?${s}` : ""}`);
  },
  instaPostCriar: (payload: { projeto_id: string; legenda?: string | null; midias: InstaMidiaIn[] },
                   userEmail?: string | null) =>
    j<{ ok: boolean; post_id: string; midias: number }>(`/api/insta/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userEmail ? { "X-User-Email": userEmail } : {}),
      },
      body: JSON.stringify(payload),
    }),
  instaPostDelete: (postId: string, userEmail?: string | null) =>
    j<{ ok: boolean }>(`/api/insta/posts/${postId}`, {
      method: "DELETE",
      headers: userEmail ? { "X-User-Email": userEmail } : undefined,
    }),
  instaFeed: (params?: { limit?: number; offset?: number }, userEmail?: string | null) => {
    const qs = new URLSearchParams();
    if (params?.limit)  qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const s = qs.toString();
    return j<InstaPost[]>(`/api/insta/feed${s ? `?${s}` : ""}`, {
      headers: userEmail ? { "X-User-Email": userEmail } : undefined,
    });
  },
  instaPerfis: () => j<InstaPerfil[]>(`/api/insta/perfis`),
  solicitacaoComprasFerramentas: (payload: {
                              departamento: string;
                              materiais: { tipo: string; quantidade: string; justificativa: string }[];
                              prazo: string; solicitante: string; pedido_por?: string;
                              setor?: string; obs?: string;
                            }, userEmail?: string | null) =>
                              j<SolicitacaoCompra>(`/api/solicitacoes-compras/ferramentas`, {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  ...(userEmail ? { "X-User-Email": userEmail } : {}),
                                },
                                body: JSON.stringify(payload),
                              }),

  // ─── REUNIÃO SEMANAL ────────────────────────────────────
  reuniaoHealth:      () => j<{ ok: boolean; whisper: any; chat: any }>(`/api/reuniao/health`),
  reuniaoHoje:        () => j<any>(`/api/reuniao/hoje`),
  reuniaoLista:       () => j<any[]>(`/api/reuniao/lista`),
  reuniaoNova:        (inp: { data?: string; conduzido_por?: string; titulo?: string } = {}) =>
                        j<Reuniao>(`/api/reuniao/nova`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(inp),
                        }),
  reuniaoDetalhe:     (rid: string) => j<ReuniaoDetalhe>(`/api/reuniao/${rid}`),
  reuniaoEncerrar:    (rid: string) => j<any>(`/api/reuniao/${rid}/encerrar`, { method: "POST" }),
  reuniaoBlocoNovo:   (rid: string, inp: { projeto_id?: string; projeto_nome: string; card_id?: string }) =>
                        j<ReuniaoBloco>(`/api/reuniao/${rid}/bloco`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(inp),
                        }),
  reuniaoBlocoAudio:  (bid: string, blob: Blob, duracaoSeg: number, fileName = "audio.webm") => {
                        const fd = new FormData();
                        fd.append("file", blob, fileName);
                        fd.append("duracao_seg", String(duracaoSeg));
                        return j<ReuniaoBlocoReview>(`/api/reuniao/bloco/${bid}/audio`, {
                          method: "POST", body: fd,
                        });
                      },
  reuniaoBlocoReview: (bid: string) => j<ReuniaoBlocoReview>(`/api/reuniao/bloco/${bid}/review`),
  reuniaoBlocoEncerrar:(bid: string) =>
                        j<any>(`/api/reuniao/bloco/${bid}/encerrar-review`, { method: "POST" }),
  reuniaoTarefaPatch: (tid: string, patch: Partial<ReuniaoTarefaPatch>) =>
                        j<ReuniaoTarefa>(`/api/reuniao/tarefa/${tid}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(patch),
                        }),
  reuniaoTarefaAprovar:(tid: string, aprovador_email?: string) =>
                        j<ReuniaoTarefa>(`/api/reuniao/tarefa/${tid}/aprovar`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ aprovador_email }),
                        }),
  reuniaoTarefaDescartar:(tid: string) =>
                        j<ReuniaoTarefa>(`/api/reuniao/tarefa/${tid}/descartar`, { method: "POST" }),
  reuniaoBlocoAddTarefa:(bid: string, inp: ReuniaoTarefaPatch) =>
                        j<ReuniaoTarefa>(`/api/reuniao/bloco/${bid}/tarefa`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(inp),
                        }),
  reuniaoAlertaPatch: (aid: string, patch: { descricao?: string; gravidade?: string; evidencia?: string }) =>
                        j<ReuniaoAlerta>(`/api/reuniao/alerta/${aid}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(patch),
                        }),
  reuniaoAlertaAprovar: (aid: string) =>
                        j<ReuniaoAlerta>(`/api/reuniao/alerta/${aid}/aprovar`, { method: "POST" }),
  reuniaoAlertaDescartar: (aid: string) =>
                        j<ReuniaoAlerta>(`/api/reuniao/alerta/${aid}/descartar`, { method: "POST" }),
  reuniaoBlocoAddAlerta: (bid: string, inp: { descricao: string; gravidade?: string; evidencia?: string }) =>
                        j<ReuniaoAlerta>(`/api/reuniao/bloco/${bid}/alerta`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(inp),
                        }),
  reuniaoProjetosCronograma:
                      () => j<ReuniaoProjetoOpt[]>(`/api/reuniao/projetos-cronograma`),
  // Kanban PDCA geral: todas as tarefas aprovadas de reunião + fase
  tarefasKanban:      () => j<TarefaPdca[]>(`/api/reuniao/tarefas-kanban`),
  tarefaPdcaMover:    (tid: string, pdca: PdcaFase) =>
                        j<{ id: string; pdca: PdcaFase }>(`/api/reuniao/tarefa/${tid}/pdca`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ pdca }),
                        }),
  cardTarefas:        (cardId: string) =>
                        j<{ obra_thread_id: number | null; tasks: ChatObraTask[]; open_count: number }>(
                          `/api/reuniao/card/${cardId}/tarefas`),
  cardTarefaToggle:   (taskId: number) =>
                        j<ChatObraTask>(`/api/reuniao/tarefa-chat/${taskId}/toggle`, { method: "POST" }),
  cardTarefaPatch:    (taskId: number, patch: { title?: string; assignee_id?: string | null; due_date?: string | null }) =>
                        j<ChatObraTask>(`/api/reuniao/tarefa-chat/${taskId}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(patch),
                        }),
  cardTarefaDelete:   (taskId: number) =>
                        j<{ ok: boolean }>(`/api/reuniao/tarefa-chat/${taskId}`, { method: "DELETE" }),
  cardTarefaManualAdd:(cardId: string, inp: { title: string; assignee_id?: string | null; due_date?: string | null }) =>
                        j<ChatObraTask>(`/api/reuniao/card/${cardId}/tarefa-manual`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(inp),
                        }),
  cardTarefaComments: (taskId: number) =>
                        j<{ source_msg_id: number | null; comments: ChatObraTaskComment[] }>(
                          `/api/reuniao/tarefa-chat/${taskId}/comments`),
  cardTarefaComment:  (taskId: number, content: string, anexos?: TarefaAnexo[]) =>
                        j<{ id: number; source_msg_id: number }>(`/api/reuniao/tarefa-chat/${taskId}/comment`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ content, anexos: anexos || [] }),
                        }),
  reuniaoTarefaAnexoUpload: async (tid: string, file: File): Promise<TarefaAnexo> => {
                        const fd = new FormData(); fd.append("file", file);
                        const r = await fetch(`/api/reuniao/tarefa/${tid}/anexo`, { method: "POST", body: fd });
                        if (!r.ok) throw new Error(`upload falhou (${r.status}): ${(await r.text()).slice(0,200)}`);
                        return r.json();
                      },
  reuniaoTarefaAnaliseIa: (tid: string, force = false) =>
                        j<TarefaAnaliseIa>(`/api/reuniao/tarefa/${tid}/analise-ia${force ? "?force=true" : ""}`, {
                          method: "POST",
                        }),
  cardTarefasReorder: (ordered_ids: number[]) =>
                        j<{ ok: boolean; count: number }>(`/api/reuniao/tarefas/reorder`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ ordered_ids }),
                        }),
  chatUsers:          (q?: string) => {
                        const qs = q ? `?q=${encodeURIComponent(q)}` : "";
                        return j<ChatUser[]>(`/api/reuniao/users${qs}`);
                      },

  // ═══ Custos de Terceiros (backend em app/custos.py, prefixo /api/custos) ═══
  // Regra do modulo: TODO calculo mora no backend. O front so manda os campos
  // crus (km, litros, check-in/out) e exibe o que voltar em valor_total_cent.
  custosPolitica:     () => j<CustoPolitica>("/api/custos/politica"),
  // Memoria de lancamento: sugestoes aprendidas dos lancamentos anteriores
  // (km da obra, consumo do carro do terceiro, diaria do hotel, preco do
  // litro). O escopo de cada campo e decidido no backend.
  custosMemoria:      (projeto_id?: string, prestador_id?: string) => {
                        const qs = new URLSearchParams();
                        if (projeto_id)   qs.set("projeto_id", projeto_id);
                        if (prestador_id) qs.set("prestador_id", prestador_id);
                        const s = qs.toString();
                        return j<CustoMemoria>(`/api/custos/memoria${s ? `?${s}` : ""}`);
                      },
  custosPrestadores:  (busca?: string) => {
                        const qs = busca ? `?busca=${encodeURIComponent(busca)}` : "";
                        return j<{ items: CustoPrestador[] }>(`/api/custos/prestadores${qs}`);
                      },
  // Grava dados de pagamento (PIX/banco/documento) na ficha do terceiro no
  // Cloud. Volta o prestador atualizado com as pendencias recalculadas.
  custosPrestadorPatch: (pid: string, body: Partial<Pick<CustoPrestador,
                        "tipo_pessoa" | "cpf" | "cnpj" | "pix_chave" | "banco" |
                        "agencia" | "conta" | "conta_tipo" | "titular" | "telefone">>) =>
                        j<CustoPrestador>(`/api/custos/prestadores/${pid}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body),
                        }),
  custosLancamentos:  (params?: { status?: string; projeto_id?: string; prestador_id?: string; fila?: boolean }) => {
                        const qs = new URLSearchParams();
                        if (params?.status)       qs.set("status", params.status);
                        if (params?.projeto_id)   qs.set("projeto_id", params.projeto_id);
                        if (params?.prestador_id) qs.set("prestador_id", params.prestador_id);
                        if (params?.fila)         qs.set("fila", "true");
                        const s = qs.toString();
                        return j<{ items: CustoLancamentoLinha[]; papel: CustoPapel }>(
                          `/api/custos/lancamentos${s ? `?${s}` : ""}`);
                      },
  // Relatorio: linha a linha + resumo por obra/terceiro/categoria/mes.
  // Filtros vazios ficam fora da query (o backend assume os defaults).
  custosRelatorio:    (params?: { de?: string; ate?: string; projeto_id?: string; prestador_id?: string; categoria?: string; status?: string }) => {
                        const qs = new URLSearchParams();
                        (["de", "ate", "projeto_id", "prestador_id", "categoria", "status"] as const)
                          .forEach(k => { if (params?.[k]) qs.set(k, params[k] as string); });
                        const s = qs.toString();
                        return j<CustoRelatorio>(`/api/custos/relatorio${s ? `?${s}` : ""}`);
                      },
  // Mesmo endpoint em formato=csv. Nao usa j() (resposta e arquivo, nao JSON)
  // e precisa do X-User-Email, entao baixa via fetch e devolve o Blob.
  custosRelatorioCsv: async (params?: { de?: string; ate?: string; projeto_id?: string; prestador_id?: string; categoria?: string; status?: string }): Promise<Blob> => {
                        const qs = new URLSearchParams();
                        (["de", "ate", "projeto_id", "prestador_id", "categoria", "status"] as const)
                          .forEach(k => { if (params?.[k]) qs.set(k, params[k] as string); });
                        qs.set("formato", "csv");
                        let me = "";
                        try { me = localStorage.getItem("gestao_user_email") || ""; } catch {}
                        const r = await fetch(`/api/custos/relatorio?${qs.toString()}`, {
                          headers: me ? { "X-User-Email": me } : {},
                        });
                        if (!r.ok) throw new Error(`CSV falhou (${r.status}): ${(await r.text()).slice(0, 200)}`);
                        return r.blob();
                      },
  // Resumo agregado pra aba Custos de Terceiros dentro da obra.
  custosResumoObra:   (pid: string) => j<{
                        n: number; lancado_cent: number; aprovado_cent: number;
                        a_pagar_cent: number; pago_cent: number;
                      }>(`/api/custos/projetos/${pid}/resumo`),
  custosLancamentoNovo: (body: {
                        projeto_id: string; prestador_id: string;
                        data_ida?: string | null; data_volta?: string | null;
                        motivo?: string | null; adiantamento_cent?: number;
                      }) => j<CustoDetalhe>("/api/custos/lancamentos", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      }),
  custosLancamento:   (lid: string) => j<CustoDetalhe>(`/api/custos/lancamentos/${lid}`),
  custosLancamentoPatch: (lid: string, patch: {
                        data_ida?: string | null; data_volta?: string | null;
                        motivo?: string | null; adiantamento_cent?: number;
                      }) => j<CustoDetalhe>(`/api/custos/lancamentos/${lid}`, {
                        method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(patch),
                      }),
  custosLancamentoApagar: (lid: string) =>
                        j<{ ok: boolean }>(`/api/custos/lancamentos/${lid}`, { method: "DELETE" }),
  custosStatus:       (lid: string, para: string, observacao?: string) =>
                        j<CustoDetalhe>(`/api/custos/lancamentos/${lid}/status`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ para, observacao: observacao || null }),
                        }),
  custosDespesaNova:  (lid: string, body: CustoDespesaIn) =>
                        j<CustoDespesa>(`/api/custos/lancamentos/${lid}/despesas`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body),
                        }),
  custosDespesaPatch: (did: string, body: Partial<CustoDespesaIn>) =>
                        j<CustoDespesa>(`/api/custos/despesas/${did}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body),
                        }),
  custosDespesaApagar: (did: string) =>
                        j<{ ok: boolean }>(`/api/custos/despesas/${did}`, { method: "DELETE" }),
  custosDespesaDecisao: (did: string, decisao: "aprovado" | "glosado" | "pendente", glosa_motivo?: string) =>
                        j<CustoDespesa>(`/api/custos/despesas/${did}/decisao`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ decisao, glosa_motivo: glosa_motivo || null }),
                        }),
  // Upload do comprovante. FormData nao leva Content-Type manual (boundary do
  // browser) e por isso nao passa pelo wrapper j().
  custosDespesaAnexo: async (did: string, file: File): Promise<CustoDespesa> => {
                        const fd = new FormData();
                        fd.append("file", file);
                        let me = "";
                        try { me = localStorage.getItem("gestao_user_email") || ""; } catch {}
                        const r = await fetch(`/api/custos/despesas/${did}/anexo`, {
                          method: "POST", body: fd, headers: me ? { "X-User-Email": me } : {},
                        });
                        if (!r.ok) throw new Error(`upload falhou (${r.status}): ${(await r.text()).slice(0, 200)}`);
                        return r.json();
                      },
  // PDF da ordem de pagamento. Nao usa j() (resposta binaria, nao JSON) e
  // precisa do X-User-Email, entao baixa via fetch e abre como blob.
  custosOpPdf:        async (lid: string): Promise<Blob> => {
                        let me = "";
                        try { me = localStorage.getItem("gestao_user_email") || ""; } catch {}
                        const r = await fetch(`/api/custos/lancamentos/${lid}/op.pdf`, {
                          headers: me ? { "X-User-Email": me } : {},
                        });
                        if (!r.ok) throw new Error(`PDF falhou (${r.status}): ${(await r.text()).slice(0, 200)}`);
                        return r.blob();
                      },
};

// ═══════════════════════════════════════════════════════════════════
// Custos de Terceiros
// Todo campo monetario e inteiro em CENTAVOS (sufixo _cent). Nunca float:
// o modulo inteiro, do banco ao PDF, trabalha em centavos.
// ═══════════════════════════════════════════════════════════════════

export type CustoPolitica = {
  id: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  km_valor_cent: number;
  hospedagem_teto_noite_cent: number;
  refeicao_teto_cent: number;
  diaria_fechada_cent: number;
  /** despesa acima disso sem anexo gera alerta (nao bloqueia) */
  anexo_obrigatorio_acima_cent: number;
  observacao: string | null;
};

// Memoria de lancamento: o que o backend aprendeu dos lancamentos anteriores
// (km da obra, consumo do carro do terceiro, diaria do hotel, preco do litro).
// Chave do Record = subcategoria; valores _cent seguem em centavos.
export type CustoMemoriaSugestao = {
  valor_unitario_cent?: number;
  quantidade?: number;
  descricao?: string;
  campos?: Record<string, any>;
};
export type CustoMemoria = { sugestoes: Record<string, CustoMemoriaSugestao> };

export type CustoPrestador = {
  id: string;
  nome: string;
  telefone: string | null;
  categoria: string | null;
  cpf: string | null;
  cnpj: string | null;
  tipo_pessoa: string | null;
  pix_chave: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  conta_tipo: string | null;
  titular: string | null;
  /** ficha incompleta pro pagamento: exibir como pendencia, nunca bloquear */
  pendencias: string[];
};

/** papel do usuario logado, resolvido no backend a partir de user_profiles */
export type CustoPapel = { admin: boolean; financeiro: boolean; financeiro_ve: boolean };

export type CustoStatus = "rascunho" | "enviado" | "em_analise" | "aprovado" | "devolvido" | "pago";

/** linha da listagem (nao traz despesas nem historico) */
export type CustoLancamentoLinha = {
  id: string;
  numero: string;
  status: CustoStatus;
  motivo: string | null;
  data_ida: string | null;
  data_volta: string | null;
  prestador_id: string;
  prestador_nome: string | null;
  total_lancado_cent: number;
  total_aprovado_cent: number;
  adiantamento_cent: number;
  saldo_cent: number;
  centro_custo_nome: string | null;
  criado_por: string | null;
  created_at: string;
  projeto_id: string;
  cliente: string;
  endereco: string | null;
  numero_proposta: string | null;
  n_despesas: number;
  n_alertas: number;
  n_pendentes: number;
};

/** linha do relatorio (uma despesa, com contexto da OP e da obra) */
export type CustoRelatorioLinha = {
  mes: string;
  obra: string;
  numero: string;
  status: CustoStatus;
  terceiro: string | null;
  centro_custo: string | null;
  categoria: string;
  subcategoria: string;
  status_despesa: "pendente" | "aprovado" | "glosado";
  data: string | null;
  descricao: string | null;
  quantidade: number;
  valor_unitario_cent: number;
  valor_total_cent: number;
};

export type CustoRelatorio = {
  items: CustoRelatorioLinha[];
  total_cent: number;
  glosado_cent: number;
  // eixo (obra/terceiro/categoria/mes) -> chave -> soma em centavos
  resumo: Record<string, Record<string, number>>;
};

export type CustoAlerta = { codigo: string; mensagem: string; nivel: string };

export type CustoDespesa = {
  id: string;
  categoria: "deslocamento" | "estadia" | "documentacao";
  subcategoria: string;
  descricao: string | null;
  data: string | null;
  quantidade: number;
  valor_unitario_cent: number;
  valor_total_cent: number;
  campos: Record<string, any>;
  alertas: CustoAlerta[];
  anexo_url: string | null;
  anexo_nome: string | null;
  anexo_content_type: string | null;
  status: "pendente" | "aprovado" | "glosado";
  glosa_motivo: string | null;
  decidido_por: string | null;
  decidido_em: string | null;
  created_at: string;
};

/** payload da despesa: so campos crus, o backend calcula quantidade e total */
export type CustoDespesaIn = {
  subcategoria: string;
  descricao?: string | null;
  data?: string | null;
  quantidade?: number | null;
  valor_unitario_cent?: number;
  campos?: Record<string, any>;
};

export type CustoHistorico = {
  de: string | null;
  para: string;
  usuario_email: string | null;
  usuario_nome: string | null;
  observacao: string | null;
  created_at: string;
};

export type CustoDetalhe = {
  lancamento: CustoLancamentoLinha & {
    politica_id: string | null;
    centro_custo_id: string | null;
    aprovado_por: string | null;
    aprovado_em: string | null;
    pago_por: string | null;
    pago_em: string | null;
    comprovante_url: string | null;
  };
  despesas: CustoDespesa[];
  historico: CustoHistorico[];
  politica: CustoPolitica;
  /** o que falta pra fechar o pagamento (centro de custo, ficha do terceiro) */
  pendencias: string[];
  /** transicoes permitidas pra ESTE usuario neste status; dirige os botoes */
  proximos_status: CustoStatus[];
  pode_editar: boolean;
  pode_decidir: boolean;
  papel: CustoPapel;
};

export type ChatObraTaskComment = {
  id: number; sender_id: string; content: string;
  created_at: string; edited_at: string | null; deleted: boolean;
};

export type ChatUser = {
  id: string; name: string; email: string;
  avatar_url: string | null; sector_id: string | null;
};

export type ChatObraTask = {
  id: number;
  obra_thread_id: number;
  title: string;
  created_by: string;
  assignee_id: string | null;
  due_date: string | null;
  done: number;
  done_by: string | null;
  done_at: string | null;
  source_msg_id: number | null;
  created_at: string;
};

// ─── Reunião — types ─────────────────────────────────────
export type Reuniao = {
  id: string; data: string; conduzido_por: string | null; titulo: string | null;
  status: "em_andamento" | "encerrada";
  created_at: string; encerrada_em?: string | null;
};

export type ReuniaoTarefa = {
  id: string; ordem: number; titulo: string; titulo_original: string | null;
  responsavel_user_id: string | null; responsavel_nome_falado: string | null;
  responsavel_email: string | null;
  prazo_texto: string | null; prazo_data: string | null;
  tipo: string | null;
  status: "pending" | "approved" | "edited" | "discarded";
  chat_task_id: number | null;
  decidido_em: string | null;
};

// Tarefa aprovada de reunião no kanban PDCA geral (/tarefas).
// Fase mora em meta.pdca no backend; chat_done vem do obra_tasks do chat.
export type PdcaFase = "plan" | "do" | "check" | "act";

export type TarefaPdca = {
  id: string; titulo: string; tipo: string | null;
  responsavel_nome_falado: string | null;
  responsavel_user_id: string | null;
  responsavel_email: string | null;
  prazo_texto: string | null; prazo_data: string | null;
  chat_task_id: number | null; chat_thread_id: number | null;
  pdca: PdcaFase;
  decidido_por: string | null; decidido_em: string | null; created_at: string;
  bloco_id: string;                  // bloco da reunião que originou a tarefa (pra buscar transcrição)
  bloco_resumo: string | null;       // resumo em bullets extraído do áudio pela IA
  projeto_id: string | null; projeto_nome: string | null; card_id: string | null;
  reuniao_data: string;
  chat_done: boolean | null; chat_done_at: string | null;
  // meta pode conter anexos[] e analise_ia — expostos pelo endpoint /tarefas-kanban
  meta?: { anexos?: TarefaAnexo[]; analise_ia?: TarefaAnaliseIa; [k: string]: any } | null;
};

export type TarefaAnexo = { url: string; name: string; mime: string; size: number };
export type TarefaAnaliseIa = {
  texto: string;
  raw?: { diagnostico?: string; proximos_passos?: { titulo: string; quem: string; prazo_sugerido?: string; detalhe?: string }[] };
  conv_msgs?: number;
  gerada_em?: string;
};

export type ReuniaoBloco = {
  id: string; reuniao_id: string; projeto_id: string | null;
  projeto_nome_snapshot: string; card_id_snapshot: string | null;
  audio_url: string | null; duracao_seg: number | null;
  status: "gravando" | "processando" | "review" | "aprovado" | "descartado" | "erro";
  erro_msg?: string | null;
  transcricao?: string | null; resumo?: string | null;
  meta?: any;
  created_at: string; encerrado_em?: string | null; aprovado_em?: string | null;
};

export type ReuniaoAlerta = {
  id: string; ordem: number;
  descricao: string; descricao_original: string | null;
  evidencia: string | null;
  gravidade: "leve" | "media" | "grave";
  status: "pending" | "approved" | "edited" | "discarded";
  crise_id: string | null;
  decidido_em: string | null;
};

export type ReuniaoBlocoReview = ReuniaoBloco & {
  tarefas: ReuniaoTarefa[];
  alertas: ReuniaoAlerta[];
};

export type ReuniaoBlocoResumo = ReuniaoBloco & { n_tarefas: number; n_tarefas_aprovadas: number };

export type ReuniaoDetalhe = Reuniao & {
  n_blocos: number; n_aprovados: number; n_review: number;
  n_tarefas_total: number; n_tarefas_aprovadas: number; n_tarefas_pending: number;
  blocos: ReuniaoBlocoResumo[];
};

export type ReuniaoTarefaPatch = {
  titulo?: string;
  responsavel_user_id?: string | null;
  responsavel_nome_falado?: string | null;
  responsavel_email?: string | null;
  prazo_data?: string | null;
  prazo_texto?: string | null;
  tipo?: string;
};

export type ReuniaoProjetoOpt = {
  id: string; card_id: string | null; cliente: string;
  numero_proposta: string | null; status: string;
  column_id: string | null; coluna_titulo: string | null;
  gestor_email: string | null; updated_at: string;
  pct_completo: number;
};

export type DocCatalogo = {
  id: number; fase: number; fase_titulo: string; codigo: string; titulo: string;
  etapa_numero: number | null; obrigatorio: boolean; ordem: number;
};

export type AnteprojetoPrancha = {
  id: string;
  project_id: string;
  code: string | null;
  title: string | null;
  revision_num: string | null;
  created_at: string;
  meta?: any;
  pdf_url: string;
  editor_url: string;
};

export type Documento = {
  id: string; projeto_id: string; catalogo_id: number | null; etapa_numero: number | null;
  slug: string; titulo: string; arquivo_url: string | null; storage_path: string | null;
  content_type: string | null; nome_arquivo: string | null; tamanho_bytes: number | null;
  gerado_por: string | null; meta?: any; created_at: string;
  fase: number | null; fase_titulo: string | null; codigo: string | null;
  catalogo_titulo: string | null;
};

export type SolicitacaoCompra = {
  id: string | number;
  dept_id?: string;
  column_id?: string | null;      // coluna atual no kanban de compras (null = card apagado)
  titulo?: string;
  solicitante: string;
  departamento?: string;
  responsavel?: string;
  data: string;
  prazo: string;
  materiais: { tipo: string; quantidade: string; justificativa: string }[];
  obs?: string;
  status?: string;                // details.status_solicitacao: pendente|aceito|rejeitado|concluido
  motivo?: string | null;         // motivo da rejeição (details.motivo_rejeicao)
  origem?: string | null;         // details.origem: de onde veio o pedido (fiscal_verifica, gestao_projeto…)
  origem_nome?: string | null;    // quem originou fora do gestão (ex: nome do fiscal no verifica)
  obra?: string | null;           // título do card pai no Space (quando sem projeto no gestao)
  parent_card_id?: string | null;
  // presentes quando a solicitação casa com um projeto do gestao
  projeto_id?: string;
  cliente?: string;
  obra_code?: string | null;
};

// ─── Types: Obra · Acompanhamento ──────────────────────
export type ObraAlerta = { tipo: string; data: string | null; motivo: string };

export type ObraAcompanhamento = {
  projeto_id: string;
  entrada_obra: string | null;              // entrada da obra editável na ficha do cliente
  inicio_obra: string | null;
  previsao_entrega_manual: string | null;   // manual de propósito — sem auto-calcular
  descricao_produto: string | null;
  alertas: ObraAlerta[];
  share_token: string | null;
  meta: any;
};

export type FotoObra = {
  id: string;
  projeto_id: string;
  item_id: string | null;
  url: string;
  legenda: string | null;
  ambiente: string | null;
  categoria: string | null;
  tipo: string;                 // foto | video
  origem: string;               // upload | fiscal | instala
  fonte_id: string | null;
  storage_path: string | null;
  ordem: number;
  autor_email: string | null;
  created_at: string;
  center_visivel: boolean;      // curada pra aparecer na Central do Cliente
};

export type PublicoObra = {
  projeto: {
    id: string; cliente: string; endereco: string | null; obra_code: string | null;
    numero_proposta: string | null; vendedor: string | null; gestor_email: string | null;
    status: string;
  };
  acompanhamento: ObraAcompanhamento;
  itens: Item[];
  fotos: FotoObra[];
  prestadores: { nome: string; telefone: string | null; categoria: string | null }[];
};

// ─── Types: Equipes Parket (prestadores) ───────────────
/** Uma linha da lista de acessos do instala (um prestador). */
export type PrestadorAcesso = {
  prestador_id: string;
  nome: string | null;
  telefone: string | null;
  categoria: string | null;
  ativo: boolean | null;
  login: string | null;
  senha: string | null;
  tem_acesso: boolean;
  atualizado_em: string | null;
  atualizado_por: string | null;
  // Nomes das linhas de equipes_parket ligadas a este prestador
  equipes: string[];
  no_gestao: boolean;
};

export type EquipeParket = {
  id: string;
  nome: string;
  telefone: string | null;
  /** Frente principal — é por ela que a lista agrupa. */
  categoria: string;
  /** Todas as frentes que o instalador atende (dedup 018). Inclui a principal. */
  categorias?: string[] | null;
  ativo: boolean;
  cnpj_cpf: string | null;
  endereco: string | null;
  email: string | null;
  foto_url: string | null;
  total_checks: number;
  total_ok: number;
  total_ocorrencias: number;
  total_sem_resposta: number;
  pct_ok: number | null;
  ultimo_check: string | null;
  dias_verificados: number;
  obras_distintas: number;
  created_at: string;
  updated_at: string;
};

export type EquipeInput = {
  nome: string;
  telefone?: string | null;
  categoria: string;
  ativo?: boolean;
  cnpj_cpf?: string | null;
  endereco?: string | null;
  email?: string | null;
  foto_url?: string | null;
};

export type TermoResumo = {
  id: string;
  equipe_id: string;
  card_id: string;
  projeto_id: string | null;
  status: "pendente" | "aceito" | "recusado" | "cancelado";
  criado_em: string;
  aceito_em: string | null;
  pdf_url: string | null;
  prestador_nome: string | null;
  n_itens: number;
  cliente: string | null;
  obra_code: string | null;
  /** Presente = anexo ativado por OTP (contrato geral F4). Nulo em aceito = termo legado re-assinado. */
  contrato_aceite_id?: string | null;
};

/** Status do contrato geral (F5 #1989): melhor aceite de cada prestador, chaveado por equipe_id. */
export type ContratoGeralEquipe = {
  versao_termos: number;
  aceito_em: string | null;
  pdf_url: string | null;
  /** Foto (selfie) e assinatura registradas no aceite do contrato geral (bucket público). */
  selfie_url?: string | null;
  assinatura_url?: string | null;
  /** true = aceite da versão vigente do catálogo; false = versão antiga (re-aceite no próximo login). */
  vigente: boolean;
};
export type ContratoGeralResp = {
  versao_vigente: number;
  por_equipe: Record<string, ContratoGeralEquipe>;
};

export type FiscalVinculado = {
  id: string; nome: string;
  telefone?: string | null; email?: string | null; ativo?: boolean;
};

export type PrestadorVinculado = EquipeParket & {
  // Pode vir só com nome/telefone/categoria caso não bata com equipes_parket
  id: string;
  // Ids de gestao.itens que ESTE prestador executa. Vazio ou ausente = obra inteira.
  escopo_itens_ids?: string[];
};

export type EquipeObra = {
  card_id: string;
  cliente: string | null;
  obra_code: string | null;
  column_id: string | null;
  dept_id: string | null;
  sla_status: string | null;
  projeto_id: string | null;
};

export type EquipeComObras = Pick<
  EquipeParket,
  "id" | "nome" | "telefone" | "categoria" | "categorias" | "ativo" | "pct_ok" | "ultimo_check" | "obras_distintas"
> & {
  obras: EquipeObra[];
  total_ocorrencias?: number;
  bloqueado_em?: string | null;
  bloqueado_por?: string | null;
  bloqueio_motivo?: string | null;
  aval_n?: number;
  score?: number | null;
  mancadas?: number;
  tier?: "A" | "B" | "C" | null;
  status_banco?: "em_obra" | "disponivel" | "bloqueado";
};

export type PrestadorAvaliacao = {
  id: string;
  equipe_id: string;
  card_id: string | null;
  obra: string | null;
  avaliador_email: string;
  avaliador_nome: string | null;
  papel: "fiscal" | "gestao";
  nota_qualidade: number;
  nota_prazo: number;
  nota_postura: number;
  nota_retrabalho: number;
  comentario: string | null;
  created_at: string;
};

export type PrestadorEvento = {
  id: string;
  equipe_id: string;
  tipo: "mancada" | "elogio";
  gravidade: "leve" | "media" | "grave" | null;
  descricao: string;
  card_id: string | null;
  obra: string | null;
  registrado_por: string | null;
  created_at: string;
};

export type CriseColuna = "entrada" | "analisando" | "resolvendo" | "resolvido";
export type CriseGravidade = "leve" | "media" | "grave";

// Setores que fazem sentido pra crise operacional. Mesmo enum do backend
// (main.py CRISE_SETORES). Label + cor ficam aqui pra controle da UX.
export type CriseSetor =
  | "comercial" | "atendimento" | "projetos" | "producao" | "obras"
  | "operacional" | "fiscal" | "compras" | "prestadores" | "logistica"
  | "financeiro" | "orcamento" | "marketing" | "rh";

export const CRISE_SETORES: { id: CriseSetor; label: string }[] = [
  { id: "atendimento",  label: "Atendimento / CS" },
  { id: "comercial",    label: "Comercial" },
  { id: "compras",      label: "Compras" },
  { id: "financeiro",   label: "Financeiro" },
  { id: "fiscal",       label: "Fiscal" },
  { id: "logistica",    label: "Logística / Expedição" },
  { id: "marketing",    label: "Marketing" },
  { id: "obras",        label: "Obras" },
  { id: "operacional",  label: "Operacional" },
  { id: "orcamento",    label: "Orçamento / Valoria" },
  { id: "prestadores",  label: "Prestadores" },
  { id: "producao",     label: "Produção" },
  { id: "projetos",     label: "Projetos" },
  { id: "rh",           label: "RH" },
];

export type CriseAnexo = {
  url: string;
  name: string;
  mime?: string | null;
  size?: number | null;
};

export type CriseComentario = {
  id: string;
  autor_email: string | null;
  autor_nome: string | null;
  texto: string;
  tipo: "comentario" | "mudanca_coluna" | "mudanca_gravidade" | "resolucao" | "analise_ia";
  meta: { conv_msgs?: number; raw?: any } | null;
  anexos: CriseAnexo[];
  created_at: string;
};

export type Crise = {
  id: string;
  card_id: string | null;
  projeto_id: string | null;
  projeto_nome: string | null;
  cliente: string | null;
  descricao: string;
  gravidade: CriseGravidade;
  origem: "relacionamento" | "projeto" | "manual";
  coluna: CriseColuna;
  setor_responsavel: CriseSetor | null;
  setores_notificar: CriseSetor[];
  responsavel_email: string | null;
  responsavel_nome: string | null;
  notificar: { nome: string; email: string }[];
  prazo: string | null;
  criado_por: string | null;
  resolucao: string | null;
  resolvido_em: string | null;
  created_at: string;
  updated_at: string;
};

export type OperacoesEquipesResp = {
  grupos: { categoria: string; equipes: EquipeComObras[] }[];
};

/** Um prestador vinculado a uma obra, com a origem do vínculo.
 *  origem: "gestao" = só em details.prestadores, "instala" = só em
 *  prestador_card, "ambos" = os dois lados batem (situação normal). */
export type ObraPrestadorVinculo = {
  equipe_id: string | null;
  prestador_id: string | null;
  nome: string | null;
  telefone: string | null;
  categoria: string | null;
  origem: "gestao" | "instala" | "ambos";
};

export type ObraComPrestadores = {
  card_id: string;
  cliente: string | null;
  obra_code: string | null;
  column_id: string | null;
  dept_id: string | null;
  sla_status: string | null;
  projeto_id: string | null;
  prestadores: ObraPrestadorVinculo[];
};

export type ObrasPrestadoresResp = {
  obras: ObraComPrestadores[];
  // Catálogo de equipes ativas pro seletor da tela
  equipes: { id: string; nome: string; telefone: string | null;
             categoria: string | null; prestador_id: string | null }[];
};

// ─── Types: Relacionamento (Painel CS · WhatsApp) ──────
export type WhatsappMessage = {
  id: string;
  phone: string;
  instance: string | null;
  direction: "in" | "out";
  sender_name: string | null;
  message_text: string | null;
  message_type: string | null;
  media_url: string | null;
  timestamp: string;
  evolution_msg_id: string | null;
  card_id: string | null;
};

export type RelacionamentoConversa = {
  id: string;
  grupo_jid: string;
  instance_name: string;
  status: string;
  prioridade: string | null;
  atribuido_a: string | null;
  tags: string[] | null;
  last_msg_at: string | null;
  last_msg_preview: string | null;
  last_msg_from_me: boolean | null;
  unread_count: number;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type WhatsappGrupo = {
  id: string;
  grupo_jid: string;
  instance_name: string;
  subject: string | null;
  cliente: string | null;
  obra_code: string | null;
  membros: number;
  saude: string | null;
  card_id: string | null;
  updated_at: string | null;
};

export type RelacionamentoResp = {
  conversa: RelacionamentoConversa | null;
  grupo_jid: string | null;
  instance: string;
  card_id: string;
  mensagens: WhatsappMessage[];
};

export type ConversaResumo = RelacionamentoConversa & {
  card_id: string | null;
  is_grupo: boolean;
  subject: string | null;
  cliente: string | null;
  obra_code: string | null;
  projeto_id: string | null;
};

export type CopilotoSugestao = {
  tom: "positiva" | "neutra" | "negativa";
  titulo: string;
  texto: string;
};

export type CopilotoResp = {
  ok: boolean;
  sugestoes: CopilotoSugestao[];
  ultima_mensagem_cliente: string;
  n_mensagens_contexto: number;
};

// ─── Types: Cronograma v2 (agrega gestao.itens por categoria) ──
export type CronogramaItemGrupo = {
  projeto_id: string;
  categoria: string;       // UPPER — chave canônica
  n_itens: number;
  quantidade_total: number;
  unidade: string | null;
  responsavel: string | null;   // nome da equipe se todos itens iguais; null se divergem/vazio
  previsao_inicio: string | null;
  previsao_fim: string | null;
  ambientes: string[];
};

// ─── Types: Cronograma (obras) ─────────────────────────
export type CronogramaRow = {
  id: string;
  tipo: string;                  // obras | marcenaria | reparos
  categoria: string;             // acompanhamento | cronograma_final | obras_liberadas | travado | finalizadas
  nome_obra: string;
  card_id: string | null;
  equipe: string | null;
  fiscal: string | null;
  servico: string | null;
  dias: string | null;
  custos: string | null;
  observacao: string | null;
  localizacao: string | null;
  data: string | null;
  inicio_dia: string | null;
  termino_dia: string | null;
  contrato: string | null;
  dispos: string | null;
  status_obra: string | null;
  data_finalizacao: string | null;
  posicao: number | null;
  created_at: string;
  updated_at: string;
};

export type CronogramaInput = {
  tipo?: string;
  categoria?: string;
  nome_obra: string;
  card_id?: string | null;
  equipe?: string | null;
  fiscal?: string | null;
  servico?: string | null;
  dias?: string | null;
  custos?: string | null;
  observacao?: string | null;
  localizacao?: string | null;
  data?: string | null;
  inicio_dia?: string | null;
  termino_dia?: string | null;
  contrato?: string | null;
  dispos?: string | null;
  status_obra?: string | null;
  data_finalizacao?: string | null;
};

// ─── Types: Relatório modelo Parket (fiscal_laudos.relatorio_dados) ─────
export type RelatorioEntrada = { autor: string; data: string; texto: string };
export type RelatorioMedicaoItem = { item: string; descricao: string; qtd: string };
export type RelatorioServico = { descricao: string; quantidade: string; previsao_inicio?: string; liberacao?: string };
export type RelatorioTermo = {
  condicao?: string;
  resp_obra?: string; resp_cpf?: string; resp_data?: string;
  tecnico?: string; tecnico_cpf?: string; tecnico_data?: string;
  /** assinaturas digitais desenhadas na tela — data URI PNG */
  resp_ass?: string; tecnico_ass?: string;
};
export type RelatorioDados = {
  vendedor?: string;
  responsavel?: string;
  descricao_produto?: string;
  servico_contratado?: RelatorioServico[];
  medicao_itens?: RelatorioMedicaoItem[];
  relatorio_numero?: number;
  relatorio_data?: string;
  entradas?: RelatorioEntrada[];
  termo?: RelatorioTermo;
  /** resumo técnico lapidado pela IA (persona engenheiro) — texto que o cliente lê/assina */
  lapidado?: { resumo?: string; em?: string; por?: string | null; modelo?: string };
  /** briefing executivo pro gestor (interno) — cached em relatorio_dados */
  resumo_gestor?: { resumo?: string; pendencias?: string[]; em?: string; por?: string | null; modelo?: string };
};
// Campos próprios do laudo do fiscal na página pública de assinatura —
// mesmo conjunto do painel do cliente (CENTER_LAUDO_CAMPOS/CHECKLISTS no backend)
export type LaudoConteudoPublico = {
  setor?: string;
  descritivo_sistema?: string;
  descritivo_material?: string;
  servicos_inclusos?: string[];
  medicao_obra?: string;
  ocorrencias?: string;
  materiais_falta?: string;
  insumos_falta?: string;
  metragem_areas?: string;
  obs_andaime?: string;
  tipo_laje?: string;
  reforco_necessario?: string;
  insumos_necessarios?: string;
  sistema_instalacao?: string;
  materiais_necessarios?: string;
  resultado?: string;
  checklists?: Record<string, Record<string, { valor?: string; obs?: string }>>;
};
export type LaudoProjetoInfo = {
  id: string; cliente: string; endereco: string | null;
  vendedor: string | null; numero_proposta: string | null;
};
export type LaudoItemProjeto = {
  id: string; descritivo: string; ambiente: string | null;
  quantidade: number; unidade: string; codigo: string | null; produto_header: string | null;
};

// ─── Type: Laudo detalhado (com todos os checklists JSONB) ─────
export type LaudoDetalhado = Laudo & {
  descritivo_sistema: string | null;
  descritivo_material: string | null;
  servicos_inclusos: string[] | null;
  medicao_obra: string | null;
  relatorio_dados?: RelatorioDados | null;
  // Campos preenchidos pelo fiscal no verifica que faltavam no type
  ocorrencias?: string | null;
  materiais_falta?: string | null;
  insumos_falta?: string | null;
  metragem_areas?: string | null;
  obs_andaime?: string | null;
  tipo_laje?: string | null;
  reforco_necessario?: string | null;
  insumos_necessarios?: string | null;
  materiais_necessarios?: any;
  descritivo_reparo?: string | null;
  obs_solucao?: string | null;
  sistema_instalacao?: string | null;
  resultado?: any;
  assinatura_fiscal_url?: string | null;
  assinado_em?: string | null;
  assinado_por?: string | null;
  iniciado_em?: string | null;
  iniciado_lat?: number | null;
  iniciado_lng?: number | null;
  updated_at?: string | null;
  checklist_piso: any;
  checklist_deck: any;
  checklist_forro: any;
  checklist_painel: any;
  checklist_liberacao: any;
  checklist_equipe: any;
  checklist_produtividade: any;
  checklist_reparo: any;
  checklist_entrega: any;
  checklist_extra: any;
  checklist_escada?: any;
  checklist_porta?: any;
  checklist_bancos?: any;
};

// ─── Types: combobox + Gestão de Laudos ─────────
export type ProjetoResumo = {
  id: string;
  card_id: string | null;
  cliente: string;
  obra_code: string | null;
  endereco: string | null;
  numero_proposta: string | null;
  column_id: string | null;
};

export type LaudoAll = Laudo & {
  projeto_id?: string | null;   // linka pra /projetos/:id se houver gestao.projetos vinculado
};

// ─── Types: Laudos & Fotos ─────────────────────────
export type Laudo = {
  id: string;
  card_id: string | null;
  obra: string | null;
  cliente: string | null;
  endereco: string | null;
  tipo: string;                      // 1vistoria|2vistoria|acompanhamento|entrega|reparo
  fiscal_id: string | null;
  fiscal_nome: string | null;
  data_vistoria: string | null;
  data_agendamento: string | null;
  status: string;                    // pendente|agendado|em_andamento|concluido|cancelado
  setor: string | null;
  descritivo_sistema: string | null;
  descritivo_material: string | null;
  servicos_inclusos: string[] | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type Foto = {
  id: string;
  laudo_id: string | null;
  card_id: string | null;
  ambiente: string | null;
  url: string;
  descricao: string | null;
  servico: string | null;
  tipo: string | null;               // "foto" | "video"
  storage_path: string | null;
  created_at: string;
};

// ─── Types: Agenda (Kanban Semanal) ────────────────
export type AgendaTipo = "1vistoria" | "2vistoria" | "acompanhamento" | "entrega" | "reparo";
export type AgendaStatus = "agendado" | "confirmado" | "realizado" | "cancelado";
export type Agenda = {
  id: string;
  card_id: string | null;
  fiscal_id: string | null;
  fiscal_nome: string | null;
  tipo: AgendaTipo;
  data_inicio: string;
  data_fim: string | null;
  obra: string | null;
  cliente: string | null;
  endereco: string | null;
  status: AgendaStatus;
  notas: string | null;
  online: boolean;
  /** online + no_calendario = fica na coluna do dia; online sem no_calendario = coluna Acompanhamento Online */
  no_calendario: boolean;
  tags: string[] | null;
  /** Anexos do agendamento (projeto anexado, o que foi vendido…); arquivo vive no bucket fiscal-anexos */
  attachments: AgendaAnexo[] | null;
  created_at: string;
  updated_at: string;
};
export type AgendaAnexo = {
  url: string;
  nome: string;
  content_type: string | null;
  size: number | null;
};
export type AgendaInput = {
  tipo: AgendaTipo;
  data_inicio: string;
  data_fim?: string | null;
  fiscal_id?: string | null;
  card_id?: string | null;
  obra?: string | null;
  cliente?: string | null;
  endereco?: string | null;
  notas?: string | null;
  status?: AgendaStatus;
  online?: boolean;
  no_calendario?: boolean;
  tags?: string[];
  attachments?: AgendaAnexo[];
};

// ─── Types: Fiscal ───────────────────────────────────
export type Fiscal = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  permissoes: Record<string, boolean> | null;
  whatsapp_group_jid: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};
export type FiscalInput = {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  ativo?: boolean;
  permissoes?: Record<string, boolean>;
  whatsapp_group_jid?: string | null;
};

// ─── Types: InstaParket ────────────────────────────────
export type InstaQueueItem = {
  foto_id: string | null;                       // já em gestao.fotos
  fonte: "gestao" | "fiscal" | "instala";
  fonte_id: string | null;
  projeto_id: string;
  cliente: string;
  url: string;
  tipo: string;                                 // 'foto' | 'video'
  legenda: string | null;
  ambiente: string | null;
  origem: string | null;
  created_at: string;
  postada: boolean;
};

export type InstaMidiaIn = {
  foto_id?: string | null;
  fonte?: string | null;
  fonte_id?: string | null;
  url?: string | null;
  tipo?: string | null;
  legenda?: string | null;
  ambiente?: string | null;
};

export type InstaPostMidia = {
  foto_id: string; url: string; tipo: string;
  legenda: string | null; ambiente: string | null;
};

export type InstaPost = {
  id: string; projeto_id: string; legenda: string | null;
  created_at: string; publicado_por: string;
  cliente: string; concluido: boolean;
  midias: InstaPostMidia[];
  curtidas: number; comentarios: number; curti: boolean;
  avatar_url?: string | null;
};

export type InstaPerfil = {
  projeto_id: string; cliente: string; concluido: boolean;
  posts: number; ultimo_post: string | null; avatar_url: string | null;
};
