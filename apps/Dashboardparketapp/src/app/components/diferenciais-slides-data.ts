import { type SlideData } from "./slides-data";
import parketLogo from "figma:asset/ea944c52b88c841ea9c822abd0b2ed2bddf425e6.png";
import parketHerringbone from "figma:asset/b9bdf6119029ab1e402ac73b9a4bf22363cd3ff6.png";
import parketCurvedShelving from "figma:asset/599bac592a9aaa0e1b24504b427fc642dc39a574.png";
import parketStoneWall from "figma:asset/e709d3507fb615d8e01cdd56b0745f81577f6d89.png";
import parketWoodInterior from "figma:asset/e602455ef9adc036da056c804817732f86ab9037.png";
import parketCasaMilan from "figma:asset/c5da764965787206bd8e7105fcda0252da4da63b.png";
import parketDeckLake from "figma:asset/4d5981327c581648268ef6760447eb46d6931f4c.png";

export const diferenciaisSlides: SlideData[] = [

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 1 — INTRODUÇÃO (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 1. Capa
  {
    type: "cover",
    props: {
      title: "Manual de\nDiferenciais",
      subtitle: "Conheça, domine e comunique o que nos torna únicos",
      image: parketCurvedShelving,
    },
  },

  // 2. Statement
  {
    type: "statement",
    props: {
      statement: "O cliente não compra madeira. Ele compra a certeza de que fez a melhor escolha. Cada diferencial é uma camada de confiança que você constrói.",
      label: "Por Que Este Manual Existe",
      attribution: "Diretoria Comercial Parket",
    },
  },

  // 3. Mapa dos diferenciais
  {
    type: "grid",
    props: {
      title: "Nossos 10\nDiferenciais",
      label: "Visão Geral",
      columns: 2,
      cards: [
        { title: "100% Madeira Natural", description: "Curadoria global: das nossas florestas na América do Sul aos carvalhos europeus, nogueira americana e muito mais.", icon: "01" },
        { title: "Fábrica Própria", description: "A planta mais moderna da América Latina.", icon: "02" },
        { title: "Tábuas Acima de 20cm", description: "Os únicos a produzir. Exclusividade absoluta.", icon: "03" },
        { title: "Solução Completa", description: "Do piso à marcenaria fina, tudo integrado.", icon: "04" },
        { title: "Casa Milan", description: "Showroom na icônica obra de Paulo Mendes da Rocha.", icon: "05" },
        { title: "Instalação Própria", description: "Equipe treinada, sem terceirizados, com garantia.", icon: "06" },
        { title: "50+ Anos de Mercado", description: "Cinco décadas de expertise e credibilidade.", icon: "07" },
        { title: "10mil+ Projetos", description: "Residências, hotéis, corporativos e fachadas.", icon: "08" },
        { title: "Atendimento Consultivo", description: "Cada projeto é tratado como único, do briefing à entrega.", icon: "09" },
        { title: "Portfólio de Referência", description: "Os maiores nomes da arquitetura brasileira.", icon: "10" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 2 — DEEP DIVE EM CADA DIFERENCIAL (10 slides)
  // ═══════════════════════════════════════════════════════════════

  // 4. Seção
  {
    type: "section",
    props: {
      block: "Bloco 01",
      title: "Deep Dive",
      subtitle: "Cada diferencial explicado em profundidade — o que é, por que importa e como comunicar.",
    },
  },

  // 5. 100% Madeira Natural
  {
    type: "content",
    props: {
      title: "100% Madeira\nNatural — Do Mundo\nInteiro",
      label: "Diferencial 01",
      highlight: "Não trabalhamos com laminados, sintéticos, porcelanatos ou vinílicos. Trabalhamos exclusivamente com madeira natural — e fazemos uma curadoria global para trazer ao Brasil o que existe de melhor no mundo.",
      items: [
        "América do Sul: produzimos Cumaru, Ipê, Freijó, Peroba, Jatobá e outras espécies nobres a partir de florestas próprias no Brasil, Bolívia e Peru",
        "Europa: importamos Carvalho Europeu da Alemanha e Itália — a madeira mais especificada pela arquitetura mundial — e Pinho de Riga da Dinamarca, com textura e história únicas",
        "América do Norte: trazemos Nogueira Americana, Carvalho Americano e Maple do Canadá — referências absolutas em design contemporâneo",
        "África: selecionamos madeiras africanas de dureza e beleza excepcionais, ideais para projetos que pedem personalidade e exclusividade",
        "Itália — Pisos Especiais: importamos pisos de madeira combinados com metais e mármores — peças de arte para projetos únicos no mundo",
        "Noruega — Madeira Thermo: trazemos madeira termotratada norueguesa — tecnologia de ponta que garante estabilidade extrema sem uso de químicos",
        "Curadoria global: fomos buscar nos nossos clientes de exportação — distribuidores de todo o mundo — o que existe de melhor. Não vendemos apenas o que produzimos; selecionamos o que há de mais extraordinário no planeta",
        "Como comunicar: 'Na Parket, fazemos uma curadoria das melhores madeiras do mundo. Produzimos nas nossas florestas na América do Sul e importamos carvalhos da Europa, nogueira do Canadá, madeira thermo da Noruega e até pisos com metais e mármores da Itália. Nada de laminados — só madeira natural, de verdade.'",
      ],
    },
  },

  // 6. Fábrica Própria
  {
    type: "split",
    props: {
      title: "Fábrica Própria:\nA Mais Moderna da\nAmérica Latina",
      label: "Diferencial 02",
      image: parketWoodInterior,
      content: "Nosso parque fabril é considerado por especialistas do setor como a planta mais moderna da América Latina. Maquinário de última geração que garante precisão milimétrica em cada peça.",
      items: [
        "Controle total da cadeia: da seleção da madeira bruta ao produto acabado, tudo dentro de casa",
        "Maquinário de ponta: equipamentos importados de altíssima precisão para cortes e acabamentos perfeitos",
        "Capacidade única: somos os únicos a produzir pisos acima de 20cm de largura no Brasil",
        "Rastreabilidade: cada lote é rastreado da origem ao destino — sabe-se exatamente de onde vem cada tábua",
        "Como comunicar: 'Nossa fábrica é considerada a mais moderna da América Latina por quem entende do assunto. Isso significa que cada peça que entregamos tem precisão industrial sem perder a alma artesanal.'",
      ],
    },
  },

  // 7. Tábuas Acima de 20cm
  {
    type: "content",
    props: {
      title: "Tábuas Acima\nde 20cm de Largura",
      label: "Diferencial 03",
      highlight: "Somos os únicos no Brasil a produzir pisos de madeira natural com largura superior a 20cm. Isso não é apenas um detalhe técnico — é um diferencial visual transformador.",
      items: [
        "Impacto visual: tábuas largas criam amplitude, sofisticação e sensação de espaço. Poucos emendas, mais continuidade",
        "Dificuldade técnica: produzir tábuas largas exige madeira de altíssima qualidade e maquinário específico — por isso ninguém mais consegue",
        "Estabilidade: nosso processo de tratamento e secagem garante estabilidade dimensional mesmo em peças largas",
        "Tendência internacional: os projetos mais premiados do mundo usam tábuas largas. Referências como Studio MK27 e Marcio Kogan especificam",
        "Comparação: tábuas de 10cm (padrão de mercado) criam visual fragmentado. Tábuas de 22-25cm criam visual contínuo e premium",
        "Como comunicar: 'Nossas tábuas podem chegar a mais de 20cm de largura — algo que ninguém mais faz no Brasil. É uma questão de capacidade fabril. O resultado visual é incomparável: amplitude, elegância e modernidade.'",
      ],
    },
  },

  // 8. Solução Completa
  {
    type: "content",
    props: {
      title: "Solução Completa:\nPiso à Marcenaria",
      label: "Diferencial 04",
      highlight: "Não somos apenas uma empresa de pisos. Fornecemos a solução completa em madeira natural — do revestimento à marcenaria fina, integrando todo o projeto com a mesma madeira ou lâmina natural.",
      items: [
        "Pisos: tábuas maciças ou engenheiradas em todas as espécies, para áreas internas e externas",
        "Painéis e revestimentos de parede: ripados, painéis lisos, boiserie em madeira natural",
        "Forros e tetos: acabamento superior para tetos — liso, ripado ou com desenho personalizado",
        "Escadas: degraus, espelhos, corrimão e guarda-corpo em madeira maciça",
        "Decks e fachadas: madeira tratada para áreas externas com máxima durabilidade",
        "Marcenaria fina: armários, bancadas, prateleiras — tudo na mesma madeira do piso, integrando o projeto por completo",
        "Vantagem para o cliente: um único fornecedor para toda a madeira do projeto = coerência visual, gestão simplificada e responsabilidade única",
        "Como comunicar: 'Na Parket, fornecemos tudo em madeira — do piso à marcenaria, passando por painéis, forros e escadas. Tudo com a mesma madeira, a mesma qualidade, e um único responsável.'",
      ],
    },
  },

  // 9. Casa Milan
  {
    type: "split",
    props: {
      title: "Showroom na\nCasa Milan",
      label: "Diferencial 05",
      image: parketCasaMilan,
      content: "Nosso showroom funciona dentro da Casa Milan — a residência icônica projetada por Paulo Mendes da Rocha, um dos maiores arquitetos da história. É uma experiência sensorial e cultural única.",
      items: [
        "A Casa Milan é Patrimônio da Arquitetura Brasileira — visitá-la já é uma experiência",
        "Ambiente real: as madeiras estão aplicadas em contexto, não em mostruários. Você vive a madeira",
        "Exclusividade: pouquíssimas marcas no mundo têm showroom em edifício icônico de arquitetura",
        "Ferramenta de conversão: o showroom converte porque gera emoção, não apenas informação",
        "Como comunicar: 'Nosso showroom fica na Casa Milan — a residência que Paulo Mendes da Rocha projetou nos anos 70. É um espaço único onde você pode ver, tocar e sentir nossas madeiras em um ambiente de arquitetura premiada.'",
      ],
    },
  },

  // 10. Instalação Própria
  {
    type: "content",
    props: {
      title: "Instalação com\nEquipe Própria",
      label: "Diferencial 06",
      highlight: "100% da instalação é feita por equipe própria Parket, treinada internamente. Zero terceirizados. Isso garante qualidade, padronização e garantia real.",
      items: [
        "Equipe treinada: cada instalador passa por programa interno de capacitação contínua",
        "Sem terceirizados: o mercado terceiriza instalação e perde controle. Nós fazemos tudo internamente",
        "Garantia real: como instalamos com equipe própria, oferecemos garantia sobre material E instalação",
        "Preparação de contrapiso: nossa equipe prepara o contrapiso com as especificações corretas antes de instalar",
        "Pós-instalação: limpeza final, inspeção de qualidade e orientação de manutenção incluídos",
        "Problemas do mercado: 90% dos problemas com madeira vêm de instalação ruim, não do material. Ao controlar a instalação, eliminamos isso",
        "Como comunicar: 'Toda a instalação é feita pela nossa equipe, treinada e supervisionada por nós. Sem terceirizados. Isso garante que o resultado seja perfeito — e que a garantia cubra tudo.'",
      ],
    },
  },

  // 11. 50+ anos e 10mil+ projetos
  {
    type: "content",
    props: {
      title: "50+ Anos de Mercado\n10mil+ Projetos",
      label: "Diferencial 07 + 08",
      highlight: "Mais de cinco décadas de experiência e mais de dez mil projetos entregues. Não somos uma empresa nova experimentando — somos a referência consolidada do setor.",
      items: [
        "Credibilidade: empresas que resistem a 50 anos de mercado são raras. Especialmente no Brasil",
        "Curva de aprendizado: 10mil+ projetos significam que já enfrentamos e resolvemos praticamente qualquer desafio técnico possível",
        "Rede de relacionamento: décadas construindo relações com os maiores arquitetos, incorporadores e construtoras do país",
        "Adaptação: sobreviver 5 décadas exige reinvenção constante. Começamos com pisos e hoje entregamos soluções completas",
        "Contra a concorrência: muitos concorrentes são empresas recentes sem histórico comprovado. Pergunte quantos projetos já entregaram",
        "Como comunicar: 'A Parket tem mais de 50 anos de mercado e mais de 10 mil projetos entregues. Quando se trata de madeira natural de alto padrão, somos a referência que os maiores arquitetos do Brasil escolhem.'",
      ],
    },
  },

  // 12. Atendimento Consultivo + Portfólio
  {
    type: "content",
    props: {
      title: "Atendimento Consultivo\ne Portfólio de Referência",
      label: "Diferencial 09 + 10",
      highlight: "Cada projeto é tratado como único. E nosso portfólio inclui os maiores nomes da arquitetura brasileira — prova social irrefutável.",
      items: [
        "Atendimento consultivo: do primeiro contato à entrega, acompanhamos o projeto com escuta ativa e recomendações técnicas personalizadas",
        "Não vendemos 'de prateleira': analisamos o projeto, entendemos o conceito do arquiteto e sugerimos as melhores soluções em madeira",
        "Portfólio premium: projetos assinados por escritórios como Studio MK27, Isay Weinfeld, Fernanda Marques, entre outros",
        "Prova social poderosa: quando o cliente ouve que trabalhamos com os maiores nomes, a confiança sobe automaticamente",
        "Cases visuais: temos documentação fotográfica profissional de centenas de projetos. Use como ferramenta de venda",
        "Como comunicar: 'Cada projeto que atendemos é único — fazemos uma análise personalizada para recomendar as melhores soluções. Atendemos os maiores escritórios de arquitetura do Brasil. Posso mostrar alguns projetos similares ao seu.'",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 3 — COMO USAR NAS VENDAS (7 slides)
  // ═══════════════════════════════════════════════════════════════

  // 13. Seção
  {
    type: "section",
    props: {
      block: "Bloco 02",
      title: "Como Usar\nna Prática",
      subtitle: "Quando e como acionar cada diferencial em cada etapa da venda.",
    },
  },

  // 14. Diferenciais na Prospecção (BDR)
  {
    type: "content",
    props: {
      title: "Diferenciais na\nProspecção (BDR)",
      label: "Aplicação — BDR",
      highlight: "Na prospecção, use os diferenciais como isca para gerar curiosidade, não como argumento de venda.",
      items: [
        "Cold Call → Use 'Casa Milan': 'Nosso showroom funciona na residência de Paulo Mendes da Rocha. Gostariam de conhecer?'",
        "E-mail → Use '50+ anos': 'Há mais de 50 anos somos referência em madeira natural de alto padrão, com curadoria das melhores espécies do mundo.'",
        "WhatsApp → Use 'Portfólio': Envie foto de projeto de arquiteto renomado como gancho",
        "Follow-up → Use 'Tábuas exclusivas': 'Somos os únicos a produzir pisos acima de 20cm de largura. O impacto visual é incrível.'",
        "Regra de ouro: na prospecção, o diferencial gera CURIOSIDADE. Não exagere — deixe o showroom fazer o resto",
        "Máximo 1-2 diferenciais por contato. Dosifique. A descoberta gradual gera mais desejo",
      ],
    },
  },

  // 15. Diferenciais na Qualificação (SDR)
  {
    type: "content",
    props: {
      title: "Diferenciais na\nQualificação (SDR)",
      label: "Aplicação — SDR",
      highlight: "Na qualificação, use os diferenciais para validar que o lead tem perfil premium e para criar expectativa sobre a visita.",
      items: [
        "Se o lead perguntar preço → 'Cada projeto é personalizado, por isso o investimento varia. Mas posso adiantar: trabalhamos exclusivamente com madeira natural — das nossas florestas na América do Sul aos carvalhos europeus — e com equipe de instalação própria.'",
        "Se o lead comparar com porcelanato → 'Entendo a comparação. No showroom você vai poder pisar nos dois e sentir a diferença. É transformador.'",
        "Se o lead tiver arquiteto → 'Trabalhamos com os maiores escritórios do Brasil. Provavelmente seu arquiteto já nos conhece. Convide-o para a visita.'",
        "Para criar expectativa → 'Nossa fábrica é a mais moderna da América Latina. Na visita, vou mostrar madeiras que você não vai encontrar em nenhum outro lugar.'",
        "Para agendar → 'A Casa Milan, por si só, já é uma experiência. É a residência que Paulo Mendes da Rocha projetou. Vale a visita.'",
      ],
    },
  },

  // 16. Diferenciais no Showroom (Closer)
  {
    type: "content",
    props: {
      title: "Diferenciais no\nShowroom (Closer)",
      label: "Aplicação — Closer",
      highlight: "No showroom, os diferenciais são vivenciados. Não liste — demonstre. O cliente precisa VER, TOCAR e SENTIR.",
      items: [
        "Recepção → 'Esta é a Casa Milan, projetada por Paulo Mendes da Rocha nos anos 70. Uma das obras mais importantes da arquitetura brasileira.'",
        "Tour pelas madeiras → 'Sinta essa tábua de 22cm de largura. Somos os únicos no Brasil a produzir nessa dimensão. Repare na continuidade visual.'",
        "Apresentação técnica → 'Cada peça passa pela nossa fábrica — da madeira bruta ao produto final. O maquinário que usamos é considerado o mais avançado da América Latina.'",
        "Solução completa → 'Além do piso, podemos fazer os painéis, o forro e a marcenaria na mesma madeira. Um projeto totalmente integrado, com um único fornecedor.'",
        "Instalação → 'Nossa equipe própria instala tudo. Sem terceirizados. Isso é raro no mercado e faz toda diferença no resultado.'",
        "Prova social → 'Esse piso é igual ao que instalamos no projeto do [Arquiteto X]. Posso mostrar as fotos do resultado final.'",
      ],
    },
  },

  // 17. Diferenciais na Negociação
  {
    type: "content",
    props: {
      title: "Diferenciais na\nNegociação",
      label: "Aplicação — Negociação",
      highlight: "Na negociação, os diferenciais justificam o investimento. Cada objeção de preço é respondida com valor.",
      items: [
        "'Está caro' → 'Considere que inclui material selecionado + fábrica própria + instalação com equipe treinada + garantia sobre tudo. É um investimento integrado.'",
        "'O concorrente é mais barato' → 'Pergunte se eles produzem tábuas acima de 20cm, se a instalação é própria, e quantos projetos já entregaram. A comparação precisa ser justa.'",
        "'Porcelanato custa metade' → 'Em 30 anos, o porcelanato foi trocado 3 vezes. A madeira natural ainda está lá, mais bonita. É a diferença entre custo e investimento.'",
        "'Preciso pensar' → 'Entendo. Enquanto decide, lembre que essa partida de [madeira] é limitada e nossa agenda de instalação está com 6 semanas de espera.'",
        "Regra: nunca use diferenciais como 'desculpa'. Use como JUSTIFICATIVA DE VALOR. O tom é consultivo, nunca defensivo",
      ],
    },
  },

  // 18. Tabela comparativa
  {
    type: "twocolumn",
    props: {
      title: "Parket vs.\nConcorrência",
      label: "Comparativo Direto",
      leftTitle: "Parket",
      leftItems: [
        "100% madeira natural — curadoria global das melhores espécies do mundo",
        "Fábrica própria — a mais moderna da América Latina",
        "Tábuas acima de 20cm de largura (exclusivo)",
        "Solução completa: piso, painéis, forro, escada, marcenaria",
        "Showroom na Casa Milan (Paulo Mendes da Rocha)",
        "Instalação 100% com equipe própria e garantia",
        "50+ anos de mercado, 10mil+ projetos",
        "Florestas próprias + importação da Europa, América do Norte e Noruega",
      ],
      rightTitle: "Concorrência Típica",
      rightItems: [
        "Mistura de madeira com laminados e sintéticos",
        "Revende produtos de terceiros, sem controle fabril",
        "Limitados a tábuas de 10-15cm (padrão de mercado)",
        "Vende apenas pisos. Resto com outros fornecedores",
        "Showroom convencional ou loja de material",
        "Terceiriza instalação — sem controle de qualidade",
        "Empresas recentes, histórico limitado",
        "Portfólio limitado a madeiras nacionais comuns",
      ],
      leftColor: "#C4956A",
      rightColor: "#E85D5D",
    },
  },

  // 19. Frases de impacto
  {
    type: "grid",
    props: {
      title: "Frases de Impacto\npara Cada Diferencial",
      label: "Arsenal Verbal",
      columns: 2,
      cards: [
        { title: "Madeira Natural", description: "\"Fazemos curadoria das melhores madeiras do mundo — das nossas florestas na América do Sul aos carvalhos europeus e madeiras nobres de 4 continentes. Cada tábua é única.\"", icon: "01" },
        { title: "Fábrica", description: "\"Nossa fábrica é considerada a mais avançada da América Latina. Precisão industrial com alma artesanal.\"", icon: "02" },
        { title: "Tábuas Largas", description: "\"Somos os únicos no Brasil a produzir tábuas acima de 20cm. O resultado visual é outro patamar.\"", icon: "03" },
        { title: "Solução Completa", description: "\"Do piso à marcenaria, tudo com a mesma madeira e o mesmo padrão de excelência. Um projeto, um fornecedor.\"", icon: "04" },
        { title: "Casa Milan", description: "\"Nosso showroom é a Casa Milan — a residência de Paulo Mendes da Rocha. A visita, por si só, já é uma experiência.\"", icon: "05" },
        { title: "Instalação", description: "\"90% dos problemas com madeira vêm de instalação ruim. Na Parket, a equipe é nossa. O resultado é garantido.\"", icon: "06" },
      ],
    },
  },

  // 20. Statement
  {
    type: "statement",
    props: {
      statement: "Diferenciais não vendem sozinhos. Quem vende é você — ao traduzir cada diferencial em benefício real e tangível para o cliente. Domine-os. Acredite neles. Comunique com convicção.",
      label: "Mensagem Final",
      attribution: "Manual de Diferenciais Parket",
    },
  },

  // 21. Closing
  {
    type: "closing",
    props: {
      title: "Parket",
      subtitle: "Manual de Diferenciais\nConheça. Domine. Comunique.",
      image: parketStoneWall,
      logo: parketLogo,
    },
  },
];