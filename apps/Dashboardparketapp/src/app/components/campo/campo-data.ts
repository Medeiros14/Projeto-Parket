/* ═══════════════════════════════════════════════════════════════
   PARKETAPP OBRAS — Dados mock para o módulo Campo & Produção
   Adaptado ao contexto Parket Pisos: revestimento, marcenaria, fábrica
   ═══════════════════════════════════════════════════════════════ */

/* ─── Cores do módulo Campo (light mode para uso em campo) ─── */
export const C = {
  bg: "#F8FAFB",
  card: "#FFFFFF",
  accent: "#B8AA9A",      // Mantém branding Parket
  accentDark: "#9A8E80",
  green: "#10B981",
  red: "#EF4444",
  yellow: "#F59E0B",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  pink: "#EC4899",
  teal: "#14B8A6",
  text: "#1A1A2E",
  textSec: "#6B7280",
  textDim: "#9CA3AF",
  border: "#E5E7EB",
  bgDark: "#0A0A0A",
  cardDark: "#111111",
  borderDark: "rgba(255,255,255,0.06)",
};

/* ─── Perfis de usuário ─── */
export type CampoProfile =
  | "instalador-revestimento"
  | "marceneiro-montador"
  | "marceneiro-producao"
  | "fabrica-diretor"
  | "fiscal";

export interface CampoUser {
  id: string;
  nome: string;
  cargo: string;
  profileType: CampoProfile;
  avatar: string;
  matricula: string;
  telefone: string;
  setor: "campo" | "marcenaria" | "fabrica";
  obraAtual?: string;
  pontos: number;
  ranking: number;
  foto: string;
}

export const CAMPO_PROFILES: { id: CampoProfile; label: string; desc: string; icon: string; color: string; foto: string }[] = [
  {
    id: "instalador-revestimento",
    label: "Instalador de Revestimento",
    desc: "Instalação de pisos, forros, decks e revestimentos em obras",
    icon: "🔨",
    color: C.green,
    foto: "https://images.unsplash.com/photo-1604589977707-d161da2edb0f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0aWxlJTIwaW5zdGFsbGF0aW9uJTIwY2VyYW1pYyUyMGZsb29yfGVufDF8fHx8MTc3Mjk0NDE2MXww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "marceneiro-montador",
    label: "Marceneiro (Montador)",
    desc: "Montagem e instalação de marcenaria em obras do cliente",
    icon: "🪚",
    color: C.yellow,
    foto: "https://images.unsplash.com/photo-1585406666850-82f7532fdae3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmdXJuaXR1cmUlMjBhc3NlbWJseSUyMGNhcnBlbnRlciUyMHRvb2xzfGVufDF8fHx8MTc3Mjk0NDE2Mnww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "marceneiro-producao",
    label: "Marceneiro (Produção)",
    desc: "Produção de peças e componentes na marcenaria/oficina",
    icon: "🏭",
    color: C.blue,
    foto: "https://images.unsplash.com/photo-1683115098652-db9813ecf284?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXJwZW50cnklMjB3b3Jrc2hvcCUyMHdvb2R3b3JraW5nfGVufDF8fHx8MTc3Mjk0NDE1Nnww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "fabrica-diretor",
    label: "Fábrica de Revestimento",
    desc: "Diretor de produção — controle de linhas e registros fotográficos",
    icon: "🏗️",
    color: C.purple,
    foto: "https://images.unsplash.com/photo-1564691848938-d0fc26235733?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b29kJTIwcGFuZWwlMjBmYWN0b3J5JTIwcHJvZHVjdGlvbnxlbnwxfHx8fDE3NzI5NDQxNTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "fiscal",
    label: "Fiscal de Obra",
    desc: "Supervisão de qualidade — revestimento e marcenaria em campo",
    icon: "📋",
    color: C.teal,
    foto: "https://images.unsplash.com/photo-1760030428004-60a033044f81?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluc3BlY3RvciUyMGNsaXBib2FyZHxlbnwxfHx8fDE3NzI5NDQxNTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
];

/* ─── Usuários mock por perfil ─── */
export const CAMPO_USERS: Record<CampoProfile, CampoUser> = {
  "instalador-revestimento": {
    id: "u-inst-01", nome: "Marcos Ribeiro", cargo: "Instalador Sênior de Pisos",
    profileType: "instalador-revestimento", avatar: "MR", matricula: "PKT-2048",
    telefone: "(11) 98765-4321", setor: "campo", obraAtual: "OBR-001",
    pontos: 485, ranking: 1,
    foto: "https://images.unsplash.com/photo-1694522362256-6c907336af43?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjB3b3JrZXIlMjBzYWZldHklMjBoZWxtZXR8ZW58MXx8fHwxNzcyODYzMzg5fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  "marceneiro-montador": {
    id: "u-marc-01", nome: "Wilson Santos", cargo: "Marceneiro Montador",
    profileType: "marceneiro-montador", avatar: "WS", matricula: "PKT-2052",
    telefone: "(11) 97654-3210", setor: "campo", obraAtual: "OBR-002",
    pontos: 390, ranking: 3,
    foto: "https://images.unsplash.com/photo-1694522362256-6c907336af43?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjB3b3JrZXIlMjBzYWZldHklMjBoZWxtZXR8ZW58MXx8fHwxNzcyODYzMzg5fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  "marceneiro-producao": {
    id: "u-prod-01", nome: "Altair Oliveira", cargo: "Marceneiro de Produção",
    profileType: "marceneiro-producao", avatar: "AO", matricula: "PKT-2061",
    telefone: "(11) 96543-2109", setor: "marcenaria",
    pontos: 310, ranking: 5,
    foto: "https://images.unsplash.com/photo-1694522362256-6c907336af43?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjB3b3JrZXIlMjBzYWZldHklMjBoZWxtZXR8ZW58MXx8fHwxNzcyODYzMzg5fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  "fabrica-diretor": {
    id: "u-fab-01", nome: "Germano Costa", cargo: "Diretor de Produção — Fábrica",
    profileType: "fabrica-diretor", avatar: "GC", matricula: "PKT-1008",
    telefone: "(11) 95432-1098", setor: "fabrica",
    pontos: 620, ranking: 1,
    foto: "https://images.unsplash.com/photo-1694522362256-6c907336af43?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjB3b3JrZXIlMjBzYWZldHklMjBoZWxtZXR8ZW58MXx8fHwxNzcyODYzMzg5fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  "fiscal": {
    id: "u-fisc-01", nome: "Felipe Mendes", cargo: "Fiscal de Obras — Revestimento & Marcenaria",
    profileType: "fiscal", avatar: "FM", matricula: "PKT-1022",
    telefone: "(11) 94321-0987", setor: "campo", obraAtual: "OBR-001",
    pontos: 520, ranking: 2,
    foto: "https://images.unsplash.com/photo-1760030428004-60a033044f81?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluc3BlY3RvciUyMGNsaXBib2FyZHxlbnwxfHx8fDE3NzI5NDQxNTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
};

/* ─── Obras ─── */
export interface ObraCampo {
  id: string; nome: string; cliente: string; endereco: string;
  status: "ativa" | "pausada" | "concluida";
  progresso: number; equipes: string[]; fiscal: string;
  orcamento: number; gastoAtual: number;
}

export const OBRAS_CAMPO: ObraCampo[] = [
  { id: "OBR-001", nome: "Pedro Campos — Brasília", cliente: "Pedro Campos", endereco: "SQN 308, Brasília - DF", status: "ativa", progresso: 72, equipes: ["Jailton e Igor", "Carlos e Ray", "Reinaldo 2"], fiscal: "Reinaldo", orcamento: 385000, gastoAtual: 245000 },
  { id: "OBR-002", nome: "Maria e Mel — Nova Lima", cliente: "Maria e Mel", endereco: "Rua das Flores, 120 — Nova Lima, MG", status: "ativa", progresso: 65, equipes: ["Viny e Wilson", "Ramon e Kaique", "Geomario (4)"], fiscal: "Davi", orcamento: 290000, gastoAtual: 178000 },
  { id: "OBR-003", nome: "Inacio — São Paulo", cliente: "Inacio", endereco: "Al. Santos, 850 — São Paulo, SP", status: "ativa", progresso: 45, equipes: ["Josemario e Altair", "Moises e Alessandro"], fiscal: "—", orcamento: 210000, gastoAtual: 92000 },
  { id: "OBR-004", nome: "Leandro Silva — Riviera", cliente: "Leandro Silva", endereco: "Condomínio Riviera, Bertioga - SP", status: "ativa", progresso: 35, equipes: ["Equipe Delta"], fiscal: "Felipe", orcamento: 175000, gastoAtual: 58000 },
  { id: "OBR-005", nome: "Studio Débora Aguiar", cliente: "Studio Débora Aguiar", endereco: "Av. Paulista, 1578 — São Paulo, SP", status: "ativa", progresso: 10, equipes: ["Equipe Beta"], fiscal: "Felipe", orcamento: 310000, gastoAtual: 28000 },
];

/* ─── Check-ins ─── */
export interface CheckinEntry {
  id: string; userId: string; obraId: string;
  horaEntrada: string; horaSaida?: string;
  dentroDoRaio: boolean; obs?: string; data: string;
}

export const CHECKINS: CheckinEntry[] = [
  { id: "ck-1", userId: "u-inst-01", obraId: "OBR-001", horaEntrada: "07:02", horaSaida: "17:15", dentroDoRaio: true, data: "07/03/2026" },
  { id: "ck-2", userId: "u-inst-01", obraId: "OBR-001", horaEntrada: "06:58", horaSaida: "17:30", dentroDoRaio: true, data: "06/03/2026" },
  { id: "ck-3", userId: "u-inst-01", obraId: "OBR-001", horaEntrada: "07:10", dentroDoRaio: true, data: "08/03/2026", obs: "Início do turno — preparação contrapiso" },
  { id: "ck-4", userId: "u-marc-01", obraId: "OBR-002", horaEntrada: "07:05", dentroDoRaio: true, data: "08/03/2026" },
  { id: "ck-5", userId: "u-fisc-01", obraId: "OBR-001", horaEntrada: "08:00", dentroDoRaio: true, data: "08/03/2026", obs: "Vistoria de umidade agendada" },
];

/* ─── Postagens / Feed ─── */
export interface PostCampo {
  id: string; userId: string; userName: string; userAvatar: string;
  obraId: string; obraNome: string; etapa: string;
  descricao: string; foto: string; data: string; hora: string;
  status: "pendente" | "aprovado" | "rejeitado";
  notaQualidade?: number; comentarioFiscal?: string;
}

export const POSTS_CAMPO: PostCampo[] = [
  {
    id: "p-1", userId: "u-inst-01", userName: "Marcos R.", userAvatar: "MR",
    obraId: "OBR-001", obraNome: "Pedro Campos", etapa: "Piso — Assentamento",
    descricao: "Finalizado assentamento do piso Cumaru no hall de entrada. 22m² executados hoje. Alinhamento e nível verificados.",
    foto: "https://images.unsplash.com/photo-1770625467780-7ed1965f8185?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3b29kJTIwZmxvb3JpbmclMjBpbnN0YWxsYXRpb258ZW58MXx8fHwxNzcyOTQ0MTU2fDA&ixlib=rb-4.1.0&q=80&w=1080",
    data: "08/03/2026", hora: "16:30", status: "aprovado", notaQualidade: 5,
    comentarioFiscal: "Excelente acabamento. Padrão Parket mantido.",
  },
  {
    id: "p-2", userId: "u-inst-01", userName: "Marcos R.", userAvatar: "MR",
    obraId: "OBR-001", obraNome: "Pedro Campos", etapa: "Deck — Preparação",
    descricao: "Preparação da base para deck na área externa. Nivelamento do contrapiso concluído.",
    foto: "https://images.unsplash.com/photo-1766595680977-fd4818afa337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwcHJvZ3Jlc3MlMjBidWlsZGluZ3xlbnwxfHx8fDE3NzI5NDQxNTl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    data: "07/03/2026", hora: "15:45", status: "aprovado", notaQualidade: 4,
  },
  {
    id: "p-3", userId: "u-marc-01", userName: "Wilson S.", userAvatar: "WS",
    obraId: "OBR-002", obraNome: "Maria e Mel", etapa: "Marcenaria — Montagem",
    descricao: "Início da montagem do painel MDF sala de jantar. Peças conferidas e alinhadas.",
    foto: "https://images.unsplash.com/photo-1585406666850-82f7532fdae3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmdXJuaXR1cmUlMjBhc3NlbWJseSUyMGNhcnBlbnRlciUyMHRvb2xzfGVufDF8fHx8MTc3Mjk0NDE2Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    data: "08/03/2026", hora: "14:20", status: "pendente",
  },
  {
    id: "p-4", userId: "u-prod-01", userName: "Altair O.", userAvatar: "AO",
    obraId: "OBR-003", obraNome: "Inacio", etapa: "Produção — Usinagem",
    descricao: "Usinagem das portas pivotantes concluída. 4 unidades prontas para acabamento.",
    foto: "https://images.unsplash.com/photo-1683115098652-db9813ecf284?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXJwZW50cnklMjB3b3Jrc2hvcCUyMHdvb2R3b3JraW5nfGVufDF8fHx8MTc3Mjk0NDE1Nnww&ixlib=rb-4.1.0&q=80&w=1080",
    data: "08/03/2026", hora: "11:00", status: "aprovado", notaQualidade: 5,
  },
  {
    id: "p-5", userId: "u-fab-01", userName: "Germano C.", userAvatar: "GC",
    obraId: "OBR-004", obraNome: "Leandro Silva", etapa: "Fábrica — Linha de Produção",
    descricao: "Linha 2 produzindo painéis de revestimento Nogueira. Lote de 30 peças — 18 prontas.",
    foto: "https://images.unsplash.com/photo-1564691848938-d0fc26235733?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b29kJTIwcGFuZWwlMjBmYWN0b3J5JTIwcHJvZHVjdGlvbnxlbnwxfHx8fDE3NzI5NDQxNTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    data: "08/03/2026", hora: "10:15", status: "pendente",
  },
];

/* ─── Tarefas ─── */
export interface TarefaCampo {
  id: string; titulo: string; obraId: string; obraNome: string;
  userId: string; prioridade: "alta" | "media" | "baixa";
  status: "pendente" | "andamento" | "concluida" | "atrasada";
  prazo: string; etapa: string;
}

export const TAREFAS_CAMPO: TarefaCampo[] = [
  { id: "t-1", titulo: "Assentamento piso hall — Cumaru", obraId: "OBR-001", obraNome: "Pedro Campos", userId: "u-inst-01", prioridade: "alta", status: "andamento", prazo: "10/03", etapa: "Piso" },
  { id: "t-2", titulo: "Deck área externa — base", obraId: "OBR-001", obraNome: "Pedro Campos", userId: "u-inst-01", prioridade: "media", status: "pendente", prazo: "15/03", etapa: "Deck" },
  { id: "t-3", titulo: "Vistoria umidade — quarto master", obraId: "OBR-001", obraNome: "Pedro Campos", userId: "u-inst-01", prioridade: "alta", status: "pendente", prazo: "09/03", etapa: "Vistoria" },
  { id: "t-4", titulo: "Montagem painel MDF — sala", obraId: "OBR-002", obraNome: "Maria e Mel", userId: "u-marc-01", prioridade: "alta", status: "andamento", prazo: "12/03", etapa: "Marcenaria" },
  { id: "t-5", titulo: "Usinagem portas pivotantes", obraId: "OBR-003", obraNome: "Inacio", userId: "u-prod-01", prioridade: "alta", status: "concluida", prazo: "08/03", etapa: "Produção" },
  { id: "t-6", titulo: "Foto lote painéis Nogueira", obraId: "OBR-004", obraNome: "Leandro Silva", userId: "u-fab-01", prioridade: "media", status: "andamento", prazo: "10/03", etapa: "Fábrica" },
  { id: "t-7", titulo: "Vistoria acabamento — Maria e Mel", obraId: "OBR-002", obraNome: "Maria e Mel", userId: "u-fisc-01", prioridade: "alta", status: "pendente", prazo: "09/03", etapa: "Vistoria" },
  { id: "t-8", titulo: "Validar 3 postagens pendentes", obraId: "OBR-001", obraNome: "Pedro Campos", userId: "u-fisc-01", prioridade: "media", status: "pendente", prazo: "08/03", etapa: "Validação" },
];

/* ─── Ordens de Produção ─── */
export interface OrdemProducao {
  id: string; codigo: string; obraDestino: string; obraNome: string;
  item: string; material: string;
  status: "fila" | "cortando" | "montando" | "acabamento" | "pronto" | "entregue";
  responsavel: string; prazo: string; conclusao: number;
}

export const ORDENS_PRODUCAO: OrdemProducao[] = [
  { id: "op-1", codigo: "OP-224", obraDestino: "OBR-005", obraNome: "Studio Débora Aguiar", item: "Fachada Cumaru — 22 painéis", material: "Cumaru", status: "fila", responsavel: "—", prazo: "25/03", conclusao: 0 },
  { id: "op-2", codigo: "OP-221", obraDestino: "OBR-003", obraNome: "Inacio", item: "Portas Pivotantes Carvalho (4un)", material: "Carvalho Europeu", status: "acabamento", responsavel: "Altair O.", prazo: "12/03", conclusao: 80 },
  { id: "op-3", codigo: "OP-220", obraDestino: "OBR-004", obraNome: "Leandro Silva", item: "Painéis Nogueira (30 peças)", material: "Nogueira", status: "cortando", responsavel: "Equipe C", prazo: "18/03", conclusao: 60 },
  { id: "op-4", codigo: "OP-218", obraDestino: "OBR-001", obraNome: "Pedro Campos", item: "Kit Rodapé Cumaru", material: "Cumaru", status: "pronto", responsavel: "—", prazo: "08/03", conclusao: 100 },
  { id: "op-5", codigo: "OP-219", obraDestino: "OBR-002", obraNome: "Maria e Mel", item: "Painel MDF Sala + Forro", material: "MDF Carvalho", status: "montando", responsavel: "Equipe B", prazo: "14/03", conclusao: 45 },
];

/* ─── Ranking / Gamificação ─── */
export interface RankingEntry {
  pos: number; userId: string; nome: string; avatar: string;
  pontos: number; badges: string[];
}

export const RANKING: RankingEntry[] = [
  { pos: 1, userId: "u-inst-01", nome: "Marcos Ribeiro", avatar: "MR", pontos: 485, badges: ["Pontual", "Produtivo", "5 Estrelas"] },
  { pos: 2, userId: "u-fisc-01", nome: "Felipe Mendes", avatar: "FM", pontos: 520, badges: ["Qualidade", "Zero Faltas"] },
  { pos: 3, userId: "u-marc-01", nome: "Wilson Santos", avatar: "WS", pontos: 390, badges: ["Produtivo"] },
  { pos: 4, userId: "u-fab-01", nome: "Germano Costa", avatar: "GC", pontos: 620, badges: ["Líder", "Produtivo", "Inovador"] },
  { pos: 5, userId: "u-prod-01", nome: "Altair Oliveira", avatar: "AO", pontos: 310, badges: ["Pontual"] },
  { pos: 6, userId: "u-06", nome: "Ricardo Silva", avatar: "RS", pontos: 280, badges: [] },
  { pos: 7, userId: "u-07", nome: "Tiago Martins", avatar: "TM", pontos: 250, badges: ["Pontual"] },
  { pos: 8, userId: "u-08", nome: "Fernando Lima", avatar: "FL", pontos: 220, badges: [] },
];

/* ─── Notificações ─── */
export interface NotifCampo {
  id: string; tipo: "tarefa" | "aprovado" | "rejeitado" | "lembrete" | "aviso";
  texto: string; data: string; lida: boolean;
}

export const NOTIFICACOES: NotifCampo[] = [
  { id: "n-1", tipo: "tarefa", texto: "Nova tarefa atribuída: Assentamento piso hall — Cumaru", data: "Hoje 07:30", lida: false },
  { id: "n-2", tipo: "aprovado", texto: "Sua postagem 'Piso Cumaru hall' foi aprovada com nota 5!", data: "Hoje 09:00", lida: false },
  { id: "n-3", tipo: "lembrete", texto: "Lembrete: Faça o check-in ao chegar na obra", data: "Hoje 06:45", lida: true },
  { id: "n-4", tipo: "aviso", texto: "Reunião de equipe amanhã às 07:00 na base", data: "Ontem 16:00", lida: true },
  { id: "n-5", tipo: "rejeitado", texto: "Postagem 'Deck externo' precisa de mais detalhes", data: "06/03 14:00", lida: true },
];

/* ─── Helpers ─── */
export function getGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
