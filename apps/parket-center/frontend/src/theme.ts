/** Esquema de cores idêntico ao Command Center (Figma) — dark/light. */

export type ColorScheme = {
  bg: string; card1: string; card2: string; border1: string; border2: string;
  textPrimary: string; textSecondary: string; textTertiary: string;
  accent: string; accentDim: string;
};

export const DARK: ColorScheme = {
  bg: "#050505", card1: "#0B0B0B", card2: "#101010",
  border1: "#1F1F1F", border2: "#2A2A2A",
  textPrimary: "#F4F1EA", textSecondary: "#8D8A84", textTertiary: "#5F5D58",
  accent: "#C8B68A", accentDim: "#B8A06A",
};

export const LIGHT: ColorScheme = {
  bg: "#F6F3EE", card1: "#FFFFFF", card2: "#F1EEE8",
  border1: "#DDD7CC", border2: "#E8E2D8",
  textPrimary: "#111111", textSecondary: "#6D675F", textTertiary: "#9D9790",
  accent: "#8A6F3D", accentDim: "#7A5F2D",
};

export const serif = "'Cormorant Garamond', serif";
export const sans = "'Inter', sans-serif";

export function getStatusStyle(status: string, isDark: boolean) {
  const s = (status || "").toLowerCase();
  if (s.includes("conclu") || s === "aprovado" || s === "disponível" || s === "assinado" ||
      s === "liberado" || s === "liberada" || s === "validada" || s === "contratado") {
    return { bg: isDark ? "rgba(200,182,138,0.09)" : "#FDF8EC", color: isDark ? "#C8B68A" : "#8A6F3D" };
  }
  if (s === "ativo" || s.includes("andamento") || s.includes("execu")) {
    return { bg: isDark ? "rgba(244,241,234,0.05)" : "#F2F0EC", color: isDark ? "#C0BCB4" : "#6A6560" };
  }
  if (s.includes("ressalva") || s.includes("aguardando assinatura")) {
    return { bg: isDark ? "rgba(185,130,42,0.10)" : "#FFF5E0", color: isDark ? "#C8922A" : "#8A6010" };
  }
  if (s.includes("não liberada") || s.includes("travado")) {
    return { bg: isDark ? "rgba(120,50,60,0.10)" : "#FEF0F2", color: isDark ? "#9B4A5A" : "#7A2030" };
  }
  return { bg: isDark ? "rgba(95,93,88,0.10)" : "#EEECEA", color: isDark ? "#5F5D58" : "#9D9790" };
}
