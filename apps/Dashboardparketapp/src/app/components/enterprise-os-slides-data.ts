import type { SlideData } from "./slides-data";

const IMG_COVER = "https://images.unsplash.com/photo-1769739132671-ac41c439d51e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3b29kJTIwZmxvb3JpbmclMjBwcmVtaXVtJTIwaW50ZXJpb3J8ZW58MXx8fHwxNzcyODg3MTg1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_ORG = "https://images.unsplash.com/photo-1676276376140-a4030cc596a1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjb3Jwb3JhdGUlMjBvcmdhbml6YXRpb25hbCUyMGNoYXJ0fGVufDF8fHx8MTc3Mjg4NzE4Nnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_PROD = "https://images.unsplash.com/photo-1574184383650-5f859b6793c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwaGFyZHdvb2QlMjBwcm9kdWN0aW9uJTIwZmFjdG9yeXxlbnwxfHx8fDE3NzI4ODcxODZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_OBRA = "https://images.unsplash.com/photo-1770838773181-e1b17ec22fee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwYnVpbGRpbmclMjBpbnN0YWxsYXRpb258ZW58MXx8fHwxNzcyODg3MTg3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_DASH = "https://images.unsplash.com/photo-1748366465774-aaa2160fe78d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaWdpdGFsJTIwZGFzaGJvYXJkJTIwY29udHJvbCUyMHJvb20lMjBzY3JlZW5zfGVufDF8fHx8MTc3Mjg4NzE4N3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_LOG = "https://images.unsplash.com/photo-1740914994657-f1cdffdc418e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsb2dpc3RpY3MlMjB3YXJlaG91c2UlMjBzaGlwcGluZyUyMG9wZXJhdGlvbnN8ZW58MXx8fHwxNzcyODg3MTg3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_AI = "https://images.unsplash.com/photo-1749006590639-e749e6b7d84c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpZmljaWFsJTIwaW50ZWxsaWdlbmNlJTIwdGVjaG5vbG9neSUyMGFic3RyYWN0fGVufDF8fHx8MTc3Mjg3OTA4NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_TEAM = "https://images.unsplash.com/photo-1758691736424-4b4273948341?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWFtJTIwbWVldGluZyUyMGJ1c2luZXNzJTIwc3RyYXRlZ3klMjBib2FyZHJvb218ZW58MXx8fHwxNzcyODg3MTg4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_RISK = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXRhJTIwYW5hbHl0aWNzJTIwcmlzayUyMGRhc2hib2FyZCUyMGRhcmt8ZW58MXx8fHwxNzcyODg3NDc2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_KANBAN = "https://images.unsplash.com/photo-1758876202468-5ffe0ee61f07?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrYW5iYW4lMjBib2FyZCUyMHByb2plY3QlMjBtYW5hZ2VtZW50JTIwd29ya2Zsb3d8ZW58MXx8fHwxNzcyODg3NDc3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_QC = "https://images.unsplash.com/photo-1768796372343-99ed316eb5ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxxdWFsaXR5JTIwY29udHJvbCUyMG1hbnVmYWN0dXJpbmclMjBpbnNwZWN0aW9ufGVufDF8fHx8MTc3Mjc5ODAyNnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

export const enterpriseOsSlides: SlideData[] = [
  // ═══════════════════════════════════════════════════
  // ABERTURA
  // ═══════════════════════════════════════════════════
  {
    type: "cover",
    props: {
      title: "Enterprise OS\nParket",
      subtitle: "Sistema Operacional Empresarial completo: organograma, processos, RACI, handoffs, 4 camadas de sistema, produtividade, scores e agentes IA.",
      image: IMG_COVER,
    },
  },
  {
    type: "content",
    props: {
      title: "O que e este documento",
      label: "Introducao",
      content: "Blueprint completo do Sistema Operacional da Parket. Consolida estrutura organizacional, fluxos E2E, RACI, handoffs, arquitetura de 4 camadas, sistema de produtividade, painel de perdas, scores de risco e agentes IA.",
      bullets: [
        { label: "Para quem", text: "Diretoria, gerentes e lideres de area" },
        { label: "Objetivo", text: "Reduzir retrabalho, reduzir ruido, reduzir atrasos, aumentar previsibilidade, aumentar margem e garantir rastreabilidade total" },
        { label: "Como usar", text: "Cada capitulo e independente — navegue pelo indice ou siga a sequencia" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Indice Geral",
      label: "Navegacao",
      bullets: [
        { label: "Cap 01", text: "Estrutura Organizacional & Organograma" },
        { label: "Cap 02", text: "Fluxo Operacional End-to-End" },
        { label: "Cap 03", text: "Arquitetura do Sistema — 4 Camadas" },
        { label: "Cap 04", text: "Sistema de Handoffs" },
        { label: "Cap 05", text: "Playbook RACI Completo" },
        { label: "Cap 06", text: "Mapa de Handoffs — Todos os 9 Detalhados" },
        { label: "Cap 07", text: "Processos por Departamento" },
        { label: "Cap 08", text: "Sistema de Produtividade & Perdas" },
        { label: "Cap 09", text: "Scores de Risco & Confiabilidade" },
        { label: "Cap 10", text: "Agentes de IA" },
        { label: "Cap 11", text: "Playbook Operacional — 10 Pilares" },
        { label: "Cap 12", text: "Roadmap & Proximos Passos" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 01 — ESTRUTURA ORGANIZACIONAL
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 01",
      title: "Estrutura\nOrganizacional",
      subtitle: "Organograma atualizado com todos os departamentos e liderancas.",
    },
  },
  {
    type: "split",
    props: {
      title: "A Parket",
      subtitle: "Empresa premium de madeira e obras complexas",
      image: IMG_COVER,
      label: "Sobre a empresa",
      items: [
        "Pisos de madeira macica e engenheirada",
        "Forros, paineis, decks e escadas sob medida",
        "Marcenaria fina e moveis fixos",
        "Fachadas em madeira",
        "Forte operacao industrial, logistica e obras",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "10 Departamentos",
      label: "Organograma",
      subtitle: "Todos reportando ao CEO",
      cards: [
        { title: "Administracao", description: "Financeiro, RH, Fiscal, Sistemas", icon: "ADM" },
        { title: "Comercial", description: "Diretores regionais, Gerentes, Executivos", icon: "COM" },
        { title: "Marketing", description: "Marca, conteudo, trafego pago, social media", icon: "MKT" },
        { title: "Projetos / Engenharia", description: "Projeto executivo, detalhamento tecnico", icon: "ENG" },
        { title: "Compras / Supply Chain", description: "Cotacao, PO, controle de materiais", icon: "SUP" },
        { title: "Producao Industrial / Marcenaria", description: "Fabrica, CNC, acabamento, QC", icon: "PRD" },
        { title: "Logistica / Expedicao", description: "Estoque, separacao, frete, entrega", icon: "LOG" },
        { title: "Obras / Instalacao / Fiscalizacao", description: "Execucao em campo, qualidade", icon: "OBR" },
        { title: "Relacionamento / Pos-Obra", description: "Satisfacao, garantia, manutencao", icon: "REL" },
        { title: "PMO / Produtividade", description: "Processos, metricas, melhoria continua", icon: "PMO" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Estrutura Comercial\nAtualizada",
      label: "Comercial — Lideres",
      bullets: [
        { label: "Gustavo Oliveira", text: "Diretor Comercial Regional — Brasilia / Goiania / Santa Catarina" },
        { label: "Suely", text: "Gerente Comercial — Brasilia / Goiania" },
        { label: "Felipe Lessa", text: "Diretor Comercial Regional — Rio de Janeiro / Bahia / Espirito Santo" },
        { label: "Fabio Figueiredo", text: "Diretor Comercial Regional — Minas Gerais" },
        { label: "Ana Paula Corretora", text: "Gerente Comercial — Santa Catarina" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Comercial Sao Paulo",
      label: "Equipe SP",
      subtitle: "Executivos comerciais responsaveis pela praca de Sao Paulo",
      items: [
        "Guilherme Miletta",
        "Christian",
        "Davi Alves",
        "Murilo Arsie",
      ],
    },
  },
  {
    type: "split",
    props: {
      title: "Hierarquia Comercial",
      image: IMG_ORG,
      label: "Visao Geral",
      items: [
        "CEO → Diretores Comerciais Regionais",
        "Diretores → Gerentes Comerciais por praca",
        "Gerentes → Executivos Comerciais",
        "Cobertura: SP, RJ, MG, BA, ES, BSB, GO, SC",
        "Modelo matricial: gestao regional + especialidade por produto",
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 02 — FLUXO OPERACIONAL
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 02",
      title: "Fluxo Operacional\nEnd-to-End",
      subtitle: "Da captacao do lead a pos-obra: 11 macroetapas.",
    },
  },
  {
    type: "content",
    props: {
      title: "Objetivos do OS",
      label: "Por que existe",
      subtitle: "O Enterprise OS foi desenhado para:",
      bullets: [
        { label: "Reduzir retrabalho", text: "Checklist e evidencias obrigatorias em cada etapa" },
        { label: "Reduzir ruido interno", text: "Canais claros, RACI definido, handoffs formais" },
        { label: "Reduzir atrasos", text: "SLAs por etapa com cobranca automatica pela IA" },
        { label: "Aumentar previsibilidade", text: "Scores de risco e dashboard em tempo real" },
        { label: "Aumentar margem", text: "Sistema de produtividade e controle de perdas" },
        { label: "Garantir rastreabilidade", text: "Timestamp, evidencia e historico em tudo" },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Jornada Completa",
      label: "Fluxo E2E",
      steps: [
        { number: "01", title: "Lead", description: "Captacao via inbound, outbound, indicacao ou arquiteto" },
        { number: "02", title: "Comercial", description: "Qualificacao, showroom, proposta e negociacao" },
        { number: "03", title: "Projeto", description: "Projeto executivo, detalhamento tecnico, especificacao" },
        { number: "04", title: "Orcamento", description: "Precificacao, margem, aprovacao interna" },
        { number: "05", title: "Contrato", description: "Assinatura, condicoes comerciais, PO cliente" },
        { number: "06", title: "Compras", description: "Cotacao, PO fornecedor, controle de entrega" },
        { number: "07", title: "Producao", description: "Fabrica, marcenaria, CNC, acabamento, QC" },
        { number: "08", title: "Logistica", description: "Separacao, embalagem, frete, agendamento" },
        { number: "09", title: "Obra", description: "Instalacao em campo, fiscalizacao, diario de obra" },
        { number: "10", title: "Entrega", description: "Vistoria final, aceite do cliente, documentacao" },
        { number: "11", title: "Pos-Obra", description: "Garantia, manutencao, NPS, recompra" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Principio Fundamental",
      label: "Regra Zero",
      highlight: "Nenhuma etapa avanca sem a etapa anterior estar 100% concluida e validada.",
      content: "Cada transicao entre etapas gera um Handoff formal com checklist obrigatorio, evidencia, timestamp e confirmacao de recebimento. A IA coordena esse processo.",
    },
  },
  {
    type: "metrics",
    props: {
      title: "Numeros do OS",
      label: "Visao Geral",
      subtitle: "Escala da operacao",
      metrics: [
        { value: "11", label: "Macroetapas", description: "Lead a pos-obra" },
        { value: "10", label: "Departamentos", description: "Reportando ao CEO" },
        { value: "9", label: "Handoffs Formais", description: "Com SLA e checklist" },
        { value: "4", label: "Camadas de Sistema", description: "Workspace, Painel, Kanban, Tower" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 03 — ARQUITETURA DO SISTEMA — 4 CAMADAS
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 03",
      title: "Arquitetura\ndo Sistema",
      subtitle: "4 camadas estruturais que formam a espinha dorsal digital.",
    },
  },
  {
    type: "split",
    props: {
      title: "As 4 Camadas",
      image: IMG_DASH,
      label: "Visao Geral",
      items: [
        "Camada 1 — Workspace Central: memoria da empresa",
        "Camada 2 — Painel de Gestao do Cliente: visao 360 por obra",
        "Camada 3 — Kanban por Departamento: boards setoriais",
        "Camada 4 — Control Tower Executivo: painel de controle",
      ],
    },
  },
  // Camada 1 — Workspace Central
  {
    type: "content",
    props: {
      title: "Camada 1\nWorkspace Central",
      label: "Memoria da Empresa",
      subtitle: "Central de memoria da empresa — fonte unica de verdade. Todos os departamentos acessam informacoes do mesmo lugar.",
      bullets: [
        { label: "Historico de cliente", text: "Todos os contatos, propostas, decisoes e interacoes" },
        { label: "Historico de obra", text: "Timeline completa de cada obra executada" },
        { label: "Decisoes", text: "Registro de todas as aprovacoes e mudancas de escopo" },
        { label: "Documentos", text: "Contratos, projetos, fichas tecnicas, plantas" },
        { label: "Compras & NF", text: "POs, notas fiscais, romaneios, conferencias" },
        { label: "Diario de obra", text: "Registros diarios, fotos, apontamentos" },
        { label: "NC & Entregas", text: "Nao-conformidades, evidencias, aceites" },
        { label: "Pos-obra", text: "Garantias, manutencoes, NPS, recompra" },
      ],
    },
  },
  // Camada 2 — Painel do Cliente
  {
    type: "content",
    props: {
      title: "Camada 2\nPainel de Gestao do Cliente",
      label: "Visao 360 por Obra",
      subtitle: "Cada cliente/obra possui um painel dedicado com:",
      bullets: [
        { label: "Status da obra", text: "Etapa atual no fluxo E2E, % de conclusao" },
        { label: "Linha do tempo", text: "Todos os eventos, handoffs e marcos da obra" },
        { label: "Ultimas decisoes", text: "Aprovacoes, mudancas de escopo, pedidos extras" },
        { label: "Pendencias", text: "O que esta faltando para avancar, com responsavel e SLA" },
        { label: "Proximas etapas", text: "O que vem depois e quem e o responsavel" },
        { label: "Alertas", text: "Riscos, atrasos, SLAs proximos de vencer" },
        { label: "Documentos principais", text: "Contrato, projeto, NFs, fotos, aceites" },
      ],
    },
  },
  // Camada 3 — Kanban Departamental
  {
    type: "split",
    props: {
      title: "Camada 3\nKanban por Departamento",
      image: IMG_KANBAN,
      label: "Boards Setoriais",
      subtitle: "Cada departamento tem seu board Kanban. A entidade Card e a unidade basica de trabalho.",
      items: [
        "Cada area opera com board proprio",
        "Cards padronizados com SLA, checklist e handoff",
        "Colunas padrao: 7 estados de progresso",
        "Visibilidade cruzada entre areas",
        "IA monitora e alerta automaticamente",
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Colunas Padrao do Kanban",
      label: "7 Estados",
      steps: [
        { number: "01", title: "Backlog", description: "Itens recebidos ainda nao priorizados" },
        { number: "02", title: "Planejado", description: "Priorizado e com data prevista de inicio" },
        { number: "03", title: "Em Execucao", description: "Trabalho em andamento pela area responsavel" },
        { number: "04", title: "Em Aprovacao", description: "Aguardando validacao do gestor ou area seguinte" },
        { number: "05", title: "Bloqueado", description: "Impedimento identificado — requer acao para destravar" },
        { number: "06", title: "Aguardando Proxima Area", description: "Handoff preparado, esperando aceite do receptor" },
        { number: "07", title: "Concluido", description: "Etapa finalizada com evidencia e handoff confirmado" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Entidade Card",
      label: "Unidade de Trabalho",
      subtitle: "Cada card nos Kanbans contem obrigatoriamente:",
      bullets: [
        { label: "Responsavel", text: "Nome do dono da tarefa naquele departamento" },
        { label: "SLA", text: "Prazo maximo para conclusao da etapa" },
        { label: "Checklist", text: "Itens obrigatorios que devem estar OK para concluir" },
        { label: "Evidencia", text: "Fotos, documentos, aprovacoes anexadas" },
        { label: "Handoff", text: "De quem recebeu, para quem vai, com confirmacao" },
        { label: "Historico", text: "Log completo de movimentacoes e timestamps" },
      ],
    },
  },
  // Camada 4 — Control Tower
  {
    type: "split",
    props: {
      title: "Camada 4\nControl Tower",
      image: IMG_RISK,
      label: "Painel Executivo",
      subtitle: "Dashboard da diretoria com visao em tempo real de toda a operacao.",
      items: [
        "Obras em risco — score automatico",
        "Atrasos — por etapa, por area, por obra",
        "Gargalos — onde a operacao esta travando",
        "Perdas — retrabalho, NC, frete extra",
        "Produtividade — por equipe e por obra",
        "Margem por obra — orcado vs. real",
        "Score de departamento — confiabilidade",
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 04 — SISTEMA DE HANDOFFS
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 04",
      title: "Sistema de\nHandoffs",
      subtitle: "Passagem de bastao formal entre areas com validacao por IA.",
    },
  },
  {
    type: "content",
    props: {
      title: "Anatomia de um Handoff",
      label: "Estrutura Padrao",
      subtitle: "Cada passagem entre areas contem obrigatoriamente:",
      bullets: [
        { label: "Responsavel anterior", text: "Quem entrega — nome, area, cargo" },
        { label: "Novo responsavel", text: "Quem recebe — nome, area, cargo" },
        { label: "Checklist obrigatorio", text: "Lista de itens que devem estar completos" },
        { label: "Evidencia", text: "Documento, foto, aprovacao ou arquivo comprobatorio" },
        { label: "Timestamp", text: "Data/hora exata da passagem" },
        { label: "SLA", text: "Prazo maximo para aceitacao e inicio da proxima etapa" },
        { label: "Confirmacao", text: "O receptor confirma recebimento — sem confirmacao, nao avanca" },
      ],
    },
  },
  {
    type: "statement",
    props: {
      statement: "A IA coordena o processo de handoff. Ela nao executa — ela garante que ninguem pule etapas.",
      attribution: "Principio do Enterprise OS",
      label: "Regra de Ouro",
    },
  },
  {
    type: "content",
    props: {
      title: "Regras de Bloqueio",
      label: "Gates",
      content: "Se qualquer item do checklist estiver incompleto, o handoff nao e liberado. A IA notifica o responsavel e escala para o gestor apos o vencimento do SLA.",
      items: [
        "Checklist incompleto → bloqueio automatico",
        "SLA vencido sem acao → escalonamento para gestor",
        "Evidencia ausente → handoff rejeitado",
        "Confirmacao de recebimento obrigatoria",
        "Historico completo no Card para auditoria",
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 05 — PLAYBOOK RACI
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 05",
      title: "Playbook\nRACI",
      subtitle: "Quem decide, executa, valida e acompanha em cada macroprocesso, departamento e decisao critica.",
    },
  },
  {
    type: "content",
    props: {
      title: "Legenda RACI",
      label: "Framework",
      bullets: [
        { label: "R — Responsible", text: "Quem faz. Executa a tarefa ou entrega." },
        { label: "A — Accountable", text: "Quem decide. Aprova e responde pelo resultado." },
        { label: "C — Consulted", text: "Quem opina. Fornece input antes da execucao." },
        { label: "I — Informed", text: "Quem acompanha. Recebe a informacao apos conclusao." },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "RACI por Macroprocesso",
      label: "Visao Geral",
      cards: [
        { title: "Captacao de Lead", description: "R: Marketing/Comercial | A: Dir. Comercial | C: CEO | I: PMO", icon: "01" },
        { title: "Qualificacao & Proposta", description: "R: Comercial | A: Dir. Regional | C: Projetos | I: Financeiro", icon: "02" },
        { title: "Projeto Executivo", description: "R: Projetos/Engenharia | A: Coord. Projetos | C: Comercial | I: Compras", icon: "03" },
        { title: "Contrato & Faturamento", description: "R: Comercial+Financeiro | A: Dir. Comercial | C: Juridico | I: PMO", icon: "04" },
        { title: "Compras & Supply", description: "R: Compras | A: Coord. Compras | C: Producao | I: Financeiro", icon: "05" },
        { title: "Producao Industrial", description: "R: Producao | A: Ger. Industrial | C: Compras | I: Logistica", icon: "06" },
        { title: "Logistica & Entrega", description: "R: Logistica | A: Coord. Logistica | C: Obras | I: Comercial", icon: "07" },
        { title: "Obra & Instalacao", description: "R: Obras | A: Coord. Obras | C: Projetos | I: Relacionamento", icon: "08" },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "RACI por Departamento",
      label: "Responsabilidades",
      cards: [
        { title: "Administracao", description: "R: Rotina financeira/RH/fiscal | A: Dir. ADM | C: CEO | I: Todas areas", icon: "ADM" },
        { title: "Comercial", description: "R: Pipeline e vendas | A: Dir. Regional | C: Marketing/Projetos | I: PMO", icon: "COM" },
        { title: "Marketing", description: "R: Leads e marca | A: Coord. MKT | C: Comercial | I: CEO", icon: "MKT" },
        { title: "Projetos", description: "R: Projeto executivo | A: Coord. Projetos | C: Comercial/Compras | I: Producao", icon: "ENG" },
        { title: "Compras", description: "R: POs e fornecedores | A: Coord. Compras | C: Producao/Financeiro | I: Logistica", icon: "SUP" },
        { title: "Producao", description: "R: Fabricacao e QC | A: Ger. Industrial | C: Compras/Projetos | I: Logistica", icon: "PRD" },
        { title: "Logistica", description: "R: Entrega e estoque | A: Coord. Logistica | C: Obras | I: Comercial", icon: "LOG" },
        { title: "Obras", description: "R: Instalacao e vistoria | A: Coord. Obras | C: Projetos | I: Relacionamento", icon: "OBR" },
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "RACI — Decisoes Criticas",
      label: "Matriz de Autoridade",
      leftTitle: "Decisoes do CEO",
      leftItems: [
        "Aprovacao de obras acima de R$ 500k",
        "Novos mercados e pracas",
        "Contratacao de liderancas",
        "Politica de precos e margem minima",
        "Investimentos em capex",
      ],
      rightTitle: "Decisoes dos Diretores",
      rightItems: [
        "Descontos acima de 10%",
        "Priorizacao de obras na fabrica",
        "Escalonamento de atrasos criticos",
        "Aprovacao de fornecedores alternativos",
        "Replano de sprint semanal",
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 06 — MAPA DE HANDOFFS — TODOS OS 9
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 06",
      title: "Mapa de Handoffs\nCompleto",
      subtitle: "Todos os 9 handoffs criticos detalhados com pacote minimo, SLA, erro comum e regra de bloqueio.",
    },
  },
  {
    type: "process",
    props: {
      title: "Os 9 Handoffs Criticos",
      label: "Mapa Geral",
      steps: [
        { number: "H1", title: "Comercial → Projetos", description: "Briefing completo, specs do cliente, prazo" },
        { number: "H2", title: "Projetos → Compras", description: "Projeto executivo aprovado, lista de materiais" },
        { number: "H3", title: "Compras → Financeiro", description: "PO aprovada, condicoes de pagamento" },
        { number: "H4", title: "Compras → Producao", description: "Material liberado, ficha de producao" },
        { number: "H5", title: "Producao → Logistica", description: "Producao concluida, QC aprovado" },
        { number: "H6", title: "Logistica → Obras", description: "Material no site, conferencia OK" },
        { number: "H7", title: "Obras → Relacionamento", description: "Vistoria aprovada, aceite do cliente" },
        { number: "H8", title: "Obras → Pos-Obra", description: "Documentacao de entrega, pendencias" },
        { number: "H9", title: "PMO → Diretoria", description: "Report semanal, metricas, alertas" },
      ],
    },
  },
  // H1
  {
    type: "grid",
    props: {
      title: "H1: Comercial → Projetos",
      label: "Detalhamento",
      cards: [
        { title: "Pacote Minimo", description: "Briefing aprovado, planta baixa, specs, fotos do local, contrato assinado", icon: "PKG" },
        { title: "SLA", description: "24h para aceitacao. 48h para inicio do projeto executivo", icon: "CLK" },
        { title: "Erro Comum", description: "Briefing incompleto, sem planta, sem fotos ou sem definicao de acabamento", icon: "ERR" },
        { title: "Regra de Bloqueio", description: "Sem contrato assinado = nao entra na fila de projetos", icon: "BLK" },
      ],
    },
  },
  // H2
  {
    type: "grid",
    props: {
      title: "H2: Projetos → Compras",
      label: "Detalhamento",
      cards: [
        { title: "Pacote Minimo", description: "Projeto executivo aprovado, lista de materiais completa, specs tecnicas, quantidades validadas", icon: "PKG" },
        { title: "SLA", description: "Aceitacao em 12h. Inicio de cotacao em D+1", icon: "CLK" },
        { title: "Erro Comum", description: "Lista de materiais incompleta, spec ambigua, quantidades sem margem de seguranca", icon: "ERR" },
        { title: "Regra de Bloqueio", description: "Projeto sem aprovacao do coord. de Projetos = Compras nao inicia", icon: "BLK" },
      ],
    },
  },
  // H3
  {
    type: "grid",
    props: {
      title: "H3: Compras → Financeiro",
      label: "Detalhamento",
      cards: [
        { title: "Pacote Minimo", description: "PO aprovada, condicoes de pagamento, prazo fornecedor, NF proforma, centro de custo", icon: "PKG" },
        { title: "SLA", description: "Aprovacao financeira em 24h. Pagamento conforme condicoes do PO", icon: "CLK" },
        { title: "Erro Comum", description: "PO sem centro de custo, condicoes divergentes do contrato, falta de NF", icon: "ERR" },
        { title: "Regra de Bloqueio", description: "PO acima do orcamento sem aprovacao do Dir. = bloqueio financeiro", icon: "BLK" },
      ],
    },
  },
  // H4
  {
    type: "grid",
    props: {
      title: "H4: Compras → Producao",
      label: "Detalhamento",
      cards: [
        { title: "Pacote Minimo", description: "Material recebido e conferido, ficha tecnica, desenho executivo, prazo de entrega", icon: "PKG" },
        { title: "SLA", description: "Confirmacao de material em ate 4h. Inicio da producao em D+1", icon: "CLK" },
        { title: "Erro Comum", description: "Material errado, quantidade insuficiente, ficha tecnica desatualizada", icon: "ERR" },
        { title: "Regra de Bloqueio", description: "Material nao conferido = producao nao inicia", icon: "BLK" },
      ],
    },
  },
  // H5
  {
    type: "grid",
    props: {
      title: "H5: Producao → Logistica",
      label: "Detalhamento",
      cards: [
        { title: "Pacote Minimo", description: "Producao concluida, QC aprovado, embalagem finalizada, romaneio, fotos pre-despacho", icon: "PKG" },
        { title: "SLA", description: "Liberacao para expedicao em 4h apos QC. Expedicao em D+1", icon: "CLK" },
        { title: "Erro Comum", description: "QC reprovado nao comunicado, embalagem inadequada, romaneio errado", icon: "ERR" },
        { title: "Regra de Bloqueio", description: "QC reprovado = nao expede. Refazer e gerar NC", icon: "BLK" },
      ],
    },
  },
  // H6
  {
    type: "grid",
    props: {
      title: "H6: Logistica → Obras",
      label: "Detalhamento",
      cards: [
        { title: "Pacote Minimo", description: "Carga conferida, NF, romaneio, fotos da embalagem, agendamento com obra", icon: "PKG" },
        { title: "SLA", description: "Entrega D-1 do inicio da obra. Conferencia no ato do recebimento", icon: "CLK" },
        { title: "Erro Comum", description: "Pecas trocadas, dano no transporte, entrega sem agendamento previo", icon: "ERR" },
        { title: "Regra de Bloqueio", description: "Conferencia com divergencia = obra nao inicia. Abrir NC", icon: "BLK" },
      ],
    },
  },
  // H7
  {
    type: "grid",
    props: {
      title: "H7: Obras → Relacionamento",
      label: "Detalhamento",
      cards: [
        { title: "Pacote Minimo", description: "Vistoria final aprovada, aceite do cliente assinado, fotos antes/depois, diario de obra", icon: "PKG" },
        { title: "SLA", description: "Handoff em ate 24h apos aceite. Primeiro contato de pos em D+3", icon: "CLK" },
        { title: "Erro Comum", description: "Aceite verbal sem registro, fotos incompletas, pendencias nao documentadas", icon: "ERR" },
        { title: "Regra de Bloqueio", description: "Sem aceite assinado = obra nao e dada como entregue", icon: "BLK" },
      ],
    },
  },
  // H8
  {
    type: "grid",
    props: {
      title: "H8: Obras → Pos-Obra",
      label: "Detalhamento",
      cards: [
        { title: "Pacote Minimo", description: "Documentacao completa de entrega, lista de pendencias remanescentes, fotos finais, termo de garantia", icon: "PKG" },
        { title: "SLA", description: "Documentacao em 48h. Resolucao de pendencias conforme prioridade", icon: "CLK" },
        { title: "Erro Comum", description: "Pendencias nao registradas, garantia sem especificacao, documentacao incompleta", icon: "ERR" },
        { title: "Regra de Bloqueio", description: "Obra sem documentacao final = nao fecha faturamento", icon: "BLK" },
      ],
    },
  },
  // H9
  {
    type: "grid",
    props: {
      title: "H9: PMO → Diretoria",
      label: "Detalhamento",
      cards: [
        { title: "Pacote Minimo", description: "Report semanal consolidado, metricas por area, alertas ativos, status de obras criticas", icon: "PKG" },
        { title: "SLA", description: "Report entregue toda segunda ate 10h. Revisao na reuniao de diretoria", icon: "CLK" },
        { title: "Erro Comum", description: "Dados desatualizados, metricas sem contexto, alertas sem sugestao de acao", icon: "ERR" },
        { title: "Regra de Bloqueio", description: "Report com dados de mais de 48h = rejeicao e reenvio", icon: "BLK" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Evidencia Obrigatoria",
      label: "Padrao de Qualidade",
      content: "Todo handoff exige evidencia documental. Sem evidencia, a IA bloqueia a passagem e notifica o gestor.",
      bullets: [
        { label: "Fotos", text: "Estado do material, local de obra, conferencia" },
        { label: "Documentos", text: "NF, PO, contrato, ficha tecnica, planta" },
        { label: "Aprovacoes", text: "Assinatura digital ou confirmacao no sistema" },
        { label: "Checklists", text: "100% completo para liberacao" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 07 — PROCESSOS POR DEPARTAMENTO
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 07",
      title: "Processos por\nDepartamento",
      subtitle: "O que cada area faz, seus inputs, outputs e KPIs.",
    },
  },
  {
    type: "role",
    props: {
      role: "Comercial",
      label: "Departamento",
      mission: "Converter leads qualificados em contratos assinados com margem saudavel.",
      image: IMG_TEAM,
      responsibilities: [
        "Qualificacao de leads (Inbound + Outbound + Indicacao)",
        "Showroom e visita tecnica",
        "Elaboracao de propostas e orcamentos",
        "Negociacao e fechamento",
        "Handoff formal para Projetos",
      ],
      kpis: ["Taxa de conversao", "Ticket medio", "Ciclo de venda", "Pipeline ativo", "CAC"],
    },
  },
  {
    type: "role",
    props: {
      role: "Projetos / Engenharia",
      label: "Departamento",
      mission: "Transformar briefing comercial em projeto executivo preciso e viavel.",
      image: IMG_ORG,
      responsibilities: [
        "Projeto executivo e detalhamento tecnico",
        "Especificacao de materiais e acabamentos",
        "Compatibilizacao com obra civil",
        "Revisao tecnica e aprovacao interna",
        "Handoff formal para Compras",
      ],
      kpis: ["Lead time de projeto", "Retrabalho (%)", "Aprovacao 1a versao", "NCs por projeto"],
    },
  },
  {
    type: "role",
    props: {
      role: "Compras / Supply Chain",
      label: "Departamento",
      mission: "Garantir materiais no prazo, qualidade e custo conforme orcado.",
      image: IMG_QC,
      responsibilities: [
        "Cotacao e negociacao com fornecedores",
        "Emissao de POs e controle de entregas",
        "Conferencia de material recebido",
        "Gestao de estoque minimo e lead times",
        "Handoff formal para Producao e Financeiro",
      ],
      kpis: ["Lead time de compra", "Custo vs. orcado", "OTIF fornecedor", "Estoque girado", "NCs de material"],
    },
  },
  {
    type: "role",
    props: {
      role: "Producao Industrial",
      label: "Departamento",
      mission: "Fabricar com qualidade, prazo e custo dentro do orcado.",
      image: IMG_PROD,
      responsibilities: [
        "Planejamento e programacao de producao",
        "Corte CNC, montagem e acabamento",
        "Controle de qualidade (QC) em cada etapa",
        "Gestao de capacidade e turnos",
        "Handoff formal para Logistica",
      ],
      kpis: ["OEE", "Lead time fabrica", "Indice de rejeicao", "Custo/hora", "Aderencia ao plano"],
    },
  },
  {
    type: "role",
    props: {
      role: "Logistica / Expedicao",
      label: "Departamento",
      mission: "Garantir que o material certo chegue no local certo, no prazo e sem avaria.",
      image: IMG_LOG,
      responsibilities: [
        "Separacao e conferencia de pedidos",
        "Embalagem e protecao adequada",
        "Roteirizacao e agendamento de entregas",
        "Controle de avarias e nao-conformidades",
        "Handoff formal para Obras",
      ],
      kpis: ["OTIF", "Avarias (%)", "Custo de frete/venda", "Tempo de separacao"],
    },
  },
  {
    type: "role",
    props: {
      role: "Obras / Instalacao",
      label: "Departamento",
      mission: "Executar a instalacao em campo com qualidade, seguranca e dentro do cronograma.",
      image: IMG_OBRA,
      responsibilities: [
        "Check-in de obra (vistoria pre-instalacao)",
        "Execucao conforme projeto executivo",
        "Diario de obra e fotos diarias",
        "Vistoria final e aceite do cliente",
        "Handoff formal para Relacionamento/Pos-Obra",
      ],
      kpis: ["Prazo vs. planejado", "Retrabalho em obra", "NPS de instalacao", "Custo/m2 instalado"],
    },
  },
  {
    type: "grid",
    props: {
      title: "Demais Departamentos",
      label: "Resumo",
      cards: [
        { title: "Administracao", description: "Financeiro, RH, fiscal, sistemas. Suporte a operacao. SLA de pagamento e contratacao", icon: "ADM" },
        { title: "Marketing", description: "Geracao de leads, marca, conteudo, trafego pago. Alinhamento com Comercial", icon: "MKT" },
        { title: "Relacionamento / Pos-Obra", description: "Satisfacao, garantia, manutencao, NPS, recompra e indicacao", icon: "REL" },
        { title: "PMO / Produtividade", description: "Processos, metricas, melhoria continua, reports executivos, OKRs", icon: "PMO" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 08 — SISTEMA DE PRODUTIVIDADE & PERDAS
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 08",
      title: "Produtividade\n& Perdas",
      subtitle: "Medicao de tempo, custo e retrabalho. Painel de perdas e relatorios automaticos.",
    },
  },
  {
    type: "split",
    props: {
      title: "Sistema de Produtividade",
      image: IMG_RISK,
      label: "Medicao",
      subtitle: "Medir para melhorar. Sem dados, nao ha gestao.",
      items: [
        "Tempo por obra — do contrato a entrega",
        "Custo por obra — orcado vs. realizado",
        "Produtividade por equipe — m2/dia, pecas/dia",
        "Retrabalho — horas gastas refazendo",
        "Tempo parado — espera de material, bloqueio",
        "Tempo produtivo — horas efetivas na tarefa",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "3 Relatorios Automaticos",
      label: "Outputs",
      cards: [
        { title: "Relatorio Semanal", description: "Consolidado de todas as obras ativas. Destaques, alertas, SLAs vencidos, ranking de equipes. Gerado pela IA toda segunda.", icon: "SEM" },
        { title: "Relatorio por Obra", description: "Timeline, custo acumulado, margem parcial, desvios, NCs, fotos. Atualizado automaticamente.", icon: "OBR" },
        { title: "Relatorio por Equipe", description: "Produtividade, horas apontadas, retrabalho, tempo parado, ranking. Base para bonus e feedback.", icon: "EQP" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Painel de Perdas",
      label: "O que rastrear",
      subtitle: "Cada perda e registrada, categorizada e tem dono para resolver.",
      bullets: [
        { label: "Retrabalho", text: "Refazer algo que ja estava pronto — fabrica ou obra" },
        { label: "Erro de compra", text: "Material errado, quantidade errada, fornecedor errado" },
        { label: "Atrasos", text: "Qualquer etapa que extrapolou o SLA" },
        { label: "Falha de comunicacao", text: "Informacao que nao chegou ou chegou errada" },
        { label: "NC (Nao-Conformidade)", text: "Defeito de qualidade, desvio de spec" },
        { label: "Frete extra", text: "Entrega adicional por erro, urgencia ou esquecimento" },
        { label: "Urgencia", text: "Custo adicional por demanda fora do planejamento" },
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Produtividade vs. Perdas",
      label: "Comparativo",
      leftTitle: "O que medir",
      leftItems: [
        "Custo hora por equipe e por obra",
        "m2 produzido / m2 instalado por dia",
        "Tempo medio por etapa do fluxo",
        "Margem real vs. margem orcada",
        "Indice de retrabalho por area",
      ],
      rightTitle: "Como medir",
      rightItems: [
        "Apontamento diario no sistema (check-in/out)",
        "Fotos de evidencia com geotag e timestamp",
        "Relatorio semanal automatico da IA",
        "Fechamento mensal por obra com P&L",
        "Ranking de equipes com gamificacao",
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 09 — SCORES DE RISCO & CONFIABILIDADE
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 09",
      title: "Scores de Risco\n& Confiabilidade",
      subtitle: "Score por obra e por departamento, calculados automaticamente pela IA.",
    },
  },
  {
    type: "content",
    props: {
      title: "Score de Risco\npor Obra",
      label: "Risk Score",
      subtitle: "Cada obra ativa recebe um score de risco automatico baseado em:",
      bullets: [
        { label: "Atraso", text: "Diferenca entre planejado e real em cada etapa" },
        { label: "Retrabalho", text: "Quantidade de refazer registrados na obra" },
        { label: "NC (Nao-Conformidades)", text: "Defeitos, desvios e problemas de qualidade" },
        { label: "Bloqueios", text: "Numero de vezes que a obra ficou travada" },
        { label: "Mudancas de escopo", text: "Alteracoes solicitadas pelo cliente apos contrato" },
      ],
    },
  },
  {
    type: "metrics",
    props: {
      title: "Faixas de Risco",
      label: "Classificacao",
      subtitle: "Score calculado de 0 a 100",
      metrics: [
        { value: "0-25", label: "Baixo Risco", description: "Obra fluindo conforme planejado" },
        { value: "26-50", label: "Atencao", description: "Desvios pontuais — monitorar" },
        { value: "51-75", label: "Alto Risco", description: "Intervencao do gestor necessaria" },
        { value: "76+", label: "Critico", description: "War Room — acao imediata" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Score de Confiabilidade\npor Departamento",
      label: "Dept Score",
      subtitle: "Cada departamento recebe um score de confiabilidade baseado em:",
      bullets: [
        { label: "Cumprimento de SLA", text: "% de handoffs entregues dentro do prazo" },
        { label: "Qualidade do handoff", text: "% de handoffs aceitos sem rejeicao" },
        { label: "Retrabalho gerado", text: "Quantidade de refazer causados pela area" },
        { label: "Bloqueios causados", text: "Vezes que a area travou o fluxo de outra" },
      ],
    },
  },
  {
    type: "statement",
    props: {
      statement: "O que nao se mede, nao se gerencia.\nO que nao se gerencia, deteriora.",
      attribution: "Enterprise OS — Principio de Medicao",
      label: "Fundamento",
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 10 — AGENTES DE IA
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 10",
      title: "Agentes\nde IA",
      subtitle: "8 agentes especializados + 1 Control Tower central.",
    },
  },
  {
    type: "split",
    props: {
      title: "IA como Coordenador",
      subtitle: "A IA nao executa. Ela coordena, monitora e garante que o processo flui.",
      image: IMG_AI,
      label: "Filosofia",
      items: [
        "Monitorar fluxo em tempo real",
        "Detectar gargalos antes que virem crises",
        "Alertar atrasos automaticamente",
        "Cobrar responsaveis por SLA vencido",
        "Gerar relatorios e resumos de obra",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Agentes por Area",
      label: "Especificacao",
      cards: [
        { title: "Agente Comercial", description: "Qualificacao de leads, follow-up automatico, alertas de pipeline frio, sugestao de proxima acao", icon: "COM" },
        { title: "Agente Projetos", description: "Alerta de prazo, checklist de projeto, validacao de specs, deteccao de retrabalho", icon: "ENG" },
        { title: "Agente Compras", description: "Comparacao de cotacoes, alerta de lead time, controle de estoque minimo, conf. NF", icon: "SUP" },
        { title: "Agente Producao", description: "Monitoramento OEE, alerta de capacidade, priorizacao de fila, QC automatizado", icon: "PRD" },
        { title: "Agente Logistica", description: "Roteirizacao inteligente, alerta de avaria, tracking em tempo real, conf. romaneio", icon: "LOG" },
        { title: "Agente Obras", description: "Check-in/out diario, diario de obra automatico, alerta de desvio, NPS pos-instalacao", icon: "OBR" },
        { title: "Agente Financeiro", description: "Controle de fluxo, alertas de inadimplencia, conciliacao automatica, DRE por obra", icon: "FIN" },
        { title: "Agente Relacionamento", description: "NPS automatico, agendamento de manutencao, campanha de recompra, gestao de garantia", icon: "REL" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Control Tower",
      label: "Agente Central",
      subtitle: "O cerebro do sistema: visao 360 de toda a operacao.",
      highlight: "Funcoes do Control Tower:",
      bullets: [
        { label: "Monitorar fluxo", text: "Identifica onde a operacao esta e onde deveria estar" },
        { label: "Detectar gargalos", text: "Alerta automatico quando area acumula cards" },
        { label: "Alertar atraso", text: "Notificacao + escalonamento automatico" },
        { label: "Cobrar responsaveis", text: "Mensagem direta para quem esta devendo SLA" },
        { label: "Gerar relatorios", text: "Report semanal, por obra, por equipe — automatico" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 11 — PLAYBOOK OPERACIONAL
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 11",
      title: "Playbook\nOperacional",
      subtitle: "Os 10 pilares do sistema operacional da Parket.",
    },
  },
  {
    type: "process",
    props: {
      title: "Os 10 Pilares",
      label: "Playbook",
      steps: [
        { number: "01", title: "Estrutura Organizacional", description: "Organograma com 10 departamentos e hierarquia clara" },
        { number: "02", title: "Fluxo End-to-End", description: "11 macroetapas com gates obrigatorios" },
        { number: "03", title: "Processos por Departamento", description: "Inputs, outputs e KPIs de cada area" },
        { number: "04", title: "Handoffs Criticos", description: "9 passagens formais com SLA, checklist e evidencia" },
        { number: "05", title: "Sistema RACI", description: "Matriz por macroprocesso, departamento e decisao" },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Os 10 Pilares (cont.)",
      label: "Playbook",
      steps: [
        { number: "06", title: "Operating Layer — 4 Camadas", description: "Workspace, Painel, Kanban, Control Tower" },
        { number: "07", title: "Estrutura de Kanbans", description: "7 colunas padrao, cards com SLA e handoff" },
        { number: "08", title: "Regras de Comunicacao", description: "Daily, weekly, monthly, War Room, canais" },
        { number: "09", title: "Produtividade & Perdas", description: "Apontamento, custo hora, painel de perdas, 3 relatorios" },
        { number: "10", title: "Agentes de IA", description: "8 agentes + Control Tower com scores automaticos" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Regras de Comunicacao",
      label: "Pilar 08",
      bullets: [
        { label: "Daily", text: "Standup de 15min por departamento — o que fiz, o que farei, bloqueios" },
        { label: "Weekly", text: "Reuniao semanal de lideres com painel Control Tower" },
        { label: "Monthly", text: "Review mensal de OKRs e metricas com diretoria" },
        { label: "War Room", text: "Acionada automaticamente pela IA em caso de obra critica (score 76+)" },
        { label: "Canais", text: "Slack/Teams por area + canal #alertas (somente IA e Control Tower)" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 12 — ROADMAP
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 12",
      title: "Roadmap &\nProximos Passos",
      subtitle: "Implementacao em 4 ondas ao longo de 90 dias.",
    },
  },
  {
    type: "process",
    props: {
      title: "Roadmap de 90 Dias",
      label: "Implementacao",
      steps: [
        { number: "S1-2", title: "Onda 1 — Fundacao", description: "Organograma oficial, fluxo E2E validado, RACI assinado, colunas Kanban definidas" },
        { number: "S3-4", title: "Onda 2 — Sistema", description: "Workspace Central + Kanbans departamentais, cards padronizados, Painel do Cliente" },
        { number: "S5-8", title: "Onda 3 — Handoffs & IA", description: "9 handoffs formais, primeiros agentes IA (Comercial + Obras + Producao), scores de risco" },
        { number: "S9-12", title: "Onda 4 — Control Tower", description: "Dashboard executivo, todos os agentes ativos, painel de perdas, produtividade, War Room" },
      ],
    },
  },
  {
    type: "metrics",
    props: {
      title: "Metas do Enterprise OS",
      label: "KPIs de Sucesso",
      metrics: [
        { value: "100%", label: "Handoffs Formais", description: "Todas as 9 passagens com SLA" },
        { value: "< 48h", label: "SLA Medio de Handoff", description: "Tempo maximo entre areas" },
        { value: "9", label: "Agentes IA Ativos", description: "8 por area + Control Tower" },
        { value: "0", label: "Etapas sem Dono", description: "RACI completo para 100% do fluxo" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Criterios de Qualidade",
      label: "Padrao",
      subtitle: "O resultado deste Enterprise OS deve ser:",
      items: [
        "Claro — qualquer colaborador entende sem treinamento extra",
        "Aplicavel — cada processo tem dono, prazo e entregavel",
        "Simples — evitar complexidade desnecessaria para o time operacional",
        "Auditavel — toda acao gera registro, evidencia e timestamp",
        "Funcional — feito para quem esta na operacao, nao para consultores",
      ],
    },
  },
  {
    type: "statement",
    props: {
      statement: "Um sistema operacional nao e um documento.\nE a forma como a empresa realmente funciona.",
      attribution: "Parket Enterprise OS",
      label: "Principio",
    },
  },
  {
    type: "closing",
    props: {
      title: "Enterprise OS\nParket",
      subtitle: "Sistema Operacional Empresarial\nv2.0 — Marco 2026",
      image: IMG_COVER,
    },
  },
];
