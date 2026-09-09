/**
 * Dados de cada setor pro DeptSidebar — espelha o `Department` do
 * Sistema Operacional Parket (data.ts).
 * Por enquanto valores hardcoded; depois plugar contagens/links reais.
 */
export type SidebarSection = {
  title: string;
  items: { label: string; to?: string; badge?: number; viewKey?: string }[];
};

export type QuickAction = { label: string; badge?: number; to?: string };

export type DeptData = {
  id: string;
  name: string;                  // "Comercial"
  fullName: string;              // "Departamento Comercial"
  breadcrumb: string;            // "Vendedores / B2B / SDR"
  avatarInitials: string;        // "CO"
  userRole: string;              // "Equipe SP"
  memberCount: number;
  kanbanCount: number;           // Meu Kanban badge
  alertsCount: number;
  handoffsCount: number;
  vencidosCount: number;
  quickActions: QuickAction[];
  sidebarSections: SidebarSection[];
  suggestion?: string;
};

export const DEPT_DATA: Record<string, DeptData> = {
  comercial: {
    id: "comercial",
    name: "Comercial",
    fullName: "Departamento Comercial",
    breadcrumb: "Vendedores / B2B / SDR",
    avatarInitials: "CO",
    userRole: "Equipe SP",
    memberCount: 4,
    kanbanCount: 47,
    alertsCount: 1,
    handoffsCount: 2,
    vencidosCount: 0,
    quickActions: [
      { label: "Novo Lead" },
      { label: "Nova Proposta" },
      { label: "Showroom" },
      { label: "Follow-up" },
    ],
    suggestion: "Segmente os leads por tipo de aplicação: piso residencial, comercial, revestimento de parede ou escada. Priorize clientes com área acima de 80m².",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Funil & Pipeline",     viewKey: "funil" },
          { label: "Ranking & Closers",    viewKey: "ranking" },
          { label: "Agenda Showroom",      viewKey: "agenda" },
          { label: "Relatório Semanal",    viewKey: "relatorio" },
        ],
      },
      {
        title: "RECURSOS",
        items: [
          { label: "Tabela de Preços",     viewKey: "precos" },
          { label: "Catálogo de Produtos", viewKey: "catalogo" },
          { label: "Argumentário",         viewKey: "argumentario" },
          { label: "Scripts WhatsApp",     viewKey: "scripts" },
        ],
      },
      {
        title: "EQUIPE",
        items: [
          { label: "Performance Individual", viewKey: "performance" },
          { label: "Metas do Mês",           viewKey: "metas" },
          { label: "Treinamentos",           viewKey: "treinamentos" },
        ],
      },
    ],
  },

  projetos: {
    id: "projetos",
    name: "Projetos",
    fullName: "Projetos Técnicos",
    breadcrumb: "Medição / Projeto / Especificação",
    avatarInitials: "PJ",
    userRole: "Equipe Técnica",
    memberCount: 3,
    kanbanCount: 0,
    alertsCount: 0,
    handoffsCount: 0,
    vencidosCount: 0,
    quickActions: [
      { label: "Nova Medição" },
      { label: "Novo Projeto" },
      { label: "Catálogo" },
      { label: "DWG / DXF" },
    ],
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Medições Pendentes" },
          { label: "Projetos em Andamento" },
          { label: "Especificações" },
        ],
      },
    ],
  },

  orcamento: {
    id: "orcamento",
    name: "Orçamento",
    fullName: "Orçamento e Propostas",
    breadcrumb: "Simulador / Aprovação Douglas",
    avatarInitials: "OR",
    userRole: "Orçamentistas",
    memberCount: 6,
    kanbanCount: 0,
    alertsCount: 0,
    handoffsCount: 0,
    vencidosCount: 0,
    quickActions: [
      { label: "Novo Orçamento" },
      { label: "Simulador" },
      { label: "Aprovação" },
      { label: "Catálogo" },
    ],
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Fila de Análise" },
          { label: "Aprovados Hoje" },
          { label: "Pendente Douglas" },
        ],
      },
    ],
  },

  producao: {
    id: "producao",
    name: "Produção",
    fullName: "Beneficiamento e PCP",
    breadcrumb: "Linhas / Cortes / Acabamento",
    avatarInitials: "PR",
    userRole: "Fábrica",
    memberCount: 12,
    kanbanCount: 0,
    alertsCount: 0,
    handoffsCount: 0,
    vencidosCount: 0,
    quickActions: [
      { label: "Nova OP" },
      { label: "Linhas" },
      { label: "Estoque" },
      { label: "Carga" },
    ],
    sidebarSections: [
      { title: "ESPECIFICO", items: [{ label: "OPs em Curso" }, { label: "Produtividade" }] },
    ],
  },

  operacional: {
    id: "operacional",
    name: "Operacional",
    fullName: "Obras + Fiscal + PMO",
    breadcrumb: "Obras / Fiscal / PMO",
    avatarInitials: "OP",
    userRole: "Campo",
    memberCount: 15,
    kanbanCount: 0,
    alertsCount: 0,
    handoffsCount: 0,
    vencidosCount: 0,
    quickActions: [
      { label: "Nova Obra" },
      { label: "Vistoria" },
      { label: "Handoff" },
      { label: "Relatório" },
    ],
    sidebarSections: [
      { title: "ESPECIFICO", items: [{ label: "Obras Ativas" }, { label: "Cronograma" }, { label: "Equipes em Campo" }] },
    ],
  },

  marketing: {
    id: "marketing", name: "Marketing", fullName: "Performance e Conteúdo",
    breadcrumb: "Campanhas / Mídia / Conteúdo", avatarInitials: "MK", userRole: "Marketing",
    memberCount: 3, kanbanCount: 0, alertsCount: 0, handoffsCount: 0, vencidosCount: 0,
    quickActions: [{ label: "Nova Campanha" }, { label: "Conteúdo" }, { label: "Mídia" }, { label: "Relatório" }],
    sidebarSections: [{ title: "ESPECIFICO", items: [{ label: "Campanhas Ativas" }, { label: "Leads do Mês" }] }],
  },

  rh: {
    id: "rh", name: "RH", fullName: "Pessoas",
    breadcrumb: "Recrutamento / Folha / DP", avatarInitials: "RH", userRole: "RH",
    memberCount: 2, kanbanCount: 0, alertsCount: 0, handoffsCount: 0, vencidosCount: 0,
    quickActions: [{ label: "Nova Vaga" }, { label: "Folha" }, { label: "Treinamento" }, { label: "Aniversários" }],
    sidebarSections: [{ title: "ESPECIFICO", items: [{ label: "Vagas Abertas" }, { label: "Colaboradores" }, { label: "Calendário" }] }],
  },

  financeiro: {
    id: "financeiro", name: "Financeiro", fullName: "Caixa e Contratos",
    breadcrumb: "Caixa / Contratos / DocuSign", avatarInitials: "FI", userRole: "Financeiro",
    memberCount: 3, kanbanCount: 0, alertsCount: 0, handoffsCount: 0, vencidosCount: 0,
    quickActions: [{ label: "Novo Contrato" }, { label: "Boleto" }, { label: "Conciliar" }, { label: "Relatório" }],
    sidebarSections: [{ title: "ESPECIFICO", items: [{ label: "Contratos Ativos" }, { label: "Recebimentos" }, { label: "Pagamentos" }] }],
  },

  atendimento: {
    id: "atendimento", name: "Atendimento", fullName: "Sala ao Vivo",
    breadcrumb: "WhatsApp / TEKA IA", avatarInitials: "AT", userRole: "Atendimento",
    memberCount: 4, kanbanCount: 0, alertsCount: 0, handoffsCount: 0, vencidosCount: 0,
    quickActions: [{ label: "Sala Ao Vivo" }, { label: "TEKA Monitor" }, { label: "Scripts" }, { label: "Filas" }],
    sidebarSections: [{ title: "ESPECIFICO", items: [{ label: "Conversas Abertas" }, { label: "Agendamentos" }] }],
  },

  analise: {
    id: "analise", name: "Análise", fullName: "KPIs e Funil",
    breadcrumb: "BI / Conversão / SLA", avatarInitials: "AN", userRole: "Analytics",
    memberCount: 1, kanbanCount: 0, alertsCount: 0, handoffsCount: 0, vencidosCount: 0,
    quickActions: [{ label: "Funil" }, { label: "Lead Time" }, { label: "Heatmap" }, { label: "Ranking" }],
    sidebarSections: [{ title: "ESPECIFICO", items: [{ label: "KPIs do Mês" }, { label: "Conversão" }, { label: "Cohort" }] }],
  },

  arquivos: {
    id: "arquivos", name: "Arquivos", fullName: "Drive e Documentos",
    breadcrumb: "Drive Parket / Backup", avatarInitials: "AR", userRole: "—",
    memberCount: 0, kanbanCount: 0, alertsCount: 0, handoffsCount: 0, vencidosCount: 0,
    quickActions: [{ label: "Drive" }, { label: "Buscar" }, { label: "Recentes" }, { label: "Compartilhados" }],
    sidebarSections: [],
  },

  manutencao: {
    id: "manutencao", name: "Manutenção", fullName: "Pós-venda",
    breadcrumb: "Garantia / Assistência", avatarInitials: "MA", userRole: "Assistência",
    memberCount: 2, kanbanCount: 0, alertsCount: 0, handoffsCount: 0, vencidosCount: 0,
    quickActions: [{ label: "Novo Chamado" }, { label: "Em Curso" }, { label: "Concluídos" }],
    sidebarSections: [{ title: "ESPECIFICO", items: [{ label: "Chamados Abertos" }, { label: "SLA" }] }],
  },
};
