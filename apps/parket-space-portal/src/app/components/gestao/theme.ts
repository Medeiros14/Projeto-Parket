export type ThemeMode = "dark" | "light";

export interface ThemeTokens {
  bg: string;
  sidebarBg: string;
  headerBg: string;
  cardBg: string;
  cardHover: string;
  border: string;
  borderHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  inputBg: string;
  statBg: string;
}

export const dark: ThemeTokens = {
  bg: "#050505",
  sidebarBg: "#040404",
  headerBg: "rgba(4,4,4,0.96)",
  cardBg: "rgba(216,211,199,0.025)",
  cardHover: "rgba(216,211,199,0.048)",
  border: "rgba(216,211,199,0.08)",
  borderHover: "rgba(216,211,199,0.18)",
  textPrimary: "#D8D3C7",
  textSecondary: "#77736A",
  textMuted: "rgba(119,115,106,0.45)",
  inputBg: "rgba(216,211,199,0.04)",
  statBg: "rgba(216,211,199,0.02)",
};

// Modo claro segue o Manual de Marca Navona:
// Bege Travertino #D8D3C7 · Off White Mineral #F3F0E8 · Preto Navona #050505 · Cinza Pedra #77736A
export const light: ThemeTokens = {
  bg: "#D8D3C7",                          // Bege Travertino — fundo principal da marca
  sidebarBg: "#CBC6BA",                   // Bege ligeiramente mais profundo para hierarquia
  headerBg: "rgba(216,211,199,0.96)",     // Bege Travertino com blur
  cardBg: "rgba(243,240,232,0.55)",       // Off White Mineral semi-transparente
  cardHover: "rgba(243,240,232,0.85)",    // Off White Mineral mais opaco no hover
  border: "rgba(5,5,5,0.1)",             // Preto Navona diluído
  borderHover: "rgba(5,5,5,0.24)",       // Preto Navona mais presente
  textPrimary: "#050505",                 // Preto Navona
  textSecondary: "#77736A",              // Cinza Pedra
  textMuted: "rgba(5,5,5,0.35)",         // Preto Navona diluído
  inputBg: "rgba(243,240,232,0.6)",      // Off White Mineral
  statBg: "rgba(243,240,232,0.45)",      // Off White Mineral
};

export function getTheme(mode: ThemeMode): ThemeTokens {
  return mode === "dark" ? dark : light;
}
