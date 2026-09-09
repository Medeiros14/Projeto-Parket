import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { Shell } from "./components/Shell";

import Login from "./pages/Login";
import EmUso from "./pages/EmUso";
import Estoque from "./pages/Estoque";
import Manutencao from "./pages/Manutencao";
import Entrada from "./pages/Entrada";
import Kanban from "./pages/Kanban";
import Funcionarios from "./pages/Funcionarios";
import Historico from "./pages/Historico";
import Dados from "./pages/Dados";

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
            <Route path="/" element={<Private><EmUso /></Private>} />
            <Route path="/estoque" element={<Private><Estoque /></Private>} />
            <Route path="/manutencao" element={<Private><Manutencao /></Private>} />
            <Route path="/entrada" element={<Private><Entrada /></Private>} />
            <Route path="/kanban" element={<Private><Kanban /></Private>} />
            <Route path="/funcionarios" element={<Private><Funcionarios /></Private>} />
            {/* Histórico de termos emitidos (empréstimo + devolução) da filial do login. */}
            <Route path="/historico" element={<Private><Historico /></Private>} />
            <Route path="/dados" element={<Private><Dados /></Private>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
