/**
 * Tela de Aprovação Douglas — lista cards do setor Orçamento parados na
 * coluna "Análise Douglas". Pra cada um: cliente, vendedor, orçamentista,
 * link da proposta + botão Ver PDF, e botões Aprovar / Rejeitar (motivo).
 *
 * Aprovar → backend move card pra "Proposta Pronta" + trigger no banco
 * sobe o card Comercial pai pra "Apresentação / Proposta", e dispara
 * mensagem no grupo "Parket — Orçamentos".
 * Rejeitar → backend move card pra "Refazer" + grava motivo + dispara grupo.
 *
 * Restrito a douglas@parket.com.br e admins (role admin/superadmin).
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2, RefreshCw, AlertTriangle, Package, MapPin, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useFetch, amostrasApi, AMOSTRA_STATUS_LABELS } from "../../lib/api";
import type { AmostraSolicitacao } from "../../lib/api";
import type { AppUser } from "../../lib/auth";
import { fmtRelative, fmtDateTime } from "../../lib/format";

const WAVOIP_API = "https://core.parket.works";
const SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
// Chat do card mora no gateway local (api.parket.works) — o Cloud parou de receber
// card_chat_messages em 14/06 (sem replicação local→cloud pra essa tabela). O resto
// do app (ChatPanel) já usa o gateway; aqui estava lendo/postando no lado congelado.
const CHAT_URL = "https://api.parket.works";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";
const WA_URL = "https://conect.parket.works";
const WA_KEY = "4eab105201410d6865b86dca76ee9fa3";
const WA_INSTANCE = "Parket";
const WA_GROUP = "120363425314205066@g.us"; // Parket — Orçamentos

async function lookupOrcamentistaPhone(nomeCompleto: string | null | undefined): Promise<string | null> {
  if (!nomeCompleto) return null;
  const firstName = String(nomeCompleto).trim().split(/\s+/)[0].toLowerCase();
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/orcamento_notify_phones?nome_key=eq.${encodeURIComponent(firstName)}&ativo=eq.true&select=telefone&limit=1`,
      { headers: { apikey: SB_KEY } }
    );
    const rows = await r.json();
    if (Array.isArray(rows) && rows[0] && rows[0].telefone) return String(rows[0].telefone);
  } catch (e) { console.warn("[lookup-phone]", e); }
  return null;
}

async function waNotifyGroup(text: string, mentionPhone: string | null) {
  try {
    const body: any = { number: WA_GROUP };
    if (mentionPhone) {
      body.text = "@" + mentionPhone + " " + text;
      body.mentioned = [mentionPhone];
    } else {
      body.text = text;
    }
    await fetch(`${WA_URL}/message/sendText/${WA_INSTANCE}`, {
      method: "POST",
      headers: { apikey: WA_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) { console.warn("[wa-notify-group]", e); }
}

async function postarComentarioChat(opts: {
  cardId: string; texto: string; tipo: "comentario" | "rejeicao";
  user: AppUser | null; cliente: string; simNumero?: string | null;
}) {
  const { cardId, texto, tipo, user, cliente, simNumero } = opts;
  const email = (user?.email || "douglas@parket.com.br").toLowerCase();
  const nome = user?.nome || "Douglas (CEO)";
  const propTag = simNumero ? `📋 Proposta #${simNumero}` : "";
  const prefix = tipo === "rejeicao"
    ? (propTag ? `[REJEIÇÃO CEO — ${propTag}]` : "[REJEIÇÃO CEO]")
    : (propTag ? `[COMENTÁRIO CEO — ${propTag}]` : "[COMENTÁRIO CEO]");
  const body = {
    context_id: cardId,
    context_type: "kanban_card",
    topic: cliente ? cliente.toLowerCase().trim() : null,
    user_name: "🟡 CEO — " + nome,
    user_email: email,
    avatar: "👑",
    msg: `${prefix}\n${texto}`,
  };
  try {
    await fetch(`${CHAT_URL}/rest/v1/card_chat_messages`, {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    });
  } catch (e) { console.warn("[postarComentarioChat]", e); }
}

async function fetchChatCounts(cardIds: string[]): Promise<{ counts: Record<string, number>; latest: Record<string, { created_at: string; user_email: string | null }> }> {
  const counts: Record<string, number> = {};
  const latest: Record<string, { created_at: string; user_email: string | null }> = {};
  if (!cardIds.length) return { counts, latest };
  try {
    await Promise.all(cardIds.map((id) =>
      Promise.all([
        fetch(`${CHAT_URL}/rest/v1/card_chat_messages?context_id=eq.${id}&select=id`, {
          headers: { apikey: SB_KEY, Prefer: "count=exact" },
        }).then((r) => {
          const cr = r.headers.get("content-range") || "";
          const m = cr.match(/\/(\d+)$/);
          counts[id] = m ? parseInt(m[1], 10) : 0;
        }).catch(() => { counts[id] = 0; }),
        fetch(`${CHAT_URL}/rest/v1/card_chat_messages?context_id=eq.${id}&select=created_at,user_email&order=created_at.desc&limit=1`, {
          headers: { apikey: SB_KEY },
        }).then((r) => r.json()).then((rows) => {
          if (Array.isArray(rows) && rows[0]) latest[id] = { created_at: rows[0].created_at, user_email: rows[0].user_email };
        }).catch(() => {}),
      ])
    ));
  } catch (e) { console.warn("[fetchChatCounts]", e); }
  return { counts, latest };
}

function getLastSeenChat(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem("__pkt_chat_last_seen") || "{}"); } catch { return {}; }
}
function markChatRead(cardId: string) {
  try {
    const seen = getLastSeenChat();
    seen[cardId] = new Date().toISOString();
    localStorage.setItem("__pkt_chat_last_seen", JSON.stringify(seen));
  } catch {}
}

// Item vendido da simulação (ops.simulacao_itens via backend wavoip) — usado
// na Análise de Custo do Douglas: valor de venda de cada item + componentes.
type ItemVendido = {
  descricao: string;
  dimensao: string | null;
  detalhe?: string | null;          // recortes: quais são (nome + qtd + unidade)
  metragem: number | null;
  preco_m2: number | null;          // R$/m2 usado no orçamento (tabela ou efetivo do ajuste manual)
  material_ajustado?: boolean;      // orçamentista sobrescreveu o material na mão
  valor_material: number;
  valor_insumos: number;
  valor_instalacao: number;
  valor_total: number;
};

// Resumo de margem calculado no backend (Will 08/09): comissão 5%, RT 10%
// sobre líquido (só com arquiteto), impostos 20%, insumos fab+inst da sim.
type AnaliseCusto = {
  venda_total: number;
  frete: number;                    // frete cobrado na proposta (repasse)
  desconto: number;                 // desconto em R$ (valor ou % já resolvido)
  total_proposta: number;           // itens + frete - desconto = valor que o cliente vê
  comissao_pct: number;
  comissao: number;
  arquiteto: string | null;
  rt_pct: number;
  rt: number;
  impostos_pct: number;
  impostos: number;
  insumos_fab: number;              // insumos SÓ do que passa pela fábrica (porta/marcenaria/laminado)
  insumos_obra: number;             // insumos de obra (cola, manta...) dos itens comprados prontos
  instalacao: number;               // mão de obra de instalação (todos os itens)
  material_pronto_venda: number;    // venda de material comprado pronto — custo de compra não registrado
  insumos: number;                  // soma geral (retrocompat)
  resultado: number;
  margem_pct: number | null;
};

type SimItem = {
  id: string;
  numero: string | null;
  cliente: string;
  vendedor: string | null;
  orcamentista: string | null;
  status: string;
  selected_at?: string | null;
  link?: string;
  pdf_url?: string;
  itens?: ItemVendido[];
  analise_custo?: AnaliseCusto;
  forma_pagamento?: string | null;  // condições da proposta (Will 08/09)
  consideracoes?: string | null;    // ex: "Recortes de forro não incluso"
  decisao?: {
    id?: string;
    decisao: "aprovado" | "rejeitado";
    motivo: string | null;
    aprovado_por_email?: string;
    aprovado_por_nome?: string | null;
    decidido_em?: string;
  } | null;
};

type AprovacaoItem = {
  card: { id: string; title: string; obra: string | null; column_id: string; details: any; created_at: string; updated_at: string };
  card_comercial: { id: string; title: string; column_id: string; responsavel: string | null } | null;
  simulacao: SimItem | null;
  simulacoes?: SimItem[];
  pendentes_count?: number;
  decididas_count?: number;
  vendedor: string | null;
  orcamentista: string;
  cliente: string;
  proposta_link: string | null;
  proposta_pdf_url: string | null;
  historico: Array<{ id: string; decisao: string; motivo: string | null; aprovado_por_email: string; aprovado_por_nome: string | null; decidido_em: string }>;
};

export function isAprovador(u: AppUser | null): boolean {
  if (!u) return false;
  if ((u.email || "").toLowerCase() === "douglas@parket.com.br") return true;
  // NÃO incluir dept_leader: vendedores são todos dept_leader e não devem
  // ter acesso à Aprovação. Restrito a Douglas + admin/superadmin.
  return u.role === "admin" || u.role === "superadmin";
}

// Formata número em R$ (pt-BR, 2 casas) pra Análise de Custo.
function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function tempoDesde(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "agora";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function OrcamentoAprovacaoPage({ appUser }: { appUser: AppUser | null }) {
  return <AprovacaoFila appUser={appUser} showHeader />;
}

export function AprovacaoFila({ appUser, showHeader = false }: { appUser: AppUser | null; showHeader?: boolean }) {
  const autorizado = isAprovador(appUser);
  const lista = useFetch<{ items: AprovacaoItem[]; total: number }>(
    () => autorizado
      ? fetch(`${WAVOIP_API}/api/orcamento/aprovacao/pendentes`).then((r) => r.json())
      : Promise.resolve({ items: [], total: 0 }),
    [autorizado]
  );

  // Aba ativa: "orcamentos" (fluxo atual) | "amostras" (aprovar mostruário)
  // Will 20/07: Douglas quer amostras SEPARADAS da aprovação de orçamento —
  // após aprovar, watcher (compras-contratos-watcher.py, cron */3min) cria
  // card no kanban do Marco Antônio (dept=compras-marco, col=solicitacao).
  const [tab, setTab] = useState<"orcamentos" | "amostras">("orcamentos");
  const [amostrasPend, setAmostrasPend] = useState<AmostraSolicitacao[]>([]);
  const [amostrasLoading, setAmostrasLoading] = useState(false);
  const [amostrasErr, setAmostrasErr] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [rejeitarOpen, setRejeitarOpen] = useState<{ item: AprovacaoItem; sim: SimItem | null } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [propostaOpen, setPropostaOpen] = useState<{ item: AprovacaoItem; sim: SimItem | null } | null>(null);
  const [comentarioOpen, setComentarioOpen] = useState<{ item: AprovacaoItem; sim: SimItem | null } | null>(null);
  const [comentarioTxt, setComentarioTxt] = useState("");
  const [conversaOpen, setConversaOpen] = useState<AprovacaoItem | null>(null);
  // Painel Análise de Custo aberto/fechado por sim.id
  const [analiseOpen, setAnaliseOpen] = useState<Record<string, boolean>>({});
  const [conversaMsgs, setConversaMsgs] = useState<Array<{ id: string; user_name: string | null; user_email: string | null; avatar: string | null; msg: string; created_at: string }>>([]);
  const [chatCounts, setChatCounts] = useState<Record<string, number>>({});
  const [chatLatest, setChatLatest] = useState<Record<string, { created_at: string; user_email: string | null }>>({});

  // Histórico de decisões + análises (últimos 30 dias)
  type HistEvento = {
    tipo: "aprovado" | "reprovado" | "analise";
    cliente: string;
    orcamentista: string | null;
    vendedor: string | null;
    motivo: string | null;
    quem: string;
    quando: string; // ISO
    card_id: string;
  };
  const [historico, setHistorico] = useState<HistEvento[]>([]);
  const [secOpen, setSecOpen] = useState<Record<string, boolean>>({ pendentes: true });

  const carregarHistorico = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const [decRes, chatRes] = await Promise.all([
        fetch(`${SB_URL}/rest/v1/orcamento_aprovacoes?decidido_em=gte.${since}&select=card_id,cliente,vendedor,orcamentista,decisao,motivo,aprovado_por_email,aprovado_por_nome,decidido_em&order=decidido_em.desc&limit=400`, {
          headers: { apikey: SB_KEY },
        }).then((r) => r.json()),
        fetch(`${CHAT_URL}/rest/v1/card_chat_messages?created_at=gte.${since}&msg=like.%5BCOMENT%C3%81RIO%20CEO%5D%25&select=context_id,user_name,user_email,msg,created_at&order=created_at.desc&limit=400`, {
          headers: { apikey: SB_KEY },
        }).then((r) => r.json()),
      ]);

      // Mapa card_id → { cliente, vendedor, orcamentista } pra completar dados de comentários
      // (card_chat_messages não guarda esses campos; orcamento_aprovacoes guarda).
      type CardInfo = { cliente?: string | null; vendedor?: string | null; orcamentista?: string | null };
      const cardInfo: Record<string, CardInfo> = {};
      if (Array.isArray(decRes)) {
        decRes.forEach((d: any) => {
          if (!d.card_id) return;
          const cur = cardInfo[d.card_id] || {};
          cardInfo[d.card_id] = {
            cliente: cur.cliente || d.cliente || null,
            vendedor: cur.vendedor || d.vendedor || null,
            orcamentista: cur.orcamentista || d.orcamentista || null,
          };
        });
      }
      // Pra qualquer card_id em comentários que não temos cliente/vendedor/orcamentista, busca no kanban_cards.details
      const idsFaltando = Array.isArray(chatRes)
        ? Array.from(new Set(chatRes.map((c: any) => c.context_id).filter((id: any) => {
            if (!id) return false;
            const ci = cardInfo[id];
            return !ci || !ci.cliente || !ci.vendedor || !ci.orcamentista;
          })))
        : [];
      // Tb adiciona ids de decisões cujo dado pode estar incompleto (raro mas seguro)
      if (Array.isArray(decRes)) {
        decRes.forEach((d: any) => {
          const ci = cardInfo[d.card_id];
          if (!ci || !ci.cliente || !ci.vendedor || !ci.orcamentista) {
            if (d.card_id && !idsFaltando.includes(d.card_id)) idsFaltando.push(d.card_id);
          }
        });
      }
      if (idsFaltando.length > 0) {
        try {
          const cardsRes = await fetch(
            `${SB_URL}/rest/v1/kanban_cards?id=in.(${idsFaltando.join(",")})&select=id,title,details`,
            { headers: { apikey: SB_KEY } }
          ).then((r) => r.json());
          if (Array.isArray(cardsRes)) {
            cardsRes.forEach((k: any) => {
              const det = k.details || {};
              const cur = cardInfo[k.id] || {};
              cardInfo[k.id] = {
                cliente: cur.cliente || det.cliente || k.title || null,
                vendedor: cur.vendedor || det.vendedor || null,
                orcamentista: cur.orcamentista || det.orcamentista || null,
              };
            });
          }
        } catch (e) { console.warn("[carregarHistorico/cardInfo]", e); }
      }

      // Helper: prefere nome a email. Se o valor parece email, usa fallback.
      const semEmail = (val: string | null | undefined, fallback: string | null | undefined): string | null => {
        const v = (val || "").trim();
        if (v && !v.includes("@")) return v;
        const f = (fallback || "").trim();
        if (f && !f.includes("@")) return f;
        return v || f || null;
      };

      const evs: HistEvento[] = [];
      if (Array.isArray(decRes)) {
        decRes.forEach((d: any) => {
          const ci = cardInfo[d.card_id] || {};
          evs.push({
            tipo: d.decisao === "aprovado" ? "aprovado" : "reprovado",
            cliente: semEmail(d.cliente, ci.cliente) || "—",
            orcamentista: semEmail(d.orcamentista, ci.orcamentista),
            vendedor: semEmail(d.vendedor, ci.vendedor),
            motivo: d.motivo || null,
            quem: d.aprovado_por_nome || (d.aprovado_por_email || "").split("@")[0],
            quando: d.decidido_em,
            card_id: d.card_id,
          });
        });
      }
      if (Array.isArray(chatRes)) {
        chatRes.forEach((c: any) => {
          const corpo = String(c.msg || "").replace(/^\[COMENT[ÁA]RIO CEO\]\s*\n?/, "").trim();
          const ci = cardInfo[c.context_id] || {};
          evs.push({
            tipo: "analise",
            cliente: semEmail(ci.cliente, c.topic) || "—",
            orcamentista: semEmail(ci.orcamentista, null),
            vendedor: semEmail(ci.vendedor, null),
            motivo: corpo,
            quem: c.user_name || (c.user_email || "").split("@")[0],
            quando: c.created_at,
            card_id: c.context_id,
          });
        });
      }
      evs.sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime());
      setHistorico(evs);
    } catch (e) { console.warn("[carregarHistorico]", e); }
  }, []);

  useEffect(() => {
    if (!autorizado) return;
    carregarHistorico();
    const t = setInterval(carregarHistorico, 60_000);
    return () => clearInterval(t);
  }, [autorizado, carregarHistorico]);

  // ─── Amostras pendentes de aprovação ────────────────────────────────
  const carregarAmostras = useCallback(async () => {
    if (!autorizado) return;
    setAmostrasLoading(true); setAmostrasErr(null);
    try {
      const rows = await amostrasApi.listar({ statuses: ["solicitada"], limit: 100 });
      setAmostrasPend(rows);
    } catch (e: any) {
      setAmostrasErr(e?.message || "Falha ao carregar amostras");
    } finally {
      setAmostrasLoading(false);
    }
  }, [autorizado]);

  useEffect(() => {
    if (!autorizado) return;
    // sempre mantém o contador atualizado (mesmo na aba orçamentos) pra o badge
    carregarAmostras();
    const t = setInterval(carregarAmostras, 60_000);
    return () => clearInterval(t);
  }, [autorizado, carregarAmostras]);

  async function amostraAprovar(a: AmostraSolicitacao) {
    if (busy) return;
    setBusy("amostra:" + a.id);
    try {
      await amostrasApi.aprovar(a.id, appUser?.id || "");
      setToast({ type: "ok", text: `Amostra aprovada — vai pro kanban do Marco em até 3min.` });
      setAmostrasPend((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e: any) {
      setToast({ type: "err", text: "Falha ao aprovar: " + (e?.message || e) });
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 5000);
    }
  }

  async function amostraRejeitar(a: AmostraSolicitacao, motivoRej: string) {
    if (busy) return;
    const m = (motivoRej || "").trim();
    if (!m) { setToast({ type: "err", text: "Motivo obrigatório pra rejeitar." }); setTimeout(() => setToast(null), 4000); return; }
    setBusy("amostra:" + a.id);
    try {
      await amostrasApi.rejeitar(a.id, appUser?.id || "", m);
      setToast({ type: "ok", text: "Amostra rejeitada." });
      setAmostrasPend((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e: any) {
      setToast({ type: "err", text: "Falha ao rejeitar: " + (e?.message || e) });
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 5000);
    }
  }

  // Agrupa eventos por dia (chave: YYYY-MM-DD na timezone local)
  const historicoPorDia = useMemo(() => {
    const out: Record<string, HistEvento[]> = {};
    historico.forEach((ev) => {
      const d = new Date(ev.quando);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      if (!out[key]) out[key] = [];
      out[key].push(ev);
    });
    return out;
  }, [historico]);

  const diasOrdenados = useMemo(() => Object.keys(historicoPorDia).sort().reverse(), [historicoPorDia]);

  function rotuloDia(key: string): string {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const ontem = new Date(hoje); ontem.setDate(ontem.getDate()-1);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (key === fmt(hoje)) return "HOJE";
    if (key === fmt(ontem)) return "ONTEM";
    const [y,m,dd] = key.split("-");
    return `${dd}/${m}/${y}`;
  }

  function toggleSec(k: string) {
    setSecOpen((p) => ({ ...p, [k]: !p[k] }));
  }

  // Carrega dados completos de 1 card (clicado no histórico) e abre o overlay da proposta.
  // Para "Em Análise" (ainda em analise-orc ou analise-douglas), permite Aprovar/Reprovar.
  async function abrirDetalheHistorico(cardId: string) {
    try {
      setBusy(cardId);
      const r = await fetch(`${WAVOIP_API}/api/orcamento/aprovacao/card/${cardId}`);
      if (!r.ok) {
        setToast({ type: "err", text: "Card não encontrado." });
        return;
      }
      const item: AprovacaoItem = await r.json();
      if (item.proposta_link) {
        const firstSim = (item.simulacoes && item.simulacoes[0]) || item.simulacao || null;
        setPropostaOpen({ item, sim: firstSim });
      } else {
        // sem proposta, abre só o chat
        await abrirConversa(item);
      }
    } catch (e: any) {
      setToast({ type: "err", text: String(e?.message || e) });
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function abrirConversa(item: AprovacaoItem) {
    setConversaOpen(item);
    setConversaMsgs([]);
    try {
      const r = await fetch(`${CHAT_URL}/rest/v1/card_chat_messages?context_id=eq.${item.card.id}&select=id,user_name,user_email,avatar,msg,created_at&order=created_at.asc`, {
        headers: { apikey: SB_KEY },
      });
      const rows = await r.json();
      setConversaMsgs(Array.isArray(rows) ? rows : []);
      markChatRead(item.card.id);
      // dispara re-render do badge
      setChatLatest((prev) => ({ ...prev }));
    } catch (e) { console.warn("[abrirConversa]", e); }
  }

  const refreshChatCounts = useCallback(async (items: AprovacaoItem[]) => {
    const ids = items.map((i) => i.card.id).filter(Boolean);
    const cc = await fetchChatCounts(ids);
    setChatCounts(cc.counts);
    setChatLatest(cc.latest);
  }, []);

  const hasUnreadFor = useCallback((cardId: string): boolean => {
    const lt = chatLatest[cardId];
    if (!lt || !lt.created_at) return false;
    const me = (appUser?.email || "").toLowerCase();
    if (lt.user_email && me && String(lt.user_email).toLowerCase() === me) return false;
    const seen = getLastSeenChat();
    const lastReadIso = seen[cardId] || "1970-01-01T00:00:00Z";
    return new Date(lt.created_at) > new Date(lastReadIso);
  }, [chatLatest, appUser]);

  // Auto-refresh a cada 30s — PAUSA enquanto Douglas está vendo uma proposta
  // ou no modal de rejeição (pra não trocar a lista debaixo dele e fechar/mudar
  // o conteúdo que ele tá lendo).
  useEffect(() => {
    if (!autorizado) return;
    if (propostaOpen || rejeitarOpen || comentarioOpen) return;  // pausa enquanto algo aberto
    const t = setInterval(() => lista.reload(), 30_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorizado, propostaOpen, rejeitarOpen, comentarioOpen]);

  const items = lista.data?.items || [];
  const ordenados = useMemo(() => {
    // Filtra: se a última msg do chat for do próprio CEO (eu) — saiu da fila pra "Em Análise".
    // Se for de outro (orçamentista respondeu) — volta pra fila com Resposta NOVA.
    // Backend já retorna ordenado por orçamentista (A-Z) + data do pedido mais antigo.
    const me = (appUser?.email || "").toLowerCase();
    return items.filter((i) => {
      const lt = chatLatest[i.card.id];
      if (!lt || !lt.user_email) return true;
      return String(lt.user_email).toLowerCase() !== me;
    });
  }, [items, chatLatest, appUser]);

  // Agrupa por orçamentista pra render (Will 20/07)
  const porOrcamentista = useMemo(() => {
    const map = new Map<string, AprovacaoItem[]>();
    ordenados.forEach((it) => {
      const orc = it.orcamentista || "—";
      if (!map.has(orc)) map.set(orc, []);
      map.get(orc)!.push(it);
    });
    return Array.from(map.entries());
  }, [ordenados]);

  // Carrega chat counts quando a lista muda; poll 12s pra detectar respostas do orçamentista
  useEffect(() => {
    if (!autorizado || items.length === 0) return;
    refreshChatCounts(items);
    const t = setInterval(() => refreshChatCounts(items), 12_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorizado, items.map((i) => i.card.id).join(",")]);

  async function callDecisao(item: AprovacaoItem, decisao: "aprovar" | "rejeitar", motivoTxt?: string, sim?: SimItem | null) {
    setBusy(item.card.id);
    try {
      // Multi-sim: hit por-simulacao se temos sim. Senão fallback pro endpoint card-level (legacy).
      const url = sim
        ? `${WAVOIP_API}/api/orcamento/aprovacao/por-simulacao/${sim.id}/${decisao}`
        : `${WAVOIP_API}/api/orcamento/aprovacao/${item.card.id}/${decisao}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: appUser?.email,
          nome: appUser?.nome,
          motivo: motivoTxt,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setToast({ type: "err", text: j.detail || `HTTP ${r.status}` });
      } else {
        const numero = sim?.numero || null;
        const propLine = numero ? ` — Proposta #${numero}` : "";
        setToast({ type: "ok", text: decisao === "aprovar"
          ? (j.card_movido ? `Proposta #${numero || "?"} aprovada — card movido pra Pronta` : `Proposta #${numero || "?"} aprovada (faltam ${j.dados?.pendentes_count ?? "?"} pendentes)`)
          : (j.card_movido ? `Proposta #${numero || "?"} rejeitada — card movido pra Refazer` : `Proposta #${numero || "?"} rejeitada (faltam ${j.dados?.pendentes_count ?? "?"} pendentes)`) });
        // Se rejeição: registra no chat do card com [REJEIÇÃO CEO — Proposta #N]
        if (decisao === "rejeitar" && motivoTxt) {
          await postarComentarioChat({
            cardId: item.card.id, texto: motivoTxt, tipo: "rejeicao",
            user: appUser, cliente: item.cliente, simNumero: numero,
          });
        }
        // Notifica grupo Parket — Orçamentos com @ no orçamentista (sempre por decisão individual)
        try {
          const orc = item.orcamentista || "—";
          const vd = item.vendedor || "—";
          const orcPhone = await lookupOrcamentistaPhone(orc);
          if (decisao === "aprovar") {
            await waNotifyGroup(
              `✅ *CEO APROVOU* — ${item.cliente}${propLine}\n\nOrçamentista: ${orc}\nVendedor: ${vd}` +
              (j.card_movido ? `\n\nCard movido pra Proposta Pronta.` : `\n\n_(faltam outras propostas pendentes neste card)_`),
              orcPhone
            );
          } else {
            await waNotifyGroup(
              `❌ *CEO REJEITOU* — ${item.cliente}${propLine}\n\nOrçamentista: ${orc}\nVendedor: ${vd}\n\n*Motivo:*\n${motivoTxt || "—"}` +
              (j.card_movido ? `\n\nCard movido pra Refazer.` : `\n\n_(faltam outras propostas pendentes neste card)_`),
              orcPhone
            );
          }
        } catch (we) { console.warn("[wa-decisao]", we); }
        markChatRead(item.card.id);
        lista.reload();
        setRejeitarOpen(null);
        setPropostaOpen(null);
        setMotivo("");
      }
    } catch (e: any) {
      setToast({ type: "err", text: String(e?.message || e) });
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function enviarComentario(item: AprovacaoItem, texto: string, sim?: SimItem | null) {
    if (!texto.trim()) return;
    setBusy(item.card.id);
    try {
      const numero = sim?.numero || null;
      const propLine = numero ? ` — Proposta #${numero}` : "";
      // 1) grava no chat do card com prefixo [COMENTÁRIO CEO — Proposta #N]
      await postarComentarioChat({
        cardId: item.card.id, texto, tipo: "comentario",
        user: appUser, cliente: item.cliente, simNumero: numero,
      });
      // 2) Grava a dúvida em details.duvida_douglas → banner amarelo no card da
      //    Valoria pro orçamentista ver. Card-level move pra 'analise-orc';
      //    por-proposta NÃO move (mantém as outras pendentes na fila Douglas).
      try {
        const r = await fetch(`${WAVOIP_API}/api/orcamento/aprovacao/${item.card.id}/comentar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: appUser?.email, nome: appUser?.nome,
            texto, simulacao_id: sim?.id || null, mover: !sim,
          }),
        });
        if (!r.ok) console.warn("[mover-card-comentar]", r.status, await r.text().catch(() => ""));
      } catch (me) { console.warn("[mover-card-comentar]", me); }
      // 3) Notifica grupo Parket — Orçamentos com @ no orçamentista
      try {
        const orc = item.orcamentista || "—";
        const orcPhone = await lookupOrcamentistaPhone(orc);
        await waNotifyGroup(
          `💬 *COMENTÁRIO do CEO* — ${item.cliente}${propLine}\n\nOrçamentista: ${orc}\n\n*Mensagem:*\n${texto}\n\n` +
          (sim ? "Card continua em Análise Douglas — responder pelo chat do card no Space." : "Card movido pra \"Em Análise\" — responder pelo chat do card no Space."),
          orcPhone
        );
      } catch (we) { console.warn("[wa-comentario]", we); }
      markChatRead(item.card.id);
      setChatCounts((prev) => ({ ...prev, [item.card.id]: (prev[item.card.id] || 0) + 1 }));
      setToast({ type: "ok", text: sim ? `Comentário enviado pra Proposta #${numero || "?"}` : "Comentário enviado — card movido pra Em Análise" });
      setComentarioOpen(null);
      setComentarioTxt("");
      lista.reload();
      carregarHistorico();
    } catch (e: any) {
      setToast({ type: "err", text: String(e?.message || e) });
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  if (!autorizado) {
    return (
      <div style={{ padding: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgb(var(--hb-text) / 0.5)", fontSize: 13, gap: 12, background: "rgb(var(--hb-bg))", minHeight: "100%" }}>
        <AlertTriangle size={24} color="rgb(var(--hb-amber))" />
        <div>Apenas Douglas e admins podem aprovar propostas.</div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "rgb(var(--hb-bg))", color: "rgb(var(--hb-text))", fontFamily: "system-ui, sans-serif" }}>
      {/* Header — idêntico ao CEO Dashboard */}
      {showHeader && (
        <div style={{ background: "rgb(var(--hb-bg))", borderBottom: "1px solid rgb(var(--hb-accent) / 0.3)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexShrink: 0, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.6rem", color: "rgb(var(--hb-text))", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>Análise Douglas</div>
            <h2 style={{ margin: "2px 0 0", fontSize: "1.15rem", color: "rgb(var(--hb-text))", fontWeight: 700 }}>Fila de Aprovação</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TabsBar tab={tab} setTab={setTab} orcCount={lista.data?.total ?? 0} amostrasCount={amostrasPend.length} />
            <button
              onClick={() => { lista.reload(); carregarAmostras(); }}
              style={{ background: "transparent", border: "1px solid rgb(var(--hb-border))", color: "rgb(var(--hb-text))", padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={11} /> Atualizar
            </button>
          </div>
        </div>
      )}

      {/* Lista — cards limpos + seções por dia */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 40px", maxWidth: 1100, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {tab === "amostras" ? (
          <AmostrasApprovalList
            items={amostrasPend}
            loading={amostrasLoading}
            error={amostrasErr}
            busyId={busy}
            onAprovar={amostraAprovar}
            onRejeitar={amostraRejeitar}
          />
        ) : (<>
        {lista.loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "rgb(var(--hb-text) / 0.55)", fontSize: 12, padding: "48px 0" }}>
            <Loader2 size={14} className="animate-spin" /> Carregando fila de aprovação…
          </div>
        )}

        {/* ═══ PENDENTES ═══ */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingLeft: 2 }}>
            <span style={{ width: 4, height: 18, background: "rgb(var(--hb-text))", borderRadius: 2 }} />
            <h3 style={{ margin: 0, fontSize: 12, color: "rgb(var(--hb-text))", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>
              Solicitações para Análise
            </h3>
            <span style={{ background: "rgb(var(--hb-accent) / 0.15)", color: "rgb(var(--hb-text))", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 10 }}>{ordenados.length}</span>
          </div>

          {ordenados.length === 0 && !lista.loading && (
            <div style={{ background: "rgb(var(--hb-panel))", border: "1px dashed rgb(var(--hb-border))", borderRadius: 12, padding: "24px 18px", textAlign: "center", color: "rgb(var(--hb-text) / 0.4)", fontSize: 12 }}>
              Fila zerada — nada pendente no momento.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {porOrcamentista.map(([orc, grupo]) => (
              <div key={"orc:"+orc}>
                {/* Header do orçamentista */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "6px 10px", background: "rgb(var(--hb-bg))", border: "1px solid rgb(var(--hb-border))", borderLeft: "3px solid rgb(var(--hb-accent))", borderRadius: 6 }}>
                  <span style={{ fontSize: 9, color: "rgb(var(--hb-text) / 0.5)", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>Orçamentista</span>
                  <span style={{ fontSize: 12, color: "rgb(var(--hb-text))", fontWeight: 700 }}>{orc}</span>
                  <span style={{ marginLeft: "auto", background: "rgb(var(--hb-accent) / 0.15)", color: "rgb(var(--hb-text))", fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 10 }}>
                    {grupo.length} pendente{grupo.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {grupo.map((item) => {
              const since = tempoDesde(item.card.updated_at || item.card.created_at);
              const isBusy = busy === item.card.id;
              const chatCount = chatCounts[item.card.id] || 0;
              const unread = chatCount > 0 && hasUnreadFor(item.card.id);
              const sims: SimItem[] = Array.isArray(item.simulacoes) ? item.simulacoes : (item.simulacao ? [item.simulacao] : []);
              const pendCount = item.pendentes_count != null ? item.pendentes_count : sims.filter(s => !s.decisao).length;
              const decididasCount = sims.length - pendCount;
              return (
                <div
                  key={item.card.id}
                  style={{
                    background: "rgb(var(--hb-panel))",
                    border: `1px solid ${unread ? "rgba(239,68,68,0.35)" : "rgb(var(--hb-border))"}`,
                    borderLeft: `3px solid ${unread ? "rgb(var(--hb-red))" : "rgb(var(--hb-text))"}`,
                    borderRadius: 10,
                    padding: "14px 16px",
                    transition: "border-color 120ms",
                  }}
                >
                  {/* Linha 1: cliente + chips */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: "rgb(var(--hb-text))", letterSpacing: 0.1 }}>
                        {item.cliente || "—"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
                        {item.card.obra && (
                          <span style={{ fontSize: 10, background: "rgb(var(--hb-border))", border: "1px solid rgb(var(--hb-border))", padding: "2px 7px", borderRadius: 4, color: "rgb(var(--hb-text) / 0.6)", fontWeight: 600 }}>{item.card.obra}</span>
                        )}
                        <span style={{ fontSize: 10.5, color: "rgb(var(--hb-text) / 0.5)" }}>Há {since}</span>
                        {item.historico.length > 0 && (
                          <span style={{ fontSize: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", padding: "2px 7px", borderRadius: 4, color: "rgb(var(--hb-amber))", fontWeight: 700 }}>
                            {item.historico.length}ª análise
                          </span>
                        )}
                        {sims.length > 1 && (
                          <span style={{ fontSize: 10, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", padding: "2px 7px", borderRadius: 4, color: "rgb(var(--hb-text))", fontWeight: 700 }}>
                            {sims.length} propostas{decididasCount > 0 ? ` · ${decididasCount} decidida${decididasCount === 1 ? "" : "s"}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {chatCount > 0 && (unread ? (
                        <button
                          onClick={() => abrirConversa(item)} title="Orçamentista respondeu"
                          style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(239,68,68,0.22)", border: "1.5px solid rgb(var(--hb-red))", color: "rgb(var(--hb-text))", cursor: "pointer", fontSize: 10, fontWeight: 700, animation: "pktApprovPulse 1.4s ease-in-out infinite", boxShadow: "0 0 0 0 rgba(239,68,68,0.6)", whiteSpace: "nowrap" }}
                        >💬 NOVA <span style={{ background: "rgb(var(--hb-text))", color: "rgb(var(--hb-red))", padding: "0 6px", borderRadius: 8, marginLeft: 4, fontSize: 9, fontWeight: 800 }}>{chatCount}</span></button>
                      ) : (
                        <button
                          onClick={() => abrirConversa(item)} title="Ver conversa"
                          style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", color: "rgb(var(--hb-text))", cursor: "pointer", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}
                        >💬 <span style={{ background: "rgb(var(--hb-accent))", color: "rgb(var(--hb-text))", padding: "0 5px", borderRadius: 8, marginLeft: 3, fontSize: 9 }}>{chatCount}</span></button>
                      ))}
                    </div>
                  </div>

                  {/* Linha 2: vendedor / orçamentista */}
                  <div style={{ display: "flex", gap: 18, fontSize: 11, color: "rgb(var(--hb-text) / 0.55)", flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid rgb(var(--hb-border))" }}>
                    <span><span style={{ color: "rgb(var(--hb-text) / 0.4)" }}>Orçamentista </span><b style={{ color: "rgb(var(--hb-text))", fontWeight: 600 }}>{item.orcamentista || "—"}</b></span>
                    {item.vendedor && (
                      <span><span style={{ color: "rgb(var(--hb-text) / 0.4)" }}>Vendedor </span><b style={{ color: "rgb(var(--hb-text))", fontWeight: 600 }}>{item.vendedor}</b></span>
                    )}
                  </div>

                  {/* Dúvida enviada + resposta do orçamentista (details.duvida_douglas) */}
                  {item.card.details?.duvida_douglas?.texto && (
                    <div style={{ marginTop: 10, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "9px 12px", fontSize: 11 }}>
                      <div style={{ color: "rgb(var(--hb-amber))", fontWeight: 700, marginBottom: 3 }}>
                        💬 Dúvida enviada{item.card.details.duvida_douglas.em ? ` — ${tempoDesde(item.card.details.duvida_douglas.em)} atrás` : ""}
                      </div>
                      <div style={{ color: "rgb(var(--hb-text) / 0.75)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {item.card.details.duvida_douglas.texto}
                      </div>
                      {item.card.details.duvida_douglas.resposta?.texto ? (
                        <div style={{ marginTop: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 6, padding: "7px 10px" }}>
                          <div style={{ color: "rgb(var(--hb-green))", fontWeight: 700, marginBottom: 2 }}>
                            ↩ {item.card.details.duvida_douglas.resposta.por || "Orçamentista"} respondeu
                            {item.card.details.duvida_douglas.resposta.em ? ` — ${tempoDesde(item.card.details.duvida_douglas.resposta.em)} atrás` : ""}
                          </div>
                          <div style={{ color: "rgb(var(--hb-text))", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                            {item.card.details.duvida_douglas.resposta.texto}
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 5, color: "rgb(var(--hb-text) / 0.45)", fontStyle: "italic" }}>
                          Aguardando resposta do orçamentista…
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lista de propostas — cada uma com seus botões */}
                  {sims.length === 0 ? (
                    <div style={{ marginTop: 10, fontSize: 11, color: "rgb(var(--hb-amber))" }}>⚠ Sem proposta vinculada</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                      {sims.map((s) => {
                        const numero = s.numero || (s.id ? s.id.slice(0,8) : "—");
                        const link = s.link || item.proposta_link || "";
                        const decidida = s.decisao;
                        const decTag = decidida
                          ? (decidida.decisao === "aprovado"
                            ? <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(16,185,129,0.18)", color: "rgb(var(--hb-green))", fontWeight: 700, textTransform: "uppercase" }}>✓ Aprovada</span>
                            : <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(239,68,68,0.18)", color: "rgb(var(--hb-red))", fontWeight: 700, textTransform: "uppercase" }}>✕ Rejeitada</span>)
                          : <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(245,158,11,0.18)", color: "rgb(var(--hb-amber))", fontWeight: 700, textTransform: "uppercase" }}>⏳ Pendente</span>;
                        return (
                          <div key={s.id} style={{ background: "rgb(var(--hb-bg))", border: "1px solid rgb(var(--hb-border))", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: 160 }}>
                              <div style={{ fontSize: 12, color: "rgb(var(--hb-text))", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                                <span>Proposta #{numero}</span>
                                {decTag}
                              </div>
                              {decidida && decidida.motivo && (
                                <div style={{ fontSize: 10, color: "rgb(var(--hb-text) / 0.5)", marginTop: 2 }}>Motivo: {decidida.motivo.slice(0,120)}{decidida.motivo.length > 120 ? "…" : ""}</div>
                              )}
                            </div>
                            {link && (
                              <button
                                onClick={() => setPropostaOpen({ item, sim: s })}
                                style={{ padding: "6px 12px", borderRadius: 5, background: "rgb(var(--hb-accent) / 0.18)", border: "1px solid rgb(var(--hb-accent) / 0.5)", color: "rgb(var(--hb-text))", cursor: "pointer", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}
                              >Ver</button>
                            )}
                            {/* Análise de Custo (Will 08/09): margem estimada pro Douglas */}
                            {s.analise_custo && s.analise_custo.venda_total > 0 && (
                              <button
                                onClick={() => setAnaliseOpen((p) => ({ ...p, [s.id]: !p[s.id] }))}
                                style={{ padding: "6px 12px", borderRadius: 5, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.45)", color: "rgb(var(--hb-amber))", cursor: "pointer", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}
                              >{analiseOpen[s.id] ? "Fechar Custo" : "Custo"}</button>
                            )}
                            <button
                              disabled={isBusy}
                              onClick={() => { setComentarioOpen({ item, sim: s }); setComentarioTxt(""); }}
                              style={{ padding: "6px 12px", borderRadius: 5, background: "rgba(59,130,246,0.18)", border: "1px solid rgba(59,130,246,0.5)", color: "rgb(var(--hb-textDim))", cursor: isBusy ? "not-allowed" : "pointer", fontSize: 10, fontWeight: 700, textTransform: "uppercase", opacity: isBusy ? 0.5 : 1 }}
                            >💬 {decidida ? "Comentar" : "Dúvida"}</button>
                            {!decidida && (
                              <>
                                <button
                                  disabled={isBusy}
                                  onClick={() => setRejeitarOpen({ item, sim: s })}
                                  style={{ padding: "6px 12px", borderRadius: 5, background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.5)", color: "rgb(var(--hb-red))", cursor: isBusy ? "not-allowed" : "pointer", fontSize: 10, fontWeight: 700, textTransform: "uppercase", opacity: isBusy ? 0.5 : 1 }}
                                >✕ Rejeitar</button>
                                <button
                                  disabled={isBusy}
                                  onClick={() => {
                                    if (!confirm(`Aprovar Proposta #${numero}?\n\nSe ainda houver outras pendentes neste card, o card continua em Análise Douglas até todas serem decididas.`)) return;
                                    callDecisao(item, "aprovar", undefined, s);
                                  }}
                                  style={{ padding: "6px 12px", borderRadius: 5, background: "rgba(16,185,129,0.22)", border: "1px solid rgba(16,185,129,0.55)", color: "rgb(var(--hb-green))", cursor: isBusy ? "not-allowed" : "pointer", fontSize: 10, fontWeight: 700, textTransform: "uppercase", opacity: isBusy ? 0.5 : 1 }}
                                >✓ Aprovar</button>
                              </>
                            )}
                            {/* Painel Análise de Custo: itens vendidos + resumo de margem.
                                width 100% força quebra pra linha de baixo dentro do flex-wrap. */}
                            {s.analise_custo && analiseOpen[s.id] && (() => {
                              const ac = s.analise_custo;
                              const itens = s.itens || [];
                              const pos = ac.resultado >= 0;
                              const linha = (label: string, valor: string, opts?: { bold?: boolean; cor?: string }) => (
                                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, color: opts?.cor || "rgb(var(--hb-text) / 0.75)", fontWeight: opts?.bold ? 700 : 500 }}>
                                  <span>{label}</span>
                                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{valor}</span>
                                </div>
                              );
                              return (
                                <div style={{ width: "100%", marginTop: 6, borderTop: "1px dashed rgb(var(--hb-border))", paddingTop: 10 }}>
                                  {/* Tabela: valor de cada item vendido */}
                                  <div style={{ fontSize: 9, color: "rgb(var(--hb-text) / 0.5)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 6 }}>Itens vendidos</div>
                                  <div style={{ border: "1px solid rgb(var(--hb-border))", borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
                                    {itens.map((it, ix) => (
                                      <div key={ix} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "5px 10px", background: ix % 2 ? "transparent" : "rgb(var(--hb-panel))", fontSize: 11 }}>
                                        {/* Descrição (material: categoria + espécie + cor) com a dimensão/formato
                                            visível logo abaixo (Will 08/09), não mais escondida só no tooltip.
                                            Recortes: a 2a linha mostra QUAIS são (detalhe do backend) */}
                                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden" }} title={it.descricao + (it.dimensao ? " " + it.dimensao : "") + (it.detalhe ? " " + it.detalhe : "")}>
                                          <span style={{ display: "block", color: "rgb(var(--hb-text))", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {it.descricao}
                                          </span>
                                          {it.dimensao || it.detalhe ? (
                                            <span style={{ display: "block", color: "rgb(var(--hb-text) / 0.5)", fontSize: 9.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                              {[it.dimensao, it.detalhe].filter(Boolean).join(" ")}
                                            </span>
                                          ) : null}
                                        </span>
                                        {it.metragem ? <span style={{ color: "rgb(var(--hb-text) / 0.45)", fontSize: 10, flexShrink: 0 }}>{it.metragem.toLocaleString("pt-BR")} m2</span> : null}
                                        {/* R$/m2 REALMENTE usado pra montar o orçamento (Will 08/09): tabela, ou o
                                            valor efetivo quando o orçamentista fechou o material na mão (asterisco) */}
                                        {it.preco_m2 ? (
                                          <span
                                            style={{ color: "rgb(var(--hb-text) / 0.6)", fontSize: 10, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}
                                            title={it.material_ajustado ? "Valor do m2 usado no orçamento (material fechado manualmente pelo orçamentista, difere da tabela)" : "Valor do m2 usado no orçamento (preço de tabela)"}
                                          >
                                            {fmtBRL(it.preco_m2)}/m2{it.material_ajustado ? "*" : ""}
                                          </span>
                                        ) : null}
                                        <span style={{ color: "rgb(var(--hb-text))", fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtBRL(it.valor_total)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {/* Fechamento do valor da proposta (Will 08/09): tudo que compõe o
                                      total que o cliente vê: itens + frete - desconto */}
                                  <div style={{ background: "rgb(var(--hb-panel))", border: "1px solid rgb(var(--hb-border))", borderRadius: 6, padding: "8px 12px", marginBottom: 10 }}>
                                    {linha("Total dos itens", fmtBRL(ac.venda_total))}
                                    {ac.frete > 0 ? linha("Frete", "+ " + fmtBRL(ac.frete)) : null}
                                    {ac.desconto > 0 ? linha("Desconto", "- " + fmtBRL(ac.desconto)) : null}
                                    {linha("Total da proposta", fmtBRL(ac.total_proposta ?? ac.venda_total), { bold: true, cor: "rgb(var(--hb-text))" })}
                                    {/* Condições que mudam a leitura do valor */}
                                    {s.forma_pagamento ? (
                                      <div style={{ fontSize: 10, color: "rgb(var(--hb-text) / 0.6)", marginTop: 4 }}>
                                        Pagamento: {s.forma_pagamento.trim()}
                                      </div>
                                    ) : null}
                                    {s.consideracoes ? (
                                      <div style={{ fontSize: 10, color: "rgb(var(--hb-yellow, 234 179 8))", marginTop: 2 }}>
                                        Consideracoes: {s.consideracoes.trim()}
                                      </div>
                                    ) : null}
                                  </div>
                                  {/* Resumo: venda, deduções e resultado estimado */}
                                  <div style={{ background: "rgb(var(--hb-panel))", border: "1px solid rgb(var(--hb-border))", borderRadius: 6, padding: "8px 12px" }}>
                                    {linha("Venda total", fmtBRL(ac.venda_total), { bold: true, cor: "rgb(var(--hb-text))" })}
                                    {linha(`Comissão vendedor (${Math.round(ac.comissao_pct * 100)}%)`, "- " + fmtBRL(ac.comissao))}
                                    {ac.arquiteto
                                      ? linha(`RT arquiteto ${ac.arquiteto} (${Math.round(ac.rt_pct * 100)}% s/ líquido)`, "- " + fmtBRL(ac.rt))
                                      : linha("RT arquiteto", "sem arquiteto no card")}
                                    {linha(`Impostos (${Math.round(ac.impostos_pct * 100)}%)`, "- " + fmtBRL(ac.impostos))}
                                    {/* Custos separados (Will 08/09): fabricação SÓ do que passa
                                        pela fábrica (porta/marcenaria/laminado, regra do PCP);
                                        insumos de obra dos comprados prontos; instalação de tudo.
                                        Fallback pro campo antigo "insumos" se backend não separou. */}
                                    {ac.insumos_fab != null
                                      ? linha("Insumos fabricação (porta/marcenaria/laminados)", "- " + fmtBRL(ac.insumos_fab))
                                      : null}
                                    {ac.insumos_obra != null && ac.insumos_obra > 0
                                      ? linha("Insumos de obra (cola, manta...)", "- " + fmtBRL(ac.insumos_obra))
                                      : null}
                                    {ac.instalacao != null
                                      ? linha("Instalação", "- " + fmtBRL(ac.instalacao))
                                      : null}
                                    {ac.insumos_fab == null && ac.instalacao == null
                                      ? linha("Insumos fabricação + instalação", "- " + fmtBRL(ac.insumos))
                                      : null}
                                    {/* Material comprado pronto (piso régua, deck, ripado...) não
                                        tem custo de compra no sistema — avisar em vez de fingir
                                        que o resultado já desconta isso */}
                                    {ac.material_pronto_venda != null && ac.material_pronto_venda > 0 ? (
                                      <div style={{ fontSize: 10, color: "rgb(var(--hb-yellow, 234 179 8))", marginTop: 4 }}>
                                        Atencao: {fmtBRL(ac.material_pronto_venda)} em material comprado pronto (venda). O custo de compra desse material nao esta registrado e NAO foi descontado do resultado.
                                      </div>
                                    ) : null}
                                    <div style={{ borderTop: "1px solid rgb(var(--hb-border))", marginTop: 4, paddingTop: 4 }}>
                                      {linha(
                                        "Resultado estimado" + (ac.margem_pct != null ? ` (${ac.margem_pct.toLocaleString("pt-BR")}% de margem)` : ""),
                                        fmtBRL(ac.resultado),
                                        { bold: true, cor: pos ? "rgb(var(--hb-green))" : "rgb(var(--hb-red))" }
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ HISTÓRICO POR DIA ═══ */}
        {diasOrdenados.map((diaKey) => {
          const evs = historicoPorDia[diaKey];
          const aprovados = evs.filter((e) => e.tipo === "aprovado");
          const reprovados = evs.filter((e) => e.tipo === "reprovado");
          const analises = evs.filter((e) => e.tipo === "analise");
          const rotulo = rotuloDia(diaKey);
          const isHoje = rotulo === "HOJE";
          const aberto = isHoje ? secOpen[diaKey] !== false : !!secOpen[diaKey];
          const corDia = isHoje ? "rgb(var(--hb-green))" : "rgb(var(--hb-textDim))";
          return (
            <div key={diaKey} style={{ marginBottom: 24 }}>
              {/* Header do dia — clicável pra colapsar */}
              <button
                onClick={() => toggleSec(diaKey)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: isHoje ? "rgba(16,185,129,0.06)" : "transparent",
                  border: `1px solid ${isHoje ? "rgba(16,185,129,0.18)" : "rgb(var(--hb-border))"}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  color: "rgb(var(--hb-text))",
                  marginBottom: aberto ? 10 : 0,
                  transition: "margin-bottom 120ms",
                }}
              >
                <span style={{ fontSize: 9, color: corDia, transform: aberto ? "rotate(90deg)" : "rotate(0)", transition: "transform 120ms", display: "inline-block" }}>▶</span>
                <span style={{ fontSize: 12, color: corDia, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>{rotulo}</span>
                <span style={{ flex: 1 }} />
                <span style={{ display: "inline-flex", gap: 12, fontSize: 10.5, fontWeight: 700 }}>
                  {aprovados.length > 0 && <span style={{ color: "rgb(var(--hb-green))" }}>✓ {aprovados.length}</span>}
                  {reprovados.length > 0 && <span style={{ color: "rgb(var(--hb-red))" }}>✕ {reprovados.length}</span>}
                  {analises.length > 0 && <span style={{ color: "rgb(var(--hb-textDim))" }}>💬 {analises.length}</span>}
                  {evs.length === 0 && <span style={{ color: "rgb(var(--hb-text) / 0.35)", fontStyle: "italic", fontWeight: 400 }}>vazio</span>}
                </span>
              </button>

              {aberto && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 4 }}>
                  <SubSecaoStatus titulo="Aprovado" cor="rgb(var(--hb-green))" iconeBg="rgb(var(--hb-green))" icone="✓" eventos={aprovados} onClick={abrirDetalheHistorico} />
                  <SubSecaoStatus titulo="Reprovado" cor="rgb(var(--hb-red))" iconeBg="rgb(var(--hb-red))" icone="✕" eventos={reprovados} onClick={abrirDetalheHistorico} />
                  <SubSecaoStatus titulo="Em Análise" cor="rgb(var(--hb-blue))" iconeBg="rgb(var(--hb-textDim))" icone="💬" eventos={analises} onClick={abrirDetalheHistorico} />
                </div>
              )}
            </div>
          );
        })}

        {!lista.loading && ordenados.length === 0 && diasOrdenados.length === 0 && (
          <div style={{ textAlign: "center", color: "rgb(var(--hb-text) / 0.55)", padding: 60 }}>
            <div style={{ fontSize: "2.4rem", marginBottom: 10 }}>✓</div>
            <div style={{ fontSize: "1rem", fontWeight: 600 }}>Tudo limpo</div>
            <div style={{ fontSize: "0.8rem", marginTop: 4 }}>Sem pendentes nem histórico recente.</div>
          </div>
        )}
        </>)}
      </div>

      {/* keyframes pra animação do botão Resposta NOVA */}
      <style>{`
        @keyframes pktApprovPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.55); transform: scale(1); }
          50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); transform: scale(1.04); }
        }
      `}</style>

      {/* Overlay proposta full-screen */}
      {propostaOpen && (() => {
        const it = propostaOpen.item;
        const sim = propostaOpen.sim;
        const link = sim?.link || it.proposta_link;
        if (!link) return null;
        const numero = sim?.numero || null;
        const decidida = sim?.decisao;
        return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 999999, display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", color: "rgb(var(--hb-text))" }}>
          <div style={{ background: "rgb(var(--hb-bg))", borderBottom: "1px solid rgb(var(--hb-border))", padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "rgb(var(--hb-text))", lineHeight: 1.2, display: "flex", alignItems: "center", gap: 8 }}>
                <span>{it.cliente}</span>
                {numero && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: "rgba(168,85,247,0.18)", color: "rgb(var(--hb-text))", fontWeight: 700, textTransform: "uppercase" }}>Proposta #{numero}</span>}
                {decidida && (decidida.decisao === "aprovado"
                  ? <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(16,185,129,0.18)", color: "rgb(var(--hb-green))", fontWeight: 700, textTransform: "uppercase" }}>✓ Já aprovada</span>
                  : <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(239,68,68,0.18)", color: "rgb(var(--hb-red))", fontWeight: 700, textTransform: "uppercase" }}>✕ Já rejeitada</span>)}
              </div>
            </div>
            <a
              href={link} target="_blank" rel="noreferrer" title="Abrir em nova aba"
              style={{ padding: "6px 10px", borderRadius: 6, background: "rgb(var(--hb-border))", border: "1px solid rgb(var(--hb-border))", color: "rgb(var(--hb-text) / 0.6)", textDecoration: "none", fontSize: 11, fontWeight: 700 }}
            >↗</a>
            <button
              onClick={() => setPropostaOpen(null)} title="Voltar à lista"
              style={{ padding: "6px 10px", borderRadius: 6, background: "transparent", border: "1px solid rgb(var(--hb-border))", color: "rgb(var(--hb-text))", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
            >← Voltar</button>
          </div>
          <iframe src={link} style={{ flex: 1, width: "100%", border: 0, background: "rgb(var(--hb-text))" }} title="Proposta" />
          <div style={{ background: "rgb(var(--hb-bg))", borderTop: "2px solid rgb(var(--hb-border))", padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200, fontSize: 11, color: "rgb(var(--hb-text) / 0.65)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span>Vendedor: <b style={{ color: "rgb(var(--hb-text))" }}>{it.vendedor || "—"}</b></span>
              <span style={{ color: "rgb(var(--hb-border))" }}>·</span>
              <span>Orçamentista: <b style={{ color: "rgb(var(--hb-text))" }}>{it.orcamentista || "—"}</b></span>
              {it.historico.length > 0 && (
                <>
                  <span style={{ color: "rgb(var(--hb-border))" }}>·</span>
                  <span style={{ color: "rgb(var(--hb-amber))", fontWeight: 600 }}>{it.historico.length}ª análise</span>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <button
                disabled={busy === it.card.id}
                onClick={() => { setComentarioOpen({ item: it, sim }); setComentarioTxt(""); }}
                style={{ padding: "8px 18px", borderRadius: 6, background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.55)", color: "rgb(var(--hb-blue))", cursor: "pointer", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}
              >💬 {decidida ? "Comentar" : "Dúvida"}</button>
              {!decidida && (
                <>
                  <button
                    disabled={busy === it.card.id}
                    onClick={() => setRejeitarOpen({ item: it, sim })}
                    style={{ padding: "8px 18px", borderRadius: 6, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.55)", color: "rgb(var(--hb-red))", cursor: "pointer", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >✕ Reprovar</button>
                  <button
                    disabled={busy === it.card.id}
                    onClick={async () => {
                      if (!confirm(`Aprovar Proposta #${numero || "?"}?\n\nSe ainda houver outras pendentes neste card, o card continua em Análise Douglas até todas serem decididas.`)) return;
                      await callDecisao(it, "aprovar", undefined, sim);
                    }}
                    style={{ padding: "8px 18px", borderRadius: 6, background: "rgba(16,185,129,0.25)", border: "1px solid rgba(16,185,129,0.6)", color: "rgb(var(--hb-green))", cursor: "pointer", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    {busy === it.card.id ? "…" : "✓ Aprovar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Modal Conversa — lista mensagens do chat do card */}
      {conversaOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 999998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setConversaOpen(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "rgb(var(--hb-panel))", border: "1px solid rgb(var(--hb-border))", borderRadius: 10, width: "min(620px, 100%)", maxHeight: "82vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 12px 48px rgba(0,0,0,0.5)" }}
          >
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgb(var(--hb-border))", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(180deg,rgb(var(--hb-panel)),rgb(var(--hb-panel)))" }}>
              <div>
                <div style={{ fontSize: 9, color: "rgb(var(--hb-textDim))", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Chat do Card</div>
                <div style={{ fontSize: 13, color: "rgb(var(--hb-text))", fontWeight: 600, marginTop: 2 }}>{conversaOpen.cliente}</div>
              </div>
              <button
                onClick={() => setConversaOpen(null)}
                style={{ background: "transparent", color: "rgb(var(--hb-textDim))", border: "1px solid rgb(var(--hb-border))", padding: "4px 9px", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
              >✕</button>
            </div>
            <div style={{ padding: "14px 16px", overflowY: "auto", color: "rgb(var(--hb-text))", fontSize: 12, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 8 }}>
              {conversaMsgs.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgb(var(--hb-textDim))", padding: "30px 0" }}>Sem mensagens ainda.</div>
              ) : conversaMsgs.map((m) => {
                const meEmail = (appUser?.email || "").toLowerCase();
                const isMe = (m.user_email || "").toLowerCase() === meEmail;
                return (
                  <div key={m.id} style={{ padding: "10px 12px", background: isMe ? "rgb(var(--hb-accent) / 0.08)" : "rgb(var(--hb-panel))", border: "1px solid rgb(var(--hb-border))", borderRadius: 6, borderLeft: `3px solid ${isMe ? "rgb(var(--hb-text))" : "rgb(var(--hb-accent))"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ color: "rgb(var(--hb-text))", fontWeight: 600 }}>
                        {m.avatar ? <span style={{ marginRight: 4 }}>{m.avatar}</span> : null}
                        {m.user_name || m.user_email || "Sistema"}
                      </span>
                      <span style={{ color: "rgb(var(--hb-textDim))", fontSize: 11 }}>{new Date(m.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <div style={{ color: "rgb(var(--hb-text))", whiteSpace: "pre-wrap" }}>{m.msg}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid rgb(var(--hb-border))", display: "flex", justifyContent: "flex-end", gap: 8, background: "rgb(var(--hb-panel))" }}>
              <button
                onClick={() => { const it = conversaOpen; setConversaOpen(null); if (it) setComentarioOpen({ item: it, sim: (it.simulacoes && it.simulacoes[0]) || it.simulacao || null }); setComentarioTxt(""); }}
                style={{ padding: "8px 14px", borderRadius: 6, background: "rgba(59,130,246,0.18)", border: "1px solid rgba(59,130,246,0.55)", color: "rgb(var(--hb-blue))", cursor: "pointer", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}
              >💬 Responder com Comentário</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Comentário — estilo CEO Dashboard (border azul) */}
      {comentarioOpen && (
        <ModalComentarioRejeicao
          tipo="comentario"
          item={comentarioOpen.item}
          simNumero={comentarioOpen.sim?.numero || null}
          texto={comentarioTxt}
          setTexto={setComentarioTxt}
          busy={!!busy}
          onCancel={() => { setComentarioOpen(null); setComentarioTxt(""); }}
          onOk={() => enviarComentario(comentarioOpen.item, comentarioTxt.trim(), comentarioOpen.sim)}
        />
      )}

      {/* Modal Rejeição — estilo CEO Dashboard (border vermelho) */}
      {rejeitarOpen && (
        <ModalComentarioRejeicao
          tipo="rejeicao"
          item={rejeitarOpen.item}
          simNumero={rejeitarOpen.sim?.numero || null}
          texto={motivo}
          setTexto={setMotivo}
          busy={!!busy}
          onCancel={() => { setRejeitarOpen(null); setMotivo(""); }}
          onOk={() => callDecisao(rejeitarOpen.item, "rejeitar", motivo.trim(), rejeitarOpen.sim)}
        />
      )}

      {/* Toast — canto inferior direito */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999999, padding: "12px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, boxShadow: "0 12px 32px rgba(0,0,0,0.6)", background: toast.type === "ok" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.type === "ok" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`, color: toast.type === "ok" ? "rgb(var(--hb-green))" : "rgb(var(--hb-red))" }}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-seção por status (Aprovado / Reprovado / Em Análise) dentro de cada dia
// ════════════════════════════════════════════════════════════════════
type HistEventoLite = {
  tipo: "aprovado" | "reprovado" | "analise";
  cliente: string;
  orcamentista: string | null;
  vendedor: string | null;
  motivo: string | null;
  quem: string;
  quando: string;
  card_id: string;
};
function SubSecaoStatus({ titulo, cor, iconeBg, icone, eventos, onClick }: {
  titulo: string; cor: string; iconeBg?: string; icone: string; eventos: HistEventoLite[];
  onClick?: (cardId: string) => void;
}) {
  if (eventos.length === 0) return null;
  const corHero = iconeBg || cor;
  return (
    <div style={{ background: "rgb(var(--hb-panel))", border: "1px solid rgb(var(--hb-border))", borderRadius: 10, overflow: "hidden" }}>
      {/* Header da sub-seção */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: `${cor}10`, borderBottom: `1px solid ${cor}25` }}>
        <span style={{ width: 22, height: 22, borderRadius: 5, background: `${corHero}28`, color: corHero, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{icone}</span>
        <span style={{ fontSize: 11, color: corHero, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>{titulo}</span>
        <span style={{ background: `${corHero}1E`, color: corHero, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9 }}>{eventos.length}</span>
      </div>
      {/* Itens */}
      <div>
        {eventos.map((ev, idx) => {
          const hora = new Date(ev.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          const clickable = !!onClick && !!ev.card_id;
          return (
            <div
              key={titulo + ":" + idx}
              onClick={clickable ? () => onClick!(ev.card_id) : undefined}
              onMouseEnter={clickable ? (e) => { e.currentTarget.style.background = "rgb(var(--hb-bg))"; } : undefined}
              onMouseLeave={clickable ? (e) => { e.currentTarget.style.background = "transparent"; } : undefined}
              style={{
                display: "flex",
                gap: 14,
                padding: "12px 14px",
                borderTop: idx > 0 ? "1px solid rgb(var(--hb-border))" : "none",
                cursor: clickable ? "pointer" : "default",
                transition: "background 100ms",
                alignItems: "flex-start",
              }}
              title={clickable ? "Ver proposta e detalhes" : undefined}
            >
              {/* Coluna esquerda: cliente + meta + motivo */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: "rgb(var(--hb-text))", fontWeight: 700, letterSpacing: 0.1 }}>{ev.cliente}</div>
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "rgb(var(--hb-text) / 0.55)", marginTop: 4, flexWrap: "wrap" }}>
                  <span><span style={{ color: "rgb(var(--hb-text) / 0.4)" }}>Orç: </span><b style={{ color: "rgb(var(--hb-text))", fontWeight: 600 }}>{ev.orcamentista || "—"}</b></span>
                  <span><span style={{ color: "rgb(var(--hb-text) / 0.4)" }}>Vend: </span><b style={{ color: "rgb(var(--hb-text))", fontWeight: 600 }}>{ev.vendedor || "—"}</b></span>
                </div>
                <div style={{ fontSize: 10.5, color: "rgb(var(--hb-text) / 0.4)", marginTop: 4 }}>
                  por <b style={{ color: "rgb(var(--hb-text) / 0.7)", fontWeight: 600 }}>{ev.quem}</b>
                </div>
                {ev.motivo && (
                  <div style={{ fontSize: 12, color: "rgb(var(--hb-text))", marginTop: 8, padding: "8px 10px", background: "rgb(var(--hb-bg))", borderRadius: 6, borderLeft: `2.5px solid ${cor}`, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                    {ev.motivo}
                  </div>
                )}
              </div>
              {/* Coluna direita: hora + arrow */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "rgb(var(--hb-text) / 0.4)", fontVariantNumeric: "tabular-nums" }}>{hora}</span>
                {clickable && <span style={{ fontSize: 10, color: corHero, opacity: 0.7 }}>↗ abrir</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Seção colapsável — header com título + contagem, body com children
// ════════════════════════════════════════════════════════════════════
function SecaoColapsavel({ aberto, onToggle, titulo, contagem, cor, extra, children }: {
  chave: string;
  aberto: boolean;
  onToggle: () => void;
  titulo: string;
  contagem?: number;
  cor: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "rgb(var(--hb-bg))", border: "1px solid rgb(var(--hb-border))", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", background: "transparent", border: 0, color: "rgb(var(--hb-text))", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: aberto ? cor : "rgb(var(--hb-textDim))", transform: aberto ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 120ms", display: "inline-block" }}>▶</span>
          <span style={{ fontSize: 11, color: cor, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>{titulo}</span>
          {typeof contagem === "number" && (
            <span style={{ background: `${cor}22`, color: cor, fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 10, marginLeft: 4 }}>{contagem}</span>
          )}
        </span>
        {extra}
      </button>
      {aberto && <div style={{ paddingBottom: 6 }}>{children}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Modal de Comentário / Rejeição — mesmo template, cores diferentes
// ════════════════════════════════════════════════════════════════════
function ModalComentarioRejeicao({ tipo, item, simNumero, texto, setTexto, busy, onCancel, onOk }: {
  tipo: "comentario" | "rejeicao";
  item: AprovacaoItem;
  simNumero?: string | null;
  texto: string;
  setTexto: (v: string) => void;
  busy: boolean;
  onCancel: () => void;
  onOk: () => void;
}) {
  const isRej = tipo === "rejeicao";
  const cor = isRej ? "rgb(var(--hb-red))" : "rgb(var(--hb-blue))";
  const corBg = isRej ? "rgba(239,68,68,0.18)" : "rgba(59,130,246,0.18)";
  const propLabel = simNumero ? `Proposta #${simNumero}` : "";
  const titulo = (isRej ? "Justificar Rejeição" : "Comentário pro Orçamentista") + (propLabel ? " — " + propLabel : "");
  const subtitulo = isRej
    ? `Descreva por que essa proposta não foi aprovada — o orçamentista vai ver no chat do card${propLabel ? " marcado como " + propLabel : ""}.`
    : `Faça uma pergunta ou comente. Vai pro chat do card com a tag ${propLabel || "do card"} + grupo WhatsApp Orçamentos.`;
  const placeholder = isRej
    ? "Ex.: Margem muito apertada na linha de instalação. Revisar e refazer."
    : "Ex.: Esse preço de m² está alinhado com o orçamento original?";
  const btnLabel = isRej ? "✕ Confirmar Rejeição" : "💬 Enviar Comentário";

  return (
    <div
      onClick={() => !busy && onCancel()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, sans-serif" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "rgb(var(--hb-bg))", border: `1px solid ${cor}`, borderRadius: 12, width: "100%", maxWidth: 560, padding: "24px 24px 18px", color: "rgb(var(--hb-text))", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}
      >
        <div style={{ fontSize: 11, color: cor, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 6 }}>
          {item.cliente || "Card"}
        </div>
        <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem", fontWeight: 700 }}>{titulo}</h3>
        <div style={{ fontSize: 12, color: "rgb(var(--hb-text) / 0.55)", marginBottom: 14, lineHeight: 1.5 }}>{subtitulo}</div>
        <textarea
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          rows={6}
          style={{ width: "100%", background: "rgb(var(--hb-bg))", border: "1px solid rgb(var(--hb-border))", borderRadius: 8, padding: 12, color: "rgb(var(--hb-text))", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button
            disabled={busy}
            onClick={onCancel}
            style={{ padding: "8px 16px", borderRadius: 6, background: "transparent", border: "1px solid rgb(var(--hb-border))", color: "rgb(var(--hb-text))", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
          >Cancelar</button>
          <button
            disabled={!texto.trim() || busy}
            onClick={onOk}
            style={{ padding: "8px 18px", borderRadius: 6, background: corBg, border: `1px solid ${cor}`, color: cor, cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: !texto.trim() || busy ? 0.5 : 1 }}
          >{busy ? "…" : btnLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TabsBar — troca entre "Orçamentos" e "Amostras" no header
// ════════════════════════════════════════════════════════════════════
function TabsBar({ tab, setTab, orcCount, amostrasCount }: {
  tab: "orcamentos" | "amostras";
  setTab: (t: "orcamentos" | "amostras") => void;
  orcCount: number;
  amostrasCount: number;
}) {
  const btn = (active: boolean): React.CSSProperties => ({
    padding: "7px 14px", borderRadius: 6, border: "1px solid rgb(var(--hb-border))",
    background: active ? "rgb(var(--hb-accent))" : "transparent",
    color: active ? "rgb(var(--hb-bg))" : "rgb(var(--hb-text))",
    cursor: "pointer", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.08em", display: "inline-flex", alignItems: "center", gap: 6,
  });
  const badge = (active: boolean, n: number): React.CSSProperties => ({
    background: active ? "rgba(255,255,255,0.22)" : "rgb(var(--hb-border))",
    color: active ? "rgb(var(--hb-bg))" : "rgb(var(--hb-text))",
    fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 9,
    minWidth: 18, textAlign: "center",
  });
  return (
    <div style={{ display: "inline-flex", gap: 6 }}>
      <button onClick={() => setTab("orcamentos")} style={btn(tab === "orcamentos")}>
        Orçamentos <span style={badge(tab === "orcamentos", orcCount)}>{orcCount}</span>
      </button>
      <button onClick={() => setTab("amostras")} style={btn(tab === "amostras")}>
        <Package size={11} /> Amostras <span style={badge(tab === "amostras", amostrasCount)}>{amostrasCount}</span>
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// AmostrasApprovalList — fila de solicitações de mostruário pendentes
// Aprovar → status=aprovada (o watcher compras-contratos-watcher.py
// pega no próximo ciclo */3min e cria card em kanban dept=compras-marco
// col=solicitacao — Marco Antônio vê em compras.parket.works).
// ════════════════════════════════════════════════════════════════════
function AmostrasApprovalList({ items, loading, error, busyId, onAprovar, onRejeitar }: {
  items: AmostraSolicitacao[];
  loading: boolean;
  error: string | null;
  busyId: string | null;
  onAprovar: (a: AmostraSolicitacao) => void;
  onRejeitar: (a: AmostraSolicitacao, motivo: string) => void;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingLeft: 2 }}>
        <span style={{ width: 4, height: 18, background: "rgb(var(--hb-accent))", borderRadius: 2 }} />
        <h3 style={{ margin: 0, fontSize: 12, color: "rgb(var(--hb-text))", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Package size={12} /> Amostras / Mostruário — Aguardando aprovação
        </h3>
        <span style={{ background: "rgb(var(--hb-accent) / 0.15)", color: "rgb(var(--hb-text))", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 10 }}>{items.length}</span>
      </div>
      <div style={{ fontSize: 11, color: "rgb(var(--hb-text) / 0.55)", marginBottom: 12, paddingLeft: 2, lineHeight: 1.5 }}>
        Aprovadas viram card no kanban do Marco Antônio (<a href="https://compras.parket.works" target="_blank" rel="noreferrer" style={{ color: "rgb(var(--hb-accent))", textDecoration: "none" }}>compras.parket.works</a>) em até 3 minutos.
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "rgb(var(--hb-text) / 0.55)", fontSize: 12, padding: "48px 0" }}>
          <Loader2 size={14} className="animate-spin" /> Carregando amostras…
        </div>
      )}
      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 8, padding: "12px 14px", color: "rgb(var(--hb-red))", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={12} /> {error}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div style={{ background: "rgb(var(--hb-panel))", border: "1px dashed rgb(var(--hb-border))", borderRadius: 12, padding: "24px 18px", textAlign: "center", color: "rgb(var(--hb-text) / 0.4)", fontSize: 12 }}>
          Nenhuma amostra pendente no momento.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((a) => (
          <AmostraApprovalCard key={a.id} amostra={a} busy={busyId === "amostra:" + a.id} onAprovar={() => onAprovar(a)} onRejeitar={(m) => onRejeitar(a, m)} />
        ))}
      </div>
    </div>
  );
}

function AmostraApprovalCard({ amostra: a, busy, onAprovar, onRejeitar }: {
  amostra: AmostraSolicitacao;
  busy: boolean;
  onAprovar: () => void;
  onRejeitar: (motivo: string) => void;
}) {
  const [showRej, setShowRej] = useState(false);
  const [motivoRej, setMotivoRej] = useState("");
  const produto = [a.produto, a.acabamento, a.cor_referencia].filter(Boolean).join(" · ");
  return (
    <div style={{
      background: "rgb(var(--hb-panel))",
      border: "1px solid rgb(var(--hb-border))",
      borderLeft: "3px solid rgb(var(--hb-accent))",
      borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "rgb(var(--hb-text))", letterSpacing: 0.1 }}>
            {produto || "Amostra"}
            <span style={{ marginLeft: 8, fontSize: 11, color: "rgb(var(--hb-text) / 0.55)", fontWeight: 500 }}>
              · {a.quantidade_pecas} peça(s)
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 5, flexWrap: "wrap", fontSize: 11, color: "rgb(var(--hb-text) / 0.6)" }}>
            {a.solicitado_por_nome && <span>por <b style={{ color: "rgb(var(--hb-text))", fontWeight: 600 }}>{a.solicitado_por_nome}</b></span>}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }} title={fmtDateTime(a.criado_at)}>
              <Clock size={9} /> {fmtRelative(a.criado_at)}
            </span>
            <a href={`/card/${a.card_id}`} target="_blank" rel="noreferrer" style={{ color: "rgb(var(--hb-accent))", textDecoration: "none", fontSize: 10 }}>
              ↗ card
            </a>
            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "rgb(var(--hb-amber) / 0.15)", color: "rgb(var(--hb-amber))", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {AMOSTRA_STATUS_LABELS[a.status]}
            </span>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "rgb(var(--hb-text))", padding: "8px 10px", background: "rgb(var(--hb-bg))", borderRadius: 6, borderLeft: "2.5px solid rgb(var(--hb-accent))", whiteSpace: "pre-wrap", lineHeight: 1.45, marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: "rgb(var(--hb-text) / 0.5)", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, marginBottom: 3 }}>Pra que serve</div>
        {a.motivo}
      </div>

      {a.obs && (
        <div style={{ fontSize: 11, color: "rgb(var(--hb-text) / 0.65)", fontStyle: "italic", marginBottom: 8 }}>
          <b style={{ fontStyle: "normal", color: "rgb(var(--hb-text) / 0.5)" }}>Obs:</b> {a.obs}
        </div>
      )}

      {(a.endereco_entrega || a.cep) && (
        <div style={{ fontSize: 11, color: "rgb(var(--hb-text) / 0.6)", display: "inline-flex", alignItems: "flex-start", gap: 4, marginBottom: 8 }}>
          <MapPin size={11} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{a.endereco_entrega}{a.endereco_entrega && a.cep ? " · " : ""}{a.cep}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid rgb(var(--hb-border))" }}>
        <button
          disabled={busy}
          onClick={() => { if (!confirm(`Aprovar amostra "${produto}"?\n\nVai gerar card no kanban do Marco Antônio em até 3min.`)) return; onAprovar(); }}
          style={{ padding: "7px 16px", borderRadius: 6, background: "rgba(16,185,129,0.22)", border: "1px solid rgba(16,185,129,0.6)", color: "rgb(var(--hb-green))", cursor: busy ? "wait" : "pointer", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "inline-flex", alignItems: "center", gap: 5, opacity: busy ? 0.5 : 1 }}
        >
          <CheckCircle2 size={11} /> {busy ? "…" : "Aprovar"}
        </button>
        <button
          disabled={busy}
          onClick={() => setShowRej((v) => !v)}
          style={{ padding: "7px 16px", borderRadius: 6, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.55)", color: "rgb(var(--hb-red))", cursor: "pointer", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <XCircle size={11} /> Rejeitar
        </button>
      </div>

      {showRej && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed rgb(var(--hb-border))", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input
            autoFocus
            type="text"
            value={motivoRej}
            onChange={(e) => setMotivoRej(e.target.value)}
            placeholder="Motivo da rejeição (obrigatório)"
            style={{ flex: 1, minWidth: 220, background: "rgb(var(--hb-bg))", border: "1px solid rgb(var(--hb-border))", padding: "7px 10px", borderRadius: 6, color: "rgb(var(--hb-text))", fontSize: 12 }}
          />
          <button
            disabled={busy || !motivoRej.trim()}
            onClick={() => { onRejeitar(motivoRej); setShowRej(false); setMotivoRej(""); }}
            style={{ padding: "7px 14px", borderRadius: 6, background: "rgb(var(--hb-red))", border: 0, color: "rgb(var(--hb-bg))", cursor: (busy || !motivoRej.trim()) ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: (busy || !motivoRej.trim()) ? 0.5 : 1 }}
          >
            Confirmar
          </button>
          <button
            onClick={() => { setShowRej(false); setMotivoRej(""); }}
            style={{ padding: "7px 14px", borderRadius: 6, background: "transparent", border: "1px solid rgb(var(--hb-border))", color: "rgb(var(--hb-textDim))", cursor: "pointer", fontSize: 11 }}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
