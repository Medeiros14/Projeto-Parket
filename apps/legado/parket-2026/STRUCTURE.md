# Estrutura do Projeto - Parket Website

Documentação completa da estrutura de arquivos e organização do código.

## 📂 Árvore de Diretórios

```
parket-website/
├── .github/                    # GitHub configuration
│   └── workflows/              # CI/CD pipelines
├── .vscode/                    # VSCode configuration
│   ├── extensions.json         # Recommended extensions
│   └── settings.json           # Workspace settings
├── public/                     # Static assets
│   ├── images/                 # Public images
│   └── fonts/                  # Public fonts
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── sections/       # Home page sections
│   │   │   │   ├── Hero.tsx
│   │   │   │   ├── About.tsx
│   │   │   │   ├── Categories.tsx
│   │   │   │   ├── Revestimentos.tsx
│   │   │   │   ├── ProductsCTA.tsx
│   │   │   │   ├── Inspiracao.tsx
│   │   │   │   ├── Philosophy.tsx
│   │   │   │   ├── Testimonial.tsx
│   │   │   │   ├── Blog.tsx
│   │   │   │   └── Contact.tsx
│   │   │   ├── shared/         # Shared components
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── SEOHead.tsx
│   │   │   │   └── FloatingCTA.tsx
│   │   │   ├── modals/         # Modals and overlays
│   │   │   │   ├── LeadFormModal.tsx
│   │   │   │   └── ImageLightbox.tsx
│   │   │   ├── layouts/        # Layout components
│   │   │   │   ├── BlogArticleLayout.tsx
│   │   │   │   └── CollectionDetail.tsx
│   │   │   ├── ui/             # Design system primitives
│   │   │   │   ├── button.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   └── ...
│   │   │   └── figma/          # Figma imports
│   │   │       └── ImageWithFallback.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx        # Homepage
│   │   │   ├── BlogIndex.tsx   # Blog listing
│   │   │   ├── products/       # Product pages
│   │   │   │   ├── Pisos.tsx
│   │   │   │   ├── Decks.tsx
│   │   │   │   ├── Forros.tsx
│   │   │   │   ├── Paineis.tsx
│   │   │   │   ├── Portas.tsx
│   │   │   │   ├── Escadas.tsx
│   │   │   │   ├── Fachadas.tsx
│   │   │   │   ├── Marcenaria.tsx
│   │   │   │   ├── ShouSugiBan.tsx
│   │   │   │   └── Spa.tsx
│   │   │   └── blog/           # Blog articles
│   │   │       ├── PisoDeMadeiraGuia.tsx
│   │   │       ├── DeckDeMadeira.tsx
│   │   │       ├── CumaruVsIpe.tsx
│   │   │       ├── EscadasDeMadeira.tsx
│   │   │       ├── ForroDeMadeira.tsx
│   │   │       ├── ForroRipadoVsContinuo.tsx
│   │   │       ├── MarcenariaArquitetonica.tsx
│   │   │       └── ComoEscolherEmpresa.tsx
│   │   ├── hooks/              # Custom React hooks
│   │   │   └── useParallax.ts
│   │   ├── routes.ts           # React Router configuration
│   │   └── App.tsx             # Root component
│   ├── styles/
│   │   ├── index.css           # Global styles
│   │   ├── theme.css           # CSS variables & theme
│   │   ├── fonts.css           # Font imports
│   │   └── tailwind.css        # Tailwind v4 config
│   └── imports/                # Figma imports & assets
│       ├── parket-design-system.txt
│       ├── parket-product-images.txt
│       └── ...
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
├── ATTRIBUTIONS.md             # Third-party attributions
├── CHANGELOG.md                # Version history
├── CONTRIBUTING.md             # Contribution guidelines
├── DEPLOY.md                   # Deployment guide
├── LICENSE                     # MIT License
├── README.md                   # Project overview
├── STRUCTURE.md                # This file
├── TECHNICAL.md                # Technical documentation
├── TODO.md                     # Task list
├── package.json                # Dependencies
├── postcss.config.mjs          # PostCSS configuration
├── tsconfig.json               # TypeScript configuration
└── vite.config.ts              # Vite configuration
```

## 🏗️ Arquitetura de Componentes

### Hierarquia

```
App.tsx (RouterProvider + HelmetProvider)
├── Header (fixed navigation)
├── RouterOutlet
│   ├── Home
│   │   ├── Hero
│   │   ├── About
│   │   ├── Categories
│   │   ├── Revestimentos
│   │   ├── ProductsCTA
│   │   ├── Inspiracao
│   │   ├── Philosophy
│   │   ├── Testimonial
│   │   ├── Blog
│   │   └── Contact
│   ├── Product Pages
│   │   ├── CollectionDetail
│   │   ├── ImageLightbox
│   │   └── Specs
│   └── Blog Pages
│       └── BlogArticleLayout
├── Footer
├── FloatingCTA (conditional)
└── LeadFormModal (conditional)
```

## 📝 Convenções de Nomenclatura

### Arquivos

- **Componentes**: `PascalCase.tsx` (ex: `Hero.tsx`, `LeadFormModal.tsx`)
- **Hooks**: `camelCase.ts` com prefixo `use` (ex: `useParallax.ts`)
- **Utilitários**: `camelCase.ts` (ex: `utils.ts`)
- **Estilos**: `kebab-case.css` (ex: `theme.css`, `fonts.css`)
- **Tipos**: `PascalCase.ts` ou inline (ex: `types.ts`)

### Componentes

```typescript
// Functional component com TypeScript
interface HeroProps {
  title: string;
  subtitle?: string;
}

export function Hero({ title, subtitle }: HeroProps) {
  // Component logic
  return (
    <section>
      {/* JSX */}
    </section>
  );
}
```

### Hooks

```typescript
// Custom hook
export function useParallax(speed = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  // Hook logic
  return { ref, y };
}
```

## 🎨 Sistema de Design

### Hierarquia de Componentes UI

```
ui/ (componentes base do design system)
├── Primitives (Radix UI)
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   └── ...
└── Composed (componentes compostos)
    ├── accordion.tsx
    ├── card.tsx
    └── ...
```

### Variáveis CSS

Todas as variáveis de design estão em `/src/styles/theme.css`:

```css
:root {
  /* Colors */
  --color-primary: #8B7355;
  --color-secondary: #A0826D;
  --color-accent: #6B5444;
  --bg-dark: #1A1A1A;
  --bg-darker: #0D0D0D;
  
  /* Typography */
  --font-sans: system-ui, sans-serif;
  
  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  /* ... */
}
```

## 🔄 Fluxo de Dados

### Rotas

```typescript
// routes.ts
createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/produtos/:category",
    Component: ProductPage,
  },
  {
    path: "/blog/:slug",
    Component: BlogArticle,
  },
])
```

### Estado Global

- **React Context**: Não utilizado (estado local suficiente)
- **URL State**: React Router para navegação
- **Local State**: `useState` para interações

### Props Drilling

Minimizado através de:
- Composição de componentes
- Context quando necessário
- Props específicas por componente

## 📦 Imports

### Ordem de Imports

```typescript
// 1. External libraries
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";

// 2. Internal hooks
import { useParallax } from "../hooks/useParallax";

// 3. Internal components
import { Button } from "./ui/button";
import { Header } from "./shared/Header";

// 4. Types
import type { ProductProps } from "../types";

// 5. Assets
import logo from "../assets/logo.svg";
import styles from "./Component.module.css";
```

### Alias de Imports

```typescript
// Configurado em tsconfig.json
import { Button } from "@/components/ui/button";  // Não usado atualmente
import { Button } from "./components/ui/button";  // Padrão atual
```

## 🎭 Padrões de Animação

### Motion/Framer Motion

```typescript
// Initial + Animate
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6 }}
/>

// Scroll-driven
const { ref, opacity, y } = useScrollReveal();
<motion.div ref={ref} style={{ opacity, y }} />

// Parallax
const { ref, y } = useParallax(0.15);
<motion.div ref={ref} style={{ y }} />
```

## 🔐 Segurança

### Proteção de Arquivos

```
protected_files/
├── /src/app/components/figma/ImageWithFallback.tsx
└── /pnpm-lock.yaml
```

Estes arquivos não devem ser modificados.

## 📊 Performance

### Code Splitting

```typescript
// Lazy loading de rotas
const ProductPage = lazy(() => import("./pages/products/Pisos"));
```

### Image Optimization

```typescript
// Lazy loading de imagens
<img loading="lazy" src="..." alt="..." />

// Figma assets
import img from "figma:asset/abc123.png";
```

## 🧪 Testing (Planejado)

```
tests/
├── unit/
│   ├── components/
│   └── hooks/
├── integration/
│   └── pages/
└── e2e/
    └── flows/
```

## 📱 Responsividade

### Breakpoints (Tailwind)

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Mobile-first

```tsx
// Padrão: mobile primeiro, depois tablet/desktop
<div className="text-[36px] md:text-[56px] lg:text-[72px]">
```

## 🚀 Build & Deploy

### Build Output

```
dist/
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── [images]/
└── index.html
```

### Otimizações de Build

- Tree shaking automático
- CSS purging (Tailwind)
- Minificação de JS/CSS
- Compressão de imagens
- Code splitting por rota

## 📚 Documentação de Componentes

Cada componente principal deve ter:

```typescript
/**
 * Hero section with Ken Burns effect video background
 * 
 * Features:
 * - YouTube video autoplay with loop
 * - Parallax scroll effect
 * - Fade out on scroll
 * 
 * @example
 * <Hero />
 */
export function Hero() {
  // ...
}
```

## 🔄 Versionamento

Seguimos [Semantic Versioning](https://semver.org/):

- **MAJOR**: Mudanças incompatíveis
- **MINOR**: Novas funcionalidades compatíveis
- **PATCH**: Correções de bugs

Exemplo: `1.2.3`
- 1 = Major version
- 2 = Minor version
- 3 = Patch version

---

Última atualização: 11 de março de 2026
