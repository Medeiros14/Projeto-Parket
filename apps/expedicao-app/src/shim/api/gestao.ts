const GESTAO_API = "https://gestao.parket.works/api";

export type GestaoProjeto = {
  id: string;
  card_id: string | null;
  numero_proposta: string | null;
  cliente: string;
  cnpj_cpf: string | null;
  endereco: string | null;
  obra_code: string | null;
  status: string;
};

export async function searchGestaoProjetos(q: string): Promise<GestaoProjeto[]> {
  const url = `${GESTAO_API}/projetos?limit=15${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gestão API ${res.status}`);
  return res.json();
}
