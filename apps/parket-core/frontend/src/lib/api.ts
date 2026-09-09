import { useEffect, useState } from "react";
// supabase      = gateway local api.parket.works (auth/login + schema public local)
// supabaseCore  = Supabase CLOUD, schema core — o financeiro VIVO (lancamentos,
//                 obras, comissoes, RT, impostos...). O watcher compras-contratos
//                 grava tudo lá; ler core pelo gateway local mostrava tela vazia.
import { supabase, supabasePublic, supabaseCore } from "./supabase";

export type Empresa = {
  id: string; cnpj: string; razao_social: string; nome_fantasia: string | null;
  cidade: string | null; uf: string | null; cor: string; regime_tributario: string | null;
  endereco?: string | null; cep?: string | null; telefone?: string | null;
  email?: string | null; inscricao_estadual?: string | null;
  ativo: boolean;
};
export type CentroCusto = { id: string; codigo: string; nome: string; descricao: string | null; cor: string; ativo: boolean };
export type PlanoConta = {
  id: string; codigo: string; nome: string; tipo: "receita" | "despesa" | "ativo" | "passivo" | "patrimonio";
  natureza: "credito" | "debito" | null; parent_id: string | null; nivel: number; analitica: boolean;
  ativo?: boolean;
};
export type Parceiro = {
  id: string; tipo_pessoa: "PF" | "PJ"; documento: string | null; nome: string; fantasia: string | null;
  is_cliente: boolean; is_fornecedor: boolean; is_vendedor: boolean; is_arquiteto: boolean;
  cidade: string | null; uf: string | null;
  comissao_padrao: number | null;
  rt_padrao: number | null;
  email?: string | null; telefone?: string | null; observacoes?: string | null;
  ativo?: boolean;
  space_prestador_id?: string | null;  // Liga com public.prestadores do Space
};
export type ContaBancaria = {
  id: string; empresa_id: string; banco: string; agencia: string | null; conta: string | null;
  tipo: string; saldo_inicial: number; saldo_inicial_data: string | null;
  ativo?: boolean;
};
export type ContaBancariaSaldo = ContaBancaria & {
  movimento: number; saldo_atual: number; ultima_movimentacao: string | null;
};
export type AuditLogRow = {
  id: number;
  tabela: string;
  acao: "INSERT" | "UPDATE" | "DELETE" | "BAIXA" | "ESTORNO";
  row_id: string | null;
  user_email: string;
  antes: any | null;
  depois: any | null;
  motivo: string | null;
  created_at: string;
};
export type Obra = {
  id: string; empresa_id: string; centro_custo_id: string; codigo: string; nome: string;
  cliente_id: string | null; vendedor_id: string | null; cidade: string | null; uf: string | null;
  endereco?: string | null;
  data_inicio: string | null; previsao_termino: string | null; data_termino: string | null;
  status: string; valor_venda: number; valor_orcamento: number | null; margem_prevista: number | null;
  observacoes?: string | null;
  arquiteto_id: string | null;
  rt_percentual: number | null;
  rt_threshold_pct: number;
  // v2 (task #1669)
  imposto_pct?: number;
  comissao_pct?: number | null;
  regra_liberacao?: "proporcional" | "threshold_50" | "manual";
  space_id?: string | null;  // Liga com public.obras do Space (PKT100xxx)
};

export type ObraResumo = {
  id: string;
  codigo: string;
  nome: string;
  empresa_id: string;
  cliente_id: string | null;
  vendedor_id: string | null;
  arquiteto_id: string | null;
  status: string;
  venda_contrato: number;
  valor_aditivos: number;
  venda_total: number;
  entradas_previstas: number;
  entradas_recebidas: number;
  pct_pago: number;                       // 0..1
  custo_realizado: number;
  custo_comprometido: number;    // previsto+pago; compra aprovada já sobe aqui (SQL 024)
  imposto_pct: number;
  comissao_pct: number | null;
  rt_percentual: number | null;
  regra_liberacao: "proporcional" | "threshold_50" | "manual";
  rt_threshold_pct: number;
  data_inicio: string | null;
  previsao_termino: string | null;
};

// Frete (public.expedicao_fretes) — usado na tela /fretes pra vincular obra manualmente
export type ExpedicaoFrete = {
  id: string;
  numero: string;
  status: string;
  cliente_nome: string | null;
  valor_total: number | null;
  data_saida: string | null;
  data_entrega: string | null;
  destino_cidade: string | null;
  destino_estado: string | null;
  motorista_nome: string | null;
  obra_id: string | null;
  valor_adiantamento1: number | null;
  valor_adiantamento2: number | null;
  valor_saldo: number | null;
  adiantamento1_pago: boolean;
  adiantamento2_pago: boolean;
  saldo_pago: boolean;
};

/** Candidato a obra pra um frete órfão (core.sugerir_obras_por_texto).
 *  score 1.00 nome igual, 0.95 contido, 0.85 primeiro cliente da carga,
 *  abaixo disso é similaridade trigram pura. valor_venda serve pra
 *  desempatar obras homônimas (mesmo cliente, propostas diferentes). */
export type ObraSugestao = {
  obra_id: string;
  nome: string;
  valor_venda: number | null;
  score: number;
  motivo: string;
};

export type FreteSugestoes = { frete_id: string; candidatos: ObraSugestao[] };

export type ObraAditivo = {
  id: string;
  obra_id: string;
  numero: number;
  descricao: string;
  valor: number;
  data: string;
  forma_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
};
export type Lancamento = {
  id: string; empresa_id: string; centro_custo_id: string | null; obra_id: string | null;
  parceiro_id: string | null; plano_conta_id: string; conta_bancaria_id: string | null;
  tipo: "entrada" | "saida"; status: string; descricao: string; numero_documento: string | null;
  data_emissao: string | null; data_competencia: string; data_vencimento: string;
  data_pagamento: string | null; valor: number; valor_pago: number | null;
  juros?: number; desconto?: number;
  parcela_atual: number; parcela_total: number; forma_pagamento: string | null;
  observacoes?: string | null;
};
export type Comissao = {
  id: string; obra_id: string | null; vendedor_id: string;
  base_calculo: number; percentual: number; valor: number; status: string; data_pagamento: string | null;
  competencia: string | null; volume_base: number | null; qtd_fechamentos: number;
};
export type ComissaoRegra = {
  id: string; vendedor_id: string; tipo: "faixa" | "fixo";
  fixo_valor: number | null; ativo: boolean; observacoes: string | null;
};
export type ComissaoFaixa = {
  id: string; regra_id: string | null; volume_min: number; volume_max: number | null;
  percentual: number; ativo: boolean;
};
export type RT = {
  id: string;
  obra_id: string;
  arquiteto_id: string;
  base_calculo: number;
  percentual: number;
  threshold_pct: number;
  valor_total: number;
  status: "aberta" | "quitada" | "cancelada";
  observacoes?: string | null;
  created_at?: string;
};
export type RTLiberacao = {
  id: string;
  rt_id: string;
  valor: number;
  data_liberacao: string;
  lancamento_id: string | null;
  observacoes?: string | null;
  created_at?: string;
};
export type Imposto = {
  id: string; empresa_id: string; tipo: string; competencia: string;
  valor: number; vencimento: string; data_pagamento: string | null; status: string;
};

export type ViagemDespesa = {
  id: string;
  data: string;
  tipo: "passagem" | "hospedagem" | "alimentacao" | "transporte_local" | "combustivel" | "pedagio" | "outros";
  descricao: string;
  valor: number;
  comprovante_path?: string | null;
  comprovante_name?: string | null;
};

export type Viagem = {
  id: string; empresa_id: string;
  funcionario_id: string | null; obra_id: string | null;
  motivo: string;
  destino_cidade: string | null; destino_uf: string | null;
  data_ida: string; data_volta: string | null;
  meio_transporte: "carro" | "aviao" | "onibus" | "van" | "outro" | null;
  status: "planejada" | "em_andamento" | "concluida" | "cancelada";
  adiantamento: number;
  despesas: ViagemDespesa[];
  observacoes: string | null;
};

export type Funcionario = {
  id: string; empresa_id: string;
  nome: string; documento: string | null;
  email: string | null; telefone: string | null;
  cargo: string | null; setor: string | null;
  vinculo: "CLT" | "PJ" | "MEI" | "estagio" | "freelance" | "socio";
  data_admissao: string | null; data_demissao: string | null;
  salario_base: number; vale_transporte: number; vale_refeicao: number;
  plano_saude: number; outros_beneficios: number;
  banco: string | null; agencia: string | null; conta: string | null; pix: string | null;
  dia_pagamento: number;
  observacoes: string | null;
  ativo: boolean;
};

// Tipos do Space (schema public)
export type SpaceUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "superadmin" | "admin" | "dept_leader" | "viewer" | "projetista" | "inactive";
  dept_permissions: Record<string, any> | null;
  avatar_color: string | null;
  created_at: string;
  updated_at: string;
};

export type ContratoAssinado = {
  id: string;
  card_id: string;
  titulo: string | null;
  status: string;
  sent_at: string | null;
  completed_at: string | null;
  signatarios: Array<{ nome?: string; name?: string; email?: string; papel?: string; role?: string }> | null;
};

export type SpaceObra = {
  id: string;            // PKT100xxx
  cliente: string;
  localizacao: string | null;
  regiao: string | null;
  status: string;
  data_finalizacao: string | null;
  valor_num: number | null;
};

export function useFetch<T>(fn: () => Promise<T> | PromiseLike<T>, deps: any[] = []): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.resolve(fn()).then(
      (d) => { if (alive) { setData(d); setLoading(false); } },
      (e) => { if (alive) { setError(e?.message || "Erro"); setLoading(false); } },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);
  return { data, loading, error, reload: () => setReloadKey((k) => k + 1) };
}

function unwrap<T>(res: any): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// Acesso ao schema `public` (Space) via fetch direto no PostgREST,
// reusando o JWT do client principal. Antes era um segundo client Supabase
// (`createClient`) com `onAuthStateChange` chamando `space.auth.setSession`,
// mas isso estava causando travamento do client principal (getSession e
// queries em `core.app_users` ficavam pendentes indefinidamente).
const url = import.meta.env.VITE_SUPABASE_URL || "https://api.parket.works";

// Cloud Parket (Supabase) — onde vivem kanban_cards + compras_itens + compras_fornecedores.
// Diferente de `url` (api.parket.works = pg-local). Compras app grava aqui,
// Core precisa ler daqui pra ver os itens que Compras enviou.
const CLOUD_URL  = "https://hbxpilrxmitvzebluoom.supabase.co";
const CLOUD_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";
async function cloudFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Bearer = token da sessao (GoTrue local assina com o MESMO jwt secret do
  // Cloud, entao auth.uid() resolve la). Sem sessao cai no anon (leituras).
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || CLOUD_ANON;
  const r = await fetch(`${CLOUD_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: CLOUD_ANON, Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`Cloud ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const text = await r.text();
  return (text ? JSON.parse(text) : undefined) as T; // RPC void -> 204 sem corpo
}
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

async function spaceFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return crossSchemaFetch<T>("public", path, init);
}

/** Fetch cross-schema pra qualquer schema exposto no PostgREST (public/erp/etc).
 *  Necessário pra abas Compras (erp.pedidos_compra) e Prestadores (public.*)
 *  dentro do Pagamentos do Core, que roda no schema `core` por default. */
async function crossSchemaFetch<T>(schema: string, path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || anon;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      "Accept-Profile": schema,
      "Content-Profile": schema,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`PostgREST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** HEAD + Prefer: count=exact + Range: 0-0 — retorna só o total de linhas
 *  do filtro. Muito mais barato que puxar linhas quando só queremos badge/count. */
async function crossSchemaCount(schema: string, path: string): Promise<number> {
  // Usa GET com ?select=id&limit=1 + Prefer:count=exact — retorna 1 row (ou 0)
  // mas o count total vem no header content-range. Evita HEAD+Range-Unit que
  // é bloqueado pelo CORS do gateway api.parket.works.
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || anon;
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${url}/rest/v1/${path}${sep}select=id&limit=1`, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      "Accept-Profile": schema,
      Prefer: "count=exact",
    },
  });
  if (!res.ok) return 0;
  const cr = res.headers.get("content-range") || "";
  const total = cr.split("/")[1];
  return Number(total) || 0;
}

/** count=exact no CLOUD (schema core). Fretes/viagens e todo o financeiro core
 *  vivem no Cloud; crossSchemaCount("core") iria pro pg-local (sempre 0). */
async function cloudCountCore(path: string): Promise<number> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || CLOUD_ANON;
    const sep = path.includes("?") ? "&" : "?";
    const r = await fetch(`${CLOUD_URL}/rest/v1/${path}${sep}select=id&limit=1`, {
      headers: {
        apikey: CLOUD_ANON,
        Authorization: `Bearer ${token}`,
        "Accept-Profile": "core",
        Prefer: "count=exact",
      },
    });
    const cr = r.headers.get("content-range") || "";
    return Number(cr.split("/")[1]) || 0;
  } catch { return 0; }
}

// ── Custos de Terceiros (API do gestao.parket.works) ──────────────────
// O QUÊ: fila de aprovação e pagamento dos Custos de Terceiros (OPT-XXXX)
// lançados no gestao. POR QUÊ aqui: o backend do gestao já tem todo o fluxo
// (decisão despesa a despesa, transições de status, write-back do pagamento
// em core.lancamentos, upload de comprovante) e autentica por X-User-Email
// na MESMA public.user_profiles que o login do Core usa. Chamar direto
// evita duplicar regra de negócio em RPC PostgREST. CORS liberado pro
// core.parket.works no stack.yml do parket-gestao.
const GESTAO_API = "https://gestao.parket.works/api/custos";

export type CustoLancResumo = {
  id: string; numero: string; status: string; motivo: string | null;
  data_ida: string | null; data_volta: string | null;
  prestador_id: string; prestador_nome: string | null;
  total_lancado_cent: number; total_aprovado_cent: number;
  adiantamento_cent: number; saldo_cent: number;
  centro_custo_nome: string | null; criado_por: string | null; created_at: string;
  projeto_id: string; cliente: string | null; endereco: string | null;
  numero_proposta: string | null;
  n_despesas: number; n_alertas: number; n_pendentes: number;
};
export type CustoDespesa = {
  id: string; categoria: string; subcategoria: string; descricao: string | null;
  data: string | null; quantidade: number; valor_unitario_cent: number;
  valor_total_cent: number; campos: any; alertas: Array<{ codigo: string; mensagem: string; nivel: string }>;
  anexo_url: string | null; anexo_nome: string | null; anexo_content_type: string | null;
  status: "pendente" | "aprovado" | "glosado"; glosa_motivo: string | null;
  decidido_por: string | null; decidido_em: string | null; created_at: string;
};
export type CustoDetalhe = {
  lancamento: CustoLancResumo & {
    comprovante_url: string | null; comprovante_nome: string | null;
    centro_custo_id: string | null; core_lancamento_id: string | null;
    pago_por: string | null; pago_em: string | null;
    aprovado_por: string | null; aprovado_em: string | null;
  };
  despesas: CustoDespesa[];
  historico: Array<{ de: string | null; para: string; usuario_email: string | null; usuario_nome: string | null; observacao: string | null; created_at: string }>;
  politica: any; pendencias: string[]; proximos_status: string[]; pode_decidir: boolean;
};

// Toda chamada leva X-User-Email da sessão logada: o _perfil() do gestao
// resolve o papel (financeiro/admin) nessa mesma user_profiles.
async function gestaoFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email;
  if (!email) throw new Error("Sessão expirada: faça login de novo");
  const r = await fetch(`${GESTAO_API}${path}`, {
    ...init,
    headers: { "X-User-Email": email, ...(init.headers || {}) },
  });
  if (!r.ok) {
    let msg = `Gestão ${r.status}`;
    try { msg = (await r.json()).detail || msg; } catch { /* corpo não-JSON */ }
    throw new Error(msg);
  }
  return r.json();
}

export const api = {
  // Fila do financeiro: enviados + em análise, mais antigos primeiro.
  custosFila: () =>
    gestaoFetch<{ items: CustoLancResumo[]; papel: { admin: boolean; financeiro: boolean; financeiro_ve: boolean } }>("/lancamentos?fila=true"),
  // Aprovados aguardando pagamento (aba /pagamentos).
  custosAprovados: () =>
    gestaoFetch<{ items: CustoLancResumo[]; papel: any }>("/lancamentos?status=aprovado"),
  // Já pagos (filtro "pagos" na aba /pagamentos — pra ver o comprovante).
  custosPagos: () =>
    gestaoFetch<{ items: CustoLancResumo[]; papel: any }>("/lancamentos?status=pago"),
  custosDetalhe: (lid: string) => gestaoFetch<CustoDetalhe>(`/lancamentos/${lid}`),
  // Decisão item a item; glosar exige motivo (o secretário precisa saber o que corrigir).
  custosDecisao: (did: string, decisao: "aprovado" | "glosado" | "pendente", glosaMotivo?: string) =>
    gestaoFetch<CustoDespesa>(`/despesas/${did}/decisao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisao, glosa_motivo: glosaMotivo ?? null }),
    }),
  // Transições: em_analise/aprovado/devolvido/pago. Devolver exige observação.
  // Pagar cria a linha em core.lancamentos no backend (write-back automático).
  custosStatus: (lid: string, para: string, observacao?: string) =>
    gestaoFetch<CustoDetalhe>(`/lancamentos/${lid}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ para, observacao: observacao ?? null }),
    }),
  // Comprovante da transferência: só depois do status pago (regra do backend).
  custosComprovante: (lid: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    // sem Content-Type manual: o browser põe o boundary do multipart sozinho
    return gestaoFetch<CustoDetalhe>(`/lancamentos/${lid}/comprovante`, { method: "POST", body: fd });
  },
  // PDF da ordem de pagamento: precisa do header X-User-Email, então baixa
  // como blob e abre em objectURL (link direto não levaria o header).
  custosOpPdf: async (lid: string, numero: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email || "";
    const r = await fetch(`${GESTAO_API}/lancamentos/${lid}/op.pdf`, { headers: { "X-User-Email": email } });
    if (!r.ok) throw new Error(`PDF ${r.status}`);
    const blob = await r.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u; a.download = `${numero}.pdf`; a.click();
    setTimeout(() => URL.revokeObjectURL(u), 30_000);
  },

  empresas: () => supabaseCore.from("empresas").select("*").order("razao_social").then(unwrap<Empresa[]>),
  centrosCusto: () => supabaseCore.from("centros_custo").select("*").order("codigo").then(unwrap<CentroCusto[]>),
  planoContas: () => supabaseCore.from("plano_contas").select("*").order("codigo").then(unwrap<PlanoConta[]>),
  parceiros: async (): Promise<Parceiro[]> => {
    // PostgREST do Supabase tem max-rows (~1000-5000) — busca em batches via
    // .range() até esgotar pra trazer TODOS os parceiros (a tabela tem 5200+
    // fornecedores depois do import do xlsx). Sem isso a UI mostra só os
    // primeiros N e o resto fica invisível.
    const PAGE = 1000;
    const out: Parceiro[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseCore
        .from("parceiros")
        .select("*")
        .order("nome")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      out.push(...(data as Parceiro[]));
      if (data.length < PAGE) break;
    }
    return out;
  },
  contasBancarias: () => supabaseCore.from("contas_bancarias").select("*").order("banco").then(unwrap<ContaBancaria[]>),

  /** Saldo bancário ao vivo (saldo_inicial + entradas pagas − saídas pagas).
   *  View core.contas_bancarias_saldo calcula agregado por conta em tempo real. */
  contasBancariasSaldo: () =>
    supabaseCore.from("contas_bancarias_saldo").select("*").order("banco").then(unwrap<ContaBancariaSaldo[]>),

  /** Baixa atômica: muda status pra pago/recebido/conciliado, grava
   *  data_pagamento + conta bancária, dispara audit log. Valida no server
   *  se a conta está ativa e se o lançamento ainda não foi baixado. */
  baixarLancamento: (args: {
    lancId: string; contaBancariaId: string; valorPago: number;
    dataPagamento: string; formaPagamento?: string | null;
    marcarConciliado?: boolean; observacoes?: string | null;
  }) =>
    supabaseCore.rpc("baixar_lancamento", {
      p_lanc_id: args.lancId,
      p_conta_bancaria_id: args.contaBancariaId,
      p_valor_pago: args.valorPago,
      p_data_pagamento: args.dataPagamento,
      p_forma_pagamento: args.formaPagamento ?? null,
      p_marcar_conciliado: args.marcarConciliado ?? false,
      p_observacoes: args.observacoes ?? null,
    }).then((r) => { if (r.error) throw new Error(r.error.message); return r.data as Lancamento; }),

  /** Baixa 1-clique com defaults: última conta usada pra aquela empresa,
   *  data=hoje, valor=valor_previsto, forma=última do parceiro. Persiste
   *  "última usada" em localStorage. Fallback: 1a conta ativa da empresa. */
  baixarLancamentoQuick: async (l: Lancamento, contasElegiveis: ContaBancaria[]) => {
    const LSK_CONTA = `parket-core:last-conta:${l.empresa_id}`;
    const LSK_FORMA = `parket-core:last-forma:${l.parceiro_id || '-'}`;
    const contaSalva = typeof window !== 'undefined' ? localStorage.getItem(LSK_CONTA) : null;
    const contaId = contasElegiveis.find((c) => c.id === contaSalva)?.id
                  || l.conta_bancaria_id
                  || contasElegiveis[0]?.id;
    if (!contaId) throw new Error("nenhuma_conta_ativa_na_empresa");
    const forma = (typeof window !== 'undefined' && localStorage.getItem(LSK_FORMA)) || l.forma_pagamento || "PIX";
    const hoje = new Date().toISOString().slice(0, 10);
    const r = await api.baixarLancamento({
      lancId: l.id, contaBancariaId: contaId,
      valorPago: Number(l.valor), dataPagamento: hoje, formaPagamento: forma,
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem(LSK_CONTA, contaId);
      localStorage.setItem(LSK_FORMA, forma);
    }
    return r;
  },

  /** Estorno: volta lançamento pra 'previsto', limpa data/valor pago, exige
   *  motivo e é gated no server pra role admin (raise permissao_negada senão). */
  estornarLancamento: (lancId: string, motivo: string) =>
    supabaseCore.rpc("estornar_lancamento", { p_lanc_id: lancId, p_motivo: motivo })
      .then((r) => { if (r.error) throw new Error(r.error.message); return r.data as Lancamento; }),

  /** Novo vencimento pra parcela em aberto (Will 28/08: vendedor renegocia
   *  o prazo direto no detalhe). RPC SECURITY DEFINER no Cloud: valida que
   *  o lançamento não foi baixado/cancelado, anota trilha nas observações e
   *  grava audit_log acao=VENCIMENTO. No TERMO- o boleto novo é emitido à
   *  parte (backend docusign) e o watcher re-anota a linha digitável. */
  alterarVencimentoLancamento: (lancId: string, novoVencimento: string, motivo?: string | null) =>
    supabaseCore.rpc("alterar_vencimento_lancamento", {
      p_lanc_id: lancId,
      p_novo_vencimento: novoVencimento,
      p_motivo: motivo ?? null,
    }).then((r) => { if (r.error) throw new Error(r.error.message); return r.data as Lancamento; }),

  /** Audit log de um lançamento específico — histórico de mudanças (INSERT/
   *  UPDATE/DELETE/BAIXA/ESTORNO) pra mostrar linha do tempo no CardDetail. */
  auditLog: (rowId: string, limit = 20) =>
    supabaseCore.from("audit_log")
      .select("*").eq("row_id", rowId)
      .order("id", { ascending: false }).limit(limit)
      .then(unwrap<AuditLogRow[]>),

  // ─── Core v2 (task #1669) — resumo da obra + aditivos + liberação ─
  obrasResumo: () =>
    supabaseCore.from("obra_resumo").select("*").order("venda_total", { ascending: false })
      .then(unwrap<ObraResumo[]>),

  obraResumo: (id: string) =>
    supabaseCore.from("obra_resumo").select("*").eq("id", id).single()
      .then(unwrap<ObraResumo>),

  aditivosPorObra: (obraId: string) =>
    supabaseCore.from("obra_aditivos").select("*").eq("obra_id", obraId).order("numero")
      .then(unwrap<ObraAditivo[]>),

  criarAditivo: (a: { obra_id: string; numero: number; descricao: string;
                       valor: number; data?: string; forma_pagamento?: string | null }) =>
    supabaseCore.from("obra_aditivos").insert(a).select().single()
      .then(unwrap<ObraAditivo>),

  removerAditivo: (id: string) =>
    supabaseCore.from("obra_aditivos").delete().eq("id", id)
      .then((r) => { if (r.error) throw new Error(r.error.message); }),

  /** Força recálculo das liberações proporcionais de RT+comissão. Normalmente
   *  o trigger dispara sozinho na baixa/estorno; expõe-se aqui pra caso de
   *  edição manual das configurações (comissao_pct, rt_percentual, regra) */
  recalcularLiberacoes: (obraId: string) =>
    supabaseCore.rpc("recalcular_liberacoes", { p_obra_id: obraId })
      .then((r) => { if (r.error) throw new Error(r.error.message); return r.data as any; }),

  // ─── Hooks Compras + Prestadores (leitura direta, sem sync) ─────
  /** Pedidos de compra (aprovados/recebidos) — feed da aba Compras. */
  pedidosCompra: () =>
    crossSchemaFetch<Array<{
      id: string; numero: string; fornecedor_id: string | null; status: string;
      data_pedido: string | null; data_recebimento: string | null;
      total: number; observacao: string | null;
    }>>("erp",
      "pedidos_compra?select=id,numero,fornecedor_id,status,data_pedido,data_recebimento,total,observacao&status=in.(APROVADO,ENVIADO,RECEBIDO_PARCIAL,RECEBIDO)&order=data_pedido.desc&limit=500"),

  /** Fornecedores do ERP pra join da aba Compras. */
  erpFornecedores: () =>
    crossSchemaFetch<Array<{ id: string; nome: string; documento: string | null }>>("erp",
      "fornecedores?select=id,nome,documento&limit=2000"),

  /** Pagamentos a prestadores por serviço na obra — feed da aba Prestadores. */
  prestadoresPagamentos: () =>
    spaceFetch<Array<{
      id: string; servico_id: string; prestador_id: string | null;
      prestador_nome: string; periodo: string; qtd: number; valor: number;
      data_pagamento: string | null; status: string; observacao: string | null;
    }>>("prestadores_pagamentos?select=*&order=created_at.desc&limit=500"),

  /** Serviços (join da aba Prestadores pra pegar obra_id do serviço). */
  prestadoresObraServicos: () =>
    spaceFetch<Array<{
      id: string; obra_id: string; descricao: string; valor_unitario: number;
    }>>("prestadores_obra_servicos?select=id,obra_id,descricao,valor_unitario&limit=2000"),

  // ─── Aprovações cross-plataforma (task Will 12/08) ────────────────
  /** erp.contas_receber pendentes (cliente ainda não pagou/registrou). */
  contasReceberPendentes: () =>
    crossSchemaFetch<Array<{
      id: string; numero: string; cliente_id: string | null; descricao: string | null;
      valor: number; data_vencimento: string; data_emissao: string | null;
      status: string; ref_tipo: string | null; ref_id: string | null;
    }>>("erp",
      "contas_receber?select=id,numero,cliente_id,descricao,valor,data_vencimento,data_emissao,status,ref_tipo,ref_id&status=in.(ABERTO,PARCIAL)&order=data_vencimento.asc&limit=500"),

  /** erp.pedidos_compra aguardando aprovação (requer_aprovacao=true). */
  pedidosCompraPendentes: () =>
    crossSchemaFetch<Array<{
      id: string; numero: string; fornecedor_id: string | null; total: number;
      data_pedido: string | null; observacao: string | null; status: string;
      requer_aprovacao: boolean;
    }>>("erp",
      "pedidos_compra?select=id,numero,fornecedor_id,total,data_pedido,observacao,status,requer_aprovacao&status=eq.RASCUNHO&requer_aprovacao=eq.true&order=data_pedido.asc&limit=500"),

  /** public.prestadores_pagamentos pendentes/liberados (aguardando OK financeiro). */
  prestadoresPagamentosPendentes: () =>
    spaceFetch<Array<{
      id: string; servico_id: string; prestador_id: string | null;
      prestador_nome: string; periodo: string; qtd: number; valor: number;
      status: string; observacao: string | null; created_at: string;
    }>>("prestadores_pagamentos?select=*&status=in.(pendente,liberado)&order=created_at.desc&limit=500"),

  // RPCs de aprovação
  aprovarPedidoCompra: (id: string, criaLancamento = true, diasVenc = 30) =>
    supabase.rpc("aprovar_pedido_compra",
      { p_id: id, p_cria_lancamento: criaLancamento, p_dias_vencimento: diasVenc })
      .then((r) => { if (r.error) throw new Error(r.error.message); return r.data as string | null; }),

  rejeitarPedidoCompra: (id: string, motivo: string) =>
    supabase.rpc("rejeitar_pedido_compra", { p_id: id, p_motivo: motivo })
      .then((r) => { if (r.error) throw new Error(r.error.message); }),

  /** public.compras_itens aguardando aprovação Financeiro.
   *  IMPORTANTE: lê direto do Supabase Cloud (não do api.parket.works que é pg-local).
   *  A tabela e os dados vivem no Cloud — mesma que Compras app grava. */
  comprasItensPendentes: async () => {
    // View 019 consolida item + card + fornecedor em 1 GET (antes eram 3).
    const rows = await cloudFetch<any[]>(
      "v_pagamentos_compras?select=*&status=eq.aguardando_aprovacao&order=created_at.asc&limit=500");
    return rows.map((it) => {
      const det = (it.card_details as any) || {};
      const nomeNorm = String(it.material || "").toLowerCase().trim();
      const matLegacy = Array.isArray(det.materiais) ? det.materiais.find((m: any) => String(m.tipo || m.material || "").toLowerCase().trim() === nomeNorm) : null;
      return {
        ...it,
        obra: det.projeto_nome || it.card_obra || it.card_title?.replace(/^Solicitação — /, "").split(" · ")[0] || "—",
        cliente: det.cliente_nome || det.cliente || null,
        solicitante: det.solicitante || det.pedido_por || det.responsavel || null,
        setor: det.setor || null,
        justificativa: matLegacy?.justificativa || it.justificativa || null,
        dados_pagto_obs: det.dados_pagto_obs || null,
        chat_messages: Array.isArray(it.card_chat_messages) ? it.card_chat_messages : [],
        card_title: it.card_title || null, card_dept: it.card_dept_id || null,
        forn_nome: it.fornecedor_nome_snapshot || it.forn_nome_cad || null,
        forn_cnpj: it.forn_snap_cnpj || it.forn_cnpj_cad || null,
        forn_razao: it.forn_snap_razao || it.forn_razao_cad || null,
        forn_banco: it.forn_snap_banco || it.forn_banco_cad || null,
        forn_agencia: it.forn_snap_agencia || it.forn_agencia_cad || null,
        forn_conta: it.forn_snap_conta || it.forn_conta_cad || null,
        forn_pix: it.forn_snap_pix || it.forn_pix_cad || null,
        forn_telefone: it.forn_snap_telefone || null,
        forn_email: it.forn_snap_email || null,
        forn_forma_pgto: it.forn_forma_pgto_cad || null, forn_prazo_pgto: it.forn_prazo_pgto_cad || null,
      };
    });
  },

  /** Cabeçalho dos cards vinculados aos itens (pra mostrar cliente/projeto). */
  comprasItensCardHeaders: (cardIds: string[]) =>
    cardIds.length === 0
      ? Promise.resolve([] as Array<{ id: string; title: string; dept_id: string; obra: string | null; details: Record<string, any> | null }>)
      : spaceFetch<Array<{ id: string; title: string; dept_id: string; obra: string | null; details: Record<string, any> | null }>>(
          `kanban_cards?select=id,title,dept_id,obra,details&id=in.(${cardIds.map((c) => `"${c}"`).join(",")})`
        ),

  /** Dados bancários/CNPJ/PIX dos fornecedores por IDs (pra fila Financeiro pagar). */
  comprasFornecedoresByIds: (ids: string[]) =>
    ids.length === 0
      ? Promise.resolve([] as Array<{ id: string; nome: string; cnpj: string | null; razao_social: string | null; banco: string | null; agencia: string | null; conta: string | null; pix: string | null; forma_pagamento: string | null; prazo_pagamento: string | null; telefone: string | null; email: string | null }>)
      : spaceFetch<Array<{ id: string; nome: string; cnpj: string | null; razao_social: string | null; banco: string | null; agencia: string | null; conta: string | null; pix: string | null; forma_pagamento: string | null; prazo_pagamento: string | null; telefone: string | null; email: string | null }>>(
          `compras_fornecedores?select=id,nome,cnpj,razao_social,banco,agencia,conta,pix,forma_pagamento,prazo_pagamento,telefone,email&id=in.(${ids.map((c) => `"${c}"`).join(",")})`
        ),

  // compras_itens vive no CLOUD — supabase.rpc iria pro pg-local (tabela vazia,
  // dava item_nao_encontrado). Wrappers public.* da migracao 019 com gate is_admin.
  aprovarItemCompra: (id: string, vencOverride?: string, criaLancamento = true) =>
    cloudFetch<{ item_id: string; novo_status: string; lancamento_ids?: string[]; lancamento_id?: string | null; venc?: string | null }>(
      `rpc/aprovar_item_compra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_item_id: id, p_venc_override: vencOverride || null, p_cria_lancamento: criaLancamento }),
      }),

  reprovarItemCompra: (id: string, motivo: string) =>
    cloudFetch<void>(`rpc/reprovar_item_compra`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_item_id: id, p_motivo: motivo }),
    }),

  /** Compras itens em fluxo de pagamento (aprovados / em rota / entregues / faturados / pagos). */
  comprasItensPagamento: async (statusFilter: "a_pagar" | "futuros" | "pagos" | "todos") => {
    const statuses = statusFilter === "pagos" ? ["pago"]
      : statusFilter === "a_pagar" || statusFilter === "futuros" ? ["aprovado","em_rota","entregue","faturado"]
      : ["aprovado","em_rota","entregue","faturado","pago"];
    const inList = statuses.map((s) => `"${s}"`).join(",");
    // View 019 consolida item + card + fornecedor em 1 GET; parcelas vem em 1 RPC.
    const rows = await cloudFetch<any[]>(
      `v_pagamentos_compras?select=*&status=in.(${inList})&order=aprovado_em.desc.nullslast&limit=500`);
    if (rows.length === 0) return [];
    let lancs: any[] = [];
    try {
      lancs = await cloudFetch<any[]>(`rpc/compras_itens_parcelas_bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_item_ids: rows.map((r) => r.id) }),
      });
    } catch {}
    const lancsPorItem = new Map<string, any[]>();
    for (const l of lancs) {
      const arr = lancsPorItem.get(l.compras_item_id) || [];
      arr.push(l);
      lancsPorItem.set(l.compras_item_id, arr);
    }
    return rows.map((it) => {
      const det = (it.card_details as any) || {};
      const parcelas = (lancsPorItem.get(it.id) || []).sort((a, b) => String(a.data_vencimento).localeCompare(String(b.data_vencimento)));
      return {
        ...it,
        obra: det.projeto_nome || it.card_obra || it.card_title?.replace(/^Solicitação — /, "").split(" · ")[0] || "—",
        solicitante: det.solicitante || det.pedido_por || det.responsavel || null,
        setor: det.setor || null,
        dados_pagto_obs: det.dados_pagto_obs || null,
        justificativa: (Array.isArray(det.materiais) ? det.materiais.find((m: any) => String(m.tipo || m.material || "").toLowerCase().trim() === String(it.material || "").toLowerCase().trim())?.justificativa : null) || null,
        chat_messages: Array.isArray(it.card_chat_messages) ? it.card_chat_messages : [],
        card_title: it.card_title || null,
        forn_nome: it.fornecedor_nome_snapshot || it.forn_nome_cad || null,
        forn_cnpj: it.forn_snap_cnpj || it.forn_cnpj_cad || null,
        forn_razao: it.forn_snap_razao || it.forn_razao_cad || null,
        forn_banco: it.forn_snap_banco || it.forn_banco_cad || null,
        forn_agencia: it.forn_snap_agencia || it.forn_agencia_cad || null,
        forn_conta: it.forn_snap_conta || it.forn_conta_cad || null,
        forn_pix: it.forn_snap_pix || it.forn_pix_cad || null,
        forn_telefone: it.forn_snap_telefone || null,
        forn_email: it.forn_snap_email || null,
        parcelas,
        venc: parcelas[0]?.data_vencimento || (it.aprovado_em && it.forma_pagamento === "faturado"
          ? new Date(new Date(it.aprovado_em).getTime() + (Number(it.prazo_faturamento_dias) || 0) * 86400000).toISOString().slice(0,10)
          : it.aprovado_em ? it.aprovado_em.slice(0,10) : null),
      };
    });
  },

  pagarLancamentoCompra: async (lancamentoId: string, comprovanteUrl: string, comprovanteNome?: string) => {
    // RPC vive em Cloud (schema core). Usa wrapper public via cloudFetch — o gateway
    // local (api.parket.works) não tem essa função, então supabase.rpc falharia.
    return await cloudFetch(`rpc/pagar_lancamento_compra`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_lancamento_id: lancamentoId, p_comprovante_url: comprovanteUrl, p_comprovante_nome: comprovanteNome ?? null }),
    });
  },

  anexarBoletoLancamento: async (lancamentoId: string, boletoUrl: string, boletoNome?: string) => {
    await cloudFetch(`rpc/anexar_boleto_lancamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_lancamento_id: lancamentoId, p_boleto_url: boletoUrl, p_boleto_nome: boletoNome ?? null }),
    });
  },

  removerBoletoLancamento: async (lancamentoId: string) => {
    await cloudFetch(`rpc/remover_boleto_lancamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_lancamento_id: lancamentoId }),
    });
  },

  removerComprovanteLancamento: async (lancamentoId: string) => {
    await cloudFetch(`rpc/remover_comprovante_lancamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_lancamento_id: lancamentoId }),
    });
  },

  aprovarPrestadorPagamento: (id: string, criaLancamento = true) =>
    supabase.rpc("aprovar_prestador_pagamento",
      { p_id: id, p_cria_lancamento: criaLancamento })
      .then((r) => { if (r.error) throw new Error(r.error.message); return r.data as string | null; }),

  rejeitarPrestadorPagamento: (id: string, motivo: string) =>
    supabase.rpc("rejeitar_prestador_pagamento", { p_id: id, p_motivo: motivo })
      .then((r) => { if (r.error) throw new Error(r.error.message); }),

  aprovarContaReceber: (args: {
    id: string; contaBancariaId?: string; dataPagamento?: string; valorPago?: number;
  }) =>
    supabase.rpc("aprovar_conta_receber", {
      p_id: args.id,
      p_conta_bancaria_id: args.contaBancariaId ?? null,
      p_data_pagamento: args.dataPagamento ?? null,
      p_valor_pago: args.valorPago ?? null,
    }).then((r) => { if (r.error) throw new Error(r.error.message); return r.data as string; }),

  rejeitarContaReceber: (id: string, motivo: string) =>
    supabase.rpc("rejeitar_conta_receber", { p_id: id, p_motivo: motivo })
      .then((r) => { if (r.error) throw new Error(r.error.message); }),

  // Fretes (public.expedicao_fretes) — só existem no Cloud. Não dá pra usar
  // supabasePublic aqui: ele fala com api.parket.works, que é o pg-local, e lá
  // as tabelas expedicao_* não existem (dava 42P01 relation does not exist).
  expedicaoFretes: async (): Promise<ExpedicaoFrete[]> => {
    const cols = "id,numero,status,cliente_nome,valor_total,data_saida,data_entrega," +
                 "destino_cidade,destino_estado,motorista_nome,obra_id," +
                 "valor_adiantamento1,valor_adiantamento2,valor_saldo," +
                 "adiantamento1_pago,adiantamento2_pago,saldo_pago";
    const out: ExpedicaoFrete[] = [];
    for (let offset = 0; ; offset += 1000) {
      const rows = await cloudFetch<ExpedicaoFrete[]>(
        `expedicao_fretes?select=${cols}&order=created_at.desc&limit=1000&offset=${offset}`);
      out.push(...rows);
      if (rows.length < 1000) break;
    }
    return out;
  },

  /** Obras lidas do Cloud. O seletor de obra do frete precisa vir do mesmo
   *  banco onde vivem os fretes e o core.lancamentos: api.obras() usa o client
   *  padrão (api.parket.works = pg-local), que só tem o esqueleto de core. */
  obrasCloud: () => cloudFetch<Obra[]>("obras?select=*&order=codigo", {
    headers: { "Accept-Profile": "core" },
  }),

  /** Sugestões de obra pra TODOS os fretes órfãos, numa chamada só (SQL 026).
   *  Por linha seriam ~120 idas ao banco; o backend devolve tudo aninhado. */
  sugestoesFretes: () =>
    cloudFetch<FreteSugestoes[]>("rpc/sugerir_obras_fretes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_lim: 4 }),
    }),

  setFreteObra: (freteId: string, obraId: string | null) =>
    cloudFetch<void>(`expedicao_fretes?id=eq.${encodeURIComponent(freteId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ obra_id: obraId }),
    }).then(() => undefined),

  // Fase 2: Fretes + Viagens + RH adiantamentos ─────────────────────
  fretesPendentes: () =>
    supabaseCore.from("fretes_solicitacoes")
      .select("id,solicitante,tipo_frete,origem,destino,transportadora,valor_orcado,data_necessaria,obra_id,observacoes,status")
      .eq("status", "pendente").order("data_necessaria", { ascending: true })
      .then(unwrap<Array<any>>),

  aprovarFrete: (id: string) =>
    supabaseCore.rpc("aprovar_frete", { p_id: id, p_cria_lancamento: true, p_dias_venc: 15 })
      .then((r) => { if (r.error) throw new Error(r.error.message); return r.data as string | null; }),
  rejeitarFrete: (id: string, motivo: string) =>
    supabaseCore.rpc("rejeitar_frete", { p_id: id, p_motivo: motivo })
      .then((r) => { if (r.error) throw new Error(r.error.message); }),

  viagensPendentes: () =>
    supabaseCore.from("viagens")
      .select("id,funcionario_id,obra_id,motivo,destino_cidade,destino_uf,data_ida,data_volta,adiantamento,status")
      .eq("status", "planejada").order("data_ida", { ascending: true })
      .then(unwrap<Array<any>>),

  aprovarViagem: (id: string) =>
    supabaseCore.rpc("aprovar_viagem", { p_id: id, p_cria_lancamento: true })
      .then((r) => { if (r.error) throw new Error(r.error.message); return r.data as string | null; }),
  rejeitarViagem: (id: string, motivo: string) =>
    supabaseCore.rpc("rejeitar_viagem", { p_id: id, p_motivo: motivo })
      .then((r) => { if (r.error) throw new Error(r.error.message); }),

  adiantamentosRhPendentes: () =>
    crossSchemaFetch<Array<{
      id: string; contrato_id: string; valor: number; motivo: string | null;
      solicitado_em: string; status: string; observacao: string | null;
    }>>("rh",
      "adiantamentos?select=id,contrato_id,valor,motivo,solicitado_em,status,observacao&status=eq.pendente&order=solicitado_em.asc&limit=200"),

  rhContratos: () =>
    crossSchemaFetch<Array<{ id: string; colaborador_id: string | null }>>("rh",
      "contratos?select=id,colaborador_id&limit=2000"),
  rhColaboradores: () =>
    crossSchemaFetch<Array<{ id: string; nome: string; cpf: string | null }>>("rh",
      "colaboradores?select=id,nome,cpf&limit=2000"),

  aprovarAdiantamentoRh: (id: string) =>
    supabase.rpc("aprovar_adiantamento_rh", { p_id: id, p_cria_lancamento: true, p_dias_venc: 3 })
      .then((r) => { if (r.error) throw new Error(r.error.message); return r.data as string | null; }),
  rejeitarAdiantamentoRh: (id: string, motivo: string) =>
    supabase.rpc("rejeitar_adiantamento_rh", { p_id: id, p_motivo: motivo })
      .then((r) => { if (r.error) throw new Error(r.error.message); }),

  // Reembolsos (rh.reembolsos — tabela nova, submissão via Core enquanto
  // rh.parket.works não tem formulário do colaborador). ────────────────
  reembolsosPendentes: () =>
    crossSchemaFetch<Array<{
      id: string; colaborador_id: string; data_gasto: string;
      categoria: string; valor: number; descricao: string;
      comprovante_url: string | null; obra_id: string | null;
      status: string; solicitado_por: string; solicitado_em: string;
    }>>("rh",
      "reembolsos?select=id,colaborador_id,data_gasto,categoria,valor,descricao,comprovante_url,obra_id,status,solicitado_por,solicitado_em&status=eq.pendente&order=solicitado_em.asc&limit=200"),

  submeterReembolso: (args: {
    colaboradorId: string; dataGasto: string; categoria: string;
    valor: number; descricao: string; comprovanteUrl?: string;
    obraId?: string; contratoId?: string;
  }) =>
    supabase.rpc("submeter_reembolso", {
      p_colaborador_id: args.colaboradorId,
      p_data_gasto: args.dataGasto,
      p_categoria: args.categoria,
      p_valor: args.valor,
      p_descricao: args.descricao,
      p_comprovante_url: args.comprovanteUrl ?? null,
      p_obra_id: args.obraId ?? null,
      p_contrato_id: args.contratoId ?? null,
    }).then((r) => { if (r.error) throw new Error(r.error.message); return r.data as string; }),

  aprovarReembolso: (id: string) =>
    supabase.rpc("aprovar_reembolso", { p_id: id, p_cria_lancamento: true, p_dias_venc: 3 })
      .then((r) => { if (r.error) throw new Error(r.error.message); return r.data as string | null; }),
  rejeitarReembolso: (id: string, motivo: string) =>
    supabase.rpc("rejeitar_reembolso", { p_id: id, p_motivo: motivo })
      .then((r) => { if (r.error) throw new Error(r.error.message); }),

  /** Totais pendentes por aba de /aprovacoes — HEAD count=exact, uma req por
   *  aba, sem baixar linhas. Usado pelo badge na sidebar. */
  aprovacoesPendingCounts: async (): Promise<{
    receber: number; prestadores: number; compras: number;
    fretes: number; viagens: number; rh: number; reembolsos: number;
    custos: number; total: number;
  }> => {
    // Custos de Terceiros: a fila vive na API do gestao (PG local), não no
    // PostgREST — conta os items retornados (LIMIT 500 é mais que suficiente).
    const custosCount = async () => {
      try {
        const r = await gestaoFetch<{ items: any[] }>("/lancamentos?fila=true");
        return r.items.length;
      } catch { return 0; }
    };
    // compras_itens vive no Cloud (Supabase), não em pg-local — usa cloudFetch.
    const cloudCountCompras = async () => {
      try {
        const r = await fetch(`${CLOUD_URL}/rest/v1/compras_itens?select=id&status=eq.aguardando_aprovacao`, {
          headers: { apikey: CLOUD_ANON, Authorization: `Bearer ${CLOUD_ANON}`, Prefer: "count=exact" },
        });
        const cr = r.headers.get("content-range") || "";
        return Number(cr.split("/")[1]) || 0;
      } catch { return 0; }
    };
    const [receber, prestadores, comprasPedidos, comprasItens, fretes, viagens, rh, reembolsos, custos] = await Promise.all([
      crossSchemaCount("erp",    "contas_receber?status=in.(ABERTO,PARCIAL)"),
      crossSchemaCount("public", "prestadores_pagamentos?status=in.(pendente,liberado)"),
      crossSchemaCount("erp",    "pedidos_compra?requer_aprovacao=eq.true&status=eq.pendente"),
      cloudCountCompras(),
      cloudCountCore("fretes_solicitacoes?status=eq.pendente"),
      cloudCountCore("viagens?status=eq.planejada"),
      crossSchemaCount("rh",     "adiantamentos?status=eq.pendente"),
      crossSchemaCount("rh",     "reembolsos?status=eq.pendente"),
      custosCount(),
    ]);
    const compras = comprasPedidos + comprasItens;
    return {
      receber, prestadores, compras, fretes, viagens, rh, reembolsos, custos,
      total: receber + prestadores + compras + fretes + viagens + rh + reembolsos + custos,
    };
  },

  obras: () => supabaseCore.from("obras").select("*").order("codigo").then(unwrap<Obra[]>),
  // _limit ignorado de propósito: PostgREST tem max-rows e o .limit() antigo
  // capava silenciosamente em 1000. Pagina em batches até esgotar.
  lancamentos: async (_limit?: number): Promise<Lancamento[]> => {
    const PAGE = 1000;
    const out: Lancamento[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseCore
        .from("lancamentos")
        .select("*")
        .order("data_vencimento", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      out.push(...(data as Lancamento[]));
      if (data.length < PAGE) break;
    }
    return out;
  },
  comissoes: () => supabaseCore.from("comissoes").select("*").then(unwrap<Comissao[]>),
  comissaoRegras: () => supabaseCore.from("comissao_regras").select("*").then(unwrap<ComissaoRegra[]>),
  comissaoFaixas: () => supabaseCore.from("comissao_faixas").select("*").order("volume_min").then(unwrap<ComissaoFaixa[]>),
  rts: () => supabaseCore.from("rts").select("*").order("created_at", { ascending: false }).then(unwrap<RT[]>),
  rtLiberacoes: () => supabaseCore.from("rt_liberacoes").select("*").order("data_liberacao", { ascending: false }).then(unwrap<RTLiberacao[]>),
  impostos: () => supabaseCore.from("impostos").select("*").order("vencimento", { ascending: false }).then(unwrap<Imposto[]>),
  funcionarios: () => supabaseCore.from("funcionarios").select("*").order("nome").then(unwrap<Funcionario[]>),
  viagens: () => supabaseCore.from("viagens").select("*").order("data_ida", { ascending: false }).then(unwrap<Viagem[]>),

  // Mutations genéricas
  insert: <T,>(table: string, data: any) =>
    supabaseCore.from(table).insert(data).select().single().then(unwrap<T>),
  insertMany: <T,>(table: string, rows: any[]) =>
    supabaseCore.from(table).insert(rows).select().then(unwrap<T[]>),
  update: <T,>(table: string, id: string, data: any) =>
    supabaseCore.from(table).update(data).eq("id", id).select().single().then(unwrap<T>),
  remove: (table: string, id: string) =>
    supabaseCore.from(table).delete().eq("id", id).then((r) => { if (r.error) throw new Error(r.error.message); }),

  // Integração com Space (schema public via fetch direto — ver spaceFetch)
  spaceObras: () =>
    spaceFetch<SpaceObra[]>("obras?select=id,cliente,localizacao,regiao,status,data_finalizacao,valor_num&order=id.desc&limit=2000"),

  // ── Contratos assinados (public.contratos_docusign, espelhados no Core
  //    pela perna 6 do compras-contratos-watcher via numero_documento CT-<id>) ──
  contratosAssinados: () =>
    spaceFetch<ContratoAssinado[]>(
      "contratos_docusign?select=id,card_id,titulo,status,sent_at,completed_at,signatarios&status=eq.assinado&order=completed_at.desc.nullslast",
    ),

  lancamentosContrato: () =>
    supabaseCore.from("lancamentos").select("*").like("numero_documento", "CT-%")
      .order("data_vencimento").then(unwrap<Lancamento[]>),

  spacePrestadores: () =>
    spaceFetch<{ id: string; nome: string; telefone: string | null; categoria: string | null; ativo: boolean }[]>(
      "prestadores?select=id,nome,telefone,categoria,ativo&ativo=eq.true&order=nome",
    ),

  // ── Usuários do Space (public.user_profiles) ──
  spaceUsers: () =>
    spaceFetch<SpaceUser[]>(
      "user_profiles?select=id,email,full_name,role,dept_permissions,avatar_color,created_at,updated_at&order=full_name",
    ),

  updateSpaceUser: (id: string, patch: Partial<SpaceUser>) =>
    spaceFetch<SpaceUser>(
      `user_profiles?id=eq.${id}`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) },
    ).then((arr: any) => Array.isArray(arr) ? arr[0] : arr),

  // ── Sincronização Space → Core ──
  /**
   * Espelha as obras do Space (public.obras) em core.obras.
   * - Match por space_id (PKT id) — se existe, atualiza dados; se não, cria.
   * - Empresa/Centro de Custo padrão: pega o 1º ativo (user pode editar depois).
   * Retorna { created, updated, skipped }.
   */
  syncObrasFromSpace: async (defaultEmpresaId: string, defaultCcId: string) => {
    const [spaceList, coreList] = await Promise.all([api.spaceObras(), api.obras()]);
    const existing = new Map<string, Obra>();
    for (const o of coreList) if (o.space_id) existing.set(o.space_id, o);

    let created = 0, updated = 0;
    for (const so of spaceList) {
      const ex = existing.get(so.id);
      const status = so.status === "finalizado" ? "concluida"
        : so.status === "travado" ? "em_andamento"
        : so.status === "aguardando" ? "contratada"
        : "em_andamento";
      const payload: any = {
        space_id: so.id,
        codigo: so.id,
        nome: so.cliente,
        cidade: so.localizacao || null,
        uf: so.regiao || null,
        status,
        data_termino: so.data_finalizacao,
        valor_venda: so.valor_num || 0,
      };
      if (ex) {
        await api.update("obras", ex.id, payload);
        updated++;
      } else {
        await api.insert("obras", { ...payload, empresa_id: defaultEmpresaId, centro_custo_id: defaultCcId });
        created++;
      }
    }
    return { created, updated, total: spaceList.length };
  },

  /**
   * Espelha prestadores do Space → core.parceiros como fornecedor.
   * - Match por space_prestador_id; cria com is_fornecedor=true.
   */
  syncPrestadoresFromSpace: async () => {
    const [sp, parceiros] = await Promise.all([api.spacePrestadores(), api.parceiros()]);
    const existing = new Map<string, Parceiro>();
    for (const p of parceiros) if (p.space_prestador_id) existing.set(p.space_prestador_id, p);

    let created = 0, updated = 0;
    for (const s of sp) {
      const ex = existing.get(s.id);
      const payload: any = {
        space_prestador_id: s.id,
        nome: s.nome,
        telefone: s.telefone,
        observacoes: s.categoria ? `Categoria Space: ${s.categoria}` : null,
        is_fornecedor: true,
        tipo_pessoa: "PF",
        ativo: s.ativo,
      };
      if (ex) {
        await api.update("parceiros", ex.id, payload);
        updated++;
      } else {
        await api.insert("parceiros", payload);
        created++;
      }
    }
    return { created, updated, total: sp.length };
  },

  /**
   * Após criar/atualizar um lançamento ligado a uma obra do Space,
   * publica um sumário no card do Operacional (kanban_cards.details.financeiro[]).
   * Não bloqueia se falhar.
   */
  pushLancamentoToSpaceCard: async (l: Lancamento) => {
    if (!l.obra_id) return;
    const ob = await supabaseCore.from("obras").select("space_id, codigo, nome").eq("id", l.obra_id).maybeSingle();
    const spaceId = ob.data?.space_id;
    if (!spaceId) return;
    const cards = await spaceFetch<Array<{ id: string; details: any }>>(
      `kanban_cards?select=id,details&dept_id=eq.operacional&obra=eq.${encodeURIComponent(spaceId)}&limit=1`,
    );
    const card = cards[0];
    if (!card) return;
    const cur = card.details || {};
    const list: any[] = Array.isArray(cur.financeiro) ? cur.financeiro : [];
    const idx = list.findIndex((x) => x.lancamento_id === l.id);
    const entry = {
      lancamento_id: l.id,
      tipo: l.tipo,
      status: l.status,
      descricao: l.descricao,
      valor: Number(l.valor),
      valor_pago: l.valor_pago != null ? Number(l.valor_pago) : null,
      data_vencimento: l.data_vencimento,
      data_pagamento: l.data_pagamento,
      atualizado_em: new Date().toISOString(),
    };
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    await spaceFetch(`kanban_cards?id=eq.${card.id}`, {
      method: "PATCH",
      body: JSON.stringify({ details: { ...cur, financeiro: list }, updated_at: new Date().toISOString() }),
    });
  },
};
