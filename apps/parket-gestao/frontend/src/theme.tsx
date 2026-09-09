/**
 * Design tokens 1:1 com o Sistema Operacional Parket zip
 * (/root/sistema-op-parket/src/app/components/gestao/theme.ts).
 *
 * Dark (Preto Navona bg · Bege Travertino text)
 * Light (Bege Travertino bg · Preto Navona text — Manual da Marca Navona)
 *
 * IMPORTANTE: state é global via Context — chamar useTheme()/useTokens() em N
 * componentes retorna o MESMO mode (bug corrigido de 2 renderizações desconexas).
 */
import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";

export type ThemeMode = "dark" | "light";

/* ─── Tokens SO Parket ─────────────────────────────────────────────── */

// Nomes canônicos (SO Parket): bg, sidebarBg, headerBg, cardBg, cardHover,
// border, borderHover, textPrimary, textSecondary, textMuted, inputBg, statBg
// + aliases compatíveis com o código atual (card1, card2, border1, border2, textTertiary).

const DARK_BASE = {
  bg:            "#050505",
  sidebarBg:     "#040404",
  headerBg:      "rgba(4,4,4,0.96)",
  cardBg:        "rgba(216,211,199,0.025)",
  cardHover:     "rgba(216,211,199,0.048)",
  border:        "rgba(216,211,199,0.08)",
  borderHover:   "rgba(216,211,199,0.18)",
  textPrimary:   "#D8D3C7",
  textSecondary: "#77736A",
  textMuted:     "rgba(119,115,106,0.45)",
  inputBg:       "rgba(216,211,199,0.04)",
  statBg:        "rgba(216,211,199,0.02)",
  // Fundo de painel de modal: OPACO de proposito. cardBg/cardHover sao
  // translucidos (dao profundidade de card sobre card), mas em cima do
  // overlay escuro do modal o conteudo fica ilegivel. Modal usa este.
  modalBg:       "#0E0E0D",
  // Accents Parket
  accent:        "#968473",  // Chai — "estado ativo, badge" (SO Parket)
  accentDim:     "#60544D",  // Walnut
  overlay:       "rgba(0,0,0,0.72)",
} as const;

const LIGHT_BASE = {
  bg:            "#D8D3C7",                 // Bege Travertino
  sidebarBg:     "#CBC6BA",                 // Bege mais profundo
  headerBg:      "rgba(216,211,199,0.96)",  // Travertino @ 96%
  cardBg:        "rgba(243,240,232,0.55)",  // Off White Mineral @ 55%
  cardHover:     "rgba(243,240,232,0.85)",  // Off White Mineral @ 85%
  border:        "rgba(5,5,5,0.10)",        // Preto Navona diluído
  borderHover:   "rgba(5,5,5,0.24)",
  textPrimary:   "#050505",                 // Preto Navona
  textSecondary: "#77736A",                 // Cinza Pedra (comum)
  textMuted:     "rgba(5,5,5,0.35)",
  inputBg:       "rgba(243,240,232,0.60)",
  statBg:        "rgba(243,240,232,0.45)",
  // Off White Mineral cheio, sem alpha: e o que torna o modal legivel no claro
  modalBg:       "#F3F0E8",
  accent:        "#968473",                 // Chai — mesmo do dark
  accentDim:     "#60544D",                 // Walnut
  overlay:       "rgba(5,5,5,0.55)",
} as const;

// Aliases pra compat com nomes usados nos componentes existentes.
export const DARK = {
  ...DARK_BASE,
  card1:        DARK_BASE.cardBg,
  card2:        DARK_BASE.cardHover,
  border1:      DARK_BASE.border,
  border2:      DARK_BASE.borderHover,
  textTertiary: DARK_BASE.textMuted,
} as const;

export const LIGHT = {
  ...LIGHT_BASE,
  card1:        LIGHT_BASE.cardBg,
  card2:        LIGHT_BASE.cardHover,
  border1:      LIGHT_BASE.border,
  border2:      LIGHT_BASE.borderHover,
  textTertiary: LIGHT_BASE.textMuted,
} as const;

/* ─── Context / Provider ───────────────────────────────────────────── */

type Ctx = {
  mode: ThemeMode;
  set: (m: ThemeMode) => void;
  toggle: () => void;
  t: typeof DARK;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("gestao-theme") as ThemeMode | null;
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    try { localStorage.setItem("gestao-theme", mode); } catch { /* noop */ }
  }, [mode]);

  const value = useMemo<Ctx>(() => ({
    mode,
    set: setMode,
    toggle: () => setMode((m) => (m === "dark" ? "light" : "dark")),
    t: (mode === "light" ? LIGHT : DARK) as typeof DARK,
  }), [mode]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

/** Retorna [mode, set, toggle]. State é global via Context — muda no App reflete em todos. */
export function useTheme(): [ThemeMode, (m: ThemeMode) => void, () => void] {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useTheme fora do <ThemeProvider>");
  return [c.mode, c.set, c.toggle];
}

/** Tokens do tema atual (reage a mudança global). */
export function useTokens(): typeof DARK {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useTokens fora do <ThemeProvider>");
  return c.t;
}

/** @deprecated Preferir useTokens(). Deixado como fallback pra código antigo. */
export const T = DARK;

/* ─── Fontes / cores fixas ─────────────────────────────────────────── */
export const fonts = {
  cinzel: "'Cinzel', 'Georgia', serif",
  inter:  "'Inter', -apple-system, sans-serif",
} as const;

export const statusColor: Record<string, string> = {
  pendente:      "#77736A",
  em_andamento:  "#C7A45B",
  em_execucao:   "#C7A45B",
  preparando:    "#8CA9B8",
  concluida:     "#7BA394",
  entregue:      "#7BA394",
  instalado:     "#7BA394",
  com_ressalva:  "#B85B4C",
  cancelado:     "#5F5D58",
  novo:          "#8CA9B8",
  ativo:         "#7BA394",
};

export const stageCategoryColor: Record<string, string> = {
  LIBERACAO:   "#8CA9B8",
  VISTORIA:    "#B85B4C",
  PROJETO:     "#A98BC7",
  PRAZOS:      "#C7A45B",
  EXECUTIVO:   "#7BA394",
  EXECUCAO:    "#C8B68A",
  FINALIZACAO: "#8B6F47",
  CLIENTE:     "#B8A06A",
};
