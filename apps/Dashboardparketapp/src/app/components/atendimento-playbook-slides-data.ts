import { type SlideData } from "./slides-data";
import parketDeckLake from "figma:asset/4d5981327c581648268ef6760447eb46d6931f4c.png";
import parketSpiral from "figma:asset/4a6a8ad24bcda1f844920eb717e3e4d47f57d4d3.png";

const IMG = {
  cover: "https://images.unsplash.com/photo-1609189123897-42db027571c9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBjdXN0b21lciUyMHNlcnZpY2UlMjByZWNlcHRpb24lMjBlbGVnYW50fGVufDF8fHx8MTc3MjEwMjQyMHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  showroom: "https://images.unsplash.com/photo-1730383445472-b45ebd18e386?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwc2hvd3Jvb20lMjBpbnRlcmlvciUyMGRlc2lnbiUyMGNvbnN1bHRhdGlvbnxlbnwxfHx8fDE3NzIxMDI0MjB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  team: "https://images.unsplash.com/photo-1769740333462-9a63bfa914bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHRlYW0lMjBjb21tdW5pY2F0aW9uJTIwaGVhZHNldCUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NzIxMDI0MjF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  wood: "https://images.unsplash.com/photo-1602544959011-554bc3fc42ae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbWluaW1hbCUyMHdvb2QlMjB0ZXh0dXJlJTIwbHV4dXJ5JTIwYmFja2dyb3VuZHxlbnwxfHx8fDE3NzIxMDI0MjF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  experience: "https://images.unsplash.com/photo-1764512680324-048f158cab2b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXN0b21lciUyMGV4cGVyaWVuY2UlMjBqb3VybmV5JTIwcHJlbWl1bSUyMHJldGFpbHxlbnwxfHx8fDE3NzIxMDI0MjJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  handshake: "https://images.unsplash.com/photo-1696861273647-92dfe8bb697c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYW5kc2hha2UlMjBidXNpbmVzcyUyMGRlYWwlMjBwcmVtaXVtJTIwZWxlZ2FudHxlbnwxfHx8fDE3NzIxMDI0MjJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
};

export const atendimentoPlaybookSlides: SlideData[] = [

  /* ═══════════════════════════════════════════════════════════
     CAPA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "cover",
    props: {
      title: "Playbook de\nAtendimento",
      subtitle: "Do primeiro contato ao encantamento pos-venda.\nProtocolos, scripts, SLAs, escalation,\ntom de voz e metricas da area.",
      image: IMG.cover,
    },
  },

  /* ═══════════════════════════════════════════════════════════
     MANIFESTO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "statement",
    props: {
      statement: "Atendimento nao e\num departamento.\nE a forma como o cliente\nsente a Parket em\ncada ponto de contato.",
      label: "Manifesto de Atendimento",
      attribution: "Cultura Parket",
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 01 — FILOSOFIA & POSICIONAMENTO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 01",
      title: "Filosofia de\nAtendimento",
      subtitle: "Por que atendimento premium nao e ser bonzinho.\nE ser preciso, rapido e memoravel.",
    },
  },
  {
    type: "split",
    props: {
      title: "O Padrao Parket\nde Atendimento",
      label: "Filosofia",
      content: "Na Parket, atendimento e produto. O cliente de altissimo padrao nao tolera demora, ambiguidade ou friccao. Cada interacao deve transmitir dominio tecnico, exclusividade e cuidado genuino. Nao vendemos pisos — entregamos experiencias que comecam no primeiro 'ola'.",
      image: IMG.showroom,
      imagePosition: "right",
    },
  },
  {
    type: "grid",
    props: {
      title: "7 Principios do\nAtendimento Parket",
      label: "Codigo de conduta",
      cards: [
        { title: "Velocidade com elegancia", description: "Responder rapido sem parecer apressado. SLA maximo de 15 min no horario comercial", icon: "⚡" },
        { title: "Dominio tecnico", description: "Quem atende precisa conhecer madeira, processos e prazos com profundidade", icon: "🧠" },
        { title: "Escuta ativa primeiro", description: "Entender a real necessidade antes de oferecer solucao ou redirecionar", icon: "👂" },
        { title: "Uma voz, um tom", description: "Tom Parket: sofisticado, acolhedor, direto. Sem grias, sem robotismo", icon: "🎯" },
        { title: "Proatividade radical", description: "Antecipar problemas, informar antes de ser cobrado, surpreender com atualizacoes", icon: "🔮" },
        { title: "Ownership total", description: "Quem recebe o problema e dono ate a resolucao — nao importa a area", icon: "🛡️" },
        { title: "Registro e rastreabilidade", description: "Toda interacao fica no CRM. Sem registro = nao aconteceu", icon: "📝" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "O Que Diferencia Atendimento Premium",
      label: "Benchmarks de alto padrao",
      highlight: "O cliente Parket ja experimentou o melhor em outros setores. Ele compara voce com a Amex Black, com a concierge do hotel 5 estrelas, com a assessoria de investimentos.",
      items: [
        "Personalização: usar o nome, lembrar do projeto, citar detalhes anteriores",
        "Consistencia multicanal: WhatsApp, telefone, e-mail, presencial — mesma experiencia",
        "Transparencia radical: prazos reais, nao otimistas. Problemas comunicados proativamente",
        "Follow-up como ritual: nao esperar o cliente cobrar. Atualizar antes",
        "Encerramento impecavel: nao sumir apos a venda. Pos-obra e a nova prospecao",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 02 — ESTRUTURA DA AREA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 02",
      title: "Estrutura &\nPapeis",
      subtitle: "Quem faz o que na area de atendimento.\nPapeis, responsabilidades e handoffs.",
    },
  },
  {
    type: "role",
    props: {
      role: "Coordenadora de Atendimento — Talita",
      mission: "Garantir que todo ponto de contato do cliente tenha resposta dentro do SLA, com qualidade e rastreabilidade. Escalar problemas criticos e proteger a experiencia do cliente.",
      responsibilities: [
        "Triagem e distribuicao de demandas entre time",
        "Monitoramento de SLAs e tempo de resposta",
        "Gestao do CRM — garantir registros completos",
        "Escalacao de reclamacoes e casos criticos",
        "Treinamento e calibracao do tom de voz do time",
        "Relatorio semanal de atendimento para lideranca",
      ],
      kpis: [
        "Tempo medio de 1a resposta < 15 min",
        "Taxa de resolucao no 1o contato > 65%",
        "NPS de atendimento > 80",
        "Zero reclamacao sem resposta em 24h",
      ],
      image: IMG.team,
    },
  },
  {
    type: "role",
    props: {
      role: "Atendente Senior — Tainara",
      mission: "Ser o ponto focal de atendimento para clientes em fase de obra ativa. Acompanhar projetos complexos e manter o cliente informado proativamente.",
      responsibilities: [
        "Atendimento direto a clientes com obras em andamento",
        "Atualizacao proativa sobre status de obra e entregas",
        "Interface com equipe de projetos e producao",
        "Gestao de ocorrencias e pos-obra",
        "Coleta de NPS e depoimentos ao final de cada projeto",
      ],
      kpis: [
        "100% das obras ativas com update semanal",
        "Tempo de resolucao de ocorrencia < 48h",
        "Taxa de recompra/indicacao > 30%",
        "NPS individual > 85",
      ],
      image: IMG.experience,
    },
  },
  {
    type: "grid",
    props: {
      title: "Matriz de Canais\n& Responsaveis",
      label: "Quem cuida de cada canal",
      cards: [
        { title: "WhatsApp Business", description: "Canal principal. Talita + Tainara. SLA: 15 min. Horario: 8h-18h seg-sex, 9h-13h sab", icon: "📱" },
        { title: "Telefone Showroom", description: "Recepcao filtra e direciona. Talita assume se comercial, Tainara se obra ativa", icon: "📞" },
        { title: "E-mail", description: "Talita monitora caixa geral. Distribuir em ate 30 min. Resposta completa em 4h", icon: "📧" },
        { title: "Presencial / Showroom", description: "Recepcao + comercial. Se cliente ativo, chamar responsavel do projeto", icon: "🏢" },
        { title: "Instagram DM", description: "Social media faz triagem. Se lead quente, redireciona para WhatsApp em 10 min", icon: "📸" },
        { title: "Reclame Aqui / Google", description: "Talita responde em ate 2h. Escalar para Germano se crise reputacional", icon: "⚠️" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 03 — JORNADA DE ATENDIMENTO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 03",
      title: "Jornada de\nAtendimento",
      subtitle: "Os 8 momentos criticos onde o atendimento\nfaz a diferenca entre perder e fidelizar.",
    },
  },
  {
    type: "process",
    props: {
      title: "8 Momentos Criticos\ndo Atendimento",
      label: "Jornada do cliente na otica do atendimento",
      steps: [
        { number: "01", title: "Primeiro contato", description: "Lead chega por qualquer canal. Classificar: quente, morno, frio. Responder em ate 15 min" },
        { number: "02", title: "Qualificacao + agendamento", description: "Entender escopo, perfil, urgencia. Agendar visita ao showroom ou call tecnica" },
        { number: "03", title: "Acompanhamento pre-venda", description: "Follow-up na cadencia certa. Enviar materiais, referencias, cases similares" },
        { number: "04", title: "Onboarding pos-contrato", description: "Boas-vindas, apresentacao do time, cronograma, grupo WhatsApp, expectativas" },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "8 Momentos Criticos\ndo Atendimento",
      label: "Momentos 05-08",
      steps: [
        { number: "05", title: "Updates durante a obra", description: "Atualizacoes proativas semanais. Fotos de progresso. Antecipar atrasos" },
        { number: "06", title: "Gestao de ocorrencias", description: "Problema surgiu? Registrar, classificar, escalar e resolver com transparencia" },
        { number: "07", title: "Entrega e aceite", description: "Momento wow: entrega impecavel, walkthrough com cliente, termo de aceite" },
        { number: "08", title: "Pos-venda e reativacao", description: "NPS, manutencao preventiva, aniversario do projeto, recompra e indicacao" },
      ],
    },
  },
  {
    type: "split",
    props: {
      title: "O Momento da Verdade:\nPrimeiro Contato",
      label: "Momento 01 — Deep Dive",
      content: "O cliente forma 80% da impressao nos primeiros 3 minutos. No WhatsApp, a velocidade e o tom da primeira mensagem definem se ele segue ou vai para o concorrente. Nunca responda com 'ola, tudo bem?' generico. Personalize, demonstre que leu a mensagem e ofereca valor imediato.",
      image: IMG.handshake,
      imagePosition: "right",
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 04 — TOM DE VOZ & SCRIPTS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 04",
      title: "Tom de Voz &\nScripts Padrao",
      subtitle: "Como falar a lingua Parket em cada canal.\nScripts prontos para os 12 cenarios mais comuns.",
    },
  },
  {
    type: "content",
    props: {
      title: "Tom de Voz Parket",
      label: "Guia de comunicacao",
      highlight: "Sofisticado sem ser frio. Acolhedor sem ser informal. Tecnico sem ser confuso. Direto sem ser seco.",
      items: [
        "SEMPRE: usar nome do cliente, ser especifico, demonstrar conhecimento tecnico",
        "NUNCA: usar diminutivos (pisinhos, madeirinha), girias, emojis excessivos",
        "WhatsApp: frases curtas, paragrafos separados, audio so se o cliente preferir (max 1 min)",
        "E-mail: saudacao formal, corpo objetivo, assinatura padrao com dados de contato",
        "Telefone: apresentacao completa, tom calmo, confirmar entendimento antes de encerrar",
        "Presencial: contato visual, postura aberta, oferecer agua/cafe, demonstrar amostras",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Script: Primeiro Contato WhatsApp",
      label: "Template de abertura",
      highlight: "Adapte ao contexto, mas nunca pule: saudacao personalizada + reconhecimento do interesse + proxima acao clara.",
      items: [
        "\"Ola, [Nome]! Sou [seu nome], da Parket Pisos. Vi seu interesse em [escopo]. Que otimo!\"",
        "\"Trabalhamos com madeira natural de altissimo padrao — pisos, paineis, forros e marcenaria sob medida.\"",
        "\"Para entender melhor o que voce precisa: o projeto ja tem arquiteto definido? E para residencia ou comercial?\"",
        "\"Se preferir, posso agendar uma visita ao nosso showroom para voce conhecer as amostras ao vivo. Qual o melhor dia?\"",
        "// Regra: nunca enviar catalogo generico sem antes qualificar. Personalizar sempre.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Script: Follow-up de Proposta",
      label: "Quando o cliente sumiu",
      highlight: "O follow-up nao e cobranca — e demonstracao de cuidado e profissionalismo.",
      items: [
        "Dia 2: \"[Nome], compartilhei a proposta [data]. Ficou alguma duvida sobre escopo, prazo ou investimento?\"",
        "Dia 5: \"Ola, [Nome]! Encontrei um projeto similar ao seu que ficou incrivel. Posso enviar as fotos como referencia?\"",
        "Dia 10: \"[Nome], sei que decisoes assim levam tempo. Estou aqui quando precisar. So queria avisar que o prazo de entrega atual esta em [X semanas].\"",
        "Dia 20: \"Ola, [Nome]! Como esta o projeto? Se precisar revisitar a proposta com algum ajuste, e so me avisar.\"",
        "// Regra: apos 30 dias sem resposta, mover para nurturing automatico e registrar no CRM",
      ],
    },
  },
  {
    type: "dosdonts",
    props: {
      title: "Comunicacao:\nO Certo e o Errado",
      label: "Calibracao de tom",
      dos: [
        "\"Vou verificar com a equipe e retorno em ate 2 horas\"",
        "\"Entendo sua preocupacao. Vamos resolver assim:\"",
        "\"O prazo estimado e de 8 semanas. Se houver qualquer alteracao, aviso com antecedencia\"",
        "\"Obrigado por nos escolher. Vou te apresentar a Tainara, que vai acompanhar seu projeto\"",
      ],
      donts: [
        "\"Vou ver e te falo\" (sem prazo definido)",
        "\"Isso nao e comigo, vou transferir\" (sem contexto)",
        "\"O prazo e mais ou menos uns 2 meses\" (impreciso e informal)",
        "\"Oi, tudo bem? Em que posso ajudar?\" (generico demais)",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 05 — SLAs & TEMPOS DE RESPOSTA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 05",
      title: "SLAs & Tempos\nde Resposta",
      subtitle: "Prazos inegociaveis.\nO que o cliente espera vs. o que entregamos.",
    },
  },
  {
    type: "grid",
    props: {
      title: "Tabela de SLAs\npor Canal e Tipo",
      label: "Prazos maximos",
      cards: [
        { title: "WhatsApp — 1a resposta", description: "15 minutos no horario comercial. 1h fora do horario (mensagem programada)", icon: "⏱️" },
        { title: "WhatsApp — resolucao", description: "Simples: 2h. Media: 24h. Complexa: 48h com update a cada 12h", icon: "✅" },
        { title: "Telefone — atender", description: "Ate 3 toques. Se nao atender, retornar em ate 30 min", icon: "📞" },
        { title: "E-mail — resposta", description: "Confirmacao de recebimento: 1h. Resposta completa: 4h uteis", icon: "📧" },
        { title: "Reclamacao formal", description: "1a resposta: 2h. Plano de acao: 24h. Resolucao: 72h max", icon: "🚨" },
        { title: "Update de obra", description: "Proativo, toda sexta-feira ate 14h. Nao esperar o cliente perguntar", icon: "📋" },
        { title: "NPS pos-entrega", description: "Enviar em ate 48h apos termo de aceite. Coletar em ate 7 dias", icon: "⭐" },
        { title: "Pos-venda preventivo", description: "Contato em 30, 90 e 180 dias apos entrega. Registrar no CRM", icon: "🔄" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Protocolo de Escalacao",
      label: "Quando escalar e para quem",
      highlight: "Escalar nao e fraqueza — e protecao. Melhor escalar cedo demais do que tarde demais.",
      items: [
        "Nivel 1 (Tainara): Duvidas operacionais, status de obra, agendamentos, materiais",
        "Nivel 2 (Talita): Reclamacoes formais, atrasos > 5 dias, insatisfacao expressa, conflito com prestador",
        "Nivel 3 (Germano): Risco de cancelamento, crise reputacional, Reclame Aqui, valor > R$50k em risco",
        "Nivel 4 (Dani): Questoes contratuais, juridicas ou financeiras que exigem decisao executiva",
        "// Regra: ao escalar, enviar contexto completo (historico, prints, timeline) em 1 mensagem. Nunca escalar 'vazio'",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 06 — ATENDIMENTO NO SHOWROOM
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 06",
      title: "Atendimento\nno Showroom",
      subtitle: "O showroom e o palco. Cada visita\ne uma performance de marca.",
    },
  },
  {
    type: "split",
    props: {
      title: "Ritual de\nRecepcao",
      label: "Experiencia presencial",
      content: "Antes da visita: confirmar 24h antes, preparar amostras relevantes ao projeto, garantir showroom impecavel. Na chegada: recepcao calorosa, oferecer agua/cafe, apresentar o espaco. Durante: tour guiado pelas solucoes relevantes, demonstrar amostras no contexto do projeto do cliente. Na saida: resumo do que foi visto, proximos passos claros, enviar fotos/referencias em ate 2h.",
      image: parketSpiral,
      imagePosition: "left",
    },
  },
  {
    type: "process",
    props: {
      title: "Checklist de Visita\nao Showroom",
      label: "6 passos obrigatorios",
      steps: [
        { number: "01", title: "Pre-visita", description: "Confirmar horario, pesquisar perfil do cliente, separar amostras do escopo" },
        { number: "02", title: "Recepcao", description: "Cumprimentar por nome, oferecer agua/cafe, apresentar o showroom" },
        { number: "03", title: "Descoberta", description: "Perguntar sobre o projeto, estilo, referencias, prazo e orcamento esperado" },
        { number: "04", title: "Demonstracao", description: "Mostrar amostras relevantes, explicar diferenciais tecnicos, contar historias de projetos similares" },
        { number: "05", title: "Proximo passo", description: "Definir acao clara: orcamento, visita tecnica, envio de proposta. Agendar na hora" },
        { number: "06", title: "Pos-visita", description: "Em ate 2h: enviar resumo por WhatsApp + fotos das amostras escolhidas + link do portfolio" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 07 — GESTAO DE OCORRENCIAS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 07",
      title: "Gestao de\nOcorrencias",
      subtitle: "Problemas vao acontecer.\nO que nos define e como resolvemos.",
    },
  },
  {
    type: "statement",
    props: {
      statement: "O cliente nao lembra\ndo problema.\nEle lembra de como\nvoce resolveu.",
      label: "Principio de recuperacao",
      attribution: "Cultura de Atendimento Parket",
    },
  },
  {
    type: "grid",
    props: {
      title: "Classificacao de\nOcorrencias",
      label: "Severidade e prazo de resolucao",
      cards: [
        { title: "Nivel 1 — Informativa", description: "Duvida, pedido de status, solicitacao simples. Resolver em ate 2h", icon: "🟢" },
        { title: "Nivel 2 — Operacional", description: "Atraso menor, ajuste de agenda, troca de amostra. Resolver em 24h", icon: "🟡" },
        { title: "Nivel 3 — Critica", description: "Defeito em material, erro de medicao, atraso > 5 dias. Resolver em 48h", icon: "🟠" },
        { title: "Nivel 4 — Crise", description: "Risco de cancelamento, dano em obra, exposicao publica. Acionar em 1h", icon: "🔴" },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Protocolo de\nResolucao",
      label: "5 passos para toda ocorrencia",
      steps: [
        { number: "01", title: "Registrar", description: "CRM obrigatorio: data, cliente, descricao, evidencia fotografica, classificacao" },
        { number: "02", title: "Reconhecer", description: "Mensagem ao cliente em ate 1h: 'Recebemos, estamos analisando, retorno em [prazo]'" },
        { number: "03", title: "Diagnosticar", description: "Identificar causa raiz: Parket, obra, prestador ou cliente? Envolver area responsavel" },
        { number: "04", title: "Resolver", description: "Executar solucao dentro do SLA. Se precisar de mais tempo, comunicar e repactuar" },
        { number: "05", title: "Fechar", description: "Confirmar resolucao com cliente, registrar aprendizado, atualizar checklist se necessario" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Scripts de Recuperacao",
      label: "O que dizer quando algo da errado",
      highlight: "Assuma a responsabilidade primeiro, mesmo que a culpa nao seja da Parket. Resolva, depois investigue internamente.",
      items: [
        "Atraso: \"[Nome], preciso ser transparente: tivemos um imprevisto com [contexto]. O novo prazo e [data]. Vou te atualizar [frequencia].\"",
        "Defeito: \"[Nome], identificamos um ponto que precisa de ajuste em [detalhe]. Ja estamos com a solucao em andamento e o prazo e [data].\"",
        "Erro nosso: \"[Nome], assumimos — houve uma falha no [processo]. Ja corrigimos e isso e o que estamos fazendo para garantir que nao se repita: [acao].\"",
        "Cliente irritado: \"Entendo completamente sua frustracao, [Nome]. Voce tem razao em cobrar. Vou pessoalmente garantir que isso se resolva ate [data/hora].\"",
        "// Regra de ouro: nunca culpar outro departamento, prestador ou fornecedor na frente do cliente",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 08 — CRM & REGISTROS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 08",
      title: "CRM &\nRegistros",
      subtitle: "Se nao esta no CRM, nao aconteceu.\nRegistro e memoria institucional.",
    },
  },
  {
    type: "content",
    props: {
      title: "O Que Registrar — Sempre",
      label: "Campos obrigatorios no CRM",
      highlight: "O CRM e a fonte unica de verdade. Nenhuma informacao critica deve viver so na cabeca de alguem ou em um chat pessoal.",
      items: [
        "Todo contato (entrada ou saida): data, hora, canal, resumo em 1 linha",
        "Mudanca de status da obra: quem moveu, por que, evidencia",
        "Ocorrencia: classificacao, descricao, responsavel, prazo, status",
        "Compromissos agendados: visita, call, entrega, vistoria — com lembrete D-1",
        "Preferencias do cliente: horario de contato, canal preferido, tom, observacoes",
        "Documentos compartilhados: proposta, contrato, projeto, termo — com versao e data",
        "NPS e feedback: nota, comentario, acao tomada",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Tags Obrigatorias\nno CRM",
      label: "Padronizacao de registros",
      cards: [
        { title: "#primeiro-contato", description: "Quando o lead chega pela primeira vez. Registrar canal de origem", icon: "🏷️" },
        { title: "#follow-up", description: "Cada tentativa de contato com o cliente. Numerar sequencialmente", icon: "🔁" },
        { title: "#ocorrencia", description: "Qualquer problema reportado. Obrigatorio: severidade e prazo", icon: "⚠️" },
        { title: "#update-obra", description: "Atualizacao proativa de status. Incluir fotos quando possivel", icon: "📸" },
        { title: "#escalado", description: "Demanda que subiu de nivel. Registrar para quem e por que", icon: "⬆️" },
        { title: "#nps-coletado", description: "NPS registrado com nota e verbatim do cliente", icon: "⭐" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 09 — ATENDIMENTO DURANTE A OBRA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 09",
      title: "Atendimento\nDurante a Obra",
      subtitle: "A obra e o momento mais sensivel.\nAqui se ganha ou se perde o cliente para sempre.",
    },
  },
  {
    type: "split",
    props: {
      title: "Ritual de Update\nSemanal",
      label: "Cadencia inegociavel",
      content: "Toda sexta-feira ate 14h, o responsavel pelo atendimento da obra envia update proativo ao cliente: status geral, % de avancamento, fotos do progresso, proximos passos da semana seguinte e qualquer ponto de atencao. Isso elimina 80% das ligacoes de cobranca e mostra profissionalismo.",
      image: parketDeckLake,
      imagePosition: "right",
    },
  },
  {
    type: "content",
    props: {
      title: "Template: Update Semanal de Obra",
      label: "Copiar e adaptar",
      highlight: "Enviar por WhatsApp, sempre com fotos. O cliente quer ver, nao so ler.",
      items: [
        "\"Ola, [Nome]! Update semanal do seu projeto Parket 🏠\"",
        "\"📍 Status: [Fase atual — ex: instalacao do piso no living, 60% concluido]\"",
        "\"✅ Concluido esta semana: [o que foi feito]\"",
        "\"📋 Proxima semana: [o que esta planejado]\"",
        "\"⚠️ Pontos de atencao: [se houver, ser transparente. Se nao: 'Tudo dentro do cronograma!']\"",
        "\"📸 Fotos do progresso: [anexar 3-5 fotos de qualidade]\"",
        "\"Qualquer duvida, estou a disposicao. Bom fim de semana!\"",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Momentos Criticos na Obra",
      label: "Quando o atendimento precisa brilhar",
      highlight: "Estes sao os momentos onde a percepcao do cliente pode mudar drasticamente. Prepare-se para cada um.",
      items: [
        "Atraso na entrega de material: comunicar imediatamente + novo prazo + impacto no cronograma",
        "Problema na vistoria: explicar o que foi encontrado + solucao proposta + prazo ajustado",
        "Mudanca de equipe/prestador: apresentar o substituto + garantir continuidade + reforcar qualidade",
        "Pedido de aditivo: apresentar com transparencia + opcoes + impacto em prazo e valor",
        "Dia da entrega: presenca do atendimento, walkthrough guiado, momento 'wow', fotos profissionais",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 10 — POS-VENDA & FIDELIZACAO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 10",
      title: "Pos-Venda &\nFidelizacao",
      subtitle: "A venda nao termina na entrega.\nO pos-venda e a nova prospecao.",
    },
  },
  {
    type: "process",
    props: {
      title: "Cadencia de\nPos-Venda",
      label: "Timeline obrigatoria",
      steps: [
        { number: "D+2", title: "NPS e agradecimento", description: "Enviar pesquisa NPS + mensagem personalizada de agradecimento. Pedir depoimento" },
        { number: "D+30", title: "Check-in 30 dias", description: "\"Como esta o piso? Algum cuidado que posso orientar?\" + dicas de manutencao" },
        { number: "D+90", title: "Revisao preventiva", description: "Oferecer visita de revisao gratuita. Identificar novas oportunidades" },
        { number: "D+180", title: "Reativacao estrategica", description: "Novos lancamentos, eventos, indicacao. Manter o cliente no ecossistema Parket" },
        { number: "D+365", title: "Aniversario do projeto", description: "Mensagem comemorativa + oferta especial para novo projeto ou indicacao premium" },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Estrategias de\nFidelizacao",
      label: "Alem do NPS",
      cards: [
        { title: "Programa de indicacao", description: "Cliente que indica ganha beneficio tangivel. Rastrear no CRM com tag #indicacao", icon: "🤝" },
        { title: "Conteudo exclusivo", description: "Enviar tendencias, lancamentos e cases antes do publico geral. Lista VIP", icon: "💎" },
        { title: "Eventos Parket", description: "Convites para eventos no showroom, lancamentos de colecao, workshops de design", icon: "🎪" },
        { title: "Manutencao preventiva", description: "Programa de cuidado com o piso: dicas sazonais, produtos recomendados, revisoes", icon: "🔧" },
        { title: "Depoimento como legado", description: "Transformar projetos em cases para portfolio. Cliente vira embaixador", icon: "📖" },
        { title: "Cross-sell inteligente", description: "Fez piso? Oferecer painel. Fez marcenaria? Oferecer forro. Mapear potencial", icon: "🎯" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 11 — METRICAS & DASHBOARD
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 11",
      title: "Metricas &\nDashboard",
      subtitle: "O que medir, como medir e\ncom que frequencia revisar.",
    },
  },
  {
    type: "metrics",
    props: {
      title: "10 KPIs do Atendimento",
      label: "Dashboard semanal",
      metrics: [
        { metric: "Tempo medio 1a resposta", target: "< 15 min", current: "Medir", unit: "min" },
        { metric: "Taxa resolucao 1o contato", target: "> 65%", current: "Medir", unit: "%" },
        { metric: "NPS geral", target: "> 80", current: "Medir", unit: "pts" },
        { metric: "Ocorrencias abertas", target: "< 5 simultaneas", current: "Medir", unit: "un" },
        { metric: "SLA cumprido", target: "> 95%", current: "Medir", unit: "%" },
        { metric: "Updates de obra no prazo", target: "100%", current: "Medir", unit: "%" },
        { metric: "NPS coletados / entregas", target: "> 90%", current: "Medir", unit: "%" },
        { metric: "Taxa de recompra/indicacao", target: "> 30%", current: "Medir", unit: "%" },
        { metric: "Reclamacoes Reclame Aqui", target: "Zero sem resposta", current: "Medir", unit: "un" },
        { metric: "Tempo medio resolucao", target: "< 24h", current: "Medir", unit: "horas" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Rotina de Revisao\nde Metricas",
      label: "Cadencia de gestao",
      highlight: "Metrica que ninguem olha nao muda comportamento. Defina ritual, dono e consequencia.",
      items: [
        "Diario (Talita): checar SLAs do dia, ocorrencias abertas, follow-ups atrasados",
        "Semanal (Talita + time): dashboard de 10 KPIs, casos criticos, calibracao de tom",
        "Quinzenal (Talita + Germano): revisao de NPS, reclamacoes, oportunidades de melhoria",
        "Mensal (lideranca): relatorio consolidado, tendencias, comparativo com metas, planos de acao",
        "Trimestral: pesquisa de satisfacao mais profunda com clientes ativos e recentes",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 12 — FERRAMENTAS & AUTOMACOES
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 12",
      title: "Ferramentas &\nAutomacoes",
      subtitle: "Tecnologia a servico do atendimento.\nO que automatizar e o que manter humano.",
    },
  },
  {
    type: "grid",
    props: {
      title: "Stack de Ferramentas\ndo Atendimento",
      label: "O que usar e para que",
      cards: [
        { title: "CRM (Pipeline)", description: "Fonte unica de verdade: leads, obras, historico, tarefas, follow-ups. Todos usam", icon: "💻" },
        { title: "WhatsApp Business API", description: "Canal principal. Mensagens programadas, templates aprovados, etiquetas de status", icon: "📱" },
        { title: "Agente IA — Triagem", description: "Bot de 1a linha: qualificar lead, responder FAQ, agendar visita. Humano assume em 1 click", icon: "🤖" },
        { title: "Planilha de SLA", description: "Controle diario de tempos de resposta e resolucao. Alimenta dashboard", icon: "📊" },
        { title: "Google Drive / Pasta Obra", description: "Documentos, fotos, projetos, termos — tudo centralizado por obra", icon: "📁" },
        { title: "NPS Tool", description: "Envio automatico pos-entrega. Coleta, analise e alertas por nota", icon: "⭐" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "O Que Automatizar\nvs. Manter Humano",
      label: "Equilibrio critico",
      highlight: "Automatize o repetitivo para liberar tempo para o que importa: a conexao humana.",
      items: [
        "✅ AUTOMATIZAR: confirmacao de recebimento, lembrete D-1, envio de NPS, follow-up padrao",
        "✅ AUTOMATIZAR: alerta de SLA proximo de vencer, relatorio semanal, tag automatica no CRM",
        "❌ MANTER HUMANO: resolucao de ocorrencias, comunicacao de problemas, onboarding pos-contrato",
        "❌ MANTER HUMANO: visita ao showroom, update semanal de obra (personalizado), gestao de crise",
        "❌ MANTER HUMANO: negociacao, empatia genuina, momentos 'wow', relacionamento de longo prazo",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 13 — TREINAMENTO & EVOLUCAO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 13",
      title: "Treinamento &\nEvolucao Continua",
      subtitle: "O playbook e vivo.\nTreinar, calibrar, melhorar — sempre.",
    },
  },
  {
    type: "process",
    props: {
      title: "Programa de\nOnboarding Atendimento",
      label: "Primeiros 30 dias de um novo membro",
      steps: [
        { number: "S1", title: "Imersao Parket", description: "Historia, produtos, diferenciais, tour showroom, acompanhar 10 atendimentos" },
        { number: "S2", title: "Sistemas e processos", description: "CRM, WhatsApp Business, templates, SLAs, protocolos de escalacao" },
        { number: "S3", title: "Atendimento supervisionado", description: "Atender com supervisao: 5 leads + 3 clientes ativos. Feedback diario" },
        { number: "S4", title: "Autonomia progressiva", description: "Atendimento autonomo com revisao semanal. Certificacao se atingir SLAs" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Calibracao Mensal de Tom",
      label: "Ritual de qualidade",
      highlight: "Todo mes, Talita seleciona 10 atendimentos aleatorios para revisao em grupo. O objetivo nao e punir — e calibrar.",
      items: [
        "Selecionar 5 atendimentos bons e 5 com oportunidade de melhoria",
        "Revisao em grupo: o que funcionou? O que poderia ser diferente?",
        "Atualizar scripts e templates com base nos aprendizados",
        "Reconhecer publicamente os melhores atendimentos do mes",
        "Documentar no playbook — este documento e vivo e evolui com o time",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     FECHAMENTO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "statement",
    props: {
      statement: "Cada interacao e\numa oportunidade de\nprovar que a Parket e\ntao premium no cuidado\nquanto no produto.",
      label: "Compromisso de Atendimento",
      attribution: "Parket Pisos",
    },
  },
  {
    type: "closing",
    props: {
      title: "Playbook de\nAtendimento",
      subtitle: "13 capitulos — do primeiro contato ao pos-venda.\nProtocolos, SLAs, scripts, metricas e rituais\npara atendimento de altissimo padrao.",
      image: IMG.wood,
    },
  },
];
