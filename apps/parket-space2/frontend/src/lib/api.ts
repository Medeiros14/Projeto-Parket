/**
 * API do Space v2 — wrappers Supabase pras tabelas core (kanban_cards, kanban_columns).
 * Reusa o mesmo gateway (api.parket.works) que Space + Homebroker.
 */
import { supabase } from "./supabase";
import { useEffect, useState } from "react";

export type KanbanCard = {
  id: string;
  dept_id: string;
  column_id: string;
  title: string | null;
  subtitle: string | null;
  obra: string | null;
  responsavel: string | null;
  tags: string[] | null;
  value: string | null;
  created_at: string;
  updated_at: string | null;
  details: any;
};

export type KanbanColumn = {
  id: string;
  dept_id: string;
  slug: string;
  title: string;
  color: string | null;
  position: number | null;
};

export const DEPT_ENTRADA = "comercial-entrada";
export const DEPT_COMERCIAL = "comercial";

const unwrap = <T,>(r: { data: T | null; error: any }): T => {
  if (r.error) throw new Error(r.error.message || String(r.error));
  return r.data as T;
};

export const api = {
  columns: async (deptIds: string[]): Promise<KanbanColumn[]> => {
    const r = await supabase.from("kanban_columns").select("*").in("dept_id", deptIds);
    const cols = unwrap(r) || [];
    return cols.sort((a: any, b: any) => {
      if (a.dept_id !== b.dept_id) return a.dept_id < b.dept_id ? -1 : 1;
      return (a.position ?? 0) - (b.position ?? 0);
    });
  },

  cardsByDept: async (deptId: string, limit = 1200): Promise<KanbanCard[]> => {
    const r = await supabase
      .from("kanban_cards")
      .select("id, dept_id, column_id, title, subtitle, obra, responsavel, tags, value, created_at, updated_at, details")
      .eq("dept_id", deptId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    return unwrap(r) || [];
  },
};

/** Resolve column_id (uuid OR slug) pro slug canônico. */
export function resolveSlug(cardColumnId: string | null | undefined, columns: KanbanColumn[]): string {
  if (!cardColumnId) return "";
  const bySlug = columns.find((c) => c.slug === cardColumnId);
  if (bySlug) return bySlug.slug;
  const byId = columns.find((c) => c.id === cardColumnId);
  if (byId) return byId.slug;
  return cardColumnId;
}

/** Hook básico de fetch com loading/error/reload. */
export function useFetch<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn().then(
      (d) => { if (alive) { setData(d); setLoading(false); setError(null); } },
      (e) => { if (alive) { setError(e?.message || String(e)); setLoading(false); } }
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, key]);
  return { data, loading, error, reload: () => setKey((k) => k + 1) };
}
