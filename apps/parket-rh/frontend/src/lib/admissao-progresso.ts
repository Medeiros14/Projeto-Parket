/**
 * Calcula progresso da admissão baseado em form_data (jsonb da rh.admissoes).
 *
 * Espelha a validação do AdmissaoPublica.tsx pra dar a mesma % no painel admin
 * e na própria página pública. Steps obrigatórios:
 *   pessoais, contatos, endereco, documentos, bancarios, emergencia, epi, uploads, assinatura
 *
 * Steps opcionais: estrangeiro, formacao, dependentes (não contam pra %).
 */

export type StepInfo = { key: string; label: string; required: boolean };

export const ADMISSAO_STEPS: StepInfo[] = [
  { key: "pessoais", label: "Dados pessoais", required: true },
  { key: "contatos", label: "Contatos", required: true },
  { key: "endereco", label: "Endereço", required: true },
  { key: "documentos", label: "Documentos", required: true },
  { key: "estrangeiro", label: "Estrangeiro", required: false },
  { key: "formacao", label: "Formação", required: false },
  { key: "dependentes", label: "Dependentes", required: false },
  { key: "bancarios", label: "Banco / PIX", required: true },
  { key: "emergencia", label: "Emergência", required: true },
  { key: "epi", label: "Uniforme / EPI", required: true },
  { key: "uploads", label: "Documentos (foto)", required: true },
  { key: "assinatura", label: "Assinatura", required: true },
];

function nonEmpty(v: any): boolean {
  return v !== null && v !== undefined && !(typeof v === "string" && !v.trim());
}

export function isStepComplete(stepKey: string, data: any): boolean {
  data = data || {};
  if (stepKey === "pessoais") {
    const p = data.pessoais || {};
    return ["nome","data_nascimento","sexo","genero_documento","estado_civil","raca_cor",
            "nacionalidade","uf_natal","cidade_natal","nome_mae"].every(k => nonEmpty(p[k]));
  }
  if (stepKey === "contatos") {
    const c = data.contatos || {};
    return nonEmpty(c.celular) && nonEmpty(c.email);
  }
  if (stepKey === "endereco") {
    const e = data.endereco || {};
    return ["cep","logradouro","numero","bairro","cidade","uf"].every(k => nonEmpty(e[k]));
  }
  if (stepKey === "documentos") {
    const d = data.documentos || {};
    const sexo = String(data.pessoais?.sexo || "").toLowerCase();
    const reqBase = ["cpf","rg_numero","rg_orgao","rg_uf","rg_data","pis","titulo","titulo_zona","titulo_secao"]
      .every(k => nonEmpty(d[k]));
    if (sexo === "homem" || sexo === "masculino") return reqBase && nonEmpty(d.reservista);
    return reqBase;
  }
  if (stepKey === "bancarios") {
    const b = data.bancarios || {};
    return ["banco","tipo","agencia","conta","digito"].every(k => nonEmpty(b[k]));
  }
  if (stepKey === "emergencia") {
    const list = data.emergencia || [];
    if (list.length === 0) return false;
    return list.every((c: any) => nonEmpty(c.nome) && nonEmpty(c.relacao) && nonEmpty(c.celular));
  }
  if (stepKey === "epi") {
    const e = data.epi || {};
    return nonEmpty(e.camiseta) && nonEmpty(e.calca);
  }
  if (stepKey === "uploads") {
    const list = data.uploads || [];
    const has = (t: string) => list.some((u: any) => u.tipo === t);
    return ["rg_frente","rg_verso","cpf","comprovante_residencia"].every(has);
  }
  if (stepKey === "assinatura") {
    return nonEmpty(data?.assinatura?.png);
  }
  // estrangeiro/formacao/dependentes: sempre "complete" (opcionais)
  return true;
}

export function calcAdmissaoProgresso(formData: any): { pct: number; obrigatoriosFeitos: number; obrigatoriosTotal: number; ultimoStepCompleto: string | null; proximoStepPendente: string | null } {
  const obrig = ADMISSAO_STEPS.filter(s => s.required);
  let feitos = 0;
  let ultimoCompleto: string | null = null;
  let proximoPendente: string | null = null;
  for (const s of obrig) {
    if (isStepComplete(s.key, formData)) {
      feitos++;
      ultimoCompleto = s.label;
    } else if (!proximoPendente) {
      proximoPendente = s.label;
    }
  }
  return {
    pct: Math.round((feitos / obrig.length) * 100),
    obrigatoriosFeitos: feitos,
    obrigatoriosTotal: obrig.length,
    ultimoStepCompleto: ultimoCompleto,
    proximoStepPendente: proximoPendente,
  };
}
