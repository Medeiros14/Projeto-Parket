import { useState } from "react";
import { NavonaDashboard } from "./NavonaDashboard";
import { DepartamentoView } from "./DepartamentoView";
import { ParketLogin } from "./ParketLogin";
import { InstaParketView } from "./InstaParketView";
import type { DepartmentId, ViewMode } from "./data";
import { DEPT_MAP } from "./data";
import type { ThemeMode } from "./theme";
import { getTheme } from "./theme";

type InternalView = ViewMode | "instaparket";

interface SistemaGestaoProps {
  onBack: () => void;
}

export function SistemaGestao({ onBack }: SistemaGestaoProps) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [view, setView] = useState<InternalView>("dashboard");
  const [theme, setTheme] = useState<ThemeMode>("dark");

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const T = getTheme(theme);

  if (!loggedIn) {
    return <ParketLogin onLogin={() => setLoggedIn(true)} theme={theme} T={T} />;
  }

  if (view === "instaparket") {
    return (
      <InstaParketView
        onBack={() => setView("dashboard")}
        theme={theme}
        onToggleTheme={toggleTheme}
        T={T}
      />
    );
  }

  if (view !== "dashboard") {
    const dept = DEPT_MAP[view as DepartmentId];
    return (
      <DepartamentoView
        dept={dept}
        onBack={() => setView("dashboard")}
        onGoDashboard={() => setView("dashboard")}
        theme={theme}
        onToggleTheme={toggleTheme}
        T={T}
      />
    );
  }

  return (
    <NavonaDashboard
      onSelectDept={(id) => setView(id)}
      onGoInstaParket={() => setView("instaparket")}
      onBack={() => setLoggedIn(false)}
      theme={theme}
      onToggleTheme={toggleTheme}
      T={T}
    />
  );
}
