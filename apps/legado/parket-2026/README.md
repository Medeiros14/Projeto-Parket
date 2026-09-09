# Parket - Website Institucional

Site institucional premium da Parket, marca especializada em produtos de madeira de alta qualidade. Inspirado no design editorial da Monofloor, com foco em estética minimalista e apresentação premium dos produtos.

## 🎨 Design System

O projeto utiliza um design system personalizado com:

- **Paleta de cores**: Tons naturais de madeira e tema dark (#1A1A1A / #0D0D0D)
- **Tipografia**: Fontes thin/light para elegância editorial
- **Estilo**: Zero border-radius, zero shadows, design minimalista
- **Tema**: Dark mode premium com contraste suave

## 🚀 Tecnologias

- **React 18** - Biblioteca JavaScript para interfaces
- **Vite** - Build tool e dev server
- **React Router 7** - Roteamento com Data Mode
- **TypeScript** - Tipagem estática
- **Tailwind CSS v4** - Framework CSS utility-first
- **Motion (Framer Motion)** - Animações e parallax
- **Lucide React** - Ícones
- **React Helmet Async** - Meta tags e SEO

## 📁 Estrutura do Projeto

```
parket-website/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── sections/      # Seções da Home
│   │   │   ├── layouts/       # Layouts compartilhados
│   │   │   ├── shared/        # Componentes reutilizáveis
│   │   │   ├── modals/        # Modais e overlays
│   │   │   ├── ui/            # Design system base
│   │   │   └── figma/         # Componentes do Figma
│   │   ├── pages/
│   │   │   ├── products/      # Páginas de produtos
│   │   │   └── blog/          # Artigos do blog
│   │   ├── hooks/             # Custom hooks
│   │   ├── routes.ts          # Configuração de rotas
│   │   └── App.tsx            # Componente raiz
│   ├── styles/
│   │   ├── index.css          # Estilos globais
│   │   ├── theme.css          # Variáveis CSS
│   │   ├── fonts.css          # Fontes customizadas
│   │   └── tailwind.css       # Config Tailwind v4
│   └── imports/               # Assets e conteúdo
├── public/                     # Arquivos públicos
└── package.json
```

## 🏗️ Seções da Home

A página inicial é uma single-page com as seguintes seções:

1. **Header** - Navegação fixa com logo e menu
2. **Hero** - Vídeo em fullscreen com efeito Ken Burns
3. **About** - Apresentação da empresa
4. **Categories** - 10 categorias de produtos em grids
5. **Revestimentos** - Carousel de revestimentos
6. **ProductsCTA** - Call-to-action para produtos
7. **Inspiração** - Galeria de projetos
8. **Philosophy** - Filosofia da marca
9. **Testimonial** - Depoimentos de clientes
10. **Blog** - Últimos artigos
11. **Contact** - Formulário de contato
12. **Footer** - Rodapé com links e informações

## 📄 Páginas de Produto

10 subpáginas com layouts customizados:

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

Cada página possui:
- Galeria de imagens com lightbox
- Especificações técnicas
- CTAs para contato

## 📝 Blog

8 artigos otimizados para SEO:

- Piso de Madeira: Guia Completo
- Deck de Madeira: Tipos e Manutenção
- Cumaru vs Ipê: Qual Escolher?
- Escadas de Madeira: Design e Segurança
- Forro de Madeira: Tendências
- Forro Ripado vs Contínuo
- Marcenaria Arquitetônica sob Medida
- Como Escolher Empresa de Madeira

## 🎯 Features Especiais

- **Parallax Scrolling**: Efeitos suaves em várias seções
- **Ken Burns Effect**: Zoom/pan sutil no vídeo hero
- **Scroll Reveal**: Animações ao rolar a página
- **Floating CTA**: Botão flutuante verde após scroll
- **Lead Form Modal**: Modal de contato com validação
- **Lightbox**: Galeria de imagens em fullscreen
- **SEO Otimizado**: Meta tags dinâmicas por página

## 🔧 Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/parket-website.git

# Entre na pasta
cd parket-website

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

## 📦 Scripts Disponíveis

```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build para produção
npm run preview      # Preview do build de produção
npm run lint         # Executa linting
```

## 🌐 Deploy

O projeto está configurado para deploy em:

- **Vercel** (recomendado)
- **Netlify**
- **GitHub Pages**

Basta conectar o repositório à plataforma escolhida e o deploy será automático.

## 📱 Responsividade

O site é totalmente responsivo com breakpoints:

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🎨 Personalização

### Cores

Edite as variáveis em `/src/styles/theme.css`:

```css
:root {
  --color-primary: #8B7355;
  --color-secondary: #A0826D;
  /* ... */
}
```

### Fontes

Adicione fontes em `/src/styles/fonts.css`

### Componentes

Componentes UI base estão em `/src/app/components/ui/`

## 📄 Licença

© 2025 Parket. Todos os direitos reservados.

## 🤝 Contribuindo

Este é um projeto privado. Para contribuir, entre em contato com a equipe de desenvolvimento.

## 📧 Contato

- Website: [www.parket.com.br](https://www.parket.com.br)
- Email: contato@parket.com.br

---

Desenvolvido com ❤️ para Parket
