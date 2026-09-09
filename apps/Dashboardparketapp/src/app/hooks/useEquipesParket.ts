import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export type EquipeMembro = {
  id: string;
  nome: string;
  telefone: string | null;
  categoria: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type CategoriaResumo = {
  categoria: string;
  total: number;
  membros: EquipeMembro[];
};

const CATEGORIAS_ORDEM = [
  "Estrutura", "Forro/Painel Revestimento", "Acabamento", "Piso", "Escada",
  "Deck", "Marcenaria", "Marcenaria Acabamento", "Brasilia Instalação/Marcenaria",
  "Terceiro Salvador", "Reparo", "Simulação Teste",
];

export function useEquipesParket(filtroCategoria?: string) {
  const [membros, setMembros] = useState<EquipeMembro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from("equipes_parket").select("*").order("categoria").order("nome");
      if (filtroCategoria) query = query.eq("categoria", filtroCategoria);
      const { data, error: err } = await query;
      if (err) throw err;
      setMembros(data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [filtroCategoria]);

  useEffect(() => {
    load();
    const channel = supabase.channel("equipes_parket_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "equipes_parket" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const porCategoria: CategoriaResumo[] = CATEGORIAS_ORDEM
    .map(cat => ({ categoria: cat, total: membros.filter(m => m.categoria === cat && m.ativo).length, membros: membros.filter(m => m.categoria === cat) }))
    .filter(c => c.membros.length > 0);

  const extras = [...new Set(membros.map(m => m.categoria))]
    .filter(c => !CATEGORIAS_ORDEM.includes(c))
    .map(cat => ({ categoria: cat, total: membros.filter(m => m.categoria === cat && m.ativo).length, membros: membros.filter(m => m.categoria === cat) }));

  const todasCategorias = [...porCategoria, ...extras];
  const totalAtivos = membros.filter(m => m.ativo).length;
  const categorias = [...new Set(membros.map(m => m.categoria))];

  async function addMembro(nome: string, telefone: string | null, categoria: string) {
    const { error } = await supabase.from("equipes_parket").insert({ nome, telefone, categoria });
    if (error) throw error;
  }
  async function updateMembro(id: string, changes: Partial<Pick<EquipeMembro, "nome" | "telefone" | "categoria" | "ativo">>) {
    const { error } = await supabase.from("equipes_parket").update(changes).eq("id", id);
    if (error) throw error;
  }
  async function removeMembro(id: string) {
    const { error } = await supabase.from("equipes_parket").delete().eq("id", id);
    if (error) throw error;
  }
  async function toggleAtivo(id: string, ativo: boolean) { return updateMembro(id, { ativo }); }

  return { membros, loading, error, porCategoria: todasCategorias, totalAtivos, categorias, reload: load, addMembro, updateMembro, removeMembro, toggleAtivo, CATEGORIAS_ORDEM };
}
