export const fmtBRL = (n: number | null | undefined, opts?: { compact?: boolean }) => {
  if (n == null || isNaN(Number(n))) return "—";
  const v = Number(n);
  if (opts?.compact) {
    if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}MM`;
    if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  }
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const fmtNum = (n: number | null | undefined, dec = 0) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = typeof s === "string" ? new Date(s.length === 10 ? s + "T00:00:00" : s) : s;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
};

export const fmtMonth = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
};

export const fmtPct = (n: number | null | undefined, dec = 1) =>
  n == null ? "—" : `${Number(n).toFixed(dec).replace(".", ",")}%`;

export const fmtCNPJ = (s: string | null | undefined) => s ?? "—";

/**
 * Código de obra pra exibir. O código bom é o número da proposta.
 * As obras herdadas da Gestão de Obras antiga do Space vieram com código
 * PKT100xxx, que não significa nada pra ninguém — essas saem sem código.
 */
export const obraCodigo = (codigo: string | null | undefined) =>
  !codigo || /^PKT\d/.test(codigo) ? "" : codigo;

/** "6551184 · CASA FLORAIS" ou só "BRADESCO SALVADOR" quando o código é lixo. */
export const obraLabel = (
  codigo: string | null | undefined,
  nome: string | null | undefined,
  sep = " · ",
) => [obraCodigo(codigo), nome || ""].filter(Boolean).join(sep);

export const colorByStatus: Record<string, { fg: string; bg: string }> = {
  previsto: { fg: "#FCD34D", bg: "#422006" },
  pago: { fg: "#34D399", bg: "#022C22" },
  recebido: { fg: "#34D399", bg: "#022C22" },
  conciliado: { fg: "#60A5FA", bg: "#1E3A8A" },
  cancelado: { fg: "#9CA3AF", bg: "#1F2937" },
  a_pagar: { fg: "#FCD34D", bg: "#422006" },
  atrasado: { fg: "#F87171", bg: "#3F1D1D" },
  em_andamento: { fg: "#60A5FA", bg: "#1E3A8A" },
  concluida: { fg: "#34D399", bg: "#022C22" },
  contratada: { fg: "#A78BFA", bg: "#2E1065" },
  orcamento: { fg: "#9CA3AF", bg: "#1F2937" },
  cancelada: { fg: "#F87171", bg: "#3F1D1D" },
  garantia: { fg: "#FBBF24", bg: "#78350F" },
};
