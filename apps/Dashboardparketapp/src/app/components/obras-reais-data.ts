/* ═══════════════════════════════════════════════════════════════
   OBRAS REAIS PARKET — Dados estruturados do cronograma real
   Fonte: obras-cronograma.json + obra-cronograma-relatorio.md + marcenaria-instalacao-obras.md
   60+ obras reais · Marcenaria + Instalação · Status detalhado
   ═══════════════════════════════════════════════════════════════ */

export interface ObraReal {
  id: string;
  cliente: string;
  localizacao: string;
  regiao: "SP" | "RJ" | "BSB" | "MG" | "BA" | "MT" | "GO" | "RS" | "PR" | "PY" | "OTHER";
  servicos: string[];
  equipes: { nome: string; tipo: "marcenaria" | "instalacao"; servico: string }[];
  fiscais: string[];
  status: "em_execucao" | "mobilizacao" | "acabamento" | "travado" | "aguardando" | "finalizado";
  dataFinalizacao?: string;
  valorEstimado: string;
  progresso: number;
  gate: number;
  prioridade: "alta" | "media" | "baixa";
  obs?: string;
}

function regionFromLoc(loc: string | null): ObraReal["regiao"] {
  if (!loc) return "SP";
  const l = loc.toUpperCase();
  if (l.includes("BRASILIA") || l.includes("CEILANDIA")) return "BSB";
  if (l.includes("RIO DE JANEIRO")) return "RJ";
  if (l.includes("NOVA LIMA")) return "MG";
  if (l.includes("CUIABA")) return "MT";
  if (l.includes("SALVADOR") || l.includes("IRECE")) return "BA";
  if (l.includes("GOIANIA") || l.includes("JATAI")) return "GO";
  if (l.includes("PORTO ALEGRE")) return "RS";
  if (l.includes("PARAGLIAY") || l.includes("PARAGUAY")) return "PY";
  return "SP";
}

/* ═══ Obras consolidadas do cronograma real ═══ */
export const OBRAS_REAIS: ObraReal[] = [
  {
    id: "OBR-001", cliente: "PEDRO CAMPOS", localizacao: "Brasília - DF", regiao: "BSB",
    servicos: ["Beiral", "Aditivo Cavas", "Deck/Pinos", "Rooftop", "Reparo Piso"],
    equipes: [
      { nome: "JAILTON E IGOR", tipo: "marcenaria", servico: "Beiral" },
      { nome: "CARLOS E RAY", tipo: "marcenaria", servico: "Beiral" },
      { nome: "RODNEY E RAY FLAVIANO", tipo: "marcenaria", servico: "Aditivo Cavas" },
      { nome: "REINALDO 2", tipo: "instalacao", servico: "Reparo Piso" },
    ],
    fiscais: ["REINALDO"],
    status: "em_execucao", dataFinalizacao: "13/02/2026",
    valorEstimado: "R$ 385k", progresso: 72, gate: 3, prioridade: "alta",
    obs: "Obra grande em Brasília — múltiplas frentes"
  },
  {
    id: "OBR-002", cliente: "MARIA E MEL", localizacao: "Nova Lima - MG", regiao: "MG",
    servicos: ["Marcenaria", "Piso", "Forro", "Deck"],
    equipes: [
      { nome: "VINY E WILSON", tipo: "marcenaria", servico: "Marcenaria" },
      { nome: "RAMON E KAIQUE", tipo: "marcenaria", servico: "Marcenaria" },
      { nome: "GEOMARIO (4)", tipo: "instalacao", servico: "Piso Forro/Deck" },
    ],
    fiscais: ["DAVI"],
    status: "em_execucao", dataFinalizacao: "20/02/2026",
    valorEstimado: "R$ 290k", progresso: 65, gate: 3, prioridade: "alta",
    obs: "Solicitação fita e deck"
  },
  {
    id: "OBR-003", cliente: "INACIO", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Marcenaria"],
    equipes: [
      { nome: "JOSEMARIO E ALTAIR", tipo: "marcenaria", servico: "Marcenaria" },
      { nome: "MOISES E ALESSANDRO", tipo: "marcenaria", servico: "Marcenaria" },
    ],
    fiscais: [],
    status: "em_execucao", dataFinalizacao: "06/03/2026",
    valorEstimado: "R$ 210k", progresso: 45, gate: 3, prioridade: "media"
  },
  {
    id: "OBR-004", cliente: "LEANDRO SILVA", localizacao: "São Paulo / Riviera - SP", regiao: "SP",
    servicos: ["Acabamento", "Rodateto"],
    equipes: [
      { nome: "LUIZ E LOURIVAL", tipo: "marcenaria", servico: "Acabamento" },
      { nome: "FERNANDO E SILVIO", tipo: "marcenaria", servico: "Rodateto" },
      { nome: "LUIS NOVO E VALDEDY", tipo: "marcenaria", servico: "Acabamento" },
    ],
    fiscais: [],
    status: "acabamento",
    valorEstimado: "R$ 175k", progresso: 85, gate: 4, prioridade: "media"
  },
  {
    id: "OBR-005", cliente: "AUREA ITAIM", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Marcenaria", "Portas", "Escada"],
    equipes: [
      { nome: "ANDERSON E BRUNO", tipo: "marcenaria", servico: "Marcenaria" },
      { nome: "EMERSON E ATILA", tipo: "marcenaria", servico: "Portas" },
      { nome: "GEADSON E WALISSON", tipo: "marcenaria", servico: "Escada" },
    ],
    fiscais: [],
    status: "em_execucao",
    valorEstimado: "R$ 320k", progresso: 55, gate: 3, prioridade: "alta"
  },
  {
    id: "OBR-006", cliente: "PRISCILA DEAR", localizacao: "Riviera / São Paulo - SP", regiao: "SP",
    servicos: ["Reparo-Bandeira", "Acabamento"],
    equipes: [
      { nome: "ANDERSON E BRUNO", tipo: "marcenaria", servico: "Reparo-Bandeira" },
      { nome: "LUIZ E LOURIVAL", tipo: "marcenaria", servico: "Acabamento" },
    ],
    fiscais: [],
    status: "em_execucao",
    valorEstimado: "R$ 95k", progresso: 40, gate: 3, prioridade: "media",
    obs: "Custo — reparo e acabamento"
  },
  {
    id: "OBR-007", cliente: "CASA FLORAES", localizacao: "Cuiabá - MT / Brasília - DF", regiao: "MT",
    servicos: ["Forro Lâmina", "Piso"],
    equipes: [
      { nome: "EDUARDO E LUCID", tipo: "marcenaria", servico: "Forro Lâmina" },
      { nome: "LUCAS E AJUDANTE", tipo: "marcenaria", servico: "Forro Lâmina" },
      { nome: "DAVID E AJUDANTE", tipo: "marcenaria", servico: "Forro Lâmina" },
      { nome: "REINALDO 3", tipo: "instalacao", servico: "Piso" },
    ],
    fiscais: ["REINALDO"],
    status: "em_execucao", dataFinalizacao: "20/02/2026",
    valorEstimado: "R$ 260k", progresso: 50, gate: 3, prioridade: "alta",
    obs: "Custo — múltiplas equipes em forro"
  },
  {
    id: "OBR-008", cliente: "FELIPE ALMEIDA", localizacao: "Baronesa - SP", regiao: "SP",
    servicos: ["Pergolado", "Forro Projeto"],
    equipes: [
      { nome: "ALAN (2)", tipo: "instalacao", servico: "Pergolado" },
      { nome: "BEDEU (5)", tipo: "instalacao", servico: "Forro Projeto" },
    ],
    fiscais: ["ALVARO"],
    status: "em_execucao", dataFinalizacao: "06/03/2026",
    valorEstimado: "R$ 340k", progresso: 35, gate: 3, prioridade: "alta",
    obs: "Diário"
  },
  {
    id: "OBR-009", cliente: "LUIZ ANDRÉ", localizacao: "Guarujá / São Paulo - SP", regiao: "SP",
    servicos: ["Acabamento", "Reparo Piso", "Raspagem Deck"],
    equipes: [
      { nome: "VANDERSON, KAUAN E SIDNEY", tipo: "instalacao", servico: "Acabamento" },
      { nome: "ALEXANDRE E RAFAEL", tipo: "instalacao", servico: "Reparo Piso" },
      { nome: "JUAN E GEOVANI", tipo: "instalacao", servico: "Reparo Piso" },
      { nome: "ROGERIO", tipo: "instalacao", servico: "Raspagem Deck" },
    ],
    fiscais: ["ALVARO"],
    status: "em_execucao",
    valorEstimado: "R$ 220k", progresso: 60, gate: 3, prioridade: "media"
  },
  {
    id: "OBR-010", cliente: "FERNANDO ARAGON", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Acabamento"],
    equipes: [{ nome: "VANDERSON, KAUAN E SIDNEY", tipo: "instalacao", servico: "Acabamento" }],
    fiscais: ["ALVARO"],
    status: "acabamento", dataFinalizacao: "17/02/2026",
    valorEstimado: "R$ 155k", progresso: 90, gate: 4, prioridade: "baixa"
  },
  {
    id: "OBR-011", cliente: "ROSANA BRAIDO", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Acabamento"],
    equipes: [{ nome: "VANDERSON, KAUAN E SIDNEY", tipo: "instalacao", servico: "Acabamento" }],
    fiscais: ["ALVARO"],
    status: "acabamento", dataFinalizacao: "17/02/2026",
    valorEstimado: "R$ 130k", progresso: 88, gate: 4, prioridade: "baixa"
  },
  {
    id: "OBR-012", cliente: "THIAGO MIRANDA", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Revestimento Suíte"],
    equipes: [{ nome: "ISAQUE", tipo: "instalacao", servico: "Revestimento Suíte" }],
    fiscais: ["ALVARO"],
    status: "em_execucao", dataFinalizacao: "13/03/2026",
    valorEstimado: "R$ 185k", progresso: 30, gate: 3, prioridade: "media"
  },
  {
    id: "OBR-013", cliente: "RUBENS FUGISACK", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Instalação Piso"],
    equipes: [{ nome: "DIEGO JAISON", tipo: "instalacao", servico: "Instalação Piso" }],
    fiscais: ["CRISTIANO"],
    status: "em_execucao",
    valorEstimado: "R$ 145k", progresso: 25, gate: 3, prioridade: "media"
  },
  {
    id: "OBR-014", cliente: "RAFAELA DIMASI", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Forro"],
    equipes: [{ nome: "TRAVADO", tipo: "instalacao", servico: "Forro" }],
    fiscais: ["CRISTIANO"],
    status: "travado",
    valorEstimado: "R$ 110k", progresso: 10, gate: 2, prioridade: "media"
  },
  {
    id: "OBR-015", cliente: "BRUNO SAID", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Fechamento Painel"],
    equipes: [
      { nome: "BRUNO SAID", tipo: "marcenaria", servico: "Marcenaria" },
      { nome: "VAGNER E RAFAEL", tipo: "instalacao", servico: "Fechamento Painel" },
    ],
    fiscais: ["ALVARO"],
    status: "em_execucao",
    valorEstimado: "R$ 120k", progresso: 45, gate: 3, prioridade: "media"
  },
  {
    id: "OBR-016", cliente: "DIOGO", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Deck 8m²"],
    equipes: [{ nome: "VAGNER E RAFAEL", tipo: "instalacao", servico: "8m² de Deck" }],
    fiscais: ["VAGNER"],
    status: "em_execucao",
    valorEstimado: "R$ 35k", progresso: 60, gate: 3, prioridade: "baixa"
  },
  {
    id: "OBR-017", cliente: "RUBEN FEFFER", localizacao: "Guarujá - SP", regiao: "SP",
    servicos: ["Deck"],
    equipes: [{ nome: "VAGNER E RAFAEL", tipo: "instalacao", servico: "Deck" }],
    fiscais: ["VAGNER"],
    status: "aguardando",
    valorEstimado: "R$ 78k", progresso: 0, gate: 2, prioridade: "media"
  },
  {
    id: "OBR-018", cliente: "DAVIDSON", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Remoção Forro"],
    equipes: [{ nome: "VAGNER E RAFAEL", tipo: "instalacao", servico: "Remoção Forro" }],
    fiscais: ["VAGNER"],
    status: "em_execucao",
    valorEstimado: "R$ 42k", progresso: 70, gate: 3, prioridade: "baixa"
  },
  {
    id: "OBR-019", cliente: "MARISTELA", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Acabamento Escada"],
    equipes: [{ nome: "VAGNER E RAFAEL", tipo: "instalacao", servico: "Acabamento Escada" }],
    fiscais: ["VAGNER"],
    status: "em_execucao",
    valorEstimado: "R$ 55k", progresso: 50, gate: 3, prioridade: "media"
  },
  {
    id: "OBR-020", cliente: "RICARDO ERNESTO", localizacao: "Porto Alegre - RS", regiao: "RS",
    servicos: ["Reparo Piso"],
    equipes: [{ nome: "CARLÃO E JOCEVANIO", tipo: "instalacao", servico: "Reparo Piso" }],
    fiscais: ["CARLOS"],
    status: "em_execucao",
    valorEstimado: "R$ 65k", progresso: 40, gate: 3, prioridade: "media"
  },
  {
    id: "OBR-021", cliente: "ROBERTO BLOES", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Forro"],
    equipes: [{ nome: "ISMAEL", tipo: "instalacao", servico: "Forro" }],
    fiscais: ["DAVI"],
    status: "em_execucao", dataFinalizacao: "24/02/2026",
    valorEstimado: "R$ 92k", progresso: 75, gate: 3, prioridade: "media"
  },
  {
    id: "OBR-022", cliente: "RICARDO FANIN", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Piso"],
    equipes: [{ nome: "HENRIQUE-DANY(2)", tipo: "instalacao", servico: "Piso" }],
    fiscais: ["CRISTIANO"],
    status: "finalizado", dataFinalizacao: "13/02/2026",
    valorEstimado: "R$ 125k", progresso: 100, gate: 5, prioridade: "baixa"
  },
  {
    id: "OBR-023", cliente: "SANTA ELISA", localizacao: "Holambra / São Paulo - SP", regiao: "SP",
    servicos: ["Vigas e Piso", "Marcenaria"],
    equipes: [
      { nome: "HENRIQUE (2)", tipo: "instalacao", servico: "Vigas e Piso" },
      { nome: "MARCO ANTONIO", tipo: "marcenaria", servico: "Marcenaria" },
    ],
    fiscais: ["ALVARO"],
    status: "em_execucao", dataFinalizacao: "13/02/2026",
    valorEstimado: "R$ 195k", progresso: 55, gate: 3, prioridade: "media",
    obs: "Diário — Custo"
  },
  {
    id: "OBR-024", cliente: "BERNADO COUTINHO", localizacao: "Rio de Janeiro - RJ", regiao: "RJ",
    servicos: ["Forro"],
    equipes: [{ nome: "GERALDO (3)", tipo: "instalacao", servico: "Forro" }],
    fiscais: ["DAVI"],
    status: "em_execucao", dataFinalizacao: "27/03/2026",
    valorEstimado: "R$ 180k", progresso: 20, gate: 3, prioridade: "media"
  },
  {
    id: "OBR-025", cliente: "LUANA BASTOS", localizacao: "Rio de Janeiro - RJ", regiao: "RJ",
    servicos: ["Forro"],
    equipes: [{ nome: "REGIS (3)", tipo: "instalacao", servico: "Forro" }],
    fiscais: ["DAVI"],
    status: "mobilizacao",
    valorEstimado: "R$ 150k", progresso: 5, gate: 2, prioridade: "media"
  },
  {
    id: "OBR-026", cliente: "BRADESCO IRECÊ/SALVADOR", localizacao: "Irecê - BA", regiao: "BA",
    servicos: ["Instalação Taco"],
    equipes: [{ nome: "DANY(3)", tipo: "instalacao", servico: "Instalação Taco" }],
    fiscais: [],
    status: "em_execucao", dataFinalizacao: "27/03/2026",
    valorEstimado: "R$ 88k", progresso: 30, gate: 3, prioridade: "media",
    obs: "Diário — Projeto corporativo"
  },
  {
    id: "OBR-027", cliente: "BRADESCO CEILÂNDIA", localizacao: "Cuiabá - MT", regiao: "MT",
    servicos: ["Instalação Taco"],
    equipes: [{ nome: "DANY(3)", tipo: "instalacao", servico: "Instalação Taco" }],
    fiscais: [],
    status: "aguardando",
    valorEstimado: "R$ 75k", progresso: 0, gate: 2, prioridade: "media"
  },
  {
    id: "OBR-028", cliente: "JORBEL", localizacao: "Paraguay", regiao: "PY",
    servicos: ["Piso", "Forro", "Deck"],
    equipes: [{ nome: "ADEMIR 4", tipo: "instalacao", servico: "Piso-Forro e Deck" }],
    fiscais: ["REINALDO"],
    status: "em_execucao", dataFinalizacao: "30/04/2026",
    valorEstimado: "R$ 420k", progresso: 15, gate: 3, prioridade: "alta",
    obs: "Projeto internacional"
  },
  {
    id: "OBR-029", cliente: "ILKA", localizacao: "Brasília - DF", regiao: "BSB",
    servicos: ["Estrutura"],
    equipes: [{ nome: "REINALDO 3", tipo: "instalacao", servico: "Estrutura" }],
    fiscais: ["REINALDO"],
    status: "em_execucao", dataFinalizacao: "20/03/2026",
    valorEstimado: "R$ 165k", progresso: 30, gate: 3, prioridade: "media"
  },
  {
    id: "OBR-030", cliente: "GABRIEL LACHER", localizacao: "Brasília - DF", regiao: "BSB",
    servicos: ["Piso e Painel", "Trilho/Brises"],
    equipes: [
      { nome: "TRAVADO", tipo: "instalacao", servico: "Piso e Painel" },
      { nome: "NIVALDO E VALDINEY", tipo: "marcenaria", servico: "Trilho" },
    ],
    fiscais: ["REINALDO"],
    status: "travado", dataFinalizacao: "13/03/2026",
    valorEstimado: "R$ 275k", progresso: 20, gate: 2, prioridade: "alta",
    obs: "Travado — aguardando liberação"
  },
  {
    id: "OBR-031", cliente: "ANA CRISTINA", localizacao: "Jataí - GO", regiao: "GO",
    servicos: ["Revestimento Forro"],
    equipes: [{ nome: "TRAVADO", tipo: "instalacao", servico: "Revestimento Forro" }],
    fiscais: ["REINALDO"],
    status: "travado", dataFinalizacao: "13/03/2026",
    valorEstimado: "R$ 110k", progresso: 5, gate: 2, prioridade: "media"
  },
  {
    id: "OBR-032", cliente: "PEDRO RAMOS", localizacao: "Brasília - DF", regiao: "BSB",
    servicos: ["Estrutura de Forro"],
    equipes: [{ nome: "REINALDO 2", tipo: "instalacao", servico: "Estrutura de Forro" }],
    fiscais: ["REINALDO"],
    status: "mobilizacao",
    valorEstimado: "R$ 140k", progresso: 10, gate: 2, prioridade: "media"
  },
  {
    id: "OBR-033", cliente: "BRUNO LIMA", localizacao: "Salvador - BA", regiao: "BA",
    servicos: ["Reparo Deck"],
    equipes: [{ nome: "MATERIAL", tipo: "instalacao", servico: "Reparo Deck" }],
    fiscais: ["REINALDO"],
    status: "aguardando", dataFinalizacao: "13/03/2026",
    valorEstimado: "R$ 48k", progresso: 0, gate: 2, prioridade: "baixa",
    obs: "Aguardando material"
  },
  {
    id: "OBR-034", cliente: "FERNANDO E MARAÍSA", localizacao: "Goiânia - GO", regiao: "GO",
    servicos: ["Estrutura Painel"],
    equipes: [{ nome: "REINALDO 2", tipo: "instalacao", servico: "Estrutura Painel" }],
    fiscais: ["REINALDO"],
    status: "travado",
    valorEstimado: "R$ 195k", progresso: 0, gate: 2, prioridade: "media",
    obs: "TRAVADO"
  },
  {
    id: "OBR-035", cliente: "VALTER E RENATA", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Forro", "Lustração/Painel"],
    equipes: [
      { nome: "EDMILSON E RAMON", tipo: "marcenaria", servico: "Lustração" },
    ],
    fiscais: ["DAVI"],
    status: "aguardando",
    valorEstimado: "R$ 165k", progresso: 5, gate: 2, prioridade: "media"
  },
  {
    id: "OBR-036", cliente: "ANDRE GURGEL", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Forro 5° Andar"],
    equipes: [],
    fiscais: ["CRISTIANO"],
    status: "aguardando", dataFinalizacao: "13/02/2026",
    valorEstimado: "R$ 135k", progresso: 0, gate: 2, prioridade: "media"
  },
  {
    id: "OBR-037", cliente: "RAFAELA", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Cortineiro"],
    equipes: [{ nome: "EDY DEVSON", tipo: "marcenaria", servico: "Cortineiro" }],
    fiscais: [],
    status: "em_execucao",
    valorEstimado: "R$ 28k", progresso: 60, gate: 3, prioridade: "baixa"
  },
  {
    id: "OBR-038", cliente: "PAULO GOTIJO", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Aditivo"],
    equipes: [{ nome: "FERNANDO E SILVIO", tipo: "marcenaria", servico: "Aditivo" }],
    fiscais: [],
    status: "em_execucao",
    valorEstimado: "R$ 45k", progresso: 50, gate: 3, prioridade: "baixa"
  },
  {
    id: "OBR-039", cliente: "ELSON", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Forro"],
    equipes: [{ nome: "ROGERIO", tipo: "instalacao", servico: "Forro" }],
    fiscais: ["ALVARO"],
    status: "em_execucao",
    valorEstimado: "R$ 98k", progresso: 40, gate: 3, prioridade: "media"
  },
  {
    id: "OBR-040", cliente: "TRILHOS GABRIEL LACHER/BRISES", localizacao: "Brasília - DF", regiao: "BSB",
    servicos: ["Trilho"],
    equipes: [{ nome: "NIVALDO E VALDINEY", tipo: "marcenaria", servico: "Trilho" }],
    fiscais: [],
    status: "em_execucao", dataFinalizacao: "13/02/2026",
    valorEstimado: "R$ 85k", progresso: 70, gate: 3, prioridade: "media"
  },
  {
    id: "OBR-041", cliente: "BARRA F/PAINEL VALTER E RENATA", localizacao: "São Paulo - SP", regiao: "SP",
    servicos: ["Lustração"],
    equipes: [{ nome: "EDMILSON E RAMON", tipo: "marcenaria", servico: "Lustração" }],
    fiscais: [],
    status: "em_execucao",
    valorEstimado: "R$ 38k", progresso: 55, gate: 3, prioridade: "baixa"
  },
];

/* ═══ Helpers de agregação ═══ */
export function getObrasByStatus(status: ObraReal["status"]) {
  return OBRAS_REAIS.filter(o => o.status === status);
}

export function getObrasByRegiao(regiao: ObraReal["regiao"]) {
  return OBRAS_REAIS.filter(o => o.regiao === regiao);
}

export function getObrasByPrioridade(prioridade: ObraReal["prioridade"]) {
  return OBRAS_REAIS.filter(o => o.prioridade === prioridade);
}

export function getTotalEquipes(): number {
  const uniqueTeams = new Set<string>();
  OBRAS_REAIS.forEach(o => o.equipes.forEach(e => uniqueTeams.add(e.nome)));
  return uniqueTeams.size;
}

export function getTotalValorEstimado(): number {
  return OBRAS_REAIS.reduce((acc, o) => {
    const num = parseFloat(o.valorEstimado.replace(/[^0-9.]/g, "")) * 1000;
    return acc + num;
  }, 0);
}

export function getProgressoMedio(): number {
  const active = OBRAS_REAIS.filter(o => o.status !== "finalizado" && o.status !== "aguardando");
  if (active.length === 0) return 0;
  return Math.round(active.reduce((acc, o) => acc + o.progresso, 0) / active.length);
}

export function getObrasByFiscal(fiscal: string) {
  return OBRAS_REAIS.filter(o => o.fiscais.some(f => f.toUpperCase() === fiscal.toUpperCase()));
}

/* Status summary */
export function getStatusSummary() {
  return {
    em_execucao: OBRAS_REAIS.filter(o => o.status === "em_execucao").length,
    mobilizacao: OBRAS_REAIS.filter(o => o.status === "mobilizacao").length,
    acabamento: OBRAS_REAIS.filter(o => o.status === "acabamento").length,
    travado: OBRAS_REAIS.filter(o => o.status === "travado").length,
    aguardando: OBRAS_REAIS.filter(o => o.status === "aguardando").length,
    finalizado: OBRAS_REAIS.filter(o => o.status === "finalizado").length,
  };
}

/* Regiao summary */
export function getRegiaoSummary() {
  const map: Record<string, number> = {};
  OBRAS_REAIS.forEach(o => { map[o.regiao] = (map[o.regiao] || 0) + 1; });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([regiao, count]) => ({ regiao, count }));
}

export const REGIAO_LABELS: Record<string, string> = {
  SP: "São Paulo", RJ: "Rio de Janeiro", BSB: "Brasília", MG: "Minas Gerais",
  BA: "Bahia", MT: "Mato Grosso", GO: "Goiás", RS: "Rio Grande do Sul",
  PR: "Paraná", PY: "Paraguay", OTHER: "Outros",
};

export const STATUS_LABELS: Record<string, string> = {
  em_execucao: "Em Execução", mobilizacao: "Mobilização", acabamento: "Acabamento",
  travado: "Travado", aguardando: "Aguardando", finalizado: "Finalizado",
};