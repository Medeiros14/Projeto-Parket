import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ─── Tipos ─── */
export interface DeptKpisLive {
  dept_id: string;
  total_cards: number;
  expired_cards: number;
  warning_cards: number;
  ok_cards: number;
  sla_ok_pct: number;
  blocked_cards: number;
  high_priority: number;
  avg_progress: number | null;
  checklist_pct: number;
  in_handoff: number;
}

export interface KpiSnapshot {
  id: string;
  dept_id: string;
  snapshot_at: string;
  total_cards: number;
  expired_cards: number;
  sla_ok_pct: number;
  blocked_cards: number;
  high_priority: number;
  avg_progress: number | null;
  checklist_pct: number;
  in_handoff: number;
}

/* ─── Hook ─── */
export function useKpis(deptId?: string) {
  const [kpis, setKpis] = useState<DeptKpisLive[]>([]);
  const [snapshots, setSnapshots] = useState<KpiSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKpis = useCallback(async () => {
    setLoading(true);
    setError(null);

    let liveQuery = supabase.from("dept_kpis_live").select("*");
    if (deptId) liveQuery = liveQuery.eq("dept_id", deptId);

    let snapQuery = supabase
      .from("kpi_snapshots")
      .select("*")
      .order("snapshot_at", { ascending: false })
      .limit(deptId ? 10 : 100);
    if (deptId) snapQuery = snapQuery.eq("dept_id", deptId);

    const [{ data: liveData, error: liveErr }, { data: snapData, error: snapErr }] =
      await Promise.all([liveQuery, snapQuery]);

    if (liveErr) setError(liveErr.message);
    else setKpis(liveData ?? []);

    if (!snapErr) setSnapshots(snapData ?? []);

    setLoading(false);
  }, [deptId]);

  useEffect(() => {
    fetchKpis();

    /* Re-fetch quando kanban_cards mudar */
    const channel = supabase
      .channel("kpis_live_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_cards" }, () => {
        fetchKpis();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchKpis]);

  /* ─── Helpers ─── */
  const getByDept = useCallback(
    (dept: string) => kpis.find(k => k.dept_id === dept) ?? null,
    [kpis]
  );

  /* Agrega todos os depts num resumo global */
  const globalSummary = {
    totalCards: kpis.reduce((s, k) => s + k.total_cards, 0),
    expiredCards: kpis.reduce((s, k) => s + k.expired_cards, 0),
    blockedCards: kpis.reduce((s, k) => s + k.blocked_cards, 0),
    highPriority: kpis.reduce((s, k) => s + k.high_priority, 0),
    avgSlaOkPct:
      kpis.length > 0
        ? Math.round(kpis.reduce((s, k) => s + k.sla_ok_pct, 0) / kpis.length)
        : 0,
  };

  /* Salva snapshot manual */
  const saveSnapshot = useCallback(async (dept?: string) => {
    const { error: err } = await supabase.rpc("save_kpi_snapshot", {
      p_dept_id: dept ?? null,
    });
    if (err) throw new Error(err.message);
    await fetchKpis();
  }, [fetchKpis]);

  return {
    kpis,
    snapshots,
    loading,
    error,
    refetch: fetchKpis,
    getByDept,
    globalSummary,
    saveSnapshot,
  };
}
