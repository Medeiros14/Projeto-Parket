import { type SlideData } from "./slides-data";
import parketHerringbone from "figma:asset/b9bdf6119029ab1e402ac73b9a4bf22363cd3ff6.png";
import parketDeckLake from "figma:asset/4d5981327c581648268ef6760447eb46d6931f4c.png";
import parketCurvedShelving from "figma:asset/599bac592a9aaa0e1b24504b427fc642dc39a574.png";
import parketWoodInterior from "figma:asset/e602455ef9adc036da056c804817732f86ab9037.png";
import parketStoneWall from "figma:asset/e709d3507fb615d8e01cdd56b0745f81577f6d89.png";
import parketSpiral from "figma:asset/4a6a8ad24bcda1f844920eb717e3e4d47f57d4d3.png";
import parketCasaMilan from "figma:asset/c5da764965787206bd8e7105fcda0252da4da63b.png";
import parketExterior from "figma:asset/cdcff48de4bfcde365631855c48651aeedb95349.png";

export const onboardingSlides: SlideData[] = [

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 1 — INTRODUÇÃO (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 1. Capa
  {
    type: "cover",
    props: {
      title: "Onboarding &\nRamp-up",
      subtitle: "De zero a vendedor Parket em 90 dias — o sistema de clonagem",
      image: parketSpiral,
    },
  },

  // 2. Statement
  {
    type: "statement",
    props: {
      statement: "Quando o seu melhor vendedor sai e o resultado cai pela metade, o problema nunca foi ele ir embora — foi você nunca ter documentado o que ele fazia de diferente.",
      label: "A Verdade Inconveniente",
      attribution: "Máquina de Vendas Parket",
    },
  },

  // 3. Content — Por que onboarding
  {
    type: "content",
    props: {
      title: "Por Que Um\nOnboarding\nEstruturado?",
      label: "O Sistema de Clonagem",
      highlight: "Uma máquina de vendas que depende de pessoas específicas não é uma máquina — é uma roleta. Onboarding estruturado é o que garante que qualquer novo membro do time chegue ao mesmo nível de performance.",
      items: [
        "Sem onboarding: vendedor leva 6-12 meses para performar. Com: 90 dias",
        "Sem onboarding: cada novo hire aprende de um jeito. Com: todos aprendem o MESMO processo",
        "Sem onboarding: quando alguém sai, leva o conhecimento junto. Com: o conhecimento está no sistema",
        "Sem onboarding: gestor gasta 80% do tempo 'apagando fogo'. Com: gasta tempo escalando",
        "O objetivo: qualquer pessoa com perfil mínimo + este programa = vendedor Parket certificado",
      ],
    },
  },

  // 4. Metrics — Timeline 90 dias
  {
    type: "metrics",
    props: {
      title: "Programa de\n90 Dias",
      label: "As 4 Fases",
      metrics: [
        { value: "S1-S2", label: "Fase 1: Imersão", description: "Cultura, história, produto, fábrica, showroom" },
        { value: "S3-S4", label: "Fase 2: Técnica", description: "Madeiras, acabamentos, processo, concorrência" },
        { value: "S5-S8", label: "Fase 3: Operação", description: "CRM, cadências, shadowing, primeiros leads" },
        { value: "S9-S12", label: "Fase 4: Ramp-up", description: "Leads próprios, mentoria, metas graduais" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 2 — FASE 1: IMERSÃO (5 slides)
  // ═══════════════════════════════════════════════════════════════

  // 5. Section
  {
    type: "section",
    props: {
      block: "Fase 01",
      title: "Imersão\nTotal",
      subtitle: "Semanas 1-2. O novo vendedor precisa respirar Parket antes de falar Parket. Cultura primeiro, técnica depois.",
    },
  },

  // 6. Process — Semana 1
  {
    type: "process",
    props: {
      title: "Semana 1:\nCultura & História",
      label: "Dias 1-5",
      steps: [
        { number: "D1", title: "Dia 1 — Boas-vindas + Visão", description: "Apresentação do time. História da Parket: 50+ anos. Missão, valores, posicionamento. Por que existimos?" },
        { number: "D1", title: "Dia 1 — Tour Completo", description: "Showroom Casa Milan (pisar em cada madeira), escritório, apresentar cada área. Sentir a empresa." },
        { number: "D2", title: "Dia 2 — O Cliente Parket", description: "Quem compra de nós? Perfil do cliente ideal. Cases reais. O que motiva a compra de luxo?" },
        { number: "D3", title: "Dia 3 — Diferenciais (parte 1)", description: "Estudar os 5 primeiros diferenciais do Manual. Prova prática: tocar, sentir, comparar madeiras." },
        { number: "D4", title: "Dia 4 — Diferenciais (parte 2)", description: "Estudar os 5 últimos diferenciais. Quiz oral com gestor. Não decorar — ENTENDER." },
        { number: "D5", title: "Dia 5 — Visita à Fábrica", description: "Dia inteiro na fábrica. Ver cada etapa: seleção, corte, tratamento, acabamento. Trocar com mestres." },
      ],
    },
  },

  // 7. Content — Por que fábrica
  {
    type: "split",
    props: {
      title: "A Visita à\nFábrica Muda Tudo",
      label: "O Divisor de Águas",
      image: parketWoodInterior,
      content: "Todo vendedor que visita a fábrica volta diferente. Quando você VÊ a madeira ser selecionada tábua a tábua, quando SENTE o cheiro, quando CONVERSA com o mestre que faz isso há 30 anos — você nunca mais vende do mesmo jeito.",
      items: [
        "Vendedor que conhece a fábrica fala com AUTORIDADE — não repete discurso, TESTEMUNHA",
        "O cliente sente quando o vendedor está sendo genuíno. E genuinidade vem de experiência real",
        "Tire fotos e vídeos — esse material vira arsenal de vendas para WhatsApp e apresentações",
        "Converse com cada mestre de produção. Pergunte. Entenda. Esse conhecimento é insubstituível",
      ],
    },
  },

  // 8. Process — Semana 2
  {
    type: "process",
    props: {
      title: "Semana 2:\nProduto & Portfólio",
      label: "Dias 6-10",
      steps: [
        { number: "D6", title: "Dia 6 — Catálogo de Madeiras", description: "Estudar cada espécie: Cumaru, Ipê, Carvalho Europeu, Nogueira Americana, Maple, Pinho de Riga, Thermo. Origem, características, aplicações." },
        { number: "D7", title: "Dia 7 — Linhas de Produto", description: "Pisos, painéis, forros, escadas, decks, fachadas, marcenaria. Entender o que compõe uma 'solução completa'." },
        { number: "D8", title: "Dia 8 — Portfólio de Projetos", description: "Estudar 20+ cases de referência. Saber contar a história de cada projeto: quem fez, qual material, qual desafio." },
        { number: "D9", title: "Dia 9 — Concorrência", description: "Mapear principais concorrentes. O que oferecem? Onde são fortes? Onde são fracos? Como nos posicionamos?" },
        { number: "D10", title: "Dia 10 — Quiz + Avaliação", description: "Quiz escrito sobre produto + simulação oral de apresentação para gestor. Nota mínima: 80%." },
      ],
    },
  },

  // 9. Grid — Quiz de Madeiras
  {
    type: "grid",
    props: {
      title: "O Que o Vendedor\nDeve Saber Sobre\nCada Madeira",
      label: "Checklist de Conhecimento",
      columns: 2,
      cards: [
        { title: "Origem", description: "De onde vem? Floresta própria ou importada? Qual país? Isso gera história para contar.", icon: "01" },
        { title: "Características", description: "Cor, dureza, veio, textura. O que torna ela ESPECIAL? Por que alguém pagaria por essa?", icon: "02" },
        { title: "Aplicações", description: "Onde usar? Piso, painel, deck, escada? Em que tipo de projeto ela brilha mais?", icon: "03" },
        { title: "Diferencial Visual", description: "Como ela fica em ambiente real? Ter 2-3 fotos de referência de projetos entregues.", icon: "04" },
        { title: "Comparação", description: "Com qual outra madeira é confundida? Qual a diferença? Como explicar para o leigo?", icon: "05" },
        { title: "História / Curiosidade", description: "Uma história que conecte. 'Essa madeira é usada nos palácios da Itália...' Storytelling vende.", icon: "06" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 3 — FASE 2: TÉCNICA COMERCIAL (5 slides)
  // ═══════════════════════════════════════════════════════════════

  // 10. Section
  {
    type: "section",
    props: {
      block: "Fase 02",
      title: "Técnica\nComercial",
      subtitle: "Semanas 3-4. O vendedor já conhece o produto. Agora aprende COMO vender. Scripts, objeções, processo.",
    },
  },

  // 11. Process — Semana 3
  {
    type: "process",
    props: {
      title: "Semana 3:\nVendas & Scripts",
      label: "Dias 11-15",
      steps: [
        { number: "D11", title: "Dia 11 — Playbook Comercial", description: "Estudar o Playbook inteiro. Entender o posicionamento, a jornada do cliente, o sistema comercial." },
        { number: "D12", title: "Dia 12 — Scripts & Cadências", description: "Estudar todas as cadências (Inbound, Outbound, Indicação, Arquiteto). Praticar os scripts em voz alta." },
        { number: "D13", title: "Dia 13 — Mapa de Objeções", description: "Estudar as 6 categorias de objeção. Ensaiar cada resposta. Role play com colega: um faz de cliente." },
        { number: "D14", title: "Dia 14 — Simulação SDR", description: "3 simulações: cold call, WhatsApp inbound, qualificação. Gestor avalia e dá feedback ao vivo." },
        { number: "D15", title: "Dia 15 — Simulação Closer", description: "2 simulações: reunião consultiva e negociação com objeção. Feedback detalhado." },
      ],
    },
  },

  // 12. Content — Role Play
  {
    type: "content",
    props: {
      title: "Role Play:\nO Treino que\nMuda o Jogo",
      label: "Prática Deliberada",
      highlight: "Nenhum atleta entra em campo sem treinar. Nenhum piloto voa sem simulador. Nenhum vendedor deveria falar com cliente sem ter praticado antes.",
      items: [
        "Frequência: mínimo 2x por semana durante o onboarding. 1x por semana depois — para sempre",
        "Formato: dois vendedores + gestor. Um faz de cliente, outro vende. Gestor avalia e intervém",
        "Cenários: cold call que não quer falar, lead que compara com porcelanato, cliente que pede desconto, arquiteto que usa outra marca",
        "Gravação: gravar as simulações (com consentimento) para auto-avaliação. Ouvir a si mesmo é revelador",
        "Feedback: imediato, específico, construtivo. Não 'foi bom'. Sim: 'No minuto 2, quando ele disse preço, você hesitou. Tente X.'",
        "Evolução: cada role play deve ser mais difícil que o anterior. Aumentar a pressão gradualmente",
        "Regra: role play é sagrado. Não se cancela. Não se adia. É tão importante quanto reunião com cliente",
      ],
    },
  },

  // 13. Process — Semana 4
  {
    type: "process",
    props: {
      title: "Semana 4:\nCRM & Ferramentas",
      label: "Dias 16-20",
      steps: [
        { number: "D16", title: "Dia 16 — CRM na prática", description: "Tutorial hands-on do CRM. Criar leads fictícios, mover pelo pipeline, registrar atividades. Prática, não teoria." },
        { number: "D17", title: "Dia 17 — Ferramentas de vendas", description: "E-mail profissional, WhatsApp Business, LinkedIn Sales Navigator, templates, portfólio digital." },
        { number: "D18", title: "Dia 18 — Métricas & Rotinas", description: "Estudar o documento de Funil, Métricas & Rotinas. Entender cada KPI que será cobrado." },
        { number: "D19", title: "Dia 19 — Daily Standup (observar)", description: "Participar do daily standup do time como observador. Entender a dinâmica, o ritmo, a cultura." },
        { number: "D20", title: "Dia 20 — Avaliação Fase 2", description: "Avaliação escrita + role play avaliado pelo gestor. Nota mínima: 85%. Se não passar: 1 semana extra." },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 4 — FASE 3: OPERAÇÃO (5 slides)
  // ═══════════════════════════════════════════════════════════════

  // 14. Section
  {
    type: "section",
    props: {
      block: "Fase 03",
      title: "Operação\nAssistida",
      subtitle: "Semanas 5-8. O vendedor começa a operar com rede de segurança. Shadowing, leads assistidos, feedback diário.",
    },
  },

  // 15. Process — Shadowing
  {
    type: "process",
    props: {
      title: "Semana 5-6:\nShadowing Intensivo",
      label: "Aprender Observando",
      steps: [
        { number: "01", title: "Acompanhar SDR sênior", description: "2 dias ouvindo ligações, lendo WhatsApps, observando cadências em tempo real. Sem interferir — apenas absorver." },
        { number: "02", title: "Acompanhar Closer sênior", description: "2 dias em reuniões de showroom, calls com cliente, apresentações de proposta. Ver como o top performer faz." },
        { number: "03", title: "Acompanhar instalação", description: "1 dia com equipe de instalação em obra. Ver o produto sendo entregue. Entender prazos, desafios, qualidade." },
        { number: "04", title: "Debrief diário com mentor", description: "Final de cada dia: 30 min com mentor. O que viu? O que aprendeu? O que faria diferente?" },
        { number: "05", title: "Primeiros leads assistidos", description: "Recebe 5-10 leads reais mas atende COM o mentor ao lado. Mentor ouve, anota, dá feedback depois." },
      ],
    },
  },

  // 16. Content — Mentor
  {
    type: "content",
    props: {
      title: "O Papel\ndo Mentor",
      label: "O Acelerador de Performance",
      highlight: "Todo novo vendedor precisa de um mentor designado — alguém do time que é responsável por acelerar a curva de aprendizado e prevenir erros evitáveis.",
      items: [
        "Quem: vendedor sênior com performance consistente e disposição para ensinar. NÃO é o gestor",
        "Dedicação: 30-60 minutos por dia durante as 8 primeiras semanas. Debrief, feedback, simulações",
        "O que faz: ouve ligações, revisa e-mails antes de enviar, acompanha em reuniões, responde dúvidas",
        "O que NÃO faz: não faz o trabalho do novo vendedor. Orienta, não executa",
        "Incentivo: mentor que forma um vendedor que bate meta no mês 3 recebe bônus. Formar é mérito",
        "Troca de mentor: se a química não funcionar em 2 semanas, trocar. Sem drama",
        "Documentação: mentor registra evolução semanal do mentorado em formulário padrão",
      ],
    },
  },

  // 17. Process — Semana 7-8
  {
    type: "process",
    props: {
      title: "Semana 7-8:\nOperação Semi-Autônoma",
      label: "Com Rede de Segurança",
      steps: [
        { number: "01", title: "Carteira própria (parcial)", description: "Recebe 50% da carteira normal de leads. Atende sozinho, mas mentor revisa CRM diariamente." },
        { number: "02", title: "Cadências independentes", description: "Executa todas as cadências por conta própria. Mentor audita 20% dos toques aleatoriamente." },
        { number: "03", title: "Primeira proposta", description: "Prepara proposta com supervisão do Closer sênior. Apresenta ao cliente com apoio." },
        { number: "04", title: "Daily standup ativo", description: "Participa do standup dando update real da sua carteira. Já é parte do time." },
        { number: "05", title: "Avaliação Fase 3", description: "Gestor + mentor avaliam: CRM compliance, qualidade das cadências, performance nos leads, postura." },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 5 — FASE 4: RAMP-UP (5 slides)
  // ═══════════════════════════════════════════════════════════════

  // 18. Section
  {
    type: "section",
    props: {
      block: "Fase 04",
      title: "Ramp-up\nAcelerado",
      subtitle: "Semanas 9-12. Carteira cheia, metas graduais, mentoria semanal. O objetivo: bater meta no mês 3.",
    },
  },

  // 19. Content — Metas graduais
  {
    type: "content",
    props: {
      title: "Metas Graduais\nde Ramp-up",
      label: "Crescimento Controlado",
      highlight: "Cobrar meta cheia no primeiro mês é burrice gerencial. Metas graduais constroem confiança, competência e resultado sustentável.",
      items: [
        "Mês 1 (semanas 1-4): meta = 0%. Foco em aprender. Qualquer venda é bônus, não obrigação",
        "Mês 2 (semanas 5-8): meta = 40% da meta plena. Leads assistidos + primeiros leads próprios",
        "Mês 3 (semanas 9-12): meta = 70% da meta plena. Carteira cheia, operação autônoma",
        "Mês 4+: meta = 100%. Vendedor certificado. Performance é cobrada integralmente",
        "Se não atingir 70% no mês 3: extensão de 30 dias com plano de ação específico",
        "Se não atingir 70% no mês 4: reavaliar fit para a posição. Sem drama, mas com honestidade",
      ],
    },
  },

  // 20. Metrics — Marcos de performance
  {
    type: "metrics",
    props: {
      title: "Marcos de\nPerformance",
      label: "Checkpoints do Ramp-up",
      metrics: [
        { value: "D5", label: "Primeira visita fábrica", description: "Conheceu a produção, tocou nas madeiras" },
        { value: "D10", label: "Quiz produto 80%+", description: "Conhece espécies, linhas e diferenciais" },
        { value: "D15", label: "Role play aprovado", description: "Simulou SDR e Closer com nota 85%+" },
        { value: "D30", label: "Primeiro lead atendido", description: "Com mentor, mas conduziu a conversa" },
        { value: "D60", label: "Primeira proposta", description: "Preparou e apresentou proposta real" },
        { value: "D90", label: "Certificação completa", description: "Aprovado em todas as competências" },
      ],
    },
  },

  // 21. Content — Mentoria semanal
  {
    type: "content",
    props: {
      title: "Mentoria Semanal\nno Ramp-up",
      label: "Semanas 9-12",
      highlight: "No ramp-up, a mentoria muda de diária para semanal. O vendedor já opera sozinho, mas tem suporte estruturado para não descarrilar.",
      items: [
        "1:1 semanal com mentor (30 min): revisar pipeline, discutir deals difíceis, praticar objeções",
        "Auditoria de CRM: mentor verifica 10% dos registros. Compliance abaixo de 90% = flag",
        "Escuta de ligação: mentor ouve 2 ligações por semana (gravadas) e dá feedback detalhado",
        "Role play semanal: com o time todo, cenário cada vez mais complexo. O novo vendedor participa sempre",
        "Pipeline review: gestor inclui o novo vendedor na review semanal a partir da semana 9",
        "Feedback bidirecional: o novo vendedor também dá feedback sobre o processo. Olho fresco vê coisas que o time não vê",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 6 — CERTIFICAÇÃO (6 slides)
  // ═══════════════════════════════════════════════════════════════

  // 22. Section
  {
    type: "section",
    props: {
      block: "Fase Final",
      title: "Certificação\nParket",
      subtitle: "No dia 90, o vendedor passa por avaliação completa. Aprovação = certificação. Sem atalhos.",
    },
  },

  // 23. Process — Checklist de certificação
  {
    type: "process",
    props: {
      title: "Avaliação de\nCertificação",
      label: "O Exame Final",
      steps: [
        { number: "01", title: "Prova escrita — Produto (60 min)", description: "Espécies, características, aplicações, diferenciais. 40 questões. Nota mínima: 85%." },
        { number: "02", title: "Prova escrita — Processo (30 min)", description: "Cadências, funil, CRM, métricas, rotinas. 20 questões. Nota mínima: 85%." },
        { number: "03", title: "Role play — SDR (20 min)", description: "Simulação de cold call + qualificação. Avaliado por gestor + vendedor sênior." },
        { number: "04", title: "Role play — Closer (30 min)", description: "Simulação de reunião consultiva + tratamento de objeção complexa." },
        { number: "05", title: "Apresentação de case (15 min)", description: "Apresentar um caso real que conduziu durante o ramp-up. O que fez, o que aprendeu, resultado." },
        { number: "06", title: "Avaliação do mentor", description: "Parecer escrito do mentor sobre: postura, disciplina, evolução, pontos de atenção." },
      ],
    },
  },

  // 24. Grid — Competências avaliadas
  {
    type: "grid",
    props: {
      title: "8 Competências\nAvaliadas",
      label: "O Que Define um Vendedor Parket",
      columns: 2,
      cards: [
        { title: "Conhecimento de Produto", description: "Sabe explicar cada madeira, cada linha, cada diferencial com profundidade e paixão.", icon: "01" },
        { title: "Domínio do Processo", description: "Executa cadências, usa CRM, segue rotinas e conhece cada etapa do funil.", icon: "02" },
        { title: "Habilidade Consultiva", description: "Faz perguntas inteligentes, ouve mais do que fala, posiciona solução — não empurra produto.", icon: "03" },
        { title: "Tratamento de Objeções", description: "Recebe objeção com calma, valida o sentimento, reposiciona com argumentos e provas.", icon: "04" },
        { title: "Comunicação Escrita", description: "E-mails profissionais, WhatsApp adequado, propostas claras. Sem erro de português.", icon: "05" },
        { title: "Disciplina & Rotina", description: "Pontual no daily, CRM em dia, cadências completas. Processo antes de improviso.", icon: "06" },
        { title: "Postura Premium", description: "Representa a marca com elegância. Tom de voz, aparência, linguagem — tudo comunica luxo.", icon: "07" },
        { title: "Resiliência", description: "Lida com rejeição sem desanimar. Entende que 'não' é parte do processo. Segue em frente.", icon: "08" },
      ],
    },
  },

  // 25. TwoColumn — Aprovado vs. Reprovado
  {
    type: "twocolumn",
    props: {
      title: "Resultado da\nCertificação",
      label: "Sem Meio-Termo",
      leftTitle: "Aprovado (85%+)",
      leftItems: [
        "Recebe certificação oficial de Vendedor Parket",
        "Carteira 100% com meta plena a partir do próximo mês",
        "Acesso completo a todas as ferramentas e autonomia de proposta",
        "Reconhecimento público no time — celebrar conquistas importa",
        "Acompanhamento trimestral de evolução pelo gestor",
        "Elegível para mentorear futuros novos vendedores (após 6 meses)",
      ],
      rightTitle: "Não Aprovado (<85%)",
      rightItems: [
        "Extensão de 30 dias com plano de ação específico",
        "Mentor reforçado — mais horas de acompanhamento",
        "Foco nas competências abaixo da nota (não refaz tudo)",
        "Nova avaliação no dia 120. Se aprovado: segue normalmente",
        "Se reprovado novamente: conversa honesta sobre fit para a posição",
        "Sem julgamento — nem todo perfil se encaixa. Melhor descobrir cedo",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 7 — SISTEMA DE MELHORIA CONTÍNUA (4 slides)
  // ═══════════════════════════════════════════════════════════════

  // 26. Section
  {
    type: "section",
    props: {
      block: "Pós-Certificação",
      title: "Melhoria\nContínua",
      subtitle: "Certificação não é o fim — é o começo. O vendedor Parket nunca para de evoluir.",
    },
  },

  // 27. Content — Treinamento contínuo
  {
    type: "content",
    props: {
      title: "Programa de\nEvolução Permanente",
      label: "Depois do Dia 90",
      highlight: "As melhores empresas do mundo não treinam só no onboarding. Treinam SEMPRE. O dia que o vendedor para de evoluir é o dia que começa a regredir.",
      items: [
        "Role play semanal: toda quinta, 1 hora. Cenários rotativos. Todo mundo participa — do júnior ao sênior",
        "Treinamento mensal: tema definido pelos dados do mês anterior. Se Win Rate caiu → foco em negociação",
        "Escuta de ligação (peer review): cada vendedor ouve 1 ligação de um colega por semana e dá feedback",
        "Book club: 1 livro de vendas por trimestre. Discussão em grupo. Conhecimento compartilhado",
        "Workshop de produto: quando nova linha/espécie entra no catálogo, todos treinam antes de vender",
        "Shadowing reverso: vendedor sênior acompanha júnior 1x por mês. Feedback bidirecional",
        "Hackathon de vendas: trimestral. Desafio prático com premiação. Competição saudável gera evolução",
      ],
    },
  },

  // 28. Grid — Documentos do arsenal
  {
    type: "grid",
    props: {
      title: "O Arsenal\nCompleto",
      label: "8 Documentos que Formam o Sistema",
      columns: 2,
      cards: [
        { title: "Playbook Comercial", description: "Visão estratégica: posicionamento, jornada, sistema, cultura. O 'porquê'.", icon: "01" },
        { title: "Manual Prático", description: "Guia operacional: scripts, fluxos, rotinas, templates. O 'como'.", icon: "02" },
        { title: "Manual de Diferenciais", description: "Os 10 diferenciais em profundidade. O 'o quê' da Parket.", icon: "03" },
        { title: "Mapa de Objeções", description: "Toda objeção mapeada com resposta. O 'escudo'.", icon: "04" },
        { title: "Scripts de Reengajamento", description: "O que fazer quando o lead para. A 'recuperação'.", icon: "05" },
        { title: "Cadências de Prospecção", description: "Sequências dia-a-dia para cada tipo de lead. O 'motor'.", icon: "06" },
        { title: "Funil, Métricas & Rotinas", description: "O painel de controle: KPIs, rituais, forecast. O 'GPS'.", icon: "07" },
        { title: "Onboarding & Ramp-up", description: "De zero a certificado em 90 dias. O 'sistema de clonagem'.", icon: "08" },
      ],
    },
  },

  // 29. Statement final
  {
    type: "statement",
    props: {
      statement: "Uma empresa que depende de heróis para vender é frágil. Uma empresa que tem um sistema que transforma qualquer pessoa dedicada num vendedor de elite — essa é antifrágil. Esse é o objetivo.",
      label: "O Objetivo Final",
      attribution: "Máquina de Vendas Parket",
    },
  },

  // 30. Closing
  {
    type: "closing",
    props: {
      title: "Onboarding &\nRamp-up",
      subtitle: "Documente o processo.\nClone os melhores.\nEscale o resultado.",
      image: parketDeckLake,
    },
  },
];
