import { type SlideData } from "./slides-data";
import parketLogo from "figma:asset/ea944c52b88c841ea9c822abd0b2ed2bddf425e6.png";
import parketHerringbone from "figma:asset/b9bdf6119029ab1e402ac73b9a4bf22363cd3ff6.png";
import parketDeckLake from "figma:asset/4d5981327c581648268ef6760447eb46d6931f4c.png";
import parketStoneWall from "figma:asset/e709d3507fb615d8e01cdd56b0745f81577f6d89.png";
import parketCasaMilan from "figma:asset/c5da764965787206bd8e7105fcda0252da4da63b.png";

export const objecoesSlides: SlideData[] = [

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 1 — INTRODUÇÃO (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 1. Capa
  {
    type: "cover",
    props: {
      title: "Mapa de\nObjeções",
      subtitle: "Cada objeção é uma porta. Você só precisa da chave certa.",
      image: parketDeckLake,
    },
  },

  // 2. Statement
  {
    type: "statement",
    props: {
      statement: "Objeção não é rejeição. É o cliente pedindo mais informação para sentir segurança. Quanto melhor você responde, mais perto está do sim.",
      label: "Filosofia",
      attribution: "Treinamento Comercial Parket",
    },
  },

  // 3. Framework de resposta
  {
    type: "process",
    props: {
      title: "Framework A.E.R.\npara Toda Objeção",
      label: "Metodologia",
      steps: [
        { number: "A", title: "Acolha", description: "Valide o sentimento do cliente. 'Entendo perfeitamente.' Nunca confronte. Nunca minimize. O cliente precisa sentir que foi ouvido." },
        { number: "E", title: "Explore", description: "Faça uma pergunta para entender a raiz. 'Me ajuda a entender melhor: o que te preocupa especificamente?' Muitas vezes a objeção verbal não é a objeção real." },
        { number: "R", title: "Responda com Valor", description: "Responda com um diferencial, uma comparação ou um case. Nunca com desconto. O valor vem antes do preço. Sempre." },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 2 — OBJEÇÕES DE PREÇO (5 slides)
  // ═══════════════════════════════════════════════════════════════

  // 4. Seção
  {
    type: "section",
    props: {
      block: "Categoria 01",
      title: "Preço e\nInvestimento",
      subtitle: "A objeção mais comum — e a mais fácil de derrubar quando você domina o valor.",
    },
  },

  // 5. "Está muito caro"
  {
    type: "script",
    props: {
      title: "\"Está muito caro\"",
      label: "Preço — Objeção 01",
      context: "O cliente acha o valor alto, sem referência de comparação clara.",
      lines: [
        { speaker: "Cliente", text: "Gostei muito, mas o valor está acima do que eu imaginava." },
        { speaker: "Closer", text: "Entendo, [Nome]. É um investimento significativo, sem dúvida. Me ajuda a entender: quando fala 'acima do esperado', é sobre o valor total do projeto ou sobre o valor por metro quadrado?" },
        { speaker: "Cliente", text: "O valor total." },
        { speaker: "Closer", text: "Faz sentido. Mas considere o que está incluso: madeira natural selecionada, produzida na fábrica mais moderna da América Latina, tábuas de 22cm que ninguém mais produz, e instalação com equipe 100% nossa, com garantia. Tudo isso está no valor." },
        { speaker: "Closer", text: "Se dividir pelo tempo de vida útil — mais de 30 anos — estamos falando de R$ [X] por dia. É menos do que um café premium. E seu imóvel valoriza até 25% com piso de madeira natural." },
      ],
      tips: [
        "Nunca diga 'é caro porque é bom'. Justifique com fatos concretos",
        "Quebre o valor: por m², por ambiente, por dia ao longo de 30 anos",
        "Use a comparação com custo de reposição de sintéticos (3-4 trocas em 30 anos)",
        "Se persistir, ofereça faseamento do projeto — nunca desconto direto",
      ],
    },
  },

  // 6. "O concorrente é mais barato"
  {
    type: "script",
    props: {
      title: "\"O concorrente é\nmais barato\"",
      label: "Preço — Objeção 02",
      context: "O cliente tem ou menciona orçamento de um concorrente com preço inferior.",
      lines: [
        { speaker: "Cliente", text: "Recebi um orçamento de outra empresa 30% mais barato." },
        { speaker: "Closer", text: "É natural comparar, e eu recomendo que compare mesmo. Mas para que a comparação seja justa, sugiro verificar alguns pontos com o outro fornecedor." },
        { speaker: "Closer", text: "Primeiro: a madeira é 100% natural ou tem laminados misturados? Segundo: quem instala — equipe própria ou terceirizada? Terceiro: qual a largura máxima das tábuas — passam de 20cm? E quarto: quantos projetos de alto padrão já entregaram?" },
        { speaker: "Cliente", text: "Não sei esses detalhes..." },
        { speaker: "Closer", text: "Então vale verificar. Na Parket, o valor inclui tudo isso: madeira selecionada, fábrica própria, tábuas exclusivas, instalação nossa com garantia. Muitas vezes o 'mais barato' acaba custando mais quando precisa refazer ou quando o resultado não atende." },
      ],
      tips: [
        "Nunca fale mal do concorrente diretamente. Faça perguntas que o cliente levará ao concorrente",
        "Dê um checklist de comparação: material, instalação, largura, garantia, histórico",
        "Use a frase: 'Preço baixo e qualidade alta não existem no mesmo lugar em madeira natural'",
        "Se o concorrente for realmente bom, reconheça — mas reforce os diferenciais únicos",
      ],
    },
  },

  // 7. "Porcelanato que imita madeira custa metade"
  {
    type: "script",
    props: {
      title: "\"Porcelanato imita\nmadeira e custa metade\"",
      label: "Preço — Objeção 03",
      context: "O cliente considera porcelanato como alternativa por custo.",
      lines: [
        { speaker: "Cliente", text: "Meu vizinho colocou porcelanato que parece madeira e pagou metade." },
        { speaker: "Closer", text: "Entendo perfeitamente. É uma comparação comum. Me permite fazer uma observação?" },
        { speaker: "Cliente", text: "Claro." },
        { speaker: "Closer", text: "O porcelanato imita o visual, mas não reproduz o que faz a madeira especial: o toque quente, o conforto acústico, a textura viva, a sensação de caminhar descalço. E cada tábua de madeira é única — o porcelanato repete o mesmo padrão a cada 3-4 peças." },
        { speaker: "Closer", text: "Além disso, a madeira natural valoriza o imóvel — porcelanato não. Em projetos de alto padrão, arquitetos especificam madeira real justamente pela autenticidade. É a diferença entre usar couro legítimo e couro sintético." },
        { speaker: "Cliente", text: "Faz sentido..." },
        { speaker: "Closer", text: "Se quiser, na próxima visita pode tirar os sapatos e pisar nos dois aqui no showroom. A experiência fala mais do que eu." },
      ],
      tips: [
        "A analogia 'couro legítimo vs sintético' funciona muito bem",
        "Convide a experiência tátil: 'tire os sapatos e pise nos dois'",
        "Use o argumento térmico: madeira é quente, porcelanato é frio",
        "Para clientes com arquiteto: 'pergunte ao seu arquiteto a opinião — eles sabem a diferença'",
      ],
    },
  },

  // 8. "Não tenho budget agora"
  {
    type: "script",
    props: {
      title: "\"Não tenho orçamento\nagora\"",
      label: "Preço — Objeção 04",
      context: "O cliente gosta do produto mas alega restrição de caixa no momento.",
      lines: [
        { speaker: "Cliente", text: "Adorei tudo, mas agora não tenho esse orçamento disponível." },
        { speaker: "Closer", text: "Entendo completamente, [Nome]. Projetos de alto padrão envolvem muitas frentes. Posso sugerir duas alternativas que funcionam muito bem?" },
        { speaker: "Cliente", text: "Claro." },
        { speaker: "Closer", text: "Primeira: fazemos em fases. Começamos pelo piso do térreo agora — que é o maior impacto visual — e programamos o restante para daqui 3-4 meses. Assim você dilui o investimento sem perder qualidade." },
        { speaker: "Closer", text: "Segunda: podemos verificar condições de pagamento estendido. Temos flexibilidade para ajustar o cronograma de pagamento ao seu fluxo de caixa. O importante é garantir a madeira e a vaga na agenda de instalação." },
        { speaker: "Cliente", text: "O faseamento faz sentido. Vou pensar." },
        { speaker: "Closer", text: "Perfeito. Vou preparar uma proposta faseada e envio até amanhã. Um detalhe: a partida de [madeira] que separamos é limitada. Se reservar agora, garanto essa madeira para todas as fases." },
      ],
      tips: [
        "Faseamento é a ferramenta #1 para lidar com restrição de budget",
        "Crie urgência real: estoque limitado, agenda de instalação",
        "Nunca julgue ou questione a capacidade financeira do cliente",
        "Ofereça flexibilidade de pagamento antes que ele peça desconto",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 3 — OBJEÇÕES DE PRAZO E TIMING (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 9. Seção
  {
    type: "section",
    props: {
      block: "Categoria 02",
      title: "Prazo e\nTiming",
      subtitle: "Quando o tempo é a barreira — real ou percebida.",
    },
  },

  // 10. "O prazo é muito longo"
  {
    type: "script",
    props: {
      title: "\"O prazo de entrega\né muito longo\"",
      label: "Prazo — Objeção 01",
      context: "O cliente acha que o prazo de produção + instala��ão é demorado demais.",
      lines: [
        { speaker: "Cliente", text: "8 semanas de produção + 3 de instalação? É muito tempo. Preciso mais rápido." },
        { speaker: "Closer", text: "Entendo a urgência. Me ajuda a entender: a obra tem uma data fixa de entrega ou há flexibilidade?" },
        { speaker: "Cliente", text: "Queremos entrar na casa em dezembro." },
        { speaker: "Closer", text: "Perfeito. Então temos margem se fecharmos agora. Mas quero ser honesto: qualidade leva tempo. Cada tábua é selecionada, tratada, acabada e inspecionada individualmente. Acelerar comprometeria o que nos diferencia." },
        { speaker: "Closer", text: "O que posso fazer é verificar se temos partidas já em estoque dessa espécie, o que encurtaria o prazo de produção. E nossa equipe de instalação pode priorizar o agendamento se confirmarmos agora." },
      ],
      tips: [
        "Nunca prometa prazos que não pode cumprir — quebra de confiança é irreversível",
        "Verifique estoque de partidas prontas — pode encurtar semanas",
        "Use a honestidade como ferramenta: 'prefiro entregar perfeito em 8 semanas que razoável em 4'",
        "Se a urgência é real e incontornável, ajuste o escopo (fase 1 agora, fase 2 depois)",
      ],
    },
  },

  // 11. "Ainda é cedo, a obra nem começou"
  {
    type: "script",
    props: {
      title: "\"A obra ainda nem\ncomeçou\"",
      label: "Prazo — Objeção 02",
      context: "O lead está em fase inicial de planejamento, sem urgência.",
      lines: [
        { speaker: "Lead", text: "Estou pesquisando, mas a obra só começa ano que vem." },
        { speaker: "SDR/Closer", text: "Ótimo que esteja se planejando com antecedência — os melhores projetos nascem assim. Na verdade, esse é o momento ideal para definir a madeira." },
        { speaker: "Lead", text: "Por quê?" },
        { speaker: "SDR/Closer", text: "Porque a escolha da madeira influencia o projeto de arquitetura — paginação do piso, transições entre ambientes, altura do contrapiso. Quanto mais cedo o arquiteto souber qual madeira, melhor o resultado final." },
        { speaker: "SDR/Closer", text: "Sugiro uma visita ao showroom agora, sem compromisso. Você e o arquiteto veem as opções, se encantam, e quando a obra avançar já está tudo definido. Economiza tempo lá na frente." },
      ],
      tips: [
        "Lead em planejamento é lead de ouro — nurture com carinho",
        "Use o argumento técnico: definir madeira cedo melhora o projeto",
        "Convide para visita 'sem compromisso' — reduz a barreira",
        "Registre no CRM com follow-up programado para quando a obra avançar",
      ],
    },
  },

  // ��══════════════════════════════════════════════════════════════
  // BLOCO 4 — OBJEÇÕES SOBRE O PRODUTO (4 slides)
  // ═══════════════════════════════════════════════════════════════

  // 12. Seção
  {
    type: "section",
    props: {
      block: "Categoria 03",
      title: "Produto e\nMaterial",
      subtitle: "Dúvidas e inseguranças sobre a madeira em si — manutenção, durabilidade, adequação.",
    },
  },

  // 13. "Madeira dá muito trabalho"
  {
    type: "script",
    props: {
      title: "\"Madeira dá muito\ntrabalho de manutenção\"",
      label: "Produto — Objeção 01",
      context: "O cliente teme que madeira exija manutenção constante e trabalhosa.",
      lines: [
        { speaker: "Cliente", text: "Eu adoro madeira, mas todo mundo fala que dá muito trabalho." },
        { speaker: "Closer", text: "Essa é uma preocupação muito comum — e quase sempre baseada em experiências de décadas atrás, com produtos e técnicas que já evoluíram muito." },
        { speaker: "Closer", text: "A manutenção hoje é simples: limpeza regular com pano úmido e, uma vez por ano, uma aplicação de cera ou óleo — que leva poucas horas. É literalmente menos trabalho que manter um jardim." },
        { speaker: "Closer", text: "Além disso, oferecemos programa de manutenção preventiva. Nossa equipe visita, avalia e faz o serviço. Você não precisa se preocupar com nada." },
        { speaker: "Cliente", text: "E se riscar?" },
        { speaker: "Closer", text: "Riscos leves fazem parte da vida da madeira — e com o tempo, dão personalidade. Mas se precisar, a madeira natural pode ser lixada e restaurada, voltando ao estado original. Porcelanato riscou? Troca tudo. Vinílico estragou? Troca tudo. Madeira? Restaura." },
      ],
      tips: [
        "Compare: 'menos trabalho que um jardim' é analogia poderosa",
        "O argumento da 'restauração' é matador: madeira é o único piso que pode ser renovado",
        "Mencione o programa de manutenção preventiva — reduz ansiedade",
        "Se possível, mostre uma peça restaurada vs. nova para demonstrar",
      ],
    },
  },

  // 14. "Tenho crianças/pets"
  {
    type: "script",
    props: {
      title: "\"Tenho crianças e\npets em casa\"",
      label: "Produto — Objeção 02",
      context: "O cliente teme que crianças e animais de estimação danifiquem o piso.",
      lines: [
        { speaker: "Cliente", text: "Temos duas crianças e um labrador. Madeira vai estragar, né?" },
        { speaker: "Closer", text: "Entendo a preocupação. Mas vou te contar: a maioria dos nossos clientes tem filhos e pets. Madeira natural é, na verdade, uma excelente escolha para famílias." },
        { speaker: "Closer", text: "Primeiro: madeira é quente e confortável para crianças brincarem no chão — diferente do porcelanato, que é frio e duro. Segundo: absorve impacto e reduz barulho — a casa fica mais silenciosa." },
        { speaker: "Closer", text: "Para pets, recomendamos espécies de alta dureza como Cumaru ou Ipê — são extremamente resistentes. E se ao longo dos anos aparecerem marcas, a madeira pode ser restaurada. É o único piso que permite isso." },
        { speaker: "Cliente", text: "E quanto a acidentes — xixi do cachorro, líquidos?" },
        { speaker: "Closer", text: "O acabamento que aplicamos protege contra líquidos se limpos rapidamente — como qualquer piso, aliás. E nosso programa de manutenção anual reforça essa proteção continuamente." },
      ],
      tips: [
        "O argumento térmico e acústico é forte para famílias com crianças",
        "Recomende espécies de alta dureza Janka para casas com pets",
        "Use o case: 'temos clientes com 3 cachorros e o piso está perfeito após 5 anos'",
        "O fato de ser restaurável é o argumento definitivo contra qualquer preocupação de dano",
      ],
    },
  },

  // 15. "Meu vizinho/amigo teve problema"
  {
    type: "script",
    props: {
      title: "\"Meu vizinho teve\nproblema com madeira\"",
      label: "Produto — Objeção 03",
      context: "O cliente conhece alguém que teve experiência negativa com piso de madeira.",
      lines: [
        { speaker: "Cliente", text: "Meu vizinho colocou madeira e em 2 anos começou a estufar e soltar." },
        { speaker: "Closer", text: "Sinto muito que o vizinho tenha passado por isso. Infelizmente, é mais comum do que deveria — e quase sempre o problema está na instalação, não na madeira." },
        { speaker: "Closer", text: "90% dos problemas com pisos de madeira vêm de: instalação terceirizada sem preparo, contrapiso mal nivelado, ou ausência de juntas de dilatação corretas. É por isso que na Parket a instalação é 100% com equipe própria." },
        { speaker: "Closer", text: "Nossa equipe prepara o contrapiso, verifica umidade, aplica as juntas corretamente e faz acabamento final. Cada etapa é inspecionada. E a garantia cobre material E instalação — porque controlamos os dois." },
        { speaker: "Cliente", text: "Mas e a qualidade da madeira em si?" },
        { speaker: "Closer", text: "A madeira passa por secagem controlada em nossa fábrica, atingindo a umidade ideal. Madeira mal seca é a segunda causa de problemas. Na Parket, cada lote é monitorado instrumentalmente antes de sair da fábrica." },
      ],
      tips: [
        "Nunca culpe o vizinho ou o fornecedor anterior diretamente — seja empático",
        "Foque em explicar POR QUE o problema aconteceu (instalação, secagem)",
        "Reforce que a Parket controla TODO o processo — diferente dos que terceirizam",
        "Ofereça visitar uma instalação recente ou mostrar vídeo do processo",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 5 — OBJEÇÕES DE DECISÃO (4 slides)
  // ═══════════════════════════════════════════════════════════════

  // 16. Seção
  {
    type: "section",
    props: {
      block: "Categoria 04",
      title: "Decisão e\nInsegurança",
      subtitle: "Quando o cliente hesita, adia ou envolve outros decisores.",
    },
  },

  // 17. "Preciso pensar"
  {
    type: "script",
    props: {
      title: "\"Preciso pensar\num pouco mais\"",
      label: "Decisão — Objeção 01",
      context: "O clássico 'preciso pensar' — geralmente mascara outra preocupação.",
      lines: [
        { speaker: "Cliente", text: "Gostei de tudo, mas preciso pensar um pouco mais." },
        { speaker: "Closer", text: "Claro, [Nome]. É uma decisão importante e merece reflexão. Me permite fazer uma pergunta?" },
        { speaker: "Cliente", text: "Pode sim." },
        { speaker: "Closer", text: "Se não fosse nenhum impedimento prático — orçamento, prazo, aprovação — você fecharia agora? Ou há algo no produto ou no projeto que ainda não te convenceu?" },
        { speaker: "Cliente", text: "Na verdade, estou entre vocês e outra empresa..." },
        { speaker: "Closer", text: "Entendo. Comparar é saudável. O que posso te pedir é que compare com critérios iguais: origem da madeira, quem instala, largura das tábuas, garantia, histórico de projetos. Se precisar, posso preparar um comparativo ponto a ponto." },
        { speaker: "Closer", text: "E independente da decisão, fico à disposição. Posso ligar na quinta para saber como está a reflexão?" },
      ],
      tips: [
        "'Preciso pensar' SEMPRE esconde algo. A pergunta 'Se não fosse impedimento, fecharia?' revela a objeção real",
        "Se for preço → vá para script de preço. Se for concorrência → vá para comparativo",
        "Sempre defina um próximo passo com data. Nunca 'me liga quando decidir'",
        "Não pressione. Elegância e paciência constroem mais confiança que urgência",
      ],
    },
  },

  // 18. "Preciso falar com minha esposa/marido"
  {
    type: "script",
    props: {
      title: "\"Preciso falar com\nminha esposa/marido\"",
      label: "Decisão — Objeção 02",
      context: "O cliente precisa consultar cônjuge ou outro decisor.",
      lines: [
        { speaker: "Cliente", text: "Adorei, mas preciso alinhar com minha esposa antes de decidir." },
        { speaker: "Closer", text: "Totalmente compreensível — é uma decisão que impacta a casa de vocês dois. O ideal seria que ela também vivesse a experiência do showroom. Posso agendar uma visita para vocês dois?" },
        { speaker: "Cliente", text: "Ela não tem muito tempo..." },
        { speaker: "Closer", text: "Entendo. Então vou preparar um material especial para você apresentar a ela: fotos das madeiras que escolhemos, amostras do projeto e a proposta detalhada. Posso até gravar um vídeo rápido do showroom, se preferir." },
        { speaker: "Closer", text: "E se ela tiver dúvidas, podemos fazer uma call rápida de 15 minutos. Quero que ela se sinta tão segura quanto você se sentiu aqui hoje." },
      ],
      tips: [
        "Sempre tente incluir TODOS os decisores na visita ao showroom",
        "Se não for possível, crie material para o cliente 'vender' em casa: fotos, vídeo, amostras",
        "Ofereça call rápida com o cônjuge — demonstra cuidado e profissionalismo",
        "Pergunte: 'O que você acha que é mais importante para ela/ele?' — antecipe objeções do decisor ausente",
      ],
    },
  },

  // 19. "Preciso de mais orçamentos"
  {
    type: "script",
    props: {
      title: "\"Preciso de mais\norçamentos\"",
      label: "Decisão — Objeção 03",
      context: "O cliente quer cotar com outros fornecedores antes de decidir.",
      lines: [
        { speaker: "Cliente", text: "Vou pegar mais 2-3 orçamentos antes de fechar." },
        { speaker: "Closer", text: "Recomendo muito que faça isso. Comparar é parte saudável do processo. O que peço é que a comparação seja justa." },
        { speaker: "Closer", text: "Preparei um checklist para te ajudar nas outras visitas. Compare: 1) A madeira é 100% natural? 2) A instalação é com equipe própria? 3) Produzem tábuas acima de 20cm? 4) Quantos projetos de alto padrão já entregaram? 5) O showroom permite vivenciar o produto?" },
        { speaker: "Cliente", text: "Boa, vou usar esse checklist." },
        { speaker: "Closer", text: "Perfeito. E um detalhe importante: a partida de [madeira] que separamos para seu projeto é limitada. Se decidir em até 15 dias, consigo garantir essa partida. Após isso, pode variar o tom e o veio." },
        { speaker: "Closer", text: "Posso retornar em uma semana para trocarmos impressões?" },
      ],
      tips: [
        "Nunca impeça o cliente de comparar — isso gera desconfiança",
        "O checklist comparativo é arma secreta: coloca os critérios que você vence",
        "Crie urgência REAL: partida limitada, agenda de instalação, variação de lote",
        "Marque follow-up em 7 dias — tempo suficiente para cotar sem esfriar",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 6 — OBJEÇÕES SOBRE O PROCESSO (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 20. Seção
  {
    type: "section",
    props: {
      block: "Categoria 05",
      title: "Processo e\nInstalação",
      subtitle: "Dúvidas sobre como funciona — obra, sujeira, barulho, logística.",
    },
  },

  // 21. "Vai fazer muita sujeira/barulho"
  {
    type: "script",
    props: {
      title: "\"Vai fazer muita\nsujeira na obra?\"",
      label: "Processo — Objeção 01",
      context: "O cliente teme o transtorno da instalação, especialmente em reformas.",
      lines: [
        { speaker: "Cliente", text: "Estamos morando na casa. A instalação vai ser muito invasiva?" },
        { speaker: "Closer", text: "É uma preocupação legítima. A boa notícia é que a instalação de piso de madeira é uma das menos invasivas em uma obra." },
        { speaker: "Closer", text: "Não quebramos nada — o piso é instalado sobre o contrapiso existente. A sujeira é mínima: basicamente pó de serra, que controlamos com aspiração durante o processo. E o barulho é moderado, limitado ao horário comercial." },
        { speaker: "Closer", text: "Podemos inclusive fazer a instalação por ambientes — vocês liberam a sala, por exemplo, enquanto usam os quartos normalmente. Em 3-5 dias a sala estaria pronta." },
        { speaker: "Cliente", text: "Isso me tranquiliza." },
        { speaker: "Closer", text: "E no final, nossa equipe faz limpeza completa. Vocês recebem o ambiente pronto para usar. Esse cuidado é parte do nosso padrão de entrega." },
      ],
      tips: [
        "Reformas com moradores exigem sensibilidade extra — demonstre cuidado",
        "Ofereça a instalação por ambientes para minimizar o impacto",
        "Compare: 'é muito menos invasivo que trocar azulejo ou fazer obra de alvenaria'",
        "Mencione a limpeza final como parte do serviço — é um diferencial valorizado",
      ],
    },
  },

  // 22. "E se der problema depois?"
  {
    type: "script",
    props: {
      title: "\"E se der problema\ndepois da instalação?\"",
      label: "Processo — Objeção 02",
      context: "O cliente quer garantias sobre suporte pós-instalação.",
      lines: [
        { speaker: "Cliente", text: "E se depois de um tempo aparecer algum problema?" },
        { speaker: "Closer", text: "É uma pergunta inteligente, e a resposta é uma das nossas maiores forças: como fabricamos E instalamos com equipe própria, a garantia cobre tudo — material E mão de obra." },
        { speaker: "Closer", text: "Se aparecer qualquer questão — um encaixe, um acabamento, o que for — nossa equipe técnica visita, avalia e resolve. Sem burocracia, sem empurra-empurra entre fornecedor e instalador." },
        { speaker: "Closer", text: "Além disso, oferecemos programa de manutenção preventiva. Nossa equipe visita periodicamente para avaliar o estado do piso e fazer os cuidados necessários. Prevenção é sempre melhor que correção." },
        { speaker: "Cliente", text: "Isso é diferente..." },
        { speaker: "Closer", text: "É um dos nossos maiores diferenciais. Quando uma empresa terceiriza a instalação, se dá problema o fabricante culpa o instalador e vice-versa. Na Parket, a responsabilidade é 100% nossa. Ponto." },
      ],
      tips: [
        "A responsabilidade única (material + instalação) é argumento devastador",
        "Conte sobre o programa de manutenção preventiva — gera confiança de longo prazo",
        "Use o contraste: 'outros culpam o instalador, nós assumimos tudo'",
        "Se possível, mostre depoimentos de clientes sobre o pós-venda",
      ],
    },
  },

  // ════════════════════════════════��══════════════════════════════
  // BLOCO 7 — OBJEÇÕES DO ARQUITETO (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 23. Seção
  {
    type: "section",
    props: {
      block: "Categoria 06",
      title: "Arquiteto e\nInfluenciadores",
      subtitle: "Quando o decisor técnico indica outro caminho.",
    },
  },

  // 24. "Meu arquiteto indicou outra empresa"
  {
    type: "script",
    props: {
      title: "\"Meu arquiteto indicou\noutra empresa\"",
      label: "Arquiteto — Objeção 01",
      context: "O arquiteto do projeto recomendou um concorrente.",
      lines: [
        { speaker: "Cliente", text: "Minha arquiteta já trabalha com outro fornecedor de madeira." },
        { speaker: "Closer", text: "Respeito muito. Muitos arquitetos têm fornecedores de confiança. Mas posso sugerir algo?" },
        { speaker: "Cliente", text: "Pode sim." },
        { speaker: "Closer", text: "Convide sua arquiteta para conhecer nosso showroom na Casa Milan e nosso parque fabril. Temos certeza de que a visita vai ser enriquecedora para ela — mesmo que já trabalhe com outro fornecedor." },
        { speaker: "Closer", text: "Muitos arquitetos que nos conhecem passam a especificar Parket justamente pela capacidade que temos: tábuas acima de 20cm, solução completa integrada e instalação própria. São coisas que poucos oferecem." },
        { speaker: "Closer", text: "E não precisa ser exclusivo — o arquiteto pode manter o outro fornecedor e usar a Parket para projetos onde nossos diferenciais façam mais sentido. O importante é que ela conheça." },
      ],
      tips: [
        "Nunca desqualifique a escolha do arquiteto — ele é aliado, não adversário",
        "O convite para conhecer é a melhor estratégia: o showroom converte",
        "Ofereça coexistência: 'pode usar os dois, dependendo do projeto'",
        "Se conseguir a visita do arquiteto, faça atendimento VIP — ele influencia dezenas de projetos",
      ],
    },
  },

  // 25. "O arquiteto acha que não precisa de madeira natural"
  {
    type: "script",
    props: {
      title: "\"O arquiteto sugeriu\noutro material\"",
      label: "Arquiteto — Objeção 02",
      context: "O arquiteto sugere porcelanato, vinílico ou outro material no lugar da madeira.",
      lines: [
        { speaker: "Cliente", text: "Meu arquiteto acha que porcelanato resolve e custa menos." },
        { speaker: "Closer", text: "Respeito a opinião do profissional. Cada arquiteto tem suas preferências e razões. Mas posso compartilhar um ponto de vista?" },
        { speaker: "Closer", text: "Os projetos mais premiados do Brasil e do mundo em residências de alto padrão usam madeira natural. Escritórios como Studio MK27, Isay Weinfeld e Fernanda Marques especificam madeira justamente pela autenticidade e sofisticação que nenhum substituto reproduz." },
        { speaker: "Closer", text: "Sugiro uma conversa entre mim e seu arquiteto — posso apresentar soluções técnicas que ele talvez não conheça. Por exemplo, nossas tábuas de 22cm de largura com acabamentos personalizados. Isso pode abrir novas possibilidades para o projeto." },
        { speaker: "Cliente", text: "Posso sugerir isso a ele." },
        { speaker: "Closer", text: "Agradeço. E reforço: o objetivo não é substituir a opinião dele, mas enriquecer as opções. Às vezes o arquiteto não sugere madeira porque nunca trabalhou com um fornecedor que entregasse com essa qualidade." },
      ],
      tips: [
        "Use referências de arquitetos renomados como prova social técnica",
        "Ofereça conversa direta com o arquiteto — técnico com técnico funciona melhor",
        "Nunca desqualifique o arquiteto na frente do cliente — destrua a relação",
        "O argumento 'talvez nunca trabalhou com fornecedor desse nível' abre portas",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 8 — FRAMEWORK E ENCERRAMENTO (4 slides)
  // ═══════════════════════════════════════════════════════════════

  // 26. Resumo por categoria
  {
    type: "grid",
    props: {
      title: "Resumo Rápido:\nChave para Cada\nCategoria",
      label: "Resumo",
      columns: 2,
      cards: [
        { title: "Preço", description: "Quebre o valor (por m², por dia em 30 anos). Compare custo de vida total. Ofereça faseamento, nunca desconto.", icon: "💰" },
        { title: "Prazo", description: "Seja honesto. Verifique estoque pronto. Use a urgência a favor: 'se fechar agora, garanto a agenda'. Sugira fases.", icon: "⏱" },
        { title: "Produto", description: "Experiência tátil é sua arma. 'Tire os sapatos e compare.' A restaurabilidade é o argumento definitivo.", icon: "🪵" },
        { title: "Decisão", description: "Descubra a objeção real ('se não fosse X, fecharia?'). Inclua todos os decisores. Material para quem não está presente.", icon: "🤔" },
        { title: "Processo", description: "Instalação é não-invasiva. Equipe própria = garantia real = responsabilidade única. Manutenção preventiva disponível.", icon: "🔧" },
        { title: "Arquiteto", description: "Nunca desqualifique. Convide para o showroom. Ofereça conversa técnica. Use referências de arquitetos renomados.", icon: "📐" },
      ],
    },
  },

  // 27. Regras de ouro
  {
    type: "content",
    props: {
      title: "10 Regras de Ouro\npara Objeções",
      label: "Princípios",
      items: [
        "1. Toda objeção é válida. Nunca minimize ou confronte o sentimento do cliente",
        "2. A objeção verbal nem sempre é a objeção real. Sempre explore com perguntas",
        "3. Silêncio é poder. Após responder, pare de falar. Deixe o cliente processar",
        "4. Nunca dê desconto como primeira resposta. O desconto é a última carta, não a primeira",
        "5. Use o framework A.E.R.: Acolha, Explore, Responda com Valor",
        "6. Tenha cases prontos para cada objeção. Histórias reais são mais convincentes que argumentos",
        "7. Se não souber responder, diga: 'Ótima pergunta. Vou verificar e te retorno até amanhã'",
        "8. Registre TODA objeção no CRM. Isso gera inteligência para o time inteiro",
        "9. Pratique. Faça role-play semanalmente com a equipe. Objeção se vence com treino",
        "10. Elegância sempre. Mesmo que não feche, o cliente deve sair com respeito pela Parket",
      ],
    },
  },

  // 28. Statement final
  {
    type: "statement",
    props: {
      statement: "O melhor vendedor não é o que nunca ouve 'não'. É o que transforma cada 'não' em 'me explica melhor' — e cada 'me explica melhor' em 'fechado'.",
      label: "Filosofia Final",
      attribution: "Mapa de Objeções Parket",
    },
  },

  // 29. Closing
  {
    type: "closing",
    props: {
      title: "Parket",
      subtitle: "Mapa de Objeções\nCada objeção é uma porta.\nVocê tem a chave.",
      image: parketHerringbone,
      logo: parketLogo,
    },
  },
];
