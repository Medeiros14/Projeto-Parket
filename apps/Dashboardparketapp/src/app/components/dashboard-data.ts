export const ACCENT = "#B8AA9A";
export const BG = "#0A0A0A";
export const CARD_BG = "#111111";
export const CARD_BORDER = "rgba(255,255,255,0.06)";
export const GREEN = "#4ADE80";
export const GREEN_DIM = "rgba(74,222,128,0.15)";
export const RED = "#F87171";
export const RED_DIM = "rgba(248,113,113,0.15)";
export const YELLOW = "#FBBF24";
export const YELLOW_DIM = "rgba(251,191,36,0.15)";
export const BLUE = "#60A5FA";
export const BLUE_DIM = "rgba(96,165,250,0.15)";
export const TEAL = "#8BA8A0";
export const PURPLE = "#A78BFA";
export const PURPLE_DIM = "rgba(167,139,250,0.15)";
export const ORANGE = "#FB923C";
export const ORANGE_DIM = "rgba(251,146,60,0.15)";

export interface ObraCC {
  id: string;
  code: string;
  client: string;
  location: string;
  type: string;
  typeLabel: string;
  value: string;
  valueNum: number;
  riskScore: number;
  riskTrend: number;
  phase: string;
  progress: number;
  daysRemaining: number;
  responsible: string;
  costBudget: number;
  costReal: number;
  marginBudget: number;
  marginReal: number;
  ncOpen: number;
  rework: number;
  blockers: number;
  scopeChanges: number;
  nextHandoff: string;
  nextHandoffDays: number;
  topRisks: string[];
}

export const obrasData: ObraCC[] = [
  { id: "1", code: "PKT-042", client: "Familia Andrade", location: "Ipiranga", type: "rev", typeLabel: "Revestimentos", value: "R$ 185k", valueNum: 185000, riskScore: 92, riskTrend: 2, phase: "Entrega", progress: 88, daysRemaining: 5, responsible: "Talita", costBudget: 118000, costReal: 112000, marginBudget: 36.2, marginReal: 39.5, ncOpen: 0, rework: 2, blockers: 0, scopeChanges: 0, nextHandoff: "Obras > Relacionamento", nextHandoffDays: 3, topRisks: ["Aceite pendente", "Checklist 92% incompleto"] },
  { id: "2", code: "PKT-045", client: "Studio MV Arq.", location: "Morumbi", type: "rev", typeLabel: "Revestimentos", value: "R$ 312k", valueNum: 312000, riskScore: 78, riskTrend: -3, phase: "Compras", progress: 42, daysRemaining: 28, responsible: "Tainara", costBudget: 198000, costReal: 89000, marginBudget: 36.5, marginReal: 34.1, ncOpen: 1, rework: 0, blockers: 0, scopeChanges: 1, nextHandoff: "Compras > Producao", nextHandoffDays: 8, topRisks: ["Lead time fornecedor", "1 NC aberta"] },
  { id: "3", code: "PKT-047", client: "Casa Pinheiros", location: "Pinheiros", type: "rev", typeLabel: "Rev. + Deck", value: "R$ 142k", valueNum: 142000, riskScore: 52, riskTrend: -8, phase: "Projeto", progress: 18, daysRemaining: 45, responsible: "Tainara", costBudget: 92000, costReal: 18000, marginBudget: 35.2, marginReal: 35.2, ncOpen: 0, rework: 0, blockers: 1, scopeChanges: 3, nextHandoff: "Projetos > Compras", nextHandoffDays: 12, topRisks: ["Gate Freeze BLOQUEADO", "3 mudancas de escopo"] },
  { id: "4", code: "PKT-048", client: "Arq. Marina Luz", location: "Vila Madalena", type: "rev", typeLabel: "Piso + Forro", value: "R$ 228k", valueNum: 228000, riskScore: 81, riskTrend: 0, phase: "Projeto", progress: 12, daysRemaining: 52, responsible: "Tainara", costBudget: 148000, costReal: 12000, marginBudget: 35.1, marginReal: 35.1, ncOpen: 0, rework: 0, blockers: 0, scopeChanges: 0, nextHandoff: "Projetos > Compras", nextHandoffDays: 18, topRisks: ["Fase inicial"] },
  { id: "5", code: "PKT-050", client: "Familia Costa Lima", location: "Higienopolis", type: "marc", typeLabel: "Marcenaria", value: "R$ 290k", valueNum: 290000, riskScore: 68, riskTrend: -5, phase: "Fabrica", progress: 55, daysRemaining: 22, responsible: "Germano", costBudget: 195000, costReal: 118000, marginBudget: 32.8, marginReal: 28.9, ncOpen: 2, rework: 4, blockers: 0, scopeChanges: 1, nextHandoff: "Producao > Logistica", nextHandoffDays: 10, topRisks: ["QA: 4 pecas pendentes", "2 NCs abertas"] },
  { id: "6", code: "PKT-051", client: "Studio AR Design", location: "Jardins", type: "marc", typeLabel: "Marcenaria", value: "R$ 178k", valueNum: 178000, riskScore: 45, riskTrend: -12, phase: "Projeto", progress: 25, daysRemaining: 38, responsible: "Germano", costBudget: 118000, costReal: 32000, marginBudget: 33.7, marginReal: 33.7, ncOpen: 0, rework: 0, blockers: 1, scopeChanges: 2, nextHandoff: "Projetos > Compras", nextHandoffDays: 15, topRisks: ["Freeze BLOQUEADO", "Compatibilizacao pendente"] },
  { id: "7", code: "PKT-053", client: "Res. Faria Lima", location: "Itaim Bibi", type: "rev", typeLabel: "Revestimentos", value: "R$ 398k", valueNum: 398000, riskScore: 74, riskTrend: -2, phase: "Liberacao", progress: 65, daysRemaining: 15, responsible: "Talita", costBudget: 252000, costReal: 172000, marginBudget: 36.7, marginReal: 33.2, ncOpen: 1, rework: 3, blockers: 0, scopeChanges: 0, nextHandoff: "Logistica > Obras", nextHandoffDays: 3, topRisks: ["Vistoria umidade pendente", "1 NC aberta"] },
];

export interface DeptData {
  name: string;
  score: string;
  slaPct: number;
  handoffOk: number;
  blocked: number;
  rework: number;
  backlog: number;
  checklist: number;
  trend: string;
}

export const deptData: DeptData[] = [
  { name: "Comercial", score: "A", slaPct: 96, handoffOk: 98, blocked: 0, rework: 0, backlog: 1, checklist: 95, trend: "estavel" },
  { name: "Projetos", score: "C", slaPct: 72, handoffOk: 68, blocked: 2, rework: 3, backlog: 4, checklist: 78, trend: "caindo" },
  { name: "Compras", score: "B", slaPct: 85, handoffOk: 82, blocked: 1, rework: 1, backlog: 3, checklist: 88, trend: "estavel" },
  { name: "Financeiro", score: "A", slaPct: 94, handoffOk: 96, blocked: 0, rework: 0, backlog: 0, checklist: 97, trend: "subindo" },
  { name: "Producao", score: "C", slaPct: 78, handoffOk: 74, blocked: 1, rework: 4, backlog: 2, checklist: 81, trend: "caindo" },
  { name: "Logistica", score: "B", slaPct: 88, handoffOk: 85, blocked: 0, rework: 1, backlog: 1, checklist: 90, trend: "estavel" },
  { name: "Obras", score: "B", slaPct: 86, handoffOk: 84, blocked: 0, rework: 2, backlog: 2, checklist: 85, trend: "subindo" },
  { name: "Relacionamento", score: "B", slaPct: 82, handoffOk: 88, blocked: 0, rework: 0, backlog: 1, checklist: 86, trend: "estavel" },
  { name: "PMO", score: "A", slaPct: 95, handoffOk: 97, blocked: 0, rework: 0, backlog: 0, checklist: 98, trend: "subindo" },
  { name: "Marketing", score: "A", slaPct: 92, handoffOk: 94, blocked: 0, rework: 0, backlog: 0, checklist: 93, trend: "estavel" },
];

export const priorities = [
  { rank: 1, title: "Destravar Freeze PKT-047", obra: "PKT-047", reason: "Gate bloqueado ha 12 dias, score 52", responsible: "Tainara", deadline: "Hoje 17h", action: "Ligar para cliente e fechar aprovacao" },
  { rank: 2, title: "Compatibilizar PKT-051", obra: "PKT-051", reason: "Score 45 e caindo, freeze bloqueado", responsible: "Germano", deadline: "Amanha 12h", action: "Reunir com engenheiro civil" },
  { rank: 3, title: "Vistoria umidade PKT-053", obra: "PKT-053", reason: "Inicio em 5 dias, vistoria pendente", responsible: "Fiscal", deadline: "Amanha 9h", action: "Agendar vistoria para amanha" },
  { rank: 4, title: "QA fabrica PKT-050", obra: "PKT-050", reason: "4 pecas sem inspecao, margem caindo", responsible: "Germano", deadline: "Hoje 18h", action: "Inspecionar 4 pecas restantes" },
  { rank: 5, title: "Fechar aceite PKT-042", obra: "PKT-042", reason: "Checklist 92%, entrega em 5 dias", responsible: "Talita", deadline: "Quinta 17h", action: "Completar 3 itens e agendar aceite" },
  { rank: 6, title: "Resolver NC PKT-050", obra: "PKT-050", reason: "2 NCs abertas, margem caindo", responsible: "Germano", deadline: "Sexta 12h", action: "Investigar causa raiz" },
  { rank: 7, title: "Confirmar fornecedor PKT-045", obra: "PKT-045", reason: "Ultimo fornecedor sem confirmacao", responsible: "Ailton", deadline: "Amanha 15h", action: "Cobrar fornecedor e plano B" },
  { rank: 8, title: "NC aberta PKT-053", obra: "PKT-053", reason: "1 NC sem resolucao ha 5 dias", responsible: "Talita", deadline: "Quarta 17h", action: "Avaliar NC com fiscal" },
  { rank: 9, title: "Mudanca escopo PKT-045", obra: "PKT-045", reason: "Escopo alterado, lista desatualizada", responsible: "Tainara", deadline: "Quinta 12h", action: "Atualizar projeto e revalidar" },
  { rank: 10, title: "Report semanal atrasado", obra: "Geral", reason: "PMO nao entregou report", responsible: "PMO", deadline: "Hoje 10h", action: "Consolidar dados e enviar" },
];

export const lossesData = [
  { type: "Retrabalho fabril", obra: "PKT-050", value: 8200, cause: "Ficha tecnica desatualizada", fix: "Travar producao sem versao aprovada", owner: "Germano" },
  { type: "Frete extra", obra: "PKT-053", value: 3800, cause: "Material esquecido na 1a entrega", fix: "Conferencia 100% com foto", owner: "Ailton" },
  { type: "Urgencia compra", obra: "PKT-045", value: 2900, cause: "Lead time nao previsto", fix: "Buffer 20% no lead time", owner: "Ailton" },
  { type: "Improdutividade", obra: "PKT-053", value: 4500, cause: "Equipe esperando frente 2 dias", fix: "Gate liberacao D-2 obrigatorio", owner: "Dani" },
  { type: "Reentrega", obra: "PKT-045", value: 1200, cause: "Peca trocada", fix: "QR code por peca", owner: "Ailton" },
];

export const founderDecisions = [
  { id: 1, title: "Antecipar producao PKT-053 vs PKT-050", context: "PKT-053 R$ 398k com prazo apertado, PKT-050 margem impactada", rec: "Aprovar remanejamento, compensar PKT-050 com turno extra", ifNow: "Entrega PKT-053 no prazo", ifLater: "PKT-053 atrasa, frete extra" },
  { id: 2, title: "Desconto 12% Studio MV (PKT-045)", context: "Cliente pediu desconto apos mudanca de escopo", rec: "Negociar 8% maximo com garantia estendida", ifNow: "Fecha contrato esta semana", ifLater: "Cliente busca concorrente" },
  { id: 3, title: "Contratar 2o fiscal de obras", context: "1 fiscal para 7 obras, gargalo em vistorias", rec: "Contratacao temporaria 3 meses", ifNow: "Vistoria PKT-053 amanha", ifLater: "Gargalo continua, 3 obras em risco" },
  { id: 4, title: "War Room PKT-051", context: "Score 45, bloqueado ha 2 semanas", rec: "War Room imediata com Germano + eng. civil", ifNow: "Destrava, score 65+ em 2 semanas", ifLater: "Score cai <40, custo reputacional" },
  { id: 5, title: "Bonus por produtividade", context: "Equipes sem incentivo para eficiencia", rec: "Piloto com 2 equipes por 60 dias", ifNow: "Equipes motivadas, produtividade sobe", ifLater: "Produtividade estagna" },
];

export const handoffsData = [
  { id: "H1", from: "Comercial", to: "Projetos", obra: "PKT-042", status: "ok", slaLeft: 0 },
  { id: "H2", from: "Projetos", to: "Compras", obra: "PKT-045", status: "ok", slaLeft: 0 },
  { id: "H3", from: "Compras", to: "Producao", obra: "PKT-050", status: "ok", slaLeft: 0 },
  { id: "H4", from: "Producao", to: "Logistica", obra: "PKT-050", status: "pendente", slaLeft: 5 },
  { id: "H5", from: "Logistica", to: "Obras", obra: "PKT-053", status: "pendente", slaLeft: 2 },
  { id: "H6", from: "Obras", to: "Relacionamento", obra: "PKT-042", status: "pendente", slaLeft: 3 },
  { id: "H7", from: "Comercial", to: "Projetos", obra: "PKT-047", status: "vencido", slaLeft: -12 },
  { id: "H8", from: "Comercial", to: "Projetos", obra: "PKT-051", status: "vencido", slaLeft: -8 },
];

export const alertsRed = [
  { obra: "PKT-051", msg: "Score 45 - War Room automatica. Freeze bloqueado ha 2 semanas.", responsible: "Germano" },
  { obra: "PKT-047", msg: "Score 52 - Gate Freeze bloqueado ha 12 dias.", responsible: "Tainara" },
];

export const alertsYellow = [
  { obra: "PKT-053", msg: "Vistoria de umidade nao realizada, inicio em 5 dias.", responsible: "Fiscal" },
  { obra: "PKT-050", msg: "QA Fabrica pendente: 4 de 12 pecas sem inspecao.", responsible: "Germano" },
  { obra: "PKT-045", msg: "Ultimo fornecedor sem confirmacao.", responsible: "Ailton" },
  { obra: "PKT-042", msg: "Checklist de entrega 92%, 3 itens pendentes.", responsible: "Talita" },
];

export const alertsBlue = [
  { obra: "Geral", msg: "Requisicoes voltando de Compras por falta de spec. 11 ocorrencias.", responsible: "PMO" },
  { obra: "Geral", msg: "Equipe Alpha com 28% acima da media - candidata a bonus.", responsible: "Dani" },
];

export const trendMonths = ["Set", "Out", "Nov", "Dez", "Jan", "Fev"];
export const trendData = trendMonths.map((m, i) => ({
  name: m,
  perdas: [42, 38, 35, 28, 24, 20.6][i],
  margem: [28, 30, 31, 32, 33, 34.2][i],
  produtividade: [62, 65, 68, 72, 75, 78][i],
}));

export function getRiskColor(score: number) {
  if (score >= 90) return GREEN;
  if (score >= 75) return YELLOW;
  if (score >= 60) return ORANGE;
  return RED;
}
export function getRiskBg(score: number) {
  if (score >= 90) return GREEN_DIM;
  if (score >= 75) return YELLOW_DIM;
  if (score >= 60) return ORANGE_DIM;
  return RED_DIM;
}
export function getRiskLabel(score: number) {
  if (score >= 90) return "Saudavel";
  if (score >= 75) return "Atencao";
  if (score >= 60) return "Risco";
  return "Critico";
}
export function getScoreColor(s: string) {
  if (s === "A") return GREEN;
  if (s === "B") return BLUE;
  if (s === "C") return YELLOW;
  return RED;
}
export function getScoreBg(s: string) {
  if (s === "A") return GREEN_DIM;
  if (s === "B") return BLUE_DIM;
  if (s === "C") return YELLOW_DIM;
  return RED_DIM;
}