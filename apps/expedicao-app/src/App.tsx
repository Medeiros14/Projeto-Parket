import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import { useServiceWorker } from "@/hooks/use-service-worker.ts";
import AuthCallback from "./pages/auth/Callback.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AppLayout } from "./components/layout/app-layout.tsx";
import Dashboard from "./pages/dashboard/page.tsx";
import ProductsPage from "./pages/produtos/page.tsx";
import ClientsPage from "./pages/clientes/page.tsx";
import MovementsPage from "./pages/movimentacoes/page.tsx";
import OrdersPage from "./pages/pedidos/page.tsx";
import OrderDetailPage from "./pages/pedidos/[id]/page.tsx";
import EtiquetaPage from "./pages/pedidos/[id]/etiqueta.tsx";
import InventoryPage from "./pages/inventario/page.tsx";
import InventoryDetailPage from "./pages/inventario/[id]/page.tsx";
import ClienteSemanaPage from "./pages/cliente-semana/page.tsx";
import FrotaPage from "./pages/frota/page.tsx";
import FrotaDashboardPage from "./pages/frota/dashboard/page.tsx";
import FrotaRelatoriosPage from "./pages/frota/relatorios/page.tsx";
import ManutencaoPage from "./pages/frota/manutencao/page.tsx";
import ReportsPage from "./pages/relatorios/page.tsx";
import AgendaPage from "./pages/agenda/page.tsx";
import FretesPage from "./pages/fretes/page.tsx";
import PedidoPublicoPage from "./pages/pedido-publico/page.tsx";
import AcompanhamentoPage from "./pages/acompanhamento/page.tsx";
import ContarInventarioPage from "./pages/inventario/contar/page.tsx";
import MotoristaPage from "./pages/motorista/page.tsx";
import EtiquetaBrancoPage from "./pages/etiqueta-branco/page.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { LandingPage } from "./pages/Index.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export default function App() {
  useServiceWorker();
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/pedido/:id" element={<PedidoPublicoPage />} />
          <Route path="/acompanhamento" element={<AcompanhamentoPage />} />
          <Route path="/motorista" element={<MotoristaPage />} />
          <Route path="/etiqueta-branco" element={<EtiquetaBrancoPage />} />
          <Route path="/inventario/contar/:id" element={<ContarInventarioPage />} />
          <Route
            path="/"
            element={
              <>
                <AuthLoading>
                  <div className="min-h-screen flex items-center justify-center">
                    <Skeleton className="w-48 h-8" />
                  </div>
                </AuthLoading>
                <Unauthenticated>
                  <LandingPage />
                </Unauthenticated>
                <Authenticated>
                  <Navigate to="/dashboard" replace />
                </Authenticated>
              </>
            }
          />
          <Route
            element={
              <Authenticated>
                <AppLayout />
              </Authenticated>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/clientes" element={<ClientsPage />} />
            <Route path="/pedidos" element={<OrdersPage />} />
            <Route path="/pedidos/:id" element={<OrderDetailPage />} />
            <Route path="/pedidos/:id/etiqueta" element={<EtiquetaPage />} />
            <Route path="/movimentacoes" element={<MovementsPage />} />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/inventario/:id" element={<InventoryDetailPage />} />
            <Route path="/relatorios" element={<ReportsPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/fretes" element={<FretesPage />} />
            <Route path="/cliente-semana" element={<ClienteSemanaPage />} />
            <Route path="/frota" element={<FrotaPage />} />
            <Route path="/frota/dashboard" element={<FrotaDashboardPage />} />
            <Route path="/frota/relatorios" element={<FrotaRelatoriosPage />} />
            <Route path="/frota/manutencao" element={<ManutencaoPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
