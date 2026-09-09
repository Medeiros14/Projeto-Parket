import { Route, Routes, Navigate } from "react-router-dom";
import { useSession } from "./lib/auth";
import { useTokens, fonts } from "./theme";
import Login from "./pages/Login";
import Board from "./pages/Board";
import CardPage from "./pages/CardPage";
import AdminContrato from "./pages/AdminContrato";

export default function App() {
  const { user, loading } = useSession();
  const T = useTokens();

  if (loading) {
    return (
      <div style={{ height: "calc(100vh / var(--pkz, 1))", display: "grid", placeItems: "center", background: T.bg, color: T.textSecondary, fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>
        Carregando…
      </div>
    );
  }

  if (!user) return <Login />;

  if (!user.canAccessFinanceiro) {
    return (
      <div style={{ height: "calc(100vh / var(--pkz, 1))", display: "grid", placeItems: "center", background: T.bg, color: T.textPrimary, fontFamily: fonts.inter }}>
        <div style={{ textAlign: "center", maxWidth: 480, padding: 32, border: `1px solid ${T.border}`, background: T.cardBg }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 14, letterSpacing: "0.22em", color: T.textPrimary, marginBottom: 8 }}>ACESSO NEGADO</div>
          <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>
            Essa plataforma é exclusiva ao time <strong style={{ color: T.textPrimary }}>Financeiro</strong>.
            <br />Peça pro admin liberar acesso ao setor no Space.
          </div>
          <div style={{ marginTop: 16, fontSize: 9, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            {user.email}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/"                element={<Board user={user} />} />
      <Route path="/card/:cardId"    element={<CardPage user={user} />} />
      <Route path="/admin/contrato"  element={<AdminContrato user={user} />} />
      <Route path="*"                element={<Navigate to="/" replace />} />
    </Routes>
  );
}
