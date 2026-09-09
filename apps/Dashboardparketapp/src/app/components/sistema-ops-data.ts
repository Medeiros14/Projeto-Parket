/* ═══════════════════════════════════════════════════════════════
   SISTEMA OPERACIONAL PARKET — Dados Reais por Departamento
   60+ obras reais · Equipes reais · Fiscais reais · Status real
   Fonte: cronograma marcenaria + instalação + relatório de status
   ═══════════════════════════════════════════════════════════════ */

export const GOLD = "#D4A853";
export const BG = "#0A0A0A";
export const CARD_BG = "#111111";
export const CARD_HOVER = "#161616";
export const BORDER = "rgba(255,255,255,0.06)";
export const GREEN = "#10B981";
export const RED = "#EF4444";
export const YELLOW = "#F59E0B";
export const BLUE = "#3B82F6";
export const PURPLE = "#8B5CF6";
export const ORANGE = "#F97316";
export const PINK = "#EC4899";
export const TEAL = "#14B8A6";
export const ACCENT = "#B8AA9A";

export interface KanbanCard {
  id: string;
  title: string;
  subtitle?: string;
  obra?: string;
  responsavel: string;
  sla: string;
  slaStatus: "ok" | "warning" | "expired";
  tags?: string[];
  progress?: number;
  value?: string;
  checklist?: { done: number; total: number };
  gate?: number;
  priority?: "alta" | "media" | "baixa";
  evidencia?: boolean;
  // Seções ricas do modal 360° (preenchidas quando card vem do banco)
  gates_data?: Array<{ gate: number; label: string; status: string; date?: string; responsible?: string }>;
  checklist_items?: Array<{ item: string; done: boolean }>;
  handoffs_data?: Array<{ from: string; to: string; item: string; status: string; date: string }>;
  financeiro_data?: {
    valorContrato?: string;
    orcado?: string;
    realizado?: string;
    margemOrc?: string;
    margemReal?: string;
    parcelas?: Array<{ num: number; valor: string; status: string; venc: string }>;
    custos?: Array<{ cat: string; valor: string; perc: number }>;
  };
  raci_data?: Array<{ atividade: string; r: string; a: string; c: string; i: string }>;
  chat_messages?: Array<{ id?: number; user: string; msg: string; time: string; avatar: string }>;
  // Handoff acceptance
  handoff_pending?: boolean;
  handoff_from_dept?: string;
  // Tipo de projeto (regra de cores - Projetos/Thainara)
  tipo_projeto?: "marcenaria" | "marcenaria_instalacao" | "instalacao" | "piso_forro" | "deck" | "escada" | "fornecimento" | "guarnicoes" | "amostra";
  // Prazo em dias úteis (Produtividade / Obras)
  previsao_inicio?: string;   // "YYYY-MM-DD"
  prazo_dias_uteis?: number;  // qtd de dias úteis a partir do início
  // Raw details JSONB — usado por módulos com UI customizada (ex: Compras)
  details?: Record<string, unknown>;
  // Vínculo com projeto pai (compras → obra)
  parent_card_id?: string;
}

/** Mapeamento tipo_projeto → cor do card (Projetos) */
export const TIPO_PROJETO_COLORS: Record<string, { color: string; label: string; desc: string }> = {
  marcenaria:             { color: "#10B981", label: "Marcenaria",           desc: "Só Marcenaria" },
  marcenaria_instalacao:  { color: "#3B82F6", label: "Marc. + Inst.",        desc: "Marcenaria + Instalação" },
  instalacao:             { color: "#EC4899", label: "Instalação",           desc: "Só Instalação" },
  piso_forro:             { color: "#F97316", label: "Piso / Forro",         desc: "Só Piso ou Forro" },
  deck:                   { color: "#94A3B8", label: "Deck",                 desc: "Projeto com Deck" },
  escada:                 { color: "#FB923C", label: "Escada",               desc: "Projeto com Escada" },
  fornecimento:           { color: "#F59E0B", label: "Fornecimento",         desc: "Fornecimento de Material" },
  guarnicoes:             { color: "#15803D", label: "Guarnições",           desc: "Guarnições / Acabamentos" },
  amostra:                { color: "#F9A8D4", label: "Amostra",              desc: "Solicitação de Amostra" },
};

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  cards: KanbanCard[];
  slaHours?: number;
  slaLabel?: string;
  priority?: string;
  value?: string;
}

export interface KPI {
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  color: string;
}

export interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  message: string;
  obra?: string;
  time: string;
  action?: string;
}

export interface Handoff {
  id: string;
  from: string;
  to: string;
  obra: string;
  status: "pendente" | "aceito" | "vencido";
  slaHours: number;
  item: string;
}

export interface DeptProfile {
  id: string;
  nome: string;
  nomeCompleto: string;
  lider: string;
  cargo: string;
  icon: string;
  color: string;
  colorDim: string;
  initials: string;
  columns: KanbanColumn[];
  kpis: KPI[];
  alerts: Alert[];
  handoffs: Handoff[];
  menuItems: string[];
}

/* ═══════════════════════════════════════════════════════════════
   1. COMERCIAL
   ═══════════════════════════════════════════════════════════════ */
const comercial: DeptProfile = {
  id: "comercial",
  nome: "Comercial",
  nomeCompleto: "Departamento Comercial",
  lider: "Equipe SP + CWB",
  cargo: "Vendedores / BDR / SDR",
  icon: "💼",
  color: BLUE,
  colorDim: "rgba(59,130,246,0.15)",
  initials: "CO",
  menuItems: ["Meu Kanban", "Funil", "Leads", "Propostas", "Metas", "Showroom"],
  kpis: [
    { label: "Leads Ativos", value: 52, sub: "+8 esta semana", trend: "up", trendValue: "+20%", color: BLUE },
    { label: "Propostas Enviadas", value: 14, sub: "R$ 3.2M no pipe", trend: "up", trendValue: "+3", color: GREEN },
    { label: "Taxa Fechamento", value: "34%", sub: "meta: 30%", trend: "up", trendValue: "+4pp", color: GREEN },
    { label: "Ticket Medio", value: "R$ 198k", sub: "ultimos 30d", trend: "flat", color: ACCENT },
    { label: "SLA Primeiro Contato", value: "2.1h", sub: "meta: <4h", trend: "down", trendValue: "-0.5h", color: GREEN },
    { label: "Showroom/Semana", value: 6, sub: "meta: 8", trend: "down", trendValue: "-2", color: YELLOW },
  ],
  alerts: [],
  handoffs: [
    { id: "h1", from: "Comercial", to: "Projetos (Thainara)", obra: "Claudio Mohn Franca", status: "pendente", slaHours: 24, item: "Contrato + briefing + projeto arq. — 48.6m2 + 46 portas" },
    { id: "h2", from: "Comercial", to: "Orcamento (Ranieri)", obra: "Silvia Alarico Neves", status: "pendente", slaHours: 12, item: "Briefing 3 portas pivotantes — definir madeira" },
    { id: "h3", from: "Comercial", to: "Atendimento (Talita)", obra: "Trocha Family", status: "aceito", slaHours: 4, item: "Dados cliente + stakeholders — projeto internacional" },
  ],
  columns: [
    { id: "prospeccao", title: "Prospeccao", color: "#6B7280", cards: [], value: "R$ 85k" },
    { id: "qualificacao", title: "Qualificacao", color: BLUE, cards: [], value: "R$ 180k", gate: 0 },
    { id: "proposta", title: "Proposta", color: PURPLE, cards: []},
    { id: "negociacao", title: "Negociacao", color: ORANGE, cards: [], priority: "alta" },
    { id: "fechamento", title: "Fechamento", color: GREEN, cards: [] },
    { id: "handoff", title: "Handoff → Projetos", color: TEAL, cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   2. PROJETOS
   ═══════════════════════════════════════════════════════════════ */
const projetos: DeptProfile = {
  id: "projetos",
  nome: "Projetos",
  nomeCompleto: "Coordenacao de Projetos",
  lider: "Thainara",
  cargo: "Coordenadora de Projetos",
  icon: "📐",
  color: "#60A5FA",
  colorDim: "rgba(96,165,250,0.15)",
  initials: "TH",
  menuItems: ["Meu Kanban", "Cronograma", "Versoes", "Aprovacoes", "Workspace"],
  kpis: [
    { label: "Projetos Ativos", value: 22, sub: "8 marc + 10 inst + 4 misto", color: BLUE },
    { label: "Aguardando Aprovacao", value: 5, sub: "3 > 5 dias", trend: "up", trendValue: "+2", color: YELLOW },
    { label: "Lead Time Medio", value: "8.5d", sub: "meta: <10d", trend: "down", trendValue: "-1.2d", color: GREEN },
    { label: "Revisoes/Projeto", value: "2.3", sub: "meta: <2", trend: "up", trendValue: "+0.4", color: ORANGE },
    { label: "Pre-Projetos Pendentes", value: 4, sub: "urgentes", color: RED },
    { label: "BOMs Gerados", value: 6, sub: "esta semana", color: GREEN },
  ],
  alerts: [],
  handoffs: [
    { id: "h1", from: "Projetos", to: "Producao (Germano)", obra: "Ana Cristina Garcia", status: "pendente", slaHours: 8, item: "Projeto + BOM 10 Portas Pivotantes Nogueira" },
    { id: "h2", from: "Projetos", to: "Compras (Ronaldo)", obra: "Luana Bastos", status: "pendente", slaHours: 24, item: "BOM 12 Portas + 23m3 Painel Tauari + Cortineiro" },
    { id: "h3", from: "Projetos", to: "Fiscal (Felipe)", obra: "Bernardo Coutinho", status: "aceito", slaHours: 8, item: "Pre-projeto forro RJ — checklist vistoria" },
  ],
  columns: [
    { id: "contratos-novos",   title: "Contratos Novos",                        color: "#6B7280", cards: [] },
    { id: "pendencia-arquivos",title: "Pendência de Arquivos",                  color: RED,       cards: [] },
    { id: "obras-hold",        title: "Obras em Hold",                          color: YELLOW,    cards: [] },
    { id: "compat-orcamento",  title: "Compatibilidade Projeto x Orçamento",    color: PURPLE,    cards: [] },
    { id: "estudo-projeto",    title: "Estudo de Projeto",                      color: BLUE,      cards: [] },
    { id: "aguarda-medicao",   title: "Aguarda Medição",                        color: ORANGE,    cards: [] },
    { id: "medicao-feita",     title: "Medição Feita",                          color: TEAL,      cards: [] },
    { id: "executivo-iniciar", title: "Executivo a Iniciar",                    color: "#60A5FA", cards: [] },
    { id: "projeto-executivo", title: "Projeto Executivo",                      color: BLUE,      cards: [] },
    { id: "aguarda-aprovacao", title: "Aguarda Aprovação",                      color: PURPLE,    cards: [] },
    { id: "aprovado",          title: "Aprovado",                               color: GREEN,     cards: [] },
    { id: "producao",          title: "Produção",                               color: YELLOW,    cards: [] },
    { id: "entrega",           title: "Entrega",                                color: "#D4A853", cards: [] },
    { id: "instalacao",        title: "Instalação",                             color: ORANGE,    cards: [] },
    { id: "finalizado",        title: "Finalizado",                             color: GREEN,     cards: [] },
    { id: "reparo",            title: "Reparo",                                 color: PINK,      cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   3. COMPRAS
   ═══════════════════════════════════════════════════════════════ */
const compras: DeptProfile = {
  id: "compras",
  nome: "Compras",
  nomeCompleto: "Compras & Supply Chain",
  lider: "Ronaldo",
  cargo: "Gestor de Compras",
  icon: "🛒",
  color: GREEN,
  colorDim: "rgba(16,185,129,0.15)",
  initials: "RO",
  menuItems: ["Meu Kanban", "Cotacoes", "Fornecedores", "Estoque", "Lead Times"],
  kpis: [
    { label: "Requisicoes Ativas", value: 24, sub: "8 urgentes", color: ORANGE },
    { label: "Economia vs Mercado", value: "28%", sub: "media 90d", trend: "up", trendValue: "+4pp", color: GREEN },
    { label: "POs Pendentes", value: 9, sub: "R$ 285k total", color: YELLOW },
    { label: "Lead Time Medio", value: "6.2d", sub: "meta: <7d", color: GREEN },
    { label: "Itens em Atraso", value: 4, sub: "3 criticos", trend: "up", trendValue: "+1", color: RED },
    { label: "Saving Acumulado", value: "R$ 112k", sub: "este trimestre", color: GREEN },
  ],
  alerts: [],
  handoffs: [
    { id: "h1", from: "Compras", to: "Producao (Germano)", obra: "Alexandre Assumpçao", status: "pendente", slaHours: 12, item: "Carvalho Europeu Natural + NF + especificacoes 4 portas" },
    { id: "h2", from: "Compras", to: "Producao (Germano)", obra: "Bernardo Coutinho", status: "pendente", slaHours: 24, item: "Carvalho Europeu + ferragens 10 portas pivotantes" },
    { id: "h3", from: "Compras", to: "Producao (Germano)", obra: "Luana Bastos", status: "pendente", slaHours: 24, item: "Tauari + acessorios 12 portas + 23m3 painel" },
  ],
  columns: [
    { id: "cotacao",              title: "Cotacao e Priorizacao",        color: BLUE,      cards: [], slaLabel: "Pesquisa de Mercado" },
    { id: "aguarda-aprovacao",    title: "Interface Financeira",         color: YELLOW,    cards: [], slaHours: 24, slaLabel: "Aguardando Liberacao" },
    { id: "emissao-pedido",       title: "Emissao do Pedido",            color: PURPLE,    cards: [], slaHours: 2,  slaLabel: "Brascomm / Lancamento" },
    { id: "em-transito",          title: "Logistica e Acompanhamento",   color: TEAL,      cards: [], slaHours: 24, slaLabel: "Em Rota de Entrega" },
    { id: "recebimento-auditoria",title: "Recebimento e Conferencia",    color: ORANGE,    cards: [], slaLabel: "Auditoria de Nota Fiscal" },
    { id: "concluido",            title: "Finalizado",                   color: GREEN,     cards: [], slaLabel: "Pedido Encerrado" },
    { id: "amostras",             title: "Amostras em Execucao",         color: PINK,      cards: [], slaLabel: "Amostra / Qualificacao" },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   4. PRODUCAO / MARCENARIA
   ═══════════════════════════════════════════════════════════════ */
const producao: DeptProfile = {
  id: "producao",
  nome: "Producao",
  nomeCompleto: "Producao Industrial / Marcenaria",
  lider: "Germano",
  cargo: "Gestor de Producao",
  icon: "🏭",
  color: ORANGE,
  colorDim: "rgba(249,115,22,0.15)",
  initials: "GE",
  menuItems: ["Meu Kanban", "Ordens", "QC", "Equipes", "Capacidade", "Estoque"],
  kpis: [
    { label: "Ordens Ativas", value: 14, sub: "78 pecas total", color: ORANGE },
    { label: "Produtividade", value: "82%", sub: "meta: 85%", trend: "up", trendValue: "+3pp", color: YELLOW },
    { label: "A Iniciar / Checklist", value: 13, sub: "aguardando fila/material", color: BLUE },
    { label: "Em Andamento", value: 7, sub: "producao ativa", color: GREEN },
    { label: "Capacidade Livre", value: "12%", sub: "proxima semana", color: YELLOW },
    { label: "OTIF Producao", value: "88%", sub: "meta: >95%", trend: "up", trendValue: "+5pp", color: YELLOW },
  ],
  alerts: [],
  handoffs: [
    { id: "h1", from: "Producao", to: "Logistica (Ailton)", obra: "Paulo Gontijo", status: "pendente", slaHours: 24, item: "Fechadura Rolete + Paineis Cozinha + Closet + Reguas — QC OK" },
    { id: "h2", from: "Producao", to: "Logistica (Ailton)", obra: "Inacio Passos", status: "pendente", slaHours: 24, item: "56m2 Forro/Painel Tauari + 1 Porta — embalado" },
    { id: "h3", from: "Compras", to: "Producao", obra: "Bernardo Coutinho", status: "aceito", slaHours: 4, item: "Carvalho Europeu + ferragens 10 portas" },
  ],
  columns: [
    { id: "a-iniciar", title: "A Iniciar", color: "#6B7280", cards: [] },
    { id: "checklist", title: "Checklist / Preparacao", color: BLUE, cards: [] },
    { id: "em-producao", title: "Em Producao", color: ORANGE, cards: [] },
    { id: "qc", title: "QC / Liberado", color: GREEN, cards: [] },
    { id: "handoff-log", title: "Handoff → Logistica", color: TEAL, cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   5. LOGISTICA / EXPEDICAO
   ═══════════════════════════════════════════════════════════════ */
const logistica: DeptProfile = {
  id: "logistica",
  nome: "Logistica",
  nomeCompleto: "Logistica & Expedicao",
  lider: "Ailton",
  cargo: "Responsavel de Expedicao",
  icon: "📦",
  color: TEAL,
  colorDim: "rgba(20,184,166,0.15)",
  initials: "AI",
  menuItems: ["Meu Kanban", "Entregas Hoje", "Frota", "Rastreio", "Conferencia"],
  kpis: [
    { label: "Entregas Semana", value: 8, sub: "4 SP + 2 BSB + 1 RJ + 1 MG", color: TEAL },
    { label: "OTIF", value: "91%", sub: "meta: >95%", trend: "up", trendValue: "+2pp", color: YELLOW },
    { label: "Divergencias", value: 2, sub: "itens faltantes", trend: "down", trendValue: "-1", color: YELLOW },
    { label: "Fretes Extras/Mes", value: 3, sub: "Riviera + Cuiaba + PY", color: ORANGE },
    { label: "Custo Frete/Obra", value: "R$ 3.8k", sub: "media (obras longe)", color: ACCENT },
    { label: "Conferencias OK", value: "94%", sub: "100% = meta", color: YELLOW },
  ],
  alerts: [],
  handoffs: [
    { id: "h1", from: "Logistica", to: "Obras (Dany)", obra: "Inacio", status: "pendente", slaHours: 4, item: "56m2 Tauari Forro/Painel + 1 Porta — entrega SP" },
    { id: "h2", from: "Producao", to: "Logistica", obra: "Paulo Gontijo", status: "pendente", slaHours: 24, item: "Fechadura + Paineis + Closet — QC pendente" },
    { id: "h3", from: "Logistica", to: "Obras (Reinaldo)", obra: "Casa Florais", status: "aceito", slaHours: 48, item: "Forro Lamina → Cuiaba + Piso → Brasilia" },
  ],
  columns: [
    { id: "backlog-entregas",      title: "Backlog de Entregas",       color: "#6B7280", cards: [], slaLabel: "Previsao da Semana" },
    { id: "aguarda-confirmacao",   title: "Aguardando Confirmacao",    color: BLUE,      cards: [], slaLabel: "Obras / Relacionamento" },
    { id: "separacao-kitagem",     title: "Separacao e Kitagem",       color: PURPLE,    cards: [], slaLabel: "Em Preparacao" },
    { id: "roteirizacao",          title: "Roteirizacao e Frete",      color: YELLOW,    cards: [], slaLabel: "Logistica & Aprovacao" },
    { id: "carregamento-expedicao",title: "Carregamento e Expedicao",  color: ORANGE,    cards: [], slaLabel: "Foto Obrigatoria" },
    { id: "em-transito",           title: "Em Transito",               color: TEAL,      cards: [], slaHours: 24, slaLabel: "Acompanhamento" },
    { id: "concluido-poe",         title: "Concluido / Prova de Entrega", color: GREEN,  cards: [], slaLabel: "Foto + Assinatura" },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   6. OBRAS / INSTALACAO
   ═══════════════════════════════════════════════════════════════ */
const obras: DeptProfile = {
  id: "obras",
  nome: "Obras",
  nomeCompleto: "Gestao de Equipes de Obras",
  lider: "Dany",
  cargo: "Coordenadora de Equipes",
  icon: "🔨",
  color: RED,
  colorDim: "rgba(239,68,68,0.15)",
  initials: "DA",
  menuItems: ["Meu Kanban", "Cronograma", "Equipes", "Diario", "Checklist", "Mapa"],
  kpis: [
    { label: "Obras Ativas", value: 32, sub: "15 SP + 5 BSB + 3 RJ + 3 MG + 2 BA + 2 GO + 1 RS + 1 PY", color: RED },
    { label: "Equipes em Campo", value: 38, sub: "23 instalacao + 15 marcenaria", color: ORANGE },
    { label: "Obras Travadas", value: 4, sub: "Rafaela Dimasi + Gabriel Lacher + Ana Cristina + Fernando/Maraisa", color: RED },
    { label: "Diarios Hoje", value: "28/32", sub: "4 pendentes", color: YELLOW },
    { label: "Reparos/Acabamento", value: 6, sub: "Priscila + Leandro + Luiz Andre + Davidson + Maristela + Ricardo E.", color: ORANGE },
    { label: "Finalizacao Proxima", value: 5, sub: "esta quinzena", color: GREEN },
  ],
  alerts: [],
  handoffs: [
    { id: "h1", from: "Obras", to: "Atendimento (Talita)", obra: "Fernando Aragon", status: "pendente", slaHours: 12, item: "Checklist acabamento + fotos + termo — finalizado 17/02" },
    { id: "h2", from: "Fiscal (Reinaldo)", to: "Obras", obra: "Ilka", status: "aceito", slaHours: 4, item: "Liberacao tecnica estrutura BSB" },
    { id: "h3", from: "Obras", to: "Atendimento (Talita)", obra: "Rosana Braido", status: "pendente", slaHours: 12, item: "Acabamento finalizado 17/02 — entrega formal" },
  ],
  columns: [
    { id: "entrada", title: "Entrada", color: BLUE, cards: [] },
    { id: "mobilizacao", title: "Mobilizacao / Aguardando", color: "#6B7280", cards: [] },
    { id: "execucao", title: "Em Execucao", color: ORANGE, cards: [], priority: "alta" },
    { id: "travado", title: "TRAVADO / BLOQUEADO", color: RED, cards: [] },
    { id: "reparos", title: "Reparos / Acabamento", color: YELLOW, cards: [] },
    { id: "finalizado", title: "Finalizado / Entrega", color: GREEN, cards: [] },
    { id: "handoff-pos", title: "Handoff → Pos-Obra", color: TEAL, cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   7. FINANCEIRO
   ═══════════════════════════════════════════════════════════════ */
const financeiro: DeptProfile = {
  id: "financeiro",
  nome: "Financeiro",
  nomeCompleto: "Departamento Financeiro",
  lider: "Karla",
  cargo: "Gestora Financeira",
  icon: "💰",
  color: "#10B981",
  colorDim: "rgba(16,185,129,0.15)",
  initials: "KA",
  menuItems: ["Meu Kanban", "Fluxo Caixa", "DRE", "Medicoes", "Retencoes", "Cobranca"],
  kpis: [
    { label: "Faturamento Mes", value: "R$ 1.8M", sub: "meta: R$ 2.0M", trend: "up", trendValue: "+22%", color: GREEN },
    { label: "Margem Real", value: "34.2%", sub: "meta: >33%", trend: "up", trendValue: "+1.8pp", color: GREEN },
    { label: "Inadimplencia", value: "R$ 156k", sub: "4 contratos", trend: "down", trendValue: "-R$ 12k", color: YELLOW },
    { label: "POs p/ Aprovar", value: 5, sub: "R$ 98k total", color: ORANGE },
    { label: "Retencoes Ativas", value: "R$ 185k", sub: "12 obras", color: BLUE },
    { label: "Caixa Projetado", value: "R$ 520k", sub: "prox. 30d", color: GREEN },
  ],
  alerts: [],
  handoffs: [
    { id: "h1", from: "Financeiro", to: "Compras (Ronaldo)", obra: "Trocha Family", status: "pendente", slaHours: 8, item: "Aprovacao POs Cabreuva — R$ 320k volume" },
  ],
  columns: [
    { id: "contrato", title: "Contrato Assinado", color: "#6B7280", cards: []},
    { id: "medicao", title: "Medicao Pendente", color: BLUE, cards: []},
    { id: "faturamento", title: "Faturamento", color: ORANGE, cards: [] },
    { id: "cobranca", title: "Cobranca / Inadimplencia", color: YELLOW, cards: [] },
    { id: "recebido", title: "Recebido", color: GREEN, cards: []},
  ],
};

/* ═══════════════════════════════════════════════════════════════
   8. ATENDIMENTO / RELACIONAMENTO
   ═══════════════════════════════════════════════════════════════ */
const atendimento: DeptProfile = {
  id: "atendimento",
  nome: "Atendimento",
  nomeCompleto: "Relacionamento ao Cliente",
  lider: "Talita",
  cargo: "Gestora de Relacionamento",
  icon: "🤝",
  color: PINK,
  colorDim: "rgba(236,72,153,0.15)",
  initials: "TA",
  menuItems: ["Meu Kanban", "Grupos", "Timeline", "NPS", "Onboarding", "Scripts"],
  kpis: [
    { label: "Tempo Resposta", value: "38min", sub: "meta: <40min", trend: "down", trendValue: "-5min", color: GREEN },
    { label: "Clientes Ativos", value: 28, sub: "32 obras + pos-venda", color: PINK },
    { label: "NPS Medio", value: "9.1", sub: "meta: >9.0", trend: "up", trendValue: "+0.2", color: GREEN },
    { label: "Onboardings Pendentes", value: 3, sub: "Claudio Mohn + Trocha + Jorbel", color: YELLOW },
    { label: "Chamados Abertos", value: 6, sub: "3 pos-obra", color: ORANGE },
    { label: "Satisfacao", value: "92%", sub: "pesquisa quinzenal", color: GREEN },
  ],
  alerts: [],
  handoffs: [
    { id: "h1", from: "Atendimento", to: "Fiscal (Davi)", obra: "Bernardo Coutinho", status: "pendente", slaHours: 8, item: "Solicitacao vistoria forro RJ + checklist cliente" },
    { id: "h2", from: "Obras (Dany)", to: "Atendimento", obra: "Fernando Aragon", status: "pendente", slaHours: 12, item: "Checklist acabamento + fotos + termo" },
  ],
  columns: [
    { id: "onboarding", title: "Onboarding", color: PINK, cards: [], priority: "alta" },
    { id: "acompanhamento", title: "Acompanhamento Ativo", color: BLUE, cards: [] },
    { id: "entrega-formal", title: "Entrega Formal", color: GREEN, cards: []},
    { id: "pos-venda", title: "Pos-Venda / NPS", color: TEAL, cards: [] },
    { id: "fechado", title: "Fechado / Arquivado", color: "#6B7280", cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   9. FISCAL / VISTORIA
   ═══════════════════════════════════════════════════════════════ */
const fiscal: DeptProfile = {
  id: "fiscal",
  nome: "Fiscal",
  nomeCompleto: "Fiscal & Vistoria Tecnica",
  lider: "Felipe / Fiscais",
  cargo: "Alvaro · Cristiano · Davi · Reinaldo · Vagner · Carlos",
  icon: "🔍",
  color: PURPLE,
  colorDim: "rgba(139,92,246,0.15)",
  initials: "FI",
  menuItems: ["Meu Kanban", "Vistorias", "Checklist", "Relatorios", "Medicoes", "Por Fiscal"],
  kpis: [
    { label: "Vistorias Semana", value: 12, sub: "6 Alvaro + 3 Reinaldo + 2 Davi + 1 Cristiano", color: PURPLE },
    { label: "Obras por Fiscal", value: "5.3", sub: "media entre 6 fiscais", color: BLUE },
    { label: "Obras s/ Fiscal", value: 4, sub: "Rafaela + Paulo Gotijo + Priscila + Rafaela", color: RED },
    { label: "Vistorias Pendentes", value: 6, sub: "3 liberacao + 3 acompanhamento", color: YELLOW },
    { label: "Relatorios OK", value: "92%", sub: "meta: 100%", color: GREEN },
    { label: "Fiscais Ativos", value: 6, sub: "Alvaro · Cristiano · Davi · Reinaldo · Vagner · Carlos", color: PURPLE },
  ],
  alerts: [],
  handoffs: [
    { id: "h1", from: "Fiscal (Reinaldo)", to: "Obras (Dany)", obra: "Ilka", status: "pendente", slaHours: 8, item: "Relatorio liberacao estrutura BSB" },
    { id: "h2", from: "Fiscal (Davi)", to: "Obras (Dany)", obra: "Bernardo Coutinho", status: "pendente", slaHours: 8, item: "Liberacao forro RJ + checklist" },
    { id: "h3", from: "Fiscal (Alvaro)", to: "Obras (Dany)", obra: "Felipe Almeida", status: "aceito", slaHours: 4, item: "Vistoria parcial pergolado + forro OK" },
  ],
  columns: [
    { id: "backlog",           title: "Backlog / Entrada de Demanda",          color: "#6B7280", cards: [] },
    { id: "agend-1vistoria",   title: "Agendamento - 1ª Vistoria",             color: BLUE,      cards: [] },
    { id: "1vistoria",        title: "Em Andamento - 1ª Vistoria",            color: PURPLE,    cards: [] },
    { id: "aguard-cliente",    title: "Aguardando Cliente (Pendências)",        color: YELLOW,    cards: [] },
    { id: "agend-2vistoria",   title: "Agendamento - 2ª Vistoria (Liberação)", color: ORANGE,    cards: [] },
    { id: "2vistoria",        title: "Em Andamento - 2ª Vistoria",            color: TEAL,      cards: [] },
    { id: "handoff-pmo",       title: "Passagem de Bastão → Obras",            color: ACCENT,    cards: [] },
    { id: "acompanhamento",    title: "Acompanhamento de Obra e Qualidade",     color: BLUE,      cards: [] },
    { id: "concluido",         title: "Concluído / Entrega Final",             color: GREEN,     cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   10. PRODUTIVIDADE / PMO
   ═══════════════════════════════════════════════════════════════ */
const produtividade: DeptProfile = {
  id: "produtividade",
  nome: "PMO",
  nomeCompleto: "Planejamento & Produtividade",
  lider: "Natalia",
  cargo: "Gestora de Produtividade",
  icon: "📊",
  color: TEAL,
  colorDim: "rgba(20,184,166,0.15)",
  initials: "NA",
  menuItems: ["Meu Kanban", "Cronogramas", "Produtividade", "Retencoes", "Ranking", "Report"],
  kpis: [
    { label: "Obras Monitoradas", value: 32, sub: "todas as ativas", color: TEAL },
    { label: "m2/dia Media", value: "18.5", sub: "piso: 22 | forro: 15 | deck: 12", color: GREEN },
    { label: "Retencao Ativa", value: "R$ 185k", sub: "12 obras", color: BLUE },
    { label: "Diarios Completos", value: "88%", sub: "meta: >95% · 4 faltando", trend: "up", trendValue: "+5pp", color: YELLOW },
    { label: "Cronograma OK", value: "75%", sub: "4 travadas baixam a media", color: YELLOW },
    { label: "Termos Pendentes", value: 5, sub: "aceite final", color: ORANGE },
  ],
  alerts: [],
  handoffs: [
    { id: "h1", from: "PMO", to: "Financeiro (Karla)", obra: "Fernando Aragon", status: "pendente", slaHours: 48, item: "Planilha pagamento final + retencao + termos — obra concluida 17/02" },
    { id: "h2", from: "PMO", to: "Financeiro (Karla)", obra: "Rosana Braido", status: "pendente", slaHours: 48, item: "Planilha pagamento final + retencao + termos — obra concluida 17/02" },
  ],
  columns: [
    { id: "entrada",    title: "Entrada",        color: "#6B7280", cards: [], slaLabel: "Novo Projeto Recebido" },
    { id: "pre-crono",  title: "Pre-Cronograma", color: BLUE,      cards: [] },
    { id: "ativo", title: "Monitoramento Ativo", color: TEAL, cards: [] },
    { id: "reparo", title: "Reparo", color: "#F97316", cards: [] },
    { id: "aceite", title: "Termo de Aceite", color: YELLOW, cards: []},
    { id: "encerrado", title: "Encerrado", color: GREEN, cards: []},
  ],
};

/* ═══════════════════════════════════════════════════════════════
   11. MARKETING
   ═══════════════════════════════════════════════════════════════ */
const marketing: DeptProfile = {
  id: "marketing",
  nome: "Marketing",
  nomeCompleto: "Marketing & Comunicacao",
  lider: "Raphael",
  cargo: "Gestor de Marketing",
  icon: "📣",
  color: "#EC4899",
  colorDim: "rgba(236,72,153,0.15)",
  initials: "RA",
  menuItems: ["Meu Kanban", "Calendario", "Campanhas", "Cases", "Analytics", "Leads"],
  kpis: [
    { label: "Leads/Mes", value: 92, sub: "+12% vs mes anterior", trend: "up", trendValue: "+12%", color: PINK },
    { label: "CAC", value: "R$ 1.8k", sub: "meta: <R$ 2k", trend: "down", trendValue: "-R$ 200", color: GREEN },
    { label: "CPL", value: "R$ 85", sub: "Google: R$ 62 | IG: R$ 108", color: GREEN },
    { label: "Conversao Lead→Proposta", value: "28%", sub: "meta: 30%", color: YELLOW },
    { label: "Posts/Semana", value: 8, sub: "3 feed + 3 reels + 2 stories", color: PINK },
    { label: "Cases Publicados", value: 4, sub: "este mes", color: GREEN },
  ],
  alerts: [],
  handoffs: [],
  columns: [
    { id: "briefing", title: "Briefing de Case", color: "#6B7280", cards: [] },
    { id: "criacao", title: "Em Criacao", color: PINK, cards: [] },
    { id: "revisao-mkt", title: "Revisao", color: YELLOW, cards: [] },
    { id: "publicacao", title: "Publicacao", color: GREEN, cards: [] },
    { id: "analise", title: "Analise / Portfolio", color: TEAL, cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   12. RH
   ═══════════════════════════════════════════════════════════════ */
const rh: DeptProfile = {
  id: "rh",
  nome: "RH",
  nomeCompleto: "Recursos Humanos",
  lider: "Talicia",
  cargo: "Gestora de RH",
  icon: "👥",
  color: "#818CF8",
  colorDim: "rgba(129,140,248,0.15)",
  initials: "TC",
  menuItems: ["Meu Kanban", "Headcount", "Vagas", "Onboarding", "Beneficios", "Equipes"],
  kpis: [
    { label: "Headcount", value: 149, sub: "13 departamentos", color: PURPLE },
    { label: "Equipes Campo", value: 38, sub: "23 inst + 15 marc · 60+ instaladores", color: ORANGE },
    { label: "Vagas Abertas", value: 4, sub: "2 instaladores + 1 fiscal + 1 marceneiro", color: YELLOW },
    { label: "Turnover", value: "3.2%", sub: "meta: <5%", trend: "flat", color: GREEN },
    { label: "Fiscais Ativos", value: 6, sub: "Alvaro · Cristiano · Davi · Reinaldo · Vagner · Carlos", color: PURPLE },
    { label: "Sobrecarga Reinaldo", value: "12 obras", sub: "⚠️ risco burnout", color: RED },
  ],
  alerts: [],
  handoffs: [],
  columns: [
    { id: "vaga", title: "Vaga Aberta", color: "#6B7280", cards: []},
    { id: "alocacao", title: "Alocacao de Equipes", color: BLUE, cards: [] },
    { id: "producao-equipes", title: "Equipes Marcenaria (Fabrica)", color: ORANGE, cards: []},
    { id: "internacional", title: "Equipes Internacionais/Viagem", color: PURPLE, cards: [] },
    { id: "treinamento", title: "Treinamento / Onboarding", color: GREEN, cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   13. ORCAMENTO
   ═══════════════════════════════════════════════════════════════ */
const orcamento: DeptProfile = {
  id: "orcamento",
  nome: "Orcamento",
  nomeCompleto: "Orcamento & Propostas",
  lider: "Ranieri",
  cargo: "Responsavel de Orcamentos",
  icon: "📝",
  color: YELLOW,
  colorDim: "rgba(245,158,11,0.15)",
  initials: "RI",
  menuItems: ["Meu Kanban", "Propostas", "Tabela Precos", "Templates", "Historico"],
  kpis: [
    { label: "Orcamentos Ativos", value: 12, sub: "R$ 2.8M no pipe", color: YELLOW },
    { label: "Lead Time", value: "2.8d", sub: "meta: <3d", trend: "down", trendValue: "-0.3d", color: GREEN },
    { label: "Dados Incompletos", value: "25%", sub: "falta info — Silvia Alarico s/ madeira", trend: "down", trendValue: "-10pp", color: YELLOW },
    { label: "Desvio Orc vs Real", value: "6.2%", sub: "meta: <8%", color: GREEN },
    { label: "Revisoes/Proposta", value: "1.4", sub: "meta: <1.5", color: GREEN },
    { label: "Propostas/Semana", value: 5, sub: "media", color: YELLOW },
  ],
  alerts: [],
  handoffs: [
    { id: "h1", from: "Orcamento", to: "Comercial", obra: "Claudio Mohn Franca", status: "aceito", slaHours: 2, item: "Proposta R$ 420k — 48.6m2 Painel + 46 Portas Peroba Laca" },
    { id: "h2", from: "Orcamento", to: "Comercial", obra: "Jorbel", status: "aceito", slaHours: 2, item: "Proposta R$ 420k — Piso + Forro + Deck Paraguay" },
  ],
  columns: [
    { id: "solicitacao", title: "Solicitacao Recebida", color: "#6B7280", cards: [], priority: "alta" },
    { id: "analise-orc", title: "Em Analise", color: BLUE, cards: []},
    { id: "calculo", title: "Em Calculo", color: YELLOW, cards: []},
    { id: "proposta-pronta", title: "Proposta Pronta / Enviada", color: GREEN, cards: []},
    { id: "handoff-com", title: "Enviada ao Comercial", color: TEAL, cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   14. IA
   ═══════════════════════════════════════════════════════════════ */
const ia: DeptProfile = {
  id: "ia",
  nome: "IA",
  nomeCompleto: "Inteligencia Artificial",
  lider: "Will",
  cargo: "Gestor de IA",
  icon: "🤖",
  color: PURPLE,
  colorDim: "rgba(139,92,246,0.15)",
  initials: "WL",
  menuItems: ["Meu Kanban", "Agentes", "Prompts", "Deploys", "Metricas"],
  kpis: [
    { label: "Agentes Ativos", value: 6, sub: "3 em producao", color: PURPLE },
    { label: "Chamadas/dia", value: "1.2k", sub: "+18% sem", trend: "up", trendValue: "+18%", color: GREEN },
    { label: "Custo Mensal API", value: "R$ 2.4k", sub: "dentro do budget", color: GREEN },
    { label: "Uptime Agentes", value: "99.2%", sub: "meta: >99%", color: GREEN },
  ],
  alerts: [],
  handoffs: [],
  columns: [
    { id: "backlog-ia", title: "Backlog", color: "#6B7280", cards: [] },
    { id: "dev-ia", title: "Em Desenvolvimento", color: BLUE, cards: [] },
    { id: "teste-ia", title: "Em Teste", color: YELLOW, cards: [] },
    { id: "deploy-ia", title: "Em Producao", color: GREEN, cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   15. LAYOUT
   ═══════════════════════════════════════════════════════════════ */
const layout: DeptProfile = {
  id: "layout",
  nome: "Layout",
  nomeCompleto: "Layout & Detalhamento",
  lider: "Equipe Layout",
  cargo: "Detalhamento Tecnico",
  icon: "📐",
  color: TEAL,
  colorDim: "rgba(20,184,166,0.15)",
  initials: "LY",
  menuItems: ["Meu Kanban", "Projetos", "Detalhamentos", "Revisoes", "Biblioteca"],
  kpis: [
    { label: "Projetos em Layout", value: 8, sub: "3 urgentes", color: TEAL },
    { label: "Lead Time", value: "4.2d", sub: "meta: <5d", trend: "down", trendValue: "-0.5d", color: GREEN },
    { label: "Revisoes Pendentes", value: 3, sub: "aguardando aprovacao", color: YELLOW },
    { label: "Detalhamentos/Semana", value: 6, sub: "media", color: TEAL },
  ],
  alerts: [],
  handoffs: [],
  columns: [
    { id: "fila-layout", title: "Fila de Layout", color: "#6B7280", cards: [] },
    { id: "em-layout", title: "Em Detalhamento", color: BLUE, cards: [] },
    { id: "revisao-layout", title: "Revisao", color: YELLOW, cards: [] },
    { id: "aprovado-layout", title: "Aprovado", color: GREEN, cards: [] },
    { id: "liberado-prod", title: "Liberado p/ Producao", color: TEAL, cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   15b. COMERCIAL — FUNIL DE ENTRADA
   ═══════════════════════════════════════════════════════════════ */
const comercialEntrada: DeptProfile = {
  id: "comercial-entrada",
  nome: "Funil de Entrada",
  nomeCompleto: "Funil de Entrada — Triagem de Leads",
  lider: "Equipe Comercial",
  cargo: "BDR / SDR",
  icon: "🎯",
  color: TEAL,
  colorDim: "rgba(20,184,166,0.15)",
  initials: "FE",
  menuItems: ["Meu Kanban", "Leads", "Qualificação"],
  kpis: [],
  alerts: [],
  handoffs: [],
  columns: [
    { id: "leads-entrada", title: "Leads de Entrada", color: "#6B7280", cards: [] },
    { id: "triagem-ia", title: "Triagem IA", color: GOLD, cards: [] },
    { id: "contato-inicial", title: "Contato Inicial", color: BLUE, cards: [] },
    { id: "em-qualificacao", title: "Em Qualificação", color: PURPLE, cards: [] },
    { id: "follow-up-1", title: "Follow Up 1", color: YELLOW, cards: [] },
    { id: "follow-up-2", title: "Follow Up 2", color: ORANGE, cards: [] },
    { id: "qualificado-ia", title: "Qualificado IA", color: TEAL, cards: [] },
    { id: "qualificado", title: "Qualificado", color: GREEN, cards: [] },
    { id: "vendedor", title: "Vendedor", color: BLUE, cards: [] },
    { id: "nao-qualificado", title: "Não Qualificado", color: RED, cards: [] },
    { id: "ganho", title: "Ganho", color: GREEN, cards: [] },
    { id: "perda", title: "Perda", color: RED, cards: [] },
    { id: "lembretes", title: "Lembretes", color: GOLD, cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   15c. COMPRAS — TAIANE
   ═══════════════════════════════════════════════════════════════ */
const comprasTaiara: DeptProfile = {
  id: "compras-taiara",
  nome: "Compras Taiara",
  nomeCompleto: "Compras & Supply Chain — Taiara",
  lider: "Taiara",
  cargo: "Gestora de Compras",
  icon: "🛒",
  color: TEAL,
  colorDim: "rgba(20,184,166,0.15)",
  initials: "TA",
  menuItems: ["Meu Kanban", "Cotacoes", "Fornecedores", "Estoque", "Lead Times"],
  kpis: [],
  alerts: [],
  handoffs: [],
  columns: [
    { id: "cotacao", title: "Cotação e Priorização", color: BLUE, cards: [] },
    { id: "aguarda-aprovacao", title: "Interface Financeira", color: YELLOW, cards: [] },
    { id: "emissao-pedido", title: "Emissão do Pedido", color: PURPLE, cards: [] },
    { id: "em-transito", title: "Logística e Acompanhamento", color: TEAL, cards: [] },
    { id: "recebimento-auditoria", title: "Recebimento e Conferência", color: ORANGE, cards: [] },
    { id: "concluido", title: "Finalizado", color: GREEN, cards: [] },
    { id: "amostras", title: "Amostras em Execução", color: PINK, cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   15d. COMPRAS — MARCO ANTÔNIO
   ═══════════════════════════════════════════════════════════════ */
const comprasMarco: DeptProfile = {
  id: "compras-marco",
  nome: "Compras Marco Antônio",
  nomeCompleto: "Compras — Marco Antônio (Amostras Marcenaria)",
  lider: "Marco Antônio",
  cargo: "Compras Amostras",
  icon: "🛒",
  color: PURPLE,
  colorDim: "rgba(139,92,246,0.15)",
  initials: "MA",
  menuItems: ["Meu Kanban", "Gestor de SLA", "Fornecedores", "Estoque", "Lead Times"],
  kpis: [],
  alerts: [],
  handoffs: [],
  columns: [
    { id: "solicitacao", title: "Solicitação", color: "#6B7280", cards: [] },
    { id: "em-execucao", title: "Em Execução", color: BLUE, cards: [] },
    { id: "amostra-pronta", title: "Amostra Pronta", color: YELLOW, cards: [] },
    { id: "em-rota-entrega", title: "Em Rota de Entrega", color: TEAL, cards: [] },
    { id: "finalizado", title: "Finalizado", color: GREEN, cards: [] },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   EXPORT TODOS OS PERFIS
   ═══════════════════════════════════════════════════════════════ */

export const allProfiles: DeptProfile[] = [
  comercial, projetos, compras, producao, logistica, obras,
  financeiro, atendimento, fiscal, produtividade, marketing, rh, orcamento,
  ia, layout, comercialEntrada, comprasTaiara, comprasMarco,
];

export function getProfile(id: string): DeptProfile | undefined {
  return allProfiles.find(p => p.id === id);
}
