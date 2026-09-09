import { type SlideData } from "./slides-data";

/* ─── Image URLs ─── */
const IMG_COVER = "https://images.unsplash.com/photo-1770625467978-fd7466804171?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3b29kJTIwZmxvb3JpbmclMjBpbnRlcmlvciUyMGRlc2lnbnxlbnwxfHx8fDE3NzE3ODkwMjN8MA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_SOCIAL = "https://images.unsplash.com/photo-1771555557418-59fdb47145da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzb2NpYWwlMjBtZWRpYSUyMGNvbnRlbnQlMjBjcmVhdGlvbiUyMHNtYXJ0cGhvbmV8ZW58MXx8fHwxNzcxODAzNjczfDA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_HERRING = "https://images.unsplash.com/photo-1608702529091-f3b4fab4b97e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwaGFyZHdvb2QlMjBoZXJyaW5nYm9uZSUyMGZsb29yfGVufDF8fHx8MTc3MTgwMzY3M3ww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_FEED = "https://images.unsplash.com/photo-1634658601812-4a8f4b366757?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbnN0YWdyYW0lMjBmZWVkJTIwYWVzdGhldGljJTIwZGVzaWdufGVufDF8fHx8MTc3MTgwMzY3NHww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_LUXURY = "https://images.unsplash.com/photo-1758315417321-83eb30a39710?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBob21lJTIwcmVub3ZhdGlvbiUyMGludGVyaW9yfGVufDF8fHx8MTc3MTgwMzY3NHww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_CRAFT = "https://images.unsplash.com/photo-1661446569716-86e93bf267d3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmFmdHNtYW4lMjB3b29kd29ya2luZyUyMGRldGFpbCUyMGhhbmRzfGVufDF8fHx8MTc3MTgwMzY3NHww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_LIVING = "https://images.unsplash.com/photo-1768946052273-0a2dd7f3e365?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsaXZpbmclMjByb29tJTIwZWxlZ2FudCUyMGZ1cm5pdHVyZXxlbnwxfHx8fDE3NzE4MDM2Nzh8MA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_STUDIO = "https://images.unsplash.com/photo-1742440710226-450e3b85c100?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcmNoaXRlY3R1cmUlMjBzdHVkaW8lMjB3b3Jrc3BhY2UlMjBjcmVhdGl2ZXxlbnwxfHx8fDE3NzE4MDM2Nzh8MA&ixlib=rb-4.1.0&q=80&w=1080";

export const socialMediaSlides: SlideData[] = [
  /* ═══════════════════════════════════════════
     CAPA
     ═══════════════════════════════════════════ */
  {
    type: "cover",
    props: {
      title: "Playbook de\nSocial Media",
      subtitle: "Estratégia completa de conteúdo, plataformas, calendário editorial e métricas para as redes sociais da Parket Pisos.",
      image: IMG_COVER,
    },
  },

  /* ═══════════════════════════════════════════
     BLOCO 1 — VISÃO ESTRATÉGICA
     ═══════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 01",
      title: "Visão\nEstratégica",
      subtitle: "Posicionamento, objetivos e audiência-alvo nas redes sociais.",
    },
  },
  {
    type: "content",
    props: {
      title: "Por que Social Media\né Estratégico",
      label: "Contexto",
      highlight: "Social media não é vitrine — é o motor de percepção de marca, autoridade técnica e geração de demanda qualificada.",
      items: [
        "82% dos decisores de reforma pesquisam inspiração no Instagram antes de contratar",
        "Arquitetos e designers acompanham marcas premium para referências de especificação",
        "A jornada de compra de pisos premium dura 60-120 dias — social nutre esse ciclo inteiro",
        "Conteúdo orgânico bem posicionado reduz CAC em 40-60% vs. apenas tráfego pago",
        "A presença digital diferencia empresas familiares de commodities importadas",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Posicionamento\nDigital Parket",
      label: "Posicionamento",
      highlight: "\"A referência brasileira em pisos, revestimentos e obras complexas em madeira — onde artesanato encontra engenharia.\"",
      items: [
        "Tom de voz: Confiante, técnico com elegância, acessível sem ser popular",
        "Persona da marca: O especialista que educa, não o vendedor que pressiona",
        "Estética: Dark luxury, texturas naturais, minimalismo sofisticado",
        "Valor central: Mostrar o 'porquê' por trás de cada detalhe técnico",
        "Diferencial narrativo: Empresa familiar com 3 gerações de know-how",
      ],
    },
  },
  {
    type: "metrics",
    props: {
      title: "Objetivos\nde Social Media",
      label: "Metas 2026",
      metrics: [
        { value: "25K", label: "Seguidores IG", description: "Meta orgânica até Dez/2026" },
        { value: "3.5%", label: "Engajamento", description: "Taxa média por post" },
        { value: "150", label: "Leads/mês", description: "Via social orgânico + pago" },
        { value: "60%", label: "Brand Awareness", description: "Top-of-mind no segmento" },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Audiências-Alvo",
      label: "Personas Sociais",
      cards: [
        {
          icon: "🏠",
          title: "Proprietário Premium",
          description: "35-55 anos, renda alta, reformando ou construindo. Busca referências visuais e confiança na marca.",
        },
        {
          icon: "📐",
          title: "Arquiteto / Designer",
          description: "25-45 anos, profissional especificador. Quer conteúdo técnico, novidades e cases para apresentar ao cliente.",
        },
        {
          icon: "🏗️",
          title: "Construtora / Incorporadora",
          description: "Decisores B2B buscando fornecedores confiáveis com track record comprovado em grandes obras.",
        },
        {
          icon: "💡",
          title: "Entusiasta de Design",
          description: "20-40 anos, aspiracional. Consome conteúdo de interiores, salva posts, compartilha inspirações.",
        },
      ],
    },
  },

  /* ═══════════════════════════════════════════
     BLOCO 2 — PLATAFORMAS
     ═══════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 02",
      title: "Estratégia por\nPlataforma",
      subtitle: "Cada rede tem seu papel específico no ecossistema digital Parket.",
    },
  },
  {
    type: "split",
    props: {
      title: "Instagram\n— Canal Principal",
      image: IMG_FEED,
      label: "Plataforma #1",
      content: "Hub central de conteúdo visual. Aqui mostramos a estética Parket em sua forma mais pura — projetos concluídos, bastidores, processo criativo e autoridade técnica.",
      items: [
        "Feed: Portfólio curado, 4-5 posts/semana, grid harmônico",
        "Stories: Bastidores diários, enquetes, Q&A técnico",
        "Reels: 3-4/semana — processo, before/after, dicas rápidas",
        "Lives: Mensal com arquitetos parceiros ou tour de obras",
        "Guides: Compilações temáticas (tipos de madeira, padrões, manutenção)",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Pinterest\n— Tráfego Orgânico",
      label: "Plataforma #2",
      highlight: "Pinterest gera tráfego qualificado de longo prazo. Pins de projetos Parket aparecem em buscas de \"piso de madeira\" por meses.",
      items: [
        "Boards temáticos: Herringbone, Chevron, Deck, Marcenaria, Antes/Depois",
        "Pins otimizados com palavras-chave em português: 10-15 novos pins/semana",
        "Rich Pins linkando para o site com especificações técnicas",
        "Infográficos: Guias visuais de manutenção, comparativos de madeiras",
        "Idea Pins: Tutoriais passo-a-passo de instalação e cuidados",
        "Meta: 500K impressões mensais e 2K cliques/mês para o site",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "LinkedIn\n— Autoridade B2B",
      label: "Plataforma #3",
      highlight: "Posicionar os fundadores e diretores como thought leaders do segmento de pisos premium e construção de alto padrão.",
      items: [
        "Perfil empresarial: Cases corporativos, parcerias com construtoras",
        "Perfis dos fundadores: Posts pessoais sobre cultura, gestão familiar, lições",
        "Artigos técnicos: 2x/mês sobre tendências, sustentabilidade, engenharia",
        "Showcase de obras comerciais: Hotéis, restaurantes, escritórios de alto padrão",
        "Networking: Comentários estratégicos em posts de arquitetos e construtoras",
        "Frequência: 3 posts/semana (empresa) + 2 posts/semana (fundadores)",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "YouTube\n— Conteúdo Profundo",
      label: "Plataforma #4",
      highlight: "Canal de conteúdo educacional longo que constrói autoridade técnica e SEO. Vídeos que respondem as dúvidas reais dos clientes.",
      items: [
        "Séries: \"Por Dentro da Obra\" — acompanhamento de projetos do início ao fim",
        "Educacional: \"Guia Definitivo\" de cada tipo de madeira, acabamento, padrão",
        "Shorts: Repurpose de Reels com adaptações — 5/semana",
        "Entrevistas: Conversa com arquitetos sobre tendências e especificação",
        "Tours: Visitas ao showroom e à fábrica/oficina",
        "Meta: 1 vídeo longo/semana + 5 Shorts — atingir 10K inscritos em 12 meses",
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "TikTok — Alcance\ne Descoberta",
      label: "Plataforma #5",
      leftTitle: "Tipos de Conteúdo",
      leftItems: [
        "Before/After com transição satisfatória",
        "\"POV: Quando o arquiteto especifica madeira de verdade\"",
        "ASMR de instalação de piso (lixamento, encaixe)",
        "Erros comuns na escolha de pisos (formato educativo rápido)",
        "Day-in-the-life do instalador especialista",
        "Trends adaptadas ao universo de pisos e madeira",
      ],
      rightTitle: "Regras de Ouro",
      rightItems: [
        "Hook nos primeiros 1.5 segundos — sempre visual",
        "Não usar linguagem corporativa — ser autêntico",
        "Mostrar processo > mostrar produto final",
        "Usar áudios trending quando fizer sentido",
        "Publicar 4-5x/semana, testar horários diferentes",
        "Engajar em 30min pós-publicação (comentários)",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Matriz de\nPlataformas",
      label: "Visão Consolidada",
      cards: [
        { icon: "📸", title: "Instagram", description: "Canal principal. Branding + leads. 4-5 posts + 3-4 Reels/semana. KPI: engajamento 3.5%." },
        { icon: "📌", title: "Pinterest", description: "Tráfego orgânico de longo prazo. 10-15 pins/semana. KPI: 500K impressões/mês." },
        { icon: "💼", title: "LinkedIn", description: "Autoridade B2B + employer brand. 3 posts/semana empresa. KPI: 50 conexões B2B/mês." },
        { icon: "🎬", title: "YouTube", description: "Conteúdo profundo + SEO. 1 vídeo + 5 Shorts/semana. KPI: 10K inscritos em 12 meses." },
        { icon: "🎵", title: "TikTok", description: "Alcance e descoberta. 4-5 vídeos/semana. KPI: 1M views/mês em 6 meses." },
        { icon: "🌐", title: "WhatsApp Status", description: "Micro-conteúdo para base existente. Diário. KPI: 200+ views por status." },
      ],
    },
  },

  /* ═══════════════════════════════════════════
     BLOCO 3 — PILARES DE CONTEÚDO
     ═══════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 03",
      title: "Pilares de\nConteúdo",
      subtitle: "Os 6 eixos temáticos que sustentam toda a produção de conteúdo Parket.",
    },
  },
  {
    type: "split",
    props: {
      title: "Pilar 1\nPortfólio & Projetos",
      image: IMG_LIVING,
      label: "40% do conteúdo",
      content: "O coração visual da marca. Projetos concluídos fotografados profissionalmente, mostrando a madeira em contexto real — a peça de desejo.",
      items: [
        "Carrosséis de projeto: 5-8 fotos com ângulos variados + close de detalhes",
        "Before/After em formato side-by-side ou transição em Reel",
        "Ficha técnica: Tipo de madeira, padrão, acabamento, m² — no caption",
        "Tag de arquiteto/designer em todas as publicações de projeto",
        "Depoimento breve do cliente no último slide do carrossel",
      ],
    },
  },
  {
    type: "split",
    props: {
      title: "Pilar 2\nBastidores & Processo",
      image: IMG_CRAFT,
      label: "25% do conteúdo",
      content: "O que diferencia artesanato de commodity. Mostrar o 'como' — as mãos, as ferramentas, a precisão milimétrica que justifica o preço premium.",
      items: [
        "Time-lapse de instalação (Reel/TikTok — alta viralidade)",
        "Close-up de técnicas: lixamento, encaixe, acabamento manual",
        "\"Um dia na obra\" — acompanhamento do instalador",
        "Seleção de madeira: visita ao fornecedor, escolha de tábuas",
        "Controle de qualidade: como cada peça é inspecionada",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Pilar 3\nEducação & Autoridade",
      label: "20% do conteúdo",
      highlight: "Conteúdo que posiciona a Parket como a principal fonte de conhecimento sobre pisos de madeira no Brasil.",
      items: [
        "\"Guia de Madeiras\": Série fixa comparando espécies (Cumaru vs Ipê vs Tauari)",
        "\"Mito ou Verdade\": Posts quebrando crenças erradas sobre piso de madeira",
        "Infográficos de manutenção: como limpar, quando restaurar, produtos ideais",
        "\"Pergunte ao Especialista\": Q&A semanal nos Stories respondendo dúvidas reais",
        "Glossário visual: O que é herringbone? Chevron? Espinha de peixe?",
        "Comparativos honestos: Madeira maciça vs Engineered vs Porcelanato madeira",
        "Tendências: O que está em alta na arquitetura mundial de pisos",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Pilar 4\nCultura & Marca",
      label: "10% do conteúdo",
      highlight: "A história de uma empresa familiar premium — humanizar a marca sem perder a sofisticação.",
      items: [
        "\"3 Gerações\": Posts contando a história da família e da empresa",
        "Valores Parket: Cada valor traduzido em ação real do dia-a-dia",
        "Time: Apresentar colaboradores-chave (instalador mestre, designer, atendimento)",
        "Marcos e conquistas: Premiações, certificações, obras icônicas completadas",
        "Bastidores do escritório/showroom: Ambiente de trabalho e cultura",
        "Data comemorativa do setor: Dia do Marceneiro, semanas de design, etc.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Pilar 5\nInspiração & Lifestyle",
      label: "5% do conteúdo",
      highlight: "Conteúdo aspiracional que conecta pisos de madeira ao estilo de vida premium que nosso público deseja.",
      items: [
        "Mood boards: Combinações de pisos + mobiliário + iluminação",
        "\"Sala dos Sonhos\": Ambientes inspiracionais com piso Parket em destaque",
        "Parcerias com marcas complementares: iluminação, mobiliário, paisagismo",
        "Referências internacionais: Projetos com madeira pelo mundo",
        "Quotes de arquitetos famosos sobre materialidade e madeira",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Mix de Formatos\npor Pilar",
      label: "Matriz Formato × Pilar",
      cards: [
        { icon: "📸", title: "Carrossel", description: "Portfólio (40%), Educação (35%), Marca (25%). Formato que gera mais saves." },
        { icon: "🎬", title: "Reels / TikTok", description: "Bastidores (40%), Portfólio (30%), Educação (30%). Formato de maior alcance." },
        { icon: "📖", title: "Stories", description: "Bastidores (35%), Educação (30%), Marca (20%), Lifestyle (15%). Engajamento diário." },
        { icon: "✍️", title: "Post Estático", description: "Educação (40%), Marca (30%), Lifestyle (30%). Captions longas e informativas." },
      ],
    },
  },

  /* ═══════════════════════════════════════════
     BLOCO 4 — CALENDÁRIO EDITORIAL
     ═══════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 04",
      title: "Calendário\nEditorial",
      subtitle: "Estrutura semanal, cadência e ritmo de publicação para cada canal.",
    },
  },
  {
    type: "process",
    props: {
      title: "Semana Tipo\nInstagram",
      label: "Cadência Semanal",
      steps: [
        { number: "SEG", title: "Carrossel de Projeto", description: "Portfólio completo com 6-8 slides. Caption com ficha técnica e tag do arquiteto. Stories: 3-4 frames de bastidores." },
        { number: "TER", title: "Reel Educativo", description: "\"Mito ou Verdade\" ou \"Guia Rápido\". 30-60s. Caption com CTA para salvar. Stories: Enquete sobre o tema." },
        { number: "QUA", title: "Post de Bastidores", description: "Foto ou carrossel mostrando processo. Caption storytelling. Stories: Diário da obra." },
        { number: "QUI", title: "Reel de Processo", description: "Time-lapse ou before/after de obra. 15-30s com música trending. Stories: Q&A respondendo perguntas." },
        { number: "SEX", title: "Conteúdo de Marca", description: "Post institucional, cultura ou lifestyle. Caption emocional. Stories: Bastidores do time." },
        { number: "SAB", title: "Reel de Inspiração", description: "Mood board animado ou tour de projeto. Formato leve e aspiracional. Stories: Repost de clientes/arquitetos." },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Cadência\nMultiplataforma",
      label: "Frequência por Canal",
      steps: [
        { number: "IG", title: "4-5 posts + 3-4 Reels + Stories diários", description: "Canal principal. Maior investimento de produção. Grid planejado com 2 semanas de antecedência." },
        { number: "TT", title: "4-5 vídeos/semana", description: "Conteúdo nativo ou adaptado de Reels. Linguagem mais casual, hooks agressivos. Testar formatos diferentes." },
        { number: "PT", title: "10-15 pins/semana", description: "Pins de projetos + infográficos + artigos do blog. Otimização SEO em títulos e descrições." },
        { number: "LI", title: "3 posts empresa + 2 pessoais/semana", description: "Artigos longos quinzenais. Cases B2B. Thought leadership dos fundadores." },
        { number: "YT", title: "1 vídeo longo + 5 Shorts/semana", description: "Vídeo longo às quintas. Shorts diários adaptados de Reels. Thumbnails padronizadas." },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Calendário\nSazonal",
      label: "Datas-Chave 2026",
      cards: [
        { icon: "🏠", title: "Jan-Fev — Renovação", description: "\"Ano novo, piso novo\". Campanhas de antes/depois. Promoção de início de ano." },
        { icon: "📐", title: "Mar-Abr — CASACOR prep", description: "Contagem regressiva para CASACOR. Parcerias com arquitetos. Sneak peeks de projetos." },
        { icon: "🌿", title: "Mai-Jun — Sustentabilidade", description: "Dia do Meio Ambiente. Madeira certificada. Conteúdo ESG e rastreabilidade." },
        { icon: "🎨", title: "Jul-Ago — Design Week", description: "Tendências globais. Cobertura de feiras. Novos padrões e coleções." },
        { icon: "🔨", title: "Set-Out — Dia do Marceneiro", description: "Homenagem ao artesão. Bastidores intensos. Histórias do time de instalação." },
        { icon: "🎄", title: "Nov-Dez — Premium Season", description: "\"Prepare sua casa para as festas\". Projetos de alto padrão. Retrospectiva do ano." },
      ],
    },
  },

  /* ═══════════════════════════════════════════
     BLOCO 5 — DIRETRIZES VISUAIS
     ═══════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 05",
      title: "Diretrizes\nVisuais",
      subtitle: "Padrões estéticos, fotografia, tipografia e identidade visual nas redes.",
    },
  },
  {
    type: "split",
    props: {
      title: "Fotografia\nde Projetos",
      image: IMG_HERRING,
      label: "Diretrizes Foto",
      content: "A fotografia é o ativo mais valioso da marca nas redes. Cada imagem deve transmitir sofisticação, precisão técnica e calor humano da madeira.",
      items: [
        "Iluminação natural sempre que possível — golden hour para externas",
        "Ângulos: wide para contexto, 45° para textura, macro para detalhe",
        "Sempre incluir ao menos 1 foto mostrando a madeira em detalhe (veio, textura)",
        "Paleta de edição: tons quentes, contraste médio, sem filtros exagerados",
        "Proporções: 4:5 para feed, 9:16 para Stories/Reels, 2:3 para Pinterest",
        "Evitar: Fotos com iluminação artificial fria, ambientes vazios sem contexto",
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Grid do Instagram\n— Regras de Ouro",
      label: "Estética do Feed",
      leftTitle: "✓ Fazer",
      leftItems: [
        "Alternar entre fotos wide e close-up a cada 2-3 posts",
        "Manter paleta quente consistente (tons de madeira, bege, preto)",
        "Usar espaço negativo — não lotar as imagens de elementos",
        "Preview do grid antes de publicar (usar app de planejamento)",
        "Carrosséis com primeiro slide impactante e limpo",
        "Tipografia padronizada em posts com texto: Inter ou similar",
      ],
      rightTitle: "✗ Evitar",
      rightItems: [
        "Fotos com filtro excessivamente saturado ou frio",
        "Textos longos diretamente na imagem (fica poluído)",
        "Logos grandes ou watermarks invasivos",
        "Sequência de 3+ posts com a mesma cor dominante",
        "Reels com marca d'água de TikTok (penalização do algoritmo)",
        "Imagens genéricas de banco de imagem sem contexto Parket",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Templates\nPadronizados",
      label: "Sistema Visual",
      highlight: "Um conjunto de 8 templates Canva/Figma garante consistência visual mesmo com múltiplos criadores de conteúdo.",
      items: [
        "Template 1 — Carrossel de Projeto: Capa escura + slides de foto + ficha técnica final",
        "Template 2 — Dica/Educativo: Fundo escuro, título grande, ícone + bullet points",
        "Template 3 — Comparativo: Split screen com vs. ou antes/depois",
        "Template 4 — Citação/Depoimento: Fundo textura madeira + quote em branco",
        "Template 5 — Infográfico: Layout clean com ícones e dados numerados",
        "Template 6 — Stories interativo: Enquete/Quiz com fundo de projeto",
        "Template 7 — Dados/Métrica: Número grande em destaque + contexto abaixo",
        "Template 8 — Cover de Reels: Padronizado com thumbnail de alta qualidade",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Paleta de Cores\npara Social",
      label: "Cores",
      highlight: "A paleta social estende a identidade visual da marca para o ambiente digital, priorizando contraste e legibilidade mobile.",
      items: [
        "Primária: #0A0A0A (preto profundo) — backgrounds de templates e textos",
        "Accent: #B8AA9A (bege Parket) — destaques, ícones, linhas, CTAs",
        "Secundária: #FFFFFF (branco puro) — títulos e tipografia principal",
        "Suporte: rgba(255,255,255,0.5) — textos secundários e descrições",
        "Overlay: rgba(0,0,0,0.6) — sobre fotos para garantir leitura de texto",
        "Alerta: Evitar cores vibrantes — se necessário, usar tons terrosos (#C4956A)",
      ],
    },
  },

  /* ═══════════════════════════════════════════
     BLOCO 6 — COPYWRITING & TOM DE VOZ
     ═══════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 06",
      title: "Copywriting\n& Tom de Voz",
      subtitle: "Como escrever para as redes da Parket — captions, hashtags e CTAs.",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Tom de Voz\nnas Redes",
      label: "Diretrizes de Copy",
      leftTitle: "Somos",
      leftItems: [
        "Especialistas que educam com elegância",
        "Confiantes sem arrogância — afirmações embasadas",
        "Técnicos mas acessíveis — explicamos sem jargões vazios",
        "Detalhistas — cada número e especificação importa",
        "Humanos — por trás da marca há pessoas e paixão por madeira",
        "Storytellers — cada projeto tem uma história para contar",
      ],
      rightTitle: "Não Somos",
      rightItems: [
        "Vendedores agressivos — sem \"CORRA QUE ACABA\"",
        "Genéricos — sem frases como \"o melhor custo-benefício\"",
        "Informais demais — sem gírias ou linguagem de meme forçado",
        "Inacessíveis — sem rebuscamento desnecessário",
        "Frios — sem posts puramente institucionais sem alma",
        "Copiadores — sempre referências originais, nunca réplicas",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Anatomia de\numa Caption Perfeita",
      label: "Fórmula de Caption",
      highlight: "Hook → Contexto → Valor → CTA. Cada parte tem função específica no engajamento.",
      items: [
        "HOOK (linha 1-2): Frase intrigante que faz expandir o 'mais'. Ex: \"Este piso demorou 3 meses para instalar. E cada dia valeu a pena.\"",
        "CONTEXTO (parágrafo 1): Briefing do projeto — local, desafio, pedido do cliente/arquiteto",
        "VALOR (parágrafo 2): O diferencial técnico — por que essa madeira, esse padrão, essa técnica",
        "STORYTELLING (parágrafo 3): Detalhe emocional ou técnico que surpreende",
        "CTA (final): Pergunta ou convite. Ex: \"Qual madeira é a cara da sua casa? Comente 👇\"",
        "HASHTAGS: 15-20 por post, separadas do texto (primeiro comentário ou após 5 quebras de linha)",
      ],
    },
  },
  {
    type: "script",
    props: {
      title: "Exemplos de\nCaption por Pilar",
      label: "Templates de Texto",
      context: "Modelos prontos para adaptar — mantenha o tom e a estrutura, personalize com dados do projeto.",
      lines: [
        {
          speaker: "Portfólio",
          text: "1.200 peças de Cumaru. 47 dias de instalação. Um piso herringbone que transformou completamente este living de 85m². ↓ Arraste para ver o antes e depois.",
        },
        {
          speaker: "Educação",
          text: "Você sabia que o piso de madeira pode durar mais de 80 anos com manutenção correta? Aqui vão 5 erros que reduzem a vida útil pela metade. Salve este post ↓",
        },
        {
          speaker: "Bastidores",
          text: "09:17 da manhã. Nosso instalador Marcos confere a última fileira do chevron com nível laser. 0.3mm de tolerância. É isso que separa artesanato de serviço comum.",
        },
        {
          speaker: "Marca",
          text: "1987. Meu avô começou com um caminhão de madeira e uma promessa: entregar o melhor piso que a madeira permite. 3 gerações depois, a promessa é a mesma.",
        },
      ],
      tips: [
        "Adapte o hook ao formato — Reels precisam de hooks visuais, não textuais",
        "Use emojis com moderação — máximo 3 por caption, sempre funcionais",
        "Quebre parágrafos longos — mobile exige espaçamento generoso",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Estratégia de\nHashtags",
      label: "Hashtags",
      highlight: "Sistema de 3 camadas que maximiza alcance sem parecer spam. 15-20 tags por post.",
      items: [
        "CAMADA 1 — Marca (em todo post): #ParketPisos #ParketBrasil #PisoDeMadeira #MadeiraDeVerdade",
        "CAMADA 2 — Nicho (5-8 por post): #PisoHerringbone #MadeiraEngineered #ArquiteturaBrasileira #InterioresLuxo #PisoChevron",
        "CAMADA 3 — Alcance (5-7 por post): #DecorInspiration #HomeDesign #Reforma #ArquiteturaDeInteriores #ProjetoResidencial",
        "CAMADA 4 — Localização (2-3 por post): #SaoPaulo #InterioresSP #ArquiteturaSP",
        "REGRA: Rotacionar hashtags a cada 3-4 posts para evitar shadowban",
        "ANÁLISE: Revisar performance das hashtags mensalmente e substituir as que não performam",
      ],
    },
  },

  /* ═══════════════════════════════════════════
     BLOCO 7 — STORIES & REELS
     ═══════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 07",
      title: "Stories, Reels\n& Vídeo",
      subtitle: "Estratégias específicas para formatos de vídeo curto e conteúdo efêmero.",
    },
  },
  {
    type: "process",
    props: {
      title: "Fórmulas de\nReels que Funcionam",
      label: "Reels Templates",
      steps: [
        { number: "01", title: "Before → After (Transformação)", description: "3-5s de antes → transição com corte/zoom → 5-10s do resultado. Música trending. Caption: ficha técnica. Viralidade: ALTA." },
        { number: "02", title: "POV do Instalador", description: "Câmera subjetiva mostrando a mão trabalhando. ASMR do encaixe da madeira. 15-30s. Viralidade: MÉDIA-ALTA." },
        { number: "03", title: "Time-Lapse de Obra", description: "Câmera fixa, 30s de uma sala sendo transformada. Antes → processo → resultado. Viralidade: ALTA." },
        { number: "04", title: "\"3 Coisas que...\"", description: "Formato talking-head com cortes rápidos. 3 dicas/erros/verdades. 30-60s. Viralidade: MÉDIA." },
        { number: "05", title: "Satisfying Detail", description: "Macro de textura, encaixe perfeito, brilho do acabamento. 10-15s em loop. Viralidade: ALTA." },
        { number: "06", title: "Tour de Projeto", description: "Walking tour pelo espaço com narração. 30-60s. Termina com wide shot revelando o piso completo." },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Stories —\nEstratégia Diária",
      label: "Stories Framework",
      highlight: "Stories são o canal de relacionamento diário. 8-15 frames/dia, misturando conteúdo planejado e espontâneo.",
      items: [
        "MANHÃ (8-9h): 2-3 frames — \"Bom dia\" do canteiro/showroom + agenda do dia",
        "MEIO-DIA (12-13h): 3-4 frames — Bastidores da obra em andamento + detalhe técnico",
        "TARDE (16-17h): 2-3 frames — Enquete/Quiz educativo + resultado de antes/depois",
        "NOITE (19-20h): 2-3 frames — Inspiração + repost de cliente/arquiteto + CTA para DM",
        "INTERATIVO: Mínimo 1 sticker interativo por dia (enquete, quiz, slider, caixa de pergunta)",
        "HIGHLIGHTS: Organizar em 6-8 categorias: Projetos, Madeiras, FAQ, Processo, Equipe, Depoimentos",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Highlights\nOrganizados",
      label: "Stories Fixos",
      cards: [
        { icon: "🏠", title: "Projetos", description: "Best-of de cada projeto concluído. Capa padronizada com foto do projeto." },
        { icon: "🪵", title: "Madeiras", description: "Guia visual de cada espécie: cor, dureza, uso recomendado, fotos reais." },
        { icon: "❓", title: "FAQ", description: "Respostas às perguntas mais frequentes sobre manutenção, preço, prazo." },
        { icon: "🔨", title: "Processo", description: "Etapa por etapa: como é feita uma obra Parket do orçamento à entrega." },
        { icon: "👥", title: "Equipe", description: "Apresentação dos profissionais-chave. Humaniza e gera confiança." },
        { icon: "⭐", title: "Depoimentos", description: "Prints e vídeos de clientes satisfeitos. Prova social poderosa." },
      ],
    },
  },

  /* ═══════════════════════════════════════════
     BLOCO 8 — COMUNIDADE & UGC
     ═══════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 08",
      title: "Comunidade\n& UGC",
      subtitle: "Engajamento, user-generated content e parcerias estratégicas.",
    },
  },
  {
    type: "split",
    props: {
      title: "Programa de\nArquitetos Parceiros",
      image: IMG_STUDIO,
      label: "Parcerias",
      content: "Arquitetos e designers são os maiores multiplicadores da marca. Um programa estruturado transforma especificadores em embaixadores.",
      items: [
        "Nível 1 — Repost: Qualquer arquiteto que postar com @parketpisos é repostado nos Stories",
        "Nível 2 — Feature: Projetos fotografados profissionalmente viram carrossel no feed",
        "Nível 3 — Collab: Lives, co-criação de conteúdo, posts em colaboração no IG",
        "Nível 4 — Embaixador: Contrato anual, conteúdo exclusivo, prioridade em lançamentos",
        "Enviar kit de boas-vindas digital com assets da marca para facilitar posts",
        "Criar hashtag exclusiva: #ProjetosComParket para rastreamento",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Estratégia de\nEngajamento",
      label: "Community Management",
      highlight: "Engajamento não é opcional — é o combustível do algoritmo. 30 minutos dedicados por dia, divididos em 3 blocos.",
      items: [
        "BLOCO 1 (pós-publicação, 15min): Responder todos os comentários em até 1h. Respostas substantivas, não emojis genéricos",
        "BLOCO 2 (proativo, 10min): Comentar em 10-15 posts de arquitetos, designers e contas do segmento. Comentários de valor, não \"lindo!\"",
        "BLOCO 3 (DMs, 5min): Responder mensagens, agradecer menções, salvar UGC para repost",
        "REGRA DE OURO: Nunca ignorar um comentário negativo — responder com empatia e levar para DM",
        "REGRA: Comentários em posts de outros devem agregar valor — dica técnica, elogio específico",
        "TRACKING: Registrar em planilha os perfis engajados para identificar futuros parceiros/clientes",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "User-Generated\nContent (UGC)",
      label: "Conteúdo do Usuário",
      highlight: "O conteúdo criado por clientes e arquitetos é 4x mais confiável que conteúdo da marca. Incentive, colete e amplifique.",
      items: [
        "Criar hashtag rastreável: #MinhaCasaParket para clientes, #ProjetosComParket para profissionais",
        "Pedir depoimento em vídeo no momento da entrega (emoção máxima)",
        "Enviar cartão pós-obra com QR code para Google Review + hashtag para IG",
        "Repostar todo UGC relevante nos Stories com agradecimento personalizado",
        "Best-of UGC mensal: Compilação no feed com créditos completos",
        "Incentivo: Sorteio trimestral de kit de manutenção entre quem postar com a hashtag",
      ],
    },
  },

  /* ═══════════════════════════════════════════
     BLOCO 9 — TRÁFEGO PAGO
     ═══════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 09",
      title: "Tráfego Pago\n& Performance",
      subtitle: "Estratégia de mídia paga integrada ao orgânico para acelerar resultados.",
    },
  },
  {
    type: "funnel",
    props: {
      title: "Funil de\nMídia Paga",
      label: "Estrutura de Campanhas",
      stages: [
        { name: "TOPO — Awareness", description: "Reels patrocinados + vídeo views", percentage: "50%" },
        { name: "MEIO — Consideração", description: "Carrossel projetos + tráfego site", percentage: "30%" },
        { name: "FUNDO — Conversão", description: "Retargeting + WhatsApp lead", percentage: "15%" },
        { name: "PÓS — Retenção", description: "Remarketing para base + upsell", percentage: "5%" },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Tipos de Campanha\nAtivas",
      label: "Sempre Ligado + Sprints",
      cards: [
        {
          icon: "🔄",
          title: "Always-On: Branding",
          description: "Vídeo views com melhores Reels. R$1.500/mês. Público: interesse em design, reforma, arquitetura. KPI: CPV < R$0.02.",
        },
        {
          icon: "🎯",
          title: "Always-On: Retargeting",
          description: "Carrosséis dinâmicos para visitantes do site/IG. R$1.000/mês. Lookalike de engajadores. KPI: CPC < R$1.50.",
        },
        {
          icon: "📱",
          title: "Sprint: Lead Gen",
          description: "WhatsApp/formulário para consulta gratuita. R$2.000 em sprints de 2 semanas. KPI: CPL < R$35.",
        },
        {
          icon: "📍",
          title: "Sprint: Showroom",
          description: "Campanha local para visitas ao showroom. R$500/mês. Raio 15km. KPI: custo por visita < R$50.",
        },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Orçamento Mensal\nde Mídia Paga",
      label: "Budget Sugerido",
      highlight: "Investimento mensal mínimo de R$5.000/mês para resultado consistente. Escalar conforme ROI comprovado.",
      items: [
        "Instagram/Facebook Ads: R$3.000/mês (60%) — Split: 50% awareness + 30% consideração + 20% conversão",
        "Google Ads (Search + Display): R$1.000/mês (20%) — Palavras-chave de alta intenção",
        "Pinterest Ads: R$500/mês (10%) — Pins de projetos promovidos para tráfego",
        "LinkedIn Ads: R$500/mês (10%) — Apenas para campanhas B2B específicas",
        "REGRA: Nunca impulsionar posts diretamente — sempre criar campanha no Ads Manager",
        "REVISÃO: Otimização semanal de criativos e públicos. Pausa em criativos com CTR < 1%",
      ],
    },
  },

  /* ═══════════════════════════════════════════
     BLOCO 10 — MÉTRICAS & KPIs
     ═══════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 10",
      title: "Métricas\n& KPIs",
      subtitle: "O que medir, como medir e com que frequência reportar.",
    },
  },
  {
    type: "metrics",
    props: {
      title: "KPIs Primários\nde Social Media",
      label: "North Star Metrics",
      metrics: [
        { value: "3.5%", label: "Taxa de Engajamento", description: "Meta: acima da média do segmento (1.5%)" },
        { value: "150", label: "Leads/mês via Social", description: "DMs + WhatsApp + formulários" },
        { value: "8%", label: "Taxa de Save", description: "Indicador de conteúdo de alto valor" },
        { value: "25K", label: "Alcance Semanal", description: "Contas únicas alcançadas por semana" },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Dashboard de\nMétricas Semanais",
      label: "Report Framework",
      steps: [
        { number: "01", title: "Crescimento de Seguidores", description: "Novo vs. perdido. Meta: +200/semana líquido. Fonte: crescimento orgânico vs. pago." },
        { number: "02", title: "Engajamento por Formato", description: "Likes, comentários, saves, shares por tipo de post. Identificar o formato campeão da semana." },
        { number: "03", title: "Alcance e Impressões", description: "Total e por post. % de alcance de não-seguidores (indicador de viralidade)." },
        { number: "04", title: "Performance de Stories", description: "Taxa de conclusão, respostas, cliques em links, stickers. Identificar horários de pico." },
        { number: "05", title: "Conversões e Leads", description: "Cliques no link da bio, DMs recebidas, leads qualificados. Atribuição por conteúdo." },
        { number: "06", title: "Benchmark Competitivo", description: "Comparar engajamento e crescimento com 3-5 concorrentes diretos." },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Cadência de\nReports",
      label: "Governança",
      highlight: "Dados sem análise são ruído. Três cadências de report garantem que insights viram ação.",
      items: [
        "DIÁRIO (5min): Check rápido de engajamento, DMs pendentes, menções para repost",
        "SEMANAL (30min, segunda-feira): Dashboard completo no Notion/Sheets. Top 3 posts da semana. Ajustes no calendário.",
        "MENSAL (reunião 1h, primeiro dia útil): Report completo com ROI. Revisão de pilares e formatos. Planejamento do mês seguinte.",
        "TRIMESTRAL (workshop 3h): Revisão estratégica profunda. Análise de concorrência. Ajuste de metas e budget.",
        "FERRAMENTA: Metricool ou MLabs para automação de coleta. Google Sheets para consolidação manual.",
        "TEMPLATE: Report padronizado com 10 métricas-chave + 3 insights + 3 ações para próxima semana",
      ],
    },
  },

  /* ═══════════════════════════════════════════
     BLOCO 11 — GESTÃO DE CRISE
     ═══════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 11",
      title: "Gestão de Crise\n& Reputação",
      subtitle: "Protocolo para situações negativas nas redes sociais.",
    },
  },
  {
    type: "process",
    props: {
      title: "Protocolo de\nCrise em 5 Passos",
      label: "Crisis Playbook",
      steps: [
        { number: "01", title: "Identificar e Classificar", description: "Nível 1 (comentário negativo isolado), Nível 2 (múltiplas reclamações públicas), Nível 3 (crise viral/imprensa). Escalonar conforme nível." },
        { number: "02", title: "Não Deletar, Não Ignorar", description: "Nunca apagar comentários negativos legítimos — isso amplifica a crise. Exceção: spam, discurso de ódio, fake news óbvio." },
        { number: "03", title: "Responder em < 2h", description: "Resposta pública empática e breve. 'Entendemos sua frustração, [nome]. Vamos resolver isso agora.' Levar detalhes para DM." },
        { number: "04", title: "Resolver no Privado", description: "DM ou telefone. Oferecer solução concreta. Documentar o caso. Se resolvido, pedir permissão para postar a resolução." },
        { number: "05", title: "Aprender e Prevenir", description: "Registrar o caso no banco de crises. Se padrão recorrente, criar conteúdo educativo que antecipe a objeção." },
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Templates de\nResposta",
      label: "Respostas-Padrão",
      leftTitle: "Reclamação de Prazo",
      leftItems: [
        "\"[Nome], entendemos que a espera é frustrante. Obras em madeira exigem um cuidado especial com aclimatação e preparação do substrato que impactam diretamente a qualidade final.\"",
        "\"Vamos verificar o status exato da sua obra agora. Pode nos enviar uma DM com seu nome completo?\"",
        "\"Nosso compromisso é transparência total — vamos te dar uma atualização detalhada em até 24h.\"",
      ],
      rightTitle: "Questionamento de Preço",
      rightItems: [
        "\"Ótima pergunta, [Nome]! O investimento em piso de madeira premium reflete a matéria-prima certificada, instalação especializada e garantia estendida.\"",
        "\"Temos opções para diferentes perfis de projeto. Que tal uma consultoria gratuita para entendermos suas necessidades?\"",
        "\"Preparamos um guia completo sobre o que compõe o valor de um piso premium — link na bio!\"",
      ],
    },
  },

  /* ═══════════════════════════════════════════
     BLOCO 12 — FERRAMENTAS & WORKFLOW
     ═══════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 12",
      title: "Ferramentas\n& Workflow",
      subtitle: "Stack de ferramentas, processos de produção e fluxo de aprovação.",
    },
  },
  {
    type: "grid",
    props: {
      title: "Stack de\nFerramentas",
      label: "Tools",
      cards: [
        { icon: "📅", title: "Planejamento", description: "Notion (calendário editorial) + Google Sheets (report) + Trello (pipeline de conteúdo)." },
        { icon: "🎨", title: "Design", description: "Canva Pro (templates) + Figma (peças complexas) + Lightroom Mobile (edição foto)." },
        { icon: "🎬", title: "Vídeo", description: "CapCut (edição Reels/TikTok) + DaVinci Resolve (YouTube) + InShot (Stories rápidos)." },
        { icon: "📊", title: "Analytics", description: "Metricool (agendamento + métricas) + Meta Business Suite + Google Analytics 4." },
        { icon: "🤖", title: "IA & Automação", description: "ChatGPT (brainstorm de captions) + ManyChat (automação de DM) + Zapier (integrações)." },
        { icon: "📸", title: "Fotografia", description: "iPhone 15 Pro (bastidores) + Câmera profissional DSLR (projetos finais) + Drone DJI Mini." },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Workflow de\nProdução Semanal",
      label: "Processo de Criação",
      steps: [
        { number: "SEG", title: "Planejamento (2h)", description: "Revisão de métricas da semana anterior. Briefing dos posts da semana. Definição de pauta e formatos. Aprovação do calendário." },
        { number: "TER", title: "Produção Visual (3h)", description: "Criação de templates. Edição de fotos e vídeos. Montagem de carrosséis. Legendas draft para todos os posts." },
        { number: "QUA", title: "Revisão & Aprovação (1h)", description: "Review de todos os posts pela liderança. Ajustes de copy e visual. Agendamento de posts SEG-QUA da próxima semana." },
        { number: "QUI", title: "Captação de Conteúdo (2-3h)", description: "Visita a obras para fotos/vídeos. Gravação de Reels planejados. Entrevistas com equipe ou parceiros." },
        { number: "SEX", title: "Pós-Produção & Agendamento (2h)", description: "Edição do material captado. Montagem de Reels. Agendamento de posts QUI-DOM. Buffer de conteúdo." },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Fluxo de\nAprovação",
      label: "Governança",
      highlight: "Todo conteúdo passa por 2 etapas de aprovação antes de publicar. Exceção: Stories espontâneos de bastidores (pré-aprovados por categoria).",
      items: [
        "ETAPA 1 — Social Media Manager: Verifica qualidade visual, copy, hashtags, horário e formato",
        "ETAPA 2 — Diretor de Marketing: Valida alinhamento com marca, tom de voz e estratégia",
        "EXCEÇÃO — Stories Bastidores: Categorias pré-aprovadas (obra em andamento, showroom, equipe) não precisam de aprovação prévia",
        "EXCEÇÃO — Repost de UGC: Desde que o conteúdo original seja positivo e a fonte seja verificada",
        "BLOQUEIO: Posts com preços, promoções, opiniões polêmicas ou dados financeiros exigem aprovação da diretoria",
        "SLA: Aprovação em até 24h úteis. Se não houver resposta, o post é adiado (nunca publicado sem OK)",
      ],
    },
  },

  /* ═══════════════════════════════════════════
     BLOCO 13 — CHECKLIST & ENCERRAMENTO
     ═══════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 13",
      title: "Checklists\n& Encerramento",
      subtitle: "Checklists operacionais e próximos passos para implementação.",
    },
  },
  {
    type: "content",
    props: {
      title: "Checklist de\nPublicação",
      label: "Antes de Publicar",
      items: [
        "☐ Imagem/vídeo na resolução correta (1080×1350 feed, 1080×1920 Reels/Stories)",
        "☐ Caption revisada — sem erros, com hook forte e CTA claro",
        "☐ Hashtags: 15-20, mistura das 4 camadas, rotacionadas vs. último post",
        "☐ Alt text adicionado na imagem (acessibilidade + SEO)",
        "☐ Arquiteto/designer tagado se for projeto colaborativo",
        "☐ Localização adicionada (sempre que relevante)",
        "☐ Horário otimizado (verificar insights do público)",
        "☐ Thumbnail de Reel verificada (sem corte estranho no grid)",
        "☐ Link na bio atualizado se o post menciona link",
        "☐ Cross-post planejado para outras plataformas (se aplicável)",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Checklist\nMensal",
      label: "Revisão Mensal",
      items: [
        "☐ Report de métricas compilado e apresentado à liderança",
        "☐ Top 5 posts do mês identificados — replicar padrões de sucesso",
        "☐ Bottom 5 posts analisados — entender o que não funcionou",
        "☐ Hashtags revisadas — substituir as de baixa performance",
        "☐ Calendário do próximo mês rascunhado com datas-chave",
        "☐ Stock de conteúdo verificado — mínimo 2 semanas de buffer",
        "☐ Perfis de parceiros/arquitetos atualizados na lista de engajamento",
        "☐ Bio e Highlights revisados — informações atualizadas",
        "☐ Benchmark competitivo atualizado (3-5 concorrentes)",
        "☐ Budget de mídia paga revisado — realocar conforme ROI",
      ],
    },
  },
  {
    type: "statement",
    props: {
      statement: "Social media não é sobre postar.\nÉ sobre construir, dia a dia, a percepção de que Parket é sinônimo de piso premium no Brasil.",
      attribution: "Playbook de Social Media — Parket Pisos",
      label: "Princípio Guia",
    },
  },
  {
    type: "closing",
    props: {
      title: "Parket Pisos",
      subtitle: "Playbook de Social Media\n48 Slides — Estratégia Completa\n\n@parketpisos · parket.com.br",
      image: IMG_COVER,
    },
  },
];
