/** Format helpers — pt-BR. */
const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlFmtZero = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const m2Fmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const pctFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/**
 * Moeda da simulação ativa (sim.meta.moeda). Quando setada (≠ BRL), TODOS os
 * fmtBRL do app passam a formatar nessa moeda — os valores gravados no banco
 * JÁ estão convertidos (action converter_moeda), aqui é só símbolo/locale.
 * Locale segue o renderer do Space (_pktPropCurrency): USD→en-US, resto pt-BR.
 */
export type MoedaCfg = { codigo: string; taxa_brl?: number | null } | null;
let _moedaCfg: MoedaCfg = null;
let _moedaFmt: Intl.NumberFormat | null = null;
let _moedaFmtZero: Intl.NumberFormat | null = null;

export function localeDaMoeda(codigo: string): string {
  return codigo === "USD" ? "en-US" : "pt-BR";
}

export function setMoedaGlobal(m: MoedaCfg | string | null | undefined) {
  const codigo = (typeof m === "string" ? m : m?.codigo || "").toUpperCase().trim();
  if (!codigo || codigo === "BRL") { _moedaCfg = null; _moedaFmt = null; _moedaFmtZero = null; return; }
  try {
    const locale = localeDaMoeda(codigo);
    _moedaFmt = new Intl.NumberFormat(locale, { style: "currency", currency: codigo });
    _moedaFmtZero = new Intl.NumberFormat(locale, { style: "currency", currency: codigo, maximumFractionDigits: 0 });
    _moedaCfg = typeof m === "string" ? { codigo } : { ...(m as any), codigo };
  } catch {
    _moedaCfg = null; _moedaFmt = null; _moedaFmtZero = null;
  }
}

export const getMoedaGlobal = (): MoedaCfg => _moedaCfg;

export const fmtBRL = (v: number | null | undefined, opts?: { compact?: boolean }) => {
  const n = Number(v ?? 0);
  if (opts?.compact) return (_moedaFmtZero || brlFmtZero).format(n);
  return (_moedaFmt || brlFmt).format(n);
};

/** Formata numa moeda específica (independente da global) — usado no link público /v2/. */
export const fmtMoeda = (v: number | null | undefined, codigo?: string | null) => {
  const cod = (codigo || "BRL").toUpperCase();
  const n = Number(v ?? 0);
  try {
    return new Intl.NumberFormat(localeDaMoeda(cod), { style: "currency", currency: cod }).format(n);
  } catch { return brlFmt.format(n); }
};
export const fmtM2 = (v: number | null | undefined) => `${m2Fmt.format(Number(v ?? 0))} m²`;
export const fmtPct = (v: number | null | undefined) => `${pctFmt.format(Number(v ?? 0))}%`;
export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(dt);
};
export const fmtDateLong = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(dt);
};

export const iniciais = (nome: string | null | undefined) => {
  const s = (nome ?? "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
