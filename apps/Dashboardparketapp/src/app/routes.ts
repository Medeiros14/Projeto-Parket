import React from "react";
import { createBrowserRouter, Outlet, Navigate, useLocation, useRouteError } from "react-router";
import { useAuth } from "./contexts/AuthContext";

/* ─── Erro de rota — detecta chunk load e recarrega ─── */
function RouteErrorBoundary() {
  const error = useRouteError() as Error | null;
  const msg = String((error as any)?.message ?? error ?? "");
  const isChunk = msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("ChunkLoadError") || msg.includes("Importing a module script failed");

  React.useEffect(() => {
    if (isChunk) {
      const key = "__chunk_reload__";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }
  }, [isChunk]);

  if (isChunk) {
    return React.createElement(
      "div",
      { className: "min-h-screen flex items-center justify-center", style: { background: "#0A0A0A" } },
      React.createElement(
        "div",
        { className: "flex flex-col items-center gap-3" },
        React.createElement("div", { className: "w-8 h-8 border-2 border-[#D4A853]/30 border-t-[#D4A853] rounded-full animate-spin" }),
        React.createElement("span", { style: { fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em" } }, "ATUALIZANDO…")
      )
    );
  }

  return React.createElement(
    "div",
    { className: "min-h-screen flex items-center justify-center", style: { background: "#0A0A0A" } },
    React.createElement(
      "div",
      { className: "flex flex-col items-center gap-4 px-6 text-center" },
      React.createElement("p", { style: { color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" } }, "Erro ao carregar a página."),
      React.createElement(
        "button",
        {
          onClick: () => window.location.reload(),
          style: { background: "rgba(184,170,154,0.15)", border: "1px solid rgba(184,170,154,0.3)", color: "#B8AA9A", padding: "6px 16px", borderRadius: "6px", fontSize: "0.7rem", cursor: "pointer" }
        },
        "RECARREGAR"
      )
    )
  );
}

/* ─── Loading screen ─── */
function LoadingScreen() {
  return React.createElement(
    "div",
    { className: "min-h-screen flex items-center justify-center", style: { background: "#0A0A0A" } },
    React.createElement(
      "div",
      { className: "flex flex-col items-center gap-3" },
      React.createElement("div", { className: "w-8 h-8 border-2 border-[#D4A853]/30 border-t-[#D4A853] rounded-full animate-spin" }),
      React.createElement("span", { style: { fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em" } }, "CARREGANDO…")
    )
  );
}

/* ─── Root layout ─── */
function RootLayout() {
  return React.createElement(Outlet);
}

function HydrateFallback() {
  return LoadingScreen();
}

/* ─── Auth guards ─── */
function RequireAuth() {
  const { user, loading, isProjetista } = useAuth();
  const location = useLocation();
  if (loading) return LoadingScreen();
  if (!user) return React.createElement(Navigate, { to: "/login", state: { from: location }, replace: true });
  // Projetistas só podem acessar /meu-painel
  if (isProjetista && location.pathname !== "/meu-painel") {
    return React.createElement(Navigate, { to: "/meu-painel", replace: true });
  }
  return React.createElement(Outlet);
}

function RequireProjetista() {
  const { user, loading, isProjetista } = useAuth();
  if (loading) return LoadingScreen();
  if (!user) return React.createElement(Navigate, { to: "/login", replace: true });
  if (!isProjetista) return React.createElement(Navigate, { to: "/", replace: true });
  return React.createElement(Outlet);
}

function RequireSuperAdmin() {
  const { user, loading, isSuperAdmin } = useAuth();
  const location = useLocation();
  if (loading) return LoadingScreen();
  if (!user) return React.createElement(Navigate, { to: "/login", state: { from: location }, replace: true });
  if (!isSuperAdmin) return React.createElement(Navigate, { to: "/", replace: true });
  return React.createElement(Outlet);
}

/* ─── Router ─── */
const E = React.createElement(RouteErrorBoundary);

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    HydrateFallback,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      /* Public */
      {
        path: "login",
        errorElement: E,
        async lazy() {
          const { LoginPage } = await import("./pages/login-page");
          return { Component: LoginPage };
        },
      },
      {
        path: "solicitar-compras",
        errorElement: E,
        async lazy() {
          const { SolicitarComprasPage } = await import("./pages/solicitar-compras-page");
          return { Component: SolicitarComprasPage };
        },
      },
      {
        path: "proposta/:id",
        errorElement: E,
        async lazy() {
          const { PropostaPublicaPage } = await import("./pages/proposta-publica-page");
          return { Component: PropostaPublicaPage };
        },
      },

      /* Projetista — requires projetista role */
      {
        Component: RequireProjetista,
        ErrorBoundary: RouteErrorBoundary,
        children: [
          {
            path: "meu-painel",
            errorElement: E,
            async lazy() {
              const { ProjetistaPage } = await import("./pages/projetista-page");
              return { Component: ProjetistaPage };
            },
          },
        ],
      },

      /* Protected — requires auth */
      {
        Component: RequireAuth,
        ErrorBoundary: RouteErrorBoundary,
        children: [
          {
            index: true,
            errorElement: E,
            async lazy() {
              const { SistemaOpsPage } = await import("./pages/sistema-ops-page");
              return { Component: SistemaOpsPage };
            },
          },
          {
            path: "ceo-dashboard",
            errorElement: E,
            async lazy() {
              const { CeoDashboardPage } = await import("./pages/ceo-dashboard-page");
              return { Component: CeoDashboardPage };
            },
          },
          { path: "comercial/*",    errorElement: E, async lazy() { const { DeptComercialPage }  = await import("./pages/dept-comercial");  return { Component: DeptComercialPage };  } },
          { path: "projetos/*",     errorElement: E, async lazy() { const { DeptProjetosPage }   = await import("./pages/dept-projetos");   return { Component: DeptProjetosPage };   } },
          { path: "compras/*",      errorElement: E, async lazy() { const { DeptComprasPage }    = await import("./pages/dept-compras");    return { Component: DeptComprasPage };    } },
          { path: "producao/*",     errorElement: E, async lazy() { const { DeptProducaoPage }   = await import("./pages/dept-producao");   return { Component: DeptProducaoPage };   } },
          { path: "logistica/*",    errorElement: E, async lazy() { const { DeptLogisticaPage }  = await import("./pages/dept-logistica");  return { Component: DeptLogisticaPage };  } },
          { path: "obras/*",        errorElement: E, async lazy() { const { DeptObrasPage }      = await import("./pages/dept-obras");      return { Component: DeptObrasPage };      } },
          { path: "financeiro/*",   errorElement: E, async lazy() { const { DeptFinanceiroPage } = await import("./pages/dept-financeiro"); return { Component: DeptFinanceiroPage }; } },
          { path: "atendimento/*",  errorElement: E, async lazy() { const { DeptAtendimentoPage }= await import("./pages/dept-atendimento");return { Component: DeptAtendimentoPage };} },
          { path: "fiscal/*",       errorElement: E, async lazy() { const { DeptFiscalPage }     = await import("./pages/dept-fiscal");     return { Component: DeptFiscalPage };     } },
          { path: "operacional/*", errorElement: E, async lazy() { const { DeptOperacionalPage } = await import("./pages/dept-operacional"); return { Component: DeptOperacionalPage }; } },
          { path: "pmo", element: React.createElement(Navigate, { to: "/produtividade", replace: true }) },
          { path: "produtividade/*",errorElement: E, async lazy() { const { DeptPmoPage }        = await import("./pages/dept-pmo");        return { Component: DeptPmoPage };        } },
          { path: "marketing/*",    errorElement: E, async lazy() { const { DeptMarketingPage }  = await import("./pages/dept-marketing");  return { Component: DeptMarketingPage };  } },
          { path: "rh/*",           errorElement: E, async lazy() { const { DeptRhPage }         = await import("./pages/dept-rh");         return { Component: DeptRhPage };         } },
          { path: "orcamento/*",    errorElement: E, async lazy() { const { DeptOrcamentoPage }  = await import("./pages/dept-orcamento");  return { Component: DeptOrcamentoPage };  } },
          { path: "ia/*",           errorElement: E, async lazy() { const { DeptIaPage }         = await import("./pages/dept-ia");         return { Component: DeptIaPage };         } },
          { path: "layout/*",       errorElement: E, async lazy() { const { DeptLayoutPage }     = await import("./pages/dept-layout-page"); return { Component: DeptLayoutPage };     } },
          { path: "obra/:id",       errorElement: E, async lazy() { const { ProjetoDetalhePage } = await import("./pages/projeto-detalhe-page"); return { Component: ProjetoDetalhePage }; } },
          { path: "geral/*",        errorElement: E, async lazy() { const { GeralPage }          = await import("./pages/geral-page");      return { Component: GeralPage };          } },
          { path: "central-do-cliente",     errorElement: E, async lazy() { const { CentralClientesPage }  = await import("./pages/central-do-cliente-page"); return { Component: CentralClientesPage };  } },
          { path: "central-do-cliente/:id", errorElement: E, async lazy() { const { ProjetoDetalhePage }   = await import("./pages/projeto-detalhe-page");    return { Component: ProjetoDetalhePage };   } },

          /* Super Admin only */
          {
            Component: RequireSuperAdmin,
            children: [
              {
                path: "admin/usuarios",
                async lazy() {
                  const { AdminUsersPage } = await import("./pages/admin-users-page");
                  return { Component: AdminUsersPage };
                },
              },
            ],
          },
        ],
      },
    ],
  },
]);
