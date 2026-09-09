import { createBrowserRouter } from "react-router";
import { Home } from "./pages/Home";
import { RootLayout } from "./components/RootLayout";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        index: true,
        Component: Home,
        hydrateFallbackElement: null,
      },
      {
        path: "pisos",
        lazy: () => import("./pages/Pisos").then((m) => ({ Component: m.Pisos })),
      },
      {
        path: "pisos/:slug",
        lazy: () => import("./pages/PisoDetail").then((m) => ({ Component: m.PisoDetail })),
      },
      {
        path: "carvalhos",
        lazy: () => import("./pages/Carvalhos").then((m) => ({ Component: m.Carvalhos })),
      },
      {
        path: "forros",
        lazy: () => import("./pages/Forros").then((m) => ({ Component: m.Forros })),
      },
      {
        path: "paineis",
        lazy: () =>
          import("./pages/Paineis").then((m) => ({ Component: m.Paineis })),
      },
      {
        path: "paineis/:slug",
        lazy: () =>
          import("./pages/PainelDetail").then((m) => ({ Component: m.PainelDetail })),
      },
      {
        path: "decks",
        lazy: () => import("./pages/Decks").then((m) => ({ Component: m.Decks })),
      },
      {
        path: "escadas",
        lazy: () =>
          import("./pages/Escadas").then((m) => ({ Component: m.Escadas })),
      },
      {
        path: "marcenaria",
        lazy: () =>
          import("./pages/Marcenaria").then((m) => ({ Component: m.Marcenaria })),
      },
      {
        path: "portas",
        lazy: () =>
          import("./pages/Portas").then((m) => ({ Component: m.Portas })),
      },
      {
        path: "fachadas",
        lazy: () =>
          import("./pages/Fachadas").then((m) => ({ Component: m.Fachadas })),
      },
      {
        path: "shou-sugi-ban",
        lazy: () =>
          import("./pages/ShouSugiBan").then((m) => ({
            Component: m.ShouSugiBan,
          })),
      },
      {
        path: "spa",
        lazy: () => import("./pages/Spa").then((m) => ({ Component: m.Spa })),
      },
      {
        path: "blog",
        lazy: () =>
          import("./pages/BlogIndex").then((m) => ({ Component: m.BlogIndex })),
      },
      {
        path: "blog/piso-de-madeira-guia",
        lazy: () =>
          import("./pages/blog/PisoDeMadeiraGuia").then((m) => ({
            Component: m.PisoDeMadeiraGuia,
          })),
      },
      {
        path: "blog/forro-de-madeira",
        lazy: () =>
          import("./pages/blog/ForroDeMadeira").then((m) => ({
            Component: m.ForroDeMadeira,
          })),
      },
      {
        path: "blog/deck-de-madeira",
        lazy: () =>
          import("./pages/blog/DeckDeMadeira").then((m) => ({
            Component: m.DeckDeMadeira,
          })),
      },
      {
        path: "blog/escadas-de-madeira",
        lazy: () =>
          import("./pages/blog/EscadasDeMadeira").then((m) => ({
            Component: m.EscadasDeMadeira,
          })),
      },
      {
        path: "blog/marcenaria-arquitetonica",
        lazy: () =>
          import("./pages/blog/MarcenariaArquitetonica").then((m) => ({
            Component: m.MarcenariaArquitetonica,
          })),
      },
      {
        path: "blog/como-escolher-empresa-pisos-madeira",
        lazy: () =>
          import("./pages/blog/ComoEscolherEmpresa").then((m) => ({
            Component: m.ComoEscolherEmpresa,
          })),
      },
      {
        path: "blog/cumaru-vs-ipe",
        lazy: () =>
          import("./pages/blog/CumaruVsIpe").then((m) => ({
            Component: m.CumaruVsIpe,
          })),
      },
      {
        path: "blog/forro-ripado-vs-continuo",
        lazy: () =>
          import("./pages/blog/ForroRipadoVsContinuo").then((m) => ({
            Component: m.ForroRipadoVsContinuo,
          })),
      },
      {
        path: "projetos/apartamentos",
        lazy: () =>
          import("./pages/projetos/Apartamentos").then((m) => ({
            Component: m.Apartamentos,
          })),
      },
      {
        path: "projetos/casas",
        lazy: () =>
          import("./pages/projetos/Casas").then((m) => ({
            Component: m.Casas,
          })),
      },
      {
        path: "projetos/edificios",
        lazy: () =>
          import("./pages/projetos/Edificios").then((m) => ({
            Component: m.Edificios,
          })),
      },
      {
        path: "projetos/hoteis",
        lazy: () =>
          import("./pages/projetos/Hoteis").then((m) => ({
            Component: m.Hoteis,
          })),
      },
      {
        path: "projetos/lojas",
        lazy: () =>
          import("./pages/projetos/Lojas").then((m) => ({
            Component: m.Lojas,
          })),
      },
      {
        path: "projetos/escritorios",
        lazy: () =>
          import("./pages/projetos/Escritorios").then((m) => ({
            Component: m.Escritorios,
          })),
      },
      {
        path: "projetos/restaurantes",
        lazy: () =>
          import("./pages/projetos/Restaurantes").then((m) => ({
            Component: m.Restaurantes,
          })),
      },
      {
        path: "projetos/museus",
        lazy: () =>
          import("./pages/projetos/Museus").then((m) => ({
            Component: m.Museus,
          })),
      },
      {
        path: "projetos/mostras",
        lazy: () =>
          import("./pages/projetos/Mostras").then((m) => ({
            Component: m.Mostras,
          })),
      },
      {
        path: "projetos/paineis",
        lazy: () =>
          import("./pages/projetos/PaineisProject").then((m) => ({
            Component: m.PaineisProject,
          })),
      },
    ],
  },
]);