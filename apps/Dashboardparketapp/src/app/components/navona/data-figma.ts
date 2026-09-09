export type DepartmentId =
  | "comercial"
  | "funil-entrada"
  | "projetos"
  | "compras"
  | "compras-taiara"
  | "compras-marco"
  | "producao"
  | "logistica"
  | "operacional"
  | "financeiro"
  | "marketing"
  | "rh"
  | "orcamento"
  | "ia";

export type ViewMode = "dashboard" | DepartmentId;

export interface KanbanCard {
  id: string;
  title: string;
  subtitle?: string;
  tags: string[];
  assignees: { name: string }[];
  status?: "no-prazo" | "atencao" | "atrasado";
  hasAbrir?: boolean;
  badge?: number;
  value?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface SidebarSection {
  title: string;
  items: { label: string }[];
  note?: string;
}

export interface QuickAction {
  label: string;
  badge?: number;
}

export interface Department {
  id: DepartmentId;
  name: string;
  fullName: string;
  teamDesc: string;
  avatarInitials: string;
  userRole: string;
  breadcrumb: string;
  columns: KanbanColumn[];
  sidebarSections: SidebarSection[];
  quickActions: QuickAction[];
  memberCount: number;
  handoffsCount: number;
  alertsCount: number;
  kanbanCount: number;
  vencidosCount: number;
  alertBanner?: string;
  suggestion?: string;
  subDeptIds?: DepartmentId[];
  hidden?: boolean;
}

export const DEPARTMENTS: Department[] = [
  // ─── COMERCIAL ────────────────────────────────────────────────────────────
  {
    id: "comercial",
    name: "Comercial",
    fullName: "Departamento Comercial",
    teamDesc: "Equipe SP · Vendedores / B2B / SDR",
    avatarInitials: "CO",
    userRole: "Equipe SP",
    breadcrumb: "Vendedores / B2B / SDR",
    memberCount: 4,
    handoffsCount: 2,
    alertsCount: 1,
    kanbanCount: 47,
    vencidosCount: 0,
    subDeptIds: ["funil-entrada", "orcamento"],
    quickActions: [
      { label: "Novo Lead" },
      { label: "Nova Proposta" },
      { label: "Showroom" },
      { label: "Follow-up" },
    ],
    suggestion: "Segmente os leads por tipo de aplicação: piso residencial, piso comercial, revestimento de parede ou escada. Priorize clientes com área acima de 80m² pois o ticket médio justifica visita técnica.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Fund & Pipeline" },
          { label: "Ranking & Closers" },
          { label: "Agenda Showroom" },
          { label: "Relatório Semanal" },
          { label: "Scripts de Abordagem" },
        ],
      },
    ],
    columns: [
      {
        id: "novas",
        title: "Novas Oportunidades",
        cards: [
          { id: "c1", title: "Felipe Santos · Piso 120m²", tags: ["Lead Quente"], assignees: [{ name: "FS" }], status: "atencao", hasAbrir: true },
          { id: "c2", title: "Patrícia Lima · Escritório 85m²", tags: ["Lead Quente"], assignees: [{ name: "PL" }], status: "atencao", hasAbrir: true },
          { id: "c3", title: "Ricardo Oliveira · Sobrado 200m²", tags: ["Lead Novo"], assignees: [{ name: "RO" }], hasAbrir: true },
        ],
      },
      { id: "contato", title: "Contato Inicial", cards: [
        { id: "c4", title: "Construtora Viva · 3 Aptos Itaim", tags: ["B2B"], assignees: [{ name: "CV" }], status: "no-prazo", hasAbrir: true },
      ]},
      { id: "briefing", title: "Em Briefing", cards: [] },
      { id: "proposta", title: "Proposta Enviada", cards: [] },
      { id: "aprovacao", title: "Aprovação", cards: [] },
      { id: "pos-venda", title: "Pós-Venda", cards: [] },
    ],
  },

  // ─── FUNIL DE ENTRADA ────────────────────────────────────────────────────
  {
    id: "funil-entrada",
    hidden: true,
    name: "Funil de Entrada",
    fullName: "Funil de Entrada",
    teamDesc: "Equipe Comercial · SDR / B2B / SDR",
    avatarInitials: "FE",
    userRole: "SDR Team",
    breadcrumb: "Qualificação de Leads · Handoff Comercial",
    memberCount: 4,
    handoffsCount: 5,
    alertsCount: 0,
    kanbanCount: 83,
    vencidosCount: 0,
    quickActions: [
      { label: "Novo Lead" },
      { label: "Qualificar" },
      { label: "Agendar" },
      { label: "Descartar" },
    ],
    suggestion: "O tempo de resposta ao lead é crítico — leads respondidos em menos de 5 minutos convertem 9x mais. Qualifique por BANT antes do handoff para o comercial.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Dashboard SDR" },
          { label: "Qualificação BANT" },
          { label: "Scripts de Abordagem" },
          { label: "Métricas de Conversão" },
          { label: "Fontes de Lead" },
        ],
      },
    ],
    columns: [
      {
        id: "lead-recebido",
        title: "Lead Recebido",
        cards: [
          { id: "fe1", title: "Mariana Costa · Instagram", tags: ["Orgânico"], assignees: [{ name: "MC" }], status: "no-prazo", hasAbrir: true },
          { id: "fe2", title: "João Pereira · Site Parket", tags: ["Orgânico"], assignees: [{ name: "JP" }], status: "no-prazo", hasAbrir: true },
          { id: "fe3", title: "Luciana Freitas · Google Ads", tags: ["Pago"], assignees: [{ name: "LF" }], status: "no-prazo", hasAbrir: true },
        ],
      },
      { id: "qualificacao", title: "Qualificação", cards: [
        { id: "fe4", title: "André Mendes · WhatsApp", tags: ["Indicação"], assignees: [{ name: "AM" }], status: "no-prazo", hasAbrir: true },
      ]},
      { id: "em-contato", title: "Em Contato", cards: [] },
      { id: "briefing-marcado", title: "Briefing Marcado", cards: [] },
      { id: "handoff-comercial", title: "Handoff Comercial", cards: [] },
      { id: "descartado", title: "Descartado", cards: [] },
    ],
  },

  // ─── PROJETOS ─────────────────────────────────────────────────────────────
  {
    id: "projetos",
    name: "Projetos",
    fullName: "Coordenacao de Projetos",
    teamDesc: "Thainara · Coordenadora de Projetos",
    avatarInitials: "TH",
    userRole: "Coordenadora de Projetos",
    breadcrumb: "Boa tarde, Thainara",
    memberCount: 4,
    handoffsCount: 0,
    alertsCount: 0,
    kanbanCount: 347,
    vencidosCount: 70,
    quickActions: [
      { label: "Novo Verso" },
      { label: "Aprovações", badge: 8 },
      { label: "Equipe" },
      { label: "SLA" },
      { label: "Calendário" },
      { label: "Solicitar Compras" },
    ],
    suggestion: "Com 41 obras simultâneas, o risco de atraso em cadeia é alto. Implante um semáforo de obras: verde (no prazo), amarelo (risco), vermelho (atrasada), visível para toda a gestão.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Dashboard" },
          { label: "Versoes & BOM" },
          { label: "File Aprovacoes" },
          { label: "Equipe & Demandas" },
          { label: "& Rotinas" },
        ],
      },
    ],
    columns: [
      {
        id: "contratos-novos",
        title: "Contratos Novos",
        cards: [
          { id: "pr1", title: "LUIS CARLOS MARTINEZ GARCIA", subtitle: "Thainara · Coordenadora de Projetos", tags: ["Parq/Forn"], assignees: [{ name: "TH" }], status: "no-prazo", hasAbrir: true },
          { id: "pr2", title: "JOSIMARA RIBEIRO DE MENDONCA", subtitle: "Thainara · Coordenadora de Projetos", tags: ["Sem projeto atq"], assignees: [{ name: "TH" }], status: "atencao", hasAbrir: true },
        ],
      },
      {
        id: "pendencia-arquivos",
        title: "Pendência de Arquivos",
        cards: [
          { id: "pr3", title: "PAULA MORAIS BOURDON", tags: ["Parq/Forn"], assignees: [{ name: "TH" }], status: "no-prazo", hasAbrir: true },
          { id: "pr4", title: "NH3 ADMINISTRACAO DE...", tags: ["Parq/Forn"], assignees: [{ name: "TH" }], hasAbrir: true },
        ],
      },
      {
        id: "obras-hold",
        title: "Obras em Hold",
        cards: [
          { id: "pr5", title: "ROBERTO SAMPAIO FERREIRA", subtitle: "Thainara · Coordenadora de Projetos", tags: ["Parq/Forn"], assignees: [{ name: "TH" }], status: "no-prazo", hasAbrir: true },
          { id: "pr6", title: "DIOGO RAPHAEL DA SILVA...", tags: ["Parq/Forn"], assignees: [{ name: "TH" }], hasAbrir: true },
        ],
      },
      { id: "compat-proj", title: "Compatibilidade Projeto x Orçamento", cards: [] },
      { id: "estudos", title: "Estudos & Pesquisa", cards: [] },
      { id: "concluido", title: "Concluído", cards: [] },
    ],
  },

  // ─── COMPRAS ──────────────────────────────────────────────────────────────
  {
    id: "compras",
    name: "Compras",
    fullName: "Compras & Supply Chain",
    teamDesc: "Romualdo · Gestor de Compras",
    avatarInitials: "RO",
    userRole: "Gestor de Compras",
    breadcrumb: "Romualdo · Marcenaria e Lamarca",
    memberCount: 4,
    handoffsCount: 0,
    alertsCount: 0,
    kanbanCount: 239,
    vencidosCount: 0,
    subDeptIds: ["compras-taiara", "compras-marco"],
    quickActions: [
      { label: "Nova PO" },
      { label: "Cotações" },
      { label: "Estoque" },
      { label: "Prazo" },
    ],
    suggestion: "Negocie lotes maiores com fornecedores homologados. Cotação mínima de 3 fornecedores para pedidos acima de R$ 5.000. Estabeleça lead time padrão por tipo de material.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Fornecedores" },
          { label: "Estoque & POs" },
        ],
      },
      {
        title: "FERRAMENTAS",
        items: [
          { label: "Bloco de Notas" },
          { label: "Timer de Tarefas" },
        ],
      },
    ],
    columns: [
      {
        id: "solicitacoes",
        title: "SOLICITAÇÕES",
        cards: [
          { id: "cp1", title: "PK03 → Arvo Marcenaria - Fábrica Curitiba", subtitle: "Solicitante — DYONE SOUZA SALOMÃO — 09/05/2026", tags: ["Obra"], assignees: [{ name: "R" }], status: "no-prazo", hasAbrir: true },
          { id: "cp2", title: "PK03 → Arvo Marcenaria - Fábrica Curitiba", subtitle: "2 UND — MASSA PARA PEQUENOS REPAROS", tags: ["Insumo"], assignees: [{ name: "R" }], status: "no-prazo", hasAbrir: true },
        ],
      },
      {
        id: "em-cotacao",
        title: "EM COTAÇÃO",
        cards: [
          { id: "cp3", title: "PK03 → Arvo Marcenaria - Fábrica Curitiba", subtitle: "Solicitante — CLEIDERSON / NATALIA", tags: ["Obra"], assignees: [{ name: "R" }], status: "no-prazo", hasAbrir: true },
        ],
      },
      {
        id: "aguardando-lib",
        title: "AGUARDANDO LIBERAÇÃO DE PAGTO OU FATURAMENTO",
        cards: [
          { id: "cp4", title: "PK03 → Arvo Marcenaria - Fábrica Curitiba", subtitle: "Solicitante — NATALIA (MARCENARIA) — 11/06/2026", tags: ["Urgente"], assignees: [{ name: "R" }], status: "atencao", hasAbrir: true },
        ],
      },
      { id: "liberacao-forn", title: "LIBERAÇÃO AO FORNECEDOR", cards: [] },
      { id: "pedido-emitido", title: "PEDIDO EMITIDO", cards: [] },
      { id: "recebido", title: "RECEBIDO · CONFERIDO", cards: [] },
    ],
  },

  // ─── COMPRAS TAIARA ───────────────────────────────────────────────────────
  {
    id: "compras-taiara",
    hidden: true,
    name: "Compras Taiara",
    fullName: "Compras — Taiara",
    teamDesc: "Taiara · Gestora de Compras",
    avatarInitials: "TA",
    userRole: "Gestora de Compras",
    breadcrumb: "Taiara · Insumos e Materiais",
    memberCount: 4,
    handoffsCount: 1,
    alertsCount: 0,
    kanbanCount: 58,
    vencidosCount: 0,
    quickActions: [
      { label: "Nova PO" },
      { label: "Cotações" },
      { label: "Estoque" },
      { label: "Prazo" },
    ],
    suggestion: "Insumos de acabamento têm validade. Controle o estoque por lote e data. Mantenha estoque mínimo de 30% acima do consumo médio mensal.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Vernizes & Acabamentos" },
          { label: "Colas & Adesivos" },
          { label: "Rodapés & Perfis" },
          { label: "EPI & Segurança" },
        ],
      },
      {
        title: "FERRAMENTAS",
        items: [
          { label: "Bloco de Notas" },
          { label: "Timer de Tarefas" },
        ],
      },
    ],
    columns: [
      {
        id: "sol-taiara",
        title: "SOLICITAÇÕES",
        cards: [
          { id: "ct1", title: "Verniz Osmocolor · 20L · Stock", tags: ["Reposição"], assignees: [{ name: "T" }], status: "no-prazo", hasAbrir: true },
          { id: "ct2", title: "Cola PVA Premium · 50kg · Obras Q3", tags: ["Normal"], assignees: [{ name: "T" }], status: "no-prazo", hasAbrir: true },
        ],
      },
      { id: "cot-taiara", title: "EM COTAÇÃO", cards: [] },
      { id: "lib-taiara", title: "AGUARDANDO LIBERAÇÃO", cards: [] },
      { id: "forn-taiara", title: "LIBERAÇÃO AO FORNECEDOR", cards: [] },
      { id: "ped-taiara", title: "PEDIDO EMITIDO", cards: [] },
      { id: "rec-taiara", title: "RECEBIDO · CONFERIDO", cards: [] },
    ],
  },

  // ─── COMPRAS MARCO ANTÔNIO ────────────────────────────────────────────────
  {
    id: "compras-marco",
    hidden: true,
    name: "Compras Marco Antônio",
    fullName: "Compras — Marco Antônio",
    teamDesc: "Marco Antônio · Compras Avulsas",
    avatarInitials: "MA",
    userRole: "Compras Avulsas",
    breadcrumb: "Marco Antônio · Compras Especiais",
    memberCount: 4,
    handoffsCount: 1,
    alertsCount: 1,
    kanbanCount: 34,
    vencidosCount: 0,
    quickActions: [
      { label: "Nova PO" },
      { label: "Cotações" },
      { label: "Urgente" },
      { label: "Aprovação" },
    ],
    suggestion: "Compras avulsas têm risco de duplicidade. Verifique sempre o histórico antes de abrir nova solicitação. Compras até R$2.000 aprovadas pelo gestor; acima disso, aprovação do Douglas.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Peças Especiais" },
          { label: "Ferramentas & Equipamentos" },
          { label: "Serviços Terceirizados" },
          { label: "Compras Urgentes" },
        ],
      },
      {
        title: "FERRAMENTAS",
        items: [
          { label: "Bloco de Notas" },
          { label: "Histórico de Avulsas" },
        ],
      },
    ],
    columns: [
      {
        id: "sol-marco",
        title: "SOLICITAÇÕES",
        cards: [
          { id: "cm1", title: "Serra Circular Nova · Reposição Urgente", tags: ["Urgente"], assignees: [{ name: "M" }], status: "atencao", hasAbrir: true },
        ],
      },
      { id: "cot-marco", title: "EM COTAÇÃO", cards: [] },
      { id: "aprov-marco", title: "APROVAÇÃO DOUGLAS", cards: [] },
      { id: "lib-marco", title: "LIBERAÇÃO AO FORNECEDOR", cards: [] },
      { id: "ped-marco", title: "PEDIDO EMITIDO", cards: [] },
      { id: "rec-marco", title: "RECEBIDO · CONFERIDO", cards: [] },
    ],
  },

  // ─── PRODUÇÃO ─────────────────────────────────────────────────────────────
  {
    id: "producao",
    name: "Producao",
    fullName: "Producao Industrial / Marcenaria",
    teamDesc: "Germano · Gestor de Producao",
    avatarInitials: "GE",
    userRole: "Gestor de Producao",
    breadcrumb: "Boa tarde, Germano",
    memberCount: 4,
    handoffsCount: 0,
    alertsCount: 0,
    kanbanCount: 6,
    vencidosCount: 0,
    quickActions: [
      { label: "Novo OP" },
      { label: "QC Check" },
      { label: "Alerta NC" },
      { label: "Capacidade" },
    ],
    suggestion: "Controle a umidade das peças antes de enviar para obra: madeira acima de 12% vai trabalhar após instalação e causar empenamento. Registre a leitura em cada ordem de serviço.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Capacidade" },
          { label: "Ordens & QC" },
        ],
      },
      {
        title: "EQUIPE & ATIVIDADE",
        items: [
          { label: "Feed de Atividade" },
        ],
      },
      {
        title: "FERRAMENTAS",
        items: [
          { label: "Bloco de Notas" },
        ],
      },
    ],
    columns: [
      {
        id: "entrada-proj",
        title: "Entrada de Projeto",
        cards: [
          { id: "pd1", title: "GUSTAVO LOPES", subtitle: "Handoff de Projetos → A iniciar", tags: ["Handoff"], assignees: [{ name: "G" }], status: "no-prazo", hasAbrir: true },
          { id: "pd2", title: "LOURENCO URBANO GIMENES", subtitle: "Handoff de Projetos → A iniciar", tags: ["Handoff"], assignees: [{ name: "V" }], status: "atencao", hasAbrir: true, badge: 1 },
        ],
      },
      { id: "analisando", title: "Analisando", cards: [] },
      { id: "desenvolvendo", title: "Desenvolvendo", cards: [] },
      { id: "verif-interna", title: "Verificação Interna", cards: [] },
      { id: "liberacao", title: "Liberação", cards: [] },
      { id: "entregue-prod", title: "Entregue", cards: [] },
    ],
  },

  // ─── LOGÍSTICA ────────────────────────────────────────────────────────────
  {
    id: "logistica",
    name: "Logistica",
    fullName: "Logística & Expedicao",
    teamDesc: "Aiton · Responsável de Expedições",
    avatarInitials: "AI",
    userRole: "Responsável de Expedição",
    breadcrumb: "Boa tarde, Aiton",
    memberCount: 2,
    handoffsCount: 0,
    alertsCount: 0,
    kanbanCount: 130,
    vencidosCount: 0,
    quickActions: [
      { label: "Nova Entrega" },
      { label: "Foto Carga" },
      { label: "Rastrear" },
      { label: "Funil" },
    ],
    suggestion: "Confirme sempre o acesso da obra antes de agendar: rua estreita, sem rampa ou andar alto sem elevador muda o tempo de descarga. Foto obrigatória na chegada e na descarga.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Entregas Hoje" },
          { label: "Frota" },
          { label: "Funil" },
        ],
      },
      {
        title: "EQUIPE & ATIVIDADE",
        items: [
          { label: "Feed de Atividade" },
        ],
      },
    ],
    columns: [
      {
        id: "sol-frete",
        title: "SOLICITAÇÃO DE FRETE",
        cards: [
          { id: "l1", title: "Solicita— Atendimento Parket (OBRAS) — 08/05/2026", subtitle: "Solicitante: Atendimento Parket [OBRAS]", tags: ["No prazo"], assignees: [{ name: "A" }], status: "no-prazo", hasAbrir: true },
          { id: "l2", title: "Solicita— Atendimento Parket (OBRAS) — 26/05/2026", subtitle: "Solicitante: Atendimento Parket [OBRAS]", tags: ["No prazo"], assignees: [{ name: "A" }], status: "no-prazo", hasAbrir: true },
        ],
      },
      { id: "ret-material", title: "RETIRADA DE MATERIAL E INSUMOS", cards: [] },
      { id: "sol-fiscal", title: "SOLICITAÇÕES DO RELATÓRIO FISCAL", cards: [] },
      { id: "preparando", title: "PREPARANDO", cards: [] },
      { id: "em-rota", title: "EM ROTA", cards: [] },
      { id: "entregue-log", title: "ENTREGUE · FOTO CONFIRMADA", cards: [] },
    ],
  },

  // ─── OPERACIONAL ──────────────────────────────────────────────────────────
  {
    id: "operacional",
    name: "Operacional",
    fullName: "Obras, Fiscal, PMO e Atendimento unificados",
    teamDesc: "Equipe Operacional · Davy / Felipe / Vinicius / Natalia / Thainare",
    avatarInitials: "OP",
    userRole: "Equipe em Campo",
    breadcrumb: "Boa tarde, Equipe Operacional",
    memberCount: 5,
    handoffsCount: 0,
    alertsCount: 0,
    kanbanCount: 518,
    vencidosCount: 1,
    quickActions: [
      { label: "Nova Visita" },
      { label: "Diário Obra" },
      { label: "Foto Obra" },
      { label: "Checklist" },
      { label: "Medição" },
      { label: "Solicitar Compras" },
    ],
    suggestion: "Com múltiplas obras simultâneas, o risco de misturar lotes é alto. Cada obra deve ter sua caixa de material identificada. Foto do piso antes e após instalar é protocolo mínimo de proteção jurídica.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Relatórios" },
          { label: "Fiscal" },
          { label: "Produtividade" },
          { label: "Obras" },
          { label: "Atendimento" },
        ],
      },
    ],
    columns: [
      {
        id: "obras-entrada",
        title: "Obras Novas / Entrada",
        cards: [
          { id: "op1", title: "CINTIA BATISTA", subtitle: "2257 · DF · 157M² DE ASSOALHO", tags: ["DF"], assignees: [{ name: "D" }], status: "no-prazo", hasAbrir: true },
        ],
      },
      {
        id: "projeto-op",
        title: "Projeto",
        cards: [
          { id: "op2", title: "EUGÊNIO COSTA RODRIGUES", subtitle: "1740 · SP · 89M² PARQUET", tags: ["SP"], assignees: [{ name: "F" }], status: "no-prazo", hasAbrir: true },
        ],
      },
      { id: "proj-finalizado", title: "Projeto Finalizado", cards: [] },
      {
        id: "pendente",
        title: "Pendente",
        cards: [
          { id: "op3", title: "ANA CAROLINA EMERENCIANO GUIMARAES", subtitle: "R: PR · 177M² ASSOALHO", tags: ["PR"], assignees: [{ name: "V" }], status: "atencao", hasAbrir: true },
        ],
      },
      { id: "pre-inst", title: "Pré-Instalação", cards: [] },
      { id: "instalando", title: "Em Instalação", cards: [] },
    ],
  },

  // ─── FINANCEIRO ───────────────────────────────────────────────────────────
  {
    id: "financeiro",
    name: "Financeiro",
    fullName: "Departamento Financeiro",
    teamDesc: "Karla · Gestora Financeira",
    avatarInitials: "KA",
    userRole: "Gestora Financeira",
    breadcrumb: "Karla · Gestão Financeira",
    memberCount: 3,
    handoffsCount: 0,
    alertsCount: 3,
    kanbanCount: 94,
    vencidosCount: 0,
    quickActions: [
      { label: "Nova NF" },
      { label: "Contas a Pagar" },
      { label: "Fluxo de Caixa" },
      { label: "Relatório" },
    ],
    suggestion: "Parquet tem custo variável por lote. Registre o custo do lote e trave a margem por SKU desde o orçamento. Se o custo subir entre a proposta e a instalação, a margem some.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Pedidos a Faturar" },
          { label: "NFs Emitidas" },
          { label: "Contas a Receber" },
          { label: "Contas a Pagar" },
          { label: "Inadimplência" },
        ],
      },
      {
        title: "GESTÃO",
        items: [
          { label: "Fluxo de Caixa" },
          { label: "Margens por Obra" },
          { label: "Relatório Mensal" },
          { label: "Plano de Contas" },
        ],
      },
    ],
    columns: [
      {
        id: "pedido-conf",
        title: "Pedido Confirmado",
        cards: [
          { id: "fn1", title: "PKT-041 · Apê Pinheiros · 140m²", subtitle: "Parquet Carvalho · Instalação incluída", tags: ["No prazo"], assignees: [{ name: "K" }], status: "no-prazo", hasAbrir: true, value: "R$ 42.000" },
          { id: "fn2", title: "PKT-042 · Escritório FL · 300m²", subtitle: "Vinílico LVT · Fornecimento", tags: ["No prazo"], assignees: [{ name: "K" }], status: "no-prazo", hasAbrir: true, value: "R$ 78.000" },
        ],
      },
      { id: "nf-emitida", title: "NF Emitida", cards: [] },
      { id: "ag-pagamento", title: "Aguardando Pagamento", cards: [] },
      { id: "parc-pago", title: "Parcialmente Pago", cards: [] },
      { id: "liquidado", title: "Liquidado", cards: [] },
      { id: "inadimplencia", title: "Inadimplência", cards: [] },
    ],
  },

  // ─── MARKETING ────────────────────────────────────────────────────────────
  {
    id: "marketing",
    name: "Marketing",
    fullName: "Marketing & Comunicacao",
    teamDesc: "Raphael · Gestor de Marketing",
    avatarInitials: "MK",
    userRole: "Gestor de Marketing",
    breadcrumb: "Boa tarde, Raphael",
    memberCount: 3,
    handoffsCount: 1,
    alertsCount: 0,
    kanbanCount: 68,
    vencidosCount: 0,
    subDeptIds: ["ia"],
    quickActions: [
      { label: "Novo Post" },
      { label: "Analytics" },
      { label: "Campanha" },
      { label: "Cases" },
    ],
    suggestion: "Parquet é visual — o cliente decide com os olhos antes de ver o preço. Mostre obras concluídas com luz natural e antes/depois: é o conteúdo de maior conversão.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Analytics" },
          { label: "Calendário Conteúdo" },
        ],
      },
      {
        title: "EQUIPE & ATIVIDADE",
        items: [
          { label: "Feed de Atividade" },
        ],
      },
      {
        title: "FERRAMENTAS",
        items: [
          { label: "Bloco de Notas" },
        ],
      },
    ],
    columns: [
      {
        id: "backlog-mk",
        title: "BACKLOG",
        cards: [
          { id: "mk1", title: "[VIDEO] Institucional Parket Descritivo", subtitle: "Produção de vídeo", tags: ["Raphael"], assignees: [{ name: "R" }], status: "no-prazo", hasAbrir: true },
          { id: "mk2", title: "[VIDEO] [Luxo Silencioso] - IA", subtitle: "Produção de vídeo", tags: ["Davi"], assignees: [{ name: "D" }], hasAbrir: true },
        ],
      },
      {
        id: "planejamento-mk",
        title: "PLANEJAMENTO",
        cards: [
          { id: "mk3", title: "[VIDEO] [OBRA] [FELIPE] - Casa Higienópolis", subtitle: "Produção de vídeo", tags: ["Davi"], assignees: [{ name: "D" }], status: "no-prazo", hasAbrir: true },
          { id: "mk4", title: "[Copy] Matérias Parket", subtitle: "Criação de conteúdo", tags: ["Raphael"], assignees: [{ name: "R" }], hasAbrir: true },
          { id: "mk5", title: "[DESIGN] Site - Navona", subtitle: "Criação de conteúdo", tags: ["WM"], assignees: [{ name: "W" }], hasAbrir: true },
        ],
      },
      {
        id: "em-and-mk",
        title: "EM ANDAMENTO",
        cards: [
          { id: "mk6", title: "[VIDEO] Obra em adamento - Novo Rumo", subtitle: "Criação de vídeo", tags: ["Davi"], assignees: [{ name: "D" }], status: "no-prazo", hasAbrir: true },
          { id: "mk7", title: "[VIDEO] [OBRA] [FELIPE] - Casa Higienópolis", subtitle: "Produção de vídeo", tags: ["Davi"], assignees: [{ name: "D" }], hasAbrir: true },
        ],
      },
      {
        id: "ajuste-mk",
        title: "AJUSTE",
        cards: [
          { id: "mk8", title: "[VIDEO] - Casa Milan", subtitle: "Produção de vídeo", tags: ["Davi"], assignees: [{ name: "D" }], status: "no-prazo", hasAbrir: true },
          { id: "mk9", title: "[VIDEO] - PizzaAndWine", subtitle: "Produção de vídeo", tags: ["Davi"], assignees: [{ name: "D" }], hasAbrir: true },
          { id: "mk10", title: "[VIDEO] [Cases] - Grandes Obras", subtitle: "Produção de vídeo", tags: ["Davi"], assignees: [{ name: "D" }], hasAbrir: true },
          { id: "mk11", title: "[DESIGN] Catálogo Principal Parket", subtitle: "Criação de conteúdo", tags: ["WM"], assignees: [{ name: "W" }], hasAbrir: true },
          { id: "mk12", title: "[VIDEO] Institucional Parket", subtitle: "Produção de vídeo · Feed", tags: ["Raphael"], assignees: [{ name: "R" }], hasAbrir: true },
        ],
      },
      { id: "revisao-mk", title: "REVISÃO", cards: [] },
      { id: "publicado-mk", title: "PUBLICADO", cards: [] },
    ],
  },

  // ─── RH ───────────────────────────────────────────────────────────────────
  {
    id: "rh",
    name: "RH",
    fullName: "Recursos Humanos",
    teamDesc: "Talicia · Gestora de RH",
    avatarInitials: "TC",
    userRole: "Gestora de RH",
    breadcrumb: "Boa tarde, Talicia",
    memberCount: 2,
    handoffsCount: 0,
    alertsCount: 0,
    kanbanCount: 0,
    vencidosCount: 0,
    quickActions: [
      { label: "Novo Vaga" },
      { label: "Contratos", badge: 2 },
      { label: "Treinamento" },
      { label: "Folha" },
    ],
    suggestion: "A equipe de instalação é o produto da Parket. Crie uma trilha de onboarding para novos instaladores com acompanhamento nas primeiras 3 obras antes de trabalhar sozinho.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Headcount & Vagas" },
          { label: "Treinamentos" },
          { label: "Equipes" },
          { label: "Controle de EPIs" },
        ],
      },
      {
        title: "EQUIPE & ATIVIDADE",
        items: [
          { label: "Feed de Atividade" },
        ],
      },
    ],
    columns: [
      { id: "vaga-aberta", title: "Vaga Aberta", cards: [
        { id: "rh1", title: "Instalador de Piso · Sênior", tags: ["Urgente"], assignees: [{ name: "T" }], status: "atencao", hasAbrir: true },
      ]},
      { id: "aloc-equipes", title: "Alocações de Equipes", cards: [] },
      { id: "eq-marcenaria", title: "Equipes Marcenaria (Fábrica)", cards: [] },
      { id: "eq-internac", title: "Equipes Internacionais/Viagem", cards: [] },
      { id: "treinamentos", title: "Treinamentos", cards: [] },
      { id: "ativo-rh", title: "Ativo · Em Campo", cards: [] },
    ],
  },

  // ─── ORÇAMENTO ────────────────────────────────────────────────────────────
  {
    id: "orcamento",
    hidden: true,
    name: "Orcamento",
    fullName: "Orçamento & Propostas",
    teamDesc: "Ranieri · Responsável de Orçamentos",
    avatarInitials: "RA",
    userRole: "Responsável de Orçamentos",
    breadcrumb: "Boa tarde, Ranieri",
    memberCount: 2,
    handoffsCount: 0,
    alertsCount: 0,
    kanbanCount: 282,
    vencidosCount: 0,
    alertBanner: "55 projetos aguardando validação de recebimento — Revisar se as informações recebidas estão adequadas e aceitar ou devolver ao setor anterior.",
    quickActions: [
      { label: "Simulação" },
      { label: "Tabela" },
      { label: "Propostas" },
      { label: "Templates" },
    ],
    suggestion: "Todo orçamento precisa de prazo de validade visível — custo de madeira e mão de obra mudam. Vincule o orçamento ao lote específico em estoque assim que aprovado.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Dashboard" },
          { label: "Simulação" },
          { label: "Tabela de Preços" },
          { label: "Propostas & Precisão" },
          { label: "Templates" },
        ],
      },
    ],
    columns: [
      {
        id: "sol-recebida",
        title: "Solicitação Recebida",
        cards: [
          { id: "or1", title: "Christiano Villela", subtitle: "Trajeto Criativo", tags: ["No prazo"], assignees: [{ name: "R" }], status: "no-prazo", hasAbrir: true },
          { id: "or2", title: "Luiza Lima", tags: ["No prazo"], assignees: [{ name: "R" }], status: "no-prazo", hasAbrir: true },
          { id: "or3", title: "Dario", tags: ["No prazo"], assignees: [{ name: "R" }], hasAbrir: true },
        ],
      },
      {
        id: "em-progresso",
        title: "Em Progresso",
        cards: [
          { id: "or4", title: "Felipe S. Fridman", subtitle: "Handoff de Comercial → Solicitação", tags: ["Handoff"], assignees: [{ name: "R" }], status: "no-prazo", hasAbrir: true },
        ],
      },
      {
        id: "em-analise",
        title: "Em Análise",
        cards: [
          { id: "or5", title: "NARA TELLES", subtitle: "Handoff de Comercial → Solicitação", tags: ["Handoff"], assignees: [{ name: "R" }], status: "no-prazo", hasAbrir: true, badge: 10 },
          { id: "or6", title: "Clínica Marco Rios", tags: ["No prazo"], assignees: [{ name: "R" }], hasAbrir: true },
          { id: "or7", title: "Willians Soares", tags: ["No prazo"], assignees: [{ name: "R" }], hasAbrir: true, badge: 3 },
        ],
      },
      {
        id: "analise-douglas",
        title: "Análise Douglas",
        cards: [
          { id: "or8", title: "Engenheiro Kléderson", subtitle: "Handoff de Comercial → Solicitação", tags: ["Handoff"], assignees: [{ name: "R" }], status: "no-prazo", hasAbrir: true, value: "R$ 632.121,84" },
        ],
      },
      { id: "enviado-cl", title: "Refinamento", cards: [] },
      { id: "aprovado-orc", title: "Aprovado · Lote Vinculado", cards: [] },
    ],
  },

  // ─── IA ───────────────────────────────────────────────────────────────────
  {
    id: "ia",
    hidden: true,
    name: "IA",
    fullName: "Inteligência Artificial & Automação",
    teamDesc: "Douglas · Gestor de IA",
    avatarInitials: "IA",
    userRole: "Gestor de IA",
    breadcrumb: "Douglas · Automações · Insights",
    memberCount: 2,
    handoffsCount: 0,
    alertsCount: 0,
    kanbanCount: 14,
    vencidosCount: 0,
    quickActions: [
      { label: "Nova Automação" },
      { label: "Backlog IA" },
      { label: "Insights" },
      { label: "Relatório" },
    ],
    suggestion: "Automatize primeiro o que mais consome tempo manual: geração de proposta, follow-up de lead e alerta de obra atrasada. Com 41 obras ativas, a IA pode monitorar prazos e gerar alertas antes do problema virar crise.",
    sidebarSections: [
      {
        title: "ESPECIFICO",
        items: [
          { label: "Automações Ativas" },
          { label: "Em Desenvolvimento" },
          { label: "Backlog de IA" },
          { label: "Integrações" },
        ],
      },
      {
        title: "INSIGHTS",
        items: [
          { label: "Dashboard IA · CEO" },
          { label: "Alertas Preditivos" },
          { label: "Análise de Pipeline" },
          { label: "Relatório de Performance" },
        ],
      },
    ],
    columns: [
      {
        id: "backlog-ia",
        title: "Backlog",
        cards: [
          { id: "ia1", title: "Auto Follow-up · Lead sem resposta 24h", tags: ["Comercial"], assignees: [{ name: "D" }], status: "no-prazo", hasAbrir: true },
          { id: "ia2", title: "Alerta · Obra próxima do prazo", tags: ["Projetos"], assignees: [{ name: "D" }], status: "no-prazo", hasAbrir: true },
          { id: "ia3", title: "Geração automática de proposta PDF", tags: ["Orçamento"], assignees: [{ name: "D" }], hasAbrir: true },
        ],
      },
      { id: "dev-ia", title: "Em Desenvolvimento", cards: [] },
      { id: "testes-ia", title: "Testes", cards: [] },
      { id: "revisao-ia", title: "Revisão Final", cards: [] },
      { id: "prod-ia", title: "Em Produção · Ativo", cards: [] },
      { id: "arq-ia", title: "Arquivado", cards: [] },
    ],
  },
];

export const DEPT_MAP = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d])) as Record<DepartmentId, Department>;
