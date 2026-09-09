import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getTheme, ThemeMode, ThemeTokens } from "../lib/theme";

type Ctx = { mode: ThemeMode; t: ThemeTokens; toggle: () => void; set: (m: ThemeMode) => void };
const ThemeCtx = createContext<Ctx | null>(null);

function applyCssVars(t: ThemeTokens) {
  const r = document.documentElement;
  Object.entries(t).forEach(([k, v]) => r.style.setProperty(`--va-${k}`, String(v)));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("producao-theme") : null;
    return (stored === "light" ? "light" : "dark") as ThemeMode;
  });
  const t = getTheme(mode);

  useEffect(() => {
    applyCssVars(t);
    document.documentElement.dataset.theme = mode;
    localStorage.setItem("producao-theme", mode);
  }, [mode]);

  return (
    <ThemeCtx.Provider value={{
      mode, t,
      toggle: () => setMode((m) => (m === "dark" ? "light" : "dark")),
      set: setMode,
    }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useTheme fora do ThemeProvider");
  return c;
};
