/** Overrides manuais por projeto — usados quando o cronograma contratual
 *  já está fechado em planilha mas o gestão ainda não reflete 1-pra-1.
 *  Fonte da verdade continua sendo o gestão; usar override só em casos
 *  pontuais e limpar quando o gestão for atualizado. */

export type LinhaCronoOverride = {
  codigo: string;
  descricao: string;
  contratado: number;
  unidade: string;
  inicio: string | null;   // ISO YYYY-MM-DD
  fim: string | null;
  instalado?: number;      // acompanhamento; default 0
  observacao?: string;     // texto livre, aparece junto do status
};

// Map projeto.id → linhas do cronograma
export const CRONOGRAMA_OVERRIDE: Record<string, LinhaCronoOverride[]> = {
  // Bruno Colodetti — cronograma contratual 10 itens (Will 14/07/2026)
  "27f0fc32-9627-45f3-a20c-f1ea38936498": [
    { codigo: "01", descricao: "FORRO INTERNO – INSTALAÇÃO RETA",   contratado: 40.5,  unidade: "m²", inicio: "2026-06-30", fim: "2026-07-08" },
    { codigo: "02", descricao: "FORRO – TOBLERONE",                 contratado: 10,    unidade: "m²", inicio: "2026-07-09", fim: "2026-07-14" },
    { codigo: "03", descricao: "FORRO MUXARABIÊ",                   contratado: 4.45,  unidade: "m²", inicio: "2026-07-15", fim: "2026-07-17" },
    { codigo: "04", descricao: "ASSOALHO – INSTALAÇÃO RETA",        contratado: 114.3, unidade: "m²", inicio: "2026-07-20", fim: "2026-07-27" },
    { codigo: "05", descricao: "PAINEL INTERNO – INSTALAÇÃO RETA",  contratado: 63,    unidade: "m²", inicio: "2026-07-28", fim: "2026-08-03" },
    { codigo: "06", descricao: "PAINEL – TOBLERONE",                contratado: 18,    unidade: "m²", inicio: "2026-08-04", fim: "2026-08-06" },
    { codigo: "07", descricao: "PAINEL – MUXARABIÊ",                contratado: 36.9,  unidade: "un", inicio: "2026-08-07", fim: "2026-08-12" },
    { codigo: "08", descricao: "PORTAS – PIVOTANTE",                contratado: 8,     unidade: "un", inicio: "2026-08-13", fim: "2026-08-21" },
    { codigo: "09", descricao: "PORTAS – CORRER",                   contratado: 1,     unidade: "un", inicio: "2026-08-24", fim: "2026-08-26" },
    { codigo: "10", descricao: "MÓVEIS FINOS CUSTOMIZADOS",         contratado: 1,     unidade: "un", inicio: "2026-08-27", fim: "2026-08-28" },
  ],

  // Amauri dos Santos — datas movidas pra gestao.itens (Will 13/08/2026);
  // override removido, cronograma vem direto do gestão (fonte única).
};

/** Deriva status de execução a partir das datas contratuais e do instalado. */
export function statusAcomp(l: LinhaCronoOverride, hoje = new Date()): string {
  const inst = l.instalado ?? 0;
  const done = inst >= l.contratado && l.contratado > 0;
  if (done) return "Concluído";
  const iniciou = inst > 0;
  const ini = l.inicio ? new Date(l.inicio + "T12:00:00") : null;
  const fim = l.fim ? new Date(l.fim + "T12:00:00") : null;
  if (iniciou) return "Em andamento";
  if (fim && hoje > fim) return "Atrasado";
  if (ini && hoje >= ini) return "Em andamento";
  return "Programado";
}
