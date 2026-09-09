/**
 * Cliente dos endpoints /api/fiscal/* do parket-gestao_api.
 * Proxy nginx (deploy/nginx.conf) faz same-origin pra evitar CORS.
 */

export type Projeto = {
  id: string;
  endereco: string | null;
  status: string;
  valor_total: number;
  obra_code: string | null;
};

export type ClienteGrupo = {
  cliente: string;
  cnpj_cpf: string | null;
  projetos: Projeto[];
};

export type UploadResult = {
  ch_nfe: string;
  status: "criado" | "duplicado" | "erro";
  numero?: number;
  serie?: number;
  dest_nome?: string;
  valor_nf?: number;
  obra_projeto_id?: string | null;
  status_vinculo?: "vinculado" | "pendente";
  sugestao_projeto?: { id: string; cliente: string; endereco: string | null } | null;
  erro?: string | null;
};

export type Nota = {
  ch_nfe: string;
  numero: number;
  serie: number;
  dh_emissao: string;
  dest_nome: string;
  dest_cnpj_cpf: string;
  valor_nf: number;
  status_vinculo: "vinculado" | "pendente";
  obra_projeto_id: string | null;
  projeto_cliente: string | null;
  projeto_endereco: string | null;
  emit_nome: string;
  uploaded_at: string;
  uploaded_by: string;
};

const BASE = "/api/fiscal";

export async function listProjetos(): Promise<ClienteGrupo[]> {
  const r = await fetch(`${BASE}/projetos`);
  if (!r.ok) throw new Error(`GET /projetos falhou: ${r.status}`);
  const j = await r.json();
  return j.clientes || [];
}

export async function listNotas(params: { status?: "vinculado" | "pendente"; obra_projeto_id?: string } = {}): Promise<Nota[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.obra_projeto_id) qs.set("obra_projeto_id", params.obra_projeto_id);
  const r = await fetch(`${BASE}/notas?${qs.toString()}`);
  if (!r.ok) throw new Error(`GET /notas falhou: ${r.status}`);
  const j = await r.json();
  return j.notas || [];
}

export async function uploadXMLs(files: File[], uploadedBy: string): Promise<UploadResult[]> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  fd.append("uploaded_by", uploadedBy);
  const r = await fetch(`${BASE}/upload`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`POST /upload falhou: ${r.status}`);
  return await r.json();
}

export async function vincularNota(chNfe: string, obraProjetoId: string, ator: string): Promise<void> {
  const r = await fetch(`${BASE}/notas/${chNfe}/vincular`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ obra_projeto_id: obraProjetoId, ator }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Falha ao vincular: ${r.status} ${t}`);
  }
}

export function xmlUrl(chNfe: string): string {
  return `${BASE}/notas/${chNfe}/xml`;
}

/** DANFE (PDF padrão SEFAZ) gerado on-demand pelo backend a partir do xml_raw. */
export function pdfUrl(chNfe: string): string {
  return `${BASE}/notas/${chNfe}/pdf`;
}
