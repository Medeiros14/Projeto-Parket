# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.3.5] - 2026-03-20 BRT — ✅ DEPLOYED 2026-03-20 23:16 BRT

### 🚀 Atualização Completa — Sincronização com GitHub (ParketBR/parket-website) commit d2c8374

#### Links CTA Funcionais
- **`FloatingCTA.tsx`**: links CTA atualizados para links diretos funcionais
- **`HeroFloatingBar.tsx`**: links CTA atualizados para links diretos funcionais
- **`Contact.tsx`**: links CTA atualizados para links diretos funcionais
- **`BlogArticleLayout.tsx`**: links CTA atualizados para links diretos funcionais

#### Seções CTA Adicionadas às Subpáginas
- **`Escadas.tsx`**: adicionada seção CTA ausente
- **`Fachadas.tsx`**: adicionada seção CTA ausente
- **`Marcenaria.tsx`**: adicionada seção CTA ausente
- **`Paineis.tsx`**: adicionada seção CTA ausente
- **`Portas.tsx`**: adicionada seção CTA ausente
- **`Spa.tsx`**: adicionada seção CTA ausente

#### Atualização de Conteúdo
- **`About.tsx`**: foto da família Parket atualizada para `familia-parket-2026.jpg`
- **`Carvalhos.tsx`**, **`ShouSugiBan.tsx`**: limpeza de código — simplificação de seções
- **`Decks.tsx`**, **`Forros.tsx`**, **`Pisos.tsx`**, **`PisoDetail.tsx`**, **`PainelDetail.tsx`**: atualizações de links/CTAs

#### Assets
- **`src/assets/familia-parket-2026.jpg`**: nova foto da família Parket (94 KB)

#### Arquivos Editados
- `src/app/components/About.tsx`
- `src/app/components/BlogArticleLayout.tsx`
- `src/app/components/Contact.tsx`
- `src/app/components/FloatingCTA.tsx`
- `src/app/components/HeroFloatingBar.tsx`
- `src/app/pages/Carvalhos.tsx`
- `src/app/pages/Decks.tsx`
- `src/app/pages/Escadas.tsx`
- `src/app/pages/Fachadas.tsx`
- `src/app/pages/Forros.tsx`
- `src/app/pages/Marcenaria.tsx`
- `src/app/pages/Paineis.tsx`
- `src/app/pages/PainelDetail.tsx`
- `src/app/pages/PisoDetail.tsx`
- `src/app/pages/Pisos.tsx`
- `src/app/pages/Portas.tsx`
- `src/app/pages/ShouSugiBan.tsx`
- `src/app/pages/Spa.tsx`
- `src/assets/familia-parket-2026.jpg` (novo)

---

## [1.3.4] - 2026-03-20 BRT — 🔄 BUILD IN PROGRESS

### 🚀 Atualização Completa — Sincronização com GitHub (ParketBR/parket-website)

#### Proteção de Imagens
- **`src/main.tsx`**: adicionado bloqueio de right-click, drag e Ctrl+S em imagens/vídeos via JavaScript
- **`src/styles/index.css`**: adicionado CSS de proteção — `user-drag: none`, `user-select: none`, `pointer-events: none` em img/video/picture; re-habilitado pointer-events em wrappers interativos

#### Redesign de Carrosséis — Páginas de Projetos
- **`Apartamentos.tsx`, `Casas.tsx`, `Edificios.tsx`, `Escritorios.tsx`, `Hoteis.tsx`, `Lojas.tsx`, `Mostras.tsx`, `Museus.tsx`, `PaineisProject.tsx`, `Restaurantes.tsx`**: novo layout de galeria nas subpáginas de projetos — cabeçalho com label "Galeria" e contador de fotos, layout simplificado sem botões de navegação externos

#### Revisão de Componentes
- **`src/app/components/Categories.tsx`**: imagem de Pisos atualizada para `/pisos.jpg` (via public folder)
- **`src/app/components/Pisos.tsx`**: imagens das coleções Brazil/Clássicos/Eternos voltam para URLs parket.com.br
- **`src/app/pages/Carvalhos.tsx`**: atualizado conforme novo repositório
- **`src/app/pages/ShouSugiBan.tsx`**: atualizado conforme novo repositório

#### Configuração
- **`vite.config.ts`**: simplificado — substituído `figmaAssetPlugin()` custom por alias nativo `figma:asset`, adicionado `server.allowedHosts: 'all'`
- **`public/`**: adicionadas imagens estáticas — `pisos.jpg`, `carvalhos-1.jpg` a `carvalhos-7.jpg`

#### Arquivos Editados
- `src/main.tsx`
- `src/styles/index.css`
- `src/app/components/Categories.tsx`
- `src/app/components/Pisos.tsx`
- `src/app/pages/Carvalhos.tsx`
- `src/app/pages/ShouSugiBan.tsx`
- `src/app/pages/projetos/Apartamentos.tsx`
- `src/app/pages/projetos/Casas.tsx`
- `src/app/pages/projetos/Edificios.tsx`
- `src/app/pages/projetos/Escritorios.tsx`
- `src/app/pages/projetos/Hoteis.tsx`
- `src/app/pages/projetos/Lojas.tsx`
- `src/app/pages/projetos/Mostras.tsx`
- `src/app/pages/projetos/Museus.tsx`
- `src/app/pages/projetos/PaineisProject.tsx`
- `src/app/pages/projetos/Restaurantes.tsx`
- `vite.config.ts`
- `public/` (novo diretório)

---

## [1.3.3] - 2026-03-20 BRT — ✅ DEPLOYED 2026-03-20 BRT

### 🎨 Estilo

#### Reposicionamento da foto do card Pisos (seção Produtos)

- **`Categories.tsx`**: revertida imagem do card "Pisos" de `PRO_PI_CL_EXT_01.jpg` de volta para `PRO_PI_HERO.jpg` (foto original); adicionado `object-position: center 70%` para enquadrar o piso de madeira ao invés do tapete

#### Arquivos Editados
- `src/app/components/Categories.tsx`

---

## [1.3.2] - 2026-03-20 BRT — ✅ DEPLOYED 2026-03-20 BRT

### 🎨 Estilo

#### Ajuste de foto no card Pisos (seção Produtos)

- **`Categories.tsx`**: imagem do card "Pisos" substituída — `PRO_PI_HERO.jpg` focava no tapete; substituída por `PRO_PI_CL_EXT_01.jpg` que destaca o piso de madeira clássico

#### Arquivos Editados
- `src/app/components/Categories.tsx`

---

## [1.3.1] - 2026-03-20 18:00 BRT — ✅ DEPLOYED 2026-03-20 18:00 BRT

### 🐛 Correção

#### Imagens quebradas nos cards de Pisos

- **`Categories.tsx`**: card "Pisos" usava `/pisos.jpg` (arquivo inexistente no servidor) — substituído pelo asset local `PRO_PI_HERO.jpg`
- **`Pisos.tsx`**: cards Brazil, Clássicos e Eternos usavam URLs externas do parket.com.br — substituídos pelos assets locais `PRO_PI_BR_EXT_01.jpg`, `PRO_PI_CL_EXT_01.jpg` e `PRO_PI_ET_EXT_01.jpg`

#### Arquivos Editados
- `src/app/components/Categories.tsx`
- `src/app/components/Pisos.tsx`

---

## [1.3.0] - 2026-03-20 — ✅ DEPLOYED 2026-03-20 BRT

### ✨ Atualização Completa do Site

#### Sincronização com github.com/ParketBR/parket-website

- **Páginas de produtos completamente redesenhadas** com fotos reais de coleções
  - `Pisos.tsx`: nova estrutura com coleções Clássico (14 fotos), Eterno (5 fotos) e Brazil (1 foto)
  - `Carvalhos.tsx`, `Decks.tsx`, `Forros.tsx`, `Escadas.tsx`, `Paineis.tsx`, `Portas.tsx`, `Marcenaria.tsx`, `ShouSugiBan.tsx`, `Fachadas.tsx`, `Spa.tsx`: layouts atualizados
  - `PisoDetail.tsx`, `PainelDetail.tsx`: páginas de detalhe atualizadas
  - `BlogIndex.tsx` e todos os 8 artigos de blog atualizados
- **Novo componente `ZoomImage.tsx`** para zoom em imagens
- **22 novas imagens de produto** adicionadas em `src/assets/`:
  - `PRO_PI_CL_EXT_01.jpg` a `PRO_PI_CL_EXT_14.jpg` (coleção Clássico)
  - `PRO_PI_ET_EXT_01.jpg` a `PRO_PI_ET_EXT_05.jpg` (coleção Eterno)
  - `PRO_PI_BR_EXT_01.jpg` (coleção Brazil), `PRO_PI_HERO.jpg`, `japan-house-sf.jpg`
- **Assets convertidos de PNG para JPG** (12 imagens hash-named otimizadas)
- **Páginas de projetos atualizadas**: Apartamentos, Casas, Edifícios, Escritórios, Hotéis, Lojas, Mostras, Museus, PaineisProject, Restaurantes
- **`vite-env.d.ts`** adicionado em `src/`
- **Correção de bugs JSX** em `ShouSugiBan.tsx` e `Carvalhos.tsx` (tags duplicadas do GitHub)

#### Arquivos Editados
- `src/app/App.tsx`
- `src/app/components/About.tsx`, `Categories.tsx`, `Decks.tsx`, `Forros.tsx`, `Hero.tsx`, `Inspiracao.tsx`, `Pisos.tsx`, `Revestimentos.tsx`, `SEOHead.tsx`, `Testimonial.tsx`
- `src/app/components/ZoomImage.tsx` (novo)
- `src/app/pages/` — todos os 15 arquivos de página atualizados
- `src/app/pages/blog/` — todos os 8 artigos atualizados
- `src/app/pages/projetos/` — todos os 10 arquivos atualizados
- `src/assets/` — 22 novos JPGs + 12 assets atualizados + vite-env.d.ts

---

## [1.2.0] - 2026-03-18 — ✅ DEPLOYED 2026-03-18 BRT

### ✨ Adicionado

#### Boas-vindas ao Time de Dev

- **Mensagem de boas-vindas no console do browser** para Raphael e Wilson
  - Exibe mensagem estilizada com as cores do design system Parket ao abrir DevTools
  - Reconhece os novos membros do time que passam a contribuir com as melhorias do site
  - Não impacta a experiência visual do usuário final

#### Arquivos Editados
- `src/app/App.tsx`

---

## [1.1.0] - 2026-03-18 18:00 BRT — ✅ DEPLOYED 2026-03-18 18:05 BRT

### 🔧 Modificado

#### Processo Interno de Build

- **Adicionado plugin Vite `figma-asset-resolver`** em `vite.config.ts`
  - Resolve imports do tipo `figma:asset/{hash}.ext` diretamente para `src/assets/{hash}.ext`
  - Elimina dependência do ambiente Figma Make para resolução de assets
  - Plugin posicionado primeiro no array para garantir prioridade na resolução de módulos
- Removidos comentários legados do ambiente Figma Make (não mais relevantes)
- Limpeza do alias `@` mantido sem alteração funcional

#### Arquivos Editados
- `vite.config.ts`

---

## [1.0.0] - 2025-03-11

### ✨ Adicionado

#### Estrutura Base
- Configuração inicial do projeto com React + Vite + TypeScript
- Implementação do React Router 7 em Data Mode
- Integração do Tailwind CSS v4
- Sistema de animações com Motion (Framer Motion)
- Design system completo com paleta Parket

#### Páginas
- Página Home com 12 seções integradas
- 10 páginas de produtos com layouts customizados:
  - Pisos de Madeira
  - Decks
  - Forros
  - Painéis
  - Portas
  - Escadas
  - Fachadas
  - Marcenaria Arquitetônica
  - Shou Sugi Ban
  - SPA
- Blog Index com listagem de artigos
- 8 artigos de blog otimizados para SEO

#### Componentes

**Seções da Home:**
- Header com navegação fixa
- Hero com vídeo YouTube e efeito Ken Burns
- About com apresentação da empresa
- Categories com 10 categorias em grid
- Revestimentos com carousel
- ProductsCTA com call-to-action
- Inspiração com galeria de projetos
- Philosophy com filosofia da marca
- Testimonial com depoimentos
- Blog com últimos artigos
- Contact com formulário
- Footer completo

**Componentes Compartilhados:**
- LeadFormModal para captura de leads
- FloatingCTA com botão flutuante verde
- ImageLightbox para galeria fullscreen
- BlogArticleLayout para artigos
- SEOHead para meta tags dinâmicas
- ImageWithFallback com fallback automático

**Hooks Customizados:**
- useParallax para efeitos parallax
- useScrollReveal para reveal ao scroll
- useScrollRef para refs do Motion

#### Features
- Parallax scrolling em múltiplas seções
- Ken Burns effect no vídeo hero
- Scroll reveal animations
- Floating CTA que aparece após scroll
- Sistema de modal para forms
- Lightbox para galerias de imagens
- SEO otimizado com meta tags dinâmicas
- Responsividade completa (mobile-first)

#### Documentação
- README.md completo
- CONTRIBUTING.md com guias de contribuição
- TECHNICAL.md com documentação técnica
- CHANGELOG.md (este arquivo)
- .gitignore configurado

### 🔧 Configuração
- Tailwind CSS v4 com design system customizado
- TypeScript com configuração strict
- Vite configurado para produção
- ESLint e Prettier (preparado)

### 🎨 Design System
- Paleta de cores madeira + dark theme
- Tipografia thin/light (200-300)
- Zero border-radius
- Zero shadows
- Espaçamento generoso
- Tema dark (#1A1A1A / #0D0D0D)

### 📱 SEO
- Meta tags dinâmicas por página
- Open Graph tags para redes sociais
- Structured data (JSON-LD)
- URLs amigáveis
- Alt text em todas as imagens
- Sitemap preparado

### 🚀 Performance
- Lazy loading de imagens
- Code splitting por rota
- Tree shaking automático
- CSS otimizado com Tailwind v4
- Bundle size otimizado

---

## [Não Lançado]

### 🔮 Planejado para Próximas Versões

- [ ] Google Analytics 4 integration
- [ ] Integração com CMS (Contentful ou Strapi)
- [ ] Busca de produtos
- [ ] Filtros avançados de produtos
- [ ] Sistema de favoritos
- [ ] Calculadora de metragem
- [ ] Comparador de produtos
- [ ] Newsletter signup
- [ ] Chatbot de atendimento
- [ ] Vídeos de instalação
- [ ] AR para visualização de produtos
- [ ] Área de revendedores
- [ ] Portal de projetos
- [ ] Sistema de orçamento online
- [ ] Integração com WhatsApp Business
- [ ] Multi-idioma (PT/EN/ES)

### 🐛 Correções Planejadas

- [ ] Otimizar performance em Safari mobile
- [ ] Melhorar acessibilidade (WCAG 2.1 AA)
- [ ] Adicionar testes unitários
- [ ] Adicionar testes E2E
- [ ] Melhorar cache de imagens

---

## Tipos de Mudanças

- **✨ Adicionado** - para novas funcionalidades
- **🔧 Modificado** - para mudanças em funcionalidades existentes
- **❌ Depreciado** - para funcionalidades que serão removidas
- **🗑️ Removido** - para funcionalidades removidas
- **🐛 Corrigido** - para correção de bugs
- **🔒 Segurança** - para vulnerabilidades corrigidas
- **📚 Documentação** - para mudanças na documentação
- **🎨 Estilo** - para mudanças de design/CSS
- **⚡ Performance** - para melhorias de performance

---

Mantido por Parket Development Team
