/** Identidade visual Parket — mesma paleta do Center (center.parket.works).
 *  Valores via CSS vars (index.html): claro default, dark com html[data-theme="dark"]. */
export const t = {
  bg: "var(--pkt-bg)",
  card: "var(--pkt-card)",
  card2: "var(--pkt-card2)",
  border: "var(--pkt-border)",
  border2: "var(--pkt-border2)",
  text: "var(--pkt-text)",
  text2: "var(--pkt-text2)",
  text3: "var(--pkt-text3)",
  accent: "var(--pkt-accent)",
  accentSoft: "var(--pkt-accent-soft)",
  navBg: "var(--pkt-nav-bg)",
  danger: "#C07A4A",
  ok: "#5B8A5E",
};

/* Header invertido em relação ao tema, igual ao Center */
export const hd = {
  bg: "var(--pkt-hd-bg)",
  text: "var(--pkt-hd-text)",
  text2: "var(--pkt-hd-text2)",
  border: "var(--pkt-hd-border)",
  accent: "var(--pkt-hd-accent)",
};

export const fonts = {
  brand: "'Cormorant Garamond', serif",
  body: "'Inter', system-ui, sans-serif",
};

export const MAXW = 560;

const THEME_KEY = "insta-theme";
export const isDark = () => document.documentElement.dataset.theme === "dark";
export const setDark = (dark: boolean) => {
  if (dark) document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch {}
};
