/**
 * API do home broker — abstrai queries dos schemas que já existem no Supabase.
 * Reusa tabelas: kanban_cards, kanban_columns, card_movements, card_events,
 * whatsapp_messages, atendimento_conversas, marketing_leads_mensal.
 */
import { useEffect, useState } from "react";
import { supabase, supabaseValoria } from "./supabase";

export type KanbanCard = {
  id: string;
  dept_id: string;
  column_id: string;
  title: string | null;
  subtitle: string | null;
  obra: string | null;
  responsavel: string | null;
  sla: string | null;
  sla_status: string | null;
  tags: string[] | null;
  progress: number | null;
  value: string | null;
  created_at: string;
  updated_at: string | null;
  details?: any;
};

export type KanbanColumn = {
  id: string;          // uuid
  dept_id: string;
  slug: string;        // slug like "ganho", "em-negociacao"
  title: string;
  color?: string | null;
  position?: number;
};

/**
 * Resolve column_id de um card (que pode vir como UUID ou como slug) para
 * o SLUG canônico. Se não bater nada, devolve o original.
 */
export function resolveSlug(cardColumnId: string | null | undefined, columns: KanbanColumn[]): string {
  if (!cardColumnId) return "";
  // Já é slug?
  const bySlug = columns.find((c) => c.slug === cardColumnId);
  if (bySlug) return bySlug.slug;
  // É uuid?
  const byId = columns.find((c) => c.id === cardColumnId);
  if (byId) return byId.slug;
  return cardColumnId;
}

export type CardMovement = {
  id: string;
  card_id: string;
  from_column: string | null;
  to_column: string;
  moved_by: string | null;
  moved_at: string;
};

export type WhatsAppMessage = {
  id: string;
  card_id: string | null;
  phone: string | null;
  direction: "in" | "out";
  text: string | null;
  created_at: string;
  message_type?: string | null;       // conversation | imageMessage | audioMessage | documentMessage | videoMessage | stickerMessage | locationMessage | contactMessage | reactionMessage
  media_url?: string | null;
  evolution_msg_id?: string | null;
  metadata?: any;
};

// ─── Funis comerciais ────────────────────────────────────────────────
export const DEPT_ENTRADA = "comercial-entrada";
export const DEPT_COMERCIAL = "comercial";

// ─── Social Selling (Will 01/09) ─────────────────────────────────────
// Funil de relacionamento com ARQUITETOS que passaram pelo SDR.
// 3 pipelines encadeados (aquisição → conexão → ativação), movimento
// 100% manual pelo Vinicius. Cards vivem nas mesmas kanban_cards/columns.
export const DEPT_SOCIAL_AQUISICAO = "social-aquisicao";
export const DEPT_SOCIAL_CONEXAO   = "social-conexao";
export const DEPT_SOCIAL_ATIVACAO  = "social-ativacao";
export const DEPTS_SOCIAL = [DEPT_SOCIAL_AQUISICAO, DEPT_SOCIAL_CONEXAO, DEPT_SOCIAL_ATIVACAO];

/** Hook genérico de fetch com loading/error/reload + timeout 15s. */
export function useFetch<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      if (alive) {
        setError("Timeout: a consulta demorou demais (>30s). Tente recarregar.");
        setLoading(false);
        console.error("[useFetch] timeout 30s");
      }
    }, 30000);
    fn().then(
      (d) => { if (alive) { clearTimeout(timer); setData(d); setLoading(false); setError(null); } },
      (e) => {
        if (alive) {
          clearTimeout(timer);
          const msg = e?.message || e?.error_description || String(e) || "Erro desconhecido";
          setError(msg);
          setLoading(false);
          console.error("[useFetch] erro:", e);
        }
      },
    );
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, key]);
  return { data, loading, error, reload: () => setKey((k) => k + 1) };
}

// Cache em memória pra condominiosList (TTL ~5min). Reset via api.condominiosListReset().
let condominiosCache: string[] | null = null;

// Cache email → valoria orcamentista_id (team.orcamentistas).
// Reset por sessão (sem TTL — orcamentistas raramente mudam).
const valoriaOrcCache = new Map<string, string | null>();

async function getValoriaOrcamentistaId(email: string): Promise<string | null> {
  const key = email.toLowerCase().trim();
  if (valoriaOrcCache.has(key)) return valoriaOrcCache.get(key)!;
  // Valoria expõe team.orcamentistas via PostgREST com Accept-Profile=team
  // Como nosso cliente supabaseValoria default-schema é "ops", uso fetch direto.
  const r = await fetch(
    `https://skbjmlzgaeupflujomzw.supabase.co/rest/v1/orcamentistas?email=ilike.${encodeURIComponent(key)}&select=id`,
    {
      headers: {
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrYmptbHpnYWV1cGZsdWpvbXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjA1NDYsImV4cCI6MjA5NzE5NjU0Nn0.iAPj6bE_Kysd1I_RLWp3gR-J4YFy-Ps71-E-ukjOUGI",
        "Accept-Profile": "team",
      },
    }
  );
  const arr = await r.json().catch(() => []);
  const id = Array.isArray(arr) && arr[0]?.id ? String(arr[0].id) : null;
  valoriaOrcCache.set(key, id);
  return id;
}

const unwrap = <T,>(r: { data: T | null; error: any }): T => {
  if (r.error) throw new Error(r.error.message || String(r.error));
  return r.data as T;
};

export const api = {
  /** Colunas dos 2 funis (entrada + comercial) ordenadas pelo `position`. */
  columns: async (): Promise<KanbanColumn[]> => {
    const r = await supabase
      .from("kanban_columns")
      .select("*")
      .in("dept_id", [DEPT_ENTRADA, DEPT_COMERCIAL]);
    const cols = unwrap(r);
    return (cols || []).sort((a: any, b: any) => {
      if (a.dept_id !== b.dept_id) return a.dept_id < b.dept_id ? -1 : 1;
      return (a.position ?? 0) - (b.position ?? 0);
    });
  },

  /** Cards dos 2 funis. Limit padrão 600 (suficiente pros KPIs/funil sem travar). */
  cards: async (limit = 600): Promise<KanbanCard[]> => {
    // colunas mínimas pra não trafegar `details` (jsonb pesado) na lista
    const r = await supabase
      .from("kanban_cards")
      .select("id, dept_id, column_id, title, subtitle, obra, responsavel, sla, sla_status, tags, progress, value, created_at, updated_at")
      .in("dept_id", [DEPT_ENTRADA, DEPT_COMERCIAL])
      .order("updated_at", { ascending: false })
      .limit(limit);
    return unwrap(r) || [];
  },

  /** Cards de UM funil só, com `details` completo (pro Book — tem metragem, valor, etc).
   *  Sem teto: pagina até trazer TODOS os cards do dept (Will 04/08 — o top-N por
   *  updated_at deixava cards antigos fora da janela e "sumiam" do pipeline). */
  cardsWithDetails: async (deptId: string, responsavel?: string): Promise<(KanbanCard & { details: any })[]> => {
    const PAGE = 1000;
    const data: any[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = supabase
        .from("kanban_cards")
        .select("id, dept_id, column_id, title, subtitle, obra, responsavel, sla, sla_status, tags, progress, value, details, created_at, updated_at")
        .eq("dept_id", deptId)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true }) // tiebreaker: sem ele o range pula/duplica linhas
        .range(from, from + PAGE - 1);
      // Vendedor/SDR: filtra no servidor (payload menor)
      if (responsavel && responsavel.trim()) q = q.ilike("responsavel", responsavel.trim());
      const page = unwrap(await q) || [];
      data.push(...page);
      if (page.length < PAGE) break;
    }
    // Reduz peso do JSONB no client — Book só usa esses campos. Cards detalhados
    // ainda vêm completos via api.card(id) quando o user abre o CardDetail.
    return data.map((c: any) => {
      const d = c.details || {};
      return {
        ...c,
        details: {
          overview_ia: d.overview_ia,
          resumo_qualificacao: d.resumo_qualificacao,
          qualificacao_inicial: d.qualificacao_inicial,
          produto_interesse: d.produto_interesse,
          relacao_obra: d.relacao_obra,
          preferencia_madeira: d.preferencia_madeira,
          metragem_estimada: d.metragem_estimada, area_m2: d.area_m2,
          metragem: d.metragem, metros: d.metros, m2: d.m2,
          cidade: d.cidade, city: d.city,
          investimento: d.investimento, orcamento: d.orcamento,
          budget: d.budget, valor: d.valor,
          nivel_lead: d.nivel_lead, qualificacao: d.qualificacao,
          status_lead: d.status_lead, sdr: d.sdr, vendedor: d.vendedor,
          favorito_douglas: d.favorito_douglas,
          // Origem / atribuição de mídia — o Report classifica o lead por canal
          // (Meta, Google, Site, WhatsApp, Homebroker) a partir destes campos.
          origem: d.origem, origem_lead: d.origem_lead, origem_detalhe: d.origem_detalhe,
          platform: d.platform, platform_label: d.platform_label,
          campaign_id: d.campaign_id, campaign_name: d.campaign_name,
          attribution: d.attribution, meta_tracking: d.meta_tracking,
        },
      };
    });
  },

  // ─── Social Selling ────────────────────────────────────────────────

  /** Colunas dos 3 pipelines do Social Selling, ordenadas por position.
   *  sla_label carrega o prazo visual da coluna ("3 dias", "7 dias", "30 dias"). */
  socialColumns: async (): Promise<(KanbanColumn & { sla_label?: string | null })[]> => {
    const r = await supabase
      .from("kanban_columns")
      .select("*")
      .in("dept_id", DEPTS_SOCIAL);
    const cols = unwrap(r) || [];
    return cols.sort((a: any, b: any) => {
      if (a.dept_id !== b.dept_id) return a.dept_id < b.dept_id ? -1 : 1;
      return (a.position ?? 0) - (b.position ?? 0);
    });
  },

  /** Cards dos 3 pipelines COM details (telefones/emails/instagram/canal
   *  vivem no JSONB). Base ~4.5k (backfill HB + planilha TOP1000): PostgREST
   *  pagina em 1000 por default, então busca em páginas de 1000 até esgotar. */
  socialCards: async (): Promise<KanbanCard[]> => {
    const PAGE = 1000;
    const all: KanbanCard[] = [];
    for (let from = 0; ; from += PAGE) {
      const r = await supabase
        .from("kanban_cards")
        .select("id, dept_id, column_id, title, subtitle, obra, responsavel, tags, value, details, created_at, updated_at")
        .in("dept_id", DEPTS_SOCIAL)
        .order("title", { ascending: true })
        .range(from, from + PAGE - 1);
      const page = (unwrap(r) || []) as KanbanCard[];
      all.push(...page);
      if (page.length < PAGE) break;
    }
    return all;
  },

  /** Move card do Social Selling (pode trocar de pipeline = dept). Loga em
   *  card_movements com o email de quem moveu — é dessa trilha que o chip
   *  de "dias na etapa" NÃO depende (usa updated_at), mas fica a auditoria. */
  socialMoverCard: async (cardId: string, fromSlug: string | null, toDeptId: string, toSlug: string, movedBy: string) => {
    const patch: any = { column_id: toSlug, dept_id: toDeptId, updated_at: new Date().toISOString() };
    const r = await supabase.from("kanban_cards").update(patch).eq("id", cardId);
    if (r.error) throw new Error(r.error.message);
    try {
      await supabase.from("card_movements").insert({
        card_id: cardId, from_column: fromSlug, to_column: toSlug,
        moved_by: movedBy || "social-selling", moved_at: new Date().toISOString(),
      });
    } catch {}
  },

  /** Cria contato (arquiteto) direto na Base do pipeline Aquisição.
   *  Usado pelo modal Novo Contato e pelo importador de CSV. */
  socialCriarContato: async (input: {
    nome: string; telefone?: string; instagram?: string; email?: string;
    canal?: string; observacoes?: string; origem?: string; criadoPor: string;
  }): Promise<{ id: string }> => {
    const details = {
      social_selling: true,
      origem: input.origem || "manual",
      telefones: input.telefone?.trim() ? [input.telefone.trim()] : [],
      emails: input.email?.trim() ? [input.email.trim().toLowerCase()] : [],
      instagram: (input.instagram || "").trim().replace(/^@/, ""),
      canal: input.canal || "",
      observacoes: input.observacoes || "",
      criado_por: input.criadoPor,
      cards_origem: [],
    };
    const r = await supabase.from("kanban_cards").insert({
      dept_id: DEPT_SOCIAL_AQUISICAO, column_id: "base",
      title: input.nome.trim(), subtitle: "Arquiteto",
      tags: ["arquiteto"], details,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).select("id").single();
    if (r.error) throw new Error(r.error.message);
    return { id: (r.data as any).id };
  },

  /** Atualiza os campos de contato do card social (merge no details). */
  socialAtualizarContato: async (cardId: string, detailsAtual: any, patch: {
    telefones?: string[]; emails?: string[]; instagram?: string; canal?: string; observacoes?: string;
  }) => {
    const details = { ...(detailsAtual || {}), ...patch };
    if (typeof details.instagram === "string") details.instagram = details.instagram.replace(/^@/, "");
    const r = await supabase.from("kanban_cards")
      .update({ details, updated_at: new Date().toISOString() })
      .eq("id", cardId);
    if (r.error) throw new Error(r.error.message);
  },

  /** Preço médio (R$/m²) por categoria de produto da Parket — usado pra
   *  estimar "valor na mesa" automaticamente a partir de metragem×produto. */
  precosMediosPorCategoria: async (): Promise<Map<string, number>> => {
    const { data, error } = await supabase
      .from("orcamento_tabela_precos")
      .select("categoria, preco")
      .eq("ativo", true)
      .gt("preco", 0)
      .limit(2000);
    if (error) throw error;
    const sum = new Map<string, { tot: number; n: number }>();
    (data || []).forEach((r: any) => {
      const cat = String(r.categoria || "").toLowerCase().trim();
      const p = Number(r.preco);
      if (!cat || !p || isNaN(p)) return;
      // Porta é unidade (não m²) — ignora pra cálculo de área
      if (cat === "porta") return;
      const cur = sum.get(cat) || { tot: 0, n: 0 };
      cur.tot += p; cur.n += 1;
      sum.set(cat, cur);
    });
    const out = new Map<string, number>();
    sum.forEach((v, k) => out.set(k, v.tot / v.n));
    return out;
  },

  /** Última mensagem WhatsApp de uma lista de cards (max ~2000 ids). */
  lastMessagesByCards: async (cardIds: string[]): Promise<Map<string, { text: string; at: string; direction: string; phone: string | null }>> => {
    const out = new Map<string, { text: string; at: string; direction: string; phone: string | null }>();
    if (cardIds.length === 0) return out;
    // Batch maior (250) + paralelismo → reduz ~22 chamadas seq pra 8 paralelas.
    const BATCH = 250;
    const slices: string[][] = [];
    for (let i = 0; i < cardIds.length; i += BATCH) slices.push(cardIds.slice(i, i + BATCH));
    const results = await Promise.all(slices.map(async (slice) => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("card_id, message_text, direction, phone, timestamp")
        .in("card_id", slice)
        .not("timestamp", "is", null)
        .order("timestamp", { ascending: false })
        .limit(slice.length * 6);
      if (error) throw error;
      return data || [];
    }));
    results.flat().forEach((m: any) => {
      if (!m.card_id) return;
      const cur = out.get(m.card_id);
      if (!cur || cur.at < m.timestamp) {
        out.set(m.card_id, { text: m.message_text || "", at: m.timestamp, direction: m.direction || "in", phone: m.phone });
      }
    });
    return out;
  },

  /** Card único com detalhes. */
  card: async (id: string): Promise<KanbanCard | null> => {
    const r = await supabase.from("kanban_cards").select("*").eq("id", id).single();
    return unwrap(r);
  },

  /** Movimentações de um card (timeline). */
  movements: async (cardId: string, limit = 100): Promise<CardMovement[]> => {
    const r = await supabase
      .from("card_movements")
      .select("*")
      .eq("card_id", cardId)
      .order("moved_at", { ascending: false })
      .limit(limit);
    return unwrap(r) || [];
  },

  /** Últimas N movimentações em TODO o funil (Pregão). Vem do banco já populado
   *  pra não deixar a sala ao vivo iniciar vazia. */
  recentMovements: async (limit = 12): Promise<{ card_id: string; card_title: string | null; column_id: string | null; dept_id: string | null; moved_at: string; moved_by: string | null }[]> => {
    const r = await supabase
      .from("card_movements")
      .select("card_id, to_column, to_dept, moved_at, moved_by, kanban_cards!inner(title)")
      .in("to_dept", [DEPT_ENTRADA, DEPT_COMERCIAL])
      .order("moved_at", { ascending: false })
      .limit(limit);
    const data = unwrap(r) || [];
    return data.map((m: any) => ({
      card_id: m.card_id,
      card_title: m.kanban_cards?.title || null,
      column_id: m.to_column,
      dept_id: m.to_dept,
      moved_at: m.moved_at,
      moved_by: m.moved_by,
    }));
  },

  /** Mensagens WhatsApp de um card. */
  messages: async (cardId: string, limit = 200): Promise<WhatsAppMessage[]> => {
    const r = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("card_id", cardId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return ((unwrap(r) || []) as WhatsAppMessage[]).reverse(); // ordem cronológica pra render
  },

  // ─── AGENDAMENTOS ──────────────────────────────────────────
  /** Lista agendamentos em um range de datas. */
  agendamentosNoRange: async (de: string, ate: string, vendedor?: string): Promise<Agendamento[]> => {
    let q = supabase.from("agendamentos").select("*")
      .gte("data", de).lte("data", ate)
      .order("data").order("hora_inicio");
    if (vendedor) q = q.eq("vendedor", vendedor);
    return unwrap(await q) || [];
  },
  /** Agendamentos vinculados a um card específico. */
  agendamentosByCard: async (cardId: string): Promise<Agendamento[]> => {
    const r = await supabase.from("agendamentos").select("*")
      .eq("card_id", cardId).order("data", { ascending: false }).order("hora_inicio");
    return unwrap(r) || [];
  },
  /** Cria um novo agendamento. */
  criarAgendamento: async (a: Omit<Agendamento, "id" | "created_at" | "updated_at" | "duracao_min">): Promise<Agendamento> => {
    const r = await supabase.from("agendamentos").insert(a).select().single();
    if (r.error) throw r.error;
    return r.data;
  },
  atualizarAgendamento: async (id: string, patch: Partial<Agendamento>): Promise<void> => {
    const r = await supabase.from("agendamentos").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (r.error) throw r.error;
  },
  cancelarAgendamento: async (id: string): Promise<void> => {
    const r = await supabase.from("agendamentos").update({ status: "cancelado", updated_at: new Date().toISOString() }).eq("id", id);
    if (r.error) throw r.error;
  },
  /** Disponibilidade semanal — lê e escreve. */
  disponibilidadeDoVendedor: async (vendedor: string): Promise<DisponibilidadeDia[]> => {
    const r = await supabase.from("agendamento_disponibilidade").select("*").eq("vendedor", vendedor).order("dia_semana");
    return unwrap(r) || [];
  },
  setDisponibilidade: async (vendedor: string, slots: { dia_semana: number; hora_inicio: string; hora_fim: string }[]): Promise<void> => {
    // Estratégia: delete tudo, insere tudo (poucas linhas, OK).
    const del = await supabase.from("agendamento_disponibilidade").delete().eq("vendedor", vendedor);
    if (del.error) throw del.error;
    if (slots.length === 0) return;
    const ins = await supabase.from("agendamento_disponibilidade")
      .insert(slots.map((s) => ({ ...s, vendedor })));
    if (ins.error) throw ins.error;
  },

  // ─── TAREFAS (estilo Google Tasks) ─────────────────────────
  /** Lista tarefas do user logado num range opcional de datas (YYYY-MM-DD).
   *  RLS já filtra por user_id = auth.uid(); admin vê todas. */
  tarefas: async (deDate?: string, ateDate?: string, status?: "pendente" | "feita" | "cancelada"): Promise<AgendaTarefa[]> => {
    // Embed do parceiro vinculado (PostgREST resolve pela FK parceiro_id) — fica null se a tarefa não tem parceiro.
    let q = supabase.from("agenda_tarefas")
      .select("*,parceiro:carteira_parceiros(id,nome,tipo)")
      .order("data", { ascending: true, nullsFirst: false })
      .order("hora", { ascending: true, nullsFirst: false })
      .order("prioridade", { ascending: false });
    if (deDate)  q = q.or(`data.gte.${deDate},data.is.null`);
    if (ateDate) q = q.or(`data.lte.${ateDate},data.is.null`);
    if (status)  q = q.eq("status", status);
    return unwrap(await q) || [];
  },

  criarTarefa: async (t: {
    user_id: string; user_nome?: string | null;
    titulo: string; descricao?: string | null;
    data?: string | null; hora?: string | null;
    prioridade?: "baixa" | "media" | "alta";
    card_id?: string | null;
    parceiro_id?: string | null;
  }): Promise<AgendaTarefa> => {
    const r = await supabase.from("agenda_tarefas").insert({
      user_id: t.user_id, user_nome: t.user_nome || null,
      titulo: t.titulo, descricao: t.descricao || null,
      data: t.data || null, hora: t.hora || null,
      prioridade: t.prioridade || "media",
      card_id: t.card_id || null,
      parceiro_id: t.parceiro_id || null,
    }).select().single();
    if (r.error) throw r.error;
    return r.data as AgendaTarefa;
  },

  /** Tarefas vinculadas a um parceiro da carteira. */
  tarefasDoParceiro: async (parceiroId: string): Promise<AgendaTarefa[]> => {
    const r = await supabase.from("agenda_tarefas")
      .select("*")
      .eq("parceiro_id", parceiroId)
      .order("status", { ascending: true })
      .order("data", { ascending: true, nullsFirst: false })
      .order("hora", { ascending: true, nullsFirst: false });
    if (r.error) throw r.error;
    return (r.data || []) as AgendaTarefa[];
  },

  atualizarTarefa: async (id: string, patch: Partial<AgendaTarefa>): Promise<void> => {
    const r = await supabase.from("agenda_tarefas").update(patch).eq("id", id);
    if (r.error) throw r.error;
  },

  toggleTarefa: async (id: string, feita: boolean): Promise<void> => {
    const r = await supabase.from("agenda_tarefas").update({
      status: feita ? "feita" : "pendente",
      completed_at: feita ? new Date().toISOString() : null,
    }).eq("id", id);
    if (r.error) throw r.error;
  },

  removerTarefa: async (id: string): Promise<void> => {
    const r = await supabase.from("agenda_tarefas").delete().eq("id", id);
    if (r.error) throw r.error;
  },

  /** Atualiza meta_mensal de um vendedor em user_profiles. RLS já garante:
   *  vendedor edita só a própria; admin pode editar qualquer. Retorna true se OK. */
  /** Demandas de orçamento (orcamento_demandas) atreladas a um card comercial.
   *  Retorna ordenado por created_at desc — vendedor vê última devolução primeiro. */
  demandasPorCard: async (cardId: string): Promise<SolicitacaoOrcamento[]> => {
    const r = await supabase.from("orcamento_demandas")
      .select("id, orcamentista_id, kanban_card_id, kanban_card_orc_id, titulo, tipo, tamanho, prioridade, status, prazo_horas, prazo_unidade, prazo_data, aceito_em, recusado_em, concluido_em, details, created_at, updated_at")
      .eq("kanban_card_id", cardId)
      .order("created_at", { ascending: false });
    if (r.error) throw r.error;
    return (r.data || []) as any;
  },

  /** Batch: prazo + status da demanda mais recente por card comercial.
   *  Usado no Pipeline pra mostrar badge "Prazo dd/mm" em cards com orçamento. */
  prazoDemandaPorCards: async (cardIds: string[]): Promise<Map<string, { prazo_data: string | null; status: string; aceito_em: string | null }>> => {
    const out = new Map<string, { prazo_data: string | null; status: string; aceito_em: string | null }>();
    if (cardIds.length === 0) return out;
    const r = await supabase.from("orcamento_demandas")
      .select("kanban_card_id, prazo_data, status, aceito_em, created_at")
      .in("kanban_card_id", cardIds)
      .order("created_at", { ascending: false });
    if (r.error) throw r.error;
    for (const row of (r.data || []) as any[]) {
      const cid = row.kanban_card_id;
      if (!cid || out.has(cid)) continue; // já pegou a mais recente
      out.set(cid, { prazo_data: row.prazo_data, status: row.status, aceito_em: row.aceito_em });
    }
    return out;
  },

  /** Atualiza meta_agendamentos_diarios do SDR. RLS já cuida (self ou admin). */
  atualizarMetaAgendamentos: async (userId: string, meta: number): Promise<boolean> => {
    const r = await supabase.from("user_profiles")
      .update({ meta_agendamentos_diarios: meta, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (r.error) { console.error("[api] atualizarMetaAgendamentos:", r.error); return false; }
    return true;
  },

  /** Cards comerciais cujo SDR original é o user logado (details.sdr === sdrNome).
   *  Filtro exato pelo PostgREST — só retorna oportunidades vinculadas a ESSE SDR.
   *  Inclui dept comercial-entrada (em qualificação) e comercial (já com vendedor). */
  oportunidadesDoSdr: async (sdrNome: string): Promise<KanbanCard[]> => {
    if (!sdrNome) return [];
    const r = await supabase.from("kanban_cards")
      .select("id, dept_id, column_id, title, subtitle, obra, responsavel, sla, sla_status, tags, progress, value, details, created_at, updated_at")
      .in("dept_id", [DEPT_ENTRADA, DEPT_COMERCIAL])
      .eq("details->>sdr", sdrNome)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(2000);  // SDR pode ter centenas de leads atendidos — limit alto pra não cortar
    if (r.error) throw r.error;
    return (r.data || []) as any;
  },

  atualizarMetaMensal: async (userId: string, meta: number): Promise<boolean> => {
    const r = await supabase.from("user_profiles")
      .update({ meta_mensal: meta, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (r.error) { console.error("[api] atualizarMetaMensal falhou:", r.error); return false; }
    return true;
  },

  /** Lista solicitações de orçamento baseadas em orcamento_demandas.status:
   *    aguarda_aceite → SOLICITADOS
   *    aceito          → FAZENDO (a menos que já tenha concluido_em → FEITO)
   *    concluido       → FEITO
   *  Faz join com kanban_cards (pelo kanban_card_orc_id) pra trazer column_id
   *  e details (cliente/cidade/produto). Filtro opcional por vendedor. */
  solicitacoesOrcamento: async (opts?: { vendedorNome?: string; limit?: number }): Promise<SolicitacaoOrcamento[]> => {
    let q = supabase
      .from("orcamento_demandas")
      .select("id, orcamentista_id, kanban_card_id, kanban_card_orc_id, titulo, tipo, tamanho, prioridade, status, prazo_horas, prazo_unidade, prazo_data, aceito_em, recusado_em, concluido_em, details, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(opts?.limit || 600);
    if (opts?.vendedorNome) {
      q = q.eq("details->>vendedor_nome", opts.vendedorNome);
    }
    const dem = unwrap(await q) || [];

    // Busca cards do funil orçamento referenciados (pra ver coluna atual)
    const cardIds = dem.map((d: any) => d.kanban_card_orc_id).filter(Boolean);
    let cardsById: Record<string, any> = {};
    if (cardIds.length > 0) {
      const cardsR = await supabase.from("kanban_cards")
        .select("id, column_id, details, title, tags")
        .in("id", cardIds);
      (cardsR.data || []).forEach((c: any) => { cardsById[c.id] = c; });
    }

    return dem.map((d: any) => {
      const card = d.kanban_card_orc_id ? cardsById[d.kanban_card_orc_id] : null;
      const cardCol = card?.column_id || "";
      // Determina bucket lógico: feito ganha prioridade
      const proposalReady = cardCol && /proposta-pronta|handoff-com|proposta-aceita/.test(cardCol);
      const bucket: "solicitados" | "fazendo" | "feito" | "recusado" =
          d.status === "recusado" ? "recusado"
        : (d.status === "concluido" || d.concluido_em || proposalReady) ? "feito"
        : d.status === "aceito" ? "fazendo"
        : "solicitados";
      return { ...d, card, bucket } as SolicitacaoOrcamento;
    });
  },

  // ─── CARTEIRA DO VENDEDOR (parceiros, coordenadores, atividades) ───
  /** Lista parceiros do vendedor (ou todos se admin). */
  carteiraParceiros: async (vendedorId?: string): Promise<CarteiraParceiro[]> => {
    let q = supabase.from("carteira_parceiros")
      .select("*")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (vendedorId) q = q.eq("vendedor_id", vendedorId);
    return unwrap(await q) || [];
  },

  criarParceiro: async (p: Omit<CarteiraParceiro, "id" | "ativo" | "created_at" | "updated_at">): Promise<CarteiraParceiro> => {
    const r = await supabase.from("carteira_parceiros").insert({
      vendedor_id: p.vendedor_id,
      tipo: p.tipo,
      nome: p.nome,
      empresa: p.empresa || null,
      email: p.email || null,
      telefone: p.telefone || null,
      instagram: p.instagram || null,
      aniversario: p.aniversario || null,
      categorias: p.categorias || [],
      observacoes: p.observacoes || null,
    }).select().single();
    if (r.error) throw r.error;
    return r.data as CarteiraParceiro;
  },

  atualizarParceiro: async (id: string, patch: Partial<CarteiraParceiro>): Promise<void> => {
    const r = await supabase.from("carteira_parceiros").update(patch).eq("id", id);
    if (r.error) throw r.error;
  },

  removerParceiro: async (id: string): Promise<void> => {
    // soft delete: ativo=false
    const r = await supabase.from("carteira_parceiros").update({ ativo: false }).eq("id", id);
    if (r.error) throw r.error;
  },

  coordenadoresDoParceiro: async (parceiroId: string): Promise<CarteiraCoordenador[]> => {
    const r = await supabase.from("carteira_coordenadores")
      .select("*").eq("parceiro_id", parceiroId).order("nome");
    return unwrap(r) || [];
  },

  criarCoordenador: async (c: Omit<CarteiraCoordenador, "id" | "created_at">): Promise<CarteiraCoordenador> => {
    const r = await supabase.from("carteira_coordenadores").insert(c).select().single();
    if (r.error) throw r.error;
    return r.data as CarteiraCoordenador;
  },

  removerCoordenador: async (id: string): Promise<void> => {
    const r = await supabase.from("carteira_coordenadores").delete().eq("id", id);
    if (r.error) throw r.error;
  },

  atividadesDoParceiro: async (parceiroId: string, limit = 50): Promise<CarteiraAtividade[]> => {
    const r = await supabase.from("carteira_atividades")
      .select("*").eq("parceiro_id", parceiroId)
      .order("data", { ascending: false }).limit(limit);
    return unwrap(r) || [];
  },

  /** Histórico de orçamentos gerados pra um parceiro (arq/eng/gerenciadora).
   *  Match por NOME (campo `arquiteto` em simulacao_projetos) — ILIKE inclui
   *  nome + empresa pra cobrir variações ("João Silva", "JOAO SILVA ARQ", etc).
   *  Status do orçamento vem da coluna do card comercial vinculado (card_comercial_id):
   *    ganho  → APROVADO   · perda → REJEITADO   · resto → EM ANDAMENTO */
  historicoOrcamentosParceiro: async (parceiro: { nome: string; empresa?: string | null }): Promise<HistoricoOrcamentoRow[]> => {
    const tokens = [parceiro.nome, parceiro.empresa].filter(Boolean).map(String);
    if (tokens.length === 0) return [];
    // monta filtro OR pra ILIKE em arquiteto
    const orExpr = tokens.map((t) => `arquiteto.ilike.%${t.replace(/[%,]/g, "")}%`).join(",");
    const sims = await supabase.from("simulacao_projetos")
      .select("id,numero,cliente,vendedor,arquiteto,status,card_comercial_id,created_at,forma_pagamento,desconto_perc,desconto_modo,desconto_valor,frete_valor")
      .or(orExpr)
      .order("created_at", { ascending: false })
      .limit(200);
    if (sims.error) throw sims.error;
    const rows = (sims.data || []) as any[];
    if (rows.length === 0) return [];

    // valores agregados de itens
    const ids = rows.map((r) => r.id);
    const items = await supabase.from("simulacao_itens")
      .select("simulacao_id,valor")
      .in("simulacao_id", ids);
    const valorPorSim = new Map<string, number>();
    for (const it of (items.data || []) as any[]) {
      valorPorSim.set(it.simulacao_id, (valorPorSim.get(it.simulacao_id) || 0) + Number(it.valor || 0));
    }

    // status dos comerciais vinculados
    const cardIds = Array.from(new Set(rows.map((r) => r.card_comercial_id).filter(Boolean)));
    const cardStatus = new Map<string, string>();
    if (cardIds.length > 0) {
      const cards = await supabase.from("kanban_cards")
        .select("id,column_id")
        .in("id", cardIds);
      for (const c of (cards.data || []) as any[]) cardStatus.set(c.id, c.column_id);
    }

    return rows.map((r): HistoricoOrcamentoRow => {
      const col = r.card_comercial_id ? cardStatus.get(r.card_comercial_id) || null : null;
      const valorBruto = valorPorSim.get(r.id) || 0;
      const descPerc = Number(r.desconto_perc || 0);
      const descVal  = r.desconto_modo === "valor" ? Number(r.desconto_valor || 0) : 0;
      const frete    = Number(r.frete_valor || 0);
      const valorTotal = valorBruto * (1 - descPerc/100) - descVal + frete;
      let situacao: HistoricoOrcamentoRow["situacao"] = "andamento";
      if (col === "ganho") situacao = "aprovado";
      else if (col === "perda") situacao = "rejeitado";
      return {
        simulacao_id: r.id,
        numero: r.numero,
        cliente: r.cliente,
        vendedor: r.vendedor,
        arquiteto: r.arquiteto,
        forma_pagamento: r.forma_pagamento || null,
        status_proposta: r.status,
        coluna_comercial: col,
        situacao,
        valor_total: valorTotal,
        criado_at: r.created_at,
        card_comercial_id: r.card_comercial_id || null,
      };
    });
  },

  criarAtividade: async (a: Omit<CarteiraAtividade, "id" | "created_at">): Promise<CarteiraAtividade> => {
    const r = await supabase.from("carteira_atividades").insert(a).select().single();
    if (r.error) throw r.error;
    return r.data as CarteiraAtividade;
  },

  toggleAtividadeFeita: async (id: string, feita: boolean): Promise<void> => {
    const r = await supabase.from("carteira_atividades").update({
      feito_em: feita ? new Date().toISOString() : null,
    }).eq("id", id);
    if (r.error) throw r.error;
  },

  removerAtividade: async (id: string): Promise<void> => {
    const r = await supabase.from("carteira_atividades").delete().eq("id", id);
    if (r.error) throw r.error;
  },

  /** Lista distinct de condomínios já cadastrados em kanban_cards.details.condominio.
   *  Usado pelo autocomplete do campo Condomínio (Adicionar Lead, Solicitar Orçamento,
   *  CardDetail). Faz cache simples em memória pra não consultar 2x na mesma sessão. */
  /** Limpa o cache local da lista de condomínios. Após salvar um novo,
   *  o próximo `condominiosList()` re-puxa do banco. */
  condominiosListReset: () => { condominiosCache = null; },

  /** Adiciona um valor novo direto na lista cacheada (sem rebuscar do banco).
   *  Útil quando o user acabou de salvar um condomínio inédito — aparece na
   *  próxima abertura sem esperar a próxima sessão. */
  condominiosListAdd: (novo: string) => {
    const v = (novo || "").trim();
    if (!v || v.length < 2) return;
    if (!condominiosCache) return;  // cache vazio será re-puxado na próxima
    if (condominiosCache.some((c) => c.toLowerCase() === v.toLowerCase())) return;
    condominiosCache = [...condominiosCache, v].sort((a, b) => a.localeCompare(b, "pt-BR"));
  },

  condominiosList: async (): Promise<string[]> => {
    if (condominiosCache) return condominiosCache;
    // 2000 cards já cobre a grande maioria dos comerciais ativos
    const r = await supabase
      .from("kanban_cards")
      .select("details")
      .in("dept_id", [DEPT_ENTRADA, DEPT_COMERCIAL])
      .not("details->condominio", "is", null)
      .limit(2000);
    if (r.error) return [];
    const set = new Set<string>();
    (r.data || []).forEach((c: any) => {
      const v = c.details?.condominio || c.details?.edificio || c.details?.residencial;
      if (v && typeof v === "string" && v.trim().length > 1) set.add(v.trim());
    });
    condominiosCache = [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
    // expira o cache depois de 5 min
    setTimeout(() => { condominiosCache = null; }, 5 * 60 * 1000);
    return condominiosCache;
  },

  // ─── SOLICITAR ORÇAMENTO ───────────────────────────────────
  /** Lista orçamentistas ativos (tabela orcamento_equipe). Usado pro dropdown
   *  no modal de Solicitar Orçamento e no admin de usuários (vincular padrão). */
  equipeOrcamento: async (): Promise<OrcamentistaEquipe[]> => {
    const r = await supabase.from("orcamento_equipe")
      .select("id, nome, email, especialidade, ativo, is_gestor, avatar_color, ordem")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });
    return unwrap(r) || [];
  },

  /** Cria uma demanda de orçamento + card no funil orcamento/solicitacao,
   *  replicando o fluxo do Space (criado_via=orcamento-picker, com parent_card_id
   *  e demanda_id linkados). */
  solicitarOrcamento: async (input: SolicitarOrcamentoInput): Promise<{ demanda_id: string; card_orc_id: string; valoria_card_id: string | null }> => {
    let valoria_card_id: string | null = null;
    const produtosStr = (input.produtos && input.produtos.length > 0)
      ? input.produtos.join(", ") : null;

    // Pacote completo de dados pra orçamentista — mesmos campos do "Adicionar Lead".
    // Vai pra ambas as tabelas (orcamento_demandas.details + kanban_cards.details)
    // pra que apareça tanto na demanda quanto no card visualmente.
    const dadosCompletos: Record<string, any> = {
      vendedor_nome: input.vendedor_nome,
      arquiteto: input.arquiteto || null,       // campo dedicado no Valor (cards_solicitacao.arquiteto)
      // Contato principal
      contato_celular: input.contato_celular || null,
      contato_email: input.contato_email || null,
      // Endereço/local
      cidade: input.cidade || null,
      condominio: input.condominio || null,
      endereco: input.endereco || null,
      endereco_obra: input.endereco || null,    // alias compat com Space
      // Produto/medidas
      produtos: produtosStr,                     // string CSV pra leitura rápida
      produtos_lista: input.produtos || null,    // array pra UIs que listam
      produto_interesse: produtosStr,            // alias compat
      metragem: input.metragem || null,
      metragem_estimada: input.metragem || null, // alias compat
      area_m2: input.metragem || null,
      // Novo formato (Will 15/07): metragem por produto do form.
      // Ex: { Piso: 120, Painel: 45, Forro: 30 }. Orçamentista vê no card.
      metragens_por_produto: (input.metragens_por_produto && Object.keys(input.metragens_por_produto).length > 0)
        ? input.metragens_por_produto : null,
      previsao_instalacao: input.previsao_instalacao || null,
      // Contatos adicionais + anexos do card original
      contatos_adicionais: (input.contatos_adicionais && input.contatos_adicionais.length > 0)
        ? input.contatos_adicionais : null,
      anexos_origem: (input.anexos && input.anexos.length > 0) ? input.anexos : null,
      // Observações + prioridade
      observacoes: input.observacoes || null,
    };

    // 1) INSERT em orcamento_demandas — ou REATIVA a existente.
    //    O índice único uq_od_card_orcamentista (kanban_card_id, orcamentista_id)
    //    vale independente do status: re-solicitar pro mesmo orçamentista+card
    //    dava "duplicate key". Aqui a demanda antiga é reaproveitada.
    const demandaFields = {
      titulo: input.titulo,
      tipo: produtosStr,                         // tipo recebe o(s) produto(s)
      tamanho: input.metragem ? `${input.metragem} m²` : null,
      prioridade: input.prioridade || "normal",
      status: "aguarda_aceite",
      prazo_horas: input.prazo_horas || null,
      prazo_unidade: input.prazo_unidade || "horas",
      prazo_data: input.prazo_data || null,
      details: dadosCompletos,
    };
    const existente = await supabase.from("orcamento_demandas")
      .select("id, kanban_card_orc_id")
      .eq("kanban_card_id", input.parent_card_id)
      .eq("orcamentista_id", input.orcamentista_id)
      .maybeSingle();
    let demanda_id: string;
    let card_orc_existente: string | null = null;
    if (existente.data?.id) {
      demanda_id = existente.data.id;
      card_orc_existente = (existente.data as any).kanban_card_orc_id || null;
      const upd = await supabase.from("orcamento_demandas").update({
        ...demandaFields,
        aceito_em: null, recusado_em: null, motivo_recusa: null, concluido_em: null,
        updated_at: new Date().toISOString(),
      }).eq("id", demanda_id);
      if (upd.error) throw upd.error;
    } else {
      const dem = await supabase.from("orcamento_demandas").insert({
        orcamentista_id: input.orcamentista_id,
        kanban_card_id: input.parent_card_id,
        ...demandaFields,
      }).select("id").single();
      if (dem.error) throw dem.error;
      demanda_id = (dem.data as any).id;
    }

    // 2) INSERT em kanban_cards (dept orcamento, coluna solicitacao)
    const det: Record<string, any> = {
      ...dadosCompletos,
      vendedor: input.vendedor_nome,
      criado_por: input.criado_por,
      criado_via: "orcamento-picker",   // satisfaz RLS kanban_insert_orcamento_picker
      demanda_id,
      data_criada: new Date().toISOString(),
      parent_dept: "comercial",
      parent_card_id: input.parent_card_id,
      status_lead: "Novo",
      orcamentista: input.orcamentista_nome,
      orcamentista_id: input.orcamentista_id,
      orcamentista_nome: input.orcamentista_nome,
      prioridade: input.prioridade,
      // celular separado também (Space lê assim)
      celular: input.contato_celular || null,
      email: input.contato_email || null,
    };
    let card_orc_id: string;
    if (card_orc_existente) {
      // Demanda reativada com card já criado antes: atualiza em vez de duplicar.
      // Merge de details preserva chaves que outros sistemas gravaram no card.
      card_orc_id = card_orc_existente;
      const atual = await supabase.from("kanban_cards")
        .select("details").eq("id", card_orc_id).maybeSingle();
      const mergedDet = { ...((atual.data as any)?.details || {}), ...det };
      const updCard = await supabase.from("kanban_cards").update({
        title: input.titulo,
        subtitle: input.cidade || input.endereco || null,
        obra: input.condominio || input.endereco || input.cidade || null,
        responsavel: input.orcamentista_nome,
        details: mergedDet,
        updated_at: new Date().toISOString(),
      }).eq("id", card_orc_id);
      if (updCard.error) throw updCard.error;
    } else {
      const card = await supabase.from("kanban_cards").insert({
        dept_id: "orcamento",
        column_id: "solicitacao",
        title: input.titulo,
        subtitle: input.cidade || input.endereco || null,
        obra: input.condominio || input.endereco || input.cidade || null,
        // IMPORTANTE: responsavel = ORÇAMENTISTA (não vendedor). É assim que o
        // Space filtra o kanban de cada orçamentista. Vendedor fica em details.vendedor_nome.
        responsavel: input.orcamentista_nome,
        tags: ["orcamento-picker"],
        value: null,
        details: det,
      }).select("id").single();
      if (card.error) throw card.error;
      card_orc_id = (card.data as any).id;

      // 3) Linka kanban_card_orc_id na demanda (best-effort, não-fatal se falhar)
      await supabase.from("orcamento_demandas")
        .update({ kanban_card_orc_id: card_orc_id })
        .eq("id", demanda_id);
    }

    // 4) INSERT em simulacao_projetos pra Valoria (valor.parket.works) enxergar.
    //    O Valoria filtra por card_id. Trigger fill_sim_card_comercial auto-preenche
    //    card_comercial_id a partir de details.parent_card_id. Numero é sequencial.
    //    Best-effort — se falhar, não bloqueia o fluxo principal (card+demanda já criados).
    try {
      // Re-solicitação: se o card reaproveitado já tem simulação, não cria outra.
      const simExist = await supabase.from("simulacao_projetos")
        .select("id").eq("card_id", card_orc_id).limit(1);
      if (!simExist.data || simExist.data.length === 0) {
        const maxR = await supabase
          .from("simulacao_projetos")
          .select("numero")
          .order("created_at", { ascending: false })
          .limit(50);
        let next = 2300;
        if (maxR.data) {
          for (const row of maxR.data as any[]) {
            const n = parseInt(String(row.numero || "").replace(/\D/g, ""), 10);
            if (!isNaN(n) && n >= next) next = n + 1;
          }
        }
        await supabase.from("simulacao_projetos").insert({
          numero: String(next),
          cliente: input.titulo,
          arquiteto: input.arquiteto || "",
          endereco: input.endereco || input.cidade || "",
          vendedor: input.vendedor_nome,
          orcamentista: input.orcamentista_nome,
          // obra_code = nome da obra, preenchido MANUALMENTE no Valor pelo
          // orçamentista. HB não pré-popula (ficava com endereço/UUID e a capa
          // da proposta duplicava com o campo Endereço).
          card_id: card_orc_id,                         // card no funil orcamento (trigger linka comercial via parent)
          status: "rascunho",
          validade_dias: 15,
          desconto_perc: 0,
          forma_pagamento: "",
          meta: {
            criado_via: "homebroker-solicitar-orcamento",
            demanda_id,
            parent_card_id: input.parent_card_id,
            produtos: input.produtos || [],
            metragem: input.metragem || null,
            observacoes: input.observacoes || null,
          },
        });
      }
    } catch (e) {
      console.warn("[solicitarOrcamento] simulacao_projetos insert falhou:", e);
      // Não joga erro — o card+demanda já foram criados, Valoria pode ser linkada depois
    }

    // 5) INSERT em ops.cards_solicitacao no banco próprio da Valoria
    //    (valor.parket.works) — é o que aparece no Kanban Pessoal do orçamentista
    //    (filtra por orcamentista_id). Campos baseados no Solicitar.tsx da Valoria.
    //
    //    IMPORTANTE: o orcamentista_id do Parket (orcamento_equipe.id) ≠ id da
    //    Valoria (team.orcamentistas.id). Mapeia via EMAIL (que é estável).
    //    Best-effort: se a Valoria estiver offline ou der erro, o resto já tá criado.
    try {
      // Busca o email do orcamentista no Parket
      const orcInfo = await supabase.from("orcamento_equipe")
        .select("email,nome")
        .eq("id", input.orcamentista_id)
        .maybeSingle();
      const orcEmail = (orcInfo.data?.email || "").toLowerCase();
      if (!orcEmail) throw new Error("Orçamentista sem e-mail — não dá pra mapear pra Valoria");

      // Busca o id correspondente na Valoria (cache em memória)
      const valoriaId = await getValoriaOrcamentistaId(orcEmail);
      if (!valoriaId) throw new Error(`Orçamentista ${orcEmail} não cadastrado na Valoria (team.orcamentistas)`);
      const notasCompletas = [
        input.observacoes || "",
        input.produtos && input.produtos.length > 0 ? `Produtos: ${input.produtos.join(", ")}` : "",
        input.metragem ? `Metragem: ${input.metragem} m²` : "",
        input.cidade ? `Cidade: ${input.cidade}` : "",
        input.condominio ? `Condomínio: ${input.condominio}` : "",
        input.previsao_instalacao ? `Previsão: ${input.previsao_instalacao}` : "",
        input.prioridade ? `Prioridade: ${input.prioridade}` : "",
      ].filter(Boolean).join("\n");
      // id = card_orc_id (mesmo id do kanban_cards do Parket). O cron
      // sync_space_valoria.py espelha o funil orçamento com id idêntico
      // (ON CONFLICT id) — id aleatório aqui gerava CARD DUPLICADO no
      // kanban do orçamentista quando o sync rodava. Upsert também torna
      // a re-solicitação idempotente.
      const valoriaCardId = card_orc_id;
      // Re-solicitação NÃO pode rebaixar a coluna: o upsert com column_id
      // "solicitacao" puxava card já em proposta-pronta/handoff-com de volta,
      // e o trigger da Valoria empurrava o retrocesso pro Space (card "andando
      // sozinho" — 05/08/2026). Se o card já existe, omite column_id (o upsert
      // do PostgREST só atualiza colunas presentes no payload).
      const vExist = await supabaseValoria.from("cards_solicitacao")
        .select("id").eq("id", valoriaCardId).maybeSingle();
      const vRow: Record<string, any> = {
        id: valoriaCardId,  // schema exige id NOT NULL sem default
        cliente: input.titulo,
        arquiteto: input.arquiteto || "",
        cnpj_cpf: "",
        endereco: input.endereco || input.cidade || "",
        // obra_code = nome da obra, preenchido no Valor (não pré-popular do HB).
        vendedor: input.vendedor_nome,
        contato_email: input.contato_email || "",
        contato_telefone: input.contato_celular || "",
        notas: notasCompletas,
        origem: "homebroker",
        column_id: "solicitacao",
        orcamentista_id: valoriaId,
        // Mesmo pacote gravado em orcamento_demandas.details — inclui
        // anexos_origem (arquivos + links do solicitante) que a Valoria
        // exibe no modal de aceite e no AnexosBox.
        details: dadosCompletos,
      };
      if (vExist.data) delete vRow.column_id;
      await supabaseValoria.from("cards_solicitacao").upsert(vRow);
      valoria_card_id = valoriaCardId;

      // 6) UPSERT em ops.demandas (Valoria) — é o que a coluna "Aguarda Aceite"
      //    do KanbanPessoal lê via Realtime. Sem isso, o orçamentista só vê
      //    quando o cron sync_space_valoria.py rodar (até 1min de delay).
      //    id = demanda_id do Parket (mesma chave que o sync usa) → re-solicitar
      //    reativa a mesma demanda em vez de duplicar.
      await supabaseValoria.from("demandas").upsert({
        id: demanda_id,
        card_id: valoriaCardId,
        orcamentista_id: valoriaId,
        titulo: input.titulo,
        cliente: input.titulo,
        tipo: produtosStr,
        tamanho: input.metragem ? `${input.metragem} m²` : null,
        status: "aguarda_aceite",
        prioridade: input.prioridade || "normal",
        prazo: input.prazo_data || null,
        aceito_em: null, recusado_em: null, motivo_recusa: null, concluido_em: null,
        details: dadosCompletos,
      });
    } catch (e) {
      console.warn("[solicitarOrcamento] valoria cards_solicitacao/demandas falhou:", e);
    }

    return { demanda_id, card_orc_id, valoria_card_id };
  },

  /** Manda um card do funil Comercial de volta pro funil de Entrada (SDR)
   *  pra ser requalificado. Usado pelo botão "Requalificação" na Pipeline. */
  requalificarLead: async (cardId: string): Promise<void> => {
    const r = await supabase.from("kanban_cards").update({
      dept_id: DEPT_ENTRADA,
      column_id: "em-qualificacao",
      updated_at: new Date().toISOString(),
    }).eq("id", cardId);
    if (r.error) throw r.error;
  },

  // ─── NOVO LEAD ─────────────────────────────────────────────
  /** Cria um novo lead (mesma tabela que o Space lê — fica visível em ambas
   *  as plataformas em tempo real).
   *  Destino depende do quadro em que foi criado: SDR → funil
   *  comercial-entrada/leads-entrada (qualificação); Vendas
   *  (paraVendedor=true) → Pipeline comercial/contato-inicial (o vendedor já
   *  cadastrou o lead porque falou com o cliente, então pula "Novas
   *  Oportunidades"). Atrelado via `responsavel` — campo que o filtro do
   *  Pipeline e o Space usam pra atribuir card a vendedor.
   *  Campos no padrão JSONB que o restante do ecossistema já usa. */
  criarLead: async (input: NovoLeadInput): Promise<{ id: string; merged?: boolean }> => {
    const paraVendedor = !!input.paraVendedor;
    const deptDestino = paraVendedor ? DEPT_COMERCIAL : DEPT_ENTRADA;
    const colDestino = paraVendedor ? "novas-oportunidades" : "leads-entrada";
    const det: Record<string, any> = {
      nome: input.nome,
      celular: input.celular,
      email: input.email || null,
      cidade: input.cidade || null,
      endereco: input.endereco || null,
      endereco_obra: input.endereco || null,
      condominio: input.condominio || null,
      produto_interesse: input.produto || null,
      metragem_estimada: input.metragem || null,
      area_m2: input.metragem || null,
      previsao_instalacao: input.previsaoInstalacao || null,
      observacoes: input.observacoes || null,
      arquitetura: input.contatosAdicionais.find((c) => c.papel === "arquiteto")?.nome || null,
      contatos_adicionais: input.contatosAdicionais.length > 0 ? input.contatosAdicionais : null,
      attachments: input.attachments.length > 0 ? input.attachments : null,
      attachments_count: input.attachments.length || null,
      links: input.links.length > 0 ? input.links : null,
      // Pasta do cliente no Drive já resolvida no form (anexo subiu antes do
      // card existir) — evita novo ensure-folder no CardDetail/watcher.
      drive_folder_id: input.driveFolderId || null,
      drive_folder_url: input.driveFolderUrl || null,
      origem: "homebroker",
      origem_lead: "manual",
      criado_por: input.criadoPor || null,
      // padrão Space: details.sdr = quem captou; details.vendedor = dono no Pipeline
      sdr: paraVendedor ? null : (input.criadoPor || null),
      vendedor: paraVendedor ? (input.criadoPor || null) : null,
      data_criada: new Date().toISOString().slice(0, 10),
      status_lead: "Novo",
    };
    // Title: nome principal + arquiteto entre parênteses (padrão visual do Space).
    const arq = input.contatosAdicionais.find((c) => c.papel === "arquiteto")?.nome;
    const title = arq ? `${input.nome} — Arq ${arq}` : input.nome;

    // NOTA: a tabela tem trigger BEFORE INSERT `prevent_dup_lead_comercial` que,
    // se já existe um lead ativo (não-ganho/perda) com o mesmo celular, faz
    // UPDATE no card existente e retorna NULL — silenciosamente bloqueando o
    // INSERT. Nesse cenário, o .select("id") devolve [] (0 linhas). Por isso
    // NÃO usamos .single() — checamos manualmente e, se zero, buscamos o card
    // existente pelo celular pra devolver o ID correto e sinalizar `merged`.
    const r = await supabase.from("kanban_cards").insert({
      dept_id: deptDestino,
      column_id: colDestino,
      title,
      subtitle: input.celular,
      obra: input.condominio || input.endereco || null,
      responsavel: input.criadoPor || null,
      tags: ["novo-lead", "homebroker"],
      value: null,
      details: det,
    }).select("id");
    if (r.error) throw r.error;
    const rows = (r.data || []) as Array<{ id: string }>;
    if (rows.length > 0) return { id: rows[0].id, merged: false };

    // INSERT bloqueado pelo trigger de dedup — o card existente já recebeu
    // merge dos campos novos. Busca-o pelo celular pra devolver o ID.
    const cel = (input.celular || "").replace(/[^0-9]/g, "").slice(-11);
    if (cel.length === 11) {
      const f = await supabase
        .from("kanban_cards")
        .select("id")
        .eq("dept_id", deptDestino)
        .filter("details->>celular", "like", `%${cel.slice(-9)}%`)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (!f.error && f.data && f.data.length > 0) {
        return { id: (f.data[0] as any).id, merged: true };
      }
    }
    // Sem celular ou não achou — sinaliza erro real
    throw new Error("Lead não pôde ser criado (sem retorno do banco). Verifique celular/duplicidade.");
  },

  /** Apaga o card. FKs cascadeiam (kanban_card_history/messages/attachments etc.).
   *  Referências não-cascade (simulacao_projetos, fiscal_agenda...) viram NULL.
   *  Gate de permissão é feito na UI via canDeleteCard(); a policy `kanban_delete`
   *  do banco também reforça (admin/superadmin/dept_leader/created_by). */
  deleteCard: async (id: string): Promise<void> => {
    const r = await supabase.from("kanban_cards").delete().eq("id", id);
    if (r.error) throw r.error;
  },

  // uploadAnexoLead (bucket card-attachments/_novos-leads) foi APOSENTADO
  // (PKT-HB-DRIVE-20260902B): anexo de lead agora sobe direto pro Drive do
  // cliente via ensureDriveFolder + uploadDriveFileScript (anexo-upload.ts),
  // sem limite de tamanho. Ver NovoLeadModal.onUpload.
};

// ─── Tipos do Novo Lead ────────────────────────────────────────────
export type ContatoPapel = "arquiteto" | "engenheiro" | "gerenciador" | "comprador" | "outro";

export type ContatoAdicional = {
  papel: ContatoPapel;
  papel_label?: string;        // quando papel="outro", custom label
  nome: string;
  telefones: string[];         // múltiplos permitidos
  emails: string[];            // múltiplos permitidos
};

export type AnexoLead = {
  url: string;
  name: string;
  bytes: number;
  mimeType: string;
};

export type NovoLeadInput = {
  nome: string;
  celular: string;
  email?: string;
  contatosAdicionais: ContatoAdicional[];
  cidade?: string;
  endereco?: string;
  condominio?: string;
  produto?: string;
  metragem?: number;
  previsaoInstalacao?: string; // YYYY-MM-DD
  observacoes?: string;
  attachments: AnexoLead[];
  links: string[];
  criadoPor?: string;
  /** true = criador é vendedor → lead cai direto no Pipeline (dept comercial)
   *  atrelado a ele; false/ausente = funil de Entrada (SDR). */
  paraVendedor?: boolean;
  /** Pasta do cliente no Drive (Home Broker/<CLIENTE>) criada durante o upload
   *  de anexos no form — persiste no card já no nascimento pra reuso. */
  driveFolderId?: string;
  driveFolderUrl?: string;
};

export type Agendamento = {
  id: string;
  card_id: string | null;
  vendedor: string;
  cliente_nome: string | null;
  data: string;          // YYYY-MM-DD
  hora_inicio: string;   // HH:MM:SS
  hora_fim: string;      // HH:MM:SS
  duracao_min: number;
  modalidade: "presencial" | "meet";
  meet_link: string | null;
  endereco: string | null;
  status: "agendado" | "realizado" | "cancelado" | "no-show" | "reagendado";
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type HistoricoOrcamentoRow = {
  simulacao_id: string;
  numero: string;
  cliente: string;
  vendedor: string | null;
  arquiteto: string | null;
  forma_pagamento: string | null;
  status_proposta: string;
  coluna_comercial: string | null;
  situacao: "aprovado" | "rejeitado" | "andamento";
  valor_total: number;
  criado_at: string | null;
  card_comercial_id: string | null;
};

export type CarteiraParceiroTipo = "arquiteto" | "engenheiro" | "gerenciadora" | "outro";

export type CarteiraParceiro = {
  id: string;
  vendedor_id: string;
  tipo: CarteiraParceiroTipo;
  nome: string;
  empresa: string | null;
  email: string | null;
  telefone: string | null;
  instagram: string | null;
  aniversario: string | null;   // YYYY-MM-DD
  cidade: string | null;
  estado: string | null;         // UF — 2 letras
  categorias: string[];          // contato/instagram/amostra/coordenador/relacionamento/...
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type CarteiraCoordenador = {
  id: string;
  parceiro_id: string;
  nome: string;
  papel: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  aniversario: string | null;
  observacoes: string | null;
  created_at: string;
};

export type CarteiraAtividade = {
  id: string;
  parceiro_id: string;
  vendedor_id: string;
  tipo: string;                  // contato_telefone/visita/amostra/instagram/almoco/reuniao/aniversario/outro
  data: string;                  // YYYY-MM-DD
  descricao: string | null;
  feito_em: string | null;
  created_at: string;
};

export type SolicitacaoOrcamento = {
  id: string;
  orcamentista_id: string;
  kanban_card_id: string | null;        // card no funil comercial original
  kanban_card_orc_id: string | null;    // card no funil orcamento
  titulo: string;
  tipo: string | null;
  tamanho: string | null;
  prioridade: string | null;
  status: "aguarda_aceite" | "aceito" | "recusado" | "concluido" | string;
  prazo_horas: number | null;
  prazo_unidade: string | null;
  prazo_data: string | null;
  aceito_em: string | null;
  recusado_em: string | null;
  concluido_em: string | null;
  details: any;
  created_at: string;
  updated_at: string;
  card?: { id: string; column_id: string; details: any; title: string; tags: string[] } | null;
  bucket: "solicitados" | "fazendo" | "feito" | "recusado";
};

export type OrcamentistaEquipe = {
  id: string;
  nome: string;
  email: string | null;
  especialidade: string | null;
  ativo: boolean;
  is_gestor: boolean;
  avatar_color: string | null;
  ordem: number | null;
};

export type SolicitarOrcamentoInput = {
  parent_card_id: string;
  titulo: string;                 // nome do cliente LIMPO (sem "— Arq X")
  arquiteto?: string;             // nome do arquiteto, campo próprio no Valor
  orcamentista_id: string;        // orcamento_equipe.id
  orcamentista_nome: string;
  vendedor_nome: string;
  criado_por?: string;
  // Contato principal
  contato_email?: string;
  contato_celular?: string;
  // Endereço da obra
  cidade?: string;
  condominio?: string;
  endereco?: string;
  // Produto + medidas
  produtos?: string[];            // multi-select: Piso, Forro, Painel...
  metragem?: number;              // soma total (compat com fluxo legado)
  metragens_por_produto?: Record<string, number>;  // Piso → 120, Painel → 45, ...
  previsao_instalacao?: string;   // YYYY-MM-DD
  // Contatos adicionais (arquiteto/eng/...) — passa do card pra demanda
  contatos_adicionais?: Array<{
    papel: string; papel_label?: string;
    nome: string; telefones: string[]; emails: string[];
  }>;
  // Anexos já no card — passa as URLs pra demanda
  anexos?: Array<{ url: string; name: string; bytes?: number; mimeType?: string }>;
  // Workflow
  prioridade?: "baixa" | "normal" | "alta";
  prazo_horas?: number;
  prazo_unidade?: "horas" | "dias";
  prazo_data?: string;            // YYYY-MM-DD
  observacoes?: string;
};

export type AgendaTarefa = {
  id: string;
  user_id: string;
  user_nome: string | null;
  titulo: string;
  descricao: string | null;
  data: string | null;        // YYYY-MM-DD ou null
  hora: string | null;        // HH:MM:SS ou null
  card_id: string | null;
  parceiro_id: string | null;
  /** Embed PostgREST: nome/tipo do parceiro quando vinculado (via FK). */
  parceiro?: { id: string; nome: string; tipo: string } | null;
  status: "pendente" | "feita" | "cancelada";
  prioridade: "baixa" | "media" | "alta";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DisponibilidadeDia = {
  vendedor: string;
  dia_semana: number;       // 0=domingo, 6=sábado
  hora_inicio: string;
  hora_fim: string;
  updated_at: string;
};

// ─── AMOSTRAS / MOSTRUÁRIO ────────────────────────────────────────────
export const AMOSTRA_PRODUTOS = ["Piso", "Painel", "Forro", "Deck", "Revestimento", "Brise", "Porta", "Rodapé", "Sauna", "Outro"] as const;
export type AmostraProduto = typeof AMOSTRA_PRODUTOS[number];

export type AmostraStatus = "solicitada" | "aprovada" | "rejeitada" | "em_separacao" | "enviada" | "entregue";

export const AMOSTRA_STATUS_LABELS: Record<AmostraStatus, string> = {
  solicitada:    "Aguardando aprovação",
  aprovada:      "Aprovada",
  rejeitada:     "Rejeitada",
  em_separacao:  "Em separação",
  enviada:       "Enviada",
  entregue:      "Entregue",
};

export type AmostraSolicitacao = {
  id: string;
  card_id: string;
  solicitado_por: string;
  solicitado_por_nome: string | null;
  criado_at: string;
  produto: string;
  acabamento: string | null;
  cor_referencia: string | null;
  quantidade_pecas: number;
  motivo: string;
  obs: string | null;
  endereco_entrega: string | null;
  cep: string | null;
  status: AmostraStatus;
  aprovado_por: string | null;
  aprovado_at: string | null;
  rejeitado_motivo: string | null;
  codigo_rastreio: string | null;
  transportadora: string | null;
  enviado_at: string | null;
  entregue_at: string | null;
  updated_at: string;
};

export type NovaAmostraInput = {
  card_id: string;
  solicitado_por: string;
  solicitado_por_nome?: string | null;
  produto: string;
  acabamento?: string | null;
  cor_referencia?: string | null;
  quantidade_pecas?: number;
  motivo: string;
  obs?: string | null;
  endereco_entrega?: string | null;
  cep?: string | null;
};

export const amostrasApi = {
  /** Cria uma solicitação de amostra pra um card. Default status = "solicitada". */
  criar: async (input: NovaAmostraInput): Promise<AmostraSolicitacao> => {
    const row = {
      card_id: input.card_id,
      solicitado_por: input.solicitado_por,
      solicitado_por_nome: input.solicitado_por_nome ?? null,
      produto: input.produto,
      acabamento: input.acabamento ?? null,
      cor_referencia: input.cor_referencia ?? null,
      quantidade_pecas: input.quantidade_pecas ?? 1,
      motivo: input.motivo,
      obs: input.obs ?? null,
      endereco_entrega: input.endereco_entrega ?? null,
      cep: input.cep ?? null,
    };
    const r = await supabase.from("amostras_solicitacoes").insert(row).select("*").single();
    if (r.error) throw r.error;
    return r.data as AmostraSolicitacao;
  },

  /** Lista solicitações — opcionalmente filtra por card, por solicitante, ou por status. */
  listar: async (opts: { cardId?: string; solicitante?: string; statuses?: AmostraStatus[]; limit?: number } = {}): Promise<AmostraSolicitacao[]> => {
    let q = supabase.from("amostras_solicitacoes").select("*").order("criado_at", { ascending: false });
    if (opts.cardId)      q = q.eq("card_id", opts.cardId);
    if (opts.solicitante) q = q.eq("solicitado_por", opts.solicitante);
    if (opts.statuses && opts.statuses.length) q = q.in("status", opts.statuses);
    if (opts.limit)       q = q.limit(opts.limit);
    const r = await q;
    if (r.error) throw r.error;
    return (r.data || []) as AmostraSolicitacao[];
  },

  /** Aprovar — Douglas/admin only (gate na UI). Grava aprovador. */
  aprovar: async (id: string, aprovadoPor: string): Promise<void> => {
    const r = await supabase.from("amostras_solicitacoes")
      .update({ status: "aprovada", aprovado_por: aprovadoPor, rejeitado_motivo: null })
      .eq("id", id);
    if (r.error) throw r.error;
  },

  /** Rejeitar — Douglas/admin only. Motivo opcional mas recomendado. */
  rejeitar: async (id: string, aprovadoPor: string, motivo: string): Promise<void> => {
    const r = await supabase.from("amostras_solicitacoes")
      .update({ status: "rejeitada", aprovado_por: aprovadoPor, rejeitado_motivo: motivo || null })
      .eq("id", id);
    if (r.error) throw r.error;
  },

  /** Marcar como em separação — após aprovação. */
  emSeparacao: async (id: string): Promise<void> => {
    const r = await supabase.from("amostras_solicitacoes").update({ status: "em_separacao" }).eq("id", id);
    if (r.error) throw r.error;
  },

  /** Marcar enviada — grava rastreio e transportadora (opcional). */
  enviar: async (id: string, opts: { codigo_rastreio?: string; transportadora?: string } = {}): Promise<void> => {
    const r = await supabase.from("amostras_solicitacoes")
      .update({ status: "enviada", codigo_rastreio: opts.codigo_rastreio || null, transportadora: opts.transportadora || null })
      .eq("id", id);
    if (r.error) throw r.error;
  },

  /** Marcar entregue — vendedor confirma recebimento pelo cliente. */
  entregar: async (id: string): Promise<void> => {
    const r = await supabase.from("amostras_solicitacoes").update({ status: "entregue" }).eq("id", id);
    if (r.error) throw r.error;
  },
};

// ─── ACOMPANHAMENTO DE OBRAS (vendedor) ──────────────────────────────
export const OBRA_COL_LABELS: Record<string, string> = {
  "entrada":              "Obras Novas / Entrada",
  "projeto":              "Projeto",
  "projeto-finalizado":   "Projeto Finalizado",
  "pendente":             "Pendente",
  "pre-cronograma":       "Pré-Cronograma",
  "primeira-vistoria":    "Primeira Vistoria",
  "segunda-vistoria":     "Segunda Vistoria",
  "entrega-material":     "Entrega Material",
  "obras-liberadas":      "Obras Liberadas",
  "cronograma-final":     "Cronograma Final",
  "acompanhamento":       "Acompanhamento",
  "travado":              "Travado",
  "obras-finalizadas":    "Finalizadas",
  "reparos":              "Reparos",
  "reparos-concluidos":   "Reparos Concluídos",
};

export type ObraInteracao = {
  id: string;
  card_id: string;
  autor_id: string;
  autor_nome: string | null;
  tipo: "pos_venda" | "visita" | "contato" | "observacao" | "outro";
  texto: string;
  data: string;
  created_at: string;
  updated_at: string;
};

export const OBRA_INTERACAO_TIPOS: { key: ObraInteracao["tipo"]; label: string }[] = [
  { key: "pos_venda",  label: "Pós-venda" },
  { key: "visita",     label: "Visita à obra" },
  { key: "contato",    label: "Contato (call/WhatsApp)" },
  { key: "observacao", label: "Observação" },
  { key: "outro",      label: "Outro" },
];

export const obrasApi = {
  /** Cards de obras (dept=operacional) filtrados pelo nome do vendedor.
   *  Faz match por PRIMEIRO NOME ILIKE pra tolerar dados sujos ("MURILO" vs
   *  "MURILO CECCON ARSIE"). Se vendedorNome vazio, devolve tudo (admin). */
  minhasObras: async (vendedorNome: string | null): Promise<KanbanCard[]> => {
    let q = supabase.from("kanban_cards").select("*").eq("dept_id", "operacional");
    if (vendedorNome && vendedorNome.trim()) {
      const primeiroNome = vendedorNome.trim().split(/\s+/)[0];
      q = q.ilike("details->>vendedor", `%${primeiroNome}%`);
    }
    const r = await q.order("updated_at", { ascending: false, nullsFirst: false }).limit(500);
    if (r.error) throw r.error;
    return (r.data || []) as KanbanCard[];
  },

  listarInteracoes: async (cardId: string): Promise<ObraInteracao[]> => {
    const r = await supabase.from("acompanhamento_obras_interacoes")
      .select("*").eq("card_id", cardId).order("created_at", { ascending: false });
    if (r.error) throw r.error;
    return (r.data || []) as ObraInteracao[];
  },

  /** Lista o N mais recente por card (pra mostrar "última interação" no cartão).
   *  Faz N queries em paralelo — N tipicamente pequeno (<200 cards). */
  ultimaInteracaoPorCard: async (cardIds: string[]): Promise<Map<string, ObraInteracao>> => {
    if (cardIds.length === 0) return new Map();
    const r = await supabase.from("acompanhamento_obras_interacoes")
      .select("*").in("card_id", cardIds).order("created_at", { ascending: false });
    if (r.error) throw r.error;
    const map = new Map<string, ObraInteracao>();
    for (const row of (r.data || []) as ObraInteracao[]) {
      if (!map.has(row.card_id)) map.set(row.card_id, row);
    }
    return map;
  },

  criarInteracao: async (input: {
    card_id: string; autor_id: string; autor_nome?: string | null;
    tipo: ObraInteracao["tipo"]; texto: string; data?: string;
  }): Promise<ObraInteracao> => {
    const row = {
      card_id: input.card_id,
      autor_id: input.autor_id,
      autor_nome: input.autor_nome ?? null,
      tipo: input.tipo,
      texto: input.texto,
      data: input.data || new Date().toISOString().slice(0, 10),
    };
    const r = await supabase.from("acompanhamento_obras_interacoes")
      .insert(row).select("*").single();
    if (r.error) throw r.error;
    return r.data as ObraInteracao;
  },

  deletarInteracao: async (id: string): Promise<void> => {
    const r = await supabase.from("acompanhamento_obras_interacoes").delete().eq("id", id);
    if (r.error) throw r.error;
  },
};

/** Subscribe realtime nos cards comerciais — chama `onChange` em INSERT/UPDATE/DELETE.
 *  Cada chamada cria um canal único (random suffix) pra evitar conflito quando
 *  múltiplos componentes assinam ao mesmo tempo. */
export function subscribeCards(onChange: (evt: { type: "INSERT" | "UPDATE" | "DELETE"; card: KanbanCard }) => void) {
  const uniqueId = Math.random().toString(36).slice(2, 9);
  const channel = supabase
    .channel(`hb-cards-${uniqueId}`)
    .on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "kanban_cards", filter: `dept_id=in.(${DEPT_ENTRADA},${DEPT_COMERCIAL})` },
      (payload: any) => {
        const card = (payload.new || payload.old) as KanbanCard;
        if (!card) return;
        onChange({ type: payload.eventType, card });
      }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
