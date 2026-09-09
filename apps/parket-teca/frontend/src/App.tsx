import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { T, fonts, useTheme, useIsMobile } from "./theme";
import Nucleo from "./pages/Nucleo";
import Consultar from "./pages/Consultar";
import Notas from "./pages/Notas";
import Pulsar from "./pages/Pulsar";
import Aprendizados from "./pages/Aprendizados";

const NAV = [
  { to: "/",             label: "NÚCLEO",       sub: "world 3D"          },
  { to: "/consultar",    label: "CONSULTAR",    sub: "chat + citações"   },
  { to: "/notas",        label: "NOTAS",        sub: "second brain"      },
  { to: "/pulsar",       label: "PULSAR",       sub: "insights ativos"   },
  { to: "/aprendizados", label: "APRENDIZADO",  sub: "por app"           },
];

export default function App() {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // fecha o drawer ao trocar de rota
  useEffect(() => { if (isMobile) setDrawerOpen(false); }, [location.pathname, isMobile]);

  return (
    <div style={{
      display: isMobile ? "flex" : "grid",
      flexDirection: isMobile ? "column" : undefined,
      gridTemplateColumns: isMobile ? undefined : "220px 1fr",
      // Shell raiz: 100vh cru fica errado dentro do body{zoom} (Chrome nao compensa
      // vh), sobra vao vazio embaixo. --pkz espelha o zoom (ver index.html).
      height: "calc(100vh / var(--pkz, 1))",
      background: T.bg,
      color: T.textPrimary,
    }}>
      {isMobile && (
        <MobileTopBar
          onOpen={() => setDrawerOpen(true)}
          currentLabel={NAV.find((n) => (n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to)))?.label || "NÚCLEO"}
        />
      )}

      <Sidebar isMobile={isMobile} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main style={{ overflow: "hidden", position: "relative", flex: 1, minHeight: 0 }}>
        <Routes>
          <Route path="/"          element={<Nucleo />} />
          <Route path="/consultar" element={<Consultar />} />
          <Route path="/notas"     element={<Notas />} />
          <Route path="/pulsar"    element={<Pulsar />} />
          <Route path="/aprendizados" element={<Aprendizados />} />
        </Routes>
      </main>
    </div>
  );
}

function MobileTopBar({ onOpen, currentLabel }: { onOpen: () => void; currentLabel: string }) {
  const [, , toggleTheme] = useTheme();
  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 16px", background: T.sidebarBg, borderBottom: `1px solid ${T.border}`,
      zIndex: 5,
    }}>
      <button
        onClick={onOpen}
        aria-label="Abrir menu"
        style={{
          background: "transparent", border: `1px solid ${T.border}`,
          color: T.textPrimary, padding: "8px 10px", cursor: "pointer",
          fontSize: 16, lineHeight: 1,
        }}
      >☰</button>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.22em", color: T.textPrimary }}>
        {currentLabel}
      </div>
      <ThemeToggle onClick={toggleTheme} />
    </header>
  );
}

function Sidebar({ isMobile, open, onClose }: { isMobile: boolean; open: boolean; onClose: () => void }) {
  const [mode, , toggleTheme] = useTheme();

  const asideStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed", top: 0, left: 0, bottom: 0,
        width: 260, zIndex: 30,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s ease-out",
        background: T.sidebarBg,
        borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        padding: "24px 20px",
        boxShadow: open ? "6px 0 30px rgba(0,0,0,0.35)" : "none",
      }
    : {
        background: T.sidebarBg,
        borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        padding: "24px 20px",
      };

  return (
    <>
      {isMobile && open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            zIndex: 20,
          }}
        />
      )}
      <aside style={asideStyle}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div>
            <div style={{
              fontFamily: fonts.cinzel, fontSize: 14,
              letterSpacing: "0.22em", color: T.textPrimary, marginBottom: 4,
            }}>NÚCLEO TECA</div>
            <div style={{
              fontFamily: fonts.inter, fontSize: 9,
              letterSpacing: "0.24em", color: T.textMuted,
              textTransform: "uppercase",
            }}>segunda mente parket</div>
          </div>
          {isMobile && (
            <button
              onClick={onClose}
              aria-label="Fechar menu"
              style={{
                background: "transparent", border: "none", color: T.textMuted,
                cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1,
              }}
            >×</button>
          )}
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 40 }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              style={({ isActive }) => ({
                display: "block",
                padding: "14px 12px",
                textDecoration: "none",
                background: isActive ? T.cardHover : "transparent",
                border: `1px solid ${isActive ? T.borderHover : "transparent"}`,
                color: isActive ? T.textPrimary : T.textSecondary,
                transition: "all 0.15s",
              })}
            >
              <div style={{
                fontFamily: fonts.cinzel, fontSize: 11,
                letterSpacing: "0.20em",
              }}>{n.label}</div>
              <div style={{
                fontFamily: fonts.inter, fontSize: 9,
                letterSpacing: "0.14em", color: T.textMuted, marginTop: 4,
              }}>{n.sub}</div>
            </NavLink>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        {!isMobile && (
          <button
            onClick={toggleTheme}
            style={{
              marginBottom: 16, padding: "10px 12px",
              background: "transparent", border: `1px solid ${T.border}`,
              color: T.textSecondary, cursor: "pointer",
              fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.20em",
              textTransform: "uppercase", textAlign: "left",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
            aria-label="Alternar tema"
          >
            <span>{mode === "dark" ? "modo claro" : "modo escuro"}</span>
            <span aria-hidden style={{ fontSize: 12 }}>{mode === "dark" ? "☀" : "☾"}</span>
          </button>
        )}

        <div style={{
          fontFamily: fonts.inter, fontSize: 8,
          letterSpacing: "0.18em", color: T.textMuted,
          textTransform: "uppercase",
        }}>
          teca.parket.works · v0.3
        </div>
      </aside>
    </>
  );
}

function ThemeToggle({ onClick }: { onClick: () => void }) {
  const [mode] = useTheme();
  return (
    <button
      onClick={onClick}
      aria-label="Alternar tema"
      style={{
        background: "transparent", border: `1px solid ${T.border}`,
        color: T.textSecondary, padding: "6px 10px", cursor: "pointer",
        fontSize: 14, lineHeight: 1, minWidth: 34,
      }}
    >{mode === "dark" ? "☀" : "☾"}</button>
  );
}
