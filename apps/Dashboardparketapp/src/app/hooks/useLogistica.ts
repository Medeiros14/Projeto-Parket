import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface LogisticaEntrega {
  id: string; obra_code: string; destino: string; motorista: string; eta: string;
  status: "separacao"|"carregando"|"em transito"|"entregue"|"cancelado";
  itens: number; tipo: "proprio"|"terceiro"; data: string;
}

export interface LogisticaFrota {
  id: string; veiculo: string; motorista: string;
  status: "em rota"|"na base"|"manutencao"|"disponivel";
  km: string; manutencao: string;
}

export interface LogisticaOTIF { id: string; mes: string; otif: number; periodo: string; }

export function useLogistica() {
  const [entregas, setEntregas] = useState<LogisticaEntrega[]>([]);
  const [frota, setFrota] = useState<LogisticaFrota[]>([]);
  const [otif, setOTIF] = useState<LogisticaOTIF[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const [{ data: en }, { data: fr }, { data: ot }] = await Promise.all([
      supabase.from("logistica_entregas").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("logistica_frota").select("*").order("created_at"),
      supabase.from("logistica_otif").select("*").order("periodo"),
    ]);
    setEntregas(en ?? []);
    setFrota(fr ?? []);
    setOTIF(ot ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("logistica_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "logistica_entregas" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "logistica_frota" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const updateEntregaStatus = async (id: string, status: string) => {
    await supabase.from("logistica_entregas").update({ status }).eq("id", id);
    fetchAll();
  };

  const criarEntrega = async (data: { obra_code: string; destino: string; motorista: string; eta: string; itens: number; tipo: string }) => {
    await supabase.from("logistica_entregas").insert({ ...data, status: "separacao", data: new Date().toISOString().split("T")[0] });
    fetchAll();
  };

  const updateFrotaStatus = async (id: string, status: string) => {
    await supabase.from("logistica_frota").update({ status }).eq("id", id);
    fetchAll();
  };

  const emTransito = entregas.filter(e => e.status === "em transito").length;
  const frotaEmRota = frota.filter(f => f.status === "em rota").length;
  const otifAtual = otif.length > 0 ? otif[otif.length - 1].otif : 0;

  return { entregas, frota, otif, loading, refetch: fetchAll, emTransito, frotaEmRota, otifAtual, updateEntregaStatus, criarEntrega, updateFrotaStatus };
}
