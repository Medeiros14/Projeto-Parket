/**
 * Atendimento — sala única estilo WhatsApp Web.
 * Lista TODOS os cards do pipeline comercial à esquerda, chat à direita.
 * Cards sem msg WhatsApp ainda aparecem (no fim da lista) — user pode iniciar chat.
 * Realtime: novas mensagens reordenam a lista (mais recente no topo).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, MessageSquare, Flame, ArrowLeft, CalendarDays } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { ChatPanel } from "../ChatPanel";
import { initials, fmtRelative } from "../../lib/format";
import { displayChatName } from "../../lib/whatsappGroupNames";
import { CriarAgendamentoModal } from "./Agendamentos";
import { TagsSelectorPopover, TagChip, PIPELINE_TAG_GROUPS } from "./Book";
import { useReconnect } from "../../lib/use-reconnect";
import type { AppUser } from "../../lib/auth";

const AGENTE_URL = "https://agente.parket.works";

type ConvRow = {
  card_id: string;        // pra órfãs: "wa:<phone>" (não é UUID real)
  card_title: string | null;
  card_dept: string | null;
  card_column: string | null;
  card_responsavel: string | null;
  card_tags: string[] | null;
  card_details: any | null;
  last_phone: string | null;
  last_text: string | null;
  last_at: string;
  last_direction: "in" | "out";
  count: number;
  unread_in: number;
  is_orphan?: boolean;        // true = sem card vinculado, precisa criar
  last_instance?: string | null;  // instance da última msg (pra criar o card)
  last_sender_name?: string | null;  // pushName da última msg (pra title)
};

// Mantém "lidas" por user no localStorage. Marca o card_id + timestamp da última msg vista.
// Chave: hb-read-<user_id> → { [card_id]: timestamp_iso_da_ultima_vista }
function loadReadMap(userId: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(`hb-read-${userId}`) || "{}"); } catch { return {}; }
}
function saveReadMap(userId: string, map: Record<string, string>) {
  try { localStorage.setItem(`hb-read-${userId}`, JSON.stringify(map)); } catch {}
}

// Tamanho do primeiro batch — quantas conversas carregam INSTANTANEAMENTE.
// Depois o resto entra em background sem travar a UI.
const FAST_BATCH = 50;
// Concorrência do background — 4 requests simultâneos costuma saturar 1 conexão
// PostgREST sem estourar rate limit.
const BG_CONCURRENCY = 4;
const BG_CARDS_PER_QUERY = 150;

export function AtendimentoPage({ appUser }: { appUser: AppUser }) {
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [bgProgress, setBgProgress] = useState<{ done: number; total: number } | null>(null);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAgendar, setShowAgendar] = useState(false);
  const [filter, setFilter] = useState<"todas" | "minhas" | "respondi-nao" | "nao-respondi" | "nao-lidas">("todas");
  const [readMap, setReadMap] = useState<Record<string, string>>(() => loadReadMap(appUser.id));

  const [error, setError] = useState<string | null>(null);

  // Ref pra token de reload — cancela bg em andamento se novo reload dispara.
  const reloadTokenRef = useRef(0);

  // Carrega conversas em 2 fases pra não travar a UI:
  //  Fase 1 (fastPath, blocking): 50 cards mais recentes por updated_at + últimas msgs.
  //                               Renderiza em <300ms. Painel visível pro user.
  //  Fase 2 (bgPath, background): restante dos cards em batches paralelos.
  //                               Vai preenchendo convs + KPIs, com progresso.
  //  Realtime: patch-in-place (sem reload full) — não flicka nem descarta bg loaded.
  const initConvFromCard = (c: any): ConvRow => {
    const isJidTitle = c.title && /@g\.us$/i.test(c.title);
    const cardTitleResolved = (!c.title || isJidTitle) ? displayChatName("", null) : c.title;
    const fallbackPhone = c.details?.telefone || c.details?.celular || c.details?.phone || null;
    return {
      card_id: c.id,
      card_title: cardTitleResolved,
      card_dept: c.dept_id || null,
      card_column: c.column_id || null,
      card_responsavel: c.responsavel || null,
      card_tags: c.tags || null,
      card_details: c.details || null,
      last_phone: fallbackPhone,
      last_text: null,
      last_at: c.updated_at || c.created_at || new Date(0).toISOString(),
      last_direction: "out",
      count: 0,
      unread_in: 0,
    };
  };
  const applyMsgToConv = (cur: ConvRow, m: any) => {
    if (cur.count === 0) {
      cur.last_phone = m.phone || cur.last_phone;
      cur.last_text = m.message_text;
      cur.last_at = m.timestamp;
      cur.last_direction = m.direction;
      if (!cur.card_title || /@g\.us$/i.test(cur.card_title)) {
        cur.card_title = displayChatName(m.phone, m.sender_name);
      }
    }
    cur.count += 1;
    if (m.direction === "in") cur.unread_in += 1;
  };
  const sortConvs = (arr: ConvRow[]): ConvRow[] =>
    [...arr].sort((a, b) => {
      const aHas = a.count > 0 || !!a.is_orphan;
      const bHas = b.count > 0 || !!b.is_orphan;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.last_at < b.last_at ? 1 : -1;
    });

  const reload = async () => {
    const myToken = ++reloadTokenRef.current;
    setLoading(true);
    setError(null);
    setBgProgress(null);

    const isVendPuro = appUser?.funcaoComercial === "vendedor" && !appUser?.isGestor && !appUser?.canSeeAll;
    const applyResponsavelFilter = (q: any) =>
      isVendPuro && appUser.nome ? q.eq("responsavel", appUser.nome) : q;

    // ── Fase 1: primeiros 50 cards + suas últimas msgs ──────
    const { data: firstCards, error: ec } = await applyResponsavelFilter(
      supabase.from("kanban_cards")
        .select("id, title, dept_id, column_id, responsavel, tags, details, updated_at, created_at")
        .in("dept_id", ["comercial-entrada", "comercial"])
        .order("updated_at", { ascending: false })
        .limit(FAST_BATCH)
    );
    if (myToken !== reloadTokenRef.current) return; // cancelado por outro reload
    if (ec) {
      console.error("[Atendimento] erro cards fast:", ec);
      setError(ec.message || "Falha ao carregar cards");
      setConvs([]); setLoading(false); return;
    }

    const byCard = new Map<string, ConvRow>();
    (firstCards || []).forEach((c: any) => byCard.set(c.id, initConvFromCard(c)));

    const firstIds = (firstCards || []).map((c: any) => c.id);
    if (firstIds.length > 0) {
      const { data: msgs } = await supabase
        .from("whatsapp_messages")
        .select("card_id, phone, direction, message_text, timestamp, instance, sender_name")
        .in("card_id", firstIds)
        .order("timestamp", { ascending: false })
        .limit(firstIds.length * 40);
      (msgs || []).forEach((m: any) => {
        const cur = byCard.get(m.card_id);
        if (cur) applyMsgToConv(cur, m);
      });
    }
    if (myToken !== reloadTokenRef.current) return;
    setConvs(sortConvs([...byCard.values()]));
    setLoading(false);

    // ── Fase 2: restante dos cards (background) ─────────────
    (async () => {
      const { data: restCards } = await applyResponsavelFilter(
        supabase.from("kanban_cards")
          .select("id, title, dept_id, column_id, responsavel, tags, details, updated_at, created_at")
          .in("dept_id", ["comercial-entrada", "comercial"])
          .order("updated_at", { ascending: false })
          .range(FAST_BATCH, 4999)
      );
      if (myToken !== reloadTokenRef.current) return;
      const rest = (restCards || []) as any[];
      // Adiciona já os placeholders (title/phone) — user pode buscar por eles antes de msg carregar
      rest.forEach((c) => { if (!byCard.has(c.id)) byCard.set(c.id, initConvFromCard(c)); });
      if (rest.length > 0) setConvs(sortConvs([...byCard.values()]));

      const restIds = rest.map((c) => c.id);
      const batches: string[][] = [];
      for (let i = 0; i < restIds.length; i += BG_CARDS_PER_QUERY) {
        batches.push(restIds.slice(i, i + BG_CARDS_PER_QUERY));
      }
      let done = 0;
      setBgProgress({ done: 0, total: restIds.length });

      // Pool de concorrência limitada — máx BG_CONCURRENCY requests simultâneos.
      let idx = 0;
      const runOne = async () => {
        while (idx < batches.length) {
          const my = idx++;
          const slice = batches[my];
          const { data: msgs } = await supabase
            .from("whatsapp_messages")
            .select("card_id, phone, direction, message_text, timestamp, instance, sender_name")
            .in("card_id", slice)
            .order("timestamp", { ascending: false })
            .limit(slice.length * 40);
          if (myToken !== reloadTokenRef.current) return;
          (msgs || []).forEach((m: any) => {
            const cur = byCard.get(m.card_id);
            if (cur) applyMsgToConv(cur, m);
          });
          done += slice.length;
          setBgProgress({ done, total: restIds.length });
          setConvs(sortConvs([...byCard.values()]));
        }
      };
      await Promise.all(Array(BG_CONCURRENCY).fill(0).map(runOne));
      if (myToken !== reloadTokenRef.current) return;

      // Órfãs (msgs sem card, instância comercial, 7d)
      const sinceOrphan = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: orphanMsgs } = await supabase
        .from("whatsapp_messages")
        .select("phone, direction, message_text, timestamp, instance, sender_name")
        .gt("timestamp", sinceOrphan)
        .is("card_id", null)
        .ilike("instance", "%comercial%")
        .order("timestamp", { ascending: false })
        .limit(3000);
      if (myToken !== reloadTokenRef.current) return;
      if (orphanMsgs && orphanMsgs.length > 0) {
        const norm11 = (p: string) => (p || "").replace(/\D/g, "").slice(-11);
        const phonesLinkedSet = new Set<string>();
        byCard.forEach((c) => { if (c.last_phone) phonesLinkedSet.add(norm11(c.last_phone)); });
        const byPhone = new Map<string, ConvRow>();
        orphanMsgs.forEach((m: any) => {
          const p11 = norm11(m.phone || "");
          if (!p11) return;
          if (phonesLinkedSet.has(p11)) return;
          const syntheticId = `wa:${p11}`;
          const cur = byPhone.get(syntheticId);
          if (!cur) {
            byPhone.set(syntheticId, {
              card_id: syntheticId,
              card_title: displayChatName(m.phone, m.sender_name),
              card_dept: null,
              card_column: "Sem card",
              card_responsavel: null,
              card_tags: null,
              card_details: null,
              last_phone: m.phone,
              last_text: m.message_text,
              last_at: m.timestamp,
              last_direction: m.direction,
              count: 1,
              unread_in: m.direction === "in" ? 1 : 0,
              is_orphan: true,
              last_instance: m.instance,
              last_sender_name: m.sender_name,
            });
          } else {
            cur.count += 1;
            if (m.direction === "in") cur.unread_in += 1;
          }
        });
        byPhone.forEach((v, k) => byCard.set(k, v));
        setConvs(sortConvs([...byCard.values()]));
      }
      setBgProgress(null);
    })();
  };

  // Auto-criação: toda conversa órfã (sem card) vira card no funil de entrada
  // automaticamente. O backend é idempotente — se já existe card pro número
  // (qualquer variação com/sem DDI/9º dígito), só vincula as mensagens.
  const autoCreateAttempted = useRef<Set<string>>(new Set());
  useEffect(() => {
    const orphans = convs.filter(
      (c) => c.is_orphan && c.last_phone && !autoCreateAttempted.current.has(c.card_id)
    );
    if (orphans.length === 0) return;
    orphans.forEach((c) => autoCreateAttempted.current.add(c.card_id));
    (async () => {
      for (const conv of orphans) {
        try {
          await fetch(`${AGENTE_URL}/api/hb-whatsapp/create-card`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: conv.last_phone,
              nome: conv.last_sender_name || null,
              instance: conv.last_instance || "Comercial - Parket",
            }),
          });
        } catch { /* falhou — tenta de novo no próximo mount */ }
      }
      reload();
    })();
  }, [convs]);

  useEffect(() => { reload(); }, []);

  // Reconnect — quando volta a aba, força reload da lista (caso realtime tenha caído)
  useReconnect(() => { reload(); });

  // Realtime — patch-in-place da conv afetada. Evita reload full a cada msg
  // (que descartaria a fase-background já carregada e piscaria a lista).
  // Cards que ainda não estão em convs ficam pra próximo reload manual.
  useEffect(() => {
    const ch = supabase
      .channel("hb-atendimento-list")
      .on("postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload: any) => {
          const m = payload.new || {};
          if (!m.card_id || !m.timestamp) return;
          setConvs((prev) => {
            const idx = prev.findIndex((c) => c.card_id === m.card_id);
            if (idx < 0) return prev; // card ainda não carregado — deixa pro próximo reload
            const cur = { ...prev[idx] };
            // Só sobrescreve last_* se essa msg é mais recente do que a atual
            if (!cur.last_text || cur.last_at < m.timestamp) {
              cur.last_phone = m.phone || cur.last_phone;
              cur.last_text = m.message_text;
              cur.last_at = m.timestamp;
              cur.last_direction = m.direction;
            }
            cur.count += 1;
            if (m.direction === "in") cur.unread_in += 1;
            const next = [...prev];
            next[idx] = cur;
            return sortConvs(next);
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper: conversa está NÃO-LIDA se a última msg recebida (in) é posterior
  // ao timestamp armazenado em readMap (ou nunca foi lida).
  const isUnread = (c: ConvRow): boolean => {
    if (c.last_direction !== "in") return false;  // só conta se cliente mandou
    const seen = readMap[c.card_id];
    if (!seen) return true;
    return c.last_at > seen;
  };

  // Visibilidade — non-admin só vê conversas de cards onde é o responsavel.
  // Fica oculto também as órfãs (sem card vinculado) — só admin lida com elas.
  // Só VENDEDOR PURO fica restrito ao próprio funil. SDR/admin/gestor veem tudo
  // (SDR precisa filtrar via abas Todas/Não lidas/Minhas).
  const isVendedorPuro = appUser?.funcaoComercial === "vendedor" && !appUser?.isGestor && !appUser?.canSeeAll;
  const onlyMine = isVendedorPuro;
  const myNameNorm = (appUser?.nome || "").trim().toLowerCase();
  const visibleConvs = useMemo(() => {
    if (!onlyMine || !myNameNorm) return convs;
    return convs.filter((c) =>
      !c.is_orphan && (c.card_responsavel || "").trim().toLowerCase() === myNameNorm
    );
  }, [convs, onlyMine, myNameNorm]);

  const filtered = useMemo(() => {
    let arr = visibleConvs;
    if (filter === "minhas") arr = arr.filter((c) => (c.card_responsavel || "").trim().toLowerCase() === myNameNorm);
    // Filtros direcionais só fazem sentido em cards COM msg (count>0). Cards sem msg
    // têm last_direction "out" default — não conta como "respondi", é só placeholder.
    if (filter === "respondi-nao") arr = arr.filter((c) => c.count > 0 && c.last_direction === "out");
    if (filter === "nao-respondi") arr = arr.filter((c) => c.count > 0 && c.last_direction === "in");
    if (filter === "nao-lidas") arr = arr.filter(isUnread);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((c) =>
        (c.card_title || "").toLowerCase().includes(s) ||
        (c.last_text || "").toLowerCase().includes(s) ||
        (c.card_responsavel || "").toLowerCase().includes(s) ||
        (c.last_phone || "").includes(s)
      );
    }
    return arr;
  }, [visibleConvs, filter, search, myNameNorm, readMap]);

  const active = visibleConvs.find((c) => c.card_id === activeId);

  // Marca como lida quando abre a conversa (e quando chega msg nova com ela aberta)
  useEffect(() => {
    if (!activeId) return;
    const c = convs.find((x) => x.card_id === activeId);
    if (!c) return;
    if (readMap[activeId] === c.last_at) return;
    const next = { ...readMap, [activeId]: c.last_at };
    setReadMap(next);
    saveReadMap(appUser.id, next);
  }, [activeId, convs, appUser.id]);

  // KPIs do header — usam visibleConvs pra refletir o que o user de fato enxerga.
  // Aguardando/respondidas filtram cards COM msg (count>0) pra não inflar com placeholder.
  const kpis = useMemo(() => {
    const naoLidas = visibleConvs.filter(isUnread).length;
    const aguardando = visibleConvs.filter((c) => c.count > 0 && c.last_direction === "in").length;
    const respondidas = visibleConvs.filter((c) => c.count > 0 && c.last_direction === "out").length;
    const minhas = visibleConvs.filter((c) => (c.card_responsavel || "").trim().toLowerCase() === myNameNorm).length;
    return { naoLidas, aguardando, respondidas, minhas, total: visibleConvs.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleConvs, readMap, myNameNorm]);

  return (
    <div className="h-full flex">
      {/* Lista de conversas */}
      <aside className={`${activeId ? "hidden md:flex" : "flex"} w-full md:w-[320px] shrink-0 border-r border-hb-border flex-col bg-hb-bg`}>
        <div className="p-3 border-b border-hb-border space-y-2">
          <div className="text-xs uppercase tracking-wider font-bold text-hb-gold flex items-center gap-1.5">
            <MessageSquare size={11} /> Sala Ao Vivo
          </div>
          {/* KPIs numéricos */}
          <div className="grid grid-cols-4 gap-1.5">
            <KpiMini label="Não lidas" value={kpis.naoLidas} color={kpis.naoLidas > 0 ? "green" : "dim"} pulse={kpis.naoLidas > 0} />
            <KpiMini label="Aguardando" value={kpis.aguardando} color={kpis.aguardando > 0 ? "amber" : "dim"} />
            <KpiMini label="Respondidas" value={kpis.respondidas} color="blue" />
            <KpiMini label="Total" value={kpis.total} color="gold" />
          </div>
          {/* Progresso do background load — some quando termina */}
          {bgProgress && bgProgress.total > 0 && (
            <div className="text-[9px] text-hb-textDim tabular flex items-center gap-1.5">
              <div className="flex-1 h-0.5 bg-hb-border overflow-hidden rounded-full">
                <div
                  className="h-full bg-hb-accent transition-[width] duration-300"
                  style={{ width: `${Math.min(100, (bgProgress.done / bgProgress.total) * 100)}%` }}
                />
              </div>
              <span>carregando histórico {bgProgress.done}/{bgProgress.total}</span>
            </div>
          )}
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-hb-textDim" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, telefone, mensagem…"
              className="w-full bg-hb-panel border border-hb-border rounded pl-7 pr-2 py-1.5 text-xs outline-none focus:border-hb-accent" />
          </div>
          <div className="flex gap-1 text-[10px] flex-wrap">
            {([
              ["todas", "Todas"],
              ["nao-lidas", `Não lidas${kpis.naoLidas > 0 ? ` (${kpis.naoLidas})` : ""}`],
              ["minhas", "Minhas"],
              ["nao-respondi", "Aguardando"],
              ["respondi-nao", "Respondidas"],
            ] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k as any)}
                className={`px-2 py-1 rounded font-semibold ${filter === k ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {loading && <div className="p-8 text-center text-[11px] text-hb-textDim"><Loader2 size={14} className="animate-spin inline mr-1" />Carregando…</div>}
          {error && (
            <div className="p-3 text-[11px] text-hb-red bg-hb-red/10 border-b border-hb-red/30">
              ⚠ {error}
              <button onClick={reload} className="block mt-1 underline">Tentar de novo</button>
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="p-8 text-center text-[11px] text-hb-textDim">
              Nenhuma conversa nos últimos 7 dias.
            </div>
          )}
          {filtered.map((c) => {
            const isActive = c.card_id === activeId;
            const isInLast = c.last_direction === "in";
            const isHot = (c.card_tags || []).some((t: string) => /quente|hot|urgent/i.test(t));
            const unread = isUnread(c);
            const orphan = !!c.is_orphan;
            return (
              <div key={c.card_id}
                className={`w-full text-left px-3 py-2 border-b border-hb-border transition flex items-start gap-2 ${
                  isActive ? "bg-hb-panelLight border-l-2 border-l-hb-accent"
                    : unread ? "bg-hb-green/5 border-l-2 border-l-hb-green"
                    : orphan ? "bg-hb-amber/5 border-l-2 border-l-hb-amber"
                    : ""
                } ${orphan ? "" : "hover:bg-hb-panelLight cursor-pointer"}`}
                onClick={orphan ? undefined : () => setActiveId(c.card_id)}>
                <div className="relative shrink-0">
                  <div className={`w-9 h-9 rounded-full bg-hb-accent/15 border text-hb-accent flex items-center justify-center text-[11px] font-bold ${
                    unread ? "border-hb-green" : orphan ? "border-hb-amber/60" : "border-hb-accent/30"
                  }`}>
                    {initials(c.card_title || "?")}
                  </div>
                  {unread && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-hb-green border border-hb-bg animate-blink" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className={`text-xs truncate flex-1 ${unread ? "font-bold text-hb-text" : "font-semibold text-hb-text"}`}>
                      {c.card_title || c.card_id.slice(0, 8)}
                    </div>
                    {isHot && <Flame size={10} className="text-hb-red" />}
                    <div className={`text-[9px] tabular shrink-0 ${unread ? "text-hb-green font-bold" : "text-hb-textDim"}`}>
                      {fmtRelative(c.last_at)}
                    </div>
                  </div>
                  <div className={`text-[10px] truncate mt-0.5 flex items-center gap-1 ${unread ? "text-hb-text font-medium" : "text-hb-textDim"}`}>
                    {c.count === 0 && !orphan ? (
                      <span className="italic">Sem mensagens — clique pra iniciar</span>
                    ) : (
                      <>
                        {!isInLast && <span className="text-hb-accent">↪</span>}
                        <span>{(c.last_text || "(sem texto)").slice(0, 60)}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] mt-1">
                    {orphan ? (
                      <span className="text-hb-amber font-semibold inline-flex items-center gap-1">
                        <Loader2 size={9} className="animate-spin" /> Criando card no funil de entrada… · {c.last_phone}
                      </span>
                    ) : (
                      <>
                        {c.card_responsavel && <span className="text-hb-textDim">{c.card_responsavel}</span>}
                        <span className="text-hb-textDim font-mono">· {c.card_column || c.card_dept}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Chat ativo */}
      <main className={`${activeId ? "flex" : "hidden md:flex"} flex-1 flex-col bg-hb-bg`}>
        {activeId ? (
          <div className="h-full p-3 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <button onClick={() => setActiveId(null)} className="md:hidden text-[11px] text-hb-textDim hover:text-hb-text flex items-center gap-1">
                <ArrowLeft size={11} /> Voltar à lista
              </button>
              {/* Tags do card: chips dos selecionados + popover pra adicionar.
                  Só funciona quando o card é real (não órfão/sintético). */}
              {active && !active.is_orphan && (
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                  {(active.card_tags || [])
                    .filter((t) => PIPELINE_TAG_GROUPS.some((g) => g.tags.some((x) => x.toLowerCase() === t.toLowerCase())))
                    .map((t) => (
                      <TagChip key={t} tag={t} onRemove={async () => {
                        const next = (active.card_tags || []).filter((x) => x.toLowerCase() !== t.toLowerCase());
                        await supabase.from("kanban_cards").update({ tags: next }).eq("id", active.card_id);
                        reload();
                      }} />
                    ))}
                  <TagsSelectorPopover
                    value={active.card_tags || []}
                    onChange={async (next) => {
                      await supabase.from("kanban_cards").update({ tags: next }).eq("id", active.card_id);
                      reload();
                    }}
                    label="🏷 Tags"
                  />
                </div>
              )}
              <button
                onClick={() => setShowAgendar(true)}
                className="text-[11px] px-2.5 py-1 rounded bg-hb-accent text-hb-bg font-semibold hover:opacity-90 flex items-center gap-1"
              >
                <CalendarDays size={11} /> Agendar reunião
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ChatPanel
                cardId={activeId}
                cardTitle={active?.card_title || undefined}
                fallbackPhone={(active?.card_details?.telefone || active?.card_details?.celular || active?.last_phone) as string | undefined}
                appUser={appUser}
                cardCtx={active ? {
                  slug: active.card_column,
                  produto_interesse: active.card_details?.produto_interesse,
                  metragem: Number(active.card_details?.metragem_estimada || active.card_details?.area_m2 || 0) || undefined,
                  cidade: active.card_details?.cidade,
                  responsavel: active.card_responsavel,
                  ia_analise: active.card_details?.ia_analise,
                } : undefined}
                cardMeta={active ? {
                  dept_id: active.card_dept || "",
                  column_id: active.card_column,
                  responsavel: active.card_responsavel,
                } : undefined}
                onCardChanged={reload}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-hb-textDim p-12">
            <MessageSquare size={32} className="mb-3 opacity-50" />
            <div className="text-sm">Selecione uma conversa pra começar</div>
            <div className="text-[10px] mt-1">Tempo real · sem refresh · som ativável</div>
          </div>
        )}
      </main>

      {showAgendar && (
        <CriarAgendamentoModal
          vendedores={active?.card_responsavel ? [active.card_responsavel] : []}
          cardIdInit={activeId || undefined}
          clienteInit={active?.card_title || ""}
          vendedorInit={active?.card_responsavel || ""}
          onClose={() => setShowAgendar(false)}
          onCreated={() => setShowAgendar(false)}
        />
      )}
    </div>
  );
}

function KpiMini({ label, value, color, pulse }: { label: string; value: number; color: "green" | "amber" | "blue" | "gold" | "dim"; pulse?: boolean }) {
  const colorMap = {
    green: "text-hb-green border-hb-green/30",
    amber: "text-hb-amber border-hb-amber/30",
    blue:  "text-hb-blue border-hb-blue/30",
    gold:  "text-hb-gold border-hb-gold/30",
    dim:   "text-hb-textDim border-hb-border",
  };
  return (
    <div className={`border bg-hb-panel rounded p-1.5 text-center ${colorMap[color]}`}>
      <div className={`text-sm font-bold tabular ${pulse ? "animate-blink" : ""}`}>{value}</div>
      <div className="text-[8px] uppercase tracking-wider text-hb-textDim font-semibold leading-tight">{label}</div>
    </div>
  );
}
