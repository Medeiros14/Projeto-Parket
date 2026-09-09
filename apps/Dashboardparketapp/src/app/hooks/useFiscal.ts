import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface FiscalVistoria {
  id: string; data_label: string; hora: string; obra_code: string; tipo: string;
  local: string; status: "agendada"|"realizada"|"cancelada"|"sem projeto";
  checklist?: string; data: string;
}

export interface FiscalRelatorio {
  id: string; obra_code: string; tipo: string; data: string;
  ambientes: number; itens_ok: number; itens_total: number;
  status: "rascunho"|"postado"|"aprovado";
}
export interface FiscalChecklist { id: string; item: string; categoria: string; ordem: number; ativo: boolean; }

export function useFiscal() {
  const [vistorias, setVistorias] = useState<FiscalVistoria[]>([]);
  const [relatorios, setRelatorios] = useState<FiscalRelatorio[]>([]);
  const [checklist, setChecklist] = useState<FiscalChecklist[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: vs }, { data: rl }, { data: ck }] = await Promise.all([
      supabase.from("fiscal_vistorias").select("*").order("data"),
      supabase.from("fiscal_relatorios").select("*").order("data", { ascending: false }).limit(10),
      supabase.from("fiscal_checklist").select("*").eq("ativo", true).order("ordem"),
    ]);
    setVistorias(vs ?? []);
    setRelatorios(rl ?? []);
    setChecklist(ck ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("fiscal_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "fiscal_vistorias" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "fiscal_relatorios" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "fiscal_checklist" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const updateVistoriaStatus = async (id: string, status: string) => {
    await supabase.from("fiscal_vistorias").update({ status }).eq("id", id);
    fetchAll();
  };

  const criarVistoria = async (data: { data_label: string; hora: string; obra_code: string; tipo: string; local: string }) => {
    await supabase.from("fiscal_vistorias").insert({ ...data, status: "agendada", data: new Date().toISOString().split("T")[0] });
    fetchAll();
  };

  const toggleChecklistItem = async (id: string, ativo: boolean) => {
    await supabase.from("fiscal_checklist").update({ ativo }).eq("id", id);
    fetchAll();
  };

  const agendadas = vistorias.filter(v => v.status === "agendada").length;
  const bloqueadas = vistorias.filter(v => v.status === "sem projeto").length;

  return { vistorias, relatorios, checklist, loading, refetch: fetchAll, agendadas, bloqueadas, updateVistoriaStatus, criarVistoria, toggleChecklistItem };
}
