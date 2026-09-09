import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "../../lib/theme-context";
import { BottomNav } from "./BottomNav";
import { NotifSino } from "./NotifSino";

const FONT_BODY = "'Inter', sans-serif";
const FONT_DISPLAY = "'Cinzel', serif";

export function Screen({ slug, titulo, subtitulo, children, action, voltar }: {
  slug: string; titulo: string; subtitulo?: string; children: ReactNode; action?: ReactNode; voltar?: string;
}) {
  const { T } = useTheme();
  const nav = useNavigate();
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.textPrimary, fontFamily: FONT_BODY }}>
      <header style={{
        padding: "20px 22px 16px", borderBottom: `1px solid ${T.border}`,
        background: T.headerBg, backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {voltar && (
            <button
              onClick={() => nav(voltar)}
              aria-label="Voltar"
              style={{
                background: T.statBg, border: `1px solid ${T.border}`, color: T.textPrimary,
                padding: 9, cursor: "pointer", borderRadius: 999, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            {subtitulo && (
              <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 4 }}>
                {subtitulo.toUpperCase()}
              </p>
            )}
            <h1 style={{
              fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 500,
              letterSpacing: "0.06em", color: T.textPrimary,
            }}>
              {titulo}
            </h1>
          </div>
        </div>
        {/* Direita do header: sino de novidades sempre presente + acao da tela */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {action}
          <NotifSino slug={slug} />
        </div>
      </header>

      <main style={{ padding: "20px 22px 120px" }}>{children}</main>

      <BottomNav slug={slug} />
    </div>
  );
}
