/**
 * useDeptCounts — conta cards do setor em tempo real + atualiza badges
 * da sidebar (Meu Kanban, Alertas, Handoffs).
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Mapa de cada setor → dept_ids do kanban_cards
const DEPT_TO_KANBAN: Record<string, string[]> = {
  comercial:    ["comercial-entrada", "comercial"],
  projetos:     ["projetos"],
  orcamento:    ["orcamento"],
  producao:     ["producao"],
  operacional:  ["obras", "fiscal", "pmo", "atendimento-obras"],
  rh:           ["rh"],
  financeiro:   ["financeiro"],
};

export type DeptCounts = {
  kanban: number;
  alertas: number;
  handoffs: number;
};

export function useDeptCounts(deptKey: string): DeptCounts {
  const [counts, setCounts] = useState<DeptCounts>({ kanban: 0, alertas: 0, handoffs: 0 });
  const kanbans = DEPT_TO_KANBAN[deptKey];

  const reload = async () => {
    if (!kanbans || kanbans.length === 0) return;
    try {
      // Total ativo no kanban — exclui colunas finais (ganho/perda)
      const r = await supabase
        .from("kanban_cards")
        .select("id, column_id, tags", { count: "exact" })
        .in("dept_id", kanbans)
        .not("column_id", "in", "(ganho,perda,cancelado,nao-qualificado,base-lost)");
      if (r.error) return;
      const all = r.data || [];
      const kanban = r.count || all.length;
      // Heurística simples: alertas = cards com tag "alerta" ou stage "atrasado"
      const alertas = all.filter((c: any) =>
        (c.tags || []).some((t: string) => /alerta|atras|urgent|sla/i.test(t))
      ).length;
      // Handoffs: cards em transição (slugs específicos)
      const handoffs = all.filter((c: any) =>
        /handoff|transition|aguarda/i.test(c.column_id || "")
      ).length;
      setCounts({ kanban, alertas, handoffs });
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    if (!kanbans) return;
    reload();
    // Realtime: refresca quando kanban_cards mudar
    const ch = supabase
      .channel(`dept-counts-${deptKey}`)
      .on("postgres_changes" as any,
        { event: "*", schema: "public", table: "kanban_cards" },
        () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptKey]);

  return counts;
}
