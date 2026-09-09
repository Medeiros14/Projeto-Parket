# Documentação Técnica - Parket Website

Este documento fornece informações técnicas detalhadas sobre a arquitetura e implementação do site Parket.

## 🏗️ Arquitetura

### Stack Tecnológica

- **Frontend Framework**: React 18.3.1
- **Build Tool**: Vite 6.0.11
- **Routing**: React Router 7.1.3 (Data Mode)
- **Styling**: Tailwind CSS v4.0
- **Animations**: Motion 12.0.3 (antigo Framer Motion)
- **TypeScript**: 5.7.3
- **Icons**: Lucide React 0.469.0

### Padrão de Rotas (Data Mode)

O projeto usa React Router em Data Mode para melhor performance e experiência:

```typescript
// src/app/routes.ts
import { createBrowserRouter } from "react-router";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/produtos/pisos",
    Component: Pisos,
  },
  // ...
]);
```

```typescript
// src/app/App.tsx
import { RouterProvider } from "react-router";
import { HelmetProvider } from "react-helmet-async";

export default function App() {
  return (
    <HelmetProvider>
      <RouterProvider router={router} />
    </HelmetProvider>
  );
}
```

## 🎨 Design System

### Paleta de Cores

Definida em `/src/styles/theme.css`:

```css
:root {
  /* Cores primárias */
  --color-primary: #8B7355;      /* Tom madeira médio */
  --color-secondary: #A0826D;    /* Tom madeira claro */
  --color-accent: #6B5444;       /* Tom madeira escuro */
  
  /* Backgrounds */
  --bg-dark: #1A1A1A;            /* Background principal */
  --bg-darker: #0D0D0D;          /* Background seções */
  
  /* Textos */
  --text-primary: #E8E4DF;       /* Texto principal */
  --text-secondary: #B8B4AF;     /* Texto secundário */
  
  /* CTA Verde */
  --color-cta: #4A7C59;          /* Verde Parket */
}
```

### Tipografia

```css
/* Headings - Ultra Light */
h1, h2, h3 {
  font-weight: 200;
  letter-spacing: 0.02em;
}

/* Body - Light */
body {
  font-weight: 300;
  letter-spacing: 0.01em;
}
```

### Princípios de Design

1. **Zero Border Radius**: Todos os elementos mantêm cantos retos (0px)
2. **Zero Shadows**: Sem sombras (box-shadow: none)
3. **Minimal Borders**: Bordas sutis quando necessárias (1px solid rgba)
4. **Tipografia Thin/Light**: Pesos 200-300 predominantes
5. **Espaçamento Generoso**: Breathing room para conteúdo premium

## 🎬 Sistema de Animações

### Custom Hooks

#### useParallax

Cria efeito parallax baseado em scroll:

```typescript
import { useParallax } from '../hooks/useParallax';

const { ref, y } = useParallax(0.15); // speed 0-1

<motion.div ref={ref} style={{ y }}>
  {/* conteúdo */}
</motion.div>
```

#### useScrollReveal

Revela conteúdo ao rolar:

```typescript
import { useScrollReveal } from '../hooks/useParallax';

const { ref, opacity, y } = useScrollReveal();

<motion.div ref={ref} style={{ opacity, y }}>
  {/* conteúdo */}
</motion.div>
```

#### useScrollRef

Ref para usar com useScroll do Motion:

```typescript
import { useScrollRef } from '../hooks/useParallax';
import { useScroll, useTransform } from 'motion/react';

const sectionRef = useScrollRef<HTMLDivElement>();
const { scrollYProgress } = useScroll({
  target: sectionRef,
  offset: ["start start", "end start"],
});
```

### Supressão de Warnings

O hook `useParallax.ts` suprime o warning do Motion sobre `position: relative`:

```typescript
// Motion verifica CSS antes do browser pintar
// Todos os elementos já têm position: relative via Tailwind
// Este código suprime o warning falso-positivo
if (typeof window !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Please ensure that the container has a non-static position")
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
}
```

## 📱 Componentes Principais

### Hero (Ken Burns Effect)

Vídeo fullscreen com parallax e zoom sutil:

```typescript
const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
const videoScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
```

### FloatingCTA

Botão flutuante que aparece após scroll:

```typescript
const [isVisible, setIsVisible] = useState(false);

useEffect(() => {
  const handleScroll = () => {
    setIsVisible(window.scrollY > 800);
  };
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

### LeadFormModal

Modal de captura de leads com validação:

```typescript
interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName?: string;
}
```

### ImageLightbox

Galeria fullscreen com navegação:

```typescript
interface ImageLightboxProps {
  images: string[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}
```

## 🔍 SEO

### Componente SEOHead

Gerencia meta tags dinamicamente:

```typescript
import { SEOHead } from '../components/SEOHead';

<SEOHead
  title="Pisos de Madeira Maciça | Parket"
  description="Pisos de madeira de alta qualidade..."
  keywords="piso de madeira, deck, parquet, cumaru, ipê"
  ogImage="/images/pisos-og.jpg"
  article={false}
/>
```

### Estratégia SEO

1. **Title Tags**: 50-60 caracteres, incluindo "Parket"
2. **Meta Descriptions**: 150-160 caracteres, persuasivas
3. **Keywords**: 5-8 palavras-chave relevantes
4. **Open Graph**: Imagens 1200x630px para compartilhamento
5. **Structured Data**: JSON-LD para produtos e artigos
6. **Headings**: Hierarquia H1 > H2 > H3 correta
7. **Alt Text**: Descrições detalhadas em todas as imagens

### URLs Amigáveis

```
/                           # Home
/produtos/pisos             # Produto
/produtos/decks
/produtos/forros
/produtos/paineis
/produtos/portas
/produtos/escadas
/produtos/fachadas
/produtos/marcenaria
/produtos/shou-sugi-ban
/produtos/spa
/blog                       # Blog Index
/blog/piso-de-madeira-guia  # Artigo
```

## 🖼️ Sistema de Imagens

### ImageWithFallback

Componente protegido com fallback:

```typescript
import { ImageWithFallback } from './components/figma/ImageWithFallback';

<ImageWithFallback
  src="/images/product.jpg"
  alt="Piso de madeira cumaru instalado"
  className="w-full h-full object-cover"
  loading="lazy"
/>
```

### Imports de Assets

```typescript
// Raster images (PNG, JPG) - usar figma:asset
import img from "figma:asset/abc123.png";

// SVGs - imports relativos
import svgPaths from "../imports/svg-wg56ef214f";
```

## 🎯 Performance

### Otimizações Implementadas

1. **Lazy Loading**: Todas as imagens com `loading="lazy"`
2. **Code Splitting**: Rotas carregadas sob demanda
3. **Tree Shaking**: Imports específicos (não `import *`)
4. **CSS Optimization**: Tailwind v4 com purge automático
5. **Bundle Size**: Motion importado de `motion/react`

### Métricas Target

- **First Contentful Paint**: < 1.8s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3.8s
- **Cumulative Layout Shift**: < 0.1

## 🧩 Extensibilidade

### Adicionar Nova Página de Produto

1. Criar arquivo em `/src/app/pages/products/NovoProduto.tsx`
2. Usar template base com seções: Hero, Gallery, Specs, CTA
3. Adicionar rota em `/src/app/routes.ts`
4. Adicionar card em `/src/app/components/Categories.tsx`
5. Criar conteúdo SEO em `SEOHead`

### Adicionar Novo Artigo de Blog

1. Criar arquivo em `/src/app/pages/blog/NovoArtigo.tsx`
2. Usar `BlogArticleLayout` como wrapper
3. Adicionar rota em `/src/app/routes.ts`
4. Adicionar card em `/src/app/components/Blog.tsx`
5. Otimizar para SEO com keywords relevantes

## 🔒 Segurança

- Sem API keys expostas no frontend
- Formulários com validação client-side
- Sanitização de inputs (forms)
- HTTPS obrigatório em produção

## 🚀 Deploy

### Build de Produção

```bash
npm run build
```

Saída em `/dist` pronta para deploy estático.

### Variáveis de Ambiente

Criar `.env.production`:

```env
VITE_SITE_URL=https://www.parket.com.br
VITE_API_URL=https://api.parket.com.br
```

### Plataformas Recomendadas

1. **Vercel** - Deploy automático, edge functions
2. **Netlify** - Deploy automático, forms nativas
3. **AWS S3 + CloudFront** - Máximo controle

## 📊 Analytics

Adicionar Google Analytics 4:

```typescript
// src/app/App.tsx
useEffect(() => {
  // GA4 initialization
  window.gtag('config', 'G-XXXXXXXXXX');
}, []);
```

---

Para mais informações, consulte o README.md principal.
