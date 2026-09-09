import { type SlideData } from "./slides-data";
import parketLogo from "figma:asset/ea944c52b88c841ea9c822abd0b2ed2bddf425e6.png";
import parketHerringbone from "figma:asset/b9bdf6119029ab1e402ac73b9a4bf22363cd3ff6.png";
import parketDeckLake from "figma:asset/4d5981327c581648268ef6760447eb46d6931f4c.png";
import parketCurvedShelving from "figma:asset/599bac592a9aaa0e1b24504b427fc642dc39a574.png";
import parketWoodInterior from "figma:asset/e602455ef9adc036da056c804817732f86ab9037.png";

export const reengajamentoSlides: SlideData[] = [

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 1 — INTRODUÇÃO (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 1. Capa
  {
    type: "cover",
    props: {
      title: "Scripts de\nReengajamento",
      subtitle: "O que fazer quando o lead para de responder",
      image: parketCurvedShelving,
    },
  },

  // 2. Statement
  {
    type: "statement",
    props: {
      statement: "Silêncio não é 'não'. É 'não agora' ou 'não me convenceu o suficiente'. Cada mensagem de reengajamento é uma nova chance — se feita com inteligência e elegância.",
      label: "Filosofia do Reengajamento",
      attribution: "Treinamento Comercial Parket",
    },
  },

  // 3. Por que leads param de responder
  {
    type: "grid",
    props: {
      title: "Por Que o Lead\nPara de Responder",
      label: "Diagnóstico",
      columns: 2,
      cards: [
        { title: "Está ocupado", description: "A vida corrida tomou conta. O projeto não é prioridade no momento. Não é rejeição — é timing.", icon: "01" },
        { title: "Perdeu o interesse", description: "A urgência esfriou. O projeto foi adiado ou o entusiasmo diminuiu. Precisa de novo estímulo.", icon: "02" },
        { title: "Encontrou alternativa", description: "Está conversando com concorrente ou optou por outro material. Precisa ser reconquistado.", icon: "03" },
        { title: "Falta de decisão", description: "Não conseguiu alinhar com cônjuge, arquiteto ou outros decisores. Está travado.", icon: "04" },
        { title: "Preço assustou", description: "A proposta ficou acima do esperado e ele não sabe como voltar ao assunto. Precisa de abertura.", icon: "05" },
        { title: "Esqueceu", description: "Simples assim. Recebeu centenas de mensagens depois da sua e a conversa ficou soterrada.", icon: "06" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 2 — CADÊNCIA GERAL DE REENGAJAMENTO (2 slides)
  // ═══════════════════════════════════════════════════════════════

  // 4. Regras da cadência
  {
    type: "content",
    props: {
      title: "Regras de Ouro do\nReengajamento",
      label: "Princípios",
      highlight: "Reengajar não é perseguir. É reaparecer com valor no momento certo, pelo canal certo, com a mensagem certa.",
      items: [
        "Máximo 5 tentativas de reengajamento antes de mover para nurturing passivo",
        "Espaçamento crescente: D+3, D+7, D+14, D+21, D+30. Nunca mensagens diárias",
        "Cada tentativa precisa ter um GANCHO NOVO: case, novidade, evento, urgência real",
        "Nunca repita a mesma mensagem. Se a primeira não funcionou, a segunda precisa ser diferente",
        "Alterne canais: WhatsApp → E-mail → Ligação → WhatsApp. Varie o formato",
        "Tom sempre respeitoso e leve. Zero cobrança, zero culpa, zero 'por que não respondeu?'",
        "Se após 5 tentativas não responder, respeite. Mova para nurturing de 90 dias",
        "Registre TUDO no CRM: data, canal, mensagem, status. Inteligência para o time todo",
      ],
    },
  },

  // 5. Cadência visual
  {
    type: "process",
    props: {
      title: "Cadência de\nReengajamento",
      label: "Fluxo Completo",
      steps: [
        { number: "D+3", title: "Check-in suave (WhatsApp)", description: "Tom: 'Vi que não conseguimos conectar. Tudo bem? Fico à disposição.' Leve, sem pressão." },
        { number: "D+7", title: "Conteúdo de valor (E-mail)", description: "Envie case novo, foto de projeto similar ou notícia do setor. Gancho: 'lembrei de você quando vi isso.'" },
        { number: "D+14", title: "Urgência real (WhatsApp)", description: "Estoque limitado, agenda lotando, novidade de produto. Algo concreto e verdadeiro." },
        { number: "D+21", title: "Ligação pessoal (Telefone)", description: "Ligue. Voz humana é mais poderosa que texto. Se não atender, deixe mensagem de voz curta e genuína." },
        { number: "D+30", title: "Última tentativa (WhatsApp)", description: "Mensagem de encerramento elegante. 'Se o timing mudou, sem problema. Estarei aqui quando fizer sentido.'" },
        { number: "D+90", title: "Nurturing (E-mail)", description: "Entram em fluxo de nurturing automático: newsletter, convites, lançamentos. Sem contato direto." },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 3 — PÓS PRIMEIRO CONTATO (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 6. Seção
  {
    type: "section",
    props: {
      block: "Cenário 01",
      title: "Pós Primeiro\nContato",
      subtitle: "O lead respondeu inicialmente mas sumiu antes de agendar visita ou avançar.",
    },
  },

  // 7. Scripts WhatsApp
  {
    type: "script",
    props: {
      title: "WhatsApp: Pós\nPrimeiro Contato",
      label: "Cenário 01 — Scripts",
      context: "O lead conversou inicialmente (por telefone, WhatsApp ou e-mail) mas parou de responder.",
      lines: [
        { speaker: "SDR", text: "[D+3] Olá, [Nome]! Tudo bem? Faz uns dias que conversamos sobre o projeto de madeira. Sei como a rotina é corrida! Se tiver qualquer dúvida, é só me chamar. Enquanto isso, olha esse projeto que acabamos de entregar — lembrei das referências que você mencionou. [Foto]" },
        { speaker: "SDR", text: "[D+7] [Nome], bom dia! Passando para compartilhar algo que pode te interessar: estamos com uma partida especial de [espécie] que raramente aparece nessa qualidade. Montei um material rápido — posso enviar? Sem compromisso." },
        { speaker: "SDR", text: "[D+14] Oi [Nome]! Queria te convidar para conhecer nosso showroom na Casa Milan — a residência do Paulo Mendes da Rocha. Mesmo que o projeto não esteja no timing agora, a visita vale muito a pena pela experiência. Posso agendar?" },
        { speaker: "SDR", text: "[D+21] [Nome], espero que esteja tudo bem! Não quero ser inconveniente — só queria saber se o projeto de madeira ainda está nos planos ou se mudou de direção. Independente, estou à disposição sempre que precisar." },
        { speaker: "SDR", text: "[D+30] [Nome], passando para dizer que nosso canal fica sempre aberto. Se em algum momento o projeto avançar, será uma honra ajudar. Desejo tudo de melhor no projeto da casa! Abraço, [Seu Nome] — Parket." },
      ],
      tips: [
        "D+3: tom leve + conteúdo visual (foto de projeto). Zero cobrança",
        "D+7: gancho de novidade/exclusividade. Gera curiosidade",
        "D+14: convite para experiência. Muda o frame de 'venda' para 'vivência'",
        "D+21: pergunta direta e honesta. Respeita o tempo do lead",
        "D+30: encerramento elegante. Deixa a porta aberta sem pressão",
      ],
    },
  },

  // 8. Scripts E-mail
  {
    type: "content",
    props: {
      title: "E-mail: Pós\nPrimeiro Contato",
      label: "Cenário 01 — Templates E-mail",
      items: [
        "[D+7] Assunto: 'Um projeto que lembrou o seu'. Corpo: 'Olá [Nome], acabamos de entregar um projeto que me lembrou o que conversamos — [breve descrição]. Anexo foto. Se quiser saber mais sobre o processo, estou aqui.'",
        "[D+14] Assunto: 'Convite especial — Casa Milan'. Corpo: 'Nosso showroom funciona na residência icônica de Paulo Mendes da Rocha. Gostaria de convidá-lo(a) para uma visita sem compromisso — é uma experiência que vale por si só.'",
        "[D+21] Assunto: 'Novidade: [espécie de madeira]'. Corpo: 'Recebemos uma partida exclusiva de [madeira] com características raras. Lembrei do seu projeto. Disponibilidade limitada — posso reservar amostras?'",
        "Regra: e-mails de reengajamento devem ser CURTOS (3-4 linhas no corpo), com assunto que gere curiosidade, e SEMPRE com conteúdo de valor (foto, case, novidade)",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 4 — PÓS VISITA AO SHOWROOM (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 9. Seção
  {
    type: "section",
    props: {
      block: "Cenário 02",
      title: "Pós Visita ao\nShowroom",
      subtitle: "O lead visitou o showroom, gostou, mas sumiu antes de receber ou responder à proposta.",
    },
  },

  // 10. Scripts WhatsApp pós-showroom
  {
    type: "script",
    props: {
      title: "WhatsApp: Pós\nVisita ao Showroom",
      label: "Cenário 02 — Scripts",
      context: "O lead visitou a Casa Milan, demonstrou interesse, mas parou de responder após a visita.",
      lines: [
        { speaker: "Closer", text: "[D+3] [Nome], tudo bem? Queria saber como está a reflexão sobre o projeto. As madeiras que você escolheu — [espécie] — ficaram realmente incríveis naquele ambiente do showroom. Se surgiu alguma dúvida, estou aqui!" },
        { speaker: "Closer", text: "[D+7] Olá [Nome]! Acabamos de entregar um projeto com a mesma [espécie] que você escolheu. O resultado ficou espetacular — olha essa foto! [Foto]. Imaginando isso no seu espaço de [metragem]m²... Posso preparar a proposta detalhada?" },
        { speaker: "Closer", text: "[D+14] [Nome], bom dia! Queria te avisar que a partida de [espécie] que vimos juntos no showroom é limitada — e está com procura alta. Se quiser garantir para seu projeto, precisamos reservar em breve. Posso verificar a disponibilidade atual?" },
        { speaker: "Closer", text: "[D+21] [Nome], espero que esteja tudo bem! Estou ligando [ou enviando áudio] porque acho mais pessoal que texto. Queria saber: o projeto segue firme? Há algo que eu possa fazer para ajudar na decisão? Sem pressão — genuinamente quero ajudar." },
        { speaker: "Closer", text: "[D+30] [Nome], sei que a decisão envolve muitas variáveis e respeito muito seu tempo. Vou guardar todas as informações do seu projeto no nosso sistema para quando o timing estiver certo. É só me chamar. Abraço!" },
      ],
      tips: [
        "O lead já visitou — ele conhece e gostou. Use REFERÊNCIAS ESPECÍFICAS da visita",
        "Mencione exatamente a madeira que ele escolheu, o ambiente que elogiou, o que comentou",
        "Foto de projeto similar é a ferramenta mais poderosa nesta fase",
        "A urgência de estoque é REAL e deve ser usada com honestidade",
        "No D+21, prefira ÁUDIO ou LIGAÇÃO. A voz cria conexão que texto não consegue",
      ],
    },
  },

  // 11. Script ligação pós-showroom
  {
    type: "script",
    props: {
      title: "Ligação: Pós\nVisita ao Showroom",
      label: "Cenário 02 — Telefone",
      context: "Ligação de follow-up quando o lead não responde mensagens após a visita.",
      lines: [
        { speaker: "Closer", text: "Olá [Nome], aqui é [Seu Nome] da Parket! Tudo bem? Estou ligando porque percebi que não conseguimos nos conectar por mensagem e preferi ligar — acho mais pessoal." },
        { speaker: "Lead", text: "Oi! Desculpa, estou numa correria..." },
        { speaker: "Closer", text: "Imagino! Sei como é. Vou ser breve: queria saber se o projeto de madeira segue nos planos e se posso ajudar em algo. Desde a visita, guardei as referências que vocês escolheram." },
        { speaker: "Lead", text: "Sim, segue. Mas estamos decidindo entre vocês e outra opção." },
        { speaker: "Closer", text: "Entendo perfeitamente. Comparar faz parte. Posso te ajudar com alguma informação adicional? Também posso preparar um comparativo técnico que facilite a análise lado a lado." },
        { speaker: "Lead", text: "Pode mandar sim." },
        { speaker: "Closer", text: "Mando hoje. E um detalhe: a [espécie] que vocês escolheram — temos uma partida pronta que garante uniformidade de tom para o projeto todo. Se demorar muito, a próxima partida pode ter tom diferente. Fica a informação." },
      ],
      tips: [
        "Ligação é mais eficaz que WhatsApp quando o lead para de responder por texto",
        "Tom: genuíno, curioso, prestativo. Zero cobrança",
        "Se descobrir que está comparando com concorrente, ofereça comparativo técnico",
        "A informação de partida/estoque limitado é ferramenta de urgência legítima",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 5 — PÓS ENVIO DE PROPOSTA (4 slides)
  // ═══════════════════════════════════════════════════════════════

  // 12. Seção
  {
    type: "section",
    props: {
      block: "Cenário 03",
      title: "Pós Envio de\nProposta",
      subtitle: "O lead recebeu a proposta e não respondeu — o momento mais crítico do funil.",
    },
  },

  // 13. Scripts WhatsApp
  {
    type: "script",
    props: {
      title: "WhatsApp: Pós\nEnvio de Proposta",
      label: "Cenário 03 — Scripts",
      context: "A proposta foi enviada, o lead visualizou mas não respondeu.",
      lines: [
        { speaker: "Closer", text: "[D+3] [Nome], bom dia! Conseguiu analisar a proposta que enviei? Se preferir, posso agendar uma call rápida de 15 minutos para percorrermos juntos e tirar qualquer dúvida. Que dia funciona?" },
        { speaker: "Closer", text: "[D+7] [Nome], olha esse antes e depois de um projeto que entregamos recentemente — [espécie] em [metragem]m², muito parecido com o que propusemos para você. [Foto antes/depois]. O resultado fala por si. Se quiser ajustar algo na proposta, é só me dizer!" },
        { speaker: "Closer", text: "[D+14] [Nome], queria te avisar sobre algo importante: nossa agenda de instalação para os próximos 2 meses está quase lotada. Se fecharmos até [data], consigo encaixar seu projeto no cronograma ideal. Após essa data, o prazo pode estender em 3-4 semanas." },
        { speaker: "Closer", text: "[D+21] [Nome], sei que decisões assim envolvem vários fatores. Posso fazer algo para facilitar? Ajustar condição de pagamento? Revisar o escopo? Propor um faseamento? Me diz o que ajudaria e eu trabalho para viabilizar." },
        { speaker: "Closer", text: "[D+30] [Nome], respeito muito seu tempo de decisão. Vou manter sua proposta válida por mais 15 dias — após esse período, talvez precise recalcular por variações de custo. Se quiser retomar, é só me chamar. Abraço!" },
      ],
      tips: [
        "D+3: ofereça CALL para apresentar proposta — muitos não leem PDFs",
        "D+7: antes/depois é a arma nuclear de conversão. Use sempre que tiver",
        "D+14: urgência de AGENDA é mais crível que urgência de estoque",
        "D+21: abra negociação proativamente — se ele está quieto, talvez precise de ajuda",
        "D+30: validade da proposta gera escassez temporal legítima",
      ],
    },
  },

  // 14. Script: E-mail de reengajamento pós-proposta
  {
    type: "content",
    props: {
      title: "E-mail: Pós\nEnvio de Proposta",
      label: "Cenário 03 — Templates E-mail",
      items: [
        "[D+3] Assunto: 'Sua proposta — posso apresentar?'. Corpo: '[Nome], enviei a proposta na [data]. Muitos clientes preferem que eu apresente pessoalmente — posso agendar 15min para percorrermos juntos?'",
        "[D+7] Assunto: 'Resultado: [espécie] em projeto de [m²]'. Corpo: foto de projeto similar entregue recentemente. 'A [espécie] que escolhemos para você ficou assim em um projeto parecido. O seu tem tudo para ficar ainda melhor.'",
        "[D+14] Assunto: 'Importante: agenda de instalação'. Corpo: 'Nossa equipe de instalação está com agenda preenchendo rápido. Para garantir a melhor janela de execução, precisaríamos confirmar até [data]. Posso ajudar?'",
        "[D+30] Assunto: 'Validade da proposta: [Nome do Projeto]'. Corpo: 'A proposta tem validade até [data]. Após esse período, poderemos ter ajustes em valores por variações de mercado. Gostaria de conversar antes que expire?'",
        "Dica: todo e-mail de reengajamento pós-proposta deve ter assunto urgente e corpo curto (max 4 linhas).",
      ],
    },
  },

  // 15. Script: Áudio WhatsApp pós-proposta
  {
    type: "content",
    props: {
      title: "Áudios de WhatsApp:\nPós Proposta",
      label: "Cenário 03 — Áudios",
      highlight: "Áudios curtos (20-40s) são extremamente eficazes quando textos não funcionam. O tom de voz cria conexão humana. Use nos momentos D+7 e D+21.",
      items: [
        "[D+7 — Áudio 1] 'Oi [Nome], aqui é [Seu Nome] da Parket! Tô mandando áudio porque acho mais pessoal. Queria saber como tá a análise da proposta — se surgiu alguma dúvida, tô aqui pra ajudar. E olha, acabou de sair uma foto de um projeto com a [madeira] que você escolheu, vou mandar aqui em seguida. Fica incrível! Abraço!'",
        "[D+21 — Áudio 2] '[Nome], aqui é [Seu Nome]. Sei que a decisão envolve muita coisa e respeito seu tempo. Só queria dizer que se tiver qualquer questão — valor, prazo, pagamento — a gente pode conversar e achar o melhor caminho. Não quero que nada fique sem solução. Me chama quando puder. Abraço!'",
        "Regras para áudios: máximo 40 segundos. Tom genuíno e caloroso. Nunca cobranças. Sempre finalize com 'estou à disposição'. Sorria ao gravar — o sorriso transparece na voz.",
        "Quando NÃO usar áudio: primeiro contato (use texto), leads corporativos/formais, após lead pedir para parar o contato",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 6 — PÓS NEGOCIAÇÃO TRAVADA (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 16. Seção
  {
    type: "section",
    props: {
      block: "Cenário 04",
      title: "Negociação\nTravada",
      subtitle: "O lead negociou, pediu desconto ou condições, mas sumiu sem fechar.",
    },
  },

  // 17. Scripts para negociação travada
  {
    type: "script",
    props: {
      title: "WhatsApp: Negociação\nTravada",
      label: "Cenário 04 — Scripts",
      context: "O lead estava em negociação ativa (discutiu preço, pediu condições) mas parou de responder.",
      lines: [
        { speaker: "Closer", text: "[D+3] [Nome], tudo bem? Fiquei pensando na nossa conversa sobre o projeto. Consegui verificar uma alternativa de pagamento que pode fazer sentido: [descrever brevemente]. Posso detalhar?" },
        { speaker: "Closer", text: "[D+7] [Nome], bom dia! Lembrei que você mencionou preocupação com [objeção específica]. Conversei com a equipe técnica e tenho uma solução que pode resolver isso. Posso te ligar 5 minutos para explicar?" },
        { speaker: "Closer", text: "[D+14] [Nome], queria compartilhar algo: um cliente que tinha a mesma preocupação que você ([objeção]) fechou conosco há 6 meses. Aqui está o resultado: [Foto]. Ele me disse que foi a melhor decisão. Posso conectar vocês se quiser conversar?" },
        { speaker: "Closer", text: "[D+21] [Nome], vou ser direto e sincero: sinto que talvez haja algo que eu não esteja enxergando. Se for preço, podemos falar sobre faseamento. Se for dúvida técnica, posso enviar nosso engenheiro. Se mudou de ideia, respeito 100%. Me ajuda a entender?" },
        { speaker: "Closer", text: "[D+30] [Nome], foi um prazer enorme te atender e conhecer o projeto. Se em algum momento quiser retomar, estarei aqui. As portas do showroom estão sempre abertas. Desejo sucesso no projeto! Abraço, [Nome]." },
      ],
      tips: [
        "Diferencial aqui: referência a CONVERSA ESPECÍFICA que tiveram na negociação",
        "D+3: traga solução proativa para a última objeção discutida",
        "D+7: ofereça call curta — 5 minutos é menos ameaçador que 'reunião'",
        "D+14: prova social (cliente com mesma objeção) é muito poderosa",
        "D+21: honestidade radical — 'me ajuda a entender' desarma e abre diálogo",
      ],
    },
  },

  // 18. O poder da pergunta direta
  {
    type: "content",
    props: {
      title: "O Poder da\nPergunta Direta",
      label: "Cenário 04 — Técnica Avançada",
      highlight: "Quando nenhuma abordagem sutil funcionar, a honestidade radical é a última — e mais poderosa — ferramenta.",
      items: [
        "'[Nome], posso ser honesto? Sinto que talvez eu não tenha atendido alguma expectativa sua. Se for o caso, gostaria de saber para melhorar.'",
        "'[Nome], uma pergunta direta: o projeto segue com madeira? Se mudou de rumo, sem problema — prefiro saber para não te incomodar.'",
        "'[Nome], estou entre te ligar mais uma vez ou respeitar seu silêncio. O que prefere?'",
        "'[Nome], sei que pedir desconto e não receber pode ter frustrado. Mas posso propor algo diferente: faseamento, condição de pagamento ou ajuste de escopo. Posso?'",
        "Por que funciona: a honestidade radical demonstra maturidade e respeito. Rompe o ciclo de ghosting e dá ao lead uma saída digna — respondendo ou encerrando.",
        "Quando usar: APENAS após pelo menos 3 tentativas sem resposta. Nunca como primeiro recurso.",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 7 — LEADS FRIOS / NURTURING DE LONGO PRAZO (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 19. Seção
  {
    type: "section",
    props: {
      block: "Cenário 05",
      title: "Leads Frios e\nNurturing",
      subtitle: "O lead não respondeu a nenhuma tentativa. Mas ele pode voltar em 3, 6 ou 12 meses.",
    },
  },

  // 20. Estratégia de nurturing
  {
    type: "content",
    props: {
      title: "Estratégia de\nNurturing Passivo",
      label: "Cenário 05 — Longo Prazo",
      highlight: "Leads que não respondem não são leads mortos. São leads adormecidos. O nurturing passivo mantém a Parket presente na mente sem ser invasivo.",
      items: [
        "Frequência: 1 contato a cada 60-90 dias. Nunca mais frequente que isso",
        "Canal principal: e-mail marketing. Sem mensagens diretas de WhatsApp ou ligações",
        "Conteúdo: cases novos, lançamentos de madeira, convites para eventos, artigos sobre madeira e arquitetura",
        "Personalização mínima: use o nome, mas não referencie o projeto anterior (pode gerar constrangimento)",
        "Gatilho de reativação: se o lead abrir e-mail ou clicar em link, mova-o de volta para follow-up ativo",
        "CRM: marque como 'Nurturing' com data de revisão automática em 90 dias",
        "Taxa de reativação esperada: 5-10% dos leads em nurturing voltam a engajar dentro de 12 meses",
      ],
    },
  },

  // 21. Templates de nurturing
  {
    type: "script",
    props: {
      title: "Templates de\nNurturing (90 dias)",
      label: "Cenário 05 — Templates",
      context: "Mensagens espaçadas a cada 60-90 dias para leads em nurturing passivo.",
      lines: [
        { speaker: "Mês 3", text: "[E-mail] Assunto: 'Novo projeto Parket: [Nome do Projeto]'. Corpo: 'Olá [Nome], compartilho nosso mais recente projeto — [breve descrição + foto]. Se em algum momento quiser retomar a conversa sobre madeira, estamos aqui.'" },
        { speaker: "Mês 6", text: "[E-mail] Assunto: 'Convite: [Nome do Evento] na Casa Milan'. Corpo: 'Estamos realizando [evento] em nosso showroom. Seria uma honra recebê-lo. Inscrição pelo link.'" },
        { speaker: "Mês 9", text: "[E-mail] Assunto: 'Tendência 2026: tábuas largas em madeira natural'. Corpo: artigo curto sobre tendência + fotos de projetos recentes. Tom editorial, não comercial." },
        { speaker: "Mês 12", text: "[WhatsApp — ÚNICO no ano] '[Nome], faz um ano que conversamos sobre seu projeto. Se ele avançou ou está para avançar, adoraria retomar. Se não, sem problemas — só queria manter o contato. Abraço!'" },
      ],
      tips: [
        "Nurturing é jardim: você planta, rega com paciência e colhe quando for a hora",
        "O e-mail de mês 6 com convite para evento é o que mais reativa leads",
        "ÚNICO WhatsApp direto no ano todo (mês 12) — respeita o silêncio anterior",
        "Se o lead reengajar (responder, clicar, abrir) → mova IMEDIATAMENTE para cadência ativa",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 8 — SCRIPTS POR CANAL (4 slides)
  // ═══════════════════════════════════════════════════════════════

  // 22. Seção
  {
    type: "section",
    props: {
      block: "Bloco Extra",
      title: "Scripts por\nCanal",
      subtitle: "Adaptações de linguagem e formato para cada meio de comunicação.",
    },
  },

  // 23. WhatsApp: do's and don'ts
  {
    type: "twocolumn",
    props: {
      title: "WhatsApp:\nO Que Fazer vs. Evitar",
      label: "Canal — WhatsApp",
      leftTitle: "Faça Assim",
      leftItems: [
        "Mensagens curtas (max 3 parágrafos). Respeite o formato mobile",
        "Envie foto/vídeo como gancho — conteúdo visual engaja 3x mais",
        "Use áudio curto (20-40s) quando já tiver rapport. Humaniza",
        "Responda rápido quando ele voltar — janela de oportunidade é curta",
        "Varie os horários de envio — teste manhã, tarde e início de noite",
        "Sempre termine com pergunta suave que convide resposta",
      ],
      rightTitle: "Nunca Faça Isso",
      rightItems: [
        "Mensagens longas que viram 'parede de texto'. Ninguém lê",
        "Vários '???' ou 'olá?' seguidos. Parece desespero",
        "Enviar no domingo ou fora de horário comercial",
        "Cobrar resposta: 'por que não respondeu?' é proibido",
        "Usar figurinhas, gifs ou excesso de emojis. Mantenha elegância",
        "Enviar proposta ou preço por WhatsApp sem contexto prévio",
      ],
      leftColor: "#C4956A",
      rightColor: "#E85D5D",
    },
  },

  // 24. E-mail e Telefone
  {
    type: "twocolumn",
    props: {
      title: "E-mail e Telefone:\nBoas Práticas",
      label: "Canal — E-mail / Telefone",
      leftTitle: "E-mail",
      leftItems: [
        "Assunto curto e personalizado — evite genéricos como 'Proposta Parket'",
        "Corpo: máx 5 linhas. Um CTA claro. Link ou foto que engaje",
        "Envie terça a quinta, entre 9h-11h — maior taxa de abertura",
        "Se não abriu os últimos 3 e-mails, pare. Mude para outro canal",
        "Use tracking de abertura para saber se leu (ferramenta CRM)",
      ],
      rightTitle: "Telefone",
      rightItems: [
        "Ligue em horários estratégicos: 10h-11h ou 14h-15h são ideais",
        "Se não atender, deixe caixa postal CURTA (20s): nome, motivo, número",
        "Se atender e disser que não pode falar: 'Sem problema, posso retornar às [hora]?'",
        "Se disser que não tem interesse: agradeça e encerre com elegância",
        "Nunca ligue mais de 2x seguidas. Uma vez, caixa postal, aguarde",
      ],
      leftColor: "#C4956A",
      rightColor: "#C4956A",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 9 — ENCERRAMENTO (4 slides)
  // ═══════════════════════════════════════════════════════════════

  // 25. Erros fatais
  {
    type: "grid",
    props: {
      title: "Erros Fatais no\nReengajamento",
      label: "Alertas",
      columns: 2,
      cards: [
        { title: "Perseguição", description: "Mensagens diárias, ligações repetidas, '???' — isso destrói a imagem da marca e gera bloqueio.", icon: "✕" },
        { title: "Mesma mensagem", description: "Repetir o mesmo texto/abordagem esperando resultado diferente. Cada contato precisa de gancho novo.", icon: "✕" },
        { title: "Cobrança", description: "'Por que não respondeu?' ou 'Ainda está interessado?' com tom de cobrança. Zero tolerância.", icon: "✕" },
        { title: "Desconto não pedido", description: "Oferecer desconto por desespero quando o lead some. Desvaloriza o produto e a marca.", icon: "✕" },
        { title: "Ignorar sinais", description: "Se o lead pediu para parar, pare. Se bloqueou, acabou. Respeite absolutamente.", icon: "✕" },
        { title: "Não registrar", description: "Cada tentativa de reengajamento deve estar no CRM com data, canal e conteúdo. Sem registro, sem inteligência.", icon: "✕" },
      ],
    },
  },

  // 26. Métricas
  {
    type: "metrics",
    props: {
      title: "Métricas de\nReengajamento",
      label: "KPIs",
      metrics: [
        { value: "15-20%", label: "Taxa de reativação", description: "Leads silenciosos que voltam a responder" },
        { value: "5", label: "Tentativas máximas", description: "Antes de mover para nurturing" },
        { value: "D+3", label: "Primeiro follow-up", description: "Máximo de 3 dias após silêncio" },
        { value: "5-10%", label: "Nurturing → Reativação", description: "Leads que voltam em 12 meses" },
        { value: "30d", label: "Janela ativa", description: "Período de reengajamento direto" },
        { value: "100%", label: "Registros no CRM", description: "Toda tentativa documentada" },
      ],
    },
  },

  // 27. Statement
  {
    type: "statement",
    props: {
      statement: "A arte do reengajamento é saber a diferença entre persistência e insistência. Persistência é reaparecer com valor. Insistência é repetir sem propósito. Domine a primeira. Elimine a segunda.",
      label: "Mensagem Final",
      attribution: "Scripts de Reengajamento Parket",
    },
  },

  // 28. Closing
  {
    type: "closing",
    props: {
      title: "Parket",
      subtitle: "Scripts de Reengajamento\nPersistência com elegância.\nSempre.",
      image: parketDeckLake,
      logo: parketLogo,
    },
  },
];
