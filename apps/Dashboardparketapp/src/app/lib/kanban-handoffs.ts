/** Regras de passagem de bastão entre departamentos.
 *  isPrimary=true  → o card MOVE para o novo dept (single-card flow — sem duplicata).
 *  isPrimary=false → um card leve é criado no dept paralelo (fiscal, pmo, etc.).
 *  gate → número do gate que este handoff avança o card. */
export interface HandoffRule {
  fromDept: string;
  fromColumn: string;
  toDept: string;
  toDeptLabel: string;
  toColumn: string;
  toColumnLabel: string;
  isPrimary: boolean;
  gate: number;
}

export const HANDOFF_RULES: HandoffRule[] = [
  // Comercial → Projetos  (gate 1)
  { fromDept: "comercial", fromColumn: "handoff",         toDept: "projetos",      toDeptLabel: "Projetos",    toColumn: "briefing",    toColumnLabel: "Briefing Recebido",   isPrimary: true,  gate: 1 },
  { fromDept: "comercial", fromColumn: "fechamento",      toDept: "financeiro",    toDeptLabel: "Financeiro",  toColumn: "contrato",    toColumnLabel: "Contrato Assinado",   isPrimary: true,  gate: 1 },

  // Projetos → Aprovado: dispara handoffs simultâneos para Produção + Produtividade + Fiscal + Compras  (gate 2)
  { fromDept: "projetos",  fromColumn: "aprovado",        toDept: "producao",      toDeptLabel: "Produção",       toColumn: "a-iniciar",      toColumnLabel: "A Iniciar",            isPrimary: false, gate: 2 },
  { fromDept: "projetos",  fromColumn: "aprovado",        toDept: "produtividade", toDeptLabel: "PMO/Produtividade", toColumn: "entrada",     toColumnLabel: "Entrada",              isPrimary: false, gate: 2 },
  { fromDept: "projetos",  fromColumn: "aprovado",        toDept: "fiscal",        toDeptLabel: "Fiscal",         toColumn: "backlog",        toColumnLabel: "Backlog / Entrada",    isPrimary: false, gate: 2 },
  { fromDept: "projetos",  fromColumn: "aprovado",        toDept: "compras",       toDeptLabel: "Compras",        toColumn: "entrada",        toColumnLabel: "Entrada",              isPrimary: false, gate: 2 },

  // Projetos → Compras (primary) + Fiscal (secondary)  (gate 2 — fluxo legado BOM)
  { fromDept: "projetos",  fromColumn: "handoff-compras", toDept: "compras",       toDeptLabel: "Compras",     toColumn: "requisicao",  toColumnLabel: "Requisição Recebida", isPrimary: true,  gate: 2 },
  { fromDept: "projetos",  fromColumn: "handoff-compras", toDept: "fiscal",        toDeptLabel: "Fiscal",      toColumn: "agendada",    toColumnLabel: "Agendada",            isPrimary: false, gate: 2 },
  { fromDept: "projetos",  fromColumn: "bom",             toDept: "compras",       toDeptLabel: "Compras",     toColumn: "requisicao",  toColumnLabel: "Requisição Recebida", isPrimary: true,  gate: 2 },

  // Compras → Produção  (gate 3)
  { fromDept: "compras",   fromColumn: "handoff-prod",    toDept: "producao",      toDeptLabel: "Produção",    toColumn: "a-iniciar",   toColumnLabel: "A Iniciar",           isPrimary: true,  gate: 3 },
  { fromDept: "compras",   fromColumn: "recebido",        toDept: "producao",      toDeptLabel: "Produção",    toColumn: "a-iniciar",   toColumnLabel: "A Iniciar",           isPrimary: true,  gate: 3 },

  // Produção → Logística  (gate 4)
  { fromDept: "producao",  fromColumn: "handoff-log",     toDept: "logistica",     toDeptLabel: "Logística",   toColumn: "pronto",      toColumnLabel: "Material Pronto",     isPrimary: true,  gate: 4 },
  { fromDept: "producao",  fromColumn: "qc",              toDept: "logistica",     toDeptLabel: "Logística",   toColumn: "pronto",      toColumnLabel: "Material Pronto",     isPrimary: true,  gate: 4 },

  // Logística → Obras  (gate 5)
  { fromDept: "logistica", fromColumn: "handoff-obras",   toDept: "obras",         toDeptLabel: "Obras",       toColumn: "mobilizacao", toColumnLabel: "Mobilização",         isPrimary: true,  gate: 5 },
  { fromDept: "logistica", fromColumn: "entregue",        toDept: "obras",         toDeptLabel: "Obras",       toColumn: "mobilizacao", toColumnLabel: "Mobilização",         isPrimary: true,  gate: 5 },

  // Obras → Atendimento (primary) + PMO (secondary)  (gate 6)
  { fromDept: "obras",     fromColumn: "handoff-pos",     toDept: "atendimento",   toDeptLabel: "Atendimento", toColumn: "onboarding",  toColumnLabel: "Onboarding",          isPrimary: true,  gate: 6 },
  { fromDept: "obras",     fromColumn: "handoff-pos",     toDept: "produtividade", toDeptLabel: "PMO",         toColumn: "pre-crono",   toColumnLabel: "Pré-Cronograma",      isPrimary: false, gate: 6 },
  { fromDept: "obras",     fromColumn: "finalizado",      toDept: "atendimento",   toDeptLabel: "Atendimento", toColumn: "onboarding",  toColumnLabel: "Onboarding",          isPrimary: true,  gate: 6 },
];

export function getHandoffRules(deptId: string, columnId: string): HandoffRule[] {
  return HANDOFF_RULES.filter(r => r.fromDept === deptId && r.fromColumn === columnId);
}

/** A regra primária para fromDept+fromColumn (move o card real), ou null. */
export function getPrimaryRule(deptId: string, columnId: string): HandoffRule | null {
  return HANDOFF_RULES.find(r => r.fromDept === deptId && r.fromColumn === columnId && r.isPrimary) ?? null;
}

/** Regras secundárias (criam cards paralelos em depts como fiscal, pmo). */
export function getSecondaryRules(deptId: string, columnId: string): HandoffRule[] {
  return HANDOFF_RULES.filter(r => r.fromDept === deptId && r.fromColumn === columnId && !r.isPrimary);
}
