/**
 * SO Parket — Design System (mesmos tokens do sistema-op-parket).
 * Segue a especificação canônica: bordas retas, tipografia Cinzel/Inter,
 * paleta walnut/gold, textSecondary comum entre dark/light.
 */
import { useEffect, useState } from "react";

type Mode = "dark" | "light";

const DARK = {
  bg: "#050505",
  sidebarBg: "#040404",
  headerBg: "rgba(4,4,4,0.96)",
  cardBg: "rgba(216,211,199,0.025)",
  cardHover: "rgba(216,211,199,0.048)",
  colBg: "rgba(216,211,199,0.015)",
  border: "rgba(216,211,199,0.08)",
  borderHover: "rgba(216,211,199,0.18)",
  borderStrong: "rgba(216,211,199,0.32)",
  textPrimary: "#D8D3C7",
  textSecondary: "#77736A",
  textMuted: "rgba(119,115,106,0.55)",
  inputBg: "rgba(216,211,199,0.04)",
  statBg: "rgba(216,211,199,0.02)",
  overlay: "rgba(0,0,0,0.72)",
} as const;

const LIGHT = {
  bg: "#D8D3C7",
  sidebarBg: "#CBC6BA",
  headerBg: "rgba(216,211,199,0.96)",
  cardBg: "rgba(243,240,232,0.55)",
  cardHover: "rgba(243,240,232,0.85)",
  colBg: "rgba(243,240,232,0.35)",
  border: "rgba(5,5,5,0.10)",
  borderHover: "rgba(5,5,5,0.24)",
  borderStrong: "rgba(5,5,5,0.38)",
  textPrimary: "#050505",
  textSecondary: "#77736A",
  textMuted: "rgba(5,5,5,0.35)",
  inputBg: "rgba(243,240,232,0.60)",
  statBg: "rgba(243,240,232,0.45)",
  overlay: "rgba(5,5,5,0.55)",
} as const;

export const ACCENT = {
  cream:  "#C8BDB1",
  chai:   "#968473",
  walnut: "#60544D",
  gold:   "#C7A45B",
  green:  "#7AA07A",
  red:    "#B25050",
  amber:  "#C9944A",
  blue:   "#5E7F9E",
} as const;

export const fonts = {
  cinzel: "'Cinzel', serif",
  inter:  "'Inter', system-ui, sans-serif",
} as const;

export function useTheme(): [Mode, (m: Mode) => void, () => void] {
  const [mode, setMode] = useState<Mode>(() => {
    const saved = (localStorage.getItem("parket-contratos-theme") as Mode) || "dark";
    document.documentElement.setAttribute("data-theme", saved);
    return saved;
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem("parket-contratos-theme", mode);
  }, [mode]);
  return [mode, setMode, () => setMode(mode === "dark" ? "light" : "dark")];
}

export function useTokens() {
  const [mode] = useTheme();
  return mode === "dark" ? DARK : LIGHT;
}

// Ícone SVG walnut Parket (marca) — usado no header
export const PARKET_MARK = (color: string) => `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="${color}" stroke-width="1.6">
  <rect x="3" y="3" width="18" height="18" fill="none"/>
  <path d="M3 8 L21 8 M3 14 L21 14 M8 3 L8 21 M15 3 L15 21"/>
</svg>`;

// Mapeia status DocuSign → cor accent
export const STATUS_COLOR: Record<string, string> = {
  rascunho:  ACCENT.chai,
  enviado:   ACCENT.gold,
  parcial:   ACCENT.amber,
  assinado:  ACCENT.green,
  recusado:  ACCENT.red,
  cancelado: ACCENT.walnut,
  expirado:  ACCENT.walnut,
  erro:      ACCENT.red,
};
