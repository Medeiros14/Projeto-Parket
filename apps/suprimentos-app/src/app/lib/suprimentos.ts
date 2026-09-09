/** Camada de dados do Suprimentos — tabelas suprimentos_* no Supabase Cloud Parket. */
import { sb } from "./supabase";
import { tbl, rpcProximoTermo } from "./filial";

export type Funcionario = {
  id: string;
  nome: string;
  empresa: string | null;
  cpf: string | null;
  nascimento: string | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
};

export type ItemStatus = "estoque" | "uso" | "manutencao" | "baixado";

export type Item = {
  id: string;
  descricao: string;
  marca: string | null;
  serie: string | null;
  valor: number;
  novo: boolean;
  status: ItemStatus;
  funcionario_id: string | null;
  termo: string | null;
  data_emprestimo: string | null;
  manut_motivo: string | null;
  manut_data: string | null;
  baixa_motivo: string | null;
  baixa_data: string | null;
  created_at: string;
};

export type Movimentacao = {
  id: string;
  data: string;
  tipo: string;
  item_id: string | null;
  item_descricao: string | null;
  item_serie: string | null;
  funcionario_id: string | null;
  funcionario_nome: string | null;
  termo: string | null;
  detalhes: Record<string, unknown> | null;
  usuario: string | null;
};

export const fmtBRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDataHora = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

export const fmtData = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
};

export const diasDesde = (iso: string | null | undefined) => {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};

export async function fetchFuncionarios(): Promise<Funcionario[]> {
  const { data, error } = await sb
    .from(tbl("funcionarios"))
    .select("*")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data as Funcionario[]) || [];
}

/** Inclui inativos — histórico precisa reimprimir termo de quem já saiu. */
export async function fetchFuncionariosTodos(): Promise<Funcionario[]> {
  const { data, error } = await sb.from(tbl("funcionarios")).select("*").order("nome");
  if (error) throw error;
  return (data as Funcionario[]) || [];
}

/** Item como fica congelado dentro do termo (snapshot, não segue edição do item). */
export type TermoItemSalvo = {
  id?: string;
  descricao: string;
  marca: string | null;
  serie: string | null;
  valor: number;
  /** Só em devolução: Nº CONTROLE do empréstimo de origem. */
  termo_origem?: string | null;
};

export type TermoRegistro = {
  id: string;
  numero: string;
  tipo: "emprestimo" | "devolucao";
  funcionario_id: string | null;
  funcionario_nome: string | null;
  itens: TermoItemSalvo[] | null;
  created_at: string;
};

/** Histórico de termos emitidos (empréstimo + devolução) da filial do login. */
export async function fetchTermos(limite = 500): Promise<TermoRegistro[]> {
  const { data, error } = await sb
    .from(tbl("termos"))
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data as TermoRegistro[]) || [];
}

export async function fetchItens(): Promise<Item[]> {
  const { data, error } = await sb
    .from(tbl("itens"))
    .select("*")
    .neq("status", "baixado")
    .order("descricao");
  if (error) throw error;
  return (data as Item[]) || [];
}

export async function logMov(mov: Partial<Movimentacao>) {
  await sb.from(tbl("movimentacoes")).insert(mov);
}

export async function proximoTermo(): Promise<string> {
  const { data, error } = await sb.rpc(rpcProximoTermo());
  if (error) throw error;
  return String(data);
}

export async function emprestarItens(ids: string[], func: Funcionario, termo: string, usuario: string | null) {
  const agora = new Date().toISOString();
  const { data: itens, error: e0 } = await sb.from(tbl("itens")).select("*").in("id", ids);
  if (e0) throw e0;
  const { error } = await sb
    .from(tbl("itens"))
    .update({ status: "uso", funcionario_id: func.id, termo, data_emprestimo: agora, updated_at: agora })
    .in("id", ids)
    .eq("status", "estoque");
  if (error) throw error;
  await sb.from(tbl("termos")).insert({
    numero: termo, tipo: "emprestimo", funcionario_id: func.id, funcionario_nome: func.nome,
    itens: (itens as Item[]).map((i) => ({ id: i.id, descricao: i.descricao, marca: i.marca, serie: i.serie, valor: i.valor })),
  });
  await sb.from(tbl("movimentacoes")).insert(
    (itens as Item[]).map((i) => ({
      tipo: "emprestimo", item_id: i.id, item_descricao: i.descricao, item_serie: i.serie,
      funcionario_id: func.id, funcionario_nome: func.nome, termo, usuario,
    }))
  );
}

/** Grupo pra registrar a devolução como um termo próprio (com Nº CONTROLE novo). */
export type DevolucaoTermoInput = {
  numero: string;
  referenteA: string | null;
  funcionarioId: string | null;
  funcionarioNome: string;
  itensIds: string[];
};

export async function devolverItens(
  itens: Item[], funcNomes: Record<string, string>, usuario: string | null,
  termos?: DevolucaoTermoInput[]
) {
  const agora = new Date().toISOString();
  const { error } = await sb
    .from(tbl("itens"))
    .update({ status: "estoque", funcionario_id: null, termo: null, data_emprestimo: null, updated_at: agora })
    .in("id", itens.map((i) => i.id));
  if (error) throw error;
  await sb.from(tbl("movimentacoes")).insert(
    itens.map((i) => {
      const t = termos?.find((tt) => tt.itensIds.includes(i.id));
      return {
        tipo: "devolucao", item_id: i.id, item_descricao: i.descricao, item_serie: i.serie,
        funcionario_id: i.funcionario_id, funcionario_nome: i.funcionario_id ? funcNomes[i.funcionario_id] || null : null,
        // Movimento traz o Nº CONTROLE da devolução (novo); rastreabilidade fica no suprimentos_termos.
        termo: t?.numero || i.termo, usuario,
      };
    })
  );
  // Rastreabilidade: 1 row em suprimentos_termos por Nº CONTROLE novo da devolução.
  if (termos?.length) {
    const itensById = new Map(itens.map((i) => [i.id, i]));
    await sb.from(tbl("termos")).insert(termos.map((t) => ({
      numero: t.numero, tipo: "devolucao",
      funcionario_id: t.funcionarioId, funcionario_nome: t.funcionarioNome,
      itens: t.itensIds.map((id) => {
        const i = itensById.get(id);
        return i ? { id: i.id, descricao: i.descricao, marca: i.marca, serie: i.serie, valor: i.valor,
                     termo_origem: i.termo || null } : null;
      }).filter(Boolean),
    })));
  }
}

export async function moverParaManutencao(item: Item, motivo: string, funcNome: string | null, usuario: string | null) {
  const agora = new Date().toISOString();
  const { error } = await sb
    .from(tbl("itens"))
    .update({
      status: "manutencao", manut_motivo: motivo, manut_data: agora,
      funcionario_id: null, termo: null, data_emprestimo: null, updated_at: agora,
    })
    .eq("id", item.id);
  if (error) throw error;
  await logMov({
    tipo: "manutencao", item_id: item.id, item_descricao: item.descricao, item_serie: item.serie,
    funcionario_id: item.funcionario_id, funcionario_nome: funcNome, termo: item.termo,
    detalhes: { motivo }, usuario,
  });
}

export async function concluirReparo(itens: Item[], usuario: string | null) {
  const agora = new Date().toISOString();
  const { error } = await sb
    .from(tbl("itens"))
    .update({ status: "estoque", manut_motivo: null, manut_data: null, updated_at: agora })
    .in("id", itens.map((i) => i.id));
  if (error) throw error;
  await sb.from(tbl("movimentacoes")).insert(
    itens.map((i) => ({
      tipo: "reparo_concluido", item_id: i.id, item_descricao: i.descricao, item_serie: i.serie,
      detalhes: { motivo: i.manut_motivo }, usuario,
    }))
  );
}

export async function adicionarFerramenta(
  f: { descricao: string; marca: string; serie: string; valor: number; qtd: number },
  usuario: string | null
) {
  const rows = Array.from({ length: f.qtd }, () => ({
    descricao: f.descricao, marca: f.marca || null, serie: f.serie || null, valor: f.valor, novo: true, status: "estoque" as const,
  }));
  const { data, error } = await sb.from(tbl("itens")).insert(rows).select();
  if (error) throw error;
  await sb.from(tbl("movimentacoes")).insert(
    ((data as Item[]) || []).map((i) => ({
      tipo: "entrada", item_id: i.id, item_descricao: i.descricao, item_serie: i.serie,
      detalhes: { valor: i.valor }, usuario,
    }))
  );
}

export async function darBaixa(item: Item, motivo: string, usuario: string | null) {
  const agora = new Date().toISOString();
  const { error } = await sb
    .from(tbl("itens"))
    .update({ status: "baixado", baixa_motivo: motivo, baixa_data: agora, funcionario_id: null, termo: null, updated_at: agora })
    .eq("id", item.id);
  if (error) throw error;
  await logMov({
    tipo: "baixa", item_id: item.id, item_descricao: item.descricao, item_serie: item.serie,
    detalhes: { motivo, valor: item.valor }, usuario,
  });
}

export async function editarItem(
  id: string,
  patch: { descricao: string; marca: string | null; serie: string | null; valor: number },
  usuario: string | null
) {
  const { error } = await sb
    .from(tbl("itens"))
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await logMov({ tipo: "edicao", item_id: id, item_descricao: patch.descricao, item_serie: patch.serie, usuario });
}

export function exportCSV(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + [header.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
