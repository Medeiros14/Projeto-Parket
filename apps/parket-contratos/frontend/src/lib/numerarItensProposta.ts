/**
 * Aplica a MESMA lógica hierárquica da RPC gestao.projetar_de_proposta —
 * consolida as 3 linhas por ambiente (PRODUTO + INSUMOS + INSTALAÇÃO) da
 * public.simulacao_itens em 1 item hierárquico "N.M".
 *
 * Espelha o renderer propostaRendererSpace35.js:
 *   - Raiz N = categoria encoded (PISO||especie||dim)
 *   - Sub M  = ambiente dentro da raiz (bloco de 10 na ordem)
 *
 * Extrai também metragem_real, metragem_com_perda, perda_pct do descritivo.
 */
export type SimulacaoItemRaw = {
  id: string;
  categoria: string;      // encoded ex "PISO||CARVALHO EUROPEU NATURALLE||15/3 × 12.5 × 120cm"
  descritivo: string;
  valor: number;
  ordem: number;
};

export type ItemHierarquico = {
  simulacao_item_id: string | null;
  codigo: string;              // "1.1", "1.2", "2.1"
  raiz: string;                // "1", "2"
  sub: number;                 // 1, 2, 3...
  categoria_raiz: string;      // "PISO"
  produto_header: string;      // "CARVALHO EUROPEU NATURALLE · 15/3 × 12.5 × 120cm"
  ambiente: string;
  descritivo: string;
  metragem_real: number | null;
  metragem_com_perda: number | null;
  perda_pct: number | null;
  valor_produto: number;
  valor_insumos: number;
  valor_instalacao: number;
  valor_total: number;
  categoria_encoded: string;
};

function parseNumBR(s: string | null | undefined): number | null {
  if (s === null || s === undefined || s === "") return null;
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function extraiMetragens(desc: string) {
  if (!desc) return { real: null, comPerda: null, perdaPct: null } as const;
  const real   = desc.match(/Metragem\s+real\s+([\d.,]+)\s*m/i)?.[1] ?? null;
  const perda  = desc.match(/\+\s*([\d.,]+)\s*%/i)?.[1] ?? null;
  const total  = desc.match(/=\s*([\d.,]+)\s*m/i)?.[1] ?? null;
  return {
    real:     parseNumBR(real),
    comPerda: parseNumBR(total),
    perdaPct: parseNumBR(perda),
  };
}

function tipoLinha(desc: string): "produto" | "insumos" | "instalacao" {
  const u = (desc || "").toUpperCase();
  if (/^\s*INSUMOS\b/.test(u)) return "insumos";
  if (/^\s*INSTALA[ÇC][AÃ]O\s+E\s+GEST/.test(u) || /^\s*INSTALA[ÇC][AÃ]O\b/.test(u)) return "instalacao";
  return "produto";
}

/** Pega só o "ambiente" — 1ª linha do descritivo, sem prefixos INSUMOS/INSTALAÇÃO. */
function extraiAmbiente(desc: string): string {
  if (!desc) return "";
  const linha0 = desc.split("\n")[0].trim();
  // Remove sufixos tipo "Forro ripado com espaçamento..." — pega até primeira lowercase word
  const m = linha0.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s\-.]+?)(?:\s+[a-záéíóúãõâêôç]|$)/);
  return (m?.[1] || linha0).trim();
}

/** Header do produto = espécie + dim vindas da categoria encoded. */
function extraiProdutoHeader(catEncoded: string): { categoriaRaiz: string; produto: string } {
  const parts = catEncoded.split("||");
  const categoriaRaiz = parts[0] || "";
  const esp = (parts[1] || "").trim();
  const dim = (parts[2] || "").trim();
  const produto = esp && dim ? `${esp} · ${dim}` : esp || dim;
  return { categoriaRaiz, produto };
}

export function numerarItensProposta(rows: SimulacaoItemRaw[]): ItemHierarquico[] {
  if (!rows || rows.length === 0) return [];

  // 1. Agrupa por (categoria, bloco de 10 na ordem = ambiente)
  const buckets = new Map<string, {
    cat: string;
    bloco: number;
    ordemMin: number;
    linhas: SimulacaoItemRaw[];
  }>();
  for (const r of rows) {
    const bloco = Math.floor(r.ordem / 10);
    const key = `${r.categoria}::${bloco}`;
    const b = buckets.get(key) || { cat: r.categoria, bloco, ordemMin: r.ordem, linhas: [] };
    b.ordemMin = Math.min(b.ordemMin, r.ordem);
    b.linhas.push(r);
    buckets.set(key, b);
  }

  // 2. Raízes = categorias distintas, ordenadas pela menor ordem de aparição
  const catFirstOrdem = new Map<string, number>();
  for (const b of buckets.values()) {
    const cur = catFirstOrdem.get(b.cat);
    if (cur === undefined || b.ordemMin < cur) catFirstOrdem.set(b.cat, b.ordemMin);
  }
  const raizes = Array.from(catFirstOrdem.entries())
    .sort(([, a], [, b]) => a - b)
    .map(([cat], i) => [cat, String(i + 1)] as const);
  const raizByCat = new Map(raizes);

  // 3. Consolida cada bucket em 1 item
  const consolidados: ItemHierarquico[] = [];
  const catBucketsOrd = new Map<string, typeof buckets extends Map<any, infer V> ? V[] : never>();
  for (const b of buckets.values()) {
    const arr = catBucketsOrd.get(b.cat) || [];
    arr.push(b);
    catBucketsOrd.set(b.cat, arr);
  }
  for (const [cat, arr] of catBucketsOrd) {
    arr.sort((a, b) => a.ordemMin - b.ordemMin);
    const raiz = raizByCat.get(cat) || "?";
    const { categoriaRaiz, produto } = extraiProdutoHeader(cat);
    arr.forEach((bucket, idx) => {
      const sub = idx + 1;
      const produtoRow = bucket.linhas.find(l => tipoLinha(l.descritivo) === "produto");
      const insumosRow = bucket.linhas.find(l => tipoLinha(l.descritivo) === "insumos");
      const instalRow  = bucket.linhas.find(l => tipoLinha(l.descritivo) === "instalacao");
      const descBase = produtoRow?.descritivo || instalRow?.descritivo || "(item)";
      const metragens = extraiMetragens(instalRow?.descritivo || produtoRow?.descritivo || "");
      const ambiente = extraiAmbiente(produtoRow?.descritivo || instalRow?.descritivo || "");
      consolidados.push({
        simulacao_item_id: produtoRow?.id ?? null,
        codigo: `${raiz}.${sub}`,
        raiz,
        sub,
        categoria_raiz: categoriaRaiz,
        produto_header: produto,
        ambiente,
        descritivo: descBase,
        metragem_real: metragens.real,
        metragem_com_perda: metragens.comPerda,
        perda_pct: metragens.perdaPct,
        valor_produto:    Number(produtoRow?.valor || 0),
        valor_insumos:    Number(insumosRow?.valor || 0),
        valor_instalacao: Number(instalRow?.valor || 0),
        valor_total:      Number(produtoRow?.valor || 0) + Number(insumosRow?.valor || 0) + Number(instalRow?.valor || 0),
        categoria_encoded: cat,
      });
    });
  }

  return consolidados.sort((a, b) => {
    const [ra, sa] = a.codigo.split(".").map(Number);
    const [rb, sb] = b.codigo.split(".").map(Number);
    return ra - rb || sa - sb;
  });
}
