/**
 * Theme Parket — tokens aplicados em todo o app.
 * Segue o Sistema Operacional Parket (4 cores institucionais).
 * Preto Navona #050505 · Bege Travertino #D8D3C7 · Off White Mineral #F3F0E8 · Cinza Pedra #77736A
 * Tipografia: Cinzel (títulos/logotipo) + Inter (corpo).
 */
export type ThemeMode = "dark" | "light";

export interface ThemeTokens {
  bg: string;
  bgElevated: string;
  sidebarBg: string;
  headerBg: string;
  cardBg: string;
  cardHover: string;
  /** Fundo SÓLIDO pra modais — não pode ser translúcido senão vaza o conteúdo de baixo. */
  modalBg: string;
  /** Overlay escuro do backdrop de modal (cobertura forte pra ofuscar UI atrás). */
  modalOverlay: string;
  border: string;
  borderHover: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  inputBg: string;
  statBg: string;
  accent: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

// Tokens 1:1 com /root/sistema-op-parket/src/app/components/gestao/theme.ts
// (fonte canônica do Sistema Operacional Parket).
export const dark: ThemeTokens = {
  bg:           "#050505",                      // Preto Navona
  bgElevated:   "#0e0e0e",
  sidebarBg:    "#040404",                      // SO Parket sidebarBg
  headerBg:     "rgba(4,4,4,0.96)",             // SO Parket headerBg + backdrop-blur
  cardBg:       "rgba(216,211,199,0.025)",      // Travertino @ 2.5%
  cardHover:    "rgba(216,211,199,0.048)",      // Travertino @ 4.8%
  modalBg:      "#0e0e0e",
  modalOverlay: "rgba(0,0,0,0.72)",
  border:       "rgba(216,211,199,0.08)",
  borderHover:  "rgba(216,211,199,0.18)",
  borderStrong: "rgba(216,211,199,0.32)",
  textPrimary:  "#D8D3C7",                      // Bege Travertino
  textSecondary:"#77736A",                      // Cinza Pedra
  textMuted:    "rgba(119,115,106,0.45)",       // Cinza Pedra @ 45%
  inputBg:      "rgba(216,211,199,0.04)",
  statBg:       "rgba(216,211,199,0.02)",
  accent:       "#D8D3C7",
  accentSoft:   "rgba(216,211,199,0.14)",
  success:      "#7AA07A",                      // Olive-suave (paleta acentos Parket)
  warning:      "#C9944A",                      // Amber-Shadow
  danger:       "#B25050",                      // Walnut-red
  info:         "#5E7F9E",                      // Morning Blue
};

// Modo claro — Manual de Marca Navona.
// Bege Travertino #D8D3C7 é o fundo principal (não Off White Mineral).
export const light: ThemeTokens = {
  bg:           "#D8D3C7",                      // Bege Travertino — fundo principal da marca
  bgElevated:   "#F3F0E8",                      // Off White Mineral — elevações
  sidebarBg:    "#CBC6BA",                      // Bege ligeiramente mais profundo
  headerBg:     "rgba(216,211,199,0.96)",       // Travertino @ 96% + backdrop-blur
  cardBg:       "rgba(243,240,232,0.55)",       // Mineral @ 55%
  cardHover:    "rgba(243,240,232,0.85)",       // Mineral @ 85%
  modalBg:      "#F3F0E8",
  modalOverlay: "rgba(5,5,5,0.55)",
  border:       "rgba(5,5,5,0.10)",
  borderHover:  "rgba(5,5,5,0.24)",
  borderStrong: "rgba(5,5,5,0.38)",
  textPrimary:  "#050505",                      // Preto Navona
  textSecondary:"#77736A",                      // Cinza Pedra (comum entre dark/light)
  textMuted:    "rgba(5,5,5,0.35)",
  inputBg:      "rgba(243,240,232,0.60)",
  statBg:       "rgba(243,240,232,0.45)",
  accent:       "#050505",
  accentSoft:   "rgba(5,5,5,0.08)",
  success:      "#5D8A5D",                      // verde escurecido pra contraste em bege
  warning:      "#9E7238",                      // amber escurecido
  danger:       "#8E3D3D",                      // walnut-red escurecido
  info:         "#455763",                      // Navy
};

export function getTheme(mode: ThemeMode): ThemeTokens {
  return mode === "dark" ? dark : light;
}

// ─── Compras: 3 responsáveis, cada um com seu dept_id/colunas ─────────────
// IDs/labels/cores espelham 1:1 o sistema-ops-data do Space golden — os dois
// sistemas leem/escrevem os MESMOS kanban_cards, então nada aqui pode divergir.

export type DeptCompras = "compras" | "compras-taiara" | "compras-marco";

export const RESPONSAVEIS_COMPRAS: { dept: DeptCompras; nome: string; sub: string; cor: string; iniciais: string }[] = [
  { dept: "compras",        nome: "Ronaldo",       sub: "Marcenaria / Lalamove", cor: "#3B82F6", iniciais: "RO" },
  { dept: "compras-taiara", nome: "Taiara",        sub: "Instalação",            cor: "#14B8A6", iniciais: "TA" },
  { dept: "compras-marco",  nome: "Marco Antônio", sub: "Amostras",              cor: "#8B5CF6", iniciais: "MA" },
];

export type ColunaKanban = { id: string; label: string; cor: string; slaHours?: number };

export const COLUNAS_COMPRAS: Record<DeptCompras, ColunaKanban[]> = {
  "compras": [
    { id: "entrada",               label: "Solicitações",                                  cor: "#6B7280" },
    { id: "cotacao",               label: "Em Cotação",                                    cor: "#3B82F6" },
    { id: "aguarda-aprovacao",     label: "Aguardando Liberação de Pagto ou Faturamento",  cor: "#F59E0B", slaHours: 24 },
    { id: "pedido",                label: "Liberação ao Fornecedor",                       cor: "#8B5CF6", slaHours: 2 },
    { id: "em-transito",           label: "Pedido em Rota de Entrega",                     cor: "#14B8A6", slaHours: 24 },
    { id: "recebido-e-conferido",  label: "Recebido e Conferido",                          cor: "#F97316" },
    { id: "concluido",             label: "Finalizado",                                    cor: "#10B981" },
  ],
  "compras-taiara": [
    { id: "entrada",               label: "Entrada de Demandas",       cor: "#6B7280" },
    { id: "cotacao",               label: "Cotação e Priorização",     cor: "#3B82F6" },
    { id: "aguarda-aprovacao",     label: "Aguardando Liberação de Pagto ou Faturamento", cor: "#F59E0B", slaHours: 24 },
    { id: "emissao-pedido",        label: "Emissão do Pedido",         cor: "#8B5CF6", slaHours: 2 },
    { id: "em-transito",           label: "Logística e Acompanhamento", cor: "#14B8A6", slaHours: 24 },
    { id: "recebimento-auditoria", label: "Recebimento e Conferência", cor: "#F97316" },
    { id: "concluido",             label: "Finalizado",                cor: "#10B981" },
    { id: "amostras",              label: "Amostras em Execução",      cor: "#EC4899" },
  ],
  "compras-marco": [
    { id: "solicitacao",     label: "Solicitação",        cor: "#6B7280" },
    { id: "em-execucao",     label: "Em Execução",        cor: "#3B82F6", slaHours: 24 },
    { id: "amostra-pronta",  label: "Amostra Pronta",     cor: "#F59E0B", slaHours: 24 },
    { id: "em-rota-entrega", label: "Em Rota de Entrega", cor: "#14B8A6", slaHours: 48 },
    { id: "finalizado",      label: "Finalizado",         cor: "#10B981" },
  ],
};
