import { type SlideData } from "./slides-data";

/* Sistema Nervoso Central - Guia para departamentos */
const IMG = {
  cover: "https://images.unsplash.com/photo-1664854953181-b12e6dda8b7c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXR3b3JrJTIwY29ubmVjdGlvbnMlMjBuZXVyYWwlMjBzeXN0ZW0lMjBhYnN0cmFjdCUyMGRhcmt8ZW58MXx8fHwxNzcyNDg5ODU1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  dashboard: "https://images.unsplash.com/photo-1579894097903-bf6a37819b79?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaWdpdGFsJTIwZGFzaGJvYXJkJTIwY29udHJvbCUyMGNlbnRlciUyMGRhcmslMjBtb2Rlcm58ZW58MXx8fHwxNzcyNDg5ODU0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  team: "https://images.unsplash.com/photo-1758876019380-0e5f636376b2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWFtJTIwY29sbGFib3JhdGlvbiUyMHdvcmtmbG93JTIwb2ZmaWNlJTIwbW9kZXJufGVufDF8fHx8MTc3MjQ4OTg1NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  ai: "https://images.unsplash.com/photo-1760931969401-9bd6ee902798?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpZmljaWFsJTIwaW50ZWxsaWdlbmNlJTIwYXV0b21hdGlvbiUyMGZ1dHVyaXN0aWMlMjBkYXJrfGVufDF8fHx8MTc3MjQ4OTg1OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  wood: "https://images.unsplash.com/photo-1769739132671-ac41c439d51e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3b29kJTIwZmxvb3JpbmclMjBpbnRlcmlvciUyMHByZW1pdW18ZW58MXx8fHwxNzcyNDg5ODU4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  kanban: "https://images.unsplash.com/photo-1743385779347-1549dabf1320?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9qZWN0JTIwbWFuYWdlbWVudCUyMGJvYXJkJTIwdGFza3MlMjBvcmdhbml6ZWR8ZW58MXx8fHwxNzcyNDg5ODYyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  handoff: "https://images.unsplash.com/photo-1663246544984-2730f63628b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYW5kc2hha2UlMjByZWxheSUyMGJhdG9uJTIwcGFzc2luZyUyMHRlYW13b3JrfGVufDF8fHx8MTc3MjQ4OTg2Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
};

export const sistemaNervosoSlides: SlideData[] = [

  /* ═══════════════════════════════════════════════════════════
     CAPA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "cover",
    props: {
      title: "Sistema Nervoso\nCentral",
      subtitle: "Como vai funcionar a aplicacao que estamos\nimplementando na Parket — explicado para\ncada pessoa e cada departamento.",
      image: IMG.cover,
    },
  },

  /* ═══════════════════════════════════════════════════════════
     MANIFESTO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "statement",
    props: {
      statement: "Hoje, informacao se perde\nentre WhatsApp, planilhas\ne cabecas. O Sistema Nervoso\nCentral muda isso.\nUma unica fonte de verdade\npara toda a Parket.",
      label: "Por que estamos fazendo isso",
      attribution: "Visao Parket 2025",
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 01 — VISAO GERAL
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 01",
      title: "Visao Geral",
      subtitle: "O que e o Sistema Nervoso Central,\npor que ele existe e o que muda no dia a dia.",
    },
  },

  {
    type: "split",
    props: {
      title: "O Problema Hoje",
      bullets: [
        "Informacao espalhada em WhatsApp, e-mails, planilhas e pastas soltas",
        "Ninguem sabe o status real de uma obra sem perguntar para 3 pessoas",
        "Passagem de bastao entre areas depende de boa vontade",
        "Erros so aparecem quando o cliente reclama",
        "Retrabalho constante por falta de checklist e evidencia",
        "Impossivel medir performance real de cada departamento",
      ],
      image: IMG.team,
    },
  },

  {
    type: "split",
    props: {
      title: "A Solucao: Sistema\nNervoso Central",
      bullets: [
        "Um sistema unico onde TUDO sobre cada obra/cliente esta registrado",
        "Cada area tem seu quadro Kanban proprio, mas conectado ao todo",
        "Passagem de bastao formal — com checklist, evidencia e validacao",
        "IA como coordenador: alerta, cobra, resume, mas nao decide",
        "Qualquer pessoa consulta o status de qualquer obra em 10 segundos",
        "Metricas automaticas — sem planilha manual",
      ],
      image: IMG.dashboard,
    },
  },

  {
    type: "content",
    props: {
      title: "O que NAO e o Sistema",
      bullets: [
        { label: "Nao e mais burocracia", text: "E menos — porque automatiza o que hoje e feito no grito" },
        { label: "Nao e fiscalizacao", text: "E visibilidade — para que cada um saiba o que precisa fazer e quando" },
        { label: "Nao e para substituir pessoas", text: "E para tirar trabalho repetitivo e deixar cada um focar no que importa" },
        { label: "Nao e complexo", text: "Se voce sabe usar WhatsApp e Trello, voce sabe usar o sistema" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 02 — ARQUITETURA 3 CAMADAS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 02",
      title: "Arquitetura\nem 3 Camadas",
      subtitle: "Workspace Central + Painel do Cliente\n+ Kanban por Departamento",
    },
  },

  {
    type: "process",
    props: {
      title: "As 3 Camadas do Sistema",
      steps: [
        { label: "Camada 1", description: "Workspace Central — A pasta centralizada por obra/cliente com TUDO: decisoes, projetos, propostas, compras, notas, diario de obra, NCs, handoffs e aditivos." },
        { label: "Camada 2", description: "Painel de Gestao do Cliente — Dashboard visual por obra: linha do tempo, status, gates, alertas, risco, ultima decisao e proxima acao." },
        { label: "Camada 3", description: "Kanban por Departamento — Board proprio de cada area com colunas padronizadas, cards com campos obrigatorios, SLA e evidencia." },
      ],
    },
  },

  /* Camada 1 deep-dive */
  {
    type: "split",
    props: {
      title: "Camada 1:\nWorkspace Central",
      subtitle: "A Fonte de Verdade",
      bullets: [
        "Uma pasta por obra/cliente — estrutura padronizada",
        "Historico completo: decisoes, versoes de projeto, propostas, compras",
        "Diario de obra, nao-conformidades, handoffs, aditivos",
        "Chamados pos-obra vinculados",
        "Acesso controlado por perfil (quem ve o que)",
        "Audit log obrigatorio — tudo rastreavel",
      ],
      image: IMG.wood,
    },
  },

  {
    type: "content",
    props: {
      title: "Estrutura de Pastas por Obra",
      bullets: [
        { label: "/Obra_NomeCliente", text: "Pasta raiz com nome padronizado" },
        { label: "/01_Comercial", text: "Briefing, proposta, contrato, aditivos" },
        { label: "/02_Projetos", text: "Versoes do projeto, aprovacoes, revisoes" },
        { label: "/03_Compras", text: "Requisicoes, POs, notas fiscais" },
        { label: "/04_Producao", text: "Ordem de producao, apontamentos, fotos" },
        { label: "/05_Obra", text: "Diario, check-in/out, NCs, vistoria" },
        { label: "/06_Entrega", text: "Checklist de entrega, termo de aceite, fotos" },
        { label: "/07_Pos_Obra", text: "Chamados, garantias, pesquisa satisfacao" },
      ],
    },
  },

  /* Camada 2 deep-dive */
  {
    type: "split",
    props: {
      title: "Camada 2:\nPainel do Cliente",
      subtitle: "Visao executiva por obra",
      bullets: [
        "Linha do tempo visual da jornada completa",
        "Status geral com cor (verde/amarelo/vermelho)",
        "Gates 0 a 4 — marcos obrigatorios de qualidade",
        "Alertas ativos e score de risco",
        "Ultima decisao registrada e proxima acao pendente",
        "Resumo automatico da IA: fase, decisao, risco, proximo passo",
      ],
      image: IMG.dashboard,
    },
  },

  {
    type: "grid",
    props: {
      title: "Gates da Jornada",
      subtitle: "Cada obra passa por 5 gates obrigatorios",
      items: [
        { title: "Gate 0", description: "Qualificacao — Lead validado, briefing completo, budget confirmado" },
        { title: "Gate 1", description: "Escopo Aprovado — Projeto aprovado pelo cliente, contrato assinado" },
        { title: "Gate 2", description: "Producao Liberada — Compras fechadas, materiais confirmados, cronograma validado" },
        { title: "Gate 3", description: "Obra Liberada — Vistoria pre-obra OK, equipe alocada, canteiro pronto" },
        { title: "Gate 4", description: "Entrega Formal — Vistoria final, aceite do cliente, NPS coletado" },
      ],
    },
  },

  /* Camada 3 deep-dive */
  {
    type: "split",
    props: {
      title: "Camada 3:\nKanban por Area",
      subtitle: "Cada departamento com seu board",
      bullets: [
        "Board tipo Trello com colunas padronizadas para TODAS as areas",
        "Colunas: Backlog > Planejado > Em Execucao > Em Aprovacao > Bloqueado > Aguardando Proxima Area > Concluido",
        "Cada card tem campos obrigatorios, checklist e SLA",
        "Evidencia obrigatoria antes de mover card",
        "Integracao total: mover card no Comercial cria card em Projetos",
        "Visao consolidada: gestor ve todos os boards ao mesmo tempo",
      ],
      image: IMG.kanban,
    },
  },

  {
    type: "content",
    props: {
      title: "Campos Obrigatorios de Cada Card",
      bullets: [
        { label: "Obra/Cliente", text: "Vinculo obrigatorio com o workspace central" },
        { label: "Responsavel", text: "Pessoa dona daquele card (nao 'equipe', pessoa)" },
        { label: "SLA", text: "Prazo maximo para conclusao daquela etapa" },
        { label: "Checklist", text: "Itens obrigatorios para considerar a tarefa concluida" },
        { label: "Evidencia", text: "Foto, documento ou print que comprova conclusao" },
        { label: "Status", text: "Automatico com base na coluna onde o card esta" },
        { label: "Handoff", text: "Para quem e para qual area vai quando concluir" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 03 — PASSAGEM DE BASTAO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 03",
      title: "Passagem de\nBastao",
      subtitle: "O handoff formal que elimina o 'achei que\nvoce ia fazer' da Parket.",
    },
  },

  {
    type: "statement",
    props: {
      statement: "Passagem de bastao\nnao e mandar mensagem\nno WhatsApp.\nE um protocolo formal\ncom checklist, evidencia\ne aceite do receptor.",
      label: "Principio Fundamental",
      attribution: "Sistema Nervoso Central",
    },
  },

  {
    type: "process",
    props: {
      title: "Como Funciona o Handoff",
      steps: [
        { label: "1. Conclusao", description: "Responsavel completa checklist, anexa evidencias e solicita passagem de bastao." },
        { label: "2. Validacao IA", description: "IA verifica automaticamente: checklist completo? Campos preenchidos? Evidencias anexadas?" },
        { label: "3. Bloqueio ou Liberacao", description: "Se faltar algo → bloqueia e avisa o que falta. Se tudo OK → libera e notifica proximo." },
        { label: "4. Aceite", description: "Proximo responsavel recebe notificacao, revisa e confirma que aceitou a responsabilidade." },
        { label: "5. Escalonamento", description: "Se nao confirmar em X horas → alerta automatico para gestor. Sem desculpas." },
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "O que Cada Handoff Gera",
      bullets: [
        { label: "Log estruturado", text: "Registro permanente no workspace da obra" },
        { label: "Timestamp", text: "Data e hora exata da passagem" },
        { label: "Responsavel anterior", text: "Quem entregou e completou a etapa" },
        { label: "Novo responsavel", text: "Quem recebeu e aceitou" },
        { label: "Evidencias", text: "Todos os documentos/fotos anexados na passagem" },
        { label: "Tempo de resposta", text: "Quanto tempo levou para o receptor aceitar" },
      ],
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "Antes vs. Depois do Handoff Formal",
      left: {
        title: "Hoje (sem sistema)",
        items: [
          "Manda mensagem no WhatsApp e torce",
          "Ninguem sabe se o outro recebeu",
          "Informacao incompleta — falta sempre algo",
          "Culpa vai e volta sem registro",
          "Retrabalho porque nao tinha evidencia",
          "Gestor so descobre o problema quando estoura",
        ],
      },
      right: {
        title: "Com Sistema Nervoso Central",
        items: [
          "Protocolo formal com checklist obrigatorio",
          "Receptor confirma aceite — registrado",
          "IA bloqueia se faltar campo ou evidencia",
          "Log permanente: quem fez o que, quando",
          "Zero retrabalho por falta de informacao",
          "Gestor ve gargalos em tempo real",
        ],
      },
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 04 — IA COMO COORDENADOR
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 04",
      title: "IA como\nCoordenador",
      subtitle: "A IA nao decide por voce.\nEla valida, alerta e coordena.",
    },
  },

  {
    type: "split",
    props: {
      title: "O Papel da IA\nno Sistema",
      subtitle: "Coordenador, nao executor",
      bullets: [
        "Monitora todos os Kanbans de todas as areas simultaneamente",
        "Detecta gargalos antes de virarem problema",
        "Alerta SLAs vencidos ou prestes a vencer",
        "Identifica cards parados e cobra responsavel",
        "Valida handoffs: checa checklist e evidencias automaticamente",
        "Gera resumos semanais por obra e consolidado da empresa",
      ],
      image: IMG.ai,
    },
  },

  {
    type: "grid",
    props: {
      title: "9 Funcoes da IA",
      subtitle: "O que ela faz automaticamente todos os dias",
      items: [
        { title: "1. Monitor", description: "Varre todos os boards e identifica anomalias" },
        { title: "2. Gargalos", description: "Detecta acumulo de cards ou lentidao em colunas" },
        { title: "3. SLA", description: "Alerta quando prazo esta vencendo ou venceu" },
        { title: "4. Cards Parados", description: "Cobra responsavel quando card nao move ha X dias" },
        { title: "5. Handoff", description: "Valida e libera (ou bloqueia) passagens de bastao" },
        { title: "6. Resumo Obra", description: "Gera resumo semanal por obra para o gestor" },
        { title: "7. Consolidado", description: "Gera resumo geral da empresa para diretoria" },
        { title: "8. Risco", description: "Calcula score de risco antecipado por obra" },
        { title: "9. Relacionamento", description: "Sugere mensagens e acoes para engajar cliente" },
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Resumo Automatico da IA\npor Cliente/Obra",
      subtitle: "Exemplo do que a IA gera para o atendente antes de ligar para o cliente",
      bullets: [
        { label: "Fase atual", text: "Obra em execucao — semana 3 de 6" },
        { label: "Ultima decisao", text: "Cliente aprovou mudanca de acabamento em 25/02" },
        { label: "Proximo passo", text: "Vistoria parcial agendada para 05/03" },
        { label: "Risco atual", text: "Medio — material importado com 3 dias de atraso" },
        { label: "Acao sugerida", text: "Ligar para cliente informando novo prazo e oferecer alternativa" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 05 — NA PRATICA: COMO CADA AREA USA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 05",
      title: "Na Pratica:\nCada Departamento",
      subtitle: "Como o sistema funciona no dia a dia\nde cada area da Parket.",
    },
  },

  /* Comercial */
  {
    type: "role",
    props: {
      role: "Comercial",
      mission: "Captar, qualificar e converter leads em contratos assinados — garantindo que toda informacao chegue completa para Projetos.",
      responsibilities: [
        "Registrar lead no sistema com briefing completo",
        "Preencher campos obrigatorios do card (orcamento, tipo, prazo desejado)",
        "Mover card pelas colunas: Prospeccao > Qualificacao > Proposta > Negociacao > Fechamento",
        "Anexar evidencias: briefing assinado, proposta aprovada, contrato",
        "Fazer handoff formal para Projetos com checklist completo",
      ],
      kpis: [
        "Taxa de conversao lead → proposta",
        "Taxa de conversao proposta → contrato",
        "Tempo medio de fechamento",
        "% de handoffs sem rejeicao (meta: 95%)",
      ],
      image: IMG.handoff,
    },
  },

  /* Projetos */
  {
    type: "role",
    props: {
      role: "Projetos",
      mission: "Transformar o briefing do cliente em projeto executivo aprovado, sem ambiguidades, pronto para compras e producao.",
      responsibilities: [
        "Receber handoff do Comercial e validar completude do briefing",
        "Criar versoes de projeto no workspace (versionamento obrigatorio)",
        "Registrar todas as aprovacoes e revisoes do cliente",
        "Gerar lista de materiais (BOM) para Compras",
        "Fazer handoff formal para Compras/Producao com projeto aprovado + BOM",
      ],
      kpis: [
        "Numero de revisoes por projeto (meta: max 3)",
        "Tempo medio do ciclo briefing → projeto aprovado",
        "% de projetos entregues no prazo",
        "% de handoffs aceitos sem devolucao",
      ],
      image: IMG.wood,
    },
  },

  /* Compras */
  {
    type: "role",
    props: {
      role: "Compras",
      mission: "Garantir que todo material chegue no prazo, no custo previsto, com rastreabilidade total do pedido a entrega.",
      responsibilities: [
        "Receber BOM (lista de materiais) do handoff de Projetos",
        "Criar requisicoes de compra com fornecedor, prazo e custo",
        "Registrar POs (purchase orders) e notas fiscais no workspace",
        "Acompanhar entregas e alertar atrasos",
        "Fazer handoff para Producao/Expedição quando material chegar",
      ],
      kpis: [
        "% de compras entregues no prazo",
        "Variacao de custo real vs. orcado",
        "Lead time medio de fornecedores",
        "% de requisicoes completas no primeiro envio",
      ],
      image: IMG.kanban,
    },
  },

  /* Producao */
  {
    type: "role",
    props: {
      role: "Producao",
      mission: "Fabricar com qualidade, no prazo, com apontamento de horas e registro de nao-conformidades.",
      responsibilities: [
        "Receber ordem de producao via handoff de Compras/Projetos",
        "Registrar apontamento de horas por obra/unidade",
        "Fotografar etapas criticas como evidencia",
        "Registrar qualquer nao-conformidade (NC) imediatamente",
        "Fazer handoff para Expedicao com checklist de qualidade aprovado",
      ],
      kpis: [
        "Horas reais vs. horas orcadas por obra",
        "Numero de NCs por periodo",
        "% de producao entregue no prazo",
        "Tempo medio de producao por tipo de produto",
      ],
      image: IMG.team,
    },
  },

  /* Obras */
  {
    type: "role",
    props: {
      role: "Obras / Instalacao",
      mission: "Executar a instalacao com excelencia, diario de obra atualizado, check-in/out diario e vistoria final impecavel.",
      responsibilities: [
        "Receber handoff de Expedicao com materiais e cronograma",
        "Fazer check-in diario com foto do canteiro",
        "Registrar diario de obra: atividades, ocorrencias, fotos",
        "Comunicar desvios ou NCs imediatamente via sistema",
        "Vistoria final com checklist obrigatorio + fotos + aceite do cliente",
        "Fazer handoff para Pos-Obra com termo de entrega assinado",
      ],
      kpis: [
        "% de obras entregues no prazo",
        "NPS do cliente na entrega",
        "Numero de NCs por obra",
        "% de check-ins diarios realizados",
      ],
      image: IMG.dashboard,
    },
  },

  /* Financeiro */
  {
    type: "role",
    props: {
      role: "Financeiro",
      mission: "Controlar fluxo de caixa, medicoes, retencoes e margem real por obra — com dados do sistema, nao de planilha.",
      responsibilities: [
        "Receber notificacao automatica quando contrato e assinado",
        "Registrar medicoes vinculadas ao progresso real da obra",
        "Controlar retencao de 25% ate entrega final",
        "Liberar pagamentos vinculados a gates aprovados",
        "Gerar relatorio de margem real por obra (custo real vs. orcado)",
      ],
      kpis: [
        "Margem real media por obra",
        "Inadimplencia (% e dias)",
        "Variacao orcado vs. realizado",
        "Tempo medio de recebimento",
      ],
      image: IMG.ai,
    },
  },

  /* Atendimento */
  {
    type: "role",
    props: {
      role: "Atendimento / Relacionamento",
      mission: "Ser a ponte entre o cliente e a operacao — com contexto completo fornecido pelo sistema, sem depender de memoria.",
      responsibilities: [
        "Consultar linha do tempo completa do cliente antes de qualquer contato",
        "Usar resumo automatico da IA: fase, decisao, risco, proximo passo",
        "Registrar todas as interacoes no workspace do cliente",
        "Escalonar alertas quando cliente reporta problema",
        "Acionar pesquisa de satisfacao nos marcos definidos",
      ],
      kpis: [
        "NPS por ponto de contato",
        "Tempo medio de resposta ao cliente",
        "% de contatos proativos vs. reativos",
        "Taxa de resolucao no primeiro contato",
      ],
      image: IMG.handoff,
    },
  },

  /* Pos-Obra */
  {
    type: "role",
    props: {
      role: "Pos-Obra",
      mission: "Garantir que chamados pos-entrega sejam resolvidos com SLA, rastreabilidade e pesquisa de satisfacao final.",
      responsibilities: [
        "Receber handoff de Obras com termo de entrega",
        "Abrir e gerenciar chamados de garantia/manutencao",
        "Registrar cada atendimento com foto, diagnostico e solucao",
        "Acionar pesquisa de satisfacao 30/60/90 dias",
        "Alimentar base de conhecimento com problemas recorrentes",
      ],
      kpis: [
        "Tempo medio de resolucao de chamados",
        "% de chamados resolvidos dentro do SLA",
        "NPS pos-obra",
        "Taxa de recorrencia de problemas",
      ],
      image: IMG.wood,
    },
  },

  /* Marketing */
  {
    type: "role",
    props: {
      role: "Marketing",
      mission: "Gerar leads qualificados, nutrir pipeline e documentar cases de sucesso usando dados reais do sistema.",
      responsibilities: [
        "Acompanhar taxa de conversao de campanhas no funil do sistema",
        "Documentar cases usando fotos e dados reais do workspace da obra",
        "Solicitar depoimentos automaticamente apos NPS alto",
        "Alimentar calendario editorial com marcos de obras em andamento",
        "Gerar relatorios de ROI de campanhas vinculados a contratos fechados",
      ],
      kpis: [
        "Custo por lead qualificado",
        "Taxa de conversao campanha > lead > proposta",
        "Numero de cases documentados por trimestre",
        "Engajamento organico (redes sociais)",
      ],
      image: IMG.kanban,
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 06 — FLUXO COMPLETO DE UMA OBRA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 06",
      title: "Fluxo Completo\nde uma Obra",
      subtitle: "De ponta a ponta: do lead que chega\nate a pesquisa de satisfacao final.",
    },
  },

  {
    type: "process",
    props: {
      title: "Jornada Completa no Sistema",
      steps: [
        { label: "Lead Captado", description: "Comercial registra no sistema -> card criado automaticamente -> briefing obrigatorio" },
        { label: "Qualificacao", description: "Comercial preenche budget, tipo, prazo -> Gate 0 validado pela IA" },
        { label: "Proposta & Contrato", description: "Proposta gerada -> aprovada -> contrato assinado -> handoff formal para Projetos" },
        { label: "Projeto", description: "Projetos recebe -> cria versoes -> cliente aprova -> BOM gerado -> handoff para Compras" },
        { label: "Compras & Producao", description: "Material comprado -> produzido -> expedido -> handoff para Obras" },
        { label: "Execucao & Entrega", description: "Obra executada -> diario -> vistoria -> aceite -> handoff para Pos-Obra" },
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Responsaveis Reais por Etapa",
      subtitle: "Nomes, nao cargos genericos",
      bullets: [
        { label: "Comercial / Atendimento", text: "Talita e Tainara — captacao, qualificacao, proposta, relacionamento" },
        { label: "Projetos", text: "Carla — projeto executivo, revisoes, BOM" },
        { label: "Producao", text: "Germano — fabricacao, apontamento, qualidade" },
        { label: "Compras", text: "Dani — requisicoes, POs, rastreamento de entregas" },
        { label: "Obras", text: "Ailton — instalacao, diario, vistoria, entrega" },
        { label: "Produtividade/PMO", text: "Nat — metricas, dashboards, cobranças de SLA" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 07 — ALERTAS E METRICAS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 07",
      title: "Alertas &\nMetricas",
      subtitle: "O sistema grita antes do cliente gritar.",
    },
  },

  {
    type: "grid",
    props: {
      title: "Alertas Automaticos",
      subtitle: "Disparados pela IA sem intervencao humana",
      items: [
        { title: "SLA Vencendo", description: "Card proximo do prazo limite — notifica responsavel e gestor" },
        { title: "SLA Vencido", description: "Card passou do prazo — escalona para nivel acima" },
        { title: "Card Parado", description: "Card sem movimentacao ha X dias — cobra responsavel" },
        { title: "Handoff Pendente", description: "Receptor nao confirmou aceite — escalona" },
        { title: "Evidencia Faltando", description: "Card na coluna 'Concluido' sem evidencia — bloqueia" },
        { title: "Risco Alto", description: "Score de risco da obra acima do limiar — alerta diretoria" },
      ],
    },
  },

  {
    type: "metrics",
    props: {
      title: "10 Metricas Semanais",
      subtitle: "Dashboard automatico — sem planilha",
      metrics: [
        { label: "Obras Ativas", value: "Auto", description: "Total de obras em execucao" },
        { label: "Cards Vencidos", value: "0", description: "Meta: zero SLAs estourados" },
        { label: "Handoffs/sem", value: "Auto", description: "Passagens de bastao na semana" },
        { label: "Tempo Medio", value: "< 2h", description: "Tempo de aceite de handoff" },
        { label: "NCs Abertas", value: "Auto", description: "Nao-conformidades pendentes" },
        { label: "NPS Medio", value: "> 9", description: "Satisfacao do cliente" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 08 — COMO VAI SER IMPLEMENTADO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 08",
      title: "Plano de\nImplementacao",
      subtitle: "90 dias. 6 sprints.\nSem big-bang. Area por area.",
    },
  },

  {
    type: "process",
    props: {
      title: "Roadmap de 90 Dias",
      steps: [
        { label: "Sprint 1 (Sem 1-2)", description: "Fundacao: Workspace Central + estrutura de pastas + modelo do card + Kanban do Comercial" },
        { label: "Sprint 2 (Sem 3-4)", description: "Projetos + Compras: boards Kanban + handoff Comercial > Projetos > Compras" },
        { label: "Sprint 3 (Sem 5-6)", description: "Producao + Expedicao: boards + apontamento de horas + handoff para Obras" },
        { label: "Sprint 4 (Sem 7-8)", description: "Obras: diario digital, check-in/out, vistoria, entrega formal" },
        { label: "Sprint 5 (Sem 9-10)", description: "IA ativada: validacao de handoffs, alertas de SLA, resumos automaticos" },
        { label: "Sprint 6 (Sem 11-12)", description: "Painel do Cliente + Pos-Obra + Dashboard consolidado + treinamento geral" },
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "O Que Cada Sprint Entrega",
      bullets: [
        { label: "Sprint 1", text: "Comercial ja opera no sistema — leads nao se perdem mais" },
        { label: "Sprint 2", text: "Projetos e Compras conectados — handoff formal funcionando" },
        { label: "Sprint 3", text: "Producao rastreada — horas apontadas, NCs registradas" },
        { label: "Sprint 4", text: "Obras com diario digital — visibilidade total da execucao" },
        { label: "Sprint 5", text: "IA valida handoffs — zero passagem incompleta" },
        { label: "Sprint 6", text: "Sistema completo — dashboard para diretoria, NPS automatizado" },
      ],
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "O Que Muda Para Voce",
      left: {
        title: "Para o Time Operacional",
        items: [
          "Voce sabe exatamente o que precisa fazer hoje",
          "Nao precisa perguntar status pra ninguem",
          "Recebe o bastao com TUDO que precisa",
          "Passa o bastao e tem certeza que chegou",
          "Nao e cobrado por algo que nao e seu",
          "Suas entregas sao registradas e reconhecidas",
        ],
      },
      right: {
        title: "Para a Diretoria",
        items: [
          "Visao real de todas as obras em 1 tela",
          "Sabe onde esta o gargalo antes de estourar",
          "Metricas reais, nao achismo",
          "Decisoes baseadas em dados",
          "Rastreabilidade total para auditorias",
          "Escala sem depender de heroismo individual",
        ],
      },
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 09 — PERGUNTAS FREQUENTES
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 09",
      title: "Perguntas\nFrequentes",
      subtitle: "As duvidas mais comuns do time\nrespondidas de forma direta.",
    },
  },

  {
    type: "content",
    props: {
      title: "FAQ — Parte 1",
      bullets: [
        { label: "Vou ter que preencher muita coisa?", text: "Menos do que hoje. O sistema pre-preenche dados e a IA completa campos. Voce so valida." },
        { label: "E se eu esquecer de atualizar?", text: "O sistema avisa. Notificacao no celular, alerta no board. Se nao mover, escala." },
        { label: "Posso usar pelo celular?", text: "Sim. O sistema e responsivo. Board, cards e handoffs funcionam no celular." },
        { label: "Quem ve o que?", text: "Acesso por perfil. Voce ve o que e relevante para sua area. Gestor ve tudo." },
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "FAQ — Parte 2",
      bullets: [
        { label: "A IA vai tomar decisoes por mim?", text: "Nao. A IA valida, alerta e sugere. Toda decisao critica e humana." },
        { label: "Se o sistema cair, para tudo?", text: "Nao. O sistema e na nuvem com backup. E para emergencias, temos protocolo offline." },
        { label: "Como funciona o treinamento?", text: "Sprint por sprint. Cada area e treinada quando seu modulo entra. Nao e tudo de uma vez." },
        { label: "Vai substituir o WhatsApp?", text: "Para comunicacao pessoal, nao. Para passagem de informacao de obra, SIM. WhatsApp nao gera registro." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 10 — PRINCIPIOS INEGOCIAVEIS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 10",
      title: "Principios\nInegociaveis",
      subtitle: "As regras que nao mudam\nindependente da situacao.",
    },
  },

  {
    type: "grid",
    props: {
      title: "6 Principios do Sistema",
      items: [
        { title: "Tudo Rastreavel", description: "Se nao esta no sistema, nao aconteceu. Sem excecao." },
        { title: "Tudo Auditavel", description: "Audit log em toda acao. Quem fez, quando, o que mudou." },
        { title: "Sem Boa Vontade", description: "Nenhuma etapa depende de alguem lembrar. O sistema cobra." },
        { title: "Simples de Usar", description: "Se voce sabe usar WhatsApp, voce sabe usar isso." },
        { title: "Bloqueio Real", description: "Handoff incompleto = bloqueado. Sem jeitinho." },
        { title: "Dados, nao Achismo", description: "Metricas vem do sistema, nao de sensacao." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     ENCERRAMENTO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "statement",
    props: {
      statement: "O Sistema Nervoso Central\nnao e um projeto de TI.\nE a forma como a Parket\nvai operar a partir de agora.\nUma empresa, um sistema,\numa fonte de verdade.",
      label: "Compromisso",
      attribution: "Parket 2025",
    },
  },

  {
    type: "closing",
    props: {
      title: "Sistema Nervoso\nCentral",
      subtitle: "Documento vivo — atualizado a cada sprint.\nDuvidas? Fale com Nat (PMO) ou com a diretoria.\nVamos construir juntos.",
      image: IMG.cover,
    },
  },
];