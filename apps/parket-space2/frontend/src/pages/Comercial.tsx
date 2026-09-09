/**
 * Comercial — kanban dos dois funis (SDR + Vendedor) no padrão SO Parket.
 * Lê kanban_cards/kanban_columns via gateway local (api.parket.works).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, ArrowRight, Loader2, Flame, MapPin, Ruler, Plus, AlertTriangle, X, Eye, MessageCircle, Filter, Settings } from "lucide-react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api, resolveSlug, useFetch, DEPT_ENTRADA, DEPT_COMERCIAL, type KanbanCard, type KanbanColumn } from "../lib/api";
import { fmtBRLCompact, fmtRelative, parseValueText } from "../lib/format";
import { supabase } from "../lib/supabase";
import { DeptHeader } from "../components/DeptHeader";
import { DeptSidebar, type DeptView, type QuickActionKey } from "../components/DeptSidebar";
import { CardDetailPanel } from "../components/CardDetailPanel";
import { DEPT_DATA } from "../lib/dept-data";
import type { AppUser } from "../lib/auth";

type Funil = "sdr" | "vendedor";

const TABS: { key: Funil; label: string; dept: string; subtitle: string }[] = [
  { key: "sdr",      label: "FUNIL DE ENTRADA · SDR",      dept: DEPT_ENTRADA,   subtitle: "Qualificação e triagem" },
  { key: "vendedor", label: "FUNIL DE VENDAS · VENDEDOR",  dept: DEPT_COMERCIAL, subtitle: "Negociação e fechamento" },
];

export default function Comercial({ appUser }: { appUser: AppUser }) {
  const [tab, setTab] = useState<Funil>("vendedor");
  const [search, setSearch] = useState("");
  const [respFilter, setRespFilter] = useState<string>("");
  const [sdrFilter, setSdrFilter] = useState<string>("");
  const [scope, setScope] = useState<"geral" | "meu">("geral");
  const [showNovaConversa, setShowNovaConversa] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [relacaoFilter, setRelacaoFilter] = useState<string>("");
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [dragging, setDragging] = useState<KanbanCard | null>(null);
  const [optimistic, setOptimistic] = useState<Map<string, string>>(new Map());
  const [newLeadCol, setNewLeadCol] = useState<string | null>(null);
  const [view, setView] = useState<DeptView>("kanban");
  const [showAgendarDirect, setShowAgendarDirect] = useState(false);
  const dragJustHappenedRef = useRef(false);

  // Sensores DnD — só inicia drag depois de 4px de movimento (não conflita c/ click)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleQuickAction(k: QuickActionKey) {
    if (k === "novo-lead") {
      // Abre modal de novo lead na primeira coluna disponível
      const firstCol = (cols.data || [])[0]?.slug;
      if (firstCol) setNewLeadCol(firstCol);
    } else if (k === "nova-proposta") {
      // Vai pra orçamento.parket.works (Space) — ou poderia abrir um seletor
      window.open("https://space.parket.works/orcamento", "_blank");
    } else if (k === "showroom") {
      // Abre AgendarModal direto sem card vinculado
      setShowAgendarDirect(true);
    } else if (k === "follow-up") {
      // Muda pra view Alertas (cards atrasados/quentes)
      setView("alertas");
    }
  }

  async function onDragStart(e: DragStartEvent) {
    const c = cardsAll.find((x) => x.id === e.active.id);
    if (c) setDragging(c);
  }

  async function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    dragJustHappenedRef.current = true;
    setTimeout(() => { dragJustHappenedRef.current = false; }, 150);

    const cardId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const card = cardsAll.find((c) => c.id === cardId);
    if (!card) return;
    const fromSlug = resolveSlug(card.column_id, colsAll);

    // Destino: coluna direta (drop em zona vazia/header) OU outro card
    let toSlug: string;
    if (overId.startsWith("col:")) {
      toSlug = overId.slice(4);
    } else {
      const overCard = cardsAll.find((c) => c.id === overId);
      if (!overCard) return;
      toSlug = optimistic.get(overCard.id) || resolveSlug(overCard.column_id, colsAll);
    }

    // Mesma coluna = só reorder visual (sort_order). Coluna diferente = move.
    if (fromSlug === toSlug) {
      // Reorder vertical: grava sort_order em details
      if (overId === cardId) return;
      const colCards = byColumn.get(toSlug) || [];
      const oldIdx = colCards.findIndex((c) => c.id === cardId);
      const newIdx = colCards.findIndex((c) => c.id === overId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      const reordered = arrayMove(colCards, oldIdx, newIdx);
      // Grava sort_order em batch (number maior = mais alto)
      const updates = reordered.map((c, i) => ({
        id: c.id, sort_order: (reordered.length - i) * 1000,
      }));
      try {
        await Promise.all(updates.map((u) =>
          supabase.from("kanban_cards")
            .update({ details: { ...((cardsAll.find((c) => c.id === u.id))?.details || {}), sort_order: u.sort_order } })
            .eq("id", u.id)
        ));
        cards.reload();
      } catch (err: any) { alert("Erro ao reordenar: " + (err?.message || err)); }
      return;
    }

    // Move pra outra coluna
    setOptimistic((m) => new Map(m).set(cardId, toSlug));
    try {
      const r = await supabase.from("kanban_cards").update({ column_id: toSlug }).eq("id", cardId);
      if (r.error) throw r.error;
      await supabase.from("card_movements").insert({
        card_id: cardId, from_column: fromSlug, to_column: toSlug,
        moved_by: appUser.nome || appUser.email, moved_at: new Date().toISOString(),
      });
      cards.reload();
    } catch (err: any) {
      alert("Erro ao mover: " + (err?.message || err));
      setOptimistic((m) => { const next = new Map(m); next.delete(cardId); return next; });
    }
  }

  const current = TABS.find((t) => t.key === tab)!;
  const cols = useFetch(() => api.columns([current.dept]), [current.dept]);
  const cards = useFetch(() => api.cardsByDept(current.dept, 1500), [current.dept]);

  // Realtime — qualquer mudança em kanban_cards desse dept refaz fetch (debounced 5s)
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimer.current) return;
      reloadTimer.current = setTimeout(() => { reloadTimer.current = null; cards.reload(); }, 5000);
    };
    const ch = supabase
      .channel(`comercial-${current.dept}`)
      .on("postgres_changes" as any,
        { event: "*", schema: "public", table: "kanban_cards", filter: `dept_id=eq.${current.dept}` },
        scheduleReload)
      .subscribe();
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.dept]);

  const colsAll = cols.data || [];
  const cardsAll = cards.data || [];

  // Vendedores únicos pro filtro
  const responsaveis = useMemo(() => {
    const set = new Set<string>();
    cardsAll.forEach((c) => { if (c.responsavel) set.add(c.responsavel); });
    return [...set].sort();
  }, [cardsAll]);

  // SDRs únicos extraídos de details.sdr
  const sdrs = useMemo(() => {
    const set = new Set<string>();
    cardsAll.forEach((c) => { const s = c.details?.sdr; if (s) set.add(s); });
    return [...set].sort();
  }, [cardsAll]);

  // Filtra (incluindo filtros de view Alertas/Handoffs)
  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    const today = Date.now();
    return cardsAll.filter((c) => {
      if (respFilter && c.responsavel !== respFilter) return false;
      if (sdrFilter && (c.details?.sdr || "") !== sdrFilter) return false;
      // Scope "meu" → apenas cards do user logado (como responsavel OU SDR)
      if (scope === "meu") {
        const me = (appUser.nome || "").toLowerCase();
        const isResp = (c.responsavel || "").toLowerCase() === me;
        const isSdr = (c.details?.sdr || "").toLowerCase() === me;
        if (!isResp && !isSdr) return false;
      }
      if (s) {
        const hay = `${c.title || ""} ${c.subtitle || ""} ${c.responsavel || ""} ${c.obra || ""} ${JSON.stringify(c.details || {})}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      // Date range (created_at)
      if (dateFrom && (c.created_at || "") < dateFrom) return false;
      if (dateTo && (c.created_at || "") > dateTo + "T23:59:59") return false;
      // Relação com a obra
      if (relacaoFilter && (c.details?.relacao_obra || "") !== relacaoFilter) return false;
      // View Alertas: cards com tag quente/alerta/atras OU SLA >= 7d em etapa ativa
      if (view === "alertas") {
        const tags = (c.tags || []).map((t) => String(t).toLowerCase()).join("|");
        const hasAlertTag = /quente|hot|urgent|alerta|atras|sla/.test(tags);
        const lastUpdate = new Date(c.updated_at || c.created_at || 0).getTime();
        const diasParado = Math.floor((today - lastUpdate) / 86400000);
        const isFinal = /ganho|perda|cancelado|nao-qualif/.test(c.column_id || "");
        const isLate = !isFinal && diasParado >= 7;
        if (!hasAlertTag && !isLate) return false;
      }
      // View Handoffs: cards em colunas de transição (qualificado SDR / em-negociacao Vendedor / ganho)
      if (view === "handoffs") {
        if (!/qualificado|em-negociacao|ganho|handoff|aguardando/.test(c.column_id || "")) return false;
      }
      return true;
    });
  }, [cardsAll, search, respFilter, sdrFilter, scope, view, appUser.nome, dateFrom, dateTo, relacaoFilter]);

  // Agrupa por coluna (na ordem do kanban) — respeita movimentos otimistas
  // + ordena dentro da coluna por details.sort_order (desc) / updated_at (desc)
  const byColumn = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    colsAll.forEach((col) => map.set(col.slug, []));
    filtered.forEach((c) => {
      const optimisticSlug = optimistic.get(c.id);
      const slug = optimisticSlug || resolveSlug(c.column_id, colsAll);
      if (!map.has(slug)) map.set(slug, []);
      map.get(slug)!.push(c);
    });
    // Sort dentro de cada coluna
    map.forEach((arr, slug) => {
      arr.sort((a, b) => {
        const sa = (a.details?.sort_order ?? 0) as number;
        const sb = (b.details?.sort_order ?? 0) as number;
        if (sa !== sb) return sb - sa; // sort_order maior em cima
        return (b.updated_at || "").localeCompare(a.updated_at || ""); // depois updated_at desc
      });
      map.set(slug, arr);
    });
    return map;
  }, [filtered, colsAll, optimistic]);

  const loading = cols.loading || cards.loading;
  const err = cols.error || cards.error;

  const deptData = DEPT_DATA.comercial;

  return (
    <div className="h-screen flex flex-col bg-pk-bg text-pk-text overflow-hidden">
      {/* Header padrão SO Parket */}
      <DeptHeader deptName={deptData.fullName.toUpperCase()} breadcrumb={deptData.breadcrumb} appUser={appUser} />

      {/* Body: sidebar 210px + main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar SO Parket */}
        <DeptSidebar dept={deptData} appUser={appUser}
          view={view} onView={setView}
          onQuickAction={handleQuickAction} />

        {/* Main column */}
        <main className="flex-1 flex flex-col overflow-hidden">

      {/* Views específicas — substituem o kanban quando ativas */}
      {view === "dashboard" || view === "funil" ? (
        <ComercialDashboard cards={cardsAll} cols={colsAll} dept={current.dept} />
      ) : view === "ranking" ? (
        <RankingView cards={cardsAll} />
      ) : view === "agenda" ? (
        <AgendaShowroomView />
      ) : view === "precos" ? (
        <PrecosView />
      ) : view === "scripts" ? (
        <ScriptsView />
      ) : view === "performance" ? (
        <PerformanceView cards={cardsAll} appUser={appUser} />
      ) : view === "relatorio" || view === "catalogo" || view === "argumentario" || view === "metas" || view === "treinamentos" ? (
        <PlaceholderView view={view} onBack={() => setView("kanban")} />
      ) : (
      <>

      {/* Banner visual quando view filtra (Alertas / Handoffs) */}
      {(view === "alertas" || view === "handoffs") && (
        <div className="border-b border-pk-border bg-pk-text/[0.025] px-6 py-2 shrink-0 flex items-center gap-3">
          <div className="text-[8px] uppercase tracking-[0.22em] text-pk-accent font-semibold">
            {view === "alertas" ? "▸ VIEW ALERTAS — CARDS QUENTES OU PARADOS ≥ 7D" : "▸ VIEW HANDOFFS — CARDS EM TRANSIÇÃO"}
          </div>
          <button onClick={() => setView("kanban")}
            className="ml-auto text-[8px] uppercase tracking-[0.18em] text-pk-textDim hover:text-pk-text border border-pk-border px-2 py-1">
            VER TUDO
          </button>
        </div>
      )}

      {/* Filtros — padrão Space v1 adaptado pra SO Parket */}
      <div className="border-b border-pk-border px-6 py-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Pill toggle: Funil de Entrada | Funil de Vendas */}
          <PillToggle>
            {TABS.map((t) => (
              <PillBtn key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
                {t.key === "sdr" ? "FUNIL DE ENTRADA" : "FUNIL DE VENDAS"}
              </PillBtn>
            ))}
          </PillToggle>

          {/* Vendedor + SDR com ícone olho */}
          <div className="flex items-center gap-2">
            <Eye size={12} className="text-pk-textDim shrink-0" />
            <FilterSelect value={respFilter} onChange={setRespFilter}>
              <option value="">TODOS VENDEDORES · {responsaveis.length}</option>
              {responsaveis.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
            </FilterSelect>
            <FilterSelect value={sdrFilter} onChange={setSdrFilter}>
              <option value="">TODOS SDRs · {sdrs.length}</option>
              {sdrs.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
            </FilterSelect>
          </div>

          {/* Pill toggle: Geral | Meu Funil */}
          <PillToggle>
            <PillBtn active={scope === "geral"} onClick={() => setScope("geral")}>GERAL</PillBtn>
            <PillBtn active={scope === "meu"}   onClick={() => setScope("meu")}>MEU FUNIL</PillBtn>
          </PillToggle>

          {/* Busca */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pk-textDim" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-pk-text/[0.025] border border-pk-text/[0.08] pl-7 pr-3 py-1.5 text-[10px] text-pk-text outline-none focus:border-pk-accent transition placeholder:text-pk-textDim uppercase tracking-[0.06em]" />
          </div>

          {/* Nova Conversa — green/olive brand */}
          <button onClick={() => setShowNovaConversa(true)}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 border border-pk-olive/40 bg-pk-olive/10 text-pk-olive hover:bg-pk-olive/20 text-[9px] uppercase tracking-[0.18em] font-semibold transition">
            <MessageCircle size={11} /> NOVA CONVERSA
          </button>

          {/* Contador */}
          <div className="text-[9px] uppercase tracking-[0.20em] text-pk-textDim w-full md:w-auto md:ml-2">
            <span className="tabular text-pk-text mr-1">{filtered.length}</span>
            {filtered.length === 1 ? "CARD" : "CARDS"}
          </div>
        </div>
      </div>

      {/* Barra 2: KPIs por etapa + ações ─────────────────────────── */}
      <StageKpisBar cards={cardsAll} cols={colsAll}
        onNovoLead={() => {
          const firstCol = colsAll[0]?.slug; if (firstCol) setNewLeadCol(firstCol);
        }} />

      {/* Barra 3: filtros avançados (busca/data/relação/atualizar) ── */}
      <div className="border-b border-pk-border bg-pk-bg/40 px-6 py-2 shrink-0 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pk-textDim" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, cidade, produto..."
            className="w-full bg-pk-text/[0.025] border border-pk-text/[0.08] pl-7 pr-3 py-1.5 text-[10px] text-pk-text outline-none focus:border-pk-accent placeholder:text-pk-textDim" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] uppercase tracking-[0.20em] text-pk-textDim">DE</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="bg-pk-text/[0.025] border border-pk-text/[0.08] px-2 py-1.5 text-[10px] text-pk-text outline-none focus:border-pk-accent cursor-pointer" />
          <span className="text-[8px] uppercase tracking-[0.20em] text-pk-textDim ml-1">ATÉ</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="bg-pk-text/[0.025] border border-pk-text/[0.08] px-2 py-1.5 text-[10px] text-pk-text outline-none focus:border-pk-accent cursor-pointer" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={11} className="text-pk-textDim" />
          <FilterSelect value={relacaoFilter} onChange={setRelacaoFilter} minWidth={170}>
            <option value="">RELAÇÃO COM A OBRA</option>
            <option value="Proprietário">PROPRIETÁRIO</option>
            <option value="Arquiteto">ARQUITETO</option>
            <option value="Engenheiro">ENGENHEIRO</option>
            <option value="Construtora">CONSTRUTORA</option>
          </FilterSelect>
        </div>
        <div className="flex-1" />
        <button onClick={() => { cards.reload(); cols.reload(); }}
          className="flex items-center gap-2 px-3 py-1.5 border border-pk-accent/40 bg-pk-accent/10 text-pk-accent hover:bg-pk-accent/20 text-[9px] uppercase tracking-[0.18em] font-semibold transition">
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          ATUALIZAR
        </button>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-auto bg-pk-bg">
        {err && (
          <div className="m-6 p-3 border border-pk-walnut bg-pk-walnut/15 text-[10px] text-pk-walnut">
            ⚠ {err}
          </div>
        )}
        {loading && !cards.data ? (
          <div className="h-full flex items-center justify-center text-pk-textDim">
            <Loader2 size={18} className="animate-spin text-pk-accent" />
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="flex gap-3 p-4 min-h-full" style={{ minWidth: "100%" }}>
              {colsAll.map((col) => (
                <KanbanColumnUI key={col.id} col={col} cards={byColumn.get(col.slug) || []}
                  onCardClick={(c) => { if (!dragJustHappenedRef.current) setSelectedCard(c); }}
                  onNewLead={(slug) => setNewLeadCol(slug)} />
              ))}
              {colsAll.length === 0 && (
                <div className="text-[10px] uppercase tracking-[0.20em] text-pk-textDim p-12">
                  NENHUMA COLUNA CONFIGURADA
                </div>
              )}
            </div>
            <DragOverlay dropAnimation={null}>
              {dragging && <DraggingCardOverlay card={dragging} />}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      </>
      )}

        </main>
      </div>

      {/* Modal de Showroom (agendamento sem card vinculado) */}
      {showAgendarDirect && (
        <ShowroomModal vendedor={appUser.nome || ""} onClose={() => setShowAgendarDirect(false)} />
      )}

      {/* Modal Nova Conversa WhatsApp */}
      {showNovaConversa && (
        <NovaConversaModal onClose={() => setShowNovaConversa(false)} />
      )}

      {/* Modal de novo lead */}
      {newLeadCol && (
        <NewLeadModal deptId={current.dept} columnSlug={newLeadCol}
          onClose={() => setNewLeadCol(null)}
          onCreated={() => { setNewLeadCol(null); cards.reload(); }} />
      )}

      {/* Painel de detalhe lateral */}
      {selectedCard && (
        <CardDetailPanel
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onUpdated={(next) => {
            cards.reload();
            setSelectedCard(next);
          }}
        />
      )}
    </div>
  );
}

// Plus icon usado no header da coluna
function PlusIcon() {
  return <Plus size={11} />;
}

// ─── Modal de novo lead (cria card direto na coluna) ──────────────────
function NewLeadModal({ deptId, columnSlug, onClose, onCreated }: {
  deptId: string; columnSlug: string; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [cidade, setCidade] = useState("");
  const [produto, setProduto] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = title.trim();
    if (!t) { alert("Nome obrigatório"); return; }
    setBusy(true);
    try {
      const r = await supabase.from("kanban_cards").insert({
        dept_id: deptId, column_id: columnSlug, title: t,
        details: {
          nome: t, contato_principal: t,
          celular: phone.replace(/\D/g, "") || null,
          cidade: cidade || null,
          produto_interesse: produto || null,
        },
      });
      if (r.error) { alert("Erro: " + r.error.message); return; }
      onCreated();
    } finally { setBusy(false); }
  };
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-pk-raisinBlack/60 backdrop-blur-[2px]" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[440px] max-w-[100vw] bg-pk-bg border border-pk-border shadow-2xl">
        <div className="border-b border-pk-border px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-1">{columnSlug.toUpperCase()}</div>
            <h2 className="font-display text-[14px] uppercase tracking-[0.14em]">NOVO LEAD</h2>
          </div>
          <button onClick={onClose} className="p-1 text-pk-textDim hover:text-pk-text">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <FormField label="NOME *">
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-pk-bg border border-pk-border px-3 py-2 text-[12px] text-pk-text outline-none focus:border-pk-accent" />
          </FormField>
          <FormField label="TELEFONE">
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 99999-9999"
              className="w-full bg-pk-bg border border-pk-border px-3 py-2 text-[12px] font-mono text-pk-text outline-none focus:border-pk-accent" />
          </FormField>
          <FormField label="CIDADE">
            <input value={cidade} onChange={(e) => setCidade(e.target.value)}
              className="w-full bg-pk-bg border border-pk-border px-3 py-2 text-[12px] text-pk-text outline-none focus:border-pk-accent" />
          </FormField>
          <FormField label="PRODUTO DE INTERESSE">
            <input value={produto} onChange={(e) => setProduto(e.target.value)}
              placeholder="Piso · Painel · Deck..."
              className="w-full bg-pk-bg border border-pk-border px-3 py-2 text-[12px] text-pk-text outline-none focus:border-pk-accent" />
          </FormField>
          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={busy || !title.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-pk-accent text-pk-bg text-[10px] uppercase tracking-[0.20em] font-semibold disabled:opacity-40">
              {busy && <Loader2 size={11} className="animate-spin" />}
              CRIAR LEAD
            </button>
            <button onClick={onClose}
              className="px-5 py-2.5 border border-pk-border text-pk-textDim text-[10px] uppercase tracking-[0.20em]">
              CANCELAR
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[7px] uppercase tracking-[0.22em] text-pk-textDim mb-1.5 font-semibold">{label}</div>
      {children}
    </div>
  );
}

// Cor por etapa — paleta brand SO Parket (cores fixas por slug)
const STAGE_COLOR: Record<string, string> = {
  // SDR (comercial-entrada)
  "leads-entrada":          "morningBlue",
  "triagem-ia":             "morningBlue",
  "contato-inicial":        "navy",
  "follow-up-1":            "shadow",
  "follow-up-2":            "shadow",
  "follow-up-3":            "walnut",
  "em-qualificacao":        "shadow",
  "qualificado":            "olive",
  "nao-qualificado":        "walnut",
  // Vendedor (comercial)
  "novas-oportunidades":    "morningBlue",
  "em-briefing":            "shadow",
  "criacao-orcamento":      "wood",
  "apresentacao-proposta":  "navy",
  "em-negociacao":          "olive",
  "ganho":                  "olive",
  "perda":                  "walnut",
  "lembretes":              "navy",
};

const COLOR_VAR: Record<string, string> = {
  morningBlue: "rgb(var(--pk-morningBlue))",
  navy:        "rgb(var(--pk-navy))",
  shadow:      "rgb(var(--pk-shadow))",
  olive:       "rgb(var(--pk-olive))",
  walnut:      "rgb(var(--pk-walnut))",
  wood:        "rgb(var(--pk-wood))",
  moss:        "rgb(var(--pk-moss))",
};

// ─── Coluna do kanban ────────────────────────────────────────────────
function KanbanColumnUI({ col, cards, onCardClick, onNewLead }: {
  col: KanbanColumn; cards: KanbanCard[]; onCardClick: (c: KanbanCard) => void;
  onNewLead: (slug: string) => void;
}) {
  const total = cards.reduce((s, c) => s + parseValueText(c.value), 0);
  const colorKey = STAGE_COLOR[col.slug] || "morningBlue";
  const colorVar = COLOR_VAR[colorKey];
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.slug}` });
  return (
    <div ref={setNodeRef}
      className={`w-[260px] shrink-0 flex flex-col transition rounded-none ${
        isOver ? "bg-pk-text/[0.04]" : ""
      }`}
      style={isOver ? { outline: `1px dashed ${colorVar}`, outlineOffset: -2 } : {}}>
      {/* Header da coluna */}
      <div className="border-b border-pk-border pb-2 mb-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-3" style={{ background: colorVar }} />
          <span className="text-[8px] uppercase tracking-[0.20em] font-medium text-pk-text flex-1">
            {col.title}
          </span>
          <span className="text-[8px] uppercase tracking-[0.12em] tabular px-1.5 py-0.5 bg-pk-panel border border-pk-border text-pk-textDim">
            {cards.length}
          </span>
          <button onClick={() => onNewLead(col.slug)} title="Novo card"
            className="p-1 text-pk-textDim hover:text-pk-accent hover:bg-pk-text/[0.05] transition">
            <PlusIcon />
          </button>
        </div>
        {total > 0 && (
          <div className="text-[8px] uppercase tracking-[0.16em] text-pk-cream pl-3">
            {fmtBRLCompact(total)}
          </div>
        )}
      </div>

      {/* Cards — SortableContext permite reorder vertical dentro da coluna */}
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5 min-h-[40px]">
          {cards.length === 0 ? (
            <div className={`text-[8px] uppercase tracking-[0.18em] text-pk-textDim text-center py-6 border border-dashed transition ${
              isOver ? "border-pk-text/30 bg-pk-text/[0.03]" : "border-pk-border"
            }`}>
              {isOver ? "SOLTAR AQUI" : "VAZIO"}
            </div>
          ) : (
            cards.map((c) => <KanbanCardUI key={c.id} card={c} onClick={() => onCardClick(c)} />)
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── Overlay do card sendo arrastado (visual leve seguindo cursor) ──
function DraggingCardOverlay({ card }: { card: KanbanCard }) {
  const det = card.details || {};
  const nome = det.contato_principal || det.nome || card.title || "(sem nome)";
  const produto = det.produto_interesse;
  return (
    <div className="w-[260px] bg-pk-panel border border-pk-accent shadow-2xl p-2.5 rotate-2 cursor-grabbing"
      style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.6)" }}>
      <div className="text-[11px] text-pk-text font-medium leading-tight">{nome}</div>
      {produto && (
        <div className="text-[9px] text-pk-textDim mt-1 uppercase tracking-[0.04em]">{produto}</div>
      )}
    </div>
  );
}

// Etapas finais — SLA não conta nelas
const FINAL_STAGES = new Set(["ganho", "perda", "nao-qualificado", "cancelado"]);

// ─── Card do kanban ──────────────────────────────────────────────────
function KanbanCardUI({ card, onClick }: { card: KanbanCard; onClick: () => void }) {
  const det = card.details || {};
  const nome = det.contato_principal || det.nome || card.title || "(sem nome)";
  const produto = det.produto_interesse;
  const cidade = det.cidade;
  const metragem = det.metragem_estimada || det.area_m2 || det.metragem;
  const valor = parseValueText(det.valor_orcamento_enviado || card.value || "");
  const isHot = (card.tags || []).some((t) => /quente|hot|urgent/i.test(t));

  // SLA: dias parado em etapa ativa
  const lastUpdate = new Date(card.updated_at || card.created_at || 0).getTime();
  const diasParado = lastUpdate ? Math.floor((Date.now() - lastUpdate) / 86400000) : 0;
  const isFinal = FINAL_STAGES.has(card.column_id);
  const slaWarn = !isFinal && diasParado >= 4 && diasParado < 7;
  const slaAtrasado = !isFinal && diasParado >= 7;

  // Sortable — permite drag entre colunas E reorder vertical dentro da mesma coluna
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  // Borda esquerda colorida indica SLA
  const slaBar = slaAtrasado ? "rgb(var(--pk-walnut))" : slaWarn ? "rgb(var(--pk-shadow))" : "transparent";

  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      onClick={onClick}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        borderLeftColor: slaBar,
        borderLeftWidth: slaBar !== "transparent" ? 2 : 1,
      }}
      className={`bg-pk-text/[0.025] hover:bg-pk-text/[0.048] border border-pk-text/[0.08] hover:border-pk-text/[0.18] transition-colors cursor-grab active:cursor-grabbing p-2.5 ${
        isDragging ? "opacity-30" : ""
      }`}>
      {/* Topo */}
      <div className="flex items-start gap-2 mb-1.5">
        {isHot && <Flame size={10} className="text-pk-walnut shrink-0 mt-0.5" />}
        <div className="text-[11px] text-pk-text font-medium leading-tight flex-1 line-clamp-2">
          {nome}
        </div>
      </div>

      {/* Meta */}
      {produto && (
        <div className="text-[9px] text-pk-textDim mb-1 leading-snug line-clamp-1 uppercase tracking-[0.04em]">
          {produto}
        </div>
      )}

      {/* Linha bottom */}
      <div className="flex items-center gap-2 mt-2 text-[8px] uppercase tracking-[0.14em] text-pk-textDim">
        {cidade && (
          <span className="flex items-center gap-1 truncate">
            <MapPin size={8} />{cidade}
          </span>
        )}
        {metragem && (
          <span className="flex items-center gap-1">
            <Ruler size={8} />{metragem}m²
          </span>
        )}
      </div>

      {/* Vendedor + valor */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-pk-border">
        <span className="text-[8px] uppercase tracking-[0.14em] text-pk-textDim truncate flex-1">
          {card.responsavel || "—"}
        </span>
        {valor > 0 && (
          <span className="text-[9px] tabular text-pk-cream font-semibold ml-2 whitespace-nowrap">
            {fmtBRLCompact(valor)}
          </span>
        )}
      </div>

      {/* Última atividade + SLA */}
      <div className="flex items-center gap-1.5 mt-1.5 text-[8px] uppercase tracking-[0.14em]">
        <ArrowRight size={8} className="text-pk-textDim" />
        <span className="text-pk-textDim">{fmtRelative(card.updated_at || card.created_at)}</span>
        {(slaWarn || slaAtrasado) && (
          <span className="ml-auto flex items-center gap-1 px-1 py-px font-semibold tracking-[0.10em]"
            style={{ color: slaAtrasado ? "rgb(var(--pk-walnut))" : "rgb(var(--pk-shadow))" }}>
            <AlertTriangle size={8} /> {diasParado}D
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard & KPIs do Comercial ────────────────────────────────────
function ComercialDashboard({ cards, cols, dept }: {
  cards: KanbanCard[]; cols: KanbanColumn[]; dept: string;
}) {
  const stats = useMemo(() => {
    const total = cards.length;
    const final = (s: string) => /ganho|perda|cancelado|nao-qualif/.test(s);
    const ganhos = cards.filter((c) => c.column_id === "ganho").length;
    const perdas = cards.filter((c) => c.column_id === "perda" || c.column_id === "nao-qualificado").length;
    const ativos = cards.filter((c) => !final(c.column_id || "")).length;
    const valorTotal = cards
      .filter((c) => !final(c.column_id || ""))
      .reduce((s, c) => s + parseValueText(c.value || ""), 0);
    const valorGanho = cards.filter((c) => c.column_id === "ganho").reduce((s, c) => s + parseValueText(c.value || ""), 0);
    const winRate = (ganhos + perdas) > 0 ? (ganhos / (ganhos + perdas)) * 100 : 0;
    const ticket = ganhos > 0 ? valorGanho / ganhos : 0;
    // Por etapa
    const porEtapa = cols.map((col) => ({
      slug: col.slug, title: col.title,
      count: cards.filter((c) => resolveSlug(c.column_id, cols) === col.slug).length,
    }));
    return { total, ativos, ganhos, perdas, valorTotal, valorGanho, winRate, ticket, porEtapa };
  }, [cards, cols]);

  const maxCount = Math.max(1, ...stats.porEtapa.map((x) => x.count));

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-[1100px] mx-auto space-y-6">
        <div>
          <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-2">DASHBOARD · COMERCIAL</div>
          <h2 className="font-display text-[20px] uppercase tracking-[0.14em] font-medium">PERFORMANCE DO FUNIL</h2>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px]">
          <KpiBox label="ATIVOS"        value={stats.ativos.toString()} />
          <KpiBox label="GANHOS"        value={stats.ganhos.toString()} accent="olive" />
          <KpiBox label="PERDAS"        value={stats.perdas.toString()} accent="walnut" />
          <KpiBox label="WIN RATE"      value={`${stats.winRate.toFixed(1)}%`} />
          <KpiBox label="VALOR NA MESA" value={fmtBRLCompact(stats.valorTotal)} accent="olive" />
          <KpiBox label="RECEITA GANHA" value={fmtBRLCompact(stats.valorGanho)} accent="olive" />
          <KpiBox label="TICKET MÉDIO"  value={fmtBRLCompact(stats.ticket)} />
          <KpiBox label="TOTAL CARDS"   value={stats.total.toString()} />
        </div>

        {/* Funil por etapa */}
        <div>
          <SectionLabel>FUNIL POR ETAPA</SectionLabel>
          <div className="space-y-1 mt-3">
            {stats.porEtapa.map((e) => {
              const w = Math.max(6, (e.count / maxCount) * 100);
              const colorKey = STAGE_COLOR[e.slug] || "morningBlue";
              const c = COLOR_VAR[colorKey];
              return (
                <div key={e.slug} className="flex items-center gap-3">
                  <div className="w-40 text-[10px] text-pk-text uppercase tracking-[0.06em] text-right pr-2 truncate">{e.title}</div>
                  <div className="flex-1 h-6 relative">
                    <div className="h-full flex items-center px-2 transition-all"
                      style={{ width: `${w}%`, background: `${c}40`, border: `1px solid ${c}`, minWidth: 38 }}>
                      <span className="text-[10px] tabular text-pk-text font-semibold">{e.count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiBox({ label, value, accent }: { label: string; value: string; accent?: "olive" | "walnut" }) {
  const color = accent === "olive" ? "text-pk-olive" : accent === "walnut" ? "text-pk-walnut" : "text-pk-text";
  return (
    <div className="border border-pk-border bg-pk-text/[0.025] px-5 py-4 flex flex-col gap-2">
      <div className="text-[8px] uppercase tracking-[0.20em] text-pk-textDim">{label}</div>
      <div className={`font-display tabular text-[24px] leading-none font-medium ${color}`}>{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-3 border-t border-pk-border">
      <div className="w-3 h-3 bg-pk-accent" />
      <span className="text-[8px] uppercase tracking-[0.22em] text-pk-textSecondary text-pk-text font-medium">{children}</span>
    </div>
  );
}

// ─── Modal Showroom — agendar visita sem precisar de card vinculado ──
function ShowroomModal({ vendedor, onClose }: { vendedor: string; onClose: () => void }) {
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [cliente, setCliente] = useState("");
  const [data, setData] = useState(ymd);
  const [hora, setHora] = useState("10:00");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!cliente.trim()) { alert("Nome do cliente obrigatório"); return; }
    setBusy(true);
    try {
      const r = await supabase.from("agendamentos").insert({
        cliente_nome: cliente.trim(), vendedor, data,
        hora_inicio: `${hora}:00`,
        modalidade: "presencial", endereco: "Casa Parket — Showroom",
        observacoes: obs.trim() || null, status: "agendado",
      });
      if (r.error) { alert("Erro: " + r.error.message); return; }
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[60] bg-pk-raisinBlack/70 backdrop-blur-[2px]" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[440px] max-w-[100vw] bg-pk-bg border border-pk-border shadow-2xl">
        <div className="border-b border-pk-border px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-1">AGENDAR · CASA PARKET</div>
            <h2 className="font-display text-[14px] uppercase tracking-[0.14em]">VISITA SHOWROOM</h2>
          </div>
          <button onClick={onClose} className="p-1 text-pk-textDim hover:text-pk-text"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <FormField label="CLIENTE *">
            <input autoFocus value={cliente} onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome do cliente"
              className="w-full bg-pk-bg border border-pk-border px-3 py-2 text-[12px] outline-none focus:border-pk-accent" />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="DATA">
              <input type="date" value={data} onChange={(e) => setData(e.target.value)}
                className="w-full bg-pk-bg border border-pk-border px-3 py-2 text-[11px] outline-none focus:border-pk-accent" />
            </FormField>
            <FormField label="HORA">
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)}
                className="w-full bg-pk-bg border border-pk-border px-3 py-2 text-[11px] outline-none focus:border-pk-accent" />
            </FormField>
          </div>
          <FormField label="OBSERVAÇÕES">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
              placeholder="Contexto, produtos de interesse..."
              className="w-full bg-pk-bg border border-pk-border px-3 py-2 text-[11px] outline-none focus:border-pk-accent" />
          </FormField>
          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={busy || !cliente.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-pk-accent text-pk-bg text-[10px] uppercase tracking-[0.20em] font-semibold disabled:opacity-40">
              {busy && <Loader2 size={11} className="animate-spin" />}
              AGENDAR
            </button>
            <button onClick={onClose} className="px-5 py-2.5 border border-pk-border text-pk-textDim text-[10px] uppercase tracking-[0.20em]">
              CANCELAR
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Pill toggle group (estilo Space v1) ──────────────────────────────
function PillToggle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex border border-pk-text/[0.08] overflow-hidden">
      {children}
    </div>
  );
}

function PillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3.5 py-1.5 text-[9px] uppercase tracking-[0.14em] font-semibold transition border-0 ${
        active
          ? "bg-pk-accent text-pk-bg"
          : "bg-pk-text/[0.025] text-pk-textDim hover:text-pk-text hover:bg-pk-text/[0.045]"
      }`}>
      {children}
    </button>
  );
}

function FilterSelect({ value, onChange, children, minWidth }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; minWidth?: number;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="bg-pk-text/[0.025] border border-pk-text/[0.08] px-2 py-1.5 text-[9px] uppercase tracking-[0.08em] text-pk-text outline-none focus:border-pk-accent cursor-pointer font-medium appearance-none"
      style={{
        minWidth: minWidth || 150,
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%2377736A' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", paddingRight: 24,
      }}>
      {children}
    </select>
  );
}

// ─── Modal Nova Conversa — abre WhatsApp pra novo número ──────────────
function NovaConversaModal({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const submit = () => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) { alert("Telefone obrigatório"); return; }
    const intl = digits.startsWith("55") ? digits : "55" + digits;
    const url = `https://wa.me/${intl}${msg.trim() ? `?text=${encodeURIComponent(msg.trim())}` : ""}`;
    window.open(url, "_blank");
    onClose();
  };
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[60] bg-pk-raisinBlack/70 backdrop-blur-[2px]" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[420px] max-w-[100vw] bg-pk-bg border border-pk-border shadow-2xl">
        <div className="border-b border-pk-border px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-1">WHATSAPP</div>
            <h2 className="font-display text-[14px] uppercase tracking-[0.14em]">NOVA CONVERSA</h2>
          </div>
          <button onClick={onClose} className="p-1 text-pk-textDim hover:text-pk-text"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <FormField label="TELEFONE *">
            <input autoFocus value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 99999-9999"
              className="w-full bg-pk-bg border border-pk-border px-3 py-2 text-[12px] font-mono outline-none focus:border-pk-accent"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          </FormField>
          <FormField label="MENSAGEM INICIAL (OPCIONAL)">
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3}
              placeholder="Oi! Sou da Parket..."
              className="w-full bg-pk-bg border border-pk-border px-3 py-2 text-[11px] outline-none focus:border-pk-accent" />
          </FormField>
          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={!phone.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-pk-olive text-pk-bg text-[10px] uppercase tracking-[0.20em] font-semibold disabled:opacity-40">
              <MessageCircle size={11} /> ABRIR WHATSAPP
            </button>
            <button onClick={onClose} className="px-5 py-2.5 border border-pk-border text-pk-textDim text-[10px] uppercase tracking-[0.20em]">
              CANCELAR
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Views auxiliares — wireups dos items da sidebar ──────────────────

function ViewShell({ title, breadcrumb, children, onBack }: {
  title: string; breadcrumb?: string; onBack: () => void; children: React.ReactNode;
}) {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-1">{breadcrumb || "COMERCIAL"}</div>
            <h2 className="font-display text-[20px] uppercase tracking-[0.14em] font-medium">{title}</h2>
          </div>
          <button onClick={onBack}
            className="text-[9px] uppercase tracking-[0.18em] text-pk-textDim hover:text-pk-text border border-pk-border px-3 py-1.5">
            ← VOLTAR PRO KANBAN
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Ranking & Closers — top vendedores ───────────────────────────────
function RankingView({ cards }: { cards: KanbanCard[] }) {
  const ranking = useMemo(() => {
    const m = new Map<string, { ganhos: number; total: number; valor: number }>();
    cards.forEach((c) => {
      const r = (c.responsavel || "").trim();
      if (!r) return;
      const cur = m.get(r) || { ganhos: 0, total: 0, valor: 0 };
      cur.total += 1;
      if (c.column_id === "ganho") {
        cur.ganhos += 1;
        cur.valor += parseValueText(c.value || "");
      }
      m.set(r, cur);
    });
    return [...m.entries()]
      .map(([nome, v]) => ({ nome, ...v, win: v.total > 0 ? (v.ganhos / v.total) * 100 : 0 }))
      .filter((x) => x.total >= 1)
      .sort((a, b) => b.ganhos - a.ganhos || b.valor - a.valor);
  }, [cards]);
  const maxGanhos = Math.max(1, ...ranking.map((r) => r.ganhos));
  return (
    <ViewShell title="RANKING & CLOSERS" breadcrumb="ESPECIFICO · COMERCIAL" onBack={() => history.back()}>
      <div className="border border-pk-text/[0.08] bg-pk-text/[0.025]">
        <div className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-pk-text/[0.08] text-[8px] uppercase tracking-[0.20em] text-pk-textDim font-semibold">
          <div className="col-span-1">#</div>
          <div className="col-span-4">VENDEDOR</div>
          <div className="col-span-4">GANHOS</div>
          <div className="col-span-1 text-right tabular">CARDS</div>
          <div className="col-span-2 text-right tabular">RECEITA</div>
        </div>
        {ranking.length === 0 ? (
          <div className="text-[9px] uppercase tracking-[0.20em] text-pk-textDim text-center py-12">SEM DADOS</div>
        ) : ranking.map((r, i) => (
          <div key={r.nome} className="grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-pk-text/[0.04] items-center text-[11px]">
            <div className="col-span-1 font-display tabular text-pk-textDim">{String(i + 1).padStart(2, "0")}</div>
            <div className="col-span-4 text-pk-text truncate">{r.nome}</div>
            <div className="col-span-4 flex items-center gap-2">
              <div className="flex-1 h-3 bg-pk-text/[0.04] relative">
                <div className="absolute inset-y-0 left-0 bg-pk-olive" style={{ width: `${(r.ganhos / maxGanhos) * 100}%` }} />
              </div>
              <span className="text-[10px] tabular text-pk-olive font-semibold w-6 text-right">{r.ganhos}</span>
            </div>
            <div className="col-span-1 text-right tabular text-pk-textDim">{r.total}</div>
            <div className="col-span-2 text-right tabular text-pk-cream font-semibold">{fmtBRLCompact(r.valor)}</div>
          </div>
        ))}
      </div>
    </ViewShell>
  );
}

// ─── Agenda Showroom — lista de agendamentos presenciais ──────────────
function AgendaShowroomView() {
  const [ags, setAgs] = useState<any[] | null>(null);
  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const r = await supabase.from("agendamentos")
        .select("id, vendedor, cliente_nome, data, hora_inicio, hora_fim, endereco, status, observacoes")
        .eq("modalidade", "presencial").gte("data", ymd).neq("status", "cancelado")
        .order("data", { ascending: true }).order("hora_inicio", { ascending: true })
        .limit(80);
      setAgs(r.data || []);
    })();
  }, []);
  return (
    <ViewShell title="AGENDA SHOWROOM" breadcrumb="ESPECIFICO · COMERCIAL" onBack={() => history.back()}>
      {!ags ? (
        <div className="flex justify-center py-8"><Loader2 size={14} className="animate-spin text-pk-accent" /></div>
      ) : ags.length === 0 ? (
        <div className="text-[9px] uppercase tracking-[0.20em] text-pk-textDim text-center py-12 border border-dashed border-pk-border">SEM AGENDAMENTOS PRESENCIAIS</div>
      ) : (
        <div className="space-y-2">
          {ags.map((a) => {
            const d = new Date(a.data + "T00:00:00");
            const dia = String(d.getDate()).padStart(2, "0");
            const meses = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
            return (
              <div key={a.id} className="flex items-center gap-4 p-4 border border-pk-text/[0.08] bg-pk-text/[0.025]">
                <div className="w-12 text-center shrink-0">
                  <div className="font-display text-[20px] text-pk-text leading-none">{dia}</div>
                  <div className="text-[8px] uppercase tracking-[0.16em] text-pk-textDim mt-1">{meses[d.getMonth()]}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-pk-text font-medium">{a.cliente_nome || "(sem nome)"}</div>
                  <div className="text-[9px] uppercase tracking-[0.10em] text-pk-textDim mt-0.5">
                    {a.hora_inicio?.slice(0, 5)} · {a.vendedor} {a.endereco && `· ${a.endereco}`}
                  </div>
                  {a.observacoes && <div className="text-[10px] text-pk-textDim italic mt-1 truncate">{a.observacoes}</div>}
                </div>
                <span className="text-[8px] uppercase tracking-[0.18em] border border-pk-border px-2 py-1 text-pk-textDim">{(a.status || "—").toUpperCase()}</span>
              </div>
            );
          })}
        </div>
      )}
    </ViewShell>
  );
}

// ─── Tabela de Preços — orcamento_tabela_precos ───────────────────────
function PrecosView() {
  const [precos, setPrecos] = useState<any[] | null>(null);
  const [busca, setBusca] = useState("");
  useEffect(() => {
    (async () => {
      const r = await supabase.from("orcamento_tabela_precos")
        .select("id, categoria, subtipo, especie, dimensao_label, mao_obra_label, preco, ativo")
        .eq("ativo", true).gt("preco", 0)
        .order("categoria").order("especie").limit(800);
      setPrecos(r.data || []);
    })();
  }, []);
  const filtered = (precos || []).filter((p) => {
    if (!busca.trim()) return true;
    const s = busca.toLowerCase();
    return `${p.categoria} ${p.subtipo} ${p.especie} ${p.dimensao_label}`.toLowerCase().includes(s);
  });
  return (
    <ViewShell title="TABELA DE PREÇOS" breadcrumb="RECURSOS · COMERCIAL" onBack={() => history.back()}>
      <div className="mb-3">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar categoria, espécie, dimensão..."
          className="w-full bg-pk-text/[0.025] border border-pk-text/[0.08] px-3 py-2 text-[11px] outline-none focus:border-pk-accent" />
      </div>
      {!precos ? (
        <div className="flex justify-center py-8"><Loader2 size={14} className="animate-spin text-pk-accent" /></div>
      ) : (
        <div className="border border-pk-text/[0.08] bg-pk-text/[0.025]">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-pk-text/[0.08] text-[8px] uppercase tracking-[0.20em] text-pk-textDim font-semibold sticky top-0 bg-pk-bg z-10">
            <div className="col-span-3">CATEGORIA</div>
            <div className="col-span-2">SUBTIPO</div>
            <div className="col-span-3">ESPÉCIE</div>
            <div className="col-span-2">DIMENSÃO</div>
            <div className="col-span-2 text-right">PREÇO/m²</div>
          </div>
          <div style={{ maxHeight: "60vh", overflow: "auto" }}>
            {filtered.length === 0 ? (
              <div className="text-[9px] uppercase tracking-[0.20em] text-pk-textDim text-center py-12">NENHUM PREÇO</div>
            ) : filtered.map((p) => (
              <div key={p.id} className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-pk-text/[0.04] items-center text-[10px]">
                <div className="col-span-3 text-pk-text uppercase tracking-[0.04em]">{p.categoria}</div>
                <div className="col-span-2 text-pk-textDim">{p.subtipo || "—"}</div>
                <div className="col-span-3 text-pk-text">{p.especie || "—"}</div>
                <div className="col-span-2 text-pk-textDim font-mono">{p.dimensao_label || "—"}</div>
                <div className="col-span-2 text-right tabular text-pk-cream font-semibold">{fmtBRLCompact(Number(p.preco) || 0)}</div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-pk-text/[0.08] text-[8px] uppercase tracking-[0.20em] text-pk-textDim">
            {filtered.length} {filtered.length === 1 ? "ITEM" : "ITENS"}
            {filtered.length !== (precos?.length || 0) && ` · DE ${precos?.length}`}
          </div>
        </div>
      )}
    </ViewShell>
  );
}

// ─── Scripts WhatsApp — templates de mensagem ─────────────────────────
function ScriptsView() {
  // Templates hardcoded (depois pode virar tabela `scripts`)
  const scripts = [
    { titulo: "QUALIFICAR LEAD NOVO", texto: "Oi {{nome}}! 👋 Sou da Parket. Vi seu interesse em {{produto}}.\n\nPra te ajudar melhor:\n· Qual é a metragem aproximada do projeto?\n· Em qual cidade fica?\n· Tem prazo de instalação?" },
    { titulo: "AGENDAR VISITA SHOWROOM", texto: "{{nome}}, que tal conhecer nosso showroom em São Paulo? Trabalhamos com madeira de alta qualidade e você pode ver as peças de perto.\n\nTenho disponível:\n· {{data1}} às {{hora1}}\n· {{data2}} às {{hora2}}\n\nQual fica melhor?" },
    { titulo: "ENVIO DE ORÇAMENTO", texto: "{{nome}}, segue o orçamento personalizado pro seu projeto: {{link_proposta}}\n\nDúvidas? Estou à disposição." },
    { titulo: "FOLLOW-UP — SEM RETORNO", texto: "Oi {{nome}}, tudo bem? Passando pra saber se conseguiu avaliar nossa proposta. Posso ajudar com alguma dúvida?" },
    { titulo: "REATIVAR LEAD FRIO", texto: "{{nome}}! Lembra da gente lá da Parket? Estamos com novas opções de {{produto}} que podem te interessar.\n\nQuer dar uma olhada?" },
    { titulo: "FECHAR NEGÓCIO", texto: "{{nome}}, ficamos felizes com seu interesse 🤝\n\nPra fechar:\n1. Confirme metragem final\n2. Escolha condição de pagamento\n3. Assinaremos o contrato pelo DocuSign\n\nSegue link: {{link_contrato}}" },
  ];
  return (
    <ViewShell title="SCRIPTS WHATSAPP" breadcrumb="RECURSOS · COMERCIAL" onBack={() => history.back()}>
      <div className="space-y-3">
        {scripts.map((s, i) => (
          <div key={i} className="border border-pk-text/[0.08] bg-pk-text/[0.025] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-pk-cream font-semibold">{s.titulo}</div>
              <button onClick={() => navigator.clipboard.writeText(s.texto)}
                className="text-[8px] uppercase tracking-[0.20em] px-2 py-1 border border-pk-text/[0.15] text-pk-textDim hover:text-pk-text">
                COPIAR
              </button>
            </div>
            <pre className="text-[11px] text-pk-text leading-relaxed whitespace-pre-wrap font-sans">{s.texto}</pre>
          </div>
        ))}
        <div className="text-[8px] uppercase tracking-[0.18em] text-pk-textDim text-center pt-4">
          VARIÁVEIS &#123;&#123;NOME&#125;&#125;, &#123;&#123;PRODUTO&#125;&#125;, ETC SÃO SUBSTITUÍDAS PELO COPILOTO IA
        </div>
      </div>
    </ViewShell>
  );
}

// ─── Performance Individual — KPIs do user logado ─────────────────────
function PerformanceView({ cards, appUser }: { cards: KanbanCard[]; appUser: AppUser }) {
  const me = (appUser.nome || "").toLowerCase();
  const meus = useMemo(() => cards.filter((c) => {
    return (c.responsavel || "").toLowerCase() === me ||
           (c.details?.sdr || "").toLowerCase() === me;
  }), [cards, me]);
  const ganhos = meus.filter((c) => c.column_id === "ganho").length;
  const perdas = meus.filter((c) => c.column_id === "perda" || c.column_id === "nao-qualificado").length;
  const ativos = meus.length - ganhos - perdas;
  const winRate = (ganhos + perdas) > 0 ? (ganhos / (ganhos + perdas)) * 100 : 0;
  const valorAtivo = meus.filter((c) => !/ganho|perda|nao-qualif|cancelado/.test(c.column_id || ""))
    .reduce((s, c) => s + parseValueText(c.value || ""), 0);
  const valorGanho = meus.filter((c) => c.column_id === "ganho")
    .reduce((s, c) => s + parseValueText(c.value || ""), 0);
  const ticket = ganhos > 0 ? valorGanho / ganhos : 0;
  return (
    <ViewShell title={`PERFORMANCE · ${(appUser.nome || appUser.email).toUpperCase()}`} breadcrumb="EQUIPE · COMERCIAL" onBack={() => history.back()}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px]">
        <KpiBox label="MEUS CARDS"     value={meus.length.toString()} />
        <KpiBox label="ATIVOS"         value={ativos.toString()} />
        <KpiBox label="GANHOS"         value={ganhos.toString()} accent="olive" />
        <KpiBox label="PERDAS"         value={perdas.toString()} accent="walnut" />
        <KpiBox label="WIN RATE"       value={`${winRate.toFixed(1)}%`} />
        <KpiBox label="VALOR ATIVO"    value={fmtBRLCompact(valorAtivo)} />
        <KpiBox label="RECEITA GANHA"  value={fmtBRLCompact(valorGanho)} accent="olive" />
        <KpiBox label="TICKET MÉDIO"   value={fmtBRLCompact(ticket)} />
      </div>
      <div className="mt-6 text-[9px] uppercase tracking-[0.18em] text-pk-textDim">
        BASEADO EM {meus.length} CARDS ONDE VOCÊ É VENDEDOR OU SDR
      </div>
    </ViewShell>
  );
}

// ─── Placeholder pras views ainda não implementadas ───────────────────
function PlaceholderView({ view, onBack }: { view: string; onBack: () => void }) {
  const titles: Record<string, string> = {
    relatorio: "RELATÓRIO SEMANAL",
    catalogo: "CATÁLOGO DE PRODUTOS",
    argumentario: "ARGUMENTÁRIO",
    metas: "METAS DO MÊS",
    treinamentos: "TREINAMENTOS",
  };
  const breadcrumbs: Record<string, string> = {
    relatorio: "ESPECIFICO · COMERCIAL",
    catalogo: "RECURSOS · COMERCIAL",
    argumentario: "RECURSOS · COMERCIAL",
    metas: "EQUIPE · COMERCIAL",
    treinamentos: "EQUIPE · COMERCIAL",
  };
  return (
    <ViewShell title={titles[view] || view.toUpperCase()} breadcrumb={breadcrumbs[view]} onBack={onBack}>
      <div className="flex items-center justify-center py-24 border border-dashed border-pk-border">
        <div className="text-center max-w-md">
          <div className="font-display text-[14px] uppercase tracking-[0.20em] mb-2 text-pk-cream">EM CONSTRUÇÃO</div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-pk-textDim leading-relaxed">
            Esta seção será implementada em uma próxima onda.<br/>
            Por enquanto, use o link abaixo pra acessar no Space v1.
          </p>
          <a href={`https://space.parket.works/comercial?view=${view}`} target="_blank" rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.20em] text-pk-accent no-underline px-3 py-1.5 border border-pk-accent">
            ABRIR NO SPACE V1 →
          </a>
        </div>
      </div>
    </ViewShell>
  );
}

// ─── Barra de KPIs por etapa principal + ações ───────────────────────
function StageKpisBar({ cards, cols, onNovoLead }: {
  cards: KanbanCard[]; cols: KanbanColumn[]; onNovoLead: () => void;
}) {
  // 5 etapas-chave (espelha o Space v1)
  const KEY_STAGES = ["novas-oportunidades", "criacao-orcamento", "em-negociacao", "ganho", "perda"];
  const stats = KEY_STAGES.map((slug) => {
    const col = cols.find((c) => c.slug === slug);
    const count = cards.filter((c) => c.column_id === slug).length;
    const colorKey = STAGE_COLOR[slug] || "morningBlue";
    return { slug, label: col?.title || slug, count, color: COLOR_VAR[colorKey] };
  });
  return (
    <div className="border-b border-pk-border bg-pk-bg/40 px-6 py-2.5 shrink-0 flex items-center gap-2 flex-wrap">
      {stats.map((s) => (
        <div key={s.slug} className="flex items-baseline gap-2 px-3 py-1.5 border border-pk-text/[0.08] bg-pk-text/[0.025]">
          <span className="font-display tabular text-[16px] font-medium" style={{ color: s.color }}>{s.count}</span>
          <span className="text-[8px] uppercase tracking-[0.16em] text-pk-textDim">{s.label}</span>
        </div>
      ))}
      <div className="flex-1" />
      <button onClick={onNovoLead}
        className="flex items-center gap-2 px-3 py-1.5 border border-pk-accent/40 bg-pk-accent/10 text-pk-accent hover:bg-pk-accent/20 text-[9px] uppercase tracking-[0.18em] font-semibold transition">
        <Plus size={12} /> NOVO LEAD
      </button>
      <button title="Gerenciar colunas (em construção)"
        className="flex items-center gap-2 px-3 py-1.5 border border-pk-cream/30 bg-pk-cream/10 text-pk-cream hover:bg-pk-cream/20 text-[9px] uppercase tracking-[0.18em] font-semibold transition">
        <Settings size={11} /> COLUNAS
      </button>
    </div>
  );
}
