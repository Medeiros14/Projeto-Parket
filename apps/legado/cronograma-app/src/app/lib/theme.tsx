import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";

export type Mode = "dark" | "light";

export type Tokens = {
  bg: string;
  bgPanel: string;
  bgInput: string;
  bgInputEdit: string;
  bgHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentInk: string;
  danger: string;
};

const DARK: Tokens = {
  bg: "#0a0a0a",
  bgPanel: "#0e0e0e",
  bgInput: "rgba(255,255,255,0.04)",
  bgInputEdit: "rgba(212,168,83,0.08)",
  bgHover: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.10)",
  text: "#ffffff",
  textMuted: "rgba(255,255,255,0.5)",
  textFaint: "rgba(255,255,255,0.25)",
  accent: "#D4A853",
  accentInk: "#000",
  danger: "#f87171",
};

const LIGHT: Tokens = {
  bg: "#f6f5f1",
  bgPanel: "#ffffff",
  bgInput: "#ffffff",
  bgInputEdit: "rgba(212,168,83,0.14)",
  bgHover: "rgba(0,0,0,0.03)",
  border: "rgba(0,0,0,0.08)",
  borderStrong: "rgba(0,0,0,0.16)",
  text: "#1a1a1a",
  textMuted: "rgba(0,0,0,0.55)",
  textFaint: "rgba(0,0,0,0.30)",
  accent: "#B8893A",
  accentInk: "#fff",
  danger: "#dc2626",
};

type Ctx = { mode: Mode; t: Tokens; toggle: () => void };
const ThemeCtx = createContext<Ctx>({ mode: "dark", t: DARK, toggle: () => {} });

const STORAGE_KEY = "cronograma:theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "dark";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
    document.body.style.background = mode === "light" ? LIGHT.bg : DARK.bg;
    document.body.style.colorScheme = mode;
  }, [mode]);

  const value = useMemo<Ctx>(() => ({
    mode,
    t: mode === "light" ? LIGHT : DARK,
    toggle: () => setMode((m) => (m === "light" ? "dark" : "light")),
  }), [mode]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
