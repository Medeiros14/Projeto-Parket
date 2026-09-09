import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface ComprasSaving { id: string; mes: string; saving: number; mercado: number; periodo: string; }
export interface ComprasFornecedor { id: string; nome: string; categoria: string; avaliacao: number; entregas: number; atrasos: number; valor_k: number; ativo: boolean; }
export interface ComprasEstoque { id: string; item: string; qtd: string; minimo: string; status: "ok"|"atencao"|"baixo"|"zerado"; consumo: string; }
export interface ComprasPO { id: string; codigo: string; obra_code: string; fornecedor: string; valor: string; dias: number; status: "novo"|"cotacao"|"no prazo"|"atrasado"|"entregue"; }

export function useCompras() {
  const [saving, setSaving] = useState<ComprasSaving[]>([]);
  const [fornecedores, setFornecedores] = useState<ComprasFornecedor[]>([]);
  const [estoque, setEstoque] = useState<ComprasEstoque[]>([]);
  const [pos, setPOs] = useState<ComprasPO[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: sv }, { data: fn }, { data: es }, { data: po }] = await Promise.all([
      supabase.from("compras_saving").select("*").order("periodo"),
      supabase.from("compras_fornecedores").select("*").eq("ativo", true).order("avaliacao", { ascending: false }),
      supabase.from("compras_estoque").select("*").order("status"),
      supabase.from("compras_pos").select("*").order("created_at", { ascending: false }),
    ]);
    setSaving(sv ?? []);
    setFornecedores(fn ?? []);
    setEstoque(es ?? []);
    setPOs(po ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("compras_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "compras_estoque" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "compras_pos" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const updatePOStatus = async (id: string, status: string) => {
    await supabase.from("compras_pos").update({ status }).eq("id", id);
    fetchAll();
  };

  const criarPO = async (data: { codigo: string; obra_code: string; fornecedor: string; valor: string }) => {
    await supabase.from("compras_pos").insert({ ...data, dias: 0, status: "novo" });
    fetchAll();
  };

  const updateEstoqueQtd = async (id: string, qtd: string) => {
    await supabase.from("compras_estoque").update({ qtd }).eq("id", id);
    fetchAll();
  };

  const estoqueCritico = estoque.filter(e => e.status === "zerado" || e.status === "baixo").length;
  const posAtrasadas = pos.filter(p => p.status === "atrasado").length;

  return { saving, fornecedores, estoque, pos, loading, refetch: fetchAll, estoqueCritico, posAtrasadas, updatePOStatus, criarPO, updateEstoqueQtd };
}
