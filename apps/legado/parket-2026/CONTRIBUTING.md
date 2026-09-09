# Guia de Contribuição - Parket Website

Obrigado por considerar contribuir para o projeto Parket! Este documento fornece diretrizes para manter a qualidade e consistência do código.

## 🎯 Princípios de Desenvolvimento

1. **Design Editorial Premium**: Mantenha o estilo minimalista inspirado na Monofloor
2. **Performance First**: Otimize imagens, lazy loading e code splitting
3. **SEO Otimizado**: Sempre adicione meta tags e conteúdo semântico
4. **Acessibilidade**: Siga WCAG 2.1 AA guidelines
5. **Responsividade**: Mobile-first approach

## 📝 Padrões de Código

### TypeScript

```typescript
// ✅ BOM - Tipos explícitos e interfaces claras
interface ProductProps {
  title: string;
  description: string;
  images: string[];
}

export function Product({ title, description, images }: ProductProps) {
  // ...
}

// ❌ EVITAR - Any types e props implícitas
export function Product(props: any) {
  // ...
}
```

### React Components

```typescript
// ✅ BOM - Functional components com hooks
import { useState, useEffect } from 'react';

export function MyComponent() {
  const [state, setState] = useState<string>('');
  // ...
}

// ❌ EVITAR - Class components
export class MyComponent extends React.Component {
  // ...
}
```

### Naming Conventions

- **Componentes**: PascalCase (`Header.tsx`, `ProductCard.tsx`)
- **Hooks**: camelCase com prefixo `use` (`useParallax.ts`, `useScrollReveal.ts`)
- **Variáveis**: camelCase (`productList`, `isLoading`)
- **Constantes**: UPPER_SNAKE_CASE (`MAX_ITEMS`, `API_URL`)
- **Arquivos CSS**: kebab-case (`theme.css`, `fonts.css`)

### Estrutura de Arquivos

```
src/app/
├── components/
│   ├── sections/       # Seções da Home (Hero.tsx, About.tsx)
│   ├── layouts/        # Layouts compartilhados (BlogArticleLayout.tsx)
│   ├── shared/         # Componentes reutilizáveis (Header.tsx, Footer.tsx)
│   ├── modals/         # Modais (LeadFormModal.tsx, ImageLightbox.tsx)
│   └── ui/             # Design system base
├── pages/
│   ├── products/       # Páginas de produtos
│   └── blog/           # Artigos do blog
└── hooks/              # Custom hooks (useParallax.ts)
```

## 🎨 Design System

### Cores

Use as variáveis CSS definidas em `/src/styles/theme.css`:

```tsx
// ✅ BOM - Usar variáveis do tema
<div className="text-[--color-primary]">

// ❌ EVITAR - Cores hardcoded
<div className="text-[#8B7355]">
```

### Tipografia

```tsx
// ✅ BOM - Usar tokens de font-weight
<h1 style={{ fontWeight: 200 }}>Título Light</h1>

// ❌ EVITAR - Classes Tailwind para peso
<h1 className="font-light">Título</h1>
```

### Espaçamento

```tsx
// ✅ BOM - Usar escala Tailwind consistente
<div className="px-6 md:px-10 lg:px-20">

// ❌ EVITAR - Valores arbitrários inconsistentes
<div className="px-[23px] md:px-[47px]">
```

## 🎬 Animações

### Motion/Framer Motion

```typescript
import { motion } from 'motion/react';

// ✅ BOM - Animações suaves e performáticas
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
>

// ❌ EVITAR - Animações muito rápidas ou bruscas
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.1 }}
>
```

### Parallax

```typescript
import { useParallax } from '../hooks/useParallax';

// ✅ BOM - Usar hooks customizados
const { ref, y } = useParallax(0.15);
```

## 📱 Responsividade

```tsx
// ✅ BOM - Mobile-first com breakpoints consistentes
<div className="text-[36px] md:text-[56px] lg:text-[72px]">

// ❌ EVITAR - Desktop-first ou breakpoints inconsistentes
<div className="lg:text-[72px] md:text-[56px] text-[36px]">
```

## 🔍 SEO

Sempre adicione meta tags usando o componente `SEOHead`:

```typescript
import { SEOHead } from '../components/SEOHead';

export function ProductPage() {
  return (
    <>
      <SEOHead
        title="Pisos de Madeira | Parket"
        description="Pisos de madeira de alta qualidade..."
        keywords="piso de madeira, deck, parquet"
        ogImage="/images/pisos-og.jpg"
      />
      {/* conteúdo */}
    </>
  );
}
```

## 📸 Imagens

```tsx
// ✅ BOM - Usar ImageWithFallback com lazy loading
import { ImageWithFallback } from './components/figma/ImageWithFallback';

<ImageWithFallback
  src="/images/product.jpg"
  alt="Descrição detalhada do produto"
  loading="lazy"
/>

// ❌ EVITAR - <img> direto sem fallback
<img src="/images/product.jpg" />
```

## 🧪 Testes

```bash
# Antes de commitar
npm run lint           # Verificar erros de linting
npm run build          # Garantir que o build funciona
npm run preview        # Testar o build localmente
```

## 📝 Commits

Use mensagens de commit descritivas:

```bash
# ✅ BOM
git commit -m "feat: adiciona página de Fachadas com galeria lightbox"
git commit -m "fix: corrige parallax em mobile Safari"
git commit -m "style: ajusta espaçamento da seção Hero"
git commit -m "docs: atualiza README com instruções de deploy"

# ❌ EVITAR
git commit -m "update"
git commit -m "fix bug"
git commit -m "changes"
```

### Padrão de Commits

- `feat:` - Nova funcionalidade
- `fix:` - Correção de bug
- `style:` - Mudanças de estilo (CSS, formatação)
- `refactor:` - Refatoração de código
- `docs:` - Documentação
- `test:` - Testes
- `chore:` - Tarefas de manutenção

## 🔄 Pull Requests

1. Crie uma branch descritiva: `feat/pagina-paineis`
2. Faça commits atômicos e bem descritos
3. Atualize a documentação se necessário
4. Teste em diferentes navegadores
5. Inclua screenshots para mudanças visuais

## ❓ Dúvidas

Para dúvidas, abra uma issue ou entre em contato com a equipe de desenvolvimento.

---

Obrigado por contribuir com o projeto Parket! 🌳
