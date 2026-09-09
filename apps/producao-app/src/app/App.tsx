import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { Shell } from "./components/Shell";

import Login from "./pages/Login";
import Kanban from "./pages/Kanban";
import Ordens from "./pages/Ordens";
import Prensa from "./pages/Prensa";
import Marcenaria from "./pages/Marcenaria";
import Almoxarifado from "./pages/Almoxarifado";
import Visao360 from "./pages/Visao360";
import SolicitarCompra from "./pages/SolicitarCompra";

function Private({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, color: "#888" }}>Carregando sessão…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true } as any}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Private><Kanban /></Private>} />
            <Route path="/validacao" element={<Private><Ordens etapa="1. VALIDAÇÃO" titulo="Validação" /></Private>} />
            <Route path="/projetos" element={<Navigate to="/validacao" replace />} />
            <Route path="/prensa" element={<Private><Prensa /></Private>} />
            <Route path="/marcenaria" element={<Private><Marcenaria /></Private>} />
            <Route path="/almoxarifado" element={<Private><Almoxarifado /></Private>} />
            <Route path="/finalizado" element={<Private><Ordens etapa="7. FINALIZADO" titulo="Finalizado" /></Private>} />
            <Route path="/visao360" element={<Private><Visao360 /></Private>} />
            <Route path="/solicitar" element={<Private><SolicitarCompra /></Private>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
