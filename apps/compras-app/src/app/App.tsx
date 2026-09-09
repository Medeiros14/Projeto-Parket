import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { Shell } from "./components/Shell";

import Login from "./pages/Login";
import Kanban from "./pages/Kanban";
import Fornecedores from "./pages/Fornecedores";
import Solicitar from "./pages/Solicitar";
import Cadastros from "./pages/Cadastros";
import Almoxarifado from "./pages/Almoxarifado";
import Financeiro from "./pages/Financeiro";
import Faturamentos from "./pages/Faturamentos";
import Relatorios from "./pages/Relatorios";

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
            {/* Form público — mesmo fluxo do space.parket.works/solicitar-compras */}
            <Route path="/solicitar" element={<Solicitar />} />

            <Route path="/" element={<Private><Kanban /></Private>} />
            <Route path="/fornecedores" element={<Private><Fornecedores /></Private>} />
            <Route path="/almoxarifado" element={<Private><Almoxarifado /></Private>} />
            <Route path="/cadastros" element={<Private><Cadastros /></Private>} />
            <Route path="/financeiro" element={<Private><Financeiro /></Private>} />
            <Route path="/faturamentos" element={<Private><Faturamentos /></Private>} />
            <Route path="/relatorios" element={<Private><Relatorios /></Private>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
