import type { EntregaCatalogo } from "../api";

/* Painel Jornada = 11 entregas espelhando os cards do center do cliente (Will 22/07).
   Cada fase agrupa entregas por título; o backend filtra visivel_jornada=true
   e devolve exatamente essas 11 linhas, na ordem certa. */
export const MACRO_JORNADA: { fase: number; label: string; cor: string; titulos: string[] }[] = [
  {
    fase: 1, label: "Vistoria Técnica", cor: "#77736A",
    titulos: ["Itens Contratados", "Checklist de Início", "Reconhecimento da Obra", "Liberação de Obra"],
  },
  {
    fase: 2, label: "Projeto", cor: "#A98BC7",
    titulos: ["Mapeamento", "Definições", "Anteprojeto", "Projeto Executivo"],
  },
  {
    fase: 3, label: "Acompanhamento de Obras", cor: "#8CA9B8",
    titulos: ["Cronograma"],
  },
  {
    fase: 4, label: "Conclusão", cor: "#7BA394",
    titulos: ["Validação de Entrega", "Avaliação da Experiência"],
  },
];
export const MACRO_POR_TITULO: Record<string, number> = Object.fromEntries(
  MACRO_JORNADA.flatMap((m) => m.titulos.map((tit) => [tit, m.fase])));
export const MACRO_LABEL: Record<number, string> = Object.fromEntries(
  MACRO_JORNADA.map((m) => [m.fase, m.label]));
export const COR_FASE: Record<number, string> = Object.fromEntries(
  MACRO_JORNADA.map((m) => [m.fase, m.cor]));

/* Vínculo kanban → fase mais alta habilitada. 4 fases (Will 22/07):
   Vistoria Técnica → Projeto → Acompanhamento → Conclusão. */
export const FASE_POR_COLUNA: Record<string, number> = {
  "entrada": 1,
  "primeira-vistoria": 1,
  "projeto": 2,
  "pendente": 2,
  "pre-cronograma": 2,
  "segunda-vistoria": 3,
  "entrega-material": 3,
  "obras-liberadas": 3,
  "cronograma-final": 3,
  "acompanhamento": 3,
  "reparos": 3,
  "reparos-concluidos": 3,
  "obras-finalizadas": 4,
  // "travado" é especial: mantém a fase alcançada e sinaliza trava
};

export type FaseEntrega = {
  fase: number; label: string; cor: string; entregas: EntregaCatalogo[];
};

/** Reclassifica as entregas do catálogo nas 4 fases macro e ordena.
    Entregas sem título mapeado são descartadas — o backend já filtra
    por visivel_jornada=true, mas defende contra sujeira antiga. */
export function mapearEntregas(entregas: EntregaCatalogo[]): EntregaCatalogo[] {
  return entregas
    .filter((e) => MACRO_POR_TITULO[e.titulo] != null)
    .map((e) => {
      const macro = MACRO_POR_TITULO[e.titulo]!;
      return { ...e, fase: macro, fase_titulo: MACRO_LABEL[macro] };
    })
    .sort((a, b) => (a.fase - b.fase) || (a.ordem - b.ordem) || (a.id - b.id));
}

export function agruparFases(entregas: EntregaCatalogo[]): FaseEntrega[] {
  const m = new Map<number, FaseEntrega>();
  for (const e of entregas) {
    const f = m.get(e.fase) ?? m.set(e.fase, {
      fase: e.fase, label: e.fase_titulo, cor: COR_FASE[e.fase] || "#77736A", entregas: [],
    }).get(e.fase)!;
    f.entregas.push(e);
  }
  return [...m.values()].sort((a, b) => a.fase - b.fase);
}
