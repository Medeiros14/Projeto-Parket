export interface SlideData {
  type:
    | "cover"
    | "section"
    | "split"
    | "content"
    | "grid"
    | "process"
    | "funnel"
    | "twocolumn"
    | "statement"
    | "metrics"
    | "role"
    | "closing"
    | "script"
    | "palette"
    | "dosdonts"
    | "brandaxis"
    | "persona"
    | "visual";
  props: Record<string, any>;
}

import parketLogo from "figma:asset/ea944c52b88c841ea9c822abd0b2ed2bddf425e6.png";
import parketInterior from "figma:asset/8895fbbf8e799621eb29613c0c646fae87caae91.png";
import parketExterior from "figma:asset/cdcff48de4bfcde365631855c48651aeedb95349.png";
import parketCorridor from "figma:asset/28a705cf3ea7cb71edfe6ed641ae88d4c31cf689.png";
import parketSpiral from "figma:asset/4a6a8ad24bcda1f844920eb717e3e4d47f57d4d3.png";
import parketStoneWall from "figma:asset/e709d3507fb615d8e01cdd56b0745f81577f6d89.png";
import parketHerringbone from "figma:asset/b9bdf6119029ab1e402ac73b9a4bf22363cd3ff6.png";
import parketWoodInterior from "figma:asset/e602455ef9adc036da056c804817732f86ab9037.png";
import parketLatticeLiving from "figma:asset/34ef7cbd988ad5d042ed3fc1f86d054998bbf494.png";
import parketCurvedShelving from "figma:asset/599bac592a9aaa0e1b24504b427fc642dc39a574.png";
import parketChevronMarble from "figma:asset/ea0f5dc71a9c6dc129a9bab938e0e9a789ce04d5.png";
import parketCasaMilan from "figma:asset/c5da764965787206bd8e7105fcda0252da4da63b.png";
import parketDeckLake from "figma:asset/4d5981327c581648268ef6760447eb46d6931f4c.png";

export { parketLogo };

const IMAGES = {
  hero: parketDeckLake,
  panels: parketInterior,
  texture: parketHerringbone,
  showroom: parketWoodInterior,
  staircase: parketSpiral,
  architect: parketStoneWall,
  living: parketLatticeLiving,
  meeting: parketCurvedShelving,
  facade: parketExterior,
  penthouse: parketChevronMarble,
  corridor: parketCorridor,
  casaMilan: parketCasaMilan,
  deckLake: parketDeckLake,
};

export const slides: SlideData[] = [
  // ═══════════════════════════════════════════
  // BLOCO 1 — INTRODUÇÃO (4 slides)
  // ═══════════════════════════════════════════

  // 1. Capa — ultra-minimalista
  {
    type: "cover",
    props: {
      title: "Comercial",
      subtitle: "Estratégias, processos e excelência",
      image: IMAGES.hero,
    },
  },

  // 2. Quem é a Parket
  {
    type: "split",
    props: {
      title: "Quem é a Parket",
      label: "Introdução",
      content:
        "A principal empresa do Brasil em soluções completas em madeira natural para arquitetura de altíssimo padrão. Pisos, painéis, forros, escadas, fachadas e marcenaria sob medida.",
      image: IMAGES.panels,
      imagePosition: "right",
      items: [
        "Presente nos projetos mais exclusivos do país",
        "Parceria direta com os principais escritórios de arquitetura",
        "Engenharia e instalação própria de ponta a ponta",
      ],
    },
  },

  // 3. O que a Parket realmente vende
  {
    type: "statement",
    props: {
      statement:
        "Nós não vendemos madeira. Vendemos a materialização de ambientes que definem legados, contam histórias e elevam a experiência de viver.",
      label: "O que a Parket realmente vende",
      attribution: "Filosofia Parket",
    },
  },

  // 4. Posicionamento no mercado
  {
    type: "metrics",
    props: {
      title: "Posicionamento\nno Mercado",
      label: "Introdução",
      metrics: [
        { value: "#1", label: "Em madeira premium", description: "Referência nacional" },
        { value: "10mil+", label: "Projetos entregues", description: "Residências, hotéis e corporativos" },
        { value: "100%", label: "Madeira natural", description: "Sem laminados ou sintéticos" },
        { value: "50+", label: "Anos de mercado", description: "Cinco décadas de expertise" },
      ],
    },
  },

  // ═══════════════════════════════════════════
  // BLOCO 2 — POSICIONAMENTO (4 slides)
  // ═══════════════════════════════════════════

  // 5. Seção
  {
    type: "section",
    props: {
      block: "Bloco 02",
      title: "Posicionamento",
      subtitle: "O que nos diferencia no mercado e por que somos a escolha certa.",
    },
  },

  // 6. Diferenciais competitivos
  {
    type: "grid",
    props: {
      title: "Diferenciais\nCompetitivos",
      label: "Posicionamento",
      columns: 2,
      cards: [
        { title: "Verticalização Total", description: "Controlamos toda a cadeia — da seleção da matéria-prima à instalação final.", icon: "◆" },
        { title: "Engenharia de Precisão", description: "A planta mais moderna da América Latina segundo especialistas do setor. Maquinário de ponta e os únicos a produzir pisos acima de 20cm de largura.", icon: "◆" },
        { title: "Madeiras Exclusivas", description: "Espécies nobres certificadas: Freijó, Cumaru, Ipê, Nogueira e Carvalho.", icon: "◆" },
        { title: "Atendimento Consultivo", description: "Cada projeto é tratado como único, do briefing à entrega.", icon: "◆" },
        { title: "Solução Completa", description: "Do revestimento de madeira à marcenaria fina — tudo com a mesma madeira ou lâmina natural, integrando todo o projeto em uma única entrega.", icon: "◆" },
        { title: "Portfólio de Referência", description: "Projetos assinados pelos maiores nomes da arquitetura brasileira.", icon: "◆" },
      ],
    },
  },

  // 7. Por que clientes escolhem
  {
    type: "split",
    props: {
      title: "Por que Clientes\nEscolhem a Parket",
      label: "Posicionamento",
      image: IMAGES.living,
      imagePosition: "left",
      items: [
        "Qualidade incomparável em cada detalhe",
        "Confiança construída em décadas de atuação",
        "Capacidade de execução de projetos complexos",
        "Indicação espontânea de arquitetos e clientes",
        "Compromisso inabalável com prazos e acabamento",
      ],
    },
  },

  // 8. Autoridade no segmento premium
  {
    type: "split",
    props: {
      title: "Autoridade no\nSegmento Premium",
      label: "Posicionamento",
      content:
        "A Parket não é uma opção entre várias. É a referência que define o padrão do mercado. Quando os maiores arquitetos do Brasil precisam de madeira, ligam para a Parket.",
      image: IMAGES.facade,
      imagePosition: "right",
      items: [
        "Referência técnica para os principais escritórios do país",
        "Presença nos empreendimentos de maior valor por m² do Brasil",
        "Capacidade de executar projetos que nenhum concorrente aceita",
        "Reputação construída projeto a projeto, sem atalhos",
      ],
    },
  },

  // ═══════════════════════════════════════════
  // BLOCO 3 — PSICOLOGIA DO CLIENTE (4 slides)
  // ═══════════════════════════════════════════

  // 9. Seção
  {
    type: "section",
    props: {
      block: "Bloco 03",
      title: "Psicologia\ndo Cliente",
      subtitle: "Entender quem é o cliente Parket é fundamental para vender com excelência.",
    },
  },

  // 10. Quem é o cliente
  {
    type: "split",
    props: {
      title: "Quem é o\nCliente Parket",
      label: "Psicologia do Cliente",
      content:
        "Pessoas de altíssimo poder aquisitivo que buscam o melhor para suas residências e espaços. Decidem com calma, valorizam exclusividade e confiam em quem demonstra domínio técnico.",
      image: IMAGES.penthouse,
      imagePosition: "right",
      items: [
        "Empresários, executivos C-Level, herdeiros",
        "Arquitetos de alto padrão indicando para seus clientes",
        "Incorporadoras premium buscando diferenciação",
      ],
    },
  },

  // 11. Desejos e temores
  {
    type: "twocolumn",
    props: {
      title: "Desejos e Temores\ndo Cliente Premium",
      label: "Psicologia do Cliente",
      leftTitle: "O que ele deseja",
      leftItems: [
        "Exclusividade — ser único, não padronizado",
        "Confiança — saber que o projeto será impecável",
        "Status — material que reflita seu padrão de vida",
        "Durabilidade — investimento que atravessa gerações",
      ],
      rightTitle: "O que ele teme",
      rightItems: [
        "Erro na execução — manchas, desníveis, falhas",
        "Atraso — impacto no cronograma geral da obra",
        "Falta de comunicação — não saber o que acontece",
        "Ser tratado como mais um — atendimento genérico",
      ],
      leftColor: "#C4956A",
      rightColor: "#E85D5D",
    },
  },

  // 12. Como ele decide
  {
    type: "process",
    props: {
      title: "Como o Cliente\nPremium Decide",
      label: "Psicologia do Cliente",
      steps: [
        { number: "01", title: "Confiança antes de preço", description: "Escolhe quem transmite segurança, domínio técnico e reputação." },
        { number: "02", title: "Recomendação é tudo", description: "A maioria chega via indicação do arquiteto ou de outro cliente." },
        { number: "03", title: "Experiência sensorial", description: "Precisa ver, tocar e sentir a madeira. O showroom é o ponto de virada." },
        { number: "04", title: "Decisão compartilhada", description: "Envolve cônjuges, arquitetos e consultores. Navegue múltiplos decisores." },
      ],
    },
  },

  // ═══════════════════════════════════════════
  // BLOCO 4 — JORNADA DO CLIENTE (4 slides)
  // ═══════════════════════════════════════════

  // 13. Seção
  {
    type: "section",
    props: {
      block: "Bloco 04",
      title: "Jornada\ndo Cliente",
      subtitle: "Do primeiro contato à fidelização — cada etapa é uma oportunidade.",
    },
  },

  // 14. Jornada completa
  {
    type: "process",
    props: {
      title: "Jornada Completa\ndo Cliente Parket",
      label: "Jornada do Cliente",
      steps: [
        { number: "01", title: "Descoberta", description: "Indicação, redes sociais, busca orgânica ou eventos de arquitetura." },
        { number: "02", title: "Primeiro Contato", description: "BDR/SDR qualifica o lead, entende o projeto e agenda visita." },
        { number: "03", title: "Imersão no Showroom", description: "Experiência sensorial da madeira. Momento decisivo da jornada." },
        { number: "04", title: "Proposta Técnica", description: "Proposta personalizada com especificações, prazos e investimento." },
        { number: "05", title: "Negociação e Fechamento", description: "Alinhamento de expectativas, ajustes e assinatura do contrato." },
        { number: "06", title: "Entrega e Pós-venda", description: "Instalação impecável, vistoria técnica e fidelização contínua." },
      ],
    },
  },

  // 15. Funil comercial
  {
    type: "funnel",
    props: {
      title: "Funil Comercial",
      label: "Jornada do Cliente",
      stages: [
        { name: "Leads Qualificados", description: "Indicações, inbound e prospecção ativa", percentage: "100%" },
        { name: "Agendamento", description: "Visita ao showroom ou reunião agendada", percentage: "60%" },
        { name: "Visita / Showroom", description: "Experiência presencial com a madeira", percentage: "45%" },
        { name: "Proposta Enviada", description: "Proposta técnica personalizada", percentage: "35%" },
        { name: "Negociação", description: "Alinhamento de escopo e condições", percentage: "25%" },
        { name: "Fechamento", description: "Contrato assinado", percentage: "18%" },
      ],
    },
  },

  // 16. Pontos críticos de conversão
  {
    type: "content",
    props: {
      title: "Pontos Críticos\nde Conversão",
      label: "Jornada do Cliente",
      highlight: "Os momentos onde mais perdemos oportunidades — e como reverter.",
      items: [
        "Lead → Agendamento: tempo de resposta lento mata a conversão. Meta: < 2 horas",
        "Agendamento → Visita: taxa de no-show alta. Confirme 24h antes, envie localização e contexto",
        "Visita → Proposta: demora no envio esfria o interesse. Meta: proposta em 48 horas",
        "Proposta → Fechamento: falta de follow-up estruturado. Cadência de 3, 7, 14 e 30 dias",
        "Cada ponto crítico tem um responsável claro e uma métrica de sucesso definida",
      ],
    },
  },

  // ═══════════════════════════════════════════
  // BLOCO 5 — SISTEMA COMERCIAL (5 slides)
  // ═══════════════════════════════════════════

  // 17. Seção
  {
    type: "section",
    props: {
      block: "Bloco 05",
      title: "Sistema\nComercial",
      subtitle: "Cada função tem um papel estratégico no ecossistema de vendas.",
    },
  },

  // 18. BDR
  {
    type: "role",
    props: {
      role: "BDR — Business\nDevelopment",
      label: "Sistema Comercial",
      mission: "Gerar oportunidades qualificadas através de prospecção ativa em escritórios de arquitetura e incorporadoras premium.",
      image: IMAGES.meeting,
      responsibilities: [
        "Mapear e prospectar escritórios de arquitetura premium",
        "Estabelecer relacionamento com arquitetos influenciadores",
        "Gerar agendamentos qualificados para o time de vendas",
        "Manter cadência de prospecção consistente e documentada",
      ],
      kpis: ["Contatos/semana", "Agendamentos", "Taxa de conversão", "Novos arquitetos"],
    },
  },

  // 19. SDR
  {
    type: "role",
    props: {
      role: "SDR — Sales\nDevelopment",
      label: "Sistema Comercial",
      mission: "Qualificar leads inbound e outbound, garantindo que apenas oportunidades reais cheguem aos closers.",
      image: IMAGES.architect,
      responsibilities: [
        "Atender e qualificar leads de todos os canais",
        "Aplicar critérios: perfil, projeto, orçamento, timing",
        "Agendar visitas ao showroom com leads qualificados",
        "Registrar todas as interações no CRM",
      ],
      kpis: ["Tempo de resposta", "Leads qualificados", "Agendamentos", "Taxa de no-show"],
    },
  },

  // 20. Closer
  {
    type: "role",
    props: {
      role: "Closer",
      label: "Sistema Comercial",
      mission: "Converter oportunidades qualificadas em contratos, conduzindo o cliente da proposta ao fechamento com maestria.",
      image: IMAGES.showroom,
      responsibilities: [
        "Conduzir experiência no showroom com excelência",
        "Elaborar propostas técnicas personalizadas",
        "Conduzir negociação preservando margem e valor",
        "Gerenciar pipeline com disciplina e previsibilidade",
        "Fazer handoff impecável para equipe de produção",
      ],
      kpis: ["Taxa de fechamento", "Ticket médio", "Ciclo de venda", "Revenue", "NPS"],
    },
  },

  // 21. Diretor Comercial
  {
    type: "role",
    props: {
      role: "Diretor\nComercial",
      label: "Sistema Comercial",
      mission: "Orquestrar todo o sistema comercial, garantindo que a máquina funcione com previsibilidade, eficiência e cultura de alta performance.",
      image: IMAGES.corridor,
      responsibilities: [
        "Definir metas, estratégias e ritmo do time comercial",
        "Garantir que os processos sejam seguidos com disciplina",
        "Analisar métricas, identificar gargalos e corrigir rotas",
        "Desenvolver talentos e manter a cultura comercial viva",
        "Ser o elo entre o comercial e a alta liderança da empresa",
      ],
      kpis: ["Revenue total", "Crescimento MoM", "Margem média", "Turnover do time", "Forecast accuracy"],
    },
  },

  // ═══════════════════════════════════════════
  // BLOCO 6 — PROCESSO DE VENDAS (7 slides)
  // ═══════════════════════════════════════════

  // 22. Seção
  {
    type: "section",
    props: {
      block: "Bloco 06",
      title: "Processo\nde Vendas",
      subtitle: "Cada etapa tem um objetivo claro e uma execução definida.",
    },
  },

  // 23. Primeiro contato
  {
    type: "content",
    props: {
      title: "Primeiro Contato",
      label: "Processo de Vendas — Etapa 01",
      highlight: "A primeira impressão define o tom de toda a relação.",
      items: [
        "Responda em até 2 horas — velocidade é respeito",
        "Apresente-se de forma consultiva, não comercial",
        "Faça perguntas inteligentes sobre escopo, timeline e visão",
        "Nunca fale de preço neste momento — construa contexto",
        "Agende o próximo passo: showroom ou call de aprofundamento",
      ],
    },
  },

  // 24. Qualificação
  {
    type: "grid",
    props: {
      title: "Qualificação",
      label: "Processo de Vendas — Etapa 02",
      columns: 2,
      cards: [
        { title: "Perfil do Cliente", description: "Quem é? Poder de decisão? Há arquiteto envolvido? Padrão do empreendimento?", icon: "01" },
        { title: "Escopo do Projeto", description: "Quais ambientes? Pisos, painéis, forro? Metragem? Residencial ou corporativo?", icon: "02" },
        { title: "Orçamento e Timeline", description: "Há orçamento? Quando a obra começa? Fase do projeto de arquitetura?", icon: "03" },
        { title: "Processo Decisório", description: "Quem decide? Comparando concorrentes? Qual o critério de escolha?", icon: "04" },
      ],
    },
  },

  // 25. Construção de confiança
  {
    type: "content",
    props: {
      title: "Construção\nde Confiança",
      label: "Processo de Vendas — Etapa 03",
      highlight: "Confiança não se pede. Se constrói, interação após interação.",
      items: [
        "Demonstre conhecimento técnico profundo sobre madeiras e acabamentos",
        "Compartilhe cases relevantes e similares ao projeto do cliente",
        "Envolva especialistas da equipe quando necessário — nunca improvise",
        "Cumpra cada micro-compromisso: ligou na hora, enviou no prazo",
        "Seja transparente sobre limitações — honestidade é o alicerce",
        "Antecipe perguntas e traga soluções antes que o cliente peça",
      ],
    },
  },

  // 26. Proposta
  {
    type: "content",
    props: {
      title: "Proposta",
      label: "Processo de Vendas — Etapa 04",
      highlight: "A proposta não é um orçamento. É um documento que materializa a visão do cliente.",
      items: [
        "Personalize cada proposta — jamais envie modelo genérico",
        "Inclua: escopo, especificações, cronograma e investimento",
        "Apresente presencialmente sempre que possível",
        "Contextualize: durabilidade, valorização e impacto estético",
        "Envie em até 48 horas após a visita",
      ],
    },
  },

  // 27. Fechamento
  {
    type: "content",
    props: {
      title: "Fechamento",
      label: "Processo de Vendas — Etapa 05",
      highlight: "Fechar não é empurrar. É o resultado natural de um processo conduzido com excelência.",
      items: [
        "Recapitule os pontos de valor que mais ressoaram",
        "Reforce exclusividade: disponibilidade de material, agenda",
        "Gerencie objeções com calma, dados e cases reais",
        "Facilite a decisão: simplifique contratos e próximos passos",
        "Use urgência real, nunca artificial",
      ],
    },
  },

  // 28. Pós-venda
  {
    type: "content",
    props: {
      title: "Pós-venda",
      label: "Processo de Vendas — Etapa 06",
      highlight: "O pós-venda é onde nasce a próxima venda. Cliente satisfeito é o ativo mais valioso.",
      items: [
        "Acompanhe a produção e mantenha o cliente informado",
        "Garanta instalação impecável com vistoria técnica",
        "Follow-up de satisfação em 7, 30 e 90 dias",
        "Ofereça programa de manutenção preventiva",
        "Solicite feedbacks, depoimentos e indicações",
      ],
    },
  },

  // ═══════════════════════════════════════════
  // BLOCO 7 — SHOWROOM (4 slides)
  // ═══════════════════════════════════════════

  // 29. Seção
  {
    type: "section",
    props: {
      block: "Bloco 07",
      title: "Showroom",
      subtitle: "Casa Milan — a obra-prima de Paulo Mendes da Rocha é o nosso palco.",
    },
  },

  // 30. Casa Milan
  {
    type: "split",
    props: {
      title: "Casa Milan\nO Nosso Showroom",
      label: "Showroom",
      content:
        "O showroom da Parket funciona na Casa Milan — a residência mais icônica de Paulo Mendes da Rocha, Pritzker 2006. Receber um cliente ou arquiteto nesse espaço não é apenas uma visita: é uma imersão em um dos marcos da arquitetura mundial. O poder simbólico de apresentar nossas madeiras dentro de uma obra-prima brutalista é imbatível.",
      image: IMAGES.casaMilan,
      imagePosition: "left",
      items: [
        "Obra-prima de Paulo Mendes da Rocha — referência global em arquitetura",
        "O simples convite para conhecer a Casa Milan já gera desejo e exclusividade",
        "Arquitetos se sentem reverenciados ao serem recebidos neste espaço",
        "O contraste entre o concreto brutalista e a madeira natural é avassalador",
        "Nenhum concorrente tem um ativo de marca tão poderoso",
      ],
    },
  },

  // 31. Como conduzir
  {
    type: "process",
    props: {
      title: "Como Conduzir\nno Showroom",
      label: "Showroom",
      steps: [
        { number: "01", title: "Recepção impecável", description: "Receba pelo nome. Ofereça água, café. Exclusividade desde o primeiro segundo." },
        { number: "02", title: "Entenda antes de mostrar", description: "Pergunte sobre o projeto, estilo e preferências. Depois conduza para as peças relevantes." },
        { number: "03", title: "Experiência guiada", description: "Jornada da madeira: origem, processo, acabamento. Deixe tocar, sentir, comparar." },
        { number: "04", title: "Conex��o com o projeto", description: "Mostre como a madeira escolhida vai ficar no ambiente específico do cliente." },
        { number: "05", title: "Defina o próximo passo", description: "Nunca deixe o cliente sair sem compromisso: proposta, nova visita ou amostra." },
      ],
    },
  },

  // 32. Como converter no showroom
  {
    type: "content",
    props: {
      title: "Como Converter\nno Showroom",
      label: "Showroom",
      highlight: "O showroom não é um passeio. É o momento de maior impacto emocional da jornada.",
      items: [
        "Prepare-se antes: estude o projeto e tenha amostras relevantes separadas",
        "Use storytelling — conte a história da madeira, da floresta à peça final",
        "Crie comparações tácteis: deixe o cliente sentir a diferença entre espécies",
        "Fotografe o cliente no showroom — gera pertencimento e registro emocional",
        "Antes de sair, apresente valor: \"baseado no que vimos, o investimento fica entre X e Y\"",
        "Agende o follow-up na hora — nunca diga \"depois te ligo\"",
      ],
    },
  },

  // ═══════════════════════════════════════════
  // BLOCO 8 — OBJEÇÕES (4 slides)
  // ════════════════════════════���══════════════

  // 33. Seção
  {
    type: "section",
    props: {
      block: "Bloco 08",
      title: "Gestão de\nObjeções",
      subtitle: "Cada objeção é uma pergunta disfarçada. Responda com empatia e autoridade.",
    },
  },

  // 34. Objeções comuns
  {
    type: "grid",
    props: {
      title: "Objeções Mais Comuns",
      label: "Gestão de Objeções",
      columns: 2,
      cards: [
        { title: "\"Está caro demais\"", description: "Não é caro — é investimento. Madeira natural valoriza o imóvel em até 25%. Compare com trocar um produto inferior em 5 anos.", icon: "01" },
        { title: "\"Preciso pensar\"", description: "Respeite o tempo. Pergunte se há dúvidas. Defina data de retorno e ofereça informações complementares.", icon: "02" },
        { title: "\"Meu arquiteto prefere outro\"", description: "Convide o arquiteto para conhecer nosso showroom. Muitos dos maiores escritórios já trabalham conosco.", icon: "03" },
        { title: "\"Encontrei similar mais barato\"", description: "Similar não é igual. Pergunte sobre origem, tratamento, garantia e instalação. A diferença está nos detalhes.", icon: "04" },
      ],
    },
  },

  // 35. Framework de resposta
  {
    type: "process",
    props: {
      title: "Framework de\nResposta a Objeções",
      label: "Gestão de Objeções",
      steps: [
        { number: "01", title: "Escute com atenção genuína", description: "Nunca interrompa. Deixe o cliente expressar completamente sua preocupação." },
        { number: "02", title: "Valide a preocupação", description: "\"Entendo perfeitamente.\" — Validar não é concordar, é respeitar." },
        { number: "03", title: "Recontextualize com dados", description: "Traga fatos, cases e dados que respondam de forma objetiva e confiável." },
        { number: "04", title: "Conduza para a decisão", description: "\"Com essa informação, faz sentido avançarmos?\" — Confiança, nunca pressão." },
      ],
    },
  },

  // 36. Mentalidade sobre objeções
  {
    type: "statement",
    props: {
      statement:
        "Uma objeção não é um não. É o cliente pedindo mais motivos para dizer sim. Quem domina a arte de responder objeções, domina a arte de vender.",
      label: "Gestão de Objeções",
      attribution: "Mentalidade Parket",
    },
  },

  // ═══════════════════════════════════════════
  // BLOCO 9 — CRM (4 slides)
  // ═════════════════════════════════════════��═

  // 37. Seção
  {
    type: "section",
    props: {
      block: "Bloco 09",
      title: "Sistema CRM",
      subtitle: "Informação organizada é poder. O CRM é a memória e a inteligência do time.",
    },
  },

  // 38. Importância do CRM
  {
    type: "content",
    props: {
      title: "Por que o CRM\né Inegociável",
      label: "Sistema CRM",
      highlight: "Sem CRM, não há visibilidade, previsibilidade ou escala.",
      items: [
        "Registra toda a história do relacionamento com o cliente",
        "Permite previsão de receita e gestão de pipeline com precisão",
        "Garante que nenhum lead caia no esquecimento",
        "Facilita handoffs entre BDR, SDR e Closer sem perda de contexto",
        "Protege a empresa — as informações pertencem à Parket",
      ],
    },
  },

  // 39. Processo correto no CRM
  {
    type: "process",
    props: {
      title: "Processo Correto\nno CRM",
      label: "Sistema CRM",
      steps: [
        { number: "01", title: "Registro imediato", description: "Todo novo contato entra no CRM em até 1 hora. Sem exceções." },
        { number: "02", title: "Qualificação documentada", description: "Perfil do cliente, escopo, orçamento e timeline registrados de forma estruturada." },
        { number: "03", title: "Atualização por etapa", description: "Cada mudança de fase do funil é registrada com data, contexto e próximo passo." },
        { number: "04", title: "Notas de interação", description: "Toda ligação, reunião ou e-mail relevante recebe uma nota com resumo e ação." },
        { number: "05", title: "Fechamento ou perda", description: "Negócios fechados ou perdidos são documentados com motivo e aprendizado." },
      ],
    },
  },

  // 40. Fluxo de informação
  {
    type: "content",
    props: {
      title: "Fluxo de\nInformação",
      label: "Sistema CRM",
      highlight: "A informação certa, na hora certa, para a pessoa certa.",
      items: [
        "BDR registra o lead → SDR recebe com contexto completo para qualificar",
        "SDR qualifica → Closer recebe o histórico inteiro antes da primeira reunião",
        "Closer fecha → Produção recebe briefing detalhado sem retrabalho",
        "Pós-venda → Feedback do cliente alimenta toda a cadeia para melhoria contínua",
        "Diretoria → Dashboard em tempo real com visão de pipeline, previsão e performance",
      ],
    },
  },

  // ═══════════════════════════════════════════
  // BLOCO 10 — CULTURA COMERCIAL (5 slides)
  // ════════════════════���══════════════════════

  // 41. Seção
  {
    type: "section",
    props: {
      block: "Bloco 10",
      title: "Cultura Comercial\nParket",
      subtitle: "Mais do que processos, o que nos define é a forma como pensamos e agimos.",
    },
  },

  // 42. Mentalidade do vendedor
  {
    type: "content",
    props: {
      title: "Mentalidade do\nVendedor Parket",
      label: "Cultura Comercial",
      items: [
        "Somos consultores, não vendedores. Orientamos a melhor decisão.",
        "Conhecimento técnico é obrigatório, não diferencial.",
        "Cada interação eleva a percepção da marca Parket.",
        "Não competimos por preço. Competimos por excelência.",
        "Somos obcecados por detalhes — do primeiro e-mail ao último parafuso.",
        "Tratamos o tempo do cliente como sagrado.",
        "Celebramos vitórias em equipe e aprendemos com cada perda.",
      ],
    },
  },

  // 43. Padrão de excelência
  {
    type: "grid",
    props: {
      title: "Padrão de\nExcelência",
      label: "Cultura Comercial",
      columns: 2,
      cards: [
        { title: "Pontualidade", description: "Chegar no horário é o mínimo. Chegar preparado é o padrão.", icon: "◆" },
        { title: "Comunicação", description: "Clara, objetiva e elegante. Nada de gírias, informalidade excessiva ou pressa.", icon: "◆" },
        { title: "Aparência", description: "A forma como nos apresentamos é extensão da marca Parket.", icon: "◆" },
        { title: "Follow-up", description: "Nenhum cliente fica sem resposta por mais de 24 horas.", icon: "◆" },
        { title: "Conhecimento", description: "Estudar constantemente: madeiras, arquitetura, tendências e mercado.", icon: "◆" },
        { title: "Integridade", description: "Prometeu, cumpre. Não sabe, busca. Errou, assume.", icon: "◆" },
      ],
    },
  },

  // 44. Statement — Responsabilidade
  {
    type: "statement",
    props: {
      statement:
        "Cada um de nós carrega a marca Parket em cada interação. Somos a empresa aos olhos do cliente. A responsabilidade é total. O orgulho também.",
      label: "Cultura Comercial",
      attribution: "Compromisso Parket",
    },
  },

  // 45. Slide de fechamento
  {
    type: "closing",
    props: {
      title: "Parket",
      subtitle: "Madeira natural de altíssimo padrão.\nExcelência que se sente.\nConfiança que se constrói.",
      image: IMAGES.texture,
      logo: parketLogo,
    },
  },
];