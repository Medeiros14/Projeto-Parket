// Tokens canônicos SO Parket — light + dark via CSS custom properties.
// Todo consumidor faz `T.bg`, `T.textPrimary` etc. — retorna "var(--…)" e o
// tema efetivo é escolhido pelo atributo `data-theme` no <html>.
//
// Para leitores que precisam do valor bruto (ex: Three.js background),
// use `resolveColor(name)` — lê o computed style.

import { useEffect, useState } from "react";

type Mode = "dark" | "light";

const DARK = {
  bg:            "#050505",
  sidebarBg:     "#040404",
  headerBg:      "rgba(4,4,4,0.96)",
  cardBg:        "rgba(216,211,199,0.025)",
  cardHover:     "rgba(216,211,199,0.048)",
  border:        "rgba(216,211,199,0.08)",
  borderHover:   "rgba(216,211,199,0.18)",
  textPrimary:   "#D8D3C7",
  textSecondary: "#77736A",
  textMuted:     "rgba(119,115,106,0.55)",
  inputBg:       "rgba(216,211,199,0.04)",
  statBg:        "rgba(216,211,199,0.02)",
  walnut:        "#8B6F47",
  cream:         "#F3F0E8",
  danger:        "#B85B4C",
  ok:            "#7BA394",
  warn:          "#C7A45B",
  scrollThumb:   "rgba(216,211,199,0.14)",
};

const LIGHT = {
  bg:            "#F5F2EA",   // Off-white travertino
  sidebarBg:     "#EDE9DE",
  headerBg:      "rgba(245,242,234,0.96)",
  cardBg:        "rgba(30,25,20,0.03)",
  cardHover:     "rgba(30,25,20,0.06)",
  border:        "rgba(30,25,20,0.10)",
  borderHover:   "rgba(30,25,20,0.24)",
  textPrimary:   "#2A2622",   // Grafite quente
  textSecondary: "#5A544A",
  textMuted:     "rgba(90,84,74,0.55)",
  inputBg:       "rgba(30,25,20,0.04)",
  statBg:        "rgba(30,25,20,0.02)",
  walnut:        "#8B6F47",   // acento madeira (idêntico)
  cream:         "#2A2622",   // no light vira grafite (contraste sobre walnut)
  danger:        "#B85B4C",
  ok:            "#5B8A7A",
  warn:          "#B08A3E",
  scrollThumb:   "rgba(30,25,20,0.22)",
};

// Injeta CSS vars uma vez.
function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("__teca_theme")) return;

  const kv = (o: Record<string, string>) =>
    Object.entries(o).map(([k, v]) => `--${k}: ${v};`).join("\n    ");

  const style = document.createElement("style");
  style.id = "__teca_theme";
  style.textContent = `
:root, html[data-theme='dark'] {
    ${kv(DARK)}
    color-scheme: dark;
}
html[data-theme='light'] {
    ${kv(LIGHT)}
    color-scheme: light;
}
html, body, #root {
    background: var(--bg);
    color: var(--textPrimary);
    transition: background-color 0.25s, color 0.25s;
}
::-webkit-scrollbar-thumb { background: var(--scrollThumb); }
::selection { background: var(--borderHover); color: var(--textPrimary); }
  `;
  document.head.appendChild(style);
}

if (typeof document !== "undefined") injectStyles();

// Proxy que devolve `var(--<key>)` para qualquer chave — permite consumo
// idêntico ao anterior (T.bg, T.walnut, etc.), sem mexer nos componentes.
export const T: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_t, key: string) => `var(--${key})`,
});

// Resolve o valor real (hex/rgba) — usado onde CSS vars não colam (ex: WebGL).
export function resolveColor(key: keyof typeof DARK): string {
  if (typeof document === "undefined") return DARK[key];
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${key}`).trim();
  return v || DARK[key];
}

// ── Tema (dark/light) ───────────────────────────────────────────
const STORAGE_KEY = "teca-theme";

function initialMode(): Mode {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(STORAGE_KEY) as Mode | null;
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyMode(mode: Mode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", mode);
  document.documentElement.style.colorScheme = mode;
}

if (typeof document !== "undefined") applyMode(initialMode());

// Bus simples pra assinantes reagirem à troca de tema.
const listeners = new Set<(m: Mode) => void>();

export function useTheme(): [Mode, (m: Mode) => void, () => void] {
  const [mode, setMode] = useState<Mode>(initialMode());

  useEffect(() => {
    const h = (m: Mode) => setMode(m);
    listeners.add(h);
    return () => { listeners.delete(h); };
  }, []);

  const set = (m: Mode) => {
    applyMode(m);
    localStorage.setItem(STORAGE_KEY, m);
    listeners.forEach((h) => h(m));
  };
  const toggle = () => set(mode === "dark" ? "light" : "dark");
  return [mode, set, toggle];
}

// ── Mobile detection ────────────────────────────────────────────
const MOBILE_MAX = 768;

export function useIsMobile(breakpoint = MOBILE_MAX): boolean {
  const [is, setIs] = useState<boolean>(
    typeof window !== "undefined" ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const h = (e: MediaQueryListEvent) => setIs(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [breakpoint]);
  return is;
}

// ── Cores setoriais (funcionam nos dois temas) ──────────────────
export const setorColor: Record<string, string> = {
  comercial:   "#C7A45B",
  obras:       "#B85B4C",
  "orçamento": "#7BA394",
  desenho:     "#8CA9B8",
  catalogo:    "#8B6F47",
  mensageria:  "#B98CB2",
  financeiro:  "#5B8FB8",
  rh:          "#D8B47B",
  identidade:  "#77736A",
  ia:          "#A98BC7",
  teca:        "#8B6F47",   // trocamos textPrimary (varia por tema) por walnut fixo
  sync:        "#4E5A5A",
  backup:      "#3A3F3F",
  meta:        "#77736A",
  docs:        "#8CA9B8",
  geral:       "#77736A",
  core:        "#C7A45B",
  erp:         "#B85B4C",
  notas:       "#A98BC7",
};

export const fonts = {
  cinzel: "'Cinzel', serif",
  inter:  "'Inter', sans-serif",
};
