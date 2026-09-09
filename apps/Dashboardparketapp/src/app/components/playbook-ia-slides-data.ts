import { type SlideData } from "./slides-data";

/* ─── Images ─── */
const IMG_NEURAL = "https://images.unsplash.com/photo-1737505598998-693328b57ae3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbWluaW1hbCUyMHRlY2hub2xvZ3klMjBuZXVyYWwlMjBuZXR3b3JrJTIwYWJzdHJhY3R8ZW58MXx8fHwxNzcxODExMzU4fDA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_SERVER = "https://images.unsplash.com/photo-1680992046626-418f7e910589?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzZXJ2ZXIlMjByb29tJTIwZGF0YSUyMGNlbnRlciUyMGRhcmt8ZW58MXx8fHwxNzcxNzUwOTA1fDA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_MEETING = "https://images.unsplash.com/photo-1764255120215-9bb4665b44cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjBtZWV0aW5nJTIwZGFyayUyMGdsYXNzfGVufDF8fHx8MTc3MTgxMTM2M3ww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_DASHBOARD = "https://images.unsplash.com/photo-1575388902449-6bca946ad549?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXNoYm9hcmQlMjBhbmFseXRpY3MlMjBzY3JlZW4lMjBkYXJrJTIwbWluaW1hbHxlbnwxfHx8fDE3NzE4MTEzNjV8MA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_PHONE = "https://images.unsplash.com/photo-1678329886668-6f44024b9ae6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWFydHBob25lJTIwd2hhdHNhcHAlMjBidXNpbmVzcyUyMGNvbW11bmljYXRpb24lMjBkYXJrfGVufDF8fHx8MTc3MTgxMTM2OHww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_CONSTRUCTION = "https://images.unsplash.com/photo-1768223903619-637df53d3908?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwbW9kZXJuJTIwYnVpbGRpbmclMjBwcm9ncmVzc3xlbnwxfHx8fDE3NzE3NjE1MzJ8MA&ixlib=rb-4.1.0&q=80&w=1080";

export const playbookIASlides: SlideData[] = [

  /* ═══════════════════════════════════════════════════════════
     00 · CAPA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "cover",
    props: {
      title: "Playbook de\nImplementação IA",
      subtitle: "O escritório de agentes inteligentes da Parket.\nArquitetura, governança, áreas e plano de 6 semanas.\nCada agente com missão, regra e limite.",
      image: IMG_NEURAL,
    },
  },

  /* ═══════════════════════════════════════════════════════════
     01 · POR QUE IA NA PARKET
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 00",
      title: "Por que\nIA na Parket",
      subtitle: "O problema real e o que a IA resolve (e o que não resolve).",
    },
  },
  {
    type: "statement",
    props: {
      statement: "A IA não substitui\nninguém.\nEla impede que\no processo quebre\nentre as pessoas.",
      attribution: "Princípio #1 do Escritório de Agentes",
      label: "Manifesto",
    },
  },
  {
    type: "content",
    props: {
      title: "O que a IA resolve\nnesta empresa",
      label: "Contexto",
      highlight: "Cada agente existe para eliminar uma falha recorrente — não para gerar relatórios bonitos.",
      items: [
        "PROBLEMA 1 — Informação mora na cabeça de alguém. Quando essa pessoa não está, o processo para.",
        "PROBLEMA 2 — Handoffs entre áreas perdem dados. Comercial entrega incompleto → Projetos improvisa → Obras descobre na hora.",
        "PROBLEMA 3 — Ninguém sabe o status real de 20 obras ao mesmo tempo. O fundador vira o \"sistema\" da empresa.",
        "PROBLEMA 4 — Checklist, diário, evidência — tudo existe no papel. Na prática, pula quando aperta.",
        "PROBLEMA 5 — Decisões financeiras (desconto, urgência, aditivo) acontecem sem registro e sem análise de impacto.",
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "O que a IA faz vs.\no que ela nunca faz",
      label: "Limites Claros",
      leftTitle: "O que a IA faz",
      leftItems: [
        "Valida dados antes de avançar",
        "Cobra evidência e checklist",
        "Gera relatórios automáticos",
        "Dispara alertas de risco",
        "Bloqueia processo sem gate aprovado",
        "Responde status e estoque em tempo real",
        "Prepara pautas e atas de reunião",
      ],
      rightTitle: "O que a IA NUNCA faz",
      rightItems: [
        "Decide desconto ou exceção financeira",
        "Aprova mudança de escopo ou aditivo",
        "Envia mensagem para cliente sem aprovação",
        "Substitui julgamento técnico de obra",
        "Toma decisão com risco legal",
        "Muda prioridade de produção sozinha",
        "Executa pagamento ou compra",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#E85D5D",
    },
  },

  /* ═══════════════════════════════════════════════════════════
     02 · ARQUITETURA — OS 3 PLANOS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 01",
      title: "Arquitetura\nque para de pé",
      subtitle: "3 planos, 1 escritório de agentes, zero bot solto.",
    },
  },
  {
    type: "statement",
    props: {
      statement: "WhatsApp é a boca.\nOpenClaw é o cérebro.\nCRM/ERP é a memória.\nNenhum funciona\nsem os outros dois.",
      attribution: "Regra de Arquitetura",
      label: "Os 3 Planos",
    },
  },
  {
    type: "content",
    props: {
      title: "Plano 1 — Interface\n(WhatsApp + Grupos)",
      label: "Camada de Interação",
      highlight: "WhatsApp é o canal de interação com humanos. Serve para pedir, responder, cobrar, lembrar. NUNCA é a fonte final de verdade.",
      items: [
        "FUNÇÃO — Canal de comunicação rápida entre humanos e agentes. Velocidade máxima, rastreabilidade zero.",
        "REGRA DE OURO — Tudo que virar decisão, mudança, compra, prazo ou aceite precisa ser espelhado em até 2h no CRM/ERP.",
        "CANAIS — Um número WhatsApp por agente de área. Agente de Obras entra nos grupos de obra.",
        "COMPORTAMENTO — Agente não conversa o tempo todo. Ele cobra, registra, alerta. Modo gatekeeper, não chatbot.",
        "SESSÕES — OpenClaw separa sessões por grupo/número, isolando contexto e auditoria por obra.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Plano 2 — Controle\n(OpenClaw)",
      label: "Gateway de Execução",
      highlight: "OpenClaw é o orquestrador: conecta canais (WhatsApp), ferramentas (CRM, ERP, BI, Drive) e executa os agentes com regras definidas.",
      items: [
        "FUNÇÃO — Gateway central que recebe pedidos dos canais, consulta sistemas, executa regras e devolve respostas/ações.",
        "CONEXÕES — WhatsApp API, CRM, ERP, Google Drive, BI dashboards, calendário, e-mail.",
        "AGENTES — Cada agente é um conjunto de regras, prompts e ferramentas. Não é magia: é lógica de negócio codificada.",
        "SEGURANÇA — Credenciais por agente, logs de toda ação, níveis de permissão por tipo de operação.",
        "ESCALABILIDADE — Começa com 3 obras piloto. Depois 20. Depois 100. A arquitetura é a mesma.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Plano 3 — Verdade\n(CRM + ERP)",
      label: "System of Record",
      highlight: "CRM e ERP são o system of record. Todo evento relevante vira registro estruturado: tarefa, decisão, evidência, status, SLA.",
      items: [
        "FUNÇÃO — Fonte única de verdade. Se não está registrado aqui, não aconteceu.",
        "REGISTROS — Tarefas com dono e prazo, decisões com evidência, status de obra, compras, medições, NCs.",
        "VERSÃO — Controle de versão de documentos. Nunca mais trabalhar na versão errada.",
        "AUDITORIA — Todo registro tem timestamp, autor e origem (humano ou agente).",
        "RELATÓRIOS — Dashboards semanais gerados automaticamente a partir dos dados estruturados.",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     03 · ORGANOGRAMA DO ESCRITÓRIO DE AGENTES
     ═══════════════════════════════════════════════════════════ */
  {
    type: "statement",
    props: {
      statement: "Você não quer\n12 bots soltos.\nVocê quer um escritório\ncom hierarquia\ne contratos.",
      attribution: "Regra de Governança de Agentes",
      label: "Escritório de Agentes",
    },
  },
  {
    type: "grid",
    props: {
      title: "Organograma do\nEscritório de Agentes",
      label: "Hierarquia",
      items: [
        { title: "Control Tower", desc: "O CEO do escritório. Consolida verdade semanal, detecta risco, impõe prioridades, prepara decisões e cobra execução. Não executa — dirige." },
        { title: "Agentes por Área", desc: "Validam inputs, geram outputs, bloqueiam avanço sem evidência, produzem relatórios. Modo: gatekeeper + auditor." },
        { title: "Conselho Virtual", desc: "Modo de decisão do Control Tower: consulta 3 agentes (Obras + Financeiro + Comercial) para decisão relevante. Produz recomendação com tradeoffs." },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Control Tower\n— O CEO do Escritório",
      label: "Agente Principal",
      highlight: "O Control Tower não executa compras, contratos ou pagamentos. Ele consolida, detecta, prioriza e cobra. É o cérebro da operação.",
      items: [
        "MISSÃO — Visão 360 de todas as obras, áreas e riscos. Consolida em 1 painel semanal.",
        "INPUTS — Score de risco por obra, pipeline comercial, forecast financeiro, fila de produção, NCs abertas.",
        "OUTPUTS — Relatório semanal da operação, alertas de risco, recomendações de priorização, pauta de reunião de diretoria.",
        "ROTINA — Todo domingo à noite: puxa dados, calcula scores, gera relatório. Segunda de manhã: diretoria recebe.",
        "CONSELHO — Quando decisão relevante, consulta agentes de Obras, Financeiro e Comercial. Gera recomendação com 3 cenários.",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Mapa de Agentes\npor Área",
      label: "Time Completo",
      items: [
        { title: "🔨 Obras", desc: "Gatekeeper de frente liberada, diário, evidência e NC. Copiloto do coordenador." },
        { title: "💼 Comercial", desc: "Qualificação, disciplina CRM, proteção de margem, auditoria de follow-up." },
        { title: "💰 Financeiro", desc: "Proteção de caixa e margem por obra, controle de exceções, radar de risco." },
        { title: "📦 Expedição", desc: "Estoque em tempo real, picking list, conferência, OTIF." },
        { title: "🏭 Produção", desc: "Fila por prioridade, capacidade vs demanda, OTIF de fabricação." },
        { title: "🛒 Compras", desc: "Validação técnica, lead time, catálogo, urgências e score fornecedor." },
        { title: "📑 Fiscal", desc: "Validação de campos, checklist por operação, fila de emissão." },
        { title: "📊 PMO", desc: "Score de risco, balanceamento de recursos, war room automático." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     04 · REUNIÕES — PRESENTE SEM VIRAR TEATRO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 02",
      title: "Presente em\ntoda reunião",
      subtitle: "3 artefatos por reunião. Antes, durante, depois.",
    },
  },
  {
    type: "statement",
    props: {
      statement: "O poder não está\nem assistir reunião.\nEstá em chegar preparado,\nsair com tarefas\ne cobrar execução.",
      attribution: "Princípio de Reunião",
      label: "IA em Reuniões",
    },
  },
  {
    type: "content",
    props: {
      title: "Antes da Reunião\n— Pauta Automática",
      label: "Artefato 1: Briefing",
      highlight: "O Control Tower puxa dados automaticamente e gera pauta de 10 minutos. Ninguém chega sem saber o que está queimando.",
      items: [
        "PUXA AUTOMÁTICO — Último relatório semanal da obra, cronograma baseline, plano semanal, lista de bloqueios e riscos.",
        "PUXA AUTOMÁTICO — Pendências de decisão, NC e retrabalho recentes, score de risco atualizado.",
        "GERA PAUTA — 3 coisas que podem estourar esta semana.",
        "GERA PAUTA — 3 decisões pendentes que precisam de aprovação agora.",
        "GERA PAUTA — 3 compromissos da semana anterior com status (feito / atrasado / bloqueado).",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Durante a Reunião\n— Ata Expressa",
      label: "Artefato 2: Registro",
      highlight: "Regra: tudo que for decisão vira Log de Decisões em tempo real. Ao final, alguém confirma em template de 8 campos.",
      items: [
        "CAMPO 1 — Decisões tomadas (o que foi decidido, com contexto).",
        "CAMPO 2 — Responsáveis (quem executa cada item, nominalmente).",
        "CAMPO 3 — Prazos (data-limite objetiva, não \"o mais rápido possível\").",
        "CAMPO 4 — Evidência exigida (o que comprova execução: foto, documento, aprovação).",
        "CAMPO 5 — Bloqueios identificados (o que pode impedir a execução).",
        "CAMPO 6 — Próximo checkpoint (quando se confere se foi feito).",
        "OPÇÃO — OpenClaw pode transcrever e registrar automaticamente, mas o padrão é: humano confirma ao final.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Depois da Reunião\n— Execução Automática",
      label: "Artefato 3: Tarefas",
      highlight: "O Control Tower transforma ata em ação: cria tarefas no sistema e publica resumo no WhatsApp em até 30 minutos após a reunião.",
      items: [
        "PUBLICA — Resumo executivo de 10 linhas no grupo relevante.",
        "CRIA — Lista de tarefas com dono, prazo e critério de \"feito\" no sistema de tarefas.",
        "CRIA — Lista de bloqueios com próximos passos e responsável por destravá-los.",
        "EMITE — Alertas de risco da semana para as pessoas certas.",
        "COBRA — Na véspera do checkpoint, lembra o responsável. No dia, cobra evidência.",
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Fluxo de Reunião\ncom IA",
      label: "Ciclo Completo",
      steps: [
        { title: "Control Tower puxa dados", desc: "Score, bloqueios, pendências, NCs, cronograma." },
        { title: "Gera pauta em 10 min", desc: "3 riscos + 3 decisões + 3 compromissos." },
        { title: "Reunião acontece", desc: "Ata expressa preenchida ao final: 8 campos." },
        { title: "Tarefas criadas no sistema", desc: "Cada decisão vira tarefa com dono e prazo." },
        { title: "Resumo no WhatsApp", desc: "10 linhas + alertas. Em até 30 min." },
        { title: "Cobrança automática", desc: "Véspera: lembrete. Dia: cobra evidência." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     05 · ANTECIPAÇÃO DE PROBLEMAS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 03",
      title: "Antecipar\nproblemas",
      subtitle: "Score de risco, leading indicators e War Room automático.",
    },
  },
  {
    type: "statement",
    props: {
      statement: "Você não precisa\nde previsão sofisticada.\nPrecisa de 6 sinais\nque gritam \"vai\nestourar em 10 dias\".",
      attribution: "Leading Indicators > Machine Learning",
      label: "Antecipação",
    },
  },
  {
    type: "grid",
    props: {
      title: "Score de Risco\npor Obra — Semanal",
      label: "6 Inputs Obrigatórios",
      items: [
        { title: "Atraso em Gates", desc: "Freeze, Compra validada, Frente liberada, Aceite. Cada gate atrasado adiciona pontos de risco." },
        { title: "Urgência de Compras", desc: "Índice de compras urgentes e fretes extras. Urgência = falha de planejamento." },
        { title: "Diário Incompleto", desc: "Dias sem evidência fotográfica. Sem diário = obra invisível." },
        { title: "NC e FPY", desc: "Não-conformidades por 100 entregas e First Pass Yield (taxa de acerto de primeira)." },
        { title: "Dependências do Cliente", desc: "Decisões ou liberações pendentes do cliente há mais de X dias." },
        { title: "Lead Times Críticos", desc: "Itens com lead time longo sem plano B. Risco de parar obra por material." },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Saída do Score\nde Risco",
      label: "Ações Automáticas",
      highlight: "Score 0 a 100 por obra, atualizado semanalmente. Se < 60, entra em War Room automaticamente.",
      items: [
        "SCORE — Número de 0 a 100 calculado pela média ponderada dos 6 inputs. Quanto menor, pior.",
        "MOTIVOS — Lista objetiva dos fatores que derrubaram o score. Sem \"opinião\", apenas dados.",
        "AÇÕES — Recomendações automáticas com dono e SLA. Ex: \"Resolver NC #42 até sexta — Responsável: João\".",
        "WAR ROOM — Score < 60 = entrada automática. Reunião 20 min 2x/semana até estabilizar.",
        "TENDÊNCIA — Comparação com semana anterior. Subindo ou descendo? Por quê?",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "War Room\nAutomático",
      label: "Protocolo de Crise",
      highlight: "War Room não é punição. É protocolo de recuperação com foco, frequência e saída clara.",
      items: [
        "CRITÉRIOS DE ENTRADA — Score < 60, gate atrasado > X dias, 2 semanas de NC alta, cliente em escalonamento.",
        "FORMATO — Reunião 20 minutos, 2x por semana, até sair do risco. Sem desculpa, só dados e ações.",
        "PLANO — 5 ações de recuperação, 1 dono por ação, prazo máximo de 1 semana por ação.",
        "CONGELAMENTO — Mudanças não críticas são congeladas até estabilizar. Foco total na recuperação.",
        "SAÍDA — Score volta a > 70 por 2 semanas consecutivas. Volta para rotina normal.",
      ],
    },
  },
  {
    type: "metrics",
    props: {
      title: "Indicadores de\nAntecipação",
      label: "Leading vs Lagging",
      metrics: [
        { value: "< 60", label: "Score que ativa War Room" },
        { value: "7-14d", label: "Antecedência de sinal de risco" },
        { value: "2x/sem", label: "Frequência War Room" },
        { value: "> 70", label: "Score para sair de War Room" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     06 · WHATSAPP POR ÁREA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 04",
      title: "WhatsApp\nsem explodir",
      subtitle: "Regra operacional, modelo de canais e comportamento de agente.",
    },
  },
  {
    type: "statement",
    props: {
      statement: "WhatsApp é excelente\npara velocidade.\nÉ péssimo para\nrastreabilidade.\nUse para um.\nProteja do outro.",
      attribution: "Regra de Canal",
      label: "WhatsApp",
    },
  },
  {
    type: "content",
    props: {
      title: "Regra Operacional\nde WhatsApp",
      label: "O Mandamento",
      highlight: "REGRA: Tudo que virar decisão, mudança, compra, prazo ou aceite precisa ser espelhado em até 2 horas no CRM/ERP ou sistema de tarefas.",
      items: [
        "MODELO — Um número WhatsApp por agente de área para coordenadores pedirem ajuda e registrarem eventos.",
        "GRUPOS DE OBRA — Agente de Obras entra em todos os grupos, mas com comportamento restrito.",
        "SESSÕES — OpenClaw separa sessões por grupo. Cada grupo = 1 contexto isolado. Facilita auditoria.",
        "PROIBIDO — Decisão que só existe no WhatsApp não conta. Precisa de registro formal.",
        "BACKUP — Se WhatsApp cair, o sistema continua funcionando via CRM/ERP. WhatsApp é conveniência, não dependência.",
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Comportamento do Agente\nnos Grupos de Obra",
      label: "O que faz vs. O que não faz",
      leftTitle: "O que o agente faz",
      leftItems: [
        "Cobra evidência e padrões no prazo",
        "Registra decisões e cria tarefas",
        "Emite alertas de risco ou ausência de dados",
        "Responde status de obra e estoque",
        "Publica resumo semanal e alertas",
        "Lembra prazos e cobranças pendentes",
      ],
      rightTitle: "O que o agente NÃO faz",
      rightItems: [
        "Conversar o tempo todo como chatbot",
        "Participar de discussões informais",
        "Tomar decisão sem aprovação humana",
        "Mandar mensagem para cliente/arquiteto",
        "Ignorar protocolo por urgência verbal",
        "Aprovar exceção financeira ou de escopo",
      ],
      leftColor: "#7BC48A",
      rightColor: "#E85D5D",
    },
  },
  {
    type: "grid",
    props: {
      title: "Modelo de Canais\nWhatsApp",
      label: "Estrutura",
      items: [
        { title: "🔨 Obras WhatsApp", desc: "1 número por agente. Entra nos grupos de obra. Cobra diário, evidência, registra decisões." },
        { title: "💼 Comercial WhatsApp", desc: "1 número. Responde status de proposta, cobra follow-up, valida qualificação." },
        { title: "💰 Financeiro WhatsApp", desc: "1 número. Responde sobre pagamentos, alertas de desvio, exceções pendentes." },
        { title: "📦 Expedição WhatsApp", desc: "1 número. Responde estoque em tempo real, status de separação e entrega." },
        { title: "🏭 Produção WhatsApp", desc: "1 número. Fila de produção, datas de necessidade, alertas de atraso." },
        { title: "🛒 Compras WhatsApp", desc: "1 número. Status de PO, lead time, urgências e fornecedor." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     07 · AGENTES POR ÁREA — DETALHAMENTO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 05",
      title: "Agentes\npor área",
      subtitle: "Missão, inputs, ações e limites de cada agente.",
    },
  },

  /* ─── 5.1 AGENTE OBRAS ─── */
  {
    type: "statement",
    props: {
      statement: "O Agente de Obras\né o fiscal digital\nque nunca dorme,\nnunca esquece\ne nunca aceita\n\"depois eu preencho\".",
      attribution: "Função: Gatekeeper + Auditor de Campo",
      label: "Agente Obras",
    },
  },
  {
    type: "content",
    props: {
      title: "Agente Obras\n— Função e Entradas",
      label: "5.1 Obras",
      highlight: "Copiloto do fiscal e do coordenador de obras. Gatekeeper de Frente Liberada, Diário, Evidência e NC.",
      items: [
        "INPUT — Cronograma baseline e plano semanal atualizado.",
        "INPUT — Checklist de frente liberada (base, umidade, prumo, acesso).",
        "INPUT — Diário de obra com fotos: antes, durante, depois.",
        "INPUT — Lista de bloqueios e dependências do cliente.",
        "INPUT — NCs abertas com classificação e prazo de correção.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Agente Obras\n— Ações e Bloqueios",
      label: "5.1 Obras — Execução",
      highlight: "5 ações automáticas que protegem cada obra de erro silencioso.",
      items: [
        "AÇÃO 1 — Bloqueia início sem frente liberada aprovada e fotografada.",
        "AÇÃO 2 — Cobra diário de obra até horário fixo (ex: 17h). Se não chegou, alerta o coordenador.",
        "AÇÃO 3 — Abre NC automaticamente quando padrão de qualidade quebra (fotos insuficientes, checklist incompleto).",
        "AÇÃO 4 — Escalona quando score de risco passa do limite. Avisa líder → War Room se necessário.",
        "AÇÃO 5 — Gera relatório semanal de cada obra em 1 página: progresso, riscos, NCs, próximos gates.",
      ],
    },
  },

  /* ─── 5.2 AGENTE COMERCIAL ─── */
  {
    type: "content",
    props: {
      title: "Agente Comercial\n— Função e Entradas",
      label: "5.2 Comercial",
      highlight: "Qualificação, disciplina de CRM e proteção de margem. Analisador de propostas ganhas e perdidas.",
      items: [
        "INPUT — CRM com etapas e campos obrigatórios preenchidos.",
        "INPUT — Registro de visitas ao showroom, reuniões e propostas enviadas.",
        "INPUT — Follow-ups com prazo e status (feito / vencido / pendente).",
        "INPUT — Motivos de perda padronizados por categoria.",
        "INPUT — Aprovações de desconto e exceção com registro formal.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Agente Comercial\n— Ações e Proteções",
      label: "5.2 Comercial — Execução",
      highlight: "4 ações que blindam o funil comercial contra erosão de margem e pipeline estagnado.",
      items: [
        "AÇÃO 1 — Bloqueia envio de proposta sem ficha de qualificação completa (10 campos obrigatórios).",
        "AÇÃO 2 — Cobra follow-up vencido. Se > 3 dias atrasado, alerta o líder comercial.",
        "AÇÃO 3 — Gera dashboard semanal: atividade por vendedor, conversão por etapa, velocidade do funil, perdas por motivo.",
        "AÇÃO 4 — Sugere ações de recuperação para deals em risco (sem atividade > 7 dias, proposta sem retorno > 14 dias).",
      ],
    },
  },

  /* ─── 5.3 AGENTE FINANCEIRO ─── */
  {
    type: "content",
    props: {
      title: "Agente Financeiro\n— Função e Entradas",
      label: "5.3 Financeiro",
      highlight: "Proteção de caixa e margem por obra. Controle de exceções e radar de risco financeiro.",
      items: [
        "INPUT — Orçamento por obra com breakdown: material, MO, frete, overhead.",
        "INPUT — POs emitidas, medições, recebíveis e contas a pagar.",
        "INPUT — Painel de perdas: aditivos não cobrados, descontos, urgências, retrabalho.",
        "INPUT — Exceções: tudo que fugiu do processo normal (desconto, urgência, compra fora de PO).",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Agente Financeiro\n— Ações e Alertas",
      label: "5.3 Financeiro — Execução",
      highlight: "3 ações que protegem margem e caixa antes de estourar.",
      items: [
        "AÇÃO 1 — Bloqueia compra fora de PO e fora de orçamento. Se ultrapassar X%, exige dupla aprovação.",
        "AÇÃO 2 — Alerta de desvio de margem por obra. Quando custo real > Y% do orçado, dispara para diretoria.",
        "AÇÃO 3 — Relatório semanal por obra: margem atual, perdas acumuladas, forecast 8 semanas, riscos de caixa.",
        "EXTRA — Forecast automático: projeção de caixa 8 semanas com cenários (otimista / base / pessimista).",
      ],
    },
  },

  /* ─── 5.4 AGENTE EXPEDIÇÃO ─── */
  {
    type: "content",
    props: {
      title: "Agente Expedição\n— Estoque e Entrega",
      label: "5.4 Expedição",
      highlight: "Resposta instantânea de estoque no WhatsApp. Garantia de picking list por obra e conferência dupla.",
      items: [
        "INPUT — ERP: estoque por lote, localização, reserva por obra.",
        "INPUT — Ordens de separação, packing list, agendamento de entrega.",
        "AÇÃO 1 — Resposta instantânea de disponibilidade via WhatsApp: item, quantidade, localização, reserva.",
        "AÇÃO 2 — Bloqueia expedição sem conferência e evidência de embalagem (foto + checklist).",
        "AÇÃO 3 — Alerta de risco de falta para obras críticas (itens com estoque < mínimo e obra em < 7 dias).",
        "AÇÃO 4 — Report semanal de OTIF (On Time In Full) e avarias por obra.",
      ],
    },
  },

  /* ─── 5.5 AGENTE PRODUÇÃO ─── */
  {
    type: "content",
    props: {
      title: "Agente Produção\n— Fila e Capacidade",
      label: "5.5 Produção",
      highlight: "Previsibilidade de prazo, detecção de gargalo e balanceamento capacidade vs demanda.",
      items: [
        "INPUT — Fila de produção por célula, capacidade por máquina/equipe, ordens de produção ativas.",
        "INPUT — Lista de materiais críticos com status de compra e lead time.",
        "INPUT — Datas de necessidade por obra (quando o material tem que estar no canteiro).",
        "AÇÃO 1 — Report semanal de OTIF de produção: pedidos entregues no prazo vs atrasados.",
        "AÇÃO 2 — Alerta de risco de atraso por ordem e por obra, com X dias de antecedência.",
        "AÇÃO 3 — Recomenda ação: comprar mais, remanejar equipe, terceirizar, ou repriorizar fila.",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     08 · GOVERNANÇA DE DECISÃO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 06",
      title: "Governança\nde decisão",
      subtitle: "Autonomia com travas. 3 níveis de ação. Regra de ouro.",
    },
  },
  {
    type: "statement",
    props: {
      statement: "Autonomia sem trava\né um risco.\nBurocracia sem\nautonomia é inércia.\nO segredo é saber\nonde colocar cada uma.",
      attribution: "Princípio de Governança",
      label: "Governança IA",
    },
  },
  {
    type: "content",
    props: {
      title: "Nível 1\n— Pode fazer sozinho",
      label: "Autonomia Total",
      highlight: "Ações que o agente executa sem pedir permissão. São ações de registro, cobrança e consulta — nunca de decisão.",
      items: [
        "Gerar relatórios automáticos (semanal, por obra, por área).",
        "Criar tarefas no sistema com dono e prazo.",
        "Cobrar evidência de execução (diário, fotos, checklists).",
        "Atualizar dashboards e painéis em tempo real.",
        "Responder perguntas de status, estoque e cronograma.",
        "Emitir alertas de risco e lembretes de prazo.",
        "Registrar decisões de reunião como tarefas.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Nível 2\n— Aprovação humana simples",
      label: "Trava Leve",
      highlight: "Ações que o agente prepara mas só executa com OK de 1 pessoa autorizada. O agente monta, o humano aprova.",
      items: [
        "Enviar mensagem para cliente ou arquiteto (agente redige, humano confirma).",
        "Mudar prioridade de produção (agente sugere, líder de produção aprova).",
        "Escalonar fornecedor com cobrança formal (agente redige, compras aprova).",
        "Alterar cronograma baseline (agente calcula impacto, coordenador aprova).",
        "Publicar atualização semanal para cliente (agente gera, responsável comercial aprova).",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Nível 3\n— Dupla aprovação + registro",
      label: "Trava Forte",
      highlight: "Ações com risco financeiro ou legal. Exigem 2 aprovadores, motivo formal, evidência e log de auditoria.",
      items: [
        "Aprovar desconto ou exceção financeira (líder comercial + diretoria).",
        "Aprovar compra acima de limite definido (compras + financeiro).",
        "Aprovar aditivo ou mudança de escopo (coordenador + diretoria).",
        "Executar ações com risco legal (qualquer ação que possa gerar contrato ou obrigação).",
        "REGRA — Motivo documentado + evidência + 2 aprovadores + log com timestamp.",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Resumo de\nGovernança",
      label: "Matriz de Decisão",
      items: [
        { title: "Nível 1 — Faz sozinho", desc: "Relatórios, tarefas, cobranças, dashboards, consultas de status. Zero risco." },
        { title: "Nível 2 — 1 aprovação", desc: "Mensagem a cliente, mudança de prioridade, cronograma, cobrança formal. Risco médio." },
        { title: "Nível 3 — 2 aprovações + log", desc: "Desconto, compra grande, aditivo, risco legal. Risco alto. Auditável." },
        { title: "Regra de Ouro", desc: "Ações sensíveis SEMPRE exigem: motivo, evidência, aprovador e log de auditoria. Sem exceção." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     09 · PLANO DE IMPLEMENTAÇÃO — 6 SEMANAS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 07",
      title: "Plano de\n6 semanas",
      subtitle: "De fundamentos a escala. Semana a semana, com entregáveis claros.",
    },
  },
  {
    type: "statement",
    props: {
      statement: "Não implemente tudo\nde uma vez.\nComece com 3 obras.\nProve que funciona.\nDepois escale.",
      attribution: "Princípio de Implementação",
      label: "Rollout",
    },
  },
  {
    type: "content",
    props: {
      title: "Semana 1\n— Fundamentos",
      label: "Base do Sistema",
      highlight: "Nada funciona sem fundamentos. System of record, taxonomia, templates, Control Tower básico. 3 obras piloto.",
      items: [
        "DEFINIR — System of record: onde tarefas e decisões vivem (CRM/ERP). Não é WhatsApp, não é planilha.",
        "DEFINIR — Código de obra, status padrão, tags e templates. Taxonomia única para toda empresa.",
        "CRIAR — Control Tower v1 com dashboards básicos: lista de obras + score + alertas.",
        "SELECIONAR — 3 obras piloto com coordenadores engajados. Critério: 1 fácil, 1 média, 1 complexa.",
        "RESULTADO DA SEMANA — Sistema configurado, 3 obras cadastradas, Control Tower gerando primeiro relatório.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Semana 2\n— Agente de Obras",
      label: "Primeiro Agente",
      highlight: "O agente mais crítico primeiro. Obras determina se o sistema tem credibilidade no campo.",
      items: [
        "CONECTAR — Agente de Obras nos grupos WhatsApp das 3 obras piloto.",
        "IMPLEMENTAR — Frente liberada: checklist obrigatório antes de iniciar qualquer frente.",
        "IMPLEMENTAR — Diário de obra: cobrança automática de fotos e registro até 17h.",
        "IMPLEMENTAR — NC: abertura automática quando padrão quebra. Classificação e prazo de correção.",
        "IMPLEMENTAR — Score de risco v1: 3 inputs (gates, diário, NCs). Relatório semanal.",
        "RESULTADO DA SEMANA — Coordenadores usando o agente. Primeiro score de risco publicado.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Semana 3\n— Agente Comercial",
      label: "Funil e CRM",
      highlight: "Conectar CRM, disciplinar pipeline e começar a proteger margem desde a proposta.",
      items: [
        "CONECTAR — CRM com campos obrigatórios definidos. Motivos de perda padronizados.",
        "IMPLEMENTAR — Ficha de qualificação obrigatória antes de proposta (10 campos).",
        "IMPLEMENTAR — Cobrança de follow-up: alerta se vencido > 3 dias.",
        "IMPLEMENTAR — Aprovação de desconto: fluxo formal com registro.",
        "RESULTADO DA SEMANA — Pipeline visível, follow-ups cobrados, descontos registrados.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Semana 4\n— Financeiro + Compras",
      label: "Margem e Caixa",
      highlight: "Conectar ERP, proteger caixa, bloquear exceções perigosas e gerar forecast.",
      items: [
        "CONECTAR — ERP: fluxo de PO, medições, contas a pagar, recebíveis.",
        "IMPLEMENTAR — Bloqueio de compra fora de PO e fora de orçamento.",
        "IMPLEMENTAR — Alertas de exceção: desconto, urgência, aditivo não cobrado.",
        "IMPLEMENTAR — Forecast 8 semanas: projeção de caixa automática.",
        "IMPLEMENTAR — Margem por obra: custo real vs orçado, atualizado semanalmente.",
        "RESULTADO DA SEMANA — DRE por obra visível, exceções bloqueadas, forecast funcionando.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Semana 5\n— Produção + Expedição",
      label: "Fábrica e Entrega",
      highlight: "Fila de produção, datas de necessidade, estoque em tempo real e OTIF.",
      items: [
        "CONECTAR — Fila de produção com ordens, capacidade e datas de necessidade.",
        "IMPLEMENTAR — Resposta de estoque no WhatsApp: instantânea e por obra.",
        "IMPLEMENTAR — Picking list e conferência: bloqueio sem checklist aprovado.",
        "IMPLEMENTAR — OTIF de produção e expedição: medição semanal.",
        "IMPLEMENTAR — Alertas de falta de material para obras próximas.",
        "RESULTADO DA SEMANA — Estoque respondendo, picking list funcionando, OTIF medido.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Semana 6\n— Conselho e Escala",
      label: "Consolidação",
      highlight: "Instalar rotinas de reunião com IA, conselho virtual para decisões e preparar escala de 3 → 20 → 100 obras.",
      items: [
        "INSTALAR — Rotina de reuniões com ata expressa e tarefas automáticas.",
        "INSTALAR — Conselho virtual: Control Tower consulta Obras + Financeiro + Comercial para decisões relevantes.",
        "AVALIAR — Resultados das 3 obras piloto. O que funcionou, o que precisa ajustar.",
        "PLANEJAR — Escala: de 3 obras para 20, depois para 100 por ondas progressivas.",
        "DOCUMENTAR — Playbook de operação do escritório de agentes: quem faz o quê, quando, como.",
        "RESULTADO DA SEMANA — Sistema provado, ajustado e pronto para escala.",
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Roadmap\nde 6 Semanas",
      label: "Visão Geral",
      steps: [
        { title: "Sem 1 — Fundamentos", desc: "System of record, taxonomia, Control Tower, 3 obras piloto." },
        { title: "Sem 2 — Obras", desc: "Agente nos grupos, frente liberada, diário, NC, score." },
        { title: "Sem 3 — Comercial", desc: "CRM, qualificação, follow-up, desconto." },
        { title: "Sem 4 — Financeiro", desc: "ERP, PO, exceções, forecast 8 sem, margem." },
        { title: "Sem 5 — Produção", desc: "Fila, estoque, picking list, OTIF." },
        { title: "Sem 6 — Escala", desc: "Conselho, reuniões, avaliação, 3→20→100." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     10 · MÉTRICAS DE SUCESSO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 08",
      title: "Como saber\nse funcionou",
      subtitle: "Métricas de sucesso ao final das 6 semanas e beyond.",
    },
  },
  {
    type: "metrics",
    props: {
      title: "KPIs do Escritório\nde Agentes",
      label: "Métricas de Sucesso",
      metrics: [
        { value: "95%", label: "Diários preenchidos até 17h" },
        { value: "100%", label: "Gates com checklist aprovado" },
        { value: "< 2h", label: "Decisão espelhada no sistema" },
        { value: "0", label: "Compras fora de PO aprovadas" },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Indicadores de\nSucesso por Área",
      label: "O que medir",
      items: [
        { title: "Obras", desc: "Score médio > 70, diários 95%+, NCs com causa raiz, zero início sem frente liberada." },
        { title: "Comercial", desc: "Follow-up < 3 dias, 100% propostas com ficha completa, pipeline visível e atualizado diariamente." },
        { title: "Financeiro", desc: "DRE por obra atualizado semanalmente, forecast 8 semanas com < 10% desvio, zero compra fora de PO." },
        { title: "Produção", desc: "OTIF > 90%, fila de produção com datas reais, alertas de atraso com 7d antecedência." },
        { title: "Expedição", desc: "OTIF > 95%, zero expedição sem conferência, estoque respondendo em < 1 minuto." },
        { title: "Control Tower", desc: "Relatório semanal entregue 100%, War Room ativado automaticamente, decisões com log." },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Critérios de Escala\n3 → 20 → 100",
      label: "Quando Expandir",
      highlight: "Não escale o que não funciona. Só expande quando os critérios forem atingidos nas obras piloto.",
      items: [
        "CRITÉRIO 1 — 3 obras piloto com score > 70 por 3 semanas consecutivas.",
        "CRITÉRIO 2 — Coordenadores usando os agentes sem necessidade de suporte constante.",
        "CRITÉRIO 3 — Dashboards alimentados automaticamente (sem intervenção manual para gerar relatório).",
        "CRITÉRIO 4 — Zero regressão: nenhum processo que funcionava parou de funcionar por causa da IA.",
        "CRITÉRIO 5 — Feedback qualitativo: coordenadores dizem \"ajuda\" e não \"atrapalha\".",
        "ONDA 1 — 3 → 10 obras (2 semanas). ONDA 2 — 10 → 20 (2 semanas). ONDA 3 — 20 → todas (gradual).",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     11 · RISCOS E MITIGAÇÕES
     ═══════════════════════════════════════════════════════════ */
  {
    type: "content",
    props: {
      title: "Riscos da\nImplementação",
      label: "O que pode dar errado",
      highlight: "Implementar IA sem antecipar riscos é implementar problemas. Estes são os 6 mais prováveis.",
      items: [
        "RISCO 1 — Resistência do time: \"mais um sistema pra preencher\". MITIGAÇÃO: mostrar que reduz trabalho manual, não adiciona.",
        "RISCO 2 — Dados ruins = saída ruim. MITIGAÇÃO: começar simples (3 inputs) e ir adicionando conforme dados melhoram.",
        "RISCO 3 — Excesso de alertas cria fadiga. MITIGAÇÃO: calibrar thresholds nas primeiras 2 semanas. Menos é mais.",
        "RISCO 4 — Agente agindo sem trava. MITIGAÇÃO: começar com Nível 1 apenas. Nível 2 e 3 só com governança testada.",
        "RISCO 5 — Depender do WhatsApp para verdade. MITIGAÇÃO: regra de 2h para espelhamento. WhatsApp é canal, não registro.",
        "RISCO 6 — Escalar antes de provar. MITIGAÇÃO: critérios objetivos de escala (5 critérios definidos acima).",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     12 · COMO EXPLICAR PARA O TIME
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 09",
      title: "Como explicar\npara o time",
      subtitle: "FAQ, objeções comuns e a mensagem que cada área precisa ouvir.",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Objeções do Time\ne Respostas",
      label: "FAQ Interno",
      leftTitle: "O que vão perguntar",
      leftItems: [
        "\"Vai substituir meu emprego?\"",
        "\"É mais um sistema pra eu preencher?\"",
        "\"E se o agente errar?\"",
        "\"Quem decide, eu ou a IA?\"",
        "\"Isso funciona no canteiro de obra?\"",
        "\"E se o WhatsApp cair?\"",
      ],
      rightTitle: "O que responder",
      rightItems: [
        "Não. Ela elimina trabalho repetitivo para você focar no que importa.",
        "Não. Ela preenche por você quando possível. Quando não, pede 1 vez, não 5.",
        "Ela erra menos que planilha. E quando erra, tem log para corrigir.",
        "Você decide sempre. A IA prepara, sugere e cobra. Nunca decide sozinha.",
        "Funciona via WhatsApp, que já está no canteiro. Sem app novo.",
        "O sistema continua no CRM/ERP. WhatsApp é conveniência.",
      ],
      leftColor: "#E87C6C",
      rightColor: "#7BC48A",
    },
  },
  {
    type: "grid",
    props: {
      title: "A mensagem certa\npara cada área",
      label: "Comunicação Interna",
      items: [
        { title: "Para Coordenadores", desc: "\"O agente é seu copiloto. Ele cuida do burocrático para você cuidar da obra. Se funcionar, você trabalha menos à noite.\"" },
        { title: "Para Vendedores", desc: "\"O agente cuida do CRM e follow-up. Você foca no relacionamento e na venda. Ele lembra o que você esqueceria.\"" },
        { title: "Para Financeiro", desc: "\"O agente blinda contra exceções perigosas. Ninguém compra fora de PO sem você saber. Margem visível por obra.\"" },
        { title: "Para Produção", desc: "\"Fila clara, datas reais, alertas de atraso antes de virar urgência. Sem surpresa na segunda-feira.\"" },
        { title: "Para Expedição", desc: "\"Responde estoque sem parar o que está fazendo. Picking list correto, conferência garantida, erro zero.\"" },
        { title: "Para Diretoria", desc: "\"Visão 360 de toda operação. Decisão com dados, não com feeling. Risco antecipado, não descoberto na crise.\"" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     13 · FECHAMENTO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "statement",
    props: {
      statement: "A IA não é o destino.\nÉ a infraestrutura\nque permite que\ncada pessoa faça\no que faz de melhor\n— sem que o processo\nquebre no caminho.",
      attribution: "Parket Pisos — Escritório de Agentes IA",
      label: "Fechamento",
    },
  },
  {
    type: "closing",
    props: {
      title: "Playbook de\nImplementação IA",
      subtitle: "Arquitetura · Governança · Agentes por Área · Plano de 6 Semanas",
      items: [
        "3 planos: Interface → Controle → Verdade",
        "1 Control Tower + 8 agentes por área",
        "3 níveis de governança com travas",
        "Score de risco + War Room automático",
        "Rollout em 6 semanas: 3 → 20 → 100 obras",
        "Métricas de sucesso por área",
        "FAQ e comunicação para o time",
      ],
    },
  },
];
