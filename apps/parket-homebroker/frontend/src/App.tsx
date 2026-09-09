import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth, type AppUser } from "./lib/auth";
import { LoginPage } from "./components/LoginPage";
import { Layout } from "./components/Layout";
import { AssignNotifications } from "./components/AssignNotifications";
import { CardsProvider } from "./lib/cards-store";

// Páginas carregadas SOB DEMANDA (cada rota = chunk separado).
// Reduz drasticamente o JS inicial — só baixa o código da página que o user abrir.
const PregaoPage     = lazy(() => import("./components/pages/Pregao").then((m) => ({ default: m.PregaoPage })));
const BookPage       = lazy(() => import("./components/pages/Book").then((m) => ({ default: m.BookPage })));
const CardDetailPage = lazy(() => import("./components/pages/CardDetail").then((m) => ({ default: m.CardDetailPage })));
const AtendimentoPage = lazy(() => import("./components/pages/Atendimento").then((m) => ({ default: m.AtendimentoPage })));
const AuditoriaPage = lazy(() => import("./components/pages/Auditoria").then((m) => ({ default: m.AuditoriaPage })));
const AgendamentosPage = lazy(() => import("./components/pages/Agendamentos").then((m) => ({ default: m.AgendamentosPage })));
const ScriptsPage    = lazy(() => import("./components/pages/Scripts").then((m) => ({ default: m.ScriptsPage })));
const OrcamentoPage  = lazy(() => import("./components/pages/Orcamento").then((m) => ({ default: m.OrcamentoPage })));
const OrcamentoAprovacaoPage = lazy(() => import("./components/pages/OrcamentoAprovacao").then((m) => ({ default: m.OrcamentoAprovacaoPage })));
const PerformancePage = lazy(() => import("./components/pages/Performance").then((m) => ({ default: m.PerformancePage })));
const TecaMonitorPage = lazy(() => import("./components/pages/TecaMonitor").then((m) => ({ default: m.TecaMonitorPage })));
const TrackingPage = lazy(() => import("./components/pages/Tracking").then((m) => ({ default: m.TrackingPage })));
const TrackingAdminPage = lazy(() => import("./components/pages/Tracking").then((m) => ({ default: m.TrackingAdminPage })));
const TrackingAgendaPage = lazy(() => import("./components/pages/Tracking").then((m) => ({ default: m.TrackingAgendaPage })));
const AdminUsuariosComercialPage = lazy(() => import("./components/pages/AdminUsuariosComercial").then((m) => ({ default: m.AdminUsuariosComercialPage })));
const CarteiraPage = lazy(() => import("./components/pages/Carteira").then((m) => ({ default: m.CarteiraPage })));
const AmostrasPage = lazy(() => import("./components/pages/Amostras").then((m) => ({ default: m.AmostrasPage })));
const AcompanhamentoObrasPage = lazy(() => import("./components/pages/AcompanhamentoObras").then((m) => ({ default: m.AcompanhamentoObrasPage })));
const OportunidadesSdrPage = lazy(() => import("./components/pages/OportunidadesSdr").then((m) => ({ default: m.OportunidadesSdrPage })));
const OportunidadesDouglasPage = lazy(() => import("./components/pages/OportunidadesDouglas").then((m) => ({ default: m.OportunidadesDouglasPage })));
const SucessoClientePage = lazy(() => import("./components/pages/SucessoCliente").then((m) => ({ default: m.SucessoClientePage })));
const MonitoramentoPage = lazy(() => import("./components/pages/Monitoramento").then((m) => ({ default: m.MonitoramentoPage })));
const MarketingPage = lazy(() => import("./components/pages/Marketing").then((m) => ({ default: m.MarketingPage })));
const ReportPage = lazy(() => import("./components/pages/Report").then((m) => ({ default: m.ReportPage })));
const SocialSellingPage = lazy(() => import("./components/pages/SocialSelling").then((m) => ({ default: m.SocialSellingPage })));
import { TecaAgendamentoNotifier } from "./components/TecaAgendamentoNotifier";

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full p-12 text-hb-textDim">
      <Loader2 size={18} className="animate-spin text-hb-accent mr-2" />
      <span className="text-xs">Carregando…</span>
    </div>
  );
}

/** Rotas que vivem dentro do <Layout> (sidebar + topbar). */
function LayoutRoutes({ appUser }: { appUser: AppUser }) {
  const isAdmin = appUser.role === "admin" || appUser.role === "superadmin";
  return (
    <Route element={<Layout appUser={appUser} />}>
      <Route index element={<Suspense fallback={<PageLoader />}><PregaoPage appUser={appUser} /></Suspense>} />
      <Route path="book/sdr"          element={<Suspense fallback={<PageLoader />}><BookPage kind="sdr" appUser={appUser} /></Suspense>} />
      <Route path="book/vendas"       element={<Suspense fallback={<PageLoader />}><BookPage kind="vendas" appUser={appUser} /></Suspense>} />
      <Route path="funil"             element={<Navigate to="book/sdr" replace />} />
      <Route path="card/:id"          element={<Suspense fallback={<PageLoader />}><CardDetailPage appUser={appUser} /></Suspense>} />
      <Route path="atendimento"       element={<Suspense fallback={<PageLoader />}><AtendimentoPage appUser={appUser} /></Suspense>} />
      <Route path="auditoria"         element={<Suspense fallback={<PageLoader />}><AuditoriaPage appUser={appUser} /></Suspense>} />
      <Route path="agendamentos"      element={<Suspense fallback={<PageLoader />}><AgendamentosPage appUser={appUser} /></Suspense>} />
      <Route path="carteira"          element={<Suspense fallback={<PageLoader />}><CarteiraPage appUser={appUser} /></Suspense>} />
      <Route path="conversas"         element={<Navigate to="atendimento" replace />} />
      <Route path="scripts"           element={<Suspense fallback={<PageLoader />}><ScriptsPage appUser={appUser} /></Suspense>} />
      <Route path="orcamento"         element={<Suspense fallback={<PageLoader />}><OrcamentoPage appUser={appUser} /></Suspense>} />
      <Route path="orcamento/aprovacao" element={<Suspense fallback={<PageLoader />}><OrcamentoAprovacaoPage appUser={appUser} /></Suspense>} />
      <Route path="amostras"          element={<Suspense fallback={<PageLoader />}><AmostrasPage appUser={appUser} /></Suspense>} />
      <Route path="acompanhamento-obras" element={<Suspense fallback={<PageLoader />}><AcompanhamentoObrasPage appUser={appUser} /></Suspense>} />
      <Route path="oportunidades-sdr"   element={<Suspense fallback={<PageLoader />}><OportunidadesSdrPage appUser={appUser} /></Suspense>} />
      <Route path="oportunidades"       element={<Suspense fallback={<PageLoader />}><OportunidadesDouglasPage appUser={appUser} /></Suspense>} />
      <Route path="sucesso-cliente"     element={<Suspense fallback={<PageLoader />}><SucessoClientePage appUser={appUser} /></Suspense>} />
      <Route path="performance"       element={<Suspense fallback={<PageLoader />}><PerformancePage appUser={appUser} /></Suspense>} />
      <Route path="marketing"         element={<Suspense fallback={<PageLoader />}><MarketingPage appUser={appUser} /></Suspense>} />
      <Route path="report"            element={<Suspense fallback={<PageLoader />}><ReportPage appUser={appUser} /></Suspense>} />
      <Route path="social-selling"    element={<Suspense fallback={<PageLoader />}><SocialSellingPage appUser={appUser} /></Suspense>} />
      {/* Rota antiga /raport: o nome estava escrito errado. Redireciona pra não
          quebrar link salvo de quem já usava o relatório. */}
      <Route path="raport"            element={<Navigate to="/report" replace />} />
      <Route path="teca-monitor"      element={<Suspense fallback={<PageLoader />}><TecaMonitorPage appUser={appUser} /></Suspense>} />
      <Route path="monitoramento"     element={<Suspense fallback={<PageLoader />}><MonitoramentoPage appUser={appUser} /></Suspense>} />
      {isAdmin && (
        <Route path="admin/usuarios-comercial" element={<Suspense fallback={<PageLoader />}><AdminUsuariosComercialPage appUser={appUser} /></Suspense>} />
      )}
    </Route>
  );
}

/** Links antigos tinham prefix /:username/ (ex.: /will/card/123). Não é mais
 *  usado — strip do 1º segmento e segue pro path real. */
function LegacyPrefixRedirect() {
  const location = useLocation();
  const rest = location.pathname.replace(/^\/[^/]+/, "");
  return <Navigate to={rest || "/"} replace />;
}

export default function App() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hb-bg text-hb-textDim">
        <Loader2 size={20} className="animate-spin text-hb-accent" />
      </div>
    );
  }

  if (!auth.session || !auth.appUser) {
    return <LoginPage initialError={auth.error} />;
  }

  const appUser = auth.appUser;

  return (
    <CardsProvider>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-hb-bg text-hb-textDim"><Loader2 size={20} className="animate-spin text-hb-accent" /></div>}>
        <Routes>
          {/* Tracking — app fullscreen mobile-first, sem chrome do Homebroker (prestadores). */}
          <Route path="/tracking" element={<Suspense fallback={<PageLoader />}><TrackingPage appUser={appUser} /></Suspense>} />
          <Route path="/tracking/agenda" element={<Suspense fallback={<PageLoader />}><TrackingAgendaPage appUser={appUser} /></Suspense>} />
          <Route path="/tracking/admin" element={<Suspense fallback={<PageLoader />}><TrackingAdminPage appUser={appUser} /></Suspense>} />

          {/* Rotas do app na raiz (sidebar + topbar) */}
          {LayoutRoutes({ appUser })}

          {/* Links antigos /:username/... → strip do prefixo */}
          <Route path="/:username/*" element={<LegacyPrefixRedirect />} />
        </Routes>
      </Suspense>
      <AssignNotifications appUser={appUser} />
      <TecaAgendamentoNotifier />
    </CardsProvider>
  );
}
