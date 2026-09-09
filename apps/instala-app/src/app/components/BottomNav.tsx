import { useLocation, useNavigate } from "react-router-dom";
import { Clock, Calendar, Play, Receipt, LayoutGrid } from "lucide-react";
import { useTheme } from "../../lib/theme-context";
import { OfflineBadge } from "./OfflineBadge";

const FONT_MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

// icone recebe tambem fill/style (Play do INICIAR usa fill + offset otico)
type Tab = { key: string; label: string; icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string; fill?: string; style?: React.CSSProperties }>; center?: boolean; path: (slug: string) => string };

const TABS: Tab[] = [
  { key: "hoje",    label: "OBRAS",   icon: Clock,    path: (s) => `/${s}` },
  { key: "agenda",  label: "AGENDA",  icon: Calendar, path: (s) => `/${s}/agenda` },
  { key: "iniciar", label: "INICIAR", icon: Play,     center: true, path: (s) => `/${s}/iniciar` },
  // Equipe foi pra dentro do MENU (Will 08/09); Custos segue na nav
  { key: "custos",  label: "CUSTOS",  icon: Receipt,  path: (s) => `/${s}/custos` },
  { key: "mais",    label: "MENU",    icon: LayoutGrid, path: (s) => `/${s}/mais` },
];

const MAIS_TAILS = ["mais", "equipe", "ranking", "ocorrencias", "material", "pagamentos", "conferencia", "pendencias", "cronograma"];

export function BottomNav({ slug }: { slug: string }) {
  const { T, mode } = useTheme();
  const nav = useNavigate();
  const { pathname } = useLocation();

  const activeKey = (() => {
    const tail = pathname.replace(`/${slug}`, "").replace(/^\/+/, "").split("/")[0] || "hoje";
    if (MAIS_TAILS.includes(tail)) return "mais";
    return TABS.find((t) => t.key === tail)?.key ?? "hoje";
  })();

  const barBg = mode === "light" ? "#EDE9E0" : "#0E0E0E";
  const stroke = T.textPrimary;

  return (
    <>
    <OfflineBadge />
    <nav
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40,
        background: barBg,
        borderTop: `3px solid ${stroke}`,
        display: "flex", alignItems: "flex-end", justifyContent: "space-around",
        padding: `12px 6px calc(12px + env(safe-area-inset-bottom))`,
        fontFamily: FONT_MONO,
      }}
    >
      {TABS.map((tab) => {
        const active = activeKey === tab.key;
        const Icon = tab.icon;
        if (tab.center) {
          return (
            <button
              key={tab.key}
              onClick={() => nav(tab.path(slug))}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", gap: 6, cursor: "pointer",
                background: "transparent", border: "none", padding: 0,
                color: stroke,
              }}
            >
              <span
                style={{
                  width: 58, height: 58, borderRadius: "50%", marginTop: -22,
                  background: stroke, color: barBg,
                  boxShadow: `${stroke} 4px 4px 0px`,
                  border: `3px solid ${stroke}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {/* Play preenchido + deslocado 2px: o triangulo pesa pra esquerda, sem o offset parece descentralizado no circulo */}
                <Icon size={26} strokeWidth={2.2} fill="currentColor" style={{ marginLeft: 2 }} />
              </span>
              {/* marginRight negativo anula o espaco fantasma que o letterSpacing poe depois da ultima letra (senao a label sai do eixo do icone) */}
              <span style={{ fontSize: 8.5, letterSpacing: "0.1em", marginRight: "-0.1em" }}>{tab.label}</span>
            </button>
          );
        }
        return (
          <button
            key={tab.key}
            onClick={() => nav(tab.path(slug))}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 6, cursor: "pointer",
              background: "transparent", border: "none", padding: 0,
              color: active ? stroke : `${stroke}6B`,
            }}
          >
            <Icon size={25} strokeWidth={1.9} />
            {/* mesmo ajuste da label central: sem o marginRight a aba MENU (e as demais) fica levemente fora do eixo */}
            <span style={{ fontSize: 8.5, letterSpacing: "0.1em", marginRight: "-0.1em" }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
    </>
  );
}

export const BOTTOM_NAV_HEIGHT = 96;
