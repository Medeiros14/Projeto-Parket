import { Link } from "react-router-dom";
import { useTokens, fonts, useTheme, ACCENT } from "../theme";
import { signOut, type AppUser } from "../lib/auth";

export default function Header({ user, stats }: { user: AppUser; stats?: { total: number; assinados: number } }) {
  const T = useTokens();
  const [mode, , toggleTheme] = useTheme();
  return (
    <header style={{
      background: T.headerBg, backdropFilter: "blur(10px)",
      borderBottom: `1px solid ${T.border}`,
      padding: "12px 24px", display: "flex", alignItems: "center", gap: 24,
      position: "sticky", top: 0, zIndex: 10,
      fontFamily: fonts.inter,
    }}>
      <div>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 13, letterSpacing: "0.24em", color: T.textPrimary }}>
          CONTRATOS
        </div>
        <div style={{ fontSize: 8, letterSpacing: "0.24em", color: T.textMuted, textTransform: "uppercase", marginTop: 2 }}>
          gestão de assinaturas · parket
        </div>
      </div>

      {stats && (
        <div style={{ display: "flex", gap: 20, marginLeft: 24 }}>
          <Stat label="Contratos" value={stats.total} T={T} />
          <Stat label="Assinados" value={stats.assinados} T={T} accent={ACCENT.green} />
        </div>
      )}

      <div style={{ flex: 1 }} />

      {user.canEditFinanceiro && (
        <Link
          to="/admin/contrato"
          style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: T.textSecondary, textDecoration: "none", padding: "6px 10px", border: `1px solid ${T.border}` }}
          title="Editar cláusulas do contrato"
        >
          Editar contrato
        </Link>
      )}

      <button onClick={toggleTheme}
        style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textSecondary, padding: "6px 8px", cursor: "pointer", lineHeight: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 30, height: 26, transition: "color 0.2s, border-color 0.2s" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = T.textPrimary; (e.currentTarget as HTMLButtonElement).style.borderColor = T.borderHover; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = T.textSecondary; (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; }}
        title={mode === "dark" ? "Modo claro" : "Modo escuro"}
        aria-label={mode === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      >
        {mode === "dark" ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>

      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 11, color: T.textPrimary, fontWeight: 500 }}>
          {user.profile?.full_name || user.email}
        </div>
        <button onClick={signOut}
          style={{ background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", padding: 0 }}>
          sair
        </button>
      </div>
    </header>
  );
}

function Stat({ label, value, T, accent }: { label: string; value: number; T: any; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 8, letterSpacing: "0.22em", color: T.textMuted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 16, color: accent || T.textPrimary, marginTop: 2 }}>{value}</div>
    </div>
  );
}
