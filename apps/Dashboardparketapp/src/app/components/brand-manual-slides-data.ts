import { type SlideData } from "./slides-data";
import parketLogo from "figma:asset/ea944c52b88c841ea9c822abd0b2ed2bddf425e6.png";
import parketHerringbone from "figma:asset/b9bdf6119029ab1e402ac73b9a4bf22363cd3ff6.png";
import parketWoodInterior from "figma:asset/e602455ef9adc036da056c804817732f86ab9037.png";
import parketLatticeLiving from "figma:asset/34ef7cbd988ad5d042ed3fc1f86d054998bbf494.png";
import parketCurvedShelving from "figma:asset/599bac592a9aaa0e1b24504b427fc642dc39a574.png";
import parketChevronMarble from "figma:asset/ea0f5dc71a9c6dc129a9bab938e0e9a789ce04d5.png";
import parketCasaMilan from "figma:asset/c5da764965787206bd8e7105fcda0252da4da63b.png";
import parketDeckLake from "figma:asset/4d5981327c581648268ef6760447eb46d6931f4c.png";
import parketStoneWall from "figma:asset/e709d3507fb615d8e01cdd56b0745f81577f6d89.png";
import parketInterior from "figma:asset/8895fbbf8e799621eb29613c0c646fae87caae91.png";
import parketExterior from "figma:asset/cdcff48de4bfcde365631855c48651aeedb95349.png";
import parketSpiral from "figma:asset/4a6a8ad24bcda1f844920eb717e3e4d47f57d4d3.png";

const UNSPLASH = {
  luxuryWood: "https://images.unsplash.com/photo-1770625467978-fd7466804171?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3b29kJTIwZmxvb3JpbmclMjBpbnRlcmlvciUyMGRlc2lnbnxlbnwxfHx8fDE3NzE3ODkwMjN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  architect: "https://images.unsplash.com/photo-1695712551846-4dc15433fbd4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcmNoaXRlY3QlMjByZXZpZXdpbmclMjBtYXRlcmlhbCUyMHNhbXBsZXN8ZW58MXx8fHwxNzcxNzg5MDI0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  showroom: "https://images.unsplash.com/photo-1681310483042-64aa6776f112?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwbHV4dXJ5JTIwc2hvd3Jvb20lMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzE3ODkwMjR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  herringbone: "https://images.unsplash.com/photo-1769736436809-eab3de70b175?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwaGVycmluZ2JvbmUlMjBwYXJxdWV0JTIwZmxvb3J8ZW58MXx8fHwxNzcxNzg5MDI0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  livingRoom: "https://images.unsplash.com/photo-1763647972062-5e9cd48fb282?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVnYW50JTIwbW9kZXJuJTIwbGl2aW5nJTIwcm9vbSUyMG5hdHVyYWwlMjBsaWdodHxlbnwxfHx8fDE3NzE3ODkwMjV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  photography: "https://images.unsplash.com/photo-1764779169348-353c6d99dbd0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBicmFuZCUyMHBob3RvZ3JhcGh5JTIwc3R1ZGlvJTIwc2V0dXB8ZW58MXx8fHwxNzcxNzg5MDI3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  construction: "https://images.unsplash.com/photo-1764222233275-87dc016c11dc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwcHJlbWl1bSUyMGJ1aWxkaW5nfGVufDF8fHx8MTc3MTc4OTAyN3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
};

export const brandManualSlides: SlideData[] = [
  // ═══════════════════════════════════════════════════════════════
  // BLOCO 01 — ESSÊNCIA DA MARCA (7 slides)
  // ═══════════════════════════════════════════════════════════════

  // 01. Capa
  {
    type: "cover",
    props: {
      title: "Manual\nde Marca",
      subtitle: "Identidade, voz e diretrizes visuais para todo o ecossistema Parket",
      image: parketDeckLake,
    },
  },

  // 02. Statement de abertura
  {
    type: "statement",
    props: {
      statement:
        "Antes do logo, da cor ou do post existe a verdade da marca. Este manual existe para que cada pessoa do time saiba exatamente o que a Parket representa e como traduzir isso em cada ponto de contato.",
      label: "Por que este manual existe",
      attribution: "Parket Brand",
    },
  },

  // 03. Seção — Essência
  {
    type: "section",
    props: {
      block: "Bloco 01",
      title: "Essência\nda Marca",
      subtitle: "O DNA que sustenta cada decisão de comunicação, design e conteúdo.",
    },
  },

  // 04. Propósito
  {
    type: "content",
    props: {
      title: "Propósito",
      label: "Essência da Marca",
      highlight: "Transformar superfícies em experiências que definem legados.",
      content:
        "Não vendemos madeira. Materializamos a visão de quem exige o melhor para seus espaços. Cada piso, painel ou forro que sai da nossa fábrica carrega a promessa de que aquele ambiente vai contar uma história diferente. Uma história de excelência, de materialidade e de respeito pelo tempo.",
    },
  },

  // 05. Visão + Missão
  {
    type: "twocolumn",
    props: {
      title: "Visão & Missão",
      label: "Essência da Marca",
      leftTitle: "Visão",
      leftItems: [
        "Ser reconhecida como a marca definitiva em soluções de madeira natural para arquitetura de alto padrão no Brasil",
        "Referência absoluta quando se pensa em piso, painel, forro e marcenaria premium",
        "Uma marca que arquitetos, designers e clientes finais mencionam com orgulho",
      ],
      rightTitle: "Missão",
      rightItems: [
        "Entregar soluções completas em madeira natural com engenharia de ponta, do projeto à instalação",
        "Elevar o padrão do mercado através de inovação, curadoria e obsessão por qualidade",
        "Construir relações de confiança de longo prazo com arquitetos, designers e clientes finais",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#B8AA9A",
    },
  },

  // 06. Valores
  {
    type: "grid",
    props: {
      title: "Valores\nFundamentais",
      label: "Essência da Marca",
      columns: 2,
      cards: [
        {
          title: "Excelência Obsessiva",
          description: "O bom nunca é suficiente. Cada detalhe importa. Cada entrega deve ser impecável.",
          icon: "01",
        },
        {
          title: "Autenticidade Material",
          description: "Só trabalhamos com madeira natural. Sem imitações, sem atalhos, sem compromisso.",
          icon: "02",
        },
        {
          title: "Curadoria & Expertise",
          description: "Não somos um catálogo. Somos curadores que orientam a melhor escolha para cada projeto.",
          icon: "03",
        },
        {
          title: "Parceria de Confiança",
          description: "Construímos relações de longo prazo com arquitetos e clientes. Confiança é nosso maior ativo.",
          icon: "04",
        },
        {
          title: "Inovação com Propósito",
          description: "Investimos na planta mais moderna da América Latina não por vaidade, mas por resultado.",
          icon: "05",
        },
        {
          title: "Legado & Permanência",
          description: "Nossos pisos atravessam gerações. Pensamos em décadas, não em tendências passageiras.",
          icon: "06",
        },
      ],
    },
  },

  // 07. Manifesto
  {
    type: "statement",
    props: {
      statement:
        "Existe uma diferença entre colocar madeira no chão e criar um piso que transforma um espaço em algo que você sente. Nós vivemos nessa diferença. A Parket não decora. A Parket define.",
      label: "Manifesto da Marca",
      attribution: "Parket",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 02 — POSICIONAMENTO ESTRATÉGICO (6 slides)
  // ═══════════════════════════════════════════════════════════════

  // 08. Seção
  {
    type: "section",
    props: {
      block: "Bloco 02",
      title: "Posicionamento\nEstratégico",
      subtitle: "Onde estamos no mercado, para quem falamos e o que nos diferencia de todos os demais.",
    },
  },

  // 09. Positioning Statement
  {
    type: "content",
    props: {
      title: "Brand Positioning\nStatement",
      label: "Posicionamento",
      highlight:
        "Para arquitetos, designers e proprietários que exigem o mais alto padrão em madeira natural, a Parket é a empresa que oferece soluções completas — do revestimento à marcenaria — com a engenharia mais avançada e a curadoria mais refinada do mercado brasileiro.",
      content:
        "Diferente de fornecedores tradicionais que vendem commodities, a Parket entrega experiência, precisão e legado. A marca é reconhecida pelos maiores nomes da arquitetura nacional e opera na Casa Milan, obra-prima de Paulo Mendes da Rocha.",
    },
  },

  // 10. O que somos vs. O que não somos
  {
    type: "twocolumn",
    props: {
      title: "O que somos\nvs. O que não somos",
      label: "Posicionamento",
      leftTitle: "O que somos",
      leftItems: [
        "Referência premium em madeira natural",
        "Consultores que orientam a melhor decisão",
        "Engenharia de ponta com execução impecável",
        "Marca que gera orgulho em quem especifica",
        "Parceiro de projeto, não fornecedor de material",
        "Curadoria de espécies, acabamentos e soluções",
      ],
      rightTitle: "O que NÃO somos",
      rightItems: [
        "Loja de materiais de construção",
        "Vendedores que empurram produto",
        "Catálogo genérico de pisos",
        "Opção barata ou 'custo-benefício'",
        "Marca que compete por preço",
        "Fornecedor de laminados ou sintéticos",
      ],
      leftColor: "#6ECB8A",
      rightColor: "#D4716A",
    },
  },

  // 11. Arquétipos de Marca
  {
    type: "content",
    props: {
      title: "Arquétipos\nde Marca",
      label: "Posicionamento",
      highlight: "A Parket opera na intersecção de três arquétipos que definem sua personalidade única.",
      items: [
        "O CRIADOR — Obsessão por fazer o melhor produto possível. Cada piso é uma obra. Perfeccionismo como filosofia.",
        "O SÁBIO — Conhecimento profundo sobre madeiras, processos e tendências. Somos a autoridade que orienta decisões.",
        "O GOVERNANTE — Posição de liderança no mercado premium. Confiança, sofisticação e controle de qualidade absoluto.",
      ],
    },
  },

  // 12. Pilares Estratégicos
  {
    type: "grid",
    props: {
      title: "Pilares\nEstratégicos",
      label: "Posicionamento",
      columns: 2,
      cards: [
        {
          title: "Autoridade Técnica",
          description: "Somos a referência em conhecimento sobre madeira natural. Quando os maiores nomes têm dúvida, ligam para nós.",
          icon: "◆",
        },
        {
          title: "Experiência Premium",
          description: "Do showroom na Casa Milan ao pós-venda — cada touchpoint é impecável e memorável.",
          icon: "◆",
        },
        {
          title: "Verticalização Total",
          description: "Controlamos toda a cadeia. Da floresta à instalação. Isso é raro e poderoso.",
          icon: "◆",
        },
        {
          title: "Relação com Arquitetos",
          description: "Somos parceiros estratégicos dos maiores escritórios. Eles nos especificam por convicção.",
          icon: "◆",
        },
      ],
    },
  },

  // 13. Território de marca — Inspirações
  {
    type: "content",
    props: {
      title: "Território\nde Marca",
      label: "Posicionamento — Referências",
      highlight: "A Parket se posiciona no universo de marcas que definem categoria, não competem nela.",
      items: [
        "LORO PIANA — Luxo silencioso. Material como protagonista. Qualidade que não precisa gritar.",
        "POLIFORM — Design italiano. Arquitetura como arte. Sofisticação funcional e atemporal.",
        "GAGGENAU — Engenharia alemã. Precisão obsessiva. Performance como diferencial visível.",
        "B&B ITALIA — Curadoria. Colaboração com grandes nomes. Design que define gerações.",
        "Assim como essas marcas, a Parket não vende produto — vende um ponto de vista sobre como viver.",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 03 — PÚBLICO & PERSONAS (5 slides)
  // ═══════════════════════════════════════════════════════════════

  // 14. Seção
  {
    type: "section",
    props: {
      block: "Bloco 03",
      title: "Público\n& Personas",
      subtitle: "Conhecer profundamente quem nos ouve é a base de toda comunicação eficaz.",
    },
  },

  // 15. Persona — Arquiteto
  {
    type: "persona",
    props: {
      title: "Persona Primária",
      label: "Público & Personas",
      name: "Arq. Carolina",
      role: "Arquiteta de Alto Padrão",
      demographics: "35-55 anos. Escritório próprio ou sócia em estúdio reconhecido. Projetos residenciais e corporativos acima de R$2M. Viaja para feiras internacionais. Ativa no Instagram profissional.",
      needs: [
        "Fornecedor confiável que não comprometa sua reputação",
        "Amostras rápidas e suporte técnico durante o projeto",
        "Material exclusivo que diferencie seus projetos",
        "Parceiro que entenda prazos e complexidade de obra",
      ],
      painPoints: [
        "Fornecedores que atrasam e comprometem o cronograma",
        "Falta de conhecimento técnico do vendedor",
        "Amostras que não representam o produto final",
        "Ser tratada como 'intermediária' e não como parceira",
      ],
    },
  },

  // 16. Persona — Cliente Final
  {
    type: "persona",
    props: {
      title: "Persona Secundária",
      label: "Público & Personas",
      name: "Roberto",
      role: "Cliente Final — Proprietário",
      demographics: "40-65 anos. Empresário, executivo C-Level ou herdeiro. Patrimônio elevado. Construindo ou reformando residência de alto padrão. Decisão influenciada pelo cônjuge e pelo arquiteto.",
      needs: [
        "Segurança de que está investindo no melhor",
        "Status e exclusividade — material que reflita seu padrão",
        "Processo sem estresse — alguém que resolva tudo",
        "Durabilidade — investimento que atravesse gerações",
      ],
      painPoints: [
        "Medo de errar numa decisão de alto valor",
        "Não entender as diferenças técnicas entre opções",
        "Obra que já atrasou e pressão por resolução rápida",
        "Ter que lidar com múltiplos fornecedores",
      ],
    },
  },

  // 17. Persona — Incorporadora
  {
    type: "persona",
    props: {
      title: "Persona Terciária",
      label: "Público & Personas",
      name: "Fernanda",
      role: "Diretora de Produto — Incorporadora Premium",
      demographics: "35-50 anos. Incorporadora que lança empreendimentos acima de R$20mil/m². Busca diferenciação no mercado. Decide com base em custo total de propriedade, não preço unitário.",
      needs: [
        "Fornecedor com escala e capacidade de atender múltiplas unidades",
        "Material que agregue valor percebido ao empreendimento",
        "Garantia e suporte pós-entrega das unidades",
        "Cases e portfólio que validem a parceria",
      ],
      painPoints: [
        "Fornecedores sem capacidade de atender volume premium",
        "Variação de qualidade entre lotes",
        "Falta de padronização na instalação",
        "Assistência técnica pós-entrega deficiente",
      ],
    },
  },

  // 18. Mapa de decisão
  {
    type: "process",
    props: {
      title: "Mapa de Decisão\ndo Público Premium",
      label: "Público & Personas",
      steps: [
        {
          number: "01",
          title: "Confiança > Preço",
          description: "Clientes premium escolhem quem transmite segurança e domínio. O preço é secundário quando a confiança é absoluta.",
        },
        {
          number: "02",
          title: "Indicação é Moeda",
          description: "80% dos nossos clientes chegam via indicação de arquitetos ou clientes anteriores. Reputação é nosso maior canal.",
        },
        {
          number: "03",
          title: "Experiência Sensorial",
          description: "O cliente precisa tocar, ver e sentir. O digital atrai, mas o showroom converte. Casa Milan é o ponto de virada.",
        },
        {
          number: "04",
          title: "Decisão Coletiva",
          description: "Cônjuge, arquiteto, consultor — múltiplos decisores. Nossa comunicação precisa convencer todos simultaneamente.",
        },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 04 — IDENTIDADE VISUAL (8 slides)
  // ═══════════════════════════════════════════════════════════════

  // 19. Seção
  {
    type: "section",
    props: {
      block: "Bloco 04",
      title: "Identidade\nVisual",
      subtitle: "As diretrizes que garantem consistência e sofisticação em cada ponto de contato visual.",
    },
  },

  // 20. Princípios de Design
  {
    type: "content",
    props: {
      title: "Princípios\nde Design",
      label: "Identidade Visual",
      highlight: "Nosso design comunica antes de explicar. Cada elemento visual carrega o DNA da marca.",
      items: [
        "MINIMALISMO INTENCIONAL — Menos é mais, mas o que fica precisa ser perfeito. Espaço negativo é luxo.",
        "MATERIALIDADE — A textura, o grão, a temperatura da madeira devem ser sentidas mesmo no digital.",
        "ATEMPORALIDADE — Design que não segue tendências passageiras. Se não vai funcionar em 5 anos, não funciona hoje.",
        "PRECISÃO — Alinhamentos, espaçamentos e proporções impecáveis. A qualidade do design reflete a qualidade do produto.",
        "SOFISTICAÇÃO SILENCIOSA — Inspiração Loro Piana: luxo que não precisa gritar. Elegância natural.",
      ],
    },
  },

  // 21. Paleta Primária
  {
    type: "palette",
    props: {
      title: "Paleta de Cores\nPrimária",
      label: "Identidade Visual — Cores",
      colors: [
        {
          name: "Parket Black",
          hex: "#0A0A0A",
          usage: "Background principal. Base de toda comunicação. Transmite sofisticação e profundidade.",
          isPrimary: true,
        },
        {
          name: "Parket Sand",
          hex: "#B8AA9A",
          usage: "Cor de destaque. Remete à madeira natural. Usada em títulos, ícones e acentos.",
          isPrimary: true,
        },
        {
          name: "Parket White",
          hex: "#FFFFFF",
          usage: "Texto principal em fundos escuros. Tipografia e elementos de interface.",
          isPrimary: true,
        },
      ],
      note: "A paleta primária é intencional: preto transmite luxury, sand remete à madeira, branco garante legibilidade. Esta tríade deve dominar 90% de toda comunicação visual.",
    },
  },

  // 22. Paleta Secundária
  {
    type: "palette",
    props: {
      title: "Paleta de Cores\nSecundária",
      label: "Identidade Visual — Cores",
      colors: [
        {
          name: "Warm Oak",
          hex: "#C4956A",
          usage: "Detalhes quentes. CTAs, links e elementos de interação em peças premium.",
        },
        {
          name: "Deep Forest",
          hex: "#2C3A2E",
          usage: "Backgrounds alternativos. Remete à floresta e sustentabilidade.",
        },
        {
          name: "Stone Gray",
          hex: "#717182",
          usage: "Textos secundários, legendas e informações complementares.",
        },
        {
          name: "Light Linen",
          hex: "#F5F0EB",
          usage: "Background claro para materiais impressos e apresentações em fundo branco.",
        },
        {
          name: "Copper Accent",
          hex: "#A67C52",
          usage: "Elementos decorativos, linhas de separação e detalhes metálicos em materiais premium.",
        },
      ],
      note: "Cores secundárias devem ser usadas com moderação (máx. 10% da composição). Nunca devem competir com a paleta primária.",
    },
  },

  // 23. Tipografia
  {
    type: "content",
    props: {
      title: "Tipografia",
      label: "Identidade Visual — Fontes",
      highlight: "A tipografia é a voz silenciosa da marca. Nossas fontes comunicam precisão e sofisticação.",
      items: [
        "INTER — Fonte principal para todo o digital. Clean, moderna e altamente legível. Pesos: Light (300), Regular (400), Medium (500).",
        "TÍTULOS — Inter Light (300) em uppercase com tracking expandido (0.15em-0.20em). Transmite breathing room e luxury.",
        "CORPO — Inter Regular (400) com line-height generoso (1.6-1.8). Conforto de leitura em telas.",
        "DESTAQUES — Inter Medium (500) para labels, CTAs e informações prioritárias.",
        "PROIBIDO — Nunca usar fontes decorativas, scripts ou serifadas em materiais digitais. Em peças impressas premium, consulte o time de design.",
        "HIERARQUIA — Manter no máximo 3 níveis de peso tipográfico por peça. Simplicidade é sofisticação.",
      ],
    },
  },

  // 24. Logo — Regras de Uso
  {
    type: "content",
    props: {
      title: "Logo\nRegras de Uso",
      label: "Identidade Visual — Logo",
      highlight: "O logotipo Parket é nosso ativo mais valioso. Seu uso correto é inegociável.",
      items: [
        "VERSÃO PRIMÁRIA — Logo branco sobre fundo escuro (#0A0A0A). Esta é a versão principal.",
        "VERSÃO SECUNDÁRIA — Logo escuro sobre fundo claro (#F5F0EB). Para materiais impressos e variações.",
        "ÁREA DE PROTEÇÃO — Manter espaço mínimo ao redor do logo equivalente à altura da letra 'P'. Nenhum elemento pode invadir essa área.",
        "TAMANHO MÍNIMO — Digital: 80px de largura. Impresso: 25mm. Abaixo disso, a legibilidade é comprometida.",
        "POSIÇÃO PADRÃO — Canto superior direito em materiais digitais. Centralizado inferior em materiais impressos.",
        "Em dúvida, menos é mais: o logo em marca d'água com 20% de opacidade é sempre elegante.",
      ],
    },
  },

  // 25. Logo — Do's e Don'ts
  {
    type: "dosdonts",
    props: {
      title: "Logo\nDo's & Don'ts",
      label: "Identidade Visual — Logo",
      dos: [
        "Use sempre os arquivos originais fornecidos pelo design",
        "Mantenha proporções originais — nunca distorça",
        "Aplique sobre fundos limpos e sem ruído visual",
        "Use opacidade reduzida (15-25%) como watermark",
        "Garanta contraste suficiente para legibilidade",
      ],
      donts: [
        "Nunca altere as cores do logo",
        "Nunca adicione efeitos: sombra, brilho, gradiente",
        "Nunca rotacione ou incline o logo",
        "Nunca coloque sobre imagens com muito ruído sem overlay",
        "Nunca use o logo como padrão repetitivo ou textura",
      ],
    },
  },

  // 26. Elementos Gráficos
  {
    type: "grid",
    props: {
      title: "Elementos\nGráficos",
      label: "Identidade Visual — Sistema",
      columns: 2,
      cards: [
        {
          title: "Linhas de Separação",
          description: "Linhas finas (1px) em #B8AA9A com opacidade 35%. Usadas para separar seções e criar ritmo visual.",
          icon: "—",
        },
        {
          title: "Cantos Arredondados",
          description: "Border-radius de 8px para cards e containers. 4px para elementos menores. Nunca totalmente retos.",
          icon: "◻",
        },
        {
          title: "Espaço Negativo",
          description: "Generoso. Padding mínimo de 32px em composições digitais. O silêncio visual é parte do design.",
          icon: "◇",
        },
        {
          title: "Overlays de Imagem",
          description: "Gradient overlay escuro (60-80%) sobre fotos. Permite texto legível sem perder a atmosfera.",
          icon: "▣",
        },
        {
          title: "Grid System",
          description: "Grid de 2 colunas para mobile, 3-4 colunas para desktop. Alinhamento rigoroso em todas as peças.",
          icon: "▦",
        },
        {
          title: "Animações",
          description: "Sutis e com propósito. Slide-up com easing suave. Duração: 300-600ms. Nunca chamativos.",
          icon: "↑",
        },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 05 — TOM DE VOZ (7 slides)
  // ═══════════════════════════════════════════════════════════════

  // 27. Seção
  {
    type: "section",
    props: {
      block: "Bloco 05",
      title: "Tom de Voz",
      subtitle: "Como a Parket fala, escreve e se expressa em cada canal e contexto.",
    },
  },

  // 28. Personalidade da Marca
  {
    type: "content",
    props: {
      title: "Personalidade\nda Marca",
      label: "Tom de Voz",
      highlight: "Se a Parket fosse uma pessoa, como ela se comportaria em uma conversa?",
      items: [
        "CONFIANTE, NUNCA ARROGANTE — Sabe do que fala, mas ouve com atenção. Autoridade natural, sem pose.",
        "PRECISA, NUNCA FRIA — Comunica com objetividade e clareza, mas sempre com calor humano e cuidado.",
        "SOFISTICADA, NUNCA INACESSÍVEL — Elegante nas palavras, mas compreensível para todos. Sem jargões gratuitos.",
        "APAIXONADA, NUNCA EXAGERADA — Ama o que faz e isso transparece, mas sem exclamações ou hype desnecessário.",
        "CONSULTIVA, NUNCA VENDEDORA — Orienta, educa e inspira. A venda é consequência, nunca o objetivo visível.",
      ],
    },
  },

  // 29. Eixos de Personalidade
  {
    type: "brandaxis",
    props: {
      title: "Eixos de\nPersonalidade",
      label: "Tom de Voz — Espectro",
      axes: [
        { leftLabel: "Casual", rightLabel: "Formal", position: 72 },
        { leftLabel: "Emocional", rightLabel: "Racional", position: 55 },
        { leftLabel: "Acessível", rightLabel: "Exclusiva", position: 68 },
        { leftLabel: "Divertida", rightLabel: "Séria", position: 62 },
        { leftLabel: "Provocadora", rightLabel: "Respeitosa", position: 75 },
        { leftLabel: "Minimalista", rightLabel: "Detalhista", position: 40 },
      ],
      note: "Estes eixos guiam o equilíbrio da comunicação. Não somos extremos em nenhum — somos sofisticadamente equilibrados, com tendência à formalidade elegante e ao minimalismo.",
    },
  },

  // 30. Tom por Canal
  {
    type: "twocolumn",
    props: {
      title: "Tom de Voz\npor Canal",
      label: "Tom de Voz — Adaptações",
      leftTitle: "Instagram / Redes Sociais",
      leftItems: [
        "Tom mais caloroso e inspiracional",
        "Frases curtas, impactantes, com respiro",
        "Storytelling visual predomina sobre texto",
        "Hashtags: máx. 5, relevantes, sem exagero",
        "Nunca: 'clique aqui', 'não perca', 'promoção'",
      ],
      rightTitle: "Site / Apresentações / E-mail",
      rightItems: [
        "Tom mais técnico e consultivo",
        "Informação estruturada e completa",
        "Dados e cases como prova social",
        "Linguagem direta e profissional",
        "Sempre com call-to-action elegante",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#B8AA9A",
    },
  },

  // 31. Vocabulário da Marca
  {
    type: "twocolumn",
    props: {
      title: "Vocabulário\nda Marca",
      label: "Tom de Voz — Palavras",
      leftTitle: "Palavras que usamos",
      leftItems: [
        "Curadoria, seleção, expertise",
        "Materialidade, textura, veios, grão",
        "Projeto, solução, ambiente, espaço",
        "Investimento, valor, legado, permanência",
        "Precisão, engenharia, excelência",
        "Parceria, confiança, relação",
      ],
      rightTitle: "Palavras que evitamos",
      rightItems: [
        "Promoção, desconto, oferta, barato",
        "Produto, mercadoria, item, artigo",
        "Comprar, gastar, custo",
        "Urgente!, imperdível!, última chance!",
        "O melhor do mercado, líder absoluto",
        "Gírias, abreviações, emojis excessivos",
      ],
      leftColor: "#6ECB8A",
      rightColor: "#D4716A",
    },
  },

  // 32. Exemplos de Tom — Instagram
  {
    type: "script",
    props: {
      title: "Exemplos de Tom\nInstagram",
      label: "Tom de Voz — Na Prática",
      context: "Como a Parket escreve legendas de Instagram. Observe o ritmo, a escolha de palavras e a ausência de exageros.",
      lines: [
        {
          speaker: "Correto",
          text: "Freijó. Veios únicos que contam a história de décadas de crescimento. Neste projeto, a espécie foi escolhida por sua tonalidade quente e grão irregular — cada tábua é diferente, como deve ser.",
        },
        {
          speaker: "Errado",
          text: "OLHA QUE LINDO esse piso de Freijó!!! 😍🔥 O melhor piso do mercado!! Peça já o seu orçamento e não perca essa oportunidade incrível!! Link na bio 👆",
        },
        {
          speaker: "Correto",
          text: "Casa Milan. Paulo Mendes da Rocha, 1970. Onde concreto brutalista encontra madeira natural. O contraste que define nossa visão de arquitetura.",
        },
        {
          speaker: "Errado",
          text: "Nosso showroom é INCRÍVEL!! 🏠✨ Venha nos visitar e conhecer os melhores pisos do Brasil!! Agende sua visita agora!!",
        },
      ],
      tips: [
        "Nunca use mais de 1 emoji por post (e mesmo assim, só se agregar)",
        "Frases curtas. Parágrafos de 1-2 linhas. Respiro entre blocos.",
        "Conte uma história. Qual é a espécie? De onde vem? Por que foi escolhida?",
        "O CTA, quando houver, é discreto: 'Link na bio para conhecer o projeto.'",
      ],
    },
  },

  // 33. Linguagem — Do's e Don'ts
  {
    type: "dosdonts",
    props: {
      title: "Linguagem\nDo's & Don'ts",
      label: "Tom de Voz",
      dos: [
        "Escreva como quem conversa com um arquiteto: inteligente e respeitoso",
        "Use dados e fatos para sustentar afirmações",
        "Conte histórias: a origem da madeira, o processo, o resultado",
        "Seja específico: 'Carvalho Europeu com acabamento natural' > 'piso bonito'",
        "Mantenha consistência: o mesmo tom em todas as plataformas",
      ],
      donts: [
        "Não use superlativos vazios: 'o melhor', 'incrível', 'fantástico'",
        "Não use urgência artificial: 'últimas unidades', 'só hoje'",
        "Não copie o tom de marcas populares/massificadas",
        "Não use linguagem de vendas agressiva em nenhum canal",
        "Não misture formatos: se o post é foto minimalista, a legenda também é",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 06 — ESTRATÉGIA DE CONTEÚDO (7 slides)
  // ═══════════════════════════════════════════════════════════════

  // 34. Seção
  {
    type: "section",
    props: {
      block: "Bloco 06",
      title: "Estratégia\nde Conteúdo",
      subtitle: "Os pilares, formatos e diretrizes que guiam toda a produção de conteúdo da Parket.",
    },
  },

  // 35. Pilares de Conteúdo
  {
    type: "grid",
    props: {
      title: "Pilares de\nConteúdo",
      label: "Estratégia de Conteúdo",
      columns: 2,
      cards: [
        {
          title: "Materialidade",
          description: "Conteúdo sobre madeiras: espécies, origens, características, curiosidades. Educa e posiciona como autoridade. (30% do feed)",
          icon: "01",
        },
        {
          title: "Projetos & Cases",
          description: "Projetos realizados com fotos profissionais. Antes/depois. Depoimentos de arquitetos. Prova social real. (30% do feed)",
          icon: "02",
        },
        {
          title: "Processo & Bastidores",
          description: "A fábrica, a engenharia, a instalação. Mostra o que acontece por trás da entrega final. Gera confiança. (20% do feed)",
          icon: "03",
        },
        {
          title: "Lifestyle & Inspiração",
          description: "Arquitetura, design, tendências. Conteúdo aspiracional que posiciona a Parket no universo premium. (20% do feed)",
          icon: "04",
        },
      ],
    },
  },

  // 36. Calendário de Conteúdo — Estrutura
  {
    type: "process",
    props: {
      title: "Cadência\nde Conteúdo",
      label: "Estratégia de Conteúdo",
      steps: [
        {
          number: "01",
          title: "Feed — 3-4x por semana",
          description: "Posts de alta qualidade visual. Fotos profissionais. Carrosséis educativos. Cada post precisa funcionar sozinho.",
        },
        {
          number: "02",
          title: "Stories — Diários",
          description: "Bastidores, processo, dia a dia. Tom mais caloroso e espontâneo (mas ainda Parket). Máx. 6-8 stories/dia.",
        },
        {
          number: "03",
          title: "Reels — 2-3x por semana",
          description: "Vídeos curtos com produção cinematográfica. Tours de projeto. Transformações. Processo de fabricação.",
        },
        {
          number: "04",
          title: "LinkedIn — 2x por semana",
          description: "Conteúdo mais técnico e institucional. Cases, dados do setor, bastidores de engenharia.",
        },
        {
          number: "05",
          title: "Newsletter — Mensal",
          description: "Curadoria de projetos, tendências e insights. Tom editorial. Para base de arquitetos e clientes VIP.",
        },
      ],
    },
  },

  // 37. Instagram Guidelines
  {
    type: "content",
    props: {
      title: "Instagram\nGuidelines",
      label: "Estratégia de Conteúdo — Instagram",
      highlight: "O Instagram é nosso principal canal de marca. Cada post é uma vitrine da Parket.",
      items: [
        "GRID — Manter harmonia visual. Alternar entre close-ups de textura, ambientes amplos e conteúdo editorial.",
        "FOTOS — Sempre profissionais ou com qualidade equivalente. Luz natural sempre que possível. Nunca fotos de celular sem tratamento.",
        "LEGENDAS — Máx. 150 palavras. Primeiro parágrafo é gancho. Storytelling > descrição. CTA discreto no final.",
        "HASHTAGS — Máx. 5 por post. Relevantes e nichadas: #madeiraNatural #pisosdeMadeira #arquiteturaPremium. Nunca genéricas.",
        "STORIES — Autêntico mas com padrão visual. Fonte Inter. Paleta de cores da marca. Sem filtros que descaracterizem.",
        "REELS — Cinematográfico. Transições suaves. Música instrumental ou ambiente. Nunca trends genéricas ou dancinhas.",
        "BIO — Mantida atualizada com link principal e informação essencial. Clean e objetiva.",
      ],
    },
  },

  // 38. Formatos por Plataforma
  {
    type: "grid",
    props: {
      title: "Formatos\npor Plataforma",
      label: "Estratégia de Conteúdo — Formatos",
      columns: 2,
      cards: [
        {
          title: "Post Estático",
          description: "1080x1350px (4:5). Foto hero com overlay mínimo. Tipografia integrada quando necessário. Nunca poluído.",
          icon: "IG",
        },
        {
          title: "Carrossel",
          description: "1080x1350px. Máx. 10 slides. Capa impactante, conteúdo educativo, CTA final. Manter identidade visual slide a slide.",
          icon: "IG",
        },
        {
          title: "Reels / Vídeo",
          description: "1080x1920px (9:16). 15-90 segundos. Cinematográfico. Legendas quando necessário. Sempre com som original ou música premium.",
          icon: "IG",
        },
        {
          title: "Stories",
          description: "1080x1920px. Fundo na paleta da marca. Fonte Inter. Enquetes e CTAs com moderação. Destaque curado mensalmente.",
          icon: "IG",
        },
        {
          title: "LinkedIn",
          description: "1200x627px para imagens. Posts longos com dados e insights. Tom mais institucional. Cases com métricas quando possível.",
          icon: "LI",
        },
        {
          title: "Website / Blog",
          description: "Conteúdo evergreen. SEO otimizado. Fotos em alta resolução. Estrutura clara com H1-H3. CTA para showroom.",
          icon: "WEB",
        },
      ],
    },
  },

  // 39. Fluxo de criação
  {
    type: "process",
    props: {
      title: "Fluxo de Criação\nde Conteúdo",
      label: "Estratégia de Conteúdo — Processo",
      steps: [
        {
          number: "01",
          title: "Planejamento (Seg)",
          description: "Reunião semanal: definir pauta, pilares e formatos. Alinhar com calendário comercial e lançamentos.",
        },
        {
          number: "02",
          title: "Briefing (Seg-Ter)",
          description: "Briefing claro para cada peça: objetivo, formato, referências, copy draft e assets necessários.",
        },
        {
          number: "03",
          title: "Produção (Ter-Qui)",
          description: "Captação de fotos/vídeo. Criação de arte. Redação de copy. Tudo seguindo este manual.",
        },
        {
          number: "04",
          title: "Revisão (Qui-Sex)",
          description: "Checklist de brand compliance. Revisão de texto, visual e tom. Aprovação do líder de marketing.",
        },
        {
          number: "05",
          title: "Publicação",
          description: "Agendamento nos melhores horários. Monitoramento de performance. Engajamento com comentários.",
        },
      ],
    },
  },

  // 40. Métricas de Conteúdo
  {
    type: "metrics",
    props: {
      title: "Métricas que\nImportam",
      label: "Estratégia de Conteúdo — KPIs",
      metrics: [
        { value: "3-5%", label: "Engagement Rate", description: "Meta mínima no Instagram" },
        { value: "40%", label: "Save Rate", description: "Saves/alcance — indica conteúdo de valor" },
        { value: "2x", label: "Crescimento mensal", description: "Seguidores qualificados por mês" },
        { value: "15%", label: "Click-through", description: "Stories → Link na bio" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 07 — FOTOGRAFIA & VÍDEO (6 slides)
  // ═══════════════════════════════════════════════════════════════

  // 41. Seção
  {
    type: "section",
    props: {
      block: "Bloco 07",
      title: "Fotografia\n& Vídeo",
      subtitle: "A direção criativa que faz cada imagem Parket ser inconfundível.",
    },
  },

  // 42. Princípios de Fotografia
  {
    type: "visual",
    props: {
      title: "Princípios de\nFotografia",
      label: "Fotografia & Vídeo",
      image: parketLatticeLiving,
      caption: "Referência: luz natural, composição clean, materialidade em foco",
      guidelines: [
        "LUZ NATURAL — Sempre preferir. Horário dourado ou luz difusa. Flash direto é proibido.",
        "COMPOSIÇÃO — Regra dos terços. Linhas guia. Ângulos que valorizem a profundidade do ambiente.",
        "MATERIALIDADE — Close-ups que mostram veios, textura e grão. O espectador precisa quase sentir a madeira.",
        "CONTEXTO — Ambientes reais, mobiliados, vividos. Nunca espaços vazios ou clínicos demais.",
        "TEMPERATURA — Tons quentes predominantes. Evitar fotos frias ou excessivamente saturadas.",
        "PÓS-PRODUÇÃO — Sutil. Correção de cor, não filtros. A realidade da madeira é bonita por si só.",
      ],
    },
  },

  // 43. Estilo Visual — Moodboard
  {
    type: "visual",
    props: {
      title: "Estilo Visual\nMoodboard",
      label: "Fotografia & Vídeo — Direção",
      image: parketWoodInterior,
      caption: "Universo visual: arquitetura, materialidade, sofisticação silenciosa",
      guidelines: [
        "Referência visual: editorial de arquitetura (AD, Dezeen, Wallpaper*)",
        "Paleta de cores natural: madeira, pedra, linho, concreto, metal escovado",
        "Pessoas aparecem sutilmente — mão tocando a madeira, pé no piso, silhueta no ambiente",
        "Objetos de lifestyle: livros, plantas, peças de design — nunca objetos baratos ou genéricos",
        "Inspiração Loro Piana: luxo discreto, texturas ricas, composição impecável",
      ],
    },
  },

  // 44. Fotografia — Do's e Don'ts
  {
    type: "dosdonts",
    props: {
      title: "Fotografia\nDo's & Don'ts",
      label: "Fotografia & Vídeo",
      dos: [
        "Fotografe com câmera profissional ou celular premium com tratamento posterior",
        "Priorize luz natural e horários com iluminação suave",
        "Mostre a madeira em contexto real — integrada ao ambiente",
        "Capture detalhes: veios, junções, reflexos de luz natural",
        "Mantenha horizonte reto e linhas alinhadas — precisão é luxo",
      ],
      donts: [
        "Nunca publique foto sem tratamento básico de cor e enquadramento",
        "Nunca use flash direto — mata a textura e a profundidade",
        "Nunca fotografe amostras isoladas em fundo branco genérico",
        "Nunca use ângulos distorcidos ou lentes olho-de-peixe",
        "Nunca publique foto com entulho, bagunça ou elementos indesejados visíveis",
      ],
    },
  },

  // 45. Direção de Vídeo
  {
    type: "content",
    props: {
      title: "Direção\nde Vídeo",
      label: "Fotografia & Vídeo — Filmmaker",
      highlight: "Vídeo Parket = cinema. Cada frame é composto como se fosse uma fotografia.",
      items: [
        "MOVIMENTO — Suave, lento, intencional. Gimbal ou tripé. Nunca câmera na mão tremida.",
        "RITMO — Edição calma. Cortes com propósito. Transições suaves (dissolve, fade). Nunca jump cuts frenéticos.",
        "SOM — Som ambiente valorizado (passos na madeira, eco do espaço). Música: instrumental, minimalista, atemporal.",
        "DURAÇÃO — Reels: 15-45s. Institucional: 60-120s. Projeto completo: até 3min. Nunca mais que o necessário.",
        "COLOR GRADING — Tons quentes, contraste controlado, pele natural. Referência: filmes de Wes Anderson (precisão) + editorial de arquitetura.",
        "NARRAÇÃO — Quando houver, voz calma e segura. Texto enxuto. Pausas intencionais. Nunca tom de locutor comercial.",
        "FORMATO — Sempre capturar em 4K. Entregar em 1080p para redes. Manter arquivo RAW para uso futuro.",
      ],
    },
  },

  // 46. Template de Briefing de Filmagem
  {
    type: "grid",
    props: {
      title: "Briefing de\nFilmagem",
      label: "Fotografia & Vídeo — Template",
      columns: 2,
      cards: [
        {
          title: "Objetivo",
          description: "O que queremos comunicar? Qual é a mensagem principal? Para quem é este vídeo?",
          icon: "01",
        },
        {
          title: "Formato & Canal",
          description: "Reel, Stories, institucional, LinkedIn? Definir formatos de entrega e durações.",
          icon: "02",
        },
        {
          title: "Roteiro / Shot List",
          description: "Sequência de cenas planejadas. Quais ângulos? Quais detalhes? Quais ambientes?",
          icon: "03",
        },
        {
          title: "Referências Visuais",
          description: "3-5 referências de estilo. Podem ser vídeos, filmes ou fotos. Alinhar expectativa criativa.",
          icon: "04",
        },
        {
          title: "Logística",
          description: "Local, data, horário (luz!), acessos, pessoas presentes. Equipamentos necessários.",
          icon: "05",
        },
        {
          title: "Entregáveis & Prazo",
          description: "Quantas peças? Quais formatos? Data de entrega do bruto e do editado.",
          icon: "06",
        },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 08 — TRÁFEGO PAGO (5 slides)
  // ═══════════════════════════════════════════════════════════════

  // 47. Seção
  {
    type: "section",
    props: {
      block: "Bloco 08",
      title: "Tráfego\nPago",
      subtitle: "Diretrizes para performance que respeita a marca e converte com inteligência.",
    },
  },

  // 48. Princípios de Performance
  {
    type: "content",
    props: {
      title: "Princípios de\nPerformance",
      label: "Tráfego Pago",
      highlight: "Performance não é desculpa para destruir a marca. Resultados e estética coexistem.",
      items: [
        "MARCA PRIMEIRO — Todo anúncio, mesmo de performance, deve ser reconhecido como Parket em 2 segundos.",
        "QUALIDADE DO CRIATIVO — A qualidade visual dos anúncios deve ser tão alta quanto a do feed orgânico.",
        "SEGMENTAÇÃO PRECISA — Preferimos alcançar 1.000 pessoas certas a 100.000 erradas. Qualidade > quantidade.",
        "LANDING PAGE COERENTE — A experiência pós-clique deve ser tão premium quanto o anúncio.",
        "MENSURAÇÃO INTELIGENTE — Nem todo resultado é imediato. Brand awareness é investimento de médio prazo.",
        "TESTE CONTÍNUO — A/B test de criativos, copies e segmentações. Dados guiam decisões, não achismos.",
      ],
    },
  },

  // 49. Estrutura de Campanhas
  {
    type: "grid",
    props: {
      title: "Estrutura de\nCampanhas",
      label: "Tráfego Pago — Estrutura",
      columns: 2,
      cards: [
        {
          title: "Topo de Funil",
          description: "Awareness. Vídeos de projeto. Conteúdo educativo sobre madeiras. Amplo alcance qualificado. Interesses: arquitetura, design, lifestyle premium.",
          icon: "TOFU",
        },
        {
          title: "Meio de Funil",
          description: "Consideração. Carrosséis de antes/depois. Depoimentos de arquitetos. Tours pelo showroom. Retargeting de visitantes do site.",
          icon: "MOFU",
        },
        {
          title: "Fundo de Funil",
          description: "Conversão. Formulário de orçamento. Agendamento de visita. Lookalike de clientes. Remarketing de visitantes engajados.",
          icon: "BOFU",
        },
        {
          title: "Retenção",
          description: "Pós-venda. Conteúdo de manutenção. Programa de indicação. Nutrição da base existente. E-mail + WhatsApp.",
          icon: "RET",
        },
      ],
    },
  },

  // 50. Guidelines de Criativos para Ads
  {
    type: "dosdonts",
    props: {
      title: "Criativos para Ads\nDo's & Don'ts",
      label: "Tráfego Pago — Criativos",
      dos: [
        "Use fotos profissionais — mesma qualidade do feed orgânico",
        "Headlines curtas e impactantes: 'Madeira natural. Engenharia precisa.'",
        "CTA claro mas elegante: 'Agende uma visita ao showroom' > 'COMPRE AGORA'",
        "Teste variações de criativo mantendo a identidade visual consistente",
        "Inclua proof points sutis: 'Presentes nos maiores projetos do Brasil'",
      ],
      donts: [
        "Nunca use estoque de imagem (stock photos) genérico",
        "Nunca use texto sobre imagem com baixa legibilidade",
        "Nunca use linguagem de urgência falsa ou clickbait",
        "Nunca descuide da landing page — ela fecha a venda",
        "Nunca ignore o mobile — 85% do tráfego vem do celular",
      ],
    },
  },

  // 51. Fluxo de Aprovação
  {
    type: "process",
    props: {
      title: "Fluxo de\nAprovação",
      label: "Tráfego Pago — Processo",
      steps: [
        {
          number: "01",
          title: "Briefing de campanha",
          description: "Objetivo, público, verba, período e KPIs definidos. Template padrão preenchido.",
        },
        {
          number: "02",
          title: "Criação de criativos",
          description: "Seguindo as diretrizes deste manual. Mínimo de 3 variações por campanha.",
        },
        {
          number: "03",
          title: "Revisão de brand",
          description: "Checklist de compliance visual e textual. O criativo passa no 'teste Parket'?",
        },
        {
          number: "04",
          title: "Aprovação e veiculação",
          description: "Aprovação do líder de marketing. Publicação com tracking correto (UTMs).",
        },
        {
          number: "05",
          title: "Análise semanal",
          description: "Relatório de performance. O que funcionou? O que precisa ajustar? Otimização contínua.",
        },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 09 — GOVERNANÇA DA MARCA (4 slides)
  // ═══════════════════════════════════════════════════════════════

  // 52. Seção
  {
    type: "section",
    props: {
      block: "Bloco 09",
      title: "Governança\nda Marca",
      subtitle: "O sistema que garante consistência, qualidade e integridade em cada ponto de contato.",
    },
  },

  // 53. Checklist de Brand Compliance
  {
    type: "content",
    props: {
      title: "Checklist de\nBrand Compliance",
      label: "Governança da Marca",
      highlight: "Antes de publicar qualquer material, passe por este checklist. Sem exceções.",
      items: [
        "A peça usa exclusivamente as cores da paleta Parket?",
        "A tipografia é Inter nos pesos corretos (300, 400, 500)?",
        "O logo está aplicado corretamente, com área de proteção?",
        "O tom de voz está alinhado com as diretrizes deste manual?",
        "As fotos têm qualidade profissional e seguem a direção de fotografia?",
        "O conteúdo não usa palavras proibidas ou linguagem inadequada?",
        "Em dúvida, submeta ao líder de design ou marketing antes de publicar.",
      ],
    },
  },

  // 54. Fluxo de Aprovação de Materiais
  {
    type: "process",
    props: {
      title: "Fluxo de Aprovação\nde Materiais",
      label: "Governança da Marca",
      steps: [
        {
          number: "01",
          title: "Solicitação",
          description: "Qualquer material novo começa com um briefing. Objetivo, formato, canal e deadline.",
        },
        {
          number: "02",
          title: "Criação",
          description: "Time de design/conteúdo produz seguindo este manual. Sempre com referências visuais.",
        },
        {
          number: "03",
          title: "Revisão Interna",
          description: "Checklist de brand compliance aplicado. Feedback documentado. Ajustes realizados.",
        },
        {
          number: "04",
          title: "Aprovação Final",
          description: "Líder de marketing ou direção aprova. Material liberado para publicação/impressão.",
        },
        {
          number: "05",
          title: "Arquivo",
          description: "Material final arquivado na pasta compartilhada com nomenclatura padrão e data.",
        },
      ],
    },
  },

  // 55. Fechamento
  {
    type: "closing",
    props: {
      title: "Parket",
      subtitle: "Cada ponto de contato é uma promessa.\nCada material é uma extensão da marca.\nCada detalhe conta a nossa história.\n\nEste manual é vivo — ele cresce com a Parket.",
      image: parketHerringbone,
      logo: parketLogo,
    },
  },
];
