import { useEffect, useState } from "react";
import { supabase, supabaseCore, coreReady } from "./supabase";

export function useFetch<T>(fn: () => Promise<T> | PromiseLike<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
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

// Tipos minimalistas (vão sendo expandidos por componente)
export type Empresa = {
  id: string; cnpj: string; razao_social: string; nome_fantasia: string | null;
  cidade: string | null; uf: string | null; ativo: boolean;
};

export type Colaborador = {
  id: string;
  external_id_convenia: string | null;
  user_id: string | null;
  nome: string;
  nome_social: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  estado_civil: string | null;
  raca_cor: string | null;
  email_pessoal: string | null;
  email_profissional: string | null;
  celular: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  status_dados: string;
  qtd_dependentes_ir: number | null;
  foto_url: string | null;
  observacoes: string | null;
  created_at: string;
};

export type Contrato = {
  id: string;
  colaborador_id: string;
  empresa_id: string;
  matricula: string | null;
  cargo_id: string | null;
  departamento_id: string | null;
  time_id: string | null;
  salario_base: number;
  data_admissao: string;
  data_demissao: string | null;
  vinculo: string | null;
  tipo_contrato: string;
  status: string;
  senioridade: string | null;
  nivel_senioridade: string | null;
};

export type Cargo = { id: string; empresa_id: string; nome: string; salario_base_default: number | null };
export type Departamento = { id: string; empresa_id: string; nome: string };
export type Time = { id: string; empresa_id: string; departamento_id: string | null; nome: string };

export type Admissao = {
  id: string;
  empresa_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cargo_id: string | null;
  departamento_id: string | null;
  data_admissao_prevista: string | null;
  salario_proposto: number | null;
  etapa: string;
  preenchido_em: string | null;
  contrato_assinado_em: string | null;
  aprovado_em: string | null;
  rejeitado_motivo: string | null;
  token: string;
  token_expira_em: string | null;
  created_at: string;
  form_data: any | null;
};

export type FeriasSolicitacao = {
  id: string;
  contrato_id: string;
  inicio: string;
  fim: string;
  dias: number;
  status: string;
  solicitado_em: string;
};

/** Manda WhatsApp via Agente RH (Evolution API). Sem expor API key. */
export async function sendWhatsAppViaAgent(opts: {
  telefone: string; mensagem: string;
  colaborador_id?: string; documento_id?: string;
}): Promise<{ ok: boolean; message_id?: string; telefone_normalizado?: string; error?: string }> {
  const r = await fetch("https://agente.parket.works/api/rh-whatsapp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { ok: false, error: `HTTP ${r.status} ${t.slice(0, 200)}` };
  }
  return r.json();
}

// === CLICKSIGN ===
// API exposta no próprio domínio rh.parket.works (nginx proxy → backend interno)
const CLICKSIGN_BASE = "/api/clicksign";

export type ClicksignEnvioResult = {
  documento_emitido_id: string;
  envelope_id: string;
  signer_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  modelo_id: string;
  modelo_titulo: string;
  signer_url: string;
  whatsapp?: { ok: boolean; status?: number; error?: string; skip?: boolean } | null;
};

export type ClicksignEnviarResp = {
  ok: boolean;
  total_enviados: number;
  total_erros: number;
  resultados: ClicksignEnvioResult[];
  erros: Array<{ modelo_id: string; modelo_titulo: string; colaborador_id: string; colaborador_nome: string; erro: string }>;
};

export const clicksign = {
  async enviar(body: {
    modelo_ids: string[];
    colaborador_ids: string[];
    campos_extras?: Record<string, any>;
    auto_close?: boolean;
    deadline_dias?: number;
    remind_interval?: number;
    enviar_whatsapp?: boolean;
    mensagem_whatsapp?: string;
    auth_methods?: string[];
    lote_titulo?: string;
    incluir_testemunha?: boolean;
  }): Promise<ClicksignEnviarResp & { lote_id: string; lote_titulo: string }> {
    const r = await fetch(`${CLICKSIGN_BASE}/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status}: ${t.slice(0, 300)}`);
    }
    return r.json();
  },

  async envios(params: { status?: string; colaborador_id?: string; limit?: number } = {}): Promise<{ items: any[]; count: number }> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.colaborador_id) qs.set("colaborador_id", params.colaborador_id);
    if (params.limit) qs.set("limit", String(params.limit));
    const r = await fetch(`${CLICKSIGN_BASE}/envios?${qs}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },

  pdfUrl: (envioId: string) => `${CLICKSIGN_BASE}/envios/${envioId}/pdf-assinado`,

  async eventos(envioId: string) {
    const r = await fetch(`${CLICKSIGN_BASE}/envios/${envioId}/eventos`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },

  async healthcheck() {
    const r = await fetch(`${CLICKSIGN_BASE}/healthcheck`);
    return r.ok ? r.json() : { ok: false };
  },
};

export const api = {
  // CORE
  empresas: async () => {
    await coreReady;
    return supabaseCore.from("empresas").select("*").order("razao_social").then(unwrap<Empresa[]>);
  },

  // RH
  colaboradores: () => supabase.from("colaboradores").select("*").is("deleted_at", null).order("nome").then(unwrap<Colaborador[]>),
  // Só colaboradores com pelo menos 1 contrato ATIVO — usado em telas de envio
  // de documentos (Documentos/Contratos/Holerites). Desligados ficam fora.
  colaboradoresAtivos: async (): Promise<Colaborador[]> => {
    const [colabsRes, contratosRes] = await Promise.all([
      supabase.from("colaboradores").select("*").is("deleted_at", null).order("nome"),
      supabase.from("contratos").select("colaborador_id,status").is("deleted_at", null).eq("status", "ativo"),
    ]);
    if (colabsRes.error) throw new Error(colabsRes.error.message);
    if (contratosRes.error) throw new Error(contratosRes.error.message);
    const ativos = new Set((contratosRes.data || []).map((c: any) => c.colaborador_id));
    return (colabsRes.data || []).filter((c: any) => ativos.has(c.id)) as Colaborador[];
  },
  colaborador: (id: string) => supabase.from("colaboradores").select("*").eq("id", id).single().then(unwrap<Colaborador>),
  contratos: () => supabase.from("contratos").select("*").is("deleted_at", null).then(unwrap<Contrato[]>),
  contratosByColab: (colab_id: string) =>
    supabase.from("contratos").select("*").eq("colaborador_id", colab_id).is("deleted_at", null).then(unwrap<Contrato[]>),
  cargos: () => supabase.from("cargos").select("*").eq("ativo", true).order("nome").then(unwrap<Cargo[]>),
  departamentos: () => supabase.from("departamentos").select("*").eq("ativo", true).order("nome").then(unwrap<Departamento[]>),
  times: () => supabase.from("times").select("*").eq("ativo", true).order("nome").then(unwrap<Time[]>),
  admissoes: () => supabase.from("admissoes").select("*").order("created_at", { ascending: false }).then(unwrap<Admissao[]>),
  feriasSolicitacoes: () =>
    supabase.from("ferias_solicitacoes").select("*").order("solicitado_em", { ascending: false }).then(unwrap<FeriasSolicitacao[]>),
};
