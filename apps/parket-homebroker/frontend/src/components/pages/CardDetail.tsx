/**
 * CardDetail — detalhe do lead com accordions compactos + chat lateral grande.
 * Reaproveita TODOS os campos de `kanban_cards.details` (mesma fonte do Space).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, Activity, User, Briefcase, Target,
  Flame, ChevronDown, ChevronRight, Tag, ExternalLink, CalendarDays,
  Brain, Bot, FileBarChart, Calculator, Database, Package, ListTodo,
  Phone, ClipboardCheck, Paperclip, DollarSign, Link2, Trash2, Plus, Check, X, Pencil, FileText, Image as ImageIcon,
  MessageSquare, ArrowRight as ArrowRightIcon, XCircle, Trophy, Star, FolderOpen,
} from "lucide-react";
import { api, DEPT_COMERCIAL, type KanbanCard, type CardMovement, type SolicitacaoOrcamento, type OrcamentistaEquipe } from "../../lib/api";
import { supabase, supabaseValoria } from "../../lib/supabase";
// Mesma conta de valor usada no card do Pipeline (/book/vendas): bruto dos itens
// menos desconto mais frete. Fonte unica pra proposta nao divergir entre telas.
import { totalDaSim } from "../../lib/propostaValor";
import { uploadAnexo } from "../../lib/anexo-upload";
import { DrivePanel } from "./DrivePanel";
import { gerarHTMLContrato, abrirContratoParaImpressao } from "../../lib/contratoGenerator";
import { fmtDateTime, fmtRelative, fmtBRL, parseValueText } from "../../lib/format";
import { ChatPanel } from "../ChatPanel";
import { CriarAgendamentoModal } from "./Agendamentos";
import { SolicitarOrcamentoModal } from "./SolicitarOrcamentoModal";
import { SolicitarAmostraModal } from "./SolicitarAmostraModal";
import { TarefaModal } from "./AgendaTarefasPanel";
import { PIPELINE_TAG_GROUPS, TagChip, TagsSelectorPopover } from "./Book";
import { CondominioInput } from "../CondominioInput";
import { canDeleteCard, type AppUser } from "../../lib/auth";

// Defaults do Pagamento — copiados da golden do Space (dept-layout-v2-DWGFIX1)
const PAG_DEFAULTS = {
  forma_pagamento: "A combinar",
  pag_garantia: "10 anos",
  pag_prazo_entrega: "120 dias após a contratação",
  pag_prazo_execucao: "120 dias após a entrega do material",
  pag_dados_bancarios: "Banco Itaú | Agencia 3720 CC 30.288-8 | PIX: pamella@parket.com.br",
  pag_razao_social: "Mundial Export Assess. Com. e Ext. Imp e Exp Eireli | CNPJ 29.872.616/0001-34",
};

type AnexoItem = {
  name: string; url: string; type: string; size: number; uploaded_at: string;
  uploaded_by?: string; kind?: "file" | "link";
  storage?: "drive" | "supabase"; // onde o arquivo mora (drive = pasta do cliente)
  drive_file_id?: string;         // id do arquivo no Drive (so storage=drive)
};
type PropostaValoria = { id: string; numero: number; url_publica: string; created_at: string; card_id_valoria?: string; sim_id?: string; cloud_sim_id?: string; valor_total?: number };

// Meta visual das observações do Tracking — usado no accordion "Observações Tracking".
const OBS_KIND_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  match:    { label: "MATCH",    cls: "bg-hb-red/10 text-hb-red border border-hb-red/30",       icon: <Flame size={9} /> },
  cadencia: { label: "CADÊNCIA", cls: "bg-hb-accent/10 text-hb-accent border border-hb-accent/30", icon: <Check size={9} /> },
  move:     { label: "AVANÇO",   cls: "bg-hb-blue/10 text-hb-blue border border-hb-blue/30",    icon: <ArrowRightIcon size={9} /> },
  win:      { label: "GANHO",    cls: "bg-hb-green/10 text-hb-green border border-hb-green/30", icon: <Trophy size={9} /> },
  lost:     { label: "PERDA",    cls: "bg-hb-red/10 text-hb-red border border-hb-red/30",       icon: <XCircle size={9} /> },
  default:  { label: "AÇÃO",     cls: "bg-hb-panelLight text-hb-textDim border border-hb-border", icon: <MessageSquare size={9} /> },
};

export function CardDetailPage({ appUser }: { appUser: AppUser }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<KanbanCard | null>(null);
  const [showAgendar, setShowAgendar] = useState(false);
  const [showSolicitarOrc, setShowSolicitarOrc] = useState(false);
  const [showSolicitarAmostra, setShowSolicitarAmostra] = useState(false);
  const [showNovaTarefa, setShowNovaTarefa] = useState(false);
  const [showEnviarContrato, setShowEnviarContrato] = useState(false);
  const [showFecharManual, setShowFecharManual] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [demandas, setDemandas] = useState<SolicitacaoOrcamento[]>([]);
  const [movs, setMovs] = useState<CardMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Contrato — dados que o cliente preencheu no form público da proposta
  // (space.parket.works/proposta/...), gravados em simulacao_projetos.meta.contrato_cliente.
  // Vendedor pode editar/complementar direto pelo card no Financeiro.
  const [contrato, setContrato] = useState<Record<string, any> | null>(null);
  // ID efetivo da proposta usada como fonte do contrato_cliente.
  // Comercial: procura pela proposta mais recente vinculada via card_comercial_id.
  // Financeiro: usa details.simulacao_id (setado no handoff).
  const [effectiveSimId, setEffectiveSimId] = useState<string | undefined>(undefined);

  // Visibilidade — vendedor/SDR vê só os campos simplificados (mesmos do form
  // de "Adicionar Lead"). Admin/gestor vê tudo (IA, Teka, tracking, metadados).
  const isAdminLike = appUser?.canSeeAll || appUser?.isGestor;

  // Atualiza campos em kanban_cards.details (merge) e refaz fetch local. Usado por
  // todas as seções editáveis (Contato, Projeto, Qualificação, Pagamento, Anexos).
  async function patchDetails(patch: Record<string, any>) {
    if (!card) return;
    const next = { ...(card.details || {}), ...patch };
    setCard({ ...card, details: next });
    const { error: err } = await supabase
      .from("kanban_cards")
      .update({ details: next })
      .eq("id", card.id);
    if (err) {
      // rollback otimista
      setCard(card);
      alert("Erro ao salvar: " + err.message);
    }
  }

  // Salva campo do contrato dentro de simulacao_projetos.meta.contrato_cliente (merge).
  // Usa o effectiveSimId (proposta ativa/mais recente vinculada ao card).
  async function patchContrato(patch: Record<string, any>) {
    const simId = effectiveSimId;
    if (!simId) { alert("Nenhuma proposta encontrada — gera uma proposta antes de preencher contrato."); return; }
    const nextContrato = { ...(contrato || {}), ...patch };
    setContrato(nextContrato);
    const cur = await supabase.from("simulacao_projetos").select("meta").eq("id", simId).single();
    const meta = { ...((cur.data as any)?.meta || {}), contrato_cliente: nextContrato };
    const { error: err } = await supabase.from("simulacao_projetos").update({ meta }).eq("id", simId);
    if (err) {
      setContrato(contrato);
      alert("Erro ao salvar contrato: " + err.message);
    }
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.card(id), api.movements(id)])
      .then(([c, m]) => { setCard(c); setMovs(m); })
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
    // Demandas de orçamento são opcionais — best-effort
    api.demandasPorCard(id).then(setDemandas).catch(() => setDemandas([]));
  }, [id]);

  // Propostas geradas no Valoria vinculadas ao card do cliente (Will 20/07 v2).
  // Antes vinculava só via orcamento_demandas.kanban_card_orc_id — mas cards Valoria
  // recentes NÃO têm demanda gerada (importados via Teca/importPropostaFromSpace,
  // sem passar pelo picker). Novo caminho: usa kanban_cards Cloud (dept=orcamento)
  // WHERE details.parent_card_id = id do card comercial → id-convergente com
  // cards_solicitacao Valoria (mesmo uuid). Fallback demanda mantido.
  const [propostasPorDemanda, setPropostasPorDemanda] = useState<Record<string, PropostaValoria[]>>({});
  // NOVO: propostas soltas (não atreladas a demanda) pra card comercial atual
  const [propostasSoltas, setPropostasSoltas] = useState<PropostaValoria[]>([]);
  // Refresh tick — refetcha a cada 20s pra pegar quando orçamentista move card
  // Valoria pra handoff-com sem precisar reload manual da página.
  const [propostasTick, setPropostasTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPropostasTick((v) => v + 1), 20000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!id) { setPropostasPorDemanda({}); setPropostasSoltas([]); return; }
    (async () => {
      // 1) IDs candidatos de cards Valoria vinculados ao card comercial atual:
      //    a) via demandas.kanban_card_orc_id (fluxo antigo)
      //    b) via kanban_cards Cloud dept=orcamento com details.parent_card_id = id
      const idsFromDem = (demandas as any[]).map((d) => d.kanban_card_orc_id).filter(Boolean);
      const kcRes = await supabase.from("kanban_cards")
        .select("id, details")
        .eq("dept_id", "orcamento")
        .filter("details->>parent_card_id", "eq", id);
      // Falha de rede/API: supabase-js NAO lanca, devolve .error. Antes o
      // (data||[]) engolia e o estado era ZERADO: proposta que ja estava na
      // tela sumia num flake de conexao (02/09). Em erro, mantem o estado
      // atual e deixa o proximo tick (20s) tentar de novo.
      if (kcRes.error) { console.warn("[propostas HB] kanban_cards:", kcRes.error.message); return; }
      const idsFromKC = ((kcRes.data as any[]) || []).map((k) => k.id);
      const cardIds = Array.from(new Set<string>([...idsFromDem, ...idsFromKC]));
      if (cardIds.length === 0) { setPropostasPorDemanda({}); setPropostasSoltas([]); return; }
      // 2) Cards Valoria já enviados ao comercial: handoff-com (Enviada
      //    Comercial) OU proposta-aceita, que fica DEPOIS dela no kanban da
      //    Valoria (cliente já aceitou). Antes só handoff-com: card avançado
      //    pra proposta-aceita sumia daqui enquanto o Pipeline (propostaValor)
      //    mostrava — mesmo gate dos dois lados agora (02/09).
      const cardsRes = await (supabaseValoria as any).from("cards_solicitacao")
        .select("id, column_id")
        .in("id", cardIds)
        .in("column_id", ["handoff-com", "proposta-aceita"]);
      if (cardsRes.error) { console.warn("[propostas HB] cards_solicitacao:", cardsRes.error.message); return; }
      const cardsValoria = (cardsRes.data || []) as Array<{ id: string; column_id: string }>;
      if (cardsValoria.length === 0) { setPropostasPorDemanda({}); setPropostasSoltas([]); return; }
      const cardValoriaIds = cardsValoria.map((c) => c.id);
      // 3) sims desses cards
      //    Traz tambem desconto/frete: sao os campos da conta do valor da proposta
      //    quando a sim so existe na Valoria (sem espelho no Cloud).
      const simsRes = await (supabaseValoria as any).from("simulacoes")
        .select("id, card_id, numero, titulo, desconto_perc, desconto_valor, frete_valor")
        .in("card_id", cardValoriaIds);
      if (simsRes.error) { console.warn("[propostas HB] simulacoes:", simsRes.error.message); return; }
      const sims = (simsRes.data || []) as Array<{ id: string; card_id: string; numero: number; titulo: string | null }>;
      if (sims.length === 0) { setPropostasPorDemanda({}); setPropostasSoltas([]); return; }
      // 4) Se tem proposta gerada, usa. Se não, cai no /v2/{sim_id} (renderer live).
      const propsRes = await (supabaseValoria as any).from("propostas")
        .select("id, simulacao_id, numero, url_publica, created_at")
        .in("simulacao_id", sims.map((s) => s.id))
        .order("created_at", { ascending: false });
      const propsRows = (propsRes.data || []) as Array<{ id: string; simulacao_id: string; numero: number; url_publica: string | null; created_at: string }>;
      const simsAprovadas = sims;
      // Junta: cardValoriaId → propostas[] (uma linha por sim). Sim sem proposta
      // gerada cai no /v2/{sim_id} (renderer live).
      const propBySim = new Map<string, typeof propsRows[number]>();
      for (const p of propsRows) if (!propBySim.has(p.simulacao_id)) propBySim.set(p.simulacao_id, p);
      const simToCard = new Map(sims.map((s) => [s.id, s.card_id]));
      const byCardValoria: Record<string, PropostaValoria[]> = {};
      // Match Valoria→Cloud por numero pra usar renderer Space /proposta/{cloud_id}.
      // selected_at mora só em simulacao_projetos (Cloud) — o box ✓ do Douglas.
      const numeros = simsAprovadas.map((s) => s.numero).filter(Boolean);
      //    Guarda a row inteira: desconto/frete entram na conta do valor da proposta.
      const cloudByNum = new Map<number, any>();
      if (numeros.length > 0) {
        const spRes = await (supabase as any).from("simulacao_projetos")
          .select("id,numero,cliente,selected_at,desconto_perc,desconto_modo,desconto_valor,frete_valor")
          .in("numero", numeros as any);
        const rows = ((spRes.data as any[]) || []);
        const byNumRows = new Map<number, any[]>();
        for (const r of rows) {
          const key = Number(r.numero);
          if (!byNumRows.has(key)) byNumRows.set(key, []);
          byNumRows.get(key)!.push(r);
        }
        const cliCard = (card?.title || "").trim().toLowerCase();
        for (const [num, list] of byNumRows) {
          const pick = list.length === 1
            ? list[0]
            : (list.find((r) => (r.cliente || "").trim().toLowerCase() === cliCard) || list[0]);
          cloudByNum.set(num, { ...pick, selected_at: pick.selected_at || null });
        }
      }
      // Will 28/07: mostrar SÓ a proposta aprovada por Douglas (box ✓ = selected_at
      //   != null em simulacao_projetos). Se várias marcadas, a mais recente vence.
      //   Sem aprovação, bloco "Propostas" fica vazio.
      for (const s of simsAprovadas) {
        const p = propBySim.get(s.id);
        const cid = simToCard.get(s.id);
        if (!cid) continue;
        const cloud = cloudByNum.get(s.numero as any);
        if (!cloud?.selected_at) continue;
        const url = cloud.id
          ? `https://proposta.parket.works/proposta/${cloud.id}`
          : ((p?.url_publica) || `https://proposta.parket.works/v2/${s.id}`);
        (byCardValoria[cid] ||= []).push({
          id: p?.id || s.id,
          numero: p?.numero ?? s.numero,
          url_publica: url,
          created_at: p?.created_at || new Date().toISOString(),
          card_id_valoria: cid,
          sim_id: s.id,
          cloud_sim_id: cloud.id,
          cloud_sim: cloud, // row completa: desconto/frete pra conta do valor
          selected_at: cloud.selected_at,
        } as any);
      }
      // Só a mais recente por card (selected_at desc)
      for (const cid of Object.keys(byCardValoria)) {
        byCardValoria[cid] = byCardValoria[cid]
          .sort((a, b) => String((b as any).selected_at || "").localeCompare(String((a as any).selected_at || "")))
          .slice(0, 1);
      }
      // Valor de cada proposta que sobrou: soma os itens e aplica desconto+frete
      // (mesma conta do card do Pipeline e do modal Enviar Contrato). Prefere o
      // espelho do Cloud, que tem os itens conferidos; sem espelho, usa a Valoria.
      const vivas = Object.values(byCardValoria).flat();
      if (vivas.length > 0) {
        const simsPorId = new Map(sims.map((s) => [s.id, s as any]));
        const cloudIds = vivas.map((p) => p.cloud_sim_id).filter(Boolean) as string[];
        const brutoCloud = new Map<string, number>();
        if (cloudIds.length > 0) {
          const it = await (supabase as any).from("simulacao_itens")
            .select("simulacao_id,valor").in("simulacao_id", cloudIds);
          for (const r of ((it.data as any[]) || [])) {
            brutoCloud.set(r.simulacao_id, (brutoCloud.get(r.simulacao_id) || 0) + Number(r.valor || 0));
          }
        }
        const semEspelho = vivas.filter((p) => !p.cloud_sim_id || !brutoCloud.has(p.cloud_sim_id));
        const brutoValoria = new Map<string, number>();
        if (semEspelho.length > 0) {
          const it = await (supabaseValoria as any).from("simulacao_itens")
            .select("simulacao_id,valor_material,valor_insumos,valor_instalacao")
            .in("simulacao_id", semEspelho.map((p) => p.sim_id).filter(Boolean) as string[]);
          for (const r of ((it.data as any[]) || [])) {
            const t = Number(r.valor_material || 0) + Number(r.valor_insumos || 0) + Number(r.valor_instalacao || 0);
            brutoValoria.set(r.simulacao_id, (brutoValoria.get(r.simulacao_id) || 0) + t);
          }
        }
        for (const p of vivas) {
          const cloud = (p as any).cloud_sim;
          if (p.cloud_sim_id && brutoCloud.has(p.cloud_sim_id)) {
            p.valor_total = totalDaSim(brutoCloud.get(p.cloud_sim_id) || 0, cloud);
          } else {
            const sv = p.sim_id ? simsPorId.get(p.sim_id) : null;
            // Sim da Valoria nao tem desconto_modo: o campo perc e o que vale.
            p.valor_total = totalDaSim(brutoValoria.get(p.sim_id || "") || 0, { ...(sv || {}), desconto_modo: "perc" });
          }
        }
      }
      // Mapeia demanda_id → propostas (mantém compat) + coleta soltas
      const outPorDem: Record<string, PropostaValoria[]> = {};
      const usadas = new Set<string>();
      for (const d of demandas as any[]) {
        const cid = d.kanban_card_orc_id;
        if (cid && byCardValoria[cid]?.length) {
          outPorDem[d.id] = byCardValoria[cid];
          usadas.add(cid);
        }
      }
      const soltas: PropostaValoria[] = [];
      for (const cid of Object.keys(byCardValoria)) {
        if (usadas.has(cid)) continue;
        soltas.push(...byCardValoria[cid]);
      }
      setPropostasPorDemanda(outPorDem);
      setPropostasSoltas(soltas);
    // Excecao no meio da cadeia: mantem o estado atual (nao zera a tela);
    // o refresh tick de 20s refaz a consulta sozinho.
    })().catch((e) => { console.warn("[propostas HB]", e); });
  }, [id, demandas, propostasTick]);

  // Equipe de orçamentistas + lista de vendedores em uso (distintos de kanban_cards.responsavel).
  // Carregado só pra admin/gestor, que vê o accordion "Atribuições".
  const [equipeOrc, setEquipeOrc] = useState<OrcamentistaEquipe[]>([]);
  const [vendedoresList, setVendedoresList] = useState<string[]>([]);
  useEffect(() => {
    if (!isAdminLike) return;
    api.equipeOrcamento().then(setEquipeOrc).catch(() => setEquipeOrc([]));
    supabase.from("kanban_cards")
      .select("responsavel")
      .in("dept_id", [DEPT_COMERCIAL, "entrada"])
      .not("responsavel", "is", null)
      .limit(1200)
      .then(({ data }) => {
        const s = new Set<string>();
        (data || []).forEach((r: any) => { if (r.responsavel) s.add(String(r.responsavel).trim()); });
        setVendedoresList([...s].sort((a, b) => a.localeCompare(b, "pt-BR")));
      });
  }, [isAdminLike]);

  // Resolve o simulacao_id "efetivo" e puxa contrato_cliente com fallback:
  //  1. Financeiro: usa card.details.simulacao_id
  //  2. Comercial: procura simulacao_projetos WHERE card_comercial_id = card.id
  //     — prioriza a com selected_at (ativa), senão a mais recente
  //  3. Se a proposta não tem contrato_cliente preenchido, procura em outras
  //     propostas do mesmo card (última preenchida vence)
  useEffect(() => {
    if (!card) { setContrato(null); setEffectiveSimId(undefined); return; }
    const okDept = card.dept_id === "financeiro" || card.dept_id === "comercial";
    if (!okDept) { setContrato(null); setEffectiveSimId(undefined); return; }
    let cancelled = false;
    (async () => {
      let simId = (card.details as any)?.simulacao_id as string | undefined;
      if (!simId) {
        // Comercial: procura propostas ligadas pelo card_comercial_id
        const cardCom = (card.details as any)?.comercial_card_id || card.id;
        const q = await supabase.from("simulacao_projetos")
          .select("id,selected_at,created_at")
          .eq("card_comercial_id", cardCom)
          .order("selected_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(1);
        simId = ((q.data as any[]) || [])[0]?.id;
      }
      if (cancelled) return;
      setEffectiveSimId(simId);
      if (!simId) { setContrato({}); return; }
      // busca meta da proposta escolhida
      const cur = await supabase.from("simulacao_projetos").select("meta,card_comercial_id").eq("id", simId).maybeSingle();
      let cc = ((cur.data as any)?.meta || {}).contrato_cliente || {};
      // Fallback: se vazia, procura outras propostas do mesmo card
      if (Object.keys(cc).filter((k) => cc[k]).length === 0) {
        const cardCom = (cur.data as any)?.card_comercial_id || (card.details as any)?.comercial_card_id || card.id;
        // Sem updated_at: a coluna NAO existe em simulacao_projetos e o
        // PostgREST devolvia 400 (42703) engolido em silencio (02/09).
        const others = await supabase.from("simulacao_projetos")
          .select("id,meta,created_at").eq("card_comercial_id", cardCom).neq("id", simId)
          .order("created_at", { ascending: false });
        for (const r of ((others.data as any[]) || [])) {
          const m = (r.meta || {}).contrato_cliente || {};
          if (Object.keys(m).filter((k) => m[k]).length > 0) { cc = m; break; }
        }
      }
      if (cancelled) return;
      setContrato(cc);
    })();
    return () => { cancelled = true; };
  }, [card?.id, (card?.details as any)?.simulacao_id, card?.dept_id]);

  if (loading) return (
    <div className="p-12 flex items-center justify-center text-hb-textDim text-sm">
      <Loader2 size={16} className="animate-spin mr-2" /> Carregando…
    </div>
  );
  if (error || !card) return (
    <div className="p-12 text-center">
      <div className="text-hb-red text-sm mb-2">⚠ {error || "Card não encontrado"}</div>
      <Link to="/book/sdr" className="text-xs text-hb-accent underline">Voltar ao book</Link>
    </div>
  );

  const det = (card.details || {}) as any;
  // Volta pro book de origem: cards comerciais → /book/vendas, entrada → /book/sdr.
  // Baseado no dept_id do card, não em referrer (que pode não existir em deep-link).
  const backTo = card.dept_id === DEPT_COMERCIAL ? "/book/vendas" : "/book/sdr";
  const valor = parseValueText(card.value) || parseValueText(det.investimento) || parseValueText(det.orcamento) || 0;
  const metragem = Number(det.metragem_estimada || det.area_m2 || det.metragem || 0) || 0;
  const isHot = (card.tags || []).some((t) => /quente|hot|urgent/i.test(t));
  const isGanho = card.column_id === "ganho";
  const isPerda = card.column_id === "perda";
  const statusColor = isGanho ? "text-hb-green" : isPerda ? "text-hb-red" : "text-hb-gold";

  // Etiqueta "Favorito Douglas" — visível pra Douglas + admin/superadmin +
  // vendedores/ambos (Will 28/08: vendedor sinaliza oportunidade direto no card).
  // Marca details.favorito_douglas = { em, por }. Aparece na aba Oportunidades do Douglas.
  const canFavoritar = (appUser?.email || "").toLowerCase() === "douglas@parket.com.br"
    || appUser?.role === "admin" || appUser?.role === "superadmin"
    || appUser?.funcaoComercial === "vendedor" || appUser?.funcaoComercial === "ambos";
  const isFavorito = !!(det.favorito_douglas);
  const toggleFavorito = () => {
    if (isFavorito) {
      patchDetails({ favorito_douglas: null });
    } else {
      patchDetails({ favorito_douglas: { em: new Date().toISOString(), por: appUser?.email || null } });
    }
  };

  // Apagar card — só admins/superadmin + Raphael. Confirmação com título digitado
  // pra evitar exclusão acidental. Ao concluir, volta pra listagem anterior.
  const canApagar = canDeleteCard(appUser);
  async function handleApagar() {
    if (!card || apagando) return;
    const titulo = card.title || card.id.slice(0, 8);
    const conf = window.prompt(
      `APAGAR CARD "${titulo}"?\n\nEssa ação é IRREVERSÍVEL. Histórico, mensagens, anexos e agendamentos vinculados serão removidos junto.\n\nDigite APAGAR (em maiúsculas) pra confirmar:`
    );
    if (conf !== "APAGAR") return;
    setApagando(true);
    try {
      await api.deleteCard(card.id);
      navigate(backTo);
    } catch (e: any) {
      alert("Erro ao apagar: " + (e?.message || String(e)));
      setApagando(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header compacto */}
      <div className="border-b border-hb-border px-4 py-2 flex items-center gap-3 bg-hb-panel">
        <Link to={backTo} className="text-xs text-hb-textDim hover:text-hb-text flex items-center gap-1">
          <ArrowLeft size={11} /> Voltar
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-hb-textDim font-mono">{card.dept_id} · {card.column_id || "(sem coluna)"}</div>
          <div className="text-sm font-bold truncate flex items-center gap-1.5">
            {card.title || card.id.slice(0, 8)}
            {isHot && <Flame size={12} className="text-hb-red" />}
            {canFavoritar && (
              <button
                onClick={toggleFavorito}
                title={isFavorito ? "Remover dos favoritos do Douglas" : "Marcar como favorito do Douglas — aparece em Oportunidades"}
                className="ml-1 p-0.5 transition"
              >
                <Star
                  size={14}
                  className={isFavorito ? "text-hb-gold" : "text-hb-textDim hover:text-hb-gold"}
                  fill={isFavorito ? "currentColor" : "none"}
                />
              </button>
            )}
          </div>
        </div>
        <span className={`text-[10px] font-bold uppercase ${statusColor}`}>{card.column_id || "?"}</span>
        {/* Solicitar Orçamento — só aparece em cards do funil Comercial.
            Cards já em orçamento/obras/etc não fazem sentido reabrir uma nova solicitação. */}
        {card.dept_id === "comercial" && (
          <button
            onClick={() => setShowSolicitarOrc(true)}
            title="Abre form pra enviar pra equipe de orçamento (valor.parket.works)"
            className="text-[11px] px-2.5 py-1 rounded border border-hb-gold/60 text-hb-gold hover:bg-hb-gold/10 font-semibold flex items-center gap-1"
          >
            <Calculator size={11} /> Solicitar orçamento
          </button>
        )}
        {appUser.funcaoComercial !== "sdr" && (
        <button
          onClick={() => setShowSolicitarAmostra(true)}
          title="Pedir mostruário/amostra pra esse cliente — aprovação por Douglas"
          className="text-[11px] px-2.5 py-1 rounded border border-hb-accent/60 text-hb-accent hover:bg-hb-accent/10 font-semibold flex items-center gap-1"
        >
          <Package size={11} /> Solicitar amostra
        </button>
        )}
        {(card.dept_id === "comercial" || card.dept_id === "financeiro") && (
          <button
            onClick={() => setShowEnviarContrato(true)}
            title={
              (card.details as any)?.proposta_aprovada
                ? `Proposta #${(card.details as any).proposta_aprovada.numero || ""} APROVADA por Douglas — pronto pra enviar contrato.`
                : "Gerar preview do contrato + enviar pra contrato.parket.works (setor Financeiro)"
            }
            className={
              (card.details as any)?.proposta_aprovada
                ? "text-[11px] px-2.5 py-1 rounded bg-hb-gold text-hb-bg font-bold hover:opacity-90 flex items-center gap-1 animate-pulse ring-2 ring-hb-gold/40"
                : "text-[11px] px-2.5 py-1 rounded bg-hb-gold text-hb-bg font-semibold hover:opacity-90 flex items-center gap-1"
            }
          >
            <FileText size={11} />
            {(card.details as any)?.proposta_aprovada ? "✅ Enviar contrato" : "Enviar contrato"}
          </button>
        )}
        {/* Dar como fechado (admins) — cliente que NÃO usa o sistema de contratos:
            admin escolhe a proposta e fecha manual, disparando a MESMA cascata
            da assinatura digital (ganho, financeiro, gestão, Core, produção). */}
        {isAdminLike && (card.dept_id === "comercial" || card.dept_id === "financeiro") && (
          <button
            onClick={() => setShowFecharManual(true)}
            title="Escolher a proposta e dar o negócio como FECHADO sem contrato digital (admins). Segue o fluxo completo com os outros setores."
            className="text-[11px] px-2.5 py-1 rounded border border-hb-green/60 text-hb-green hover:bg-hb-green/10 font-semibold flex items-center gap-1"
          >
            <Trophy size={11} /> Dar como fechado
          </button>
        )}
        <button
          onClick={() => setShowNovaTarefa(true)}
          title="Criar tarefa pessoal vinculada a este card — aparece em Agendamentos"
          className="text-[11px] px-2.5 py-1 rounded border border-hb-border text-hb-textDim hover:text-hb-text hover:border-hb-accent font-semibold flex items-center gap-1"
        >
          <ListTodo size={11} /> Atribuir tarefa
        </button>
        <button
          onClick={() => setShowAgendar(true)}
          className="text-[11px] px-2.5 py-1 rounded bg-hb-accent text-hb-bg font-semibold hover:opacity-90 flex items-center gap-1"
        >
          <CalendarDays size={11} /> Agendar
        </button>
        {canApagar && (
          <button
            onClick={handleApagar}
            disabled={apagando}
            title="Apagar card permanentemente (admins e Raphael)"
            className="text-[11px] px-2.5 py-1 rounded border border-hb-red/60 text-hb-red hover:bg-hb-red/10 font-semibold flex items-center gap-1 disabled:opacity-50"
          >
            <Trash2 size={11} /> {apagando ? "Apagando..." : "Apagar"}
          </button>
        )}
      </div>

      {/* Banner de pendência de contrato — o Financeiro solicitou correção via contrato.parket.works */}
      <ContratoPendenciaBanner
        card={card}
        appUser={appUser}
        onReload={() => api.card(card.id).then((c) => c && setCard(c))}
      />

      {showSolicitarOrc && (
        <SolicitarOrcamentoModal
          card={card}
          appUser={appUser}
          onClose={() => setShowSolicitarOrc(false)}
          onCreated={() => setShowSolicitarOrc(false)}
        />
      )}

      {showSolicitarAmostra && (
        <SolicitarAmostraModal
          card={card}
          appUser={appUser}
          onClose={() => setShowSolicitarAmostra(false)}
          onCreated={() => setShowSolicitarAmostra(false)}
        />
      )}

      {showNovaTarefa && (
        <TarefaModal
          appUser={appUser}
          tarefa={null}
          cardId={card.id}
          cardTitle={card.title || undefined}
          onClose={() => setShowNovaTarefa(false)}
          onSaved={() => setShowNovaTarefa(false)}
        />
      )}

      {showEnviarContrato && (
        <EnviarContratoModal
          card={card}
          contratoCliente={contrato || {}}
          onClose={() => setShowEnviarContrato(false)}
          onSent={() => {
            setShowEnviarContrato(false);
            api.card(card.id).then((c) => c && setCard(c));
          }}
        />
      )}

      {showFecharManual && (
        <FecharManualModal
          card={card}
          appUser={appUser}
          onClose={() => setShowFecharManual(false)}
          onDone={() => {
            setShowFecharManual(false);
            api.card(card.id).then((c) => c && setCard(c));
          }}
        />
      )}

      {showAgendar && (
        <CriarAgendamentoModal
          vendedores={card.responsavel ? [card.responsavel] : []}
          cardIdInit={card.id}
          clienteInit={card.title || ""}
          vendedorInit={card.responsavel || ""}
          onClose={() => setShowAgendar(false)}
          onCreated={() => setShowAgendar(false)}
        />
      )}

      {/* Layout 5 colunas: 2 sidebar (accordions) + 3 chat */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-5 gap-2 p-2 min-h-0">
        <div className="lg:col-span-2 overflow-auto space-y-1.5 pr-1">
          {/* Tags qualificatórias — só mostra as selecionadas + botão "+ Adicionar".
              Chips com cores (urgência usa ícones/emojis). Sincroniza com kanban_cards.tags. */}
          <Accordion title={`Tags (${(card.tags || []).filter((t) => PIPELINE_TAG_GROUPS.some((g) => g.tags.includes(t))).length})`} icon={<Tag size={11} />} defaultOpen>
            <TagsInline
              currentTags={card.tags || []}
              onChange={async (next) => {
                setCard({ ...card, tags: next });
                const { error: err } = await supabase.from("kanban_cards").update({ tags: next }).eq("id", card.id);
                if (err) { setCard(card); alert("Erro: " + err.message); }
              }}
            />
          </Accordion>

          {/* Contato — mesmos campos do form "Adicionar Lead" */}
          <Accordion title="Contato" icon={<Phone size={11} />} defaultOpen>
            <div className="space-y-1.5">
              <EditField label="Nome do contato" value={det.contato_principal || det.nome || card.title} onSave={async (v) => {
                // Escreve em details, title E cascata pros cards filhos (orçamento tem
                // parent_card_id apontando pra este). Sem cascata, rename no card
                // comercial não aparecia no card orçamento nem no Valor (Will 12/08).
                await patchDetails({ contato_principal: v, nome: v });
                const trimmed = String(v || "").trim();
                if (trimmed && trimmed !== card.title) {
                  const { error: tErr } = await supabase.from("kanban_cards").update({ title: trimmed }).eq("id", card.id);
                  if (!tErr) setCard({ ...card, title: trimmed, details: { ...(card.details || {}), contato_principal: v, nome: v } });
                  // Cascata: atualiza cards filhos (details.parent_card_id = this.id) — mais barato
                  // que forçar o sync a resolver, e propaga na hora pra Valor/Compras/Instala.
                  try {
                    const kids = await supabase.from("kanban_cards").select("id, details").eq("details->>parent_card_id", card.id);
                    for (const kid of (kids.data || [])) {
                      const kDet = { ...((kid as any).details || {}), contato_principal: v, nome: v };
                      await supabase.from("kanban_cards").update({ title: trimmed, details: kDet }).eq("id", (kid as any).id);
                    }
                  } catch (e) { console.warn("[rename] cascata pros filhos falhou:", e); }
                }
              }} />
              <EditField label="WhatsApp / Telefone" value={det.celular || det.telefone} onSave={(v) => patchDetails({ celular: v })} mono />
              <EditField label="E-mail" value={det.email || det.email_comercial} onSave={(v) => patchDetails({ email: v })} />
            </div>
            {/* Contatos adicionais (arquiteto/engenheiro/gerenciador/...) — vindos do form */}
            {Array.isArray(det.contatos_adicionais) && det.contatos_adicionais.length > 0 && (
              <div className="mt-3 pt-2 border-t border-hb-border">
                <div className="text-[9px] uppercase tracking-wider font-bold text-hb-textDim mb-1.5">
                  Contatos adicionais do projeto
                </div>
                <div className="space-y-1.5">
                  {det.contatos_adicionais.map((c: any, i: number) => (
                    <div key={i} className="border border-hb-border bg-hb-bg/40 rounded p-2 text-[10px]">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="px-1 py-0.5 bg-hb-walnut/30 text-hb-cream uppercase text-[8px] font-bold" style={{ letterSpacing: "0.14em" }}>
                          {c.papel_label || c.papel || "Contato"}
                        </span>
                        <span className="font-semibold text-hb-text">{c.nome}</span>
                      </div>
                      {Array.isArray(c.telefones) && c.telefones.filter(Boolean).length > 0 && (
                        <div className="text-hb-textDim font-mono text-[9px]">
                          📞 {c.telefones.filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {Array.isArray(c.emails) && c.emails.filter(Boolean).length > 0 && (
                        <div className="text-hb-textDim text-[9px]">
                          ✉ {c.emails.filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Accordion>

          {/* Projeto — mesmos campos do form "Adicionar Lead" (orçamento) */}
          <Accordion title="Projeto" icon={<Briefcase size={11} />} defaultOpen>
            <div className="space-y-1.5">
              <EditField label="Cidade" value={det.cidade} onSave={(v) => patchDetails({ cidade: v })} />
              {/* Condomínio com autocomplete da lista de condomínios já cadastrados */}
              <CondominioField value={det.condominio} onSave={(v) => patchDetails({ condominio: v })} />
              <EditField label="Endereço" value={det.endereco || det.endereco_obra} onSave={(v) => patchDetails({ endereco: v, endereco_obra: v })} />
              <EditField label="Arquiteto / Arquitetura" value={det.arquiteto || det.arquitetura} onSave={(v) => patchDetails({ arquiteto: v })} />
              <EditField label="Fiscal responsável" value={det.fiscal_responsavel || det.fiscal} onSave={(v) => patchDetails({ fiscal_responsavel: v })} />
              <EditField label="Produto" value={det.produto_interesse} onSave={(v) => patchDetails({ produto_interesse: v })} />
              <EditField label="Metragem (m²)" value={det.metragem_estimada || (metragem > 0 ? String(metragem) : "")} onSave={(v) => patchDetails({ metragem_estimada: v, area_m2: v })} />
              <EditField label="Previsão de instalação" value={det.previsao_instalacao || det.prazo || det.previsao} onSave={(v) => patchDetails({ previsao_instalacao: v })} />
            </div>
          </Accordion>

          {/* Observações — campo livre (mesmo do form de Adicionar Lead) */}
          <Accordion title="Observações" icon={<ClipboardCheck size={11} />} defaultOpen>
            <EditField label="" value={det.observacoes || det.resumo_qualificacao || ""} onSave={(v) => patchDetails({ observacoes: v })} multiline />
          </Accordion>

          <Accordion title="Pagamento" icon={<DollarSign size={11} />}>
            <div className="space-y-2">
              <EditField label="Condições de pagamento" value={det.forma_pagamento ?? PAG_DEFAULTS.forma_pagamento}
                onSave={(v) => patchDetails({ forma_pagamento: v })} multiline placeholder={PAG_DEFAULTS.forma_pagamento} />
              <EditField label="Garantia" value={det.pag_garantia ?? PAG_DEFAULTS.pag_garantia}
                onSave={(v) => patchDetails({ pag_garantia: v })} placeholder={PAG_DEFAULTS.pag_garantia} />
              <EditField label="Prazo de entrega" value={det.pag_prazo_entrega ?? PAG_DEFAULTS.pag_prazo_entrega}
                onSave={(v) => patchDetails({ pag_prazo_entrega: v })} placeholder={PAG_DEFAULTS.pag_prazo_entrega} />
              <EditField label="Prazo de execução" value={det.pag_prazo_execucao ?? PAG_DEFAULTS.pag_prazo_execucao}
                onSave={(v) => patchDetails({ pag_prazo_execucao: v })} placeholder={PAG_DEFAULTS.pag_prazo_execucao} />
              <EditField label="Dados bancários" value={det.pag_dados_bancarios ?? PAG_DEFAULTS.pag_dados_bancarios}
                onSave={(v) => patchDetails({ pag_dados_bancarios: v })} multiline placeholder={PAG_DEFAULTS.pag_dados_bancarios} />
              <EditField label="Razão social emissora" value={det.pag_razao_social ?? PAG_DEFAULTS.pag_razao_social}
                onSave={(v) => patchDetails({ pag_razao_social: v })} multiline placeholder={PAG_DEFAULTS.pag_razao_social} />
            </div>
          </Accordion>

          <AnexosAccordion
            cardId={card.id}
            anexos={(det.anexos as AnexoItem[]) || []}
            appUser={appUser}
            clientName={card.title || det.contato_principal || det.nome || ""}
            driveFolderId={(det.drive_folder_id as string) || undefined}
            driveFolderUrl={(det.drive_folder_url as string) || undefined}
            onPatch={(patch) => patchDetails(patch)}
          />

          {/* Drive do cliente: navegacao/upload direto na pasta Home Broker/
              <CLIENTE> (igual aba Documentos do gestao). Arquivo grande de
              arquitetura sobe pelo modo Conectar Google (sem teto de 35MB). */}
          <Accordion title="Drive do cliente" icon={<FolderOpen size={11} />}>
            <DrivePanel
              clientName={card.title || det.contato_principal || det.nome || ""}
              driveFolderId={(det.drive_folder_id as string) || undefined}
              driveFolderUrl={(det.drive_folder_url as string) || undefined}
              onFolder={(patch) => patchDetails(patch)}
            />
          </Accordion>

          {isAdminLike && det.ia_analise && typeof det.ia_analise === "object" && (
            <Accordion title="Análise IA" icon={<Brain size={11} />} defaultOpen>
              <Compact>
                <FieldRow
                  label="Nível"
                  value={det.ia_analise.nivel}
                  accent={/quente/i.test(det.ia_analise.nivel || "") ? "red" : /morno/i.test(det.ia_analise.nivel || "") ? "amber" : "blue"}
                />
                <FieldRow label="Score" value={det.ia_analise.score != null ? String(det.ia_analise.score) : null} accent="gold" />
                <FieldRow label="Feita por" value={det.ia_analise.feita_por} small />
                <FieldRow label="Feita em" value={det.ia_analise.feita_at ? fmtDateTime(det.ia_analise.feita_at) : null} small />
              </Compact>
              {det.ia_analise.motivo && (
                <div className="mt-2 text-[10px] bg-hb-bg/40 border border-hb-border rounded p-2">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-hb-textDim mb-0.5">Motivo</div>
                  <div className="text-hb-text leading-snug">{String(det.ia_analise.motivo)}</div>
                </div>
              )}
              {det.ia_analise.proxima_acao && (
                <div className="mt-2 text-[10px] bg-hb-accent/10 border border-hb-accent/40 rounded p-2">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-hb-accent mb-0.5">Próxima ação</div>
                  <div className="text-hb-text leading-snug">{String(det.ia_analise.proxima_acao)}</div>
                </div>
              )}
            </Accordion>
          )}

          {isAdminLike && (
            <Accordion title="Atribuições" icon={<User size={11} />} defaultOpen={!card.responsavel || !det.orcamentista_id}>
              <AtribuicoesEditor
                vendedorAtual={card.responsavel || det.vendedor || ""}
                orcamentistaAtualId={det.orcamentista_id || ""}
                vendedoresList={vendedoresList}
                equipeOrc={equipeOrc}
                onVendedorSave={async (novo) => {
                  const nome = novo.trim();
                  const prev = card;
                  setCard({ ...card, responsavel: nome || null, details: { ...(card.details || {}), vendedor: nome || null } });
                  const { error: err } = await supabase.from("kanban_cards")
                    .update({ responsavel: nome || null, details: { ...(card.details || {}), vendedor: nome || null }, updated_at: new Date().toISOString() })
                    .eq("id", card.id);
                  if (err) { setCard(prev); alert("Erro ao salvar vendedor: " + err.message); }
                  else if (nome && !vendedoresList.includes(nome)) {
                    setVendedoresList((cur) => [...cur, nome].sort((a, b) => a.localeCompare(b, "pt-BR")));
                  }
                }}
                onOrcamentistaSave={async (orc) => {
                  await patchDetails({
                    orcamentista_id: orc?.id || null,
                    orcamentista_nome: orc?.nome || null,
                    orcamentista_email: orc?.email || null,
                  });
                }}
              />
            </Accordion>
          )}

          {demandas.length > 0 && (
            <Accordion title={`Orçamentos solicitados (${demandas.length})`} icon={<Calculator size={11} />} defaultOpen>
              <div className="space-y-1.5">
                {demandas.map((d) => {
                  const statusLabel: Record<string, { label: string; cor: string; bg: string }> = {
                    aguarda_aceite: { label: "Aguarda aceite", cor: "text-hb-amber", bg: "bg-hb-amber/10" },
                    aceito:         { label: "Aceito",          cor: "text-hb-blue",  bg: "bg-hb-blue/10"  },
                    concluido:      { label: "Concluído",       cor: "text-hb-green", bg: "bg-hb-green/10" },
                    recusado:       { label: "Recusado",        cor: "text-hb-red",   bg: "bg-hb-red/10"   },
                  };
                  const st = statusLabel[d.status] || { label: d.status, cor: "text-hb-textDim", bg: "bg-hb-bg" };
                  const prazoTxt = d.prazo_data
                    ? new Date(d.prazo_data + "T00:00:00").toLocaleDateString("pt-BR")
                    : (d.prazo_horas ? `${d.prazo_horas} ${d.prazo_unidade || "h"}` : null);
                  const atrasada = d.prazo_data && !d.concluido_em && new Date(d.prazo_data) < new Date();
                  return (
                    <div key={d.id} className="border border-hb-border bg-hb-bg/40 p-2 text-[10px] space-y-1">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className={`text-[8px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 ${st.cor} ${st.bg}`}>
                          {st.label}
                        </span>
                        {d.tipo && <span className="text-hb-textDim uppercase tracking-[0.10em]">{d.tipo}</span>}
                        {d.tamanho && <span className="text-hb-textDim">{d.tamanho}</span>}
                      </div>
                      <div className="flex items-center justify-between gap-2 flex-wrap text-[10px]">
                        {prazoTxt && (
                          <span className={`inline-flex items-center gap-1 ${atrasada ? "text-hb-red font-bold" : "text-hb-text"}`}>
                            <CalendarDays size={10} /> Prazo: <span className="tabular font-semibold">{prazoTxt}</span>
                            {atrasada && " (atrasada)"}
                          </span>
                        )}
                        {d.aceito_em && (
                          <span className="text-hb-textDim">Aceito {fmtRelative(d.aceito_em)}</span>
                        )}
                        {d.concluido_em && (
                          <span className="text-hb-green">✓ Concluído {fmtRelative(d.concluido_em)}</span>
                        )}
                      </div>
                      {(d as any).details?.orcamentista_nome && (
                        <div className="text-[9px] text-hb-textDim">
                          Orçamentista: <span className="text-hb-text">{(d as any).details.orcamentista_nome}</span>
                        </div>
                      )}
                      {(propostasPorDemanda[d.id] || []).length > 0 && (
                        <div className="pt-1.5 mt-1 border-t border-hb-border/70 space-y-1">
                          <div className="text-[8px] uppercase tracking-[0.14em] text-hb-textDim font-bold">
                            Propostas ({propostasPorDemanda[d.id]!.length})
                          </div>
                          {propostasPorDemanda[d.id]!.map((p) => {
                            const urlProp = p.cloud_sim_id
                              ? `https://proposta.parket.works/proposta/${p.cloud_sim_id}`
                              : `https://proposta.parket.works/v2/${p.sim_id || p.id}`;
                            // PDF sempre via valor.parket AutoprintView (iframe+print
                            // como o botão "Baixar PDF" da Valoria — Will 21/07)
                            const pdfUrl = `https://valor.parket.works/v2/${p.sim_id || p.id}?autoprint=1`;
                            return (
                              <div key={p.id} className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-mono text-hb-text">#{p.numero}</span>
                                {/* Valor fechado da proposta (mesma conta do card do
                                    Pipeline e do modal Enviar Contrato). */}
                                {!!p.valor_total && p.valor_total > 0 && (
                                  <span className="text-[10px] font-bold text-hb-gold tabular"
                                        title="Valor total da proposta enviada ao comercial">
                                    {fmtBRL(p.valor_total)}
                                  </span>
                                )}
                                <a href={urlProp} target="_blank" rel="noreferrer"
                                   title="Abrir proposta (modelo Parket)"
                                   className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 border border-hb-accent/40 text-hb-accent hover:bg-hb-accent/10 uppercase tracking-[0.12em] font-semibold">
                                  <Link2 size={9} /> Link
                                </a>
                                <a href={pdfUrl}
                                   target="_blank" rel="noreferrer"
                                   title="Baixar PDF (mesma UX do valor.parket)"
                                   className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 border border-hb-gold/50 text-hb-gold hover:bg-hb-gold/10 uppercase tracking-[0.12em] font-semibold">
                                  <FileText size={9} /> PDF
                                </a>
                                <span className="text-[9px] text-hb-textDim">· {fmtRelative(p.created_at)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Accordion>
          )}

          {/* Propostas prontas — vinculadas ao card comercial. Will 20/07:
                - Ver Proposta → proposta.parket.works/v2/{sim_id} (renderer PGSTRUCT
                  com dados AO VIVO, id-convergente Valoria/Cloud, modelo certo)
                - PDF → mesma URL com ?autoprint=1 (renderiza HTML fullscreen e
                  dispara print na mesma aba, sem popup) */}
          {propostasSoltas.length > 0 && (
            <Accordion title={`Propostas prontas (${propostasSoltas.length})`} icon={<FileText size={11} />} defaultOpen>
              <div className="space-y-2">
                {propostasSoltas.map((p) => {
                  const propostaUrl = p.cloud_sim_id
                    ? `https://proposta.parket.works/proposta/${p.cloud_sim_id}`
                    : `https://proposta.parket.works/v2/${p.sim_id || p.id}`;
                  // PDF sempre via valor.parket AutoprintView (mesma UX do botão
                  // "Baixar PDF" da Valoria — iframe+window.print, sem popup)
                  const pdfUrl = `https://valor.parket.works/v2/${p.sim_id || p.id}?autoprint=1`;
                  return (
                    <div key={p.id} className="border border-hb-accent/30 bg-hb-accent/5 px-3 py-2 flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-hb-text tabular">Proposta #{p.numero}</span>
                      {/* Valor total fechado, mesma conta do card do Pipeline. */}
                      {!!p.valor_total && p.valor_total > 0 && (
                        <span className="text-xs font-bold text-hb-gold tabular"
                              title="Valor total da proposta enviada ao comercial">
                          {fmtBRL(p.valor_total)}
                        </span>
                      )}
                      <a href={propostaUrl} target="_blank" rel="noreferrer"
                         title="Abrir a proposta (modelo Parket, dados atualizados)"
                         className="inline-flex items-center gap-1 text-[10px] px-2 py-1 border border-hb-accent/60 text-hb-accent hover:bg-hb-accent/10 uppercase tracking-[0.12em] font-semibold">
                        <Link2 size={10} /> Ver Proposta
                      </a>
                      <a href={pdfUrl} target="_blank" rel="noreferrer"
                         title="Baixar PDF"
                         className="inline-flex items-center gap-1 text-[10px] px-2 py-1 border border-hb-gold/50 text-hb-gold hover:bg-hb-gold/10 uppercase tracking-[0.12em] font-semibold">
                        <FileText size={10} /> PDF
                      </a>
                      <span className="text-[10px] text-hb-textDim ml-auto">
                        Enviada pelo orçamentista · {fmtRelative(p.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Accordion>
          )}

          {isAdminLike && (det.teka_ativa != null || det.teka_pause_reason || det.teka_pause_ts || det.teka_ultima_msg ||
            det.teka_followup_count || det.teka_followup_1_at || det.teka_followup_2_at ||
            det.teca_etapa || det.etapa_conversa || det.mensagens_ia || det.evo_instance) && (
            <Accordion title="TEKA / Conversa IA" icon={<Bot size={11} />}>
              <Compact>
                <FieldRow label="TEKA ativa" value={det.teka_ativa != null ? (det.teka_ativa ? "sim" : "não") : null}
                  accent={det.teka_ativa ? "green" : "red"} />
                <FieldRow label="Etapa conversa" value={det.etapa_conversa || det.teca_etapa} />
                <FieldRow label="Instância" value={det.evo_instance} />
                <FieldRow label="Mensagens IA" value={Array.isArray(det.mensagens_ia) ? det.mensagens_ia.length : det.mensagens_ia} />
                <FieldRow label="Última msg TEKA" value={det.teka_ultima_msg ? fmtRelative(det.teka_ultima_msg) : null} small />
                <FieldRow label="TEKA pausada em" value={det.teka_pause_ts ? fmtRelative(det.teka_pause_ts) : null} small />
                <FieldRow label="Followups enviados" value={det.teka_followup_count} />
                <FieldRow label="Followup 1" value={det.teka_followup_1_at ? fmtDateTime(det.teka_followup_1_at) : null} small />
                <FieldRow label="Followup 2" value={det.teka_followup_2_at ? fmtDateTime(det.teka_followup_2_at) : null} small />
              </Compact>
              {det.teka_pause_reason && (
                <div className="mt-2 text-[10px] bg-hb-bg/40 border border-hb-border rounded p-2">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-hb-textDim mb-0.5">Motivo da pausa</div>
                  <div className="text-hb-text leading-snug">{String(det.teka_pause_reason)}</div>
                </div>
              )}
            </Accordion>
          )}

          {isAdminLike && (
          <Accordion title="Lead & Tracking" icon={<Target size={11} />}>
            <Compact>
              <FieldRow label="SDR" value={det.sdr || card.responsavel} />
              <FieldRow label="Vendedor" value={det.vendedor} />
              <FieldRow label="Fonte" value={det.fonte} />
              <FieldRow label="Origem" value={det.origem} />
              <FieldRow label="Nível do lead" value={det.nivel_lead || det.nivel_label} accent={
                /quente/i.test(det.nivel_lead || "") ? "red" : /morno/i.test(det.nivel_lead || "") ? "amber" : "blue"
              } />
              <FieldRow label="Status do lead" value={det.status_lead} />
              <FieldRow label="Ad ID" value={det.ad_id} mono />
              <FieldRow label="Adset ID" value={det.adset_id} mono />
              <FieldRow label="Form ID" value={det.form_id} mono />
              {det.qualificacao && (
                <div className="col-span-2 mt-1 text-[10px] bg-hb-bg/40 border border-hb-border rounded p-2">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-hb-textDim mb-0.5">Qualificação IA</div>
                  <div className="text-hb-text leading-snug">{String(det.qualificacao)}</div>
                </div>
              )}
              {det.resumo_qualificacao && (
                <div className="col-span-2 mt-1 text-[10px] bg-hb-bg/40 border border-hb-border rounded p-2">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-hb-textDim mb-0.5">Resumo qualificação</div>
                  <div className="text-hb-text leading-snug">{String(det.resumo_qualificacao)}</div>
                </div>
              )}
            </Compact>
          </Accordion>
          )}

          {isAdminLike && Array.isArray(det.observacoes_tracking) && det.observacoes_tracking.length > 0 && (
            <Accordion title={`Observações Tracking (${det.observacoes_tracking.length})`} icon={<MessageSquare size={11} />} defaultOpen>
              <ol className="space-y-2">
                {[...det.observacoes_tracking].reverse().slice(0, 30).map((o: any, i: number) => {
                  const kindMeta = OBS_KIND_META[o.kind as string] || OBS_KIND_META.default;
                  return (
                    <li key={i} className="border border-hb-border rounded p-2 bg-hb-bg/40">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${kindMeta.cls}`}>
                          {kindMeta.icon} {kindMeta.label}
                        </span>
                        {o.from_column && o.to_column && o.from_column !== o.to_column && (
                          <span className="text-[9px] text-hb-textDim flex items-center gap-0.5">
                            {o.from_column} <ArrowRightIcon size={8} /> {o.to_column}
                          </span>
                        )}
                        <span className="text-[9px] text-hb-textDim ml-auto" title={fmtDateTime(o.at)}>
                          {fmtRelative(o.at)}{o.by && ` · ${o.by}`}
                        </span>
                      </div>
                      {o.text ? (
                        <div className="text-[11px] text-hb-text leading-snug whitespace-pre-wrap">{String(o.text)}</div>
                      ) : (
                        <div className="text-[10px] text-hb-textDim italic">— sem nota —</div>
                      )}
                    </li>
                  );
                })}
                {det.observacoes_tracking.length > 30 && (
                  <li className="text-[9px] text-hb-textDim text-center pt-1">+{det.observacoes_tracking.length - 30} mais</li>
                )}
              </ol>
            </Accordion>
          )}

          {isAdminLike && Array.isArray(det.proposta_tracking) && det.proposta_tracking.length > 0 && (
            <Accordion title={`Propostas visualizadas (${det.proposta_tracking.length})`} icon={<FileBarChart size={11} />}>
              <ol className="space-y-1">
                {det.proposta_tracking.slice(0, 25).map((p: any, i: number) => (
                  <li key={i} className="flex items-start gap-1.5 text-[10px]">
                    <span className="text-[9px] text-hb-textDim tabular w-24 shrink-0 mt-0.5 font-mono">{p.data || "—"}</span>
                    <div className="flex-1 leading-tight">
                      <span className="text-hb-text font-medium">{p.cliente || "—"}</span>
                      {p.tempo_fmt && <span className="text-hb-gold ml-1.5">· {p.tempo_fmt}</span>}
                      {p.visualizacao != null && <span className="text-[9px] text-hb-textDim ml-1.5">view #{p.visualizacao}</span>}
                    </div>
                  </li>
                ))}
                {det.proposta_tracking.length > 25 && (
                  <li className="text-[9px] text-hb-textDim text-center pt-1">+{det.proposta_tracking.length - 25} mais</li>
                )}
              </ol>
            </Accordion>
          )}

          {isAdminLike && (() => {
            const knownKeys = new Set([
              "nome", "email", "telefone", "celular", "contato_principal",
              "cidade", "estado", "perfil", "empresa", "cargo", "profissao", "relacao_obra",
              "produto_interesse", "metragem_estimada", "area_m2", "metragem", "metros", "m2",
              "investimento", "orcamento", "budget", "valor", "obra", "prazo", "previsao",
              "preferencia_madeira",
              "sdr", "vendedor", "fonte", "origem", "nivel_lead", "nivel_label",
              "status_lead", "ad_id", "adset_id", "form_id", "qualificacao", "resumo_qualificacao",
              "ia_analise",
              "orcamentista_nome", "orcamentista_email", "orcamentista_id",
              "teka_ativa", "teka_pause_reason", "teka_pause_ts", "teka_ultima_msg",
              "teka_followup_count", "teka_followup_1_at", "teka_followup_2_at",
              "teca_etapa", "etapa_conversa", "mensagens_ia", "evo_instance",
              "proposta_tracking", "observacoes_tracking",
              "cadencia_ultima_at", "cadencia_ultima_por", "cadencia_ultima_obs",
              "motivo_perda", "perda_em", "perda_por",
              "qualificacao_inicial", "overview_ia",
            ]);
            const extras = Object.entries(det).filter(([k, v]) =>
              !knownKeys.has(k) && v !== null && v !== undefined && v !== ""
            );
            if (extras.length === 0) return null;
            return (
              <Accordion title={`Outros (${extras.length})`} icon={<Database size={11} />}>
                <Compact>
                  {extras.map(([k, v]) => (
                    <FieldRow
                      key={k}
                      label={k}
                      value={typeof v === "object" ? JSON.stringify(v) : String(v)}
                      small
                      mono={typeof v === "object" || /id$/i.test(k)}
                    />
                  ))}
                </Compact>
              </Accordion>
            );
          })()}

          {isAdminLike && (card.tags?.length ?? 0) > 0 && (
            <Accordion title={`Tags (${card.tags!.length})`} icon={<Tag size={11} />}>
              <div className="flex flex-wrap gap-1">
                {card.tags!.map((t, i) => (
                  <span key={i} className="text-[10px] bg-hb-panelLight border border-hb-border rounded px-1.5 py-0.5">
                    {t}
                  </span>
                ))}
              </div>
            </Accordion>
          )}

          {isAdminLike && (
          <Accordion title={`Timeline (${movs.length})`} icon={<Activity size={11} />}>
            {movs.length === 0 ? (
              <div className="text-[10px] text-hb-textDim py-2 text-center">Sem movimentações.</div>
            ) : (
              <ol className="space-y-1">
                {movs.slice(0, 20).map((m) => (
                  <li key={m.id} className="flex items-start gap-1.5 text-[10px]">
                    <span className="text-[9px] text-hb-textDim tabular w-16 shrink-0 mt-0.5">{fmtRelative(m.moved_at)}</span>
                    <div className="flex-1 leading-tight">
                      <span className="text-hb-textDim">{m.from_column || "(início)"} → </span>
                      <span className="font-semibold text-hb-text">{m.to_column}</span>
                      {m.moved_by && <span className="text-[9px] text-hb-textDim ml-1.5">por {m.moved_by}</span>}
                    </div>
                  </li>
                ))}
                {movs.length > 20 && <li className="text-[9px] text-hb-textDim text-center pt-1">+{movs.length - 20} mais</li>}
              </ol>
            )}
          </Accordion>
          )}

          {(card.dept_id === "financeiro" || card.dept_id === "comercial") && (
            <ContratoAccordion
              contrato={contrato}
              simulacaoId={effectiveSimId}
              onPatch={patchContrato}
            />
          )}

          {isAdminLike && (
          <Accordion title="Metadados">
            <Compact>
              <FieldRow label="ID" value={card.id} mono small />
              <FieldRow label="Criado em" value={fmtDateTime(card.created_at)} small />
              <FieldRow label="Atualizado em" value={fmtDateTime(card.updated_at)} small />
            </Compact>
            <a href={`https://space.parket.works/?card=${card.id}`} target="_blank" rel="noreferrer"
              className="text-[10px] text-hb-accent hover:underline mt-2 inline-flex items-center gap-1">
              Abrir no Space <ExternalLink size={9} />
            </a>
          </Accordion>
          )}
        </div>

        {/* Chat — agora ocupa 3/5 da largura, com altura total */}
        <div className="lg:col-span-3 min-h-0 h-full">
          <ChatPanel
            cardId={card.id}
            cardTitle={card.title || undefined}
            fallbackPhone={(det.telefone || det.celular) as string | undefined}
            appUser={appUser}
            cardCtx={{
              slug: card.column_id,
              produto_interesse: det.produto_interesse,
              metragem: metragem || undefined,
              valor_mesa: valor || undefined,
              cidade: det.cidade,
              responsavel: card.responsavel,
              ia_analise: det.ia_analise,
            }}
            cardMeta={{
              dept_id: card.dept_id,
              column_id: card.column_id,
              responsavel: card.responsavel,
            }}
            onCardChanged={() => {
              api.card(card.id).then((c) => c && setCard(c));
              api.movements(card.id).then(setMovs);
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** AtribuicoesEditor — só admin/gestor: troca vendedor e orçamentista de um card já criado.
 *  Vendedor = kanban_cards.responsavel (nome livre; sugere responsáveis em uso).
 *  Orçamentista = details.orcamentista_{id,nome,email} (select da tabela orcamento_equipe). */
function AtribuicoesEditor({
  vendedorAtual, orcamentistaAtualId, vendedoresList, equipeOrc,
  onVendedorSave, onOrcamentistaSave,
}: {
  vendedorAtual: string;
  orcamentistaAtualId: string;
  vendedoresList: string[];
  equipeOrc: OrcamentistaEquipe[];
  onVendedorSave: (nome: string) => Promise<void>;
  onOrcamentistaSave: (orc: OrcamentistaEquipe | null) => Promise<void>;
}) {
  const [vend, setVend] = useState(vendedorAtual);
  const [savingV, setSavingV] = useState(false);
  const [savingO, setSavingO] = useState(false);
  useEffect(() => { setVend(vendedorAtual); }, [vendedorAtual]);
  const vendDirty = (vend || "").trim() !== (vendedorAtual || "").trim();
  const commitVend = async () => {
    if (!vendDirty) return;
    setSavingV(true);
    try { await onVendedorSave(vend); } finally { setSavingV(false); }
  };
  const orcAtual = equipeOrc.find((o) => o.id === orcamentistaAtualId) || null;
  const trocarOrc = async (id: string) => {
    setSavingO(true);
    try {
      const escolhido = id ? (equipeOrc.find((o) => o.id === id) || null) : null;
      await onOrcamentistaSave(escolhido);
    } finally { setSavingO(false); }
  };
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[9px] uppercase text-hb-textDim mb-0.5 flex items-center gap-1" style={{ letterSpacing: "0.12em" }}>
          <User size={9} /> Vendedor / Responsável
        </div>
        <div className="flex items-center gap-1.5">
          <input
            list="hb-vendedores-datalist"
            value={vend}
            onChange={(e) => setVend(e.target.value)}
            onBlur={commitVend}
            onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
            placeholder="Nome do vendedor…"
            className="flex-1 bg-hb-bg border border-hb-border px-2 py-1 text-[11px] outline-none focus:border-hb-accent"
          />
          <datalist id="hb-vendedores-datalist">
            {vendedoresList.map((v) => <option key={v} value={v} />)}
          </datalist>
          {savingV && <Loader2 size={11} className="animate-spin text-hb-accent" />}
          {vendDirty && !savingV && (
            <button onClick={commitVend}
              className="text-[10px] px-2 py-1 bg-hb-accent text-hb-bg font-semibold hover:opacity-90 rounded">
              Salvar
            </button>
          )}
        </div>
      </div>
      <div>
        <div className="text-[9px] uppercase text-hb-textDim mb-0.5 flex items-center gap-1" style={{ letterSpacing: "0.12em" }}>
          <Calculator size={9} /> Orçamentista
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={orcamentistaAtualId || ""}
            onChange={(e) => trocarOrc(e.target.value)}
            disabled={savingO}
            className="flex-1 bg-hb-bg border border-hb-border px-2 py-1 text-[11px] outline-none focus:border-hb-accent"
          >
            <option value="">— Nenhum —</option>
            {equipeOrc.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}{o.especialidade ? ` · ${o.especialidade}` : ""}{o.is_gestor ? " (gestor)" : ""}
              </option>
            ))}
          </select>
          {savingO && <Loader2 size={11} className="animate-spin text-hb-accent" />}
        </div>
        {orcAtual?.email && (
          <div className="text-[9px] text-hb-textDim mt-0.5 font-mono truncate">{orcAtual.email}</div>
        )}
      </div>
    </div>
  );
}

// ─── Accordion compacto ─────────────────────────────────────────
function Accordion({ title, icon, children, defaultOpen }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="bg-hb-panel border border-hb-border rounded">
      <button onClick={() => setOpen(!open)}
        className="w-full px-2.5 py-1.5 flex items-center gap-1.5 hover:bg-hb-panelLight transition">
        {open ? <ChevronDown size={11} className="text-hb-textDim" /> : <ChevronRight size={11} className="text-hb-textDim" />}
        {icon && <span className="text-hb-gold">{icon}</span>}
        <span className="text-[10px] font-bold uppercase tracking-wider text-hb-text flex-1 text-left">{title}</span>
      </button>
      {open && (
        <div className="px-2.5 py-2 border-t border-hb-border">{children}</div>
      )}
    </div>
  );
}

function Compact({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">{children}</div>;
}

/** CondominioField — campo de Condomínio com autocomplete (datalist) + salva no blur.
 *  Lista vem de api.condominiosList(); user pode adicionar novo digitando. */
function CondominioField({ value, onSave }: { value: any; onSave: (v: string) => void }) {
  const [val, setVal] = useState<string>(value || "");
  useEffect(() => { setVal(value || ""); }, [value]);
  const dirty = (val || "") !== (value || "");
  const commit = () => { if (dirty) onSave(val.trim()); };
  return (
    <div>
      <div className="text-[9px] uppercase text-hb-textDim mb-0.5" style={{ letterSpacing: "0.12em" }}>
        Condomínio / Edifício
      </div>
      <CondominioInput
        value={val}
        onChange={setVal}
        onBlur={commit}
        className="w-full bg-hb-bg border border-hb-border px-2 py-1 text-[11px] outline-none focus:border-hb-accent"
      />
    </div>
  );
}

/** TagsInline — visualização compacta usada no CardDetail.
 *  Mostra SOMENTE as tags selecionadas (com cor + ícone) + botão "+ Adicionar"
 *  que abre o popover de seleção. Tags fora da lista oficial vão num grupo "Outras". */
function TagsInline({ currentTags, onChange }: {
  currentTags: string[];
  onChange: (next: string[]) => void;
}) {
  const flat = PIPELINE_TAG_GROUPS.flatMap((g) => g.tags);
  const known = currentTags.filter((t) => flat.some((p) => p.toLowerCase() === t.toLowerCase()));
  const outras = currentTags.filter((t) => !flat.some((p) => p.toLowerCase() === t.toLowerCase()));

  const removeTag = (tag: string) =>
    onChange(currentTags.filter((t) => t.toLowerCase() !== tag.toLowerCase()));

  return (
    <div className="space-y-2">
      {known.length === 0 && outras.length === 0 && (
        <div className="text-[10px] text-hb-textDim italic">Sem tags ainda.</div>
      )}
      {known.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {known.map((t) => (
            <TagChip key={t} tag={t} size="md" onRemove={() => removeTag(t)} />
          ))}
        </div>
      )}
      {outras.length > 0 && (
        <div className="pt-1.5 border-t border-hb-border">
          <div className="text-[9px] uppercase text-hb-textDim mb-1" style={{ letterSpacing: "0.18em" }}>
            Outras tags (não-padrão)
          </div>
          <div className="flex flex-wrap gap-1">
            {outras.map((t) => (
              <TagChip key={t} tag={t} size="sm" onRemove={() => removeTag(t)} />
            ))}
          </div>
        </div>
      )}
      <div>
        <TagsSelectorPopover
          value={currentTags}
          onChange={onChange}
          label="+ Adicionar tag"
        />
      </div>
    </div>
  );
}

function FieldRow({ label, value, accent, mono, small }: {
  label: string; value: any; accent?: "gold" | "green" | "red" | "amber" | "blue"; mono?: boolean; small?: boolean;
}) {
  if (value === null || value === undefined || value === "") return null;
  const colorMap = {
    gold: "text-hb-gold", green: "text-hb-green", red: "text-hb-red", amber: "text-hb-amber", blue: "text-hb-blue",
  } as const;
  const color = accent ? colorMap[accent] : "text-hb-text";
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-hb-textDim font-semibold leading-tight">{label}</div>
      <div className={`${color} ${mono ? "font-mono" : "font-medium"} ${small ? "text-[10px]" : "text-[11px]"} leading-snug break-words`}
        title={String(value)}>
        {String(value)}
      </div>
    </div>
  );
}

// Campo inline-editável: clica no ✏️ pra abrir editor, Enter ou Salvar pra commit, Esc cancela.
function EditField({ label, value, onSave, multiline, mono, placeholder }: {
  label: string;
  value: any;
  onSave: (v: string) => Promise<void> | void;
  multiline?: boolean;
  mono?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDraft(value == null ? "" : String(value)); }, [value]);

  const commit = async () => {
    setBusy(true);
    try { await onSave(draft); setEditing(false); }
    catch (e: any) { alert("Erro ao salvar: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  if (editing) {
    return (
      <div>
        <div className="text-[9px] uppercase tracking-wider text-hb-textDim font-semibold leading-tight mb-0.5">{label}</div>
        <div className="flex items-start gap-1">
          {multiline ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder={placeholder}
              className={`flex-1 bg-hb-panelLight border border-hb-accent rounded px-1.5 py-1 text-[11px] ${mono ? "font-mono" : ""} text-hb-text focus:outline-none`}
              onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
            />
          ) : (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              className={`flex-1 bg-hb-panelLight border border-hb-accent rounded px-1.5 py-1 text-[11px] ${mono ? "font-mono" : ""} text-hb-text focus:outline-none`}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                else if (e.key === "Escape") setEditing(false);
              }}
            />
          )}
          <button onClick={commit} disabled={busy}
            className="text-hb-green hover:bg-hb-panelLight rounded p-1 disabled:opacity-50" title="Salvar (Enter)">
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          </button>
          <button onClick={() => { setDraft(value == null ? "" : String(value)); setEditing(false); }}
            className="text-hb-red hover:bg-hb-panelLight rounded p-1" title="Cancelar (Esc)">
            <X size={11} />
          </button>
        </div>
      </div>
    );
  }

  const display = value == null || value === "" ? <span className="text-hb-textDim italic">—</span> : String(value);
  return (
    <div className="group">
      <div className="text-[9px] uppercase tracking-wider text-hb-textDim font-semibold leading-tight flex items-center gap-1">
        <span>{label}</span>
        <button onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 text-hb-textDim hover:text-hb-accent transition" title="Editar">
          <Pencil size={9} />
        </button>
      </div>
      <div className={`${mono ? "font-mono" : "font-medium"} text-[11px] leading-snug break-words text-hb-text whitespace-pre-wrap`}
        onClick={() => setEditing(true)}
        style={{ cursor: "text" }}
        title={value ? String(value) : "Clique pra editar"}>
        {display}
      </div>
    </div>
  );
}

// Accordion de Anexos com upload de arquivo direto do computador.
// Drive SEMPRE (pasta do cliente em Home Broker/<CLIENTE>, upload resumable
// via gestao API, sem teto de tamanho; Supabase aposentado) + adicionar link
// externo. onPatch grava no details do card num unico merge (anexos +
// drive_folder_id quando a pasta nasce aqui).
function AnexosAccordion({ cardId, anexos, appUser, onPatch, clientName, driveFolderId, driveFolderUrl }: {
  cardId: string;
  anexos: AnexoItem[];
  appUser: AppUser;
  onPatch: (patch: Record<string, any>) => void;
  clientName: string;
  driveFolderId?: string;
  driveFolderUrl?: string; // URL salva no card (details.drive_folder_url)
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Link da pasta do cliente no Drive: usa a URL persistida no card; card
  // antigo pode ter so o id (watcher/backfill), entao monta a URL padrao.
  const pastaUrl = driveFolderUrl
    || (driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : "");

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    try {
      // Pasta do cliente: usa a do card; se nascer durante o upload
      // (ensure_hb_folder), guarda aqui pra reusar nos proximos arquivos
      // e persistir junto com os anexos num patch so.
      let folderId = driveFolderId;
      let novaPasta: { drive_folder_id: string; drive_folder_url: string } | null = null;
      const novos: AnexoItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`enviando ${i + 1}/${files.length} · ${file.name}`);
        try {
          const up = await uploadAnexo(file, cardId, {
            driveFolderId: folderId,
            clientName,
            onFolder: (info) => {
              folderId = info.folderId;
              novaPasta = { drive_folder_id: info.folderId, drive_folder_url: info.folderUrl };
            },
            // % real do PUT resumable (importante pra arquivo de arquitetura grande)
            onProgress: (frac) =>
              setProgress(`enviando ${i + 1}/${files.length} · ${file.name} (${Math.round(frac * 100)}%)`),
          });
          novos.push({
            name: file.name,
            url: up.url,
            type: file.type,
            size: file.size,
            uploaded_at: new Date().toISOString(),
            uploaded_by: appUser.nome || appUser.email || "?",
            kind: "file",
            storage: up.storage,
            ...(up.driveFileId ? { drive_file_id: up.driveFileId } : {}),
          });
        } catch (err: any) { console.error(err); alert(`Erro no ${file.name}: ${err.message}`); }
      }
      // Um merge unico no details: anexos novos + id da pasta criada agora.
      if (novos.length || novaPasta) {
        onPatch({
          ...(novos.length ? { anexos: [...anexos, ...novos] } : {}),
          ...(novaPasta || {}),
        });
      }
    } finally {
      setBusy(false); setProgress("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    onPatch({ anexos: [...anexos, {
      name: linkName.trim() || url,
      url,
      type: "link",
      size: 0,
      uploaded_at: new Date().toISOString(),
      uploaded_by: appUser.nome || appUser.email || "?",
      kind: "link",
    }] });
    setLinkUrl(""); setLinkName(""); setShowLinkForm(false);
  };

  const remove = (idx: number) => {
    if (!confirm("Remover este anexo?")) return;
    // Remove so a referencia do card; o arquivo fica no Drive/bucket
    // (regra Will: nunca delete definitivo, cliente pode voltar).
    onPatch({ anexos: anexos.filter((_, i) => i !== idx) });
  };

  return (
    <Accordion title={`Anexos & Links (${anexos.length})`} icon={<Paperclip size={11} />}>
      {progress && (
        <div className="mb-2 text-[9px] text-hb-accent bg-hb-accent/5 border border-hb-accent/20 rounded px-2 py-1 flex items-center gap-1.5">
          <Loader2 size={10} className="animate-spin" />
          {progress}
        </div>
      )}
      {/* Atalho pra pasta do cliente no Drive (Home Broker/<CLIENTE>).
          So aparece quando o card ja tem pasta; abre em aba nova. */}
      {pastaUrl && (
        <a
          href={pastaUrl}
          target="_blank"
          rel="noreferrer"
          className="mb-2 w-full text-[10px] py-1.5 rounded border border-hb-border bg-hb-panelLight text-hb-text hover:bg-hb-bg flex items-center justify-center gap-1.5"
          title="Abre a pasta deste cliente no Google Drive (login da equipe)"
        >
          <FolderOpen size={11} className="text-hb-accent" />
          Abrir pasta do cliente no Drive
        </a>
      )}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex-1 text-[10px] py-1.5 rounded border border-hb-accent/40 bg-hb-accent/10 text-hb-accent hover:bg-hb-accent/20 disabled:opacity-50 flex items-center justify-center gap-1"
          title="Sobe o arquivo do seu computador (PDFs, projetos, imagens)"
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
          Anexar arquivo
        </button>
        <button
          onClick={() => setShowLinkForm((v) => !v)}
          className="flex-1 text-[10px] py-1.5 rounded border border-hb-border bg-hb-panelLight text-hb-text hover:bg-hb-bg flex items-center justify-center gap-1"
        >
          <Link2 size={10} /> Adicionar link
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.dwg,.dxf"
          onChange={onFiles}
          className="hidden"
        />
      </div>

      {showLinkForm && (
        <div className="mb-2 p-2 rounded border border-hb-border bg-hb-bg/40 space-y-1">
          <input
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="Nome do link (opcional)"
            className="w-full bg-hb-panelLight border border-hb-border rounded px-1.5 py-1 text-[11px] text-hb-text focus:outline-none"
          />
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="w-full bg-hb-panelLight border border-hb-border rounded px-1.5 py-1 text-[11px] font-mono text-hb-text focus:outline-none"
            onKeyDown={(e) => { if (e.key === "Enter") addLink(); }}
          />
          <div className="flex gap-1">
            <button onClick={addLink} className="flex-1 text-[10px] py-1 rounded bg-hb-accent text-hb-bg font-semibold hover:opacity-90">
              Salvar link
            </button>
            <button onClick={() => { setShowLinkForm(false); setLinkUrl(""); setLinkName(""); }}
              className="px-3 text-[10px] py-1 rounded border border-hb-border text-hb-textDim hover:bg-hb-panelLight">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {anexos.length === 0 ? (
        <div className="text-[10px] text-hb-textDim py-3 text-center border border-dashed border-hb-border rounded">
          Nenhum anexo. Adicione arquivos ou links do Drive/projeto.
        </div>
      ) : (
        <ul className="space-y-1">
          {anexos.map((a, i) => {
            const isLink = a.kind === "link" || a.type === "link";
            const isImg = (a.type || "").startsWith("image/");
            const sizeKB = a.size ? Math.round(a.size / 1024) : 0;
            const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : sizeKB ? `${sizeKB} KB` : "";
            return (
              <li key={i} className="flex items-center gap-2 p-1.5 rounded border border-hb-border bg-hb-bg/30">
                <span className="text-hb-accent shrink-0">
                  {isLink ? <Link2 size={12} /> : isImg ? <ImageIcon size={12} /> : <FileText size={12} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-hb-text truncate" title={a.name}>{a.name}</div>
                  <div className="text-[9px] text-hb-textDim">
                    {isLink ? "link" : sizeStr}
                    {" · "}{fmtRelative(a.uploaded_at)}
                    {a.uploaded_by && ` · ${a.uploaded_by}`}
                  </div>
                </div>
                <a href={a.url} target="_blank" rel="noreferrer"
                  className="text-[10px] text-hb-accent hover:underline flex items-center gap-1">
                  <ExternalLink size={10} /> Abrir
                </a>
                <button onClick={() => remove(i)}
                  className="text-hb-red hover:bg-hb-panelLight rounded p-1" title="Remover">
                  <Trash2 size={11} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Accordion>
  );
}

// ─── Contrato — dados que o cliente preencheu no form da proposta pública ─────
// Vive em `simulacao_projetos.meta.contrato_cliente`. Vendedor edita direto
// aqui (útil quando cliente ainda não preencheu ou pra corrigir).
function ContratoAccordion({ contrato, simulacaoId, onPatch }: {
  contrato: Record<string, any> | null;
  simulacaoId: string | undefined;
  onPatch: (patch: Record<string, any>) => Promise<void>;
}) {
  if (!simulacaoId) {
    return (
      <Accordion title="Contrato" icon={<FileText size={11} />}>
        <div className="text-[10px] text-hb-textDim italic">
          Card sem <span className="font-mono">simulacao_id</span> — vincular no handoff comercial→financeiro pra habilitar edição do contrato.
        </div>
      </Accordion>
    );
  }
  if (contrato == null) {
    return (
      <Accordion title="Contrato" icon={<FileText size={11} />}>
        <div className="text-[10px] text-hb-textDim flex items-center gap-1.5">
          <Loader2 size={10} className="animate-spin" /> Carregando dados…
        </div>
      </Accordion>
    );
  }
  const c = contrato;
  const isEmpty = Object.keys(c).filter((k) => c[k]).length === 0;
  return (
    <Accordion title="Contrato" icon={<FileText size={11} />} defaultOpen>
      {isEmpty && (
        <div className="mb-2 px-2 py-1.5 border border-hb-gold/40 bg-hb-gold/10 rounded text-[10px] text-hb-gold">
          Cliente ainda não preencheu o formulário. Vendedor pode completar aqui.
        </div>
      )}
      <div className="space-y-1.5">
        <EditField label="Nome completo" value={c.nome} onSave={(v) => onPatch({ nome: v })} />
        <div className="grid grid-cols-2 gap-2">
          <EditField label="CPF / CNPJ" value={c.cpf_cnpj} onSave={(v) => onPatch({ cpf_cnpj: v })} mono />
          <EditField label="RG / IE" value={c.rg} onSave={(v) => onPatch({ rg: v })} mono />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <EditField label="Telefone" value={c.telefone} onSave={(v) => onPatch({ telefone: v })} mono />
          <EditField label="E-mail" value={c.email} onSave={(v) => onPatch({ email: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <EditField label="Estado civil" value={c.estado_civil} onSave={(v) => onPatch({ estado_civil: v })} />
          <EditField label="CEP" value={c.cep} onSave={(v) => onPatch({ cep: v })} mono />
        </div>
        <EditField label="Endereço (rua)" value={c.rua} onSave={(v) => onPatch({ rua: v })} />
        <div className="grid grid-cols-3 gap-2">
          <EditField label="Número" value={c.numero} onSave={(v) => onPatch({ numero: v })} mono />
          <EditField label="Complemento" value={c.complemento} onSave={(v) => onPatch({ complemento: v })} />
          <EditField label="Bairro" value={c.bairro} onSave={(v) => onPatch({ bairro: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <EditField label="Cidade" value={c.cidade} onSave={(v) => onPatch({ cidade: v })} />
          <EditField label="UF" value={c.uf} onSave={(v) => onPatch({ uf: (v || "").toUpperCase().slice(0, 2) })} mono />
        </div>

        {/* Bloco arquiteto + RT — vão junto no contrato */}
        <div className="pt-2 mt-2 border-t border-hb-border">
          <div className="text-[9px] uppercase tracking-wider text-hb-textDim font-semibold mb-1.5">Arquiteto / RT</div>
          <div className="grid grid-cols-[2fr_1fr] gap-2">
            <EditField label="Nome do arquiteto" value={c.arquiteto_nome} onSave={(v) => onPatch({ arquiteto_nome: v })} />
            <EditField label="RT (%)" value={c.arquiteto_rt_pct} onSave={(v) => onPatch({ arquiteto_rt_pct: v })} mono placeholder="ex.: 10" />
          </div>
        </div>

        {c.aceito_em && (
          <div className="pt-1 text-[9px] text-hb-textDim">
            ✓ Cliente aceitou os termos em <span className="font-mono">{fmtDateTime(c.aceito_em)}</span>
          </div>
        )}
        <div className="pt-2 text-[9px] text-hb-textDim">
          Envio pra assinatura via botão <span className="text-hb-gold font-bold">Enviar contrato</span> no topo do card.
        </div>
      </div>
    </Accordion>
  );
}

// ─── Loader compartilhado de propostas do card ─────────────────────────────
// Lista TODAS as propostas do card comercial + agrega valor total.
// Três fontes MESCLADAS (não mais fallback só-se-vazio — bug Loçasso 25/08:
// um placeholder de demanda no Cloud escondia as propostas reais da Valoria):
//   a) Cloud simulacao_projetos por card_comercial_id (caminho normal);
//   b) Cloud com card_comercial_id NULL mas meta.valoria_card_id apontando pro
//      espelho orçamento deste comercial (validaCardId falhou na hora do
//      espelho — 728 sims órfãs em 25/08);
//   c) Sims da Valoria em handoff-com sem espelho no Cloud (sync parado).
// Usado pelo EnviarContratoModal E pelo FecharManualModal (dar como fechado).
type PropostaListada = {
  id: string;
  numero: string | number | null;
  valor_total: number;
  selected_at: string | null;
  created_at: string;
  status: string | null;
  _valoria?: boolean;  // true = sim que só existe na Valoria (sem espelho Cloud)
  meta?: any;          // meta do Cloud (valoria_simulacao_id etc)
  // Card de ORÇAMENTO dono da proposta (id convergente Valoria↔Cloud).
  // Usado pelo FecharManualModal pra mover SÓ esse orçamento pra
  // proposta-aceita (cliente com 2+ orçamentos: fechar um não fecha o outro).
  valoria_card_id?: string | null;
};
async function listarPropostasDoCard(card: KanbanCard, initialSimId?: string): Promise<PropostaListada[]> {
  const det = (card.details as any) || {};
  const cardComercial = det.comercial_card_id || card.id;
  const SEL = "id,numero,card_comercial_id,selected_at,status,created_at,desconto_perc,desconto_modo,desconto_valor,frete_valor,meta";
  // Espelhos do card orçamento (id convergente Valoria↔Cloud)
  const kcRes = await supabase.from("kanban_cards")
    .select("id").eq("dept_id", "orcamento")
    .filter("details->>parent_card_id", "eq", cardComercial);
  const orcIds = ((kcRes.data as any[]) || []).map((k) => k.id);

  // a) Vinculadas direto ao card comercial
  const sp = await supabase.from("simulacao_projetos")
    .select(SEL)
    .or(`card_comercial_id.eq.${cardComercial},id.eq.${initialSimId || "00000000-0000-0000-0000-000000000000"}`)
    .order("selected_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  let rows = ((sp.data as any[]) || []);

  // b) Espelhos órfãos: sem card_comercial_id mas com meta.valoria_card_id
  if (orcIds.length > 0) {
    // Cast any: filtro em coluna JSON (meta->>) estoura a inferência de
    // tipos do supabase-js (TS2589) — o runtime aceita normalmente.
    const orf = await (supabase as any).from("simulacao_projetos")
      .select(SEL)
      .is("card_comercial_id", null)
      .in("meta->>valoria_card_id", orcIds);
    const vistos = new Set(rows.map((r) => r.id));
    for (const r of ((orf.data as any[]) || [])) {
      if (!vistos.has(r.id)) rows.push(r);
    }
  }

  // c) Sims da Valoria em handoff-com (handoff-com já implica aprovação,
  // Will 21/07) OU proposta-aceita (coluna seguinte: cliente já aceitou).
  // Só entram as que NÃO têm espelho no Cloud (match por numero OU
  // meta.valoria_simulacao_id): espelho tem itens, ganha.
  if (orcIds.length > 0) {
    const csRes = await (supabaseValoria as any).from("cards_solicitacao")
      .select("id").in("id", orcIds).in("column_id", ["handoff-com", "proposta-aceita"]);
    const cardValIds = ((csRes.data || []) as any[]).map((c) => c.id);
    if (cardValIds.length > 0) {
      const simsRes = await (supabaseValoria as any).from("simulacoes")
        .select("id,numero,card_id,desconto_perc,desconto_valor,frete_valor,status,created_at,updated_at")
        .in("card_id", cardValIds);
      const numerosCloud = new Set(rows.map((r) => Number(r.numero)));
      const simsEspelhadas = new Set(rows.map((r) => r.meta?.valoria_simulacao_id).filter(Boolean));
      for (const s of ((simsRes.data || []) as any[])) {
        if (numerosCloud.has(Number(s.numero)) || simsEspelhadas.has(s.id)) continue;
        rows.push({
          id: s.id, numero: s.numero, card_comercial_id: cardComercial,
          selected_at: s.updated_at, status: s.status || "handoff-com",
          created_at: s.created_at,
          desconto_perc: s.desconto_perc || 0,
          desconto_modo: "perc",
          desconto_valor: s.desconto_valor || 0,
          frete_valor: s.frete_valor || 0,
          _valoria: true,
          valoria_card_id: s.card_id,  // dono direto: sim da Valoria carrega o card
        });
      }
    }
  }

  // Placeholder de demanda (Solicitar Orçamento cria sim sem itens, numero
  // = seq do card HB) só aparece se não existir proposta real.
  const reais = rows.filter((r) => r.meta?.criado_via !== "homebroker-solicitar-orcamento");
  if (reais.length > 0) rows = reais;

  // Ordena: ativa (selected_at) primeiro, depois mais recente
  rows.sort((a, b) =>
    (b.selected_at ? Date.parse(b.selected_at) : 0) - (a.selected_at ? Date.parse(a.selected_at) : 0) ||
    (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  // Agrega valor: Cloud (simulacao_itens.valor) ou Valoria (soma valor_material+insumos+instalacao)
  const valorCloud = new Map<string, number>();
  const it = await supabase.from("simulacao_itens").select("simulacao_id,valor").in("simulacao_id", ids);
  for (const r of ((it.data as any[]) || [])) valorCloud.set(r.simulacao_id, (valorCloud.get(r.simulacao_id) || 0) + Number(r.valor || 0));
  const valoriaIds = rows.filter((r) => r._valoria).map((r) => r.id);
  const valorVal = new Map<string, number>();
  if (valoriaIds.length > 0) {
    const itV = await (supabaseValoria as any).from("simulacao_itens")
      .select("simulacao_id,valor_material,valor_insumos,valor_instalacao")
      .in("simulacao_id", valoriaIds);
    for (const r of ((itV.data || []) as any[])) {
      const t = Number(r.valor_material || 0) + Number(r.valor_insumos || 0) + Number(r.valor_instalacao || 0);
      valorVal.set(r.simulacao_id, (valorVal.get(r.simulacao_id) || 0) + t);
    }
  }
  return rows.map((r) => {
    const bruto = (r._valoria ? valorVal.get(r.id) : valorCloud.get(r.id)) || 0;
    const desc  = r.desconto_modo === "valor" ? Number(r.desconto_valor || 0) : bruto * (Number(r.desconto_perc || 0) / 100);
    const frete = Number(r.frete_valor || 0);
    return {
      id: r.id, numero: r.numero, valor_total: bruto - desc + frete,
      selected_at: r.selected_at, created_at: r.created_at, status: r.status,
      _valoria: !!r._valoria, meta: r.meta,
      // Dono: sim Valoria traz card_id direto; espelho Cloud traz meta.valoria_card_id
      valoria_card_id: r._valoria ? (r.valoria_card_id || null) : (r.meta?.valoria_card_id || null),
    };
  });
}

// ─── Modal Enviar Contrato ─────────────────────────────────────────────────
// Junta tudo que o card + aba Contrato + simulação têm num único documento
// editável antes de mandar. Grava o merge em simulacao_projetos.meta.contrato_cliente
// e cria/move o card pra financeiro/verificando (entrada única no board de Contratos).
function EnviarContratoModal({ card, contratoCliente, onClose, onSent }: {
  card: KanbanCard;
  contratoCliente: Record<string, any>;
  onClose: () => void;
  onSent: () => void;
}) {
  const det = (card.details as any) || {};
  const initialSimId = det.simulacao_id as string | undefined;
  const [simId, setSimId]     = useState<string | undefined>(initialSimId);
  const [propostas, setPropostas] = useState<PropostaListada[]>([]);
  const [sim, setSim]         = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // 1) Lista as propostas do card via loader compartilhado (3 fontes mescladas).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enriched = await listarPropostasDoCard(card, initialSimId);
      if (cancelled) return;
      setPropostas(enriched);
      if (enriched.length > 0 && !simId) {
        const ativa = enriched.find((p) => p.selected_at);
        setSimId(ativa?.id || enriched[0].id);
      }
    })();
    return () => { cancelled = true; };
  }, [card.id, initialSimId]);

  // 2) Puxa a proposta selecionada + itens + contrato_cliente com fallback
  useEffect(() => {
    if (!simId) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      let [sp, it] = await Promise.all([
        supabase.from("simulacao_projetos")
          .select("id,numero,cliente,vendedor,arquiteto,forma_pagamento,frete_valor,desconto_perc,desconto_modo,desconto_valor,pag_prazo_entrega,pag_prazo_execucao,pag_dados_bancarios,pag_razao_social,pag_garantia,meta")
          .eq("id", simId).maybeSingle(),
        supabase.from("simulacao_itens").select("id,categoria,descritivo,valor,ordem").eq("simulacao_id", simId).order("ordem"),
      ]);
      // Fallback Valoria: id não achado no Cloud (sim veio do Valoria em handoff-com).
      // Busca do simulacoes/simulacao_itens da Valoria e mapeia pro shape do Cloud
      // pra o preview renderizar itens+total corretos.
      if (!sp.data) {
        const simsV = await (supabaseValoria as any).from("simulacoes")
          .select("id,numero,titulo,card_id,desconto_perc,desconto_valor,frete_valor,forma_pagamento,pag_prazo_entrega,pag_prazo_execucao,pag_dados_bancarios,pag_razao_social,pag_garantia,meta,gestao_obra_pct")
          .eq("id", simId).maybeSingle();
        if (simsV?.data) {
          const s: any = simsV.data;
          let vendedor: string | null = null, arquiteto: string | null = null, cliente: string | null = null;
          if (s.card_id) {
            const cardV = await (supabaseValoria as any).from("cards_solicitacao")
              .select("cliente,vendedor,arquiteto").eq("id", s.card_id).maybeSingle();
            vendedor = cardV?.data?.vendedor ?? null;
            arquiteto = cardV?.data?.arquiteto ?? null;
            cliente = cardV?.data?.cliente ?? null;
          }
          const itensV = await (supabaseValoria as any).from("simulacao_itens")
            .select("id,categoria,descritivo,valor_material,valor_insumos,valor_instalacao,ordem")
            .eq("simulacao_id", simId).order("ordem");
          sp = { data: {
            id: s.id, numero: s.numero, cliente, vendedor, arquiteto,
            forma_pagamento: s.forma_pagamento, frete_valor: s.frete_valor,
            desconto_perc: s.desconto_perc, desconto_modo: "perc",
            desconto_valor: s.desconto_valor,
            pag_prazo_entrega: s.pag_prazo_entrega, pag_prazo_execucao: s.pag_prazo_execucao,
            pag_dados_bancarios: s.pag_dados_bancarios, pag_razao_social: s.pag_razao_social,
            pag_garantia: s.pag_garantia, meta: s.meta,
          }} as any;
          it = { data: ((itensV?.data || []) as any[]).map((r) => ({
            id: r.id, categoria: r.categoria, descritivo: r.descritivo,
            valor: Number(r.valor_material || 0) + Number(r.valor_insumos || 0) + Number(r.valor_instalacao || 0),
            ordem: r.ordem,
          })) } as any;
        }
      }
      let cc = ((sp.data as any)?.meta || {}).contrato_cliente || {};
      // Fallback: se a selecionada não tem dados, procura em outras propostas
      // do mesmo card comercial. Última preenchida vence.
      if (!cc || Object.keys(cc).filter((k) => cc[k]).length === 0) {
        const cardCom = det.comercial_card_id || card.id;
        // Sem updated_at: a coluna NAO existe em simulacao_projetos e o
        // PostgREST devolvia 400 (42703) engolido em silencio (02/09).
        const others = await supabase.from("simulacao_projetos")
          .select("id,meta,created_at")
          .eq("card_comercial_id", cardCom).neq("id", simId)
          .order("created_at", { ascending: false });
        for (const r of ((others.data as any[]) || [])) {
          const meta = (r.meta || {}).contrato_cliente || {};
          if (Object.keys(meta).filter((k) => meta[k]).length > 0) { cc = meta; break; }
        }
      }
      setSim({ ...(sp.data || {}), itens: (it.data as any[]) || [], _contrato_cliente_effective: cc });
      setLoading(false);
    })();
  }, [simId, card.id, det.comercial_card_id]);

  // Merge de campos — prioridade: contrato_cliente da PROPOSTA selecionada
  // (com fallback pra qualquer outra que tenha dados) > card details > simulação
  const merged = useMemo(() => {
    const c = (sim?._contrato_cliente_effective as Record<string, any>) || contratoCliente || {};
    return {
      nome:         c.nome         || det.contato_principal || det.nome     || card.title || "",
      cpf_cnpj:     c.cpf_cnpj     || det.cpf_cnpj    || det.cnpj || "",
      rg:           c.rg           || det.rg          || det.inscricao_estadual || "",
      telefone:     c.telefone     || det.celular     || det.telefone       || "",
      email:        c.email        || det.email       || det.email_comercial || "",
      cep:          c.cep          || det.cep         || "",
      estado_civil: c.estado_civil || "",
      rua:          c.rua          || det.endereco    || det.endereco_obra  || "",
      numero:       c.numero       || det.numero      || "",
      complemento:  c.complemento  || det.complemento || "",
      bairro:       c.bairro       || det.bairro      || "",
      cidade:       c.cidade       || det.cidade      || "",
      uf:           c.uf           || det.uf          || det.estado         || "",
      arquiteto_nome:    c.arquiteto_nome    || sim?.arquiteto || det.arquitetura || det.arquiteto || "",
      arquiteto_rt_pct:  c.arquiteto_rt_pct  || det.arquiteto_rt_pct || "",
      forma_pagamento:   sim?.forma_pagamento    || det.forma_pagamento    || "",
      pag_prazo_entrega: sim?.pag_prazo_entrega  || det.pag_prazo_entrega  || "",
      pag_prazo_execucao:sim?.pag_prazo_execucao || det.pag_prazo_execucao || "",
      pag_dados_bancarios: sim?.pag_dados_bancarios || det.pag_dados_bancarios || "",
      pag_razao_social:    sim?.pag_razao_social    || det.pag_razao_social    || "",
      pag_garantia:        sim?.pag_garantia        || det.pag_garantia        || "",
      vendedor:      card.responsavel || sim?.vendedor || det.vendedor || "",
      numero_proposta: sim?.numero || det.numero_proposta || "",
    };
  }, [contratoCliente, card, det, sim]);

  const [form, setForm] = useState<Record<string, any>>(merged);
  // Reseta o form quando a proposta selecionada muda OU quando o dado
  // efetivo de contrato_cliente muda (fetch de outra proposta como fallback).
  useEffect(() => { setForm(merged); }, [simId, merged.nome, merged.cpf_cnpj, merged.arquiteto_nome, sim?.numero]);
  const patch = (k: string, v: any) => setForm((f: Record<string, any>) => ({ ...f, [k]: v }));

  // Gera HTML do contrato em tempo real (mesmo renderer do valor.parket.works).
  // Preview via iframe srcdoc — só o motor do browser interpreta @page/DM Sans.
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const previewInputRef = useRef<any>(null);
  useEffect(() => {
    if (loading) return;
    const input = {
      card: { ...card, responsavel: form.vendedor || card.responsavel,
        title: form.nome || card.title,
        details: { ...(card.details as any),
          contato_principal: form.nome, celular: form.telefone, email: form.email,
          cnpj_cpf: form.cpf_cnpj, forma_pagamento: form.forma_pagamento,
          pag_prazo_entrega: form.pag_prazo_entrega, pag_prazo_execucao: form.pag_prazo_execucao,
          pag_garantia: form.pag_garantia, pag_dados_bancarios: form.pag_dados_bancarios,
          pag_razao_social: form.pag_razao_social, arquitetura: form.arquiteto_nome,
        },
      },
      sim: {
        ...(sim || {}),
        numero: form.numero_proposta || sim?.numero,
        forma_pagamento: form.forma_pagamento || sim?.forma_pagamento,
        arquiteto: form.arquiteto_nome || sim?.arquiteto,
        cnpj_cpf: form.cpf_cnpj,
        endereco: [form.rua, form.numero, form.complemento, form.bairro, form.cidade, form.uf, form.cep].filter(Boolean).join(", "),
        pag_garantia: form.pag_garantia, pag_prazo_entrega: form.pag_prazo_entrega,
        pag_prazo_execucao: form.pag_prazo_execucao, pag_dados_bancarios: form.pag_dados_bancarios,
        pag_razao_social: form.pag_razao_social,
      },
      itens: sim?.itens || [],
      contratoCliente: form,
    };
    previewInputRef.current = input;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      try { setPreviewHtml(gerarHTMLContrato(input)); }
      catch (e) { console.error("Falha ao gerar HTML:", e); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form, sim, loading, card]);

  // Valor total agregado dos itens
  const valorTotal = useMemo(() => {
    if (!sim?.itens) return 0;
    const bruto = sim.itens.reduce((a: number, r: any) => a + Number(r.valor || 0), 0);
    const desc  = sim.desconto_modo === "valor" ? Number(sim.desconto_valor || 0)
                : bruto * (Number(sim.desconto_perc || 0) / 100);
    const frete = Number(sim.frete_valor || 0);
    return bruto - desc + frete;
  }, [sim]);

  const areaTotal = useMemo(() => (sim?.itens || []).reduce((a: number, r: any) => a + Number(r.area || 0), 0), [sim]);

  const [sentOk, setSentOk] = useState(false);
  async function confirm() {
    if (!simId) { alert("Selecione a proposta final antes."); return; }
    setSending(true);
    try {
      // Card comercial de referência (não mexemos nele — ele só vai pra 'ganho'
      // pelo trigger sync_contrato_status_to_card quando o DocuSign confirmar).
      const cardComercialId = det.comercial_card_id || (card.dept_id === "comercial" ? card.id : undefined);

      // 1) Marca a proposta escolhida como ATIVA e limpa das outras
      if (cardComercialId) {
        await supabase.from("simulacao_projetos")
          .update({ selected_at: null })
          .eq("card_comercial_id", cardComercialId)
          .not("id", "eq", simId);
      }
      await supabase.from("simulacao_projetos")
        .update({ selected_at: new Date().toISOString() })
        .eq("id", simId);

      // 2) Grava contrato_cliente em simulacao_projetos.meta
      const cur = await supabase.from("simulacao_projetos").select("meta").eq("id", simId).maybeSingle();
      const meta = {
        ...((cur.data as any)?.meta || {}),
        contrato_cliente: {
          ...(((cur.data as any)?.meta || {}).contrato_cliente || {}),
          ...form,
          preview_gerado_em: new Date().toISOString(),
        },
      };
      const upSim = await supabase.from("simulacao_projetos").update({ meta }).eq("id", simId);
      if (upSim.error) throw upSim.error;

      // 3) Se este card já é FINANCEIRO (handoff feito antes), atualiza
      //    simulacao_id + garante coluna 'verificando'. NÃO mexe em card
      //    comercial (deve permanecer em 'em-negociacao' até assinar).
      if (card.dept_id === "financeiro") {
        const upFin = await supabase.from("kanban_cards")
          .update({
            column_id: "verificando",
            details: { ...(card.details as any), simulacao_id: simId },
          })
          .eq("id", card.id);
        if (upFin.error) throw upFin.error;
      } else if (card.dept_id === "comercial") {
        // Criar ou reutilizar o card financeiro (verificando) vinculado a este comercial.
        const existing = await supabase.from("kanban_cards")
          .select("id")
          .eq("dept_id", "financeiro")
          .contains("details", { comercial_card_id: card.id })
          .limit(1);
        const existingId = ((existing.data as any[]) || [])[0]?.id;
        const nextDetails = {
          ...(card.details as any),
          comercial_card_id: card.id,
          simulacao_id: simId,
          origem: "handoff_comercial_ganho",
          data_handoff: new Date().toISOString(),
        };
        if (existingId) {
          const upFin = await supabase.from("kanban_cards")
            .update({ column_id: "verificando", details: nextDetails })
            .eq("id", existingId);
          if (upFin.error) throw upFin.error;
        } else {
          const inFin = await supabase.from("kanban_cards")
            .insert({
              dept_id: "financeiro",
              column_id: "verificando",
              title: card.title,
              responsavel: card.responsavel,
              details: nextDetails,
            });
          if (inFin.error) throw inFin.error;
        }
        // Card comercial permanece em 'em-negociacao' — trigger DocuSign
        // vai movê-lo pra 'ganho' + adicionar tag "🏆 Negócio Fechado" quando
        // o contrato for assinado.
      }

      setSentOk(true);
    } catch (e: any) {
      alert("Erro ao enviar: " + (e?.message || e));
    } finally { setSending(false); }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" style={{ backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-hb-panel border border-hb-border rounded-lg max-w-[95vw] xl:max-w-[1600px] w-full max-h-[96vh] overflow-hidden flex flex-col shadow-2xl">

        <div className="px-5 py-3 border-b border-hb-border flex items-center justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-hb-textDim">Enviar contrato</div>
            <div className="text-sm font-bold text-hb-gold mt-0.5">
              {form.nome || card.title} {form.numero_proposta ? `· proposta #${form.numero_proposta}` : ""}
            </div>
          </div>
          <button onClick={onClose} className="text-hb-textDim hover:text-hb-text" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {sentOk ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-hb-green/15 border-2 border-hb-green flex items-center justify-center">
              <Check size={30} className="text-hb-green" />
            </div>
            <div>
              <div className="text-lg font-bold text-hb-text">Enviado com sucesso</div>
              <div className="text-[11px] text-hb-textDim mt-2 max-w-md leading-relaxed">
                Proposta <span className="font-mono text-hb-text">#{form.numero_proposta || "—"}</span> foi enviada
                pro time <span className="text-hb-gold font-bold">Financeiro</span> pra seguir com a assinatura do contrato.
              </div>
            </div>
            <div className="max-w-sm px-4 py-3 border border-hb-border bg-hb-panelLight rounded text-[11px] text-hb-text leading-relaxed">
              🔔 Você vai receber uma <span className="font-bold text-hb-gold">notificação de ganho</span> assim que o cliente assinar o contrato.
            </div>
            <button onClick={() => { onSent(); }}
              className="mt-4 text-[11px] font-bold uppercase tracking-widest text-hb-bg bg-hb-accent hover:opacity-90 py-2 px-6 rounded">
              Ok, fechar
            </button>
          </div>
        ) : loading ? (
          <div className="p-16 flex items-center justify-center text-hb-textDim text-sm">
            <Loader2 size={16} className="animate-spin mr-2" /> Consolidando dados do card + proposta…
          </div>
        ) : (
          <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-[minmax(360px,400px)_1fr] min-h-0">
            {/* Coluna 1: form editável */}
            <div className="p-5 space-y-4 overflow-auto border-r border-hb-border">
              {/* Seletor de proposta — final é a que vai virar contrato */}
              {propostas.length > 0 && (
                <FormBlock title={`Proposta final (${propostas.length})`}>
                  <div className="col-span-2 flex flex-col gap-1.5 max-h-[220px] overflow-auto">
                    {propostas.map((p) => {
                      const selected = p.id === simId;
                      const valor = p.valor_total > 0 ? fmtBRL(p.valor_total) : "—";
                      const isAtiva = !!p.selected_at;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSimId(p.id)}
                          className={`text-left px-2 py-1.5 rounded border transition flex items-center justify-between gap-2 ${selected ? "bg-hb-gold/15 border-hb-gold" : "border-hb-border bg-hb-panelLight hover:border-hb-textDim"}`}
                          title={`Criada em ${fmtDateTime(p.created_at)}`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${selected ? "bg-hb-gold" : "bg-hb-border"}`} />
                            <span className="text-[10px] font-mono text-hb-text">#{p.numero ?? "—"}</span>
                            {isAtiva && <span className="text-[8px] uppercase tracking-widest text-hb-green px-1 py-0.5 border border-hb-green/40 rounded">ativa</span>}
                            {p.status && p.status !== "rascunho" && (
                              <span className="text-[8px] uppercase tracking-widest text-hb-textDim">{p.status}</span>
                            )}
                          </span>
                          <span className="text-[10px] text-hb-text font-medium tabular-nums">{valor}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="col-span-2 text-[9px] text-hb-textDim leading-tight">
                    Escolha qual proposta será a "final" — o PDF vai usar os itens/valores dela e ela ficará marcada como <span className="font-bold">ativa</span> no Space.
                  </div>
                </FormBlock>
              )}

              <FormBlock title="Contratante">
                <FormRow label="Nome completo" value={form.nome} onChange={(v) => patch("nome", v)} full />
                <FormRow label="CPF / CNPJ"    value={form.cpf_cnpj} onChange={(v) => patch("cpf_cnpj", v)} mono />
                <FormRow label="RG / IE"       value={form.rg} onChange={(v) => patch("rg", v)} mono />
                <FormRow label="Telefone"      value={form.telefone} onChange={(v) => patch("telefone", v)} mono />
                <FormRow label="E-mail"        value={form.email} onChange={(v) => patch("email", v)} />
                <FormRow label="Estado civil"  value={form.estado_civil} onChange={(v) => patch("estado_civil", v)} />
                <FormRow label="CEP"           value={form.cep} onChange={(v) => patch("cep", v)} mono />
              </FormBlock>

              <FormBlock title="Endereço">
                <FormRow label="Rua/Av."       value={form.rua} onChange={(v) => patch("rua", v)} full />
                <FormRow label="Número"        value={form.numero} onChange={(v) => patch("numero", v)} mono />
                <FormRow label="Complemento"   value={form.complemento} onChange={(v) => patch("complemento", v)} />
                <FormRow label="Bairro"        value={form.bairro} onChange={(v) => patch("bairro", v)} full />
                <FormRow label="Cidade"        value={form.cidade} onChange={(v) => patch("cidade", v)} />
                <FormRow label="UF"            value={form.uf} onChange={(v) => patch("uf", (v || "").toUpperCase().slice(0, 2))} mono />
              </FormBlock>

              <FormBlock title="Arquiteto / RT">
                <FormRow label="Nome do arquiteto" value={form.arquiteto_nome} onChange={(v) => patch("arquiteto_nome", v)} full />
                <FormRow label="RT (%)"            value={form.arquiteto_rt_pct} onChange={(v) => patch("arquiteto_rt_pct", v)} mono placeholder="ex.: 10" />
              </FormBlock>
            </div>

            {/* Coluna 2: preview do HTML (padrão Parket / mesmo renderer da Valoria) */}
            <div className="flex flex-col bg-hb-bg/40 min-h-0">
              <div className="px-3 py-2 border-b border-hb-border flex items-center justify-between">
                <div className="text-[9px] uppercase tracking-widest text-hb-textDim">Preview do contrato</div>
                <button
                  type="button"
                  onClick={() => { if (previewInputRef.current) abrirContratoParaImpressao(previewInputRef.current); }}
                  className="text-[10px] text-hb-gold hover:underline inline-flex items-center gap-1"
                  title="Abre em nova aba com print automático — user pode Salvar como PDF"
                >
                  <FileText size={10} /> Abrir e imprimir
                </button>
              </div>
              <div className="flex-1 min-h-0 bg-white">
                {previewHtml ? (
                  <iframe srcDoc={previewHtml} title="Preview do contrato" className="w-full h-full border-0" style={{ minHeight: 520 }} />
                ) : (
                  <div className="p-8 flex items-center justify-center text-[10px] text-hb-textDim uppercase tracking-widest">
                    Gerando preview…
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!sentOk && (
          <div className="px-5 py-3 border-t border-hb-border flex items-center justify-between gap-3">
            <div className="text-[10px] text-hb-textDim">
              {simId ? "Vai gravar dados + mover card pra Financeiro / Verificando" : "Selecione a proposta final antes"}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="text-[10px] font-bold uppercase tracking-wider text-hb-textDim hover:text-hb-text border border-hb-border py-2 px-4 rounded">
                Cancelar
              </button>
              <button onClick={confirm} disabled={sending || !simId}
                className="text-[10px] font-bold uppercase tracking-wider text-hb-bg bg-hb-gold hover:opacity-90 py-2 px-4 rounded flex items-center gap-1.5 disabled:opacity-50">
                {sending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                {sending ? "Enviando…" : "Confirmar e enviar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal Dar Como Fechado (admins) ───────────────────────────────────────
// Cliente que NÃO usa o sistema de contratos digitais: admin escolhe a proposta
// e fecha o negócio manualmente. O modal faz as escritas permitidas ao anon
// (proposta ativa, card comercial → ganho, card financeiro em novo-contrato,
// Valoria → proposta-aceita) e marca details.fechado_manual no card FINANCEIRO.
// O watcher (compras-contratos-watcher.py, perna fechamento manual, cron 3min)
// vê a marca e cria o contratos_docusign status='assinado' sintético com
// service_role (RLS bloqueia insert do frontend de propósito) — a partir daí a
// cascata NORMAL da assinatura roda: gestão, Core financeiro, compras, OP de
// produção com anexos (anexos_producao) e Drive movido pra Projetos (perna 9).
function FecharManualModal({ card, appUser, onClose, onDone }: {
  card: KanbanCard;
  appUser: AppUser;
  onClose: () => void;
  onDone: () => void;
}) {
  const det = (card.details as any) || {};
  const [propostas, setPropostas] = useState<PropostaListada[]>([]);
  const [simId, setSimId] = useState<string | undefined>(det.simulacao_id);
  const [loading, setLoading] = useState(true);
  const [confirmado, setConfirmado] = useState(false);
  const [sending, setSending] = useState(false);
  const [doneOk, setDoneOk] = useState(false);

  // Mesmo loader do Enviar Contrato: 3 fontes mescladas (Cloud, órfãs, Valoria)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enriched = await listarPropostasDoCard(card, det.simulacao_id);
      if (cancelled) return;
      setPropostas(enriched);
      if (enriched.length > 0 && !det.simulacao_id) {
        const ativa = enriched.find((p) => p.selected_at);
        setSimId(ativa?.id || enriched[0].id);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [card.id]);

  const escolhida = propostas.find((p) => p.id === simId);

  async function fechar() {
    if (!simId || !escolhida) { alert("Selecione a proposta antes."); return; }
    setSending(true);
    try {
      const now = new Date().toISOString();
      // Card comercial de referência (este modal abre em comercial OU financeiro)
      const cardComercialId = det.comercial_card_id || (card.dept_id === "comercial" ? card.id : undefined);
      if (!cardComercialId) throw new Error("Card sem vínculo com o comercial (comercial_card_id).");

      // Espelhos do card orçamento — usados pro mapa_pdf e pra mover a Valoria
      const kcRes = await supabase.from("kanban_cards")
        .select("id,details").eq("dept_id", "orcamento")
        .filter("details->>parent_card_id", "eq", cardComercialId);
      const orcCards = ((kcRes.data as any[]) || []);
      const orcIds = orcCards.map((k) => k.id);

      // Link público da proposta (mesma regra do topo do CardDetail):
      // Cloud → /proposta/<id>; Valoria-only → ops.propostas.url_publica ou /v2/<sim>
      let propostaLink = `https://proposta.parket.works/proposta/${simId}`;
      if (escolhida._valoria) {
        const pr = await (supabaseValoria as any).from("propostas")
          .select("url_publica").eq("simulacao_id", simId).limit(1);
        propostaLink = ((pr.data || []) as any[])[0]?.url_publica
          || `https://proposta.parket.works/v2/${simId}`;
      }

      // Card de ORÇAMENTO dono da proposta escolhida: fechar UM orçamento não
      // pode arrastar os outros do mesmo cliente pra proposta-aceita.
      // 1) loader já traz o dono (sim Valoria = card_id; espelho = meta.valoria_card_id)
      let orcAlvo: string | null = escolhida.valoria_card_id || null;
      // 2) espelho Cloud sem valoria_card_id mas com valoria_simulacao_id:
      //    pergunta pra Valoria de qual card a sim é
      if (!orcAlvo && escolhida.meta?.valoria_simulacao_id) {
        const sv = await (supabaseValoria as any).from("simulacoes")
          .select("card_id").eq("id", escolhida.meta.valoria_simulacao_id).limit(1);
        orcAlvo = ((sv.data || []) as any[])[0]?.card_id || null;
      }
      // 3) um orçamento só = sem ambiguidade
      if (!orcAlvo && orcIds.length === 1) orcAlvo = orcIds[0];
      // Só confia no alvo se ele é mesmo espelho deste comercial; senão cai no
      // comportamento antigo (todos), que só acontece sem como identificar o dono.
      const orcAlvoIds = orcAlvo && orcIds.includes(orcAlvo) ? [orcAlvo] : orcIds;

      // 1) Proposta escolhida vira a ATIVA (limpa selected_at das outras).
      //    Pra sim só-Valoria o update por id é no-op no Cloud — inofensivo.
      await supabase.from("simulacao_projetos")
        .update({ selected_at: null })
        .eq("card_comercial_id", cardComercialId)
        .not("id", "eq", simId);
      await supabase.from("simulacao_projetos")
        .update({ selected_at: now })
        .eq("id", simId);

      const fechadoManual = {
        por: appUser?.email || null,
        em: now,
        simulacao_id: simId,
        numero: escolhida.numero ?? null,
        proposta_link: propostaLink,
        orcamento_card_id: orcAlvo,  // qual orçamento foi fechado (auditoria)
      };

      // 2) Card COMERCIAL → ganho + proposta_aprovada (mesmo shape que o
      //    trigger do DocuSign deixaria; o CardDetail lê .numero dela)
      const comRes = await supabase.from("kanban_cards")
        .select("id,title,responsavel,details").eq("id", cardComercialId).maybeSingle();
      const comCard = comRes.data as any;
      if (!comCard) throw new Error("Card comercial não encontrado.");
      const comDet = (comCard.details as any) || {};
      const upCom = await supabase.from("kanban_cards")
        .update({
          column_id: "ganho",
          details: {
            ...comDet,
            simulacao_id: simId,
            proposta_aprovada: {
              numero: escolhida.numero ?? null,
              simulacao_id: simId,
              proposta_link: propostaLink,
              aprovada_em: now,
              aprovada_por: appUser?.email || null,
              origem: "fechamento-manual-admin",
            },
            fechado_manual: fechadoManual,
          },
        })
        .eq("id", cardComercialId);
      if (upCom.error) throw upCom.error;

      // mapa_pdf vem do card espelho de orçamento (quando o orçamentista anexou);
      // preferência pro orçamento DONO da proposta fechada
      const mapaPdf =
        (orcAlvo ? (orcCards.find((k) => k.id === orcAlvo)?.details as any)?.mapa_pdf : null)
        || orcCards.map((k) => (k.details as any)?.mapa_pdf).find(Boolean);

      // 3) Card FINANCEIRO em novo-contrato (mesma coluna do bulk validado) com
      //    details herdados do comercial — anexos/drive_folder_id vão junto e a
      //    marca fechado_manual é o gatilho do watcher.
      const finDetails = {
        ...comDet,
        comercial_card_id: cardComercialId,
        card_comercial_id: cardComercialId,
        simulacao_id: simId,
        proposta_link: propostaLink,
        origem: "fechamento-manual-admin",
        data_handoff: now,
        fechado_manual: fechadoManual,
        ...(mapaPdf ? { mapa_pdf: mapaPdf } : {}),
      };
      const existing = await supabase.from("kanban_cards")
        .select("id,details")
        .eq("dept_id", "financeiro")
        .contains("details", { comercial_card_id: cardComercialId })
        .limit(1);
      const existingFin = ((existing.data as any[]) || [])[0];
      if (existingFin) {
        const upFin = await supabase.from("kanban_cards")
          .update({
            column_id: "novo-contrato",
            details: { ...((existingFin.details as any) || {}), ...finDetails },
          })
          .eq("id", existingFin.id);
        if (upFin.error) throw upFin.error;
      } else {
        const inFin = await supabase.from("kanban_cards")
          .insert({
            dept_id: "financeiro",
            column_id: "novo-contrato",
            title: comCard.title,
            responsavel: comCard.responsavel,
            details: finDetails,
          });
        if (inFin.error) throw inFin.error;
      }

      // 4) Valoria: SÓ o orçamento dono da proposta vai pra proposta-aceita
      //    (os outros orçamentos do cliente ficam onde estão)
      if (orcAlvoIds.length > 0) {
        await (supabaseValoria as any).from("cards_solicitacao")
          .update({ column_id: "proposta-aceita" })
          .in("id", orcAlvoIds);
      }

      setDoneOk(true);
    } catch (e: any) {
      alert("Erro ao fechar: " + (e?.message || e));
    } finally { setSending(false); }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" style={{ backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-hb-panel border border-hb-border rounded-lg max-w-[560px] w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">

        <div className="px-5 py-3 border-b border-hb-border flex items-center justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-hb-textDim">Dar como fechado</div>
            <div className="text-sm font-bold text-hb-green mt-0.5">{card.title}</div>
          </div>
          <button onClick={onClose} className="text-hb-textDim hover:text-hb-text" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {doneOk ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-hb-green/15 border-2 border-hb-green flex items-center justify-center">
              <Trophy size={28} className="text-hb-green" />
            </div>
            <div>
              <div className="text-lg font-bold text-hb-text">Negócio fechado</div>
              <div className="text-[11px] text-hb-textDim mt-2 max-w-md leading-relaxed">
                Proposta <span className="font-mono text-hb-text">#{escolhida?.numero ?? "?"}</span> aprovada.
                O card foi pra <span className="text-hb-gold font-bold">Ganho</span> e o Financeiro recebeu o card do contrato.
              </div>
            </div>
            <div className="max-w-md px-4 py-3 border border-hb-border bg-hb-panelLight rounded text-[10px] text-hb-textDim leading-relaxed text-left">
              Em até 6 minutos o sistema registra o contrato como assinado e dispara o fluxo completo:
              obra no Gestão, financeiro no Core, ordem de produção no PCP com os anexos do card
              e pasta do Drive movida pra Projetos. Nada mais precisa ser feito aqui.
            </div>
            <button onClick={onDone}
              className="mt-2 text-[11px] font-bold uppercase tracking-widest text-hb-bg bg-hb-green hover:opacity-90 py-2 px-6 rounded">
              Ok, fechar
            </button>
          </div>
        ) : loading ? (
          <div className="p-12 flex items-center justify-center text-hb-textDim text-sm">
            <Loader2 size={16} className="animate-spin mr-2" /> Buscando propostas do card…
          </div>
        ) : propostas.length === 0 ? (
          <div className="p-12 text-center text-[11px] text-hb-textDim leading-relaxed">
            Nenhuma proposta encontrada pra este card. Gere a proposta na Valoria antes de dar como fechado.
          </div>
        ) : (
          <div className="p-5 space-y-4 overflow-auto">
            {/* Seletor de proposta — mesmo visual do Enviar Contrato */}
            <div>
              <div className="text-[9px] uppercase tracking-widest text-hb-textDim font-semibold mb-1.5">
                Proposta fechada ({propostas.length})
              </div>
              <div className="flex flex-col gap-1.5 max-h-[260px] overflow-auto">
                {propostas.map((p) => {
                  const selected = p.id === simId;
                  const valor = p.valor_total > 0 ? fmtBRL(p.valor_total) : "sem valor";
                  const isAtiva = !!p.selected_at;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSimId(p.id)}
                      className={`text-left px-2 py-1.5 rounded border transition flex items-center justify-between gap-2 ${selected ? "bg-hb-gold/15 border-hb-gold" : "border-hb-border bg-hb-panelLight hover:border-hb-textDim"}`}
                      title={`Criada em ${fmtDateTime(p.created_at)}`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${selected ? "bg-hb-gold" : "bg-hb-border"}`} />
                        <span className="text-[10px] font-mono text-hb-text">#{p.numero ?? "?"}</span>
                        {isAtiva && <span className="text-[8px] uppercase tracking-widest text-hb-green px-1 py-0.5 border border-hb-green/40 rounded">ativa</span>}
                        {p.status && p.status !== "rascunho" && (
                          <span className="text-[8px] uppercase tracking-widest text-hb-textDim">{p.status}</span>
                        )}
                      </span>
                      <span className="text-[10px] text-hb-text font-medium tabular-nums">{valor}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-3 py-2.5 border border-hb-border bg-hb-panelLight rounded text-[10px] text-hb-textDim leading-relaxed">
              Use quando o cliente fechou <span className="font-bold text-hb-text">sem assinar pelo sistema de contratos</span>.
              O card vai pra Ganho e o fluxo completo dos outros setores roda igual ao da assinatura digital:
              Financeiro, Gestão, Core, produção com anexos e Drive em Projetos.
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)}
                className="mt-0.5 accent-emerald-500" />
              <span className="text-[10px] text-hb-text leading-relaxed">
                Confirmo que o cliente fechou a proposta
                {escolhida ? <> <span className="font-mono">#{escolhida.numero ?? "?"}</span> ({escolhida.valor_total > 0 ? fmtBRL(escolhida.valor_total) : "sem valor"})</> : null} e
                que este fechamento manual substitui a assinatura digital.
              </span>
            </label>
          </div>
        )}

        {!doneOk && !loading && propostas.length > 0 && (
          <div className="px-5 py-3 border-t border-hb-border flex items-center justify-between gap-3">
            <div className="text-[10px] text-hb-textDim">
              {simId ? "Vai marcar GANHO + disparar a cascata dos setores" : "Selecione a proposta antes"}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="text-[10px] font-bold uppercase tracking-wider text-hb-textDim hover:text-hb-text border border-hb-border py-2 px-4 rounded">
                Cancelar
              </button>
              <button onClick={fechar} disabled={sending || !simId || !confirmado}
                className="text-[10px] font-bold uppercase tracking-wider text-hb-bg bg-hb-green hover:opacity-90 py-2 px-4 rounded flex items-center gap-1.5 disabled:opacity-50">
                {sending ? <Loader2 size={11} className="animate-spin" /> : <Trophy size={11} />}
                {sending ? "Fechando…" : "Dar como fechado"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Bloco de form usado no modal
function FormBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-hb-gold font-semibold mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}
function FormRow({ label, value, onChange, mono, placeholder, full }: { label: string; value: any; onChange: (v: string) => void; mono?: boolean; placeholder?: string; full?: boolean }) {
  return (
    <label className={full ? "col-span-2" : ""}>
      <div className="text-[8px] uppercase tracking-widest text-hb-textDim mb-1">{label}</div>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full bg-hb-panelLight border border-hb-border rounded px-2 py-1.5 text-[11px] text-hb-text ${mono ? "font-mono" : ""} focus:outline-none focus:border-hb-accent`}
      />
    </label>
  );
}

// ── Banner de pendência de contrato ─────────────────────────────────────────
// Aparece quando o Financeiro solicitou correção via contrato.parket.works.
// O motivo veio no `details.contrato_pendencia`. Vendedor completa os dados
// do cliente na simulação/proposta e clica "Reenviar pra Contrato" — a gente
// limpa o pendencia AQUI e atualiza o card do Financeiro (contrato_card_id)
// pra status='reenviado' com timestamp.
function ContratoPendenciaBanner({ card, appUser, onReload }: {
  card: any; appUser: AppUser; onReload: () => void;
}) {
  const pend = (card?.details as any)?.contrato_pendencia;
  const [busy, setBusy] = useState(false);
  if (!pend || pend.status !== "pendente") return null;

  async function reenviar() {
    setBusy(true);
    try {
      // 1. Limpa a pendência no card do Comercial
      const newDetails = { ...(card.details || {}) };
      delete newDetails.contrato_pendencia;
      const upd = await supabase.from("kanban_cards").update({ details: newDetails }).eq("id", card.id);
      if (upd.error) throw upd.error;

      // 2. Marca o card do Financeiro como "reenviado"
      const contratoCardId = pend.contrato_card_id;
      if (contratoCardId) {
        const cur = await supabase.from("kanban_cards").select("details").eq("id", contratoCardId).maybeSingle();
        const curDet = ((cur.data as any)?.details) || {};
        const oldReview = curDet.contrato_review || {};
        const newReview = {
          ...oldReview,
          status: "reenviado",
          reenviado_em: new Date().toISOString(),
          reenviado_por_email: appUser.email,
          motivo_ultimo: pend.motivo,
        };
        await supabase.from("kanban_cards").update({ details: { ...curDet, contrato_review: newReview } }).eq("id", contratoCardId);
      }

      // 3. Notifica o solicitante (Financeiro) que o vendedor complementou
      if (pend.aberto_por_email) {
        const solic = await supabase.from("user_profiles").select("id,full_name").eq("email", pend.aberto_por_email).maybeSingle();
        if (solic.data?.id) {
          await supabase.from("notificacoes").insert({
            user_id: solic.data.id,
            tipo: "contrato_reenviado",
            titulo: `Contrato reenviado — ${card.title || card.id.slice(0, 8)}`,
            mensagem: `${appUser.nome} complementou as informações. Reveja no contrato.parket.works.`,
            referencia_id: contratoCardId || card.id,
            referencia_tipo: "kanban_card",
            lida: false,
          });
        }
      }

      onReload();
    } catch (e: any) {
      alert("Falha ao reenviar: " + (e?.message || e));
    } finally { setBusy(false); }
  }

  const abertoEm = pend.aberto_em ? new Date(pend.aberto_em).toLocaleString("pt-BR") : "";

  return (
    <div className="mx-4 mt-3 mb-2 border border-amber-500/60 bg-amber-500/10 rounded p-3">
      <div className="flex items-start gap-3">
        <div className="text-amber-400 text-lg leading-none">⏳</div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-amber-300 font-bold mb-1">
            Financeiro solicitou correção do contrato
          </div>
          <div className="text-[12px] text-hb-text leading-relaxed mb-2 whitespace-pre-wrap">
            {pend.motivo}
          </div>
          {pend.campos_faltando?.length > 0 && (
            <div className="text-[10px] text-hb-textDim mb-1">
              Campos: <span className="text-hb-text">{pend.campos_faltando.join(" · ")}</span>
            </div>
          )}
          <div className="text-[9px] text-hb-textDim uppercase tracking-wider mb-3">
            Solicitado por {pend.aberto_por_email} · {abertoEm}
          </div>
          <div className="text-[11px] text-hb-textDim mb-3">
            Complete os campos do cliente e da proposta abaixo e clique em <b>Reenviar</b> pra devolver ao Financeiro.
          </div>
          <button
            onClick={reenviar} disabled={busy}
            className="text-[11px] px-3 py-1.5 rounded bg-amber-500 text-hb-bg font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "reenviando…" : "↻ Reenviar pra Contrato"}
          </button>
        </div>
      </div>
    </div>
  );
}

