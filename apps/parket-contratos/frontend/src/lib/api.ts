/**
 * API — leitura super eficiente do Kanban.
 *
 * Uma única query pra kanban_cards do dept 'financeiro' nas 4 colunas alvo +
 * um LEFT JOIN em `contratos_docusign` (via segundo request agrupado por card_id
 * já que PostgREST não faz LEFT JOIN nativo). Em seguida um IN em
 * simulacao_projetos pra puxar `meta.contrato_cliente`.
 *
 * Total: 3 requests, todas via gateway → PostgREST local. Realtime opcional
 * em cima disso.
 */
import { supabase } from "./supabase";

export const KANBAN_COLUMNS = [
  { slug: "verificando",       title: "Verificando",       descr: "Recebido do Homebroker — time revisa e envia" },
  { slug: "contrato-enviado",  title: "Contrato Enviado",  descr: "PDF enviado — aguardando assinaturas" },
  { slug: "contrato-assinado", title: "Contrato Assinado", descr: "Envelope completo — todas assinaturas coletadas" },
] as const;

export type KanbanColumnSlug = typeof KANBAN_COLUMNS[number]["slug"];

export type Card = {
  id: string;
  title: string | null;
  column_id: string | null;
  responsavel: string | null;
  created_at: string;
  updated_at: string;
  details: Record<string, any> | null;
  tags: string[] | null;
  value: string | null;
};

export type ContratoRow = {
  id: string;
  card_id: string;
  envelope_id: string | null;
  status: string;
  titulo: string | null;
  sent_at: string | null;
  completed_at: string | null;
  last_event: Record<string, any> | null;
  created_at: string;
};

export type SimulacaoMeta = {
  id: string;
  numero: number | null;
  cliente: string | null;
  vendedor: string | null;
  arquiteto: string | null;
  meta: Record<string, any> | null;
};

export type BoardRow = {
  card: Card;
  contrato: ContratoRow | null;
  simulacao: SimulacaoMeta | null;
};

// Ordem canônica das colunas por slug
export function columnOrder(slug: string | null | undefined): number {
  const i = KANBAN_COLUMNS.findIndex((c) => c.slug === slug);
  return i < 0 ? 999 : i;
}

export async function fetchBoard(): Promise<BoardRow[]> {
  const slugs = KANBAN_COLUMNS.map((c) => c.slug);
  const cards = await supabase
    .from("kanban_cards")
    .select("id,title,column_id,responsavel,created_at,updated_at,details,tags,value")
    .eq("dept_id", "financeiro")
    .in("column_id", slugs)
    .order("updated_at", { ascending: false });
  if (cards.error) throw cards.error;
  const rows = (cards.data || []) as Card[];
  if (rows.length === 0) return [];

  const cardIds = rows.map((r) => r.id);
  const simIds  = rows
    .map((r) => (r.details as any)?.simulacao_id)
    .filter(Boolean) as string[];

  // Contratos: pega TODOS por card e escolhe o mais recente por id/created_at
  const contratos = await supabase
    .from("contratos_docusign")
    .select("id,card_id,envelope_id,status,titulo,sent_at,completed_at,last_event,created_at")
    .in("card_id", cardIds)
    .order("created_at", { ascending: false });
  const byCard = new Map<string, ContratoRow>();
  for (const c of ((contratos.data || []) as ContratoRow[])) {
    if (!byCard.has(c.card_id)) byCard.set(c.card_id, c);
  }

  const sims = simIds.length > 0
    ? await supabase.from("simulacao_projetos")
        .select("id,numero,cliente,vendedor,arquiteto,meta")
        .in("id", simIds)
    : { data: [] };
  const bySim = new Map<string, SimulacaoMeta>();
  for (const s of ((sims.data || []) as SimulacaoMeta[])) bySim.set(s.id, s);

  return rows.map((card) => ({
    card,
    contrato:  byCard.get(card.id) || null,
    simulacao: bySim.get((card.details as any)?.simulacao_id) || null,
  }));
}

export async function moveCard(cardId: string, toSlug: KanbanColumnSlug): Promise<void> {
  const { error } = await supabase
    .from("kanban_cards")
    .update({ column_id: toSlug })
    .eq("id", cardId);
  if (error) throw error;
}

// Salva merge em simulacao_projetos.meta.contrato_cliente
export async function saveContratoCliente(simId: string, patch: Record<string, any>): Promise<void> {
  const cur = await supabase.from("simulacao_projetos").select("meta").eq("id", simId).maybeSingle();
  const meta = { ...((cur.data as any)?.meta || {}), contrato_cliente: {
    ...((((cur.data as any)?.meta || {}).contrato_cliente) || {}),
    ...patch,
  }};
  const { error } = await supabase.from("simulacao_projetos").update({ meta }).eq("id", simId);
  if (error) throw error;
}

// Grava override do corpo de contrato POR proposta (simulacao_projetos.meta.contrato_corpo_override).
// Passar `null` remove o override (volta ao padrão global de public.contrato_clausulas).
export async function saveContratoCorpoOverride(simId: string, corpo: string | null): Promise<void> {
  const cur = await supabase.from("simulacao_projetos").select("meta").eq("id", simId).maybeSingle();
  const metaCur = ((cur.data as any)?.meta || {}) as Record<string, any>;
  const meta = { ...metaCur };
  if (corpo == null || corpo.trim().length === 0) delete meta.contrato_corpo_override;
  else meta.contrato_corpo_override = corpo;
  const { error } = await supabase.from("simulacao_projetos").update({ meta }).eq("id", simId);
  if (error) throw error;
}

// ── DocuSign: chamadas passam pelo nginx local → parket-docusign_api ─────────
const DU_BASE = "/api/docusign";

export type EnvelopeCreate = {
  card_id: string;
  pdf_base64: string;
  pdf_filename: string;
  email_subject: string;
  email_blurb?: string;
  titulo?: string;
  signatarios: Array<{
    nome: string; email: string; papel: string; anchor?: string;
    rg?: string; cpf?: string;   // opcionais — usados só pra testemunhas
  }>;
};

export async function docusignSend(payload: EnvelopeCreate): Promise<ContratoRow> {
  const r = await fetch(`${DU_BASE}/envelopes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`DocuSign send falhou (${r.status}): ${await r.text()}`);
  return r.json();
}

export type EnvelopeCreateFromHtml = Omit<EnvelopeCreate, "pdf_base64"> & {
  html_base64: string;    // HTML do contrato em base64 (UTF-8)
};

/** Backend renderiza o PDF do HTML via Chromium (Playwright) — sem anexo manual. */
export async function docusignSendFromHtml(payload: EnvelopeCreateFromHtml): Promise<ContratoRow> {
  const r = await fetch(`${DU_BASE}/envelopes-from-html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`DocuSign send (HTML) falhou (${r.status}): ${await r.text()}`);
  return r.json();
}

export async function docusignRefresh(envelopeId: string): Promise<any> {
  const r = await fetch(`${DU_BASE}/envelopes/${envelopeId}/refresh`, { method: "POST" });
  if (!r.ok) throw new Error(`Refresh falhou (${r.status})`);
  return r.json();
}

export async function docusignByCard(cardId: string): Promise<ContratoRow[]> {
  const r = await fetch(`${DU_BASE}/by-card/${cardId}`);
  if (!r.ok) return [];
  return r.json();
}

export async function docusignSigningUrl(envelopeId: string, recipientId: string): Promise<{ url: string; name: string; papel: string }> {
  const r = await fetch(`${DU_BASE}/envelopes/${envelopeId}/signing-url/${recipientId}`, { method: "POST" });
  if (!r.ok) throw new Error(`Signing URL falhou (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// ── Verificação/Aceite dos dados do contrato ────────────────────────────────

export type ContratoReview = {
  status: "aceito" | "pendente_vendedor" | "reenviado" | null;
  motivo?: string;
  campos_faltando?: string[];
  aceito_em?: string;
  aceito_por_email?: string;
  aberto_em?: string;
  aberto_por_email?: string;
  reenviado_em?: string;
};

async function patchCardDetails(cardId: string, patch: Record<string, any>): Promise<void> {
  const cur = await supabase.from("kanban_cards").select("details").eq("id", cardId).maybeSingle();
  const newDetails = { ...((cur.data?.details as any) || {}), ...patch };
  const { error } = await supabase.from("kanban_cards").update({ details: newDetails }).eq("id", cardId);
  if (error) throw error;
}

/** Resolve o user_id do vendedor a partir do nome ou email guardado no card. */
async function resolveVendedorUserId(nome: string | null | undefined, email: string | null | undefined): Promise<{ id: string; email: string; nome: string } | null> {
  if (email && email.trim()) {
    const r = await supabase.from("user_profiles").select("id,email,full_name").eq("email", email.trim().toLowerCase()).maybeSingle();
    if (r.data) return { id: r.data.id, email: r.data.email, nome: r.data.full_name };
  }
  if (!nome || !nome.trim()) return null;
  // Match por full_name + vendedor + ativo, priorizando dept_leader (Davi principal)
  const rs = await supabase.from("user_profiles")
    .select("id,email,full_name,role,funcao_comercial,ativo")
    .eq("full_name", nome.trim())
    .eq("funcao_comercial", "vendedor")
    .eq("ativo", true)
    .order("role", { ascending: false });   // 'dept_leader' > 'viewer'
  const list = (rs.data || []) as any[];
  if (list.length === 0) return null;
  return { id: list[0].id, email: list[0].email, nome: list[0].full_name };
}

/**
 * Aceita as informações do contrato — libera o envio pra DocuSign.
 * Marca `details.contrato_review.status='aceito'`.
 */
export async function aceitarContrato(contratoCardId: string, userEmail: string): Promise<void> {
  const review: ContratoReview = {
    status: "aceito",
    aceito_em: new Date().toISOString(),
    aceito_por_email: userEmail,
  };
  await patchCardDetails(contratoCardId, { contrato_review: review });
}

/**
 * Solicita correção ao vendedor: guarda o motivo no card do Financeiro,
 * espelha o mesmo motivo no card do Comercial (que o vendedor abre no Homebroker),
 * cria uma tarefa e uma notificação in-app pro vendedor.
 */
export async function solicitarCorrecaoContrato(args: {
  contratoCardId: string;
  clienteNome: string;
  motivo: string;
  camposFaltando?: string[];
  userEmail: string;                    // quem tá solicitando (Financeiro)
}): Promise<{ vendedor: { id: string; email: string; nome: string } | null; comercialCardId: string | null }> {
  const { contratoCardId, clienteNome, motivo, camposFaltando = [], userEmail } = args;

  // Carrega o card do Financeiro pra achar o comercial_card_id + dados do vendedor
  const card = await supabase.from("kanban_cards").select("id,details,responsavel").eq("id", contratoCardId).maybeSingle();
  if (!card.data) throw new Error("Card não encontrado");
  const det = (card.data.details as any) || {};
  const comercialCardId: string | null = det.comercial_card_id || null;

  // Encontra o vendedor
  const vendedor = await resolveVendedorUserId(
    (card.data as any).responsavel || det.vendedor || null,
    det.vendedor_email || null,
  );

  const now = new Date().toISOString();
  const review: ContratoReview = {
    status: "pendente_vendedor",
    motivo,
    campos_faltando: camposFaltando,
    aberto_em: now,
    aberto_por_email: userEmail,
  };

  // 1. Marca o card do Financeiro (contrato)
  await patchCardDetails(contratoCardId, { contrato_review: review });

  // 2. Espelha no card do Comercial (Homebroker) — o vendedor vê o alerta lá
  if (comercialCardId) {
    await patchCardDetails(comercialCardId, {
      contrato_pendencia: {
        status: "pendente",
        motivo,
        campos_faltando: camposFaltando,
        aberto_em: now,
        aberto_por_email: userEmail,
        contrato_card_id: contratoCardId,
      },
    });
  }

  // 3. Cria a tarefa atribuída ao vendedor
  if (vendedor) {
    await supabase.from("agenda_tarefas").insert({
      user_id: vendedor.id,
      user_nome: vendedor.nome,
      titulo: `Complementar contrato — ${clienteNome}`,
      descricao: motivo,
      card_id: comercialCardId || contratoCardId,
      status: "pendente",
      prioridade: "alta",
      data: now.slice(0, 10),
    });

    // 4. Cria a notificação in-app
    await supabase.from("notificacoes").insert({
      user_id: vendedor.id,
      tipo: "contrato_pendencia",
      titulo: `Contrato pendente — ${clienteNome}`,
      mensagem: motivo.slice(0, 220),
      referencia_id: comercialCardId || contratoCardId,
      referencia_tipo: "kanban_card",
      lida: false,
    });
  }

  return { vendedor, comercialCardId };
}
