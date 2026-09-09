import type { SlideData } from "./slides-data";

const IMG_CMD = "https://images.unsplash.com/photo-1692133211836-52846376d66f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxleGVjdXRpdmUlMjBjb21tYW5kJTIwY2VudGVyJTIwZGFyayUyMHNjcmVlbnN8ZW58MXx8fHwxNzcyODg4NDEwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_FIN = "https://images.unsplash.com/photo-1759661966728-4a02e3c6ed91?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNpYWwlMjBkYXNoYm9hcmQlMjBtZXRyaWNzJTIwYW5hbHlzaXN8ZW58MXx8fHwxNzcyODg4NDEwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_MEET = "https://images.unsplash.com/photo-1771147372634-976f022c0033?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjBleGVjdXRpdmUlMjBtZWV0aW5nJTIwdGFibGV8ZW58MXx8fHwxNzcyODg4NDExfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_PROD = "https://images.unsplash.com/photo-1469289759076-d1484757abc3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwd2FyZWhvdXNlJTIwcHJvZHVjdGlvbiUyMGxpbmV8ZW58MXx8fHwxNzcyODg4NDExfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_WAR = "https://images.unsplash.com/photo-1573742287010-81e9aeab57e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwY29udHJvbCUyMHJvb20lMjBtb25pdG9ycyUyMHRlY2hub2xvZ3l8ZW58MXx8fHwxNzcyODg4NDE2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_RISK = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXRhJTIwYW5hbHl0aWNzJTIwcmlzayUyMGRhc2hib2FyZCUyMGRhcmt8ZW58MXx8fHwxNzcyODg3NDc2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_AI = "https://images.unsplash.com/photo-1749006590639-e749e6b7d84c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpZmljaWFsJTIwaW50ZWxsaWdlbmNlJTIwdGVjaG5vbG9neSUyMGFic3RyYWN0fGVufDF8fHx8MTc3Mjg3OTA4NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_COVER = "https://images.unsplash.com/photo-1769739132671-ac41c439d51e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3b29kJTIwZmxvb3JpbmclMjBwcmVtaXVtJTIwaW50ZXJpb3J8ZW58MXx8fHwxNzcyODg3MTg1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_CHESS = "https://images.unsplash.com/photo-1677816155981-919b9a6eeded?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGVzcyUyMHN0cmF0ZWd5JTIwZGVjaXNpb24lMjBleGVjdXRpdmV8ZW58MXx8fHwxNzcyODg5MDYyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const IMG_CLOCK = "https://images.unsplash.com/photo-1741981193724-1bb1211405d5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdG9wd2F0Y2glMjB1cmdlbmN5JTIwdGltZSUyMHByZXNzdXJlJTIwYnVzaW5lc3N8ZW58MXx8fHwxNzcyODg5MDYyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

export const commandCenterSlides: SlideData[] = [
  // ═══════════════════════════════════════════
  // ABERTURA
  // ═══════════════════════════════════════════
  {
    type: "cover",
    props: {
      title: "Command\nCenter",
      subtitle: "Centro de comando executivo da Parket. 5 camadas, 10 dashboards, Executive Action Engine, scores automaticos, War Room e Control Tower IA.",
      image: IMG_CMD,
    },
  },
  {
    type: "content",
    props: {
      title: "O que e o Command Center",
      label: "Introducao",
      content: "Sistema de comando executivo que mostra de forma simples e acionavel o status de toda a operacao. Cada indicador serve para uma decisao. Cada dashboard serve para uma reuniao.",
      bullets: [
        { label: "Para quem", text: "CEO, diretoria, coordenadores, agentes de IA" },
        { label: "Quando usar", text: "Reunioes semanais, war rooms, tomada de decisao diaria" },
        { label: "Principio", text: "Objetivo, executivo, operacional. Nada generico." },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "O que o Command Center mostra",
      label: "10 Visoes",
      bullets: [
        { label: "01", text: "Obras em risco" },
        { label: "02", text: "Gargalos por departamento" },
        { label: "03", text: "Perdas financeiras" },
        { label: "04", text: "Produtividade por equipe" },
        { label: "05", text: "Atrasos criticos" },
        { label: "06", text: "Handoffs quebrados" },
        { label: "07", text: "Margem por obra" },
        { label: "08", text: "Performance comercial" },
        { label: "09", text: "Capacidade operacional" },
        { label: "10", text: "Prioridades da semana" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Indice",
      label: "Navegacao",
      bullets: [
        { label: "Cap 01", text: "Arquitetura — 5 Camadas" },
        { label: "Cap 02", text: "10 Dashboards Obrigatorios" },
        { label: "Cap 03", text: "Indicadores A-J Completos" },
        { label: "Cap 04", text: "Score de Risco por Obra (0-100)" },
        { label: "Cap 05", text: "Score de Confiabilidade por Departamento (A-D)" },
        { label: "Cap 06", text: "War Room Automatica" },
        { label: "Cap 07", text: "Control Tower IA" },
        { label: "Cap 08", text: "Executive Action Engine — 5 Saidas" },
        { label: "Cap 09", text: "3 Paineis de Acao: Action Board, Decision Deck, War Room Trigger" },
        { label: "Cap 10", text: "Logica Operacional Semanal" },
        { label: "Cap 11", text: "Sistema de Alertas (Vermelho / Amarelo / Azul)" },
        { label: "Cap 12", text: "Integracao com Workspace Central" },
        { label: "Cap 13", text: "Guia: Reuniao Semanal da Diretoria" },
      ],
    },
  },

  // ═══════════════════════════════════════════
  // CAP 01 — ARQUITETURA 5 CAMADAS
  // ═══════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 01",
      title: "Arquitetura\n5 Camadas",
      subtitle: "Do painel executivo ao Control Tower IA.",
    },
  },
  {
    type: "process",
    props: {
      title: "As 5 Camadas",
      label: "Arquitetura",
      steps: [
        { number: "C1", title: "Visao Executiva", description: "Painel principal: obras ativas, risco, margem, perdas, produtividade, scores, top 10 decisoes" },
        { number: "C2", title: "Visao de Risco por Obra", description: "Cada obra: status, avanco, custo, score, riscos, NC, bloqueios, proximos 7 dias" },
        { number: "C3", title: "Visao por Departamento", description: "10 departamentos: SLA, gargalos, handoffs, retrabalho, score de confiabilidade" },
        { number: "C4", title: "Produtividade & Margem", description: "Horas produtivas/improdutivas, custo por obra/equipe, margem industrial e full" },
        { number: "C5", title: "Control Tower IA", description: "Alertas automaticos, decisoes pendentes, gargalos por handoff, sugestoes de acao" },
      ],
    },
  },
  // C1
  {
    type: "split",
    props: {
      title: "Camada 1\nVisao Executiva",
      image: IMG_CMD,
      label: "Painel Principal",
      subtitle: "Tudo que o CEO precisa ver em 30 segundos.",
      items: [
        "Total de obras ativas",
        "Obras em risco / obras criticas",
        "Margem media por obra",
        "Custo de perdas no mes",
        "Produtividade media",
        "Score de confiabilidade por departamento",
        "Top 10 decisoes da semana",
      ],
    },
  },
  // C2
  {
    type: "content",
    props: {
      title: "Camada 2\nVisao de Risco por Obra",
      label: "Drill-down por Obra",
      subtitle: "Cada obra ativa tem seu painel individual com:",
      bullets: [
        { label: "Status atual", text: "Etapa do fluxo E2E, % de avanco real vs. planejado" },
        { label: "Custo", text: "Real vs. previsto, desvio acumulado" },
        { label: "Score de risco", text: "0-100, calculado automaticamente" },
        { label: "Top 5 riscos", text: "Maiores ameacas ativas nessa obra" },
        { label: "Retrabalho + NC", text: "Horas e custo de refazer + nao-conformidades" },
        { label: "Bloqueios", text: "O que esta travando a obra agora" },
        { label: "Responsavel atual", text: "Quem e o dono da etapa vigente" },
        { label: "Proximo handoff", text: "Para quem vai e quando" },
        { label: "Proximos 7 dias", text: "O que esta planejado para a semana" },
      ],
    },
  },
  // C3
  {
    type: "content",
    props: {
      title: "Camada 3\nVisao por Departamento",
      label: "10 Departamentos",
      subtitle: "Cada departamento exibe seu painel com:",
      bullets: [
        { label: "Cards em atraso", text: "Tarefas que ultrapassaram o SLA" },
        { label: "SLA vencido", text: "% de entregas fora do prazo" },
        { label: "Gargalos", text: "Onde a area esta acumulando trabalho" },
        { label: "Handoffs nao aceitos", text: "Passagens que o receptor nao confirmou" },
        { label: "Retrabalho causado", text: "Horas/custo de refazer gerado pela area" },
        { label: "Score de confiabilidade", text: "A/B/C/D — calculado automaticamente" },
        { label: "Performance da semana", text: "Tendencia vs. semana anterior" },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Departamentos Monitorados",
      label: "Camada 3",
      cards: [
        { title: "Comercial", description: "Pipeline, propostas, conversao, forecast", icon: "COM" },
        { title: "Projetos", description: "Lead time, retrabalho, aprovacoes", icon: "ENG" },
        { title: "Compras", description: "Urgencias, lead time, validacao tecnica", icon: "SUP" },
        { title: "Financeiro", description: "Fluxo, inadimplencia, conciliacao", icon: "FIN" },
        { title: "Fiscal", description: "NFs, tributos, compliance", icon: "FSC" },
        { title: "Producao", description: "OTIF, ordens atrasadas, retrabalho fabril", icon: "PRD" },
        { title: "Logistica", description: "OTIF entrega, avarias, reentregas", icon: "LOG" },
        { title: "Obras", description: "Diarios, NC, FPY, atraso por equipe", icon: "OBR" },
        { title: "Relacionamento", description: "SLA resposta, chamados, NPS", icon: "REL" },
        { title: "PMO / Produtividade", description: "Metricas, processos, OKRs", icon: "PMO" },
      ],
    },
  },
  // C4
  {
    type: "split",
    props: {
      title: "Camada 4\nProdutividade & Margem",
      image: IMG_FIN,
      label: "Metricas Financeiras",
      subtitle: "Onde o dinheiro esta indo — e onde deveria ir.",
      items: [
        "Horas produtivas vs. improdutivas",
        "Custo por obra e por equipe",
        "Produtividade por tipologia (piso, forro, deck...)",
        "Margem industrial por obra",
        "Margem full por obra (com overhead)",
        "Retrabalho em horas e R$",
        "Custo de urgencia e frete extra",
      ],
    },
  },
  // C5
  {
    type: "split",
    props: {
      title: "Camada 5\nControl Tower IA",
      image: IMG_AI,
      label: "Inteligencia Central",
      subtitle: "A IA consolida, alerta e sugere. Nao executa.",
      items: [
        "Alertas automaticos do dia",
        "Decisoes pendentes com prazo",
        "Gargalos por handoff",
        "Handoffs sem confirmacao",
        "Score de risco por obra (tendencia)",
        "Score de confiabilidade por departamento (tendencia)",
        "Sugestoes de acao da IA",
      ],
    },
  },

  // ═══════════════════════════════════════════
  // CAP 02 — 10 DASHBOARDS
  // ═══════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 02",
      title: "10 Dashboards\nObrigatorios",
      subtitle: "Cada dashboard resolve um problema especifico.",
    },
  },
  {
    type: "grid",
    props: {
      title: "Dashboards 1-5",
      label: "Paineis Principais",
      cards: [
        { title: "01 — Executivo Principal", description: "Visao consolidada: obras ativas, criticas, margem, perdas, produtividade, decisoes da semana", icon: "CEO" },
        { title: "02 — Obras em Risco", description: "Ranking de obras por score de risco, drill-down para detalhes, proximos 7 dias", icon: "RSK" },
        { title: "03 — Perdas", description: "Retrabalho, NC, frete extra, urgencias, erros de compra. Custo total de perda no mes", icon: "PER" },
        { title: "04 — Produtividade", description: "Horas produtivas/improdutivas, custo hora, ranking de equipes, tendencia 90 dias", icon: "PRO" },
        { title: "05 — Margem por Obra", description: "Margem industrial vs. full, orcado vs. real, desvios, top 5 melhores e piores", icon: "MAR" },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Dashboards 6-10",
      label: "Paineis Setoriais",
      cards: [
        { title: "06 — Comercial", description: "Leads, propostas, showroom, conversao, ticket medio, pipeline, forecast mensal", icon: "COM" },
        { title: "07 — Handoffs", description: "Mapa de passagens: aceitos, pendentes, rejeitados, SLA vencido, gargalos de transicao", icon: "HND" },
        { title: "08 — Confiabilidade Dept.", description: "Score A/B/C/D por departamento, tendencia, piores metricas, plano de acao", icon: "SCR" },
        { title: "09 — Capacidade Producao", description: "Capacidade vs. demanda, fila de ordens, turnos, OEE, gargalo por etapa fabril", icon: "CAP" },
        { title: "10 — Pos-obra / Relacionamento", description: "NPS, chamados, reincidencia, SLA de resposta, risco reputacional", icon: "POS" },
      ],
    },
  },

  // ═══════════════════════════════════════════
  // CAP 03 — INDICADORES A-J
  // ═══════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 03",
      title: "Indicadores\nCompletos",
      subtitle: "10 categorias de indicadores (A-J). Cada um serve para uma decisao.",
    },
  },
  // A
  {
    type: "content",
    props: {
      title: "A — Indicadores Executivos",
      label: "Categoria A",
      subtitle: "Visao macro para CEO e diretoria",
      bullets: [
        { label: "Obras ativas", text: "Total de obras em andamento neste momento" },
        { label: "Obras criticas", text: "Score de risco abaixo de 60" },
        { label: "Faturamento previsto mes", text: "Receita projetada com base no pipeline + entregas" },
        { label: "Margem media", text: "Margem full media ponderada por faturamento" },
        { label: "Custo de perdas", text: "Soma de retrabalho + NC + frete extra + urgencias" },
        { label: "Prazo medio vs. prometido", text: "Dias de desvio entre entrega real e promessa" },
      ],
    },
  },
  // B
  {
    type: "content",
    props: {
      title: "B — Indicadores de Obras",
      label: "Categoria B",
      subtitle: "Status detalhado de cada obra",
      bullets: [
        { label: "Avanco %", text: "Percentual real de conclusao vs. planejado" },
        { label: "Atraso em dias", text: "Diferenca entre cronograma e execucao real" },
        { label: "Custos acumulados", text: "Total gasto ate o momento vs. orcamento" },
        { label: "Horas totais", text: "Soma de horas apontadas na obra" },
        { label: "Horas improdutivas", text: "Tempo parado, espera, retrabalho" },
        { label: "NC abertas", text: "Nao-conformidades ativas sem resolucao" },
        { label: "Retrabalho", text: "Horas e custo de refazer" },
        { label: "Score de risco", text: "0-100, calculado pela IA" },
      ],
    },
  },
  // C
  {
    type: "content",
    props: {
      title: "C — Indicadores de Departamento",
      label: "Categoria C",
      subtitle: "Performance de cada area",
      bullets: [
        { label: "SLA cumprido", text: "% de entregas dentro do prazo acordado" },
        { label: "Handoffs aceitos no prazo", text: "% de passagens confirmadas dentro do SLA" },
        { label: "Cards bloqueados", text: "Tarefas travadas no Kanban da area" },
        { label: "Retrabalho gerado", text: "Refazer causado por falha da area" },
        { label: "Backlog vencido", text: "Tarefas no backlog alem do prazo" },
        { label: "Score de confiabilidade", text: "A/B/C/D — nota geral do departamento" },
      ],
    },
  },
  // D
  {
    type: "content",
    props: {
      title: "D — Indicadores Comerciais",
      label: "Categoria D",
      subtitle: "Pipeline e conversao de vendas",
      bullets: [
        { label: "Leads", text: "Novos leads no periodo (por canal)" },
        { label: "Propostas", text: "Orcamentos enviados e em negociacao" },
        { label: "Visitas showroom", text: "Agendadas e realizadas" },
        { label: "Follow-ups", text: "Cadencias executadas vs. planejadas" },
        { label: "Taxa de conversao", text: "% lead → contrato assinado" },
        { label: "Ticket medio", text: "Valor medio dos contratos fechados" },
        { label: "Forecast", text: "Previsao de receita para os proximos 90 dias" },
      ],
    },
  },
  // E
  {
    type: "content",
    props: {
      title: "E — Indicadores de Compras",
      label: "Categoria E",
      bullets: [
        { label: "Urgencias", text: "Compras feitas fora do fluxo normal por emergencia" },
        { label: "Lead time medio", text: "Dias entre PO e recebimento do material" },
        { label: "Compras fora de SLA", text: "% de POs que nao cumpriram prazo" },
        { label: "Sem validacao tecnica", text: "Compras feitas sem aprovacao de Projetos" },
        { label: "Score fornecedor", text: "Nota por fornecedor baseada em OTIF, qualidade, preco" },
      ],
    },
  },
  // F
  {
    type: "content",
    props: {
      title: "F — Indicadores de Producao",
      label: "Categoria F",
      bullets: [
        { label: "OTIF producao", text: "% de ordens entregues completas e no prazo" },
        { label: "Ordens atrasadas", text: "Quantidade de ordens fora do cronograma" },
        { label: "Retrabalho fabril", text: "Horas e custo de refazer na fabrica" },
        { label: "Tempo por lote", text: "Horas medias para completar um lote de producao" },
        { label: "Gargalo por etapa", text: "Etapa da fabrica com mais acumulo/espera" },
      ],
    },
  },
  // G
  {
    type: "content",
    props: {
      title: "G — Indicadores de Logistica",
      label: "Categoria G",
      bullets: [
        { label: "Entregas completas no prazo", text: "OTIF de logistica — carga certa, hora certa" },
        { label: "Reentregas", text: "Entregas que precisaram ser repetidas" },
        { label: "Avarias", text: "Danos durante transporte ou manuseio" },
        { label: "Sem dados completos", text: "Entregas sem NF, romaneio ou fotos" },
        { label: "Falha de conferencia", text: "Divergencia entre romaneio e carga real" },
      ],
    },
  },
  // H
  {
    type: "content",
    props: {
      title: "H — Indicadores de Obras (Campo)",
      label: "Categoria H",
      bullets: [
        { label: "Diarios completos", text: "% de dias com diario de obra preenchido" },
        { label: "Frente liberada na 1a", text: "% de vezes que a obra iniciou sem retrabalho de frente" },
        { label: "NC / 100 entregas", text: "Nao-conformidades a cada 100 entregas de material" },
        { label: "FPY (First Pass Yield)", text: "% de instalacoes aprovadas na 1a vistoria" },
        { label: "Atraso por equipe", text: "Dias de atraso por equipe de instalacao" },
      ],
    },
  },
  // I
  {
    type: "content",
    props: {
      title: "I — Indicadores de Relacionamento",
      label: "Categoria I",
      bullets: [
        { label: "SLA de resposta", text: "Tempo medio de resposta a solicitacoes do cliente" },
        { label: "Chamados abertos", text: "Total de solicitacoes em aberto" },
        { label: "Chamados reincidentes", text: "Solicitacoes que voltaram apos resolucao" },
        { label: "NPS", text: "Net Promoter Score — satisfacao geral" },
        { label: "Risco reputacional", text: "Clientes com experiencia negativa ativa" },
      ],
    },
  },
  // J
  {
    type: "content",
    props: {
      title: "J — Indicadores de Produtividade",
      label: "Categoria J",
      bullets: [
        { label: "Custo hora por equipe", text: "R$/hora real por equipe de instalacao/producao" },
        { label: "Unidade por hora", text: "m2/hora, pecas/hora por tipo de produto" },
        { label: "Custo direto por obra", text: "Material + mao de obra + frete" },
        { label: "Custo total por obra", text: "Direto + indireto + overhead" },
        { label: "Margem industrial", text: "Receita - custo direto" },
        { label: "Margem full", text: "Receita - custo total (com overhead)" },
      ],
    },
  },

  // ═══════════════════════════════════════════
  // CAP 04 — SCORE DE RISCO POR OBRA
  // ═══════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 04",
      title: "Score de Risco\npor Obra",
      subtitle: "Modelo 0-100 com 10 variaveis e 4 faixas de classificacao.",
    },
  },
  {
    type: "split",
    props: {
      title: "10 Variaveis do Score",
      image: IMG_RISK,
      label: "Composicao",
      subtitle: "Cada variavel tem peso e e calculada automaticamente pela IA.",
      items: [
        "Atraso em gate (passagem entre etapas)",
        "Atraso de cronograma geral",
        "Compras criticas pendentes",
        "Frente nao liberada",
        "Falta de diario de obra",
        "NC alta (nao-conformidade grave)",
        "Retrabalho alto",
        "Cliente sensivel (historico ou VIP)",
        "Mudanca de escopo frequente",
        "Material critico em risco de entrega",
      ],
    },
  },
  {
    type: "metrics",
    props: {
      title: "Faixas de Classificacao",
      label: "Score de Risco",
      subtitle: "Score de 0 a 100 — quanto maior, mais saudavel",
      metrics: [
        { value: "90-100", label: "Saudavel", description: "Obra fluindo conforme planejado" },
        { value: "75-89", label: "Atencao", description: "Desvios pontuais — monitorar" },
        { value: "60-74", label: "Risco", description: "Intervencao do gestor necessaria" },
        { value: "<60", label: "Critico / War Room", description: "Acao imediata obrigatoria" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Regras de Acao por Faixa",
      label: "O que fazer",
      bullets: [
        { label: "90-100 Saudavel", text: "Monitoramento normal. Report semanal padrao." },
        { label: "75-89 Atencao", text: "Gestor da obra informado. Plano de contencao em 48h." },
        { label: "60-74 Risco", text: "Escalonamento para coordenador. Reuniao de alinhamento em 24h." },
        { label: "<60 Critico", text: "War Room automatica. CEO informado. Plano de recuperacao em 4h." },
      ],
    },
  },

  // ═══════════════════════════════════════════
  // CAP 05 — SCORE DE CONFIABILIDADE
  // ═══════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 05",
      title: "Score de\nConfiabilidade",
      subtitle: "Nota A-D por departamento, baseada em 7 variaveis.",
    },
  },
  {
    type: "content",
    props: {
      title: "7 Variaveis do Score",
      label: "Composicao",
      subtitle: "Calculadas automaticamente a partir dos dados do Kanban e handoffs.",
      bullets: [
        { label: "Cumprimento de SLA", text: "% de entregas dentro do prazo" },
        { label: "Qualidade do handoff", text: "% de handoffs aceitos sem rejeicao" },
        { label: "Retrabalho gerado", text: "Horas/custo de refazer causados pela area" },
        { label: "Bloqueios causados", text: "Vezes que a area travou o fluxo de outra" },
        { label: "Pendencias vencidas", text: "Tarefas passadas do prazo sem resolucao" },
        { label: "Aderencia ao checklist", text: "% de checklists completados antes do handoff" },
        { label: "Qualidade de evidencia", text: "% de evidencias completas e validas" },
      ],
    },
  },
  {
    type: "metrics",
    props: {
      title: "Classificacao por Nota",
      label: "Faixas",
      subtitle: "Score consolidado em 4 notas",
      metrics: [
        { value: "A", label: "Excelente", description: "SLA >95%, zero bloqueios, handoffs impecaveis" },
        { value: "B", label: "Boa", description: "SLA >85%, desvios pontuais, tendencia estavel" },
        { value: "C", label: "Instavel", description: "SLA <85%, retrabalho frequente, handoffs rejeitados" },
        { value: "D", label: "Critica", description: "SLA <70%, gargalo cronico, War Room automatica" },
      ],
    },
  },

  // ═══════════════════════════════════════════
  // CAP 06 — WAR ROOM
  // ═══════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 06",
      title: "War Room\nAutomatica",
      subtitle: "Acionada pela IA quando a operacao atinge nivel critico.",
    },
  },
  {
    type: "split",
    props: {
      title: "Quando acionar",
      image: IMG_WAR,
      label: "Gatilhos",
      subtitle: "A War Room e acionada automaticamente quando:",
      items: [
        "Obra com score abaixo de 60",
        "Departamento com score D",
        "Atraso critico (>5 dias no gate)",
        "Margem negativa na obra",
        "Cliente escalado (reclamacao formal)",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "O que a War Room mostra",
      label: "Painel",
      subtitle: "Informacao estruturada para decisao rapida:",
      bullets: [
        { label: "Causa raiz", text: "O que causou a crise — identificado pela IA" },
        { label: "Dono", text: "Quem e o responsavel pela resolucao" },
        { label: "Plano de recuperacao", text: "Acoes concretas com prazo e responsavel" },
        { label: "Prazo", text: "Deadline para resolucao (horas, nao dias)" },
        { label: "Indicador de saida", text: "O que precisa acontecer para sair da War Room" },
      ],
    },
  },
  {
    type: "statement",
    props: {
      statement: "War Room nao e reuniao.\nE um protocolo de emergencia com prazo de resolucao.",
      attribution: "Command Center — Regra",
      label: "Principio",
    },
  },

  // ═══════════════════════════════════════════
  // CAP 07 — CONTROL TOWER IA
  // ═══════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 07",
      title: "Control Tower\nIA",
      subtitle: "O cerebro do Command Center. Consolida, alerta e sugere.",
    },
  },
  {
    type: "content",
    props: {
      title: "O que a IA consolida",
      label: "Funcoes",
      bullets: [
        { label: "Alertas do dia", text: "Tudo que precisa de atencao nas proximas 24h" },
        { label: "Handoffs sem aceite", text: "Passagens que o receptor nao confirmou" },
        { label: "Tarefas criticas vencidas", text: "Cards bloqueados ou com SLA estourado" },
        { label: "Obras que pioraram", text: "Score de risco que caiu vs. semana anterior" },
        { label: "Departamentos que pioraram", text: "Score de confiabilidade que caiu" },
        { label: "Sugestoes de acao", text: "A IA sugere: quem deve fazer o que, ate quando" },
        { label: "Prioridades executivas", text: "Top 10 decisoes da semana, rankeadas por impacto" },
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "IA: O que faz vs. Nao faz",
      label: "Limites",
      leftTitle: "A IA faz",
      leftItems: [
        "Consolida dados de todos os Kanbans",
        "Calcula scores automaticamente",
        "Envia alertas e notificacoes",
        "Sugere acoes baseadas em dados",
        "Gera relatorios semanais",
        "Aciona War Room quando necessario",
      ],
      rightTitle: "A IA nao faz",
      rightItems: [
        "Nao toma decisoes por humanos",
        "Nao muda status de cards",
        "Nao aprova handoffs",
        "Nao cancela obras",
        "Nao negocia com clientes",
        "Nao substitui gestores",
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 08 — EXECUTIVE ACTION ENGINE
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 08",
      title: "Executive\nAction Engine",
      subtitle: "A camada decisoria do Command Center. Transforma dashboards em direcao executiva acionavel.",
    },
  },
  {
    type: "split",
    props: {
      title: "O que e o Action Engine",
      image: IMG_CHESS,
      label: "Camada Decisoria",
      subtitle: "Sem ele, voce ve problema. Com ele, voce recebe direcao.",
      items: [
        "O que precisa ser decidido",
        "O que precisa ser escalado",
        "O que esta queimando margem",
        "Quem esta segurando fluxo",
        "Quais obras precisam de intervencao imediata",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "5 Perguntas Semanais",
      label: "Funcao Estrategica",
      subtitle: "O Executive Action Engine responde toda segunda-feira:",
      bullets: [
        { label: "Onde estamos perdendo dinheiro", text: "Top 5 perdas evitaveis com valor e causa raiz" },
        { label: "Onde vamos atrasar", text: "Top 5 obras para intervencao com plano de 3 acoes" },
        { label: "Qual departamento esta travando", text: "Top 5 gargalos com ocorrencias e impacto" },
        { label: "Qual obra precisa de war room", text: "Score <60, margem negativa ou cliente escalado" },
        { label: "O que precisa da decisao do fundador", text: "Top 5 decisoes com trade-off e recomendacao da IA" },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "5 Saidas Automaticas",
      label: "Outputs",
      steps: [
        { number: "S1", title: "Top 10 Prioridades da Semana", description: "Lista rankeada por impacto em margem, prazo, risco e dependencia entre areas" },
        { number: "S2", title: "Top 5 Obras para Intervencao", description: "Obras com score <60, piora de 2 semanas, NC alta, cliente escalado" },
        { number: "S3", title: "Top 5 Gargalos por Departamento", description: "Backlog vencido, handoffs nao aceitos, SLA estourado, cards bloqueados" },
        { number: "S4", title: "Top 5 Perdas Evitaveis", description: "Retrabalho, frete extra, urgencia, erro de compra, reentrega, garantia recorrente" },
        { number: "S5", title: "Top 5 Decisoes do Fundador", description: "Excecao financeira, cliente estrategico, repriorizar obras, contratacao critica" },
      ],
    },
  },

  // Bloco 1 — Top 10 Prioridades
  {
    type: "content",
    props: {
      title: "Bloco 1\nTop 10 Prioridades",
      label: "Logica de Calculo",
      subtitle: "Cada item recebe score baseado em 6 variaveis:",
      bullets: [
        { label: "Impacto em margem", text: "Quanto dinheiro esta em risco se nao resolver" },
        { label: "Impacto em prazo", text: "Quantos dias de atraso se nao agir" },
        { label: "Risco reputacional", text: "Cliente VIP, showroom, indicador, arquiteto" },
        { label: "Dependencia entre areas", text: "Quantas areas ficam travadas se nao resolver" },
        { label: "Proximidade do prazo", text: "Dias ate a deadline — quanto mais perto, mais urgente" },
        { label: "Criticidade da obra", text: "Score de risco atual da obra relacionada" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Formato de Saida",
      label: "Top 10 — Output",
      subtitle: "Cada prioridade sai com 7 campos:",
      bullets: [
        { label: "Titulo", text: "Nome claro do que precisa ser feito" },
        { label: "Obra/Departamento", text: "Onde esta o problema" },
        { label: "Motivo", text: "Por que isso e prioridade agora" },
        { label: "Impacto", text: "O que acontece se nao resolver" },
        { label: "Responsavel", text: "Quem vai resolver (nome, nao area)" },
        { label: "Prazo", text: "Ate quando — em horas, nao dias" },
        { label: "Acao sugerida", text: "O que a IA recomenda fazer" },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Exemplo: Prioridade 01",
      label: "Formato Real",
      cards: [
        { title: "Obra", description: "Casa Jardim Europa", icon: "OBR" },
        { title: "Tema", description: "Frente nao liberada e entrega critica em 4 dias", icon: "ALR" },
        { title: "Impacto", description: "Risco de atraso + frete extra + cliente sensivel", icon: "IMP" },
        { title: "Acao", description: "Validar base ate hoje 17h e confirmar logistica amanha 9h", icon: "ACT" },
      ],
    },
  },

  // Bloco 2 — Top 5 Obras
  {
    type: "content",
    props: {
      title: "Bloco 2\nTop 5 Obras para Intervencao",
      label: "Criterios de Entrada",
      subtitle: "Uma obra entra no Top 5 quando:",
      bullets: [
        { label: "Score <60", text: "Obra em faixa critica automaticamente" },
        { label: "Atraso em gate", text: "Passagem entre etapas com SLA vencido" },
        { label: "2 semanas piora", text: "Score caindo por 2 semanas consecutivas" },
        { label: "NC alta", text: "Nao-conformidades graves sem resolucao" },
        { label: "Cliente escalado", text: "Reclamacao formal registrada" },
        { label: "Margem em queda", text: "Margem projetada caindo vs. orcado" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Output por Obra",
      label: "Top 5 Obras — Formato",
      subtitle: "Cada obra do Top 5 apresenta:",
      bullets: [
        { label: "Score atual", text: "Numero 0-100 com tendencia (subindo/caindo)" },
        { label: "Principal causa de risco", text: "O que mais esta puxando o score para baixo" },
        { label: "Decisao pendente", text: "O que precisa ser decidido agora" },
        { label: "Proximo marco", text: "Proximo evento critico no cronograma" },
        { label: "Plano de recuperacao", text: "3 acoes concretas com dono e prazo" },
        { label: "Dono da recuperacao", text: "Quem responde pelo plano (nome)" },
      ],
    },
  },

  // Bloco 3 — Top 5 Gargalos
  {
    type: "content",
    props: {
      title: "Bloco 3\nTop 5 Gargalos por Departamento",
      label: "Criterios",
      subtitle: "Entram no Top 5 os gargalos com:",
      bullets: [
        { label: "Backlog vencido", text: "Tarefas paradas alem do prazo na area" },
        { label: "Handoffs nao aceitos", text: "Passagens que o receptor nao confirmou" },
        { label: "SLA estourado", text: "% de entregas fora do prazo acima de 15%" },
        { label: "Retrabalho gerado", text: "Area gerando refazer para outras areas" },
        { label: "Cards bloqueados", text: "Acumulo acima da media historica" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Output por Gargalo",
      label: "Top 5 Gargalos — Formato",
      subtitle: "Cada gargalo apresenta:",
      bullets: [
        { label: "Departamento", text: "Area onde o gargalo esta" },
        { label: "Gargalo", text: "Descricao do que esta travando" },
        { label: "Ocorrencias", text: "Numero de vezes no periodo" },
        { label: "Impacto", text: "Quais areas e obras sao afetadas" },
        { label: "Area afetada", text: "Quem esta sendo prejudicado" },
        { label: "Acao corretiva", text: "Sugestao da IA para destravar" },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Exemplo: Gargalo Compras",
      label: "Formato Real",
      cards: [
        { title: "Departamento", description: "Compras / Supply Chain", icon: "SUP" },
        { title: "Gargalo", description: "Requisicoes voltando por falta de especificacao", icon: "GAR" },
        { title: "Ocorrencias: 11", description: "Impacto: atraso de compras + urgencia logistica", icon: "IMP" },
        { title: "Acao", description: "Travar requisicao sem versao do projeto e campo de acabamento", icon: "ACT" },
      ],
    },
  },

  // Bloco 4 — Top 5 Perdas
  {
    type: "content",
    props: {
      title: "Bloco 4\nTop 5 Perdas Evitaveis",
      label: "Fontes de Perda",
      subtitle: "O sistema rastreia 7 categorias de perda:",
      bullets: [
        { label: "Retrabalho", text: "Refazer producao ou instalacao por erro" },
        { label: "Frete extra", text: "Entrega adicional por falha de planejamento" },
        { label: "Urgencia de compra", text: "Material comprado fora do fluxo normal" },
        { label: "Erro de compra", text: "Material errado, quantidade errada" },
        { label: "Improdutividade", text: "Horas paradas esperando material ou frente" },
        { label: "Reentrega", text: "Logistica fazendo 2a entrega por erro na 1a" },
        { label: "Garantia recorrente", text: "Mesma falha aparecendo em multiplas obras" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Output por Perda",
      label: "Top 5 Perdas — Formato",
      subtitle: "Cada perda sai com:",
      bullets: [
        { label: "Tipo", text: "Categoria da perda (retrabalho, frete, urgencia...)" },
        { label: "Obra/Departamento", text: "Onde aconteceu" },
        { label: "Valor estimado", text: "R$ da perda (real ou projetado)" },
        { label: "Causa raiz", text: "O que gerou a perda" },
        { label: "Contramedida", text: "Mudanca de processo para evitar recorrencia" },
        { label: "Dono", text: "Quem vai implementar a contramedida" },
      ],
    },
  },
  {
    type: "statement",
    props: {
      statement: "Toda perda recorrente vira:\nchecklist + regra de bloqueio +\natualizacao de template + treinamento.",
      attribution: "Action Engine — Regra de Ouro",
      label: "Principio",
    },
  },

  // Bloco 5 — Top 5 Decisões do Fundador
  {
    type: "content",
    props: {
      title: "Bloco 5\nTop 5 Decisoes do Fundador",
      label: "Criterios de Escalonamento",
      subtitle: "Uma decisao sobe para o fundador quando:",
      bullets: [
        { label: "Excecao financeira", text: "Desconto, aditivo, custo fora do orcamento" },
        { label: "Cliente estrategico", text: "Impacta relacionamento com indicador-chave" },
        { label: "Repriorizar obras", text: "Mudar fila de producao ou logistica" },
        { label: "Contratacao/demissao critica", text: "Lideranca ou posicao-chave" },
        { label: "Risco reputacional", text: "Situacao que pode afetar a marca" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Output por Decisao",
      label: "Top 5 Decisoes — Formato",
      subtitle: "Cada decisao sai com:",
      bullets: [
        { label: "Decisao", text: "O que precisa ser decidido" },
        { label: "Contexto", text: "Por que isso chegou ate o fundador" },
        { label: "Trade-off", text: "O que se ganha e o que se perde em cada opcao" },
        { label: "Recomendacao da IA", text: "Sugestao baseada em dados do sistema" },
        { label: "Impacto se decidir hoje", text: "Cenario otimista com acao rapida" },
        { label: "Impacto se adiar", text: "Cenario pessimista com inacao" },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Exemplo: Decisao 03",
      label: "Formato Real",
      cards: [
        { title: "Tema", description: "Antecipar producao do lote X para a obra Y", icon: "DEC" },
        { title: "Trade-off", description: "Atrasa 2 dias obra Z, mas preserva cliente mais estrategico", icon: "TRD" },
        { title: "Recomendacao IA", description: "Aprovar remanejamento e compensar obra Z com equipe extra", icon: "REC" },
        { title: "Se adiar", description: "Cliente Y escala, atraso de 5 dias, frete extra + risco reputacional", icon: "RSK" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 09 — 3 PAINEIS DE ACAO
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 09",
      title: "3 Paineis\nde Acao",
      subtitle: "Executive Action Board, Weekly Decision Deck e War Room Trigger Board.",
    },
  },
  // Executive Action Board
  {
    type: "split",
    props: {
      title: "Painel 1\nExecutive Action Board",
      image: IMG_CMD,
      label: "Painel Unico",
      subtitle: "Visual unico com as 5 saidas do Engine. Primeira tela que o CEO abre na segunda.",
      items: [
        "Top 10 prioridades da semana",
        "Top 5 obras para intervencao",
        "Top 5 gargalos por departamento",
        "Top 5 perdas evitaveis",
        "Top 5 decisoes do fundador",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Layout Visual",
      label: "Executive Action Board",
      subtitle: "3 linhas de informacao:",
      bullets: [
        { label: "Linha 1", text: "Prioridades da semana | Custo de perdas | Obras criticas | Decisoes do fundador" },
        { label: "Linha 2", text: "Gargalos por area | Score de confiabilidade | Handoffs quebrados | Clientes sensiveis" },
        { label: "Linha 3", text: "Plano de acao | Responsaveis | Prazos | Status de execucao" },
      ],
    },
  },
  // Weekly Decision Deck
  {
    type: "split",
    props: {
      title: "Painel 2\nWeekly Decision Deck",
      image: IMG_MEET,
      label: "Reuniao Semanal",
      subtitle: "Versao resumida do Action Board otimizada para a reuniao de diretoria.",
      items: [
        "5 slides auto-gerados pela IA toda segunda 7h",
        "Prioridades — o que atacar essa semana",
        "Obras — quem precisa de intervencao",
        "Perdas — onde parar de perder dinheiro",
        "Decisoes — o que so o fundador resolve",
      ],
    },
  },
  // War Room Trigger Board
  {
    type: "split",
    props: {
      title: "Painel 3\nWar Room Trigger Board",
      image: IMG_WAR,
      label: "Intervencao",
      subtitle: "Painel exclusivo de obras e areas em regime de emergencia.",
      items: [
        "Obras com score <60 (automatico)",
        "Departamentos com score D (automatico)",
        "Margem negativa confirmada",
        "Cliente escalado com reclamacao formal",
        "Gate critico vencido por >5 dias",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "War Room Trigger — Protocolo",
      label: "Formato de Cada Trigger",
      bullets: [
        { label: "Gatilho", text: "O que ativou a War Room (score, margem, cliente, gate)" },
        { label: "Causa raiz", text: "Identificada pela IA com base no historico do card" },
        { label: "Dono", text: "Quem lidera a recuperacao (nomeado, nao area)" },
        { label: "Plano de 3 acoes", text: "Acoes concretas, cada uma com prazo em horas" },
        { label: "Indicador de saida", text: "Metrica que precisa atingir para sair da War Room" },
        { label: "Status", text: "Em andamento / Resolvido / Escalado para CEO" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 10 — LOGICA OPERACIONAL SEMANAL
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 10",
      title: "Logica Operacional\nSemanal",
      subtitle: "O ritmo do Command Center: segunda a sexta.",
    },
  },
  {
    type: "process",
    props: {
      title: "Cadencia Semanal",
      label: "Ritmo",
      steps: [
        { number: "SEG\n7h", title: "Sistema Roda", description: "Relatorio consolidado, scores de obras, scores de departamentos, prioridades, decisoes criticas" },
        { number: "SEG\n8h", title: "Control Tower Envia", description: "Resumo executivo por email/slack, link dos paineis, lista de responsaveis cobrados" },
        { number: "SEG\n9h", title: "Reuniao de Diretoria", description: "Weekly Decision Deck: prioridades, obras criticas, perdas, gargalos, decisoes do fundador" },
        { number: "QUA\n9h", title: "Follow-up 15min", description: "War Rooms resolveram? Donos cumpriram? Score melhorou?" },
        { number: "SEX\n17h", title: "Sistema Compara", description: "O que foi priorizado vs. executado vs. ficou aberto. Quem respondeu. Qual impacto gerou." },
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Segunda vs. Sexta",
      label: "Ciclo PDCA",
      leftTitle: "Segunda — Planejar",
      leftItems: [
        "Top 10 prioridades definidas",
        "Top 5 obras com plano de 3 acoes",
        "Donos nomeados para cada gargalo",
        "Perdas com contramedida aprovada",
        "Decisoes do fundador tomadas",
      ],
      rightTitle: "Sexta — Verificar",
      rightItems: [
        "Quantas prioridades foram executadas?",
        "Scores das obras melhoraram ou pioraram?",
        "Gargalos desbloquearam?",
        "Contramedidas foram implementadas?",
        "Decisoes geraram resultado?",
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 11 — SISTEMA DE ALERTAS
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 11",
      title: "Sistema de\nAlertas",
      subtitle: "3 niveis: Vermelho (imediato), Amarelo (diario), Azul (insight).",
    },
  },
  {
    type: "content",
    props: {
      title: "Alertas Vermelhos",
      label: "Disparo Imediato",
      highlight: "Disparam instantaneamente. Notificacao para CEO + gestor da area.",
      bullets: [
        { label: "Obra <60", text: "Score de risco caiu para faixa critica" },
        { label: "Margem negativa", text: "Margem projetada ficou abaixo de zero" },
        { label: "Cliente escalado", text: "Reclamacao formal registrada" },
        { label: "Gate critico vencido", text: "Passagem entre etapas com SLA estourado" },
        { label: "Handoff critico sem aceite", text: "Receptor nao confirmou handoff critico" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Alertas Amarelos",
      label: "Resumo Diario",
      highlight: "Disparam no resumo diario. Notificacao para gestor da area.",
      bullets: [
        { label: "Backlog crescente", text: "Area acumulando cards acima da media" },
        { label: "SLA perto do vencimento", text: "Prazo vence nas proximas 24h" },
        { label: "Produtividade baixa", text: "Equipe abaixo da meta semanal" },
        { label: "Frete extra anormal", text: "Custo de frete acima do padrao" },
        { label: "NC subindo", text: "Nao-conformidades crescendo vs. semana anterior" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Alertas Azuis",
      label: "Insights & Melhoria",
      highlight: "Disparam no report semanal. Insights para melhoria continua.",
      bullets: [
        { label: "Padrao recorrente", text: "IA detectou problema que se repete em multiplas obras" },
        { label: "Oportunidade de automacao", text: "Tarefa manual que pode ser automatizada" },
        { label: "Equipe destaque", text: "Equipe com performance acima da media — candidata a bonus" },
        { label: "Fornecedor melhora/piora", text: "OTIF do fornecedor mudou significativamente" },
      ],
    },
  },
  {
    type: "metrics",
    props: {
      title: "Canais de Alerta",
      label: "Distribuicao",
      subtitle: "Cada nivel usa canais diferentes",
      metrics: [
        { value: "🔴", label: "Vermelho", description: "Push + Slack #war-room + Email CEO" },
        { value: "🟡", label: "Amarelo", description: "Slack #alertas + Email gestor" },
        { value: "🔵", label: "Azul", description: "Report semanal + Slack #insights" },
        { value: "📊", label: "Todos", description: "Consolidados no Control Tower IA" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 12 — INTEGRACAO WORKSPACE
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 12",
      title: "Integracao\nWorkspace Central",
      subtitle: "Cada indicador abre o contexto completo.",
    },
  },
  {
    type: "content",
    props: {
      title: "Drill-down em tudo",
      label: "Navegacao",
      subtitle: "Todo indicador no Command Center abre o contexto original no Workspace Central:",
      bullets: [
        { label: "Obra", text: "Abre a timeline completa da obra com todos os eventos" },
        { label: "Documento", text: "Abre o contrato, projeto, NF ou ficha tecnica relacionada" },
        { label: "Decisao", text: "Abre o registro da decisao com quem, quando e por que" },
        { label: "Handoff", text: "Abre o handoff com checklist, evidencia e confirmacao" },
        { label: "Evidencia", text: "Abre fotos, documentos ou aprovacoes anexadas" },
        { label: "Responsavel", text: "Abre perfil do responsavel com historico e metricas" },
      ],
    },
  },
  {
    type: "statement",
    props: {
      statement: "O Command Center e a lente.\nO Workspace Central e a memoria.\nO Action Engine e o cerebro.\nJuntos, sao o sistema nervoso da empresa.",
      attribution: "Parket Enterprise OS",
      label: "Integracao",
    },
  },

  // ═══════════════════════════════════════════════════
  // CAP 13 — GUIA REUNIAO SEMANAL
  // ═══════════════════════════════════════════════════
  {
    type: "section",
    props: {
      block: "Capitulo 13",
      title: "Guia: Reuniao\nSemanal",
      subtitle: "Como usar o Command Center + Action Engine na reuniao de diretoria.",
    },
  },
  {
    type: "split",
    props: {
      title: "Roteiro da Reuniao",
      image: IMG_MEET,
      label: "60 minutos",
      subtitle: "Toda segunda-feira as 9h. Duracao: 1 hora. Sem slides — so Command Center.",
      items: [
        "Painel Executivo (5 min)",
        "Top 10 Prioridades da Semana (10 min)",
        "Top 5 Obras para Intervencao (10 min)",
        "Top 5 Gargalos por Departamento (10 min)",
        "Top 5 Perdas Evitaveis (10 min)",
        "Top 5 Decisoes do Fundador (10 min)",
        "War Rooms + Follow-up de Sexta (5 min)",
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Passo a Passo",
      label: "Roteiro Detalhado",
      steps: [
        { number: "01", title: "Abrir Action Board", description: "CEO olha as 5 saidas do Engine. Pergunta: 'O que mudou vs. semana passada?'" },
        { number: "02", title: "Top 10 Prioridades", description: "Ler cada prioridade. Confirmar donos e prazos. IA anota decisoes." },
        { number: "03", title: "Top 5 Obras", description: "Drill-down nas obras criticas. Coord. de Obras apresenta plano de 3 acoes por obra." },
        { number: "04", title: "Top 5 Gargalos", description: "Gestor da area com gargalo explica e propoe solucao. IA registra prazo." },
        { number: "05", title: "Top 5 Perdas", description: "Dir. Financeiro apresenta custo total. Contramedidas aprovadas na hora." },
        { number: "06", title: "Top 5 Decisoes", description: "CEO decide ou delega. IA registra decisao, dono e prazo." },
        { number: "07", title: "War Rooms + Sexta", description: "Status das War Rooms. Resultado do follow-up de sexta. Fechar acoes." },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Regras da Reuniao",
      label: "Disciplina",
      bullets: [
        { label: "Sem slides", text: "So o Command Center na tela. Dados ao vivo." },
        { label: "Sem desculpas", text: "Se o dado esta no sistema, nao precisa explicar. So resolver." },
        { label: "Decisao na hora", text: "Nao sair da reuniao sem dono e prazo para cada problema." },
        { label: "Ata automatica", text: "A IA registra decisoes, donos e prazos automaticamente." },
        { label: "Follow-up na quarta", text: "Check rapido de 15min: War Rooms resolveram? Donos cumpriram?" },
        { label: "Fechamento na sexta", text: "Sistema compara priorizado vs. executado. Gera score de execucao." },
      ],
    },
  },

  // ══════════════════════════════��════════════════════
  // ENCERRAMENTO
  // ═══════════════════════════════════════════════════
  {
    type: "metrics",
    props: {
      title: "Resumo do Command Center v2",
      label: "Numeros",
      metrics: [
        { value: "5", label: "Camadas", description: "Executiva, Obra, Dept, Produtividade, IA" },
        { value: "10", label: "Dashboards", description: "Cada um para um problema" },
        { value: "5", label: "Saidas do Engine", description: "Prioridades, Obras, Gargalos, Perdas, Decisoes" },
        { value: "3", label: "Paineis de Acao", description: "Action Board, Decision Deck, War Room Trigger" },
      ],
    },
  },
  {
    type: "metrics",
    props: {
      title: "Resumo do Command Center v2 (cont.)",
      label: "Numeros",
      metrics: [
        { value: "60+", label: "Indicadores", description: "10 categorias (A-J)" },
        { value: "3", label: "Niveis de Alerta", description: "Vermelho, Amarelo, Azul" },
        { value: "2", label: "Scores Auto.", description: "Risco por obra + Confiabilidade" },
        { value: "5/7", label: "Ritmo Semanal", description: "Seg gera, Qua verifica, Sex fecha" },
      ],
    },
  },
  {
    type: "statement",
    props: {
      statement: "Um Command Center sem Action Engine e um painel bonito.\nCom Action Engine, e o lugar onde decisoes acontecem.",
      attribution: "Parket Command Center v2",
      label: "Principio Final",
    },
  },
  {
    type: "closing",
    props: {
      title: "Command\nCenter",
      subtitle: "Parket — Centro de Comando Executivo\nv2.0 com Executive Action Engine — Marco 2026",
      image: IMG_CMD,
    },
  },
];
