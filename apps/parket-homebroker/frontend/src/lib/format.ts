export const fmtBRL = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtInt = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

/**
 * Formato compacto pra números grandes (UI de home broker).
 *  - <1.000      → "847"
 *  - 1k-999k     → "1,2 mil" / "847 mil"
 *  - 1M-999M     → "4,3 Mi"  / "120 Mi"
 *  - ≥1B         → "1,2 Bi"
 * Mantém 1 casa decimal quando útil (12.500 → "12,5 mil" mas 12.000 → "12 mil").
 */
function _shortNumber(v: number, suffix: string, divisor: number): string {
  const x = v / divisor;
  // 1 casa decimal só se < 100 e a parte fracionária for relevante (>=0.05)
  const decs = x >= 100 ? 0 : Math.abs(x - Math.round(x)) >= 0.05 ? 1 : 0;
  return x.toLocaleString("pt-BR", { minimumFractionDigits: decs, maximumFractionDigits: decs }) + " " + suffix;
}
export const fmtIntCompact = (n: number | null | undefined): string => {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return sign + _shortNumber(abs, "Bi", 1_000_000_000);
  if (abs >= 1_000_000)     return sign + _shortNumber(abs, "MM", 1_000_000); // notação financeira
  if (abs >= 1_000)         return sign + _shortNumber(abs, "mil", 1_000);
  return sign + fmtInt(abs);
};

/**
 * BRL compacto. R$ 1.234.567 → "R$ 1,2 MM" (notação financeira).
 * Mantém precisão pra valores pequenos.
 */
export const fmtBRLCompact = (n: number | null | undefined): string => {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return sign + "R$ " + _shortNumber(abs, "Bi", 1_000_000_000);
  if (abs >= 1_000_000)     return sign + "R$ " + _shortNumber(abs, "MM", 1_000_000);
  if (abs >= 10_000)        return sign + "R$ " + _shortNumber(abs, "mil", 1_000);
  // <10mil mostra cheio (R$ 8.450, R$ 1.230) pra não perder centavos relevantes
  return fmtBRL(n) || "—";
};

export const fmtPct = (n: number, decs = 1) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: decs, maximumFractionDigits: decs }) + "%";

export const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
};

export const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

export const fmtRelative = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "—";
  const diff = Date.now() - d;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `há ${day}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
};

/** Parseia "R$ 1.234,56" → 1234.56. Útil pra `kanban_cards.value`. */
export const parseValueText = (s: string | null | undefined): number => {
  if (!s) return 0;
  const cleaned = String(s).replace(/[^\d,.-]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > lastDot) return Number(cleaned.replace(/\./g, "").replace(",", "."));
  return Number(cleaned.replace(/,/g, ""));
};

export const initials = (s: string | null | undefined): string => {
  if (!s) return "?";
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
