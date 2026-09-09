import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface DeptActivity {
  id: string;
  dept_id: string;
  text: string;
  type: "action" | "update" | "alert" | "completed";
  user_name?: string;
  obra?: string;
  created_at: string;
}

/* Formato compatível com ActivityItem do dept-layout */
export function toActivityItem(a: DeptActivity) {
  return {
    id: a.id,
    text: a.text,
    type: a.type,
    time: new Date(a.created_at).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    }),
  };
}

export function useAtividades(deptId?: string) {
  const [atividades, setAtividades] = useState<DeptActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAtividades = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("dept_activities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(deptId ? 20 : 100);

    if (deptId) query = query.eq("dept_id", deptId);

    const { data } = await query;
    setAtividades(data ?? []);
    setLoading(false);
  }, [deptId]);

  useEffect(() => {
    fetchAtividades();

    const channel = supabase
      .channel("dept_activities_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dept_activities" }, () => {
        fetchAtividades();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAtividades]);

  const addAtividade = useCallback(async (
    dept_id: string,
    text: string,
    type: DeptActivity["type"],
    obra?: string
  ) => {
    await supabase.from("dept_activities").insert({ dept_id, text, type, obra: obra ?? null });
  }, []);

  const activityItems = atividades.map(toActivityItem);

  return { atividades, activityItems, loading, refetch: fetchAtividades, addAtividade };
}
