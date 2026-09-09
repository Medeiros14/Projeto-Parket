import { type SlideData } from "./slides-data";
import parketLogo from "figma:asset/ea944c52b88c841ea9c822abd0b2ed2bddf425e6.png";
import parketHerringbone from "figma:asset/b9bdf6119029ab1e402ac73b9a4bf22363cd3ff6.png";
import parketCurvedShelving from "figma:asset/599bac592a9aaa0e1b24504b427fc642dc39a574.png";
import parketStoneWall from "figma:asset/e709d3507fb615d8e01cdd56b0745f81577f6d89.png";
import parketWoodInterior from "figma:asset/e602455ef9adc036da056c804817732f86ab9037.png";
import parketCasaMilan from "figma:asset/c5da764965787206bd8e7105fcda0252da4da63b.png";
import parketDeckLake from "figma:asset/4d5981327c581648268ef6760447eb46d6931f4c.png";

export const manualSlides: SlideData[] = [

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 1 — INTRODUÇÃO AO MANUAL (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 1. Capa
  {
    type: "cover",
    props: {
      title: "Manual Prático\nComercial",
      subtitle: "Scripts, fluxos e processos para BDR, SDR e Closer",
      image: parketDeckLake,
    },
  },

  // 2. Statement
  {
    type: "statement",
    props: {
      statement: "Este manual é o seu mapa operacional. Cada script, cada fluxo e cada checklist foram desenhados para que você execute com confiança e consistência.",
      label: "Como Usar Este Manual",
      attribution: "Diretoria Comercial Parket",
    },
  },

  // 3. Estrutura do manual
  {
    type: "grid",
    props: {
      title: "Estrutura do\nManual",
      label: "Visão Geral",
      columns: 2,
      cards: [
        { title: "BDR", description: "Prospecção ativa, mapeamento de arquitetos, scripts de cold call e e-mail, cadência completa.", icon: "01" },
        { title: "SDR", description: "Qualificação de leads, framework BANT+, scripts de atendimento, agendamento e confirmação.", icon: "02" },
        { title: "Closer", description: "Condução no showroom, proposta, negociação, fechamento, objeções avançadas e follow-up.", icon: "03" },
        { title: "Fluxos Integrados", description: "Handoffs perfeitos, rituais comerciais, cadência de reuniões e templates prontos.", icon: "04" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 2 — BDR: MANUAL COMPLETO (13 slides)
  // ═══════════════════════════════════════════════════════════════

  // 4. Seção BDR
  {
    type: "section",
    props: {
      block: "Bloco 01",
      title: "BDR\nBusiness\nDevelopment",
      subtitle: "O motor de novas oportunidades. Sem BDR, o pipeline seca.",
    },
  },

  // 5. Missão e DNA
  {
    type: "content",
    props: {
      title: "Missão e DNA\ndo BDR Parket",
      label: "BDR — Fundamentos",
      highlight: "Gerar oportunidades qualificadas de forma proativa, abrindo portas em escritórios de arquitetura e incorporadoras premium que ainda não conhecem a Parket.",
      items: [
        "Você é o primeiro ponto de contato da marca — sua abordagem define a percepção",
        "Seu foco é relacionamento, não venda. Você planta. O Closer colhe",
        "Você é um pesquisador: estuda o mercado, identifica oportunidades e cria conexões",
        "Resiliência é sua maior virtude — 80% das portas serão fechadas antes de abrir",
        "Cada 'não' te aproxima do 'sim' certo. Volume com qualidade é a fórmula",
        "Você é medido por agendamentos qualificados, não por número de ligações",
      ],
    },
  },

  // 6. Rotina diária do BDR
  {
    type: "process",
    props: {
      title: "Rotina Diária\ndo BDR",
      label: "BDR — Operação",
      steps: [
        { number: "08h", title: "Preparação (30min)", description: "Revise CRM, organize lista de prospecção do dia, pesquise escritórios-alvo. Separe 15 contatos prioritários." },
        { number: "09h", title: "Bloco de prospecção I (2h)", description: "Cold calls e e-mails para novos escritórios. Foco em volume: 15-20 tentativas de contato." },
        { number: "11h", title: "Follow-ups (1h)", description: "Retorne contatos pendentes, envie materiais prometidos, atualize CRM com todas as interações." },
        { number: "12h", title: "Almoço + Pesquisa (1h)", description: "Navegue perfis de arquitetos no Instagram/LinkedIn. Identifique projetos publicados recentemente." },
        { number: "13h", title: "Bloco de prospecção II (2h)", description: "Novas tentativas + segunda rodada de contatos da manhã. WhatsApp para contatos quentes." },
        { number: "15h", title: "Gestão e Planejamento (1h)", description: "Atualize CRM, prepare lista do dia seguinte, registre aprendizados. Reporte ao gestor." },
      ],
    },
  },

  // 7. Fluxo de prospecção
  {
    type: "process",
    props: {
      title: "Fluxo de Prospecção\nde Arquitetos",
      label: "BDR — Processo",
      steps: [
        { number: "01", title: "Pesquisa e mapeamento", description: "Identifique escritórios premium via Instagram, ArchDaily, revistas de arquitetura, eventos do setor e indicações internas." },
        { number: "02", title: "Qualificação prévia", description: "Avalie: porte do escritório, tipo de projetos (alto padrão?), clientes atendidos, uso de madeira em projetos anteriores." },
        { number: "03", title: "Primeiro contato", description: "Ligação ou e-mail personalizado. Mencione um projeto específico do arquiteto. Nunca seja genérico." },
        { number: "04", title: "Nutrição do contato", description: "Envie conteúdo relevante: cases, novidades em madeiras, convites para eventos. Construa relacionamento." },
        { number: "05", title: "Convite para showroom", description: "Quando houver rapport, convide para conhecer a Casa Milan. O showroom é o grande trunfo." },
        { number: "06", title: "Handoff para SDR/Closer", description: "Arquiteto engajado com projeto ativo → registre tudo no CRM e faça handoff formal." },
      ],
    },
  },

  // 8. Mapeamento de escritórios
  {
    type: "content",
    props: {
      title: "Como Mapear\nEscritórios Premium",
      label: "BDR — Inteligência",
      highlight: "Prospecção inteligente começa com pesquisa profunda. Não ligue para qualquer escritório — ligue para o escritório certo.",
      items: [
        "Instagram: busque #arquiteturadealtopradon, #projetoresidencial, #casadealtopradon e analise portfólios",
        "ArchDaily Brasil: filtre projetos residenciais de luxo. Identifique os escritórios por trás",
        "Revistas: Casa Vogue, Casa & Jardim, Wish Casa — quem são os arquitetos que aparecem?",
        "LinkedIn: conecte-se com sócios e diretores de projeto. Acompanhe publicações",
        "Eventos: CASACOR, Expo Revestir, feiras de design — mapeie participantes e expositores",
        "Indicações internas: pergunte aos Closers quais arquitetos eles gostariam de ter no pipeline",
        "Crie uma planilha com: nome, escritório, especialidade, contato, status e data do último contato",
      ],
    },
  },

  // 9. Script: Cold Call para escritório
  {
    type: "script",
    props: {
      title: "Script: Cold Call\npara Escritório",
      label: "BDR — Scripts",
      context: "Ligação fria para escritório de arquitetura que ainda não conhece a Parket.",
      lines: [
        { speaker: "BDR", text: "Bom dia! Aqui é [Seu Nome] da Parket. Nós somos especializados em soluções completas em madeira natural para projetos de alto padrão. Gostaria de falar com [Nome do Arquiteto], por favor." },
        { speaker: "Secretária", text: "Ele está em reunião no momento..." },
        { speaker: "BDR", text: "Sem problema algum. Eu vi o projeto [Nome do Projeto] que o escritório publicou recentemente — ficou extraordinário. O uso de materiais naturais chamou muito a atenção. Posso deixar meu contato e o melhor horário para retornar?" },
        { speaker: "Secretária", text: "Pode sim, ele costuma estar disponível às terças pela manhã." },
        { speaker: "BDR", text: "Perfeito. Vou retornar terça às 10h. Enquanto isso, posso enviar um e-mail com nosso portfólio? Temos cases muito relevantes para projetos como os de vocês." },
      ],
      tips: [
        "Sempre pesquise um projeto real do escritório antes de ligar",
        "Seja cordial com a secretária — ela é a guardiã do acesso",
        "Nunca peça 'só um minutinho' — demonstre que valoriza o tempo de todos",
        "Se conseguir falar com o arquiteto, foque em curiosidade, não em venda",
      ],
    },
  },

  // 10. Script: Cold call quando fala com o arquiteto
  {
    type: "script",
    props: {
      title: "Script: Conversa\ncom o Arquiteto",
      label: "BDR — Scripts",
      context: "Quando você consegue falar diretamente com o arquiteto pela primeira vez.",
      lines: [
        { speaker: "BDR", text: "Bom dia, [Arquiteto]! Aqui é [Nome] da Parket. Muito prazer. Acompanho o trabalho do escritório e fiquei impressionado com o projeto [Nome]. A forma como vocês integraram materiais naturais é referência." },
        { speaker: "Arquiteto", text: "Obrigado! Sim, aquele projeto ficou muito especial." },
        { speaker: "BDR", text: "Imagino. É exatamente esse tipo de projeto que a gente atende na Parket. Somos a maior empresa do Brasil em madeira natural para alta arquitetura — pisos, painéis, forros, escadas, fachadas e marcenaria. Nosso showroom fica na Casa Milan, a residência do Paulo Mendes da Rocha." },
        { speaker: "Arquiteto", text: "Ah, conheço a Casa Milan. Interessante..." },
        { speaker: "BDR", text: "Seria uma honra receber você lá para mostrar nossas madeiras e trocar ideias sobre projetos. Posso agendar uma visita em um horário que funcione para você?" },
        { speaker: "Arquiteto", text: "Pode me mandar mais informações primeiro?" },
        { speaker: "BDR", text: "Claro! Vou enviar nosso portfólio com cases de projetos de arquitetos como [Nome Referência]. Posso retornar na semana que vem para conversarmos?" },
      ],
      tips: [
        "Mencionar a Casa Milan gera curiosidade imediata — use esse ativo",
        "Cite outros arquitetos renomados que já trabalham com a Parket",
        "Não force o agendamento — construa interesse genuíno primeiro",
        "Sempre defina um próximo passo concreto antes de desligar",
      ],
    },
  },

  // 11. Script: E-mail de prospecção
  {
    type: "content",
    props: {
      title: "Template: E-mail\nde Prospecção",
      label: "BDR — Templates",
      highlight: "Assunto: [Nome do Projeto] — madeira natural para projetos como o seu",
      items: [
        "Abertura: 'Prezado(a) [Nome], acompanho o trabalho do [Escritório] e o projeto [X] me chamou atenção pela sofisticação no uso de materiais naturais.'",
        "Contexto: 'A Parket é líder no Brasil em soluções completas em madeira natural para arquitetura de altíssimo padrão. Atendemos os principais escritórios do país com pisos, painéis, forros, escadas, fachadas e marcenaria sob medida.'",
        "Diferencial: 'Nosso showroom funciona na Casa Milan — a residência icônica de Paulo Mendes da Rocha. Um espaço único para sentir e escolher madeiras.'",
        "CTA: 'Gostaria de enviar nosso portfólio e, se fizer sentido, agendar uma visita ao showroom. Posso enviar?'",
        "Assinatura: 'Atenciosamente, [Nome] | BDR Parket | [Telefone] | [E-mail]'",
        "Regra: máximo 5 parágrafos curtos. Nunca envie e-mail genérico sem personalização.",
      ],
    },
  },

  // 12. Script: Follow-up WhatsApp
  {
    type: "script",
    props: {
      title: "Script: Follow-up\nWhatsApp",
      label: "BDR — Scripts",
      context: "Após enviar e-mail ou ter primeiro contato, fazer follow-up por WhatsApp.",
      lines: [
        { speaker: "BDR", text: "Bom dia, [Nome]! Aqui é [Seu Nome] da Parket. Enviei um e-mail na semana passada com nosso portfólio de madeiras naturais para projetos de alto padrão. Conseguiu dar uma olhada?" },
        { speaker: "Arquiteto", text: "Oi! Ainda não tive tempo..." },
        { speaker: "BDR", text: "Sem problemas! Vou reenviar aqui pelo WhatsApp mesmo — é um PDF rápido com alguns projetos que ficaram incríveis. [Anexar PDF]. Quando puder olhar, me diz o que achou. Temos novidades em madeiras exclusivas que podem ser perfeitas para os projetos do escritório." },
        { speaker: "Arquiteto", text: "Vou olhar sim, obrigado." },
        { speaker: "BDR", text: "Obrigado eu! Se tiver algum projeto em andamento que envolva madeira, terei o maior prazer em ajudar. Nosso showroom na Casa Milan está de portas abertas para vocês." },
      ],
      tips: [
        "WhatsApp é mais informal — adapte o tom, mas mantenha a elegância",
        "Sempre envie material visual: PDF, fotos de projetos, vídeos curtos",
        "Não insista se não responder. Espere 5-7 dias para novo contato",
        "Use áudios curtos (máx 30s) quando já tiver rapport — humaniza a relação",
      ],
    },
  },

  // 13. Cadência de prospecção
  {
    type: "process",
    props: {
      title: "Cadência de\nProspecção BDR",
      label: "BDR — Cadência",
      steps: [
        { number: "D1", title: "E-mail personalizado", description: "E-mail de apresentação com menção a projeto do arquiteto. Assunto personalizado. Portfólio em anexo." },
        { number: "D3", title: "Ligação telefônica", description: "Cold call referenciando o e-mail. Se não atender, deixe recado e tente novamente no D5." },
        { number: "D5", title: "Follow-up WhatsApp", description: "Mensagem informal reforçando o contato. Envie uma foto de projeto relevante como gancho." },
        { number: "D10", title: "Conteúdo de valor", description: "Envie artigo, vídeo ou case study relevante. Sem cobrança — apenas nutrindo." },
        { number: "D15", title: "Nova tentativa de contato", description: "Ligação + e-mail com novo gancho: evento, lançamento de madeira, case recente." },
        { number: "D21", title: "Convite para evento/showroom", description: "Convite para visitar a Casa Milan ou para evento exclusivo. Última tentativa ativa." },
        { number: "D30", title: "Nurturing passivo", description: "Se sem resposta, mova para lista de nurturing. Retome em 60-90 dias com novo gancho." },
      ],
    },
  },

  // 14. KPIs do BDR
  {
    type: "metrics",
    props: {
      title: "KPIs e Metas\ndo BDR",
      label: "BDR — Métricas",
      metrics: [
        { value: "80+", label: "Contatos/semana", description: "Ligações, e-mails e WhatsApp combinados" },
        { value: "8-12", label: "Agendamentos/mês", description: "Visitas qualificadas ao showroom" },
        { value: "25%", label: "Taxa de conversão", description: "Contatos → Agendamentos confirmados" },
        { value: "15+", label: "Novos arquitetos/mês", description: "Escritórios adicionados ao pipeline" },
        { value: "<2h", label: "Tempo de resposta", description: "Para leads inbound encaminhados" },
        { value: "100%", label: "CRM atualizado", description: "Toda interação registrada no mesmo dia" },
      ],
    },
  },

  // 15. Erros fatais do BDR
  {
    type: "grid",
    props: {
      title: "Erros Fatais\ndo BDR",
      label: "BDR — Alertas",
      columns: 2,
      cards: [
        { title: "Prospecção genérica", description: "Ligar sem pesquisar o escritório. Enviar e-mail padronizado. Isso destrói credibilidade.", icon: "✕" },
        { title: "Falar de preço", description: "Nunca mencione valores na prospecção. Seu papel é abrir portas, não negociar.", icon: "✕" },
        { title: "Desistir cedo", description: "A maioria dos deals acontece após 5+ tentativas de contato. Persistência com classe.", icon: "✕" },
        { title: "Não registrar no CRM", description: "Informação que não está no CRM não existe. Sem registro, sem inteligência comercial.", icon: "✕" },
        { title: "Prometer o que não pode", description: "Não invente prazos, capacidades ou condições. Seja honesto e consulte antes.", icon: "✕" },
        { title: "Ignorar a secretária", description: "A secretária é aliada, não obstáculo. Trate-a com o mesmo respeito do arquiteto.", icon: "✕" },
      ],
    },
  },

  // 16. Checklist do BDR
  {
    type: "content",
    props: {
      title: "Checklist Diário\ndo BDR",
      label: "BDR — Disciplina",
      highlight: "Antes de encerrar o dia, confira se todos os itens foram cumpridos.",
      items: [
        "[ ] Fiz pelo menos 15-20 tentativas de contato hoje",
        "[ ] Pesquisei cada escritório antes de ligar/escrever",
        "[ ] Registrei 100% das interações no CRM",
        "[ ] Enviei todos os materiais prometidos durante o dia",
        "[ ] Atualizei o status de cada lead no pipeline",
        "[ ] Preparei a lista de prospecção de amanhã",
        "[ ] Identifiquei pelo menos 3 novos escritórios potenciais",
        "[ ] Reportei ao gestor os destaques e bloqueios do dia",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 3 — SDR: MANUAL COMPLETO (13 slides)
  // ═══════════════════════════════════════════════════════════════

  // 17. Seção SDR
  {
    type: "section",
    props: {
      block: "Bloco 02",
      title: "SDR\nSales\nDevelopment",
      subtitle: "O filtro inteligente. Você garante que só oportunidades reais cheguem ao Closer.",
    },
  },

  // 18. Missão e DNA
  {
    type: "content",
    props: {
      title: "Missão e DNA\ndo SDR Parket",
      label: "SDR — Fundamentos",
      highlight: "Qualificar leads com velocidade e precisão, garantindo que o Closer receba apenas oportunidades reais — com contexto completo e expectativa alinhada.",
      items: [
        "Você é o guardião da qualidade do pipeline — leads ruins desperdiçam o tempo de todos",
        "Velocidade é sua arma: o primeiro a responder tem 50% mais chance de converter",
        "Você qualifica com perguntas inteligentes — nunca com perguntas invasivas",
        "Sua missão é entender: quem é, o que precisa, quando precisa e quem decide",
        "Cada lead recebe tratamento premium — mesmo os que não são qualificados agora",
        "Organização impecável: CRM atualizado em tempo real, sem exceções",
      ],
    },
  },

  // 19. Rotina diária do SDR
  {
    type: "process",
    props: {
      title: "Rotina Diária\ndo SDR",
      label: "SDR — Operação",
      steps: [
        { number: "08h", title: "Triagem de leads (30min)", description: "Revise todos os leads que entraram. Priorize por canal, perfil e urgência. Classifique: quente, morno, frio." },
        { number: "09h", title: "Primeiro contato (2h)", description: "Ligue e envie WhatsApp para todos os leads novos. Meta: contato em < 2h após entrada do lead." },
        { number: "11h", title: "Qualificação (1.5h)", description: "Aprofunde a qualificação dos leads quentes. Aplique BANT+. Registre tudo no CRM." },
        { number: "13h", title: "Agendamentos (1h)", description: "Agende visitas ao showroom para leads qualificados. Envie confirmação com localização e contexto." },
        { number: "14h", title: "Follow-ups (1.5h)", description: "Retome leads mornos. Confirme visitas de amanhã. Reengaje leads frios com conteúdo de valor." },
        { number: "16h", title: "CRM + Report (30min)", description: "Atualize todos os status. Prepare handoffs. Reporte métricas do dia ao gestor." },
      ],
    },
  },

  // 20. Framework BANT+
  {
    type: "grid",
    props: {
      title: "Framework de\nQualificação BANT+",
      label: "SDR — Metodologia",
      columns: 2,
      cards: [
        { title: "Budget (Orçamento)", description: "Há orçamento definido? Está compatível com o padrão Parket? Se não tem budget, é cedo demais.", icon: "B" },
        { title: "Authority (Autoridade)", description: "Quem decide? É o proprietário, o arquiteto, o cônjuge? Há múltiplos decisores? Mapeie todos.", icon: "A" },
        { title: "Need (Necessidade)", description: "Qual o projeto? Pisos, painéis, forro? Qual metragem? Residencial ou corporativo? Qual a dor?", icon: "N" },
        { title: "Timeline (Prazo)", description: "Quando a obra começa? Em que fase está o projeto de arquitetura? Há urgência ou é planejamento?", icon: "T" },
        { title: "Perfil Premium", description: "O cliente tem perfil de alto padrão? O projeto é compatível com o posicionamento da Parket?", icon: "+" },
        { title: "Arquiteto Envolvido", description: "Há arquiteto no projeto? Quem é? Já trabalha com a Parket? Pode ser uma porta de entrada.", icon: "+" },
      ],
    },
  },

  // 21. Script: Atendimento Inbound Telefone
  {
    type: "script",
    props: {
      title: "Script: Atendimento\nInbound (Telefone)",
      label: "SDR — Scripts",
      context: "Lead entrou pelo site, Instagram ou indicação e ligou para a Parket.",
      lines: [
        { speaker: "SDR", text: "Parket, bom dia! Aqui é [Nome]. Como posso ajudar?" },
        { speaker: "Lead", text: "Oi, estou fazendo uma reforma e gostaria de saber sobre pisos de madeira." },
        { speaker: "SDR", text: "Que ótimo! Fico feliz que tenha nos procurado. Para que eu possa te ajudar da melhor forma, posso fazer algumas perguntas sobre o projeto?" },
        { speaker: "Lead", text: "Claro, pode sim." },
        { speaker: "SDR", text: "O projeto é residencial ou corporativo? E qual a metragem aproximada da área que vai receber a madeira?" },
        { speaker: "Lead", text: "Residencial, são uns 200m² de piso." },
        { speaker: "SDR", text: "Excelente. Há um arquiteto conduzindo o projeto? E vocês já têm uma ideia de espécie de madeira ou acabamento?" },
        { speaker: "Lead", text: "Sim, temos arquiteto. Ele sugeriu Cumaru." },
        { speaker: "SDR", text: "Cumaru é uma escolha sofisticada — durabilidade e beleza extraordinárias. O ideal seria agendar uma visita ao nosso showroom na Casa Milan para que vocês possam ver e sentir as opções. Funciona para vocês nesta semana?" },
      ],
      tips: [
        "Atenda com energia e profissionalismo — a primeira impressão sonora é fundamental",
        "Faça perguntas abertas para entender o contexto completo antes de oferecer qualquer coisa",
        "Se o lead não tem arquiteto, registre — pode ser oportunidade de indicar parceiros",
        "Sempre termine com agendamento concreto: dia, hora, local",
      ],
    },
  },

  // 22. Script: Qualificação WhatsApp
  {
    type: "script",
    props: {
      title: "Script: Qualificação\npor WhatsApp",
      label: "SDR — Scripts",
      context: "Lead entrou pelo formulário do site ou Instagram e você faz o primeiro contato via WhatsApp.",
      lines: [
        { speaker: "SDR", text: "Olá, [Nome]! Aqui é [Seu Nome] da Parket. Vi que você demonstrou interesse em nossas soluções em madeira natural. Seja muito bem-vindo(a)! Posso saber um pouco mais sobre o seu projeto?" },
        { speaker: "Lead", text: "Oi! Sim, estou construindo uma casa e quero pisos de madeira." },
        { speaker: "SDR", text: "Que projeto bonito! Para que eu possa te direcionar da melhor forma, algumas perguntas rápidas: qual a metragem aproximada? E a obra já está em andamento?" },
        { speaker: "Lead", text: "São 350m² de piso e painéis. A obra começa em 3 meses." },
        { speaker: "SDR", text: "Excelente, projetos assim são a nossa especialidade! Vocês trabalham com arquiteto? E já têm alguma preferência de madeira?" },
        { speaker: "Lead", text: "Sim, a arquiteta é a [Nome]. Ela sugeriu Freijó." },
        { speaker: "SDR", text: "Freijó é uma escolha magnífica — versátil e com veio único. O próximo passo ideal seria uma visita ao nosso showroom na Casa Milan, que é a residência icônica do Paulo Mendes da Rocha. Posso verificar a disponibilidade? Qual dia da semana funciona melhor para vocês?" },
      ],
      tips: [
        "Responda em até 30 minutos para leads de WhatsApp — velocidade é conversão",
        "Use emojis com parcimônia — máximo 1-2 por mensagem para manter a elegância",
        "Envie fotos de projetos similares para engajar — 'Olha como ficou um projeto parecido'",
        "Sempre pergunte sobre o arquiteto — isso define a estratégia de abordagem",
      ],
    },
  },

  // 23. Script: Agendamento de visita
  {
    type: "script",
    props: {
      title: "Script: Agendamento\nde Visita ao Showroom",
      label: "SDR — Scripts",
      context: "Lead qualificado, momento de agendar a visita ao showroom.",
      lines: [
        { speaker: "SDR", text: "[Nome], pelo que conversamos, seu projeto é exatamente o tipo que atendemos com excelência. O próximo passo mais importante é você conhecer nossas madeiras pessoalmente." },
        { speaker: "Lead", text: "Sim, gostaria de ver as opções." },
        { speaker: "SDR", text: "Nosso showroom fica na Casa Milan — uma residência projetada por Paulo Mendes da Rocha, um dos maiores arquitetos da história. É uma experiência única. Tenho disponibilidade na terça às 10h ou quinta às 14h. Qual funciona melhor?" },
        { speaker: "Lead", text: "Quinta às 14h seria bom." },
        { speaker: "SDR", text: "Perfeito! Vou agendar com nosso especialista [Nome do Closer], que vai preparar amostras específicas para o seu projeto. O ideal seria trazer o(a) arquiteto(a) junto, se possível — a experiência fica ainda mais rica. Posso confirmar?" },
        { speaker: "Lead", text: "Vou falar com ela." },
        { speaker: "SDR", text: "Excelente! Vou enviar por WhatsApp a localização, estacionamento e o que esperar da visita. Amanhã confirmo com você. [Nome], vai ser um prazer recebê-lo!" },
      ],
      tips: [
        "Sempre ofereça 2 opções de horário — facilita a decisão e demonstra organização",
        "Incentive a presença do arquiteto — aumenta drasticamente a taxa de conversão",
        "Envie confirmação formal: endereço, mapa, o que esperar, nome do especialista",
        "O nome 'Casa Milan' e 'Paulo Mendes da Rocha' geram curiosidade e desejo imediatos",
      ],
    },
  },

  // 24. Script: Confirmação de visita
  {
    type: "script",
    props: {
      title: "Script: Confirmação\nde Visita (24h antes)",
      label: "SDR — Scripts",
      context: "24 horas antes da visita agendada, faça a confirmação para reduzir no-show.",
      lines: [
        { speaker: "SDR", text: "Olá, [Nome]! Tudo bem? Passando para confirmar sua visita amanhã ao showroom da Parket na Casa Milan, às [horário]. Nosso especialista [Nome] já está preparando amostras especiais para o seu projeto. Está tudo certo?" },
        { speaker: "Lead", text: "Sim, confirmado!" },
        { speaker: "SDR", text: "Excelente! Vou reenviar o endereço: [Endereço]. Estacionamento disponível no local. Sugestão: venha de roupa confortável — você vai poder caminhar sobre os pisos e sentir as texturas. Até amanhã!" },
      ],
      tips: [
        "Confirme SEMPRE 24h antes — reduz no-show em até 40%",
        "Reforce o nome do especialista — cria vínculo antes do encontro",
        "Mencione 'amostras preparadas' — gera sensação de exclusividade",
        "Se não confirmar, ligue. Se não atender, envie áudio curto e amigável",
        "Se precisar reagendar, ofereça nova data imediatamente — nunca deixe em aberto",
      ],
    },
  },

  // 25. Handoff SDR → Closer
  {
    type: "process",
    props: {
      title: "Handoff Perfeito\nSDR → Closer",
      label: "SDR — Processo",
      steps: [
        { number: "01", title: "Briefing completo no CRM", description: "Nome, perfil, projeto, metragem, madeiras de interesse, orçamento estimado, timeline, arquiteto, decisores." },
        { number: "02", title: "Contexto emocional", description: "O que motivou o contato? O que é mais importante para o cliente? Há inseguranças ou comparações com concorrentes?" },
        { number: "03", title: "Expectativas alinhadas", description: "O que o cliente espera da visita? Já tem favoritos? Há restrições (orçamento, prazo, estilo)?" },
        { number: "04", title: "Comunicação verbal", description: "Além do CRM, faça uma ligação ou mensagem rápida ao Closer: 'Olha, esse lead é quente porque...'." },
        { number: "05", title: "Follow-up pós-handoff", description: "Depois da visita, peça feedback ao Closer. Se não converter, analise onde o processo pode melhorar." },
      ],
    },
  },

  // 26. KPIs do SDR
  {
    type: "metrics",
    props: {
      title: "KPIs e Metas\ndo SDR",
      label: "SDR — Métricas",
      metrics: [
        { value: "<2h", label: "Tempo de resposta", description: "Meta para primeiro contato com lead novo" },
        { value: "70%", label: "Taxa de qualificação", description: "Leads contatados → Leads qualificados" },
        { value: "85%", label: "Taxa de comparecimento", description: "Agendamentos → Visitas realizadas" },
        { value: "12-15", label: "Agendamentos/mês", description: "Visitas confirmadas ao showroom" },
        { value: "100%", label: "CRM atualizado", description: "Todas as interações registradas no dia" },
        { value: "<10%", label: "Taxa de no-show", description: "Meta máxima de faltas em agendamentos" },
      ],
    },
  },

  // 27. Erros fatais do SDR
  {
    type: "grid",
    props: {
      title: "Erros Fatais\ndo SDR",
      label: "SDR — Alertas",
      columns: 2,
      cards: [
        { title: "Demora na resposta", description: "Lead que espera mais de 2h já está falando com o concorrente. Velocidade mata indecisão.", icon: "✕" },
        { title: "Qualificação rasa", description: "Não fazer as perguntas certas e enviar lead sem perfil ao Closer. Desperdício de tempo de todos.", icon: "✕" },
        { title: "Handoff sem contexto", description: "Agendar visita sem briefar o Closer é sabotar a conversão. Contexto é tudo.", icon: "✕" },
        { title: "Não confirmar visita", description: "Não confirmar 24h antes é aceitar 30-40% de no-show. Confirmação é obrigatória.", icon: "✕" },
        { title: "Falar demais de preço", description: "Se o lead insistir em preço, diga: 'Cada projeto é único, o Closer vai detalhar na visita'. Redirecione.", icon: "✕" },
        { title: "Tratar lead frio igual", description: "Lead frio precisa de nutrição, não de pressão. Envie conteúdo, não proposta.", icon: "✕" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 4 — CLOSER: MANUAL COMPLETO (16 slides)
  // ═══════════════════════════════════════════════════════════════

  // 28. Seção Closer
  {
    type: "section",
    props: {
      block: "Bloco 03",
      title: "Closer",
      subtitle: "O maestro da conversão. Você transforma oportunidades em contratos e clientes em embaixadores.",
    },
  },

  // 29. Missão e DNA
  {
    type: "content",
    props: {
      title: "Missão e DNA\ndo Closer Parket",
      label: "Closer — Fundamentos",
      highlight: "Converter oportunidades qualificadas em contratos, conduzindo cada interação com maestria técnica, sensibilidade comercial e obsessão pela experiência do cliente.",
      items: [
        "Você não vende madeira — você materializa a visão do cliente e do arquiteto",
        "Cada visita ao showroom é um evento exclusivo — prepare-se como tal",
        "Domínio técnico é obrigatório: espécies, acabamentos, processos, instalação",
        "Você preserva margem com valor, nunca com desconto. Valor vem antes de preço",
        "Pipeline é sua responsabilidade pessoal — gestão disciplinada, previsão precisa",
        "Pós-fechamento impecável: o handoff para produção define a satisfação do cliente",
      ],
    },
  },

  // 30. Rotina semanal
  {
    type: "process",
    props: {
      title: "Rotina Semanal\ndo Closer",
      label: "Closer — Operação",
      steps: [
        { number: "SEG", title: "Planejamento semanal", description: "Revise pipeline, priorize deals, prepare visitas da semana. Defina meta de propostas e fechamentos." },
        { number: "TER", title: "Visitas e showroom", description: "Dia forte de visitas. Prepare amostras, estude projetos, conduza experiências no showroom." },
        { number: "QUA", title: "Propostas e follow-ups", description: "Elabore propostas pendentes. Faça follow-up de propostas enviadas. Atualize pipeline." },
        { number: "QUI", title: "Visitas e negociação", description: "Segundo dia forte de visitas. Reúna-se com leads em negociação para avançar deals." },
        { number: "SEX", title: "Fechamentos e revisão", description: "Foco em fechar deals maduros. Revisão semanal: o que funcionou, o que ajustar. Prepare próxima semana." },
      ],
    },
  },

  // 31. Preparação pré-showroom
  {
    type: "content",
    props: {
      title: "Preparação\nPré-Showroom",
      label: "Closer — Excelência",
      highlight: "A visita ao showroom é o momento de maior impacto emocional. Chegar despreparado é imperdoável.",
      items: [
        "Leia o briefing do SDR no CRM: quem é, projeto, metragem, preferências, arquiteto, decisores",
        "Pesquise o projeto: se há referências visuais, estude-as. Se o arquiteto tem portfólio online, veja",
        "Separe amostras específicas: se o cliente mencionou Cumaru, tenha Cumaru à mão na entrada",
        "Prepare comparações: se ele vai ver Cumaru, tenha Ipê e Freijó ao lado para enriquecer a escolha",
        "Organize o showroom: tudo limpo, iluminado e impecável. Café, água, material de apoio prontos",
        "Alinhe com a equipe: quem mais estará presente? Há suporte técnico necessário?",
        "Vista-se adequadamente: elegante, mas acessível. Você representa a Parket",
      ],
    },
  },

  // 32. Condução no Showroom
  {
    type: "process",
    props: {
      title: "Condução no\nShowroom — Passo a Passo",
      label: "Closer — Showroom",
      steps: [
        { number: "01", title: "Recepção calorosa (5min)", description: "Receba pelo nome na entrada. Apresente-se. Ofereça café/água. Comente sobre a Casa Milan e sua história." },
        { number: "02", title: "Alinhamento de expectativas (10min)", description: "Pergunte: 'O que é mais importante pra vocês neste projeto?' Escute com atenção total. Anote." },
        { number: "03", title: "Tour guiado pelas madeiras (20min)", description: "Conduza pela jornada da madeira: origem, tratamento, acabamento. Deixe tocar, pisar, comparar texturas." },
        { number: "04", title: "Apresentação direcionada (15min)", description: "Mostre as opções mais relevantes para o projeto. Explique prós e contras de cada espécie com honestidade." },
        { number: "05", title: "Visualização do projeto (10min)", description: "Conecte a madeira ao projeto: 'Imagina esse Freijó no living de 80m² com a luz natural da tarde...'." },
        { number: "06", title: "Próximos passos (10min)", description: "Apresente faixa de investimento. Defina próximo passo: proposta em 48h. Agende follow-up na hora." },
      ],
    },
  },

  // 33. Script: Recepção no showroom
  {
    type: "script",
    props: {
      title: "Script: Recepção\nno Showroom",
      label: "Closer — Scripts",
      context: "Cliente chega ao showroom da Casa Milan para visita agendada.",
      lines: [
        { speaker: "Closer", text: "[Nome], seja muito bem-vindo à Casa Milan! Eu sou [Seu Nome], vou acompanhar vocês hoje. Que bom que conseguiram vir!" },
        { speaker: "Cliente", text: "Obrigado! Que espaço incrível..." },
        { speaker: "Closer", text: "Sim, essa é a residência projetada por Paulo Mendes da Rocha nos anos 70 — uma das obras mais importantes da arquitetura brasileira. E hoje funciona como nosso showroom. Café? Água?" },
        { speaker: "Cliente", text: "Um café seria ótimo." },
        { speaker: "Closer", text: "Já providencio! Enquanto isso, me conta: o que é mais importante pra vocês neste projeto? O que não pode faltar?" },
        { speaker: "Cliente", text: "Queremos algo sofisticado, mas aconchegante. A arquiteta sugeriu Freijó..." },
        { speaker: "Closer", text: "Excelente escolha. O Freijó tem uma personalidade única — veio marcante, cor quente. Vamos começar por ele e eu mostro também algumas alternativas que podem surpreender vocês. Vamos?" },
      ],
      tips: [
        "A história da Casa Milan é uma ferramenta de venda — use-a sempre",
        "Pergunte o que é importante ANTES de mostrar qualquer madeira",
        "Café, água — hospitalidade impecável. Detalhes fazem diferença",
        "Se o arquiteto está presente, inclua-o: 'O que você acha, [Arquiteta]?'",
      ],
    },
  },

  // 34. Script: Apresentação técnica
  {
    type: "script",
    props: {
      title: "Script: Apresentação\nTécnica da Madeira",
      label: "Closer — Scripts",
      context: "Durante o tour pelo showroom, apresentando espécies e acabamentos.",
      lines: [
        { speaker: "Closer", text: "Esse aqui é o Freijó que vocês mencionaram. Sinta a textura — esse veio marcante é característico da espécie. Cada tábua é única." },
        { speaker: "Cliente", text: "Nossa, é lindo. E durável?" },
        { speaker: "Closer", text: "Extremamente. O Freijó tem dureza Janka de 580 — ideal para pisos de tráfego residencial. Com a manutenção correta, atravessa gerações. E olha aqui ao lado: esse é o Cumaru, ainda mais duro — Janka de 1.500. Ideal para áreas externas ou quem prefere resistência máxima." },
        { speaker: "Arquiteta", text: "E quanto ao processo de instalação?" },
        { speaker: "Closer", text: "Instalação é 100% nossa — equipe própria, treinada e com garantia. Fazemos desde a preparação do contrapiso até o acabamento final. Nenhum terceirizado. E somos os únicos no Brasil a produzir tábuas acima de 20cm de largura, graças ao nosso parque fabril — considerado o mais moderno da América Latina." },
        { speaker: "Cliente", text: "Isso faz diferença..." },
        { speaker: "Closer", text: "Toda. Tábuas largas criam amplitude visual — o ambiente parece maior, mais sofisticado. Poucos conseguem entregar isso. Vou mostrar uma instalação com tábuas de 25cm que fizemos em um projeto aqui em São Paulo..." },
      ],
      tips: [
        "Domínio técnico transmite confiança — estude as espécies profundamente",
        "Deixe o cliente tocar, pisar, comparar — o tato vende mais que o discurso",
        "Sempre conecte a técnica ao benefício emocional: dureza → tranquilidade, veio → exclusividade",
        "Tenha cases prontos: 'Fizemos algo similar no projeto do [Arquiteto X]'",
      ],
    },
  },

  // 35. Elaboração da proposta
  {
    type: "content",
    props: {
      title: "Como Elaborar\na Proposta Perfeita",
      label: "Closer — Proposta",
      highlight: "A proposta não é um orçamento. É um documento que materializa o sonho do cliente com precisão técnica.",
      items: [
        "Personalização total: use o nome do projeto, referência às conversas, espécies discutidas",
        "Estrutura obrigatória: 1) Escopo detalhado, 2) Especificações técnicas, 3) Cronograma, 4) Investimento",
        "Escopo: detalhe cada ambiente, metragem, espécie, padrão de acabamento e método de instalação",
        "Cronograma: produção (X semanas) + instalação (Y semanas) + margem de segurança",
        "Investimento: apresente por ambiente ou por solução, não como valor único. Facilite a compreensão",
        "Inclua cases similares: 'Projetos como o seu que entregamos com sucesso'",
        "Prazo: envie em até 48h após a visita — velocidade demonstra profissionalismo",
        "Formato: PDF elegante, com imagens das madeiras escolhidas e visualizações do projeto",
      ],
    },
  },

  // 36. Script: Apresentação da proposta
  {
    type: "script",
    props: {
      title: "Script: Apresentação\nda Proposta",
      label: "Closer — Scripts",
      context: "Reunião (presencial ou call) para apresentar a proposta ao cliente.",
      lines: [
        { speaker: "Closer", text: "[Nome], preparei a proposta com muito carinho baseada em tudo que conversamos no showroom. Vou te guiar por cada parte. Posso compartilhar a tela?" },
        { speaker: "Cliente", text: "Sim, pode compartilhar." },
        { speaker: "Closer", text: "Aqui está o escopo: Freijó para todo o piso do térreo — 180m² em tábuas de 22cm com acabamento natural cetim. Para o painel da sala, sugerimos o mesmo Freijó para manter a unidade do projeto, como a [Arquiteta] recomendou." },
        { speaker: "Cliente", text: "E o prazo?" },
        { speaker: "Closer", text: "Produção em 8 semanas após aprovação. Instalação em 3 semanas. Total: 11 semanas com margem. O investimento para todo o projeto fica em R$ [valor], incluindo material, produção, transporte e instalação com equipe própria." },
        { speaker: "Cliente", text: "É um valor considerável..." },
        { speaker: "Closer", text: "Entendo. Mas considere: são R$ [valor/m²] por metro quadrado para uma madeira que vai valorizar o imóvel em até 25% e durar mais de 30 anos. Pisos sintéticos custam metade, mas precisam ser trocados em 5-7 anos. É investimento versus despesa." },
      ],
      tips: [
        "Apresente a proposta — nunca apenas envie por e-mail",
        "Recapitule o que foi discutido no showroom antes de entrar nos números",
        "Quebre o investimento: valor por m², valor por ambiente — fica mais palatável",
        "Tenha comparativos prontos: custo ao longo de 30 anos vs. alternativas",
      ],
    },
  },

  // 37. Técnicas de negociação
  {
    type: "grid",
    props: {
      title: "Técnicas de\nNegociação Premium",
      label: "Closer — Negociação",
      columns: 2,
      cards: [
        { title: "Ancoragem por Valor", description: "Antes de falar preço, reforce todos os diferenciais: fábrica própria, instalação, garantia, tábuas exclusivas. O preço vem depois do valor.", icon: "01" },
        { title: "Espelho Reverso", description: "Se o cliente diz 'tá caro', pergunte: 'O que seria um investimento justo para um projeto desse nível?' Entenda a referência dele.", icon: "02" },
        { title: "Escopo, Não Desconto", description: "Nunca dê desconto direto. Ajuste escopo: 'Podemos começar pelo térreo e fazer o segundo andar em uma segunda fase.'", icon: "03" },
        { title: "Urgência Real", description: "Use fatos reais: 'Essa partida de Freijó é limitada' ou 'Nossa agenda de instalação está com 6 semanas de espera'.", icon: "04" },
        { title: "Silêncio Estratégico", description: "Após apresentar o valor, fique em silêncio. Quem fala primeiro perde poder de negociação. Deixe o cliente processar.", icon: "05" },
        { title: "O Poder da Escolha", description: "Ofereça 2-3 opções (bom, melhor, premium). O cliente escolhe o nível, não se compra ou não compra.", icon: "06" },
      ],
    },
  },

  // 38. Script: Negociação e fechamento
  {
    type: "script",
    props: {
      title: "Script: Negociação\ne Fechamento",
      label: "Closer — Scripts",
      context: "Cliente está na fase de decisão. Já viu a proposta e tem dúvidas ou quer negociar.",
      lines: [
        { speaker: "Cliente", text: "Gostei muito da proposta, mas o valor ficou acima do que esperávamos." },
        { speaker: "Closer", text: "Entendo perfeitamente, [Nome]. Me ajuda a entender: quando você fala 'acima do esperado', é sobre o valor total ou sobre o valor por metro quadrado?" },
        { speaker: "Cliente", text: "O valor total. Estamos com o orçamento da obra apertado." },
        { speaker: "Closer", text: "Faz sentido. Uma alternativa que muitos clientes escolhem é fazer em fases. Podemos começar com os pisos do térreo agora — que é o maior impacto visual — e programar o segundo andar para daqui 3 meses. Isso diluiria o investimento sem comprometer a qualidade." },
        { speaker: "Cliente", text: "Isso seria interessante. Mas consegue um desconto?" },
        { speaker: "Closer", text: "Nosso compromisso é entregar o melhor resultado possível, e por isso trabalhamos com preço justo. O que posso fazer é incluir a manutenção preventiva do primeiro ano, que normalmente é cobrada à parte. Isso garante que o piso fique perfeito depois da instalação. Faz sentido?" },
        { speaker: "Cliente", text: "Faz sim. Vou conversar com minha esposa e a arquiteta." },
        { speaker: "Closer", text: "Perfeito. Posso ligar quinta-feira para alinharmos? E se a [Arquiteta] tiver alguma dúvida técnica, pode me ligar a qualquer momento." },
      ],
      tips: [
        "Nunca negocie contra você mesmo — entenda o que realmente incomoda antes de oferecer algo",
        "Desconto direto desvaloriza o produto. Ofereça valor adicional: manutenção, parcelamento, fases",
        "Sempre defina próximo passo com data — 'Posso ligar quinta?' é melhor que 'Me liga quando decidir'",
        "Se envolver múltiplos decisores, ofereça-se para uma call conjunta",
      ],
    },
  },

  // 39. Objeções avançadas
  {
    type: "grid",
    props: {
      title: "Objeções Avançadas\ne Respostas",
      label: "Closer — Objeções",
      columns: 2,
      cards: [
        { title: "\"Vou fazer com porcelanato que imita madeira\"", description: "Porcelanato não tem a sensação tátil, térmica e acústica da madeira. É frio, duro e não valoriza o imóvel da mesma forma. Em alto padrão, o toque é tudo.", icon: "01" },
        { title: "\"O prazo é muito longo\"", description: "Qualidade leva tempo. Cada peça é selecionada, tratada e acabada individualmente. Acelerar comprometeria o que nos diferencia. Podemos ver se há partidas prontas.", icon: "02" },
        { title: "\"Madeira dá muito trabalho\"", description: "Com a manutenção correta (simples e anual), a madeira natural dura +30 anos. É menos manutenção que um jardim. E oferecemos programa preventivo.", icon: "03" },
        { title: "\"Meu vizinho teve problema com madeira\"", description: "Problemas com madeira vêm de instalação ruim ou material de baixa qualidade. Na Parket, instalação é própria e o material é selecionado tábua a tábua.", icon: "04" },
        { title: "\"Preciso de mais orçamentos\"", description: "Recomendo que compare, sim. Mas peço que compare: origem da madeira, garantia, quem instala, e se fazem tábuas da largura que mostramos. Estamos à disposição.", icon: "05" },
        { title: "\"O arquiteto indicou outra empresa\"", description: "Respeito muito. Convide o arquiteto para conhecer nosso showroom e nosso parque fabril. Temos certeza de que a comparação será favorável.", icon: "06" },
      ],
    },
  },

  // 40. Script: Follow-up pós-proposta
  {
    type: "script",
    props: {
      title: "Script: Follow-up\nPós-Proposta",
      label: "Closer — Cadência",
      context: "Cadência de follow-up após envio da proposta.",
      lines: [
        { speaker: "Closer", text: "[D+3] Olá, [Nome]! Passando para saber se conseguiu analisar a proposta. Ficou alguma dúvida que eu possa esclarecer?" },
        { speaker: "Closer", text: "[D+7] [Nome], bom dia! Queria compartilhar um case que acabamos de entregar — um projeto muito parecido com o seu: [enviar foto]. Ficou espetacular. A proposta continua válida, qualquer ajuste é só me dizer." },
        { speaker: "Closer", text: "[D+14] [Nome], espero que esteja tudo bem! Queria te avisar que a partida de [Madeira] que separamos para o seu projeto tem disponibilidade limitada. Gostaria de garantir para vocês. Podemos conversar?" },
        { speaker: "Closer", text: "[D+30] [Nome], passaram 30 dias desde nossa conversa. O projeto ainda está nos seus planos? Se o timing mudou, sem problema algum — fico à disposição quando fizer sentido. Abraço!" },
      ],
      tips: [
        "D+3: tom consultivo, tire dúvidas",
        "D+7: envie valor adicional (case, conteúdo), reforce interesse",
        "D+14: crie urgência real (estoque, agenda), sem pressão artificial",
        "D+30: último follow-up ativo. Se não responder, mova para nurturing",
        "Nunca faça mais de 4 follow-ups sem resposta — preserve a elegância da marca",
      ],
    },
  },

  // 41. Pipeline management
  {
    type: "content",
    props: {
      title: "Gestão de\nPipeline",
      label: "Closer — Disciplina",
      highlight: "Seu pipeline é o reflexo da sua disciplina. Pipeline limpo = previsão precisa = meta batida.",
      items: [
        "Revise o pipeline toda segunda-feira: quantos deals em cada fase? Qual o valor total? Qual o forecast?",
        "Cada deal precisa ter: valor estimado, probabilidade de fechamento, data prevista e próximo passo",
        "Deals parados há mais de 30 dias sem interação devem ser movidos para 'Stalled' ou descartados",
        "Mantenha no máximo 20-25 deals ativos. Acima disso, a qualidade do atendimento cai",
        "A regra 3x: seu pipeline deve ter 3x o valor da sua meta para garantir a conversão",
        "Forecast semanal: comprometa-se com fechamentos da semana e reporte resultado. Sem surpresas",
        "Deals perdidos: registre o motivo. Preço? Prazo? Concorrente? Isso gera inteligência para todo o time",
      ],
    },
  },

  // 42. KPIs do Closer
  {
    type: "metrics",
    props: {
      title: "KPIs e Metas\ndo Closer",
      label: "Closer — Métricas",
      metrics: [
        { value: "35%+", label: "Taxa de fechamento", description: "Propostas enviadas → Contratos assinados" },
        { value: "48h", label: "Tempo até proposta", description: "Da visita ao envio da proposta" },
        { value: "30d", label: "Ciclo médio de venda", description: "Do primeiro contato ao fechamento" },
        { value: "3x", label: "Pipeline / Meta", description: "Cobertura mínima de pipeline" },
        { value: "9+", label: "NPS", description: "Satisfação do cliente com o processo" },
        { value: "100%", label: "CRM atualizado", description: "Pipeline reflete a realidade em tempo real" },
      ],
    },
  },

  // 43. Checklist do Closer
  {
    type: "content",
    props: {
      title: "Checklist Semanal\ndo Closer",
      label: "Closer — Disciplina",
      highlight: "Toda sexta-feira, antes de encerrar a semana.",
      items: [
        "[ ] Todas as propostas pendentes foram enviadas dentro de 48h",
        "[ ] Todos os follow-ups da semana foram executados na cadência correta",
        "[ ] Pipeline atualizado: valor, probabilidade, próximo passo para cada deal",
        "[ ] Deals stalled (parados >30 dias) foram revisados ou descartados",
        "[ ] Handoffs para produção/instalação foram feitos com briefing completo",
        "[ ] Forecast da próxima semana definido e reportado ao gestor",
        "[ ] Feedback solicitado ao SDR sobre a qualidade dos leads recebidos",
        "[ ] Pelo menos 1 case study/depoimento coletado de cliente satisfeito",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 5 — FLUXOS INTEGRADOS (6 slides)
  // ═══════════════════════════════════════════════════════════════

  // 44. Seção
  {
    type: "section",
    props: {
      block: "Bloco 04",
      title: "Fluxos\nIntegrados",
      subtitle: "A máquina comercial só funciona quando cada peça se encaixa perfeitamente.",
    },
  },

  // 45. Fluxo completo
  {
    type: "process",
    props: {
      title: "Fluxo Completo\nBDR → SDR → Closer",
      label: "Fluxos — Visão Geral",
      steps: [
        { number: "01", title: "BDR prospecta", description: "Identifica escritório, faz contato, nutre relacionamento. Arquiteto engajado → registra no CRM com tag 'Prospectado'." },
        { number: "02", title: "BDR agenda ou encaminha", description: "Se há projeto ativo, agenda visita diretamente ou encaminha para SDR qualificar. Briefing completo no CRM." },
        { number: "03", title: "SDR qualifica", description: "Aplica BANT+. Confirma perfil, projeto, orçamento, timeline e decisores. Atualiza status para 'Qualificado'." },
        { number: "04", title: "SDR agenda showroom", description: "Agenda visita, confirma 24h antes, prepara briefing completo para o Closer. Status: 'Agendado'." },
        { number: "05", title: "Closer conduz e propõe", description: "Experiência no showroom → proposta em 48h → follow-up na cadência → negociação → fechamento." },
        { number: "06", title: "Closer fecha e entrega", description: "Contrato assinado → handoff para produção com briefing técnico completo. Pós-venda ativo." },
      ],
    },
  },

  // 46. Handoff perfeito
  {
    type: "content",
    props: {
      title: "O Handoff Perfeito",
      label: "Fluxos — Handoff",
      highlight: "Cada transição entre funções é um momento crítico. Informação perdida = oportunidade perdida.",
      items: [
        "BDR → SDR: Nome, escritório, projetos, contato, contexto da conversa, temperatura do lead, arquiteto envolvido",
        "SDR → Closer: Tudo acima + BANT+ completo, expectativas do cliente, preferências de madeira, horário da visita, quem estará presente",
        "Closer → Produção: Contrato assinado + especificações técnicas detalhadas + cronograma acordado + contato do arquiteto + observações especiais",
        "Regra de ouro: nunca faça handoff apenas por CRM. Sempre complemente com comunicação verbal ou mensagem direta",
        "Feedback reverso: após cada handoff, o receptor informa ao emissor como foi. Isso calibra a qualidade do processo continuamente",
      ],
    },
  },

  // 47. Rituais comerciais
  {
    type: "grid",
    props: {
      title: "Rituais\nComerciais",
      label: "Fluxos — Cultura",
      columns: 2,
      cards: [
        { title: "Daily (15min)", description: "Toda manhã: cada um reporta — ontem, hoje, bloqueios. Rápido, objetivo, em pé.", icon: "Diário" },
        { title: "Pipeline Review (1h)", description: "Toda segunda: revisão de cada deal do pipeline. Valor, probabilidade, próximo passo, bloqueios.", icon: "Semanal" },
        { title: "Forecast Meeting (30min)", description: "Toda sexta: Closer + Diretor. O que fecha essa semana? O que entrou? O que saiu? Acuracidade.", icon: "Semanal" },
        { title: "One-on-One (45min)", description: "Quinzenal: gestor + cada membro. Desenvolvimento, feedback, metas pessoais, carreira.", icon: "Quinzenal" },
        { title: "Treinamento (2h)", description: "Mensal: técnicas de venda, produto, cases, role-play de objeções. Todos participam.", icon: "Mensal" },
        { title: "Retrospectiva (1h)", description: "Mensal: o que funcionou? O que ajustar? Celebrações + aprendizados. Cultura de melhoria.", icon: "Mensal" },
      ],
    },
  },

  // 48. Dashboard e Relatórios
  {
    type: "content",
    props: {
      title: "Dashboard e\nRelatórios",
      label: "Fluxos — Visibilidade",
      highlight: "Se não está medido, não está gerenciado. O dashboard é o painel de controle da máquina comercial.",
      items: [
        "Visão em tempo real: leads novos, agendamentos, visitas, propostas, negociações, fechamentos",
        "Conversão por etapa: onde estamos perdendo? Qual a taxa entre cada fase do funil?",
        "Velocidade do pipeline: quantos dias em média entre cada etapa? Onde o deal fica travado?",
        "Performance individual: cada BDR, SDR e Closer tem seu scorecard com as métricas-chave",
        "Forecast vs. Real: quanto previmos fechar? Quanto fechamos? Qual a acuracidade?",
        "Relatório semanal: enviado toda sexta ao Diretor Comercial com resumo de métricas e destaques",
        "Relatório mensal: análise profunda com tendências, comparativos MoM e plano de ação",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 6 — BANCO DE TEMPLATES (6 slides)
  // ═══════════════════════════════════════════════════════════════

  // 49. Seção
  {
    type: "section",
    props: {
      block: "Bloco 05",
      title: "Banco de\nTemplates",
      subtitle: "Modelos prontos para WhatsApp, e-mail e situações recorrentes do dia a dia comercial.",
    },
  },

  // 50. Templates WhatsApp
  {
    type: "content",
    props: {
      title: "Templates\nWhatsApp",
      label: "Templates — WhatsApp",
      items: [
        "Primeiro contato: 'Olá, [Nome]! Aqui é [Seu Nome] da Parket — líder em madeira natural de alto padrão. Vi que você se interessou por nossas soluções. Posso saber mais sobre o seu projeto?'",
        "Pós-visita: '[Nome], foi um prazer recebê-lo hoje na Casa Milan! Como combinamos, envio a proposta até [data]. Enquanto isso, qualquer dúvida estou à disposição.'",
        "Follow-up de proposta: '[Nome], bom dia! Conseguiu analisar a proposta que enviei? Se tiver alguma dúvida, posso agendar uma call rápida para conversarmos.'",
        "Reengajamento: '[Nome], tudo bem? Faz um tempo que conversamos. Se o projeto de madeira ainda está nos planos, estamos com novidades que podem interessar!'",
        "Indicação: '[Nome], conheço seu trabalho e admiro muito. Temos cases incríveis com madeira natural em projetos de alto padrão. Gostaria de conhecer nosso showroom na Casa Milan?'",
      ],
    },
  },

  // 51. Templates E-mail
  {
    type: "content",
    props: {
      title: "Templates\nE-mail",
      label: "Templates — E-mail",
      items: [
        "Pós-visita: Assunto: 'Foi um prazer, [Nome]! Proposta em caminho'. Corpo: recapitule a visita, confirme os produtos escolhidos, informe prazo da proposta, reforce disponibilidade.",
        "Envio de proposta: Assunto: 'Proposta personalizada — Projeto [Nome do Projeto]'. Corpo: proposta em PDF anexa, recapitulação do escopo, convite para apresentação presencial.",
        "Follow-up (D+7): Assunto: 'Novo case que combina com seu projeto'. Corpo: compartilhe case similar, reforce a proposta, ofereça call para dúvidas.",
        "Reativação: Assunto: 'Novidades em madeiras exclusivas — Parket'. Corpo: novidade de produto/espécie, convite para visita, tom leve e sem cobrança.",
        "Regra geral: máx 3 parágrafos curtos. Assunto personalizado. CTA claro. Assinatura profissional completa.",
      ],
    },
  },

  // 52. Frases proibidas vs recomendadas
  {
    type: "twocolumn",
    props: {
      title: "Linguagem\nComercial",
      label: "Templates — Comunicação",
      leftTitle: "Frases Recomendadas",
      leftItems: [
        "'O investimento para este projeto é de...' (em vez de 'custa')",
        "'Vou analisar a melhor solução para vocês' (consultivo)",
        "'Posso verificar a disponibilidade dessa madeira' (exclusividade)",
        "'Nossos especialistas vão cuidar de cada detalhe' (confiança)",
        "'Baseado no que conversamos...' (mostra que escutou)",
        "'Cada projeto é único, vamos personalizar' (exclusividade)",
      ],
      rightTitle: "Frases Proibidas",
      rightItems: [
        "'O preço é...' (nunca use 'preço', use 'investimento')",
        "'É o mais barato que consigo' (nunca compita por preço)",
        "'Não sei, vou perguntar' (pesquise antes, traga a resposta)",
        "'Isso é política da empresa' (humanize, explique o porquê)",
        "'Você vai ter que...' (nunca dê ordens ao cliente)",
        "'Pra ontem' ou gírias informais (mantenha a elegância sempre)",
      ],
      leftColor: "#C4956A",
      rightColor: "#E85D5D",
    },
  },

  // 53. Statement final
  {
    type: "statement",
    props: {
      statement: "Cada ligação, cada e-mail, cada visita ao showroom é uma oportunidade de construir a reputação da Parket. Execute com disciplina. Venda com elegância. Entregue com excelência.",
      label: "Compromisso Final",
      attribution: "Manual Comercial Parket",
    },
  },

  // 54. Closing
  {
    type: "closing",
    props: {
      title: "Parket",
      subtitle: "Manual Prático Comercial\nBDR · SDR · Closer\nExcelência em cada interação.",
      image: parketHerringbone,
      logo: parketLogo,
    },
  },
];
