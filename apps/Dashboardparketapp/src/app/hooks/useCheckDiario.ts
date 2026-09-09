/**
 * useCheckDiario — Motor de check diário de obras via WhatsApp.
 * Anti-bloqueio: 25+ templates, delay randômico 45-150s, personalização.
 * Classificação de respostas via webhook (Claude no backend).
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const EVO_URL = "https://conect.parket.works";

export const OBRAS_EVO_CONFIG = {
  instance: "Parket",
  apiKey: "4eab105201410d6865b86dca76ee9fa3",
};

export let GRUPO_OBRAS_JID = "";
export function setGrupoObrasJid(jid: string) { GRUPO_OBRAS_JID = jid; }

const TEMPLATES_BOM_DIA = [
  (nome: string, obra: string) => `Bom dia ${nome}! Como está a obra ${obra} hoje? Tudo certo ou tem alguma ocorrência?`,
  (nome: string, obra: string) => `Olá ${nome}, bom dia! Passando pra saber como tá andando a ${obra}. Alguma novidade?`,
  (nome: string, obra: string) => `E aí ${nome}, bom dia! Como tá o andamento da obra ${obra}? Tudo tranquilo?`,
  (nome: string, obra: string) => `Bom dia ${nome}! Tudo bem? Como está o serviço na ${obra} hoje?`,
  (nome: string, obra: string) => `Oi ${nome}! Bom dia. A obra ${obra} tá fluindo bem? Precisa de algo?`,
  (nome: string, obra: string) => `Bom dia ${nome}! Como vai o trabalho na ${obra}? Algum problema ou ocorrência?`,
  (nome: string, obra: string) => `Olá ${nome}! Tudo certo aí na ${obra}? Me atualiza por favor 👍`,
  (nome: string, obra: string) => `Bom dia ${nome}, como está o progresso na obra ${obra}? Alguma pendência?`,
  (nome: string, obra: string) => `E aí ${nome}! Bom dia! A ${obra} tá dentro do planejado? Me dá um retorno`,
  (nome: string, obra: string) => `Oi ${nome}, bom dia! Preciso de uma atualização da ${obra}. Como tá?`,
  (nome: string, obra: string) => `Bom dia ${nome}! Passando aqui pra check diário. A obra ${obra} tá ok?`,
  (nome: string, obra: string) => `${nome}, bom dia! Me manda um status da ${obra} por favor. Tudo certo?`,
  (nome: string, obra: string) => `Bom dia! ${nome}, como vai aí na ${obra}? Material ok? Equipe completa?`,
  (nome: string, obra: string) => `Oi ${nome}! Começando o dia. Como está a situação na ${obra}?`,
  (nome: string, obra: string) => `Bom dia ${nome}! Fazendo o check do dia. A ${obra} está em ordem?`,
  (nome: string, obra: string) => `E aí ${nome}, tudo bem? Queria saber se a obra ${obra} tá andando sem problemas`,
  (nome: string, obra: string) => `Bom dia ${nome}! Alguma atualização da ${obra} pra hoje?`,
  (nome: string, obra: string) => `Olá ${nome}, bom dia! Check diário: como tá a ${obra}? Tudo ok ou tem algo?`,
  (nome: string, obra: string) => `Bom dia ${nome}! Me dá uma posição da obra ${obra}. Tá tudo fluindo?`,
  (nome: string, obra: string) => `${nome}! Bom dia. Obra ${obra}: alguma ocorrência ou segue tudo bem?`,
  (nome: string, obra: string) => `Oi ${nome}, bom dia! Rápido check: como tá a ${obra} hoje?`,
  (nome: string, obra: string) => `Bom dia ${nome}! Verificação diária da ${obra}. Pode me atualizar?`,
  (nome: string, obra: string) => `E aí ${nome}! Tudo certo na ${obra}? Se precisar de algo avisa`,
  (nome: string, obra: string) => `Bom dia ${nome}! O serviço na ${obra} começou bem hoje?`,
  (nome: string, obra: string) => `Olá ${nome}! Check da manhã: ${obra} tá dentro do esperado?`,
];

function pickTemplate(prestadorId: string, lastUsed: Map<string, number>): number {
  const last = lastUsed.get(prestadorId) ?? -1;
  let idx: number;
  do { idx = Math.floor(Math.random() * TEMPLATES_BOM_DIA.length); } while (idx === last && TEMPLATES_BOM_DIA.length > 1);
  lastUsed.set(prestadorId, idx);
  return idx;
}

function randomDelay(): number { return 45000 + Math.floor(Math.random() * 105000); }
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export interface CheckDiario {
  id: string; data: string; obra_id: string; obra_titulo: string; obra_codigo: string | null;
  prestador_id: string; prestador_nome: string; prestador_telefone: string | null; prestador_categoria: string | null;
  status: "pendente" | "enviado" | "ok" | "ocorrencia" | "sem_resposta" | "erro_envio";
  mensagem_enviada: string | null; resposta: string | null;
  ocorrencia_texto: string | null; ocorrencia_gravidade: string | null;
  alerta_criado: boolean; enviado_em: string | null; respondido_em: string | null; created_at: string;
}

export interface DisparoProgress { total: number; enviados: number; erros: number; atual: string; running: boolean; }

export function useCheckDiario(data?: string) {
  const hoje = data || new Date().toISOString().split("T")[0];
  const [checks, setChecks] = useState<CheckDiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [progresso, setProgresso] = useState<DisparoProgress>({ total: 0, enviados: 0, erros: 0, atual: "", running: false });
  const abortRef = { current: false };

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabase.from("obras_check_diario").select("*").eq("data", hoje).order("obra_titulo").order("prestador_nome");
    setChecks(rows ?? []);
    setLoading(false);
  }, [hoje]);

  useEffect(() => { load(); }, [load]);

  const total = checks.length;
  const pendentes = checks.filter(c => c.status === "pendente").length;
  const enviados = checks.filter(c => c.status === "enviado").length;
  const oks = checks.filter(c => c.status === "ok").length;
  const ocorrencias = checks.filter(c => c.status === "ocorrencia").length;
  const semResposta = checks.filter(c => c.status === "sem_resposta").length;
  const erros = checks.filter(c => c.status === "erro_envio").length;

  async function gerarChecksDoDia() {
    const { data: cards } = await supabase.from("kanban_cards").select("id,title,obra,details").eq("dept_id", "obras").not("column_id", "in", '("finalizado","arquivado","concluido")');
    if (!cards) return;
    const registros: any[] = [];
    for (const card of cards) {
      const det = (card.details ?? {}) as Record<string, any>;
      const prestadores: any[] = det.prestadores ?? [];
      for (const p of prestadores) {
        if (!p.telefone) continue;
        registros.push({ data: hoje, obra_id: card.id, obra_titulo: card.title, obra_codigo: card.obra || null, prestador_id: p.id, prestador_nome: p.nome, prestador_telefone: p.telefone, prestador_categoria: p.categoria || null, status: "pendente" });
      }
    }
    if (registros.length === 0) return;
    await supabase.from("obras_check_diario").upsert(registros, { onConflict: "data,obra_id,prestador_id", ignoreDuplicates: true });
    await load();
  }

  async function dispararMensagens() {
    abortRef.current = false;
    const pendingChecks = checks.filter(c => c.status === "pendente" && c.prestador_telefone);
    if (pendingChecks.length === 0) return;
    setProgresso({ total: pendingChecks.length, enviados: 0, erros: 0, atual: "", running: true });
    const lastUsed = new Map<string, number>();
    for (let i = 0; i < pendingChecks.length; i++) {
      if (abortRef.current) break;
      const check = pendingChecks[i];
      const templateIdx = pickTemplate(check.prestador_id, lastUsed);
      const msg = TEMPLATES_BOM_DIA[templateIdx](check.prestador_nome, check.obra_titulo);
      setProgresso(p => ({ ...p, atual: `${check.prestador_nome} — ${check.obra_titulo}`, enviados: i }));
      try {
        const phone = formatPhone(check.prestador_telefone!);
        const res = await fetch(`${EVO_URL}/message/sendText/${OBRAS_EVO_CONFIG.instance}`, {
          method: "POST", headers: { "Content-Type": "application/json", apikey: OBRAS_EVO_CONFIG.apiKey },
          body: JSON.stringify({ number: phone, text: msg }),
        });
        if (res.ok) {
          await supabase.from("obras_check_diario").update({ status: "enviado", mensagem_enviada: msg, enviado_em: new Date().toISOString() }).eq("id", check.id);
        } else {
          await supabase.from("obras_check_diario").update({ status: "erro_envio" }).eq("id", check.id);
          setProgresso(p => ({ ...p, erros: p.erros + 1 }));
        }
      } catch {
        await supabase.from("obras_check_diario").update({ status: "erro_envio" }).eq("id", check.id);
        setProgresso(p => ({ ...p, erros: p.erros + 1 }));
      }
      if (i < pendingChecks.length - 1 && !abortRef.current) {
        const delay = randomDelay();
        setProgresso(p => ({ ...p, atual: `Aguardando ${Math.round(delay / 1000)}s antes do próximo envio…` }));
        await new Promise(r => setTimeout(r, delay));
      }
    }
    setProgresso(p => ({ ...p, running: false, enviados: pendingChecks.length - p.erros, atual: "Concluído" }));
    await load();
  }

  function cancelarDisparo() { abortRef.current = true; }

  async function marcarStatus(checkId: string, status: "ok" | "ocorrencia", resposta?: string, ocorrenciaTexto?: string, gravidade?: string) {
    const updates: any = { status, resposta: resposta || null, respondido_em: new Date().toISOString() };
    if (status === "ocorrencia") { updates.ocorrencia_texto = ocorrenciaTexto || resposta; updates.ocorrencia_gravidade = gravidade || "media"; }
    await supabase.from("obras_check_diario").update(updates).eq("id", checkId);
    await load();
  }

  async function marcarSemResposta() {
    await supabase.from("obras_check_diario").update({ status: "sem_resposta" }).eq("data", hoje).eq("status", "enviado");
    await load();
  }

  // Realtime: escuta mudanças na tabela (webhook do backend atualiza direto)
  useEffect(() => {
    const channel = supabase.channel("check_diario_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "obras_check_diario" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // Timeout 30 min
  useEffect(() => {
    const envs = checks.filter(c => c.status === "enviado");
    if (envs.length === 0) return;
    const interval = setInterval(async () => {
      const agora = Date.now();
      for (const check of envs) {
        if (!check.enviado_em) continue;
        if ((agora - new Date(check.enviado_em).getTime()) / 60000 >= 30) {
          await supabase.from("obras_check_diario").update({ status: "sem_resposta", respondido_em: new Date().toISOString() }).eq("id", check.id).eq("status", "enviado");
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [checks]);

  const porObra = new Map<string, { obra_id: string; obra_titulo: string; obra_codigo: string | null; checks: CheckDiario[] }>();
  for (const c of checks) {
    const existing = porObra.get(c.obra_id) || { obra_id: c.obra_id, obra_titulo: c.obra_titulo, obra_codigo: c.obra_codigo, checks: [] };
    existing.checks.push(c);
    porObra.set(c.obra_id, existing);
  }

  async function enviarRelatorio() {
    // Relatório manual enviado via grupo (se configurado)
    if (!GRUPO_OBRAS_JID) return;
    let msg = `📊 *RELATÓRIO CHECK DIÁRIO — ${hoje}*\n\n✅ *${oks}* OK · ⚠️ *${ocorrencias}* Ocorrência(s) · ⏳ *${semResposta}* Sem resposta\n📋 Total: ${total} verificados`;
    const ocs = checks.filter(c => c.status === "ocorrencia");
    if (ocs.length > 0) { msg += "\n\n🚨 *OCORRÊNCIAS:*"; for (const o of ocs) msg += `\n• *${o.obra_titulo}* — ${o.prestador_nome}: ${o.ocorrencia_texto || "—"}`; }
    msg += "\n\n_Relatório Parket Obras_";
    await fetch(`${EVO_URL}/message/sendText/${OBRAS_EVO_CONFIG.instance}`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: OBRAS_EVO_CONFIG.apiKey },
      body: JSON.stringify({ number: GRUPO_OBRAS_JID, text: msg }),
    });
  }

  return { checks, loading, hoje, resumo: { total, pendentes, enviados, oks, ocorrencias, semResposta, erros },
    porObra: [...porObra.values()], progresso, gerarChecksDoDia, dispararMensagens, cancelarDisparo,
    marcarStatus, marcarSemResposta, reload: load, enviarRelatorio };
}

/** Hook separado para histórico/relatórios por prestador */
export interface PrestadorHistorico {
  prestador_id: string; prestador_nome: string; prestador_telefone: string | null; prestador_categoria: string | null;
  total_checks: number; total_ok: number; total_ocorrencias: number; total_sem_resposta: number;
  pct_ok: number; pct_ocorrencia: number; primeiro_check: string; ultimo_check: string;
  dias_verificados: number; obras_distintas: number;
}

export function useHistoricoPrestadores() {
  const [historico, setHistorico] = useState<PrestadorHistorico[]>([]);
  const [detalhe, setDetalhe] = useState<CheckDiario[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("vw_prestador_historico").select("*").order("total_checks", { ascending: false });
    setHistorico(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function carregarDetalhe(prestadorId: string) {
    const { data } = await supabase.from("obras_check_diario").select("*").eq("prestador_id", prestadorId).order("data", { ascending: false }).limit(50);
    setDetalhe(data ?? []);
  }

  return { historico, detalhe, loading, reload: load, carregarDetalhe };
}
