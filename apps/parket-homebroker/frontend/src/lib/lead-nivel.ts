/**
 * Classificador de temperatura do lead (quente/morno/frio).
 * Mesma lógica usada no Book de Vendas — extraída pra ser reusada no Tracking.
 */
export type NivelLead = "quente" | "morno" | "frio" | "sem";

export function classificarNivel(args: {
  valor: number;
  slug: string;
  ultimaMsgAt?: string | null;
  tags?: string[] | null;
  det?: any;
  aguardando?: boolean;
}): { nivel: NivelLead; fonte: "ia" | "heuristica" } {
  const det = args.det || {};
  // 1) IA já classificou em details.nivel_lead / qualificacao
  const iaNivel = String(det.nivel_lead || det.qualificacao || "").toLowerCase();
  if (iaNivel.includes("quente")) return { nivel: "quente", fonte: "ia" };
  if (iaNivel.includes("morno"))  return { nivel: "morno",  fonte: "ia" };
  if (iaNivel.includes("frio"))   return { nivel: "frio",   fonte: "ia" };

  // 2) Tag explícita
  const tagsLower = (args.tags || []).map((t) => String(t).toLowerCase()).join("|");
  if (/quente|hot|urgent/.test(tagsLower)) return { nivel: "quente", fonte: "heuristica" };
  if (/frio|cold/.test(tagsLower))         return { nivel: "frio",   fonte: "heuristica" };

  // 3) Heurística por etapa + valor + silêncio
  const stage = args.slug || "";
  const stageHot = /em-negociac|apresentacao-proposta|ganho|qualificado/.test(stage);
  const stageCold = /perda|nao-qualif|follow-up-3/.test(stage);
  const valorAlto = args.valor >= 200000;
  const valorMedio = args.valor >= 50000;

  const daysSilent = args.ultimaMsgAt
    ? (Date.now() - new Date(args.ultimaMsgAt).getTime()) / 86400000
    : 999;

  if (stageCold || daysSilent > 14) return { nivel: "frio", fonte: "heuristica" };
  if (stageHot && (valorAlto || args.aguardando)) return { nivel: "quente", fonte: "heuristica" };
  if (valorAlto && daysSilent < 3) return { nivel: "quente", fonte: "heuristica" };
  if (stageHot || valorMedio) return { nivel: "morno", fonte: "heuristica" };
  return { nivel: "frio", fonte: "heuristica" };
}
