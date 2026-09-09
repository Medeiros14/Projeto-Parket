import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { getTheme, type ThemeMode, type ThemeTokens } from "../app/components/gestao/theme";

type Ctx = { mode: ThemeMode; T: ThemeTokens; toggle: () => void; setMode: (m: ThemeMode) => void };
const ThemeCtx = createContext<Ctx>({ mode: "dark", T: getTheme("dark"), toggle: () => {}, setMode: () => {} });

const STORAGE = "parket-instala-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem(STORAGE);
    return saved === "light" || saved === "dark" ? saved : "dark";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE, mode);
    const T = getTheme(mode);
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.body.style.background = T.bg;
    document.body.style.color = T.textPrimary;
    document.body.style.colorScheme = mode;
  }, [mode]);

  const value = useMemo<Ctx>(() => ({
    mode,
    T: getTheme(mode),
    toggle: () => setMode((m) => (m === "dark" ? "light" : "dark")),
    setMode,
  }), [mode]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
