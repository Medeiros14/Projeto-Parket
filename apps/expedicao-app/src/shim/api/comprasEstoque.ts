import { supabase } from "./helpers";

export type ComprasSaldo = {
  codigo: string;
  descricao: string;
  unidade: string | null;
  saldo: number;
};

// Saldo agregado do estoque do ERP Compras (compras_estoque_mov, todos os depósitos).
export async function fetchComprasSaldos(): Promise<ComprasSaldo[]> {
  const porCodigo = new Map<string, ComprasSaldo>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("compras_estoque_mov")
      .select("produto_codigo,descricao,tipo,quantidade,unidade")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const m of data ?? []) {
      const key = (m.produto_codigo || m.descricao || "").trim().toUpperCase();
      if (!key) continue;
      const cur = porCodigo.get(key) ?? {
        codigo: m.produto_codigo ?? "",
        descricao: m.descricao ?? "",
        unidade: m.unidade ?? null,
        saldo: 0,
      };
      cur.saldo += (m.tipo === "Entrada" ? 1 : -1) * (Number(m.quantidade) || 0);
      porCodigo.set(key, cur);
    }
    if (!data || data.length < PAGE) break;
  }
  return Array.from(porCodigo.values());
}

// Match por código exato ou descrição (contém, case-insensitive).
export function matchSaldo(saldos: ComprasSaldo[], code: string, name: string): ComprasSaldo | null {
  const c = code.trim().toUpperCase();
  const n = name.trim().toUpperCase();
  return (
    saldos.find((s) => s.codigo.toUpperCase() === c) ??
    saldos.find((s) => n && s.descricao.toUpperCase() === n) ??
    saldos.find((s) => n.length >= 6 && s.descricao.toUpperCase().includes(n)) ??
    null
  );
}
