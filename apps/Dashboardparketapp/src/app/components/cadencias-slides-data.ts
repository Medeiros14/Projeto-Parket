import { type SlideData } from "./slides-data";
import parketHerringbone from "figma:asset/b9bdf6119029ab1e402ac73b9a4bf22363cd3ff6.png";
import parketDeckLake from "figma:asset/4d5981327c581648268ef6760447eb46d6931f4c.png";
import parketCurvedShelving from "figma:asset/599bac592a9aaa0e1b24504b427fc642dc39a574.png";
import parketWoodInterior from "figma:asset/e602455ef9adc036da056c804817732f86ab9037.png";
import parketStoneWall from "figma:asset/e709d3507fb615d8e01cdd56b0745f81577f6d89.png";
import parketSpiral from "figma:asset/4a6a8ad24bcda1f844920eb717e3e4d47f57d4d3.png";
import parketChevronMarble from "figma:asset/ea0f5dc71a9c6dc129a9bab938e0e9a789ce04d5.png";

export const cadenciasSlides: SlideData[] = [

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 1 — INTRODUÇÃO (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 1. Capa
  {
    type: "cover",
    props: {
      title: "Cadências de\nProspecção",
      subtitle: "O sistema que transforma disciplina em receita previsível",
      image: parketChevronMarble,
    },
  },

  // 2. Statement
  {
    type: "statement",
    props: {
      statement: "Vendedor bom não é o que faz uma ligação brilhante. É o que faz 12 toques no lead certo, no canal certo, na hora certa — sem pular nenhum. Cadência é o que separa amador de profissional.",
      label: "Filosofia",
      attribution: "Máquina de Vendas Parket",
    },
  },

  // 3. O que é cadência
  {
    type: "content",
    props: {
      title: "O Que É Uma\nCadência",
      label: "Conceito Fundamental",
      highlight: "Cadência é uma sequência predefinida de ações de contato — com canais, intervalos e mensagens específicas — executada de forma sistemática até obter resposta ou esgotar as tentativas.",
      items: [
        "Não é 'ligar quando lembrar'. É um processo industrial aplicado à venda consultiva",
        "Elimina a dependência do 'feeling' do vendedor — o processo decide, não a pessoa",
        "Cada cadência tem: número de toques, canais definidos, intervalos entre toques e scripts prontos",
        "O lead nunca é abandonado por esquecimento — só por decisão estratégica",
        "Cadência bem executada aumenta taxa de conexão em 3x a 5x vs. contato avulso",
        "A consistência da cadência é o que gera previsibilidade de receita",
      ],
    },
  },

  // 4. Grid — Tipos de cadência
  {
    type: "grid",
    props: {
      title: "4 Tipos de\nCadência Parket",
      label: "Arsenal Completo",
      columns: 2,
      cards: [
        { title: "Inbound Quente", description: "Lead pediu contato. Velocidade é tudo. 7 dias, 9 toques.", icon: "01" },
        { title: "Outbound Frio", description: "Nós iniciamos. Persistência inteligente. 21 dias, 12 toques.", icon: "02" },
        { title: "Indicação", description: "Veio por referência. Confiança herdada. 5 dias, 6 toques.", icon: "03" },
        { title: "Arquiteto / Especificador", description: "Relacionamento B2B. Valor antes de venda. 14 dias, 8 toques.", icon: "04" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 2 — CADÊNCIA INBOUND (7 slides)
  // ═══════════════════════════════════════════════════════════════

  // 5. Section
  {
    type: "section",
    props: {
      block: "Cadência 01",
      title: "Inbound\nQuente",
      subtitle: "Lead pediu contato. Cada minuto que passa, a probabilidade de conversão cai. Velocidade é a arma.",
    },
  },

  // 6. Processo dia-a-dia
  {
    type: "process",
    props: {
      title: "Sequência de\n7 Dias — 9 Toques",
      label: "Cadência Inbound",
      steps: [
        { number: "D0", title: "Minuto 0 — WhatsApp + Ligação", description: "Resposta em até 5 min. WhatsApp com apresentação + ligação imediata. Quem chega primeiro, fecha." },
        { number: "D0", title: "Hora 2 — E-mail de valor", description: "E-mail com portfólio visual + link do showroom. Tom consultivo, não desesperado." },
        { number: "D1", title: "Dia 1 — WhatsApp follow-up", description: "Mensagem curta: 'Vi que não conseguimos falar, fico à disposição.' + imagem de projeto similar." },
        { number: "D2", title: "Dia 2 — Ligação 2", description: "Horário diferente do D0. Manhã se ligou à tarde, e vice-versa." },
        { number: "D3", title: "Dia 3 — WhatsApp com gatilho", description: "Enviar caso de sucesso ou depoimento de cliente. Gerar curiosidade." },
        { number: "D5", title: "Dia 5 — Ligação 3 + E-mail", description: "Última ligação. E-mail com assunto diferente e proposta de visita ao showroom." },
        { number: "D7", title: "Dia 7 — Mensagem de encerramento", description: "Tom elegante: 'Não quero ser inconveniente. Fico à disposição quando fizer sentido.' Deixa porta aberta." },
      ],
    },
  },

  // 7. Script D0 — WhatsApp
  {
    type: "script",
    props: {
      title: "Dia 0 — WhatsApp\nPrimeiro Contato",
      label: "Script Inbound",
      context: "Lead acabou de preencher formulário ou pedir contato. Máximo 5 minutos.",
      lines: [
        { speaker: "SDR", text: "Olá [Nome], tudo bem? Sou [seu nome] da Parket. Vi que demonstrou interesse em [piso/painel/projeto]. Que bom ter você aqui!" },
        { speaker: "SDR", text: "A Parket é referência há mais de 50 anos em madeira natural para alta arquitetura. Trabalhamos com curadoria das melhores madeiras do mundo — do Ipê brasileiro ao Carvalho Europeu." },
        { speaker: "SDR", text: "Posso entender melhor o seu projeto? É residencial ou comercial? Já tem arquiteto definido?" },
        { speaker: "Lead", text: "É para minha casa, estou reformando..." },
        { speaker: "SDR", text: "Excelente! Para uma experiência completa, convido você a conhecer nosso showroom na Casa Milan — a icônica residência projetada por Paulo Mendes da Rocha. Lá você pisa nas madeiras, sente a diferença. Qual o melhor dia para você?" },
      ],
      tips: [
        "Responda em ATÉ 5 MINUTOS — taxa de conversão cai 80% após 30 min",
        "Use o nome do lead. Personalização gera conexão",
        "Envie uma foto de projeto junto com a mensagem — visual vende",
        "Nunca envie preço nesse primeiro contato",
      ],
    },
  },

  // 8. Script D0 — Ligação
  {
    type: "script",
    props: {
      title: "Dia 0 — Ligação\nImediata",
      label: "Script Inbound",
      context: "Ligar imediatamente após o WhatsApp. Se não atendeu o WhatsApp, a ligação é o plano B instantâneo.",
      lines: [
        { speaker: "SDR", text: "Olá [Nome], aqui é [seu nome] da Parket. Você solicitou informações sobre [produto]. Posso falar um minuto?" },
        { speaker: "Lead", text: "Pode sim, rapidinho." },
        { speaker: "SDR", text: "Perfeito. Só pra eu direcionar da melhor forma: esse projeto é residencial? Já tem metragem definida? Trabalha com algum arquiteto?" },
        { speaker: "Lead", text: "É residencial, uns 200m2 de piso..." },
        { speaker: "SDR", text: "Ótimo. Para um projeto desse porte, o ideal é uma visita consultiva ao nosso showroom. A gente analisa o projeto, sugere as melhores opções de madeira e acabamento, e você sai com uma proposta personalizada. Qual dia funciona melhor?" },
      ],
      tips: [
        "Objetivo da ligação: AGENDAR visita, não vender por telefone",
        "Se não atender: não deixe mensagem de voz. Tente novamente no D1",
        "Fale devagar, tom calmo — transmita autoridade, não urgência",
        "Anote TUDO no CRM imediatamente após a ligação",
      ],
    },
  },

  // 9. Script D3 — Gatilho
  {
    type: "script",
    props: {
      title: "Dia 3 — WhatsApp\ncom Gatilho de Valor",
      label: "Script Inbound",
      context: "Lead não respondeu nos dias anteriores. Hora de gerar curiosidade com prova social.",
      lines: [
        { speaker: "SDR", text: "[Nome], bom dia! Lembrei de você quando vi esse projeto que entregamos recentemente — um apartamento em [bairro/cidade] com piso em Carvalho Europeu. [FOTO]" },
        { speaker: "SDR", text: "O arquiteto especificou tábuas de 22cm de largura — somos os únicos a produzir nessa dimensão. Ficou impressionante." },
        { speaker: "SDR", text: "Se quiser ver de perto como a madeira fica no ambiente real, posso agendar uma visita ao showroom. Sem compromisso." },
      ],
      tips: [
        "Escolha um projeto parecido com o do lead (residencial se residencial, etc.)",
        "Foto REAL de projeto entregue, não render 3D",
        "O gatilho funciona porque mostra resultado, não promessa",
        "Se responder: ótimo, retome. Se não: siga a cadência",
      ],
    },
  },

  // 10. Script D7 — Encerramento elegante
  {
    type: "script",
    props: {
      title: "Dia 7 — Mensagem\nde Encerramento",
      label: "Script Inbound",
      context: "Último toque da cadência. Tom respeitoso. Porta sempre aberta.",
      lines: [
        { speaker: "SDR", text: "[Nome], tentei contato nos últimos dias mas entendo que o timing pode não ser o ideal agora." },
        { speaker: "SDR", text: "Vou pausar os contatos para não ser inconveniente. Mas saiba que a Parket está aqui quando o seu projeto avançar." },
        { speaker: "SDR", text: "Se precisar de qualquer referência sobre madeira natural para arquitetura, é só chamar. Um abraço!" },
      ],
      tips: [
        "NUNCA demonstre frustração ou cobrança",
        "Essa mensagem tem a maior taxa de resposta — a pressão desaparece",
        "Após enviar, mova o lead para cadência de nurturing no CRM",
        "Se responder, retome como se fosse o primeiro contato",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 3 — CADÊNCIA OUTBOUND (8 slides)
  // ═══════════════════════════════════════════════════════════════

  // 11. Section
  {
    type: "section",
    props: {
      block: "Cadência 02",
      title: "Outbound\nFrio",
      subtitle: "Nós iniciamos o contato. O lead não nos conhece. Persistência inteligente + valor em cada toque.",
    },
  },

  // 12. Processo
  {
    type: "process",
    props: {
      title: "Sequência de\n21 Dias — 12 Toques",
      label: "Cadência Outbound",
      steps: [
        { number: "D1", title: "Dia 1 — LinkedIn + Pesquisa", description: "Pesquisar o lead. Conectar no LinkedIn com mensagem personalizada. Mapear contexto." },
        { number: "D2", title: "Dia 2 — E-mail frio #1", description: "E-mail consultivo com referência ao perfil/empresa. Sem pitch. Perguntar sobre o projeto." },
        { number: "D4", title: "Dia 4 — WhatsApp #1", description: "Mensagem curta + foto de projeto. Tom leve, não invasivo." },
        { number: "D5", title: "Dia 5 — Ligação #1", description: "Primeira ligação. Referência ao e-mail. Se não atender: sem voice mail." },
        { number: "D7", title: "Dia 7 — E-mail #2 com caso", description: "E-mail com caso de sucesso de cliente do mesmo segmento." },
        { number: "D9", title: "Dia 9 — WhatsApp #2", description: "Compartilhar conteúdo relevante: artigo sobre tendências, foto de projeto." },
        { number: "D11", title: "Dia 11 — Ligação #2", description: "Segunda ligação em horário diferente. Se atender: abordagem consultiva." },
        { number: "D14", title: "Dia 14 — E-mail #3 convite", description: "Convite para visita ao showroom. Tom exclusivo, não genérico." },
        { number: "D17", title: "Dia 17 — WhatsApp #3", description: "Mensagem com depoimento de cliente. Prova social é a arma mais forte." },
        { number: "D19", title: "Dia 19 — Ligação #3", description: "Última ligação. Direto ao ponto: 'Vale a pena nos conhecermos?'" },
        { number: "D21", title: "Dia 21 — Break-up email", description: "E-mail de encerramento elegante. Porta aberta. Move para nurturing." },
      ],
    },
  },

  // 13. Script Outbound D2 — Email frio
  {
    type: "script",
    props: {
      title: "Dia 2 — E-mail\nFrio Consultivo",
      label: "Script Outbound",
      context: "Primeiro e-mail. O lead não nos conhece. Cada palavra precisa justificar a próxima.",
      lines: [
        { speaker: "SDR", text: "Assunto: Madeira natural no [projeto/bairro/empreendimento]" },
        { speaker: "SDR", text: "[Nome], vi que você está à frente do [projeto/reforma/empreendimento] e achei que faria sentido nos conectarmos." },
        { speaker: "SDR", text: "A Parket é a maior especialista em madeira natural para alta arquitetura no Brasil — são 50+ anos e 10.000+ projetos com os maiores escritórios do país." },
        { speaker: "SDR", text: "Trabalhamos com uma curadoria global: Carvalho Europeu, Nogueira Americana, Ipê, pisos com metais e mármores italianos, madeira Thermo norueguesa, entre outras." },
        { speaker: "SDR", text: "Se madeira natural está no seu radar, adoraria mostrar o que podemos fazer pelo seu projeto. Vale 15 minutos?" },
      ],
      tips: [
        "Assunto CURTO e específico — evite 'Proposta Comercial' ou genéricos",
        "Mencione algo específico do lead: bairro, prédio, arquiteto",
        "Sem anexo pesado no primeiro e-mail — link para portfólio digital",
        "CTA é reunião/visita, nunca 'me ligue quando puder'",
      ],
    },
  },

  // 14. Script Outbound D4 — WhatsApp
  {
    type: "script",
    props: {
      title: "Dia 4 — WhatsApp\nPrimeiro Toque",
      label: "Script Outbound",
      context: "Lead não respondeu o e-mail. WhatsApp é mais direto. Tom leve.",
      lines: [
        { speaker: "BDR", text: "[Nome], tudo bem? Sou [seu nome] da Parket. Enviei um e-mail há dois dias sobre madeira natural para o seu [projeto]." },
        { speaker: "BDR", text: "Achei que seria mais prático trocar por aqui. Olha esse projeto que entregamos recentemente — [FOTO] — Carvalho Europeu com tábuas de 22cm." },
        { speaker: "BDR", text: "Se fizer sentido, posso te convidar para conhecer o showroom na Casa Milan. Sem compromisso." },
      ],
      tips: [
        "Foto de projeto é obrigatória — nunca mande só texto",
        "Se o lead visualizar e não responder: NÃO mande mais nada hoje",
        "Tom de quem está compartilhando algo legal, não vendendo",
        "Nunca mande áudio na primeira mensagem outbound",
      ],
    },
  },

  // 15. Script Outbound D21 — Break-up
  {
    type: "script",
    props: {
      title: "Dia 21 — E-mail\nde Encerramento",
      label: "Script Outbound",
      context: "Último toque. Muitas vezes é este e-mail que gera resposta — psicologia da escassez.",
      lines: [
        { speaker: "BDR", text: "Assunto: Fechando o ciclo" },
        { speaker: "BDR", text: "[Nome], tentei contato algumas vezes nas últimas semanas, mas entendo que o timing nem sempre é o ideal." },
        { speaker: "BDR", text: "Vou encerrar as tentativas de contato para não tomar mais do seu tempo." },
        { speaker: "BDR", text: "Se em algum momento madeira natural entrar no seu radar — pisos, painéis, escadas, fachadas — a Parket estará aqui. São 50+ anos fazendo isso com excelência." },
        { speaker: "BDR", text: "Desejo sucesso no seu projeto. Um abraço." },
      ],
      tips: [
        "O break-up email tem taxa de resposta de 25-30% — NÃO PULE",
        "Se responder: retome com entusiasmo, sem cobrar o silêncio",
        "Após enviar: mover para nurturing automático (conteúdo mensal)",
        "Revisitar em 90 dias se não houve resposta",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 4 — CADÊNCIA INDICAÇÃO (4 slides)
  // ═══════════════════════════════════════════════════════════════

  // 16. Section
  {
    type: "section",
    props: {
      block: "Cadência 03",
      title: "Indicação",
      subtitle: "Confiança herdada. O lead já ouviu falar bem de nós. Velocidade + referência ao indicador.",
    },
  },

  // 17. Processo
  {
    type: "process",
    props: {
      title: "Sequência de\n5 Dias — 6 Toques",
      label: "Cadência Indicação",
      steps: [
        { number: "D0", title: "Dia 0 — WhatsApp imediato", description: "Mencionar quem indicou. 'Fulano me passou seu contato e disse que você está com um projeto incrível.'" },
        { number: "D0", title: "Dia 0 — Ligação", description: "Ligar em até 1 hora. Referência ao indicador abre todas as portas." },
        { number: "D1", title: "Dia 1 — WhatsApp com portfólio", description: "Enviar 2-3 fotos de projetos similares. 'Separei alguns trabalhos que lembram o que o [indicador] me descreveu.'" },
        { number: "D2", title: "Dia 2 — Ligação 2", description: "Segunda tentativa de ligação. Se atender: convidar para showroom." },
        { number: "D3", title: "Dia 3 — E-mail formal", description: "E-mail com apresentação institucional + link do portfólio. Tom mais formal." },
        { number: "D5", title: "Dia 5 — Encerramento elegante", description: "WhatsApp final: 'Fico à disposição quando o timing for o ideal.'" },
      ],
    },
  },

  // 18. Script Indicação
  {
    type: "script",
    props: {
      title: "WhatsApp —\nAbordagem Indicação",
      label: "Script Indicação",
      context: "Lead indicado por cliente ou arquiteto. A confiança já existe — capitalize.",
      lines: [
        { speaker: "SDR", text: "[Nome], tudo bem? Sou [seu nome] da Parket. O [nome do indicador] me passou o seu contato — disse que você está com um projeto que pode se beneficiar da nossa expertise em madeira natural." },
        { speaker: "SDR", text: "Fizemos o [descrever brevemente o trabalho com o indicador] e ele ficou muito satisfeito. Adoraríamos contribuir com o seu projeto também." },
        { speaker: "Lead", text: "Ah sim, ele me falou muito bem de vocês!" },
        { speaker: "SDR", text: "Que ótimo ouvir isso! Posso te convidar para conhecer o nosso showroom? Funciona dentro da Casa Milan — a residência projetada por Paulo Mendes da Rocha. Lá você sente a madeira, vê os acabamentos. Qual dia funciona?" },
      ],
      tips: [
        "SEMPRE mencionar quem indicou — é o gatilho mais poderoso",
        "Indicação tem conversão 3x maior que cold — não desperdice",
        "Agradeça o indicador com feedback sobre o andamento",
        "Cadência mais curta porque a confiança já está herdada",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 5 — CADÊNCIA ARQUITETO (4 slides)
  // ═══════════════════════════════════════════════════════════════

  // 19. Section
  {
    type: "section",
    props: {
      block: "Cadência 04",
      title: "Arquiteto &\nEspecificador",
      subtitle: "Relacionamento B2B de longo prazo. Aqui não se vende — se constrói parceria.",
    },
  },

  // 20. Processo
  {
    type: "process",
    props: {
      title: "Sequência de\n14 Dias — 8 Toques",
      label: "Cadência Arquiteto",
      steps: [
        { number: "D1", title: "Dia 1 — LinkedIn + Pesquisa", description: "Estudar portfólio do arquiteto. Conectar no LinkedIn com elogio genuíno a um projeto." },
        { number: "D2", title: "Dia 2 — E-mail consultivo", description: "E-mail com referência a um projeto do arquiteto + como a Parket poderia agregar." },
        { number: "D4", title: "Dia 4 — WhatsApp + material", description: "Enviar catálogo técnico digital ou book de projetos com arquitetos renomados." },
        { number: "D6", title: "Dia 6 — Ligação", description: "Ligar para apresentar-se. Convidar para visita técnica ao showroom ou fábrica." },
        { number: "D8", title: "Dia 8 — Convite exclusivo", description: "Convite para evento, workshop ou visita privativa ao showroom." },
        { number: "D10", title: "Dia 10 — WhatsApp com caso", description: "Compartilhar projeto feito com outro arquiteto renomado. Prova social B2B." },
        { number: "D12", title: "Dia 12 — E-mail com proposta", description: "Proposta formal de parceria: condições especiais, suporte técnico, amostras." },
        { number: "D14", title: "Dia 14 — Follow-up final", description: "Mensagem de disponibilidade. Sem pressão. Relacionamento é maratona." },
      ],
    },
  },

  // 21. Script Arquiteto
  {
    type: "script",
    props: {
      title: "E-mail — Abordagem\nArquiteto",
      label: "Script Arquiteto",
      context: "Primeiro contato com escritório de arquitetura. Tom de parceria, nunca de venda.",
      lines: [
        { speaker: "BDR", text: "Assunto: Seu projeto no [nome do projeto/concurso] + madeira natural" },
        { speaker: "BDR", text: "[Nome], vi o seu trabalho no [projeto específico] e achei admirável como você [detalhe específico do projeto]." },
        { speaker: "BDR", text: "Sou da Parket — há 50+ anos somos o braço de madeira natural dos maiores escritórios de arquitetura do Brasil. Trabalhamos com [listar 2-3 nomes de arquitetos parceiros]." },
        { speaker: "BDR", text: "Temos fábrica própria — a mais moderna da América Latina — e uma curadoria global de madeiras: do Carvalho Europeu ao Ipê, passando por Nogueira Americana e Thermo norueguês." },
        { speaker: "BDR", text: "Adoraria te receber no nosso showroom na Casa Milan para trocarmos ideias sobre como podemos agregar aos seus projetos. Vale um café?" },
      ],
      tips: [
        "PESQUISE o arquiteto antes — elogio genérico é pior que nenhum",
        "Cite nomes de arquitetos parceiros (com permissão) — gera validação",
        "Ofereça VALOR primeiro: amostras, suporte técnico, visita à fábrica",
        "Nunca fale em 'comissão' no primeiro contato — fale em 'parceria'",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 6 — REGRAS DE OURO & MULTICANAL (6 slides)
  // ═══════════════════════════════════════════════════════════════

  // 22. Section
  {
    type: "section",
    props: {
      block: "Bloco 05",
      title: "Regras de\nOuro",
      subtitle: "Os princípios invioláveis que fazem a cadência funcionar. Quebre um e o sistema quebra.",
    },
  },

  // 23. Content — 10 Mandamentos
  {
    type: "content",
    props: {
      title: "Os 10 Mandamentos\nda Cadência",
      label: "Regras Invioláveis",
      items: [
        "1. NUNCA pule um toque — a cadência só funciona completa. Lead não respondeu no D3? Faça o D5 igual",
        "2. Cada toque precisa AGREGAR VALOR — não repita a mesma mensagem. Cada contato é um novo motivo para responder",
        "3. VARIE OS CANAIS — WhatsApp, ligação, e-mail, LinkedIn. Multi-canal aumenta a chance de conexão em 3x",
        "4. RESPEITE OS INTERVALOS — nem muito perto (desesperado) nem muito longe (esquecido). O timing foi calibrado",
        "5. PERSONALIZE SEMPRE — nome do lead, contexto do projeto, bairro, tipo de imóvel. Mensagem genérica = lixo",
        "6. REGISTRE TUDO NO CRM — cada toque, cada resposta, cada silêncio. Sem registro não há processo",
        "7. NUNCA demonstre frustração — silêncio não é afronta, é informação. Mantenha a elegância",
        "8. O break-up NÃO É OPCIONAL — é o toque com maior taxa de resposta. Faça sempre",
        "9. MANHÃ é para ligação (9h-11h), TARDE é para WhatsApp (14h-16h), NOITE é para e-mail (19h-21h)",
        "10. Se o lead responder em QUALQUER etapa — pare a cadência e inicie a conversa. O objetivo é conexão",
      ],
    },
  },

  // 24. Grid — Erros fatais
  {
    type: "grid",
    props: {
      title: "8 Erros Fatais\nque Matam a Cadência",
      label: "O Que NÃO Fazer",
      columns: 2,
      cards: [
        { title: "Ligar só uma vez", description: "Pesquisas mostram que 80% das vendas acontecem após o 5o toque. Uma tentativa = zero resultado.", icon: "X" },
        { title: "Enviar preço logo", description: "Preço sem contexto é sentença de morte. Primeiro construa valor, depois revele investimento.", icon: "X" },
        { title: "Copiar e colar", description: "Mensagem genérica grita 'mass mailing'. Personalização não é opcional, é obrigatória.", icon: "X" },
        { title: "Usar só um canal", description: "Só WhatsApp = invisível por e-mail. Multi-canal é o que torna impossível ignorar.", icon: "X" },
        { title: "Desistir no silêncio", description: "Silêncio NÃO é 'não'. É 'não agora' ou 'não me convenceu'. Continue com inteligência.", icon: "X" },
        { title: "Cobrar resposta", description: "'Você recebeu meu e-mail?' é a pior mensagem possível. Gera culpa, não conexão.", icon: "X" },
        { title: "Não registrar no CRM", description: "Se não registrou, não aconteceu. Sem dados não há melhoria, sem melhoria não há escala.", icon: "X" },
        { title: "Improvisar os toques", description: "Cadência não é sugestão — é um processo industrial. Seguir o script é o que garante resultado.", icon: "X" },
      ],
    },
  },

  // 25. TwoColumn — Multi-canal
  {
    type: "twocolumn",
    props: {
      title: "Estratégia\nMulti-Canal",
      label: "Canal Certo, Hora Certa",
      leftTitle: "Quando Usar Cada Canal",
      leftItems: [
        "WhatsApp: primeiro contato, follow-ups rápidos, fotos de projeto, tom informal",
        "Ligação: agendar visitas, qualificar, conversas complexas, urgência",
        "E-mail: apresentação formal, portfólio, propostas, break-up, documentar",
        "LinkedIn: pesquisa, primeiro contato outbound, conteúdo, relacionamento B2B",
        "Instagram: nutrição de longo prazo, bastidores, projetos entregues",
      ],
      rightTitle: "Regras de Horário",
      rightItems: [
        "Ligação: 9h-11h (melhor) ou 15h-17h (segunda opção). Nunca antes das 9h",
        "WhatsApp: 10h-12h ou 14h-16h. Evite mensagens após 19h",
        "E-mail: 7h-9h (abre ao chegar) ou 19h-21h (abre em casa). Terça e quarta são os melhores dias",
        "LinkedIn: 8h-10h ou 17h-18h. Conteúdo no domingo à noite performa bem",
        "NUNCA: sexta à tarde, sábado, domingo (exceto LinkedIn e e-mail agendado)",
      ],
    },
  },

  // 26. Content — Personalização em escala
  {
    type: "content",
    props: {
      title: "Personalização\nem Escala",
      label: "O Segredo do Volume com Qualidade",
      highlight: "O vendedor médio personaliza quando tem tempo. O vendedor de elite personaliza SEMPRE — porque tem um sistema para isso.",
      items: [
        "Template + Variáveis: cada script tem campos [Nome], [projeto], [bairro], [arquiteto] que DEVEM ser preenchidos",
        "Banco de imagens: organize 20+ fotos de projetos por estilo (clássico, contemporâneo, rústico) para envio rápido",
        "Pesquisa relâmpago: 2 minutos no Instagram/LinkedIn do lead ANTES de ligar. Um detalhe muda tudo",
        "CRM como memória: registre detalhes pessoais (filhos, viagem, obra) para usar nos follow-ups",
        "Regra de ouro: se a mensagem poderia ser para qualquer pessoa, ela não é boa o suficiente",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 7 — DASHBOARD & CONTROLE (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 27. Metrics — Performance
  {
    type: "metrics",
    props: {
      title: "Métricas de\nCadência",
      label: "O Que Medir",
      metrics: [
        { value: "85%", label: "Cadências Completas", description: "Leads que receberam todos os toques previstos" },
        { value: "<5m", label: "Tempo de Resposta", description: "Inbound: primeiro toque em até 5 minutos" },
        { value: "25%", label: "Taxa de Conexão", description: "Leads que responderam em qualquer canal" },
        { value: "40%", label: "Taxa de Agendamento", description: "Dos que responderam, quantos agendaram visita" },
      ],
    },
  },

  // 28. Grid — Checklist diário
  {
    type: "grid",
    props: {
      title: "Checklist Diário\nde Cadência",
      label: "Antes de Fechar o Dia",
      columns: 2,
      cards: [
        { title: "Inbound zerado?", description: "Todo lead inbound do dia recebeu primeiro toque em até 5 min?", icon: "01" },
        { title: "Cadências no dia?", description: "Todos os toques programados para hoje foram executados?", icon: "02" },
        { title: "CRM atualizado?", description: "Cada contato feito está registrado com resultado e próximo passo?", icon: "03" },
        { title: "Amanhã planejado?", description: "Os toques de amanhã já estão com alertas configurados?", icon: "04" },
        { title: "Pipeline revisado?", description: "Leads parados há mais de 48h sem toque foram identificados?", icon: "05" },
        { title: "Personalização OK?", description: "As mensagens de amanhã já estão personalizadas (nome, projeto)?", icon: "06" },
      ],
    },
  },

  // 29. Statement final
  {
    type: "statement",
    props: {
      statement: "Um vendedor disciplinado com um script médio vende mais que um vendedor genial sem processo. Cadência é a diferença entre ter sorte e ter resultado.",
      label: "Princípio",
      attribution: "Máquina de Vendas Parket",
    },
  },

  // 30. Closing
  {
    type: "closing",
    props: {
      title: "Cadências de\nProspecção",
      subtitle: "Execute a cadência.\nConfie no processo.\nOs resultados vêm.",
      image: parketDeckLake,
    },
  },
];
