import { Routes, Route, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { LoginPage } from "@/components/LoginPage";
import { Layout } from "@/components/Layout";
import { DashboardPage } from "@/components/pages/Dashboard";
import { ColaboradoresPage } from "@/components/pages/Colaboradores";
import { DesligamentosPage } from "@/components/pages/Desligamentos";
import { ColaboradorDetalhePage } from "@/components/pages/ColaboradorDetalhe";
import { AdmissoesPage } from "@/components/pages/Admissoes";
import { AdmissaoWizardPage } from "@/components/pages/AdmissaoWizard";
import { AdmissaoDetalhePage } from "@/components/pages/AdmissaoDetalhe";
import { AdmissaoPublicaPage } from "@/components/pages/AdmissaoPublica";
import { DocumentosPage } from "@/components/pages/Documentos";
import { AssinarDocumentoPage } from "@/components/pages/AssinarDocumento";
import { MuralPublicoPage } from "@/components/pages/MuralPublico";
import { MuraisAdminPage } from "@/components/pages/MuraisAdmin";
import { MuralEditPage } from "@/components/pages/MuralEdit";
import { FeriasPage } from "@/components/pages/Ferias";
import { CalendarioPage } from "@/components/pages/Calendario";
import { EmpresasPage } from "@/components/pages/Empresas";
import { UsuariosPage } from "@/components/pages/Usuarios";
import { PlaceholderPage } from "@/components/pages/Placeholder";
import { ConfiguracoesPage } from "@/components/pages/Configuracoes";
import { ContratosPage } from "@/components/pages/Contratos";
import { HoleritesPage } from "@/components/pages/Holerites";
import { TreinamentosPage } from "@/components/pages/Treinamentos";
import { AvaliacoesPage } from "@/components/pages/Avaliacoes";

export default function App() {
  const location = useLocation();
  // Rota pública: form de admissão preenchido pelo futuro funcionário
  // (sem login, validado por token na URL).
  if (location.pathname.startsWith("/admissao/")) {
    return (
      <Routes>
        <Route path="/admissao/:token" element={<AdmissaoPublicaPage />} />
      </Routes>
    );
  }
  if (location.pathname.startsWith("/assinar/")) {
    return (
      <Routes>
        <Route path="/assinar/:token" element={<AssinarDocumentoPage />} />
      </Routes>
    );
  }
  // Rota pública: mural sem branding — colaborador entra com nome+CPF
  if (location.pathname.startsWith("/mural/")) {
    return (
      <Routes>
        <Route path="/mural/:slug" element={<MuralPublicoPage />} />
      </Routes>
    );
  }

  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 size={20} className="animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Carregando perfil…</span>
        <button
          onClick={async () => {
            try { await (await import("@/lib/auth")).signOut(); } catch {}
            try { Object.keys(localStorage).filter((k) => k.startsWith("parket-rh") || k.startsWith("sb-")).forEach((k) => localStorage.removeItem(k)); } catch {}
            window.location.reload();
          }}
          className="text-[11px] px-3 py-1.5 rounded border border-border hover:bg-secondary transition"
        >Travou? Limpar sessão e tentar novamente</button>
      </div>
    );
  }

  // Sem session → tela de login
  if (!auth.session) {
    return <LoginPage initialError={auth.error} />;
  }
  // Tem session mas appUser não carregou — NÃO desloga, mostra erro com retry
  if (!auth.appUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-sm font-semibold">Não foi possível carregar seu perfil</div>
        <div className="text-xs text-muted-foreground max-w-md text-center">{auth.error || "Tente recarregar a página."}</div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="text-[11px] px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
          >Recarregar</button>
          <button
            onClick={async () => {
              try { await (await import("@/lib/auth")).signOut(); } catch {}
              try { Object.keys(localStorage).filter((k) => k.startsWith("parket-rh") || k.startsWith("sb-")).forEach((k) => localStorage.removeItem(k)); } catch {}
              window.location.reload();
            }}
            className="text-[11px] px-3 py-1.5 rounded border border-border hover:bg-secondary"
          >Limpar sessão e relogar</button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout appUser={auth.appUser} />}>
        <Route index element={<DashboardPage />} />
        <Route path="/colaboradores" element={<ColaboradoresPage />} />
        <Route path="/colaboradores/:id" element={<ColaboradorDetalhePage />} />
        <Route path="/admissoes" element={<AdmissoesPage />} />
        <Route path="/admissoes/novo" element={<AdmissaoWizardPage />} />
        <Route path="/admissoes/:id" element={<AdmissaoDetalhePage />} />
        <Route path="/desligamentos" element={<DesligamentosPage />} />
        <Route path="/ferias" element={<FeriasPage />} />
        <Route path="/calendario" element={<CalendarioPage />} />
        <Route path="/ponto" element={<PlaceholderPage title="Ponto eletrônico" description="Bater ponto + espelhos" />} />
        <Route path="/holerites" element={<HoleritesPage />} />
        <Route path="/treinamentos" element={<TreinamentosPage />} />
        <Route path="/avaliacoes" element={<AvaliacoesPage />} />
        <Route path="/documentos" element={<DocumentosPage />} />
        <Route path="/murais" element={<MuraisAdminPage />} />
        <Route path="/murais/:slug" element={<MuralEditPage />} />
        <Route path="/contratos" element={<ContratosPage />} />
        <Route path="/empresas" element={<EmpresasPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
        <Route path="*" element={<PlaceholderPage title="Página não encontrada" />} />
      </Route>
    </Routes>
  );
}
