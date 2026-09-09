import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";

export type FiscalRef = { id: string; nome: string };
export type EquipeRef = { id: string; nome: string };
export type CardRef = { id: string; title: string; obra: string | null; dept_id: string | null };

type Catalogos = {
  loading: boolean;
  fiscais: FiscalRef[];
  equipes: EquipeRef[];
  cards: CardRef[];
};

let cache: Catalogos | null = null;
const subs: Array<(c: Catalogos) => void> = [];

async function fetchAll(): Promise<Catalogos> {
  const [f, e, c] = await Promise.all([
    sb.from("fiscal_equipe").select("id,nome").eq("ativo", true).order("nome"),
    sb.from("equipes_parket").select("id,nome").eq("ativo", true).order("nome"),
    sb.from("kanban_cards").select("id,title,obra,dept_id").eq("dept_id", "operacional").order("title").limit(2000),
  ]);
  return {
    loading: false,
    fiscais: (f.data || []) as FiscalRef[],
    equipes: (e.data || []) as EquipeRef[],
    cards: (c.data || []) as CardRef[],
  };
}

export function useCatalogos(): Catalogos {
  const [cat, setCat] = useState<Catalogos>(() => cache ?? { loading: true, fiscais: [], equipes: [], cards: [] });

  useEffect(() => {
    if (cache) return;
    let active = true;
    (async () => {
      const data = await fetchAll();
      cache = data;
      if (active) {
        setCat(data);
        subs.forEach((s) => s(data));
      }
    })();
    const sub = (c: Catalogos) => active && setCat(c);
    subs.push(sub);
    return () => {
      active = false;
      const i = subs.indexOf(sub);
      if (i >= 0) subs.splice(i, 1);
    };
  }, []);

  return cat;
}
