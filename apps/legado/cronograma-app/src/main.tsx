import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./app/lib/auth";
import { ThemeProvider, useTheme } from "./app/lib/theme";
import { Login } from "./app/pages/Login";
import { Workspace } from "./app/pages/Workspace";

function Guard({ children }: { children: React.ReactNode }) {
  const { ready, user, hasOperacional } = useAuth();
  const { t } = useTheme();
  if (!ready) return <div style={{ display: "grid", placeItems: "center", height: "100vh", color: t.textMuted, background: t.bg }}>Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasOperacional) return <div style={{ display: "grid", placeItems: "center", height: "100vh", padding: 32, textAlign: "center", color: t.textMuted, background: t.bg }}>
    <div>
      <h2 style={{ color: t.text, marginBottom: 12 }}>Acesso restrito</h2>
      <p>Esta aplicação é exclusiva do setor <strong>Operacional</strong>. Peça acesso ao admin.</p>
      <p style={{ marginTop: 16, fontSize: 12 }}>Usuário: {user.email}</p>
    </div>
  </div>;
  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<Guard><Workspace /></Guard>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
