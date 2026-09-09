import { useCallback, useEffect, useState } from "react";
import { useAuth, signOut } from "../lib/auth";
import { fetchApps, fetchMyOverrides, canSeeApp, type PortalApp, type PortalOverride } from "../lib/portalData";
import { getTheme, type ThemeMode } from "./components/gestao/theme";
import { ParketLogin } from "./components/gestao/ParketLogin";
import { PortalHome } from "./PortalHome";
import { AdminAcessos } from "./AdminAcessos";
import { BusinessPlan } from "./BusinessPlan";
import { ManualMarca } from "./ManualMarca";
import { PlaybookAtendimento } from "./components/playbook/PlaybookAtendimento";
import { CulturaRitual } from "./components/playbook/CulturaRitual";
import { WorkflowProcessos } from "./components/playbook/WorkflowProcessos";
import { PlaybookProduto } from "./components/playbook/PlaybookProduto";

const THEME_KEY = "parket-portal-theme";

function readRoute(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}

export default function App() {
  const { session, appUser, loading, error } = useAuth();
  const [theme, setTheme] = useState<ThemeMode>(() =>
    localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"
  );
  const [route, setRoute] = useState<string>(readRoute());
  const [apps, setApps] = useState<PortalApp[]>([]);
  const [overrides, setOverrides] = useState<PortalOverride[]>([]);

  const T = getTheme(theme);

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  };

  const loadApps = useCallback(async () => {
    if (!appUser) return;
    try {
      const [a, o] = await Promise.all([fetchApps(), fetchMyOverrides(appUser.id)]);
      setApps(a);
      setOverrides(o);
    } catch (e) {
      console.error("Falha ao carregar apps do portal:", e);
    }
  }, [appUser?.id]);

  useEffect(() => {
    if (appUser) loadApps();
    else { setApps([]); setOverrides([]); }
  }, [appUser?.id, loadApps]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", backgroundColor: T.bg, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
      }}>
        <p style={{ fontSize: 10, letterSpacing: "0.24em", color: T.textMuted }}>
          CARREGANDO…
        </p>
      </div>
    );
  }

  if (!appUser) {
    return <ParketLogin theme={theme} T={T} authError={error} />;
  }

  const goHome = () => { window.location.hash = "/"; };

  if (route === "/admin" && appUser.isAdmin) {
    return (
      <AdminAcessos
        user={appUser}
        theme={theme}
        T={T}
        onBack={goHome}
        onChanged={loadApps}
      />
    );
  }

  if (route.startsWith("/biblioteca/")) {
    const id = route.slice("/biblioteca/".length);
    if (id === "business-plan") return <BusinessPlan onBack={goHome} />;
    if (id === "manual-marca") return <ManualMarca onBack={goHome} />;
    if (id === "playbook-atendimento") return <PlaybookAtendimento onBack={goHome} />;
    if (id === "playbook-produto") return <PlaybookProduto onBack={goHome} />;
    if (id === "cultura-ritual") return <CulturaRitual onBack={goHome} />;
    if (id === "workflow") return <WorkflowProcessos onBack={goHome} />;
  }

  const visibleApps = apps
    .filter((a) => canSeeApp(a, appUser, overrides))
    .sort((x, y) => x.ordem - y.ordem);

  return (
    <PortalHome
      user={appUser}
      apps={visibleApps}
      session={session}
      theme={theme}
      onToggleTheme={toggleTheme}
      T={T}
      onOpenModule={(id) => { window.location.hash = `/biblioteca/${id}`; }}
      onOpenAdmin={() => { window.location.hash = "/admin"; }}
      onLogout={() => { signOut(); }}
    />
  );
}
