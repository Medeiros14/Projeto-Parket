/**
 * useTheme — segue o mesmo padrão do base.parket.works:
 *   - atributo `data-theme="light|dark"` no <html>
 *   - storage key: "parket-theme"
 *   - light = filter: invert() hue-rotate(180deg) no <html> (CSS faz o trabalho)
 *   - imagens/SVG ficam re-invertidas via CSS (mantêm cor original)
 */
import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";
const KEY = "parket-theme"; // mesma key do base.parket.works

function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.style.colorScheme = t;
}

function getInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(KEY) as Theme | null;
  if (saved === "light" || saved === "dark") return saved;
  return "dark"; // default dark, igual ao gestão (não segue o OS)
}

let initialized = false;
export function ensureThemeInitialized() {
  if (initialized) return;
  initialized = true;
  applyTheme(getInitial());
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getInitial());

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(KEY, theme); } catch {}
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, setTheme, toggle };
}
