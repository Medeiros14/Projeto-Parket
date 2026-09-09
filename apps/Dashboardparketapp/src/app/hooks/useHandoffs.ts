import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ─── Tipos ─── */
export interface Handoff {
  id: string;
  dept_from: string;
  dept_to: string;
  responsavel_from?: string;
  responsavel_to?: string;
  obra?: string;
  obra_id?: string;
  item: string;
  status: "pendente" | "aceito" | "vencido" | "cancelado";
  sla_hours: number;
  aceito_em?: string;
  aceito_por?: string;
  observacao?: string;
  created_at: string;
  updated_at: string;
}

export interface HandoffFlow {
  dept_from: string;
  dept_to: string;
  total: number;
  pendentes: number;
  aceitos: number;
  vencidos: number;
  tem_vencido: boolean;
}

/* ─── Converte para o formato legado usado no dept-layout ─── */
export function toLegacyHandoff(h: Handoff) {
  return {
    id: h.id,
    from: h.dept_from,
    to: h.responsavel_to ? `${h.dept_to} (${h.responsavel_to})` : h.dept_to,
    obra: h.obra ?? "",
    obra_id: h.obra_id,
    status: h.status === "cancelado" ? "vencido" : h.status,
    slaHours: h.sla_hours,
    item: h.item,
  } as const;
}

/* ─── Hook principal ─── */
export function useHandoffs(deptId?: string) {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [flow, setFlow] = useState<HandoffFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHandoffs = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Handoffs filtrados pelo dept se fornecido
    let query = supabase.from("handoffs").select("*").order("created_at", { ascending: false });
    if (deptId) {
      query = query.or(`dept_from.eq.${deptId},dept_to.eq.${deptId}`);
    }

    const [{ data: hData, error: hErr }, { data: fData, error: fErr }] = await Promise.all([
      query,
      supabase.from("handoffs_flow").select("*"),
    ]);

    if (hErr) setError(hErr.message);
    else setHandoffs(hData ?? []);

    if (!fErr) setFlow(fData ?? []);

    setLoading(false);
  }, [deptId]);

  useEffect(() => {
    fetchHandoffs();

    const channel = supabase
      .channel("handoffs_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "handoffs" }, () => {
        fetchHandoffs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchHandoffs]);

  /* ─── Filtros por dept ─── */
  const getByDeptFrom = useCallback((dept: string) =>
    handoffs.filter(h => h.dept_from === dept), [handoffs]);

  const getByDeptTo = useCallback((dept: string) =>
    handoffs.filter(h => h.dept_to === dept), [handoffs]);

  const getByDept = useCallback((dept: string) =>
    handoffs.filter(h => h.dept_from === dept || h.dept_to === dept), [handoffs]);

  /* ─── Counts ─── */
  const counts = {
    total: handoffs.length,
    pendente: handoffs.filter(h => h.status === "pendente").length,
    aceito: handoffs.filter(h => h.status === "aceito").length,
    vencido: handoffs.filter(h => h.status === "vencido").length,
  };

  /* ─── Mutações ─── */
  const aceitarHandoff = useCallback(async (id: string, aceitoPor?: string) => {
    const { error: err } = await supabase.rpc("aceitar_handoff", {
      p_id: id,
      p_aceito_por: aceitoPor ?? null,
    });
    if (err) {
      // fallback: direct update if RPC doesn't exist
      await supabase.from("handoffs").update({ status: "aceito", aceito_em: new Date().toISOString() }).eq("id", id);
    }
    await fetchHandoffs();
  }, [fetchHandoffs]);

  const createHandoff = useCallback(async (h: Omit<Handoff, "id" | "created_at" | "updated_at">) => {
    const { data, error: err } = await supabase
      .from("handoffs")
      .insert(h)
      .select()
      .single();
    if (err) throw new Error(err.message);
    await fetchHandoffs();
    return data as Handoff;
  }, [fetchHandoffs]);

  const updateStatus = useCallback(async (id: string, status: Handoff["status"], obs?: string) => {
    const { error: err } = await supabase
      .from("handoffs")
      .update({ status, ...(obs ? { observacao: obs } : {}) })
      .eq("id", id);
    if (err) throw new Error(err.message);
    await fetchHandoffs();
  }, [fetchHandoffs]);

  /* ─── Formato legado (compatível com dept-layout existente) ─── */
  const legacyHandoffs = handoffs.map(toLegacyHandoff);

  return {
    handoffs,
    legacyHandoffs,
    flow,
    loading,
    error,
    counts,
    refetch: fetchHandoffs,
    getByDept,
    getByDeptFrom,
    getByDeptTo,
    aceitarHandoff,
    createHandoff,
    updateStatus,
  };
}
