import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { LoginPage } from "./components/LoginPage";
import { Layout } from "./components/Layout";
import { Toaster } from "./components/ui/Toaster";
// v2 (task #1669) — telas Nubank-style
import { PainelPage } from "./components/pages/v2/Painel";
import { ObrasV2Page } from "./components/pages/v2/Obras";
import { ObraDetalhePage } from "./components/pages/v2/ObraDetalhe";
import { PagamentosV2Page } from "./components/pages/v2/Pagamentos";
import { RecebimentosV2Page } from "./components/pages/v2/Recebimentos";
import { AprovacoesPage } from "./components/pages/v2/Aprovacoes";
import { FretesObraPage } from "./components/pages/v2/FretesObra";
// Legado: reusa cadastros
import { ParceirosPage } from "./components/pages/Parceiros";
import { EmpresasPage } from "./components/pages/Empresas";
import { ContasBancariasPage } from "./components/pages/ContasBancarias";
import { ContratosPage } from "./components/pages/Contratos";
import { ConciliacaoPage } from "./components/pages/Conciliacao";
import { UsuariosPage } from "./components/pages/Usuarios";
import { PrestadoresPage } from "./components/pages/Prestadores";
import { PrestadoresObraPage } from "./components/pages/PrestadoresObra";
import { PlaceholderPage } from "./components/pages/Placeholder";
import { ContratoPage } from "./components/pages/Contrato";
import { ContratoAssinadoPage } from "./components/pages/ContratoAssinado";
import { ThemeToggle } from "./components/ThemeToggle";
import { Loader2 } from "lucide-react";

export default function App() {
  const auth = useAuth();

  // Rota pública /contrato/:cardId
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/contrato/")) {
    return (
      <>
        <Routes>
          <Route path="/contrato/assinado" element={<ContratoAssinadoPage />} />
          <Route path="/contrato/:cardId" element={<ContratoPage />} />
        </Routes>
        <Toaster />
        <ThemeToggle floating />
      </>
    );
  }

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parket-bg text-parket-textDim">
        <Loader2 size={20} className="animate-spin text-parket-accent" />
      </div>
    );
  }

  const loginErr = auth.error && /timeout|Falha ao verificar/i.test(auth.error) ? null : auth.error;

  if (!auth.session || !auth.appUser) {
    return (
      <>
        <LoginPage initialError={loginErr} />
        <Toaster />
        <ThemeToggle floating />
      </>
    );
  }

  if (auth.appUser.prestadoresOnly) {
    return (
      <>
        <Routes>
          <Route element={<Layout appUser={auth.appUser} />}>
            <Route path="/prestadores" element={<PrestadoresPage />} />
            <Route path="/prestadores/:obraId" element={<PrestadoresObraPage />} />
            <Route path="*" element={<Navigate to="/prestadores" replace />} />
          </Route>
        </Routes>
        <Toaster />
      </>
    );
  }

  return (
    <>
    <Routes>
      <Route element={<Layout appUser={auth.appUser} />}>
        {/* v2 — nav principal */}
        <Route index element={<PainelPage />} />
        <Route path="/obras" element={<ObrasV2Page />} />
        <Route path="/obras/:id" element={<ObraDetalhePage />} />
        <Route path="/pagamentos" element={<PagamentosV2Page />} />
        <Route path="/recebimentos" element={<RecebimentosV2Page />} />
        <Route path="/aprovacoes" element={<AprovacoesPage />} />
        <Route path="/contas-bancarias" element={<ContasBancariasPage />} />
        {/* Cadastros */}
        <Route path="/empresas" element={<EmpresasPage />} />
        <Route path="/parceiros" element={<ParceirosPage />} />
        <Route path="/contratos" element={<ContratosPage />} />
        <Route path="/prestadores" element={<PrestadoresPage />} />
        <Route path="/prestadores/:obraId" element={<PrestadoresObraPage />} />
        {/* Legado escondido — acessível por URL direta ou link do Painel */}
        <Route path="/conciliacao" element={<ConciliacaoPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        {/* Redirects das rotas velhas pra novas */}
        <Route path="/contas-pagar" element={<Navigate to="/pagamentos" replace />} />
        <Route path="/contas-receber" element={<Navigate to="/recebimentos" replace />} />
        <Route path="/comissoes" element={<Navigate to="/pagamentos" replace />} />
        <Route path="/rts" element={<Navigate to="/pagamentos" replace />} />
        <Route path="/impostos" element={<Navigate to="/pagamentos" replace />} />
        <Route path="/dre" element={<Navigate to="/" replace />} />
        <Route path="/fluxo-caixa" element={<Navigate to="/" replace />} />
        <Route path="/custo-obra" element={<Navigate to="/obras" replace />} />
        <Route path="/relatorios" element={<Navigate to="/" replace />} />
        <Route path="/plano-contas" element={<Navigate to="/" replace />} />
        <Route path="/centros-custo" element={<Navigate to="/" replace />} />
        <Route path="/funcionarios" element={<Navigate to="/" replace />} />
        <Route path="/viagens" element={<Navigate to="/pagamentos" replace />} />
        <Route path="/fretes" element={<FretesObraPage />} />
        <Route path="*" element={<PlaceholderPage title="Página não encontrada" />} />
      </Route>
    </Routes>
    <Toaster />
    </>
  );
}
