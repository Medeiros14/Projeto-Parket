/** Helpers compartilhados do módulo ERP (estoque / financeiro / relatórios). */
import { sb } from "./supabase";

export const fmtBRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtQtd = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export const fmtData = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const hojeISO = () => new Date().toISOString().slice(0, 10);

export type Movimento = {
  id: string;
  data: string;
  produto_codigo: string | null;
  descricao: string;
  tipo: "Entrada" | "Saída";
  quantidade: number;
  unidade: string | null;
  valor_unitario: number;
  valor_total: number;
  documento: string | null;
  fornecedor: string | null;
  projeto: string | null;
  deposito: "marcenaria" | "instalacao" | "marcenaria-curitiba";
  created_at: string;
};

export type Produto = { id: string; codigo: string; descricao: string; unidade: string | null; ativo: boolean; categoria?: "MATERIA_PRIMA" | "FERRAGEM" | "EMBALAGEM" | null };

/** Mesma regra do compras-contratos-watcher (tipo_insumo): fallback por palavra-chave. */
const KW_FERRAGEM = ["PIVÔ", "PIVO", "FECHADURA", "PUXADOR", "IMÃ", "IMA ", "TRANQUETA",
  "ADAPTADOR", "DOBRADIÇA", "DOBRADICA", "ROLDANA", "KIT "];
const KW_EMBALAGEM = ["CAIXA", "CAIXAS", "PAPELÃO", "PAPELAO", "SACO ", "SACOS", "SACOLA",
  "PLÁSTICO BOLHA", "PLASTICO BOLHA", "BOLHA", "FILME STRETCH", "STRETCH", "FILM ",
  "FITA ADESIVA", "FITA CREPE", "FITA EMBAL", "ETIQUETA", "LACRE", "PALLET",
  "PALETE", "STRAP", "STROP", "TIRA PLASTICA", "EMBALAGEM"];
export function categoriaInsumo(descricao: string): "MATERIA_PRIMA" | "FERRAGEM" | "EMBALAGEM" {
  const up = (descricao || "").trim().toUpperCase();
  if (KW_EMBALAGEM.some((k) => up.includes(k))) return "EMBALAGEM";
  if (KW_FERRAGEM.some((k) => up.includes(k))) return "FERRAGEM";
  return "MATERIA_PRIMA";
}

export async function fetchProdutos(): Promise<Produto[]> {
  const { data } = await sb.from("compras_produtos").select("*").eq("ativo", true).order("descricao");
  return (data as unknown as Produto[]) || [];
}

/** Garante produto cadastrado (match por descrição exata, case-insensitive) e retorna o código PRD-xxxx.
 *  `categoriaOverride` sobrescreve a classificação automática (usar quando o usuário escolheu na UI). */
export async function ensureProduto(
  descricao: string, unidade: string, cache: Produto[],
  categoriaOverride?: "MATERIA_PRIMA" | "FERRAGEM" | "EMBALAGEM" | null
): Promise<string> {
  const desc = descricao.trim().toUpperCase();
  const hit = cache.find((p) => p.descricao.trim().toUpperCase() === desc);
  if (hit) return hit.codigo;

  const { data: max } = await sb
    .from("compras_produtos").select("codigo")
    .like("codigo", "PRD-%").order("codigo", { ascending: false }).limit(1);
  const ultimo = (max as any[])?.[0]?.codigo ? parseInt(String((max as any[])[0].codigo).replace("PRD-", ""), 10) || 0 : 0;
  const codigo = `PRD-${String(ultimo + 1).padStart(4, "0")}`;

  const { data: novo, error } = await sb
    .from("compras_produtos")
    .insert({ codigo, descricao: desc, unidade: unidade || "UN", ativo: true,
              categoria: categoriaOverride || categoriaInsumo(desc) })
    .select().single();
  if (error) {
    // corrida: outro usuário criou o mesmo código — tenta achar por descrição
    const { data: retry } = await sb.from("compras_produtos").select("*").ilike("descricao", desc).limit(1);
    if (retry?.[0]) { cache.push(retry[0] as unknown as Produto); return (retry[0] as any).codigo; }
    throw new Error("Falha ao cadastrar produto: " + error.message);
  }
  cache.push(novo as unknown as Produto);
  return codigo;
}

/** Lista de projetos pra datalist: banco de obras + distintos dos movimentos + cards de compras. */
export async function fetchProjetos(): Promise<string[]> {
  const set = new Set<string>();
  const { data: obras } = await sb.from("obras").select("cliente").not("cliente", "is", null).limit(2000);
  (obras || []).forEach((r: any) => r.cliente && set.add(r.cliente));
  const { data: movs } = await sb.from("compras_estoque_mov").select("projeto").not("projeto", "is", null).limit(1000);
  (movs || []).forEach((r: any) => r.projeto && set.add(r.projeto));
  const { data: cards } = await sb
    .from("kanban_cards").select("details")
    .in("dept_id", ["compras", "compras-taiara", "compras-marco"]).limit(500);
  (cards || []).forEach((r: any) => {
    const p = r?.details?.projeto_nome;
    if (p && typeof p === "string") set.add(p);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Próximo protocolo de saída: SAI-000123 (sequencial global). */
export async function proximoProtocolo(): Promise<string> {
  const { data } = await sb
    .from("compras_saidas").select("protocolo")
    .like("protocolo", "SAI-%").order("protocolo", { ascending: false }).limit(1);
  const ultimo = (data as any[])?.[0]?.protocolo ? parseInt(String((data as any[])[0].protocolo).replace("SAI-", ""), 10) || 0 : 0;
  return `SAI-${String(ultimo + 1).padStart(6, "0")}`;
}

/** Abre janela de impressão com HTML formatado (identidade Parket, P&B pra papel). */
export function printHtml(titulo: string, corpoHtml: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { alert("Popup bloqueado — libere popups para imprimir."); return; }
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; margin: 28px; }
    h1 { font-size: 17px; letter-spacing: .12em; text-transform: uppercase; border-bottom: 2px solid #111; padding-bottom: 8px; }
    h2 { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; margin: 18px 0 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid #111; padding: 5px 6px; }
    td { font-size: 11px; border-bottom: 1px solid #ddd; padding: 5px 6px; }
    .meta { font-size: 11px; margin: 2px 0; }
    .tot { font-weight: 700; }
    .assin { margin-top: 48px; display: flex; gap: 40px; }
    .assin div { flex: 1; border-top: 1px solid #111; padding-top: 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; text-align: center; }
    @media print { body { margin: 10mm; } }
  </style></head><body>
  <h1>PARKET · ${titulo}</h1>
  ${corpoHtml}
  <script>window.onload = () => { window.print(); };<\/script>
  </body></html>`);
  w.document.close();
}
