import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface DeptCounts {
  kanbanCount: number;
  vencidosCount: number;
}

/**
 * Busca, em UMA query, todos os kanban_cards e agrega por dept_id.
 * Retorna mapa { deptId → { kanbanCount, vencidosCount } }.
 */
export function useLiveDeptCounts() {
  const [counts, setCounts] = useState<Record<string, DeptCounts>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("kanban_cards")
        .select("dept_id,sla_status");
      if (cancelled) return;
      if (error || !data) {
        setLoading(false);
        return;
      }
      const agg: Record<string, DeptCounts> = {};
      for (const row of data as { dept_id: string; sla_status?: string }[]) {
        if (!agg[row.dept_id]) agg[row.dept_id] = { kanbanCount: 0, vencidosCount: 0 };
        agg[row.dept_id].kanbanCount += 1;
        if (row.sla_status === "expired") agg[row.dept_id].vencidosCount += 1;
      }
      setCounts(agg);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { counts, loading };
}
