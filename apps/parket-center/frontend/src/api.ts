/** Cliente da API pública da Central do Cliente.
 *  Fonte única: API do gestao.parket.works (proxy /api no nginx). */

export type KanbanCol = { id: string; titulo: string; cor: string; ordem: number };

export type Etapa = {
  numero: number; slug: string; categoria: string; titulo: string;
  subtitulo: string; descricao: string;
  status: string; iniciada_em: string | null; concluida_em: string | null;
  observacoes: string | null; meta: any;
};

export type ItemObra = {
  id: string; ordem: number; categoria: string; descritivo: string;
  ambiente: string | null; quantidade: number; unidade: string;
  status: string; previsao_inicio: string | null; previsao_fim: string | null;
  meta: { obra?: any; codigo?: string | null; produto_header?: string | null; categoria_raiz?: string | null };
};

export type Documento = {
  id: string; etapa_numero: number | null; slug: string | null; titulo: string;
  arquivo_url: string; content_type: string | null; nome_arquivo: string | null;
  created_at: string;
  paginas?: { n: number; url: string; label?: string }[] | null;
};

export type LaudoConteudo = {
  descricao_produto?: string;
  responsavel?: string;
  vendedor?: string;
  relatorio_numero?: number;
  relatorio_data?: string;
  medicao_itens?: { item?: string; qtd?: string; descricao?: string }[];
  servico_contratado?: { descricao?: string; quantidade?: string; liberacao?: string; previsao_inicio?: string }[];
  entradas?: { data?: string; autor?: string; texto?: string }[];
  // Campos top-level do laudo do fiscal
  cliente?: string;
  obra?: string;
  endereco?: string;
  setor?: string;
  descritivo_sistema?: string;
  descritivo_material?: string;
  servicos_inclusos?: string[];
  medicao_obra?: string;
  observacoes?: string;
  ocorrencias?: string;
  materiais_falta?: string;
  insumos_falta?: string;
  metragem_areas?: string;
  obs_andaime?: string;
  tipo_laje?: string;
  reforco_necessario?: string;
  insumos_necessarios?: string;
  sistema_instalacao?: string;
  materiais_necessarios?: string;
  resultado?: string;
  checklists?: Record<string, Record<string, { obs?: string; valor?: string }>>;
};

export type Laudo = {
  id: string; tipo: string; status: string; data_vistoria: string | null;
  fiscal_nome: string | null; created_at: string; condicao: string;
  assinado: boolean; assinado_por: string; assinado_em: string | null;
  assinar_url: string | null; pdf_url: string;
  conteudo?: LaudoConteudo;
  fotos?: LaudoFoto[];
};

export type LaudoFoto = {
  tipo: string | null; servico: string | null;
  ambiente: string | null; descricao: string | null; url: string;
};

export type MapaPrint = {
  mapa_id: string;
  revisao: string;
  pdf_url: string;
  paginas: { n: number; url: string; label?: string }[];
  gerado_em: string;
};

export type DefinicaoItem = {
  pergunta: string; resposta: string;
  contrato?: string; obs?: string;
  status?: "ok" | "ajuste" | "aditivo" | "fora_escopo";
};
export type DefinicaoSecao = { titulo: string; itens: DefinicaoItem[]; referencias?: string[] };
export type DefinicaoArquivo = { nome_arquivo: string; url: string; content_type?: string; por?: string; em?: string };
export type DefinicaoResposta = { resposta: string; por?: string; em?: string };
export type Definicoes = {
  titulo?: string; data?: string; tipo?: string; participantes?: string[];
  secoes?: DefinicaoSecao[]; referencias?: string[];
  ata_url?: string; arquivos?: DefinicaoArquivo[];
  respostas?: Record<string, DefinicaoResposta>;
};

// Foto da obra curada no gestão (fiscal + instalador) com ambiente e material
export type FotoObraCenter = {
  id: string; url: string; legenda: string | null; ambiente: string | null;
  tipo: string; origem: string; item_id: string | null;
  ordem: number; created_at: string;
  item_categoria: string | null; item_descritivo: string | null;
  item_ambiente: string | null; item_codigo: string | null;
  item_produto: string | null;
};

export type CenterData = {
  projeto: {
    id: string; cliente: string; endereco: string | null; numero_proposta: string | null;
    vendedor: string | null; arquiteto: string | null; status: string;
    etapa_atual: number; column_id: string;
    assinado_em: string | null; iniciado_em: string | null; entregue_em: string | null;
    updated_at: string; created_at: string;
    grupo_link?: string | null;
  };
  kanban: { colunas: KanbanCol[]; atual: string };
  etapas: Etapa[];
  itens: ItemObra[];
  documentos: Documento[];
  fotos_obra?: FotoObraCenter[];
  laudos: Laudo[];
  mapa: MapaPrint | null;
  avaliacao: { notas: Record<string, number>; comentario: string; nome: string; enviada_em: string } | null;
  feed_instalador?: Array<{
    id: string; kind: string; titulo: string; detalhe: string | null;
    foto_url: string | null; payload: any; created_at: string;
  }>;
  ocorrencias_instalador?: Array<{
    id: string; tipo: string | null; descricao: string | null;
    foto_url: string | null; audio_url: string | null; status: string | null;
    resolvida_em: string | null; created_at: string; prestador_nome: string | null;
  }>;
  conferencias_instalador?: Array<{
    id: string; item_nome: string | null; volume: number | null; status: string | null;
    foto_url: string | null; obs: string | null; created_at: string; prestador_nome: string | null;
  }>;
  andamento?: {
    pct_etapas: number; pct_itens: number; pct_geral: number;
    ultima_atividade: string | null;
  };
};

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

// Chave de sessão do login do cliente — uma por token, persistida localmente
const keyName = (token: string) => `parket-center-key-${token}`;
export const getCenterKey = (token: string) => {
  try { return localStorage.getItem(keyName(token)) || ""; } catch { return ""; }
};
export const setCenterKey = (token: string, key: string) => {
  try { localStorage.setItem(keyName(token), key); } catch {}
};
export const clearCenterKey = (token: string) => {
  try { localStorage.removeItem(keyName(token)); } catch {}
};
const auth = (token: string): Record<string, string> => {
  const k = getCenterKey(token);
  return k ? { "X-Center-Key": k } : {};
};

export type InstaMidiaCenter = {
  foto_id: string; url: string; tipo: string | null;
  legenda: string | null; ambiente: string | null;
};
export type InstaPostCenter = {
  id: string; legenda: string | null; created_at: string;
  midias: InstaMidiaCenter[]; curtidas: number; comentarios: number;
};
export type InstaPerfilCenter = {
  cliente: string; avatar_url: string | null; posts: InstaPostCenter[];
};

export const api = {
  center: (token: string) => j<CenterData>(`/api/publico/center/${token}`, { headers: auth(token) }),
  instaPerfil: (token: string) => j<InstaPerfilCenter>(`/api/publico/insta/${token}`),
  login: (token: string, body: { usuario: string; senha: string }) =>
    j<{ ok: boolean; key: string; nome: string }>(`/api/publico/center/${token}/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
  avaliar: (token: string, body: { notas: Record<string, number>; comentario?: string; nome?: string }) =>
    j<{ ok: boolean }>(`/api/publico/center/${token}/avaliacao`, {
      method: "POST", headers: { "Content-Type": "application/json", ...auth(token) }, body: JSON.stringify(body),
    }),
  // Assinatura in-page do termo (mesmo endpoint público do /assinar/ do gestao)
  assinarTermo: (signToken: string, body: { nome: string; cpf?: string; assinatura: string }) =>
    j<{ ok: boolean }>(`/api/publico/laudo-assinatura/${signToken}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
  checklistItem: (token: string, form: FormData) =>
    j<{ ok: boolean; chave: string; item: ChecklistRevisao }>(`/api/publico/center/${token}/checklist/item`, {
      method: "POST", headers: auth(token), body: form,
    }),
  checklistTermo: (token: string, body: { servico: string; nome: string; papel: string; obs?: string; itens_pendentes: string[]; aceite: boolean }) =>
    j<{ ok: boolean; servico: string; termo: ChecklistTermo }>(`/api/publico/center/${token}/checklist/termo`, {
      method: "POST", headers: { "Content-Type": "application/json", ...auth(token) }, body: JSON.stringify(body),
    }),
  definicoesArquivo: (token: string, form: FormData) =>
    j<{ ok: boolean; arquivo: DefinicaoArquivo }>(`/api/publico/center/${token}/definicoes/arquivo`, {
      method: "POST", headers: auth(token), body: form,
    }),
  definicoesResposta: (token: string, body: { secao: string; pergunta: string; resposta: string; nome?: string }) =>
    j<{ ok: boolean; chave: string; resposta: DefinicaoResposta }>(`/api/publico/center/${token}/definicoes/resposta`, {
      method: "POST", headers: { "Content-Type": "application/json", ...auth(token) }, body: JSON.stringify(body),
    }),
  // Financeiro: consulta agregada + geração de Pix por parcela + polling de status.
  // Boleto sai por download direto (window.open) na URL abaixo — o backend do
  // gestão faz proxy pro parket-docusign (Itaú) e devolve o PDF inline.
  financeiro: (token: string) =>
    j<FinanceiroObra>(`/api/publico/center/${token}/financeiro`, { headers: auth(token) }),
  financeiroBoletoUrl: (token: string, lancamentoId: string) =>
    `/api/publico/center/${token}/financeiro/${lancamentoId}/boleto`,
  financeiroPix: (token: string, lancamentoId: string) =>
    j<{ ok: boolean; txid: string; copia_e_cola: string; valor: number; ambiente: string }>(
      `/api/publico/center/${token}/financeiro/${lancamentoId}/pix`,
      { method: "POST", headers: { "Content-Type": "application/json", ...auth(token) } },
    ),
  financeiroPixStatus: (token: string, txid: string) =>
    j<{ ok: boolean; status: string }>(`/api/publico/center/${token}/financeiro/pix/${txid}`, {
      headers: auth(token),
    }),

  // ── NF-e da obra (aba do card CONTRATO na Central) ──────────────────
  // Notas emitidas pelo Fiscal vinculadas ao projeto do cliente.
  // Path /api/fiscal/center/:token/notas (não /api/publico) porque vem do
  // router fiscal do gestão-api. Sem auth extra: token do center já é o
  // segredo. XML e PDF (DANFE) saem por download direto.
  centerNotas: (token: string) =>
    j<CenterNotasResp>(`/api/fiscal/center/${token}/notas`),
  centerNotaXmlUrl: (chNfe: string) => `/api/fiscal/notas/${chNfe}/xml`,
  centerNotaPdfUrl: (chNfe: string) => `/api/fiscal/notas/${chNfe}/pdf`,
};

export type NotaCenter = {
  ch_nfe: string;
  numero: number;
  serie: number;
  dh_emissao: string;
  natureza_op: string | null;
  valor_nf: number;
  emit_nome: string;
};
export type CenterNotasResp = {
  projeto_id: string;
  cliente: string;
  notas: NotaCenter[];
  total_valor: number;
  total_qtd: number;
};

// ── Financeiro da obra (aba da página Itens Contratados) ──
// Parcelas de ENTRADA do core.lancamentos (Cloud, schema core) via gestão API;
// boleto/Pix saem por proxy do backend do termo (parket-docusign / Itaú).
export type ParcelaFinanceiro = {
  id: string; descricao: string;
  numero_documento?: string;
  parcela_atual: number; parcela_total: number;
  valor: number; valor_pago: number | null;
  vencimento: string | null; pago_em: string | null;
  forma_pagamento?: string | null;
  anexos?: { nome: string; url: string }[];
  status: "pago" | "pendente" | "vencido";
  cobranca_disponivel: boolean;
};
export type ProximaParcela = {
  id: string; valor: number; vencimento: string | null;
  status: "pendente" | "vencido";
  parcela_atual: number; parcela_total: number;
};
export type FinanceiroObra = {
  disponivel: boolean;
  parcelas: ParcelaFinanceiro[];
  proxima?: ProximaParcela | null;
  totais: { contratado: number; pago: number; falta: number; pct_pago: number } | null;
};

export type ChecklistRevisao = { status?: string; obs?: string; previsao?: string; foto_url?: string; por: string; papel: string; em: string };
export type ChecklistTermo = { nome: string; papel: string; obs?: string; itens_pendentes: string[]; assinado_em: string };

export const fmtNum = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("pt-BR");
export const fmtData = (iso?: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return iso; }
};
export const fmtDataHora = (iso?: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
};
