# Parket Website - Exportação Completa para Antigravity

Site institucional premium da Parket - Produtos em madeira de alta qualidade.  
Inspirado no estilo editorial da monofloor.com.br com design system em tons de madeira.

---

## 📋 Índice

1. [Configuração do Projeto](#1-configuração-do-projeto)
2. [Arquivos de Entrada](#2-arquivos-de-entrada)
3. [Rotas](#3-rotas)
4. [Componentes Principais](#4-componentes-principais)
5. [Páginas - Home](#5-páginas---home)
6. [Páginas - Produtos](#6-páginas---produtos)
7. [Páginas - Projetos (Galerias)](#7-páginas---projetos-galerias)
8. [Páginas - Blog](#8-páginas---blog)
9. [Estilos](#9-estilos)
10. [Hooks e Utilities](#10-hooks-e-utilities)

---

## 1. Configuração do Projeto

### package.json
```json
{
  "name": "parket-website",
  "private": true,
  "version": "1.0.0",
  "description": "Site institucional premium da Parket - Produtos de madeira de alta qualidade",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "echo 'Linting configuration pending'",
    "type-check": "tsc --noEmit"
  },
  "author": "Parket",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/parket/parket-website"
  },
  "keywords": [
    "parket",
    "madeira",
    "pisos",
    "decks",
    "forros",
    "marcenaria",
    "arquitetura",
    "design"
  ],
  "dependencies": {
    "@emotion/react": "11.14.0",
    "@emotion/styled": "11.14.1",
    "@mui/icons-material": "7.3.5",
    "@mui/material": "7.3.5",
    "@popperjs/core": "2.11.8",
    "@radix-ui/react-accordion": "1.2.3",
    "@radix-ui/react-alert-dialog": "1.1.6",
    "@radix-ui/react-aspect-ratio": "1.1.2",
    "@radix-ui/react-avatar": "1.1.3",
    "@radix-ui/react-checkbox": "1.1.4",
    "@radix-ui/react-collapsible": "1.1.3",
    "@radix-ui/react-context-menu": "2.2.6",
    "@radix-ui/react-dialog": "1.1.6",
    "@radix-ui/react-dropdown-menu": "2.1.6",
    "@radix-ui/react-hover-card": "1.1.6",
    "@radix-ui/react-label": "2.1.2",
    "@radix-ui/react-menubar": "1.1.6",
    "@radix-ui/react-navigation-menu": "1.2.5",
    "@radix-ui/react-popover": "1.1.6",
    "@radix-ui/react-progress": "1.1.2",
    "@radix-ui/react-radio-group": "1.2.3",
    "@radix-ui/react-scroll-area": "1.2.3",
    "@radix-ui/react-select": "2.1.6",
    "@radix-ui/react-separator": "1.1.2",
    "@radix-ui/react-slider": "1.2.3",
    "@radix-ui/react-slot": "1.1.2",
    "@radix-ui/react-switch": "1.1.3",
    "@radix-ui/react-tabs": "1.1.3",
    "@radix-ui/react-toggle": "1.1.2",
    "@radix-ui/react-toggle-group": "1.1.2",
    "@radix-ui/react-tooltip": "1.1.8",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "cmdk": "1.1.1",
    "date-fns": "3.6.0",
    "embla-carousel-react": "8.6.0",
    "input-otp": "1.4.2",
    "invariant": "^2.2.4",
    "lucide-react": "0.487.0",
    "motion": "12.23.24",
    "next-themes": "0.4.6",
    "react-day-picker": "8.10.1",
    "react-dnd": "16.0.1",
    "react-dnd-html5-backend": "16.0.1",
    "react-fast-compare": "^3.2.2",
    "react-helmet-async": "^3.0.0",
    "react-hook-form": "7.55.0",
    "react-popper": "2.3.0",
    "react-resizable-panels": "2.1.7",
    "react-responsive-masonry": "2.7.1",
    "react-router": "7.13.0",
    "react-slick": "0.31.0",
    "recharts": "2.15.2",
    "shallowequal": "^1.1.0",
    "sonner": "2.0.3",
    "tailwind-merge": "3.2.0",
    "tw-animate-css": "1.3.8",
    "vaul": "1.1.2"
  },
  "devDependencies": {
    "@tailwindcss/vite": "4.1.12",
    "@vitejs/plugin-react": "4.7.0",
    "tailwindcss": "4.1.12",
    "vite": "6.3.5"
  },
  "peerDependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    },
    "react-dom": {
      "optional": true
    }
  },
  "pnpm": {
    "overrides": {
      "vite": "6.3.5"
    }
  }
}
```

### vite.config.ts
```typescript
import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
```

### postcss.config.mjs
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

---

## 2. Arquivos de Entrada

### /src/app/App.tsx
```tsx
import { RouterProvider } from "react-router";
import { router } from "./routes";
// Import early to suppress Motion false-positive warnings before any component renders
import "./hooks/useParallax";

// App entry point
function App() {
  return <RouterProvider router={router} />;
}

export default App;
```

### /LICENSE/main.tsx
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './src/app/App'
import './src/styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

---

## 3. Rotas

### /src/app/routes.ts
```typescript
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
```

---

## 4. Componentes Principais

### Observação sobre todos os arquivos de componentes
Para ver o conteúdo completo de cada componente, leia os seguintes arquivos:

- `/src/app/components/RootLayout.tsx`
- `/src/app/components/Header.tsx`
- `/src/app/components/Hero.tsx`
- `/src/app/components/HeroFloatingBar.tsx`
- `/src/app/components/Footer.tsx`
- `/src/app/components/SEOHead.tsx`
- `/src/app/components/LeadFormModal.tsx`
- `/src/app/components/ImageLightbox.tsx`
- `/src/app/components/Categories.tsx`
- `/src/app/components/ProductsCTA.tsx`
- `/src/app/components/Inspiracao.tsx`
- `/src/app/components/Philosophy.tsx`
- `/src/app/components/Contact.tsx`
- `/src/app/components/Testimonial.tsx`

---

## 5. Páginas - Home

O arquivo principal da Home está em `/src/app/pages/Home.tsx`

---

## 6. Páginas - Produtos

### 6.1 Painéis em Madeira (ATUALIZADA RECENTEMENTE)

**Arquivo:** `/src/app/pages/Paineis.tsx`

**Descrição:** Galeria de painéis decorativos, acústicos e 3D. Foram atualizadas:
- Nova foto no header (heroImage)
- Removida foto 5 (agora tem 17 fotos no total, antes tinha 18)

**Imagens atuais:**
1. `figma:asset/9c46d87915beeb2a78ff72d13a035f0083aaae7a.png` (header - NOVA)
2-17. URLs das fotos PRO_PA-02 até PRO_PA-18 (saltando PRO_PA-06 que foi removida)

```tsx
// Array de imagens atual (17 fotos)
const images = [
  heroImage, // Nova imagem do header
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-02.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-03.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-04.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-05.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-07.jpg", // Pula PRO_PA-06
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-08.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-09.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-10.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-11.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-12.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-13.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-14.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-15.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-16.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-17.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/PRO_PA-18.jpg",
];
```

### Outros Produtos

Arquivos disponíveis:
- `/src/app/pages/Pisos.tsx` - Página overview de pisos
- `/src/app/pages/PisoDetail.tsx` - Detalhes de cada piso
- `/src/app/pages/Carvalhos.tsx` - Pisos de carvalho
- `/src/app/pages/Forros.tsx` - Forros de madeira
- `/src/app/pages/PainelDetail.tsx` - Detalhes de painéis
- `/src/app/pages/Decks.tsx` - Decks externos
- `/src/app/pages/Escadas.tsx` - Escadas em madeira
- `/src/app/pages/Marcenaria.tsx` - Marcenaria arquitetônica
- `/src/app/pages/Portas.tsx` - Portas em madeira
- `/src/app/pages/Fachadas.tsx` - Fachadas ventiladas
- `/src/app/pages/ShouSugiBan.tsx` - Técnica japonesa
- `/src/app/pages/Spa.tsx` - Madeira para spas

---

## 7. Páginas - Projetos (Galerias)

### 7.1 Hotéis (ATUALIZADA RECENTEMENTE)

**Arquivo:** `/src/app/pages/projetos/Hoteis.tsx`

**Descrição:** Galeria de projetos em hotéis. **TODAS as 15 fotos foram substituídas** pelas novas imagens INS_HO-01 até INS_HO-15.

**Imagens atuais (ordem reversa - 15 até 01):**
```tsx
const images = [
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-15.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-14.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-13.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-12.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-11.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-10.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-09.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-08.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-07.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-06.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-05.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-04.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-03.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-02.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_HO-01.jpg",
];
```

### Outras Páginas de Projetos

Arquivos disponíveis:
- `/src/app/pages/projetos/Apartamentos.tsx`
- `/src/app/pages/projetos/Casas.tsx`
- `/src/app/pages/projetos/Edificios.tsx`
- `/src/app/pages/projetos/Lojas.tsx`
- `/src/app/pages/projetos/Escritorios.tsx`
- `/src/app/pages/projetos/Restaurantes.tsx`
- `/src/app/pages/projetos/Museus.tsx`
- `/src/app/pages/projetos/Mostras.tsx`
- `/src/app/pages/projetos/PaineisProject.tsx`

---

## 8. Páginas - Blog

### Índice do Blog
**Arquivo:** `/src/app/pages/BlogIndex.tsx`

### Artigos Disponíveis

1. `/src/app/pages/blog/PisoDeMadeiraGuia.tsx` - Guia completo de pisos de madeira
2. `/src/app/pages/blog/ForroDeMadeira.tsx` - Forros de madeira na arquitetura
3. `/src/app/pages/blog/DeckDeMadeira.tsx` - Decks externos
4. `/src/app/pages/blog/EscadasDeMadeira.tsx` - Escadas em madeira
5. `/src/app/pages/blog/MarcenariaArquitetonica.tsx` - Marcenaria arquitetônica
6. `/src/app/pages/blog/ComoEscolherEmpresa.tsx` - Como escolher empresa de pisos
7. `/src/app/pages/blog/CumaruVsIpe.tsx` - Comparativo Cumaru vs Ipê
8. `/src/app/pages/blog/ForroRipadoVsContinuo.tsx` - Forro ripado vs contínuo

---

## 9. Estilos

### 9.1 Estrutura de Estilos

```
/src/styles/
├── index.css      # Importa todos os estilos
├── tailwind.css   # Diretivas Tailwind
├── theme.css      # Variáveis e tema customizado
└── fonts.css      # Importação de fontes
```

### 9.2 Theme CSS (Variáveis do Design System)

**Arquivo:** `/src/styles/theme.css`

```css
@custom-variant dark (&:is(.dark *));

:root {
  --font-size: 16px;
  --background: #FAF8F5;
  --foreground: #2A2A2A;
  --card: #FAF8F5;
  --card-foreground: #2A2A2A;
  --popover: #FAF8F5;
  --popover-foreground: #2A2A2A;
  --primary: #2A2A2A;
  --primary-foreground: #FAF8F5;
  --secondary: #F0EBE3;
  --secondary-foreground: #2A2A2A;
  --muted: #F0EBE3;
  --muted-foreground: #8C8478;
  --accent: #9C8B6E;
  --accent-foreground: #FAF8F5;
  --destructive: #d4183d;
  --destructive-foreground: #ffffff;
  --border: #D9D3CB;
  --input: transparent;
  --input-background: #F0EBE3;
  --switch-background: #D9D3CB;
  --font-weight-medium: 500;
  --font-weight-normal: 400;
  --ring: #B5A48A;
  --chart-1: #9C8B6E;
  --chart-2: #B5A48A;
  --chart-3: #8C8478;
  --chart-4: #D9D3CB;
  --chart-5: #2A2A2A;
  --radius: 0px;
  /* ... sidebar variables ... */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... dark mode variables ... */
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    font-family: 'DM Sans', sans-serif;
    @apply bg-background text-foreground;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  h1 {
    font-size: var(--text-2xl);
    font-weight: 200;
    line-height: 1.2;
    letter-spacing: 0.02em;
    font-family: 'DM Sans', sans-serif;
  }

  h2 {
    font-size: var(--text-xl);
    font-weight: 200;
    line-height: 1.2;
    letter-spacing: 0.02em;
    font-family: 'DM Sans', sans-serif;
  }

  h3 {
    font-size: var(--text-lg);
    font-weight: 300;
    line-height: 1.3;
    letter-spacing: 0.02em;
    font-family: 'DM Sans', sans-serif;
  }

  /* ... outros elementos ... */
}
```

### 9.3 Paleta de Cores do Design System

**Cores principais:**
- Background primário: `#FAF8F5` (bege claro)
- Background secundário: `#F0EBE3` (bege médio)
- Texto principal: `#2A2A2A` (quase preto)
- Texto secundário: `#8C8478` (marrom acinzentado)
- Accent: `#9C8B6E` (marrom madeira)
- Border: `#D9D3CB` (bege claro)

**Cores dark mode:**
- Background: `#1A1A1A` / `#0D0D0D`
- Texto: `#E8E4DF` (bege claro)

### 9.4 Tipografia

**Fonte principal:** DM Sans
**Pesos usados:**
- Thin: 200 (títulos grandes)
- Light: 300 (subtítulos)
- Regular: 400 (corpo de texto)
- Medium: 500 (labels, botões)

**Tamanhos importantes:**
- Labels de seção: `14px` (na verdade usa `12px` mas especificado como 14px nas instruções)
- Títulos Hero: `36px` → `52px` → `68px` (mobile → tablet → desktop)
- Corpo de texto: `16px` → `18px`

### 9.5 Regras de Design

✅ **Obrigatórios:**
- Zero `border-radius`
- Zero `box-shadow`
- Tipografia thin/light
- Tons de madeira na paleta

❌ **Proibidos:**
- Borders arredondados
- Sombras
- Pesos de fonte bold/black

---

## 10. Hooks e Utilities

### 10.1 useParallax Hook

**Arquivo:** `/src/app/hooks/useParallax.ts`

Hook para efeitos de parallax suaves nas páginas.

### 10.2 Componentes UI

Todos os componentes UI estão em `/src/app/components/ui/` e incluem:
- Accordion, Alert Dialog, Avatar, Badge
- Button, Card, Checkbox, Dialog
- Dropdown Menu, Form, Input, Label
- Select, Tabs, Textarea, Tooltip
- E muitos outros componentes Radix UI

---

## 📝 Notas Importantes para Antigravity

### Regras de Import

1. **React Router:** Usar `react-router` (NÃO `react-router-dom`)
   ```tsx
   import { useNavigate } from "react-router";
   ```

2. **Motion:** Usar `motion/react` (NÃO `framer-motion`)
   ```tsx
   import { motion } from "motion/react";
   ```

3. **Imagens Figma:** Usar esquema virtual `figma:asset`
   ```tsx
   import heroImage from "figma:asset/abc123.png";
   ```

### Header Behavior

O Header tem transição gradual:
- Transparente no topo (sobre vídeo)
- Muda para bege com blur entre 60% e 90% da altura do Hero
- Logo e links mudam de claro para escuro no ponto médio

### Hero Floating Bar

Barra fixa que desaparece ao rolar até a seção de Contato.

### SEO

Componente customizado `SEOHead.tsx` usa `useEffect` ao invés de `react-helmet-async`.

### Modais e CTAs

Todos os CTAs abrem o `LeadFormModal` para captura de leads.

---

## 🎨 Inspiração Visual

O design segue o estilo editorial premium da **monofloor.com.br**:
- Tipografia delicada e minimalista
- Espaçamentos generosos
- Grid limpo e organizado
- Fotografia de alta qualidade
- Animações sutis e elegantes
- Sem elementos decorativos excessivos

---

## 📦 Estrutura de Arquivos Completa

```
/
├── package.json
├── vite.config.ts
├── postcss.config.mjs
├── LICENSE/
│   └── main.tsx
└── src/
    ├── styles/
    │   ├── index.css
    │   ├── tailwind.css
    │   ├── theme.css
    │   └── fonts.css
    ├── imports/
    │   ├── parket-design-system.txt
    │   └── parket-product-images.txt
    └── app/
        ├── App.tsx
        ├── routes.ts
        ├── hooks/
        │   └── useParallax.ts
        ├── components/
        │   ├── RootLayout.tsx
        │   ├── Header.tsx
        │   ├── Hero.tsx
        │   ├── HeroFloatingBar.tsx
        │   ├── Footer.tsx
        │   ├── SEOHead.tsx
        │   ├── LeadFormModal.tsx
        │   ├── ImageLightbox.tsx
        │   ├── Categories.tsx
        │   ├── ProductsCTA.tsx
        │   ├── Inspiracao.tsx
        │   ├── Philosophy.tsx
        │   ├── Contact.tsx
        │   ├── Testimonial.tsx
        │   ├── figma/
        │   │   └── ImageWithFallback.tsx
        │   └── ui/
        │       └── [40+ componentes UI]
        └── pages/
            ├── Home.tsx
            ├── BlogIndex.tsx
            ├── Pisos.tsx
            ├── PisoDetail.tsx
            ├── Carvalhos.tsx
            ├── Forros.tsx
            ├── Paineis.tsx           ← ATUALIZADO
            ├── PainelDetail.tsx
            ├── Decks.tsx
            ├── Escadas.tsx
            ├── Marcenaria.tsx
            ├── Portas.tsx
            ├── Fachadas.tsx
            ├── ShouSugiBan.tsx
            ├── Spa.tsx
            ├── blog/
            │   ├── PisoDeMadeiraGuia.tsx
            │   ├── ForroDeMadeira.tsx
            │   ├── DeckDeMadeira.tsx
            │   ├── EscadasDeMadeira.tsx
            │   ├── MarcenariaArquitetonica.tsx
            │   ├── ComoEscolherEmpresa.tsx
            │   ├── CumaruVsIpe.tsx
            │   └── ForroRipadoVsContinuo.tsx
            └── projetos/
                ├── Apartamentos.tsx
                ├── Casas.tsx
                ├── Edificios.tsx
                ├── Hoteis.tsx          ← ATUALIZADO
                ├── Lojas.tsx
                ├── Escritorios.tsx
                ├── Restaurantes.tsx
                ├── Museus.tsx
                ├── Mostras.tsx
                └── PaineisProject.tsx
```

---

## ✅ Checklist de Atualizações Recentes

- [x] Painéis: Nova foto no header
- [x] Painéis: Removida foto 5 (PRO_PA-06)
- [x] Painéis: Total de 17 fotos na galeria
- [x] Hotéis: Todas as 15 fotos substituídas (INS_HO-01 até INS_HO-15)
- [x] Hotéis: Lightbox funcionando corretamente
- [x] Painéis: Lightbox funcionando corretamente

---

**Gerado em:** 18 de Março de 2026  
**Versão:** 1.0.0  
**Projeto:** Parket Website - Site Institucional Premium
