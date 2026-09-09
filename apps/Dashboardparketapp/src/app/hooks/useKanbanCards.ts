import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { KanbanCard, KanbanColumn } from "../components/sistema-ops-data";

/* ─── Tipos das seções ricas do card ─── */
export interface GateStep {
  gate: number;
  label: string;
  status: "done" | "current" | "pending" | "blocked";
  date?: string;
  responsible?: string;
}

export interface ChecklistItem {
  item: string;
  done: boolean;
}

export interface HandoffStep {
  from: string;
  to: string;
  item: string;
  status: "done" | "current" | "pending";
  date: string;
}

export interface FinanceiroData {
  valorContrato?: string;
  orcado?: string;
  realizado?: string;
  margemOrc?: string;
  margemReal?: string;
  parcelas?: Array<{ num: number; valor: string; status: string; venc: string }>;
  custos?: Array<{ cat: string; valor: string; perc: number }>;
}

export interface RACIEntry {
  atividade: string;
  r: string;
  a: string;
  c: string;
  i: string;
}

export interface ChatMessage {
  id?: number;
  user: string;
  msg: string;
  time: string;
  avatar: string;
}

/* ─── Tipo do card no Supabase ─── */
export interface DbCard {
  id: string;
  dept_id: string;
  column_id: string;
  title: string;
  subtitle?: string;
  obra?: string;
  responsavel: string;
  sla: string;
  sla_status: "ok" | "warning" | "expired";
  tags?: string[];
  progress?: number;
  value?: string;
  checklist_done?: number;
  checklist_total?: number;
  gate?: number;
  priority?: "alta" | "media" | "baixa";
  parent_card_id?: string;
  created_by?: string;
  // Texto livre
  description?: string;
  details?: Record<string, unknown>;
  // Seções ricas do modal 360°
  gates_data?: GateStep[];
  checklist_items?: ChecklistItem[];
  handoffs_data?: HandoffStep[];
  financeiro_data?: FinanceiroData;
  raci_data?: RACIEntry[];
  chat_messages?: ChatMessage[];
  // Auditoria
  created_at?: string;
  updated_at?: string;
}

export type NewCard = Omit<DbCard, "id" | "created_at" | "updated_at">;

/* ─── Tipo da coluna no Supabase ─── */
export interface DbColumn {
  id: string;
  dept_id: string;
  slug: string;       // human-readable identifier (column_id now uses UUID)
  title: string;
  color: string;
  position: number;
  is_handoff: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Retorna true se o ID parece um UUID (card do banco) */
export function isDbCardId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Converte DbCard → KanbanCard (formato do frontend) */
function toKanbanCard(db: DbCard): KanbanCard {
  const det = db.details as Record<string, unknown> | undefined;
  return {
    id: db.id,
    title: db.title,
    subtitle: db.subtitle,
    obra: db.obra,
    responsavel: db.responsavel,
    sla: db.sla,
    slaStatus: db.sla_status,
    tags: db.tags,
    progress: db.progress,
    value: db.value,
    checklist: db.checklist_total ? { done: db.checklist_done ?? 0, total: db.checklist_total } : undefined,
    gate: db.gate,
    priority: db.priority,
    // Seções ricas para o modal 360°
    gates_data: db.gates_data,
    checklist_items: db.checklist_items,
    handoffs_data: db.handoffs_data,
    financeiro_data: db.financeiro_data,
    raci_data: db.raci_data,
    chat_messages: db.chat_messages,
    // Handoff acceptance
    handoff_pending: det?.handoff_status === "pending_acceptance",
    handoff_from_dept: det?.handoff_from_dept as string | undefined,
    // Tipo de projeto (regra de cores)
    tipo_projeto: det?.tipo_projeto as KanbanCard["tipo_projeto"] | undefined,
    // Prazo em dias úteis
    previsao_inicio: det?.previsao_inicio as string | undefined,
    prazo_dias_uteis: typeof det?.prazo_dias_uteis === "number" ? det.prazo_dias_uteis : undefined,
    // Raw details for custom dept UIs (e.g. Compras)
    details: db.details as Record<string, unknown> | undefined,
    parent_card_id: db.parent_card_id,
  };
}

/* ─── Hook principal ─── */
export function useKanbanCards(deptId: string) {
  const [dbCards, setDbCards] = useState<DbCard[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("kanban_cards")
      .select("*")
      .eq("dept_id", deptId)
      .order("created_at", { ascending: true });
    setDbCards((data ?? []) as DbCard[]);
    setLoading(false);
  }, [deptId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: recarrega cards quando INSERT ou UPDATE na tabela kanban_cards
  useEffect(() => {
    const channel = supabase
      .channel(`kanban_cards:dept_id=eq.${deptId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "kanban_cards", filter: `dept_id=eq.${deptId}` }, () => { load(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "kanban_cards", filter: `dept_id=eq.${deptId}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [deptId, load]);

  /** Cria card no banco e adiciona ao estado local */
  async function addCard(card: NewCard): Promise<DbCard | null> {
    const { data, error } = await supabase
      .from("kanban_cards")
      .insert(card)
      .select()
      .single();
    if (!error && data) {
      setDbCards(prev => [...prev, data as DbCard]);
      return data as DbCard;
    }
    console.error("addCard error:", error);
    return null;
  }

  /** Atualiza campos de um card no banco */
  async function updateDbCard(cardId: string, fields: Partial<DbCard>): Promise<boolean> {
    const { error } = await supabase
      .from("kanban_cards")
      .update(fields)
      .eq("id", cardId);
    if (!error) {
      setDbCards(prev => prev.map(c => c.id === cardId ? { ...c, ...fields } : c));
      return true;
    }
    console.error("updateDbCard error:", error);
    return false;
  }

  /** Atualiza a coluna de um card no banco */
  async function moveDbCard(cardId: string, toColumnId: string) {
    await supabase
      .from("kanban_cards")
      .update({ column_id: toColumnId })
      .eq("id", cardId);
  }

  /** Busca um card completo */
  async function getDbCard(cardId: string): Promise<DbCard | null> {
    const { data } = await supabase
      .from("kanban_cards")
      .select("*")
      .eq("id", cardId)
      .single();
    return data as DbCard | null;
  }

  /** Merge dos cards do banco nas colunas estáticas */
  function mergeIntoColumns(staticColumns: KanbanColumn[]): KanbanColumn[] {
    if (dbCards.length === 0) return staticColumns;
    // Quando há cards no banco, descarta os cards estáticos de exemplo
    const merged = staticColumns.map(col => ({ ...col, cards: [] as KanbanColumn["cards"] }));
    for (const db of dbCards) {
      const col = merged.find(c => c.id === db.column_id);
      if (col) col.cards.push(toKanbanCard(db));
    }
    return merged;
  }

  return { dbCards, loading, addCard, updateDbCard, moveDbCard, getDbCard, mergeIntoColumns, reload: load };
}

/* ─── Hook de colunas dinâmicas ─── */
export function useKanbanColumns(deptId: string) {
  const [dbColumns, setDbColumns] = useState<DbColumn[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("kanban_columns")
      .select("*")
      .eq("dept_id", deptId)
      .order("position", { ascending: true });
    if (data && data.length > 0) setDbColumns(data as DbColumn[]);
    setLoading(false);
  }, [deptId]);

  useEffect(() => { load(); }, [load]);

  async function addColumn(title: string, color: string = "gray"): Promise<DbColumn | null> {
    const maxPos = dbColumns.length > 0 ? Math.max(...dbColumns.map(c => c.position)) + 1 : 0;
    const slug = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { data, error } = await supabase
      .from("kanban_columns")
      .insert({ dept_id: deptId, slug, title, color, position: maxPos, is_handoff: false })
      .select()
      .single();
    if (!error && data) {
      setDbColumns(prev => [...prev, data as DbColumn]);
      return data as DbColumn;
    }
    console.error("addColumn error:", error);
    return null;
  }

  async function updateColumn(colId: string, fields: Partial<DbColumn>): Promise<boolean> {
    const { error } = await supabase
      .from("kanban_columns")
      .update(fields)
      .eq("id", colId);
    if (!error) {
      setDbColumns(prev => prev.map(c => c.id === colId ? { ...c, ...fields } : c));
      return true;
    }
    return false;
  }

  async function deleteColumn(colId: string): Promise<boolean> {
    const { error } = await supabase
      .from("kanban_columns")
      .delete()
      .eq("id", colId);
    if (!error) {
      setDbColumns(prev => prev.filter(c => c.id !== colId));
      return true;
    }
    return false;
  }

  async function reorderColumns(ordered: DbColumn[]): Promise<void> {
    setDbColumns(ordered);
    await Promise.all(
      ordered.map((col, idx) =>
        supabase.from("kanban_columns").update({ position: idx }).eq("id", col.id)
      )
    );
  }

  /** Converts DB columns to the KanbanColumn shape used by the board */
  function toKanbanColumns(staticCols: import("../components/sistema-ops-data").KanbanColumn[]): import("../components/sistema-ops-data").KanbanColumn[] {
    if (dbColumns.length === 0) return staticCols;
    return dbColumns.map(dc => {
      const existing = staticCols.find(sc => sc.id === dc.id || sc.id === dc.slug);
      return {
        id: dc.id,
        title: dc.title,
        color: dc.color as any,
        cards: existing?.cards ?? [],
      };
    });
  }

  return { dbColumns, loading, addColumn, updateColumn, deleteColumn, reorderColumns, toKanbanColumns, reload: load };
}

/* ─── Função standalone para criar handoff cards em outros depts ─── */
export async function createHandoffCard(card: NewCard): Promise<DbCard | null> {
  const { data, error } = await supabase
    .from("kanban_cards")
    .insert(card)
    .select()
    .single();
  if (error) { console.error("createHandoffCard error:", error); return null; }
  return data as DbCard;
}

/**
 * Move um card para um novo dept+coluna (passagem de bastão primária).
 * - Atualiza kanban_cards: dept_id, column_id, gate, gates_data
 * - Loga o movimento em card_movements (falha silenciosa se tabela não existir)
 */
export async function moveCardToDept(
  cardId: string,
  toDept: string,
  toColumn: string,
  gate: number,
  movedBy: string,
): Promise<boolean> {
  const { data: current, error: fetchErr } = await supabase
    .from("kanban_cards").select("*").eq("id", cardId).single();
  if (fetchErr || !current) {
    console.error("moveCardToDept: fetch failed", fetchErr);
    return false;
  }

  const card = current as DbCard;
  const today = new Date().toISOString().split("T")[0];

  // Atualiza gates_data: marca o gate atual como done, próximo como current
  const prevGates: GateStep[] = Array.isArray(card.gates_data) ? card.gates_data : [];
  const updatedGates: GateStep[] = prevGates.map(step => {
    if (step.gate === card.gate) return { ...step, status: "done" as const, date: today };
    if (step.gate === gate)      return { ...step, status: "current" as const };
    return step;
  });

  const prevDetails = (card.details as Record<string, unknown>) ?? {};
  const newDetails: Record<string, unknown> = {
    ...prevDetails,
    handoff_status: "pending_acceptance",
    handoff_from_dept: card.dept_id,
    handoff_from_column: card.column_id,
    handoff_received_at: new Date().toISOString(),
  };

  const { error: updateErr } = await supabase.from("kanban_cards").update({
    dept_id: toDept,
    column_id: toColumn,
    gate,
    details: newDetails,
    ...(updatedGates.length > 0 ? { gates_data: updatedGates } : {}),
  }).eq("id", cardId);

  if (updateErr) {
    console.error("moveCardToDept: update failed", updateErr);
    return false;
  }

  // Loga o movimento (falha silenciosa se tabela ainda não existe)
  try {
    await supabase.from("card_movements").insert({
      card_id: cardId,
      gate,
      from_dept: card.dept_id,
      from_column: card.column_id,
      to_dept: toDept,
      to_column: toColumn,
      moved_by: movedBy,
    });
  } catch (e) {
    console.warn("moveCardToDept: card_movements insert (non-fatal):", e);
  }

  return true;
}

const AI_BACKEND_HANDOFFS = "https://agente.parket.works/api/handoffs/notify";

async function _notifyHandoff(
  action: "aceito" | "recusado",
  det: DbCard,
  acceptedBy: string,
  observacao?: string,
  negadoMotivo?: string,
) {
  const prevDet = (det.details as Record<string, unknown>) ?? {};
  // Look up linked handoff record by source_card_id = handoff_source_card_id or dest_card_id = det.id
  const { data: handoffRows } = await supabase
    .from("handoffs")
    .select("id")
    .eq("dest_card_id", det.id)
    .eq("status", "pendente")
    .limit(1);

  const handoffId = handoffRows?.[0]?.id ?? det.id;

  // Update handoffs table
  if (action === "aceito") {
    await supabase.from("handoffs").update({
      status: "aceito",
      aceito_por: acceptedBy,
      aceito_em: new Date().toISOString(),
      observacao: observacao ?? null,
      updated_at: new Date().toISOString(),
    }).eq("dest_card_id", det.id);
  } else {
    await supabase.from("handoffs").update({
      status: "cancelado",
      negado_por: acceptedBy,
      negado_em: new Date().toISOString(),
      negado_motivo: negadoMotivo ?? null,
      observacao: observacao ?? null,
      updated_at: new Date().toISOString(),
    }).eq("dest_card_id", det.id);
  }

  // Notify AI backend → WhatsApp
  try {
    await fetch(AI_BACKEND_HANDOFFS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handoff_id: handoffId,
        action,
        obra: det.obra,
        title: det.title,
        dept_from: (prevDet.handoff_from_dept as string) ?? "fiscal",
        dept_to: det.dept_id,
        responsavel_from: "Felipe",
        responsavel_to: acceptedBy,
        observacao: observacao ?? null,
        negado_motivo: negadoMotivo ?? null,
      }),
    });
  } catch (_) {}
}

/**
 * Aceita o projeto recebido via handoff.
 * Marca handoff_status = "accepted", atualiza tabela handoffs e notifica WhatsApp.
 */
export async function acceptHandoff(cardId: string, acceptedBy: string, observacao?: string): Promise<boolean> {
  const { data: card, error: fetchErr } = await supabase
    .from("kanban_cards").select("*").eq("id", cardId).single();
  if (fetchErr || !card) return false;

  const det = card as DbCard;
  const details: Record<string, unknown> = {
    ...((det.details as Record<string, unknown>) ?? {}),
    handoff_status: "accepted",
    handoff_accepted_by: acceptedBy,
    handoff_accepted_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("kanban_cards").update({ details }).eq("id", cardId);
  if (error) return false;

  try {
    await supabase.from("card_movements").insert({
      card_id: cardId,
      gate: det.gate ?? 0,
      from_dept: det.dept_id,
      from_column: det.column_id,
      to_dept: det.dept_id,
      to_column: det.column_id,
      moved_by: acceptedBy,
      notes: `✅ Handoff aceito por ${acceptedBy}`,
    });
  } catch (_) {}

  await _notifyHandoff("aceito", det, acceptedBy, observacao);
  return true;
}

/**
 * Devolve o projeto ao dept anterior com um motivo.
 * Move o card de volta, atualiza handoffs e notifica WhatsApp.
 */
export async function returnHandoff(cardId: string, reason: string, returnedBy: string): Promise<boolean> {
  const { data: card, error: fetchErr } = await supabase
    .from("kanban_cards").select("*").eq("id", cardId).single();
  if (fetchErr || !card) return false;

  const det = card as DbCard;
  const prevDet = (det.details as Record<string, unknown>) ?? {};
  const fromDept = (prevDet.handoff_from_dept as string) ?? det.dept_id;
  const prevGate = Math.max((det.gate ?? 1) - 1, 0);
  // Fiscal: devolve para "2vistoria" (coluna antes do handoff-pmo)
  // Outros: usa a coluna de origem registrada ou fallback "revisao"
  const fromColumnStored = (prevDet.handoff_from_column as string) ?? null;
  const fromColumn = fromDept === "fiscal" ? "2vistoria" : (fromColumnStored ?? "revisao");

  // Reverte gates_data: marca gate atual como "pending", anterior como "current"
  const prevGates: GateStep[] = Array.isArray(det.gates_data) ? det.gates_data : [];
  const revertedGates: GateStep[] = prevGates.map(step => {
    if (step.gate === det.gate)  return { ...step, status: "current" as const, date: undefined };
    if (step.gate === prevGate)  return { ...step, status: "current" as const };
    return step;
  });

  const newDetails: Record<string, unknown> = {
    ...prevDet,
    handoff_status: "returned",
    handoff_return_reason: reason,
    handoff_returned_by: returnedBy,
    handoff_returned_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("kanban_cards").update({
    dept_id: fromDept,
    column_id: fromColumn,
    gate: prevGate,
    details: newDetails,
    ...(revertedGates.length > 0 ? { gates_data: revertedGates } : {}),
  }).eq("id", cardId);

  if (error) return false;

  try {
    await supabase.from("card_movements").insert({
      card_id: cardId,
      gate: prevGate,
      from_dept: det.dept_id,
      from_column: det.column_id,
      to_dept: fromDept,
      to_column: fromColumn,
      moved_by: returnedBy,
      notes: `🔙 DEVOLVIDO: ${reason}`,
    });
  } catch (_) {}

  await _notifyHandoff("recusado", det, returnedBy, reason, reason);
  return true;
}
